B keşfi: 12 ortaklaştırma adayı; 8 P1, 4 P2; 4 atlanan mevcut yapı, 8 yeni aday.
En hızlı kazanım: mevcut useAsyncAction, FormActions ve FormFieldWrapper kullanımını yaygınlaştırmak.
P1: mutation davranışı, form footer’ı, alan sarmalayıcı, form dialog’u, ayrıntı sheet’i, alan-değer listesi, form hatası, yıkıcı onay.
Kaynak kod değiştirilmedi; tek çıktı bu rapordur; bulgular statik okuma ve rg ile doğrulandı.
shifts referansı değişiyor; sayılar aşağıdaki doğrulanmış dosyalarla sınırlıdır, repo genelinde tahmin değildir.

# Ortak bileşen keşfi B — formlar ve ayrıntı panelleri

27 Ekim 2026 · K3 / salt okuma. Konumlar repo köküne göredir. “Adet”, aksi belirtilmedikçe farklı kaynak dosyası sayısıdır; aynı dosyadaki çoklu alanları şişirmez. Yeni adayların her biri en az üç farklı modülde doğrulandı. Mevcut yapının atlanması için en az üç dosya şartı uygulandı; B08 iki modüldeki üç dosyadır. Süreler istenen kaba uygulama tahminleridir; kanıt sayısı veya yapılmış iş değildir. Etkiler aday bazındadır, aynı dosya birden fazla adayda geçtiğinden toplanmamalıdır.

## P1 · B01 — useAsyncAction · atlanan

**Tekrar / fark:** pending state → try/await → başarı/hata bildirimi → finally zinciri elle yazılıyor. Mevcut `src/hooks/useAsyncAction.ts:11` ref tabanlı eşzamanlı çağrı kilidi ve bildirimleri zaten sağlıyor; özellikle LeaveRequestsPanel hata durumunda da `finally` içinde dialog’u kapatırken CorrectionRequestsPanel yalnız başarıda kapatıyor.

**Yerler — 6 dosya / 5 modül:**
- `src/components/employees/EmployeeConsentsCard.tsx:87` — rıza kaydı, pending ve notify.
- `src/components/leaves/LeaveRequestsPanel.tsx:54` — hata sonrası `finally` içinde `setDecision(null)` (66).
- `src/components/pdks/CorrectionRequestsPanel.tsx:55` — başarıda `setDecision(null)` (64), hata sonrası açık kalıyor.
- `src/components/admin/components/AccountAccessActions.tsx:37` — erişim değişikliği.
- `src/components/admin/ProjectMembersContent.tsx:21` — proje rolü değişikliği.
- `src/components/settings/sections/RolesSettings.tsx:23` — rol yetkisi değişikliği.

**API — mevcut imza korunur:**
```ts
function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown>,
  options?: { success?: string; error?: string },
): { run: (...args: Args) => Promise<boolean>; pending: boolean };
```
**Etki:** 6 tüketici dosya; hook değişmeden kullanılabilir. **Risk:** orta; optimistic update ve form taslağı korunmalı, kapanış yalnız başarılı `run()` sonrasında yapılmalı, iç catch hatayı yutmamalı. **Süre:** 2–3 saat. Başarı bildirimleri callback içinde kalırsa ayrıca `success` verilip çift toast üretilmemeli.

## P1 · B02 — FormActions → shared/FormActions · atlanan

**Tekrar / fark:** iptal + submit, pending metni, disabled ve footer yerleşimi tekrar ediyor. Mevcut `src/components/employees/FormActions.tsx:13` zaten `EmployeeForm.tsx:243` ve `devices/DeviceForm.tsx:336` tarafından kullanılıyor; ziyaretçi footer’ı gap-2/p-4/bg-surface, mevcut yardımcı gap-3/px-5/py-3/bg-background, manuel PDKS iptali ghost, diğerleri outline.

