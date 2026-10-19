/**
 * The shopping list: one list for anything to buy, kept on the account in `shopping_items` (only the owner can read or
 * change a row; supabase/migrations/20261019130000_promises_shopping_rules.sql). The assistant adds, ticks and removes
 * items by voice; the Shopping list screen shows the same rows.
 */

import { supabaseFetch } from '@/constants/supabase';
import type { ItemDraft } from '@/services/assistant/everyday';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  done: boolean;
  created_at: string;
}

const TABLE = '/rest/v1/shopping_items';
const COLUMNS = 'id,name,quantity,done,created_at';

async function check(res: Response, what: string): Promise<void> {
  if (!res.ok) throw new Error(`${what} (${res.status})`);
}

export async function listItems(token: string): Promise<ShoppingItem[]> {
  const res = await supabaseFetch(`${TABLE}?select=${COLUMNS}&order=done.asc,created_at.asc&limit=300`, {}, token);
  await check(res, 'The shopping list could not be loaded');
  return (await res.json()) as ShoppingItem[];
}

/** Adds what is not on the list yet (an item already there and bought is put back as still to buy). */
export async function addItems(token: string, drafts: ItemDraft[]): Promise<{ added: string[]; already: string[] }> {
  const have = await listItems(token);
  const added: string[] = [];
  const already: string[] = [];
  const fresh: ItemDraft[] = [];
  for (const d of drafts) {
    const same = have.find((i) => i.name.toLowerCase() === d.name.toLowerCase());
    if (!same) {
      fresh.push(d);
      added.push(d.name);
    } else if (same.done) {
      await setDone(token, [same.id], false);
      added.push(d.name);
    } else {
      already.push(d.name);
    }
  }
  if (fresh.length) {
    const res = await supabaseFetch(TABLE, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fresh.map((d) => ({ name: d.name, quantity: d.quantity }))) }, token);
    await check(res, 'That could not be added');
  }
  return { added, already };
}

const ids = (list: string[]) => `(${list.map((i) => `"${i}"`).join(',')})`;

export async function setDone(token: string, itemIds: string[], done: boolean): Promise<void> {
  if (!itemIds.length) return;
  const res = await supabaseFetch(`${TABLE}?id=in.${encodeURIComponent(ids(itemIds))}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ done, updated_at: new Date().toISOString() }) }, token);
  await check(res, 'The list could not be changed');
}

export async function removeItems(token: string, itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const res = await supabaseFetch(`${TABLE}?id=in.${encodeURIComponent(ids(itemIds))}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
  await check(res, 'That could not be removed');
}

/** Clears the bought items, or (all = true) the whole list. */
export async function clearItems(token: string, all: boolean): Promise<void> {
  const res = await supabaseFetch(`${TABLE}?${all ? 'id=not.is.null' : 'done=eq.true'}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
  await check(res, 'The list could not be cleared');
}
