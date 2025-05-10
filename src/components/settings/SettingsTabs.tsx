
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./sections/GeneralSettings";
import { WorkScheduleSettings } from "./sections/WorkScheduleSettings";
import { NotificationSettings } from "./sections/NotificationSettings";
import { MailSettings } from "./sections/MailSettings";
import { UserManagement } from "./sections/UserManagement";

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="hidden">
        <TabsTrigger value="general">Genel</TabsTrigger>
        <TabsTrigger value="users">Kullanıcı Yönetimi</TabsTrigger>
        <TabsTrigger value="schedule">Çalışma Saatleri</TabsTrigger>
        <TabsTrigger value="mail">Mail Ayarları</TabsTrigger>
        <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>

      <TabsContent value="users">
        <UserManagement />
      </TabsContent>
      
      <TabsContent value="schedule">
        <WorkScheduleSettings />
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
