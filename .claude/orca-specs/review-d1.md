# Görev: Dalga 1 ortak altyapı denetimi (SALT-OKUMA)

Repo: /Users/emreaydin/ngsaccess. Codex worker ortak UX altyapısını yazdı (spec: .claude/orca-specs/d1-foundation.md); sen bağımsız denetçisin. DİFF'i oku: `git diff -- . ':!mobile' ':!convex/lib/cardReadingAudit.ts'` + `git status --porcelain` içindeki yeni (`??`) dosyalar. Belge: docs/ux-audit/DESIGN_SYSTEM.md.

## Bak
1. API tasarımı: Dalga 2'de 4-5 worker bu parçaları tüketecek — resolveProjectScope, useActiveProjectScope, notify/errorMessage, useAsyncAction/asyncGuard, nullablePatch.toPatch, ConfirmDestructive, StatusBadge/statusTone, SectionSkeleton. İsimler/imzalar net mi, yanlış kullanıma açık mı, belge kodla uyumlu mu?
2. Doğruluk: resolveProjectScope erişim doğrulaması (başka projenin verisi okunabilir mi; super_admin davranışı dashboard'daki eski `dashboardProjectIds` ile aynı mı), nullablePatch null/undefined sözleşmesi Convex patch semantiğiyle uyumlu mu, useAsyncAction uçuş guard'ı + hata durumunda form açık kalıyor mu, ConfirmDestructive hata/pending davranışı, 3 eski native confirm yerinin davranışı korunmuş mu (BridgeIntegrationCard, AdminDeviceDialog, AdminDevicesPanel).
3. React: hook kuralları, gereksiz render, AlertDialog erişilebilirliği (focus, Escape, pending'de kapanma).
4. CLAUDE.md kuralları: any/as any yok, ! yok, yerel tip kopyası yok.
Not: koordinatör AdminDevicesPanel/AdminDeviceDialog metinlerini "okuma geçmişi korunur" olarak düzeltti (adminDevices.remove → purgeDeviceCascade artık okumaları silmiyor) — doğrula.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run

## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK.

## worker_done (≤12 satır)
Bulgular önem sırasıyla, file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
