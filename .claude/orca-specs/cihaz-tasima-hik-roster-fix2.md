# Fix 2 — Hik roster eşitleme: sessiz kalan 3 durum + asKeyPart taşıma

Önceki iş COMMIT'Lİ: `7e131a49` (spec `.claude/orca-specs/cihaz-tasima-hik-roster.md` + `-fix1.md`).
Denetim raporu: `/tmp/cihaz-tasima-denetim.md` (Claude opus, ENGEL 0, DÜZELTİLMELİ 4). Bu tur 1-3 + bir NOT.

## GIT YASAĞI (önceki turda ihlal edildi)
`git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>` ÇALIŞTIRMA. Değişiklikler çalışma ağacında
commit'siz kalır; commit'i koordinatör/CEO atar. worker_done'dan SONRA hiçbir komut çalıştırma.

## D1 — gateway HTTP 200 + hata gövdesi "boş cihaz" sayılıyor
`convex/actions/hikRosterReconcile.ts:64-76`: `searchPersonOnDevice` (`convex/lib/gateway/persons.ts:223`) yalnız HTTP status'a
bakıyor; çevrimdışı cihazda gateway 200 + statusCode≠1 dönerse `persons:[]`, `total:undefined` → `complete=true`, silme yok,
retry yok. **Düzeltme (persons.ts'e DOKUNMA):** action'da boş sayfa geldiğinde `total` tanımsızsa (özellikle ilk sayfa)
`device_roster_unavailable` say → register zinciri tekrar dener. Gerçekten boş cihaz `totalMatches: 0` döner (tanımlı) →
tamamlandı sayılır. `convex/lib/gateway/core.ts:~260` gateway-level hata ele alışına bak, tutarlı ol. Test: 200 + boş gövde
(total yok) → unavailable + retry zamanlandı; `total: 0` boş cihaz → complete, silme yok.

## D2 — son uyarı kalıcı değil, cihaz çevrimiçi olunca tetik yok
5 deneme bitince `setHikOfflineHint` yazılıyor ama `convex/devices.ts` ISUP durum mutation'ı (~:1009 patch) her online
olayında `hikOfflineHint`'i siliyor ve eşitleme bir daha koşmuyor. **Düzeltme:**
- `convex/schema.ts` devices'a TEK opsiyonel alan: `hikRosterReconcilePending: v.optional(v.boolean())` (yorumla).
- Register zinciri tükenince (D1/D3 dahil tüm "tekrar edilebilir" sonlar) hint + `hikRosterReconcilePending: true` yaz (yeni
  küçük internalMutation, tercihen `convex/hikRosterReconcile.ts` içinde; devices.ts'teki `setHikOfflineHint`'i kullanmaya devam
  edebilirsin).
- `convex/devices.ts` ISUP durum mutation'ında: `online === true` ve `device.hikRosterReconcilePending === true` ise bayrağı
  temizle + `ctx.scheduler.runAfter(0, internal.actions.hikRosterReconcile.reconcileHikDeviceRoster, { deviceId, dryRun:false,
  reason:"register", attempt:0 })`. devices.ts'te YALNIZ bu hunk; başka satıra dokunma. Zincir bitmeden bayrak yazılmadığı için
  eşzamanlı iki koşu olmaz — bunu koru.
- Test: zincir tükenince bayrak+hint; online olayı bayrağı temizleyip tek koşu zamanlıyor; bayrak yokken online olayı zamanlamıyor.

## D3 — kısmi silme hatası (failed>0) sessiz
`convex/actions/hikRosterReconcile.ts:118-129`: register bağlamında `failed > 0` ise aynı attempt zinciriyle tekrar dene
(RETRY_DELAYS), tükenince D2'deki hint + bayrak. `manual` bağlamında davranış aynı kalır. 500 sınırı devam mantığı korunur.
Test: 10 fazladan 3'ü başarısız → retry zamanlandı; tüm denemeler başarısız → bayrak + hint.

## NOT-fix — asKeyPart'ı lib'e taşı
`convex/lib/hikRosterReconcile.ts` `../hikvisionSync` (V8 query modülü) import ediyor → node bundle'ına çekiliyor. `asKeyPart`'ı
yeni `convex/lib/hikKeyPart.ts`'e taşı (davranış birebir), `convex/hikvisionSync.ts` ve `convex/lib/hikRosterReconcile.ts`
oradan import etsin; hikvisionSync'teki export kalksın. `convex/_generated/api.d.ts`'e `lib/hikKeyPart` girişi (alfabetik, elle).

## Ownership (yalnız bunlar)
convex/actions/hikRosterReconcile.ts (+test), convex/lib/hikRosterReconcile.ts (+test), convex/hikRosterReconcile.ts (+test),
convex/lib/hikKeyPart.ts (yeni), convex/hikvisionSync.ts (yalnız asKeyPart import/export), convex/schema.ts (tek alan),
convex/devices.ts (yalnız ISUP online hunk'ı), convex/_generated/api.d.ts.
BAŞKA OTURUMLARIN COMMIT'SİZ İŞİ VAR, DOKUNMA: convex/deviceSyncRuns.ts, convex/ideSync*.ts, convex/employees*.ts,
convex/actions/ideGatewayDevice.ts, convex/accessScheduleTemplates.test.ts, src/components/access-control/**,
convex/lib/gateway/persons.ts.

## Kapsam dışı
Denetim D4 (ehomeID tekilliği, deviceProvision.ts) · registerDeviceOnGateway backend "zaten kayıtlı" kontrolü · ClaimDeviceDialog
metni. Canlı çağrı / `npx convex run` / deploy YOK.

## Kapılar (hepsi yeşil, sayıları rapora yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint <değişen dosyalar>` · TAM `node_modules/.bin/vitest run` (başka oturumun yarım işinden kırmızı varsa
dosya adıyla yaz, düzeltme) · `node scripts/find-node-leak.mjs`.
Rapor: `/tmp/cihaz-tasima-fix2-rapor.md` (≤25 satır, file:line). worker_done ≤10 satır.
