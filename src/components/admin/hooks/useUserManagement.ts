import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAuth } from "@/components/auth/AuthProvider";
import { capabilities } from "@/lib/capabilities";
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
  role: "project_user",
  projectIds: [],
});
export const useUserManagement = () => {
  const { profile } = useAuth();
  const { projectId } = useActiveProjectScope();
  const permissions = capabilities(profile?.role);
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
          role: parsed.role,
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
  return {
    projects: projectsRaw ?? [],
    currentUser,
    formData,
    baseline,
    setFormData,
    error,
    handleEditUser: (user: User) => {
      const data = {
        email: user.email ?? "",
        role: user.role ?? "project_user",
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
