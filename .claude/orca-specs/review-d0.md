# Görev: Dalga 0 kod denetimi (SALT-OKUMA)

Repo: /Users/emreaydin/ngsaccess (React + Convex). Codex worker'ları Dalga 0'ı uyguladı; sen öbür aileden bağımsız denetçisin. Raporu değil DİFF'i oku: `git diff -- . ':!mobile' ':!convex/lib/cardReadingAudit.ts'` + yeni dosyalar (`git status --porcelain` içinde `??` olan convex/lib/dashboardActivity*.ts, convex/lib/adminGuards.ts, convex/adminSettingsGuards.test.ts). Bağlam: docs/ux-audit/00_OZET_VE_YOL_HARITASI.md §5 Dalga 0 + §6 kullanıcı kararları; spec'ler .claude/orca-specs/d0-*.md.

## Bak
1. Doğruluk: her bulgu ID'si (SHL-01..07,10,22,35 · ADM-01,03,09,11,20 · DEV-07,19,22 · ACC-03,10) gerçekten düzeldi mi, yeni hata üretildi mi (null cihaz, boş liste, yarış, TR saat dilimi).
2. Yetki/güvenlik: dashboard `projectId` argümanı erişim doğrulaması (başka projenin verisi okunabilir mi?), users.updateRole/deleteUser guard'ları, projects.remove engel + temizlik (yanlış veri silinebilir mi? auditLog korunuyor mu?), devices remove/reassign/release okuma geçmişini koruyor mu. Bilinen not: havuza alınıp başka projeye verilen cihazda `convex/cardReadings.ts:157` eski projenin tanımsız kart okumasını döndürebilir — etkisini değerlendir.
3. Convex: index kullanımı, tam tablo taraması, okuma limiti riski (projects.remove 21 tablo × take(101)), `convex/_generated/ai/guidelines.md` ihlali.
4. Proje kuralları (CLAUDE.md): `any`/`as any` yok, `!` yok, yerel tip kopyası yok, camelCase.
5. getPdksStats (PDKS sayfası) davranışı değişmemiş olmalı.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run

## YASAK
Hiçbir dosyayı düzenleme. commit/push/deploy/DB YOK.

## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), her biri file:line + 1 cümle + önerilen düzeltme. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
