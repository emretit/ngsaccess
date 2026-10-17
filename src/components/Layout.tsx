import { Suspense } from "react";
import { Navigate, Link, useLocation, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SyncIssuesBanner } from "@/components/sync/SyncIssuesBanner";

import { routeMeta } from "@/lib/routeMeta";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";

export default function Layout() {
  const { loading, session, profile } = useAuth();
  const location = useLocation();
  const { activeProjectId } = useActiveProject();

  const pageTitle = routeMeta.find((item) => item.href === location.pathname)?.name ?? "";
  if (loading) return <LoadingSpinner text="Sistem hazırlanıyor..." />;
  if (!session || profile?.verified === false) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-screen overflow-hidden bg-muted/50">
        <AppHeader title={pageTitle} />
        <ErrorBoundary fallback={() => <ErrorState compact title="Eşitleme durumu alınamadı" />}><SyncIssuesBanner /></ErrorBoundary>
        <main className="flex-1 overflow-auto p-3 md:p-4 min-w-0 bg-muted/50">
          <ErrorBoundary key={`${location.pathname}|${activeProjectId ?? ""}`} fallback={(_error, reset) => <>
            <ErrorState onRetry={reset} />
            <div className="text-center"><Button asChild variant="outline"><Link to="/home">Ana sayfaya dön</Link></Button></div>
          </>}>
            <Suspense fallback={<SectionSkeleton rows={5} label="Sayfa yükleniyor" />}><Outlet /></Suspense>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
