import React, { createContext, useContext, useRef } from 'react';
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
  verified?: boolean;
  photo_url?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  session: unknown | null;
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown | null }>;
  signUp: (
    email: string,
    password: string,
    name?: string,
    companyName?: string,
  ) => Promise<{ error: unknown | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkUserRole: (requiredRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = [
  '/', '/login', '/register', '/auth', '/verify-email', '/demo-request',
  '/user-setup', '/admin-setup', '/employee-setup', '/system-admin',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const ensureProject = useMutation(api.onboarding.ensureProjectForNewUser);
  const requestVerification = useMutation(api.emailVerification.requestVerification);
  const navigate = useNavigate();
  const location = useLocation();

  const loading = isLoading || (isAuthenticated && user === undefined);
  const profile = user ?? null;

  // verified=false kullanıcıyı bir kez signOut etmek için (effect döngüsünü önler)
  const blockedRef = useRef(false);
  // ensureProject'i bir kez çağırmak için (idempotent ama gereksiz çağrıyı önler)
  const ensuredRef = useRef(false);
  // signUp sürerken effect'in /home'a yönlendirmesini engelle (dashboard flash'ı).
  // Convex Auth signUp anında oturum açar; biz hemen signOut edeceğiz, bu arada
  // effect tetiklenip kullanıcıyı bir an dashboard'a atmasın.
  const signingUpRef = useRef(false);

  React.useEffect(() => {
    if (isLoading) return;

    // signUp devam ediyor: oturum geçici olarak açık ama hemen kapatılacak.
    // Bu pencerede hiçbir yönlendirme/proje oluşturma yapma (dashboard flash'ı önlenir).
    if (signingUpRef.current) return;

    if (isAuthenticated && profile) {
      // Doğrulanmamış self-signup kullanıcısı içeri giremez.
      // Eski kullanıcılar verified=undefined → engellenmez (yalnızca === false).
      if (profile.verified === false) {
        if (!blockedRef.current) {
          blockedRef.current = true;
          void convexSignOut()
            .then(() => {
              toast({
                title: "E-posta doğrulanmadı",
                description: "Giriş yapmadan önce e-postanıza gönderdiğimiz doğrulama linkine tıklayın.",
                variant: "destructive",
              });
              navigate('/login');
            })
            .catch(() => {
              // signOut başarısız olursa tekrar denenebilsin.
              blockedRef.current = false;
            });
        }
        return;
      }

      blockedRef.current = false;

      // Doğrulanmış kullanıcı: projesi yoksa otomatik oluştur (idempotent).
      if (!ensuredRef.current) {
        ensuredRef.current = true;
        ensureProject({}).catch(() => {
          // Hata olursa (geçici) sonraki effect tetiklemesinde tekrar denensin.
          ensuredRef.current = false;
        });
      }

      if (
        location.pathname === '/login' ||
        location.pathname === '/register' ||
        location.pathname === '/verify-email'
      ) {
        navigate('/home');
      }
    }

    if (!isAuthenticated) {
      ensuredRef.current = false;
      if (!PUBLIC_PATHS.includes(location.pathname)) {
        navigate('/login');
      }
    }
  }, [isAuthenticated, isLoading, profile, location.pathname, navigate, convexSignOut, ensureProject]);

  const signIn = async (email: string, password: string) => {
    try {
      await convexSignIn("password", { email, password, flow: "signIn" });
      // verified guard'ı ve yönlendirme useEffect'te yapılır
      // (signIn anında profile henüz client'a yüklenmemiş olabilir).
      return { error: null };
    } catch (error: unknown) {
      return { error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name?: string,
    companyName?: string,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    // Bu pencerede effect'in /home'a yönlendirmesini engelle (dashboard flash'ı).
    signingUpRef.current = true;
    try {
      // Convex Auth signUp hesabı oluşturur ve oturum açar.
      // verified=false ve firstCompanyName, auth.ts'teki profile() callback ile
      // BU çağrıda users'a yazılır (companyName parametresi profile'a ulaşır).
      await convexSignIn("password", {
        email: normalizedEmail,
        password,
        name: name ?? normalizedEmail.split('@')[0],
        companyName: companyName?.trim() ?? "",
        flow: "signUp",
      });
      // Doğrulama token'ını üret ve doğrulama mailini gönder.
      await requestVerification({ email: normalizedEmail });
      // Doğrulanana kadar içeri girilmesin — oturumu hemen kapat.
      await convexSignOut();
      return { error: null };
    } catch (error: unknown) {
      // signUp yarıda kaldıysa oturumu temizlemeye çalış.
      try {
        await convexSignOut();
      } catch {
        // yok say
      }
      return { error };
    } finally {
      signingUpRef.current = false;
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
