import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { Summary } from "./accessRulesListModel";
import { RuleRow } from "./RuleRow";

const state = vi.hoisted(() => ({
  canManage: true,
  open: false,
  stateIndex: 0,
  buttons: new Map<string, (() => void) | undefined>(),
  load: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: boolean) => {
    const index = state.stateIndex++;
    return [index === 0 ? state.open : initial, (value: boolean) => {
      if (index === 0) state.open = value;
    }];
  },
}));
vi.mock("convex/react", () => ({ useConvex: () => ({}) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.canManage }) }));
vi.mock("@/hooks/access-rules/useAccessRuleMutations", () => ({
  useAccessRuleMutations: () => ({ updateAccessRule: {}, deleteAccessRule: {} }),
}));
vi.mock("@/hooks/useAsyncAction", () => ({
  useAsyncAction: (action: () => Promise<void>) => ({ run: action, pending: false }),
}));
vi.mock("../lib/loadRuleEditor", () => ({ loadRuleEditor: state.load }));
vi.mock("../AccessRuleDetails", () => ({ AccessRuleDetails: () => <div>Kural ayrıntıları</div> }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: () => null }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, className, disabled }: ComponentProps<"button">) => {
    state.buttons.set(String(children), onClick ? () => onClick({} as Parameters<NonNullable<typeof onClick>>[0]) : undefined);
    return <button className={className} disabled={disabled}>{children}</button>;
  },
}));
vi.mock("@/components/ui/sheet", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <section>{children}</section> : null,
    SheetContent: Container,
    SheetHeader: Container,
    SheetTitle: Container,
    SheetDescription: Container,
  };
});
const rule = {
  _id: "rule", name: "Hafta içi", days: ["Friday", "Monday"], startTime: "08:30", endTime: "17:45",
  panels: [], unassignedDoors: [], memberCount: 1,
} as unknown as Summary;
const projectId = "project" as Id<"projects">;
const render = (onEditRule = vi.fn(), value = rule) => {
  state.stateIndex = 0;
  state.buttons.clear();
  return renderToStaticMarkup(<table><tbody><RuleRow rule={value} projectId={projectId} onEditRule={onEditRule} /></tbody></table>);
};
beforeEach(() => {
  state.open = false;
  state.canManage = true;
  state.load.mockReset();
});
it.each([
  [rule, "Pzt, Cum · 08:30–17:45"],
  [{ ...rule, startTime: undefined, endTime: undefined }, "Pzt, Cum · Tüm gün"],
  [{ ...rule, endTime: undefined }, "Pzt, Cum · Eksik saat aralığı"],
])("özel saatli kuralın küçük ekran alt satırında gün ve saati gösterir", (value, text) => {
  const html = render(vi.fn(), value);
  expect(html).toContain(`<p class="xl:hidden text-xs text-muted-foreground break-words">${text}</p>`);
});
it("ayrıntıdan mevcut düzenleme akışını açar ve çekmeceyi kapatır", async () => {
  const onEditRule = vi.fn();
  const details = { ...rule, groupMembers: [], groupDevices: [], groupDoors: [] };
  state.load.mockResolvedValue(details);
  render(onEditRule);
  state.buttons.get(rule.name)?.();
  expect(render(onEditRule)).toContain("Kural ayrıntıları");
  expect(state.buttons.has("Düzenle")).toBe(true);
  state.buttons.get("Düzenle")?.();
  await vi.waitFor(() => expect(onEditRule).toHaveBeenCalledWith(details));
  expect(state.load).toHaveBeenCalledWith({}, rule._id, projectId);
  expect(state.open).toBe(false);
  expect(render(onEditRule)).not.toContain("Kural ayrıntıları");
});
it("yönetim yetkisi olmadan çekmecede düzenleme sunmaz", () => {
  state.open = true;
  state.canManage = false;
  const html = render();
  expect(html).toContain("Kural ayrıntıları");
  expect(html).not.toContain("Düzenle");
  expect(state.buttons.has("Düzenle")).toBe(false);
});
