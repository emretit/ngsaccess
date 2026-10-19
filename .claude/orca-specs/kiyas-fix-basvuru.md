# FIX-A — Başvuru backend: denetim bulguları E3 + D6 + D7 (+N7)

Kaynak: `docs/hikconnect-audit/review-wave1.md` — E3, D6, D7, N7 bölümlerini OKU (senaryolar ve önerilen düzeltme orada). Bu bulguları kapat; başka şeye dokunma.

## Ownership
`convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`, `convex/lib/requestRules.ts` + testleri (`convex/leaveRequests.test.ts`, `convex/attendanceCorrections.test.ts`, `convex/lib/requestRules.test.ts`). YAZMA: `convex/pdksRecords.ts` (yalnız oku), `convex/leaves.ts`, schema, `src/**`.

## Yapılacaklar
1. **E3 (ENGEL):** `attendanceCorrections` onayında tek yönlü düzeltme (`checkIn`/`checkOut`) mevcut kaydın DİĞER saatini silmesin: `entryTime: input.entryTime ?? existing.entryTime`, `exitTime: input.exitTime ?? existing.exitTime`; birleşik değerle giriş<çıkış doğrulaması (gece vardiyası kuralı D7 ile uyumlu). Test: mevcut kayıt (giriş+çıkış) + `checkIn` talebi → çıkış korunur; tersi de.
2. **D7:** Kopyada vardiya çözümü eksik: `upsertManual`'daki `buildShiftResolver` + `validateManualPdksInput(…, shiftResolver)` akışını AYNI biçimde uygula (pdksRecords.ts:27-38, 78-113'e bak; dosyayı DEĞİŞTİRME — ortak `lib/pdksManualWrite.ts` çıkarımı UI audit PDKS dalgası bitince yapılacak; kopya satırlarını tek yorumla işaretlemeye devam et). `note` kaynağı: orijinalle aynı davranış mı değil mi karar ver ve yorumla. Test: gece vardiyalı çalışanın (22:00–06:00) düzeltmesi onaylanabilir.
3. **D6:** `leaveRequests.submit`: aynı çalışanda çakışan `pending` talep varsa reddet (Türkçe mesaj) + çalışan başına toplam bekleyen talep üst sınırı 10. Test.
4. **N7:** `attendanceCorrections.listPending` `take(200)` sessiz kesmesi: sonuç sayısı sınıra dayanıyorsa `isDone` yanlış `true` dönmesin (ya sayfalama alanını doğru döndür ya da sınırı belgeli hale getir ve `hasMore` işareti ver). Mevcut çağıran yoksa (UI yok) sade tut.

## Kural
Testler: bu repoda convex-test YOK; desen = vitest + `vi.mock("./lib/customFunctions")` passThrough + sahte ctx (mevcut `convex/leaveRequests.test.ts` ve `convex/attendanceCorrections.test.ts` nasıl yazılmışsa öyle). `writeAudit` kullan, doğrudan `auditLog` insert YASAK. Yeni `targetTable` yazma.
Kapı: kendi dosyalarında tsc 0, eslint 0, `npx vitest run convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib/requestRules.test.ts convex/lib/auditLogQuery.test.ts` yeşil. Testler yeşil olmadan worker_done gönderme.
