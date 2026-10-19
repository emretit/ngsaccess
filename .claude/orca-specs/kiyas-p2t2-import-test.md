# P2t2 — Kişi içe aktarma: handler testleri + son rötuşlar (önceki 2 worker testleri yazmadan durdu)

Durum: `convex/employeeImport.ts` (`importChunk`, `assignCards`) ve `convex/lib/employeeImportValidation.ts` yazıldı; ilişki ID zorlamaları temizlendi. EKSİK: `convex/employeeImport.test.ts` HİÇ YOK. İlk iş bu testi yazmak; sonra rötuşlar.

## Ownership
`convex/employeeImport.ts`, `convex/lib/employeeImportValidation.ts`, `convex/employeeImport.test.ts` (YENİ), `convex/lib/employeeImportValidation.test.ts`. YAZMA: `employees.ts` (yalnız oku), schema, `src/**`. Dışa açık imzalar DEĞİŞMEZ: `importChunk({projectId, rows, dryRun})`, `assignCards({assignments})`.

## Karar (koordinatör, değiştirme)
- `employees.create` iki cihaz senkron action'ı zamanlıyor; içe aktarma bunu TETİKLEMEZ (toplu fırtınayı önlemek için; arayüzde yönetici açıkça "Cihazlara gönder" der).
- `employees.create` audit yazmıyor; içe aktarmada her NON-dryRun `importChunk` çağrısı sonunda TEK özet audit yaz: `writeAudit` (`convex/lib/audit.ts`; doğrudan `ctx.db.insert("auditLog")` YASAK — `searchText` yazılmaz) → `{ user: ctx.user, projectId, action: "create", targetTable: "employees", targetId: <projectId string>, newValue: { imported: n, skipped: n, errors: n }, note: "Excel içe aktarma" }`. Kişi verisi audit'e yazılmaz. `assignCards` için de tek özet audit (`action: "update"`, atanan sayısı).
- Ardından 2 kullanılmayan import uyarısını temizle.

## Test (convex-test; desen: `convex/orphanGuards.test.ts`, `convex/employeeCheckIn.test.ts`)
`importChunk`: dryRun hiçbir şey yazmaz; başka projenin departmanı/pozisyonu/firması bulunamaz → satır hatası; project_user reddedilir; erişimsiz projeye çağrı reddedilir; aynı projede yinelenen T.C./e-posta/kart no `skippedDuplicate` (BAŞKA projedeki aynı değer çakışma SAYILMAZ); dosya içi çift; 100+ satır reddedilir; Türkçe i/İ ad eşleme; non-dryRun özet audit yazar (searchText dolu), dryRun yazmaz.
`assignCards`: çakışma, başka proje çalışanı, 200+ limit, geçersiz biçim, aynı kartı iki kişiye atama, özet audit.
Kapı: `npx vitest run convex/employeeImport.test.ts convex/lib/employeeImportValidation.test.ts`; kendi dosyalarında tsc/eslint 0.
Test yazmadan `worker_done` GÖNDERME; testler yeşil değilse kodu düzeltip tekrar koş.
