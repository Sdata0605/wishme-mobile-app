/**
 * Collects what is said in the current assistant conversation, line by line, so it can be saved to the long-term memory when
 * the conversation ends. Pure bookkeeping (no network): checked in scripts/conversationLog.selfcheck.ts.
 *
 * The live transcript arrives in small pieces ("My sis", "ter Anita..."); consecutive pieces from the same speaker are joined
 * into one line, and a change of speaker starts a new one.
 */

import type { LogLine } from './recall';

const MAX_LINES = 300;
const MAX_LINE_CHARS = 2000;

export interface Session {
  id: string;
  startedAt: string;
  lines: LogLine[];
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let current: Session | null = null;
let open: LogLine | null = null;

/** One piece of the transcript. */
export function logFragment(role: 'user' | 'assistant', text: string, now: Date = new Date()): void {
  if (!text) return;
  if (!current) current = { id: newId(), startedAt: now.toISOString(), lines: [] };
  if (open && open.role === role) {
    open.text = (open.text + text).slice(0, MAX_LINE_CHARS);
    return;
  }
  open = { role, text: text.slice(0, MAX_LINE_CHARS), at: now.toISOString() };
  current.lines.push(open);
  // A conversation that never ends must not grow without limit: the oldest lines go.
  if (current.lines.length > MAX_LINES) current.lines.splice(0, current.lines.length - MAX_LINES);
}

/** The assistant finished its answer: the next piece from it starts a new line. */
export function endLine(): void {
  open = null;
}

/**
 * Hands over what has been said so far and starts afresh. Null when the user said nothing worth keeping (a "hello" and
 * nothing else is not a conversation).
 */
export function takeSession(): Session | null {
  const s = current;
  current = null;
  open = null;
  if (!s) return null;
  const said = s.lines.filter((l) => l.role === 'user').map((l) => l.text.trim()).join(' ');
  if (said.length < 4) return null;
  s.lines = s.lines.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text);
  return s;
}

export function peekLineCount(): number {
  return current?.lines.length ?? 0;
}
