
import { useState } from "react";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { ShiftSettings } from "@/components/settings/sections/ShiftSettings";
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
      case "schedule":
        return <ShiftSettings />;
      case "mail":
        return <MailSettings />;
      case "notifications":
        return <NotificationSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <main className="flex-1 p-6 bg-gray-50 flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex flex-1 min-h-0">
        <SettingsSidebar
          selected={activeTab}
          onSelect={setActiveTab}
        />
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            {renderActiveContent()}
          </div>
        </div>
      </div>
    </main>
  );
}
