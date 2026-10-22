import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { UserFormDialog } from "./UserFormDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { User, UserFormData } from "../types/user-types";
vi.mock("../hooks/useAdminFormGuard", () => ({ useAdminFormGuard: () => ({ dialog: null, requestClose: (fn: () => void) => fn() }) }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: () => null }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogFooter: Part, DialogHeader: Part, DialogTitle: Part };
});
it("D-3: platform edit offers exactly super admin and normal; invites keep project roles", () => {
  const data: UserFormData = { email: "normal@test.com", role: "project_user", projectIds: [] };
  const props = { isOpen: true, onClose: vi.fn(), formData: data, baseline: data, onFormDataChange: vi.fn(), onSave: async () => true, projects: [] };
  const user: User = { _id: "user" as Id<"users">, email: data.email, displayName: data.email, role: "viewer", projects: [], isSelf: false, pendingSetup: false, disabledAt: undefined, accessExpiresAt: undefined, accessExpired: false, setupExpiresAt: undefined };
  const edit = renderToStaticMarkup(<MemoryRouter><UserFormDialog {...props} currentUser={user} /></MemoryRouter>);
  expect(edit.match(/<option value="[^"]+"/g)).toEqual(['<option value="super_admin"', '<option value="project_user"']);
  expect(edit).toContain('Normal</option>');
  const invite = renderToStaticMarkup(<MemoryRouter><UserFormDialog {...props} currentUser={null} formData={{ ...data, role: "viewer" }} /></MemoryRouter>);
  expect(invite).toContain('<option value="admin"');
  expect(invite).not.toContain('<option value="super_admin"');
});
