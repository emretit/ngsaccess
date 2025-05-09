
import React, { createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuthState } from '@/hooks/useAuthState';
import { 
  signInWithPassword, 
  signUpWithPassword, 
  signOut as authSignOut,
  redirectBasedOnRole,
  checkUserRole as checkRole
} from '@/services/authService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkUserRole: (requiredRole: 'super_admin' | 'project_admin' | 'project_user') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { session, user, profile, loading, refreshProfile } = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle auth events and role-based redirects - but not on landing page
  React.useEffect(() => {
    // Ana sayfa, login veya register sayfalarında yönlendirme yapma
    if (profile && location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/register') {
      redirectBasedOnRole(profile.role, navigate, location.pathname);
    }
  }, [profile, navigate, location.pathname]);

  // Listen for auth state changes for toast notifications
  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        toast({
          title: "Giriş başarılı",
          description: "Başarıyla giriş yaptınız"
        });
      } else if (event === 'SIGNED_OUT') {
        toast({
          title: "Çıkış yapıldı",
          description: "Başarıyla çıkış yaptınız"
        });
        // Sadece ana, login ve register sayfalarında değilse login'e yönlendir
        if (location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/register') {
          navigate('/login');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  const signIn = async (email: string, password: string) => {
    return await signInWithPassword(email, password);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    return await signUpWithPassword(email, password, name);
  };

  const signOut = async () => {
    await authSignOut();
  };

  const checkUserRole = (requiredRole: 'super_admin' | 'project_admin' | 'project_user'): boolean => {
    return checkRole(profile, requiredRole);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        checkUserRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
