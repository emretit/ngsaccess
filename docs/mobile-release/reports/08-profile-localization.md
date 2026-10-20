# 08 — Profil, kapsamlı hedef tercihi ve yerelleştirme teslimatı

19 Ekim 2026. Bu rapor gerçek kod değişikliklerini kaydeder; yayın, üretim mutasyonu veya fiziksel kapı doğrulaması yapıldığı anlamına gelmez. Önceden mevcut web/Convex değişiklikleri korundu; yalnız bu dispatch'in sahip olduğu mobil dosyalar, ilişkili testler ve bu rapor düzenlendi. Backend kaynaklarına dokunulmadı; endpoint sözleşmesi backend/auth sahiplerinin Orca mesajlarından alındı.

## Uygulanan davranış

- **Hedef tercihi:** `setIdentity(employeeId, projectId:, deployment:)` kimlik değişiminde belleği senkron temizler; eksik kapsamda tercih kullanmaz. Version 1 tek JSON kaydı çalışan/proje/deployment ile cihaz, kapı ve opak targetId'yi birlikte saklar. Eski iki kapsam dışı anahtar silinir, hiçbir hesaba taşınmaz. Tek son tercih tutulur: farklı hesap başka seçim kaydederse önceki hesabın tercihi ayrıca arşivlenmez.
- **Depolama:** Tercih yazıları sıralıdır; hata/false dönüşü kaydedildi sayılmaz. İd/ad karışık çift oluşmaz. Kimlik değişimi/dispose sonrası eski okuma/yazma sonuçları yeni belleğe, hata veya busy durumuna dokunamaz. Tema/dil geç bootstrap sonucuyla kullanıcı seçimini geri almaz; başarısız sonraki yazıdan önceki doğrulanmış seçim korunur.
- **Hedef listesi:** `DeviceRepository.listForEmployee()` session tabanlı `mobileAccess:listTargets` çağırır; istemciden çalışan/proje ID'si göndermez. Tek paneldeki farklı kapılar ayrı hedef olarak kalır. DTO yanlış şekil/tip/ID/duplicate veya eksik capability alanında `ProtocolError` üretir; başarılı boş listeyle hata karışmaz. Eksik gerçek ad `null` kalır; çevrilmiş fallback depolanmaz.
- **Seçim ekranı:** Yenileme, Türkçe I/İ/ı duyarlı arama, açık tercih kaldırma, kaydetme kilidi, yerelleştirilmiş hata ve seçili durum semantiği vardır. Liste yalnız başarılı tam cevapta tercihi doğrular; eksik/pasif/yetkisi kalkmış hedefi temizler ve açıklar. Ağ hatası tercihi silmez. Geçici saat kısıtında tercih korunur; kullanılamayan hedef seçilmez. Kapı ve transport hata nedenleri allowlist kodlardan çevrilir. Hesap/istek nesli geç yanıtı engeller. İçerik, kısa ekran/büyük metinde kaydırılan sliver düzenindedir; stack yoksa Profil'e döner.
- **Tema ve dil:** Cihaz genelinde, logout sonrası korunan sistem/TR/EN locale seçimi ve açık/koyu/sistem tema seçimi gerçekten kaydedilir. Kayıt tamamlanmadan dialog başarıyla kapanmaz; hata ve ilerleme görünür. `LocaleProvider.locale == null` sistem takibidir; desteklenmeyen sistem dili mevcut `supportedLocales` sırasına göre EN'ye düşer. Root binding başka dispatch'in sorumluluğudur.
- **Profil:** Gerçek çalışan bilgisi, erişilebilir semantik renkler ve grapheme tabanlı avatar; sahte örnek e-posta yoktur. Kurumsal ad/soyad/e-posta salt okunur olduğu açıkça anlatılır. Çalışmayan genel ayarlar dialog'u kaldırıldı. Yardım, güvenlik, bildirim kullanımı ve gizlilik açıklamaları gerçek kaydırılabilir içerik sayfalarıdır ve açıkken dil değişimini izler.
- **Parola:** Güvenlik sayfasında mevcut/yeni/tekrar şifre alanları, en az 12 Unicode code point, en fazla 72 UTF-8 bayt, mevcut şifreden farklı ve eşleşen tekrar doğrulaması; gerçek `AuthProvider.changePassword` çağrısı, gönderim kilidi ve güvenli yerel hata vardır. Başarı auth sahibinin API'siyle tüm eski oturumların geçersizleştirilmesi ve yerel çıkışa bağlanır. Unutulan parola yöneticinin kurulum bağlantısı modelini anlatır; e-posta gönderilmiş gibi göstermez.
- **Sürüm:** Profil ve Hakkında aynı `PackageInfo.fromPlatform()` Future'ından kurulu version/build bilgisini gösterir; okuma hatasında sabit yanlış sürüm yerine yerel fallback vardır. `package_info_plus: 8.3.1` bağımlılığını platform sahibi ekledi; bu worker pubspec/lock değiştirmedi.
- **Katalog:** Başlangıçtaki 229 TR/EN anahtarın tamamı korundu; 357 eşleşen mesaj vardır. Auth, startup, history, QR, home command ve visitor sahiplerinin anahtarları eklendi. EN'deki üç kayıt sayacı ICU one/other kullanır; TR sayı sözleşmesi korunur. İlgili hata/unknown etiketleri UI'da çevrilir. ARB kaynak kabul edilir; generated dosyaların son üretimi koordinatöre aittir.

