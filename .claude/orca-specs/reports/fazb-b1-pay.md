# Faz B / B1 — Ücret görünürlüğü
Durum: B1 tamamlandı; ortak ağaçtaki kapsam dışı 4 test hatası aşağıda.

## TAM değişen dosya listesi (yalnız B1 katkısı)
- convex/employees.ts
- convex/visitors.ts
- convex/cardReadings.ts
- convex/reports.ts
- convex/lib/payVisibility.ts (yeni)
- convex/lib/payVisibility.test.ts (yeni)
- convex/payVisibility.handlers.test.ts (yeni)
- src/components/settings/sections/ReportsSettings.tsx
- src/components/settings/sections/reports/exportReport.ts
- src/components/settings/sections/reports/exportReport.test.ts
- src/utils/reportsExport.ts
- .claude/orca-specs/reports/fazb-b1-pay.md (bu rapor)

## Değişiklikler
- payVisibility.ts:5,9: canSeePay mevcut isManager politikasını kullanır; maskPay yönetici değerini aynen korur.
- employees.ts:96,155: list/getById spread SONRASI hourlyRate ve monthlySalary maskeleri.
- visitors.ts:126: eski list uç noktasındaki iki ücret alanı spread sonrası maskelenir.
- cardReadings.ts:350,510: tablo hesaplayıcısına project_user için ücret alanları verilmez; resolveHourlyRate null üretir.
- cardReadings.ts:643,772: aylık bordro project_user saatlik ücreti null; her hücre ve toplam zaten null üretir.
- pdksTable.ts/pdksPayroll.ts/pdksHelpers.ts yalnız okundu; hesaplayıcı dosyaları değiştirilmedi.
- reports.ts:152,226,258: mesai satırları ve totalOvertimePayTRY project_user için null.
- reports.ts:291,353,388: departman ücret/maliyetleri null; project_user departman adına, yöneticiler mevcut maliyete göre sıralanır.
- ReportsSettings.tsx:185: null mesai toplamı gösterilmez; toLocaleString çağrısına girmez.
- reports/exportReport.ts:25,35 ve utils/reportsExport.ts:70,73: null parasal hücreler “—”; gerçek 0 sayısı korunur.
- payVisibility.handlers.test.ts:1: gerçek 7 handler; üç rol, ücret önceliği/maaş fallback, sıfır/eksik ücret, her bordro hücresi/toplam, proje/orphan erişimi ve sıralama.
- Aynı test saklanan ücretlerin değişmesinin project_user yanıtlarının hiçbirini değiştirmediğini doğrular.
- payVisibility.test.ts:1 ve exportReport.test.ts:19: saf politika, null/0/pozitif değerler ve dışa aktarım regresyonları.

## Kapı sonuçları (son çalışma)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: PASS, çıkış 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: PASS, çıkış 0.
- `node_modules/.bin/eslint` yukarıdaki 11 TS/TSX dosyası: PASS, çıkış 0; uyarı/hata yok.
- `node_modules/.bin/vitest run convex/lib/payVisibility.test.ts convex/payVisibility.handlers.test.ts convex/lib/reportScope.test.ts convex/lib/pdksTable.test.ts convex/lib/pdksPayroll.test.ts src/components/settings/sections/reports/exportReport.test.ts`: PASS, 6 dosya / 71 test.
- `node_modules/.bin/vitest run`: FAIL, 149 dosya / 1811 test geçti; 2 dosyada 4 test başarısız (toplam 151 dosya / 1815 test).
- Kapsam dışı shiftAssign.test.ts:237,284: mevcut auth mock'unda yeni isProjectAllowed dışa aktarımı eksik (2 test).
- Kapsam dışı leaveValidation.test.ts:176,222: yeni employee proje erişim denetimi ile eski fixture uyumsuz (2 test).
- İlk tam koşuda orphanGuards customFunctions mock authedAction eksikti; son koşuda bu suite geçti.

## Açık kalan / risk
- B1 kapsamında açık iş yok; yöneticilerin ücret matematiği ve parasal olmayan alanlar korunur.
- Tam paketin yeşile dönmesi kapsam dışı iki test dosyasının sahiplerinde; koordinatöre escalation gönderildi.
- Canlı API, DB yazma, codegen/deploy ve git stage/commit yapılmadı; diğer worker dosyalarına dokunulmadı.
