
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AuthError {
  message: string;
}

export const fetchUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

export const signInWithPassword = async (email: string, password: string) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  } catch (error: any) {
    return { error };
  }
};

export const signUpWithPassword = async (email: string, password: string, name?: string) => {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name || email.split('@')[0]
        }
      }
    });
    
    return { error };
  } catch (error: any) {
    return { error };
  }
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const redirectBasedOnRole = (role: string, navigate: Function, currentPath: string) => {
  // Don't redirect if on the landing page
  if (currentPath === '/') {
    return;
  }
  
  // Tüm rolleri home sayfasına yönlendirelim
  navigate('/home');
  
  // Rollerine göre yönlendirme şimdilik iptal edildi
  /*
  switch (role) {
    case 'super_admin':
      navigate('/admin/dashboard');
      break;
    case 'project_admin':
      navigate('/settings');
      break;
    case 'project_user':
      navigate('/dashboard');
      break;
    default:
      // Don't redirect to '/' as it's the landing page
      break;
  }
  */
};

export const checkUserRole = (profile: any | null, requiredRole: 'super_admin' | 'project_admin' | 'project_user'): boolean => {
  if (!profile) return false;
  
  // Super admin can do everything
  if (profile.role === 'super_admin') return true;
  
  // Project admin can do project_admin and project_user tasks
  if (profile.role === 'project_admin') {
    return requiredRole === 'project_admin' || requiredRole === 'project_user';
  }
  
  // Project user can only do project_user tasks
  if (profile.role === 'project_user') {
    return requiredRole === 'project_user';
  }
  
  return false;
};
