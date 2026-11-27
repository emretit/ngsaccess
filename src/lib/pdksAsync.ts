export class PdksCancelledError extends Error {
  constructor() { super("Hesaplama iptal edildi"); }
}
export function checkPdksCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new PdksCancelledError();
}
export interface PdksSharedEntry<T> {
  at: number; done: boolean; users: number; controller: AbortController; promise: Promise<T>;
}
/** Cancels outstanding work only after its last observer leaves. */
export function pdksShared<T>(cache: Map<string, PdksSharedEntry<T>>, key: string,
  produce: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, maxEntries = 3): Promise<T> {
  checkPdksCancelled(signal);
  let entry = cache.get(key);
  if (entry && (Date.now() - entry.at > 300000 || entry.controller.signal.aborted)) { cache.delete(key); entry = undefined; }
  if (!entry) {
    const controller = new AbortController();
    const created: PdksSharedEntry<T> = { at: Date.now(), done: false, users: 0, controller, promise: Promise.resolve().then(() => produce(controller.signal)) };
    created.promise = created.promise.then(data => { created.done = true; created.at = Date.now(); return data; }, error => {
      if (cache.get(key) === created) cache.delete(key);
      throw error;
    });
    entry = created;
    cache.set(key, created);
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value ?? "");
  }
  const shared = entry;
  shared.users++;
  return new Promise<T>((resolve, reject) => {
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      signal?.removeEventListener("abort", abort);
      if (--shared.users === 0 && !shared.done) {
        shared.controller.abort();
        if (cache.get(key) === shared) cache.delete(key);
      }
    };
    const abort = () => { release(); reject(new PdksCancelledError()); };
    signal?.addEventListener("abort", abort, { once: true });
    shared.promise.then(data => { if (active) { release(); resolve(data); } }, error => { if (active) { release(); reject(error); } });
  });
}
