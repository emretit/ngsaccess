
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useState, useEffect } from "react";

interface NotificationSettingsProps {
  onComplete?: () => void;
}

export function NotificationSettings({ onComplete }: NotificationSettingsProps) {
  const { notificationSettings, isLoading, saveNotificationSettings, isSaving } = useNotificationSettings();
  
  const [formData, setFormData] = useState({
    email_notifications: true,
    late_notifications: true,
    report_notifications: true,
    system_notifications: true
  });

  useEffect(() => {
    if (notificationSettings) {
      setFormData({
        email_notifications: notificationSettings.email_notifications ?? true,
        late_notifications: notificationSettings.late_notifications ?? true,
        report_notifications: notificationSettings.report_notifications ?? true,
        system_notifications: notificationSettings.system_notifications ?? true
      });
    }
  }, [notificationSettings]);

  const handleSave = () => {
    saveNotificationSettings(formData);
    if (onComplete) {
      onComplete();
    }
  };

  const handleSwitchChange = (field: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
    }));
  };

  if (isLoading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bildirim Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="emailNotifications">E-posta Bildirimleri</Label>
          <Switch 
            id="emailNotifications" 
            checked={formData.email_notifications}
            onCheckedChange={(checked) => handleSwitchChange('email_notifications', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="lateNotifications">Geç Kalma Bildirimleri</Label>
          <Switch 
            id="lateNotifications" 
            checked={formData.late_notifications}
            onCheckedChange={(checked) => handleSwitchChange('late_notifications', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="reportNotifications">Rapor Bildirimleri</Label>
          <Switch 
            id="reportNotifications" 
            checked={formData.report_notifications}
            onCheckedChange={(checked) => handleSwitchChange('report_notifications', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="systemNotifications">Sistem Bildirimleri</Label>
          <Switch 
            id="systemNotifications" 
            checked={formData.system_notifications}
            onCheckedChange={(checked) => handleSwitchChange('system_notifications', checked)}
          />
        </div>
        
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </Button>
      </CardContent>
    </Card>
  );
}
