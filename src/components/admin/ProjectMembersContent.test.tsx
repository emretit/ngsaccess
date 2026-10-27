import React from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberRoleSelect } from "./ProjectMembersContent";
import type { Id } from "../../../convex/_generated/dataModel";
import { PROJECT_ROLES } from "../../../convex/lib/roleCatalog";
const state = vi.hoisted(() => ({ save: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => Object.assign(state.save, { withOptimisticUpdate: () => state.save }) }));
vi.mock("@/lib/notify", () => ({ notify: { error: state.error, success: state.success } }));
const member = { userId: "u" as Id<"users">, name: "Ada", email: "ada@example.com", role: "admin" as const, isSuperAdmin: false, canResetPassword: false };
const projectId = "p" as Id<"projects">;
function control() {
  let tree: React.ReactElement<{ children?: React.ReactNode }> | undefined;
  function Harness() { tree = MemberRoleSelect({ member, projectId }); return null; }
  renderToStaticMarkup(<Harness />);
  const select = React.Children.toArray(tree?.props.children).find(child => React.isValidElement(child) && child.type === NativeSelect);
  if (!React.isValidElement<{ onChange: (event: { target: { value: string } }) => Promise<void> }>(select)) throw new Error("Missing role control");
  return select;
}
beforeEach(() => { state.save.mockReset().mockResolvedValue(null); state.error.mockClear(); state.success.mockClear(); });
describe("proje üyesi rol seçimi", () => {
  it("offers five catalog roles and sends project, user and role", async () => {
    const html = renderToStaticMarkup(<MemberRoleSelect member={member} projectId={projectId} />);
    for (const role of PROJECT_ROLES) expect(html).toContain(`value="${role}"`);
    await control().props.onChange({ target: { value: "hr" } });
    expect(state.save).toHaveBeenCalledWith({ projectId: "p", userId: "u", role: "hr" });
  });
  it("preserves the Turkish last-admin error in the toast", async () => {
    const error = new Error("Projenin son yöneticisinin rolü değiştirilemez");
    state.save.mockRejectedValue(error);
    await control().props.onChange({ target: { value: "viewer" } });
    expect(state.error).toHaveBeenCalledWith("Proje rolü değiştirilemedi", error);
    expect(state.success).not.toHaveBeenCalled();
  });
  it("disables super-admin project roles", () => {
    const html = renderToStaticMarkup(<MemberRoleSelect member={{ ...member, isSuperAdmin: true }} projectId={projectId} />);
    expect(html).toMatch(/<select[^>]*disabled/);
    expect(html).toContain("Süper Admin · değiştirilemez");
  });
});
