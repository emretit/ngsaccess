import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface NotificationSettingsProps {
  onComplete?: () => void;
}

export function NotificationSettings({ onComplete }: NotificationSettingsProps) {
  const handleSave = () => {
    // Simulate save operation
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bildirim Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="emailNotifications">E-posta Bildirimleri</Label>
          <Switch id="emailNotifications" />
        </div>
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="lateNotifications">Geç Kalma Bildirimleri</Label>
          <Switch id="lateNotifications" />
        </div>
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="reportNotifications">Rapor Bildirimleri</Label>
          <Switch id="reportNotifications" />
        </div>
        <Button onClick={handleSave}>Değişiklikleri Kaydet</Button>
      </CardContent>
    </Card>
  );
}
