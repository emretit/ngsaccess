# P2t — Kişi içe aktarma BACKEND testleri + denetim

Önceki worker `convex/employeeImport.ts` (`importChunk`, `assignCards`) ve `convex/lib/employeeImportValidation.ts` yazdı; yalnız 3 saf doğrulama testi var, Convex handler testleri YOK. İşin: handler testlerini yazmak ve handler'ı `convex/employees.ts` `create` ile karşılaştırıp eksik değişmezleri kapatmak.

## Ownership (yalnız bunlara yaz)
`convex/employeeImport.ts`, `convex/lib/employeeImportValidation.ts`, `convex/employeeImport.test.ts` (yeni), `convex/lib/employeeImportValidation.test.ts`.
**YAZMA:** `convex/employees.ts` (yalnız oku), schema, `src/**` (arayüz başka worker'da: dışa açık imzalar `importChunk({projectId, rows, dryRun})` ve `assignCards({assignments})` DEĞİŞMEZ; dönüş şekli aynı kalır).

## Önce oku
`convex/employees.ts` `create` + `checkDuplicate` + `DUPLICATE_MESSAGES`, `convex/orphanGuards.test.ts` ve `convex/employeeCheckIn.test.ts` (convex-test deseni, kimlik/rol kurma), `convex/payVisibility.handlers.test.ts`.

## İş
1. Karşılaştırma: `employees.create` insert dışında ne yapıyor (denetim kaydı, zorunlu alanlar, normalizasyon, proje/şirket ilişkisi, cihaz senkronu tetiği, çalışan hesabı vb.)? `importChunk`'ın eksik bıraktığı DEĞİŞMEZLERİ listele; güvenli olanları `employeeImport.ts` içinde kapat (aynı kurallar, aynı hata mesajları). Karar gerektiren (ör. senkron tetiği, auditLog kapsamı) için raporda soru olarak bırak, DEĞİŞTİRME.
2. Tip temizliği: `as Id<...>` zorlamaları ve `relation` genel fonksiyonundaki birleşik tip hilesini tip güvenli hale getir (`any` yok).
3. Test (convex-test): `importChunk` — dryRun yazmaz; başka proje departmanı/pozisyonu bulunamaz → satır hatası; project_user reddedilir; başka projeye erişimsiz yönetici reddedilir; yinelenen T.C./e-posta/kart no atlanır (projeler arası çakışma SAYILMAZ); dosya içi çift; 100+ satır reddedilir; Türkçe i/İ ad eşleme. `assignCards` — çakışma, başka proje çalışanı, 200+ limit, geçersiz biçim, aynı kartı iki kişiye atama.
4. Kapı: `npx vitest run convex/employeeImport.test.ts convex/lib/employeeImportValidation.test.ts`, kendi dosyalarında tsc/eslint 0.

## Kapsam dışı
Arayüz, Excel, yeni tablo/alan, cihaz senkronu eklemek.