## Audit kapanış sınırı

| Audit işi | Bu teslimdeki durum |
| --- | --- |
| MOB-14 / DEV-F01, DEV-F06, DEV-F07 / PROFILE-F02 / DEV-W01,W05,W06 | Yerel kapsam, atomic kayıt, DTO, revalidate ve kurtarma UI kodu uygulandı; test doğrulaması aşağıda. Root ve gerçek backend yetkilendirmesi ilgili sahiplerle entegre edilir. |
| DEV-W04 / DEV-F05 | Door/target DTO ve seçici tarafı uygulandı. Kapı izinleri/aktüatörün sunucuda çözülmesi backend sahibinde; fiziksel kapı kanıtı bu raporun iddiası değildir. |
| MOB-16 / L10N-F01,F06,F07 / PROFILE-F06 / PROFILE-W08,W09 | Locale/tema kayıt koruması, gerçek seçiciler, ICU sayaçlar, runtime version/build uygulandı. Root locale injection ve son gen-l10n koordinatörde. |
| L10N-F03,F04 / DEV-F08 | Bu sahiplikteki device model/selector ham hata ve Türkçe fallback kaldırıldı; diğer hata/attendance/visitor/QR tüketicileri kendi dispatch'lerinde. |
| MOB-17 / PROFILE-F03,F04 / PROFILE-W03–W06 | Yönetici kontrollü profil alanları dürüstçe salt okunur; gerçek parola değişimi ve kullanım desteği uygulandı. Kurtarma ekranının kendisi auth sahibinde. Bildirim teslim altyapısı ve kuruluşun onaylı public policy URL'si tamamlanmış sayılmadı. |
| MOB-15 | Bu sahiplikte semantik renk/ikon tooltip/seçili durum/scroll ve büyük metin düzenleri uygulandı; cihaz ekran okuyucu/kontrast matrisi hâlâ gerçek cihaz QA kapısıdır. |
| MOB-01/02/03/05/06/07/09, PROFILE-F01,F05, DEV-F02–F04, L10N-F02,F05 | Ortak auth/backend/home/QR sahiplerinin işleri; bu worker bunları kendi uygulaması veya kapalı bütün ürün yeteneği olarak sahiplenmez. |

## Değişen dosyalar

