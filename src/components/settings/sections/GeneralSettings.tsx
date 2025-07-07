
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dark mode toggle function
  const toggleDarkMode = (enabled: boolean) => {
    setIsDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Update the form checkbox
    const darkModeCheckbox = document.querySelector('[name="darkMode"]') as HTMLInputElement;
    if (darkModeCheckbox) {
      darkModeCheckbox.checked = enabled;
    }
  };

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
      const { data, error } = await supabase
        .from('general_settings')
        .upsert(settingsData, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      
      // Apply dark mode setting immediately
      toggleDarkMode(settingsData.dark_mode || false);

      toast({
        title: "✅ Ayarlar güncellendi",
        description: "Tüm değişiklikler başarıyla kaydedildi.",
      });
    } catch (error) {
      console.error('Settings save error:', error);
      toast({
        title: "❌ Hata",
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
        .limit(1)
        .single();

      if (error) {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
        
        // Apply dark mode setting immediately when loaded
        const darkModeEnabled = data.dark_mode || false;
        setIsDarkMode(darkModeEnabled);
        toggleDarkMode(darkModeEnabled);
        
        // Set form values directly using controlled components
        setTimeout(() => {
          const form = document.querySelector('form') as HTMLFormElement;
          if (form) {
            // Company info
            (form.elements.namedItem('companyName') as HTMLInputElement).value = data.company_name || '';
            (form.elements.namedItem('taxNumber') as HTMLInputElement).value = data.tax_number || '';
            (form.elements.namedItem('address') as HTMLTextAreaElement).value = data.address || '';
            (form.elements.namedItem('email') as HTMLInputElement).value = data.email || '';
            (form.elements.namedItem('phone') as HTMLInputElement).value = data.phone || '';
            (form.elements.namedItem('website') as HTMLInputElement).value = data.website || '';
            
            // System settings
            (form.elements.namedItem('workingHoursStart') as HTMLInputElement).value = data.working_hours_start || '09:00';
            (form.elements.namedItem('workingHoursEnd') as HTMLInputElement).value = data.working_hours_end || '18:00';
          }
        }, 100);
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
                type="url" 
                placeholder="https://www.sirket.com"
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
              <Select name="language" defaultValue={settings?.system_language || "tr"}>
                <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Dil seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Saat Dilimi</Label>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Select name="timezone" defaultValue={settings?.timezone || "Europe/Istanbul"}>
                  <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Saat dilimi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Istanbul">🇹🇷 İstanbul (UTC+3)</SelectItem>
                    <SelectItem value="Europe/London">🇬🇧 Londra (UTC+0)</SelectItem>
                    <SelectItem value="America/New_York">🇺🇸 New York (UTC-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">Tarih Formatı</Label>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select name="dateFormat" defaultValue={settings?.date_format || "DD.MM.YYYY"}>
                  <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Tarih formatı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD.MM.YYYY">📅 DD.MM.YYYY (07.01.2025)</SelectItem>
                    <SelectItem value="MM/DD/YYYY">📅 MM/DD/YYYY (01/07/2025)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">📅 YYYY-MM-DD (2025-01-07)</SelectItem>
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
                  defaultValue={settings?.working_hours_start || "09:00"}
                  className="focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-muted-foreground font-medium">-</span>
                <Input
                  id="workingHoursEnd"
                  name="workingHoursEnd"
                  type="time"
                  defaultValue={settings?.working_hours_end || "18:00"}
                  className="focus:ring-2 focus:ring-primary/20"
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
              <Switch 
                id="darkMode" 
                name="darkMode" 
                checked={isDarkMode}
                onCheckedChange={toggleDarkMode}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Sistem Bildirimleri</Label>
                <div className="text-sm text-muted-foreground">
                  Önemli sistem bildirimlerini göster
                </div>
              </div>
              <Switch 
                id="notifications" 
                name="notifications" 
                checked={settings?.notifications_enabled || true}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4 border-t">
        <Button 
          type="submit" 
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 font-semibold"
        >
          💾 Değişiklikleri Kaydet
        </Button>
      </div>
    </form>
  );
}
