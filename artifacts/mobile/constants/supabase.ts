export const SUPABASE_URL = 'https://eqikeuqwbphwongtfzhe.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWtldXF3YnBod29uZ3RmemhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDU3MjgsImV4cCI6MjA3MzkyMTcyOH0.OTmxqFKhXiHcEKoV0uuRCvhmkHkKGHNo-n7qpl_tW1Y';

const FETCH_TIMEOUT_MS = 20_000;

export async function supabaseFetch(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<Response> {
  const bearerToken = accessToken ?? SUPABASE_ANON_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
