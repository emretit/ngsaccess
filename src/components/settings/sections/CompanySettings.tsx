
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CompanySettings() {
  return (
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
          <Label htmlFor="companyAddress">Şirket Adresi</Label>
          <Textarea 
            id="companyAddress" 
            placeholder="Şirket adresini girin"
            className="min-h-[100px]" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxNumber">Vergi Numarası</Label>
          <Input id="taxNumber" placeholder="Vergi numarasını girin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" type="tel" placeholder="+90" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" placeholder="info@sirket.com" />
        </div>
        <Button type="submit" className="w-full">Değişiklikleri Kaydet</Button>
      </CardContent>
    </Card>
  );
}