- `mobile/lib/screens/profile/profile_screen.dart`
- `mobile/lib/screens/settings/select_device_screen.dart`
- `mobile/lib/providers/theme_provider.dart`
- `mobile/lib/providers/preferred_device_provider.dart`
- `mobile/lib/providers/locale_provider.dart` (yeni)
- `mobile/lib/repositories/device_repository.dart`
- `mobile/lib/models/device.dart`
- `mobile/lib/l10n/app_tr.arb`, `app_en.arb`, `app_localizations.dart`, `app_localizations_tr.dart`, `app_localizations_en.dart`
- `mobile/test/helpers/preference_store.dart`
- `mobile/test/providers/theme_provider_test.dart`, `locale_provider_test.dart`, `preferred_device_provider_test.dart`
- `mobile/test/models/device_test.dart`
- `mobile/test/repositories/device_repository_test.dart`
- `mobile/test/l10n/catalog_test.dart`, `expected_keys.json`
- `mobile/test/widgets/profile_screen_test.dart`, `select_device_screen_test.dart`
- Bu rapor. `mobile/l10n.yaml` mevcut doğru yapılandırması korundu; main/router/home/auth/config/pubspec/backend bu worker tarafından değiştirilmedi.

## Entegrasyon arayüzleri

- `PreferredDeviceProvider.setIdentity(String? employeeId, {String? projectId, String? deployment}) -> Future<void>`; bellek ilk await öncesi temizlenir. Root her auth epoch değişiminde null ile sıfırlayıp doğrulanmış employee/project/deployment bağlar. `bootstrap()`, `revalidate(List<Device>) -> Future<bool>`, `setDevice({required String id, required String? name, String? doorId, String? targetId}) -> Future<bool>`, `clear() -> Future<bool>`, `deviceId`, `deviceName`, `doorId`, `targetId`, `identityGeneration`, `hasIdentity`, `isSaving`, `error`, `wasInvalidated` mevcuttur.
- Hızlı işlem sahibi tam target listesini getirip yakalanan `identityGeneration` hâlâ geçerliyken `revalidate` eder; backend çağrısına `deviceId` ile **doorId** gönderir. UI tercihi yetki kaynağı değildir.
- `LocaleProvider.bootstrap()`, `Locale? locale`, `setLocale(Locale?) -> Future<bool>`, `isSaving`, `error`, `dispose()`; root Provider ve `MaterialApp.router.locale` bağlar. `ThemeProvider.setThemeMode -> Future<bool>` mevcut await/ignore tüketicileriyle uyumludur.
- `PreferenceError` allowlist enum'u `storage`, `unavailableIdentity`, `invalidSelection` içerir. Providerlar exception metni yerine bu kodları tutar. Test enjeksiyonu `PreferencesLoader` ile yapılır; yeni dependency/framework eklenmedi.
- `Device.name` nullable'dır; UI `doorName ?? name ?? l10n.historyUnknownDevice` kullanır. `targetId` opak preference kimliğidir; `id` gerçek deviceId'dir. `transport`, `canOpen`, `reason`, `supportsReaderToken`, `actuator`, `doorId` DTO'da korunur. `actuator:null` yalnız kullanılamayan hedefte kabul edilir; açılabilir hedefte gerçek, transport için geçerli IO zorunludur (IDE MQTT 0 tabanlı; Hik gateway 1 tabanlı). 0 uydurulmuş fallback olarak kullanılmaz; backendden gelen gerçek IDE IO 0 korunur.
- Parola formu auth sahibinin `changePassword({required String currentPassword, required String newPassword}) -> Future<bool>`, `isChangingPassword`, `lastError` arayüzünü kullanır; backend endpoint'i `employeeAuth:changePassword` session'dan kimlik türetir.

## Testler ve kontroller

51 yeni regresyon vakası yazıldı: 5 tema, 6 locale, 12 kapsamlı tercih, 6 device decode, 3 device repository, 2 katalog, 10 gerçek profil widget ve 7 gerçek selector widget testi. Testler A→B geç yanıt/yazı, proje/deployment ayrımı, legacy temizleme, tek JSON eşleşmesi, aynı panelde ayrı kapılar, yanlış DTO, false depolama, sıralı yazı, bootstrap yarışı, dispose, locale değiştirme, metadata fixture değişimi, gerçek parola çağrısı/hata, EN hata, bilinmeyen ad ve büyük yazı akışlarını kapsar.

