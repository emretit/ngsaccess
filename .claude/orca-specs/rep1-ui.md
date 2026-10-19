# Worker UI — Raporlar registry + generic ReportPage + hub/grup sayfaları + route
ÖNCE `.claude/orca-specs/rep1-common.md` oku (zorunlu). Backend imzası: `.claude/orca-specs/rep1-api.md` §Sözleşme.

**Hedef:** `/reports`, `/reports/:group`, `/reports/:group/:slug` route'ları çalışır; 6 rapor tek bir generic `ReportPage` ile (filtre + kolon seçici + tablo +
sayfalama + Excel/CSV/PDF export) açılır; Resmi grubu Ayarlar → Raporlar'a link verir; saf mantık testli.

## Ownership (yalnız bunlara yaz)
- `src/lib/reports/**` (YENİ dosyalar; `groups.ts` koordinatörün — OKU, YAZMA)
- `src/components/reports/**` (YENİ)
- `src/pages/Reports.tsx` (YENİ; hub + grup + rapor için tek sayfa ya da `Reports*.tsx` ayrı sayfalar — senin seçimin)
- `src/App.tsx` — YALNIZ `lazy(() => import('@/pages/Reports...'))` satırları + `<Layout>` altına `/reports`, `/reports/:group`, `/reports/:group/:slug` route'ları.

## Veri kaynakları (koddan doğrulandı)
- **Günlük raporlar** → `api.cardReadings.getPdksTableData` `{ projectId, startDate, endDate, viewMode: "matrix", departmentId?, person? }` → `PdksTableRow[]`;
  her satırın `days[]` hücreleri (`PdksTableDayCell` + `detail`) istemcide kişi×gün satırlarına düzleştirilir. Sorgu biyometriği zaten süzüyor.
  - Günlük Puantaj (`gunluk-puantaj`): tüm hücreler (status `future`/`noData` hariç). Kolonlar: Tarih · Ad Soyad · Departman · Bordro kodu · Vardiya · Plan giriş · Plan çıkış ·
    İlk giriş · Son çıkış · Toplam süre · Geç (dk) · Erken çıkış (dk) · Fazla mesai · Durum · Okutma sayısı · Manuel.
  - Geç Kalanlar (`gec-kalanlar`): `cell.isLate` → `lateMinutes` (azalan). Erken Çıkış dk kolonu da (`detail.earlyExitMinutes`).
  - Devamsızlar (`devamsizlar`): `cell.status === "absent"`.
  - Fazla Mesai (`fazla-mesai`): `cell.overtimeMinutes > 0` + `detail.dayType` (Hafta içi/Hafta sonu/Resmî tatil/Yarım gün).
  - Durum etiketi/tonu: `src/components/pdks/statusMeta.ts` `STATUS_META` (+ `StatusBadge`). Aralık ≤31 gün (istemcide engelle, Türkçe uyarı).
- **Aylık Durum** (`aylik-durum`) → `api.cardReadings.getMonthlyPayrollSheet` `{ projectId, year, month }` → `{ days, rows:[{ name, department, payrollCode, cells, totals }] }`
  (hücre şekli: `convex/lib/pdksPayroll.ts` `computePayrollCell`). Matris: kişi satırı × ayın günleri (hücrede kod) + toplam kolonları. Filtre: ay seçici.
- **Ham Okutmalar** (`ham-okutmalar`, grup `kayitlar`) → `usePaginatedQuery(api.cardReadings.listReportTransactions, { projectId, startDate, endDate, result? }, { initialNumItems: 50 })`.
  Kolonlar: Zaman (İstanbul) · Ad Soyad · Departman · Kart no · Cihaz · Kapı · Yön · Sonuç (+ ret nedeni) · Kaynak. "Daha fazla yükle" (filtre sayfası boş dönebilir — `isDone` olana dek
  yüklemeyi kullanıcı sürdürür). Kalıcı not: "Biyometrik doğrulamalı geçişler KVKK gereği PDKS raporlarında gösterilmez." + sayfalardaki `hiddenBiometricCount` toplamı > 0 ise "N kayıt gizlendi".
  Bu sorgu Worker API tarafından aynı anda ekleniyor: başladığında `grep -n listReportTransactions convex/cardReadings.ts` boşsa önce diğer raporları yap, en son bunu bağla.
  Tip: `FunctionReturnType<typeof api.cardReadings.listReportTransactions>["page"][number]` (veya `convex/lib/reportAttendance` `ReportTransactionRow` tip importu).
- **Resmi** grup: rapor sayfası yok; 3 link kartı (SGK Aylık (APHB) · Fazla Mesai Özeti · Departman Maliyet) → `/settings?tab=reports`. `capabilities(role).settingsTabs.includes("reports")`
  değilse kartlar yerine "Bu raporlar yöneticiler içindir." Ayarlar dosyalarına YAZMA, `src/components/settings/sections/reports/exportReport.ts`'i IMPORT ETME.

