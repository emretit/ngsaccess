import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import ShiftPlan from "@/pages/ShiftPlan";
const state = vi.hoisted(() => ({
  canManage: false, projectId: "project" as string | null, loading: false,
  params: new URLSearchParams(), locationState: null as unknown,
  navigate: vi.fn(), back: () => {}, selectShift: (_value: string | undefined) => {}, shiftFilter: "all",
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => state.navigate,
  useLocation: () => ({ state: state.locationState }),
  useSearchParams: () => [state.params, (update: (previous: URLSearchParams) => URLSearchParams) => { state.params = update(state.params); }],
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.canManage }) }));
vi.mock("./DepartmentAssignments", () => ({ DepartmentAssignments: () => <div>Departman atamaları</div> }));
vi.mock("./ShiftCalendarView", () => ({ ShiftCalendarView: ({ shiftFilter }: { shiftFilter: string }) => { state.shiftFilter = shiftFilter; return <div>Takvim</div>; } }));
vi.mock("./ShiftTree", () => ({ ShiftTree: ({ onSelectShift }: { onSelectShift: (id: string | undefined) => void }) => { state.selectShift = onSelectShift; return <nav>Vardiya sidebarı</nav>; } }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: state.projectId, activeProject: { name: "Proje" }, loading: state.loading }) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => { if (onClick) state.back = onClick; return <button>{children}</button>; } }));
beforeEach(() => { state.canManage = false; state.projectId = "project"; state.loading = false; state.params = new URLSearchParams(); state.locationState = null; state.navigate.mockClear(); });
it("renders the calendar and definition management as a page", () => {
  const html = renderToStaticMarkup(<ShiftPlan />);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toMatch(/<main\b/);
  expect(html).toContain("Takvim");
  expect(html).toContain("Departman atamaları");
  expect(html).toContain("Vardiya sidebarı");
  expect(html).not.toContain('role="dialog"');
});
it("returns to records with the original history after selecting a sidebar shift", () => {
  state.locationState = { fromRecords: true };
  renderToStaticMarkup(<ShiftPlan />);
  state.selectShift("day");
  expect(state.params.get("shift")).toBe("day");
  renderToStaticMarkup(<ShiftPlan />);
  expect(state.shiftFilter).toBe("day");
  state.back();
  expect(state.navigate).toHaveBeenCalledWith(-1);
});
it("returns to records when opened directly", () => {
  renderToStaticMarkup(<ShiftPlan />);
  state.back();
  expect(state.navigate).toHaveBeenCalledWith("/pdks-records");
});
it("explains when no project is selected and keeps the back button available", () => {
  state.projectId = null;
  const html = renderToStaticMarkup(<ShiftPlan />);
  expect(html).toContain("Proje seçin");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toContain("Takvim");
  state.back();
  expect(state.navigate).toHaveBeenCalledWith("/pdks-records");
});

it("shows settings on the plan page only to shift managers", () => {
  expect(renderToStaticMarkup(<ShiftPlan />)).not.toContain('href="/pdks-records/settings"');
  state.canManage = true;
  expect(renderToStaticMarkup(<ShiftPlan />)).toContain('href="/pdks-records/settings"');
});

it("keeps the plan heading and back action while the project loads", () => {
  state.loading = true;
  const html = renderToStaticMarkup(<ShiftPlan />);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Vardiya planı");
  expect(html).toContain("Proje yükleniyor");
  expect(html).not.toContain("Takvim");
  state.back();
  expect(state.navigate).toHaveBeenCalledWith("/pdks-records");
});
