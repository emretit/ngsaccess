# Schema ve auth son entegrasyonu — 19 Ekim 2026

## Bu dispatch'te uygulanan kod

`mobileAccessOperations` yeni tablosuna iki zorunlu alan eklendi: `sessionId: Id<"employeeSessions">` ve `authVersion: number`. `mobileAccess.requestOpen` bu alanları sunucuda doğrulanmış session kaydından üretir; istemci employee/session ID'si yetki kaynağı değildir. Owner11'in gönderim öncesi kontrolü bu bağlantıyla logout, session expiry, parola revocation ve güncel erişim politikasını yeniden değerlendirir. Önceki auth/version, visitor, QR, attendance ve bağımsız web şema değişiklikleri korundu; bu dispatch'in şema farkı yalnız bu iki alandır.

Ek gerçek hata giderildi: `employeeAuth.me`, bozuk bir cross-project `departmentId` ilişkisini izleyerek başka projenin departman adını döndürebiliyordu. Yeni integration testi düzeltme öncesi bu sızıntıyı yeniden üretti. `signIn` ve `me` artık ortak bounded lookup ile yalnız çalışanın projesindeki mevcut departmanı kullanır; projesiz, eksik veya yabancı departman bağlantısında mevcut nullable DTO alanları `null` olur. Başarılı giriş ve kendi projesindeki departman adı korunur; response şekli değişmedi.

## Audit kapsamı ve mevcut davranış

Önceki [09-backend-auth.md](09-backend-auth.md) teslimindeki AUTH-F03/WP03, AUTH-F08/WP08 ve MOB-02/MOB-04 backend revocation, rate limit ve structured hata davranışı korundu. Bu takip, MOB-05 tenant sınırını auth profil zenginleştirmesine de uygular; MOB-06/MOB-09 komut kimliği ile auth revocation entegrasyonunu gerçek endpoint zinciri üzerinden sınar. Bütün mobil veya donanım kabulünün kapandığı iddia edilmez.

Yeni tablo henüz yayımlanmamış mobile artımının parçasıdır; zorunlu alanlar yeni yazarla birlikte yayımlanmalıdır. Canlı veri okunmadı veya değiştirilmedi. Daha eski bir deneysel deployment bu tabloda alanları eksik kayıt içeriyorsa doğrudan schema daraltması yerine ayrı widen/migrate/narrow planı gerekir; eksik session bağlantısı uydurularak backfill yapılmamalıdır. Eski `employeeAuth.passwordVersion?` ve `employeeSessions.passwordVersion?` optional geçişi değişmedi: eksik sürümler yalnız ilk parola yazımına kadar `0` kabul edilir. Revocation guard'ını kaldıran rollback eski tokenları yeniden açabilir.

## Yeni testler

`convex/employeeAuth.mobile.test.ts` içine dört regresyon eklendi. Gerçek `convex-test`, RateLimiter component, employee auth wrapper ve kayıtlı şema kullanılır; auth/erişim guard'ı mock'lanmaz.

- Cross-project departman ilişkisi `me` ve `signIn` ile sızmaz; geçerli kendi departmanı yine gösterilir. Test düzeltmeden önce beklenen biçimde başarısız oldu.
- Gerçek `changePassword`, gerçek `consumeSetupToken` ve gerçek `signOut` ayrı ayrı önceden gönderilebilir legacy-session IDE komutunu durdurur.
- Her üç akışta yeniden giriş + eski requestId replay komutu tekrar gönderilebilir yapmaz; yeni requestId ile yeni niyet gönderilebilir kalır. Logout başka cihazdaki geçerli sessionı korur; hiçbir kapı komutu attendance kaydı üretmez.

Generated API dönüş çıkarımı sonrası eşzamanlı giriş testi `result.error?.code` ile daraltıldı; `any`, non-null assertion veya güvenlik guard bypass eklenmedi.

## Sahipler arası entegrasyon

Owner11 gerekli alanları ve schema yeterliliğini doğruladı; IDE/Hik local bridge/gateway yollarındaki `mobileOperationAllowed` / `mobileQueueAllowed` çağrıları okundu. Owner12 dört visitor alanını ve iki visitor indeksini yeterli buldu; başka schema gereksinimi iletmedi. Attendance sahibine mevcut olay-zamanı indeksinin korunduğu ve son schema taleplerini iletebileceği bildirildi.

İncelemede bulunan yabancı dosya sorunları sahiplerine iletildi, bu worker o dosyaları yamalamadı: `mobileAccessGateway.test.ts` async callback TypeScript hataları sahibi tarafından düzeltildi. IDE kuyruğunda `take(limit)` sonrası revocation filtresinin iptal edilmiş pending kayıtları kalıcı bırakıp sonraki komutları engelleyebilmesi owner11'e somut on kayıt senaryosuyla iletildi; sahibi bounded kalıcı temizlik/poll ilerlemesi ve regresyon üzerinde çalışıyor. Bu takip raporu yabancı kuyruk düzeltmesinin nihai kabul raporu değildir.

## Kontroller

- `node_modules/.bin/vitest run convex/employeeAuth.mobile.test.ts convex/employeeAuth.test.ts`: **2 dosya / 37 test başarılı**.
- Önceki auth/access entegrasyon koşusu: **3 dosya / 59 test başarılı**; owner11 aynı dosyalara ek test yazmaya devam ettiği için toplam test sayısı ortak checkoutta değişebilir.
- Koordinatörün central codegen izni sonrasında `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: **başarılı**; lockstable bildirimi sonrasında tekrar çalıştırılan son koşu da **başarılı**. İlk koşudaki kendi test narrowing hataları düzeltildi; yabancı test hataları sahibine iletilip sonraki koşuda temizlendi.
- Scoped ESLint: `schema.ts`, `employeeAuth.ts`, `lib/employeeAuth.ts`, `lib/mobileErrors.ts`, `employeeAuth.test.ts`, `employeeAuth.mobile.test.ts`: **başarılı**.
- Sahip olunan değişen kodda `git diff --check`: **başarılı**.

Root dependency security sahibi lockstable bildirdi: yerel kurulumda `@convex-dev/auth 0.0.96`, `@auth/core 0.41.3`, `Vitest 4.1.12`, `convex-test 0.0.62` ve `@edge-runtime/vm 5.0.0`. Bu bildirimin ardından auth regresyonları tekrar çalıştırıldı: **2 dosya / 37 test başarılı**. Bu sürümler kurulu checkout kanıtıdır, genel “en güncel sürüm” önerisi değildir. Flutter/Dart/native, codegen, deploy, canlı mutation, commit veya push bu worker tarafından çalıştırılmadı.

## Değişen dosyalar ve açık yayın kapıları

Bu dispatch yalnız `convex/schema.ts`, `convex/employeeAuth.ts`, `convex/employeeAuth.mobile.test.ts` ve bu raporu değiştirdi. Yeni dependency yok; eski rapor09 ve önceki auth implementation değişiklikleri korundu. `signIn`/`me` çağrı imzaları ve nullable alan sözleşmeleri aynıdır.

Production benzeri HTTP560/expiry ve mobil logout-parola değişimi E2E, gerçek panel/signer/native build kontrolleri ortak release kapılarıdır. Yerel testler donanımın fiziksel kapıyı açtığını veya staging/production deployment yapıldığını kanıtlamaz. Kuyruk temizliği owner11 ve coordinator HTTP entegrasyonuyla birlikte doğrulanmalıdır.
