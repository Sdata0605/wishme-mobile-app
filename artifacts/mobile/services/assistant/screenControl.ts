/**
 * Screen control for the voice assistant: reads the live React fiber tree (root captured by
 * assistant-hook.ts) to list what is on screen, and operates it (tap, type, scroll) without touching it.
 *
 * Facts this relies on (verified against react-native 0.81.5 / React 19.1, Fabric):
 *  - Composite fibers keep `memoizedProps`, so `onPress` / `onChangeText` / `onValueChange` are readable.
 *  - A host fiber's `stateNode` is `{ node, canonical }`; `canonical.publicInstance` is the public instance
 *    (ReactNativeElement) with `measureInWindow(cb)` and `setNativeProps()` (Paper: stateNode itself).
 *    `measureInWindow` reads the shadow tree incl. ScrollView content offset, but gives an empty rect for
 *    detached nodes and may never call back, hence the timeout.
 *  - RN's ScrollView is a class component: `fiber.stateNode` has scrollTo/scrollToEnd/getNativeScrollRef/
 *    getInnerViewRef (FlatList/SectionList render one).
 *  - Screens behind in the navigation stack (and inactive tabs) stay mounted and keep their layout, so
 *    rect checks alone cannot tell them apart. Navigation providers expose `isFocused()`; unfocused
 *    subtrees are skipped. Rects, window and scroll-view clipping then drop what is not really visible.
 *  - Props on a stale fiber (the other `alternate`) may be outdated, so every action re-walks the tree and
 *    uses the fiber that is current right now (otherwise "fill, then tap Search" would use an old closure).
 *
 * Every access to internals is defensive; nothing here throws to callers.
 */

import { Dimensions } from 'react-native';
import { FiberTag, getRootFiber, type Fiber } from '../../assistant-hook';
import { cleanText, iconHint, isSensitiveFieldText, rankByLabel, truncate, type Refusal } from './labelMatch';

// ─── Public types ───────────────────────────────────────────────────────────────────────────────────────────

export type ElementKind = 'button' | 'input' | 'switch';

export interface ScreenElement {
  id: number;
  kind: ElementKind;
  label: string;
  placeholder?: string;
  /** Text of an input (never for secure fields) or on/off state of a switch. */
  value?: string | boolean;
  /** Present when the field holds a secret; the assistant must not type into it. */
  secure?: true;
  y: number;
}

export interface ScreenSnapshot {
  /** False when the fiber tree could not be reached at all. */
  available: boolean;
  elements: ScreenElement[];
  /** Visible text lines in reading order. */
  text: string[];
  /** Whether the main vertical scroll area has more content above / below. */
  scroll?: { up: boolean; down: boolean };
  /** Number of further elements not listed (list is capped to keep the payload small). */
  omitted?: number;
}

/** What a safety guard gets to look at before an action is performed. */
export interface ElementInfo {
  id: number;
  kind: ElementKind;
  label: string;
  placeholder?: string;
  secure: boolean;
  /** Label, placeholder, visible text and titles joined, for pattern checks. */
  text: string;
}

export type Guard = (element: ElementInfo, query: string) => Refusal | null;

export interface Failure {
  ok: false;
  error: string;
  instruction: string;
  /** Labels that are on screen, to help the model retry. */
  available?: string[];
}

export interface ActionSuccess {
  ok: true;
  element: { id?: number; kind: ElementKind; label: string };
  note?: string;
}

export type ActionResult = ActionSuccess | Failure;

export type ScrollDirection = 'up' | 'down' | 'top' | 'bottom';

export type ScrollResult =
  | { ok: true; moved: boolean; atTop?: boolean; atBottom?: boolean }
  | Failure;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Tuning ─────────────────────────────────────────────────────────────────────────────────────────────────

const MEASURE_TIMEOUT_MS = 600;
const SCROLL_SETTLE_MS = 350;
const SUBMIT_DELAY_MS = 150;
const MAX_FIBERS = 60000;
const MAX_TEXT_LINES = 30;
const MAX_LISTED_ELEMENTS = 60;
const LABEL_MAX = 60;
const TEXT_LINE_MAX = 120;
const MIN_VISIBLE_PX = 8;
const ROW_BUCKET_PX = 12;
const SIBLING_LABEL_LEVELS = 3;
const NEARBY_LABEL_MAX = 100;
const AVAILABLE_LABELS = 12;

// ─── Internal types ─────────────────────────────────────────────────────────────────────────────────────────

type Props = Record<string, any>;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ancestor chain of the traversal (nearest first); the fibers' own `return` pointers can be stale. */
interface Path {
  fiber: Fiber;
  up: Path | null;
}

interface Candidate {
  kind: ElementKind;
  fiber: Fiber;
  path: Path;
  /** Nearest interactive ancestor (usually a wrapper around the same control). */
  parent: Candidate | null;
  scrollView: Fiber | null;
  texts: string[];
  icons: string[];
  dropped: boolean;
  /** accessibilityLabel / title of dropped wrapper components around this control. */
  inheritedLabel: string | null;
}

