import {
  AdminPrimaryActionContext,
  type AdminPrimaryAction,
} from "@/components/admin/hooks/useAdminPrimaryAction";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { PageTemplate } from "@/components/shared/PageTemplate";
import { PageHeaderPrimaryButton } from "@/components/shared/PageHeader";
import { Plus } from "lucide-react";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import AdminProjectsPanel from "@/components/admin/AdminProjectsPanel";
import { AdminDevicesPanel } from "@/components/admin/AdminDevicesPanel";

export default function SystemAdmin() {
  const { loading, user, profile } = useAuth();
  const navigate = useNavigate();
  const [primaryAction, setPrimaryAction] = useState<AdminPrimaryAction>();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab =
    requested === "projects" || requested === "devices" ? requested : "users";
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);
  if (loading || (user && !profile))
    return <PageTemplate title="Admin"><SectionSkeleton label="Yetkiler yükleniyor" /></PageTemplate>;
  if (!user || profile?.role !== "super_admin")
    return (
      <PageTemplate title="Admin"><AccessDenied compact message="Bu sayfa için süper admin yetkisi gerekli." /></PageTemplate>
    );
  return (
    <AdminPrimaryActionContext.Provider value={setPrimaryAction}>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(params);
          next.set("tab", value);
          setParams(next);
        }}
        className="min-w-0"
      >
        <PageTemplate
          title="Admin"
          scope="Global kapsam · Tüm kullanıcılar, projeler ve cihazlar. Üst çubuktaki proje seçimi bu listeleri daraltmaz."
          primaryAction={primaryAction && (
            <PageHeaderPrimaryButton onClick={primaryAction.onClick}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {primaryAction.label}
            </PageHeaderPrimaryButton>
          )}
          navigation={
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
              <TabsTrigger value="projects">Projeler</TabsTrigger>
              <TabsTrigger value="devices">Cihaz havuzu</TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="users" className="mt-0 min-w-0">
            <AdminUsersPanel />
          </TabsContent>
          <TabsContent value="projects" className="mt-0 min-w-0">
            <AdminProjectsPanel />
          </TabsContent>
          <TabsContent value="devices" className="mt-0 min-w-0">
            <AdminDevicesPanel />
          </TabsContent>
        </PageTemplate>
      </Tabs>
    </AdminPrimaryActionContext.Provider>
  );
}
