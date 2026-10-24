import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ShiftPlan } from "../../../convex/lib/shiftPlan";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import { planSummary } from "./lib/planForm";
import type { Assignment, DepartmentAssignment } from "./lib/planning";

const state = vi.hoisted(() => ({ objectName: "" }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("./AssignmentPatternEditor", () => ({ AssignmentPatternEditor: () => null }));
vi.mock("./ShiftSelect", () => ({ ShiftSelect: () => null }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ dialog: null, requestClose: vi.fn() }) }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: ({ objectName }: { objectName: string }) => { state.objectName = objectName; return null; } }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box };
});
const first = "morning" as Id<"shifts">;
const second = "afternoon" as Id<"shifts">;
const assignment = { _id: "assignment", employeeId: "employee", shiftId: first, startDate: "2026-10-26", endDate: "2026-11-01" } as Assignment;
const departmentAssignment = { _id: "departmentAssignment", departmentId: "department", shiftId: first, startDate: assignment.startDate, endDate: assignment.endDate } as DepartmentAssignment;
const plans: ShiftPlan[] = [
  { kind: "weekly", shiftIds: [first, second] },
  { kind: "dayCycle", anchorDate: "2026-10-26", slots: [[first], [second], []] },
  { kind: "weekCycle", anchorDate: "2026-10-26", slots: [[first], [second], [], [], [], [], []] },
];
describe("Orca turu: düzenleme ve onay başlığı", () => {
  it.each(plans)("$kind çoklu planında aynı desen özeti her iki başlıkta kullanılır", plan => {
    for (const row of [assignment, departmentAssignment]) {
      const html = renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={vi.fn()} assignment={{ ...row, plan }} shifts={[]} shiftName="TEST Sabah (silinecek)" employeeName="Yönetim" />);
      const expected = `Yönetim · ${planSummary(plan)} · 26.10.2026–01.11.2026`;
      expect(html).toContain(expected);
      expect(state.objectName).toBe(expected);
      expect(html).not.toContain("TEST Sabah (silinecek)");
    }
  });
  it.each([undefined, { kind: "weekly", shiftIds: [first] }] satisfies (ShiftPlan | undefined)[])("tek vardiyanın mevcut metni korunur (%j)", plan => {
    const html = renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={vi.fn()} assignment={{ ...assignment, plan }} shifts={[]} shiftName="Sabah" employeeName="Ada" />);
    const expected = "Ada · Sabah · 26.10.2026–01.11.2026";
    expect(html).toContain(`${expected}. Kaydetme ve silme tüm seriye uygulanır.`);
    expect(state.objectName).toBe(expected);
  });
});