interface TextNode {
  fiber: Fiber;
  text: string;
  scrollView: Fiber | null;
}

interface Scan {
  candidates: Candidate[];
  texts: TextNode[];
  scrollViews: Fiber[];
  modals: Fiber[];
  budget: number;
}

interface Ctx {
  owner: Candidate | null;
  scrollView: Fiber | null;
  inText: boolean;
  noTouch: boolean;
}

interface Entry {
  id: number;
  kind: ElementKind;
  label: string;
  /** Every string that may identify this control (a11y label, visible text, placeholder, nearby label...). */
  aliases: string[];
  placeholder?: string;
  value?: string | boolean;
  secure: boolean;
  /** Full text of a card-like button whose label had to be cut; also reported as a text line. */
  detail?: string;
  fiber: Fiber;
  rect: Rect;
  visible: boolean;
  scrollView: Fiber | null;
}

interface ScrollMetrics {
  offset: number;
  max: number;
  viewport: number;
}

interface Snap {
  /** Visible elements in reading order (ids 1..n). */
  entries: Entry[];
  /** Real controls just outside the visible part of a scroll area; reachable by label only. */
  offscreen: Entry[];
  text: string[];
  main: { fiber: Fiber; rect: Rect; metrics: ScrollMetrics | null } | null;
}

let latest: Snap | null = null;
/** Offsets we requested per ScrollView instance, used only when its position cannot be measured. */
const requestedOffsets = new WeakMap<object, number>();

// ─── Small helpers ──────────────────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? cleanText(v) : null);

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const isComposite = (tag: number) =>
  tag === FiberTag.FunctionComponent ||
  tag === FiberTag.ClassComponent ||
  tag === FiberTag.ForwardRef ||
  tag === FiberTag.MemoComponent ||
  tag === FiberTag.SimpleMemoComponent;

const isTextHostType = (type: unknown) => typeof type === 'string' && /Text$/.test(type);

function typeName(f: Fiber): string {
  const t = f.type ?? f.elementType;
  if (!t) return '';
  if (typeof t === 'string') return t;
  return (
    t.displayName || t.name || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name || ''
  );
}

/** Last defined value of `key` in a (possibly nested array) style. */
function styleValue(style: any, key: string): unknown {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i--) {
      const v = styleValue(style[i], key);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  return typeof style === 'object' ? style[key] : undefined;
}

/** The assistant's own overlay / floating button must never be read or operated. */
const isAssistantOwned = (props: Props) => typeof props.testID === 'string' && props.testID.startsWith('assistant-');

const isDisabled = (props: Props) =>
  props.disabled === true || props['aria-disabled'] === true || props.accessibilityState?.disabled === true;

const isSecureProps = (props: Props) =>
  props.secureTextEntry === true ||
  props.textContentType === 'password' ||
  props.textContentType === 'newPassword' ||
  props.autoComplete === 'password' ||
  props.autoComplete === 'new-password' ||
  props.autoComplete === 'current-password';

/** React Navigation exposes the navigation prop through a provider; unfocused screens are not on screen. */
function isUnfocusedNavigation(value: any): boolean {
  if (!value || typeof value.isFocused !== 'function' || typeof value.getParent !== 'function') return false;
  try {
    return value.isFocused() === false;
  } catch {
    return false;
  }
}

function classify(f: Fiber, props: Props): ElementKind | null {
  if (typeName(f) === 'TextInput' || typeof props.onChangeText === 'function') {
    return props.editable === false || props.readOnly === true ? null : 'input';
  }
  if (typeof props.onValueChange === 'function' && typeof props.value === 'boolean') {
    return isDisabled(props) ? null : 'switch';
  }
  if (typeof props.onPress === 'function') return isDisabled(props) ? null : 'button';
  return null;
}

/** Vertical ScrollView / FlatList / SectionList scroller (RN's ScrollView is a class with these methods). */
function isVerticalScrollView(f: Fiber, props: Props): boolean {
  const s = f.stateNode;
  return (
    f.tag === FiberTag.ClassComponent &&
    !!s &&
    typeof s.scrollTo === 'function' &&
    typeof s.getNativeScrollRef === 'function' &&
    typeof s.getInnerViewRef === 'function' &&
    props.horizontal !== true &&
    props.scrollEnabled !== false
  );
}

/** Joined text of all HostText below `f` (nested Text included). */
function hostTextContent(f: Fiber): string {
  let out = '';
  const walk = (n: Fiber | null) => {
    for (; n; n = n.sibling) {
      if (n.tag === FiberTag.HostText) {
        if (typeof n.memoizedProps === 'string') out += n.memoizedProps;
      } else {
        walk(n.child);
      }
    }
  };
  walk(f.child);
  return cleanText(out);
}

