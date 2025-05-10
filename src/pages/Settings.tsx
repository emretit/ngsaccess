
import { useState } from "react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <main className="flex-1 p-6 bg-gray-50 flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex flex-1 min-h-0">
        <SettingsSidebar
          selected={activeTab}
          onSelect={setActiveTab}
        />
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </div>
      </div>
    </main>
  );
}
