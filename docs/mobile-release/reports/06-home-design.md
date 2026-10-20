# 06 — Home, ortak kartlar ve tema uygulaması

19 Ekim 2026. Bu teslim gerçek Flutter kodu ve regresyon test kodu içerir. Çalışma ağacındaki web/Convex değişiklikleri korunmuştur; backend, provider, repository, shell, router, ARB, pubspec ve composition root bu worker tarafından değiştirilmemiştir.

## Uygulanan davranışlar

- Home ilk açılış/çekerek yenilemede `loadDailySummary()` çağırır. Geçmiş listesinin sayfa penceresi günlük kartı beslemez. `hasSummaryLoaded`, `isSummaryLoading`, `summaryError`, `summaryUpdatedAt`, `isTodayStatusKnown` ve summary tabanlı mevcut saat/sayı getterları kullanılır.
- Katılım kartı ilk yükleme, ilk hata + yeniden deneme, başarılı boş, başarılı dolu, eski veri + yenileme hatası ve veri korunarak yenileme durumlarını ayrı sunar. İlk yanıt gelmeden “Henüz Yok” göstermez. Bilinmeyen yön başarılı boş veya “İçeride” sayılmaz. Başarılı verinin güncelleme zamanı görünür.
- Başlık, selamlama, günün sözü ve kart saatleri ortak `AttendanceDate.businessTime` sözleşmesiyle gösterilir. Ön planda dakika kontrolü ve resume kontrolü başlığı günceller; iş günü değişince günlük özet yenilenir. Timer dispose edilir ve arka planda sorgu başlatmaz.
- Home `AttendanceProvider.quickUnlock` / `selfCheckIn` çağırmaz. `DoorOperationProvider.open(deviceId:, doorId:)` öncesinde enjekte edilen `DeviceRepository.listForEmployee()` ve `PreferredDeviceProvider.revalidate()` çalışır; device/door/target kimlikleri tam eşleşir ve `canOpen == true` gerekir. Tercih, sunucu yetkisinin yerine geçmez.
- Hedef doğrulaması başlamadan senkron kilit alınır. Yerel hazırlık sonucu `sessionEpoch`, `identityGeneration`, istek nesli ve `mounted` ile korunur. Ağ hatası tercihi silmez; gecikmiş başka hesap yanıtı komut göndermez. Device/door/target seçimi de işlem başında yakalanır; beklerken seçim değişirse veya yeni tercih kaydı sürüyorsa eski niyet başka hedefe gönderilmez. Oturum hatası auth sahibine epoch/token kapsamıyla aktarılır.
- Komut sağlayıcısının busy ve unresolved durumları yeni açma eylemini devre dışı bırakır. Persistent durum kartı pending/sent, confirmed, failed, unknown ve ağ hatasını ayrı gösterir. Confirmed metni yalnız cihaz komut onayı der ve fiziksel geçişi doğrulamadığını açıklar.
- “Durumu kontrol et” her zaman salt okuma `checkStatus()` çağırır. Eksik yanıt ve mevcut kalıcı requestId durumunda ayrı “Aynı isteği yeniden gönder” eylemi `retrySameRequest()` çağırır; yeni requestId üretmez. Kalıcı kayıt okunamadığında requestId yoksa işlevsiz resend eylemi gösterilmez. Restore sorgusu komut gönderimi diye sunulmaz.
- Hızlı işlemler yerel genişlik ve text scaler ile normal 320 dp içerikte 2×2, büyük metinde gerektiğinde tek sütun olur; geniş alanda dört sütuna çıkabilir. Kart/düğme yükseklikleri metinle büyür; kapı adı kesilmez. Saat ve ek hareket satırları `Expanded` + `Wrap` ile yeniden akar.
- Hızlı işlem kartları tam eylem/hedef adı, button/enabled ve busy semantiğine sahiptir; disabled durumda tap üretilmez. Bölüm başlıkları header semantiği taşır. Hata anonsları live region kullanır; özet polling tickleri anons yağmuruna dönüştürülmez.
- AppTheme açık/koyu ColorScheme renklerini ve merkezi `AppStatusColors(foreground, background)` çiftlerini sağlar. Elevated/Text düğme minimum hedefleri 48 dp'dir; QR düğmesinin minimum yüksekliği 56 dp'dir. Ağdan font indirme kaldırılmış, Material sistem tipografisi kullanılmıştır.
- Kullanım dışı `ProgressHeroCard` ve `StatCard` yeni ürün özelliği olarak bağlanmadı. Mevcut bileşenler tema metinleri, uzun etiket ve semantics için düzeltildi; ilerleme sıfır/negatif toplamda boş, negatif segmentler hariç, taşan toplamda %100 sınırı ve normalize bar ile davranır. Aylık rapor/istatistik teslim edildiği iddia edilmez.

