# Mobil core/auth/history entegrasyon düzeltmeleri

19 Ekim 2026. Task `task_f6ac1b637c76`, dispatch `ctx_a8ea6b1e008d`.

Bu teslim önceki worker'ların uygulamalarını yeniden yazmaz; devredilmiş 01/02/04 dosya sahipliği altında merkezi analyze/test kayıtlarındaki somut entegrasyon hatalarını düzeltir. Önceden mevcut web/Convex ve diğer mobil sahiplerin değişiklikleri korundu. Son hedef talimatına göre bu rapor 18 numaralı istemci entegrasyon raporudur; mevcut `09-backend-auth.md` backend teslim kaydı değiştirilmedi.

## Uygulanan değişiklikler

- `normalizeBusinessCode` artık `TARGET_NOT_ALLOWED`, `DOOR_REQUIRED`, `DEVICE_INACTIVE`, `DOOR_INACTIVE`, `ACCESS_EPOCH_DENIED`, `SCHEDULE_DENIED`, `TARGET_UNSUPPORTED`, `TRANSPORT_UNSUPPORTED`, `ACCESS_GRAPH_LIMIT`, `INVALID_REQUEST_ID`, `REQUEST_TARGET_MISMATCH`, `OPERATION_NOT_FOUND`, `OPERATION_STORAGE_FAILED`, `OPERATION_UNRESOLVED` ve `READER_REQUIRED` kodlarını aynen korur. Bunlar `BUSINESS_ERROR` altında kaybolmaz. Bilinmeyen kodlar güvenli genel sonuç olarak kalır.
- `BusinessError.isAccessDenied` sadece bilinen ret kodlarını ortak güvenli sunuma bağlar; `code` ve `safeCode` değişmez. Yetki/aktiflik/schedule/kapı-okuyucu gereksinimi/uyumsuz hedef/transport/erişim grafiği retleri mevcut `accessDenied` TR/EN mesajını kullanır. `INVALID_REQUEST_ID`, `OPERATION_NOT_FOUND` ve yerel saklama/uzlaşma hataları kesin ret diye sunulmaz; güvenli genel hata metni kullanır. Yeni ARB getter veya bağımlılık gerekmez.
- Auth provider testine doğrudan `SignInResult` importu eklendi. Login widget testlerinin async sahibi provider, `setUp` dış zaman alanı yerine her widget testinin fake-async alanında oluşturulur; seri `_effects` Future zinciri `pump` tarafından ilerletilebilir. E-posta/parola doğrulama, gerçek login dokunması, tek uçuş, hata snackbar'ı, secure persistence, A/B session yarışları ve dispose sonrası login sonucu beklentileri korunur.
- Localizer testleri gerçek `Scaffold`/Material metin bağlamında ve scroll alanında mount edilir; önceki çıplak Column'un debug metin stili kaynaklı fatal overflow'u giderilir. Ham gövde/exception/sınıf adı görünmeme beklentileri ve exception kontrolü korunur.
- Geçmiş takviminin etkileşim anahtarı, marker altında kalan görsel Container yerine gerçek InkWell'e taşındı. Takvim regresyonu gerçek dokunmayı sürdürür; UTC/local bileşen günü, kayıt sayısı semantiği ve seçilen gün beklentileri korunur. Testin SemanticsHandle'ı `finally` içinde, widget testinin bitiş doğrulamasından önce kapatılır.
- Devredilen core/auth/history kapsamındaki raporlanmış multiline-if ve çoklu alt çizgi lint bilgileri düzeltildi.

## Audit kapsamı

Bu değişiklikler MOB-04 / NET-F01,F06,F07 / NET-W01,W05 kapsamında tipli iş hatası ve güvenli kullanıcı metni entegrasyonunu tamamlar; MOB-06/09 operasyon sahibinin kesin ret ile belirsiz sonuç ayrımını korur. `READER_REQUIRED` kodunun kaybolmasıyla oluşan attendance regresyonunun kaynak nedeni giderildi. AUTH-F04/WP04 ve MOB-03 mevcut yarış korumaları korunup geç hatırlanan e-posta için iki ek lifecycle regresyonu yazıldı. AH-F01/W01 / MOB-11 takvim regresyonundaki dokunma ve semantik yaşam döngüsü engelleri düzeltildi; tüm audit veya yayın kabul matrisinin geçtiği iddia edilmez.

