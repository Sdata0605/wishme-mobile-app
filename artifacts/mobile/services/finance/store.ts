/**
 * The user's money map: expected incomes, EMIs and recurring expenses.
 *
 * Like documents, this lives on the phone (AsyncStorage, one ledger per signed-in user) rather than on the server.
 * It survives restarts but not reinstalling the app. "Plan with the assistant" hands the whole ledger to the
 * assistant as text, so it needs nothing from a backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type FinKind = 'emi' | 'income' | 'expense';

export interface FinItem {
  id: string;
  kind: FinKind;
  name: string;
  /** Per month, in rupees. */
  amount: number;
  /** EMIs only: % per year. */
  interestRate: number | null;
  /** Day of the month it hits, 1-31. */
  dueDay: number | null;
  /** EMIs only: principal still owed. */
  outstanding: number | null;
  createdAt: string;
}

export interface FinSummary {
  monthlyIncome: number;
  monthlyEmi: number;
  monthlyExpense: number;
  /** In minus out. Negative means spending more than coming in. */
  surplus: number;
  totalDebt: number;
}

const key = (uid: string) => `finance.ledger.v1:${uid}`;

export async function loadItems(uid: string): Promise<FinItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    return raw ? (JSON.parse(raw) as FinItem[]) : [];
  } catch {
    return [];
  }
}

async function save(uid: string, items: FinItem[]): Promise<void> {
  await AsyncStorage.setItem(key(uid), JSON.stringify(items));
}

export async function addItem(uid: string, item: Omit<FinItem, 'id' | 'createdAt'>): Promise<FinItem[]> {
  const items = await loadItems(uid);
  const next: FinItem = { ...item, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() };
  const all = [...items, next];
  await save(uid, all);
  return all;
}

export async function deleteItem(uid: string, id: string): Promise<FinItem[]> {
  const items = (await loadItems(uid)).filter(i => i.id !== id);
  await save(uid, items);
  return items;
}

export function summarize(items: FinItem[]): FinSummary {
  const sum = (kind: FinKind) => items.filter(i => i.kind === kind).reduce((a, i) => a + i.amount, 0);
  const monthlyIncome = sum('income');
  const monthlyEmi = sum('emi');
  const monthlyExpense = sum('expense');
  return {
    monthlyIncome,
    monthlyEmi,
    monthlyExpense,
    surplus: monthlyIncome - monthlyEmi - monthlyExpense,
    totalDebt: items.filter(i => i.kind === 'emi').reduce((a, i) => a + (i.outstanding ?? 0), 0),
  };
}

/** EMIs, highest interest first, so the list reads in the order they should be cleared. */
export function sortedEmis(items: FinItem[]): FinItem[] {
  return items.filter(i => i.kind === 'emi').sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
}

/** 1,23,456 style grouping, no decimals unless the number has them. */
export function rupees(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const [whole, frac] = (Number.isInteger(abs) ? String(abs) : abs.toFixed(2)).split('.');
  let out = whole;
  if (whole.length > 3) {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    out = `${rest},${last3}`;
  }
  return `${neg ? '−' : ''}₹${out}${frac ? `.${frac}` : ''}`;
}

/** The ledger as one message for the assistant. */
export function planPrompt(items: FinItem[]): string {
  const s = summarize(items);
  const line = (i: FinItem) =>
    `- ${i.name}: ${rupees(i.amount)}/month` +
    (i.kind === 'emi' && i.interestRate ? `, ${i.interestRate}% interest` : '') +
    (i.kind === 'emi' && i.outstanding ? `, ${rupees(i.outstanding)} still owed` : '') +
    (i.dueDay ? `, on day ${i.dueDay}` : '');
  const part = (title: string, kind: FinKind) => {
    const rows = items.filter(i => i.kind === kind).map(line);
    return rows.length ? `${title}:\n${rows.join('\n')}` : '';
  };
  return [
    'Here is my finance section. Give me a plan: which EMI to close first and how to use my surplus this month.',
    part('Incomes', 'income'),
    part('EMIs', 'emi'),
    part('Recurring expenses', 'expense'),
    `In ${rupees(s.monthlyIncome)}/month, out ${rupees(s.monthlyEmi + s.monthlyExpense)}/month, surplus ${rupees(s.surplus)}, total debt ${rupees(s.totalDebt)}.`,
  ].filter(Boolean).join('\n\n');
}
