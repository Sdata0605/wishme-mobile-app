import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pickModels } from "../_shared/geminiModels.ts";

/**
 * quote-cards — THE DAY'S QUOTE AND ITS PICTURES (2026-10-19, ported from MyAssistant quotecards/service.js).
 *
 *   POST {}  (app login)  -> { date, text, status: 'ready' | 'generating' | 'off', total, cards: [
 *                              { style, label, ink, font, scrim, place, url, width, height } ] }
 *
 * The server owns the day's line: once per India day it writes a NEW motivational line (never one already used) and makes
 * one TEXT-FREE picture per style. Every user gets the same line and the same files; nobody's tap costs a generation. The
 * words are set on the phone in real fonts over the picture (image models misspell words), and the phone renders the PNG
 * that is shared. Pictures still missing are made in the background after the answer; the app asks again every few
 * seconds while it shows "generating". Once today is complete, tomorrow is prepared, so midnight never waits.
 *
 * Tables and bucket: supabase/migrations/20261019121000_quote_cards.sql. QUOTE_CARDS=off stops all generation (the line
 * then comes from the fallback list, with no pictures).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const API = "https://generativelanguage.googleapis.com/v1beta";
const BUCKET = "quote-cards";

/** The app's own list (services/home/dailyQuote.ts) — used when the model cannot write a line, picking one not used yet. */
const FALLBACK = [
  "Do the hard one first. The rest of the day gets easier.",
  "Start before you feel ready — readiness comes from starting.",
  "One hour of real work beats a day of getting ready to work.",
  "The task you keep moving down the list is the one to do now.",
  "Finish something today. Anything.",
  "Send it. A good thing shipped beats a perfect thing waiting.",
  "Decide now. A made decision frees the mind a pending one occupies.",
  "You do not need motivation. You need the first five minutes.",
  "Pick the call you are dreading and make it.",
  "Close one open loop before you open another.",
  "Your future self is watching. Give them something to work with.",
  "Show up today whether you feel like it or not — that is the whole trick.",
  "The work you avoid is usually the work that pays.",
  "Say no to one thing today so you can finish another.",
  "Do it badly, then make it better. Nothing improves in your head.",
  "Two hard hours today are worth ten distracted ones tomorrow.",
  "The day is yours until someone else spends it. Spend it first.",
  "Stop planning it. Open it and begin.",
  "Momentum is built, not found. Build some before lunch.",
  "Answer the message you have been avoiding.",
  "Effort compounds quietly, then all at once.",
  "Do today what your excuses are saving for tomorrow.",
  "Small and finished beats big and imagined.",
  "Discipline is choosing what you want most over what you want now.",
  "Every day you delay, the task grows. Take it while it is small.",
];

/** The divine picture rotates through these, one a day. */
const DEITIES = [
  "Lord Ganesha", "Lord Krishna", "Lord Shiva", "Goddess Lakshmi", "Lord Hanuman",
  "Lord Rama", "Goddess Saraswati", "Lord Venkateswara", "Goddess Durga", "Lord Murugan",
];

interface Style {
  id: string;
  label: string;
  /** The colour the phone sets the words in. */
  ink: string;
  font: "serif" | "sans";
  /** How the phone darkens (or, for a light picture, lightens) the middle so the words read. */
  scrim: "dark" | "light";
  /** 'lower' when the subject fills the top of the picture: the words then sit in the lower half. */
  place?: "lower";
  look: (day: { deity: string }) => string;
}