**Elle yazılan yerler — 8 dosya / 7 modül:**
- `src/components/visitors/VisitorForm.tsx:48`
- `src/components/visitors/VisitorZoneDialog.tsx:115`
- `src/components/leaves/LeaveForm.tsx:397`
- `src/components/pdks/ManualPdksEditDialog.tsx:205`
- `src/components/admin/projects/ProjectEditor.tsx:151`
- `src/components/access-control/AddZoneDialog.tsx:47`
- `src/components/departments/AddDepartmentDialog.tsx:89`
- `src/components/devices/AssignLocationForm.tsx:149`

**API — mevcut yardımcı genişletilir, ikinci footer bileşeni oluşturulmaz:**
```ts
type FormActionsProps = {
  pending: boolean; submitLabel?: string; pendingLabel?: string;
  cancelLabel?: string; onCancel: () => void; submitDisabled?: boolean;
  layout?: "dialog" | "sticky" | "inline"; extraActions?: React.ReactNode;
};
```
**Etki:** 8 yeni tüketici + mevcut yardımcı ve 2 mevcut import = 11 mevcut dosya. **Risk:** düşük/orta; ziyaretçi etkinleştirme metni ve izin çakışmasındaki submitDisabled korunmalı. **Süre:** 2–3 saat. `DialogFooter` yerleşimi layout içinde kalabilir; iş akışı buton metinlerine gömülmemeli.

## P1 · B03 — FormFieldWrapper · atlanan

**Tekrar / fark:** Label + kontrol + hint/error + aria-describedby eşleştirmesi elle kuruluyor. Shared bileşenin `src/components/shared/FormFieldWrapper.tsx:20` render-slot desteği SelectTrigger gibi iç kontrolleri de kapsıyor; profil alan hatası text-sm, kural alan hatası text-xs/text-danger, ortak FieldError text-xs/text-destructive (54).

**Yerler — 5 dosya / 4 modül:**
- `src/components/employees/EmployeeFormFields.tsx:84` — yerel describedBy ve alan renderer’ı; FieldError kullanılıyor, tam wrapper atlanmış.
- `src/components/devices/AssignLocationForm.tsx:105` — bölge; kapı alanı 127, manuel hata 124/146.
- `src/components/devices/ClaimDeviceDialog.tsx:178` — proje ve devamındaki cihaz/kimlik alanları; hata 196/234/254/264.
- `src/components/profile/ProfileForm.tsx:72` — ad soyad; manuel hata 86.
- `src/components/access-control/unified/components/RuleBasicInfo.tsx:24` — ad ve açıklama.

**API — mevcut:**
```ts
type Props = {
  htmlFor: string; label: string; error?: string; hint?: string;
  inline?: boolean; className?: string;
  children: React.ReactNode | ((control: FieldControlProps) => React.ReactNode);
};
```
**Etki:** 5 tüketici dosya. **Risk:** düşük/orta; mevcut alan id/name, ref ve RHF bağları korunmalı; Select için render-slot kullanılmalı. **Süre:** 2–3 saat. RHF FormItem/FormMessage kullanan bütün cihaz alanları sırf farklı API kullandıkları için bu sayıya dahil edilmedi.

## P1 · B04 — FormDialog · yeni

**Tekrar / fark:** kontrollü Dialog + başlık/açıklama + form/fieldset + footer + pending sırasında kapanış denetimi aynı işi tekrar ediyor. Bölge ve ziyaretçi dialog’ları 90dvh scroll sınırı kullanırken departman yalnız genişlik belirtiyor; PDKS viewport kenar boşluğunu calc ile koruyor. Başlık açıklaması AddZone’da yok, diğer örneklerde var; API açıklamayı opsiyonel tutmalı.

**Yerler — 6 dosya / 6 modül:**
- `src/components/access-control/AddZoneDialog.tsx:38`
- `src/components/departments/AddDepartmentDialog.tsx:51`
- `src/components/admin/projects/ProjectEditor.tsx:76`
- `src/components/visitors/VisitorZoneDialog.tsx:87`
- `src/components/pdks/ManualPdksEditDialog.tsx:87`
- `src/components/devices/AssignLocationForm.tsx:97`

