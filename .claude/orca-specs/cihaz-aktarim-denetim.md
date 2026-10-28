# Görev: "Cihazdan verileri çek" backend DENETİMİ (salt okuma)

Repo: /Users/emreaydin/ngsaccess. Ana dizinde çalış, worktree AÇMA. Yazan: Codex worker. Sen denetçisin — DOSYA YAZMA.
Önce oku: `.claude/plan-cihazdan-veri-cek.md` (kararlar K1-K5, K1.1), `.claude/orca-specs/cihaz-aktarim-backend.md` (iş tanımı),
`convex/_generated/ai/guidelines.md`, `CLAUDE.md`.

## Hedef
Backend diff'inde (aşağıdaki dosyalar) doğruluk/güvenlik hatası var mı — her bulgu file:line + somut senaryo (girdi → yanlış sonuç) ile.
Raporu değil diff'i oku: `git diff -- <dosya>` ve yeni dosyalar için doğrudan oku.

## Kapsam (yalnız bunlar)
Yeni: `convex/actions/hikDeviceImport.ts`, `convex/hikDeviceImport.ts`, `convex/lib/hikDeviceImport.ts` (+ testleri, `*.gateway.test.ts`).
Değişen: `convex/cardReadings.ts` (`backfillHikEventRow`), `convex/lib/trDate.ts`, `convex/lib/gatewayBackfill.ts`,
`convex/actions/hikGatewayDevice.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/schema.ts`, `convex/lib/gateway/cards.ts`,
`convex/lib/gateway/biometrics.ts`, `convex/hikvisionSync.ts`, `convex/_generated/api.d.ts` ve ilgili testler.
KAPSAM DIŞI (başka oturum): `src/components/pdks/**`, `src/components/shared/**`, `src/pages/PDKSRecords.tsx`, `src/components/devices/**`.

## Özellikle kontrol et
1. **Cihazdan silme yok**: hiçbir yol cihazdan kişi/kart/parmak izi silmiyor (Emre kuralı). `hikCardless` kişi için eşitleme kart silme/ekleme yapmıyor.
2. **Şablon sızıntısı**: `fingerData` action dışına dönmüyor, loglanmıyor, hata mesajına girmiyor; DB'ye yalnız şifreli (`fingerprintCrypto`).
3. **Yetki**: preview `devices.manage`; import `devices.manage + employees.manage`; parmak izi `biometrics.manage` yoksa şablon atlanıyor.
   Proje erişimi `listProjectIdsForCurrentUser`. Başka projenin cihaz/kişisi okunamıyor/yazılamıyor (IDOR).
4. **Rıza**: `biometricConsentConfirmed=false` → şablon saklanmıyor, rıza kaydı yok. True → `employeeConsents` `biometric_fingerprint` doğru alanlarla.
5. **İdempotentlik / yarış**: aynı import iki kez → ikinci `created: 0`; kart tekilliği (`convex/lib/cardIdentity.ts`) sistem genelinde korunuyor;
   istemci gönderdiği employeeNos'a güvenilmiyor (cihazdan yeniden okunuyor, yalnız `new` oluşuyor).
6. **Erişim kuralı**: "<cihaz> mevcut kişiler" 7/24, cihazın TÜM kapıları; mevcut kural yeniden kullanılıyor; üyelik eklenince normal eşitleme
   tetikleniyor ve kişi aynı employeeNo ile upsert ediliyor (parmak izi cihazda korunuyor).
7. **Backfill**: kimlik `cardNo || employeeNoString`; parmak izi olayı (major 5 / minor 38) `cardReadings`'e doğru kişiyle düşüyor;
   saat kuralı `2026-09-14T15:37:19+08:00` → `2026-09-14T12:37:19.000Z` (yerel kısım + TR); `toUtcISO` davranışı değişmedi (diğer çağıranlar);
   `fromAll` yokken varsayılan son 24 sa aynı; dedupe (aynı olay iki kez eklenmiyor).
8. **"use node"**: Node modülü içe aktaran her convex dosyası `"use node";` ile başlıyor; node dosyasında query/mutation yok.
9. **Convex kuralları**: `any` yok; `filter(Boolean)` yerine type-guard; action'dan `ctx.db` yok; action içinde gereksiz çok sayıda runMutation (tek transaction kuralı).
10. **Zaman aşımı**: büyük cihazda (≥300 kişi) preview kişi başı parmak izi çağrısı → 10 dk action sınırı riski. Sayısal tahminle belirt.

## Kapılar (KENDİN koş, sonuçları rapora yaz)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint convex
node_modules/.bin/vitest run convex
node scripts/find-node-leak.mjs
```
(Arayüz worker'ı paralelde `src/components/devices/**` yazıyor; src tarafı hataları senin kapsamın değil, not düş.)

## YASAKLAR
Dosya yazma/düzenleme YOK. `git add/commit/stash/reset/checkout/restore/push` YOK. `npx convex …` YOK. ssh/curl/canlı DB YOK.

## Rapor (worker_done, ≤15 satır)
Bulgular önem sırasıyla: [YÜKSEK/ORTA/DÜŞÜK] file:line — sorun — senaryo — önerilen düzeltme (1 cümle). Sonra kapı sonuçları.
Bulgu yoksa "bulgu yok" + kapılar. Tahmin değil kanıt: emin olmadığını "DOĞRULANAMADI" diye işaretle.
