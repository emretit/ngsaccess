# Denetim: PDKS vardiya ağacı (salt okuma, 2026-10-23)

Sonuç: Engel yok. Spec maddeleri 1-7 karşılanmış; 4 Önemli, 5 Düşük bulgu var.
Kapı: `vitest run src/components/shifts pdks layout` → 30 dosya / 166 test yeşil (tam vitest koordinatörde 3962 yeşil). tsc/eslint bu turda koşulmadı.
Proje kuralları: ShiftTree/ShiftPlanSheet/useShiftDefinitionActions/ShiftDeleteImpact'ta `any`/`as any`/`!` yok.

## Engel
Yok.

## Önemli
1. [ShiftTree.tsx:28](src/components/shifts/ShiftTree.tsx) — `useShiftCalendarDefinitions` hata verirse (Convex query hatası render'da fırlar) ağaç sınırsız; tüm PDKS sayfası düşer. Düzeltme: `<ShiftTree>`'yi PDKSRecords.tsx:111'de `QuerySectionBoundary` ile sar ya da ağaç içindeki sorguyu sınırın içine al.
2. [ShiftTree.tsx:39,41](src/components/shifts/ShiftTree.tsx) — URL'deki `shift` silinmiş/başka projeden bir id ise hiçbir satır seçili görünmez, özet "Tüm vardiyalar" yazar, kayıtlar boş gelir (başka kullanıcı silince ya da eski link). Düzeltme: `shifts` yüklenince `selectedShiftId` listede yoksa `onSelectShift(undefined)` çağır (useEffect).
3. [ShiftTree.tsx:59,71-72](src/components/shifts/ShiftTree.tsx) + [AssignShiftDialog.tsx:58,254](src/components/shifts/AssignShiftDialog.tsx) — pasif vardiyada "Kişi ata" `initial.shiftId` ile pasif id'yi forma koyuyor; seçenekler yalnız aktifleri listelediği için Select boş görünür ama değer pasif id'dir ve gönderilebilir. Düzeltme: pasif vardiyada "Kişi ata"yı gizle/disable et ya da dialogta `initial.shiftId` aktif değilse yok say.
4. [PDKSRecords.tsx:111-113](src/pages/PDKSRecords.tsx) — ağaç `projectId` yokken hiç render olmaz ama "Vardiya planı" düğmesi `disabled={!projectId}` iken URL `?plan=1` ile gelinirse (örn. /shifts yönlendirmesi, proje yüklenirken) sheet hiç açılmaz ve `plan=1` URL'de takılı kalır. Düzeltme: proje yoksa `plan` paramını temizle ya da proje yüklenince açılmasına izin ver (sheet'i projectId beklerken de aç, içeride skeleton göster).

## Düşük
1. [ShiftPlanSheet.tsx:10](src/components/shifts/ShiftPlanSheet.tsx) — `setParams` push yapar, `setFilters` ise `replace`; Geri tuşu sheet'i kapatır (muhtemelen istenen) ama tutarsız. Düzeltme: bilinçli ise yoruma yaz, değilse `{ replace: true }`.
2. Kaybolan bilgi (spec uyumlu ama haberiniz olsun): eski tanımlar tablosundaki Tür (Sabit/Esnek), Mola, Atama serisi sayısı, Aktif/Pasif rozeti, satıra tıklayıp düzenleme artık yok; `api.shifts.definitionImpacts` (convex/shifts) UI'da kullanılmayan sorgu oldu. Düzeltme: gerekirse düzenleme diyaloğunda tür/mola zaten görünür; sorguyu ayrı temizlik işine ekle.
3. [PdksSettings.tsx:19](src/pages/PdksSettings.tsx) — "PDKS’na dön" dil bilgisi hatalı. Düzeltme: "PDKS sayfasına dön".
4. [Settings.tsx:40](src/pages/Settings.tsx) — yorum hâlâ "PDKS Kayıtları › Ayarlar" (spec "güncellenebilir"). Düzeltme: "PDKS › Ayarlar".
5. [CalendarHeader.tsx:17-32](src/components/shifts/calendar/CalendarHeader.tsx) — PageHeader kaldırılırken `DropdownMenu` girintisi bozuk kalmış. Düzeltme: JSX'i div içine hizala.

## Doğrulananlar (sorun yok)
- `plan=1` aç/kapa: functional `setParams` ile diğer PDKS paramları korunur; `setFilters` da `plan`'ı korur (yalnız bilinen anahtarları siler, usePdksFilterParams.ts:86-98).
- Ağaç seçimi: aynı satıra tıklama/“Tüm vardiyalar” → `undefined`; `clearPdksFilters` artık `shiftId`'ye dokunmaz; proje değişince `shift` paramı temizlenir (filterParams.ts).
- Silinen vardiya seçiliyken kendi silmede `onDeleted` seçimi temizler (ShiftTree.tsx:75).
- Yetki: "+", "…", AddShiftDialog/Assign/Delete hepsi `canManage` ile; "Vardiya planı" herkese açık (spec gibi).
- Esnek vardiya düzenleme: useShiftDefinitionActions.ts:19-21 eski ShiftListSidebar mantığıyla birebir.
- Erişilebilirlik: Sheet'te tek `SheetTitle` + `SheetDescription`, CalendarHeader'da başlık yok; satırlarda `aria-pressed`; mobilde TreePanel açılır düğmesi (aria-expanded) kullanılıyor.
- Rotalar/menü/themeBootstrap-index.html senkron; /shifts → /pdks-records?plan=1, /shifts/definitions → /pdks-records.