**API:**
```ts
type FormDialogProps = {
  open: boolean; onRequestClose: () => void; pending: boolean;
  title: string; description?: React.ReactNode; size?: "sm" | "md" | "lg";
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode; footer: React.ReactNode; returnFocus?: React.RefObject<HTMLElement | null>;
};
```
**Etki:** 6 tüketici + 1 yeni dosya. **Risk:** orta; Escape/dış tıklama, autofocus, pending ve mevcut dirty guard akışı korunmalı. **Süre:** 3–5 saat. B02 footer’ı slot olarak tüketir; bu bileşen veri sorgulamaz, validasyon veya mutation çalıştırmaz. LeaveForm’un mobil Sheet/masaüstü Dialog ayrımı bu ilk geçişe dahil değildir (`LeaveForm.tsx:418`).

## P1 · B05 — DetailSheet · yeni

**Tekrar / fark:** Sheet open/onClose, SheetHeader/Title/Description, taşan gövde ve dönüş odağı her modülde yeniden kuruluyor. Employee/Device başlığı sabit tutulan p-0/gap-0 gövde düzeni kullanırken audit/leaves/PDKS tüm Sheet’i kaydırıyor; ziyaretçi başlığı p-5, cihaz ve personel başlığı px-5/py-3. Genişlik farkı tek başına hata sayılmamalı, adlandırılmış boyut olarak korunmalı.

**Yerler — 6 dosya / 6 modül:**
- `src/components/employees/SlideOverPanel.tsx:91` — header 108, gövde 122.
- `src/components/devices/DeviceDetailsPanel.tsx:156` — header 172.
- `src/components/visitors/VisitorSlideOverPanel.tsx:31` — header 32, gövde 33.
- `src/components/leaves/LeaveDetails.tsx:37` — header 42.
- `src/components/audit/AuditDetailPanel.tsx:9` — özel dönüş odağı.
- `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:78` — özel dönüş odağı.

**API:**
```ts
type DetailSheetProps = {
  open: boolean; onRequestClose: () => void; title: React.ReactNode;
  description: React.ReactNode; size?: "md" | "lg" | "wide"; pending?: boolean;
  headerExtra?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
  returnFocus?: React.RefObject<HTMLElement | null>; scroll?: "body" | "all";
};
```
**Etki:** 6 tüketici + 1 yeni dosya. **Risk:** orta/yüksek; form taslaklarının mount/unmount davranışı ve odak korunmalı. **Süre:** 4–6 saat. Modüle özgü sekmeler içerik slotunda kalmalı; sorgu, yetki veya tab verisi Sheet’e taşınmamalı.

## P1 · B06 — DetailFieldList · yeni

**Tekrar / fark:** `dl > div > dt + dd` alan-değer düzeni, muted etiket ve uzun değeri kırma sınıfları kopyalanıyor. Personelde dd mt-1/text-sm, ziyaretçide boyut sınıfı yok ve space-y-4, izinde text-sm/space-y-5, audit’te gap-3; boş değer personelde “—”, ziyaretçide “Belirtilmedi”.

**Yerler — 5 dosya / 5 modül:**
- `src/components/employees/EmployeeDetails.tsx:97`
- `src/components/visitors/VisitorSlideOverPanel.tsx:71` — ikinci alan grubu 76.
- `src/components/leaves/LeaveDetails.tsx:51`
- `src/components/audit/AuditDetailPanel.tsx:13`
- `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:147`

**API:**
```ts
type DetailField = { key: string; label: string; value: React.ReactNode; numeric?: boolean };
type DetailFieldListProps = {
  fields: readonly DetailField[]; columns?: 1 | 2;
  emptyValue?: React.ReactNode; className?: string;
};
```
**Etki:** 5 tüketici + 1 yeni dosya. **Risk:** düşük; sıfır/false boş sayılmamalı, kart maskeleme kontrolü ve durum badge’i value slotunda kalmalı. **Süre:** 1,5–2,5 saat. Tablo satırlarının mobil kart karşılığı bu adaya dahil edilmedi.

## P1 · B07 — FormFeedback · yeni

