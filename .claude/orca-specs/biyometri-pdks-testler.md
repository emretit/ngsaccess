# Biyometrik okutmalar PDKS'ye geri giriyor — test güncellemesi (K2)

## Hedef
`node_modules/.bin/vitest run` tamamen yeşil olsun: aşağıdaki 10 test dosyasındaki 31 kırık test, yeni kurala göre güncellensin.

## Bağlam (koordinatör yaptı, DOKUNMA)
Ürün kararı (Emre 2026-10-26): parmak izi / yüz / iris gibi biyometrik doğrulamalı okutmalar artık HER projede PDKS'ye (tablo, puantaj, bordro, raporlar, mobil özet, veri kapsamı) GİRER. Eski KVKK dışlama kuralı kalktı.
Kod değişiklikleri hazır (çalışma ağacında, commit'siz):
- `convex/lib/pdksSource.ts`: `isPdksEligibleReading` artık yalnız `"unknown"` kaynağı dışlar (biometric dahil edilir). `classifyReadingSource` DEĞİŞMEDİ (hâlâ "biometric" döner).
- `convex/cardReadings.ts` `listReportTransactions`: biyometrik satır gizleme ve dönüşteki `hiddenBiometricCount` alanı KALDIRILDI.
- `convex/lib/reportAttendance.ts`: `splitPdksEligible` fonksiyonu KALDIRILDI (prod'da kullanılmıyordu).
- `src/lib/reports/transactions.ts`: `transactionSnapshot` dönüşünden `hiddenBiometricCount` kalktı.
- `src/lib/reports/testFixtures.ts`: `transactionPage(id, isDone)` — ikinci parametre (hiddenBiometricCount) KALDIRILDI; eski çağrılar `transactionPage('x', 12)` / `transactionPage('x', 2, true)` biçimindeyse yeni imzaya çevir (`transactionPage('x')`, `transactionPage('x', true)`).
- `src/components/reports/ReportResults.tsx`: "Biyometrik doğrulamalı geçişler KVKK gereği ..." metinleri ve "N biyometrik kayıt gizlendi" kaldırıldı; kayıtlar raporunda not artık yalnız "Yalnız yüklenen kayıtlar dışa aktarılır."
- `src/components/live-monitoring/ReadingDetailPanel.tsx`: "PDKS hesabına dahil edilmez" notu kaldırıldı.

## Ownership (YALNIZ bu dosyalara yaz)
- convex/lib/pdksAvailability.test.ts
- convex/lib/pdksSource.test.ts
- convex/lib/reportAttendance.test.ts
- convex/lib/reportScope.test.ts
- convex/mobileAttendance.test.ts
- convex/w53Integration.test.ts
- src/components/reports/ReportPage.test.tsx
- src/lib/reports/query.test.ts
- src/lib/reports/reportTransactions.backend.test.ts
- src/lib/reports/transactions.test.ts

## Kurallar
- Testleri SİLME; yeni davranışı doğrulayacak şekilde ÇEVİR: "biyometrik dışlanır" → "biyometrik dahil edilir / sayılır / süre üretir". "unknown dışlanır" testleri AYNEN kalır.
- `splitPdksEligible` testleri: fonksiyon kalktığı için o `describe/it` bloklarını kaldır (ya da `isPdksEligibleReading` üzerinden eşdeğer "biometric eligible, unknown not" testine çevir).
- `hiddenBiometricCount` beklentilerini kaldır; sayfa birleştirme/dedup/isDone beklentileri kalsın.
- Prod koduna (test olmayan dosyalara) DOKUNMA. Prod'da hata bulduğunu düşünürsen düzeltme, `ask` ile sor.
- `any` / `as any` yasak (eslint error).

## Kapsam dışı
Prod kodu, UI metinleri, başka test dosyaları, docs.

## Kapılar (hepsi senin koşumunla yeşil olmalı)
- `node_modules/.bin/vitest run` → tüm dosyalar yeşil
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex --quiet` → 0

## YASAK
git add / git commit / git stash / git checkout / git reset / push / deploy / `npx convex` (dev, deploy, run, codegen) / migration / DB yazma YOK. Çalışma ağacında başka oturumların değişiklikleri olabilir; onlara dokunma.

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar, her dosyada kaç test çevrildi/silindi (file:line), kapı sonuçları (sayılarla).
