import { deferAuthGuard, registerAccount, shouldSignOutOrphanedSession } from './registrationFlow';
import React, { createContext, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { notify } from '@/lib/notify';
import { routeMeta, safeReturnPath } from '@/lib/routeMeta';
import { checkUserRole } from '@/services/authService';

type UserRole = "super_admin" | "project_admin" | "project_user";
type UserProfile = NonNullable<FunctionReturnType<typeof api.users.currentUser>>;

interface AuthContextType {
  session: unknown | null;
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
    companyName: string,
  ) => Promise<{ error: unknown | null; accountCreated?: boolean; verificationQueued?: boolean }>;
  verificationEmail: string | null;
  runSetup: (action: () => Promise<void>, options?: { signOutOnError?: boolean }) => Promise<void>;
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
  const requestVerification = useMutation(api.emailVerification.requestVerification);
  const navigate = useNavigate();
  const location = useLocation();

  const setupActiveRef = useRef(false);
  const [setupPhase, setSetupPhase] = React.useState<"idle" | "working" | "completed">("idle");
  const [signupPending, setSignupPending] = React.useState(false);
  const [verificationEmail, setVerificationEmail] = React.useState<string | null>(null);

  const loading = isLoading || (isAuthenticated && user === undefined);
  const profile = user ?? null;

  // verified=false kullanıcıyı bir kez signOut etmek için (effect döngüsünü önler)
  const blockedRef = useRef(false);
  const orphanedRef = useRef(false);
  // Bilinçli çıkış (kullanıcı ya da doğrulanmamış hesap) sürerken sunucu oturumu siler ve
  // currentUser null döner; token silinene kadarki bu an silinmiş oturum sayılmasın.
  const signingOutRef = useRef(false);
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
    const deferred = deferAuthGuard(location.pathname, signingUpRef.current, setupActiveRef.current);
    if (deferred) return;
    if (setupActiveRef.current) {
      setupActiveRef.current = false;
      setSetupPhase("idle");
    }

    if (isAuthenticated && profile) {
      orphanedRef.current = false;
      // Doğrulanmamış self-signup kullanıcısı içeri giremez.
      // Eski kullanıcılar verified=undefined → engellenmez (yalnızca === false).
      if (profile.verified === false) {
        if (!blockedRef.current) {
          blockedRef.current = true;
          signingOutRef.current = true;
          setVerificationEmail(profile.email ?? null);
          void convexSignOut()
            .then(() => {
              notify.error("E-posta doğrulanmadı", "Giriş yapmadan önce e-postanızdaki doğrulama bağlantısını açın.");
              const next = location.pathname === '/login' ? new URLSearchParams(location.search).get('next') : location.pathname + location.search + location.hash;
              navigate(`/login?next=${encodeURIComponent(safeReturnPath(next))}`, { replace: true });
            })
            .catch(() => {
              // signOut başarısız olursa tekrar denenebilsin.
              blockedRef.current = false;
              signingOutRef.current = false;
            });
        }
        return;
      }

      blockedRef.current = false;
      setVerificationEmail(null);

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
        navigate(safeReturnPath(new URLSearchParams(location.search).get('next')), { replace: true });
      }
    }

    if (
      shouldSignOutOrphanedSession({ isLoading, isAuthenticated, user, deferred, signingOut: signingOutRef.current }) &&
      !orphanedRef.current
    ) {
      orphanedRef.current = true;
      const isProtectedRoute = routeMeta.some(({ href }) =>
        location.pathname === href || location.pathname.startsWith(`${href}/`),
      );
      void convexSignOut()
        .then(() => {
          if (isProtectedRoute) {
            notify.info("Oturumunuz sona erdi");
            const next = location.pathname === '/login'
              ? new URLSearchParams(location.search).get('next')
              : location.pathname + location.search + location.hash;
            navigate(`/login?next=${encodeURIComponent(safeReturnPath(next))}`, { replace: true });
          }
        })
        .catch(() => {
          // Başarısız çıkış sonraki effect tetiklemesinde yeniden denenebilir.
          orphanedRef.current = false;
        });
      return;
    }

    if (!isAuthenticated) {
      blockedRef.current = false;
      orphanedRef.current = false;
      signingOutRef.current = false;
      ensuredRef.current = false;
    }
  }, [isAuthenticated, isLoading, profile, user, location.pathname, location.search, location.hash, navigate, convexSignOut, ensureProject, signupPending, setupPhase]);

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
    name: string,
    companyName: string,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedCompanyName = companyName.trim();

    if (!normalizedEmail || !normalizedName || !normalizedCompanyName) {
      return { error: new Error("Ad, firma ve e-posta alanları zorunludur.") };
    }
    if (password.length < 8) {
      return { error: new Error("Şifre en az 8 karakter olmalıdır.") };
    }

    // Bu pencerede effect'in /home'a yönlendirmesini engelle (dashboard flash'ı).
    signingUpRef.current = true;
    setSignupPending(true);
    try {
      return await registerAccount({
        createAccount: () => convexSignIn("password", {
          email: normalizedEmail,
          password,
          name: normalizedName,
          companyName: normalizedCompanyName,
          flow: "signUp",
        }),
        requestVerification: () => requestVerification({ email: normalizedEmail }),
        signOut: convexSignOut,
      });
    } finally {
      signingUpRef.current = false;
      setSignupPending(false);
    }
  };

  const runSetup = async (action: () => Promise<void>, options: { signOutOnError?: boolean } = {}) => {
    setupActiveRef.current = true;
    setSetupPhase("working");
    try {
      await action();
      setSetupPhase("completed");
    } catch (error: unknown) {
      if (options.signOutOnError ?? true) {
        try { await convexSignOut(); } catch { /* Backend doğrulama kontrolü sürer. */ }
      }
      setupActiveRef.current = false;
      setSetupPhase("idle");
      throw error;
    }
  };

  const signOut = async () => {
    signingOutRef.current = true;
    try {
      await convexSignOut();
    } catch (error: unknown) {
      signingOutRef.current = false;
      throw error;
    }
    notify.success("Çıkış yapıldı", "Başarıyla çıkış yaptınız");
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
        verificationEmail,
        runSetup,
        signIn,
        signUp,
        signOut,
        // Convex useQuery reaktif — mutation sonrası currentUser otomatik güncellenir.
        // refreshProfile çağrısı gereksiz; uyumluluk için no-op olarak bırakıldı.
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
