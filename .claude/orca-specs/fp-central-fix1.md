# FP-Central düzeltme turu 1 — 2026-10-22

## Hedef
`.claude/orca-specs/fp-central-denetim-rapor.md` bulgularından P1-1, P2-1…P2-5 ve P3-1/3/4/5/6 + koordinatör notları kapatılır;
tüm kapılar yeşil kalır. Ana spec: `.claude/orca-specs/fp-central.md` (ownership ve YASAK aynen geçerli).

## Önce oku
Denetim raporu (her bulgunun senaryosu ve önerisi orada), ardından çalışma ağacındaki mevcut diff (`git diff`).

## Düzeltmeler
1. **P1-1 silme retry:** `purgeFingerprintsOnDevices` başarısız snapshot'ları kendini yeniden planlayarak tekrar dener (artan bekleme,
   ör. 1 dk → 5 dk → 30 dk → 2 sa → 12 sa, en fazla ~8 deneme; deneme sayısı argümanda). Ek olarak günlük cron
   (`convex/crons.ts`'e yalnız bu satır; ownership'e eklendi) `deletionEmployeeNo` dolu ve 1 saatten eski satırları sayfalı tarayıp purge
   schedule eder (silinmiş kişinin yetim satırları dahil). Kalıcı başarısızlık device event'te "Parmak izi silme: başarısız (yeniden denenecek)".
   Yetim satır yüzünden `getPushTarget` sonsuza dek bloklanmasın: blok yalnız aynı employeeNo için geçerli olsun ya da purge sonrası açılsın.
2. **P2-1 yarış:** gönderimden ÖNCE cihaz satırını "bekleyen gönderim" olarak yaz (purge snapshot'ının göreceği şekilde); `recordPush`
   reddederse (rıza iptal vb.) cihazdan silmeyi P1-1 retry yoluna devret (sonucu yok sayma).
3. **P2-2 dedupe + kota:** push, cihaz satırı güncelse (`enrolledAt` ≥ şablonun `addedAt`'i, `deletionEmployeeNo` yok, aynı employeeNo)
   ATLAR; `resendFingerprint` için `force: true`. `syncEmployeeDevices` kancasında `listInternal` cihaz döngüsü DIŞINDA kişi başına bir kez
   çağrılır (ya da `getEmployeeWithDevices` dönüşüne `hasFingerprintTemplates` bayrağı); şablonsuz kişide sıfır ek function call.
4. **P2-3 retry kuyruğu:** push başarısızlığında `recordSyncFailure(operation:"addFingerprint", payload:{employeeId, fingerPrintID})`;
   `hikQueueWorker.ts` addFingerprint kolu push'u `runAction` ile bekleyip gerçek sonucu döner (sahte `{ok:true}` yok).
5. **P2-4 roster:** `deviceSync.ts` FP roster bacağında kişi başı `enrollmentTarget` yerine ucuz kontroller (aktif, kart, rıza, modül, cihaz yeteneği);
   kapsam zaten `resolveAuthorizedEmployeeIds`'ten geliyor.
6. **P2-5 1001 satır:** `getPushTarget`/`beginEnrollment` "cihazda bekleyen işlem" kontrolünü tüm cihaz satırlarını taramadan yapsın
   (ör. `by_device` + `pendingUntil` ile indeks ya da sınırlı sorgu); limit aşımında sessiz atlama yerine event. Yeni indeks gerekiyorsa
   yalnız `deviceFingerprintEnrollments`'e EKLEME (silme yok).
7. **P3-1** `fingerprintCrypto.ts` encode: `new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)`.
8. **P3-3** `removeFingerprint` ve `resendFingerprint` için `writeAudit` (mevcut audit deseni; şablon/encData YOK, yalnız kişi, parmak no, cihaz sayısı).
9. **P3-4** UI: `templates` parmak numarasına göre sıralı; payda açıklaması küçük ipucu ("parmak izi destekleyen erişim cihazları").
10. **P3-5** kişi silmede `scheduleFingerprintPurge` tek kez çalışsın (çift purge yok).
11. **P3-6** `removeFingerprintFromDevice`: cihaz silme başarısızsa mesaj "Sistemden silindi; cihazlardan silme yeniden denenecek" (yanıltıcı olmasın).
12. **Koordinatör notu:** `scheduleFingerprintPurge` içinde `for await` ile gezilen sorgu sırasında `ctx.db.delete/patch` yapılmasın —
    önce `.collect()`/`take(n)` ile topla, sonra yaz (`employeeCardChange.ts:29-36`).

## Ownership
Ana spec listesi + `convex/actions/hikQueueWorker.ts` (yalnız FP kolu) + `convex/crons.ts` (yalnız yeni FP purge satırı) + ilgili testler.

## Kapılar (kendin koş, hepsi yeşil)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint src convex` · `npx vitest run` (tam). Her düzeltme için en az bir test (P1-1 retry planlama + cron, P2-1 yarış,
P2-2 dedupe atlama + force, kanca tek sorgu, P2-3 kuyruk gerçek sonuç, P3-5 tek purge).

## YASAK
commit / push / deploy · `npx convex dev|deploy|codegen|env set|run` · DB yazma · worktree · ownership dışı dosya.

## Rapor
`worker_done` ≤10 satır file:line; ayrıntı `/tmp/fp-central-fix1-report.md` (bulgu → düzeltme → test eşlemesi, kapı çıktıları).