Worker tarafından çalıştırılan kontroller:

- Python JSON/source doğrulaması geçti: orijinal **229** anahtarın tamamı korundu; **357** TR/EN anahtarı, placeholder sözleşmeleri, generated erişiciler ve `expected_keys.json` eşleşiyor.
- Sahip olunan kaynak/testlerde `git diff --check` geçti.
- Flutter/Dart analyze/test/pub get/gen-l10n/build/pod/gradle komutları SDK kilidi gereği **bu worker tarafından çalıştırılmadı**. Koordinatörün merkezi analizindeki bu worker'a ait 3 curly info ve bir test underscore info düzeltildi.
- İlk iki merkezi broad koşuda widget fixture'larının farklı async zone'larda kurulması nedeniyle tamamlanmayan senaryolar vardı; tam geçiş kanıtı olarak kullanılmadı. Fixture kurulumları testWidgets callback'i içindeki tek FakeAsync zone'a taşındı. Koordinatörün [targeted integration3 kanıtı](../evidence/flutter-targeted-integration3.txt) bu değişiklikten sonra **profildeki 10 ve selector'daki 7 testin tamamının geçtiğini** doğrular; karma koşunun toplamı 104 başarılı/1 bu scope dışı router semantik hatasıdır. Sonradan eklenen mixed nullable IO ve gecikmiş restore doğrulaması dahil 51 testin tamamının nihai merkezi tekrar koşusu ve son analyze sonucu koordinatörün release raporunda ayrıca kaydedilmelidir.

Paket API'si resmi [PackageInfo.fromPlatform dokümantasyonu](https://pub.dev/documentation/package_info_plus/latest/package_info_plus/PackageInfo/fromPlatform.html) üzerinden doğrulandı; yeni current version iddiası yapılmadı. Bu API kurulu paket version/build bilgisini sağlar; release cihazında kurulu binary ile karşılaştırma ayrıca gerekir.

## Açık teslimat/yayın kapıları

1. Gerçek push teslim/OS izin/token/backend tercih altyapısı yoktur; bu yüzden etkisiz bildirim anahtarı oluşturulmadı. Profilde bu sınır ve gerçek yenileme/destek kullanımı açıklanır; push alt işi açık kalır.
2. Kuruluşun onaylı, herkese açık gizlilik politikası ve tanımlı destek URL/adresi config'te yoktur. Tarihli yerel veri açıklaması ve kurum yöneticisine başvuru yolu uygulanmıştır; bu içerik onaylı kuruluş politikası olarak sunulmaz. Mağaza public privacy URL gate'i hâlâ ürün/yayın sahibindedir.
3. Ad/soyad/e-posta düzenleme yetkisi verilmiş self-service backend bulunmadığı için bu alanlar yönetici kontrollüdür; güvenli read-only ürün seçeneği uygulanmıştır. Geniş admin update çağrısı mobile açılmadı.
4. Android/iOS fiziksel cihazda TR/EN, sistem dil değişimi, TalkBack/VoiceOver, kısa viewport/klavye/%200 metin, kalıcı tercihle yeniden başlatma ve gerçek panel/reader sonucu bu worker tarafından denenmedi. Release signing/platform credential/mağaza gönderimi başka sahipteki yayın kapılarıdır.
5. Son format/gen-l10n ve tüm test/analyze entegrasyonu merkezi SDK sahibi tarafından tamamlanmalıdır. Generated Dart geçici düzenlemeleri nihai üretimde ARB'den yeniden oluşturulabilir; `expected_keys.json` yeni anahtar talepleriyle birlikte güncellenmelidir.

Son koordinasyon kaydı: Ziyaretçi sahibi VISW04/W06 anahtarlarını gerçek UI'da tükettiğini ve ek anahtar istemediğini doğruladı; koordinatör 357 anahtarlık kataloğu final kabul etti. Bu dispatch 17 geçen widget testi ve 51 kaynak regresyon kapsamıyla teslim edilir; son gen-l10n/format/full test ve zorunlu geç anahtar entegrasyonunu root üstlenir.
