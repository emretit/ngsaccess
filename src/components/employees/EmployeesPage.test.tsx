import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import Employees from "@/pages/Employees";
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", isAdmin: true }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ activeProject: { name: "Proje" } }) }));
vi.mock("@/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [{ _id: "e", firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", departmentId: "d", isActive: true }], isLoading: false, hasProjectAccess: true }) }));
vi.mock("@/components/departments/DepartmentTree", () => ({ default: () => null }));
vi.mock("./SlideOverPanel", () => ({ default: () => null }));
vi.mock("./EmployeeTable", () => ({ default: () => null }));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: ({ children }: { children: ReactNode }) => <>{children}</> }));
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
