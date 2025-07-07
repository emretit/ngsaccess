import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Mail, Phone, CreditCard } from "lucide-react";
import { GeneralSettings } from "../types/generalSettings";

interface CompanyInfoFormProps {
  settings: GeneralSettings | null;
}

export const CompanyInfoForm = ({ settings }: CompanyInfoFormProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Şirket Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Şirket Adı *</Label>
            <Input 
              id="companyName" 
              name="companyName" 
              placeholder="Şirket adını girin" 
              defaultValue={settings?.company_name || ''}
              required 
              className="focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxNumber">Vergi Numarası</Label>
            <Input 
              id="taxNumber" 
              name="taxNumber" 
              placeholder="Vergi numarasını girin"
              defaultValue={settings?.tax_number || ''}
              className="focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Şirket Adresi</Label>
            <Textarea 
              id="address" 
              name="address" 
              placeholder="Şirket adresini girin"
              defaultValue={settings?.address || ''}
              className="focus:ring-2 focus:ring-primary/20 min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta Adresi</Label>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="ornek@sirket.com"
                defaultValue={settings?.email || ''}
                className="focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon Numarası</Label>
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <Input 
                id="phone" 
                name="phone" 
                type="tel" 
                placeholder="+90 (555) 123 45 67"
                defaultValue={settings?.phone || ''}
                className="focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Web Sitesi</Label>
            <Input 
              id="website" 
              name="website" 
              type="text" 
              placeholder="www.sirket.com veya https://www.sirket.com"
              defaultValue={settings?.website || ''}
              className="focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Para Birimi</Label>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <Select name="currency" defaultValue={settings?.currency || "TRY"}>
                <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Para birimi seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">🇹🇷 Türk Lirası (₺)</SelectItem>
                  <SelectItem value="USD">🇺🇸 US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">🇪🇺 Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};