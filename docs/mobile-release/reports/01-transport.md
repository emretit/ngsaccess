# 01 — Transport, yapılandırma ve güvenli yerel diagnostics

19 Ekim 2026. Gerçek kod ve regresyon testleri eklendi; Flutter/Dart komutları koordinatörün SDK kilidi nedeniyle bu worker tarafından **çalıştırılmadı**. Bu rapor transport sahibinin teslimatıdır; uygulamanın bütünü, imzalı paket veya canlı panel için yayın onayı değildir.

## Uygulanan davranış ve audit kapsamı

| İş / bulgu | Uygulanan sonuç | Kapanış sınırı |
| --- | --- | --- |
| MOB-04 / NET-F01 | HTTP 560 UDF zarfı altyapı 5xx'ten önce çözülür; structured `errorData.code` önceliklidir. Auth, iş kuralı ve protocol hataları ayrıldı. 560 ve iş/protocol hataları retry edilmez. | Transport düzeltmesi ve regresyon kodu hazır; backend structured kodları ayrı sahip, staging expiry E2E henüz yok. |
| MOB-04 / NET-F06 | Eksik `value`, bozuk zarf/JSON ve bozuk özel Convex sayı kodlamaları `ProtocolError` olur; object/list helper'ları yanlış top-level shape'i reddeder. Null map alanları request ve response'ta korunur. | HTTP sınırı kapatıldı; domain DTO alan kontrolleri ve mevcut veriyi koruyan provider davranışı diğer sahiplerin kapsamıdır. |
| MOB-04 / NET-F07 | Transport raw body/message saklamaz; bilinmeyen mesajlar güvenli genel iş hatası olur. Bütün AppError `userMessage`, `debugMessage`, `toString()` yüzeyleri sır taşımayan metinler üretir. `toString()` eski UI catch siteleri için kullanıcı metnine döner. | Transport/error katmanı kapatıldı; AppError dışı UI catch sitelerini bu worker değiştirmedi. |
| MOB-03 transport parçası | Her istek body/token/auth nesli snapshot'ı alır. Eski employee isteği yeni oturumda başarı veya AuthExpiredError üretemez; `SESSION_CHANGED` olur. Aynı token yeniden kurulsa bile yeni nesildir. Aynı nesilde callback en fazla bir kere çağrılır. | Provider/router/saklama nesli diğer sahiplerdedir. |
| MOB-20 / NET-F08 | Gömülü deployment kaldırıldı. HTTPS URL, credentials/path/query/fragment, host/port doğrulanır. Release `CONVEX_URL`, `APP_ENV=staging|production`, exact `CONVEX_ALLOWED_HOST` ister; eksikte client oluşmaz ve request çıkmaz. | Transport startup doğrulaması kapatıldı; signing, CI ve gerçek paket hedef kanıtı ayrı sahiplerdedir. |
| MOB-23 / PLAT-WP08 transport parçası | Bounded, memory-only, rate limited yerel diagnostics; güvenli operation/kategori/referans/süre/deneme/platform/build/runtime metadata ve temizlenmiş stack konumları. HTTP hata yolu bağlıdır. | Root framework/platform hook bağlantısı ayrı sahibine iletildi; harici telemetry, kalıcı saklama, sembolizasyon ve gerçek release crash doğrulaması yapılmadı. |

Query'ler yalnız network/timeout/gerçek altyapı 5xx için sınırlı retry yapar. Mutation/action varsayılanı tek denemedir; mevcut açık `retry:true` API'si uyumluluk için korundu ve yalnız caller'ın idempotent olduğunu bildiği işlemlerde kullanılmalıdır. 401 oturum hatası, 403 erişim reddi, 429 rate limit'tir; 403 yeni oturumu kapatmaz. Redakte plain UDF hataları genel iş hatasıdır; hata metninde rastgele substring aramasıyla auth sonucu üretilmez. Legacy fallback yalnız allowlist'teki tam ilk satırı ve standart `Uncaught Error: ` önekini tanır.

Terminal structured auth kodları: `SESSION_INVALID`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `EMPLOYEE_INACTIVE` ve uyumluluk alias'ları. İş kodlarında yalnız allowlist sunulur; `INVALID_CREDENTIALS`, `MOBILE_PASSWORD_NOT_SET`, `ACCESS_DENIED`, `RATE_LIMITED`, `SESSION_STORAGE_FAILED`, `PASSWORD_POLICY`, `INVALID_QR`, `INVALID_DEVICE` desteklenir. Bilinmeyen server kod/metni UI veya diagnostics'e yansıtılmaz. Structured rate-limit metadata'sı yalnız 0–86400000 aralığındaki integer `retryAfterMs` olarak kabul edilir.

## Dosyalar

Yalnız aşağıdaki izinli dosyalarda değişiklik yaptım:

- `mobile/lib/config/convex_config.dart`
- `mobile/lib/core/errors.dart`
- `mobile/lib/core/error_localizer.dart`
- `mobile/lib/core/response_decoder.dart` (yeni)
- `mobile/lib/core/safe_diagnostics.dart` (yeni)
- `mobile/test/config/convex_config_test.dart`
- `mobile/test/core/errors_test.dart`
- `mobile/test/core/response_decoder_test.dart` (yeni)
- `mobile/test/core/safe_diagnostics_test.dart` (yeni)
- `mobile/test/core/error_localizer_test.dart` (yeni)
- Bu rapor.

