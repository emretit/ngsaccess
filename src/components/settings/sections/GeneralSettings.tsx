
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Globe, Mail, Phone, Building2, CreditCard, Calendar, Sun } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Create a settings interface that matches our database schema
interface GeneralSettings {
  id?: string;
  company_name: string;
  tax_number?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  system_language?: string;
  timezone?: string;
  date_format?: string;
  currency?: string;
  dark_mode?: boolean;
  notifications_enabled?: boolean;
  working_hours_start?: string;
  working_hours_end?: string;
}

export function GeneralSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GeneralSettings | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Convert FormData values to appropriate types for our schema
    const settingsData: GeneralSettings = {
      company_name: formData.get('companyName') as string,
      tax_number: formData.get('taxNumber') as string,
      address: formData.get('address') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      website: formData.get('website') as string,
      system_language: formData.get('language') as string,
      timezone: formData.get('timezone') as string,
      date_format: formData.get('dateFormat') as string,
      currency: formData.get('currency') as string,
      dark_mode: formData.get('darkMode') === 'on',
      notifications_enabled: formData.get('notifications') === 'on',
      working_hours_start: formData.get('workingHoursStart') as string,
      working_hours_end: formData.get('workingHoursEnd') as string,
    };

    try {
      const { error } = await supabase
        .from('general_settings')
        .upsert(settingsData);

      if (error) throw error;

      toast({
        title: "Ayarlar güncellendi",
        description: "Tüm değişiklikler başarıyla kaydedildi.",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Ayarlar güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from('general_settings')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
        
        // Map database fields to form fields
        const formElements = {
          companyName: data.company_name,
          taxNumber: data.tax_number || '',
          address: data.address || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          language: data.system_language || 'tr',
          timezone: data.timezone || 'Europe/Istanbul',
          dateFormat: data.date_format || 'DD.MM.YYYY',
          currency: data.currency || 'TRY',
          darkMode: data.dark_mode || false,
          notifications: data.notifications_enabled || false,
          workingHoursStart: data.working_hours_start || '09:00',
          workingHoursEnd: data.working_hours_end || '18:00',
        };

        // Set form values
        Object.entries(formElements).forEach(([key, value]) => {
          const element = document.querySelector(`[name="${key}"]`) as HTMLInputElement | null;
          if (element) {
            if (typeof value === 'boolean') {
              element.checked = value;
            } else if (value !== null && value !== undefined) {
              element.value = String(value);
            }
          }
        });
      }
    };

    loadSettings();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="companyName">Şirket Adı</Label>
              <Input id="companyName" name="companyName" placeholder="Şirket adını girin" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNumber">Vergi Numarası</Label>
              <Input id="taxNumber" name="taxNumber" placeholder="Vergi numarasını girin" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Şirket Adresi</Label>
              <Textarea id="address" name="address" placeholder="Şirket adresini girin" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta Adresi</Label>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Input id="email" name="email" type="email" placeholder="ornek@sirket.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon Numarası</Label>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <Input id="phone" name="phone" type="tel" placeholder="+90" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Web Sitesi</Label>
              <Input id="website" name="website" type="url" placeholder="https://www.sirket.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Para Birimi</Label>
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <Select name="currency" defaultValue="TRY">
                  <SelectTrigger>
                    <SelectValue placeholder="Para birimi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">Türk Lirası (₺)</SelectItem>
                    <SelectItem value="USD">US Dollar ($)</SelectItem>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Sistem Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="language">Sistem Dili</Label>
              <Select name="language" defaultValue="tr">
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
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Select name="timezone" defaultValue="Europe/Istanbul">
                  <SelectTrigger>
                    <SelectValue placeholder="Saat dilimi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Istanbul">İstanbul (UTC+3)</SelectItem>
                    <SelectItem value="Europe/London">Londra (UTC+0)</SelectItem>
                    <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">Tarih Formatı</Label>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select name="dateFormat" defaultValue="DD.MM.YYYY">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="workingHoursStart">Çalışma Saatleri</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="workingHoursStart"
                  name="workingHoursStart"
                  type="time"
                  defaultValue="09:00"
                />
                <span>-</span>
                <Input
                  id="workingHoursEnd"
                  name="workingHoursEnd"
                  type="time"
                  defaultValue="18:00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="darkMode">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Karanlık Mod
                  </div>
                </Label>
                <div className="text-sm text-muted-foreground">
                  Sistem arayüzünü karanlık temada görüntüle
                </div>
              </div>
              <Switch id="darkMode" name="darkMode" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Sistem Bildirimleri</Label>
                <div className="text-sm text-muted-foreground">
                  Önemli sistem bildirimlerini göster
                </div>
              </div>
              <Switch id="notifications" name="notifications" defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Değişiklikleri Kaydet
        </Button>
      </div>
    </form>
  );
}
