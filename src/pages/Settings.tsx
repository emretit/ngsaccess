
import { useState } from "react";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralSettings } from "@/components/settings/sections/GeneralSettings";
import { WorkScheduleSettings } from "@/components/settings/sections/WorkScheduleSettings";
import { NotificationSettings } from "@/components/settings/sections/NotificationSettings";
import { MailSettings } from "@/components/settings/sections/MailSettings";
import { UserManagement } from "@/components/settings/sections/UserManagement";
import { AdminDashboard } from "@/components/settings/sections/AdminDashboard";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const { checkUserRole } = useAuth();

  const renderActiveContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings />;
      case "users":
        return <UserManagement />;
      case "schedule":
        return <WorkScheduleSettings />;
      case "mail":
        return <MailSettings />;
      case "notifications":
        return <NotificationSettings />;
      case "admin":
        return <AdminDashboard />;
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
          showAdmin={checkUserRole('super_admin')}
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
