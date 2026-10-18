import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { VisitorCombobox } from "./VisitorCombobox";
import type { VisitorFormData } from "./hooks/useVisitorFormData";
import VisitorCardCapture from "./VisitorCardCapture";
import { formatVisitorTime } from "./visitorTime";
import type { Id } from "../../../convex/_generated/dataModel";
import { DateInput } from "@/components/ui/date-picker";

export default function VisitorFormFields({ formData, setFormData, presetRules, hostEmployees, isEditing, kvkkConsentAt, errors = {}, onNewZone }: {
  formData: VisitorFormData; setFormData: (data: VisitorFormData) => void;
  presetRules: { id: string; name: string }[]; hostEmployees: { id: string; name: string }[];
  isEditing: boolean; kvkkConsentAt?: string | null; errors?: Partial<Record<string, string>>; onNewZone: () => void;
}) {
  const change = <K extends keyof VisitorFormData>(field: K, value: VisitorFormData[K]) => setFormData({ ...formData, [field]: value });
  return <div className="min-w-0 space-y-5">
    <h3 className="text-base font-semibold">Ziyaretçi bilgileri</h3>
    <FormFieldWrapper htmlFor="v_first_name" label="Ad *" error={errors.firstName}><Input id="v_first_name" value={formData.firstName} onChange={e => change("firstName", e.target.value)} autoComplete="given-name" /></FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_last_name" label="Soyad *" error={errors.lastName}><Input id="v_last_name" value={formData.lastName} onChange={e => change("lastName", e.target.value)} autoComplete="family-name" /></FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_company" label="Şirket / kurum"><Input id="v_company" value={formData.visitorCompany} onChange={e => change("visitorCompany", e.target.value)} /></FormFieldWrapper>
    <h3 className="border-t pt-4 text-base font-semibold">Ziyaret</h3>
    <FormFieldWrapper htmlFor="v_host" label="Ziyaret edilen kişi"><VisitorCombobox id="v_host" label="Ziyaret edilen kişi" value={formData.hostEmployeeId} options={hostEmployees} allowClear onChange={value => change("hostEmployeeId", value as Id<"employees"> | null)} /></FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_purpose" label="Ziyaret amacı"><Input id="v_purpose" value={formData.visitPurpose} onChange={e => change("visitPurpose", e.target.value)} /></FormFieldWrapper>
    <h3 className="border-t pt-4 text-base font-semibold">Erişim</h3>
    <FormFieldWrapper htmlFor="v_zone" label="Ziyaretçi erişim bölgesi *" error={errors.presetRuleId} hint={isEditing ? "Mevcut ziyarette erişim bölgesi değiştirilemez. Farklı bölge için yeni ziyaret kaydı oluşturun." : "Kapı, gün ve saat izinleri seçilen erişim bölgesinden gelir."}>
      <VisitorCombobox id="v_zone" label="Ziyaretçi erişim bölgesi" value={formData.presetRuleId} options={presetRules} disabled={isEditing} error={errors.presetRuleId} onChange={value => change("presetRuleId", value as Id<"accessRules"> | null)} />
    </FormFieldWrapper>
    {!isEditing && <div className="space-y-1">{!presetRules.length && <p className="text-sm text-muted-foreground">Henüz ziyaretçi erişim bölgesi yok.</p>}<Button variant="outline" type="button" onClick={onNewZone}>Erişim bölgesi oluştur</Button></div>}
    <FormFieldWrapper htmlFor="v_expires" label="Geçerlilik bitişi *" error={errors.accessExpiresAt} hint="Türkiye saati. Sürenin dolması fiziksel çıkış kaydı oluşturmaz; cihaz işlemlerini proje senkronizasyon şeridinden izleyin.">{control => <div className="flex min-w-0 gap-2"><DateInput {...control} required className="min-w-0 flex-1" value={formData.accessExpiresAt.slice(0, 10)} onChange={date => change("accessExpiresAt", `${date}T${formData.accessExpiresAt.slice(11, 16) || "00:00"}`)} /><Input id={`${control.id}-time`} type="time" className="w-28 shrink-0" aria-label="Geçerlilik bitiş saati" aria-invalid={control["aria-invalid"]} value={formData.accessExpiresAt.slice(11, 16)} onChange={e => change("accessExpiresAt", `${formData.accessExpiresAt.slice(0, 10)}T${e.target.value}`)} /></div>}</FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_card" label="Kart numarası *" error={errors.cardNumber}><Input id="v_card" value={formData.cardNumber} onChange={e => change("cardNumber", e.target.value)} placeholder="Okuyucudan alın veya elle girin" /></FormFieldWrapper>
    <VisitorCardCapture currentCard={formData.cardNumber} onCapture={card => change("cardNumber", card)} />
    <div className="flex items-center gap-2"><Checkbox id="v_active" checked={formData.isActive} onCheckedChange={checked => change("isActive", checked === true)} /><Label htmlFor="v_active">Erişim izni ver</Label></div><p className="text-xs text-muted-foreground">Erişim geçerlilik bitişiyle sınırlıdır; süresi dolan kayıt aktif sayılmaz.</p>
    <details className="border-t pt-4"><summary className="cursor-pointer font-medium">Ek bilgiler</summary><div className="mt-4 space-y-4">
      <FormFieldWrapper htmlFor="v_phone" label="Telefon"><Input id="v_phone" type="tel" value={formData.visitorPhone} onChange={e => change("visitorPhone", e.target.value)} /></FormFieldWrapper>
      <FormFieldWrapper htmlFor="v_notes" label="Notlar"><Textarea id="v_notes" value={formData.notes} onChange={e => change("notes", e.target.value)} rows={3} /></FormFieldWrapper>
    </div></details>
    <div className="space-y-1 border-t pt-4"><div className="flex items-center gap-2"><Checkbox id="v_kvkk" checked={formData.kvkkConsent} disabled={!!kvkkConsentAt} onCheckedChange={checked => change("kvkkConsent", checked === true)} /><Label htmlFor="v_kvkk">KVKK rıza kaydı alındı</Label></div><p className="text-xs text-muted-foreground">{kvkkConsentAt ? `Kayıt tarihi: ${formatVisitorTime(kvkkConsentAt)}` : "Bu alan isteğe bağlıdır. Mevcut kayıt sistemine rıza bilgisi ekler."} Metin sürümü kaydedilmiyor.</p></div>
  </div>;
}
