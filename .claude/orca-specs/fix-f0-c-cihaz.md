# FAZ 0-C — Cihaz/IDE: UUID tekilliği (C-01), IDE taşıma geçici engeli (C-02), köprü hata kodu (C-03)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU; kurallar bağlayıcı. Rapor: `/tmp/fix-f0-c-cihaz-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (C-01, C-02, C-03 satırları) + `M2-cihaz.md`.

## Ownership (yalnız bunlar)
`convex/devices.ts`, `convex/lib/deviceProvision.ts`, `convex/lib/deviceAssignment.ts`, `convex/adminDevices.ts`, `convex/ideSync.ts`,
`scripts/lib/ide-mqtt-routing.mjs` (+ varsa yanındaki node testi), `scripts/ide-mqtt-bridge.mjs` (yalnız gerekiyorsa),
`src/components/devices/**` (yalnız yeni hata kodlarının mesaj gösterimi gerekiyorsa), yeni test `convex/fixF0Devices.test.ts`,
mevcut `convex/lib/deviceAssignment.hik.test.ts`, `convex/ideSync.test.ts`, `convex/lib/deviceProvision.ehomeId.test.ts` beklenti güncellemeleri.
DOKUNMA: `convex/schema.ts` (by_ide_uuid index'leri zaten var), `convex/employees.ts`.

## Değişiklikler
1. **C-01 (P0)** — Ortak `assertIdeUuidAvailable(ctx, ideUuid, { exceptDeviceId, exceptAdminDeviceId })` (`lib/deviceProvision.ts`; mevcut
   ehomeID tekillik yardımcısı `assertEhomeIdAvailable` desenini izle): trim edilmiş UUID'yi `devices.by_ide_uuid` ve `adminDevices.by_ide_uuid`
   üzerinde arar; aynı fiziksel cihazın kendi havuz kaydı (atanmış adminDevice ↔ device bağı) hariç başka kayıt varsa
   `ConvexError({ code: "IDE_UUID_IN_USE", message: "Bu IDE panel UUID'si başka bir cihaz kaydında kullanılıyor." })`.
   Çağır: genel `createCore`, `devices.update` (ideUuid set/değişiyorsa), havuzdan claim/atama yolları, `adminDevices` kayıt yolu (zaten
   kontrol varsa ortak yardımcıya bağla). `deviceIdentityError` biçim kontrolü de bu yollarda uygulansın.
2. **C-02 (P0, geçici engel)** — `lib/deviceAssignment.ts`: Hik için var olan `HIK_DEVICE_MOVE_UNSUPPORTED` engelinin (satır ~48, ~113)
   IDE (ideUuid'li) cihazlar için karşılığı: proje değiştiren atama/yeniden atama → `IDE_DEVICE_MOVE_UNSUPPORTED`, mesaj
   "IDE paneli başka projeye taşınamaz; önce paneldeki kişiler silinmeli (yakında). Destek ile iletişime geçin." Release→başka projeye claim yolu
   da kapsansın (Hik engeli hangi yolları kapsıyorsa birebir). Kalıcı taşıma akışı Faz 2'de.
3. **C-03 (P0)** — Köprü panel ret cevabının anlamını korusun:
   - `scripts/lib/ide-mqtt-routing.mjs`: ret mesajında sabit `"panel rejected command"` yerine panelin kodu/mesajı **maskelenmiş** iletilsin
     (parola/token/kart no gibi değerleri sil, 200 karakterle sınırla). Mümkünse ayrı `errorCode` alanı (ör. `already_exists`, `not_found`) ekle.
   - `convex/ideSync.ts` `markAck`: önce `errorCode`'a, yoksa mevcut metin regex'ine (`/already exists/`, `/not found/`) baksın; eski köprü
     sürümüyle geriye uyumlu kalsın (alan opsiyonel).
   - Sözleşme testi: köprü yönlendirme fonksiyonuna "already exists" içeren ret verilince HTTP gövdesi doğru alanları taşır (node testi) ve
     `markAck` bu gövdeyle create→update dönüşümünü yapar (convex testi).
   - Köprünün sunucuya kurulumu ve canlı panelde `create_data` cevabının teyidi koordinatörde (TEYİT GEREK olarak rapora yaz).

## Kabul
- Testler: (a) iki projede aynı ideUuid ile create/update/claim reddedilir, aynı cihazın kendi havuz kaydı reddedilmez; (b) IDE cihazı başka projeye
  atama/yeniden atama reddedilir, aynı projede düzenleme serbest; (c) köprü ret → errorCode/mesaj → markAck create→update; eski metin biçimi de çalışır.
- Mevcut `convex/deviceCenter.test.ts`, `convex/devicesMutations.characterization.test.ts`, `convex/ideSync.test.ts`, `convex/lib/deviceAssignment.hik.test.ts`,
  `convex/lib/deviceProvision.ehomeId.test.ts`, `convex/roles.devices.test.ts` yeşil; `node --test scripts/lib/ide-mqtt-routing.nodetest.mjs` yeşil.
