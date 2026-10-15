/**
 * Typed helpers over Supabase's REST (PostgREST) and RPC endpoints.
 *
 * Screens used to build every request by hand and parse the JSON themselves, which meant each call site repeated the
 * same `res.ok` / `res.json()` dance and silently cast the result. These helpers keep the query strings explicit (they
 * are part of the contract with the database) but centralise the response handling: a non-2xx answer becomes a
 * `SupabaseRestError` carrying the status and the server's message, and the body comes back already typed.
 *
 * Nothing here retries or refreshes the session: pass a token from `useAuth().getValidSession()`.
 */

import { parseApiError, supabaseFetch } from '@/constants/supabase';

export class SupabaseRestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'SupabaseRestError';
  }
}

type Token = string | null | undefined;

async function throwIfNotOk(res: Response, path: string): Promise<void> {
  if (res.ok) return;
  throw new SupabaseRestError(await parseApiError(res), res.status, path);
}

/** GET `/rest/v1/<table>?<query>` and return the rows. */
export async function fetchRows<T>(path: string, token?: Token): Promise<T[]> {
  const res = await supabaseFetch(path, {}, token);
  await throwIfNotOk(res, path);
  const rows = (await res.json()) as T[] | null;
  return rows ?? [];
}

/** GET and return the first row, or null when there is none. Add `limit=1` to the query yourself. */
export async function fetchOne<T>(path: string, token?: Token): Promise<T | null> {
  const rows = await fetchRows<T>(path, token);
  return rows[0] ?? null;
}

/** POST one or more rows. Returns the inserted rows (with `Prefer: return=representation`). */
export async function insertRows<T, B = Partial<T>>(path: string, body: B | B[], token?: Token): Promise<T[]> {
  const res = await supabaseFetch(
    path,
    { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) },
    token,
  );
  await throwIfNotOk(res, path);
  const rows = (await res.json()) as T[] | null;
  return rows ?? [];
}

/** PATCH the rows the query selects. Returns the updated rows. */
export async function updateRows<T, B = Partial<T>>(path: string, body: B, token?: Token): Promise<T[]> {
  const res = await supabaseFetch(
    path,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) },
    token,
  );
  await throwIfNotOk(res, path);
  const rows = (await res.json()) as T[] | null;
  return rows ?? [];
}

/** DELETE the rows the query selects. */
export async function deleteRows(path: string, token?: Token): Promise<void> {
  const res = await supabaseFetch(path, { method: 'DELETE' }, token);
  await throwIfNotOk(res, path);
}

/** Call a Postgres function through `/rest/v1/rpc/<name>`. */
export async function callRpc<T>(name: string, args: Record<string, unknown>, token?: Token): Promise<T> {
  const path = `/rest/v1/rpc/${name}`;
  const res = await supabaseFetch(path, { method: 'POST', body: JSON.stringify(args) }, token);
  await throwIfNotOk(res, path);
  return (await res.json()) as T;
}
