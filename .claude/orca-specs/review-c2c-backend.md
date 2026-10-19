# Görev: Faz C2c backend denetimi (SALT-OKUMA) — 10 izinler, 11 denetim aktörleri, 12 admin listeleri
Repo: /Users/emreaydin/ngsaccess. Codex worker'ları yazdı (spec'ler `.claude/orca-specs/c2c-common.md`, `c2c-1{0,1,2}-api.md`; raporlar
`.claude/orca-specs/reports/c2c-1{0,1,2}-api.md`). Bağımsız denetçisin; raporu değil DİFF'i oku: `git diff -- convex` + `git status --short convex`
(yeni dosyalar). Koordinatör ekledi (`convex/schema.ts`): leaves `by_project_start`, `by_project_end`, `by_employee_start`. HARİÇ: mobile/**, src/**
(frontend worker'ları paralel çalışıyor; ara tsc hataları src kaynaklıysa seninki değil).
Bu backend canlı Convex'e frontend'den ÖNCE deploy edilebilir; canlıdaki ESKİ frontend yeni backend'i çağırmaya devam edecek.
Convex kuralları: `convex/_generated/ai/guidelines.md`.

## Özellikle bak
1. **Yetki/IDOR:** yeni public fonksiyonlar (`leaves.listPage/summary/employeeOptions/update`, `auditLog.actorOptions` + `list` `actor`,
   `users.adminList`, `projects.adminList/getDeletionImpact`, `adminDevices.adminListPage`) doğru wrapper'da mı (super_admin gerekenler
   superAdminQuery), kaynak kaydın projesini `resolveProjectScope` ile doğruluyor mu; ID ile başka projenin verisi okunabiliyor/yazılabiliyor mu.
   project_admin `auditLog.actorOptions` ile başka projenin kullanıcı adlarını görebiliyor mu.
2. **Yetki sıkılaştırması:** `projects.listActive` ve `projects.getById` public `query` → `authedQuery` yapıldı. Tüm tüketicileri bul
   (`grep -rn "projects\.\(listActive\|getById\)" src convex`), girişsiz/iç (scheduler, internalAction, http action) çağıran var mı; varsa KIRILIR = kritik.
   `ActiveProjectContext` super_admin için listActive kullanıyor — dönüş şekli aynı mı.
3. **İzin doğrulaması (10):** gerçek tarih, 366 gün, örtüşme kuralı (yalnız approved engeller, sınır günleri dahil) create ve update'te AYNI
   fonksiyon mu; update yalnız approved, `expectedUpdatedAt` yarış kontrolü, `notes: null` temizler / undefined dokunmaz; kişi/proje sabit.
   `listForRange` dönüş ŞEKLİ ve alanları eskisiyle aynı mı (Vardiyalar takvimi `FunctionReturnType` ile tüketiyor); taşmada hata fırlatması
   takvimi gereksiz kırar mı (5000 aday eşiği gerçekçi mi). `create` eski çağrıda (eski frontend) artık reddedilen girdi hangi hatayla dönüyor.
4. **Sınırlar:** yeni `.collect()` / sınırsız tarama var mı; take/paginate/maximumRowsRead sınırları; aşımda sessiz eksiltme yerine açık
   bayrak/hata mı. `convex-helpers` stream kullanımı doğru mu (filter + paginate maliyeti, index sırası).
5. **11 aktörler:** `actor: "system"` index eşleşmesi (`userId` undefined) doğru mu; `userId` ile birlikte verilince net hata; e-posta maskesi
   gerçekten tam e-posta sızdırmıyor mu (label içine gömülü e-posta dahil).
6. **12 silme önizlemesi:** `getDeletionImpact` ile `remove` aynı hesabı mı kullanıyor; `remove` davranışı değişti mi (refactor regresyonu);
   proje adı trim/boş ret create+update'te.
7. **Geriye uyum:** mevcut imzalar/dönüş alanları korunmuş mu (yeni arg'lar opsiyonel); `api.d.ts` satırları tutarlı mı.
8. CLAUDE.md: any/as any yok, `!` yok, camelCase, `filter((p): p is NonNullable<typeof p> => p !== null)`.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint convex · npx vitest run convex

## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. `npx convex` komutu koşma.

## Rapor
`.claude/orca-specs/reports/review-c2c-backend.md` (bu tek dosyayı yazabilirsin) + worker_done (≤12 satır): bulgular önem sırasıyla
(kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Deploy'a hazır mı: evet/hayır".
