/** Successful edits invalidate table, payroll and annual snapshots in this browser's tabs. */
export const PDKS_INVALIDATED = "pdks-invalidated";
const storageKey = "ngs:pdks-invalidated";
const listeningWindows = new WeakSet<object>();
let epoch = 0;
export const pdksEpoch = () => epoch;
export function subscribePdksInvalidation(listener: () => void) {
  if (!listeningWindows.has(window)) {
    listeningWindows.add(window);
    window.addEventListener("storage", event => {
      if (event.key !== storageKey) return;
      epoch++;
      window.dispatchEvent(new Event(PDKS_INVALIDATED));
    });
  }
  window.addEventListener(PDKS_INVALIDATED, listener);
  return () => window.removeEventListener(PDKS_INVALIDATED, listener);
}
export function invalidatePdksSnapshots() {
  epoch++;
  if (typeof window !== "undefined") {
    try { window.localStorage?.setItem(storageKey, `${Date.now()}:${epoch}`); } catch { /* Storage can be disabled; local invalidation still works. */ }
    window.dispatchEvent(new Event(PDKS_INVALIDATED));
  }
}
