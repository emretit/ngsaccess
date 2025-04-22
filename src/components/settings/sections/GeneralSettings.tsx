
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function GeneralSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Şirket Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Şirket Adı</Label>
            <Input id="companyName" placeholder="Şirket adını girin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxNumber">Vergi Numarası</Label>
            <Input id="taxNumber" placeholder="Vergi numarasını girin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Şirket Adresi</Label>
            <Textarea id="address" placeholder="Şirket adresini girin" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sistem Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="language">Sistem Dili</Label>
            <Select defaultValue="tr">
              <SelectTrigger>
                <SelectValue placeholder="Dil seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tr">Türkçe</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timezone">Saat Dilimi</Label>
            <Select defaultValue="europe-istanbul">
              <SelectTrigger>
                <SelectValue placeholder="Saat dilimi seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="europe-istanbul">İstanbul (UTC+3)</SelectItem>
                <SelectItem value="europe-london">Londra (UTC+0)</SelectItem>
                <SelectItem value="america-newyork">New York (UTC-5)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateFormat">Tarih Formatı</Label>
            <Select defaultValue="DD.MM.YYYY">
              <SelectTrigger>
                <SelectValue placeholder="Tarih formatı seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD.MM.YYYY">DD.MM.YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="darkMode">Karanlık Mod</Label>
              <div className="text-sm text-muted-foreground">
                Sistem arayüzünü karanlık temada görüntüle
              </div>
            </div>
            <Switch id="darkMode" />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Sistem Bildirimleri</Label>
              <div className="text-sm text-muted-foreground">
                Önemli sistem bildirimlerini göster
              </div>
            </div>
            <Switch id="notifications" defaultChecked />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg">
          Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  );
}