/** Text lines in the subtree of `n` (one per outermost Text element), skipping the assistant's own UI. */
function collectTexts(n: Fiber, out: string[], budget: { n: number }): void {
  if (budget.n-- <= 0 || n.tag === FiberTag.HostText) return;
  const props = n.memoizedProps;
  if (props && typeof props === 'object' && isAssistantOwned(props)) return;
  if (n.tag === FiberTag.HostComponent && isTextHostType(n.type)) {
    const t = hostTextContent(n);
    if (t) out.push(t);
    return;
  }
  for (let c = n.child; c; c = c.sibling) collectTexts(c, out, budget);
}

/** True if the subtree of `n` holds something the user can operate (so it is not a plain label). */
function containsControl(n: Fiber, budget = { n: 300 }): boolean {
  if (budget.n-- <= 0) return false;
  const p = n.memoizedProps;
  if (p && typeof p === 'object') {
    if (typeof p.onPress === 'function' || typeof p.onChangeText === 'function') return true;
    if (typeof n.type === 'string' && n.type.includes('TextInput')) return true;
  }
  for (let c = n.child; c; c = c.sibling) {
    if (containsControl(c, budget)) return true;
  }
  return false;
}

function siblingsBefore(parent: Fiber, node: Fiber): Fiber[] {
  const out: Fiber[] = [];
  for (let c = parent.child; c; c = c.sibling) {
    if (c === node) return out;
    out.push(c);
  }
  return [];
}

/**
 * Text of the nearest label-like sibling before the control: looks at previous siblings of the control and of
 * up to 3 ancestor levels that have any. `level` 0 is the control's own row. Stops at another control.
 */
function precedingLabel(path: Path): { text: string; level: number } | null {
  let node = path;
  let level = 0;
  for (let hops = 0; node.up && level < SIBLING_LABEL_LEVELS && hops < 8; hops++) {
    const parent = node.up;
    const before = siblingsBefore(parent.fiber, node.fiber);
    if (before.length > 0) {
      for (let i = before.length - 1; i >= 0; i--) {
        if (containsControl(before[i])) return null;
        const texts: string[] = [];
        collectTexts(before[i], texts, { n: 400 });
        const text = cleanText(texts.join(' '));
        if (text && text.length <= NEARBY_LABEL_MAX) return { text: truncate(text, LABEL_MAX), level };
      }
      level++;
    }
    node = parent;
  }
  return null;
}

// ─── Tree scan (pure JS, no native calls) ───────────────────────────────────────────────────────────────────

function noteIcon(f: Fiber, props: Props, owner: Candidate): void {
  if (owner.kind !== 'button') return;
  if (typeof props.name === 'string') {
    owner.icons.push(props.name);
  } else if ('strokeWidth' in props || ('size' in props && 'color' in props)) {
    // Icon libraries such as lucide expose the icon only as the component's display name ("ArrowLeft").
    const name = typeName(f);
    if (/^[A-Z]/.test(name)) owner.icons.push(name);
  }
}

function visitHost(f: Fiber, here: Path, ctx: Ctx, scan: Scan): void {
  const props: Props = f.memoizedProps && typeof f.memoizedProps === 'object' ? f.memoizedProps : {};
  if (styleValue(props.style, 'display') === 'none') return;

  const type = f.type;
  // A visible RN <Modal> covers the screen: only its content can be seen or touched.
  if (typeof type === 'string' && type.includes('ModalHostView')) {
    scan.modals.push(f);
    return;
  }

  let next = ctx;
  if (isTextHostType(type) && !ctx.inText) {
    const text = hostTextContent(f);
    if (text) {
      if (ctx.owner) ctx.owner.texts.push(text);
      else scan.texts.push({ fiber: f, text, scrollView: ctx.scrollView });
    }
    next = { ...next, inText: true };
  }
  const pointerEvents = props.pointerEvents ?? styleValue(props.style, 'pointerEvents');
  if (pointerEvents === 'none' && !ctx.noTouch) next = { ...next, noTouch: true };
  walkChildren(here, next, scan);
}

function visit(f: Fiber, up: Path, ctx: Ctx, scan: Scan): void {
  scan.budget--;
  if (f.tag === FiberTag.HostText) return;
  const props = f.memoizedProps;
  const hasProps = !!props && typeof props === 'object';
  if (hasProps && isAssistantOwned(props)) return;

  const here: Path = { fiber: f, up };
  if (f.tag === FiberTag.HostComponent) {
    visitHost(f, here, ctx, scan);
    return;
  }

  let next = ctx;
  if (hasProps) {
    if (f.tag === FiberTag.ContextProvider && isUnfocusedNavigation(props.value)) return;
    if ((f.tag === FiberTag.OffscreenComponent || f.tag === FiberTag.ActivityComponent) && props.mode === 'hidden') return;

    if (isComposite(f.tag)) {
      if (isVerticalScrollView(f, props)) {
        scan.scrollViews.push(f);
        next = { ...next, scrollView: f };
      }
      const kind = ctx.noTouch ? null : classify(f, props);
      if (kind) {
        const candidate: Candidate = {
          kind,
          fiber: f,
          path: here,
          parent: ctx.owner,
          scrollView: ctx.scrollView,
          texts: [],
          icons: [],
          dropped: false,
          inheritedLabel: null,
        };
        // A link nested inside a Text has no Text host of its own to collect from.
        const ownText = ctx.inText ? hostTextContent(f) : '';
        if (ownText) candidate.texts.push(ownText);
        scan.candidates.push(candidate);
        next = { ...next, owner: candidate };
      } else if (ctx.owner) {
        noteIcon(f, props, ctx.owner);
      }
    }
  }
  walkChildren(here, next, scan);
}

