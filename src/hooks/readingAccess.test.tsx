import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { usePdksTableData } from "./usePdksTableData";
import { useDashboardActivity, useDashboardReadings, useDashboardTimeline } from "./useDashboard";
const state = vi.hoisted(() => ({ projectId: "project" as string | undefined, permissions: [] as string[], query: vi.fn<(ref: Parameters<typeof getFunctionName>[0], args: unknown) => void>() }));
vi.mock("convex/react", () => ({ useConvexAuth: () => ({ isAuthenticated: true }), useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { state.query(ref, args); return undefined; } }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: state.projectId, loading: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => state.permissions.includes(permission), loading: false }) }));
function Probe() {
  usePdksTableData();
  useDashboardActivity();
  useDashboardTimeline();
  useDashboardReadings();
  return null;
}
beforeEach(() => { state.query.mockClear(); state.projectId = "project"; state.permissions = []; });
it.each([
  { permissions: [], reports: false, monitoring: false },
  { permissions: ["devices.manage"], reports: false, monitoring: true },
  { permissions: ["reports.view"], reports: true, monitoring: true },
])("skips queries according to active grants: $permissions", ({ permissions, reports, monitoring }) => {
  state.permissions = permissions;
  renderToStaticMarkup(<Probe />);
  const calls = new Map(state.query.mock.calls.map(([ref, args]) => [getFunctionName(ref), args]));
  for (const name of ["cardReadings:getPdksTableData", "dashboard:getActivitySummary"]) expect(calls.get(name) !== "skip").toBe(reports);
  for (const name of ["dashboard:getTodayTimeline", "dashboard:getRecentReadings"]) expect(calls.get(name) !== "skip").toBe(monitoring);
});
it("skips all project queries while no project is selected", () => {
  state.permissions = ["reports.view", "devices.manage"];
  state.projectId = undefined;
  renderToStaticMarkup(<Probe />);
  expect(state.query.mock.calls.map(call => call[1])).toEqual(["skip", "skip", "skip", "skip"]);
});
