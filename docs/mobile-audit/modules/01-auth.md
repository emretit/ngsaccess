# 01-auth — Kimlik doğrulama ve oturum audit raporu

Tarih: 19 Ekim 2026. Kapsam: NGS Plus Flutter çalışan girişi, parola kurtarma arayüzü, oturum geri yükleme/saklama/sonlandırma ve bunların Convex sözleşmesi. Bu rapor mevcut çalışma ağacının kaynak analizidir; üretim sürümünün aynı kodu çalıştırdığı varsayılmamıştır.

Uygulama, backend, platform ve test dosyaları değiştirilmedi; Flutter test/analyze/pub get/build, formatlama, deploy, commit veya push çalıştırılmadı. Cihaz, emülatör, gerçek sunucu ve e-posta servisi üzerinde doğrulama yapılmadı. Başlangıçtaki diğer değişiklikler korundu. Convex okunmadan önce `convex/_generated/ai/guidelines.md` dosyasının tamamı okundu. Hiçbir ortam sırrı, gerçek token veya kişisel veri değeri rapora alınmadı.

## 1. İnceleme envanteri ve gerçek akış

### Dosyalar

Hedef kapsamındaki bütün dosyalar tam okundu:

| Dosya | İncelenen sorumluluk |
| --- | --- |
| `mobile/lib/screens/auth/login_screen.dart:1–255` | Alan doğrulama, remember-me yükleme/yazma, giriş ve navigasyon |
| `mobile/lib/screens/auth/forgot_password_screen.dart:1–225` | Parola kurtarma formu, hata ve başarı görünümü |
| `mobile/lib/providers/auth_provider.dart:1–162` | Bootstrap, giriş, expiry, logout, yerel oturum |
| `mobile/lib/repositories/auth_repository.dart:1–111` | `employeeAuth:*` çağrıları, yanıt modeli |
| `mobile/test/providers/auth_provider_test.dart:1–185` | Mock repository ile giriş, expiry, logout ve hata temizleme |
| `mobile/test/repositories/auth_repository_test.dart:1–129` | Mock HTTP istemcisi ile parse ve logout çağrısı |
| `mobile/test/widgets/login_screen_test.dart:1–132` | Form doğrulamaları ve başarısız giriş snackbar'ı |

Bağlam için tam okunan dosyalar: `AGENTS.md`, `convex/_generated/ai/guidelines.md`, `mobile/lib/main.dart`, `mobile/lib/screens/splash_screen.dart`, `mobile/lib/router/app_router.dart`, `mobile/lib/config/convex_config.dart`, `mobile/lib/core/errors.dart`, `mobile/lib/core/error_localizer.dart`, `mobile/lib/providers/preferred_device_provider.dart`, `mobile/test/helpers/mocks.dart`, `mobile/test/config/convex_config_test.dart`, `convex/employeeAuth.ts`, `convex/lib/employeeAuth.ts`, `convex/employeeAuth.test.ts`, `convex/actions/setPassword.ts`, `convex/lib/rateLimit.ts`.

Seçili bölümleri okunan bağlantılar: `mobile/lib/providers/attendance_provider.dart:128–280,315–350` (oturum değişimi, eski sonuçlar), `mobile/lib/screens/profile/profile_screen.dart:455–479` (logout), `mobile/lib/screens/auth/forgot_password_screen.dart:125–225`, `mobile/lib/l10n/app_tr.arb:35–46` ve İngilizce karşılıkları, `mobile/pubspec.yaml` saklama bağımlılığı, `convex/schema.ts:142–165`, `convex/lib/customFunctions.ts:113–134`, `convex/actions/sendEmail.ts:140–202`, `convex/employees.ts:333–389,478–524`, `convex/lib/employeeUx.ts:1–19`, `convex/emailVerification.ts:21–39`. Son kontrolde koordinatörün `docs/mobile-audit/evidence/baseline.md`, `http560_repro_test.dart`, `http560-repro.txt` kanıtları ve yerel resmi SDK `node_modules/convex/src/browser/http_client.ts:27–32,305–340` bölümleri de okundu. `mobile/lib`, `mobile/test` ve `convex` altında auth/bootstrap/remember-me/session/refresh/rate-limit referansları `rg` ile tarandı. Liste dışındaki modüller için tam audit iddiası yoktur.

### Çalışma modeli

Giriş zinciri: `LoginScreen._signIn` → `AuthProvider.signIn` → `AuthRepository.signIn` → HTTP `/api/mutation`, `employeeAuth:signIn` → `employees` e-postası + `employeeAuth.passwordHash` → `employeeSessions` → Flutter kullanıcı/token durumu → router `/home`. Bu gerçek backend fonksiyonuna bağlıdır; demo giriş veya sabit kullanıcı dönüşü yoktur. Ancak bu audit gerçek sunucuda başarılı girişin kanıtı değildir.

Mobil oturum web `users`/Convex Auth JWT oturumundan ayrıdır (`convex/employeeAuth.ts:126–131`, `convex/lib/customFunctions.ts:113–134`). `HttpConvexClient.setAuth` yalnız tokenı belleğe koyar (`mobile/lib/config/convex_config.dart:85–91`); çalışan çağrıları tokenı `sessionToken` argümanı olarak gönderir (`:118–147`). JWT Authorization header beklenmemesi bu sözleşmede tek başına bug değildir.

