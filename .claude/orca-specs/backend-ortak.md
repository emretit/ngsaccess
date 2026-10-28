## ORTAK KURALLAR (backend refaktör worker'ları)
- Çalışma dizini /Users/emreaydin/ngsaccess (main, worktree YOK). Başka oturumlar aynı dizinde çalışıyor (şu an convex/devices.ts, schema.ts, http.ts, deviceCenter.ts, deviceEvents.ts, adminDevices.ts, lib/deviceConnection.ts commit'siz değişiklik taşıyor). YALNIZ "Ownership" listesindeki dosyalara yaz; git status'taki diğer M dosyalara dokunma/formatlama/geri alma YOK.
- SAF TAŞIMA: registered fonksiyonlar (`api.*` / `internal.*`) AYNI dosyada, AYNI ad + args validator + returns + sarmalayıcı türüyle (authedQuery/adminMutation/internalAction…) ince sarmalayıcı olarak kalır; gövde lib'e taşınır ve sarmalayıcı onu çağırır. `convex/_generated` DEĞİŞMEMELİ (yeni lib dosyası registered fn eklemez; lib dosyasında `query(`/`mutation(`/`action(` tanımı YOK).
- Davranış birebir: yetki/proje kontrolü sırası, ctx.db okuma/yazma sırası ve sayısı, ctx.scheduler.runAfter çağrıları (sıra + argüman), audit kayıtları, hata mesajları (ConvexError metni dahil), dönüş şekli aynı. "Bu arada düzeltme" YOK; bug/şüphe görürsen rapora yaz (file:line).
- Tip: lib fonksiyonları `QueryCtx`/`MutationCtx`/`ActionCtx` (`convex/_generated/server`) alır; `any`/`as any` yasak (unknown + narrowing); `!` non-null yerine erken return; `Doc|null` filtrelerinde `filter((p): p is NonNullable<typeof p> => p !== null)`; alan adları camelCase (snake_case mapping yasak).
- "use node" (2026-10-22 düzeltildi): Convex convex/ altındaki HER dosyayı ayrı paketler. Node-yalnız modül (crypto, ./hikGateway, ./gateway/*) içe aktaran lib dosyasının başına "use node" ŞART (yalnız node action import edebilir); V8 query/mutation tarafından import edilen lib'de "use node" OLMAZ ve node-yalnız import (dolaylı dahil) olmaz. tsc/vitest bunu YAKALAMAZ → kapı: `node /tmp/find-node-leak.mjs` (repo kökünden) çıktısız olmalı.
- Testler: mevcut test assertion'ı ve snapshot'ı DEĞİŞTİRME (`vitest -u` YASAK). Taşınan saf parçalar için küçük golden test ekleyebilirsin.
- Kapılar (hepsini kendin koş, sonuçları rapora yaz):
  1. `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (başlangıç 0)
  2. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 (başlangıç 0; başka worker'ın yarım dosyasından gelen hata varsa yalnız SENİN dosyalarında hata olmadığını doğrula ve dış hatayı dosya:satır raporla)
  3. `node_modules/.bin/eslint <senin dosyaların>` → 0 error
  4. Spec'teki vitest komutu → yeşil
  5. `git status --porcelain convex/_generated` boş
  6. `node /tmp/find-node-leak.mjs` (repo kökünden) → çıktı YOK
- `npx convex ...` / codegen / deploy / DB yazma / commit / push YOK.
- worker_done (≤10 satır): dosya + satır sayıları (önce→sonra), kapı sonuçları, korunan tuhaflıklar/bug şüpheleri (file:line). Aynısını spec'teki rapor yoluna yaz.
