
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function MailSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mail Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtp_server">SMTP Sunucusu</Label>
            <Input id="smtp_server" placeholder="smtp.example.com" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtp_port">SMTP Port</Label>
            <Input id="smtp_port" placeholder="587" type="number" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtp_username">SMTP Kullanıcı Adı</Label>
            <Input id="smtp_username" placeholder="email@example.com" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smtp_password">SMTP Şifre</Label>
            <Input id="smtp_password" type="password" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender_email">Gönderen E-posta</Label>
            <Input id="sender_email" placeholder="noreply@sirketiniz.com" />
          </div>

          <div className="flex items-center justify-between space-y-2">
            <Label htmlFor="ssl">SSL Kullan</Label>
            <Switch id="ssl" />
          </div>

          <Button className="mt-4">Ayarları Kaydet</Button>
        </div>
      </CardContent>
    </Card>
  );
}
