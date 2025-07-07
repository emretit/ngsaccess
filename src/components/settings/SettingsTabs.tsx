
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./sections/GeneralSettings";
import { ShiftSettings } from "./sections/ShiftSettings";
import { NotificationSettings } from "./sections/NotificationSettings";
import { MailSettings } from "./sections/MailSettings";
import AdminUsersPanel from "../admin/AdminUsersPanel";

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList>
        <TabsTrigger value="general">Genel</TabsTrigger>
        <TabsTrigger value="users">Kullanıcı Yönetimi</TabsTrigger>
        <TabsTrigger value="schedule">Vardiya Ayarları</TabsTrigger>
        <TabsTrigger value="mail">Mail Ayarları</TabsTrigger>
        <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>

      <TabsContent value="users">
        <AdminUsersPanel />
      </TabsContent>
      
      <TabsContent value="schedule">
        <ShiftSettings />
      </TabsContent>

      <TabsContent value="mail">
        <MailSettings />
      </TabsContent>
      
      <TabsContent value="notifications">
        <NotificationSettings />
      </TabsContent>
    </Tabs>
  );
}
