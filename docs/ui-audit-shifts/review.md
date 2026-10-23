# Vardiyalar UI düzeltmesi — bağımsız denetim (Codex A/B/C diff'i)

Sonuç: **Engel 0 · Önemli 4 · Düşük 6.** Kapsamdaki diff okundu. `tsc` (shifts) temiz, `vitest run src/components/shifts convex/shifts.test.ts` 11 dosya / 75 test yeşil. Yetki kapıları (`schedule.manage`, `reports.view`) yazma eylemlerinde doğru; backend'de atlanmış yazma yolu yok.

## Önemli

1. **Yayın sırası tuzağı — [shiftFormSchema.ts:91](../../src/components/shifts/definitions/shiftFormSchema.ts) + [ShiftListSidebar.tsx:46](../../src/components/shifts/ShiftListSidebar.tsx)**
   Düzenleme her zaman `color: null` (veya anahtar) gönderiyor. Eski Convex backend `update` argüman doğrulamasında `color`'ı tanımıyor → web Convex'ten önce yayınlanırsa **her vardiya düzenlemesi** (ad/saat/aktiflik dahil) doğrulama hatasıyla düşer. Sıra: Convex (`dev --once`) → web. Yayın notuna yaz.

2. **Pasif-only durumda takvim ve mevcut atamalar görünmez — [ShiftCalendarPlan.tsx:134](../../src/components/shifts/calendar/ShiftCalendarPlan.tsx)**
   `!active.length` iken (tüm tanımlar pasif) yalnız boş durum çıkıyor; pasif tanıma bağlı mevcut atamalar takvimde görülemez/düzenlenemez, ama "Toplu temizle" ve "Dışa aktar" menüde açık kalıyor (görmeden siler/aktarır). Çözüm: boş durumu yalnız `shifts.length === 0` için kullan, ya da menü öğelerini bu durumda kapat. Ayrıca yetkisiz kullanıcıya bu boş durumda yönlendirme yok (bkz. Düşük 3).

3. **Esnek vardiyada renk/ad/aktiflik güncellenemiyor — [convex/shifts.ts:463](../../convex/shifts.ts)**
   `update` esnek tanım için her alanda hata fırlatıyor (önceden var); renk özelliği bunu görünür yaptı: esnek vardiyaya renk atanamaz/kaldırılamaz, formda "yeni tanım oluşturun" notu renk için yanıltıcı. Çözüm: yalnız `color`/`isActive`/`name` yamalarını esnek için de serbest bırak (hesap alanlarını değil) ya da formda rengi esnek düzenlemede gizle.

4. **Seçim kutuları yetkisiz kullanıcıda işlevsiz — [ShiftCalendarPlan.tsx:121](../../src/components/shifts/calendar/ShiftCalendarPlan.tsx)**
   `selectAll` ve satır onay kutuları `schedule.manage` olmadan da çiziliyor, ama `BulkBar` (Seçilenlere ata) yalnız `canManage` için. Sonuç: yetkisiz kullanıcı seçim yapıyor, hiçbir şey olmuyor (ölü etkileşim). Çözüm: `canManage` değilse `selectAll` geçme ve satır kutularını gizle.

## Düşük

1. **Yetkisiz kullanıcı `/shifts/definitions`'ı salt okunur görüyor — [ShiftDefinitions.tsx](../../src/pages/ShiftDefinitions.tsx)**
   Yazma eylemleri (Yeni tanım, satır tıkla, RowActions, form, silme) doğru gizli; PDKS ayar bağlantısı yalnız yetkiliye link, diğerine düz metin (doğru). Ancak `PdksSettings` yetkisiz kullanıcıya "görüntüleme yetkiniz yok" gösteriyor; bu sayfa göstermiyor. Okuma bilinçli ise sorun değil; kalıp tutarlılığı için karar ver.
