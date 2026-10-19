import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_NavigationContext, useSearchParams, useNavigate, Link } from "react-router-dom";
import { SettingsSidebar, SETTINGS_SECTIONS } from "@/components/settings/SettingsSidebar";
import { SettingsFormState, type FormState } from "@/components/settings/SettingsFormState";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { WorkAndPayrollSettings } from "@/components/settings/sections/WorkAndPayrollSettings";
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
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { capabilities, type SettingsTab } from "@/lib/capabilities";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useProjectChangeGuard } from "@/contexts/ActiveProjectContext";

import { installNavigationGuard } from "@/lib/navigationGuard";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const section = SETTINGS_SECTIONS.find(item => item.key === requestedTab) ?? SETTINGS_SECTIONS[0];
  const activeTab = section.key;
  const { profile, loading } = useAuth();
  const scope = useActiveProjectScope();
  const permissions = capabilities(profile?.role);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const reportForm = useCallback((id: string, state: FormState | null) => setForms(previous => {
    if (state && previous[id]?.dirty === state.dirty && previous[id]?.pending === state.pending) return previous;
    const next = { ...previous };
    if (state) next[id] = state; else delete next[id];
    return next;
  }), []);
  const dirty = Object.values(forms).some(form => form.dirty);
  const pending = Object.values(forms).some(form => form.pending);
  const guard = useUnsavedChangesGuard(dirty || pending);
  useProjectChangeGuard(dirty || pending, pending ? () => undefined : guard.requestClose);
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const { requestClose } = guard;
  useEffect(() => {
    if (!dirty && !pending) return;
    return installNavigationGuard(navigator, proceed => { if (!pending) requestClose(proceed); }, window, pending);
  }, [dirty, pending, navigator, requestClose]);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousTab = useRef(activeTab);
  useEffect(() => {
    if (previousTab.current !== activeTab) { heading.current?.focus(); previousTab.current = activeTab; }
  }, [activeTab]);
  useEffect(() => {
    if (requestedTab !== null && !SETTINGS_SECTIONS.some(item => item.key === requestedTab)) {
      const next = new URLSearchParams(searchParams); next.delete("tab"); setSearchParams(next, { replace: true });
    }
  }, [requestedTab, searchParams, setSearchParams]);
  const handleTabChange = (tab: SettingsTab) => {
    if (pending || tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    if (tab === "general") next.delete("tab"); else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  if (loading) return <SectionSkeleton label="Ayarlar yükleniyor" />;
  if (!permissions.settingsTabs.includes(activeTab)) return <><AccessDenied message="Bu ayar bölümünü görüntüleme yetkiniz yok." /><Link className="text-sm underline" to="/profile">Profilimi aç</Link></>;
  const content = () => {
    switch (activeTab) {
      case "general": return <GeneralSettings />;
      case "users": return <div className="min-w-0 max-w-full overflow-x-auto"><AdminUsersPanel /></div>;
      case "work-payroll": return <WorkAndPayrollSettings />;
      case "reports": return <ReportsSettings />;
      case "integrations": return <IntegrationsSettings />;
      case "privacy": return <PrivacySettings />;
      case "mail": return <MailSettings />;
      case "notifications": return <NotificationSettings />;
    }
  };
  return <div className="min-w-0 space-y-8">
    <PageHeader title="Ayarlar" scope={`${scope.activeProject?.name ?? "Proje seçilmedi"} · ${section.scope}`} />
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
    {guard.dialog}
  </div>;
}
