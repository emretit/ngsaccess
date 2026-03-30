import React, { createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from '@/hooks/use-toast';
import { checkUserRole } from '@/services/authService';

type UserRole = "super_admin" | "project_admin" | "project_user";

interface UserProfile {
  _id?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  photo_url?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  session: unknown | null;
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: unknown | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkUserRole: (requiredRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const ensureProject = useMutation(api.onboarding.ensureProjectForNewUser);
  const navigate = useNavigate();
  const location = useLocation();

  const loading = isLoading || (isAuthenticated && user === undefined);
  const profile = user ?? null;

  React.useEffect(() => {
    if (!isLoading && isAuthenticated && profile) {
      if (location.pathname === '/login' || location.pathname === '/register') {
        navigate('/home');
      }
    }
    if (!isLoading && !isAuthenticated) {
      const publicPaths = ['/', '/login', '/register', '/auth', '/demo-request', '/user-setup', '/admin-setup', '/employee-setup', '/system-admin'];
      if (!publicPaths.includes(location.pathname)) {
        navigate('/login');
      }
    }
  }, [isAuthenticated, isLoading, profile, location.pathname, navigate]);

  const signIn = async (email: string, password: string) => {
    try {
      await convexSignIn("password", { email, password, flow: "signIn" });
      toast({ title: "Giriş başarılı", description: "Başarıyla giriş yaptınız" });
      navigate('/home');
      return { error: null };
    } catch (error: unknown) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      await convexSignIn("password", { email, password, name: name ?? email.split('@')[0], flow: "signUp" });
      // Yeni kullanıcı için otomatik proje oluştur (doğrudan kayıt)
      await ensureProject();
      return { error: null };
    } catch (error: unknown) {
      return { error };
    }
  };

  const signOut = async () => {
    await convexSignOut();
    toast({ title: "Çıkış yapıldı", description: "Başarıyla çıkış yaptınız" });
    navigate('/');
  };

  const handleCheckUserRole = (requiredRole: UserRole): boolean => {
    return checkUserRole(profile as { role?: UserRole } | null, requiredRole);
  };

  return (
    <AuthContext.Provider
      value={{
        session: isAuthenticated ? { user } : null,
        user: user ?? null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile: async () => {},
        checkUserRole: handleCheckUserRole,
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
