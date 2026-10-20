# Mobil kontrol turu, kütüphane güncellemesi ve telefon kurulumu

20 Ekim 2026. Kurulu Flutter 3.47.2 / Dart 3.13.2 release pinleriyle eşleşti. Mobil uygulama kaynakları ilk kontrol sırasında önceki doğrulanan snapshot ile aynıydı; sonradan gelen bağımsız web/Convex değişiklikleri korundu. Bu tur yeni worker açmadı, backend deployment veya mağaza gönderimi yapmadı.

## Güncellik incelemesi

`flutter pub outdated --json` ile doğrudan ve geçişli bağımlılıklar, geri çekilen/yayını durdurulan sürümler ve bildirilen güvenlik uyarıları sorgulandı. On doğrudan paket gerideydi. Sekiz doğrudan paket mevcut araç zinciri içinde güncellendi; solver toplam 42 bağımlılık değişikliği bildirdi. Dependency override eklenmedi. Güncelleme sonrası bildirilen güvenlik uyarısı, discontinued veya retracted paket sayısı 0. Bu sonuç registry tarafından bilinen uyarıların yokluğudur; tüm güvenlik açıklarının yokluğunu kanıtlamaz.

| Paket | Önce kilitli | Sonra kilitli |
|---|---|---|
| flutter_secure_storage | 10.0.0 | 10.3.1 |
| flutter_svg | 2.2.4 | 2.3.0 |
| go_router | 17.2.3 | 17.5.0 |
| mobile_scanner | 7.2.0 | 7.4.2 |
| path_provider | 2.1.5 | 2.1.6 |
| permission_handler | 12.0.1 | 12.0.3 |
| shared_preferences | 2.5.5 | 2.5.6 |
| table_calendar | 3.2.0 | 3.3.0 |

[Önceki registry sorgusu](evidence/device-review/pub-outdated-before.json), [sonraki sorgu](evidence/device-review/pub-outdated-after.json), [tam kilit farkı](evidence/device-review/dependency-updates.json) ve [upgrade çıktısı](evidence/device-review/pub-upgrade.txt) saklandı.

Büyük sürümler ayrı değerlendirildi:

- `flutter_secure_storage` 11.2.0: v10’da deprecated olmuş şifreleme/depo seçeneklerini kaldırır; Androidde eski verinin v10 üzerinden taşınması gerekir. Uygulamadaki legacy preference → güvenli oturum geçişi nedeniyle,10.3.1 düzeltmeleri alınıp v11’e doğrudan geçilmedi. [Yayın notları](https://pub.dev/packages/flutter_secure_storage/changelog).
- `package_info_plus` 10.2.2:9’dan itibaren AGP >= 8.12.1 gerekir; mevcut pin 8.11.1. 8.3.1 ile gerçek metadata testi ve signed native build geçti. Android araç zinciri ve plugin major yükseltmesi bu turda birleştirilmedi. [Yayın notları](https://pub.dev/packages/package_info_plus/changelog).
- `permission_handler` 13.0.2: Android compileSdk 37 ve permanent-denial davranışı değişiklikleri içerir; mevcut release compile/target 36 olduğundan 12.0.3 kullanıldı. Apple implementation 9.6.2 solver üzerinden güncellendi ve SwiftPM paketinde kamera ayarları mevcut Info.plist üzerinden çözüldü. [Yayın notları](https://pub.dev/packages/permission_handler/changelog).
- `go_router` 18.1.0: material_ui/cupertino_ui geçişi ve Flutter 3.44/Dart 3.12 alt sınırı içerir. 17.5.0 ile mevcut auth/deep-link/branch-state/Semantics regresyonları korundu; 18 geçişi ayrı UI migration olarak bırakıldı. [Yayın notları](https://pub.dev/packages/go_router/changelog).
- `cupertino_icons` 2.0.0: uygulamanın deklaratif Dart 3.11/Flutter 3.38 minimumunu yükseltmeden mevcut 1.0.8 font uyumluluğu korundu. Ağdan font yükleme yok; native tree-shaking fontları başarıyla paketledi. [Yayın notları](https://pub.dev/packages/cupertino_icons/changelog).

Kamera 7.4.2, native kamera kapanış/başlatma ve frame serbest bırakma düzeltmelerini getirir; gerçek QR/izin kabulü yine cihaz senaryosu ister. [Yayın notları](https://pub.dev/packages/mobile_scanner/changelog). Path provider 2.1.6 mevcutSDK alt sınırına uyumludur. [Yayın notları](https://pub.dev/packages/path_provider/changelog).

## Kontroller

- Başlangıç turu: Flutter 433 test geçti, analyze temiz, release betikleri 25 test geçti; güncel web/backend 220 dosyada 2352 test, iki TS projesi ve ESLint exit0. Sonradan bağımsız backend geliştirmeleri için bu eski koşu yerine yeni kaynakla yeniden doğrulama gerekir.
- Paket güncellemesinden sonra Flutter 433test geçti, analyze temiz: [çıkış kodları](evidence/device-review/mobile-updated-exits.json), [test logu](evidence/device-review/flutter-tests-updated.txt).
- Yeni iOS release paketi mevcut Apple Development identity ile derlendi. codesign deep/strict doğrulaması ve bağlı cihazı kapsayan mevcut provisioning profile kontrolü geçti: [derleme](evidence/device-review/ios-device-build.txt), [artifact kaydı](evidence/device-review/ios-device-artifact.json).
- Android unsigned release yeniden derlendi;64-bit ELF LOAD 16 KB, ZIP 16 KB, identity/permissions/backup ve unsigned-state kontrolleri geçti: [log](evidence/device-review/android-build-updated.txt). Bu tur fiziksel Android veya16KB runtime doğrulaması yapmadı.

## Bağlı telefon

Bağlı fiziksel iPhone 13/iOS 27.0.1, eşlenmiş ve Developer Mode açık bulundu. Mevcut NGS Plus 1.0.4+1 zaten geliştirme imzalıydı. Aynı `com.ngsplus.app` kimliği, mevcut team ve mevcut cihazı kapsayan geçerli profile ile derlenen güncel 1.0.4+1, uygulama silinmeden üzerine kuruldu; uninstall/wipe çağrısı yok.

Kurulum exit 0, uygulamayı öne getirerek başlatma başarılı ve aynı Runner işlemi sonradan process listesinde çalışır bulundu. [Kurulum](evidence/device-review/device-install.txt), [başlatma](evidence/device-review/device-launch.txt). Apple Distribution kimliği/mağaza yayını gerekli olmadı; bu yerel Apple Development kurulumu App Store kabulü değildir.

Telefon paketi mevcut `mobile/.env` içindeki public URL seçilerek compile-time tanımlarla derlendi: ortak geliştirme backend’i, APP_ENV=staging. `.env` dosyası asset olarak paketlenmedi, hiçbir parola/token derleme argümanına alınmadı.

## Sunucuya bağlı açık nokta

Salt-okunur HTTP query kontrolleri mevcut `notable-tern-4` geliştirme ortamında `mobileAccess:listTargets`, `mobileVisitors:summary` ve `mobileAttendance:summary` public fonksiyonlarının bulunmadığını gösterdi: [redakte probe](evidence/device-review/backend-readonly-probe.json). Telefon kurulması yeni backend fonksiyonlarını otomatik yayınlamaz; yeni kapı/ziyaretçi akışları bu sunucuya dağıtılmadan çalışmaz. Kimlik doğrulamalı gerçek hesap, kapı komutu veya ziyaretçi değişikliği denenmedi.

Bu turun telefon kurma talebi ortak Convex kodu/şemasını değiştirme işlemi olarak genişletilmedi. Çalışma ağacında paralel bağımsız backend değişiklikleri de vardır; dağıtım yapılacaksa o anda seçilmiş kaynak ve hedef birlikte gözden geçirilmeli. Mevcut rol/kart/broker/panel geçiş koşulları ve mağaza/privacy kabul kapıları korunur.

## Mac iOS simülatörü

Kullanıcının ek talebiyle iPhone 17 / iOS 27 simülatörüne güncel debug paketi derlenip kuruldu ve başlatıldı. [Kurulum/başlatma](evidence/device-review/simulator-install-launch.json), [derleme](evidence/device-review/ios-simulator-updated.txt) ve [giriş ekranı](evidence/device-review/simulator-login.png) kaydedildi. Mac’te ayrı Simulator.app bulunmadığından Orca canlı simülatör paneli kullanıldı; uygulama ve simülatör kullanıcı incelemesi için açık bırakılır. Telefonda ikinci görüntüde authenticated ana sayfa görüldü; ilk siyah yakalama kalıcı bir açılış hatası olarak değerlendirilmedi. Kişisel telefon görüntüsü repoya kopyalanmadı.

Son yapılandırılmış sonuçlar: [review-summary.json](evidence/device-review/review-summary.json).

Canlı simülatör paneli doğru iPhone 17 kimliğiyle bağlandı; erişilebilirlik ağacında NGS Plus, e-posta, şifre, giriş ve parola yardım kontrolleri doğrulandı. Kullanıcı istediği için panel ve uygulama açık bırakıldı.