**Tekrar / fark:** submit hatasının `role="alert"` ile form içinde gösterilmesi, tekrar deneme ve verinin korunduğu mesajı kopyalanıyor. Çoğu yerde yalın text-destructive paragrafı, PDKS manuel düzeltmede çerçeveli text-danger hata listesi var; aynı tür hata için farklı yoğunluk/boşluk kullanılıyor. `SettingsFormState.tsx:36` içindeki DraftNotice zaten yerel bir başlangıç; `shared/ErrorState.tsx:21` merkezlenmiş yükleme hata yüzeyi olduğundan form içi mesajla birebir aynı iş değil.

**Yerler — 6 dosya / 6 modül:**
- `src/components/visitors/VisitorForm.tsx:46`
- `src/components/employees/EmployeeForm.tsx:220`
- `src/components/devices/DeviceForm.tsx:296`
- `src/components/admin/projects/ProjectEditor.tsx:147`
- `src/components/pdks/ManualPdksEditDialog.tsx:195`
- `src/components/settings/SettingsFormState.tsx:36`

**API:**
```ts
type FormFeedbackProps = {
  tone: "error" | "info"; title?: string; children: React.ReactNode;
  id?: string; variant?: "inline" | "panel";
  action?: React.ReactNode;
};
```
**Etki:** 6 tüketici + 1 yeni dosya. **Risk:** düşük; iş alanına özgü hata içeriği ve gerçekten korunmayan taslak için yanlış “korundu” mesajı üretilmemeli. **Süre:** 1,5–2,5 saat. DraftNotice’ın uzak kayıt değişikliği mantığı kendi yerinde kalır, yalnız mesaj görünümü ortaklaşır.

## P1 · B08 — ConfirmDestructive · atlanan

**Tekrar / fark:** silme/kaldırma için elle Dialog/AlertDialog ve iki buton kurulmuş. Ortak yapı `src/components/shared/ConfirmDestructive.tsx:22` async işlemi bekler, pending kapanışı engeller ve yalnız başarıda kapanır; MailSettings kaldırma onayı pending’i kendi butonlarına bağlamıyor, PDKSSavedViews remove çağrısından hemen sonra kapanıyor.

**Yerler — 3 dosya / 2 modül (mevcut yapının atlanması):**
- `src/components/settings/sections/MailSettings.tsx:129` — SMTP hesabı kaldırma; action 65, onClick 137.
- `src/components/settings/sections/components/pdksRulesConfirmation.tsx:31` — yalnız `kind === "delete"` dalı; yayınlama dalı ayrı kalmalı.
- `src/components/pdks/dashboard/PDKSSavedViews.tsx:83` — kayıtlı görünüm silme; buton 86.

**API — mevcut temel:**
```ts
type ConfirmDestructiveProps = {
  open: boolean; onOpenChange: (open: boolean) => void; title: string;
  objectName: string; effects: string[]; confirmLabel: string;
  onConfirm: () => Promise<unknown>;
};
```
**Etki:** 3 tüketici + bağlantılı `src/hooks/usePdksSavedViews.ts:99` ve `src/components/settings/sections/components/PdksRulesSettings.tsx:240` = 5 mevcut dosya; inline hata slotu gerekiyorsa ortak bileşen de değişir (6). **Risk:** orta. **Süre:** 2–4 saat. `removeView` şu an `void persist(next)` yapıyor: yalnız JSX değiştirmek başarıda kapanış garantisi sağlamaz, gerçek Promise geri dönmeli. PdksRulesSettings handler’ı `preventDefault` ile mevcut onayı açık tutuyor; bu davranış ve inline hatası kaybolmamalı. Mevcut `run()` sonucunu yutan callback, ConfirmDestructive’a başarılı Promise gibi verilmemeli.

## P2 · B09 — useGuardedFormNavigation · yeni

**Tekrar / fark:** mevcut unsaved guard’ın etrafına route/browser-back ve proje değişikliği koruması aynı useEffect ile ekleniyor. Admin/settings yerel hook oluşturmuş; personel/cihaz/izin aynı bağlam ve cleanup işlemlerini yeniden yazıyor. Yalnız `UnsavedChangesDialog` veya yeni bir onay dialog’u eklemek bu tekrarı çözmez.

