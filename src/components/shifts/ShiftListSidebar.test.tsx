import type { HTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Shift } from "./lib/planning";
import { DefinitionCount, DeleteImpact, ShiftListSidebar } from "./ShiftListSidebar";
import ShiftDefinitions from "@/pages/ShiftDefinitions";

const state = vi.hoisted(() => ({
  query: vi.fn(), manage: true, countFailure: false, projectId: "project" as string | null,
  states: [] as unknown[], cursor: 0,
  rows: [] as HTMLAttributes<HTMLTableRowElement>[],
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: <T,>(initial: T | (() => T)) => {
  const index = state.cursor++;
  if (!(index in state.states)) state.states[index] = typeof initial === "function" ? (initial as () => T)() : initial;
  return [state.states[index], (next: T) => { state.states[index] = next; }];
} }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.manage, loading: false }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: state.projectId, loading: false }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a> }));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => state.query(getFunctionName(reference), args),
  useMutation: () => vi.fn(),
}));
function Box({ children }: { children?: ReactNode }) { return <div>{children}</div>; }
vi.mock("@/components/ui/dialog", () => ({ Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: Box }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenuItem: Box }));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: Box }));
vi.mock("@/components/ErrorBoundary", () => ({ ErrorBoundary: ({ children, fallback }: { children: ReactNode; fallback: () => ReactNode }) => state.countFailure ? fallback() : children }));
vi.mock("./definitions/AddShiftDialog", () => ({ AddShiftDialog: ({ editingShift }: { editingShift: Shift | null }) => <div>Form: {editingShift?.name ?? "Yeni"}</div> }));
vi.mock("@/lib/tableRowClick", () => ({ ROW_CLICK_CLASS: "cursor-pointer", onRowActivate: (open: () => void) => open }));
vi.mock("@/components/ui/table", async original => ({ ...await original<typeof import("@/components/ui/table")>(), TableRow: (props: HTMLAttributes<HTMLTableRowElement>) => {
  state.rows.push(props); return <tr {...props} />;
} }));
const projectId = "project" as Id<"projects">;
const shiftId = "shift" as Id<"shifts">;
const shift: Shift = { _id: shiftId, _creationTime: 1, projectId, name: "Gündüz", color: "blue", startTime: "09:00", endTime: "18:00", isActive: true, createdAt: "", updatedAt: "" };
const impact = { shiftId, assignmentCount: 3, employeeCount: 2, skippedAssignments: 0, truncated: false, countLabel: "Toplam", hasAssignments: true };
function render(page = false) {
  state.cursor = 0; state.rows = [];
  return renderToStaticMarkup(page ? <ShiftDefinitions /> : <ShiftListSidebar projectId={projectId} shifts={[shift]} createOpen={false} onCreateOpenChange={() => undefined} />);
}
beforeEach(() => {
  state.query.mockReset(); state.states = []; state.manage = true; state.countFailure = false; state.projectId = projectId;
  state.query.mockImplementation((name: string) => name === "shifts:list" ? [shift] : [impact]);
});
it("definitions page renders its table and one shared impact subscription", () => {
  const html = render(true);
  for (const label of ["Vardiya tanımları", "Yeni vardiya tanımla", "Ad", "Tür", "Saat", "Mola", "Atama serisi", "Durum", "Gündüz", "Toplam 3", "bg-blue-400"]) expect(html).toContain(label);
  expect(html).toContain('href="/pdks-records/settings"');
  expect(state.query.mock.calls.filter(([name]) => name === "shifts:definitionImpacts")).toEqual([["shifts:definitionImpacts", { projectId }]]);
});
it("manager activates a row to open editing", () => {
  render();
  state.rows.find(row => row.onClick)?.onClick?.({} as Parameters<NonNullable<HTMLAttributes<HTMLTableRowElement>["onClick"]>>[0]);
  expect(render()).toContain("Form: Gündüz");
});
it("count failure preserves table actions and editing", () => {
  state.countFailure = true;
  const html = render();
  expect(html).toContain("Sayı yüklenemedi");
  expect(html).toContain("Düzenle");
  expect(html).toContain("Silme etkisini incele");
  state.rows.find(row => row.onClick)?.onClick?.({} as Parameters<NonNullable<HTMLAttributes<HTMLTableRowElement>["onClick"]>>[0]);
  expect(render()).toContain("Form: Gündüz");
  expect(state.query).not.toHaveBeenCalled();
});
it("viewer has no row action, create action, or settings link", () => {
  state.manage = false;
  const html = render(true);
  expect(html).not.toContain("Yeni vardiya tanımla");
  expect(html).not.toContain("Düzenle");
  expect(html).not.toContain("Silme etkisini incele");
  expect(html).not.toContain('href="/pdks-records/settings"');
  expect(state.rows.every(row => !row.onClick)).toBe(true);
});
it("no project has an empty state without data subscriptions", () => {
  state.projectId = null;
  expect(render(true)).toContain("Bir proje seçin.");
  expect(state.query).not.toHaveBeenCalled();
});
it("missing counter results and exhausted budgets never show a misleading zero", () => {
  expect(renderToStaticMarkup(<DefinitionCount />)).toContain("Sayı yüklenemedi");
  const html = renderToStaticMarkup(<DefinitionCount impact={{ ...impact, assignmentCount: null, employeeCount: null, truncated: true, countLabel: "Hesaplanamadı" }} />);
  expect(html).toContain("Hesaplanamadı");
  expect(html).not.toContain("En az 0");
});
it("opening delete impact requests only that definition and enables deleting an empty one", () => {
  state.cursor = 0;
  state.query.mockReturnValue({ assignmentCount: 0, employeeCount: 0, skippedAssignments: 0, truncated: false, countLabel: "Toplam" });
  const html = renderToStaticMarkup(<DeleteImpact shift={shift} onClose={() => undefined} />);
  expect(state.query).toHaveBeenCalledExactlyOnceWith("shifts:assignmentDeleteImpact", { shiftId });
  expect(html).toContain("Toplam 0 atama serisi");
  expect(html).toMatch(/<button(?![^>]* disabled=)[^>]*>Vardiyayı sil<\/button>/);
});
