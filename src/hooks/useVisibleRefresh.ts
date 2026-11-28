import { errorMessage } from "@/lib/notify";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";
import { getFunctionName, makeFunctionReference, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";

export const DASHBOARD_REFRESH_MS = 2 * 60_000;
const visible = () => typeof document === "undefined" || !document.hidden;

export function useTabVisible(hiddenDelayMs = 0) {
  const [isVisible, setVisible] = useState(visible());
  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (visible() || hiddenDelayMs === 0) setVisible(visible());
      else timer = setTimeout(() => setVisible(false), hiddenDelayMs);
    };
    document.addEventListener("visibilitychange", update);
    update();
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", update); };
  }, [hiddenDelayMs]);
  return isVisible;
}

type Snapshot<T> = { data?: T; loading: boolean; error?: string; updatedAt?: number };
type Entry<T> = { snapshot: Snapshot<T>; subscribe: (listener: () => void) => () => void; refresh: () => void };
type Client = ReturnType<typeof useConvex>;
const clients = new WeakMap<Client, Map<string, Entry<unknown>>>();
const skipped: Snapshot<never> = { loading: false };
const pending: Snapshot<never> = { loading: true };

/** One polling lifecycle per client/query/scope, shared by all dashboard panels. */
function createEntry<T>(load: () => Promise<T>, remove: () => void): Entry<T> {
  const listeners = new Set<() => void>();
  let generation = 0;
  let inFlight = false;
  let refreshAfterFlight = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const publish = (snapshot: Snapshot<T>) => {
    entry.snapshot = snapshot;
    listeners.forEach(listener => listener());
  };
  const entry: Entry<T> = {
    snapshot: { loading: true },
    refresh: () => {
      if (!visible() || !listeners.size || inFlight) return;
      const current = generation;
      inFlight = true;
      publish({ ...entry.snapshot, loading: true, error: undefined });
      void (async () => {
        try {
          const data = await load();
          if (current === generation) publish({ data, loading: false, updatedAt: Date.now() });
        } catch (error: unknown) {
          if (current === generation) publish({ ...entry.snapshot, loading: false, error: errorMessage(error) });
        } finally {
          if (current === generation) {
            inFlight = false;
            if (refreshAfterFlight) { refreshAfterFlight = false; entry.refresh(); }
          }
        }
      })();
    },
    subscribe: listener => {
      listeners.add(listener);
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", onVisibility);
        onVisibility();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          generation++;
          inFlight = false;
          refreshAfterFlight = false;
          clearInterval(timer);
          document.removeEventListener("visibilitychange", onVisibility);
          remove();
        }
      };
    },
  };
  function onVisibility() {
    clearInterval(timer);
    if (visible()) {
      if (inFlight) refreshAfterFlight = true;
      else entry.refresh();
      timer = setInterval(entry.refresh, DASHBOARD_REFRESH_MS);
    } else refreshAfterFlight = false;
  }
  return entry;
}

export function useVisibleRefresh<Q extends FunctionReference<"query">>(reference: Q, args: FunctionArgs<Q> | "skip") {
  const client = useConvex();
  const serializedArgs = args === "skip" ? null : JSON.stringify(args);
  const queryName = getFunctionName(reference);
  const key = serializedArgs === null ? null : `${queryName}:${serializedArgs}`;
  const store = useMemo(() => {
    if (key === null || serializedArgs === null) return null;
    const queryArgs = JSON.parse(serializedArgs) as FunctionArgs<Q>;
    const queryReference = makeFunctionReference<"query", FunctionArgs<Q>, FunctionReturnType<Q>>(queryName);
    const current = () => clients.get(client)?.get(key) as Entry<FunctionReturnType<Q>> | undefined;
    return {
      snapshot: () => current()?.snapshot ?? pending,
      refresh: () => current()?.refresh(),
      subscribe: (listener: () => void) => {
        let cache = clients.get(client);
        if (!cache) { cache = new Map(); clients.set(client, cache); }
        let entry = current();
        if (!entry) {
          const entries = cache;
          const created = createEntry(() => client.query(queryReference, queryArgs), () => {
            if (entries.get(key) === created) entries.delete(key);
          });
          entries.set(key, created);
          entry = created;
        }
        return entry.subscribe(listener);
      },
    };
  }, [client, queryName, key, serializedArgs]);
  const state = useSyncExternalStore(store?.subscribe ?? subscribeSkipped, store?.snapshot ?? skippedSnapshot, skippedSnapshot);
  return { ...state, refresh: store?.refresh ?? refreshSkipped };
}
const skippedSnapshot = () => skipped;
const subscribeSkipped = () => () => {};
const refreshSkipped = () => {};
