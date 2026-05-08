
import { useState } from "react";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { WorkAndPayrollSettings } from "@/components/settings/sections/WorkAndPayrollSettings";
import { ReportsSettings } from "@/components/settings/sections/ReportsSettings";
import { NotificationSettings } from "@/components/settings/sections/NotificationSettings";
import { MailSettings } from "@/components/settings/sections/MailSettings";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useGeneralSettings } from "@/components/settings/sections/hooks/useGeneralSettings";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const { loading } = useGeneralSettings();

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
      <SettingsSidebar selected={activeTab} onSelect={setActiveTab} />

      <div className="flex-1 min-w-0 overflow-auto">
        {renderActiveContent()}
      </div>
    </div>
  );
}
