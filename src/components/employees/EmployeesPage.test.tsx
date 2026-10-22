vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permissionState.allowed === null || permissionState.allowed.includes(permission), loading: permissionState.loading }) }));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import Employees from "@/pages/Employees";
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", isAdmin: true }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ activeProject: { name: "Proje" } }) }));
vi.mock("@/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [{ _id: "e", firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", departmentId: "d", isActive: true }], isLoading: false, hasProjectAccess: true }) }));
vi.mock("@/components/departments/DepartmentTree", () => ({ default: () => null }));
vi.mock("./SlideOverPanel", () => ({ default: () => null }));
vi.mock("./EmployeeTable", () => ({ default: () => null }));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: ({ children }: { children: ReactNode }) => <>{children}</> }));
const permissionState = vi.hoisted(() => ({ allowed: null as string[] | null, loading: false }));
afterEach(() => { permissionState.allowed = null; permissionState.loading = false; });
function render(query: string) { return renderToStaticMarkup(<MemoryRouter initialEntries={[`/employees?${query}`]}><Employees /></MemoryRouter>); }
it("02-O1/D4: empty department explains direct membership and has one return action", () => {
  const html = render("department=empty");
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
