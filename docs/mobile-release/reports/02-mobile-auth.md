# Mobil auth uygulama teslimi

19 Ekim 2026. Bu teslim gerçek Flutter kodu ve regresyon testleri içerir; kaynak audit raporu değildir. Önceden mevcut web/Convex değişiklikleri korunmuştur; yalnız aşağıda listelenen sahipli dosyalar değiştirildi. Flutter SDK kilidi koordinatörde olduğu için bu worker test/analyze/pub get/gen-l10n/build/format/native build çalıştırmadı.

## Uygulanan davranışlar ve audit kapsamı

| İş | Uygulanan | Kalan doğrulama / ortak sahiplik |
| --- | --- | --- |
| MOB-01, AUTH-WP01, AUTH-F01 | Enjekte edilebilir `SessionStore`; varsayılan `SecureSessionStore` token/vadeyi tek güvenli kayıtta tutar. SharedPreferences yalnız e-posta ve sırsız restore iznini tutar. Eski ham parola/token anahtarları değerleri okunmadan temizlenir. Hiçbir parola saklama API'si/yazımı yoktur. | Gerçek Android/iOS güvenli depo, yedek/upgrade ve fiziksel cihaz doğrulaması; dependency/native ayarları platform sahibindedir. |
| AUTH-WP02, AUTH-F02 | Açık logout phase/user/token/loading durumunu ilk await öncesinde temizler. Yerel temizlik yalnız yerel I/O bekler; uzak revoke bağımsız, en fazla 5 saniye beklenen best-effort işlemdir. Güvenli kaydın silinmesi başarısız olsa da restore izni önce kapatılır. Parolayla otomatik giriş yetkisi kaldırılmıştır. | Ağsız çıkış uzaktaki tokenın iptal edildiği anlamına gelmez. Process-kill/relaunch ve remember açık/kapalı matrisi gerçek cihazda yürütülmelidir. Splash parolayla yeniden giriş yolunu kaldırma koordinatördedir. |
| MOB-03, AUTH-WP04, AUTH-F04 | Giriş/bootstrap/logout/expiry için monoton `sessionEpoch`, disposed/epoch kontrolleri, tek aktif login, deduplicate bootstrap; eski başarı/hata/finally yeni hesabı değiştiremez. Token/persist/client etkileri sıralıdır; uçuşta güvenli yazım logout temizliğini sonradan ezemez. Login controller değerleri await öncesi snapshot alınır; widget mounted kontrolü vardır. | Diğer veri provider'ları kendi async sonuçlarını aynı epoch'a bağlar. HTTP istemcisi eski auth neslinin callback'ini bastırma sorumluluğunu taşır; ilgili owner ile API paylaşıldı. |
| AUTH-WP05, AUTH-F05 | Dört açık phase, bootstrap hatası, initialize/busy getter'ları ve kullanıcı kontrollü `bootstrap(force: true)` API'si vardır. Geçici hatada güvenli kayıt korunur; doğrulanmayan kullanıcı korumalı ekran açmaz. | Composition root, Splash retry görünümü ve route dönüşü koordinatördedir; bu worker ilgili dosyalara dokunmadı. |
| AUTH-WP06, AUTH-F06 | Repo `SESSION_INVALID`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `EMPLOYEE_INACTIVE` kodlarını terminal `AuthExpiredError` yapar; provider temizler. `INVALID_CREDENTIALS`, `RATE_LIMITED` tipli `BusinessError`; güvenli mesaj ve doğrulanmış `retryAfterMs` taşır. Bozuk DTO `ProtocolError` üretir. | HTTP 560/errorData decode ve root callback diğer owner'dadır. Canlı backend pasifleştirme/revocation senaryoları çalıştırılmadı. |
| AUTH-WP07, AUTH-F07 | Kurtarma ekranında e-posta gönderme formu/başarı vaadi kaldırıldı. Yönetici kurulum bağlantısı süreci anlatılır; gerçek bir talep metni panoya kopyalanabilir veya seçilebilir. Eski auth hatası temizlenir. | Gerçek yönetici e-posta teslimi backend/operasyon akışıdır; self-service reset geliştirilmiş gibi sunulmaz. |
| Koordinatörün ek parola değiştirme entegrasyonu | `employeeAuth:changePassword` gerçek employee mutation çağrısı; `{requiresSignIn:true}` başarı şartı, error union decode, 12 code point / en fazla 72 UTF-8 byte / farklı parola kontrolü. Tek aktif işlem, 20 saniye bekleme sınırı ve epoch guard; doğrulanan başarı yerel logout ve yeni explicit login gerektirir. | Profil formu/l10n owner tarafından bağlandı. Timeout sunucu işleminin uygulanmadığını kanıtlamaz; mutasyon otomatik tekrarlanmaz. Backend parola revocation ayrı owner'dadır. |

