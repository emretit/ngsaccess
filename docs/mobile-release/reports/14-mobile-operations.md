# Mobil kapı işlemleri — uygulama teslimi

19 Ekim 2026. Kapsam yalnız ayrı kapı komutu domain/repository/provider/store katmanları ve testleridir. Home, attendance, backend/schema, main/root, cihaz tercihi ve global yerelleştirme dosyaları bu worker tarafından değiştirilmedi. Önceden var olan web/Convex değişiklikleri korundu.

## Uygulanan davranış

- Kapı komutu `AttendanceProvider` dışında `DoorOperationProvider` ile yürütülür. `confirmed` cihaz komut ACK'sidir; kapının fiziksel açıldığını, kişinin geçtiğini veya attendance kaydı oluştuğunu ifade etmez. Bu katmanda attendance yazımı yoktur.
- `mobileAccess:requestOpen` yalnız employee session kullanan mutation ile çağrılır. `getOperation` ve `getRequestOperation` ayrı employee query'leridir. Frontend çalışan/proje kimliği endpoint yetki argümanı olarak gönderilmez.
- Decoder gerekli operation/device/opsiyonel door ID'lerini, durum enum'unu ve backend'in `Date.toISOString()` biçimindeki UTC tarihini doğrular. Bozuk tarihler normalize edilerek kabul edilmez. Başarısız komut nedeni allowlist enum'una dönüşür; keyfi hata metni modele taşınmaz.
- Her yeni niyet `Random.secure()` ile üretilmiş 128 bit requestId alır. Busy ve sahiplik ilk await'ten önce sabitlenir. İlk işlem sürerken yapılan on dokunma, pending/sent/unknown durumu ve hedef değiştirme yeni komut üretmez.
- Kullanıcı + proje + deployment kapsamlı, sürümlü tek kayıt requestId, cihaz/kapı hedefi ve varsa operationId'yi tutar. Token, parola, e-posta veya ham HTTP gövdesi saklanmaz. Uygulama destek dizinindeki geçici dosya `flush: true` ile yazılır, aynı dizinde rename ile ana kaydın yerini alır; kayıt doğrulaması tamamlanmadan mutation gönderilmez.
- Store ve provider yazımları sıralanır. Aynı isolate'ta store/provider yeniden yaratıldığında yeni restore, önceki instance'ın başlamış dosya yazımını bekler. Yarım/kesilmiş, yanlış sürümlü veya yanlış scope'lu kayıt sessizce silinmez; yeni komut engellenir.
- Yeniden başlatma yalnız önceki niyeti okur ve query ile uzlaşır. Server lookup null dönerse yeni requestId veya mutation üretilmez. `checkStatus()` her durumda salt okunurdur. `retrySameRequest()` açık kullanıcı eylemidir: önce lookup yapar; yalnız kayıt yoksa aynı ID ve aynı hedefi yeniden gönderir. Bilinen operationId'nin kaybolması halinde yeniden yazmaz.
- İlk mutation'ın yapılandırılmış kesin reddi yerel niyeti güvenle temizleyebilir. Yanıt kaybı, protokol/sunucu/ağ hatası veya belirsiz tekrar bu yoldan temizlenmez. Terminal snapshot sonrası store temizliği başarısızsa bile sonraki niyet engellenir.
- Auth nesli, kullanıcı, proje, deployment ve dispose sahipliği sorgu/mutation, error ve finally yazımlarında kontrol edilir. A'nın geç yanıtı, hatası veya finally'si B'nin state/busy değerini değiştiremez. Auth expiry yalnız yakalanan epoch/token sahibi oturuma uygulanır. Logout/dispose cihaz komutunu iptal ettiğini iddia etmez; scope'lu kayıt aynı hesabın sonraki açılışında sorgulanmak üzere korunur.
- Timer/poll döngüsü yoktur. Bekleyen komut için gösterilebilecek son zaman canonical `requestedAt + 30 saniye` olarak sağlanır; client zaman aşımı yeni işlem başlatmaz veya server durumunu uydurmaz.

## Audit karşılığı

| Audit işi/bulgu | Bu teslimin kapattığı bölüm | Ortak kapanış sınırı |
| --- | --- | --- |
| MOB-06; HOME-F01; NET-F02 | Ayrı gerçek command istemcisi ve ACK/attendance ayrımı | Backend11 gerçek komut yolu, Home06 bağlantısı ve fiziksel panel doğrulaması ortak kabul gerektirir |
| MOB-09; HOME-F02 | Tek niyet/ID, durable kayıt, response-loss sorgusu, query-only restore ve açık aynı-ID retry | Backend idempotency ve cihaz etkisi bu worker'ın test kapsamı dışındadır |
| MOB-03; HOME-F08 ile aynı sahiplik kök nedeni | Yeni komut katmanının bütün async sonuçları, hata ve finally sahiplik koruması | Attendance/auth modüllerinin diğer yolları kendi sahiplerindedir |
| MOB-04; NET-F06 ile aynı DTO kök nedeni | Yeni operation DTO'sunda strict decode, protocol error ve typed güvenli failure | Ortak transport/error localizer Core18 tarafından teslim edilir |

Bu tablo yalnız uygulanan client bölümünü kapatır; MOB-06/09'un donanım ve backend kabulünün tamamlandığı iddiası değildir.

## Dosyalar ve arayüzler

Uygulama:

