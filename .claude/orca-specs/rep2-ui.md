# Raporlar Dalga 2 — Worker UI (10 yeni rapor)
ÖNCE `.claude/orca-specs/rep1-common.md` oku (kurallar aynen; HEAD `73061a6`, D1 `c235651`'de commit'li ve CANLI). D1 kodunu (`src/lib/reports/**`, `src/components/reports/**`)
oku ve AYNI kalıpla genişlet. Backend sözleşmesi: `.claude/orca-specs/rep2-api.md` §Sözleşme (API worker aynı anda yazıyor).
Kolon/düzen fikri için Hik-Connect kataloğu: `docs/hikconnect-reports/README.md`.

**Hedef:** Aşağıdaki 10 rapor mevcut generic `ReportPage` ile açılır (filtre, kolon seçici, sayfalama, Excel/CSV/PDF); registry/satır mantığı testli; D1'in 6 raporu değişmeden çalışır.

## Ownership (yalnız bunlara yaz)
`src/lib/reports/**` (`groups.ts` HARİÇ — okunur) · `src/components/reports/**` · `src/pages/Reports.tsx`. Backend, `App.tsx`, sidebar, `src/components/pdks/**` (yalnız import) YASAK.
`src/lib/reports/testFixtures.ts` senin; API worker yalnız `dailyCell` içine `detail` varsayılanı eklemiş olabilir — varsa koru.

## Raporlar
Günlük grup (`gunluk`, veri: `getPdksTableData` matris, ≤31 gün, mevcut `DailyResults`):
1. `calisma-suresi` **Çalışma Süresi** — `totalMinutes > 0` günler. Kolon: Tarih · Ad Soyad · Departman · Vardiya · İlk giriş · Son çıkış · Toplam süre · Fazla mesai.
2. `ilk-giris-son-cikis` **İlk Giriş / Son Çıkış** — `firstEntry` dolu günler. Kolon: Tarih · Ad Soyad · Departman · Plan giriş · İlk giriş · Plan çıkış · Son çıkış · Okutma sayısı.
3. `istisnalar` **İstisnalar** — `isLate || detail?.isEarlyExit || status === "absent"`. DAILY kolonlarına + "İstisna" (ör. "Geç 12 dk · Erken çıkış 8 dk" / "Devamsız").
4. `erken-cikanlar` **Erken Çıkanlar** — `detail?.isEarlyExit`; `earlyExitMinutes` azalan.
5. `mola-ihlalleri` **Mola İhlalleri** — `detail?.breakViolation`. Kolon: Tarih · Ad Soyad · Departman · Vardiya · Plan mola ("12:00–13:00") · İlk giriş · Son çıkış · Toplam süre · Okutmalar.
   Not metni: "Vardiyada tanımlı mola aralığında hiç okutma olmayan ve 7,5 saatten uzun süren günler." (`getBreakViolations` kuralı).
Kayıtlar grup (`kayitlar`):
6. `okutma-karti` **Günlük Okutma Kartı** — veri `getPdksTableData` matris (≤31 gün, `DailyResults` yolu), `detail.punches.length > 0` günler. Kolon: Tarih · Ad Soyad · Departman ·
   Okutmalar ("08:58 Giriş · 12:01 Çıkış · 13:02 —"; yön yoksa "—") · İlk giriş · Son çıkış · Toplam süre · Okutma sayısı. PDF'te Okutmalar kolonu kaydırmalı/uzun metne dayanıklı.
7. `mobil-okutmalar` **Mobil Okutmalar** — Ham Okutmalar yolu (`TransactionResults`, cursor snapshot) + `sources: ["mobile", "qr"]` sunucu argümanı. `ReportDefinition`'a
   opsiyonel `transactionSources?: readonly ("card"|"pin"|"qr"|"mobile"|"manual"|"unknown")[]` ekle; `transactionReportArgs`/`reportQueryKey` bunu kullansın (key'e girer: sunucu argümanı).
Aylık grup (`aylik`, veri: `getMonthlyPayrollSheet`, mevcut `MonthlyResults`; istemci filtreleri key'e GİRMEZ — D1 düzeltmesini koru):
8. `aylik-calisma-suresi` **Aylık Çalışma Süresi** — kişi × gün matrisi, hücrede `totalMinutes` kısa biçim ("8:35", 0 ise boş) + toplam kolonları.
9. `kisi-bazli-devam` **Kişi Bazlı Devam** — gün kolonu YOK. Kişi başına: Çalışılan gün (`totalMinutes > 0`) · Geç (gün) · Erken çıkış (gün, `cells[].isEarlyExit`) · Devamsız · İzinli ·
   Hafta tatili · Resmî tatil · Toplam süre · Fazla mesai. Sayımlar `cells[].payrollCode`/`classification`/`status` üzerinden — kodları `convex/lib/pdksPayroll.ts`'ten doğrula, uydurma.
10. `departman-bazli-devam` **Departman Bazlı Devam** — departman satırları (yeni satır türü, ör. `kind: "department"`): Kişi sayısı · Çalışılan kişi-gün · Geç · Erken çıkış · Devamsız · İzinli ·
   Toplam süre · Fazla mesai · Devam oranı (% = çalışılan / (çalışılan + devamsız), payda 0 ise "—"). Kişi araması bu raporda gizli/devre dışı; departman filtresi tek departmana süzer.

## Tasarım kuralları
- `reportColumns(def, days)` bugün her `monthlyPayroll` raporuna durum-kodu gün kolonları basıyor → tanıma göre seçilebilir yap (ör. `monthlyDays?: "code" | "minutes"`; yoksa gün kolonu yok).
  Aylık Durum davranışı DEĞİŞMEZ.
- Satır üretimi slug'a göre dağınık `if`'lerle değil, tanım/haritayla (D1'deki `DAILY_PREDICATES` kalıbı). `ReportRow` ayrık birleşimi genişler; `any`/`as` zorlaması YOK.
- `pinnedColumns`: günlüklerde `date`+`name`, aylıkta `name`, departmanda `department`.
- Rapor açıklamaları kısa, düz Türkçe; hukuki iddia yok. Biyometrik notu D1'deki gibi kayıtlar grubunda kalır.
- API bağımlılığı: Okutma Kartı / Mola / Mobil, API worker'ın alanlarına bağlı. Başlarken `grep -n "breakViolation\|punches" convex/lib/pdksTable.ts` ve
  `grep -n "sources" convex/cardReadings.ts` boşsa önce diğer 7 raporu yap; en son bunları bağla (tsc ancak o zaman yeşil olur).

## Testler
`registry.test.ts` (16 rapor, slug benzersiz; kayitlar 3: ham-okutmalar, okutma-karti, mobil-okutmalar · gunluk 9 · aylik 4) ·
`rows.test.ts` (5 yeni günlük predicate + sıralamalar + istisna metni + okutma metni; `detail` yokken çökmez) · aylık: dakika matrisi, kişi sayımları, departman toplamı ve oran (payda 0) ·
`query.test.ts` veya mevcut test: mobil raporda `sources` argümanı ve key'e girmesi; aylıkta kişi araması key'e girmez.

## Kapılar
app tsc 0 · convex tsc 0 · eslint kendi dosyaların 0 · `node_modules/.bin/vitest run src/lib/reports src/components/reports` · `git diff --check`.
Rapor: `.claude/orca-specs/reports/rep2-ui.md` (dosya:satır, yeni export imzaları, tarayıcıda bakılacak akışlar) + `worker_done` ≤10 satır.
