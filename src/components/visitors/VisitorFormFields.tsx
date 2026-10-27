import { Link } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { VisitorCollapsible } from "./VisitorCollapsible";
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

export default function VisitorFormFields({ formData, setFormData, presetRules, hostEmployees, hostSearch, onHostSearchChange, hostsLoading, isCurrentlyActive = false, isEditing, isPreRegistration = false, kvkkConsentAt, errors = {}, onNewZone }: {
  formData: VisitorFormData; setFormData: (data: VisitorFormData) => void;
  presetRules: { id: string; name: string; disabled?: boolean }[]; hostEmployees: { id: string; name: string }[];
  hostSearch?: string; onHostSearchChange?: (search: string) => void; hostsLoading?: boolean; isCurrentlyActive?: boolean;
  isEditing: boolean; isPreRegistration?: boolean; kvkkConsentAt?: string | null; errors?: Partial<Record<string, string>>; onNewZone: () => void;
}) {
  const { can } = usePermissions();
  const notice = useQuery(api.visitors.kvkkNotice, formData.projectId ? { projectId: formData.projectId } : "skip");
  const change = <K extends keyof VisitorFormData>(field: K, value: VisitorFormData[K]) => setFormData({ ...formData, [field]: value });
  return <div className="min-w-0 space-y-5 [&_[aria-invalid=true]]:border-destructive">
    <h3 className="text-base font-semibold">Erişim</h3>
    {isPreRegistration && <p className="rounded-md border bg-muted/40 p-3 text-sm">Bu ziyaretçi için henüz kart ve erişim bölgesi atanmamış. Bölge seçip teslim edeceğiniz kartı okutun veya numarasını girin. Erişimi başlatmak için “Erişim izni ver” seçeneğini işaretleyin.</p>}
    <FormFieldWrapper htmlFor="v_zone" label="Ziyaretçi erişim bölgesi *" error={errors.presetRuleId} hint={isEditing && !isPreRegistration ? "Mevcut ziyarette erişim bölgesi değiştirilemez. Farklı bölge için yeni ziyaret kaydı oluşturun." : "Kapı, gün ve saat izinleri seçilen erişim bölgesinden gelir."}>
      <VisitorCombobox id="v_zone" label="Ziyaretçi erişim bölgesi" value={formData.presetRuleId} options={presetRules} disabled={isEditing && !isPreRegistration} error={errors.presetRuleId} onChange={value => change("presetRuleId", value as Id<"accessRules"> | null)} />
    </FormFieldWrapper>
    {(!isEditing || isPreRegistration) && <div className="space-y-1">{!presetRules.length && <p className="text-sm text-muted-foreground">Henüz ziyaretçi erişim bölgesi yok.</p>}<Button variant="outline" type="button" onClick={onNewZone}>Erişim bölgesi oluştur</Button></div>}
    <FormFieldWrapper htmlFor="v_expires" label="Geçerlilik bitişi *" error={errors.accessExpiresAt} hint="Türkiye saati. Sürenin dolması fiziksel çıkış kaydı oluşturmaz; cihaz işlemlerini proje senkronizasyon şeridinden izleyin.">{control => <div className="flex min-w-0 gap-2"><DateInput {...control} required className="min-w-0 flex-1" value={formData.accessExpiresAt.slice(0, 10)} onChange={date => change("accessExpiresAt", `${date}T${formData.accessExpiresAt.slice(11, 16) || "00:00"}`)} /><Input id={`${control.id}-time`} type="time" className="w-28 shrink-0" aria-label="Geçerlilik bitiş saati" aria-invalid={control["aria-invalid"]} value={formData.accessExpiresAt.slice(11, 16)} onChange={e => change("accessExpiresAt", `${formData.accessExpiresAt.slice(0, 10)}T${e.target.value}`)} /></div>}</FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_card" label="Kart numarası *" error={errors.cardNumber}><Input id="v_card" value={formData.cardNumber} onChange={e => change("cardNumber", e.target.value)} placeholder="Okuyucudan alın veya elle girin" /></FormFieldWrapper>
    <VisitorCardCapture currentCard={formData.cardNumber} onCapture={card => change("cardNumber", card)} />
    {isCurrentlyActive ? <p className="text-sm text-muted-foreground">Erişimi kapatmak için ayrıntıdaki 'Ziyareti sonlandır'ı kullanın.</p> : <div className="flex items-center gap-2"><Checkbox id="v_active" checked={formData.isActive} onCheckedChange={checked => change("isActive", checked === true)} /><Label htmlFor="v_active">Erişim izni ver</Label></div>}<p className="text-xs text-muted-foreground">Erişim geçerlilik bitişiyle sınırlıdır; süresi dolan kayıt aktif sayılmaz.</p>
    <h3 className="text-base font-semibold">Ziyaretçi bilgileri</h3>
    <div className="grid gap-4 min-[761px]:grid-cols-2"><FormFieldWrapper htmlFor="v_first_name" label="Ad *" error={errors.firstName}><Input id="v_first_name" value={formData.firstName} onChange={e => change("firstName", e.target.value)} autoComplete="given-name" /></FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_last_name" label="Soyad *" error={errors.lastName}><Input id="v_last_name" value={formData.lastName} onChange={e => change("lastName", e.target.value)} autoComplete="family-name" /></FormFieldWrapper></div>
    <FormFieldWrapper htmlFor="v_company" label="Şirket / kurum"><Input id="v_company" value={formData.visitorCompany} onChange={e => change("visitorCompany", e.target.value)} /></FormFieldWrapper>
    <h3 className="border-t pt-4 text-base font-semibold">Ziyaret</h3>
    <FormFieldWrapper htmlFor="v_host" label="Ziyaret edilen kişi"><VisitorCombobox id="v_host" label="Ziyaret edilen kişi" value={formData.hostEmployeeId} options={hostEmployees} search={hostSearch} onSearchChange={onHostSearchChange} loading={hostsLoading} allowClear onChange={value => change("hostEmployeeId", value as Id<"employees"> | null)} /></FormFieldWrapper>
    <FormFieldWrapper htmlFor="v_purpose" label="Ziyaret amacı"><Input id="v_purpose" value={formData.visitPurpose} onChange={e => change("visitPurpose", e.target.value)} /></FormFieldWrapper>
    <VisitorCollapsible title="Ek bilgiler">
      <FormFieldWrapper htmlFor="v_phone" label="Telefon"><Input id="v_phone" type="tel" value={formData.visitorPhone} onChange={e => change("visitorPhone", e.target.value)} /></FormFieldWrapper>
      <FormFieldWrapper htmlFor="v_notes" label="Notlar"><Textarea id="v_notes" value={formData.notes} onChange={e => change("notes", e.target.value)} rows={3} /></FormFieldWrapper>
    </VisitorCollapsible>
    <div className="space-y-1 border-t pt-4"><div className="flex items-center gap-2"><Checkbox id="v_kvkk" checked={!!kvkkConsentAt || (formData.kvkkConsent && formData.kvkkDocumentVersion === notice?.version)} disabled={!!kvkkConsentAt || !notice?.version || !notice?.url} onCheckedChange={checked => setFormData({ ...formData, kvkkConsent: checked === true, kvkkDocumentVersion: checked === true ? notice?.version ?? undefined : undefined })} /><Label htmlFor="v_kvkk">KVKK rıza kaydı alındı</Label></div><p className="text-xs text-muted-foreground">{kvkkConsentAt ? `Kayıt tarihi: ${formatVisitorTime(kvkkConsentAt)}` : "Ziyaretçi aydınlatma metnini onayladıysa işaretleyin."}</p>{notice?.url && notice.version ? <a className="text-sm underline" href={notice.url} target="_blank" rel="noopener noreferrer">Aydınlatma metni · Sürüm {notice.version}</a> : <div className="space-y-1"><p className="text-xs text-muted-foreground">Aydınlatma metni tanımlı değil.</p>{can("admin.manage") && <Link className="text-sm underline" to="/settings?tab=privacy" target="_blank" rel="noopener noreferrer">Ayarlar › Gizlilik’te aydınlatma metni tanımlayın</Link>}</div>}</div>
  </div>;
}
