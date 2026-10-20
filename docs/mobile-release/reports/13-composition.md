# 13 — Composition, bootstrap ve navigation teslimi

19 Ekim 2026. Bu worker yalnız izin verilen root/router/splash/shell, yeni branch visibility ve root/router test dosyalarını değiştirdi; diğer worker'ların ve önceden var olan web/Convex değişikliklerini korudu. Commit, deploy, üretim mutasyonu, mağaza gönderimi veya dış mesaj yapılmadı.

## Uygulanan davranış

- **MOB-19 / AN-F03, AN-WP03:** `MyApp` auth bootstrap'ını bir kez başlatır. Splash yalnız görünüm ve verilmiş callback'leri sunar; sabit 2500 ms bekleme, SharedPreferences parola okuması ve gizli sign-in yoktur. Korumalı soğuk link önce `/splash?from=...`, ardından doğrulanmış oturumla orijinal hedefe; oturum yoksa `/login?from=...` üzerinden aynı hedefe gider. Oturum geçici olarak doğrulanamıyorsa giriş ekranına zorla düşmez.
- **MOB-19 / AN-F06, AN-WP04:** `retryableFailure` güvenli yerelleştirilmiş hata, yeniden deneme, açık girişe geçiş ve yönetici desteği gösterir. Geçersiz session login'e gider; retry döngüsü yaratılmaz. Retry sırasında yeni bootstrap tekrar başlatılmaz. Config başlangıç hatası ayrı yerelleştirilmiş açıklamayla yakalanır; servis oluşturulmadan auth isteği başlatılmaz, retry çalışır.
- **MOB-19 / AN-F08, AN-WP07:** Root bütün oluşturduğu notifier/router/client kaynaklarını kapatır, auth listener ve yalnız kendisine ait expiry callback'ini kaldırır. Geciken client factory sonucu root kaldırılmışsa kapatılır ve bootstrap yapılmaz. Injected client/auth caller'a aittir ve dispose edilmez. Bir root diğerinin yerine mount olduğunda diagnostics handler'ları son root çıkana dek tek ortak sahiplik sayacıyla korunur; dışarıdan daha sonra atanmış handler ezilmez.
- **MOB-15 shell / DA-F02, DA-W02:** Beş hedef gerçek `NavigationBar`/`NavigationDestination` ile yerelleştirilmiş isim, standart gezinme rolü, selected state, standart klavye/focus ve tooltip davranışını kullanır; QR artık adsız gesture değildir. Mevcut `StatefulShellRoute.indexedStack` ve aynı dala tekrar dokununca branch köküne gitme korunur.
- **AN-F04, AN-WP05:** `BranchVisibility`, tutulmuş navigator'ların aktif dal bilgisini taşır. Gerçek QR route'u `QRScanScreen(isActive: ...)` alır. QR gizlenince widget state'i korunurken kaynaklar QR sahibinin visibility API'siyle durur. Root overlay shell'i kapattığında aktif branch sinyali de kapanır. Ziyaretçi polling'i yalnız index 3, görünür shell route ve resumed uygulamada aktiftir; provider bildirimleri build içinde başlatılmaz.
- **AN-F05, AN-WP06 entegrasyonu:** Her çalışan/proje/session epoch değişiminde cihaz tercihi önce senkron bellekte temizlenir, sonra yeni employee/project/**aynı injected client'ın doğrulanmış deploymentUrl** namespace'iyle yüklenir. Logout `null` kimliğe döner. Kalıcılık ve async yarış guard'ları tercih provider sahibinin uygulamasındadır.
- **MOB-23 root entegrasyonu:** `FlutterError.onError` ve `PlatformDispatcher.instance.onError` yalnız `SafeDiagnostics.instance.record` kullanır. Ham exception body loglanmaz. Hook'lar kök ömrüyle kurulur/kaldırılır; framework/platform/bootstrap işlem türleri korunur. Bu yerel, bellek içi diagnostics'tir; dış telemetry kurulmuş değildir.

## Dosyalar

- `mobile/lib/main.dart`
- `mobile/lib/router/app_router.dart`
- `mobile/lib/router/route_paths.dart` (yeni; `app_router.dart` eski `AppRoute` import/export uyumunu korur)
- `mobile/lib/core/branch_visibility.dart` (yeni)
- `mobile/lib/screens/splash_screen.dart`
- `mobile/lib/screens/main_navigation_shell.dart`
- `mobile/test/router/app_router_integration_test.dart` (yeni)
- `mobile/test/integration/app_composition_test.dart` (yeni)
- Bu rapor.

## Somut arayüzler ve sahiplik

`MyApp({client, authProvider, sessionStore, initialLocation, clientFactory})`: injected client ve auth caller-owned; `clientFactory` sonucunu ve diğer oluşturduğu kaynakları root kapatır. `sessionStore` yalnız root-created auth için kullanılır. Kaynakları değiştirmek için root'a yeni key verilmesi sözleşmesi constructor dokümantasyonundadır. Testler gerçek root'u/global config olmadan kurabilir.

Root repository'leri `AuthRepository(client)`, `AttendanceRepository(client)`, `DeviceRepository(client)`, `QrRepository(client)`, `VisitorRepository(client)` ve `DoorOperationRepository(client)` şeklinde tek client ile oluşturur. Root-owned notifier'lar `AuthProvider(repository: authRepo, sessionStore: optional)`, `AttendanceProvider(repository: attendanceRepo)`, `ThemeProvider()`, `LocaleProvider()`, `PreferredDeviceProvider()`, `VisitorProvider(repository: visitorRepo)` ve `DoorOperationProvider(repository: doorRepo)` şeklindedir. QR ekranı kendi `QrProvider` ömrünü yönetir; root yalnız repository verir.

Auth provider root listener'ı `VisitorProvider.synchronizeSession(auth)` ve `DoorOperationProvider.synchronizeSession(auth, deployment: client.deploymentUrl)` çağırır. Ziyaretçinin auth argümanı zorunlu entegrasyon seçimidir: logout, HTTP token'ının secure storage temizliğini beklemeden çalışan state'ini temizler. Attendance, `setAuthProvider(auth)` ile build dışında bağlanır; provider kendi auth listener'ını disposal'da kaldırır. Dil/tema bootstrap edilir; `MaterialApp.locale` canlı `LocaleProvider.locale` değerini kullanır.

`safeReturnTarget` yalnız altı korumalı tam path kabul eder; scheme/authority/query/fragment/unknown hedefleri reddeder. `normalizeAppLocation` `ngsplus://history` ve `ngsplus:///history` biçimlerini `/history` yapar. `/`, bilinmeyen route ve harici URI güvenli home fallback'ine gider; home auth guard'ını atlamaz. `buildRouter(..., screenBuilders:)` testte yalnız screen gövdelerini değiştirir; guard, branch navigator, shell ve hedef koruması gerçek kalır. Stack'siz cihaz seçiminin geri fallback'i owner08 tarafından uygulanmıştır; root entegrasyon testine dahil edilmiştir.

Ziyaretçi W04/W06 genişlemesi sonrasında root HTTP fixture list yanıtına `scanLimited: false` ve bağımsız sıfır toplamlı `mobileVisitors:summary` yanıtı eklendi; visibility testi gerçek provider liste/özet yüklenme hatası olmadığını da sınar. Yeni dependency, backend, global ARB/config/platform değişikliği bu worker tarafından yapılmadı. Locale/startup getter'ları owner08, validated client namespace/callback API'si owner01, QR API'si owner05, visitor auth synchronization owner12 ve door operation API'si owner14 ile mesajla uzlaşıldı.

## Testler ve doğrulama sınırı

Yazılan 17 router ve 14 root widget entegrasyon senaryosu: geçerli tokenla soğuk history, oturumsuz hedef→login→aynı hedef, geçici offline retry, retry'dan açık login'e geçiş, geçersiz token, harici ve bilinmeyen return target reddi, `/`/unknown fallback, iki custom URI biçimi, geç A bootstrap/gerçek HTTP yanıtından sonra B izolasyonu, beş isimli/button/selected semantics ve klavye QR aktivasyonu, indexedStack History state korunması, gerçek QR hidden flag'i, visitor hidden/background polling gating, locale ve preference epoch namespace reset, stack'siz cihaz seçimi geri fallback'i, owned/injected kaynak disposal/callback ayrımı, diagnostics redaksiyonu ve hook restoration/replacement, late client factory disposal, config failclosed/retry.

Test fixture'ları sentetiktir; gerçek token/parola/kimlik/servis kullanılmaz. Serialized Future ve Completer fixture'ları `testWidgets` fake async bölgesi içinde oluşturulur. Normal root testleri mount sonrası Flutter test binding hata handler'ını geri takarak assertion/framework hatalarının üretim diagnostics hook'u tarafından yutulmasını engeller; özel hook testi üretim hook'unu doğrulayıp assertion'ları disposal'dan sonra yapar.

**Bu worker Flutter/dart test/analyze/pubget/build/genl10n/pod/gradle komutu çalıştırmadı:** SDK kilidi koordinatördedir. `git diff --check` scoped dosyalarda temizdir. Koordinatörün `flutter-analyze-integration2.txt` kaydında bu worker'a ait dosyalarda hata/info yoktu. `flutter-targeted-integration3.txt` çalışması gerçek root'un 14 senaryosunu tamamladı; tüm seçili dosyalarda toplam 104 test geçti ve tek hata router semantics testinin Home gövdesini hedeflemesiydi. Finder NavigationBar ile sınırlandırıldı; ad, button rolü, tap, tek selected ve klavye aktivasyonu doğrulamaları korunarak router tekrarı/son analyze istendi. İlk geniş test run'larının iptal edilmiş/eksik sonuçları başarılı kabul sayılmadı; widget-zone fixture sorunları giderildi ve scoped yeniden çalışma koordinatöre istendi.

Standart Flutter API sözleşmesi [NavigationBar](https://api.flutter.dev/flutter/material/NavigationBar-class.html) ve [ModalRoute.isCurrentOf](https://api.flutter.dev/flutter/widgets/ModalRoute/isCurrentOf.html) resmi referanslarıyla kontrol edildi; kurulu go_router kaynağında top-level redirect'in unknown/URI normalizasyonundan önceki match hatasını düzeltebildiği okundu.

## Açık kabul engelleri

Koordinatör Android release build2 Gradle/native bağımlılık işinin merkezi SDK kilidini tuttuğunu bildirdi; paralel SDK çalıştırılmadı. Koordinatör kaynak görevinin mevcut somut teslimle kapanmasını açıkça istedi ve son root/router test, format, analiz ve gerekirse düzeltme sahipliğini devraldı. Merkezi son scoped test/analyze/format sonucu bu rapora eklenmeden otomatik kabulün geçtiği iddia edilmez. Targeted3 sonrası NavigationBar finder düzeltmesi ve ziyaretçinin genişletilmiş DTO fixture/özet assertion değişikliği son tekrar bekleyen kaynak farklarıdır. Android/iOS gerçek OS deep-link teslimi, TalkBack/VoiceOver anonsu/klavye, kamera lifecycle ve panel/fiziksel kapı, store signing ve staging/production servis erişimi bu worker tarafından çalıştırılmadı. Gerçek credential/imza/cihaz E2E kanıtları ve diğer modüllerin özellik kabulü koordinatör/release sahiplerindedir; route guard backend yetkilendirmesinin yerine geçmez ve kapı komutu sonucu fiziksel geçiş kanıtı olarak sunulmaz.

Kaynak uygulaması tamamlanan kimlikler: MOB-19 (AN-F03/06/08; AN-WP03/04/07), MOB-15 yalnız shell (DA-F02/DA-W02), AN-F04/AN-WP05 root visibility entegrasyonu. AN-F01/02/05/07 için bu teslim root/splash/namespace/callback entegrasyonunu sağlar; ilgili auth/data/transport sahiplerinin kapsamının yerine geçmez. Otomatik kabulün son kapanış kanıtı koordinatörün final SDK çalışmasına bağlıdır.
