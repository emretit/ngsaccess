# Eşdeğerlik + yetki denetimi — B6 devices.ts (Codex yazdı)

Rol: SALT-OKUMA denetçi. Rapor dışında dosya yazma. commit/push/deploy/DB/`npx convex` YOK. Çalışma dizini /Users/emreaydin/ngsaccess (main, worktree YOK).
Eski hâl `git show HEAD:<dosya>`, yeni hâl çalışma kopyası. Yalnız şu dosyaları denetle: convex/devices.ts, convex/lib/devicePool.ts, YENİ convex/lib/deviceProvision.ts, YENİ convex/devicesMutations.characterization.test.ts. Worker raporu: /tmp/backend-b6-rapor.md (iddialara güvenme, kendin doğrula).

Taşınan 6 authedMutation: create, createIdePanel, createHikDevice (→ lib/deviceProvision.ts), claimDevice, reassignDevice, releaseDevice (→ lib/devicePool.ts). Diğer her şey yerinde kalmalı.

## Sorular
1. Her biri için HEAD gövdesi ile yeni lib fonksiyonunu satır satır karşılaştır (mümkünse programatik normalize edip diff'le): `requirePermission`/`hasPermission`/`getProjectIdsForUser`/`isProjectAllowed`/super_admin dallarının SIRASI, her `ctx.db` okuma/yazma (sıra, sayı, index, alanlar), `ctx.scheduler` çağrıları, audit kayıtları, ConvexError/Error metinleri, dönüş değerleri birebir mi? Yetki kontrolünden önce yazma yapılabilen bir sıra değişikliği ENGEL'dir.
2. Sarmalayıcılar: ad, args validator, returns, sarmalayıcı türü (authedMutation) HEAD ile aynı mı? `ctx` tipi `any`/`as` ile gevşetilmiş mi (yasak)? `ctx.user` lib'e doğru geçiyor mu?
3. Yerinde kalması gerekenler (list, getById, update, remove, updateLastSeen, applyGatewayHeartbeat, applyIsupStatus, confirmIsupOffline, regenerateApiToken, DEVICE_SECRET_FIELDS, internal fn'ler) byte-düzeyinde değişmemiş mi? `claimAdminDeviceCore` değişmemiş mi?
4. Karakterizasyon testleri: 6 mutation'ın her biri için yetkisiz rol reddi, başka proje reddi, mutlu yol tam yazılan alanlar ve (varsa) super_admin/havuz dalı gerçekten var mı? Testler HEAD kodunda da yeşil mi — doğrula: `git stash` YASAK (başka oturumların dosyaları var); bunun yerine HEAD'in devices.ts + devicePool.ts'ini geçici bir export dizinine çıkar (`rm -rf /tmp/b6-head && mkdir /tmp/b6-head && git archive HEAD | tar -x -C /tmp/b6-head && cp convex/devicesMutations.characterization.test.ts /tmp/b6-head/convex/ && ln -s /Users/emreaydin/ngsaccess/node_modules /tmp/b6-head/node_modules`) ve testi orada koş.
5. `lib/deviceProvision.ts` ve `lib/devicePool.ts`: "use node" yok, doğrudan/dolaylı node-yalnız import (crypto, ./hikGateway, ./gateway/*) yok.
6. Worker'ın raporladığı şüpheler (devicePool.ts:265 release okuyucuları bırakıyor, :248 super_admin projesiz cihazı release edemiyor, devices.ts:620 yorum vs davranış) HEAD'de de aynı mı (önceden var olan mı, taşımayla mı geldi)?

## Kapılar (kendin koş)
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json`
- `node_modules/.bin/eslint convex/devices.ts convex/lib/deviceProvision.ts convex/lib/devicePool.ts convex/devicesMutations.characterization.test.ts`
- `node_modules/.bin/vitest run convex/devicesMutations.characterization.test.ts convex/deviceCenter.test.ts convex/e1w4.test.ts convex/lib/deviceHelpers.test.ts`
- `git status --porcelain convex/_generated` boş, `node /tmp/find-node-leak.mjs` çıktısız

Rapor: /tmp/backend-b6-denetim.md — ENGEL/DÜZELT/NOT, file:line, eski vs yeni, öneri; sonda SAF/GÜVENLİ hükmü + kapı özeti.
worker_done (≤10 satır): sayılar + hüküm + kapılar.
