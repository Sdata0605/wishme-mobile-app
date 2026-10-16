import { parseApiError, supabaseFetch } from '@/constants/supabase';

/** Tries per order. A busy server, a dropped connection or an expired token almost always works on the next go. */
const MAX_ATTEMPTS = 3;
/** Slower than the app's usual 20 s: a phone on a weak connection should not give up while the order is being saved. */
const ORDER_TIMEOUT_MS = 45_000;

/**
 * Places an order through a database function (these save the order and take the money in one step), and keeps
 * the user from ever seeing a hiccup:
 *  - an expired login, a busy server (5xx / 429) or a dropped connection is retried, up to 3 tries;
 *  - before repeating after a dropped connection, `findCreated` looks for the order the first try may already have
 *    saved, so one order is never paid for twice;
 *  - a real refusal (not enough balance, celebrity unavailable...) is shown straight away, with its reason.
 */
export async function placeOrder<T>({
  rpc,
  body,
  getToken,
  findCreated,
}: {
  rpc: string;
  body: unknown;
  /** A login token that is valid right now (refreshes an old one). */
  getToken: () => Promise<string | null>;
  /** An order this user already created since `since`, if the earlier try got through. */
  findCreated: (token: string, since: string) => Promise<T | null>;
}): Promise<T> {
  const since = new Date(Date.now() - 5_000).toISOString();
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise<void>(r => setTimeout(r, 1200 * (attempt - 1)));

    const token = await getToken();
    if (!token) throw new Error('Please sign in again.');

    let res: Response;
    try {
      res = await supabaseFetch(`/rest/v1/rpc/${rpc}`, { method: 'POST', body: JSON.stringify(body) }, token, ORDER_TIMEOUT_MS);
    } catch {
      // The connection dropped or timed out: the order may have been saved anyway.
      lastError = 'The connection dropped.';
      try {
        const done = await findCreated(token, since);
        if (done) return done;
      } catch {
        // could not check; go round again
      }
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const message = await parseApiError(res);
    lastError = message;
    const transient = res.status >= 500 || res.status === 429 || res.status === 401;
    if (!transient) throw new Error(message);
  }

  throw new Error(`${lastError} We tried ${MAX_ATTEMPTS} times. Please check My orders before trying again, so you are not charged twice.`);
}
