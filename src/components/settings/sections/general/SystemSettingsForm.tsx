import { Link } from "react-router-dom";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Switch } from "@/components/ui/switch";
import type { GeneralValues } from "./generalForm";

export function SystemSettingsForm({ values, change }: { values: GeneralValues; change: (fields: Partial<GeneralValues>) => void }) {
  return <section className="space-y-4 border-t pt-6">
    <h3 className="text-base font-semibold">Sistem tercihleri</h3>
    <p className="text-sm text-muted-foreground">Arayüz Türkçe, işlem zamanı İstanbul’dur. Çalışma saatleri ve atamalar Vardiyalar sayfasında yönetilir.</p>
    <FormFieldWrapper htmlFor="darkMode" label="Karanlık mod · Proje varsayılanı" hint="Tema değişikliği bu ekranda önizlenir; Kaydet ile proje varsayılanına yazılır.">
      <Switch name="darkMode" checked={values.darkMode} onCheckedChange={darkMode => change({ darkMode })} />
    </FormFieldWrapper>
    <FormFieldWrapper htmlFor="notifications" label="Genel sistem bildirimleri" hint="Bu kayıt Bildirimler bölümündeki tercihlerden ayrıdır; gönderim testi değildir.">
      <Switch name="notifications" checked={values.notifications} onCheckedChange={notifications => change({ notifications })} />
    </FormFieldWrapper>
    <div className="flex flex-wrap gap-4 text-sm"><Link className="underline" to="/shifts">Vardiyaları aç</Link><Link className="underline" to="/profile">Profilimi aç</Link></div>
  </section>;
}
