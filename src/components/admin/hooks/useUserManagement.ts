import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAuth } from "@/components/auth/AuthProvider";
import { capabilities } from "@/lib/capabilities";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { User, UserFormData } from "../types/user-types";
export type { User, Project, UserFormData, UserRole } from "../types/user-types";
export const useUserManagement = () => {
  const { projectId } = useActiveProjectScope();
  const { profile } = useAuth();
  const permissions = capabilities(profile?.role);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ email: "", role: "project_user", projectIds: [] });
  const usersRaw = useQuery(api.users.list, permissions.admin ? {} : "skip");
  const projectsRaw = useQuery(api.projects.list, permissions.admin ? {} : "skip");
  const memberships = useQuery(api.userProjects.getProjectIdsByUser, permissions.manageUsers && currentUser ? { userId: currentUser._id } : "skip");
  const updateRole = useMutation(api.users.updateRole);
  const deleteUser = useMutation(api.users.deleteUser);
  const sendInvite = useAction(api.actions.sendEmail.sendUserInviteEmail);
  const editReady = projectsRaw !== undefined && (!currentUser || memberships !== undefined);
  const effectiveFormData = currentUser && formData.projectIds === undefined ? { ...formData, projectIds: memberships } : formData;
  const { run: handleSaveUser, pending: saving } = useAsyncAction(async () => {
    if (!editReady) throw new Error("Proje üyelikleri yükleniyor.");
    if (currentUser) {
      await updateRole({ userId: currentUser._id, role: formData.role, projectIds: effectiveFormData.projectIds });
    } else {
      const email = formData.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Geçerli bir e-posta adresi girin.");
      if (formData.role === "super_admin") throw new Error("Süper admin davet edilemez.");
      if (!formData.projectId) throw new Error("Proje seçimi zorunludur.");
      const result = await sendInvite({ email, role: formData.role, projectId: formData.projectId });
      if (!result.success) throw new Error(result.error ?? "Davet gönderilemedi.");
    }
  }, { success: currentUser ? "Kullanıcı güncellendi" : "Davet gönderildi" });
  return {
    users: usersRaw ?? [], projects: projectsRaw ?? [], currentUser, formData: effectiveFormData, setFormData,
    handleEditUser: (user: User) => { setCurrentUser(user); setFormData({ email: user.email ?? "", role: user.role ?? "project_user" }); },
    handleSaveUser, saving, editReady,
    handleDeleteUser: async (user: User) => { await deleteUser({ userId: user._id }); },
    resetForm: () => { setCurrentUser(null); setFormData({ email: "", role: "project_user", projectId, projectIds: [] }); },
    loading: usersRaw === undefined, refetchUsers: () => {},
  };
};