## Arayüzler ve koordinasyon

Yeni public salt-okunur getter: `BusinessError.isAccessDenied: bool`. Mevcut constructor, `code`, `safeCode`, `userMessage`, HTTP/client ve auth repository API'leri korunur. Operasyon sahibi `ctx_fe481587fd90` kod koruma ve sunum sözleşmesinden erken ve kod indikten sonra haberdar edildi. L10n sahibi 08'in dosyaları değiştirilmedi. Backend/şema/endpoint, dependency/pubspec, composition root, codegen veya diğer aktif sahiplerin dosyalarında değişiklik yoktur.

AuthProvider epoch ve serialized persistence guard'ları, HttpConvexClient generation guard'ı ve güvenli SessionStore sınırı kaynak üzerinden yeniden incelendi. Parola hatırlama veya ham hata gövdesi sunma yolu eklenmedi; credential değerleri rapora/teşhise taşınmadı. Bu dispatch backend dosyası okumadı veya değiştirmedi.

## Bu dispatch'in değiştirdiği dosyalar

- `mobile/lib/core/errors.dart`
- `mobile/lib/core/error_localizer.dart`
- `mobile/lib/core/safe_diagnostics.dart`
- `mobile/lib/providers/auth_provider.dart`
- `mobile/lib/screens/auth/login_screen.dart`
- `mobile/lib/screens/history/history_screen.dart`
- `mobile/lib/widgets/history/history_calendar.dart`
- `mobile/test/auth_fakes.dart`
- `mobile/test/config/convex_config_test.dart`
- `mobile/test/core/errors_test.dart`
- `mobile/test/core/error_localizer_test.dart`
- `mobile/test/core/response_decoder_test.dart`
- `mobile/test/providers/auth_provider_test.dart`
- `mobile/test/widgets/login_screen_test.dart`
- `mobile/test/widgets/forgot_password_screen_test.dart`
- `mobile/test/widgets/history_widgets_test.dart`
- Bu rapor.

## Test kaynağı ve doğrulama

34 yeni regresyon vakası yazıldı: 26 adet HTTP 200/560 structured operasyon kodu decode senaryosu; 2 adet kesin kod/safe presentation/unknown redaksiyon senaryosu; TR/EN için 2 adet yerelleştirilmiş ret ve genel recovery hata widget senaryosu; 2 adet gerçek HttpConvexClient sınırında schedule reddinin tek HTTP denemesi üretmesi ve oturumu sonlandırmaması; 2 adet geç remembered-email sonucunun kullanıcının düzenlediği e-postayı değiştirmemesi veya dispose sonrası widget'a yazmaması. Mevcut lokalizasyon veri sızıntısı, login ve takvim beklentileri zayıflatılmadı.

Okunan merkezi kanıtlar: `docs/mobile-release/evidence/flutter-analyze-integration.txt` ve `flutter-test-integration.txt`. Bu kayıtlar değişiklik öncesi başarısızlığı gösterir. Sahip olunan dosyalarda `git diff --check` çalıştırıldı ve temizdir. Flutter/Dart analyze/test/format/pubget/genl10n/build, native komutlar ve broad npm kontrolleri SDK lock nedeniyle bu dispatch tarafından çalıştırılmadı; yeni testlerin geçtiği iddia edilmez. Koordinatöre merkezi format/analyze/test için ready mesajı gönderildi.

## Kalan yayın kapıları

Koordinatörün son format/analyze/tüm Flutter test çalıştırması gereklidir. Android/iOS cihaz auth/logout/relaunch, gerçek production-redaction HTTP zarfı, erişim reddi ve operasyon uzlaşması E2E; gerçek panel/okuyucu, signing/platform credentials ve mağaza teslimi bu kaynak düzeltmesinin dışında kalan ortak yayın kapılarıdır. Commit/push/deploy, production mutation veya dış kanala mesaj gönderilmedi.
