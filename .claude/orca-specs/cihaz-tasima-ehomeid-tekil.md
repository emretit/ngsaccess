# Spec — Hik ehomeID tekilliği (denetim D4)

## GIT YASAĞI
`git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>` ÇALIŞTIRMA. Değişiklikler commit'siz kalır.
worker_done'dan SONRA hiçbir komut çalıştırma.

## Hedef (test edilebilir)
Aynı ehomeID (ISUP Device ID) ile ikinci bir `devices` kaydı oluşturulamaz: Hik cihaz oluşturma, sistemde (herhangi bir projede,
aktif/pasif fark etmez) aynı ehomeID'li başka cihaz varsa açık hata ile reddedilir.

## Bağlam
Denetim raporu `/tmp/cihaz-tasima-denetim.md` D4: `convex/lib/deviceProvision.ts` `createHikDeviceCore` (~:225-260) ve genel
`create` çekirdeği (~:32 `ehomeID` alanı) tekilliğe bakmıyor; `convex/schema.ts:444` `by_ehome_id` index'i var ama kullanılmıyor.
Senaryo: kullanıcı cihazı A'dan silmeden B'de aynı ehomeID ile ekliyor → iki proje aynı fiziksel cihaza yazar, B'nin kayıt
eşitlemesi A kişilerini siler, A'nın senkronu geri yazar → çapraz proje erişimi sürer. Canlıda ehomeID'ler tekil (NGS0001,
NGS0002, NGScikis2026).

## Yapılacaklar
1. Yardımcı: `convex/lib/deviceProvision.ts` içinde (ya da yeni `convex/lib/hikIdentity.ts`) `assertEhomeIdAvailable(ctx,
   ehomeID: string | undefined, exceptDeviceId?: Id<"devices">)`: trim'li değer boşsa geç; `by_ehome_id` ile ara (trim'li değer);
   `exceptDeviceId` dışında kayıt varsa `ConvexError({ code: "HIK_EHOME_ID_IN_USE", message: "Bu Device ID (ehomeID) başka bir
   cihaz kaydında kullanılıyor. Önce eski kaydı silin, sonra tekrar ekleyin." })`. Diğer projenin adını/ID'sini MESAJA KOYMA
   (tenant sızıntısı). Kaydedilen ehomeID trim'li olsun.
2. `createHikDeviceCore` ve genel create çekirdeği (ehomeID alan her yol) — HİÇBİR insert'ten önce çağır.
3. `export` et: `devices.update` (convex/devices.ts) ehomeID değişince aynı yardımcıyı `exceptDeviceId: deviceId` ile çağıracak —
   devices.ts'e BU WORKER DOKUNMAZ (başka worker'da); koordinatör ekleyecek. Rapora çağrının nereye konacağını yaz (file:line).
4. Testler: aynı ehomeID başka projede → ret (insert yok); aynı projede → ret; boş/undefined → geçer; trim (" NGS0001 " = "NGS0001");
   `exceptDeviceId` kendi kaydını engellemez; IDE/other markası etkilenmez.

## Ownership (yalnız bunlar)
convex/lib/deviceProvision.ts, (gerekirse yeni) convex/lib/hikIdentity.ts, ilgili yeni/var olan test dosyaları
(ör. convex/lib/deviceProvision*.test.ts, convex/devicesMutations.characterization.test.ts), yeni lib eklersen
convex/_generated/api.d.ts girişi (alfabetik, elle).
DOKUNMA: convex/devices.ts, convex/schema.ts, convex/*hikRosterReconcile*, convex/hikvisionSync.ts, convex/lib/deviceAssignment.ts
(başka worker/oturum), convex/deviceSyncRuns.ts, convex/ideSync*.ts, convex/employees*.ts, convex/actions/ideGatewayDevice.ts,
src/components/access-control/**.

## Kurallar
`convex/_generated/ai/guidelines.md` oku. TS strict, `any`/`!` yok. Canlı çağrı / deploy YOK.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint <değişen dosyalar>` · `node_modules/.bin/vitest run convex` + değişen testler · `node scripts/find-node-leak.mjs`.
(Tam vitest'i koordinatör koşacak; başka worker aynı anda yazdığı için kırmızı görürsen dosya adıyla yaz.)
Rapor: `/tmp/cihaz-tasima-ehomeid-rapor.md` (≤15 satır, file:line). worker_done ≤10 satır.
