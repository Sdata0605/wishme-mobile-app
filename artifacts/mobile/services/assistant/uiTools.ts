/**
 * Hands-free "screen control" tools for the voice assistant: read what is on the screen, tap, type, scroll.
 * They work on ANY screen through the live UI tree (see screenControl.ts).
 *
 * Safety rules enforced here, in code (not left to the model):
 *  - Payment / order-placing controls and destructive ones (delete, log out, ...) are never tapped; the
 *    model is told to ask the user to do it.
 *  - Secret / payment / identity fields (secure inputs, password, OTP, PIN, card, ID numbers...) are never
 *    filled and their values are never read out.
 *  - Typed text is capped to 500 characters.
 */

import {
  fillField,
  scroll,
  sleep,
  snapshot,
  tapElement,
  type ActionResult,
  type Failure,
  type Guard,
  type ScreenElement,
  type ScreenSnapshot,
  type ScrollDirection,
} from './screenControl';
import { MAX_FILL_TEXT, fillRefusal, tapRefusal } from './labelMatch';

/** Time for a tap/scroll/typing to take effect (navigation, animation) before the screen is re-read. */
const SETTLE_MS = 350;
const COMPACT_CONTROLS = 12;
const COMPACT_TEXT_LINES = 3;
const SCROLL_DIRECTIONS: readonly string[] = ['up', 'down', 'top', 'bottom'];

const str = (description: string) => ({ type: 'STRING', description });

export const UI_FUNCTION_DECLARATIONS: unknown[] = [
  {
    name: 'read_screen',
    description:
      'Look at the phone screen the user is on right now. Returns a numbered list of the buttons, links, text fields and switches ' +
      'that are visible (id, kind, label, placeholder, current value) plus the visible text. Call this FIRST whenever you do not ' +
      'know what is on screen, after the screen changes, and before tapping or filling something. Only the visible part is ' +
      'listed: if what you need is missing, use scroll_screen and read again.',
  },
  {
    name: 'tap',
    description:
      'Tap a control on the current screen exactly as if the user touched it: a button, link, tab, list item, icon or switch ' +
      '(a switch is toggled; tapping a text field focuses it). Give the exact label shown by read_screen, or its id as a number ' +
      'in `target` (for example "4"). Controls that pay, place an order, confirm a booking or payment, subscribe, donate or ' +
      'transfer money, and destructive ones (delete, log out) are blocked: tell the user to tap those themselves. The result ' +
      'lists the first controls of the updated screen; call read_screen if you need the full picture.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: str('Exact label of the control as listed by read_screen, or its numeric id, e.g. "Continue" or "4".'),
      },
      required: ['target'],
    },
  },
  {
    name: 'fill_field',
    description:
      'Type text into a text field on the current screen (replaces what is there; empty text clears the field). `field` is the ' +
      "field's label or placeholder as listed by read_screen, or its numeric id. Set submit=true to also press the keyboard's " +
      'search/done/go key. Never use this for passwords, OTP, PIN, card numbers, expiry, CVV, Aadhaar or PAN: those are blocked, ' +
      'ask the user to enter them themselves. The result lists the first controls of the updated screen.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: str('Label or placeholder of the field as listed by read_screen, or its numeric id, e.g. "Search celebrities".'),
        text: str('The text to type (at most 500 characters). Use an empty string to clear the field.'),
        submit: { type: 'BOOLEAN', description: 'Press the keyboard submit key after typing (search, done, go). Default false.' },
      },
      required: ['field', 'text'],
    },
  },
  {
    name: 'scroll_screen',
    description:
      'Scroll the main page or list of the current screen. down/up moves about one screen; bottom/top jumps to the end/start. ' +
      'Use it when read_screen does not show what you need (more content below or above). Tells you whether the top or bottom ' +
      'was reached, and lists the controls that are now visible.',
    parameters: {
      type: 'OBJECT',
      properties: { direction: { type: 'STRING', enum: ['down', 'up', 'bottom', 'top'] } },
      required: ['direction'],
    },
  },
];

// ─── Result shaping (compact: every token counts in a live voice session) ───────────────────────────────────

function describeControl(e: ScreenElement): string {
  let suffix = '';
  if (e.kind === 'input') suffix = e.secure ? ' [secure input]' : e.value ? ` [input = "${e.value}"]` : ' [input]';
  else if (e.kind === 'switch') suffix = e.value ? ' [switch on]' : ' [switch off]';
  return `${e.id}: ${e.label}${suffix}`;
}

/** First controls and headline text of the screen, so the model sees the new state without another call. */
function compactScreen(s: ScreenSnapshot): Record<string, unknown> {
  const total = s.elements.length + (s.omitted ?? 0);
  const compact: Record<string, unknown> = {
    controls: s.elements.slice(0, COMPACT_CONTROLS).map(describeControl),
    top_text: s.text.slice(0, COMPACT_TEXT_LINES),
  };
  if (total > COMPACT_CONTROLS) compact.more_controls = total - COMPACT_CONTROLS;
  if (s.scroll) compact.can_scroll = s.scroll;
  return compact;
}

