# C2b W-09-ui — 09 Vardiyalar sayfası A2 (frontend) + ADM-1D + UX-1B (vardiya kısmı)
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/09-vardiyalar/REPORT.md` (tüm "Yeni tasarım":
bilgi mimarisi, kolonlar ve boyutlar, rozetler ve metinler, tekli/toplu atama formu, atama ayrıntısı, vardiya tanımları sahipliği,
"Bileşen eşlemesi") + `mockup.html`. Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2b-09-api.md` — listAssignments
aralık arg'ları, previewBulkAssign, bulkAssignShift kişi bazlı sonuç, assignmentDeleteImpact, definitionUsage.
Ek: `docs/ux-audit/03_KISILER_VARDIYA_IZIN.md` UX-1B (vardiya kısmı) · `docs/ux-audit/04_AYARLAR_ADMIN.md` ADM-1D (atıl vardiya sözleşmesi).
Ürün varsayılanları: tanım yönetimi Vardiyalar'da (Sheet) tekleşir; genel mesai/tatil politikası Ayarlar'da kalır; tek gün istisnası YOK.

## Hedef (test edilebilir)
`/shifts` A2 düzende: PageHeader (h1 + proje; birincil "Vardiya ata", ikincil "Vardiya tanımları") → StatInline (kişi/gün/aktif tanım;
talep/kapasite tahmini YOK) → FilterBar (Türkçe arama, vardiya, dönem) → haftalık/aylık takvim (semantik tablo başlığı, sticky kişi
kolonu, hücre klavyeyle açılır, çoklu kayıt ayrıntısı) + 390'da ajanda görünümü → tekli/toplu ORTAK atama formu: önce
`previewBulkAssign` önizlemesi (kişi bazlı atanacak/çakışma/izinli/tatil), apply sonrası kalıcı kısmi sonuç → atama ayrıntısı
(tıklanan gün + seri ayrımı) → tanım Sheet'i (liste + ekle/düzenle; düzenlemede `definitionUsage` etki özeti; silmede
`assignmentDeleteImpact`). Takvim yalnız görünür aralığı ister. 1440/390 taşma yok; vitest + build yeşil.

## İş
1. `src/pages/Shifts.tsx`, `ShiftCalendarView.tsx`, `ShiftCalendarGrid.tsx`, `ShiftCalendarCell.tsx`: A2; ikonlu kart başlığı kalkar;
   `listAssignments` çağrısına görünür aralık (+ kişi listesi gerekiyorsa) geçer; `lib/shiftColor.ts` kullanımı StatusBadge/tonlara
   geçer, son tüketici kalmazsa dosya silinir.
2. Ajanda: yeni `ShiftAgendaView.tsx` (aynı filtreli veri; hesap kopyalanmaz) — 390'da varsayılan.
3. Atama: `AssignShiftDialog.tsx` + `BulkAssignShiftDialog.tsx` → tek ortak form (`assignmentFormSchema.ts`), önizleme adımı, alan altı
   hata, dirty koruma; `calendarConfirmed` kontrolü UI'ye bağlı; sonuç paneli kalıcı (sessiz tekrar yok). `AssignmentEditDialog.tsx`
   + yeni `ShiftDayDetails.tsx`: gün ayrıntısı ve seri düzenleme ayrımı (tek gün bölme YOK — açıklayıcı metin).
4. Tanımlar: `ShiftListSidebar.tsx` kalıcı sidebar → isteğe bağlı Sheet. `src/components/settings/sections/components/AddShiftDialog.tsx`
   ve `shiftFormSchema.ts` → `src/components/shifts/definitions/` altına TAŞI (import'ları güncelle); alan altı hata, mola/süre
   hiyerarşisi, tolerans açıklaması, dirty koruma, başarısız mutation formu kapatmaz. `ShiftSettings.tsx` / `ShiftTable.tsx` aktif
   tüketicisi yoksa sil ve `SettingsTabs.tsx`'teki vardiya sekmesini kaldırıp yerine "/shifts" bağlantısı bırak (SettingsTabs'ta YALNIZ bu değişiklik).
5. Saf mantık (görünür aralık hesabı, önizleme özeti metni, rozet eşleme) `src/components/shifts/lib/*.ts` + vitest.

## Ownership
src/pages/Shifts.tsx · src/components/shifts/** (yeni dosyalar dahil) · src/components/settings/sections/ShiftSettings.tsx ·
src/components/settings/sections/components/{AddShiftDialog.tsx,ShiftTable.tsx,shiftFormSchema.ts} (taşıma/silme) ·
src/components/settings/SettingsTabs.tsx (yalnız vardiya sekmesi)

## Kapsam dışı
convex/** (ask) · Ayarlar'ın geri kalanı (13, C2c) · İzinler (10) · PDKS · ui|shared|layout.