function walkChildren(parent: Path, ctx: Ctx, scan: Scan): void {
  for (let c = parent.fiber.child; c && scan.budget > 0; c = c.sibling) visit(c, parent, ctx, scan);
}

function scanFrom(start: Fiber): Scan {
  const scan: Scan = { candidates: [], texts: [], scrollViews: [], modals: [], budget: MAX_FIBERS };
  walkChildren({ fiber: start, up: null }, { owner: null, scrollView: null, inText: false, noTouch: false }, scan);
  return scan;
}

/** Scans the app; if modals are open, rescans inside the topmost one (it covers everything else). */
function scanTree(root: Fiber): Scan {
  let scan = scanFrom(root);
  for (let depth = 0; depth < 4 && scan.modals.length > 0; depth++) {
    scan = scanFrom(scan.modals[scan.modals.length - 1]);
  }
  return scan;
}

// ─── Measuring ──────────────────────────────────────────────────────────────────────────────────────────────

function firstHost(f: Fiber): Fiber | null {
  for (let c = f.child; c; c = c.sibling) {
    if (c.tag === FiberTag.HostComponent) return c;
    const h = firstHost(c);
    if (h) return h;
  }
  return null;
}

/** Public instance of a host fiber: Fabric `{node, canonical}` or the Paper host instance itself. */
function publicInstanceOf(host: Fiber | null): any | null {
  const s = host?.stateNode;
  if (!s) return null;
  const inst = s.canonical?.publicInstance ?? s;
  return typeof inst.measureInWindow === 'function' ? inst : null;
}

/** Host view to measure for a control (nested <Text> has no layout of its own, so use its parent Text). */
function measureHostOf(c: Candidate): Fiber | null {
  const host = firstHost(c.fiber);
  if (host && typeof host.type === 'string' && host.type.includes('Virtual')) {
    for (let p: Path | null = c.path; p; p = p.up) {
      if (p.fiber.tag === FiberTag.HostComponent && isTextHostType(p.fiber.type) && !String(p.fiber.type).includes('Virtual')) {
        return p.fiber;
      }
    }
  }
  return host;
}

/** Measures all instances in parallel; entries that never answer within the timeout stay null. */
async function measureMany(instances: Array<any | null>): Promise<Array<Rect | null>> {
  const out: Array<Rect | null> = instances.map(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, MEASURE_TIMEOUT_MS);
  });
  const jobs = instances.map(
    (inst, i) =>
      new Promise<void>((resolve) => {
        if (!inst || typeof inst.measureInWindow !== 'function') return resolve();
        try {
          inst.measureInWindow((x: number, y: number, w: number, h: number) => {
            if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h)) {
              out[i] = { x, y, w, h };
            }
            resolve();
          });
        } catch {
          resolve();
        }
      }),
  );
  await Promise.race([Promise.all(jobs), timeout]);
  if (timer) clearTimeout(timer);
  return out;
}

function intersects(r: Rect, bounds: Rect): boolean {
  const iw = Math.min(r.x + r.w, bounds.x + bounds.w) - Math.max(r.x, bounds.x);
  const ih = Math.min(r.y + r.h, bounds.y + bounds.h) - Math.max(r.y, bounds.y);
  return iw >= Math.min(MIN_VISIBLE_PX, r.w) && ih >= Math.min(MIN_VISIBLE_PX, r.h);
}

function rectsClose(a: Rect, b: Rect, tolerance: number): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.w - b.w) <= tolerance &&
    Math.abs(a.h - b.h) <= tolerance
  );
}

function contains(outer: Rect, inner: Rect, slack: number): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.w <= outer.x + outer.w + slack &&
    inner.y + inner.h <= outer.y + outer.h + slack
  );
}

function scrollMetricsOf(outer: Rect | null, inner: Rect | null): ScrollMetrics | null {
  if (!outer || !inner) return null;
  // Content moves up as the offset grows, so offset = how far the content top is above the viewport top.
  return { offset: Math.max(0, outer.y - inner.y), max: Math.max(0, inner.h - outer.h), viewport: outer.h };
}

