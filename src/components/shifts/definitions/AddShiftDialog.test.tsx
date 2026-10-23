import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AddShiftDialog, type EditingShift } from "./AddShiftDialog";
import { istanbulToday } from "../lib/planning";

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useEffect: () => undefined,
  useRef: <T,>(initial: T) => ({ current: initial }),
  useState: <T,>(initial: T | (() => T)) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [state.values[index], (next: T) => { state.values[index] = next; }];
  },
}));
vi.mock("convex/react", () => ({ useQuery: () => ({ asOfDate: istanbulToday(), assignmentCount: 0, employeeCount: 0, skippedAssignments: 0, truncated: false, countLabel: "Toplam" }) }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: (run: () => void) => run(), dialog: null }) }));
const shift: EditingShift = { _id: "shift" as Id<"shifts">, name: "Gündüz", color: "teal", startTime: "09:00", endTime: "18:00", overtimeEnabled: true, isActive: true };
type NodeProps = {
  children?: ReactNode; "aria-label"?: string; "aria-describedby"?: string; checked?: boolean;
  onChange?: () => void; onSubmit?: (event: { preventDefault: () => void }) => Promise<void>;
  onClick?: () => void; "aria-pressed"?: boolean;
};
function find(node: ReactNode, predicate: (props: NodeProps, type: unknown) => boolean): NodeProps | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const result = find(child, predicate); if (result) return result; }
  }
  if (!isValidElement<NodeProps>(node)) return undefined;
  return predicate(node.props, node.type) ? node.props : find(node.props.children, predicate);
}
function setup(editingShift: EditingShift | null = shift) {
  const onUpdate = vi.fn(); const onAdd = vi.fn();
  const render = () => {
    state.cursor = 0;
    return AddShiftDialog({ open: true, editingShift, onUpdate, onAdd, onOpenChange: vi.fn(), onClose: vi.fn() });
  };
  return { onUpdate, onAdd, render };
}
beforeEach(() => { state.values = []; state.cursor = 0; });
it("hydrates existing color and sends the selected swatch in the update payload", async () => {
  const f = setup();
  const tree = f.render();
  expect(find(tree, props => props["aria-label"] === "Turkuaz")?.checked).toBe(true);
  find(tree, props => props["aria-label"] === "Mor")?.onChange?.();
  const updated = f.render();
  expect(find(updated, props => props["aria-label"] === "Mor")?.checked).toBe(true);
  await find(updated, (_, type) => type === "form")?.onSubmit?.({ preventDefault: vi.fn() });
  expect(f.onUpdate).toHaveBeenCalledWith(shift._id, expect.objectContaining({ color: "violet" }));
  expect(f.onAdd).not.toHaveBeenCalled();
});
it("Renksiz sends null to remove an existing color", async () => {
  const f = setup();
  find(f.render(), props => props["aria-label"] === "Renksiz")?.onChange?.();
  await find(f.render(), (_, type) => type === "form")?.onSubmit?.({ preventDefault: vi.fn() });
  expect(f.onUpdate).toHaveBeenCalledWith(shift._id, expect.objectContaining({ color: null }));
});
it("overtime hint is attached to its checkbox and schedule type uses pressed buttons", () => {
  const tree = setup().render();
  expect(find(tree, props => props["aria-describedby"] === "shift-overtime-hint")?.checked).toBe(true);
  expect(find(tree, props => props.children === "Sabit")?.["aria-pressed"]).toBe(true);
  expect(find(tree, props => props.children === "Esnek")?.["aria-pressed"]).toBe(false);
});

it("preserves hydrated advanced rules when saving an existing fixed definition", async () => {
  const rules = { validWindow: { checkInStart: "08:00", checkInEnd: "10:00", checkOutStart: "17:00", checkOutEnd: "19:00", checkOutEndDayOffset: 0 as const }, absentAfterLateMinutes: 30, minWorkMinutes: 360, missingCheckInLateMinutes: 15, holidayWorkRequired: true };
  const f = setup({ ...shift, ...rules });
  await find(f.render(), (_, type) => type === "form")?.onSubmit?.({ preventDefault: vi.fn() });
  expect(f.onUpdate).toHaveBeenCalledWith(shift._id, expect.objectContaining(rules));
});
