import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RolesSettings } from "./RolesSettings";
import { PERMISSIONS, PROJECT_ROLES, ROLE_DEFAULTS, ROLE_LABELS } from "../../../../convex/lib/roleCatalog";
const state = vi.hoisted(() => ({ save: vi.fn(), optimistic: vi.fn(), allowed: true }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p" }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.allowed }) }));
vi.mock("convex/react", () => ({
  useQuery: () => PROJECT_ROLES.map(role => ({ role, permissions: [...ROLE_DEFAULTS[role]], locked: role === "admin", isDefault: true })),
  useMutation: () => Object.assign(state.save, { withOptimisticUpdate: (callback: unknown) => { state.optimistic(callback); return state.save; } }),
}));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn() } }));

function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? [child as React.ReactElement<Record<string, unknown>>, ...elements(child.props.children)] : []);
}
function tree() {
  let result: React.ReactNode;
  function Harness() { result = RolesSettings(); return null; }
  renderToStaticMarkup(<Harness />);
  return elements(result);
}
beforeEach(() => { state.allowed = true; state.save.mockReset().mockResolvedValue(null); state.optimistic.mockClear(); });
describe("proje rol matrisi", () => {
  it("has 13 × 5 checkboxes, with the entire admin column locked and described", () => {
    const inputs = tree().filter(element => element.type === "input");
    expect(inputs).toHaveLength(65);
    for (let index = 0; index < PERMISSIONS.length; index++) {
      expect(inputs[index * 5].props).toMatchObject({ checked: true, disabled: true, "aria-describedby": "roles-locked" });
    }
    const html = renderToStaticMarkup(<RolesSettings />);
    expect(html).toContain("Varsayılan yetkiler önerilir; ihtiyaca göre değiştirebilirsiniz.");
    expect(html).toContain("Yönetici yetkileri değiştirilemez");
  });
  it("saves a checkbox change to the selected project/role with the full updated permission list", async () => {
    const inputs = tree().filter(element => element.type === "input");
    const change = inputs[1].props.onChange as (event: { target: { checked: boolean } }) => void;
    change({ target: { checked: false } });
    await Promise.resolve();
    expect(state.save).toHaveBeenCalledWith({ projectId: "p", role: "hr", permissions: ROLE_DEFAULTS.hr.filter(permission => permission !== "employees.view") });
    expect(state.optimistic).toHaveBeenCalled();
  });
  it.each(PROJECT_ROLES.filter(role => role !== "admin"))("resets %s to the shared catalog defaults", async role => {
    const reset = tree().find(element => element.props["aria-label"] === `${ROLE_LABELS[role]}: Varsayılana dön`);
    (reset?.props.onClick as () => void)();
    await Promise.resolve();
    expect(state.save).toHaveBeenCalledWith({ projectId: "p", role, permissions: [...ROLE_DEFAULTS[role]] });
  });
  it("cannot grant admin.manage to other roles", () => {
    const inputs = tree().filter(element => element.type === "input");
    for (const input of inputs.slice(-5)) expect(input.props.disabled).toBe(true);
  });
  it("does not render the matrix without admin.manage", () => {
    state.allowed = false;
    expect(renderToStaticMarkup(<RolesSettings />)).toBe("");
  });
});
