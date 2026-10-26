import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { UserTable } from "./components/UserTable";
import { PasswordResetDialog, type PasswordResetTarget } from "./components/PasswordResetDialog";
import { ProjectMembersContent } from "./ProjectMembersContent";
import { useUserManagement } from "./hooks/useUserManagement";
import type { User } from "./types/user-types";

const state = vi.hoisted(() => ({ allowed: true, send: vi.fn(), success: vi.fn(), error: vi.fn(), members: [] as unknown[] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.allowed, role: "admin", loading: false }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project" }) }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: "project_user" } }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "roles:listProjectMembers" ? state.members : [],
  useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: () => vi.fn() }),
  useAction: () => state.send,
}));
vi.mock("@/lib/notify", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/notify")>(),
  notify: { success: state.success, error: state.error },
}));
vi.mock("./components/AccountAccessActions", () => ({ AccountAccessActions: () => null, AccountAccessBadges: () => null, AccountAccessDialog: () => null }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{children}</button> }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null, AlertDialogContent: Wrapper, AlertDialogHeader: Wrapper, AlertDialogTitle: Wrapper, AlertDialogDescription: Wrapper, AlertDialogFooter: Wrapper, AlertDialogCancel: Wrapper };
});
const user: User = {
  _id: "user" as User["_id"], email: "ada@example.com", displayName: "Ada", role: "viewer",
  projects: [], isSelf: false, pendingSetup: false, canResetPassword: true,
  disabledAt: undefined, accessExpiresAt: undefined, accessExpired: false, setupExpiresAt: undefined,
};
const target: PasswordResetTarget = { email: "ada@example.com", projectId: "project" as PasswordResetTarget["projectId"], role: "viewer" };
function management() {
  let value: ReturnType<typeof useUserManagement> | undefined;
  function Harness() { value = useUserManagement(); return null; }
  renderToStaticMarkup(<Harness />);
  if (!value) throw new Error("Missing management hook");
  return value;
}
function findButton(node: React.ReactNode): React.ReactElement<{ onClick: () => Promise<void>; disabled: boolean }> | undefined {
  if (!React.isValidElement<{ children?: React.ReactNode; onClick?: () => Promise<void>; disabled?: boolean }>(node)) return undefined;
  if (node.props.onClick) return node as React.ReactElement<{ onClick: () => Promise<void>; disabled: boolean }>;
  for (const child of React.Children.toArray(node.props.children)) {
    const button = findButton(child);
    if (button) return button;
  }
}
beforeEach(() => {
  state.allowed = true;
  state.send.mockReset().mockResolvedValue({ success: true });
  state.success.mockClear(); state.error.mockClear();
  state.members = [{ userId: "user", name: "Ada", email: target.email, role: "viewer", isSuperAdmin: false, canResetPassword: true }];
});
describe("F5-A yönetici şifre sıfırlama", () => {
  it.each([
    { allowed: true, eligible: true, role: "viewer" as const, visible: true },
    { allowed: false, eligible: true, role: "viewer" as const, visible: false },
    { allowed: true, eligible: false, role: "viewer" as const, visible: false },
    { allowed: true, eligible: true, role: "super_admin" as const, visible: false },
  ])("shows the row action only for authorized eligible targets: %j", ({ allowed, eligible, role, visible }) => {
    state.allowed = allowed;
    const html = renderToStaticMarkup(<UserTable users={[{ ...user, role, canResetPassword: eligible }]} onEditUser={vi.fn()} onDeleteUser={vi.fn()} onResetPassword={vi.fn()} />);
    expect(html.includes("Şifre sıfırlama bağlantısı gönder")).toBe(visible);
  });
  it.each([true, false])("project members respect admin.manage=%s", allowed => {
    state.allowed = allowed;
    expect(renderToStaticMarkup(<ProjectMembersContent />).includes("Şifre sıfırlama bağlantısı gönder")).toBe(allowed);
  });
  it("hides reset in project members for super-admins", () => {
    state.members = [{ userId: "user", name: "Ada", email: target.email, role: "viewer", isSuperAdmin: true, canResetPassword: true }];
    expect(renderToStaticMarkup(<ProjectMembersContent />)).not.toContain("Şifre sıfırlama bağlantısı gönder");
  });
  it("waits for confirmation and sends type reset with the selected project", async () => {
    const value = management();
    const close = vi.fn();
    const dialog = PasswordResetDialog({ target, onClose: close, onSend: value.handlePasswordReset, pending: false });
    const html = renderToStaticMarkup(dialog);
    expect(html).toContain("ada@example.com adresine şifre sıfırlama bağlantısı gönderilecek. Mevcut oturumları şifre değişince kapanır.");
    expect(state.send).not.toHaveBeenCalled();
    const button = findButton(dialog);
    if (!button) throw new Error("Missing send confirmation");
    await button.props.onClick();
    expect(state.send).toHaveBeenCalledWith({ ...target, type: "reset" });
    expect(state.success).toHaveBeenCalledWith("Şifre sıfırlama bağlantısı gönderildi");
    expect(close).toHaveBeenCalledOnce();
  });
  it("blocks sending without admin.manage", async () => {
    state.allowed = false;
    expect(await management().handlePasswordReset(target)).toBe(false);
    expect(state.send).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith("Şifre sıfırlama bağlantısı gönderilemedi", expect.objectContaining({ message: "Şifre sıfırlama bağlantısı gönderme yetkiniz yok." }));
  });
  it.each([
    new ConvexError({ code: "INVITE_RESET_UNAVAILABLE", message: "Bu kullanıcıya şifre sıfırlama bağlantısı gönderilemiyor." }),
    new ConvexError({ code: "INVITE_ACCOUNT_EXISTS" }),
    new Error("INVITE_EMAIL_MISMATCH"),
  ])("shows a Turkish error and keeps confirmation open on rejection: %j", async error => {
    state.send.mockRejectedValue(error);
    const value = management();
    const close = vi.fn();
    const button = findButton(PasswordResetDialog({ target, onClose: close, onSend: value.handlePasswordReset, pending: false }));
    if (!button) throw new Error("Missing send confirmation");
    await button.props.onClick();
    expect(close).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith("Şifre sıfırlama bağlantısı gönderilemedi", expect.objectContaining({ message: "Bu kullanıcıya şifre sıfırlama bağlantısı gönderilemiyor." }));
  });
  it("handles email delivery failure", async () => {
    state.send.mockResolvedValue({ success: false, error: "E-posta gönderilemedi" });
    expect(await management().handlePasswordReset(target)).toBe(false);
    expect(state.success).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith("Şifre sıfırlama bağlantısı gönderilemedi", expect.objectContaining({ message: "E-posta gönderilemedi" }));
  });
});
