// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PDKSRecords from "./PDKSRecords";
import type { PdksRecordsView } from "@/components/pdks/records/usePdksRecordsView";
import { PDKS_HIDDEN_DELAY_MS } from "@/hooks/usePdksLiveTable";

const state = vi.hoisted(() => ({ projectId: "project", history: vi.fn() }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: state.projectId, activeProject: { name: "Prova" }, loading: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/lib/pdksBatches", async original => ({ ...await original<typeof import("@/lib/pdksBatches")>(), loadPdksTable: (...args: unknown[]) => state.history(...args) }));
// Keep the real page, view/data hooks, React scheduler and Convex subscriptions.
// Only peripheral UI and the network transport are replaced.
vi.mock("@/components/shared/PageTemplate", () => ({ PageTemplate: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock("@/components/pdks/records/PdksRecordsResults", () => ({ PdksRecordsResults: ({ view }: { view: PdksRecordsView }) => <output>{view.isLoading ? "loading" : view.records.map(row => row.name).join(",") || "empty"}<button onClick={view.refresh}>refresh</button></output> }));

const listeners = new Set<() => void>();
const empty: never[] = [];
const roster = [{ employeeId: "employee", cardNumber: "1" }];
const row = { id: "employee", name: "Prova Employee", days: [], status: "absent", noShift: false };
let pending = false;
let batch = { kind: "table", rows: [row], availableDates: [], hasFlexible: false, eligibleEmployeeIds: ["employee"] };
const discovery = { ...batch, rows: empty };
const client = {
  watchQuery: (query: FunctionReference<"query">, args: { availabilityOnly?: boolean }) => ({
    localQueryResult: () => {
      if (pending) return undefined;
      const name = getFunctionName(query);
      if (name.endsWith(":todayRoster")) return roster;
      if (name.endsWith(":calculate")) return args.availabilityOnly ? discovery : batch;
      return empty;
    },
    onUpdate: (callback: () => void) => { listeners.add(callback); return () => listeners.delete(callback); },
    journal: () => undefined,
  }),
} as unknown as ConvexReactClient;
let root: Root;
let host: HTMLDivElement;
let errors: ReturnType<typeof vi.spyOn>;
const mount = async (search = "") => {
  await act(async () => root.render(<ConvexProvider client={client}><MemoryRouter initialEntries={[`/pdks${search}`]}><PDKSRecords /></MemoryRouter></ConvexProvider>));
};
const notify = async () => { await act(async () => { for (const callback of [...listeners]) callback(); }); };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.projectId = "project";
  state.history.mockResolvedValue([row]);
  pending = false;
  roster.splice(0, roster.length, { employeeId: "employee", cardNumber: "1" });
  batch = { ...batch, rows: [row] };
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  const messages = errors.mock.calls.flat().map(String).join("\n");
  errors.mockRestore();
  vi.useRealTimers();
  expect(messages).not.toMatch(/Too many re-renders|Maximum update depth|An error occurred/);
  expect(listeners.size).toBe(0);
});

it("renders the real PDKS page through loading, live results and badge updates", async () => {
  pending = true;
  await mount();
  expect(host.textContent).toContain("loading");
  pending = false;
  await notify();
  expect(host.textContent).toContain("Prova Employee");
  batch = { ...batch, rows: [{ ...row, name: "Badge Updated" }] };
  await notify();
  expect(host.textContent).toContain("Badge Updated");
  expect(host.textContent).not.toContain("PDKS kayıtları yüklenemedi");
});

it("renders historical snapshots with all five live query sets skipped", async () => {
  await mount("?date=2025-01-01");
  expect(host.textContent).toContain("Prova Employee");
  expect(state.history).toHaveBeenCalled();
});

it("renders an empty roster without a render-time subscription loop", async () => {
  roster.length = 0;
  await mount();
  expect(host.textContent).toContain("empty");
});

it("survives empty results, delayed hiding, resubscription and project changes", async () => {
  vi.useFakeTimers();
  await mount();
  expect(host.textContent).toContain("Prova Employee");
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(PDKS_HIDDEN_DELAY_MS); });
  expect(host.textContent).toContain("Prova Employee");
  expect(listeners.size).toBe(4); // Filter options remain subscribed.
  state.projectId = "other";
  await mount();
  expect(host.textContent).not.toContain("Prova Employee");
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(host.textContent).toContain("Prova Employee");
  batch = { ...batch, rows: [] };
  await notify();
  expect(host.textContent).toContain("empty");
});
