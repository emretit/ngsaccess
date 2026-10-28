# DENETİM — Faz 3A puantaj (fazla mesai, SGK girdisi, gece çıkışı)
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. Spec: `.claude/orca-specs/akis-faz3a-puantaj.md`. Yazar raporu: `/tmp/akis-faz3a-rapor.md`.
Rapor: `/tmp/akis-faz3a-denetim.md`.
Dosyalar: convex/reports.ts, convex/sgkExport.ts, convex/lib/sgkCodes.ts, convex/lib/reportAttendance.ts, convex/lib/cardReadingProcess.ts, convex/lib/legacyOvertime.ts (yeni), src/pages/Reports.tsx, src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx, testler: convex/lib/legacyOvertime.test.ts, convex/reports.attendance.test.ts, convex/lib/cardReadingProcess.direction.test.ts, convex/w5aFix1.test.ts, convex/w5aLegacyEquivalence.test.ts (+ __snapshots__), convex/w53Integration.test.ts.
## Odak
1. Fazla mesai doğruluğu: hafta sınırı Europe/Istanbul (UTC+3, DST yok), Pazar 23:59/Pzt 00:00, gece yarısını geçen vardiyanın hangi haftaya yazıldığı, ruleDays ile legacy günlerin ÇİFT sayılmaması (karma proje), tek gün dalı.
2. Manuel düzeltme: manuel giriş/çıkış ham uçları doğru değiştiriyor mu, başka projenin/çalışanın kaydı sızmıyor mu, `manualEntry` dışı pdksRecords yanlışlıkla dahil mi, işten ayrılan (W2 employedDuring) korunuyor mu.
3. Okuma bütçesi: kişi başı `pdksRecords take(1001)` (N+1) — Convex limitleri (sorgu/doküman sayısı) büyük projede aşılır mı; `employees take(10001)` aşımı açık hata mı; reaktif sorgu maliyeti.
4. Gece yönü 16 sa: 08:00 giriş, çıkış unutulup 20:00'de tekrar okutma → çıkış (önceden de öyleydi mi?); cihaz değişimi (giriş A cihazı, çıkış B cihazı — sorgu cihaz başı mı?) gece vardiyasında ne olur; reddedilen okuma.
5. Snapshot değişiklikleri yalnız beklenen davranış farkı mı (legacy eşdeğerlik testinin amacı bozulmadı mı).
6. SGK taslak etiketi her çıkış yolunda (UI, dosya adı, XML) ve yanıltıcı "resmi" ifadesi kaldı mı.