**Yerler — 5 dosya / 5 modül:**
- `src/components/admin/hooks/useAdminFormGuard.tsx:13`
- `src/components/settings/useSettingsFormsGuard.ts:20`
- `src/components/employees/SlideOverPanel.tsx:70`
- `src/components/devices/DeviceDetailsPanel.tsx:119`
- `src/components/leaves/LeaveForm.tsx:143`

**API:**
```ts
function useGuardedFormNavigation(options: {
  active?: boolean; dirty: boolean; pending: boolean;
}): { requestClose: (proceed: () => void) => void; dialog: React.ReactNode };
```
**Etki:** 5 tüketici + 1 yeni hook. **Risk:** yüksek; beforeunload, browser-back, proje geçişi ve pending sırasında navigation davranışı birlikte korunmalı. **Süre:** 4–6 saat. `useSettingsFormsGuard` çoklu form toplama görevini korur, yalnız koruma katmanını yeni hook’a devreder; draft reset bu hook’un işi değildir.

## P2 · B10 — ConfirmAction · yeni

**Tekrar / fark:** yıkıcı olmayan async eylem için başlık/açıklama + Vazgeç/Onayla + pending + başarıda kapatma tekrar ediyor. Cihaz komutu, bağlantı gönderme ve senkronizasyon başlatma aynı kabuğu kullanıyor; `ConfirmDestructive` adı ve sabit destructive butonu bu işlemlere uygun değil (`src/components/shared/ConfirmDestructive.tsx:53`).

**Yerler — 3 dosya / 3 modül:**
- `src/components/devices/DeviceCommandCenter.tsx:115`
- `src/components/admin/components/PasswordResetDialog.tsx:12`
- `src/components/access-control/unified/SyncRuns.tsx:175`

**API:**
```ts
type ConfirmActionProps = {
  open: boolean; onOpenChange: (open: boolean) => void;
  title: string; description: React.ReactNode; confirmLabel: string;
  pending: boolean; pendingLabel?: string; onConfirm: () => Promise<boolean>;
};
```
**Etki:** 3 tüketici + 1 yeni dosya. **Risk:** orta; dışarıda yönetilen pending kullanılmalı, başarılı boolean sonrası kapanmalı, ikinci mutation/ikinci toast katmanı eklenmemeli. **Süre:** 2–3 saat. İstenirse ConfirmDestructive ile iç kabuk paylaşılır; silme API’sinin etkiler/nesne sözleşmesi korunur.

## P2 · B11 — DateRangeFields · yeni

**Tekrar / fark:** başlangıç/bitiş etiketleri, iki mevcut DateInput, aralık hatası ve iki alanın ilişkilendirilmesi tekrar ediyor. PDKS karşılıklı min/max ve yerel hata denetimi sağlıyor, izin RHF alan hatalarıyla çalışıyor, vardiya temizleme tarih değişiminde önizlemeyi sıfırlıyor; ortak katman string tarih alanlarını sunmalı, bu alan davranışlarını yutmamalı.

**Yerler — 3 dosya / 3 modül:**
- `src/components/leaves/LeaveForm.tsx:331` — ikinci alan 348.
- `src/components/pdks/records/PdksDatesSheet.tsx:21` — başlangıç 27, bitiş 60; yalnız tarih seçici, filtre/preset satırları kapsam dışı.
- `src/components/shifts/ClearAssignmentsDialog.tsx:39` — **değişiyor**; yalnız tarih kontrolleri incelendi, toplu işlem çubuğu değil.

**API:**
```ts
type DateRangeFieldsProps = {
  idPrefix: string; value: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
  errors?: { start?: string; end?: string; range?: string }; disabled?: boolean;
  required?: boolean; constrainOrder?: boolean;
};
```
**Etki:** 3 tüketici + 1 yeni dosya. **Risk:** orta; Date↔string dönüşümü, dahil gün hesabı ve çakışma sorgusu çağıranda kalmalı. **Süre:** 2–4 saat. Mevcut `src/components/ui/date-picker.tsx:14` tekrar aday gösterilmedi; öneri iki tarih arasındaki form düzeni içindir. shifts değişikliği tamamlandıktan sonra satırlar/akış tekrar doğrulanmalı.