/** Every prompt asks for a calm, empty centre — that is where the words go. */
const STYLES: Style[] = [
  {
    id: "divine", label: "Divine", ink: "#FFF6E0", font: "serif", scrim: "dark", place: "lower",
    look: (d) =>
      `${d.deity}, serene and benevolent, soft divine golden light, glowing brass diyas, lotus flowers, temple atmosphere, ` +
      `warm saffron and gold tones, devotional painting, the figure in the upper part of the frame, calm uncluttered lower half`,
  },
  {
    id: "sunrise", label: "Sunrise", ink: "#FFFFFF", font: "sans", scrim: "dark",
    look: () =>
      "misty mountain ridges at sunrise, layered silhouettes, sun just above the horizon, soft orange, rose and violet sky, " +
      "hopeful and calm, wide open sky in the centre",
  },
  {
    id: "nature", label: "Nature", ink: "#FFFFFF", font: "serif", scrim: "dark",
    look: () =>
      "sunlit forest path in early morning, tall trees, rays of light through mist, fresh green and gold, peaceful, soft " +
      "depth of field, open bright centre",
  },
  {
    id: "ocean", label: "Ocean", ink: "#FFFFFF", font: "sans", scrim: "dark",
    look: () =>
      "calm ocean at golden hour, gentle waves, wide horizon, warm reflections on the water, deep teal and amber, minimal " +
      "and spacious, empty sky in the centre",
  },
  {
    id: "neon", label: "Neon", ink: "#FFFFFF", font: "sans", scrim: "dark",
    look: () =>
      "dark city street at night after rain, glowing neon reflections in magenta and cyan, soft bokeh, cinematic, high " +
      "contrast, dark empty space in the centre",
  },
  {
    id: "watercolor", label: "Watercolour", ink: "#2A2433", font: "serif", scrim: "light",
    look: () =>
      "delicate watercolour flowers in soft pastel pink, peach and sage on textured off-white paper, blooms only around the " +
      "edges, a large clean empty paper centre",
  },
  {
    id: "cosmic", label: "Cosmic", ink: "#FFFFFF", font: "sans", scrim: "dark",
    look: () => "deep space nebula in violet, blue and rose, scattered stars, soft glow, dreamy and vast, darker calm area in the centre",
  },
];

const FORMAT = { width: 1080, height: 1350 };
/** A picture someone started this long ago and never finished is started again. */
const STUCK_MS = 4 * 60_000;
/** A failed picture is tried again after this long, so a dead provider is not hammered. */
const RETRY_AFTER_MS = 30 * 60_000;

const on = () => (Deno.env.get("QUOTE_CARDS") ?? "on").toLowerCase() !== "off";

/** YYYY-MM-DD for India, offset by `plusDays`. */
function indiaDate(plusDays = 0, now = Date.now()): string {
  return new Date(now + 5.5 * 3_600_000 + plusDays * 86_400_000).toISOString().slice(0, 10);
}

/** A stable small number from a date, for the deity and the fallback pick. */
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/** Lower-cased letters only — "Start now." and "start now" are one line. */
const norm = (s: string) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function geminiKey(db: SupabaseClient): Promise<string> {
  const { data } = await db.rpc("ai_secret_get", { p_name: "ai_gemini_api_key" });
  return (typeof data === "string" && data) || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GEMINI_API_KEY") || "";
}

// ── The line ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const SYSTEM =
  "You write one motivational line for the home screen of a personal assistant app used by busy people in India. A " +
  "motivational line asks for action — start, finish, decide, send, do the hard thing first — it is read at 8 a.m. by " +
  "someone putting their day off. Rules: one or two short sentences, 6 to 18 words, plain English, original (not a famous " +
  "quote, no author), no hashtags, no emoji, no exclamation marks, no quotation marks, nothing religious, political or " +
  'about money. Never repeat or closely paraphrase a line in `used`. Answer JSON only: {"line": "..."}';

