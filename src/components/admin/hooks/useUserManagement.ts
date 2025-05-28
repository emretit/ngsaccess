
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { User, Project, UserWithProjects, UserFormData } from '../types/user-types';

export const useUserManagement = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    role: 'project_user',
    selectedProjects: [],
    projectAdminRights: {}
  });
  const { toast } = useToast();

  // Fetch users with their project assignments
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          *,
          project_users!inner(project_id, is_admin, projects(name))
        `)
        .order('email');

      if (error) {
        toast({
          variant: "destructive",
          title: "Kullanıcılar yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      return userData as UserWithProjects[];
    }
  });

  // Fetch projects for assignment
  const { data: projects = [] } = useQuery({
    queryKey: ['admin', 'projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Project[];
    }
  });

  const handleEditUser = async (user: User) => {
    setCurrentUser(user);
    
    // Fetch user's current project assignments
    const { data: userProjects } = await supabase
      .from('project_users')
      .select('project_id, is_admin')
      .eq('user_id', user.id);

    const selectedProjects = userProjects?.map(up => up.project_id) || [];
    const projectAdminRights = {};
    userProjects?.forEach(up => {
      projectAdminRights[up.project_id] = up.is_admin;
    });

    setFormData({
      email: user.email,
      password: '',
      role: user.role,
      selectedProjects,
      projectAdminRights
    });
  };

  const handleProjectSelection = (projectId: number, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        selectedProjects: [...formData.selectedProjects, projectId],
        projectAdminRights: {
          ...formData.projectAdminRights,
          [projectId]: false
        }
      });
    } else {
      const newSelectedProjects = formData.selectedProjects.filter(id => id !== projectId);
      const newProjectAdminRights = { ...formData.projectAdminRights };
      delete newProjectAdminRights[projectId];
      
      setFormData({
        ...formData,
        selectedProjects: newSelectedProjects,
        projectAdminRights: newProjectAdminRights
      });
    }
  };

  const handleAdminRightsChange = (projectId: number, isAdmin: boolean) => {
    setFormData({
      ...formData,
      projectAdminRights: {
        ...formData.projectAdminRights,
        [projectId]: isAdmin
      }
    });
  };

  const handleSaveUser = async () => {
    try {
      if (!formData.email) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "E-posta adresi zorunludur"
        });
        return;
      }

      if (!currentUser && !formData.password) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Şifre zorunludur"
        });
        return;
      }

      // Super admin olmayan kullanıcılar için proje seçimi zorunlu
      if (formData.role !== 'super_admin' && formData.selectedProjects.length === 0) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "En az bir proje seçmelisiniz"
        });
        return;
      }

      let userId = currentUser?.id;

      if (currentUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            role: formData.role
          })
          .eq('id', currentUser.id);

        if (error) throw error;
        
        // Remove existing project assignments
        await supabase
          .from('project_users')
          .delete()
          .eq('user_id', currentUser.id);
        
        toast({
          title: "Kullanıcı güncellendi",
          description: "Kullanıcı bilgileri başarıyla güncellendi"
        });
      } else {
        // Create new user
        const { data, error } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true
        });

        if (error) throw error;
        userId = data.user?.id;

        // Update role if not default
        if (formData.role !== 'project_user' && data.user) {
          const { error: roleError } = await supabase
            .from('users')
            .update({ role: formData.role })
            .eq('id', data.user.id);
            
          if (roleError) throw roleError;
        }
        
        toast({
          title: "Kullanıcı oluşturuldu",
          description: "Yeni kullanıcı başarıyla oluşturuldu"
        });
      }

      // Add project assignments (super_admin hariç)
      if (userId && formData.role !== 'super_admin' && formData.selectedProjects.length > 0) {
        const projectAssignments = formData.selectedProjects.map(projectId => ({
          user_id: userId,
          project_id: projectId,
          is_admin: formData.projectAdminRights[projectId] || false
        }));

        const { error: projectError } = await supabase
          .from('project_users')
          .insert(projectAssignments);

        if (projectError) throw projectError;
      }

      refetchUsers();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Kullanıcı kaydedilirken bir hata oluştu"
      });
      return false;
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      // First delete project assignments
      await supabase
        .from('project_users')
        .delete()
        .eq('user_id', user.id);

      // Then delete the user
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;
      
      toast({
        title: "Kullanıcı silindi",
        description: "Kullanıcı başarıyla silindi"
      });
      
      refetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Kullanıcı silinirken bir hata oluştu"
      });
    }
  };

  const resetForm = () => {
    setCurrentUser(null);
    setFormData({
      email: '',
      password: '',
      role: 'project_user',
      selectedProjects: [],
      projectAdminRights: {}
    });
  };

  return {
    users,
    projects,
    currentUser,
    formData,
    setFormData,
    handleEditUser,
    handleProjectSelection,
    handleAdminRightsChange,
    handleSaveUser,
    handleDeleteUser,
    resetForm,
    refetchUsers
  };
};
