import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Globe, Calendar, Sun } from "lucide-react";
import { GeneralSettings } from "../types/generalSettings";

interface SystemSettingsFormProps {
  settings: GeneralSettings | null;
  isDarkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
}

export const SystemSettingsForm = ({ settings, isDarkMode, onDarkModeChange }: SystemSettingsFormProps) => {
  return (
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
              onCheckedChange={onDarkModeChange}
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
              defaultChecked={settings?.notifications_enabled || true}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};