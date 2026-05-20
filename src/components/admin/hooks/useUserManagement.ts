import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { User, Project, UserFormData, UserRole } from "../types/user-types";

export type { User, Project, UserFormData, UserRole };

export const useUserManagement = () => {
  const { toast } = useToast();
  const { projectId: activeProjectId } = useActiveProject();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    role: "project_user",
    projectId: activeProjectId,
  });

  useEffect(() => {
    setFormData((prev) =>
      prev.projectId || !activeProjectId ? prev : { ...prev, projectId: activeProjectId },
    );
  }, [activeProjectId]);

  const usersRaw = useQuery(api.users.list);
  const projectsRaw = useQuery(api.projects.listActive);

  const updateRoleMut = useMutation(api.users.updateRole);
  const assignProjectMut = useMutation(api.userProjects.assign);
  const _removeProjectMut = useMutation(api.userProjects.remove);
  const sendInviteEmail = useAction(api.actions.sendEmail.sendUserInviteEmail);

  const users: User[] = (usersRaw ?? []) as User[];
  const projects: Project[] = (projectsRaw ?? []) as Project[];

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setFormData({ email: user.email ?? "", role: user.role ?? "project_user", projectId: activeProjectId });
  };

  const handleSaveUser = async () => {
    // Düzenleme akışı
    if (currentUser) {
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
    }

    // Yeni kullanıcı = davet maili gönder
    const trimmedEmail = formData.email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast({ title: "Hata", description: "E-posta adresi zorunludur", variant: "destructive" });
      return false;
    }
    if (formData.role === "super_admin") {
      toast({
        title: "Hata",
        description: "Süper admin davet edilemez. Mevcut kullanıcıyı düzenleyerek atayın.",
        variant: "destructive",
      });
      return false;
    }
    if (!formData.projectId) {
      toast({ title: "Hata", description: "Proje seçimi zorunludur", variant: "destructive" });
      return false;
    }

    try {
      const result = await sendInviteEmail({
        email: trimmedEmail,
        projectId: formData.projectId,
        role: formData.role,
      });
      if (!result.success) {
        toast({
          title: "Mail gönderilemedi",
          description: result.error ?? "Davet maili gönderilirken bir hata oluştu",
          variant: "destructive",
        });
        return false;
      }
      toast({
        title: "Davet gönderildi",
        description: `${trimmedEmail} adresine davet maili gönderildi.`,
      });
      return true;
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Davet oluşturulamadı",
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
    setFormData({ email: "", role: "project_user", projectId: activeProjectId });
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
