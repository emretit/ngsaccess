import type { Navigator } from "react-router-dom";

type Browser = Pick<Window, "history" | "addEventListener">;
type Request = (proceed: () => void) => void;
// One adapter per router, shared by every mounted form regardless of cleanup order.
const registry = new WeakMap<Navigator, { guards: Map<Request, boolean>; dispose: () => void; replace: Navigator["replace"] }>();
const popHandlers = new WeakMap<Browser, (event: PopStateEvent) => void>();
const intercepted = new WeakSet<Browser>();

/**
 * popstate fires only on window and listeners run in registration order (capture does not reorder them),
 * so BrowserRouter's own listener would navigate before a guard registered later could stop it.
 * main.tsx calls this before the router mounts; the listener then forwards to the active guard, if any.
 */
export function installPopstateInterceptor(browser: Browser = window) {
  if (intercepted.has(browser)) return;
  intercepted.add(browser);
  browser.addEventListener("popstate", event => popHandlers.get(browser)?.(event), true);
}

export function installNavigationGuard(navigator: Navigator, request: Request, browser: Browser = window, blocked = false) {
  let entry = registry.get(navigator);
  if (!entry) {
    const guards = new Map<Request, boolean>();
    const push = navigator.push;
    const replace = navigator.replace;
    let revision = 0;
    const ask = (navigate: () => void) => {
      const token = ++revision;
      const approved = new Set<Request>();
      const next = () => {
        if (token !== revision || [...guards.values()].some(Boolean)) return;
        const guard = [...guards.keys()].reverse().find(item => !approved.has(item));
        if (!guard) { revision++; navigate(); return; }
        let accepted = false;
        guard(() => { if (!accepted) { accepted = true; approved.add(guard); next(); } });
      };
      next();
    };
    let origin = historyIndex(browser.history.state);
    navigator.push = (...args) => ask(() => { push.apply(navigator, args); origin = historyIndex(browser.history.state); });
    navigator.replace = (...args) => ask(() => { replace.apply(navigator, args); origin = historyIndex(browser.history.state); });
    let restoring = false;
    let accepting = false;
    let delta = 0;
    const onPop = (event: PopStateEvent) => {
      if (accepting) { accepting = false; origin = historyIndex(event.state); return; }
      if (origin === undefined) return;
      const index = historyIndex(event.state);
      if (index === undefined) return;
      event.stopImmediatePropagation();
      if (restoring) {
        if (index !== origin) return;
        restoring = false;
        const approvedDelta = delta;
        ask(() => { accepting = true; browser.history.go(-approvedDelta); });
      } else if (index !== origin) {
        delta = origin - index;
        restoring = true;
        browser.history.go(delta);
      }
    };
    installPopstateInterceptor(browser);
    popHandlers.set(browser, onPop);
    entry = { guards, replace, dispose: () => {
      revision++;
      navigator.push = push;
      navigator.replace = replace;
      if (popHandlers.get(browser) === onPop) popHandlers.delete(browser);
      registry.delete(navigator);
    } };
    registry.set(navigator, entry);
  }
  // Each installation has a distinct identity, even if callers reuse a callback.
  const guard: Request = proceed => request(proceed);
  entry.guards.set(guard, blocked);
  const installed = entry;
  return () => {
    installed.guards.delete(guard);
    if (installed.guards.size === 0 && registry.get(navigator) === installed) installed.dispose();
  };
}
/** Router's own replace, bypassing installed guards. Only for a page's internal URL sync (no navigation). */
export function unguardedReplace(navigator: Navigator): Navigator["replace"] {
  const original = registry.get(navigator)?.replace ?? navigator.replace;
  return (...args) => original.apply(navigator, args);
}
function historyIndex(state: unknown): number | undefined {
  return state !== null && typeof state === "object" && "idx" in state && typeof state.idx === "number" ? state.idx : undefined;
}