// ─── Building the snapshot ──────────────────────────────────────────────────────────────────────────────────

const readingOrder = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.round(a.y / ROW_BUCKET_PX) - Math.round(b.y / ROW_BUCKET_PX) || a.x - b.x;

const a11yLabelOf = (props: Props): string | null =>
  nonEmpty(props.accessibilityLabel) ?? nonEmpty(props['aria-label']);

/** Marks wrapper components around the same control as dropped, so only the innermost one is listed. */
function dropWrappers(candidates: Candidate[], rects: Array<Rect | null>): void {
  const rectOf = new Map<Candidate, Rect | null>(candidates.map((c, i) => [c, rects[i]]));
  for (const c of candidates) {
    const p = c.parent;
    if (!p || p.kind !== c.kind) continue;
    const pr = rectOf.get(p) ?? null;
    const cr = rectOf.get(c) ?? null;
    const sameHandler = p.kind === 'button' && p.fiber.memoizedProps.onPress === c.fiber.memoizedProps.onPress;
    const sameBox = !!pr && !!cr && rectsClose(pr, cr, 2);
    const emptyWrapper = !!pr && !!cr && p.texts.length === 0 && p.icons.length === 0 && contains(pr, cr, 16);
    // An input or switch can never wrap another real input/switch; buttons may nest (card with inner button).
    if (p.kind !== 'button' || sameHandler || sameBox || emptyWrapper) {
      p.dropped = true;
      c.inheritedLabel = c.inheritedLabel ?? a11yLabelOf(p.fiber.memoizedProps) ?? p.inheritedLabel;
    }
  }
}

function describeCandidate(c: Candidate): Pick<Entry, 'label' | 'aliases' | 'placeholder' | 'value' | 'secure' | 'detail'> {
  const p: Props = c.fiber.memoizedProps;
  const a11y = a11yLabelOf(p) ?? c.inheritedLabel;

  if (c.kind === 'input') {
    const placeholder = nonEmpty(p.placeholder) ?? undefined;
    const near = precedingLabel(c.path);
    const secure = isSecureProps(p) || isSensitiveFieldText([a11y, placeholder, near?.text].filter(Boolean).join(' '));
    const raw = typeof p.value === 'string' ? p.value : typeof p.defaultValue === 'string' ? p.defaultValue : '';
    const value = secure || !raw ? undefined : truncate(cleanText(raw), LABEL_MAX);
    const label =
      a11y ?? (near && near.level === 0 ? near.text : null) ?? placeholder ?? near?.text ?? value ?? 'text field';
    return {
      label: truncate(label, LABEL_MAX),
      aliases: [a11y, near?.text, placeholder].filter((s): s is string => !!s),
      placeholder,
      value,
      secure,
    };
  }

  const text = cleanText(c.texts.join(' '));
  if (c.kind === 'switch') {
    const near = text ? null : precedingLabel(c.path);
    const label = a11y ?? (text || near?.text) ?? 'switch';
    return { label: truncate(label, LABEL_MAX), aliases: [a11y, text, near?.text].filter((s): s is string => !!s), value: p.value === true, secure: false };
  }

  const title = nonEmpty(p.title);
  const icon = c.icons.map(iconHint).find((h): h is string => !!h) ?? null;
  const label = a11y ?? title ?? (text || icon || 'unlabelled button');
  return {
    label: truncate(label, LABEL_MAX),
    aliases: [a11y, title, text, icon].filter((s): s is string => !!s),
    secure: false,
    detail: text.length > LABEL_MAX ? text : undefined,
  };
}

