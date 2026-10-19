# Worker UI — Raporlar D1 düzeltme turu
Önceki görevinin devamı; kurallar aynı (`rep1-common.md`, `rep1-ui.md`). Denetim raporu: `.claude/orca-specs/reports/review-rep1.md` (bulgu numaraları oradan).

**Hedef:** Denetimdeki #1, #2, #3, #4, #7 düzelir; regresyon testleri eklenir; kapılar yeşil.

## Ownership (değişmedi)
`src/lib/reports/**` (groups.ts hariç) · `src/components/reports/**` · `src/pages/Reports.tsx`. Backend, sidebar, `getPdksTableData` ve ücret alanı maskesi KOORDİNATÖRDE (#5, #6, #8) — dokunma.

## Düzeltmeler
1. **#1 YÜKSEK + #2 ORTA:** `ReportResults` remount key'i YALNIZ sunucu argümanlarından kurulsun (proje + slug + sunucuya giden filtreler + Yenile revizyonu). İstemcide uygulanan
   kişi/departman filtreleri (Ham Okutmalar, Aylık Durum) key'e GİRMEZ; yalnız `rows` hesabında (`useMemo`) uygulanır. Günlük raporlarda `person`/`departmentId` sunucu argümanıysa key'de kalabilir.
   Test: Ham Okutmalar'da 2 sayfa yüklüyken kişi filtresi değişince yüklenmiş satırlar KORUNUR (reducer/bileşen testi); aylıkta filtre değişimi sorgu argümanlarını değiştirmez.
2. **#3 ORTA:** PDF yatay parçalarda tanımlayıcı kolonlar tekrarlanır: günlüklerde `date` + `name`, Ham Okutmalar'da zaman + ad, aylıkta `name`. `ReportDefinition`'a opsiyonel
   `pinnedColumns?: readonly string[]` ekle (görünür değilse atla). Test: parça hesabı her parçada pinned kolonları içerir.
3. **#4 ORTA:** PDF satır üst sınırı `PDF_MAX_ROWS = 2000`; aşılırsa export başlamaz, `notify` ile "PDF en fazla 2.000 satır destekler; daha büyük raporlar için Excel kullanın." Düğme durumunda da
   ipucu ver. Test: sınır üstü → jsPDF dinamik import ÇAĞRILMAZ.
4. **#7 DÜŞÜK:** Gizli sayaç metni: "Yüklenen sayfalarda N biyometrik kayıt gizlendi (kişi/departman filtresinden bağımsız)."

## Kapılar
Aynı: app tsc 0 · convex tsc 0 · eslint kendi dosyaların 0 · `vitest run src/lib/reports src/components/reports` · `git diff --check`. Rapor: `.claude/orca-specs/reports/rep1-ui-fix.md` + `worker_done` ≤10 satır.