| Capability | Durum | Kod kanıtı / sınır |
| --- | --- | --- |
| E-posta/parola ile çalışan girişi | Çalışıyor — kaynak zinciri | `auth_repository.dart:59–81`; `employeeAuth.ts:149–205`; gerçek ortam kanıtlanmadı |
| Hatalı/kurulmamış/pasif çalışan için giriş reddi | Çalışıyor — kaynak zinciri | `employeeAuth.ts:156–173`; aynı genel mesaj ve dummy parola karşılaştırması |
| Başarılı girişte kalıcı oturum | Çalışıyor — kaynak zinciri | `auth_provider.dart:80–89`; remember-me kapalı olsa da token saklanır |
| Soğuk açılışta geçerli oturumu geri yükleme | Kısmi | `auth_provider.dart:40–68`, `splash_screen.dart:56–78`; geçici ağ hatasında yeniden deneme UX'i yok |
| Yerel vade kontrolü ve backend vade kontrolü | Kısmi — kontrol var, hata iletimi sorunlu | `auth_provider.dart:50–55,150–154`; `convex/lib/employeeAuth.ts:11–22`; backend hata iletimi F09 |
| Remember-me | Kısmi / güvenlik sorunu | `login_screen.dart:42–72`; e-posta ve parola saklanır; `splash_screen.dart:67–74` bunlarla yeniden giriş yapar |
| Token yenileme/rotation | Placeholder: uygulanmamış capability | Backend 90 günlük sabit token verir (`employeeAuth.ts:6,176–185`); refresh endpoint'i/refresh token akışı bulunmadı. Parola ile tekrar giriş refresh değildir |
| İstemci güvenli saklama | Placeholder: uygulama katmanında uygulanmamış | Parola ve bearer token doğrudan SharedPreferences'a veriliyor; F01 |
| Açık çıkış ve token iptali | Kısmi | `auth_provider.dart:113–125`; sunucu token siler (`employeeAuth.ts:212–224`), remember-me yeniden oturum açar; F02 |
| Offline logout | Kısmi, bilinçli yerel çıkış | Sunucu hatası yutulur, sonra yerel durum silinir (`auth_provider.dart:117–125`); uzaktaki tokenın iptali garanti edilmez |
| Pasifleştirilen/silinen çalışanın mevcut oturumu | Kısmi | Backend reddeder; pasif çalışan mesajı expiry sayılmaz (F06); standart silme oturumları da siler (`employees.ts:363–365`) fakat hata iletimi F09 kapsamındadır |
| Kullanıcı değişimi | Kısmi | Logout üzerinden attendance temizlenir (`attendance_provider.dart:142–147`); eşzamanlı auth sonuçları korunmuyor; F04 |
| Parola sıfırlama e-postası | Placeholder | Provider her zaman false döner, hiçbir endpoint çağırmaz (`auth_provider.dart:106–110`); başarı görünümü erişilemez |
| Yönetici aracılığıyla parola kurma | Çalışıyor — backend kaynak zinciri | `sendEmail.ts:140–200` → web setup linki → `setPassword.ts:11–43` → atomik token tüketimi; gerçek e-posta teslimi kanıtlanamadı |
| Parola değişince eski oturumları iptal | Placeholder: uygulanmamış | `employeeAuth.ts:116–122`, `lib/employeeAuth.ts:11–22`; F03 |
| Uçtan uca cihaz doğrulaması | Kanıtlanamadı | Mevcut auth testleri mock tabanlı; bu audit testleri çalıştırmadı |

“Çalışıyor” sınıflandırması kaynakta tamamlanmış yol bulunduğunu belirtir; cihaz/üretim testi anlamına gelmez. Sonuç: 9 bulgu, 5 P1 ve 4 P2; P0 veya P3 bulgu yoktur. Test eksikleri bağımsız işlevsel bug olarak sayılmadı.

## 2. İyi çalışan temeller

- Domain repository ve provider ayrımı mevcut; camelCase `id/firstName/departmentName` modeli backend ile uyumlu (`auth_repository.dart:27–37,59–87`; `employeeAuth.ts:193–204,238–246`).
- Parola backend'de bcrypt karşılaştırılır; pasif, bulunamayan ve parolası kurulmamış çalışanlar aynı giriş mesajını alır (`employeeAuth.ts:156–173`, `lib/employeeAuth.ts:32–36`). Dummy karşılaştırması hesap varlığını açık hata mesajıyla ifşa etmeme yaklaşımını destekler; zamanlama saldırısının engellendiği ölçülmedi.
- Oturum tokenı 32 rastgele byte'tan üretilir, her girişte yeni kayıt ve vade oluşturulur (`employeeAuth.ts:9–14,176–186`). Backend her çalışan sorgu/mutasyonunda token, vade ve çalışan aktifliğini kontrol eden ortak wrapper kullanır (`customFunctions.ts:117–133`).
- Logout tokenı bulamazsa başarılı sayılır; ağ hatası yerel çıkışı kalıcı olarak engellemez (`employeeAuth.ts:212–224`, `auth_provider.dart:117–125`).
- Router auth değişikliklerini dinler; korumalı rotalar oturumsuz kullanıcıyı girişe yollar (`app_router.dart:48–61`). HTTP expiry sinyali provider'a bağlıdır (`main.dart:51–55`).
- Geçici bootstrap hatasında tokenı hemen silmeme niyeti doğru; yanlış parola gibi iş hataları ile expiry ayrımı için tipli hata altyapısı var (`auth_provider.dart:60–67`, `core/errors.dart:8–33`). Geri kazanım akışı F05'te eksiktir.
- Setup tokenı okuma ve tüketme aynı mutation içinde, tek kullanımlı ve vadeli yapılır (`employeeAuth.ts:99–123`). Bu davranışı doğrulamayı amaçlayan testler var (`employeeAuth.test.ts:107–126`). Auth kayıtlarının ham sorguları internal; public setup sorgusu sınırlı alan döndürür (`employeeAuth.ts:17–55`).
- Attendance aboneliğinde generation ve iptal kontrolü mevcut; logout'ta liste temizlenir (`attendance_provider.dart:128–178,219–227`). Aynı korumanın auth işlemlerine ve bütün tek seferlik veri isteklerine yayılması gerekir.

## 3. Kanıtlı bulgular

AUTH-F01–F08 bulgularının kesinliği **kaynak analizi**dir; tetikleyicileri koddan çıkarılmıştır. AUTH-F09 için ayrıca koordinatörün yerel mock transport yeniden üretimi vardır; worker test çalıştırmadı. Hiçbir bulgu cihazda, canlı backend üzerinde veya üretimde istismar edilerek doğrulanmış değildir.

### AUTH-F01 — Parola ve uzun ömürlü bearer token güvenli saklama katmanı olmadan kalıcılaştırılıyor

**P1 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** `mobile/lib/screens/auth/login_screen.dart:65–68` başarıda parolayı `remembered_password` anahtarıyla doğrudan `SharedPreferences.setString`'e verir; `:42–50` geri okur. `mobile/lib/providers/auth_provider.dart:83–86` oturum tokenını aynı depoya yazar; `:47–58` tekrar kullanır. Backend tokenı tek başına yeterli oturum kanıtı olarak kabul eder (`convex/lib/employeeAuth.ts:11–22`) ve vadesi 90 gündür (`convex/employeeAuth.ts:6,178`). `mobile/pubspec.yaml:22` ilgili saklama bağımlılığını gösterir.

**Tetikleyici:** Remember-me seçerek başarılı giriş; token için herhangi bir başarılı giriş yeterli. **Beklenen:** Ham parola cihazda saklanmamalı; yeniden giriş için belirlenen oturum sırrı platform güvenli saklama katmanına yazılmalı. **Mevcut:** Uygulama katmanında şifreleme/güvenli depo sarmalayıcısı olmadan parola/token genel tercih API'sine veriliyor.

