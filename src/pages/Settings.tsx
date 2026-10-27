import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { SettingsSidebar, SETTINGS_SECTIONS } from "@/components/settings/SettingsSidebar";
import { SettingsFormState } from "@/components/settings/SettingsFormState";
import { useSettingsFormsGuard } from "@/components/settings/useSettingsFormsGuard";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { ReportsSettings } from "@/components/settings/sections/ReportsSettings";
import { NotificationSettings } from "@/components/settings/sections/NotificationSettings";
import { MailSettings } from "@/components/settings/sections/MailSettings";
import { IntegrationsSettings } from "@/components/settings/sections/IntegrationsSettings";
import { PrivacySettings } from "@/components/settings/sections/PrivacySettings";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { usePermissions } from "@/hooks/usePermissions";
import { RolesSettings } from "@/components/settings/sections/RolesSettings";
import { permissionCapabilities, type SettingsTab } from "@/lib/capabilities";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { PDKS_SETTINGS_PATH } from "@/components/pdks/settings/route";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, role, loading } = usePermissions();
  const permissions = permissionCapabilities(can, role);
  const requestedTab = searchParams.get("tab");
  const section = SETTINGS_SECTIONS.find(item => item.key === requestedTab) ?? SETTINGS_SECTIONS.find(item => permissions.settingsTabs.includes(item.key)) ?? SETTINGS_SECTIONS[0];
  const activeTab = section.key;
  const scope = useActiveProjectScope();
  const { reportForm, pending, dialog } = useSettingsFormsGuard();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousTab = useRef(activeTab);
  useEffect(() => {
    if (previousTab.current !== activeTab) { heading.current?.focus(); previousTab.current = activeTab; }
  }, [activeTab]);
  useEffect(() => {
    // Mesai ve tatil bölümü PDKS › Ayarlar sekmesine taşındı; eski bağlantılar oraya gider.
    if (requestedTab === "work-payroll") { navigate(PDKS_SETTINGS_PATH, { replace: true }); return; }
    if (requestedTab !== null && !SETTINGS_SECTIONS.some(item => item.key === requestedTab)) {
      const next = new URLSearchParams(searchParams); next.delete("tab"); setSearchParams(next, { replace: true });
    }
  }, [requestedTab, searchParams, setSearchParams, navigate]);
  const handleTabChange = (tab: SettingsTab) => {
    if (pending || tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    if (tab === "general") next.delete("tab"); else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  if (loading) return <SectionSkeleton label="Ayarlar yükleniyor" />;
  if (!permissions.settingsTabs.includes(activeTab)) return <><AccessDenied message="Bu ayar bölümünü görüntüleme yetkiniz yok." /><Link className="inline-flex min-h-11 items-center text-sm underline" to="/profile">Profilimi aç</Link></>;
  const content = () => {
    switch (activeTab) {
      case "roles": return <RolesSettings />;
      case "general": return <GeneralSettings />;
      case "users": return <div className="-mx-1 min-w-0 overflow-x-auto p-1"><AdminUsersPanel projectScoped /></div>;
      case "reports": return <ReportsSettings requestedReport={searchParams.get("report")} />;
      case "integrations": return <IntegrationsSettings />;
      case "privacy": return <PrivacySettings />;
      case "mail": return <MailSettings />;
      case "notifications": return <NotificationSettings />;
    }
  };
  return <div className="min-w-0 space-y-8">
    <PageHeader title="Ayarlar" scope={scope.activeProject?.name ?? "Proje seçilmedi"} />
    <div className="flex min-w-0 flex-col gap-6 min-[761px]:flex-row min-[761px]:gap-12">
      <SettingsSidebar selected={activeTab} onSelect={handleTabChange} disabled={pending} />
      <div className="w-full min-w-0 max-w-[800px] flex-1 space-y-6">
        <div><h2 ref={heading} tabIndex={-1} className="text-base font-semibold">{section.label}</h2><p className="mt-1 text-sm text-muted-foreground">{section.scope}</p></div>
        {scope.loading ? <SectionSkeleton label="Proje yükleniyor" /> : !scope.projectId ? <EmptyState
          title={scope.isSuperAdmin ? "Henüz aktif proje yok" : "Proje ataması bekleniyor"}
          description={scope.isSuperAdmin ? "Projeleri Admin sayfasından kontrol edebilirsiniz." : "Projeye atanmak için yöneticinizle iletişime geçin."}
          action={{ label: scope.isSuperAdmin ? "Admin sayfasını aç" : "Profilimi aç", onClick: () => navigate(scope.isSuperAdmin ? "/system-admin" : "/profile") }} /> :
          <SettingsFormState.Provider value={reportForm}><QuerySectionBoundary key={`${scope.projectId}:${activeTab}`} resetKey={`${scope.projectId}:${activeTab}`}
            title="Bu bölüm yüklenemedi" description="Diğer ayar bölümlerine geçebilir veya tekrar deneyebilirsiniz.">
            {content()}
          </QuerySectionBoundary></SettingsFormState.Provider>}
      </div>
    </div>
    {dialog}
  </div>;
}