function failed(f: Failure): Record<string, unknown> {
  const out: Record<string, unknown> = { ok: false, error: f.error, instruction: f.instruction };
  if (f.available && f.available.length > 0) out.available = f.available;
  return out;
}

const unreadable = (): Record<string, unknown> => ({
  ok: false,
  error: 'The screen cannot be read right now.',
  instruction: 'Tell the user you cannot see the screen at the moment and ask them to do this step themselves.',
});

/** Waits for the app to react, then reports the new screen state next to the action's own result. */
async function withScreen(result: Record<string, unknown>): Promise<Record<string, unknown>> {
  await sleep(SETTLE_MS);
  const s = await snapshot();
  return s.available ? { ...result, screen: compactScreen(s) } : result;
}

// ─── Tools ──────────────────────────────────────────────────────────────────────────────────────────────────

const tapGuard: Guard = (el, query) => tapRefusal(`${el.text} ${query}`, el.label);
const fillGuard: Guard = (el, query) => fillRefusal(`${el.text} ${query}`, el.secure);

/** A label (string) or an id (number or numeric string) as sent by the model. */
function targetOf(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

const missing = (what: string): Record<string, unknown> => ({
  ok: false,
  error: `Missing ${what}.`,
  instruction: 'Call read_screen to see the labels, then call the tool again with the exact label or id.',
});

async function readScreen(): Promise<Record<string, unknown>> {
  const s = await snapshot();
  if (!s.available) return unreadable();
  const result: Record<string, unknown> = { ok: true, elements: s.elements, text: s.text };
  if (s.scroll) result.can_scroll = s.scroll;
  if (s.omitted) result.omitted_elements = s.omitted;
  if (s.elements.length === 0 && s.text.length === 0) {
    result.note = 'Nothing readable is visible yet (the screen may still be loading). Try again in a moment.';
  }
  return result;
}

async function tap(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const target = targetOf(args.target ?? args.id);
  if (target === null) return missing('target');
  const r: ActionResult = await tapElement(target, { guard: tapGuard });
  if (!r.ok) return failed(r);
  const done = r.element.kind === 'switch' ? 'Toggled' : r.element.kind === 'input' ? 'Focused' : 'Tapped';
  return withScreen({ ok: true, result: `${done} "${r.element.label}"`, ...(r.note ? { note: r.note } : {}) });
}

async function fill(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const field = targetOf(args.field ?? args.id);
  if (field === null) return missing('field');
  if (args.text === undefined || args.text === null) return missing('text');
  const full = String(args.text);
  const text = full.slice(0, MAX_FILL_TEXT);
  const submit = args.submit === true || args.submit === 'true';

  const r: ActionResult = await fillField(field, text, { submit, guard: fillGuard });
  if (!r.ok) return failed(r);
  const notes = [r.note, full.length > text.length ? `Text was cut to ${MAX_FILL_TEXT} characters.` : undefined].filter(Boolean);
  return withScreen({
    ok: true,
    result: text === '' ? `Cleared "${r.element.label}"` : `Typed ${text.length} characters into "${r.element.label}"${submit ? ' and submitted' : ''}`,
    ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
  });
}

async function scrollScreen(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const direction = typeof args.direction === 'string' ? args.direction.toLowerCase() : '';
  if (!SCROLL_DIRECTIONS.includes(direction)) {
    return {
      ok: false,
      error: 'direction must be one of: down, up, bottom, top.',
      instruction: 'Call scroll_screen again with a valid direction.',
    };
  }
  const r = await scroll(direction as ScrollDirection);
  if (!r.ok) return failed(r);
  const result: Record<string, unknown> = { ok: true, moved: r.moved };
  if (r.atTop !== undefined) result.at_top = r.atTop;
  if (r.atBottom !== undefined) result.at_bottom = r.atBottom;
  if (!r.moved) result.note = direction === 'up' || direction === 'top' ? 'Already at the top.' : 'Already at the bottom.';
  return withScreen(result);
}

/**
 * Runs one of the UI tools. Returns null when `call.name` is not a UI tool (so the caller can try other tools).
 * Never throws: failures come back as `{ ok: false, error, instruction }` for the model to relay to the user.
 */
export async function runUiTool(call: { name: string; args: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const run =
    call.name === 'read_screen'
      ? readScreen
      : call.name === 'tap'
        ? tap
        : call.name === 'fill_field'
          ? fill
          : call.name === 'scroll_screen'
            ? scrollScreen
            : null;
  if (!run) return null;
  try {
    return await run(call.args ?? {});
  } catch (e) {
    return {
      ok: false,
      error: `Screen control failed: ${e instanceof Error ? e.message : String(e)}`,
      instruction: 'Tell the user it did not work and ask them to do this step themselves.',
    };
  }
}