Bu satırlar kod kapsamındaki düzeltmeleri belirtir; çalıştırılmamış testleri ve cihaz kabulünü geçmiş/kapanmış olarak sınıflandırmaz. AUTH-WP03/WP08 backend revocation/limiter ve WP09 ortak transport bu worker'ın değişiklikleri değildir. MOB-01/MOB-03'ün uygulama genelinde tamamlanması diğer owner entegrasyonları ve merkezi doğrulamaya bağlıdır.

## Saklama ve oturum politikası

- “E-postamı hatırla” yalnız e-posta doldurur. Oturum güvenli depoda kalıcıdır; checkbox oturum kalıcılığını ayrıca değiştirmez, mevcut kalıcı oturum davranışı korunur.
- Legacy `remembered_password`, `mobile_employee_token`, `mobile_employee_expires`, `convex_access_token`, `convex_refresh_token`, `remember_me` ve eski e-posta anahtarı temizlenir. Uygun legacy e-posta tek başına yeni e-posta anahtarına taşınabilir. Legacy parola/token güvenli depoya taşınmaz; yükseltme sonrası bir kez açık giriş gerekir.
- Güvenli token/vade tek JSON kaydıdır. Kaydetmeden önce restore izni kapanır, başarılı güvenli yazımdan sonra açılır. Logout restore iznini güvenli silmeden önce kapatır. Uygulama reinstall sonrasında preferences kaybolup Keychain öğesi kalırsa, sırsız izin bulunmadığından otomatik restore yapılmaz.
- Depolama hatası sahte başarılı giriş üretmez; yeni verilmiş uzak token best-effort iptal edilir. Açık logout UI'ı hemen kapatır; kalıcı temizlik bitene kadar dönen Future yerel I/O'yu bekler. Yerel depoların tamamı yazılamıyorsa kalıcı silme garantisi verilemez; görünür güvenli hata oluşur.
- Seri cleanup işlemi başlatıldığında yetkili olan logout/expiry, notifier dispose edilse de tamamlanır. Bu sırada yeni login'in kalıcı/client etkileri kuyruğa girer; eski cleanup yeni login'in sonradan yazdığı kaydı silemez.

## Entegrasyon arayüzleri

`AuthProvider(repository:, sessionStore:, now:, remoteLogoutTimeout:, passwordChangeTimeout:)` constructor'ında yalnız `repository` zorunludur. `SessionStore` varsayılanı `SecureSessionStore`'dur; testler gerçek plugin yerine fake kullanır. Eski consumer getter ve metodları korunmuştur.

Yeni/uzatılmış API:

```dart
enum AuthPhase { initializing, unauthenticated, authenticated, retryableFailure }
AuthPhase get phase;
int get sessionEpoch;
bool get isInitialized;
bool get isBootstrapping;
AppError? get bootstrapError;
Future<void> bootstrap({bool force = false});
Future<bool> signIn(String email, String password, {bool rememberEmail = false});
Future<String?> rememberedEmail();
Future<void> handleAuthExpiry({String? sessionToken, int? sessionEpoch});
bool get isChangingPassword;
Future<bool> changePassword({required String currentPassword, required String newPassword});
```

`AuthRepository.setAuth(String)` ve `clearAuth()` yalnız injected `HttpConvexClient`'ı yönetir; provider'ın global `convex` bağı yoktur. `AuthUser.projectId` nullable/opsiyoneldir; gerekli kimlik/ad/e-posta/kart alanları strict decode edilir. Mock repository kullanan dış testler `setAuth`/`clearAuth` Future'larını stub etmeli ve fake store inject etmelidir; attendance sahibine bildirildi.

Root tek bootstrap çağırmalı, retryableFailure durumunda retry sunmalı ve doğrulama tamamlanmadan korumalı route açmamalıdır. Login başarıda `context.go(home)` yapmaz; router `returnTo` hedefini auth bildirimi üzerinden geri yükler. Transport eski request neslinin expiry'sini bastırmalıdır; `handleAuthExpiry` isteyen caller için token/epoch da kabul eder.

Core error owner'ın `BusinessError.retryAfterMs`, `SESSION_STORAGE_FAILED` / `PASSWORD_POLICY` kodları ve yerelleştirmeleri kullanılır. L10n sahibinin eklediği `loginRememberEmail`, `loginShowPassword`, `loginHidePassword`, `passwordHelpTitle`, `passwordHelpAdminTitle`, `passwordHelpAdminBody`, `passwordHelpNoEmail`, `passwordHelpRequest`, `passwordHelpCopy`, `passwordHelpCopied`, `passwordHelpCopyFailed` getter'ları kullanılır; bu teslimde geçici Locale helper kalmadı. ARB/generated dosyalarını bu worker değiştirmedi; son gen-l10n koordinatördedir.

