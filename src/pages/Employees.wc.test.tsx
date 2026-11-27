import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import Employees from "./Employees";

const state = vi.hoisted(() => ({ legacy: true, search: "", queries: [] as { name: string; args: unknown }[], paginated: [] as { name: string; args: unknown }[], table: undefined as { employees: { firstName: string }[]; loading: boolean } | undefined }));
const people = Array.from({ length: 12 }, (_, i) => ({ _id: `e${i}`, firstName: `Kişi ${i + 1}`, lastName: "Test", email: "", cardNumber: "", isActive: true }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", activeProject: { name: "Test" }, loading: false }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ activeProject: { name: "Test" } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (name: string) => name === "employees.view", loading: false }) }));
vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams(state.search), () => {}],
  useLocation: () => ({ state: null, pathname: "/employees", search: "" }), useNavigate: () => () => {},
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: vi.fn() }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref);
    state.queries.push({ name, args });
    if (args === "skip") return undefined;
    if (name === "employees:listSummary") return { modeToken: state.legacy ? "legacy:1:x" : "indexed:1:x", counts: { all: 12, active: 12, inactive: 0, terminated: 0 } };
    if (name === "employees:list") return people;
    return [];
  },
  usePaginatedQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    state.paginated.push({ name: getFunctionName(ref), args });
    return args === "skip" ? { results: [], status: "LoadingFirstPage" } : { results: [{ page: people.slice(0, 2), continueCursor: "next", isDone: false }], status: "Exhausted" };
  },
}));
vi.mock("@/components/shared/PageTemplate", () => ({ PageTemplate: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <>{children}{footer}</> }));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/employees/EmployeeTable", () => ({ default: (props: { employees: { firstName: string }[]; loading: boolean }) => { state.table = props; return <p>Table</p>; } }));
vi.mock("@/components/employees/SlideOverPanel", () => ({ default: () => null }));
beforeEach(() => { state.legacy = true; state.search = ""; state.queries = []; state.paginated = []; state.table = undefined; });

it("preserves the old one-subscription client pagination while legacy keys are missing", () => {
  state.search = "page=2&size=10";
  const html = renderToStaticMarkup(<Employees />);
  expect(state.queries.find(query => query.name === "employees:list")?.args).toEqual({ projectId: "p" });
  expect(state.paginated[0].args).toBe("skip");
  expect(state.table?.employees.map(row => row.firstName)).toEqual(["Kişi 11", "Kişi 12"]);
  expect(state.table?.loading).toBe(false);
  expect(html).toContain("12 personelden 12 sonuç");
});

it("subscribes only to the visible indexed window and forwards all server filters", () => {
  state.legacy = false;
  state.search = "q=ışık&department=dep&company=c&status=inactive&sort=name:desc&children=1&size=25";
  renderToStaticMarkup(<Employees />);
  expect(state.queries.find(query => query.name === "employees:list")?.args).toBe("skip");
  expect(state.paginated[0]).toMatchObject({ name: "employees:listPageWindow", args: { projectId: "p", search: "ışık", department: "dep", company: "c", status: "inactive", sort: "name:desc", includeChildren: true, pageSize: 25, startCursor: null } });
  expect(state.table?.employees).toHaveLength(2);
  expect(state.table?.loading).toBe(false);
});
