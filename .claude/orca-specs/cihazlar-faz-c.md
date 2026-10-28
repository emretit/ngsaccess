# Görev: Kapı yeniden adlandırılınca okuyucu adı da güncellensin (Convex)

Önce oku: convex/_generated/ai/guidelines.md (Convex kuralları).

Sorun: Okuyucular kapı adıyla açılıyor (convex/lib/deviceHelpers.ts ~216 ve ~283: Hik terminalde `${doorName}`, iki okuyuculu kapıda `${doorName} Giriş` / `${doorName} Çıkış`; convex/doors.ts ~239; convex/readers.ts ~102). `doors.update` (convex/doors.ts ~254) kapının adı değişince okuyuculara dokunmuyor → kapı "Giriş" olunca okuyucu "Kapı 1" kalıyor, ağaçta kapının altında kapı gibi görünüyor.

Hedef (test edilebilir): `doors.update` `name` ile çağrılıp ad gerçekten değişince (trim sonrası eski addan farklı), o kapının okuyucularından (readers by_door index):
- adı tam olarak eski kapı adı olan → yeni kapı adı,
- adı `${eskiAd} Giriş` veya `${eskiAd} Çıkış` olan → `${yeniAd} Giriş` / `${yeniAd} Çıkış`,
- başka ada sahip (kullanıcının elle verdiği) okuyucu → DEĞİŞMEZ.
Güncellenen okuyucularda `updatedAt` yenilenir. Kapının eski `readerName` alanı (legacy) eski kapı adına eşitse ve çağrıda `readerName` verilmemişse o da yeni ada çekilir.

## Ownership (yalnız bunlar)
- convex/doors.ts (yalnız `update` handler'ı ve gerekiyorsa aynı dosyada küçük bir yardımcı fonksiyon)
- Yeni test dosyası: convex/doorRenameReaders.test.ts (mevcut convex testlerinin kurulum desenini izle, ör. convex/doorPlans.test.ts / convex/doorStatusPlan.integration.test.ts; convex-test kullanılıyorsa aynısı)

## Kurallar
- Şema değişikliği YOK, yeni Convex fonksiyonu YOK (codegen gerekmesin), migration YOK.
- Yetki/izolasyon kontrollerinin sırası ve davranışı aynen kalır (rename güncellemesi tüm mevcut kontrollerden SONRA, kapı patch'iyle aynı mutation içinde).
- Hik/IDE cihazına komut kuyruğu üretme; okuyucu adı yalnız ngsaccess içinde görüntü adı.
- Mevcut canlı veriyi düzeltme işi bu görevde YOK (koordinatör ayrıca yapacak).

## Kapılar
- node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
- node_modules/.bin/eslint convex/doors.ts convex/doorRenameReaders.test.ts
- node_modules/.bin/vitest run  (TAM; src testleri convex modüllerini mock'luyor, yalnız convex yetmez — sonuç sayılarını raporla)
- Testte en az: tek okuyucu rename, Giriş/Çıkış sonekli iki okuyucu rename, elle adlandırılmış okuyucu korunur, ad değişmeyince okuyucuya yazılmaz.
