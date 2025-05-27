
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

  React.useEffect(() => {
    console.log("AuthProvider: Checking auth profile and location", { 
      profile: profile?.role, 
      pathname: location.pathname,
      hasProfile: !!profile,
      isLandingOrAuth: location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register',
      userEmail: user?.email,
      profileData: profile
    });
    
    // Debug: Profile ve rol bilgilerini detaylı logla
    if (profile) {
      console.log("AuthProvider: Kullanıcı profil detayları:", {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        created_at: profile.created_at
      });
    }
    
    // Yönlendirme davranışını değiştirdik - artık her sayfa değişiminde yönlendirme yapmıyoruz
    // Sadece login sonrası veya profilimiz ilk yüklendiğinde kontrol ediyoruz
    if (!profile || location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register') {
      // Sadece ilk girişte veya kimlik doğrulama sayfalarında yönlendirme yap
      if (profile && (location.pathname === '/login' || location.pathname === '/register')) {
        navigate('/home');
      }
    }
  }, [profile, navigate, location.pathname]);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log("AuthProvider: Auth state changed", event);
      
      if (event === 'SIGNED_IN') {
        toast({
          title: "Giriş başarılı",
          description: "Başarıyla giriş yaptınız"
        });
        
        // Login sonrası home sayfasına yönlendir
        console.log("AuthProvider: Redirecting to home after signin");
        navigate('/home');
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
    const hasRole = checkRole(profile, requiredRole);
    console.log("AuthProvider: checkUserRole kontrolü", {
      requiredRole,
      userRole: profile?.role,
      hasRole,
      profileExists: !!profile
    });
    return hasRole;
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