## P2 · B12 — SettingsSection · yeni

**Tekrar / fark:** section + başlık + isteğe bağlı açıklama + kontrol/form + sonuç mesajı düzeni üç modülde kuruluyor. Mail alt bölümü text-sm başlık/pt-4, rıza bölümü text-base başlık/pt-5, çalışma günleri text-base ve açıklama mt-1 kullanıyor; bağlamları farklı olduğundan bu boyut farklarını doğrudan hata saymıyorum, yoğunluk seçenekleriyle ortaklaştırılabilir.

**Yerler — 3 dosya / 3 modül:**
- `src/components/settings/sections/MailSettings.tsx:166` — bağlantı test bölümü.
- `src/components/pdks/settings/WorkingDaysSettings.tsx:28` — çalışma günleri ayarı.
- `src/components/employees/EmployeeConsentsCard.tsx:118` — kişi rıza ayarları.

**API:**
```ts
type SettingsSectionProps = {
  id?: string; title: string; description?: React.ReactNode;
  children: React.ReactNode; actions?: React.ReactNode;
  divided?: boolean; density?: "compact" | "regular";
};
```
**Etki:** 3 tüketici + 1 yeni dosya. **Risk:** düşük; semantik heading seviyesi ve aria-labelledby kurulmalı, form/pending/veri katmanı içerikte kalmalı. **Süre:** 1–2 saat. Shadcn Card yeniden aday gösterilmedi; bu öneri ayar bölümü kompozisyonudur.

## Eşik altında kalanlar ve kapsam sınırları

- **Aramalı combobox:** `src/components/leaves/EmployeePicker.tsx:23` ve `src/components/visitors/VisitorCombobox.tsx:13` iki modülde doğrulandı; ilki server search/debounce/selected fallback, ikincisi client Türkçe filtreleme kullanıyor. Üçüncü modül kanıtı olmadan yeni aday yapılmadı. Basit Select ve ağaç tabanlı çoklu seçim aynı davranış sayılmadı.
- **Birleşik tarih+saat:** `src/components/visitors/VisitorFormFields.tsx:31` ve `src/components/admin/components/AccountAccessActions.tsx:57` iki modülde aynı DateInput + time input kompozisyonunu taşıyor; eşik altında.
- **PasswordField:** atlanan düz password input `src/components/settings/sections/MailSettings.tsx:108` ve `src/components/admin/IdeProvisioningCard.tsx:329` ile iki dosyada doğrulandı; üçüncü bulunmadan aday sayılmadı.
- **Reddet/onayla + gerekçe dialog’u:** `src/components/leaves/LeaveRequestsPanel.tsx:165` ve `src/components/pdks/CorrectionRequestsPanel.tsx:179` iki modülde tekrar ediyor; ayrı aday değil, async farkı B01’de kayıtlı.
- `src/pages/Settings.tsx:71` bölüm başlığını zaten tek yerde üretir; her ayar sekmesi için ayrı tekrar sayılmadı. `src/components/profile/ProfileForm.tsx:51` CardHeader/CardDescription kullanımı tek başına yeni kart adayı sayılmadı. Alarmlardaki liste/özet/filter yüzeyleri A kapsamına bırakıldı.
- Liste, tablo, filtre satırı, pagination, tree ve toplu işlem barı adayları eklenmedi. Kaynak/Convex dosyası, git durumu veya DB değiştirilmedi; uygulama testi ve lint çalıştırılmadı çünkü tek değişiklik bu keşif raporu.

## Önerilen uygulama sırası

Önce B01/B03/B08 ile mevcut davranışları tutarlı hale getirin; B02 footer’ını taşıyıp genişletin. B06/B07 düşük kapsamlı görsel ortaklaştırmalardan sonra B04/B05 kabuklarını bunları kullanacak biçimde ele alın. B09 navigation yaşam döngüsünü ayrı değişiklik olarak doğrulayın; B10–B12 ve değişen shifts tüketicisi sonraki adım olabilir. Bu bir keşif raporudur; uygulama yapılmadı.
