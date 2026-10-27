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
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => [false, vi.fn()],
}));
function change(value: VerifyPlan, layout: string) {
  const onChange = vi.fn();
  const tree = DoorVerifyPlanEditor({ value, onChange });
  const select = nodes(tree).find(
    (node) => node.props["aria-label"] === "Doğrulama planı düzeni",
  );
  (select?.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: layout },
  });
  return onChange;
}
describe("verify plan layout", () => {
  it("Hafta içi yalnız beş günü doldurur ve saniyeleri korur", () => {
    const onChange = change(initial, "weekdays");
    const result = onChange.mock.calls[0][0] as VerifyPlan;
    expect(
      result.weekly
        ?.slice(0, 5)
        .every((day) => day.segments[0]?.beginTime === initial.beginTime),
    ).toBe(true);
    expect(
      result.weekly?.slice(5).every((day) => day.segments.length === 0),
    ).toBe(true);
  });
  it("farklı günler onaysız silinmez; onayla Pazartesi kullanılır", () => {
    const value: VerifyPlan = {
      ...initial,
      weekly: [
        { day: "Monday", segments: [initial] },
        { day: "Saturday", segments: [{ ...initial, verifyMode: "card" }] },
      ],
    };
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    expect(change(value, "daily")).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    expect(change(value, "daily")).toHaveBeenCalledWith(initial);
    vi.unstubAllGlobals();
  });
});