## Tasarım
- `src/lib/reports/registry.ts`: `ReportDefinition` (`slug, group: ReportGroupKey, title, description, dataSource: "pdksMatrix"|"monthlyPayroll"|"transactions", columns, filters, formats`)
  ve `REPORTS` listesi + `getReport(group, slug)`, `reportsInGroup(group)`. Kolon: `{ key, label, value(row) → string|number|null, align?, defaultVisible, exportOnly? }`;
  satır tipleri `FunctionReturnType` türevleri, `any` YOK. Generic tip parametreleri kullanırken heterojen listeyi `unknown` + daraltma ya da discriminated union ile tut.
- `src/lib/reports/rows.ts` (veya benzeri): `flattenDailyRows(rows, predicate)`, `buildMonthlyStatusRows(sheet)` saf fonksiyonlar.
- `src/lib/reports/period.ts`: presetler Bugün · Dün · Bu hafta · Geçen hafta · Bu ay · Geçen ay · Özel — `src/lib/pdksDateRanges.ts` `getDateRange` + `src/lib/date.ts` yardımcılarını YENİDEN KULLAN
  (TR günü `todayInTurkey`); ≤31 gün doğrulaması. Filtre durumu URL search param'larında (`?preset=&from=&to=&dept=&q=&result=&month=`), paylaşılabilir link.
- `src/lib/reports/export.ts`: `exportReport(format, def, rows, meta)` — CSV (UTF-8 BOM, `;` ayraç, saf `buildCsv` testli), Excel (`exceljs` dinamik import; kalıp `src/utils/reportsExport.ts`),
  PDF (`jspdf` dinamik import; kalıp `src/utils/pdksExport.ts` `exportToPdf`, yatay A4, uzun tabloda sayfa kırma). Yalnız görünür kolonlar; dosya adı `rapor-<slug>-<from>_<to>.<ext>`.
  Ham Okutmalar'da yalnız yüklenmiş satırlar dışa aktarılır — butonun yanında "Yüklenen N kayıt" yaz.
- `src/components/reports/ReportPage.tsx` (generic): `PageHeader` (başlık + proje kapsamı + "İstanbul saati (UTC+3)") · `FilterBar` (dönem presetleri + `DateInput` özel aralık + departman + kişi arama) ·
  kolon seçici (Popover/DropdownMenu checkbox; seçim `localStorage` `reports.columns.<slug>`) · tablo (`src/components/ui/table`) · `PaginationBar` (import; istemci sayfalama 50/sayfa) ·
  `EmptyState` / `SectionSkeleton` / `QuerySectionBoundary`. Proje kapsamı `useActiveProjectScope()`; proje yoksa "Bir proje seçin" EmptyState. Örnek sayfa: `src/pages/AuditLog.tsx`.
- Grup sayfası (Hik-Connect düzeni): masaüstünde solda ikincil rapor listesi (grup içi raporlar, aktif vurgulu), sağda rapor; 390px'te liste üstte yatay/select. Grup kökünde
  (`/reports/gunluk`) ilk rapora yönlendir ya da grup içi rapor kartlarını göster. `/reports` hub: 4 grup kartı + içindeki raporlar. Geçersiz grup/slug → NotFound benzeri EmptyState + hub linki.
- Departman listesi için mevcut sorguyu bul ve kullan (ör. PDKS sayfası filtresi neyi kullanıyorsa); yeni backend sorgusu YAZMA.
- A2 dili: `docs/ui-scan/DESIGN_DIRECTION.md`, `docs/ux-audit/DESIGN_SYSTEM.md` — token renkler, emoji/gradyan/kart-içinde-kart YOK, `useToast` YOK (`notify`). 390px'te yatay taşma yok
  (tablo kendi kabında kayar). Erişilebilirlik: tablo başlıkları `<th scope="col">`, kolon seçici klavyeyle kullanılabilir, ikincil liste `nav aria-label`.

## Testler
`registry.test.ts` (slug'lar benzersiz, her rapor geçerli grupta, 6 rapor var, her kolonun label'ı boş değil) · `rows.test.ts` (düzleştirme + 4 predicate + aylık matris; `detail` yok olan hücrede
çökmez) · `period.test.ts` (presetler sabit `now` ile, ≤31 gün reddi) · `export.test.ts` (`buildCsv`: BOM, `;`, tırnak kaçışı, yalnız görünür kolonlar) ·
`ReportPage.test.tsx` (sahte definition + sahte veriyle render: kolon gizleme, boş durum). Mevcut test kalıbı: `src/components/audit/auditState.test.tsx`, `src/components/shared/shared.test.tsx`.

## Kapsam dışı
Sidebar/routeMeta (koordinatör). Dalga 2 raporları. Zamanlanmış raporlar. Backend değişikliği (sorgu eksikse `ask`). `PDKSRecords` sayfası ve `src/components/pdks/**` (yalnız import).
