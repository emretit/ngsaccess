# FIX1 — Faz 4-A saklama: Hik sentinel kilidi + aşama kapasitesi + bitiş tarihli başarısız işlerin korunması

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB). Rapor: `/tmp/fix-f4-a-fix1-rapor.md`.
Denetim raporu: `/tmp/fix-f4-a-saklama-denetim.md` (bulgu 1 + 2 ŞART; NOT 5 koordinatör kararıyla ŞART). Önceki iş: `.claude/orca-specs/fix-f4-a-saklama.md`, rapor `/tmp/fix-f4-a-saklama-rapor.md`.

## Ownership
`convex/privacyRetention.ts`, `convex/retention.test.ts`, `convex/crons.ts` (yalnız saklama cron satırları). OKU ama DOKUNMA: `convex/hikvisionSync.ts`, `convex/ideSync.ts`, `convex/schema.ts`. Başka dosya YOK (gerekirse `ask`).
Aynı ağaçta başka worker/oturum var (http/openaiChat/alarms/biometric…, pdks/reports) — onlara dokunma.

## Değişiklikler
1. **Bulgu 1** — `privacyRetention.ts` Hik `lastUpdate` (~:202): `nextRetryAt` sentinel'i (`Number.MAX_SAFE_INTEGER`, hikvisionSync.ts:817/823/1047) ve `runAt`'ten büyük (gelecekteki) değerler lastUpdate'e KATILMASIN. Aynı mantığı IDE (~:217) için de uygula (gelecekteki nextRetryAt yok sayılır).
   Test: sentinel'li done ve failed Hik işi 30 gün sonra SİLİNİR; 200+ sentinel'li eski kayıt index başındayken arkadaki kayıtlar da silinir (kilit yok).
2. **Bulgu 2 (kapasite)** — tek zincir yerine üç bağımsız grup, her biri kendi ≤20 çağrılık zinciriyle ve kendi cron'uyla:
   (a) operasyonlar: Hik done/failed, IDE acked/failed, deviceSyncRuns+targets — UTC 00:40 (mevcut satır);
   (b) deviceEvents — UTC 00:50; (c) erişim: checkInTokens (used/expired), employeeSessions, mobileAccessOperations — UTC 00:55.
   Zincir grup sınırını geçmez; "kalan her aşamaya 1 çağrı ayır" kuralı grup içinde kalır. Mevcut cron'larla çakışma yok (01:00 ve 02:00 UTC'de başka işler var — dokunma).
   Test: deviceEvents'te 450 eski kayıt → kendi zincirinde 200/200/50 (operasyon backlog'u olsa bile); her grup ≤20 çağrı.
3. **NOT 5 (koordinatör kararı)** — dismissedAt'siz başarısız işlerden yalnız `delete*` değil, kişi/kullanıcı erişimini güncelleyen işler de (Hik kişi update/upsert türü, IDE `upsertUser` türü — gerçek literal'leri hikvisionSync.ts/ideSync.ts'ten oku, rapora yaz) SİLİNMEZ. Gerekçe: bitiş tarihi cihaza gitmediyse yönetici uyarısı kaybolmamalı.
   Test: failed + dismissedAt yok + bu tür → 30 gün sonra korunur; dismissedAt varsa silinir.

## Kabul
- Kapılar: tsc app + convex 0, eslint (değişen dosyalar) 0, `vitest run convex/retention.test.ts convex/privacyRetention*.test.ts convex/cardReadingRetention*.test.ts convex/emailVerification.test.ts` yeşil, `node scripts/find-node-leak.mjs` temiz.
- Rapor ≤40 satır, file:line; `worker_done` ≤10 satır + `--report-path`.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
