
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./sections/GeneralSettings";
import { WorkScheduleSettings } from "./sections/WorkScheduleSettings";
import { NotificationSettings } from "./sections/NotificationSettings";

export function SettingsTabs() {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general">Genel</TabsTrigger>
        <TabsTrigger value="schedule">Çalışma Saatleri</TabsTrigger>
        <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <GeneralSettings />
      </TabsContent>
      
      <TabsContent value="schedule">
        <WorkScheduleSettings />
      </TabsContent>
      
      <TabsContent value="notifications">
        <NotificationSettings />
      </TabsContent>
    </Tabs>
  );
}
