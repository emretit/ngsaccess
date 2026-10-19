# P3t — Başvuru-onay backend: testler + audit düzeltmesi (önceki worker testleri yazmadan bitirdi)

Durum: `convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`, `convex/lib/requestRules.ts` yazıldı; yalnız saf `requestRules` testi var (3/3). `leaveRequests.test.ts` ve `attendanceCorrections.test.ts` YOK. Orijinal gereksinim: `.claude/orca-specs/kiyas-p3a-basvuru-backend.md`.

## DÜZELT (UI audit koordinatörü bulgusu)
`convex/leaveRequests.ts:20,:32` ve `convex/attendanceCorrections.ts:30,:42` auditLog'a doğrudan `ctx.db.insert("auditLog", ...)` yapıyor → `searchText` yazılmıyor, Denetim Kaydı aramasında çıkmaz. Hepsini `writeAudit` (`convex/lib/audit.ts`) ile değiştir. Çalışan eylemlerinde `user` yoktur: `writeAudit`'in `user?` argümanının opsiyonel olduğunu doğrula; aktör bilgisini `newValue/oldValue` içinde `actorType: "employee"` + `employeeId` ile, `note: "Çalışan talebi"` olarak ver (`auditSearchText` çalışan adını bulamıyorsa `note`'a kişi adı YAZMA — KVKK; yalnız `employeeId`).

## EKLE
Testler (convex-test; desen: `convex/employeeCheckIn.test.ts`, `convex/orphanGuards.test.ts`):
- `convex/leaveRequests.test.ts`: submit (oturumdan employeeId/projectId; çakışma, ≥ bugün−30, ≤60 gün); withdraw yalnız kendi + pending + source "employee" (onaylı geri çekilemez, başkasınınki çekilemez); listMine başka çalışanı göstermez; audit satırı `searchText` dolu.
- `convex/attendanceCorrections.test.ts`: submit (aynı gün çift pending reddi, 30 gün penceresi, tipe göre HH:mm zorunluluğu, gerekçe 5–300), withdraw, listMine, listPending proje izolasyonu, approve → `pdksRecords` yazımı + audit + status, reject notu zorunlu (≥3), project_user onaylayamaz, başka proje yöneticisi onaylayamaz.
Kapı: `npx vitest run convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib/requestRules.test.ts`; kendi dosyalarında tsc/eslint 0.

## Ownership
`convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`, `convex/lib/requestRules.ts` + testleri. YAZMA: `convex/leaves.ts` (artık serbest ama bu pakette dokunulmaz), `pdksRecords.ts`, schema, `src/**`.
`pdksRecords.upsertManual` kopyası için: tekilleştirme kapsam dışı; kopyanın hangi satırlara karşılık geldiğini dosyada tek yorumla işaretle (`// upsertManual ile aynı yazım: pdksRecords.ts:<satır>`).

Testler yeşil olmadan `worker_done` GÖNDERME; kodu düzeltip tekrar koş.
