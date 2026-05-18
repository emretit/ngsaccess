
import { useEffect, useState } from "react";
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

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab =
    tabFromUrl && (VALID_TABS as readonly string[]).includes(tabFromUrl)
      ? tabFromUrl
      : "general";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { loading } = useGeneralSettings();

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab && (VALID_TABS as readonly string[]).includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
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
      default:
        return <GeneralSettings />;
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