**Etki:** Tercih verisine erişebilen bir bağlamda parola ve uzun ömürlü oturum sırrının ele geçmesi hesap erişimine dönüşebilir. Bu rapor OS sandbox aşılmasını, yedekten çıkarılabilirliği veya gerçek veri sızıntısını kanıtlamaz. **Kök neden:** Kimlik bilgisi saklama sorumluluğu login widget ve provider arasında dağılmış; remember-me parola saklamak olarak uygulanmış. **Çözüm:** Parolayı saklamayı kaldır; token deposunu inject edilebilir güvenli saklama arayüzüne taşı; eski anahtarları tek seferlik temizle; remember-me anlamını ürün kararıyla netleştir. AUTH-WP01.

### AUTH-F02 — Açık çıkış sonraki açılışta otomatik girişi engellemiyor

**P1 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Profil onayı `signOut()` çağırır (`mobile/lib/screens/profile/profile_screen.dart:455–471`). `auth_provider.dart:113–125,142–147` yalnız token/vadeyi siler; `remember_me`, `remembered_email`, `remembered_password` silinmez. `splash_screen.dart:67–74` oturumsuz açılışta bu kayıtlarla yeni giriş yapar. `employeeAuth.ts:176–186` iptal edilen token yerine yeni token üretir.

**Tetikleyici:** Remember-me açık giriş → kullanıcı açıkça çıkış yapar → uygulama kapanıp açılır → ağ ve eski parola geçerlidir. **Beklenen:** Açık çıkışın ardından kullanıcı yeniden giriş iradesini gösterene kadar hesap açılmaz. **Mevcut:** Backend eski tokenı başarıyla iptal etmiş olsa bile otomatik olarak yeni oturum oluşturulabilir.

**Etki:** Paylaşılan/elden bırakılan cihazda kullanıcı çıkış yaptığını düşünürken hesabı yeniden açılır. **Kök neden:** Logout politikası ile parola temelli splash otomatik giriş politikası birbirinden bağımsızdır. **Çözüm:** Açık logout bütün otomatik giriş yetkisini kaldırmalı; e-posta hatırlama ile oturum sürdürme ayrılmalı. Ağ hatasında yerel çıkış hemen tamamlanmalı; uzaktaki iptal garantisinin sınırı belgelenmeli. AUTH-WP02; sır saklamayı kaldırma AUTH-WP01 ile birlikte tasarlanmalı.

### AUTH-F03 — Parolanın yeniden kurulması mevcut mobil oturumları geçersiz kılmıyor

**P1 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Yönetici mevcut auth kaydına yeni setup tokenı yazabilir (`convex/actions/sendEmail.ts:163–173`). `setPassword.ts:30–34` yeni hash'i `consumeSetupToken`'a aktarır. `employeeAuth.ts:116–122` hash ve setup alanlarını değiştirir, `employeeSessions` kaydına dokunmaz. Alternatif internal parola yolu da yalnız hash'i değiştirir (`convex/employees.ts:511–523`). `convex/lib/employeeAuth.ts:11–22` yalnız token/vade/çalışan aktifliğini okur; parola değişim sürümü/tarihi denetlemez.

**Tetikleyici:** A cihazında açık mobil oturum varken yönetici mevcut çalışan için yeniden setup gönderir ve çalışan yeni parola belirler; eski token ile `employeeAuth:me` çağrılır. **Beklenen:** Hesap kurtarma/parola yenileme işleminden sonra önceki oturumların iptali veya açık, uygulanmış ürün politikası. **Mevcut:** Çalışan aktif kaldığı ve token vadeli olduğu sürece eski token kabul edilir; yeni parolayı bilmek gerekmez.

**Etki:** Parola değiştirmek ele geçirilmiş veya kayıp cihazdaki oturumdan kurtulmaya yetmez; tokenın başlangıçtaki 90 günlük vadesine kadar erişim sürebilir. **Kök neden:** Parola yaşam döngüsü ve oturum geçerliliği bağlanmamış. **Çözüm:** Parola güncellemesiyle atomik oturum sürümü artırma ve her oturumda karşılaştırma veya ölçekli toplu revocation tasarla; web setup ve internal admin yoluna aynı kuralı uygula. AUTH-WP03.

### AUTH-F04 — Eşzamanlı giriş/çıkış ve gecikmiş yanıtlar için oturum sahipliği koruması yok

**P1 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Login düğmesi koşulsuz etkin (`mobile/lib/screens/auth/login_screen.dart:210–222`); `_signIn` tekrar giriş koruması içermez (`:54–61`). Provider `_isLoading` yazar ama başlamadan kontrol etmez (`auth_provider.dart:71–78`). Her gelen başarı ortak token/kullanıcı durumunu yazar (`:80–91`); her hata ortak durumu temizler (`:93–101`); request generation/current-session karşılaştırması yoktur. `signOut` uzak çağrıyı bekleyip ortak durumu temizler (`:113–125`). HTTP katmanı eski isteğin hangi tokenla yapıldığını callback'e vermeden global expiry çalıştırır (`convex_config.dart:237–240`, `main.dart:53–54`).

**Tetikleyici:** Giriş düğmesine art arda basıp farklı sürede yanıtlar almak; bir isteğin başarısından sonra önceki isteğin hatasının dönmesi. Kullanıcı alanları istekler arasında değiştirirse A ve B girişleri ters sırada tamamlanabilir. İkinci senaryo: eski tokena ait gecikmiş expiry, yeni oturum açıldıktan sonra döner.

**Beklenen:** Yalnız geçerli giriş girişimi/oturum nesli state değiştirebilir; kullanıcı çıkış yaptıktan sonra geç gelen giriş sonucu hesabı açamaz; eski token hatası yeni tokenı silemez. **Mevcut:** Son tamamlanan başarı/hata state'i sahiplenir; önceki isteğin hatası başarılı yeni oturumu silebilir veya geç gelen farklı hesap başarısı görünen hesabı değiştirebilir.

**Etki:** Beklenmedik oturum kapanması, yanlış hesabın aktif hale gelmesi ve UI/veri bağlamı tutarsızlığı. **Kök neden:** Auth işlemleri serileştirilmemiş; HTTP expiry sinyali token neslinden bağımsız. **Çözüm:** Tek aktif giriş, generation/epoch kontrolü, signOut ile eski istekleri hükümsüz kılma ve tokena bağlı expiry callback'i. Login sonrası controller verisini await öncesi snapshot al; widget lifecycle güvenliğini de kapsa. AUTH-WP04.

