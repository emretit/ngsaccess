import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMailSettings } from "@/hooks/useMailSettings";
import { useState, useEffect } from "react";

interface MailSettingsProps {
  onComplete?: () => void;
}

export function MailSettings({ onComplete }: MailSettingsProps) {
  const { mailSettings, isLoading, saveMailSettings, isSaving } = useMailSettings();
  
  const [formData, setFormData] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpSecure: true,
    fromEmail: '',
    fromName: '',
    isActive: true
  });

  useEffect(() => {
    if (mailSettings) {
      setFormData({
        smtpHost: mailSettings.smtpHost || '',
        smtpPort: mailSettings.smtpPort || 587,
        smtpUsername: mailSettings.smtpUsername || '',
        smtpPassword: mailSettings.smtpPassword || '',
        smtpSecure: mailSettings.smtpSecure ?? true,
        fromEmail: mailSettings.fromEmail || '',
        fromName: mailSettings.fromName || '',
        isActive: mailSettings.isActive ?? true
      });
    }
  }, [mailSettings]);

  const handleSave = () => {
    saveMailSettings(formData);
    if (onComplete) {
      onComplete();
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mail Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP Host</Label>
            <Input 
              id="smtpHost" 
              value={formData.smtpHost}
              onChange={(e) => handleInputChange('smtpHost', e.target.value)}
              placeholder="SMTP host adresini girin" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP Port</Label>
            <Input 
              id="smtpPort" 
              type="number" 
              value={formData.smtpPort}
              onChange={(e) => handleInputChange('smtpPort', parseInt(e.target.value))}
              placeholder="SMTP port numarasını girin" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtpUsername">SMTP Kullanıcı Adı</Label>
            <Input 
              id="smtpUsername" 
              value={formData.smtpUsername}
              onChange={(e) => handleInputChange('smtpUsername', e.target.value)}
              placeholder="SMTP kullanıcı adını girin" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtpPassword">SMTP Şifre</Label>
            <Input 
              id="smtpPassword" 
              type="password" 
              value={formData.smtpPassword}
              onChange={(e) => handleInputChange('smtpPassword', e.target.value)}
              placeholder="SMTP şifresini girin" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">Gönderen E-posta</Label>
            <Input 
              id="fromEmail" 
              type="email"
              value={formData.fromEmail}
              onChange={(e) => handleInputChange('fromEmail', e.target.value)}
              placeholder="Gönderen e-posta adresini girin" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromName">Gönderen Adı</Label>
            <Input 
              id="fromName" 
              value={formData.fromName}
              onChange={(e) => handleInputChange('fromName', e.target.value)}
              placeholder="Gönderen adını girin" 
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="smtpSecure">SSL/TLS Güvenlik</Label>
            <Switch 
              id="smtpSecure" 
              checked={formData.smtpSecure}
              onCheckedChange={(checked) => handleInputChange('smtpSecure', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Mail Gönderimi Aktif</Label>
            <Switch 
              id="isActive" 
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange('isActive', checked)}
            />
          </div>
        </CardContent>
      </Card>
      
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
      </Button>
    </div>
  );
}
