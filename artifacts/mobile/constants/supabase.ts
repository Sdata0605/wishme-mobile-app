/**
 * Supabase connection and the one fetch wrapper every request goes through.
 *
 * The URL and anon key can be overridden per build with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
 * (see .env.example), so a staging project can be used without editing code. Expo inlines these at bundle time,
 * which is why they are read with the full `process.env.EXPO_PUBLIC_*` spelling and not destructured.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eqikeuqwbphwongtfzhe.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWtldXF3YnBod29uZ3RmemhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDU3MjgsImV4cCI6MjA3MzkyMTcyOH0.OTmxqFKhXiHcEKoV0uuRCvhmkHkKGHNo-n7qpl_tW1Y';

/** WebSocket base for realtime and voice relays: https → wss, and http → ws for a local backend. */
export const SUPABASE_WS_URL = SUPABASE_URL.replace(/^http/, 'ws');

const FETCH_TIMEOUT_MS = 20_000;

export async function supabaseFetch(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
  /** Slow calls (AI generation takes well over 20 s) pass their own limit. */
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const bearerToken = accessToken ?? SUPABASE_ANON_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) ?? {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (
      data.error_description ||
      data.error ||
      data.message ||
      data.msg ||
      `Request failed (${res.status})`
    );
  } catch {
    return `Request failed (${res.status})`;
  }
}

let warmedAt = 0;

/**
 * Opens the connection (DNS + TLS) and wakes the sign-up edge functions before the user needs them.
 * Called when the sign-in screen appears, so the first real request skips that setup.
 */
export function warmUpBackend(): void {
  if (Date.now() - warmedAt < 60_000) return;
  warmedAt = Date.now();
  const headers = { apikey: SUPABASE_ANON_KEY };
  fetch(`${SUPABASE_URL}/auth/v1/health`, { headers }).catch(() => {});
  // OPTIONS returns immediately but still boots the function's worker.
  for (const fn of ['send-email-otp', 'verify-email-otp']) {
    fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'OPTIONS', headers }).catch(() => {});
  }
}
