# Görev: Faz C2b backend denetimi (SALT-OKUMA) — 05 gönderim run'ı, 06 ziyaretçi listesi, 07 canlı izleme, 09 vardiya atama
Repo: /Users/emreaydin/ngsaccess. Codex worker'ları yazdı (spec'ler `.claude/orca-specs/c2b-common.md`, `c2b-0{5,6,7,9}-api.md`; raporlar
`.claude/orca-specs/reports/c2b-0{5,6,7,9}-api.md`). Bağımsız denetçisin; raporu değil DİFF'i oku: `git diff -- convex` + `git status --short convex`
(yeni dosyalar). Koordinatör ekledi (`convex/schema.ts`): deviceSyncRuns + deviceSyncRunTargets tabloları; hik/idePendingOperations'a opsiyonel
`runId` + `by_run_device`; cardReadings `by_project_employee_time`; shiftAssignments `by_project_end`, `by_employee_end`. HARİÇ: mobile/**.
Bu backend canlı Convex'e frontend'den ÖNCE deploy edilebilir; canlıdaki ESKİ frontend yeni backend'i çağırmaya devam edecek.
Convex kuralları: `convex/_generated/ai/guidelines.md`.

## Özellikle bak
1. **Yetki/IDOR:** her yeni public fonksiyon (`deviceSyncRuns.*`, `accessRules.listRuleMembers`, `visitors.listPage/summary/getDetail`,
   `cardReadings.listLiveSince/listFiltered/getReading/assignCardFromReading`, `shifts.previewBulkAssign/assignmentDeleteImpact/definitionUsage`)
   kaynak kaydın projesini `resolveProjectScope` ile doğruluyor mu; ID ile başka projenin verisi okunabiliyor/yazılabiliyor mu.
   Yazma işlemleri doğru wrapper'da mı (admin gerekenler adminMutation/adminAction).
2. **assignCardFromReading:** yarış kontrolü (`expectedCurrentCard`), duplicate kart, aynı proje, QR/mobil/biyometrik kaynaklı okumayı reddetme,
   eski okumanın değişmemesi, audit kaydı, cihaz senkronunun tetiklenmesi; `ctx.runMutation(api.employees.update)` iç çağrıda yetki korunuyor mu.
3. **Gönderim run'ı (05):** Hik `done` asla `verified` sayılmıyor mu; IDE idempotency ile birleşen op'lar hedefte dürüst mü; tüm cihazlar
   (Hik + IDE) hedefleniyor mu, skipped sebepleri; OCC: çok hedefli güncellemede tek belgeye yoğun yazma var mı; eski
   `backfillAllRulesToDevices` / `syncWeekPlanToDevices` / `syncRuleToIdePanelsAndWait` davranışı değişti mi.
4. **Sınırlar:** yeni `.collect()` / sınırsız tarama var mı; `take`/paginate sınırları; aşımda sessiz eksiltme yerine açık bayrak/hata mı.
   cardReadings yoğun tablo — canlı watermark sorgusu proje kapsamlı ve sınırlı mı.
5. **Durum mantığı:** 06 ziyaretçi durum sınıflaması (TR saat, expiry, pasif) tek yerde mi; 09 çakışma/izin/tatil/gece vardiyası mantığı
   `bulkAssignShift` eski davranışını (çakışanları atla, diğerlerini kaydet) koruyor mu; preview ile apply aynı fonksiyonu mu kullanıyor.
6. **Geriye uyum:** mevcut fonksiyon imzaları ve dönüş alanları korunmuş mu (yeni arg'lar opsiyonel); `accessRules.getDetails` sınırı
   eski frontend'in düzenleme formunu bozuyor mu (üye eksik kaydedilip silinme riski = KRİTİK).
7. **KVKK:** pdksSource sınıflaması yeniden yazılmamış, import edilmiş mi; biyometrik okuma PDKS'e sızan yeni yol var mı (`grep -rn cardReadings convex`).
8. CLAUDE.md: any/as any yok, `!` yok, camelCase, `filter((p): p is NonNullable<typeof p> => p !== null)`.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint convex · npx vitest run

## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. `npx convex` komutu koşma.

## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Deploy'a hazır mı: evet/hayır".
