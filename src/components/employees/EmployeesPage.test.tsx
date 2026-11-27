vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => projectState.hasProjectAccess && (permissionState.allowed === null || permissionState.allowed.includes(permission)), loading: permissionState.loading }) }));
import type { ReactNode, EffectCallback, DependencyList } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import Employees from "@/pages/Employees";
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: vi.fn() }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip" || navigation.loading) return undefined;
    const name = getFunctionName(ref);
    if (name === "employees:listSummary") return { modeToken: "legacy:2", counts: { all: 1, active: 1, inactive: 0, terminated: 0 } };
    if (name === "employees:list") return [{ _id: "e", firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", departmentId: "d", isActive: true }];
    return [];
  },
  usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage" }),
}));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ ...projectState, isAdmin: true }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ activeProject: { name: "Proje" } }) }));
vi.mock("@/components/departments/DepartmentTree", () => ({ default: () => null }));
vi.mock("./SlideOverPanel", () => ({ default: () => null }));
vi.mock("./EmployeeTable", () => ({ default: ({ employees, emptyState }: { employees: unknown[]; emptyState?: ReactNode }) => <table><thead><tr><th>Ad soyad</th></tr></thead><tbody><tr><td>{employees.length === 0 ? emptyState : null}</td></tr></tbody></table> }));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: ({ children, renderFallback }: { children: ReactNode; renderFallback?: (retry: () => void) => ReactNode }) => projectState.failed ? renderFallback?.(() => undefined) : <>{children}</> }));
// Render portal content inline so permission assertions inspect every menu option.
vi.mock("@/components/ui/dropdown-menu", async original => ({
  ...await original<typeof import("@/components/ui/dropdown-menu")>(),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, disabled, title }: { children: ReactNode; disabled?: boolean; title?: string }) => <button disabled={disabled} title={title}>{children}</button>,
}));
const projectState = vi.hoisted(() => ({ projectId: "p" as string | undefined, loading: false, hasProjectAccess: true, failed: false }));
const permissionState = vi.hoisted(() => ({ allowed: null as string[] | null, loading: false }));
afterEach(() => { permissionState.allowed = null; permissionState.loading = false; projectState.projectId = "p"; projectState.loading = false; projectState.hasProjectAccess = true; projectState.failed = false; });
function render(query: string) { return renderToStaticMarkup(<MemoryRouter initialEntries={[`/employees?${query}`]}><Employees /></MemoryRouter>); }
it("02-O1/D4: empty department explains direct membership and has one return action", () => {
  const html = render("department=empty");
  expect(html).toContain("<thead>");
  expect(html).toContain("Bu departmanda doğrudan bağlı kişi yok");
  expect(html).toContain("Tüm personele dön");
  expect(html).not.toContain("button:last-of-type");
  expect(html.slice(html.indexOf('role="search"'), html.indexOf('role="status"'))).toContain("Filtreleri temizle");
  expect(html).toContain("0 sonuç");
  expect(html).not.toContain("0–0");
});
it("02-O1/D4: empty search keeps the filter bar clear action and recovery action", () => {
  const html = render("q=bulunamayan");
  expect(html).toContain("Aramanızla eşleşen personel yok");
  expect(html).not.toContain("button:last-of-type");
  expect(html.slice(html.indexOf('role="search"'), html.indexOf('role="status"'))).toContain("Filtreleri temizle");
  expect(html.slice(html.indexOf('role="status"')).match(/Filtreleri temizle/g)).toHaveLength(1);
  expect(html).toContain("0 sonuç");
  expect(html).not.toContain("0–0");
});

it("personel yetkisi yüklenirken reddetmez, yetki yoksa listeyi oluşturmaz", () => {
  permissionState.allowed = [];
  permissionState.loading = true;
  let html = render("");
  expect(html).toContain("Personel bilgileri yükleniyor");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toContain("Proje erişimi yok");
  permissionState.loading = false;
  html = render("");
  expect(html).toContain("Personel görüntüleme yetkiniz yok");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toContain("Personel ekle");
});
it.each([
  [["employees.view", "employees.manage"], true, false],
  [["employees.view", "reports.view"], false, true],
  [["employees.view"], false, false],
] as const)("içe ve dışa aktarmayı ayrı yetkilerle gösterir: %j", (permissions, manage, reports) => {
  permissionState.allowed = [...permissions];
  const html = render("");
  expect(html.includes("İçe aktar")).toBe(manage);
  expect(html.includes("Dışa aktar")).toBe(reports);
  expect(html.includes("Personel ekle")).toBe(manage);
  expect(html.includes("İşlemler")).toBe(manage || reports);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Proje");
});

const navigation = vi.hoisted(() => ({
  effects: [] as { callback: EffectCallback; deps: DependencyList | undefined }[],
  writes: [] as unknown[], navigate: vi.fn(), loading: false,
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useEffect: (callback: EffectCallback, deps?: DependencyList) => { navigation.effects.push({ callback, deps }); },
    useState: <T,>(initial: T | (() => T)) => {
      const [value] = actual.useState(initial);
      return [value, (next: unknown) => navigation.writes.push(next)];
    },
  };
});
vi.mock("react-router-dom", async original => ({ ...await original<typeof import("react-router-dom")>(), useNavigate: () => navigation.navigate }));
it.each([
  ["p", "e", false, true],
  ["other-project", "e", false, false],
  ["p", "e", true, false],
  ["p", "missing", false, true],
])("taşıma bağlantısı doğru projede görünür kişiyi ya da sayfa dışı kişi sorgusunu açar: %s / %s / %s", (projectId, employeeId, loading, opens) => {
  navigation.effects = []; navigation.writes = []; navigation.navigate.mockClear(); navigation.loading = loading;
  const incoming = { transferEmployeeId: employeeId, transferProjectId: projectId };
  renderToStaticMarkup(<MemoryRouter initialEntries={[{ pathname: "/employees", state: incoming }]}><Employees /></MemoryRouter>);
  const effect = navigation.effects.find(item => item.deps?.includes(incoming));
  expect(effect).toBeDefined(); effect?.callback();
  expect(navigation.writes.some(value => value === true)).toBe(opens);
  if (opens && employeeId === "e") expect(navigation.writes).toContainEqual(expect.objectContaining({ _id: "e" }));
  if (opens && employeeId === "missing") expect(navigation.writes).toContain("missing");
  if (projectId === "p" && !loading) {
    expect(navigation.navigate).toHaveBeenCalledWith({ pathname: "/employees", search: "" }, { replace: true, state: null });
  } else expect(navigation.navigate).not.toHaveBeenCalled();
  navigation.loading = false;
});

it.each(["loading", "denied", "no-project"])("keeps the page heading in project state: %s", state => {
  projectState.loading = state === "loading";
  projectState.hasProjectAccess = state !== "denied";
  projectState.projectId = state === "no-project" ? undefined : "p";
  const html = render("");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Kişiler");
  expect(html).not.toContain("İşlemler");
  expect(html).toContain(state === "loading" ? "Personel bilgileri yükleniyor" : state === "denied" ? "Personel görüntüleme yetkiniz yok" : "Personelleri görmek için proje seçin");
});

it("keeps the employee page identity and retry action when the list boundary fails", () => {
  projectState.failed = true;
  const html = render("");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Kişiler");
  expect(html).toContain("Personel listesi yüklenemedi");
  expect(html).toContain("Tekrar Dene");
  expect(html).not.toMatch(/<main\b/);
  expect(html).not.toContain("Personel ekle");
});
