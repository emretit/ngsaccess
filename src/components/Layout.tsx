import React, { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const routeTitles: Record<string, string> = {
  "/employees": "Kişiler",
  "/devices": "Cihazlar",
  "/access-control": "Geçiş Kontrol",
  "/pdks-records": "PDKS Kayıtları",
  "/shifts": "Vardiyalar",
  "/leaves": "İzinler",
  "/employee-portal": "Çalışan Portalı",
  "/siparis": "Siparis",
  "/settings": "Ayarlar",
  "/profile": "Profil",
  "/home": "Ana Sayfa",
};

export default function Layout() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = routeTitles[location.pathname] ?? "";

  useEffect(() => {
    if (
      !loading &&
      !session &&
      location.pathname !== "/login" &&
      location.pathname !== "/register"
    ) {
      navigate("/login");
    }
  }, [loading, session, navigate, location.pathname]);

  if (loading) {
    return <LoadingSpinner text="Sistem hazırlanıyor..." />;
  }

  if (
    !session &&
    location.pathname !== "/login" &&
    location.pathname !== "/register"
  ) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-900/80">
        <AppHeader title={pageTitle} />
        <main className="flex-1 overflow-auto p-3 md:p-4 min-w-0 bg-slate-100 dark:bg-slate-900/80">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
