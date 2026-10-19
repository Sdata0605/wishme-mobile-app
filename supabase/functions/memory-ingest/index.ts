import { createClient } from "npm:@supabase/supabase-js@2";
import { chunkLines, embedTexts, extractFacts, vectorLiteral, type Line } from "../_shared/memoryCore.ts";
import { learnFromConversation, saidAgain } from "../_shared/memoryLearning.ts";

/**
 * memory-ingest — saves a finished conversation (or an AI call) to the assistant's long-term memory.
 *
 *   POST { source: 'assistant', session_id, started_at?, lines: [{ role: 'user'|'assistant', text, at? }] }
 *   POST { source: 'call', call_id }                      (the lines are read from the call's own saved transcript)
 *   -> { ok, conversation_id, lines, chunks, facts, replaced } or { ok: true, skipped: reason }
 *
 * What it does, for the logged-in caller only:
 *   1. keeps the exact lines (assistant_conversations + assistant_messages),
 *   2. cuts them into short passages and embeds each one so it can be found by meaning (memory_chunks),
 *   3. asks Gemini for the lasting facts in them (family, goals, plans, follow-ups...) and saves those with a category,
 *      replacing facts they correct, and never saving the same fact twice (a fact told again grows stronger instead),
 *   4. learns from it (_shared/memoryLearning.ts): facts the assistant's answers drew on grow stronger, and facts the user
 *      contradicted lose standing.
 * Saving the same session twice does nothing. The user's two switches (save chats, learn facts) are respected.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_LINES = 400;
const MAX_TEXT = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const [{ data: { user }, error: authError }, body] = await Promise.all([userClient.auth.getUser(), req.json().catch(() => ({}))]);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const source: "assistant" | "call" = body?.source === "call" ? "call" : "assistant";
    const { data: prefs } = await db.from("assistant_memory_settings").select("save_chats, learn_facts").eq("user_id", user.id).maybeSingle();
    const saveChats = prefs?.save_chats ?? true;
    const learnFacts = prefs?.learn_facts ?? true;
    if (!saveChats && !learnFacts) return json({ ok: true, skipped: "switched off" });

    // ── The lines ────────────────────────────────────────────────────────────────────────────────────────────────────────
    let lines: Line[] = [];
    let ref = "";
    let person: string | null = null;
    let startedAt = new Date();
    let endedAt: Date | null = null;

    if (source === "call") {
      ref = String(body?.call_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(ref)) return json({ error: "call_id is required" }, 400);
      const { data: call } = await db
        .from("ai_calls")
        .select("id, user_id, to_name, to_phone, started_at, ended_at, created_at, transcript, summary, status")
        .eq("id", ref)
        .maybeSingle();
      if (!call || call.user_id !== user.id) return json({ error: "Call not found" }, 404);
      person = call.to_name || null;
      startedAt = new Date(call.started_at ?? call.created_at ?? Date.now());
      endedAt = call.ended_at ? new Date(call.ended_at) : null;
      const { data: rows } = await db.from("ai_call_lines").select("role, message, seq, created_at").eq("call_id", ref).order("seq", { ascending: true }).limit(MAX_LINES);
      lines = (rows ?? []).map((r) => ({ role: r.role as Line["role"], text: String(r.message ?? ""), at: r.created_at as string }));
      if (!lines.length && call.transcript) {
        // Older calls only have the whole transcript as text ("AI: ..." / "User: ...").
        lines = String(call.transcript)
          .split(/\n+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => ({ role: (/^(ai|assistant|bot)\b/i.test(t) ? "assistant" : "user") as Line["role"], text: t.replace(/^(ai|assistant|bot|user|human|customer)\s*:\s*/i, "") }))
          .slice(0, MAX_LINES);
      }
    } else {
      ref = String(body?.session_id ?? "").slice(0, 80);
      if (!ref) return json({ error: "session_id is required" }, 400);
      if (Array.isArray(body?.lines)) {
        lines = (body.lines as Record<string, unknown>[])
          .map((l) => ({ role: (l.role === "assistant" ? "assistant" : "user") as Line["role"], text: String(l.text ?? "").slice(0, MAX_TEXT), at: typeof l.at === "string" ? l.at : undefined }))
          .filter((l) => l.text.trim())
          .slice(0, MAX_LINES);
      }
      if (body?.started_at && !Number.isNaN(Date.parse(body.started_at))) startedAt = new Date(body.started_at);
    }

    if (!lines.some((l) => l.role === "user" && l.text.trim().length > 1)) {
      // Nothing the user said. A call is still marked as handled, so it is not tried again and again.
      if (source === "call") {
        await db.from("assistant_conversations").upsert(
          { user_id: user.id, source, source_ref: ref, person_name: person, started_at: startedAt.toISOString(), ended_at: endedAt?.toISOString() ?? null, line_count: 0 },
          { onConflict: "user_id,source,source_ref", ignoreDuplicates: true },
        );
      }
      return json({ ok: true, skipped: "nothing said" });
    }

    // ── Already saved? ───────────────────────────────────────────────────────────────────────────────────────────────────
    const { data: already } = await db.from("assistant_conversations").select("id").eq("user_id", user.id).eq("source", source).eq("source_ref", ref).maybeSingle();
    if (already) return json({ ok: true, skipped: "already saved", conversation_id: already.id });

    // ── The Gemini key ───────────────────────────────────────────────────────────────────────────────────────────────────
    const { data: vault } = await db.rpc("ai_secret_get", { p_name: "ai_gemini_api_key" });
    const apiKey = (typeof vault === "string" && vault) || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GEMINI_API_KEY") || "";

    let conversationId: string | null = null;
    let chunkCount = 0;
    if (saveChats) {
      const { data: conv, error: convError } = await db
        .from("assistant_conversations")
        .insert({ user_id: user.id, source, source_ref: ref, person_name: person, started_at: startedAt.toISOString(), ended_at: endedAt?.toISOString() ?? null, line_count: lines.length })
        .select("id")
        .single();
      if (convError) {
        // Two saves of the same session racing: the second one simply loses.
        if (/duplicate|unique/i.test(convError.message)) return json({ ok: true, skipped: "already saved" });
        throw convError;
      }
      conversationId = conv.id as string;

      const msgRows = lines.map((l, i) => ({ conversation_id: conversationId, user_id: user.id, role: l.role, message: l.text, seq: i, at: l.at && !Number.isNaN(Date.parse(l.at)) ? l.at : startedAt.toISOString() }));
      for (let i = 0; i < msgRows.length; i += 200) {
        const { error } = await db.from("assistant_messages").insert(msgRows.slice(i, i + 200));
        if (error) throw error;
      }

      const chunks = chunkLines(lines, source, person, startedAt);
      let vectors: number[][] = [];
      if (apiKey && chunks.length) {
        try {
          vectors = await embedTexts(apiKey, chunks.map((c) => c.content), "RETRIEVAL_DOCUMENT");
        } catch (e) {
          console.log("memory-ingest: embeddings failed, saving passages for keyword search only:", e instanceof Error ? e.message : e);
        }
      }
      const chunkRows = chunks.map((c, i) => ({
        user_id: user.id,
        conversation_id: conversationId,
        source,
        person_name: person,
        occurred_at: c.at.toISOString(),
        content: c.content,
        embedding: vectors[i] ? vectorLiteral(vectors[i]) : null,
      }));
      for (let i = 0; i < chunkRows.length; i += 50) {
        const { error } = await db.from("memory_chunks").insert(chunkRows.slice(i, i + 50));
        if (error) throw error;
      }
      chunkCount = chunkRows.length;
    }

    // ── The lasting facts ────────────────────────────────────────────────────────────────────────────────────────────────
    let saved = 0;
    let replaced = 0;
    if (learnFacts && apiKey) {
      const { data: existing } = await db
        .from("assistant_memories")
        .select("id, subject, fact")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(80);
      const facts = await extractFacts(
        apiKey,
        lines,
        { source, person, today: new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) },
        (existing ?? []) as { id: string; subject: string; fact: string }[],
      );
      const have = new Map((existing ?? []).map((m) => [`${String(m.subject).toLowerCase()}|${String(m.fact).toLowerCase()}`, String(m.id)]));
      const fresh = facts.filter((f) => !have.has(`${f.subject.toLowerCase()}|${f.fact.toLowerCase()}`));
      // Said again: the same fact a second time is evidence it matters.
      const again = [...new Set(facts.map((f) => have.get(`${f.subject.toLowerCase()}|${f.fact.toLowerCase()}`)).filter((id): id is string => !!id))];
      if (again.length) await saidAgain(db, user.id, again);
      if (fresh.length) {
        let vectors: number[][] = [];
        try {
          vectors = await embedTexts(apiKey, fresh.map((f) => `${f.subject}: ${f.fact}`), "RETRIEVAL_DOCUMENT");
        } catch {
          /* saved without a vector: still found by words */
        }
        const { error } = await db.from("assistant_memories").insert(
          fresh.map((f, i) => ({
            user_id: user.id,
            subject: f.subject,
            fact: f.fact,
            category: f.category,
            person: f.person,
            event_date: f.event_date,
            source: source === "call" ? "call" : "chat",
            source_id: conversationId ?? ref,
            embedding: vectors[i] ? vectorLiteral(vectors[i]) : null,
          })),
        );
        if (error) throw error;
        saved = fresh.length;
        const gone = [...new Set(fresh.flatMap((f) => f.supersedes))];
        if (gone.length) {
          const { error: delError } = await db.from("assistant_memories").delete().eq("user_id", user.id).in("id", gone);
          if (!delError) replaced = gone.length;
        }
      }
    }

    // What the assistant's answers drew on, and what the user put right. Only a conversation with the assistant: on a call
    // the other side is someone else.
    let learned = { used: 0, weakened: 0 };
    if (learnFacts && source === "assistant") learned = await learnFromConversation(db, apiKey, user.id, lines);

    return json({ ok: true, conversation_id: conversationId, lines: lines.length, chunks: chunkCount, facts: saved, replaced, ...learned });
  } catch (e) {
    console.log("memory-ingest failed:", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "memory-ingest failed" }, 500);
  }
});