async function writeLine(apiKey: string, date: string, used: string[]): Promise<string> {
  const seen = new Set(used.map(norm));
  if (apiKey) {
    for (const model of await pickModels(apiKey, Deno.env.get("QUOTE_MODEL") || undefined)) {
      try {
        const res = await fetch(`${API}/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify({ date, used: used.slice(-120) }) }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) continue;
        const body = await res.json();
        const raw = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        let line = "";
        try {
          line = String(JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()).line ?? "");
        } catch {
          line = raw;
        }
        line = line.replace(/["“”]/g, "").replace(/!/g, ".").replace(/\s+/g, " ").trim();
        // A line always ends with a full stop.
        if (line && !/[.?…]$/.test(line)) line += ".";
        const words = line.split(" ").length;
        if (words >= 5 && words <= 24 && line.length <= 160 && !seen.has(norm(line))) return line;
        console.log("quote cards: model line rejected —", line.slice(0, 80));
      } catch (e) {
        console.log("quote cards: model line failed —", e instanceof Error ? e.message.slice(0, 120) : e);
      }
    }
  }
  const fresh = FALLBACK.filter((l) => !seen.has(norm(l)));
  const pool = fresh.length ? fresh : FALLBACK;
  return pool[dayNumber(date) % pool.length];
}

/** The day's record, writing the line if the day has none yet. */
async function ensureDay(db: SupabaseClient, apiKey: string, date: string): Promise<{ day: string; text: string; deity: string }> {
  const { data: have } = await db.from("daily_quotes").select("day, text, deity").eq("day", date).maybeSingle();
  if (have?.text) return have;
  const { data: history } = await db.from("daily_quotes").select("text").order("day", { ascending: true }).limit(1000);
  const text = await writeLine(apiKey, date, (history ?? []).map((h) => String(h.text)));
  const row = { day: date, text, deity: DEITIES[dayNumber(date) % DEITIES.length] };
  // Two first requests racing: the first one's line stands.
  await db.from("daily_quotes").upsert(row, { onConflict: "day", ignoreDuplicates: true });
  const { data: stored } = await db.from("daily_quotes").select("day, text, deity").eq("day", date).single();
  return stored ?? row;
}

// ── The pictures ──────────────────────────────────────────────────────────────────────────────────────────────────────

let imageModelCache: { at: number; ids: string[] } | null = null;

/** Gemini models that answer generateContent with a picture, stable before preview. */
async function imageModels(apiKey: string): Promise<string[]> {
  if (imageModelCache && Date.now() - imageModelCache.at < 60 * 60_000) return imageModelCache.ids;
  let ids: string[] = [];
  try {
    const res = await fetch(`${API}/models?key=${apiKey}&pageSize=200`, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const body = await res.json();
      ids = ((body.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((id) => /^gemini-.*image/.test(id))
        .sort((a, b) => Number(/preview/.test(a)) - Number(/preview/.test(b)) || b.localeCompare(a));
    }
  } catch {
    /* the known name below */
  }
  if (!ids.length) ids = ["gemini-2.5-flash-image"];
  imageModelCache = { at: Date.now(), ids: ids.slice(0, 3) };
  return imageModelCache.ids;
}

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const PROMPT_TAIL =
  ". Portrait 4:5 poster background. Absolutely no text, letters, words, numbers, logos, signatures or watermarks anywhere " +
  "in the image. High quality, rich detail, soft and balanced composition.";

async function makePicture(apiKey: string, prompt: string): Promise<{ bytes: Uint8Array; mime: string; provider: string }> {
  const errors: string[] = [];
  if (apiKey) {
    for (const model of await imageModels(apiKey)) {
      try {
        const res = await fetch(`${API}/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt + PROMPT_TAIL }] }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } },
          }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) {
          errors.push(`${model} ${res.status}`);
          continue;
        }
        const body = await res.json();
        const part = (body.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
        if (part) return { bytes: decode(part.inlineData.data), mime: part.inlineData.mimeType || "image/png", provider: model };
        errors.push(`${model} returned no image`);
      } catch (e) {
        errors.push(`${model} ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  }
  // The same backstop generate-image-promotion uses.
  const openrouter = Deno.env.get("OPENROUTER_API_KEY");
  if (openrouter) {
    for (const model of ["google/gemini-2.5-flash-image", "google/gemini-2.5-flash-image-preview"]) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers: { Authorization: `Bearer ${openrouter}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: prompt + PROMPT_TAIL, aspect_ratio: "4:5" }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) {
          errors.push(`openrouter ${model} ${res.status}`);
          continue;
        }
        const item = (await res.json())?.data?.[0];
        if (typeof item?.b64_json === "string" && item.b64_json) {
          return { bytes: decode(item.b64_json), mime: item.media_type || "image/png", provider: `openrouter ${model}` };
        }
        if (typeof item?.url === "string" && item.url) {
          const img = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
          if (img.ok) return { bytes: new Uint8Array(await img.arrayBuffer()), mime: img.headers.get("content-type") || "image/png", provider: `openrouter ${model}` };
        }
        errors.push(`openrouter ${model} returned no image`);
      } catch (e) {
        errors.push(`openrouter ${model} ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  }
  throw new Error(errors.join("; ") || "no image provider");
}

interface ImageRow { style: string; status: string; path: string | null; updated_at: string }

/** The styles of `date` that need a picture now: none yet, stuck, or failed long enough ago. */
function todo(rows: ImageRow[], now = Date.now()): Style[] {
  const by = new Map(rows.map((r) => [r.style, r]));
  return STYLES.filter((s) => {
    const r = by.get(s.id);
    if (!r) return true;
    const age = now - Date.parse(r.updated_at);
    if (r.status === "pending") return age > STUCK_MS;
    if (r.status === "failed") return age > RETRY_AFTER_MS;
    return false;
  });
}

/** Claims the styles (so another request does not make them too), then makes them two at a time. */
async function generate(db: SupabaseClient, apiKey: string, date: string): Promise<void> {
  if (!on()) return;
  const day = await ensureDay(db, apiKey, date);
  const { data } = await db.from("daily_quote_images").select("style, status, path, updated_at").eq("day", date);
  const queue = todo((data ?? []) as ImageRow[]);
  if (!queue.length) return;
  const startedAt = new Date().toISOString();
  await db.from("daily_quote_images").upsert(
    queue.map((s) => ({ day: date, style: s.id, status: "pending", updated_at: startedAt })),
    { onConflict: "day,style" },
  );
  const worker = async () => {
    while (queue.length) {
      const s = queue.shift()!;
      try {
        const img = await makePicture(apiKey, s.look(day));
        const ext = img.mime.includes("jpeg") || img.mime.includes("jpg") ? "jpg" : img.mime.includes("webp") ? "webp" : "png";
        const path = `${date}/${s.id}.${ext}`;
        const { error } = await db.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: true, cacheControl: "604800" });
        if (error) throw new Error(error.message);
        await db.from("daily_quote_images").update({ status: "ready", path, provider: img.provider, updated_at: new Date().toISOString() }).eq("day", date).eq("style", s.id);
        console.log(`quote cards: ${date} ${s.id} via ${img.provider}`);
      } catch (e) {
        await db.from("daily_quote_images").update({ status: "failed", updated_at: new Date().toISOString() }).eq("day", date).eq("style", s.id);
        console.log(`quote cards: ${date} ${s.id} failed —`, e instanceof Error ? e.message.slice(0, 160) : e);
      }
    }
  };
  await Promise.all([worker(), worker()]);
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

/** Keeps the work running after the answer has gone. */
function background(p: Promise<unknown>) {
  const safe = p.catch((e) => console.log("quote cards: background failed —", e instanceof Error ? e.message : e));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(safe);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const date = indiaDate();
    if (!on()) return json({ date, text: FALLBACK[dayNumber(date) % FALLBACK.length], status: "off", total: 0, cards: [] });

    const apiKey = await geminiKey(db);
    const day = await ensureDay(db, apiKey, date);
    const { data } = await db.from("daily_quote_images").select("style, status, path, updated_at").eq("day", date);
    const rows = (data ?? []) as ImageRow[];
    const cards = STYLES.flatMap((s) => {
      const r = rows.find((x) => x.style === s.id && x.status === "ready" && x.path);
      if (!r) return [];
      const url = db.storage.from(BUCKET).getPublicUrl(r.path!).data.publicUrl;
      return [{
        style: s.id, label: s.label, ink: s.ink, font: s.font, scrim: s.scrim, place: s.place ?? "center",
        url: `${url}?v=${Date.parse(r.updated_at)}`, width: FORMAT.width, height: FORMAT.height,
      }];
    });
    const missing = todo(rows);
    const making = rows.some((r) => r.status === "pending" && Date.now() - Date.parse(r.updated_at) <= STUCK_MS);
    if (missing.length) background(generate(db, apiKey, date));
    // Today is complete: prepare tomorrow, so midnight never waits on a generation.
    else if (!making) background(generate(db, apiKey, indiaDate(1)));

    return json({
      date,
      text: day.text,
      status: missing.length || making ? "generating" : "ready",
      total: STYLES.length,
      cards,
    });
  } catch (e) {
    console.log("quote-cards failed:", e instanceof Error ? e.message : e);
    return json({ error: "The quote did not load. Try again in a moment." }, 500);
  }
});
