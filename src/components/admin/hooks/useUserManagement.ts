import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { usePermissions } from "@/hooks/usePermissions";
import { legacyRoleToProjectRole, isProjectRole } from "../../../../convex/lib/roleCatalog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { errorMessage } from "@/lib/notify";
import {
  userFormSchema,
  type User,
  type UserFormData,
} from "../types/user-types";
export type {
  User,
  Project,
  UserFormData,
  UserRole,
} from "../types/user-types";
const emptyForm = (): UserFormData => ({
  email: "",
  role: "viewer",
  projectIds: [],
});
export const useUserManagement = () => {
  const { can, role } = usePermissions();
  const { projectId } = useActiveProjectScope();
  const permissions = { admin: can("admin.manage"), manageUsers: role === "super_admin" };
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [baseline, setBaseline] = useState<UserFormData>(emptyForm);
  const [error, setError] = useState<string>();
  const projectsRaw = useQuery(
    api.projects.list,
    permissions.admin ? {} : "skip",
  );
  const memberships = useQuery(
    api.userProjects.getProjectIdsByUser,
    permissions.manageUsers && currentUser
      ? { userId: currentUser._id }
      : "skip",
  );
  // Capture the initial memberships once; background updates must not rewrite an open draft.
  useEffect(() => {
    if (
      currentUser &&
      memberships !== undefined &&
      baseline.projectIds === undefined
    ) {
      const snapshot = { ...baseline, projectIds: memberships };
      setBaseline(snapshot);
      setFormData(snapshot);
    }
  }, [currentUser, memberships, baseline]);
  const updateRole = useMutation(api.users.updateRole);
  const deleteUser = useMutation(api.users.deleteUser);
  const sendInvite = useAction(api.actions.sendEmail.sendUserInviteEmail);
  const editReady =
    projectsRaw !== undefined &&
    (!currentUser || baseline.projectIds !== undefined);
  const saveUser = async () => {
    setError(undefined);
    try {
      if (!editReady) throw new Error("Üyelikler yükleniyor.");
      if (currentUser) {
        if (isProjectRole(formData.role)) throw new Error("Proje rolünü Ayarlar → Kullanıcılar bölümünden değiştirin.");
        await updateRole({
          userId: currentUser._id,
          role: formData.role,
          projectIds: formData.projectIds,
          expectedProjectIds: baseline.projectIds,
        });
      } else {
        const parsed = userFormSchema.parse(formData);
        if (parsed.role === "super_admin")
          throw new Error("Süper admin davet edilemez.");
        if (!parsed.projectId) throw new Error("Bir proje seçin.");
        const result = await sendInvite({
          email: parsed.email.toLowerCase(),
          role: legacyRoleToProjectRole(parsed.role),
          projectId: parsed.projectId,
        });
        if (!result.success)
          throw new Error(result.error ?? "Davet gönderilemedi.");
      }
    } catch (cause) {
      setError(errorMessage(cause));
      throw cause;
    }
  };
  const { run: handleSaveUser, pending: saving } = useAsyncAction(saveUser, {
    success: currentUser ? "Kullanıcı güncellendi" : "Davet gönderildi",
  });
  const { run: handlePasswordReset, pending: resettingPassword } = useAsyncAction(
    async (target: Pick<FunctionArgs<typeof api.actions.sendEmail.sendUserInviteEmail>, "email" | "projectId" | "role">) => {
      try {
        if (!permissions.admin) throw new Error("Şifre sıfırlama bağlantısı gönderme yetkiniz yok.");
        const result = await sendInvite({ ...target, type: "reset" });
        if (!result.success) throw new Error(result.error ?? "E-posta gönderilemedi. Lütfen tekrar deneyin.");
      } catch (cause) {
        const message = errorMessage(cause);
        const data: unknown = cause instanceof ConvexError ? cause.data : undefined;
        const code = data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : "";
        if (code.startsWith("INVITE_") || message.includes("INVITE_")) {
          throw Object.assign(new Error("Bu kullanıcıya şifre sıfırlama bağlantısı gönderilemiyor."), { cause });
        }
        throw Object.assign(new Error(message), { cause });
      }
    },
    { success: "Şifre sıfırlama bağlantısı gönderildi", error: "Şifre sıfırlama bağlantısı gönderilemedi" },
  );
  return {
    canResetPassword: permissions.admin,
    handlePasswordReset,
    resettingPassword,
    projects: projectsRaw ?? [],
    currentUser,
    formData,
    baseline,
    setFormData,
    error,
    handleEditUser: (user: User) => {
      const data = {
        email: user.email ?? "",
        // Platform account editing does not mirror or overwrite project roles.
        role: user.role === "super_admin" ? "super_admin" as const : "project_user" as const,
      };
      setCurrentUser(user);
      setFormData(data);
      setBaseline(data);
      setError(undefined);
    },
    handleSaveUser,
    saving,
    editReady,
    handleDeleteUser: async (user: User) => {
      await deleteUser({ userId: user._id });
    },
    resetForm: () => {
      setCurrentUser(null);
      const initial = { ...emptyForm(), projectId: projectId ?? undefined };
      setFormData(initial);
      setBaseline(initial);
      setError(undefined);
    },
  };
};
