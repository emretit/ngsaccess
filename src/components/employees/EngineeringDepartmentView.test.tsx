import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { EngineeringDepartmentView } from "./EngineeringDepartmentView";
const state = vi.hoisted(() => ({ departments: undefined as undefined | { _id: string; name: string }[], employees: undefined as undefined | unknown[], query: 0 }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", loading: false }) }));
vi.mock("convex/react", () => ({ useQuery: () => state.query++ % 2 === 0 ? state.departments : state.employees }));
it.each(["loading", "missing", "empty"])("keeps Engineering headers for %s", mode => {
  state.query = 0;
  state.departments = mode === "loading" ? undefined : mode === "missing" ? [] : [{ _id: "d", name: "Engineering" }];
  state.employees = mode === "loading" ? undefined : [];
  const html = renderToStaticMarkup(<EngineeringDepartmentView />);
  for (const label of ["Adı Soyadı", "Email", "Pozisyon"]) expect(html).toContain(label);
  expect(html).toMatch(/<tbody[^>]*><tr[^>]*><td[^>]*colSpan="3"/);
  expect(html).toContain(mode === "loading" ? "Yükleniyor" : mode === "missing" ? "Engineering departmanı sistemde kayıtlı değil" : "Engineering departmanında çalışan bulunamadı");
});
