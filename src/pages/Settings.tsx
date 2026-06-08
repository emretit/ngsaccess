import { useSearchParams, Link } from "react-router-dom";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { WorkAndPayrollSettings } from "@/components/settings/sections/WorkAndPayrollSettings";
import { ReportsSettings } from "@/components/settings/sections/ReportsSettings";
import { NotificationSettings } from "@/components/settings/sections/NotificationSettings";
import { MailSettings } from "@/components/settings/sections/MailSettings";
import { IntegrationsSettings } from "@/components/settings/sections/IntegrationsSettings";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useGeneralSettings } from "@/components/settings/sections/hooks/useGeneralSettings";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const VALID_TABS = [
  "general",
  "users",
  "work-payroll",
  "reports",
  "integrations",
  "mail",
  "notifications",
] as const;

const TAB_LABELS: Record<string, string> = {
  general: "Genel",
  users: "Kullanıcı Yönetimi",
  "work-payroll": "Mesai & Tatil",
  reports: "Raporlar",
  integrations: "Entegrasyonlar",
  mail: "Mail Ayarları",
  notifications: "Bildirimler",
};

type Tab = (typeof VALID_TABS)[number];

function isValidTab(value: string | null): value is Tab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab: Tab = isValidTab(tabFromUrl) ? tabFromUrl : "general";
  const { loading } = useGeneralSettings();

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "general") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return <LoadingSpinner text="Ayarlar yükleniyor..." />;
  }

  const renderActiveContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings />;
      case "users":
        return <AdminUsersPanel />;
      case "work-payroll":
        return <WorkAndPayrollSettings />;
      case "reports":
        return <ReportsSettings />;
      case "integrations":
        return <IntegrationsSettings />;
      case "mail":
        return <MailSettings />;
      case "notifications":
        return <NotificationSettings />;
    }
  };

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/home">Ana Sayfa</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {activeTab === "general" ? (
              <BreadcrumbPage>Ayarlar</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to="/settings">Ayarlar</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {activeTab !== "general" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{TAB_LABELS[activeTab] ?? activeTab}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col md:flex-row gap-4 flex-1">
        <SettingsSidebar selected={activeTab} onSelect={handleTabChange} />

        <div className="flex-1 min-w-0 overflow-auto">
          {renderActiveContent()}
        </div>
      </div>
    </div>
  );
}