### AUTH-F05 — Bootstrap geçici ağ hatası geçerli oturumu giriş ekranında bırakıyor

**P2 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** `auth_provider.dart:57–67` tokenı korur fakat `me()` geçici hata verince kullanıcıyı doldurmaz, hatayı yalnız debug log'a yazar. `isAuthenticated` hem kullanıcı hem token ister (`:37`). `splash_screen.dart:67–78` remember-me yoksa doğrudan login'e gider. `me()` çağrısının tek gerçek tüketicisi bootstrap'tır (`auth_provider.dart:61`); uygulama çevrimiçi olduğunda auth bootstrap tekrarını veya görünür tekrar deneme butonunu sağlayan yol bulunmadı.

**Tetikleyici:** Önceki girişten geçerli token var; remember-me kapalı; soğuk açılışta `me` isteği mevcut HTTP retry'larını da aşan kesinti/timeout yaşar; sonra ağ düzelir. **Beklenen:** Oturumun doğrulanamadığını belirten durum ve tokenı kullanarak kullanıcı kontrollü tekrar deneme. **Mevcut:** Token diskte/bellekte korunmasına rağmen giriş formu gösterilir; kullanıcı yeniden parola girmeli veya uygulamayı yeniden açmalıdır. “Bir sonraki çağrıda denenir” yorumu (`:65`) kullanıcı profilini geri yükleyen yeni çağrı ile tamamlanmıyor.

**Etki:** Kısa bağlantı sorunundan sonra gereksiz giriş, parola unutmuş çalışanın uygulamaya dönememesi. **Kök neden:** Başlatılıyor, geçici doğrulanamadı ve çıkış yapılmış durumları tek boolean'a indirgenmiş. **Çözüm:** Açık auth state modeli, görünür retry ve foreground/bağlantı sonrası kontrollü doğrulama; doğrulanmamış oturumla korumalı ekran açmama. AUTH-WP05.

### AUTH-F06 — Çalışan pasifleştirme hatası istemcide oturum sonu olarak işlenmiyor

**P2 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Backend aktif olmayan çalışan için ayrı mesaj fırlatır (`convex/lib/employeeAuth.ts:21`). `_isAuthExpiryMessage` bu mesajı kapsamıyor (`mobile/lib/config/convex_config.dart:334–340`); HTTP 200 gibi gövdenin çözümlendiği error zarfında sonuç `BusinessError` olur (`:325–331`); gerçek HTTP 560 önce AUTH-F09 transport engeline takılır. Attendance yalnız `AuthExpiredError` için auth temizler, iş hatasını gösterir (`attendance_provider.dart:205–216`). Router provider hâlâ authenticated olduğundan korumalı ekranı açık tutar (`app_router.dart:55–61`).

**Tetikleyici:** Açık oturumdaki çalışan yönetici tarafından pasifleştirilir ve uygulama yeni bir employee çağrısı yapar. Bu bulgu hata gövdesi çözümlenebildiğinde, örneğin HTTP 200 zarfında veya F09 düzeltildikten sonra da geçerlidir; HTTP 560 mevcut durumda daha önce F09 engeline takılır. Standart çalışan silme oturum kayıtlarını da sildiğinden (`convex/employees.ts:363–365`, `convex/lib/employeeUx.ts:11`) normal silme yolunu bu mesaj eksiğine dahil etmiyoruz. **Beklenen:** Erişimin kaldırıldığına uygun mesaj ve yerel oturumun güvenli sonlandırılması. **Mevcut:** Çağrı backend'de reddedilir fakat kullanıcı/provider eski authenticated durumda kalabilir; önceden yüklenmiş attendance verisi iş hatasında temizlenmez.

**Etki:** Kullanıcı çalışmayan korumalı ekranlarda kalır, eski profil/kayıtlar görünmeye devam edebilir. Backend'in pasif hesaba yeni veri verdiği veya yeni işlem kabul ettiği iddia edilmez. **Kök neden:** Metin parçasına dayalı expiry sınıflandırması bütün kimlik iptal nedenlerini kapsamıyor. **Çözüm:** Backend yapılandırılmış auth hata kodları ve istemci terminal-auth eşlemesi; network/business/auth ayrımı korunmalı. AUTH-WP06.

### AUTH-F07 — Kurtarma ekranı uygulanmamış e-posta akışını vaat ediyor ve eski hatayı gösterebiliyor

**P2 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Türkçe arayüz bağlantı gönderme sözü verir (`mobile/lib/l10n/app_tr.arb:36–40`), form provider'ı çağırır (`forgot_password_screen.dart:30–44`). Provider e-postayı kullanmaz, backend çağırmaz, yöneticiyle iletişim mesajı yazıp daima false döner (`auth_provider.dart:106–110`). Ekranın başarı durumu yalnız true'da oluşur (`forgot_password_screen.dart:37–40`). `resetPassword` önceki `_lastError`'ı temizlemez; ekran `lastError`'ı yeni `errorMessage`'dan önce seçer (`:41–44`).

**Tetikleyici:** Geçerli e-posta ile sıfırlama isteği; ikinci varyant olarak önce yanlış parola ile giriş denemesi, ardından kurtarma ekranından gönderme. **Beklenen:** Gerçek reset teslim akışı veya baştan doğru yönetici yönlendirmesi; o işlemle ilgili güncel mesaj. **Mevcut:** E-posta gönderilmez; önceden login hatası varsa yönetici yönlendirmesi yerine eski giriş/ağ/sunucu hatası gösterilebilir. Yanlış parola hatasının özel mesajı HTTP 560 nedeniyle ayrıca F09 engeline tabidir.

**Etki:** Parolasını unutan çalışan yanlış beklentiye girer; destek talebine nasıl ilerleyeceği belirsizleşir. **Kök neden:** Web/admin setup modeline geçilirken eski self-service reset UI'ı korunmuş; hata state'i işlemler arasında ayrılmamış. **Çözüm:** Önce ürün kararı: yönetici destek akışını doğru anlat veya güvenli self-service reset uygula; operasyon başında bütün eski hataları temizle. AUTH-WP07.

### AUTH-F08 — Public mobil parola doğrulamasında uygulama düzeyinde deneme sınırı yok

