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
  it("converts legacy window to seven days without losing mode or seconds", () => {
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
    expect(change.mock.calls[0][0].weekly).toHaveLength(7);
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
