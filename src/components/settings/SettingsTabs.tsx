
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./sections/GeneralSettings";
import { Link } from "react-router-dom";
import { NotificationSettings } from "./sections/NotificationSettings";
import { MailSettings } from "./sections/MailSettings";
import AdminUsersPanel from "../admin/AdminUsersPanel";

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="min-w-0 w-full">
      <TabsList className="h-auto max-w-full flex-wrap justify-start">
        <TabsTrigger value="general">Genel</TabsTrigger>
        <TabsTrigger value="users">Kullanıcı Yönetimi</TabsTrigger>
        <TabsTrigger value="mail">Mail Ayarları</TabsTrigger>
        <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
      </TabsList>
      <p className="mt-3 text-sm text-muted-foreground">
        Vardiya tanımları artık Vardiyalar sayfasında.{" "}
        <Link to="/shifts" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
          Vardiyalara git
        </Link>
      </p>

      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>

      <TabsContent value="users">
        <AdminUsersPanel />
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
