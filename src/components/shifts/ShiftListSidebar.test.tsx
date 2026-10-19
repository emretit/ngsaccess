import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Shift } from "./lib/planning";
import { DefinitionCount, DeleteImpact, ShiftListSidebar } from "./ShiftListSidebar";

const state = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => state.query(getFunctionName(reference), args),
  useMutation: () => vi.fn(),
}));
function Box({ children }: { children?: ReactNode }) { return <div>{children}</div>; }
vi.mock("@/components/ui/sheet", () => ({ Sheet: Box, SheetContent: Box, SheetHeader: Box, SheetTitle: Box, SheetDescription: Box }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: Box }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenuItem: Box }));
// Leave each isolated section failed, so any query accidentally moved back
// above the production boundary will escape and fail the whole panel render.
vi.mock("@/components/shared/QuerySectionBoundary", () => ({ QuerySectionBoundary: ({ title }: { title: string }) => <span role="alert">{title}</span> }));

const projectId = "project" as Id<"projects">;
const shiftId = "shift" as Id<"shifts">;
const shift = { _id: shiftId, projectId, name: "Gündüz", startTime: "09:00", endTime: "18:00", isActive: true } as Shift;
beforeEach(() => { state.query.mockReset(); });

it("counter failures leave the definitions panel and its create/edit controls available", () => {
  state.query.mockImplementation(() => { throw new Error("Unavailable query"); });
  const html = renderToStaticMarkup(<ShiftListSidebar open projectId={projectId} shifts={[shift]} onOpenChange={() => undefined} />);
  for (const label of ["Vardiya tanımları", "Yeni vardiya tanımla", "Düzenle", "Silme etkisini incele", "Sayı yüklenemedi"]) expect(html).toContain(label);
  expect(state.query).not.toHaveBeenCalled();
});

it("skipped or missing counter results explicitly report an unavailable count", () => {
  const skipped = renderToStaticMarkup(<DefinitionCount projectId={projectId} shiftId={shiftId} enabled={false} />);
  expect(skipped).toContain("Sayı yüklenemedi");
  expect(state.query).toHaveBeenCalledWith("shifts:definitionImpacts", "skip");
  state.query.mockReturnValue([]);
  expect(renderToStaticMarkup(<DefinitionCount projectId={projectId} shiftId={shiftId} enabled />)).toContain("Sayı yüklenemedi");
});

it("exhausted count budgets show no misleading zero total", () => {
  state.query.mockReturnValue([{ shiftId, assignmentCount: null, employeeCount: null, countLabel: "Hesaplanamadı", truncated: true }]);
  const html = renderToStaticMarkup(<DefinitionCount projectId={projectId} shiftId={shiftId} enabled />);
  expect(html).toContain("Hesaplanamadı");
  expect(html).not.toContain("En az 0");
});

it("opening delete impact requests only that definition and enables deleting an empty one", () => {
  state.query.mockReturnValue({ assignmentCount: 0, employeeCount: 0, skippedAssignments: 0, truncated: false, countLabel: "Toplam" });
  const html = renderToStaticMarkup(<DeleteImpact shift={shift} onClose={() => undefined} />);
  expect(state.query).toHaveBeenCalledExactlyOnceWith("shifts:assignmentDeleteImpact", { shiftId });
  expect(html).toContain("Toplam 0 atama serisi");
  expect(html).toMatch(/<button(?![^>]* disabled=)[^>]*>Vardiyayı sil<\/button>/);
});
