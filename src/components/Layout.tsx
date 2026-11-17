import { usePermissions } from "@/hooks/usePermissions";
import { useLayoutEffect, useRef, Suspense } from "react";
import { Navigate, Link, useLocation, useNavigationType, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SyncIssuesBanner } from "@/components/sync/SyncIssuesBanner";

import { readingRouteAccess, resolveRouteContext } from "@/lib/routeMeta";
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
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);
  const readingAccess = readingRouteAccess(location.pathname, location.search, can);
  const ready = !loading && Boolean(session) && profile?.verified !== false && !(readingAccess !== null && permissionsLoading) && readingAccess !== false;
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!ready || !main) return;
    const pathChanged = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (pathChanged) main.focus({ preventScroll: true });
    const target = mainScrollTarget(location.key, navigationType, pathChanged, location.hash);
    let current = { left: main.scrollLeft, top: main.scrollTop };
    let pending = target.position;
    const save = () => {
      if (!pending) current = { left: main.scrollLeft, top: main.scrollTop };
    };
    main.addEventListener("scroll", save, { passive: true });
    const stop = restoreMainPosition(main, target.position, target.hash, () => {
      pending = undefined;
      current = { left: main.scrollLeft, top: main.scrollTop };
    });
    return () => {
      main.removeEventListener("scroll", save);
      stop();
      rememberMainPosition(location.key, pending ?? current);
    };
  }, [location.key, location.pathname, location.hash, navigationType, ready]);
  const { title: pageTitle, breadcrumbs } = resolveRouteContext(location.pathname);
  if (loading) return <LoadingSpinner text="Sistem hazırlanıyor..." />;
  if (!session || profile?.verified === false) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (readingAccess !== null && permissionsLoading) return <SectionSkeleton label="Yetkiler yükleniyor" />;
  if (readingAccess === false) return <Navigate to="/home" replace />;

  return (
    <SidebarProvider>
      <a href="#main" className="skip-link">İçeriğe geç</a>
      <AppSidebar />
      <SidebarInset className="h-screen overflow-hidden bg-canvas">
        <AppHeader title={pageTitle} breadcrumbs={breadcrumbs} />
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

interface ScrollPosition { left: number; top: number }
const mainPositions = new Map<string, ScrollPosition>();
const MAX_SCROLL_ENTRIES = 100;

export function rememberMainPosition(key: string, position: ScrollPosition) {
  mainPositions.delete(key);
  mainPositions.set(key, position);
  if (mainPositions.size > MAX_SCROLL_ENTRIES) {
    const oldest = mainPositions.keys().next().value;
    if (oldest !== undefined) mainPositions.delete(oldest);
  }
}

export function mainScrollTarget(key: string, navigation: string, pathChanged: boolean, hash: string): { position?: ScrollPosition; hash?: string } {
  const saved = navigation === "POP" ? mainPositions.get(key) : undefined;
  if (saved) return { position: saved };
  if (hash) return { hash };
  return pathChanged && navigation !== "POP" ? { position: { left: 0, top: 0 } } : {};
}

/** Wait for lazy/query content using observers, never a polling animation loop.
 * User input cancels restoration; all observers/timers end after 30 seconds. */
export function restoreMainPosition(main: HTMLElement, position: ScrollPosition | undefined, hash: string | undefined, onRestored: () => void): () => void {
  if (!position && !hash) { onRestored(); return () => {}; }
  let stopped = false;
  let frame: number | undefined;
  const observers: { timeout?: ReturnType<typeof setTimeout>; mutation?: MutationObserver; resize?: ResizeObserver } = {};
  const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const stop = () => {
    stopped = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (observers.timeout !== undefined) clearTimeout(observers.timeout);
    observers.mutation?.disconnect();
    observers.resize?.disconnect();
    events.forEach(event => main.removeEventListener(event, cancel));
  };
  const finish = () => { stop(); onRestored(); };
  const cancel = () => finish();
  const apply = () => {
    frame = undefined;
    if (stopped) return;
    if (position) {
      main.scrollTo({ left: position.left, top: position.top, behavior: "instant" });
      if (!main.querySelector('[aria-busy="true"]') && Math.abs(main.scrollTop - position.top) <= 1 && Math.abs(main.scrollLeft - position.left) <= 1) finish();
    } else if (hash) {
      let id: string;
      try { id = decodeURIComponent(hash.slice(1)); } catch { finish(); return; }
      const element = document.getElementById(id);
      if (element && main.contains(element)) {
        const top = element.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
        main.scrollTo({ top, left: 0, behavior: "instant" });
        finish();
      }
    }
  };
  const schedule = () => { if (!stopped && frame === undefined) frame = requestAnimationFrame(apply); };
  // An immediate attempt also covers already-mounted cached pages.
  apply();
  if (stopped) return stop;
  events.forEach(event => main.addEventListener(event, cancel, { passive: true }));
  const observeSize = () => {
    observers.resize?.disconnect();
    observers.resize?.observe(main);
    Array.from(main.children).forEach(child => observers.resize?.observe(child));
  };
  observers.resize = new ResizeObserver(schedule);
  observers.mutation = new MutationObserver(() => { observeSize(); schedule(); });
  observers.mutation.observe(main, { childList: true, subtree: true, characterData: true, attributes: true });
  observeSize();
  observers.timeout = setTimeout(finish, 30_000);
  return stop;
}
