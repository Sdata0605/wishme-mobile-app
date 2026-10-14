/**
 * Captures React's fiber root(s) so the voice assistant can read and operate the
 * live UI tree of ANY screen without per-screen changes (see services/assistant/screenControl.ts).
 *
 * How the root is obtained (verified against react-native 0.81.5 / React 19.1):
 *  - ReactFabric-{dev,prod}.js reads `__REACT_DEVTOOLS_GLOBAL_HOOK__` ONCE, while the renderer module is
 *    evaluated (`inject(internals)` -> `injectedHook`), and afterwards calls
 *    `injectedHook.onCommitFiberRoot(rendererID, root, priority, didError)` after every commit.
 *    In prod the module is evaluated lazily by `renderApplication`, i.e. after the entry file started
 *    running, so installing the hook from the FIRST import of index.js is early enough.
 *  - Dev builds: RN's setUpReactDevTools (InitializeCore, before the entry file) already installed the real
 *    DevTools hook, a plain mutable object. We wrap its `onCommitFiberRoot` (original is still called).
 *  - Release builds: no hook exists, so a minimal valid one is installed: `supportsFiber`, not `isDisabled`,
 *    `inject()` returning a renderer id, plus the callbacks React calls (`checkDCE` makes the dev renderer
 *    treat it as a real hook). The prod renderer only ever calls inject/onCommitFiberRoot/
 *    onCommitFiberUnmount/onPostCommitFiberRoot on it, so the overhead is a few no-op calls per commit.
 *  - A commit-recorded root is `FiberRoot`; `root.current` is read lazily so we always see the latest
 *    committed tree. If a real hook could not be wrapped, `hook.getFiberRoots()` is used as a fallback.
 *  - Last resort that needs no hook: any host instance ref exposes `__internalInstanceHandle` (its fiber)
 *    in RN 0.81 (ReactNativeElement); `adoptRootFromInstance(ref)` walks `.return` up to the HostRoot.
 *
 * Nothing here ever throws into React or the app.
 */

/** Minimal shape of a React fiber (only what the assistant reads). */
export interface Fiber {
  tag: number;
  type: any;
  elementType: any;
  stateNode: any;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
  memoizedProps: any;
  memoizedState: any;
}

/** React 19.1 fiber tags used by the assistant. */
export const FiberTag = {
  FunctionComponent: 0,
  ClassComponent: 1,
  HostRoot: 3,
  HostComponent: 5,
  HostText: 6,
  ContextProvider: 10,
  ForwardRef: 11,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
  OffscreenComponent: 22,
  ActivityComponent: 31,
} as const;

interface FiberRoot {
  current: Fiber;
}

const HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';
const ROOTS_KEY = '__assistantFiberRoots';
const WRAPPED_KEY = '__assistantWrapped';

const g = globalThis as unknown as Record<string, any>;

/** Mounted roots in creation order (the app root is created before e.g. LogBox's). Survives module re-evaluation. */
const roots: Set<FiberRoot> = g[ROOTS_KEY] ?? (g[ROOTS_KEY] = new Set<FiberRoot>());

function isMounted(root: FiberRoot): boolean {
  return root.current?.memoizedState?.element != null;
}

function track(root: unknown): void {
  const r = root as FiberRoot | null | undefined;
  if (!r || !r.current) return;
  if (isMounted(r)) roots.add(r);
  else roots.delete(r);
}

function createMinimalHook() {
  const renderers = new Map<number, unknown>();
  let nextRendererId = 1;
  return {
    supportsFiber: true,
    isDisabled: false,
    renderers,
    inject(renderer: unknown): number {
      const id = nextRendererId++;
      renderers.set(id, renderer);
      return id;
    },
    checkDCE() {},
    onCommitFiberRoot(_rendererId: number, root: unknown) {
      try {
        track(root);
      } catch {}
    },
    onCommitFiberUnmount() {},
    onScheduleFiberRoot() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    getFiberRoots() {
      return roots;
    },
  };
}

function wrapExistingHook(hook: Record<string, any>): void {
  if (hook[WRAPPED_KEY]) return; // already wrapped (e.g. Fast Refresh re-evaluated this module)
  const original = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (this: unknown, ...args: unknown[]) {
    try {
      track(args[1]);
    } catch {}
    return typeof original === 'function' ? original.apply(this, args) : undefined;
  };
  hook[WRAPPED_KEY] = true;
}

function install(): void {
  try {
    // Web uses react-dom; this layer is native-only.
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') return;
    const existing = g[HOOK_KEY];
    if (existing && typeof existing === 'object') wrapExistingHook(existing);
    else g[HOOK_KEY] = createMinimalHook();
  } catch {
    // A frozen/odd hook must never break app start; getRootFiber() falls back to getFiberRoots().
  }
}

install();

function firstMountedRoot(): FiberRoot | null {
  for (const root of roots) {
    if (isMounted(root)) return root;
  }
  return null;
}

/** Latest committed fiber tree (`root.current`) of the app's root, or null if none was captured yet. */
export function getRootFiber(): Fiber | null {
  try {
    let root = firstMountedRoot();
    if (!root) {
      // Fallback: a real DevTools hook keeps its own set of mounted roots per renderer.
      const hook = g[HOOK_KEY];
      if (hook && typeof hook.getFiberRoots === 'function' && hook.renderers) {
        for (const id of hook.renderers.keys()) {
          for (const r of hook.getFiberRoots(id)) track(r);
        }
        root = firstMountedRoot();
      }
    }
    return root ? root.current : null;
  } catch {
    return null;
  }
}

/**
 * Hook-free fallback: pass any host component ref (e.g. `ref={adoptRootFromInstance}` on a View) and the
 * fiber root is derived from its `__internalInstanceHandle`.
 */
export function adoptRootFromInstance(instance: unknown): void {
  try {
    const inst = instance as any;
    let fiber: Fiber | null = inst?.__internalInstanceHandle ?? inst?.canonical?.internalInstanceHandle ?? null;
    while (fiber && fiber.tag !== FiberTag.HostRoot) fiber = fiber.return;
    if (fiber) track(fiber.stateNode);
  } catch {}
}