**P2 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** `convex/employeeAuth.ts:131–174` public mutation, normalize e-posta için her istekte doğrudan parola karşılaştırır; limiter/deneme sayacı/backoff kontrolü yoktur. Yanlış parola yolu bcrypt sync çalıştırır (`convex/lib/employeeAuth.ts:32–36`). Depodaki mevcut limiter tanımları yalnız register/emailVerify/inviteCreate içindir (`convex/lib/rateLimit.ts:4–10`); başka endpoint'in açık kullanım örneği `convex/emailVerification.ts:29–31`'dedir. Global kod taraması `employeeAuth.signIn` yoluna bağlanan limiter göstermedi.

**Tetikleyici:** Aynı normalize e-posta için tekrarlanan yanlış parola mutation'ları. **Beklenen:** Hesap bazında ölçülü deneme sınırı, kullanıcıya güvenli bekleme bilgisi ve operasyonel gözlem. **Mevcut:** Her çağrı doğrulama işini yeniden yapar; uygulama iş kuralı seviyesinde sınır yoktur.

**Etki:** Parola tahmin girişimlerine ve gereksiz doğrulama maliyetine karşı savunma eksikliği. Gerçek saldırı hacmi, sağlayıcı genel kotası veya dış WAF koruması ölçülmediği için sınırsız üretim kapasitesi/kanıtlı hesap ele geçirme iddiası yoktur; P1'e yükseltilmedi. **Kök neden:** Web yardımcı akışlarına eklenmiş limiter mobil girişe uygulanmamış. **Çözüm:** Kalıcı, hata halinde de doğru sayaç davranışı gösteren limiter; normalize hesap anahtarı, gerekirse güvenilir ağ katmanı sinyali ve kişisel veri/sır içermeyen ölçümler. AUTH-WP08.

### AUTH-F09 — Convex HTTP 560 oturum hatası genel sunucu hatasına dönüşüyor

**P1 · Kesinlik: doğrulandı — koordinatörün yerel mock transport testi; canlı backend/cihaz doğrulaması yok.**

**Kanıt zinciri:** Depodaki resmi Convex SDK HTTP 560'ı fonksiyon hatası olarak tanımlar ve gövdesini çözümler (`node_modules/convex/src/browser/http_client.ts:29–32,316–336`). Mobil istemci ise tüm `>=500` yanıtları gövdeyi incelemeden `ServerError` yapar (`mobile/lib/config/convex_config.dart:299–301`); expiry mesajı ayrımı ancak aşağıda çalışır (`:325–329`). `_call` bu hatayı query'de tekrarlar ve expiry callback'ine girmez (`:237–250`). `AuthProvider.bootstrap` böyle bir hatada tokenı tutar (`auth_provider.dart:64–67`); aktif ekran çağrılarında da auth temizliği tetiklenmez.

**Tetikleyici:** Sunucunun iptal edilmiş veya süresi bitmiş employee session için HTTP 560 ve oturum hatası zarfı döndürmesi. **Beklenen:** Fonksiyon hatası gövdesi çözümlenmeli; auth hatası `AuthExpiredError` olmalı, retry olmadan güncel oturum sonlandırılmalı. **Mevcut:** Genel sunucu hatası ve gereksiz query retry'ı; kullanıcı eski authenticated durumda kalabilir. Girişteki yanlış parola iş hatası da aynı erken 5xx ayrımından etkilenebilir.

**Doğrulama:** [Koordinatör kanıtı](../evidence/baseline.md), [yeniden üretim kodu](../evidence/http560_repro_test.dart), [çıktı](../evidence/http560-repro.txt). Aynı expired-session gövdesi HTTP 200 ile `AuthExpiredError` ve callback, HTTP 560 ile `ServerError` ve callback yok sonucu verdi; iki characterization testi geçti. Testler mevcut yanlış davranışı kanıtlar, düzeltmenin başarısını değil.

**Etki:** Oturum iptali/expiry ana akışının istemci tarafında tamamlanmaması ve yanlış hata UX'i. Backend geçersiz tokenı yine reddeder; yetkisiz işlem kabul ettiği iddia edilmez. **Kök neden:** Convex UDF hata durum kodunun genel 5xx'ten ayrılmaması. **Çözüm:** HTTP 560 için hata zarfını işle, gerçek altyapı 5xx retry politikasını ayır; yapılandırılmış auth kodları ve eski-token korumasıyla birleştir. AUTH-WP09; ortak HTTP/network modülü (09) ile tek düzeltme olarak sahiplenilmeli.

## 4. Geliştirme iş paketleri

S/M/L yalnız göreli kapsam tahminidir; takvim veya gün taahhüdü değildir. Bunlar önerilen gelecekteki işlerdir; bu audit kapsamında uygulanmadı. Uygulama sırası: ortak HTTP modülüyle WP09 protokol ayrımı; WP01+WP02 ortak oturum politikası → WP04+WP05+WP06 istemci dayanıklılığı; WP03 ve WP08 backend sahipliğiyle planlanmalı; WP07 ürün kararıyla başlayabilir.

### AUTH-WP01 — Sır saklama ve migration (AUTH-F01)

- **Kapsam:** Login, splash, auth provider, inject edilebilir token deposu; gerekli platform yapılandırması.
- **Bağımlılıklar:** Remember-me ürün tanımı (yalnız e-posta mı, kalıcı oturum mu); WP02 ile ortak karar. Backend sözleşmesi korunabilir.
- **Yapılacaklar:** Ham parola yazma/okuma ve splash parola girişini kaldır; token için platform güvenli depo adaptörü ekle; eski parola/token anahtarlarını geçişte temizle; başarısız saklama/okumada tutarlı auth durumu sağla. Migration güvenli aktarılamıyorsa kontrollü yeniden giriş iste.
- **Kabul:** Her giriş/upgrade/çıkış yolundan sonra tercih deposunda parola veya token bulunmaz; eski parola anahtarı temizlenir; seçilen kalıcılık politikası cold start'ta uygulanır; güvenli depo hatası sahte başarılı giriş veya takılı yüklenme yaratmaz.
- **Test:** Legacy anahtarlarla upgrade; token var/parola var/yok kombinasyonları; güvenli depo read/write failure; Android ve iOS kill/relaunch; test çıktısında sır görünmediğinin kontrolü.
- **Tahmin:** **M** — API yüzeyi küçük, platform ve migration davranışları ek doğrulama gerektirir.

### AUTH-WP02 — Açık çıkış ve otomatik giriş yetkisi (AUTH-F02)

