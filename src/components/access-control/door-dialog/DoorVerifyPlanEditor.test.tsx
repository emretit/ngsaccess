import { isValidElement, type ReactNode, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DoorVerifyPlanEditor } from "./DoorVerifyPlanEditor";
import type { VerifyPlan } from "../../../../convex/lib/doorStatusPlan";
type Props = Record<string, unknown> & { children?: ReactNode };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
const initial: VerifyPlan = {
  enabled: true,
  beginTime: "08:00:01",
  endTime: "18:00:02",
  verifyMode: "face",
};
describe("weekly verify editor", () => {
  it("converts legacy window to weekdays without losing mode or seconds", () => {
    const change = vi.fn();
    const tree = DoorVerifyPlanEditor({ value: initial, onChange: change });
    const select = nodes(tree).find(
      (node) => node.props["aria-label"] === "Doğrulama planı düzeni",
    );
    (select?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "weekly" },
    });
    expect(change).toHaveBeenCalledWith({
      ...initial,
      weekly: expect.arrayContaining([
        {
          day: "Monday",
          segments: [
            { beginTime: "08:00:01", endTime: "18:00:02", verifyMode: "face" },
          ],
        },
      ]),
    });
    const plan = change.mock.calls[0][0] as VerifyPlan;
    expect(plan.weekly).toHaveLength(7);
    expect(plan.weekly?.slice(5).every(day => day.segments.length === 0)).toBe(true);
  });
  it("04-O4 Hafta içi sets only five days and collapses daily sections", () => {
    const change = vi.fn();
    const tree = DoorVerifyPlanEditor({ value: initial, onChange: change });
    const button = nodes(tree).find(node => node.props.children === "Hafta içi");
    (button?.props.onClick as () => void)();
    const plan = change.mock.calls[0][0] as VerifyPlan;
    expect(plan.weekly?.slice(0, 5).every(day => day.segments[0]?.verifyMode === "face")).toBe(true);
    expect(plan.weekly?.slice(5).every(day => day.segments.length === 0)).toBe(true);
    const days = nodes(DoorVerifyPlanEditor({ value: plan, onChange: change })).filter(node => node.type === "details");
    expect(days).toHaveLength(7);
    expect(days.filter(node => node.props.open)).toHaveLength(1);
  });
  it("Dalga3 C1-1 does not offer Hafta içi on a per-day plan", () => {
    const value: VerifyPlan = { ...initial, weekly: [{ day: "Saturday", segments: [{ ...initial, verifyMode: "card" }] }] };
    const tree = DoorVerifyPlanEditor({ value, onChange: vi.fn() });
    expect(nodes(tree).some(node => node.props.children === "Hafta içi")).toBe(false);
  });
  it("copies Monday to weekdays and preserves weekend", () => {
    const change = vi.fn();
    const value: VerifyPlan = {
      ...initial,
      weekly: [
        { day: "Monday", segments: [initial] },
        { day: "Saturday", segments: [{ ...initial, verifyMode: "card" }] },
      ],
    };
    const tree = DoorVerifyPlanEditor({ value, onChange: change });
    const button = nodes(tree).find(
      (node) =>
        node.props.children === "Pazartesiyi hafta içine (Salı–Cuma) kopyala",
    );
    (button?.props.onClick as () => void)();
    expect(change.mock.calls[0][0].weekly[1].segments[0].verifyMode).toBe(
      "face",
    );
    expect(change.mock.calls[0][0].weekly[5].segments[0].verifyMode).toBe(
      "card",
    );
    expect(change.mock.calls[0][0].weekly[6].segments).toEqual([]);
  });
});