- `mobile/lib/models/door_operation.dart`
- `mobile/lib/repositories/door_operation_repository.dart`
- `mobile/lib/providers/door_operation_provider.dart`
- `mobile/lib/services/door_operation_store.dart`

Testler:

- `mobile/test/models/door_operation_test.dart`
- `mobile/test/repositories/door_operation_repository_test.dart`
- `mobile/test/providers/door_operation_provider_test.dart`
- `mobile/test/services/door_operation_store_test.dart`

Entegrasyon API'si Home06/Main13/Backend11/Core18'e Orca mesajlarıyla iletildi:

```dart
DoorOperationRepository(HttpConvexClient client);
DoorOperationProvider({required DoorOperationRepository repository, DoorOperationStore? store});
Future<void> synchronizeSession(AuthProvider auth, {required String deployment});
Future<void> open({required String deviceId, String? doorId});
Future<void> checkStatus();
Future<void> retrySameRequest();
```

Public state: `operation`, `isLoading`, `error`, `hasUnresolvedOperation`, `requestId`, `pendingDeviceId`, `pendingDoorId`, `canRetrySameRequest`, `pendingExpiresAt`. `dispose()` owned notifier state'ini kapatır; enjekte client'ı kapatmaz ve auth listener sahiplenmez. Root auth değişiminde `synchronizeSession` çağırır. Aynı kimlik/epoch tekrarında restore tekrarlanmaz. Varsayılan store `FileDoorOperationStore`; test için `DoorOperationStore` veya directory resolver enjekte edilebilir.

Bağımlılık: Koordinatör onayıyla Platform07 mevcut lock'taki `path_provider: 2.1.5` paketini doğrudan dependency yaptı. Bu worker pubspec/lock veya SDK komutu çalıştırmadı. Shared preferences'in await sonrası disk kalıcılığı garanti etmemesi [resmi paket belgesinden](https://pub.dev/packages/shared_preferences) doğrulandı; uygulama destek dizini [path_provider resmi belgesi](https://pub.dev/packages/path_provider) üzerinden seçildi. Flush semantiği [Dart API belgesi](https://api.dart.dev/dart-io/RandomAccessFile/flush.html) ile kontrol edildi.

## Test ve doğrulama

Yazılmış 28 test: model 3, repository/HTTP 3, provider 15, gerçek dosya store 7. Başlıca regresyonlar:

- On eşzamanlı dokunma ve unresolved hedef değişimi tek request/ID bırakır.
- Gerçek dosya + provider + mocked HTTP testi, niyetin HTTP öncesi diskte bulunmasını; commit sonrası timeout ve provider relaunch'ın yalnız lookup ile aynı sonucu bulmasını doğrular.
- Mutation otomatik retry yapmaz; HTTP query/mutation yolları, session ve tam hedef argümanları gerçek Convex singleton-args zarfında sınanır.
- Restore null/unknown sonucu yeniden komut göndermez; açık retry aynı ID ve hedefi kullanır.
- Store read/write/remove hataları, bozuk/yarım/yanlış scope/sürüm kayıtları, crash-before-rename ve instance değişimi gerçek temp dizinleriyle sınanır.
- Logout sırasında store yazımı, A/B geç mutation/query/error/finally, yeni B işlemi sürerken A finally'si ve dispose sonrası bildirim testleri bulunur.
- Kesin ret sonrası yeni niyet; terminal cleanup hatasında engelleme; güvenli typed hata decode testleri bulunur.

Bu worker SDK lock gereği Flutter/Dart test, analyze, pub get, format, build veya native dağıtım komutu çalıştırmadı. `git diff --check` yalnız owned path'ler için çalıştırıldı ve hata üretmedi; dosyalar henüz untracked olduğu için bu tek başına yeni kaynakların Dart doğrulaması değildir. Koordinatörün önceki `flutter-analyze-integration2.txt` kaydında bu worker dosyalarına ait issue yoktu; son eklenen race testleri ve store instance sıralaması için nihai scoped suite + analyze koordinatöre açıkça iletildi. Önceki integration run'ın HTTP args assertion hatası gerçek Convex zarfına uygun biçimde düzeltildi; assertion gevşetilmedi.

## Açık sınırlar

- Son kaynaklar üzerinde SDK doğrulaması koordinatörün kilitli test/analyze koşusuna bağlıdır; burada çalıştırılmış gibi raporlanmaz.
- Gerçek Android/iOS process-kill/relaunch, panel offline/ACK kaybı, generic/Hikvision/IDE transport ve çok kapılı hedef testleri fiziksel donanımla yapılmadı. İmzalama, platform credential, mağaza gönderimi veya production mutation yapılmadı.
- Flush + aynı dizinde rename process ölümü/yeniden başlatma için güvenlik sağlar. Dart parent directory fsync sağlamadığından ani güç kesintisinde directory metadata kalıcılığı garantisi ileri sürülmez. Disk kaybı, uygulama verisinin kullanıcı/OS tarafından silinmesi ve uygulama kaldırılması yerel kaydın kapsamı dışındadır.
- Store sıralaması aynı isolate içindeki app composition sahipliği içindir; birden çok bağımsız process/engine'in aynı app-support kayıtlarına yazması destek taahhüdü değildir.
- Kalıcı bozuk kayıt veya server'da çözülemeyen unknown sonuçta otomatik unut/yeni ID yolu sunulmaz. Kullanıcıya eski komutun iptal olduğu söylenemez; operasyonel destek/gerçek backend sonucu gerekir.
