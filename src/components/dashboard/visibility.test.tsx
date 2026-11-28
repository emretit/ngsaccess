import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import LiveFeed from "./LiveFeed";
import DeviceHealth from "./DeviceHealth";
import SetupChecklist from "./SetupChecklist";

const state = vi.hoisted(() => ({ query: vi.fn(), hidden: true }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    state.query(getFunctionName(reference), args);
    return getFunctionName(reference) === "projects:getSetupStatus" ? { complete: false, steps: [] } : [];
  },
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "company", loading: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => Date.now() }));
beforeEach(() => {
  state.hidden = true;
  state.query.mockClear();
  const target = new EventTarget();
  Object.defineProperty(target, "hidden", { get: () => state.hidden });
  vi.stubGlobal("document", target);
});
afterEach(() => vi.unstubAllGlobals());
const render = () => renderToStaticMarkup(<MemoryRouter><LiveFeed /><DeviceHealth /><SetupChecklist /></MemoryRouter>);

it("skips every LiveFeed, DeviceHealth and SetupChecklist subscription while hidden", () => {
  render();
  expect(state.query.mock.calls).toEqual([
    ["dashboard:getRecentReadings", "skip"],
    ["dashboard:getReadingDevices", "skip"],
    ["devices:list", "skip"],
    ["projects:getSetupStatus", "skip"],
  ]);
});
it("opens every live subscription when visible again", () => {
  render();
  state.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  state.query.mockClear();
  render();
  expect(state.query.mock.calls).toEqual([
    ["dashboard:getRecentReadings", { projectId: "company", limit: 7, includeDevices: false }],
    ["dashboard:getReadingDevices", { projectId: "company", deviceIds: [] }],
    ["devices:list", { projectId: "company" }],
    ["projects:getSetupStatus", { projectId: "company" }],
  ]);
});
