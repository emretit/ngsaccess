# Backend auth teslimi — 19 Ekim 2026

## Uygulanan davranış

MOB-02 backend kapsamı uygulandı: bütün mevcut parola yazma yolları aynı transaction içinde `passwordVersion` artırır. `employeeAuthedQuery` ve `employeeAuthedMutation` tarafından çağrılan gerçek `getCurrentEmployee` her istekte session/auth sürümünü ve parolanın varlığını kontrol eder. Parola değişiminden sonra iki cihazın eski tokenları ilk query/mutation sırasında reddedilir; farklı çalışanın oturumu etkilenmez. Süresi dolmuş veya geçersiz tarihli session fail-closed reddedilir.

`employeeAuth:signIn`, normalize edilmiş e-posta anahtarlı gerçek RateLimiter component kullanır: token bucket kapasitesi 5, dolum 15 dakikada 5; boş bucket bir deneme için 3 dakika bekletir. Başarılı ve başarısız bütün denemeler kotayı tüketir. Beklenen yanlış parola/hesap yok/pasif çalışan/parola yok durumları aynı genel `INVALID_CREDENTIALS` sonucunu döndürür; mutation throw etmediği için limiter write geri alınmaz. `RATE_LIMITED` sonucu pozitif milisaniye bekleme bilgisi içerir. Başarı kotayı sıfırlamaz; süreyle yeniden dolar. Bu hesap bazlı korumadır; gateway/IP genel abuse kontrolü uygulanmış diye sunulmaz.

MOB-04 backend kapsamı uygulandı: auth guard artık production-safe `ConvexError({code,message})` döndürür; kodlar `SESSION_INVALID`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `EMPLOYEE_INACTIVE`. Giriş sonuç kodları `INVALID_CREDENTIALS`, `RATE_LIMITED`. DTO'larda parola/hash/session sürümü veya server stack yoktur. Mobil HTTP 560 yorumlama ve lokalizasyon diğer worker'ların sorumluluğundadır.

Ek yetkili teslim: `employeeAuth:changePassword` mevcut employee session wrapper'ı ile kullanıcının kendi parolasını değiştirir. Kimlik frontend employee ID'den alınmaz. Mevcut parola doğrulanır; yeni parola en az 12 Unicode karakter, en fazla 72 UTF-8 bayt ve eskisinden farklı olmalıdır. Ayrı employee-ID bucket'ı aynı 5/15 dakika sınırını uygular. Başarı bütün mevcut sessionları, çağıran dahil, iptal eder; yeniden giriş gerekir. Recovery/admin setup modeli korunur; yeni anonim reset endpoint'i eklenmedi.

Parola yazma yolları: `employeeAuth:update`, `consumeSetupToken`, `wipeLegacyHashes`, `employees:updateAuthPasswordInternal`, `employees:createAuthInternal` ve yeni `changePassword`. Ortak `writeEmployeePassword` helper'ı hash + revision + setup token tüketimini tek patch içinde yapar; revocation için session taraması yoktur. Metadata-only auth update sessionı iptal etmez. `hashEmployeePassword` Convex mutation runtime'ında timer kullanmayan `bcrypt.hashSync` kullanır; Promise arayüzü korunur.

## Kapanan audit kapsamı

- AUTH-F03 / AUTH-WP03: parola değişiminde eski session revocation backend uygulaması ve gerçek wrapper testleri.
- AUTH-F08 / AUTH-WP08: normalize hesap bazlı kalıcı giriş limiti, eşik/eşzamanlılık/refill/rollback regresyonları.
- AUTH-F06 / AUTH-WP06 ve AUTH-F09 / AUTH-WP09: pasif çalışan ve diğer session hataları için structured backend kodları. İstemci geçişleri ve HTTP 560 E2E bu raporla tek başına kapanmış sayılmaz.
- NET-W01 / MOB-04: backend auth hata sözleşmesi ve doğrulanan minimal me/signIn DTO'ları.

## API sözleşmesi

