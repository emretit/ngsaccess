
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MailSettings {
  smtp_server: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  sender_email: string;
  ssl_enabled: boolean;
}

export function MailSettings() {
  const [settings, setSettings] = useState<MailSettings>({
    smtp_server: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    sender_email: '',
    ssl_enabled: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('general_settings')
        .select('*')
        .single();

      if (data && !error) {
        // Mail ayarları general_settings tablosunda JSON olarak saklanabilir
        const mailSettings = data.mail_settings || {};
        setSettings({
          smtp_server: mailSettings.smtp_server || '',
          smtp_port: mailSettings.smtp_port || '587',
          smtp_username: mailSettings.smtp_username || '',
          smtp_password: mailSettings.smtp_password || '',
          sender_email: mailSettings.sender_email || '',
          ssl_enabled: mailSettings.ssl_enabled !== false
        });
      }
    } catch (error) {
      console.error('Mail ayarları yüklenirken hata:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('general_settings')
        .upsert({
          mail_settings: settings
        });

      if (error) throw error;

      toast({
        title: "Mail ayarları kaydedildi",
        description: "Mail ayarları başarıyla güncellendi"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Mail ayarları kaydedilirken hata oluştu"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof MailSettings, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mail Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp_server">SMTP Sunucusu</Label>
            <Input 
              id="smtp_server" 
              placeholder="smtp.example.com" 
              value={settings.smtp_server}
              onChange={(e) => handleInputChange('smtp_server', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtp_port">SMTP Port</Label>
            <Input 
              id="smtp_port" 
              placeholder="587" 
              type="number" 
              value={settings.smtp_port}
              onChange={(e) => handleInputChange('smtp_port', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtp_username">SMTP Kullanıcı Adı</Label>
            <Input 
              id="smtp_username" 
              placeholder="email@example.com" 
              value={settings.smtp_username}
              onChange={(e) => handleInputChange('smtp_username', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtp_password">SMTP Şifre</Label>
            <Input 
              id="smtp_password" 
              type="password" 
              value={settings.smtp_password}
              onChange={(e) => handleInputChange('smtp_password', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender_email">Gönderen E-posta</Label>
            <Input 
              id="sender_email" 
              placeholder="noreply@sirketiniz.com" 
              value={settings.sender_email}
              onChange={(e) => handleInputChange('sender_email', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between space-y-2">
            <Label htmlFor="ssl">SSL Kullan</Label>
            <Switch 
              id="ssl" 
              checked={settings.ssl_enabled}
              onCheckedChange={(checked) => handleInputChange('ssl_enabled', checked)}
            />
          </div>

          <Button 
            className="mt-4" 
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
