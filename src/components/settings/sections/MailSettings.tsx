import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MailSettingsProps {
  onComplete?: () => void;
}

export function MailSettings({ onComplete }: MailSettingsProps) {
  const handleSave = () => {
    // Simulate save operation
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mail Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP Host</Label>
            <Input id="smtpHost" placeholder="SMTP host adresini girin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP Port</Label>
            <Input id="smtpPort" type="number" placeholder="SMTP port numarasını girin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpUsername">SMTP Kullanıcı Adı</Label>
            <Input id="smtpUsername" placeholder="SMTP kullanıcı adını girin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPassword">SMTP Şifre</Label>
            <Input id="smtpPassword" type="password" placeholder="SMTP şifresini girin" />
          </div>
        </CardContent>
      </Card>
      <Button onClick={handleSave}>Değişiklikleri Kaydet</Button>
    </div>
  );
}
