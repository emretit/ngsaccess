import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface LayoutProps {
  children: React.ReactNode;
}

const routeTitles: Record<string, string> = {
  "/employees": "Kişiler",
  "/devices": "Cihazlar",
  "/access-control": "Geçiş Kontrol",
  "/pdks-records": "PDKS Kayıtları",
  "/shifts": "Vardiyalar",
  "/leaves": "İzinler",
  "/employee-portal": "Çalışan Portalı",
  "/settings": "Ayarlar",
  "/profile": "Profil",
  "/home": "Ana Sayfa",
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, session } = useAuth();
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
  }, [user, session, loading, navigate, location.pathname]);

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
      <SidebarInset>
        <AppHeader title={pageTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
