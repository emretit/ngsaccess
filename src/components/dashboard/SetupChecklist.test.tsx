import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SetupChecklist from "./SetupChecklist";

const mocks = vi.hoisted(() => ({
  project: { projectId: "p1", isAdmin: true, loading: false },
  status: { steps: [
    { key: "administrator", done: true }, { key: "device", done: false },
    { key: "cardholder", done: false }, { key: "accessRule", done: false },
    { key: "firstPassage", done: false },
  ], complete: false },
  query: vi.fn(),
  effects: [] as Array<() => void>,
  dismiss: undefined as (() => void) | undefined,
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void) => { mocks.effects.push(effect); },
}));
vi.mock("@/components/ui/button", () => ({ Button: ({ onClick }: { onClick: () => void }) => {
  mocks.dismiss = onClick;
  return <button onClick={onClick}>Şimdilik gizle</button>;
} }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => mocks.project }));
vi.mock("convex/react", () => ({ useQuery: (_query: unknown, args: unknown) => { mocks.query(args); return mocks.status; } }));
const render = () => renderToStaticMarkup(<MemoryRouter><SetupChecklist /></MemoryRouter>);
beforeEach(() => { mocks.project = { projectId: "p1", isAdmin: true, loading: false }; mocks.status.complete = false; mocks.query.mockClear(); mocks.effects = []; mocks.dismiss = undefined;
  const storage = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
});
afterEach(() => vi.unstubAllGlobals());
describe("kurulum listesi", () => {
  it("renders all five statuses and destinations with technical service and Excel guidance", () => {
    const html = render();
    expect(html).toContain("1/5 adım tamam");
    expect(html.match(/>Tamam</g)).toHaveLength(1);
    expect(html.match(/>Bekliyor</g)).toHaveLength(4);
    for (const route of ["/settings?tab=users", "/devices", "/employees", "/access-control", "/pdks-records"]) expect(html).toContain(`href="${route}"`);
    expect(html).toContain("ISUP"); expect(html).toContain("broker"); expect(html).toContain("Excel içe aktarma");
    expect(html).toContain("Şimdilik gizle");
  });
  it("renders nothing after completion", () => { mocks.status.complete = true; expect(render()).toBe(""); });
  it("persists first completion, skips after remount and uses the selected project's key", () => {
    mocks.status.complete = true;
    expect(render()).toBe("");
    // SSR does not run effects; flush the captured client effect before remounting.
    for (const effect of mocks.effects) effect();
    expect(window.localStorage.getItem("ngs.setupChecklist.done.p1")).toBe("1");
    mocks.status.complete = false;
    expect(render()).toBe("");
    expect(mocks.query).toHaveBeenLastCalledWith("skip");
    mocks.project.projectId = "p2";
    expect(render()).toContain("Kurulumu tamamlayın");
    expect(mocks.query).toHaveBeenLastCalledWith({ projectId: "p2" });
    mocks.project.projectId = "p1";
    expect(render()).toBe("");
    expect(mocks.query).toHaveBeenLastCalledWith("skip");
  });
  it("skips a dismissed project after remount without hiding another project", () => {
    render(); mocks.dismiss?.();
    expect(window.localStorage.getItem("ngs.setupChecklist.hidden.p1")).toBe("1");
    expect(render()).toBe("");
    expect(mocks.query).toHaveBeenLastCalledWith("skip");
    mocks.project.projectId = "p2";
    expect(render()).toContain("Kurulumu tamamlayın");
    expect(mocks.query).toHaveBeenLastCalledWith({ projectId: "p2" });
  });
  it("renders nothing for project_user and skips the admin query", () => {
    mocks.project.isAdmin = false;
    expect(render()).toBe(""); expect(mocks.query).toHaveBeenCalledWith("skip");
  });
  it("skips the query when no project is selected", () => {
    mocks.project.projectId = "";
    expect(render()).toBe(""); expect(mocks.query).toHaveBeenCalledWith("skip");
  });
});
