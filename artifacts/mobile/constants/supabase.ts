export const SUPABASE_URL = 'https://eqikeuqwbphwongtfzhe.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWtldXF3YnBod29uZ3RmemhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDU3MjgsImV4cCI6MjA3MzkyMTcyOH0.OTmxqFKhXiHcEKoV0uuRCvhmkHkKGHNo-n7qpl_tW1Y';

export async function supabaseFetch(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<Response> {
  const bearerToken = accessToken ?? SUPABASE_ANON_KEY;
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
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