Platform sahibi `flutter_secure_storage` bağımlılığı ve native ayarlarını yönetir; pubspec/lock/platform dosyaları değiştirilmedi. Kullanılan minimal read/write/delete API'si paket sahibinin [resmi API belgesi](https://pub.dev/documentation/flutter_secure_storage/latest/flutter_secure_storage/FlutterSecureStorage-class.html) ve [resmi paket sayfası](https://pub.dev/packages/flutter_secure_storage) üzerinden doğrulandı; bu kontrol native çalıştırma kanıtı değildir.

## Değiştirilen dosyalar

Uygulama:

- `mobile/lib/providers/auth_provider.dart`
- `mobile/lib/repositories/auth_repository.dart`
- `mobile/lib/screens/auth/login_screen.dart`
- `mobile/lib/screens/auth/forgot_password_screen.dart`
- `mobile/lib/services/session_store.dart` (yeni)

Testler:

- `mobile/test/auth_fakes.dart` (yeni, diğer owner testleri için yeniden kullanılabilir)
- `mobile/test/providers/auth_provider_test.dart`
- `mobile/test/repositories/auth_repository_test.dart`
- `mobile/test/services/session_store_test.dart` (yeni)
- `mobile/test/widgets/login_screen_test.dart`
- `mobile/test/widgets/forgot_password_screen_test.dart` (yeni)

Teslim raporu: `docs/mobile-release/reports/02-mobile-auth.md`.

## Yazılan testler

Provider testleri: güvenli kalıcılık, e-posta açık/kapalı, depolama hatasında başarısız login, çift submit, uzak revoke beklerken anlık logout, offline logout ve yeniden yaratılan provider bootstrap'ı, geç login başarısı, güvenli yazım sürerken logout, A hatasından sonra B'nin korunması, bootstrap single flight, retry, exact expiry boundary, terminal bootstrap temizliği, eski bootstrap sonucu, eski token/epoch expiry, dispose sonrası geç yanıt, dispose sonrası logout temizliği; parola değişimi başarı/policy/tek işlem/hata/eski hesap sonucu/timeout; kurtarma eski hatası.

Repository testleri: geçerli DTO ve nullable/eksik projectId uyumluluğu, gerekli alan eksikliği/yanlış tipi ve opsiyonel alan yanlış tipi, bozuk login shape/JSON, safe error mesajı, yapılandırılmış bütün auth kodları ve rate delay, bilinmeyen error zarfı, injected client auth, açık token revoke ve gerçek parola değiştirme başarı/policy/bozuk başarı sözleşmesi.

Saklama testleri: legacy sır anahtarlarının silinmesi, yalnız email migration, tek güvenli credential kaydı, izinli geçerli restore, güvenli yazım hatasında kapalı restore, silme hatasında logout marker'ı, reinstall sonrası orphan Keychain, bozuk JSON temizliği ve email unutma. Native secure storage çağrıları mock; gerçek plugin kullanılmaz.

Widget testleri: giriş alan doğrulamaları, yalnız email autofill, TR hata ve retry, bekleyen login/çift dokunma, widget dispose olurken geç başarı, EN remember metni; kurtarmada eski hata temizliği ve gerçek Clipboard kopyası.

## Çalıştırılmış kontroller ve yayın sınırı

- Sahipli dosyalarda `git diff --check`: başarılı, whitespace hatası yok.
- Kaynak ve entegrasyon sözleşmeleri `rg` ve tam/ilgili dosya okumalarıyla kontrol edildi. Convex okunmadan önce `convex/_generated/ai/guidelines.md` tamamı okundu; backend dosyası değiştirilmedi.
- Flutter/Dart test/analyze/pub get/gen-l10n/build/native komutları ve formatlama çalıştırılmadı: koordinatörün SDK kilidi korunuyor. Yukarıdaki testlerin yazılmış olması başarılı çalıştırma anlamına gelmez; merkezi test ve analiz sonucu koordinatörün kanıtına eklenmelidir.
- Android/iOS gerçek cihazda legacy upgrade, güvenli depo arızası, foreground/background, offline logout → process kill → relaunch, TalkBack/VoiceOver ve büyük metin matrisi henüz bu worker tarafından doğrulanmadı.
- Gerçek staging backend parola değişimi/revocation/e-posta teslimi ve imzalı dağıtım testi yapılmadı. Signing, mağaza gönderimi ve production deploy bu görevin yürüttüğü işlemler değildir.
- Commit/push/deploy, production mutation, dış mesaj veya gerçek sır çıktısı yoktur. Koordinasyon yalnız izinli Orca orchestration mesajlarıyla yapıldı.
