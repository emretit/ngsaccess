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
    emailNotifications: true,
    lateNotifications: true,
    reportNotifications: true,
    systemNotifications: true
  });

  useEffect(() => {
    if (notificationSettings) {
      setFormData({
        emailNotifications: notificationSettings.emailNotifications ?? true,
        lateNotifications: notificationSettings.lateNotifications ?? true,
        reportNotifications: notificationSettings.reportNotifications ?? true,
        systemNotifications: notificationSettings.systemNotifications ?? true
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
            checked={formData.emailNotifications}
            onCheckedChange={(checked) => handleSwitchChange('emailNotifications', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="lateNotifications">Geç Kalma Bildirimleri</Label>
          <Switch 
            id="lateNotifications" 
            checked={formData.lateNotifications}
            onCheckedChange={(checked) => handleSwitchChange('lateNotifications', checked)}
          />
        </div>
        
        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="reportNotifications">Rapor Bildirimleri</Label>
          <Switch 
            id="reportNotifications" 
            checked={formData.reportNotifications}
            onCheckedChange={(checked) => handleSwitchChange('reportNotifications', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-y-2">
          <Label htmlFor="systemNotifications">Sistem Bildirimleri</Label>
          <Switch 
            id="systemNotifications" 
            checked={formData.systemNotifications}
            onCheckedChange={(checked) => handleSwitchChange('systemNotifications', checked)}
          />
        </div>
        
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </Button>
      </CardContent>
    </Card>
  );
}
