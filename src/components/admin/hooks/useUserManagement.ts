import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import type { User, Project, UserFormData, UserRole } from "../types/user-types";

export type { User, Project, UserFormData, UserRole };

export const useUserManagement = () => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    role: "project_user",
    projectId: undefined,
  });

  const usersRaw = useQuery(api.users.list);
  const projectsRaw = useQuery(api.projects.listActive);

  const updateRoleMut = useMutation(api.users.updateRole);
  const assignProjectMut = useMutation(api.userProjects.assign);
  const removeProjectMut = useMutation(api.userProjects.remove);

  const users: User[] = (usersRaw ?? []) as User[];
  const projects: Project[] = (projectsRaw ?? []) as Project[];

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setFormData({ email: user.email ?? "", role: user.role ?? "project_user", projectId: undefined });
  };

  const handleSaveUser = async () => {
    if (!currentUser) return false;
    try {
      await updateRoleMut({ userId: currentUser._id, role: formData.role });
      if (formData.projectId) {
        await assignProjectMut({ userId: currentUser._id, projectId: formData.projectId });
      }
      toast({ title: "Kullanıcı güncellendi" });
      setCurrentUser(null);
      return true;
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Kullanıcı güncellenemedi",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDeleteUser = async (_user: User) => {
    void _user;
    toast({ title: "Bilgi", description: "Kullanıcı silme işlemi admin panelinden yapılabilir." });
  };

  const resetForm = () => {
    setCurrentUser(null);
    setFormData({ email: "", role: "project_user", projectId: undefined });
  };

  return {
    users,
    projects,
    currentUser,
    formData,
    setFormData,
    handleEditUser,
    handleSaveUser,
    handleDeleteUser,
    resetForm,
    refetchUsers: () => {},
    loading: usersRaw === undefined,
  };
};