`employeeAuth:signIn({email,password})` başarı şekli korunur: `{token,expiresAt,employee:{id,projectId,firstName,lastName,email,photoUrl,departmentId,cardNumber}}`. Ek `projectId` null olabilir; `photoUrl` ve `departmentId` null olabilir. Başarısızlık `{error:{code:"INVALID_CREDENTIALS"|"RATE_LIMITED",message,retryAfterMs?}}`; bu bir başarılı mutation zarfındaki başarısız iş sonucudur. HTTP/transport katmanı bunu tokenlı başarı gibi yorumlamamalıdır.

`employeeAuth:me({sessionToken})` aynı employee alanlarını ve nullable `departmentName` döndürür. Explicit returns validator eklendi. `projectId` nullable eklendi. Mevcut web tüketicileri rg ile kontrol edildi: signIn mobil AuthRepository'den, me mobil bootstrap'tan kullanılıyor; web set-password action internal mutationları kullanmaya devam ediyor.

`employeeAuth:changePassword({sessionToken,currentPassword,newPassword})` başarı `{requiresSignIn:true}`, başarısızlık `{error:{code:"INVALID_CREDENTIALS"|"RATE_LIMITED"|"PASSWORD_POLICY",message,retryAfterMs?}}`. Auth guard hataları normal structured ConvexError'dır; yanlış mevcut parola/policy/rate limit iş sonucu olarak döner. UI `PASSWORD_POLICY` için lokalize metin sağlamalı ve başarıdan sonra yerel oturumu sonlandırmalıdır.

`employeeAuth:wipeLegacyHashes` mevcut `{}` çağrısını kabul eder; ek opsiyonel `cursor` alır. Artık en fazla 100 kayıt okur ve `{wiped,isDone,continueCursor}` döner; `wiped` sayfa sayacıdır, `isDone:false` için sonraki çağrıya `cursor:continueCursor` verilmelidir. Bu migration çalıştırılmadı. Hash silme revision artırır ve eski sessionlar iptal edilir.

## Schema: bu teslimde eklenen alanlar ve indeksler

Auth widen:

- `employeeAuth.passwordVersion?: number`
- `employeeSessions.passwordVersion?: number`

Eski auth/session çiftinde eksik sürüm `0` kabul edilir. İlk parola yazımı auth sürümünü `1` yapar; sürümsüz session artık uymaz ve reddedilir. Yeni admin credential kaydı `1` ile başlar; eksik auth sonradan oluşturulduğunda eski sürümsüz tokenlar yeniden geçerli olmaz. Başarılı giriş sessionına mevcut auth sürümü yazılır. Backfill veya production veri mutasyonu yapılmadı; optional alanlar mevcut belgeleri kabul eder. Rollback kararı revision guard'ını kaldırarak yapılmamalıdır; aksi halde iptal edilmiş sessionlar eski backend tarafından tekrar kabul edilebilir.

Koordinatörün diğer mobile backend işleri için ilettiği additive şema değişiklikleri de tek schema sahibi olarak eklendi:

- `employees.mobileVisitorRequestId?`, `mobileVisitorRequestFingerprint?`, `mobileVisitorNoticeUrl?`, `mobileVisitorNoticeVersion?`: string.
- `employees.by_project_host_visitor`: `[projectId,hostEmployeeId,isVisitor]`.
- `employees.by_host_mobile_visitor_request`: `[hostEmployeeId,mobileVisitorRequestId]`.
- `checkInTokens.purpose?: "reader"`, `projectId?: Id<"projects">`, `authVersion?: number` (passwordVersion snapshot için).
- `cardReadings.by_employee_accessTime`: `[employeeId,accessTime]`.
- Yeni `mobileAccessOperations`: `projectId:Id<projects>`, `employeeId:Id<employees>`, `requestId:string`, `deviceId:Id<devices>`, `doorId?:Id<doors>`, `deviceName:string`, `requestedAt:string`, `status:pending|sent|confirmed|failed|unknown`, `errorCode?:string`, `ideOperationId?:Id<idePendingOperations>`, `hikOperationId?:Id<hikPendingOperations>`, `transport:ide_mqtt|hik_local_bridge|hik_gateway`, `actuator:number`.
- `mobileAccessOperations.by_employeeId_and_requestId`: `[employeeId,requestId]`.

