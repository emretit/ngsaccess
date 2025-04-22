
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function GeneralSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Genel Ayarlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName">Şirket Adı</Label>
          <Input id="companyName" placeholder="Şirket adını girin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminEmail">Yönetici E-posta</Label>
          <Input id="adminEmail" type="email" placeholder="yonetici@sirket.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Saat Dilimi</Label>
          <Input id="timezone" defaultValue="Europe/Istanbul" />
        </div>
        <Button>Değişiklikleri Kaydet</Button>
      </CardContent>
    </Card>
  );
}
