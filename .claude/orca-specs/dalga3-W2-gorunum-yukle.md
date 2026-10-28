# Dalga 3 / W2 — SegmentedViewControl + LoadMoreFooter (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga3-ortak.md
Rapor bölümleri: ortak-bilesen-A.md §5 (SegmentedViewControl), §10 (LoadMoreFooter).

## Hedef (test edilebilir)
1. Yeni `src/components/shared/SegmentedViewControl.tsx`:
   `<T extends string>{ label: string; value: T; options: readonly { value: T; label: ReactNode; disabled?: boolean }[]; onChange: (value: T) => void; className?: string }`.
   `role="group"` + `aria-label={label}`, her seçenek Button + `aria-pressed`. Bilinçli birleştirme: aktif `variant="secondary"`, pasif `variant="ghost"`
   (bugün PDKS/izin böyle; erişim durumu ve Alarmlar default/outline kullanıyor → onlar da secondary/ghost olur).
   Uygula: PdksPeriodSwitcher.tsx (~5/17), Leaves.tsx (~139/142 yalnız Kayıtlar/Talepler görünüm seçici), StatusResults.tsx (~13/21),
   Alarms.tsx (~112; bugünkü `role="tablist"` kalkar — tabpanel yok, group doğru semantik). URL güncellemesi, seçim temizliği, tarih sıfırlama çağıranda kalır.
2. Yeni `src/components/shared/LoadMoreFooter.tsx`:
   `{ hasMore: boolean; loading: boolean; disabled?: boolean; onLoadMore: () => void; summary?: ReactNode; loadMoreLabel?: string;
   loadingLabel?: string; exhaustedLabel?: string }`. Düğme `variant="outline"`, varsayılan metin "Daha fazla yükle", yüklenirken disabled + loadingLabel.
   hasMore=false ve exhaustedLabel verilmişse onu muted metin olarak gösterir; verilmemişse hiçbir şey göstermez.
   Uygula: AuditResultsContent.tsx (~13), ReportResults.tsx (~81), StatusResults.tsx (~76), Alarms.tsx (~117). Her yerin mevcut metinleri
   (ör. raporun "yalnız yüklenenler dışa aktarılır" bilgisi, audit'in active koşulu, alarmın loadMore(50)) çağıranda korunur.
3. Testler: SegmentedViewControl.test.tsx (aria-pressed, role=group, disabled), LoadMoreFooter.test.tsx (üç durum).

## Ownership (yalnız bunlara yaz)
- src/components/shared/SegmentedViewControl.tsx (+ test, yeni)
- src/components/shared/LoadMoreFooter.tsx (+ test, yeni)
- src/components/pdks/records/PdksPeriodSwitcher.tsx
- src/pages/Leaves.tsx
- src/pages/Alarms.tsx
- src/components/access-control/unified/status/StatusResults.tsx (+ StatusResults.test.tsx)
- src/components/audit/AuditResultsContent.tsx
- src/components/reports/ReportResults.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapsam dışı
CalendarNavigation (shifts), gerçek Tabs kullanan yerler, PaginationBar kullanan yerler, cursor/sorgu yönetimi.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/components/pdks/records src/pages src/components/access-control/unified/status src/components/audit src/components/reports`
- `node_modules/.bin/vitest run src/components/shared src/components/pdks src/pages src/components/access-control src/components/audit src/components/reports src/components/leaves`
