import { useSearchParams } from "react-router-dom";
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

const VALID_TABS = [
  "general",
  "users",
  "work-payroll",
  "reports",
  "integrations",
  "mail",
  "notifications",
] as const;

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
    <div className="flex flex-col md:flex-row gap-4 min-h-full">
      <SettingsSidebar selected={activeTab} onSelect={handleTabChange} />

      <div className="flex-1 min-w-0 overflow-auto">
        {renderActiveContent()}
      </div>
    </div>
  );
}