async function buildSnapshot(): Promise<Snap | null> {
  const root = getRootFiber();
  if (!root) return null;
  const scan = scanTree(root);

  const { width, height } = Dimensions.get('window');
  const windowRect: Rect = { x: 0, y: 0, w: width, h: height };

  // One parallel measuring pass: controls, text lines, then outer + inner view of each scroll area.
  const textNodes = scan.texts.slice(0, 600);
  const instances: Array<any | null> = [
    ...scan.candidates.map((c) => publicInstanceOf(measureHostOf(c))),
    ...textNodes.map((t) => publicInstanceOf(t.fiber)),
    ...scan.scrollViews.flatMap((sv) => {
      try {
        return [sv.stateNode.getNativeScrollRef(), sv.stateNode.getInnerViewRef()];
      } catch {
        return [null, null];
      }
    }),
  ];
  const rects = await measureMany(instances);
  const candidateRects = rects.slice(0, scan.candidates.length);
  const textRects = rects.slice(scan.candidates.length, scan.candidates.length + textNodes.length);
  const scrollRects = rects.slice(scan.candidates.length + textNodes.length);

  const scrollOuter = new Map<Fiber, Rect>();
  let main: Snap['main'] = null;
  for (let i = 0; i < scan.scrollViews.length; i++) {
    const outer = scrollRects[i * 2];
    if (!outer || outer.w <= 0 || outer.h <= 0) continue;
    scrollOuter.set(scan.scrollViews[i], outer);
    if (!intersects(outer, windowRect)) continue;
    if (!main || outer.w * outer.h > main.rect.w * main.rect.h) {
      main = { fiber: scan.scrollViews[i], rect: outer, metrics: scrollMetricsOf(outer, scrollRects[i * 2 + 1]) };
    }
  }

  const isVisible = (rect: Rect, scrollView: Fiber | null) => {
    const clip = scrollView ? scrollOuter.get(scrollView) : undefined;
    return intersects(rect, windowRect) && (!clip || intersects(rect, clip));
  };

  dropWrappers(scan.candidates, candidateRects);

  const visible: Entry[] = [];
  const offscreen: Entry[] = [];
  scan.candidates.forEach((c, i) => {
    const rect = candidateRects[i];
    if (c.dropped || !rect || rect.w <= 0 || rect.h <= 0) return;
    const entry: Entry = {
      id: 0,
      kind: c.kind,
      ...describeCandidate(c),
      fiber: c.fiber,
      rect,
      visible: isVisible(rect, c.scrollView),
      scrollView: c.scrollView,
    };
    if (entry.visible) visible.push(entry);
    // Just above/below the fold of a scroll area (not off to the side): reachable by scrolling.
    else if (c.scrollView && rect.x < windowRect.w && rect.x + rect.w > 0) offscreen.push(entry);
  });
  visible.sort((a, b) => readingOrder(a.rect, b.rect));
  visible.forEach((e, i) => (e.id = i + 1));

  const lines: Array<{ x: number; y: number; text: string }> = [];
  for (const e of visible) {
    if (e.detail) lines.push({ x: e.rect.x, y: e.rect.y, text: e.detail });
  }
  textNodes.forEach((t, i) => {
    const rect = textRects[i];
    if (rect && rect.w > 0 && rect.h > 0 && isVisible(rect, t.scrollView)) lines.push({ x: rect.x, y: rect.y, text: t.text });
  });
  lines.sort(readingOrder);
  const seen = new Set<string>();
  const text: string[] = [];
  for (const line of lines) {
    const key = line.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    text.push(truncate(line.text, TEXT_LINE_MAX));
    if (text.length >= MAX_TEXT_LINES) break;
  }

  return { entries: visible, offscreen, text, main };
}

/** Takes a fresh snapshot and remembers it as the one ids refer to. Null when the UI tree is unreachable. */
async function refreshSnapshot(): Promise<Snap | null> {
  try {
    const snap = await buildSnapshot();
    if (snap) latest = snap;
    return snap;
  } catch {
    return null;
  }
}

/** Compact snapshot of what is on screen right now (see ScreenSnapshot). */
export async function snapshot(): Promise<ScreenSnapshot> {
  const snap = await refreshSnapshot();
  if (!snap) return { available: false, elements: [], text: [] };

  const elements: ScreenElement[] = snap.entries.slice(0, MAX_LISTED_ELEMENTS).map((e) => {
    const el: ScreenElement = { id: e.id, kind: e.kind, label: e.label, y: Math.round(e.rect.y) };
    if (e.placeholder && e.placeholder !== e.label) el.placeholder = e.placeholder;
    if (e.value !== undefined && e.value !== '') el.value = e.value;
    if (e.secure) el.secure = true;
    return el;
  });
  const result: ScreenSnapshot = { available: true, elements, text: snap.text };
  const metrics = snap.main?.metrics;
  if (metrics && metrics.max > MIN_VISIBLE_PX) {
    result.scroll = { up: metrics.offset > MIN_VISIBLE_PX / 2, down: metrics.offset < metrics.max - MIN_VISIBLE_PX / 2 };
  }
  if (snap.entries.length > elements.length) result.omitted = snap.entries.length - elements.length;
  return result;
}

// ─── Resolving a target to a live element ───────────────────────────────────────────────────────────────────

const UNAVAILABLE: Failure = {
  ok: false,
  error: 'The screen cannot be read right now.',
  instruction: 'Tell the user you cannot see the screen at the moment and ask them to do this step themselves.',
};

const failure = (error: string, instruction: string, available?: string[]): Failure => ({
  ok: false,
  error,
  instruction,
  ...(available ? { available } : {}),
});

const listLabels = (snap: Snap): string[] =>
  snap.entries.slice(0, AVAILABLE_LABELS).map((e) => `${e.id}: ${e.label}`);

const describeEntry = (e: Entry): ElementInfo => ({
  id: e.id,
  kind: e.kind,
  label: e.label,
  placeholder: e.placeholder,
  secure: e.secure,
  text: [e.label, ...e.aliases].join(' '),
});

