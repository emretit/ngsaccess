import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { trTodayKey } from "../../convex/lib/trDate";
import { usePdksTableSnapshot } from "./usePdksSnapshot";
import { useAnnualOvertime } from "./useAnnualOvertime";
import { usePdksLiveTable } from "./usePdksLiveTable";
import { pdksEpoch } from "../lib/pdksInvalidation";
const state = vi.hoisted(() => ({
  availabilityUnknown: false,
  cursor: 0, slots: [] as unknown[], dependencies: [] as (readonly unknown[] | undefined)[], cleanups: [] as (() => void)[], effects: [] as (() => void)[],
  dense: false, revision: "v1" as string | undefined, roster: [{ employeeId: "employee", cardNumber: "1" }], rows: [{ id: "employee", name: "v1", days: [] }], client: {}, query: vi.fn(), table: vi.fn(), annual: vi.fn(), invalidateAnnual: vi.fn(),
}));
vi.mock("react", () => ({
  useState: <T>(initial: T) => {
    const slot = state.cursor++;
    if (!(slot in state.slots)) state.slots[slot] = initial;
    return [state.slots[slot] as T, (value: T | ((previous: T) => T)) => { state.slots[slot] = typeof value === "function" ? (value as (previous: T) => T)(state.slots[slot] as T) : value; }];
  },
  useMemo: <T>(produce: () => T) => produce(),
  useEffect: (run: () => void | (() => void), dependencies: readonly unknown[]) => {
    const slot = state.cursor++, previous = state.dependencies[slot];
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
      state.dependencies[slot] = dependencies;
      state.effects.push(() => { state.cleanups[slot]?.(); const cleanup = run(); if (cleanup) state.cleanups[slot] = cleanup; });
    }
  },
}));
vi.mock("convex/react", () => ({ useConvex: () => state.client,
  useQueries: (requests: Record<string, { query: Parameters<typeof getFunctionName>[0]; args: { availabilityOnly?: boolean; employeeIds?: string[] } }>) => {
    state.query(requests);
    return Object.fromEntries(Object.entries(requests).map(([key, { query, args }]) => [key,
      getFunctionName(query).endsWith(":todayRoster") ? state.roster : getFunctionName(query).endsWith(":todayAvailability") ? (state.availabilityUnknown ? null : []) : getFunctionName(query).endsWith(":todayDeviceAvailability") ? [] :
      state.dense && args.employeeIds?.includes("e0") && args.employeeIds.length > 32 ? Object.assign(new Error("budget"), { data: { code: "PDKS_READ_BUDGET" } }) :
      { kind: "table", rows: args.availabilityOnly ? [] : state.rows, availableDates: [trTodayKey()], hasFlexible: false, eligibleEmployeeIds: ["employee"] },
    ]));
  },
}));
vi.mock("@/lib/pdksBatches", async original => ({ ...await original<typeof import("@/lib/pdksBatches")>(), loadPdksTable: (...args: unknown[]) => state.table(...args), loadPdksPayroll: vi.fn() }));
vi.mock("@/lib/pdksAnnual", () => ({ loadAnnualOvertime: (...args: unknown[]) => state.annual(...args), invalidateAnnualOvertime: () => state.invalidateAnnual() }));
function render<T>(hook: () => T) {
  state.cursor = 0;
  const result = hook();
  state.effects.splice(0).forEach(effect => effect());
  return result;
}
beforeEach(() => { state.dense = false; state.roster = [{ employeeId: "employee", cardNumber: "1" }]; vi.stubGlobal("window", new EventTarget()); state.table.mockResolvedValue([]); state.annual.mockResolvedValue([]); state.revision = "v1"; state.rows = [{ id: "employee", name: "v1", days: [] }]; });
afterEach(() => { state.cleanups.forEach(cleanup => cleanup()); state.slots = []; state.dependencies = []; state.cleanups = []; state.effects = []; vi.clearAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => { state.availabilityUnknown = false; });
it("unknown shared availability does not block the live rows or surface a budget error", () => {
  state.availabilityUnknown = true;
  const result = render(() => usePdksLiveTable({ projectId: "project" as Id<"projects">, date: trTodayKey() }));
  expect(result.availabilityUnknown).toBe(true);
  expect(result.data?.[0]?.name).toBe("v1");
  expect(result.error).toBeUndefined();
});
it("today uses bounded group subscriptions without reloading the full snapshot for badge changes", async () => {
  const args = { projectId: "project" as Id<"projects">, date: trTodayKey() };
  expect(render(() => usePdksTableSnapshot(args)).data?.[0]?.name).toBe("v1");
  await Promise.resolve();
  expect(state.table).not.toHaveBeenCalled();
  state.rows = [{ id: "employee", name: "v2", days: [] }];
  const next = render(() => usePdksTableSnapshot(args));
  expect(next.live).toBe(true);
  expect(next.data?.[0]?.name).toBe("v2");
  expect(state.table).not.toHaveBeenCalled();
});
it("past days skip the live range and changes to today's revision do not reload them", async () => {
  const args = { projectId: "project" as Id<"projects">, date: "2025-01-01" };
  expect(render(() => usePdksTableSnapshot(args)).live).toBe(false);
  await Promise.resolve();
  state.revision = "v2";
  render(() => usePdksTableSnapshot(args));
  expect(state.query.mock.calls.every(([requests]) => Object.keys(requests).length === 0)).toBe(true);
  expect(state.table).toHaveBeenCalledTimes(1);
});
it("annual refresh clears only its own result and does not invalidate table/payroll", async () => {
  const args = { projectId: "project" as Id<"projects">, year: 2026 };
  const before = pdksEpoch();
  const result = render(() => useAnnualOvertime(args));
  await Promise.resolve();
  result.refresh();
  render(() => useAnnualOvertime(args));
  expect(state.invalidateAnnual).toHaveBeenCalledOnce();
  expect(pdksEpoch()).toBe(before);
  expect(state.annual).toHaveBeenCalledTimes(2);
});

it("a successful edit in another browser tab invalidates a historical snapshot", async () => {
  const args = { projectId: "project" as Id<"projects">, date: "2025-01-01" };
  render(() => usePdksTableSnapshot(args));
  await Promise.resolve();
  const before = pdksEpoch();
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: "ngs:pdks-invalidated" });
  window.dispatchEvent(event);
  render(() => usePdksTableSnapshot(args));
  expect(pdksEpoch()).toBe(before + 1);
  expect(state.table).toHaveBeenCalledTimes(2);
});

it("splits only the failed group and keeps healthy subscriptions and date arguments stable", () => {
  state.roster = Array.from({ length: 129 }, (_, i) => ({ employeeId: `e${i}`, cardNumber: String(i) }));
  state.dense = true;
  const args = { projectId: "project" as Id<"projects">, date: trTodayKey() };
  render(() => usePdksTableSnapshot(args));
  state.query.mockClear();
  render(() => usePdksTableSnapshot(args));
  const calls = state.query.mock.calls.flatMap(([requests]) => Object.entries(requests as Record<string, { query: Parameters<typeof getFunctionName>[0]; args: { employeeIds?: string[]; date?: string } }>));
  const groups = calls.filter(([, request]) => request.args.employeeIds).map(([, request]) => request.args.employeeIds?.length);
  expect(groups).toContain(64);
  expect(groups.filter(size => size === 32).length).toBeGreaterThanOrEqual(2);
  expect(groups).toContain(1);
  expect(calls.find(([, request]) => getFunctionName(request.query).endsWith(":todayRoster"))?.[1].args.date).toBe(args.date);
});
