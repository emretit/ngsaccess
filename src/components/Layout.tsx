import { usePermissions } from "@/hooks/usePermissions";
import { useEffect, useRef, Suspense } from "react";
import { Navigate, Link, useLocation, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SyncIssuesBanner } from "@/components/sync/SyncIssuesBanner";

import { readingRouteAccess, routeMeta } from "@/lib/routeMeta";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/useDarkMode";

export default function Layout() {
  const { loading, session, profile } = useAuth();
  const location = useLocation();
  const { can, loading: permissionsLoading } = usePermissions();
  const { activeProjectId } = useActiveProject();
  useDarkMode();

  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      mainRef.current?.focus();
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  const pageTitle = routeMeta.find((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))?.name ?? "";
  if (loading) return <LoadingSpinner text="Sistem hazırlanıyor..." />;
  if (!session || profile?.verified === false) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  const readingAccess = readingRouteAccess(location.pathname, location.search, can);
  if (readingAccess !== null && permissionsLoading) return <SectionSkeleton label="Yetkiler yükleniyor" />;
  if (readingAccess === false) return <Navigate to="/home" replace />;

  return (
    <SidebarProvider>
      <a href="#main" className="skip-link">İçeriğe geç</a>
      <AppSidebar />
      <SidebarInset className="h-screen overflow-hidden bg-canvas">
        <AppHeader title={pageTitle} />
        <span className="sr-only" aria-live="polite">{pageTitle}</span>
        <ErrorBoundary fallback={() => <ErrorState compact title="Eşitleme durumu alınamadı" />}><SyncIssuesBanner /></ErrorBoundary>
        <main id="main" ref={mainRef} tabIndex={-1} aria-label={pageTitle} className="flex-1 overflow-auto p-4 min-[761px]:p-8 min-w-0 bg-canvas">
          <ErrorBoundary key={`${location.pathname}|${activeProjectId ?? ""}`} fallback={(_error, reset) => <>
            <ErrorState title={location.pathname === "/home" ? "Proje özeti yüklenemedi" : undefined} description={location.pathname === "/home" ? "Tekrar deneyin veya üst çubuktan başka bir proje seçin." : undefined} onRetry={reset} />
            <div className="text-center"><Button asChild variant="outline"><Link to="/home">Ana sayfaya dön</Link></Button></div>
          </>}>
            <Suspense fallback={<SectionSkeleton rows={5} label="Sayfa yükleniyor" />}><Outlet /></Suspense>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
