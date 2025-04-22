
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
          <p className="text-muted-foreground">Sistem ayarlarını buradan yönetebilirsiniz.</p>
        </div>
        <Badge variant="outline">Yönetici</Badge>
      </div>

      <div className="flex flex-col gap-4">
        <SettingsTabs />
      </div>
    </div>
  );
}