2. **Başlıkta `scope` yok — [ShiftDefinitions.tsx:25](../../src/pages/ShiftDefinitions.tsx)**: `PdksSettings` `scope={activeProject?.name}` veriyor, burada yok (A2 kalıbı farkı). Geri düğmesi de `navigate("/shifts")` sabit; PdksSettings'teki `cameFromRecords` benzeri geçmiş mantığı yok (kabul edilebilir).
3. **Yetkisiz boş durum çıkmaz sokak — [ShiftCalendarPlan.tsx:134](../../src/components/shifts/calendar/ShiftCalendarPlan.tsx)**: `action` yalnız `canManage`; yetkisiz kullanıcıya "Atama yapmak için önce bir vardiya tanımlayın" deniyor ama yapabileceği bir şey yok. Metni "Yöneticiye başvurun" şeklinde yetkiye göre değiştir.
4. **Boş hücre → doğrudan atama formu, izin/tatil görünmüyor — [calendarActions.ts:13](../../src/components/shifts/calendar/calendarActions.ts)**: kaydı olmayan ama izinli/tatil olan günde `canAssign` iken ayrıntı penceresi (izin/tatil rozeti) atlanıyor. Atama formunun uyarı verip vermediğini doğrula; vermiyorsa koşula `!data.leave && !data.holiday` ekle.
5. **Ay görünümü okunabilirlik/erişilebilirlik — [ShiftCalendarCell.tsx:49,62,69](../../src/components/shifts/ShiftCalendarCell.tsx)**: compact hücrede vardiya adı yalnız `title` (dokunmatik/ekran okuyucuda zayıf; `aria-label` yalnız "N atama" diyor), 9px metin. Renk çubuğu tek başına anlam taşıyor. `aria-label`'a vardiya adlarını ekle; en az 10–11px kullan. Ayrıca bugün işareti artık yalnız zemin tonu + kalın yazı (görsel "Bugün" etiketi kalktı, [ShiftCalendarGrid.tsx:99](../../src/components/shifts/ShiftCalendarGrid.tsx) sr-only; `aria-current="date"` var, iyi).
6. **Adlandırma/temizlik — [ShiftListSidebar.tsx](../../src/components/shifts/ShiftListSidebar.tsx)**: artık sidebar değil tanım tablosu; dosya/bileşen adı yanıltıcı, import blokları dosya ortasında dağınık (`usePermissions`/`shiftTimeLabel` üstte, `useState` altta). Yeniden adlandırma ayrı iş.

## Doğrulananlar (sorun yok)

- **Backend:** `create`/`update` `color` yalnız `shiftColorValidator` ile (geçersiz anahtar reddediliyor, test var); `update`'te `null` → `toPatch` `undefined` → `db.patch` alanı **siliyor**, `color` göndermeyen istemci dokunmuyor (test: ad güncelleyince `teal` korunuyor); `requirePermission(schedule.manage)` + proje üyeliği kontrolü create/update/remove'da yerinde. "Süzgeçsiz yol" taraması: `shifts` tablosuna yazan tek yer `convex/shifts.ts` (insert:427, patch:467, delete: remove) — hepsi yetki kapılı.
- **Akışlar:** Vardiya ata (`assignmentInitial(day)`), boş hücre → ön dolu form (`employeeIds/startDate/endDate`), Seçilenlere ata, tümünü seç + indeterminate (`CalendarSelectAll` ref ile), sayfa/arama/filtre/gün/dönem değişince `clearSelection`, Toplu temizle (`initialIds` + aralık), dışa aktarma (`reports.view` + `exporting` kilidi) korunmuş.
- **Tarih etiketi:** hafta aynı ay "19–25 Ekim 2026", ay sınırı "29 Eki – 4 Kas 2026", yıl sınırı iki yılı da yazıyor, ay görünümü "Ekim 2026" (aralık ayın 1'inden başlıyor), gün görünümü `dayLabel`. Compact (≤760px) `effectivePeriod="day"`, dönem düğmeleri gizli.
- **Erişilebilirlik:** renk seçici `radiogroup` + `aria-labelledby`, native radio (ok tuşları), odak halkası; tür/dönem düğme grupları `aria-pressed` + `role=group`; satır tıklama `ROW_CLICK_CLASS` + `onRowActivate` ve klavye yolu RowActions menüsü; gezinme düğmeleri `aria-label`'lı; ızgara `th scope`, `caption`, `aria-current`.
- **Tutarlılık:** PageHeader/geri düğmesi kalıbı PdksSettings ile uyumlu; Türkçe metinler tutarlı; `/shifts/definitions` sidebar'da "Vardiyalar" altında aktif kalıyor (`isUnder`).