- **Kapsam:** `AuthProvider.signOut`, splash politikası, remember-me state'i, profil logout davranışı.
- **Bağımlılıklar:** WP01'in saklama arayüzü ve remember-me tanımı; WP04 ile auth generation uyumu.
- **Yapılacaklar:** Kullanıcı isteğiyle çıkışta otomatik oturum yetkisini kaldır; yerel temizliği ağ yanıtına bağımlı bırakma; uzaktaki iptal başarısızlığının ürün politikasını belirle; işlem çift tıklamalarını güvenli hale getir. Cihaz tercihi hesap bazlı olacaksa ilgili modül sahibiyle temizleme sözleşmesi kur.
- **Kabul:** Online/offline açık logout'tan sonra uygulama yeniden açıldığında kullanıcı iradesi olmadan `signIn` çağrılmaz; token ve auth state temizdir; eski polling durur; başarılı sunucu iptalinden sonra aynı token `me` çağrısında reddedilir. Offline tokenın başka bir istemcide iptal edilmiş olduğu yanlış biçimde iddia edilmez.
- **Test:** Remember-me açık/kapalı logout-relaunch; uçuş modu; sunucu timeout; çift logout; logout sırasında gecikmiş giriş sonucu; ikinci kullanıcıyla giriş.
- **Tahmin:** **M** — yerel silme kolay, offline/uzak iptal ve race politikası koordinasyon gerektirir.

### AUTH-WP03 — Parola değişiminde oturum iptali (AUTH-F03)

- **Kapsam:** `employeeAuth`, `employeeSessions`, `getCurrentEmployee`, setup ve internal admin parola yolları.
- **Bağımlılıklar:** Eski oturumları iptal etme ürün kararı; schema gerekiyorsa ayrı migration planı; WP06 hata kodları.
- **Yapılacaklar:** Tercihen auth/session version ile parola değişimi ve revocation'ı atomik bağla; var olan oturumlara güvenli geçiş tanımla; bütün parola yazma yollarını kapsa. Tablo silme tercih edilirse sınırsız koleksiyon taraması yerine sınırlı batch tasarla.
- **Kabul:** Yeni parola kurulunca önceki iki cihaz tokenı da ilk sonraki sorgu ve mutation'da reddedilir; yeni parola ile giriş çalışır; başka çalışan etkilenmez; eski parola ve tüketilmiş setup tokenı kullanılamaz.
- **Test:** Çoklu cihaz; eşzamanlı setup tüketimi; adminSet yolu; parola güncelleme ile aynı anda çalışan sorgusu/mutasyonu; migration öncesi oturum; ilgisiz çalışan izolasyonu.
- **Tahmin:** **M** — veri sözleşmesi ve atomiklik gerektirir; migration şekline göre büyüyebilir.

### AUTH-WP04 — Auth yarışları ve lifecycle koruması (AUTH-F04)

- **Kapsam:** Auth provider/HTTP expiry callback/login widget ve sonuç tüketen oturum sınırları.
- **Bağımlılıklar:** WP01 token deposu ve WP02 logout politikası.
- **Yapılacaklar:** Tek aktif giriş veya açık iptal semantiği; auth generation sayacı; eski başarı/hata/expiry sonuçlarını yok sayma; callback'e istek token nesli taşıma; düğmede loading durumu; await öncesi form değerlerini snapshot alma; async widget dönüşlerinde mounted kontrolü.
- **Kabul:** İki giriş için yanıt sırası ters çevrildiğinde yanlış hesap/token aktif olmaz; önceki isteğin hatası yeni oturumu silemez; logout sonrası eski başarı oturum açamaz; eski token expiry'si yeni tokenı etkilemez; ekran ayrıldıktan sonra controller/setState kaynaklı exception oluşmaz.
- **Test:** Completer kontrollü A/B başarı-hata bütün sıraları; giriş beklerken logout; eski tokenlı sorgu 401 dönerken yeni giriş; hızlı tekrar tıklama; login ekranından bekleme sırasında ayrılma. Sadece “loading true oldu” testi yeterli değildir.
- **Tahmin:** **M** — az dosya fakat birçok interleaving ve global HTTP etkisi var.

### AUTH-WP05 — Bootstrap geri kazanımı (AUTH-F05)

- **Kapsam:** Auth state modeli, splash/retry görünümü ve router.
- **Bağımlılıklar:** WP04 generation kontrolü; WP06 terminal auth hata ayrımı.
- **Yapılacaklar:** Başlatılıyor/doğrulandı/geçici hata/çıkış durumlarını ayır; saklanan tokenla görünür retry; foreground'da ölçülü yeniden doğrulama; süreli bekleme ve açıklama; network hatasında parola temelli gizli yeniden girişten kaçın.
- **Kabul:** Geçerli token + geçici kesinti sonrasında ağ düzelip retry seçildiğinde parola girmeden doğru profil ve home açılır; geçersiz token sonsuz retry'a girmez; doğrulama bitmeden korumalı veri gösterilmez.
- **Test:** Timeoutların tamamı sonrası iyileşme; offline açılış; backend 5xx; yanlış/bozuk yanıt; expired token; arka plan/ön plan; retry devam ederken logout.
- **Tahmin:** **M** — ekran/state/router koordinasyonu gerektirir.

### AUTH-WP06 — Yapılandırılmış terminal auth hataları (AUTH-F06)

- **Kapsam:** Backend employee auth guard, HTTP hata çözümleme, provider ve hata yerelleştirme.
- **Bağımlılıklar:** WP09 HTTP 560 ayrımı; backend ile geriye uyumlu hata sözleşmesi; WP03 revocation nedeni.
- **Yapılacaklar:** Missing/expired/revoked/employee-inactive/employee-deleted kodlarını tanımla; terminal auth hatasında tek yerel temizleme; network ve erişim kuralı reddini logout'tan ayır; saklanan hassas ekran verisini oturum nesliyle temizle. Geçişte mevcut mesajlar için kontrollü fallback sağla.
- **Kabul:** Pasifleştirme/silme/revocation sonraki istekte oturumu temizler ve anlaşılır mesajla login'e gider; sıradan iş kuralı reddi veya ağ kesintisi logout yaratmaz; kodlar dil değişiminden etkilenmez.
- **Test:** Her auth nedeni için query ve mutation; HTTP 200 ve HTTP 560 Convex error zarfları; HTTP 401/403; bilinmeyen hata; eşzamanlı birkaç expiry; aktif erişim reddi.
- **Tahmin:** **M** — istemci/backend ortak sözleşmesi ve veri temizleme gerektirir.

### AUTH-WP07 — Gerçekçi parola kurtarma deneyimi (AUTH-F07)