/** Finds, in the fresh snapshot, the control the model knew by `old` from the previous snapshot. */
function matchSame(snap: Snap, old: Entry): Entry | null {
  const pool = [...snap.entries, ...snap.offscreen];
  const byFiber = pool.find((e) => e.fiber === old.fiber || e.fiber === old.fiber.alternate);
  if (byFiber) return byFiber;
  const sameLabel = pool.filter((e) => e.kind === old.kind && e.label === old.label);
  sameLabel.sort((a, b) => Math.abs(a.rect.y - old.rect.y) - Math.abs(b.rect.y - old.rect.y));
  return sameLabel[0] ?? null;
}

async function locate(
  target: string | number,
  kinds: ElementKind[],
): Promise<{ ok: true; entry: Entry; note?: string } | Failure> {
  const previous = latest;
  const snap = await refreshSnapshot();
  if (!snap) return UNAVAILABLE;

  const byId = (id: number): Entry | null => {
    const old = previous?.entries.find((e) => e.id === id);
    return old ? matchSame(snap, old) : (snap.entries.find((e) => e.id === id) ?? null);
  };
  const pool = [...snap.entries, ...snap.offscreen].filter((e) => kinds.includes(e.kind));
  const query = String(target).trim();
  const wrongKind = (e: Entry) =>
    failure(
      `Element ${e.id} ("${e.label}") is a ${e.kind}, not a ${kinds.length === 1 ? kinds[0] : 'matching control'}.`,
      'Pick a different element from read_screen.',
      listLabels(snap),
    );

  let entry: Entry | null = null;
  let note: string | undefined;
  if (typeof target === 'number') {
    entry = byId(target);
    if (entry && !kinds.includes(entry.kind)) return wrongKind(entry);
  } else {
    const ranked = rankByLabel(query, pool, (e) => [e.label, ...e.aliases]);
    // A bare number is an id unless some control is literally labelled with it.
    const digits = /^#?\d{1,3}$/.test(query);
    if (ranked.length > 0 && (!digits || ranked[0].score >= 100)) {
      entry = ranked[0].item;
      const ties = ranked.filter((r) => r.score === ranked[0].score).length - 1;
      if (ties > 0) note = `${ties} other element(s) matched "${query}"; used the topmost. Use the id to be precise.`;
    } else if (digits) {
      entry = byId(Number(query.replace('#', '')));
      if (entry && !kinds.includes(entry.kind)) return wrongKind(entry);
    }
  }

  if (!entry) {
    return failure(
      `Nothing on the current screen matches "${query}".`,
      'Call read_screen to see what is on screen and retry with the exact label or id. If it may be further down, use scroll_screen first.',
      listLabels(snap),
    );
  }
  return { ok: true, entry, note };
}

/** The fiber that is current right now for a control from an earlier snapshot, or null if it is gone. */
function currentFiberOf(entry: Entry): Fiber | null {
  const root = getRootFiber();
  if (!root) return null;
  const match = scanTree(root).candidates.find((c) => c.fiber === entry.fiber || c.fiber === entry.fiber.alternate);
  return match ? match.fiber : null;
}

const GONE = failure(
  'That control is no longer on screen.',
  'The screen changed. Call read_screen again and use the new list.',
);

const nativeTagOf = (fiber: Fiber): number | undefined => {
  const tag = firstHost(fiber)?.stateNode?.canonical?.nativeTag;
  return typeof tag === 'number' ? tag : undefined;
};

