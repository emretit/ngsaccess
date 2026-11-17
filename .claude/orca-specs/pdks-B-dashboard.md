# PDKS Faz B — dashboard yıllık fazla mesai ortak motora

## Hedef
convex/dashboard.ts (~:440-490) yıllık fazla mesai hesabı kendi netWorkMinutes/ilk-son mantığı yerine ortak PDKS motorunu (computePdksDay / computePdksPlannedDay ya da pdksTable satır hesabı) kullansın; aynı gün için PDKS tablosuyla aynı net dakika çıksın.

## Bilinen fark
Planlı moladan sonra başlayan 270 dk çalışma: ana motor 270, dashboard 210.

## İstenen
- Vardiya çözümleme, politika (loadPdksRulePolicy), çok vardiya, esnek vardiya ana motorla aynı.
- Sorgu maliyeti: mevcut sınırları koru (take/limit); çalışan başına N+1 artırma, gerekiyorsa proje başına toplu yükle.
- netWorkMinutes başka yerde kullanılmıyorsa kaldır; kullanılıyorsa raporla.

## Ownership
convex/dashboard.ts, convex/dashboard*.test.ts (yeni test dosyası serbest), gerekirse convex/lib/overtimeCalc.ts.
Kapsam dışı: convex/lib/pdksDay.ts (Faz A paralel değiştiriyor — OKU ama YAZMA), pdksEvidence.ts, schema.ts, dataMigrations.ts.

## Zorunlu test
- planlı moladan sonra başlayan 270 dk → dashboard 270
- 08:00–17:00 + 12–13 mola → PDKS tablosuyla eşit

Ortak kurallar: .claude/orca-specs/pdks-ortak-kurallar.md dosyasını OKU ve uygula.
