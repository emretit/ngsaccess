import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { DASHBOARD_REFRESH_MS, useVisibleRefresh } from "./useVisibleRefresh";

const state = vi.hoisted(() => ({
  cursor: 0, slots: [] as unknown[], dependencies: [] as (readonly unknown[] | undefined)[],
  cleanups: [] as ((() => void) | undefined)[], effects: [] as (() => void)[],
  client: { query: vi.fn() },
}));
vi.mock("convex/react", () => ({ useConvex: () => state.client }));
vi.mock("react", () => {
  const effect = (run: () => void | (() => void), dependencies: readonly unknown[]) => {
    const slot = state.cursor++;
    const previous = state.dependencies[slot];
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
      state.dependencies[slot] = dependencies;
      state.effects.push(() => { state.cleanups[slot]?.(); state.cleanups[slot] = run() ?? undefined; });
    }
  };
  return {
    useEffect: effect,
    useMemo: <T>(produce: () => T, dependencies: readonly unknown[]) => {
      const slot = state.cursor++, previous = state.dependencies[slot];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
        state.dependencies[slot] = dependencies;
        state.slots[slot] = produce();
      }
      return state.slots[slot] as T;
    },
    useState: vi.fn(),
    useSyncExternalStore: <T>(subscribe: (listener: () => void) => () => void, snapshot: () => T) => {
      effect(() => subscribe(() => {}), [subscribe]);
      return snapshot();
    },
  };
});
const reference = makeFunctionReference<"query", { projectId: string }, { value: string }>("dashboard:summary");
let hidden = false;
function visibility(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}
function render<T>(Probe: () => T) {
  state.cursor = 0;
  const result = Probe();
  state.effects.splice(0).forEach(effect => effect());
  return result;
}
const Probe = (projectId = "a") => useVisibleRefresh(reference, { projectId });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  const target = new EventTarget();
  Object.defineProperty(target, "hidden", { get: () => hidden });
  vi.stubGlobal("document", target);
  state.client.query.mockResolvedValue({ value: "fresh" });
});
afterEach(() => {
  state.cleanups.forEach(cleanup => cleanup?.());
  state.slots = []; state.dependencies = []; state.cleanups = []; state.effects = [];
  vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

it("makes zero requests while hidden, including manual refresh, and refreshes on return", async () => {
  visibility(true);
  render(Probe).refresh();
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS * 3);
  expect(state.client.query).not.toHaveBeenCalled();
  visibility(false);
  await flush();
  expect(state.client.query).toHaveBeenCalledTimes(1);
  expect(render(Probe)).toMatchObject({ data: { value: "fresh" }, loading: false, updatedAt: expect.any(Number) });
  visibility(true);
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS * 4);
  expect(state.client.query).toHaveBeenCalledTimes(1);
  visibility(false);
  await flush();
  expect(state.client.query).toHaveBeenCalledTimes(2);
});

it("shares the two-minute timer and manual refresh across consumers of the same summary", async () => {
  const both = () => [Probe(), Probe()];
  render(both);
  await flush();
  expect(state.client.query).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS - 1);
  expect(state.client.query).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(state.client.query).toHaveBeenCalledTimes(2);
  render(both)[0].refresh();
  await flush();
  expect(state.client.query).toHaveBeenCalledTimes(3);
});

it("refreshes after a pending request when the tab returns without overlapping requests", async () => {
  let resolvePending: ((value: { value: string }) => void) | undefined;
  state.client.query.mockImplementationOnce(() => new Promise(resolve => { resolvePending = resolve; }));
  render(Probe);
  visibility(true);
  visibility(false);
  expect(state.client.query).toHaveBeenCalledTimes(1);
  resolvePending?.({ value: "before returning" });
  await flush();
  expect(state.client.query).toHaveBeenCalledTimes(2);
  expect(render(Probe).data).toEqual({ value: "fresh" });
});

it("clears data, errors and timestamps on company change and ignores old in-flight results", async () => {
  render(Probe);
  await flush();
  expect(render(Probe).data).toEqual({ value: "fresh" });
  let resolveOld: ((value: { value: string }) => void) | undefined;
  state.client.query.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(Probe).refresh();
  state.client.query.mockImplementationOnce(() => new Promise(() => {}));
  expect(render(() => Probe("b"))).toMatchObject({ loading: true });
  resolveOld?.({ value: "old company" });
  await flush();
  const next = render(() => Probe("b"));
  expect(next.data).toBeUndefined();
  expect(next.error).toBeUndefined();
  expect(next.updatedAt).toBeUndefined();
  expect(state.client.query.mock.calls[state.client.query.mock.calls.length - 1]?.[1]).toEqual({ projectId: "b" });
});

it("exposes refresh errors with the last success time and recovers through manual retry", async () => {
  render(Probe);
  await flush();
  const updatedAt = render(Probe).updatedAt;
  state.client.query.mockRejectedValueOnce(new Error("Bağlantı hatası"));
  render(Probe).refresh();
  expect(render(Probe).loading).toBe(true);
  await flush();
  expect(render(Probe)).toMatchObject({ error: "Bağlantı hatası", loading: false, updatedAt, data: { value: "fresh" } });
  render(Probe).refresh();
  await flush();
  expect(render(Probe).error).toBeUndefined();
});

it("skips disabled scopes and cleans up timers and listeners on unmount", async () => {
  render(() => useVisibleRefresh(reference, "skip"));
  visibility(false);
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS);
  expect(state.client.query).not.toHaveBeenCalled();
  render(Probe);
  await flush();
  state.cleanups.forEach(cleanup => cleanup?.());
  visibility(false);
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS * 3);
  expect(state.client.query).toHaveBeenCalledTimes(1);
});

it("reuses the current entry when an old subscriber returns after a replacement mounted", async () => {
  render(Probe);
  await flush();
  const subscribeOld = state.dependencies[1]?.[0] as (listener: () => void) => () => void;
  state.cleanups.forEach(cleanup => cleanup?.());
  state.slots = []; state.dependencies = []; state.cleanups = [];
  render(Probe);
  await flush();
  const stopOld = subscribeOld(() => {});
  expect(state.client.query).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS);
  expect(state.client.query).toHaveBeenCalledTimes(3);
  state.cleanups.forEach(cleanup => cleanup?.());
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS);
  expect(state.client.query).toHaveBeenCalledTimes(4);
  stopOld();
  await vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS);
  expect(state.client.query).toHaveBeenCalledTimes(4);
});

it("does not cache abandoned renders and sanitizes Convex errors", async () => {
  state.cursor = 0;
  Probe(); // The render is abandoned before its subscription effect runs.
  state.effects = []; state.slots = []; state.dependencies = [];
  expect(state.client.query).not.toHaveBeenCalled();
  state.client.query.mockRejectedValueOnce(new Error("[CONVEX Q(dashboard:summary)] [Request ID: secret] Server Error\nUncaught Error: Bağlantı kurulamadı\n at handler (convex/dashboard.ts:12)"));
  render(Probe);
  await flush();
  expect(render(Probe).error).toBe("Bağlantı kurulamadı");
  expect(vi.getTimerCount()).toBe(1);
});