/** Minimal GestureResponderEvent so handlers that touch `nativeEvent`/`persist()` keep working. */
function syntheticEvent(nativeEvent: Record<string, unknown>) {
  return {
    nativeEvent,
    type: 'press',
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    timeStamp: Date.now(),
    persist() {},
    preventDefault() {},
    stopPropagation() {},
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────────────────────────────────────

async function scrollIntoView(entry: Entry): Promise<void> {
  const sv = entry.scrollView?.stateNode;
  if (!sv) return;
  const [outer, inner] = await measureMany([sv.getNativeScrollRef?.(), sv.getInnerViewRef?.()]);
  const metrics = scrollMetricsOf(outer, inner);
  if (!outer || !metrics) return;
  const delta = entry.rect.y + entry.rect.h / 2 - (outer.y + outer.h / 2);
  sv.scrollTo({ x: 0, y: clamp(metrics.offset + delta, 0, metrics.max), animated: true });
  await sleep(SCROLL_SETTLE_MS);
}

/**
 * Presses a button/link, toggles a switch or focuses a text field. `guard` can veto after the control is
 * resolved and before anything is touched.
 */
export async function tapElement(target: string | number, options: { guard?: Guard } = {}): Promise<ActionResult> {
  try {
    const found = await locate(target, ['button', 'input', 'switch']);
    if (!found.ok) return found;
    const { entry, note } = found;

    const refusal = options.guard?.(describeEntry(entry), String(target));
    if (refusal) return { ok: false, ...refusal };

    if (!entry.visible) await scrollIntoView(entry);
    const fiber = currentFiberOf(entry);
    if (!fiber) return GONE;
    const props: Props = fiber.memoizedProps;

    if (entry.kind === 'switch') {
      if (typeof props.onValueChange !== 'function') return GONE;
      props.onValueChange(!props.value);
    } else if (entry.kind === 'input') {
      publicInstanceOf(firstHost(fiber))?.focus?.();
    } else {
      if (typeof props.onPress !== 'function') return GONE;
      const { rect } = entry;
      const nativeEvent = {
        pageX: rect.x + rect.w / 2,
        pageY: rect.y + rect.h / 2,
        locationX: rect.w / 2,
        locationY: rect.h / 2,
        timestamp: Date.now(),
        target: nativeTagOf(fiber),
        touches: [],
        changedTouches: [],
      };
      props.onPress(syntheticEvent(nativeEvent));
    }

    const element: ActionSuccess['element'] = { kind: entry.kind, label: entry.label };
    if (entry.id > 0) element.id = entry.id;
    return { ok: true, element, note };
  } catch (e) {
    return failure(`The tap did not work: ${errorMessage(e)}`, 'Tell the user it did not work and ask them to tap it themselves.');
  }
}

/**
 * Sets the text of a field (empty string clears it). Controlled inputs are driven through onChangeText (React then
 * syncs the native view); uncontrolled ones also get the native text set. `submit` presses the keyboard's submit key.
 */
export async function fillField(
  target: string | number,
  text: string,
  options: { submit?: boolean; guard?: Guard } = {},
): Promise<ActionResult> {
  try {
    const found = await locate(target, ['input']);
    if (!found.ok) return found;
    const { entry, note } = found;

    const refusal = options.guard?.(describeEntry(entry), String(target));
    if (refusal) return { ok: false, ...refusal };

    if (!entry.visible) await scrollIntoView(entry);
    let fiber = currentFiberOf(entry);
    if (!fiber) return GONE;
    const props: Props = fiber.memoizedProps;

    const value = typeof props.maxLength === 'number' ? text.slice(0, props.maxLength) : text;
    const event = syntheticEvent({ text: value, eventCount: 0, target: nativeTagOf(fiber) });
    const instance = publicInstanceOf(firstHost(fiber));

    if (typeof props.value !== 'string' && instance) {
      try {
        if (value === '' && typeof instance.clear === 'function') instance.clear();
        else instance.setNativeProps?.({ text: value });
      } catch {
        // The JS callbacks below still update app state.
      }
    }
    props.onChangeText?.(value);
    props.onChange?.(event);

    if (options.submit) {
      // Let React commit the new text first, so onSubmitEditing sees the updated state.
      await sleep(SUBMIT_DELAY_MS);
      fiber = currentFiberOf(entry) ?? fiber;
      fiber.memoizedProps.onSubmitEditing?.(event);
    }

    const element: ActionSuccess['element'] = { kind: entry.kind, label: entry.label };
    if (entry.id > 0) element.id = entry.id;
    return { ok: true, element, note };
  } catch (e) {
    return failure(`Typing did not work: ${errorMessage(e)}`, 'Tell the user it did not work and ask them to type it themselves.');
  }
}

/**
 * Scrolls the largest visible vertical scroll area (page, FlatList, SectionList): a page up/down
 * (`fraction` of the viewport height, default 0.8) or to the very top/bottom.
 */
export async function scroll(direction: ScrollDirection, fraction = 0.8): Promise<ScrollResult> {
  try {
    const snap = await refreshSnapshot();
    if (!snap) return UNAVAILABLE;
    const main = snap.main;
    const view = main?.fiber.stateNode;
    if (!main || !view) {
      return failure('Nothing on this screen can be scrolled.', 'Tell the user there is nothing more to scroll on this screen.');
    }

    const metrics = main.metrics;
    const current = metrics ? metrics.offset : (requestedOffsets.get(view) ?? 0);
    const max = metrics ? metrics.max : Number.POSITIVE_INFINITY;
    const step = clamp(fraction, 0.2, 1) * (metrics?.viewport ?? main.rect.h);

    let target: number;
    if (direction === 'top') target = 0;
    else if (direction === 'bottom') target = max;
    else target = clamp(current + (direction === 'down' ? step : -step), 0, max);

    if (direction === 'bottom') view.scrollToEnd({ animated: true });
    else view.scrollTo({ x: 0, y: target, animated: true });
    requestedOffsets.set(view, Number.isFinite(target) ? target : current);

    const moved = Number.isFinite(target) ? Math.abs(target - current) > 1 : true;
    return {
      ok: true,
      moved,
      atTop: Number.isFinite(target) ? target <= 1 : undefined,
      atBottom: metrics ? target >= max - 1 : direction === 'bottom' ? true : undefined,
    };
  } catch (e) {
    return failure(`Scrolling did not work: ${errorMessage(e)}`, 'Tell the user it did not work and ask them to scroll themselves.');
  }
}
