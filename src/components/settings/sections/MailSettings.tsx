
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
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_secure: true,
    from_email: '',
    from_name: '',
    is_active: true
  });

  useEffect(() => {
    if (mailSettings) {
      setFormData({
        smtp_host: mailSettings.smtp_host || '',
        smtp_port: mailSettings.smtp_port || 587,
        smtp_username: mailSettings.smtp_username || '',
        smtp_password: mailSettings.smtp_password || '',
        smtp_secure: mailSettings.smtp_secure ?? true,
        from_email: mailSettings.from_email || '',
        from_name: mailSettings.from_name || '',
        is_active: mailSettings.is_active ?? true
      });
    }
  }, [mailSettings]);

  const handleSave = () => {
    saveMailSettings(formData);
    if (onComplete) {
      onComplete();
    }
  };

  const handleInputChange = (field: string, value: any) => {
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
              value={formData.smtp_host}
              onChange={(e) => handleInputChange('smtp_host', e.target.value)}
              placeholder="SMTP host adresini girin" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP Port</Label>
            <Input 
              id="smtpPort" 
              type="number" 
              value={formData.smtp_port}
              onChange={(e) => handleInputChange('smtp_port', parseInt(e.target.value))}
              placeholder="SMTP port numarasını girin" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtpUsername">SMTP Kullanıcı Adı</Label>
            <Input 
              id="smtpUsername" 
              value={formData.smtp_username}
              onChange={(e) => handleInputChange('smtp_username', e.target.value)}
              placeholder="SMTP kullanıcı adını girin" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtpPassword">SMTP Şifre</Label>
            <Input 
              id="smtpPassword" 
              type="password" 
              value={formData.smtp_password}
              onChange={(e) => handleInputChange('smtp_password', e.target.value)}
              placeholder="SMTP şifresini girin" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">Gönderen E-posta</Label>
            <Input 
              id="fromEmail" 
              type="email"
              value={formData.from_email}
              onChange={(e) => handleInputChange('from_email', e.target.value)}
              placeholder="Gönderen e-posta adresini girin" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromName">Gönderen Adı</Label>
            <Input 
              id="fromName" 
              value={formData.from_name}
              onChange={(e) => handleInputChange('from_name', e.target.value)}
              placeholder="Gönderen adını girin" 
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="smtpSecure">SSL/TLS Güvenlik</Label>
            <Switch 
              id="smtpSecure" 
              checked={formData.smtp_secure}
              onCheckedChange={(checked) => handleInputChange('smtp_secure', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Mail Gönderimi Aktif</Label>
            <Switch 
              id="isActive" 
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
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
