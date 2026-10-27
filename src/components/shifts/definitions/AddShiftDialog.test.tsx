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
const shift: EditingShift = { _id: "shift" as Id<"shifts">, name: "Gündüz", startTime: "09:00", endTime: "18:00", overtimeEnabled: true, isActive: true };
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
it("has no color picker and saves an existing fixed definition without color", async () => {
  const f = setup();
  const tree = f.render();
  expect(find(tree, props => props["aria-label"] === "Renksiz")).toBeUndefined();
  await find(tree, (_, type) => type === "form")?.onSubmit?.({ preventDefault: vi.fn() });
  expect(f.onUpdate).toHaveBeenCalledWith(shift._id, expect.not.objectContaining({ color: expect.anything() }), istanbulToday());
  expect(f.onAdd).not.toHaveBeenCalled();
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
  expect(f.onUpdate).toHaveBeenCalledWith(shift._id, expect.objectContaining(rules), istanbulToday());
});

it("asks for an effective date only when a rule changes and blocks a date before the last change", async () => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  const f = setup({ ...shift, versionedUntil: "2026-01-09" });
  expect(find(f.render(), props => (props as { id?: string }).id === "shift-effectiveFrom")).toBeUndefined();
  (find(f.render(), props => (props as { id?: string }).id === "shift-startTime") as { onChange?: (event: { target: { value: string } }) => void } | undefined)?.onChange?.({ target: { value: "10:00" } });
  const tree = f.render();
  const field = find(tree, props => (props as { id?: string }).id === "shift-effectiveFrom") as { min?: string; max?: string; onChange?: (event: { target: { value: string } }) => void } | undefined;
  expect(field).toMatchObject({ min: "2026-01-10", max: istanbulToday() });
  field?.onChange?.({ target: { value: "2026-01-05" } });
  await find(f.render(), (_, type) => type === "form")?.onSubmit?.({ preventDefault: vi.fn() });
  expect(f.onUpdate).not.toHaveBeenCalled();
  (find(f.render(), props => (props as { id?: string }).id === "shift-effectiveFrom") as typeof field)?.onChange?.({ target: { value: "2026-01-10" } });
  await find(f.render(), (_, type) => type === "form")?.onSubmit?.({ preventDefault: vi.fn() });
  expect(f.onUpdate).toHaveBeenCalledWith(shift._id, expect.objectContaining({ startTime: "10:00" }), "2026-01-10");
  vi.unstubAllGlobals();
});
