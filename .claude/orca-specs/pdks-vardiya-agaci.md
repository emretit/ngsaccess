# PDKS + vardiya filtre ağacı (K2, Codex)

## Hedef (test edilebilir)
`/pdks-records` sayfasının solunda Cihazlar/Kişiler'deki gibi bir **Vardiyalar filtre ağacı** olur (vardiya seç → kayıtlar süzülür,
vardiya ekle/düzenle/kişi ata/sil oradan); vardiya takvimi PDKS başlığındaki **"Vardiya planı"** düğmesiyle açılan geniş yan panelde
(Sheet) açılır; `/shifts` ve `/shifts/definitions` ayrı sayfaları kalkar (yönlendirme); menü adı "PDKS Kayıtları" → **"PDKS"**.

## Yapılacaklar
1. **Yeni `src/components/shifts/ShiftTree.tsx`** — `src/components/shared/TreePanel.tsx` kalıbı (`TreePanel`, `TreePanelHeader`,
   `treeFixedItemClass`, `TREE_NAME_BUTTON`, `TREE_ROW_ACTIONS`). Örnek: `src/components/devices/LocationTree.tsx`,
   `src/components/departments/DepartmentTree.tsx`.
   - `id="pdks-shifts"`, `label="Vardiyalar"`, `summary` = seçili vardiya adı ya da "Tüm vardiyalar".
   - Üstte sabit satır "Tüm vardiyalar" (`aria-pressed`). Altında her vardiya bir satır: renk noktası
     (`shiftColorClasses(shift.color)?.dot`), ad, saat (`shiftTimeLabel`, küçük/soluk), pasifse "Pasif" soluk etiket.
     Sıra: `startTime`'a göre (mevcut tanımlar tablosu gibi). Sayı/rozet GÖSTERME.
   - Seçim = mevcut `shift` URL filtresi: props `selectedShiftId` + `onSelectShift(id | undefined)`; PDKSRecords bunu
     `setFilters({ ...filters, shiftId })` ile bağlar (`usePdksFilterParams`). Seçili satıra tekrar tıklamak ya da "Tüm vardiyalar" → `undefined`.
   - Yalnız `can("schedule.manage")`: başlıkta "+" (`addLabel="Vardiya ekle"`) → `AddShiftDialog` (oluştur); satırda "…" (`RowActions`):
     **Düzenle** (`AddShiftDialog` editingShift), **Kişi ata** (`AssignShiftDialog`, bu vardiya önceden seçili), **Sil** (mevcut `DeleteImpact`).
   - Ekle/düzenle mantığı (renk yalnız değiştiyse gönderilir, esnek vardiyada kısıtlı update) `ShiftListSidebar.tsx:41-54`'te; kopyalama,
     ortak hook'a taşı (ör. `src/components/shifts/useShiftDefinitionActions.ts`). `DeleteImpact` + `DialogImpact` ayrı dosyaya taşınabilir
     (`ShiftDeleteImpact.tsx`). Artık kullanılmayan `ShiftListSidebar` tablo bileşenini sil; testini yeni yapıya taşı.
   - `createOpen` / `onCreateOpenChange` props'u dışarıdan kontrol edilebilir olsun (madde 3'teki boş durum için).
   - Vardiya yoksa: ağaçta kısa metin "Henüz vardiya yok" (+ yöneticiye "Vardiya ekle" düğmesi).
2. **`AssignShiftDialog`**: `initial.shiftId` desteği (verilirse form o vardiyayla açılır). Çalışan listesi
   `useShiftCalendarDefinitions(projectId)`'den gelir (`src/components/shifts/calendar/useShiftCalendarData.ts`).
3. **Yeni `src/components/shifts/ShiftPlanSheet.tsx`**: `Sheet` (`@/components/ui/sheet`), sağdan, geniş:
   `className="w-full overflow-y-auto sm:max-w-[min(1400px,96vw)]"`. İçerik `ShiftCalendarView` (projectId, projectName).
   - Açık durumu URL'de `plan=1` (`useSearchParams`; diğer parametreleri KORU, `usePdksFilterParams` zaten bilinmeyen anahtarları korur).
   - Tek başlık: `SheetTitle` "Vardiya planı". `CalendarHeader` içindeki "Vardiyalar" başlığı tekrar etmesin (aksiyonlar —
     Vardiya ata, İşlemler › Dışa aktar / Toplu temizle — kalır). `CalendarHeader`'daki **"Vardiya tanımları" düğmesini kaldır**.
   - `openDefinitions` zinciri (`ShiftCalendarView` → `ShiftCalendarPlan` → `CalendarHeader`): boş durumdaki "Vardiya tanımlarına git" ve
     "Bir tanımı etkinleştirin" artık sheet'i kapatır; tanım yoksa ağacın "Vardiya ekle" diyaloğunu açar. Metinleri buna göre güncelle
     (ör. "Vardiya tanımla").
