vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permissionState.allowed === null || permissionState.allowed.includes(permission), loading: permissionState.loading }) }));
import type { ReactNode, EffectCallback, DependencyList } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import Employees from "@/pages/Employees";
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", isAdmin: true }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ activeProject: { name: "Proje" } }) }));
vi.mock("@/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [{ _id: "e", firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", departmentId: "d", isActive: true }], isLoading: navigation.loading, hasProjectAccess: true }) }));
vi.mock("@/components/departments/DepartmentTree", () => ({ default: () => null }));
vi.mock("./SlideOverPanel", () => ({ default: () => null }));
vi.mock("./EmployeeTable", () => ({ default: ({ employees, emptyState }: { employees: unknown[]; emptyState?: ReactNode }) => <table><thead><tr><th>Ad soyad</th></tr></thead><tbody><tr><td>{employees.length === 0 ? emptyState : null}</td></tr></tbody></table> }));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: ({ children }: { children: ReactNode }) => <>{children}</> }));
const permissionState = vi.hoisted(() => ({ allowed: null as string[] | null, loading: false }));
afterEach(() => { permissionState.allowed = null; permissionState.loading = false; });
function render(query: string) { return renderToStaticMarkup(<MemoryRouter initialEntries={[`/employees?${query}`]}><Employees /></MemoryRouter>); }
it("02-O1/D4: empty department explains direct membership and has one return action", () => {
  const html = render("department=empty");
  expect(html).toContain("<thead>");
  expect(html).toContain("Bu departmanda doğrudan bağlı kişi yok");
  expect(html).toContain("Tüm personele dön");
  expect(html).toContain("[&amp;&gt;[role=search]&gt;button:last-of-type]:hidden");
  expect(html).toContain("0 sonuç");
  expect(html).not.toContain("0–0");
});
it("02-O1/D4: empty search has exactly one clear action and short summary", () => {
  const html = render("q=bulunamayan");
  expect(html).toContain("Aramanızla eşleşen personel yok");
  expect(html).toContain("[&amp;&gt;[role=search]&gt;button:last-of-type]:hidden");
  expect(html.slice(html.indexOf('role="status"')).match(/Filtreleri temizle/g)).toHaveLength(1);
  expect(html).toContain("0 sonuç");
  expect(html).not.toContain("0–0");
});

it("personel yetkisi yüklenirken reddetmez, yetki yoksa listeyi oluşturmaz", () => {
  permissionState.allowed = [];
  permissionState.loading = true;
  let html = render("");
  expect(html).toContain("Personel bilgileri yükleniyor");
  expect(html).not.toContain("Proje erişimi yok");
  permissionState.loading = false;
  html = render("");
  expect(html).toContain("Personel görüntüleme yetkiniz yok");
  expect(html).not.toContain("Personel ekle");
});
it.each([
  [["employees.view", "employees.manage"], true, false],
  [["employees.view", "reports.view"], false, true],
] as const)("içe ve dışa aktarmayı ayrı yetkilerle gösterir: %j", (permissions, manage, reports) => {
  permissionState.allowed = [...permissions];
  const html = render("");
  expect(html.includes("İçe aktar")).toBe(manage);
  expect(html.includes("Dışa aktar")).toBe(reports);
  expect(html.includes("Personel ekle")).toBe(manage);
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
  ["p", "missing", false, false],
])("taşıma bağlantısı yalnız doğru proje ve yüklenen kayıtta drawer açar: %s / %s / %s", (projectId, employeeId, loading, opens) => {
  navigation.effects = []; navigation.writes = []; navigation.navigate.mockClear(); navigation.loading = loading;
  const incoming = { transferEmployeeId: employeeId, transferProjectId: projectId };
  renderToStaticMarkup(<MemoryRouter initialEntries={[{ pathname: "/employees", state: incoming }]}><Employees /></MemoryRouter>);
  const effect = navigation.effects.find(item => item.deps?.includes(incoming));
  expect(effect).toBeDefined(); effect?.callback();
  expect(navigation.writes.some(value => value === true)).toBe(opens);
  if (opens) expect(navigation.writes).toContainEqual(expect.objectContaining({ _id: "e" }));
  if (projectId === "p" && !loading) {
    expect(navigation.navigate).toHaveBeenCalledWith({ pathname: "/employees", search: "" }, { replace: true, state: null });
  } else expect(navigation.navigate).not.toHaveBeenCalled();
  navigation.loading = false;
});
