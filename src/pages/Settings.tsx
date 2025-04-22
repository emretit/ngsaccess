
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("company");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
          <p className="text-muted-foreground">
            Sistem ayarlarını buradan yönetebilirsiniz.
          </p>
        </div>
        <Badge variant="outline">Yönetici</Badge>
      </div>

      <div className="flex w-full gap-6">
        <SidebarProvider defaultOpen>
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1">
            <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
}
