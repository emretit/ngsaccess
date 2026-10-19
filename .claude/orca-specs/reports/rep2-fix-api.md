# Raporlar D2 backend düzeltme
- `convex/cardReadings.ts:346,514`: getPdksTableData mevcut arglarına `includePunches?: boolean` eklendi ve satır hesabına geçirildi; dönüş şekli aynı.
- `convex/cardReadings.ts:1783`: kaynak listesi doluyken tek paginate ile numItems/maximumRowsRead 1000; undefined/boş kaynakta eski 200 sınırı ve yalnız eşleşen satırlara enrich korunur.
- `convex/lib/pdksCalc.ts:100`: tam yeni imza `computeBreakViolation(params: { punchTimes: readonly string[]; breakStart?: string | null; breakEnd?: string | null }): boolean`; süre ISO ms farkının floor dakikası, pencere TR dakika-of-day.
- `convex/lib/pdksTable.ts:182,462,468`: computePdksTableRow mevcut params tipine `includePunches?: boolean` eklendi, dönüş `PdksTableRow`; varsayılan/false punches=[], diğer detail alanları dolu; manuel entryTime+exitTime varsa ihlal false.
- `convex/lib/pdksCalc.test.ts:289`, `convex/lib/pdksTable.test.ts:439,455`: 08:00:59–15:30:00 (449 dk), manuel düzeltme ve undefined/false/true payload regresyonları; 3 dosya / 83 test geçti.
- Kapılar: convex tsc 0, app tsc 0, değiştirilen 5 TS dosyasında eslint 0, git diff --check temiz; DB/deploy/codegen/commit/push çalıştırılmadı.
- Tarayıcı kontrolü: PDKS Kayıtları varsayılan boş punches; Okutma Kartı/Mola raporları includePunches=true ile gerçek okutma; manuel 10:00–15:00 günü Mola İhlalleri dışında; seyrek Mobil Okutmalar sayfalaması.
- Bilinen sınır: 1000 satırda kaynak eşleşmesi olmayabilir; kalıcı çözüm insert sırasında source alanı + index (şema değişikliği kapsam dışı); DB sorgusu yerelde çalıştırılmadı.
