
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { User, UserFormData } from '../types/user-types';

export const useUserManagement = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    role: 'project_user'
  });
  const { toast } = useToast();

  // Fetch users - simplified without project assignments
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

  const handleEditUser = async (user: User) => {
    setCurrentUser(user);
    setFormData({
      email: user.email,
      password: '',
      role: user.role
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
        // Create new user
        const { data, error } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true
        });

        if (error) throw error;

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
      password: '',
      role: 'project_user'
    });
  };

  return {
    users,
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