Bu şema ekleri access/visitor/attendance API'lerinin tamamlandığı veya donanımda çalıştığı anlamına gelmez; ilgili worker raporları davranış kanıtını sağlar. Önceden mevcut unrelated schema ve employees değişiklikleri korundu.

## Değişen dosyalar

`convex/employeeAuth.ts`, `convex/lib/employeeAuth.ts`, `convex/lib/rateLimit.ts`, yeni `convex/lib/mobileErrors.ts`, `convex/schema.ts`, `convex/employees.ts` yalnız internal password create/update ve helper import noktaları, `convex/employeeAuth.test.ts`, yeni `convex/employeeAuth.mobile.test.ts`, bu rapor. Package/lock kurulumu koordinatör tarafından yapıldı; bu worker shared dependency dosyalarını değiştirmedi.

## Testler ve çalıştırılan kontroller

`node_modules/.bin/vitest run convex/employeeAuth.mobile.test.ts convex/employeeAuth.test.ts`: **2 dosya / 33 test geçti**. Yeni dosya gerçek `convex-test`, gerçek RateLimiter component ve gerçek employeeAuthed wrapper kullanır; auth guard veya limiter mock'lanmaz. Eski DTO test dosyasında dar fake DB ve açık limiter mock'u korunur; güvenlik kanıtı yeni integration test dosyasındadır.

Anlamlı regresyonlar: yanlış parola denemelerinin kalıcı kotası; normalize email; hesap yok/pasif/auth yok/parola yok genel sonucu; beş deneme sınırı ve 3 dakika refill; eşzamanlı 8 denemede 5 kabul edilen credential kontrolü / 3 rate limit; üç internal parola yolunda iki eski cihazın query/mutation reddi; version 7→8; başka çalışanın etkilenmemesi; metadata-only update; orphan legacy tokenların yeni credential ile geri açılmaması; bounded hash retirement cursor; setup eksik/bozuk/eşit sınır expiry; own-password success/re-login/başarısız mevcut parola kotası/policy/multibyte byte sınırı; session expiry/pasif/revoked structured hataları; idempotent logout.

Scoped ESLint: `employeeAuth.ts`, `lib/employeeAuth.ts`, `lib/rateLimit.ts`, `lib/mobileErrors.ts`, `schema.ts` ve iki auth test dosyası temiz. `git diff --check` sahip olunan kod dosyaları için temiz. Broad TypeScript/lint kontrolü koordinatörde; bu worker Flutter/Dart SDK komutu, codegen, deploy veya canlı mutation çalıştırmadı.

## Dürüst kalan yayın kapıları

Gerçek staging HTTP 560 production-redaction zarfı, mobil token temizleme ve password-change sonrası yeniden login E2E cihazda doğrulanmalı. Convex schema/backend ve güncellenmiş mobil tüketiciler birlikte yayımlanmalı; bu rapor deployment yapıldığını söylemez. Convex-test gerçek backend transaction davranışını modelleyen yerel testtir; production yük/OCC ve fiziksel cihaz kanıtı yerine geçmez. Signing/platform credentials, donanım/panel smoke, broad typecheck ve mobil CI/release kontrolleri koordinatörün ortak yayın kapılarıdır. Yeni per-account limitin dışında global gateway abuse koruması ve token refresh/rotation bu teslimde uygulanmış özellik değildir.

Resmi API dayanakları: [Convex application errors](https://docs.convex.dev/functions/error-handling/application-errors), [convex-test](https://docs.convex.dev/testing/convex-test), [resmi RateLimiter component](https://github.com/convex/rate-limiter). Kurulu component API'sindeki seçenek `throws:false` olarak doğrulandı.