Önceden bulunan web/Convex değişiklikleri ve diğer sahiplerin dosyaları korunmuştur. Yeni dependency veya pubspec değişikliği yoktur.

## Entegrasyon API'leri / bağımlılıklar

Mevcut query/mutation/action/employeeQuery/employeeMutation imzaları ve JSON String dönüş tipi korundu.

- `HttpConvexClient.employeeAction({required String name, required Map<String,dynamic> args, bool retry=false})`: employee token'ı caller arg'ının üzerine güvenli biçimde eklenir.
- `HttpConvexClient.deploymentUrl`: doğrulanmış origin; yerel hesap/proje/backend preference namespace'i içindir, UI/log çıktısı değildir.
- `clearOnAuthExpired([AuthExpiryCallback? callback])`: verilen eski callback yalnız kendi kaydını temizler; argümansız çağrı mevcut callback'i temizler.
- `HttpConvexClient.close()` ve `ConvexConfig.close()`: idempotent HTTP kapatma, polling iptali, callback/auth temizliği. Auth değişimi aktif polling'i de kapatır; yeni sahip aboneliği yeniden kurar.
- `BusinessError(..., int? retryAfterMs)` geriye uyumlu ek alandır. `ProtocolError` ve `ConfigurationError`, mevcut exhaustive AppError switch'lerinde `BusinessError` kolunca kapsanan alt türlerdir.
- `decodeResponseObject(String)` → `Map<String,Object?>`, `decodeResponseList(String)` → `List<Object?>`; shape uyuşmazlığında `ProtocolError`.
- `SafeDiagnostics.instance.record(error, stack: stack, operation: DiagnosticOperation.framework/platform/bootstrap)` root hook yüzeyi; `events` salt okunur snapshot, `clear()` yerel geçmişi siler. HTTP operation türleri query/mutation/action otomatik kaydedilir. Request/function adı, argüman, response body, exception mesajı, kimlik ve token kayıt API'sine alınmaz.
- `APP_VERSION`, `BUILD_NUMBER`, `FLUTTER_VERSION` opsiyonel compile metadata; numeric/semver allowlist dışı veya eksik değer `unknown` olur. Dart sürümü runtime'dan güvenli sürüm parçası ile alınır. APP_ENV yalnız sabit allowlist'ten kayda girer.
- TR/EN `errorRateLimited`, `errorSessionStorageFailed`, `errorProtocol`, `errorPasswordPolicy` l10n sahibi tarafından eklendi; bu worker global ARB/generated dosyalarını değiştirmedi.

## Yazılan regresyonlar

- HTTP 200/560 structured auth/business; redakte ve legacy plain hatalar; structured kodun metne önceliği; `SESSION_REVOKED`/pasif çalışan terminal auth.
- 401/403/429/503 ayrımı; 560 ve iş hatasında tek istek; eşzamanlı expiry'de tek callback; sınırlı query retry, mutation/action default tek deneme.
- Employee action endpoint'i, token override koruması, explicit null map alanları.
- Eksik/boş/invalid URL, HTTP şeması, credentials/path/query/fragment, bozuk host/port; release ENV ve exact host; development env ve trailing slash.
- Bozuk JSON/zarf/özel sayı kodlaması, eksik success value; object/list shape helper'ları.
- Completer kontrollü A-request → logout → B-session → geç 200/401/560 sırası; aynı token yeniden kurulunca eski nesil iptali; close sırasında geç response/polling; callback owner temizliği.
- Sentetik sır/PII marker'larının bütün hata string yüzeylerinden, diagnostics'ten ve TR/EN widget çıktısından dışlanması; güvenli stack konumu; kapasite/rate limit; diagnostics arızasının caller'a taşınmaması.

## Kontroller ve dürüst açık engeller

- `git diff --check` yalnız sahipli tracked dosyalarda temiz; yeni dosyaların trailing whitespace/son newline denetimi de yapıldı.
- Kaynak incelemesinde gömülü hedef, transport debugPrint/raw body kaydı ve sınırsız hata metni sunumu kaldırıldığı doğrulandı.
- **Çalıştırılmayan:** Flutter/Dart test, analyze, format, pub get, gen-l10n, build, pod/Gradle. Koordinatör SDK kilidinin sahibidir; beş test dosyası ve analyze/format için arayüz/teslim mesajları erkenden gönderildi. Bu worker testler geçti iddiasında bulunmaz.
- Canlı/production backend'e HTTP çağrısı, production mutation, deploy, commit/push veya mağaza gönderimi yapılmadı; gerçek secret/env değerleri okunmadı veya rapora taşınmadı.
- Gerçek staging auth expiry E2E, native release diagnostics/symbolization, signer, kamera/kapı ve fiziksel cihaz testleri bu teslimatın kanıtı değildir; yayın kabulünde ayrıca gerekir.
- Compatibility JSON String API, non-finite Convex Float64 değerlerini temsil edemez; bunlar raw JSON hatası yerine güvenli ProtocolError olur. Domain DTO'lar sonlu sayı kullanmalıdır.

Protokol, kurulu resmi SDK `node_modules/convex/src/browser/http_client.ts` (560 ayrı UDF kodu / errorData çözümü) ve resmi [Convex application errors](https://docs.convex.dev/functions/error-handling/application-errors) belgesiyle karşılaştırıldı; Convex backend okumaları öncesinde `convex/_generated/ai/guidelines.md` okundu.