4. **`src/pages/PDKSRecords.tsx`**: `PageHeader` başlığı "PDKS"; başlıkta "Ayarlar"ın yanına `variant="outline"` **"Vardiya planı"**
   düğmesi (`CalendarClock` ikonu; sayfayı gören herkes). Gövde Cihazlar düzeni (`DevicesContent.tsx:83-85`):
   `<div className="flex min-w-0 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:gap-5">{ShiftTree}<div className="min-w-0 flex-1 space-y-4">…mevcut gövde…</div></div>`.
   `PageHeader` en üstte tam genişlik kalır.
5. **`PDKSFilterBar.tsx`**: vardiya `Select`'i (≈126-129) ve sayaçtaki `shiftId` (≈68, 93-95) kaldırılır; tek vardiya kontrolü ağaç.
   Filtre "temizle" vardiya seçimine dokunmaz.
6. **Rotalar** (`src/App.tsx`): `Shifts` + `ShiftDefinitions` lazy import ve rotaları kalkar;
   `/shifts` → `<Navigate to="/pdks-records?plan=1" replace />`, `/shifts/definitions` → `<Navigate to="/pdks-records" replace />`.
   `src/pages/Shifts.tsx` ve `src/pages/ShiftDefinitions.tsx` silinir. URL `/pdks-records` AYNI kalır.
7. **Menü/metin**: `src/lib/routeMeta.ts` `/shifts` satırı silinir, `/pdks-records` adı "PDKS".
   `SystemSettingsForm.tsx:9,16` → "Çalışma saatleri ve atamalar PDKS sayfasında yönetilir." + link `/pdks-records?plan=1` "Vardiya planını aç".
   `PdksSettingsPanel.tsx:12,16` → vardiyalar PDKS sayfasının sol panelinden ve Vardiya planı'ndan yönetilir (link `/pdks-records`).
   `PdksSettings.tsx:19,24` "PDKS Kayıtları" → "PDKS". `Settings.tsx:40` yorumu güncellenebilir.

## Kapsam dışı (DOKUNMA)
`convex/` altı (backend değişmez) · `src/components/landing/**` · `src/utils/pdksExport.ts` · `src/lib/themeBootstrap.ts` + `index.html`
(`/shifts` öneki yönlendirme için kalsın) · URL `/pdks-records` ve `PDKS_SETTINGS_PATH` değişmez · `mobile/` · İzinler sayfası.

## Ownership (yalnız bunlara yaz)
`src/App.tsx`, `src/lib/routeMeta.ts`, `src/pages/PDKSRecords.tsx`, `src/pages/PdksSettings.tsx`, `src/pages/Shifts.tsx` (sil),
`src/pages/ShiftDefinitions.tsx` (sil), `src/pages/Settings.tsx` (yalnız yorum), `src/components/pdks/dashboard/PDKSFilterBar.tsx`,
`src/components/pdks/settings/PdksSettingsPanel.tsx`, `src/components/settings/sections/general/SystemSettingsForm.tsx`,
`src/components/shifts/**` (yeni dosyalar dahil), ilgili testler (`*.test.ts(x)` bu dosyaların yanında + `src/components/pdks/auditPage.test.tsx`,
`src/components/layout/*.test.tsx` gerekiyorsa).

## Kurallar
- TypeScript strict; `any` / `as any` / `!` YOK. Convex sonuçları `FunctionReturnType` ile. Türkçe UI metni.
- Mevcut paylaşılan bileşenleri kullan (`TreePanel`, `RowActions`, `ConfirmDestructive`, `Sheet`); yeni stil sistemi icat etme.
- **`git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git worktree` ÇALIŞTIRMA.** Deploy, `npx convex`, DB yazma YOK.
- Worktree açma; ana dizinde çalış.

## Kapılar (hepsi yeşil olmadan worker_done gönderme)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src
node_modules/.bin/vitest run
```
Yeni testler: ShiftTree (Tüm vardiyalar + satırlar render; tıklama `onSelectShift` id ile; yetkisiz kullanıcıda "+"/"…" yok),
`/shifts` → `/pdks-records?plan=1` yönlendirmesi, PDKSFilterBar'da vardiya seçicisi yok.

## Rapor
`worker_done` ≤10 satır: değişen/silinen dosyalar (file:line), kapı sonuçları (test sayısı), bilinen sınırlar.