- **Kapsam:** Forgot password UI, provider hata state'i, TR/EN içerik; self-service seçilirse ayrı güvenli backend akışı.
- **Bağımlılıklar:** Ürün/destek kararı; yeni reset yapılacaksa WP03 revocation ve WP08 abuse kontrolü.
- **Yapılacaklar:** Mevcut yönetici modelinde e-posta alanı/gönderme vaadi yerine somut yönetici yardım yolu göster; eski `lastError`'ı temizle. Self-service istenirse hesap varlığını ifşa etmeyen yanıt, tek kullanımlı vadeli token ve gerçek teslim akışını ayrıca tasarla.
- **Kabul:** Kullanıcıya vaat edilen işlem gerçekten yapılır; yönetici seçeneğinde e-posta gönderildi algısı yaratılmaz; yanlış giriş sonrası recovery'de yalnız güncel yönerge görünür; TR/EN içerikler tutarlıdır.
- **Test:** Önce yanlış parola sonra recovery; doğrudan recovery; geri dönüş; ekran döndürme/küçük ekran; self-service seçilirse geçersiz/expired/replayed token ve teslim hatası.
- **Tahmin:** **S** yönetici yönlendirmesi; **L** self-service seçilirse — ikincisi abuse, e-posta, token ve revocation içeren yeni capability'dir.

### AUTH-WP08 — Mobil parola denemesi sınırlama (AUTH-F08)

- **Kapsam:** Mobil giriş backend'i, limiter yapılandırması, güvenli istemci hata gösterimi ve operasyonel metrikler.
- **Bağımlılıklar:** Eşik/geri kazanım politikası; gerekiyorsa güvenilir gateway sinyali; WP06 hata kodu biçimi.
- **Yapılacaklar:** Normalize hesap başına kalıcı sayaç ve ölçülü bekleme; hata fırlatan mutation'ın sayaç yazısını rollback etmesi olasılığı dahil transaction tasarımını doğrula; mevcut olmayan hesapta aynı dış yanıt politikası; parola/token içermeyen ölçümler.
- **Kabul:** Belirlenen eşikten sonraki deneme sunucuda sınırlandırılır; yanlış parola ile dönen işlemden sonra sayaç gerçekten korunur; farklı hesap izolasyonu ve bekleme sonrası geri kazanım çalışır; e-posta büyük/küçük harf veya boşluk değişimiyle sınır aşılamaz; meşru kullanıcı kalıcı kilitlenmez.
- **Test:** Eşzamanlı başarısız denemeler; eşik sınırları; büyük/küçük harf; olmayan hesap; süre penceresi; başarılı giriş sonrası politika; yalnız mock çağrı sayısı yerine kalıcı limiter etkisi.
- **Tahmin:** **M** — bileşen mevcut; hata/transaction ve abuse semantiği dikkat ister.

### AUTH-WP09 — HTTP 560 auth/business hata sözleşmesi (AUTH-F09)

- **Kapsam:** Ortak HTTP istemcisinin response ayrımı; auth repository/provider entegrasyonu. Modül 09 ile ortak kök neden; iki ayrı düzeltme açılmamalı.
- **Bağımlılıklar:** HTTP/network modülü sahipliği; WP04 eski-token kontrolü, WP06 auth kodları. Diğer paketlerden önce transport ayrımı düzeltilebilir.
- **Yapılacaklar:** HTTP 560 fonksiyon hata zarfını JSON olarak çözümle; auth/business error'a eşle; gerçek 5xx ve bozuk gövde için ayrı güvenli fallback; auth ve business hatalarını otomatik retry etme.
- **Kabul:** HTTP 560 expired/invalid session tek çağrıda `AuthExpiredError` ve ilgili güncel oturumun temizlenmesini üretir; yanlış parola `BusinessError` olarak anlaşılır mesaj verir; HTTP 503 mevcut sınırlı retry politikasını korur; bozuk 560 gövdesi exception zincirini veya tokenı kullanıcıya sızdırmaz.
- **Test:** Koordinatör characterization senaryolarını hedef davranışa çevir; query ve mutation 560, yanlış parola, geçersiz token bootstrap, aktif polling expiry, gerçek 503, bozuk gövde ve eski tokenlı geç expiry. Canlı test ortamında sunucu status/body sözleşmesini ayrıca gözlemle.
- **Tahmin:** **S** transport değişikliği, entegrasyonla **M** — kod sınırlı fakat bütün repository'leri etkiler.

## 5. Test kanıtının sınırı

- Provider testleri mock repository ile başarılı/başarısız giriş, expiry ve online/offline logout'u kapsıyor (`auth_provider_test.dart:29–183`). Bootstrap, remember-me, gerçek secure storage, router entegrasyonu, race ve reset state'i kapsamıyor. Bu eksikler tek başına bug değildir; yukarıdaki kod zincirlerinin korunması için test ihtiyacıdır.
- Repository testleri mock `HttpConvexClient` kullanır (`auth_repository_test.dart:16–18`); gerçek Convex response zarfı/backend birlikte çalışmasını kanıtlamaz. Login widget testleri gerçek router/splash kullanmadan form ve hata görünümünü inceler (`login_screen_test.dart:14–23,49–130`).
- HTTP testleri polling'in üst üste binmemesini ve 401 sonrası durmasını hedefler (`convex_config_test.dart:10–82`); backend'in “Çalışan aktif değil” mesajı veya eski token expiry yarışı test edilmez.
- Backend auth testleri seçili handler'ları fake context ile çağırır (`employeeAuth.test.ts:24–25,27–49,95–103,138–170`); token tüketimi ve genel giriş hata mesajı için yararlı kaynak kanıtıdır. Gerçek veritabanı transaction atomikliği, başarılı giriş, oturum vadesi ve çoklu cihaz revocation E2E kanıtı değildir.
- Worker hiçbir test/analiz komutu çalıştırmadı. Koordinatörün [baz kanıtında](../evidence/baseline.md) `flutter analyze --no-pub` için “No issues found” ve `flutter test --no-pub --reporter expanded` için **44 test geçti** sonucu var. Ayrıca F09 için iki yerel characterization testi geçti; bunlar çalışan düzeltilmiş akış değil mevcut protokol hatası kanıtıdır. Sonuçlar cihaz/canlı backend/E2E doğrulaması değildir.

## 6. Manuel cihaz / E2E doğrulama matrisi

Aşağıdaki senaryoların tamamı **çalıştırılmadı**. Gerçek kişisel veri yerine test çalışanları, test projesi ve loglara yazılmayan geçici sırlar kullanılmalı. Android ve iOS fiziksel cihazda; gerekirse aynı senaryo farklı iki cihazda uygulanmalı.