## Audit kimlikleri

Kod düzeyinde bu worker kapsamındaki HOME-F03 / DA-F07 (veri kesinliği), DA-F06 / HOME-W08 (dar ekran ve büyük metin), DA-F01'in home/ortak kart/merkezi tema bölümü giderildi. HOME-F02'nin UI çift dokunma bölümü giderildi; uçtan uca idempotency operation provider/backend sahiplerinin teslimine ve merkezi testlere bağlıdır.

MOB-12'nin home sunumu, MOB-15'in tema/ortak kart/duyarlı home alt işleri uygulanmıştır. MOB-06/MOB-09 için fiziksel operasyon UI bağlaması, MOB-10/MOB-11 için bağımsız günlük özet ve iş zamanı UI tüketimi, MOB-14 için tam hedef doğrulama uygulanmıştır; bu üst işlerin diğer modül/backend/donanım kapsamının tamamı bu raporla kapatılmaz. HOME-F01 için yanıltıcı bool self-check-in kaldırılmış ve gerçek komut API’si bağlanmıştır; gerçek panelin açılması/geçiş üretmesi bu worker tarafından doğrulanmamıştır.

## Değişen dosyalar

- `mobile/lib/screens/home/home_screen.dart`
- `mobile/lib/theme/app_theme.dart`
- `mobile/lib/widgets/cards/attendance_status_card.dart`
- `mobile/lib/widgets/cards/quick_action_card.dart`
- `mobile/lib/widgets/cards/door_command_status_card.dart` (yeni)
- `mobile/lib/widgets/cards/section_header.dart`
- `mobile/lib/widgets/cards/progress_hero_card.dart`
- `mobile/lib/widgets/cards/stat_card.dart`
- `mobile/lib/widgets/responsive_card_grid.dart` (yeni)
- `mobile/test/widgets/home_cards_test.dart` (yeni)
- `mobile/test/widgets/home_screen_test.dart` (yeni)
- `mobile/test/widgets/door_command_status_card_test.dart` (yeni)
- `mobile/test/theme/app_theme_test.dart` (yeni)
- Bu rapor.

## Arayüzler ve sahiplik bağımlılıkları

- 03: `AttendanceProvider.loadDailySummary`, summary state/known flag ve legacy günlük getterları; `AttendanceDate.businessTime`.
- 08: `PreferredDeviceProvider.identityGeneration/revalidate/deviceId/doorId/targetId/wasInvalidated`; employee kapsamlı tam hedef listesi. TR/EN home loading/error/stale/retry/unknown/updatedAt/scan ve command sending/pending/confirmed/failed/unknown/check/retry/door-unavailable anahtarları 08 sahibi tarafından eklenmiştir.
- 14: `DoorOperationProvider.operation/isLoading/error/hasUnresolvedOperation/requestId`, `open`, `checkStatus`, `retrySameRequest`; typed `DoorOperationStatus` ve allowlist failure code.
- Koordinatör/root: kaynakta `DoorOperationProvider` aynı client ve session/deployment kapsamıyla enjekte edilmiş, `synchronizeSession` bağlanmıştır. `DeviceRepository` injection da mevcuttur; runtime bootstrap akışı merkezi entegrasyon testlerine aittir.
- Başka workerın history/visitor widgetlarına dokunulmadı. Yeni dependency eklenmedi; google_fonts kaldırma/pubspec işi platform sahibindedir.

## Yazılan testler ve kontroller

Test kodu:

- Home kart testleri: yükleme semantics, verisiz hata/retry → başarılı boş, bilinmeyen yön, eski veri + hata, iş saatinin gösterimi, gerçek EN kartta tekil hareket metni, 320 dp iki sütun → %200 tek sütun, TR/EN × açık/koyu × %200 uzun kapı adı, busy disabled semantics ve eylemin çalışması, progress sıfır/negatif/taşan veri.
- Home ekran testleri: yalnız günlük özet isteği, ilk hatadan toparlanma, hedef doğrulaması sırasında çift dokunma, hesap değişimi sonrası gecikmiş yanıt, hedef seçimi değişiminde eski komut niyetinin iptali, ağ hatasında tercihin korunması ve unresolved operasyonda yeni komutun engellenmesi.
- Komut kartı testleri: tüm beş operasyon durumu, salt okuma kontrolü ile explicit resend ayrımı, ağ hatası ile erişim reddi ayrımı, gönderim sırasında disabled eylemler, restore sorgusunun komut sayılmaması, 320 dp/%200 kurtarma düğmeleri.
- Tema testleri: iki temada gerçek kullanılan status/primary/surface çiftlerinin kontrastı ve düğme foreground/background rolleri.

Çalıştırılan kontroller: kapsamlı kaynak/diff incelemesi; sahipli dosyalarda `git diff --check`; Python ile merkezi sekiz status çiftinin sRGB nominal kontrast hesabı. Status çiftleri 6,80:1–10,13:1 arasındadır. Bu hesap antialiasing, cihaz ve gerçek render ölçümü değildir.

**Bu worker Flutter/dart test, analyze, pub get, gen-l10n, format, build, pod/gradle çalıştırmadı:** koordinatör SDK kilidi nedeniyle bunları merkezi sahibine ayırdı. Koordinatörün ilk [analyze kaydı](../evidence/flutter-analyze-integration.txt) home async-context/lint uyarıları; ilk [test kaydı](../evidence/flutter-test-integration.txt) birleşik loading semantics etiketi, semantics handle kapanışı ve Home test fixture/Completer nesnelerinin farklı async zone içinde kurulmasını buldu. Bunlar doğrudan mounted kontrolleri, güncel semantics flags API’si, test içinde try/finally ile handle kapama ve Home widget senaryolarında deterministik notifier fakes ve callback içinde fixture/request-time Completer kurulumu kullanılarak düzeltildi; çift dokunma ve stale-auth assertions korundu. Koordinatörün [hedefli üçüncü turunda](../evidence/flutter-targeted-integration3.txt) bu teslimin dört test dosyasının tamamı geçti: home_screen, home_cards, door_command_status_card ve app_theme. Aynı karma hedefli tur 104 başarılı / 1 başarısız test ile bitti; tek başarısızlık bu worker kapsamı dışındaki router navigation semantics testidir. [İkinci analyze turunda](../evidence/flutter-analyze-integration2.txt) bu worker dosyalarına ait bulgu yoktur; turdaki tek info başka sahibin profile testindedir. Bu scoped başarı tüm uygulama testlerinin geçtiği anlamına gelmez; final format/broad analyze/test ve generated l10n doğrulaması koordinatörün release kapısıdır. Backend veya broad npm kontrolü bu worker tarafından çalıştırılmadı; backend değiştirilmedi.

## Açık yayın engelleri ve doğrulama sınırları

1. Bu teslimin dört test dosyası merkezi hedefli turda geçti ve analyze2’de own bulgu yok. Genel Flutter test/analyze/format ve root/bootstrap/backend operasyon entegrasyonunun son kapısı koordinatördedir; hedefli turdaki kapsam dışı router semantics hatası ayrıca kapanmalıdır.
2. Android/iOS gerçek cihazda 320/360/tablet/landscape, %200 metin, TalkBack/VoiceOver, klavye odağı ve tema geçişiyle render/kontrast/hit-area kontrolü yapılmadı.
3. Fiziksel panel ack kaybı, offline, çok kapılı actuator, confirmed ama fiziksel geçiş yok ve okuyucu olayından katılım üretimi izole donanım ortamında doğrulanmalı. UI device ack’i fiziksel geçişe dönüştürmez.
4. Signing, mağaza kimlikleri ve platform credentials bu dosya sahipliğinin dışındadır; bunlara sahip olunmadan uygulamanın yayınlandığı iddia edilmez.
