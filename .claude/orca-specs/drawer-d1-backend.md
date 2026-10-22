# Drawer D1 — Cihaz komutları backend: rol kontrolü, getOverview kotası, sunucu audit'i

Kaynak denetim: `docs/ui-audit-devices-drawer/RAPOR.md` (B2, B3, B6, B19). Emre kararı 2026-10-21: **project_user yalnız kapı açar**; diğer tüm cihaz komutları + cihaz güncelle/sil yönetici (super_admin / project_admin).

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex handler'ları schema alan adlarını olduğu gibi (camelCase) döner. Frontend'de Convex sonucu `any[]`'a açılmaz.
- Convex kuralları: `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok; `take(N)` + sınır.
- Hata/arayüz metinleri Türkçe, sade.
- YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen), DB yazma, `convex/_generated/**` (api.d.ts'e yeni/silinen modül fonksiyonu gerekiyorsa ELLE, mevcut desene uyarak), `mobile/**`, git stash/checkout/reset.

## Hedef (test edilebilir)
(1) project_user rolündeki kullanıcı `remoteOpenDoor` ve `openIdeDoor` dışındaki cihaz komutlarını ve `devices.update` / `devices.remove`'u sunucuda çağıramaz (Türkçe hata). (2) `deviceCenter.getOverview` yalnız cihazın markasına ait kuyruğu okur, her durum sayısı en çok 101 satır okuyarak `{ count, capped }` döner, `done`/`acked` satırlarını hiç okumaz, `recentEvents` yalnız UI alanlarını taşır. (3) Komut audit kaydını istemci değil action'ın kendisi yazar.

## Bağlam (kodda doğrulandı, main 4e2ef07)
- Komutlar `authedAction` (`convex/lib/customFunctions.ts:104`, `ctx.user` enjekte eder). Yetki bugün yalnız proje üyeliği: `internal.users.listProjectIdsForCurrentUser` + `isProjectAllowed`. Rol yardımcısı: `isManager(user)` (`convex/lib/auth.ts:90`).
  - Hik (`convex/actions/hikGatewayDevice.ts`): `fetchDeviceCapabilities:327`, `remoteOpenDoor:367` (project_user AÇIK kalır), `rebootDevice:410`, `fetchDeviceWorkStatus:451`, `backfillDeviceEvents:521`, `reconcileDevice:708`, `captureCardFromDevice:898`, `fetchReaderCfg:1068`.
  - IDE (`convex/actions/ideGatewayDevice.ts`): `openIdeDoor:332` (project_user AÇIK kalır), `triggerPanelSync:370`.
  - `convex/devices.ts:202` `update`, `:319` `remove` = `authedMutation` → yönetici yap (`adminMutation` ya da handler başında `isManager` kontrolü; dosyadaki mevcut desene uy). Not: project_user'a sır alanları boş dönüyor; update'i yöneticiye kapatmak "boş = temizle" silme riskini de kapatır.
- `convex/deviceCenter.ts:104-170`: 8 kuyruk sorgusu (Hik 4 + IDE 4) her zaman `.collect()`; `:131-170` `latest` alanı; `:272` `recentEvents` ham doküman (`rawData` dahil).
- Audit: istemci `api.deviceEvents.recordSystemOperation` (`convex/deviceEvents.ts:25`, authedMutation) çağırıyor (`src/components/devices/DeviceCommandCenter.tsx:216`); `ok`'u istemci söylüyor, `rawData` tüm sonuç (Eşitlik Kontrolü'nde kart numarası listeleri dahil).
- B19: `convex/devices.ts:1251` `hikOfflineHint` = "Gateway: offline" → "Gateway çevrimdışı".
- Heartbeat: `convex/devices.ts:1236-1256` `applyGatewayHeartbeat` her çağrıda değer değişmese de yazıyor → `devices.list` + `getOverview` her seferinde yeniden çalışıyor.

## Değişiklik
1. **Rol (B2):** Yukarıdaki 8 komutta (kapı açma 2'si hariç) proje kontrolünden sonra `if (!isManager(ctx.user)) return { ok:false, error:"Bu işlem için yönetici yetkisi gerekiyor" }` (fonksiyonun mevcut dönüş sözleşmesi throw ise throw et; dönüş tipini bozma). `devices.update` / `devices.remove` yöneticiye. Önce `grep -rn` ile bu fonksiyonların TÜM çağıranlarını bul (src/, mobile/, scripts/, bridge/, infra/); project_user'ın meşru kullandığı bir yer çıkarsa DUR ve `ask` ile sor.
2. **getOverview (B3):** cihaz markasına göre yalnız Hik ya da yalnız IDE kuyruğu; durumlar Hik `pending|processing|failed`, IDE `pending|sent|failed` — her biri `.take(101)` → `{ count: Math.min(n,100), capped: n>100 }`. `done`/`acked` okunmaz ve dönmez. `latest` yalnız UI kullanıyorsa kalır (grep et; kullanılmıyorsa sil). `recentEvents` → `{ _id, label, eventTime, cardNo, category, severity }`. Döndürülen `device` nesnesinden UI'ın kullanmadığı alanları çıkar (`online`, `hikVerifyMode`, `hikLastCfgAt`, `hikDoorStatusPlan` vb. — her birini src/'de grep ederek doğrula). `returns` validator'ı varsa güncelle.
3. **Sunucu audit'i (B6):** `convex/deviceEvents.ts`'e `recordOperationInternal` (internalMutation; `deviceId, label, ok, summary?: string ≤2000`). Her komut action'ı sonucu aldıktan sonra kendisi çağırır; `label` = "<Komut adı>: komut iletildi | sıraya alındı | başarısız". `summary`'ye kart numarası listesi YAZILMAZ (Eşitlik Kontrolü için yalnız sayılar: cihazda N, eksik M, fazla K). Yetkisiz/bulunamadı reddinde kayıt yazma. Public `recordSystemOperation`'ı başka çağıran yoksa (grep: src/, mobile/, scripts/) sil; varsa bırak ve raporla.
4. **Heartbeat (B3 kota):** `applyGatewayHeartbeat` yalnız izlenen alanlardan biri değiştiyse ya da son yazımdan ≥60 sn geçtiyse yazsın. Önce "çevrimiçi" eşiğini bul (src/lib/deviceStatus.ts ve convex'te); eşik 180 sn'den küçükse throttle'ı eşiğin üçte birine indir ve raporla.
5. **B19:** `hikOfflineHint` metni "Gateway çevrimdışı".
6. **Asgari frontend uyumu:** `src/components/devices/DeviceCommandCenter.tsx` içinde YALNIZ derlenmesi için gerekenler: istemci `recordOperation` çağrısını kaldır, yeni kuyruk şekline (`count/capped`, done/acked yok) ve daraltılmış `recentEvents`'e uyarla ("100+" gösterimi). Başka UI değişikliği YOK (D2'nin işi).
7. **Testler:** rol reddi (project_user → 8 komut + update/remove red, kapı açma 2'si izinli), getOverview (marka filtresi, 101+ satırda `capped:true`, done okunmuyor, recentEvents alanları), audit (action kayıt yazar, kart listesi yok), heartbeat throttle. Mevcut test desenini (convex-test) kullan.

## Ownership (yalnız bunlara yaz)
convex/actions/hikGatewayDevice.ts · convex/actions/ideGatewayDevice.ts · convex/deviceCenter.ts · convex/deviceEvents.ts · convex/devices.ts (YALNIZ update/remove sarmalayıcısı, hikOfflineHint, applyGatewayHeartbeat — dosya başka ekiple ortak, başka satıra dokunma) · convex/_generated/api.d.ts (elle, gerekiyorsa) · src/components/devices/DeviceCommandCenter.tsx (yalnız madde 6) · bu dosyaların testleri (yeni test dosyası açabilirsin)

## Kapsam dışı
Drawer arayüz düzenlemeleri (D2) · yeni komut · ISAPI/MQTT protokol değişikliği · köprü (bridge/) · mobile/** · şema değişikliği.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar, rol kontrolü eklenen fonksiyonlar, getOverview yeni şekli, silinen public fn'ler, kapı sayıları, bilinçli kararlar (file:line).
