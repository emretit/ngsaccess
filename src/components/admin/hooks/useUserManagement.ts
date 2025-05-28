import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { User, UserFormData, Project } from '../types/user-types';

export const useUserManagement = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    role: 'project_user',
    projectId: undefined
  });
  const { toast } = useToast();

  // Fetch users
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .order('email');

      if (error) {
        toast({
          variant: "destructive",
          title: "Kullanıcılar yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      return userData as User[];
    }
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: async () => {
      const { data: projectData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        toast({
          variant: "destructive",
          title: "Projeler yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      return projectData as Project[];
    }
  });

  const handleEditUser = async (user: User) => {
    setCurrentUser(user);
    setFormData({
      email: user.email,
      role: user.role,
      projectId: undefined
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
        return false;
      }

      if ((formData.role === 'project_admin' || formData.role === 'project_user') && !formData.projectId) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Proje seçimi zorunludur"
        });
        return false;
      }

      if (currentUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            role: formData.role
          })
          .eq('id', currentUser.id);

        if (error) throw error;
        
        toast({
          title: "Kullanıcı güncellendi",
          description: "Kullanıcı bilgileri başarıyla güncellendi"
        });
      } else {
        // Create new user - generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-12);
        
        const { data, error } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: tempPassword,
          email_confirm: true
        });

        if (error) throw error;

        // Update role if not default
        if (data.user) {
          const { error: roleError } = await supabase
            .from('users')
            .update({ role: formData.role })
            .eq('id', data.user.id);
            
          if (roleError) throw roleError;

          // If project is selected, create user-project relationship
          if (formData.projectId) {
            const { error: projectError } = await supabase
              .from('user_projects')
              .insert({
                user_id: data.user.id,
                project_id: formData.projectId
              });
              
            if (projectError) throw projectError;
          }

          // Send setup email
          try {
            const selectedProject = projects.find(p => p.id === formData.projectId);
            const { error: emailError } = await supabase.functions.invoke('send-user-setup-email', {
              body: {
                user_id: data.user.id,
                email: formData.email,
                role: formData.role,
                project_name: selectedProject?.name
              }
            });

            if (emailError) {
              console.error('Email sending error:', emailError);
              toast({
                variant: "destructive",
                title: "Email gönderme hatası",
                description: "Kullanıcı oluşturuldu ancak kurulum emaili gönderilemedi"
              });
            } else {
              toast({
                title: "Kullanıcı oluşturuldu",
                description: "Yeni kullanıcı başarıyla oluşturuldu ve kurulum emaili gönderildi"
              });
            }
          } catch (emailError) {
            console.error('Email error:', emailError);
            toast({
              variant: "destructive",
              title: "Email hatası",
              description: "Kullanıcı oluşturuldu ancak email gönderilirken hata oluştu"
            });
          }
        }
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
      // Delete the user
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
      role: 'project_user',
      projectId: undefined
    });
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
    refetchUsers
  };
};