| Senaryo | Ortam / adımlar | Gözlemlenebilir beklenen sonuç | Bağlantı |
| --- | --- | --- | --- |
| İlk kurulum ve doğru giriş | Temiz kurulum; admin kurulumunu tamamlamış aktif çalışan | Doğru çalışan profili, gerçek backend oturumu, home | Temel sözleşme |
| Yanlış/kurulmamış/pasif hesap | Üç test hesabıyla ayrı deneme | Aynı dış giriş hata mesajı; oturum yok | Temel güvenlik |
| Remember-me kapalı cold start | Giriş, process kill, tekrar aç | Belgelenen kalıcılık politikası tutarlı; parola saklanmaz | WP01, WP05 |
| Remember-me açık açık çıkış | Giriş, çıkış onayı, kill/relaunch | Otomatik giriş yapılmaz | WP02 |
| Offline açık çıkış | Uçuş modu, çıkış, relaunch, sonra ağ aç | Yerelde login; ağ gelince kendiliğinden hesap açılmaz; uzak iptal sınırı görünür | WP02 |
| Legacy upgrade | Eski remember ve session anahtarlarını içeren test kurulumundan upgrade | Eski parola/token preference anahtarları temiz; yanlış hesaba dönülmez | WP01 |
| Güvenli depo hatası | Test adaptöründe read/write başarısızlığı | Kontrollü hata/yeniden giriş; takılı splash ve yanlış başarı yok | WP01 |
| Geçerli token + kesinti | Cold start'ta bağlantıyı kes; retry süresi sonrası düzelt | Açık retry ile aynı kullanıcı geri gelir; parola gerekmez | WP05 |
| HTTP 560 hata zarfı | Test transport + ardından canlı test backend; expired/invalid session ve yanlış parola | Auth/business ayrımı doğru; auth hatası gereksiz retry olmadan temizlenir | WP09 |
| Süresi dolan token | Kontrollü test süresi; foreground ve cold start | Login yönlendirmesi; eski veri ve polling temizlenir | WP06 |
| İptal edilen hesap | Açık oturumdaki çalışanı pasifleştir/sil; sorgu ve mutation dene | Backend ret + yerel auth temizliği; eski profil görünmez | WP06 |
| İki cihaz + yeni parola | İki cihaz açıkken setup üzerinden yeni parola belirle | Her iki eski oturum ilk sonraki çağrıda reddedilir | WP03 |
| A'dan B'ye kullanıcı değişimi | A geçmişini yükle, çıkış, B girişi | Hiçbir anda A geçmişi/profili B altında gösterilmez; seçili cihaz politikası tutarlı | WP02, WP04; attendance modülüyle ortak |
| Kontrollü geç yanıtlar | Proxy/test transport ile A/B giriş sırası ters, eski expiry geç gelsin | Yalnız güncel kullanıcı/token state'i değiştirir | WP04 |
| Kurtarma | Hatalı girişten sonra forgot ekranını aç | Güncel yönetici yönergesi veya gerçek reset; eski login hatası yok | WP07 |
| Deneme sınırı | Test ortamında belirlenen eşiği aş | Sunucu kotası uygulanır, bekleme bilgisi doğru, parola/token log yok | WP08 |
| Foreground ve arka plan | Oturum doğrulama/çıkış beklerken app değiştir, geri dön | Tek tutarlı auth state; geç sonuçlar yeni hesabı etkilemez | WP04–06 |

## 7. Açık sorular ve modüller arası sınırlar

1. “Beni hatırla” yalnız e-postayı mı hatırlatmalı, yoksa oturumu kalıcı mı sürdürmeli? Bugün token her girişte kalıcı; checkbox ayrıca parola saklama ve otomatik giriş yapıyor. Ürün politikası netleşmeden token kalıcılığını değiştirmek kullanıcı beklentisini bozabilir.
2. Sabit 90 günlük oturum kabul ediliyor mu; daha kısa oturum ve refresh/rotation isteniyor mu? Refresh yokluğu tek başına bug sayılmadı. İstenirse WP01/WP03 sonrası ayrı backend+istemci capability olarak planlanmalı; parola saklayıp tekrar giriş çözüm sayılmamalı.
3. Parola kurtarma yöneticinin web setup akışı olarak mı kalacak? Üretim e-posta teslimi, link domain'i ve web setup ekranının mobil tarayıcı davranışı burada doğrulanmadı; WP07 kapsam kararı gerekiyor.
4. Offline çıkış uzaktaki tokenın iptalini hangi koşulda garanti etmeli? Yerelde sır silinince başarısız uzak iptali tekrar denemek için ayrıca güvenli bir politika gerekir. Bu rapor offline logout'u uzaktan revoke olmuş gibi değerlendirmez.
5. Cihaz tercihi hesap/proje bazlı mı olmalı? `PreferredDeviceProvider` global anahtarlarla saklanıyor (`preferred_device_provider.dart:7–8,17–20`), `main.dart:49,76–78` auth'a bağlı değil. Backend yetki kontrolünün aşıldığı iddia edilmiyor; kullanıcı değişiminde başka hesabın cihaz adı/tercihinin görünmesi ilgili cihaz/ana ekran auditinde birlikte doğrulanmalı.
6. Attendance aboneliğinde generation kontrolü var; tek seferlik `loadAttendanceRecords` ve `_silentRefresh` sonucu ise await sonrası kullanıcı neslini kontrol etmeden listeye yazılıyor (`attendance_provider.dart:231–237,256–267`). A'nın geciken isteğinin B oturumuna taşınması ihtimali ilgili attendance modülüyle kontrollü transport testiyle incelenmeli; bu raporda ayrı bulgu sayılmadı.
7. Login başarı notify'si router redirect'i tetikledikten sonra widget remember-me controller'larını okumaya devam ediyor (`login_screen.dart:58–75`, `auth_provider.dart:89–92`, `app_router.dart:48–60`); async `_loadRememberedUser` da mounted kontrolü yapmıyor (`login_screen.dart:42–50`). Gerçek widget yaşam döngüsü hatası çalıştırılmadı; WP04 lifecycle kabulüne dahil edildi.
8. Dış WAF/sağlayıcı kota, cihaz yedekleme politikası ve dağıtılmış uygulamanın sürümü incelenmedi. Bunlar kodda görülen koruma eksikliğini kapatıyor varsayılmadı; üretim saldırı veya cihazdan sır çıkarma iddiası da kurulmadı.

## 8. Teslim kaydı

Tek çıktı: `docs/mobile-audit/modules/01-auth.md`. Uygulama/backend/platform/test değişikliği yoktur. Görev kimliği `task_29f8284de5a0`; dispatch kimliği `ctx_4fdc4987610c`.
