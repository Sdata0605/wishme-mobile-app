import { createClient } from "npm:@supabase/supabase-js@2";
import { daily, geminiKey, saidAgain, supersede, type MemRow } from "../_shared/memoryLearning.ts";

/**
 * memory-learn — the memory that learns (2026-10-19; see _shared/memoryLearning.ts).
 *
 *   POST { action: 'remembered', id }     after remember_fact saved a NEW fact: retire the facts it replaces
 *   POST { action: 'said_again', id }     remember_fact was told a fact it already had: it grows stronger
 *   POST { action: 'daily' }              once a day per user: decay, consolidation, habits (does nothing if done today)
 *   -> { ok, ... }
 *
 * For the logged-in caller only. The user's "learn facts" switch is respected. Nothing here is on the answer's path: the
 * app calls it and does not wait.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f-]{36}$/i;

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

    if (Deno.env.get("AI_MEMORY_LEARNING")?.match(/^(off|0|false|no)$/i)) return json({ ok: true, skipped: "learning off" });
    const { data: prefs } = await db.from("assistant_memory_settings").select("learn_facts").eq("user_id", user.id).maybeSingle();
    if (prefs && prefs.learn_facts === false) return json({ ok: true, skipped: "switched off" });

    const action = String(body?.action ?? "");
    const apiKey = await geminiKey(db);

    if (action === "remembered" || action === "said_again") {
      const id = String(body?.id ?? "");
      if (!UUID.test(id)) return json({ error: "id is required" }, 400);
      const { data: row } = await db
        .from("assistant_memories")
        .select("id, subject, fact, category, person, source, strength, uses, evidence, created_at")
        .eq("user_id", user.id)
        .eq("id", id)
        .maybeSingle();
      if (!row) return json({ error: "Memory not found" }, 404);
      if (action === "said_again") {
        await saidAgain(db, user.id, [id]);
        return json({ ok: true });
      }
      const retired = apiKey ? await supersede(db, apiKey, user.id, row as MemRow) : [];
      return json({ ok: true, retired });
    }

    if (action === "daily") return json({ ok: true, ...(await daily(db, apiKey, user.id)) });

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.log("memory-learn failed:", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "memory-learn failed" }, 500);
  }
});
