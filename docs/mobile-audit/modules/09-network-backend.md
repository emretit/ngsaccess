# 09 — HTTP ve Convex sözleşmeleri

19 Ekim 2026 · Salt okunur kaynak kod auditi · Mevcut çalışma ağacı

## Sonuç ve doğrulama sınırı

Mobil uygulamanın gerçek HTTP çağrıları mevcut Convex fonksiyonlarıyla ad/argüman ve temel başarılı yanıt alanları bakımından eşleşiyor. Buna karşılık hata protokolü, kapı açma ile geçiş kaydı ayrımı ve bazı yetki kontrolleri uçtan uca tutarlı değil. **9 bulgu: 4 P1, 5 P2; P0/P3 yok.** NET-F01'in HTTP 560 sınıflandırması koordinatörün yerel mock transport deneyiyle **doğrulandı**; üretim redaksiyonu ve diğer bulgular **kaynak analizi** düzeyinde. Cihazda veya canlı backend'de yeniden üretim yapılmadı.

Yalnız bu rapor yazıldı. Flutter test/analyze/pub get/build, formatlama, backend çağrısı, veri mutasyonu, deploy, commit ve push yapılmadı. `.env` veya gerçek anahtar/token/kişisel veri değerleri okunmadı ve rapora alınmadı. Önceden bulunan web/Convex değişiklikleri korundu; satırlar HEAD yerine incelenen çalışma ağacını gösterir.

Koordinatörün [baz doğrulamasına](../evidence/baseline.md) göre `flutter analyze --no-pub` temiz ve `flutter test --no-pub --reporter expanded` **44 test başarılı**. Koordinatör ayrıca [HTTP 560 karakterizasyonunda](../evidence/http560_repro_test.dart) iki karşılaştırmalı yerel mock transport testi çalıştırdı; [ham çıktı](../evidence/http560-repro.txt) ikisinin geçtiğini gösteriyor. Bu sonuçlar bu worker tarafından yeniden çalıştırılmadı; canlı HTTP protokolü, üretim hata redaksiyonu, kamera, panel ve fiziksel kapı kanıtı sayılmaz.

## 1. İncelenen kapsam ve gerçek sözleşmeler

### Dosya envanteri

| Grup | İncelenen dosyalar / sınır |
|---|---|
| Asıl hedef, tamamı | `mobile/lib/config/convex_config.dart` (402 satır), `mobile/lib/core/errors.dart` (124), `mobile/lib/core/error_localizer.dart` (36); config dizininde başka dosya yok |
| Bütün repository'ler, tamamı | `mobile/lib/repositories/auth_repository.dart`, `attendance_repository.dart`, `device_repository.dart`; `rg` ile `mobile/lib` genelindeki diğer HTTP/Convex çağrıları da tarandı |
| Yanıt tüketimi ve oturum zinciri | `mobile/lib/models/attendance.dart`, `device.dart`, `qr_code_model.dart`; `providers/auth_provider.dart`, `attendance_provider.dart`; `main.dart`, `router/app_router.dart`, `screens/splash_screen.dart`; QR ekranının doğrudan token çağrısı ve self-check-in tüketimi, home hızlı açma, cihaz seçimi hata yolu, history filtre/liste yolu, visitor placeholder ve ilgili TR metinleri |
| Convex ön koşul | `convex/_generated/ai/guidelines.md` tamamı; backend okumalarından önce okundu |
| Karşılık gelen backend handler'ları | `convex/employeeAuth.ts` tamamı; `convex/employeeCheckIn.ts` tamamı; `convex/cardReadings.ts:1352–1450` mobil iki handler, fiziksel okuyucu/token işleme zinciri `:837–1349`; `convex/devices.ts:86–149` mobil cihaz handler'ı |
| Kimlik, veri ve karar yardımcıları | `convex/lib/customFunctions.ts`, `lib/employeeAuth.ts`, `lib/auth.ts`, `auth.ts`, `auth.config.ts`, `lib/cardReadingAudit.ts`, `lib/cardReadingProcess.ts`, `lib/accessDecision.ts`, `lib/checkInUx.ts`, `lib/pdksSource.ts`, `lib/cardReadingList.ts`; `schema.ts` çalışan/oturum/token/cihaz/kural/bağlantı/kart okuma tabloları ve indeksleri |
| Bağlam / çapraz kontrol | `convex/http.ts` route ve auth zincirleri; `employees.ts` e-posta duplicate/create ve internal şifre güncelleme yolları; `accessRules.ts` schedule alanları/create/update izleri; `actions/ideGatewayDevice.ts` schedule ve `openIdeDoor`, `actions/hikGatewayDevice.ts` `remoteOpenDoor`; cron/retention/cascade dosyalarında oturum/token temizleme izleri tarandı. Bu büyük dosyaların mobil zincir dışındaki tüm handler'ları audit edildi iddiası yoktur. |
| Mevcut test kanıtı | `mobile/test/config/convex_config_test.dart`, `core/errors_test.dart`, `repositories/auth_repository_test.dart`, `repositories/attendance_repository_test.dart`, `providers/auth_provider_test.dart`, `providers/attendance_provider_test.dart`, `helpers/mocks.dart`; `convex/employeeAuth.test.ts`, `employeeCheckIn.test.ts` okundu; çalıştırılmadı |
| Protokol çapraz kontrolü | Depoda kurulu resmi SDK `node_modules/convex/src/browser/http_client.ts`; kilitteki `http` sürümü ve yerel paket `http-1.6.0/lib/src/io_client.dart` hata sınıfları kontrol edildi. Bunlar uygulama/backend değişikliği değildir. |

### Endpoint / argüman / yanıt tablosu

Tüm mobil çağrılar `POST <deployment>/api/query|mutation` kullanır. Zarf `path`, `format: convex_encoded_json`, tek argüman nesnesini içeren `args` dizisidir (`convex_config.dart:273–284`); başarılı `value` decode edilip tekrar JSON string'e çevrilir (`:320–322`). Bu biçim yerel resmi JS SDK'nın kullandığı kodla da karşılaştırıldı. `/card-reader` ayrı HTTP-action yoludur; mobil repository bu route'a POST atmaz.

| Capability / durum | Mobil çağrı ve argüman | Backend / yanıt ve gerçek davranış |
|---|---|---|
| Çalışan girişi — **kısmi** | `AuthRepository.signIn`: `employeeAuth:signIn` mutation; `email.trim()`, `password` (`auth_repository.dart:59–81`) | `employeeAuth.ts:131–207`: normalize e-posta, çalışan + bcrypt şifresi, `{token, expiresAt, employee:{id, firstName, lastName, email, photoUrl, departmentId, cardNumber}}`. Başarılı shape eşleşiyor; iş hatası sözleşmesi F01. |
| Oturumdan profil — **kısmi** | `employeeAuth:me`, otomatik `sessionToken` (`auth_repository.dart:84–87`) | `employeeAuth.ts:231–249`: aynı çalışan alanları + `departmentName`. Expiry/iptal backend'de kontrol edilir; istemci sinyali F01. Sign-in yanıtında departmentName olmaması parser açısından desteklenen opsiyonel farktır. |
| Çıkış — **çalışıyor** (kaynakta) | `employeeAuth:signOut`, açık `sessionToken` (`auth_repository.dart:92–96`) | `employeeAuth.ts:212–224`: token varsa siler, yoksa `null`; istemci yanıt beklemez. Ağ hatasında lokal çıkış sürer (`auth_provider.dart:113–125`); uzaktaki tokenın iptali bu durumda kanıtlanamaz. |
| Kendi geçmişi / polling — **kısmi** | `cardReadings:listForEmployee`, `{limit}`, otomatik token; list ve subscribe aynı fonksiyon (`attendance_repository.dart:13–17,42–52`) | `cardReadings.ts:1357–1370`: oturumdaki çalışana göre liste; camelCase okuma alanları + sınırlı `device` projeksiyonu. Sayfa/chronology F09, parse F06. |
| Yetkili cihaz seçimi — **çalışıyor** (kaynakta), anlık kapı izni **kısmi** | `devices:listForEmployee`, yalnız otomatik token (`device_repository.dart:10–12`) | `devices.ts:91–149`: proje bazlı üyelik → aktif kural → bağlantı → aktif cihaz; `{_id,name,deviceSerial,deviceType,zoneName,doorName}`. Zaman aralığı/anlık kapı izni değerlendirilmez; bu liste tek başına geçiş kararı değildir. |
| Cihaz QR tarama / hızlı aç — **kısmi** | `cardReadings:selfCheckIn`, `deviceId` **veya** `deviceSerial` + token (`attendance_repository.dart:22–37`); `granted` bool'a indirgenir | `cardReadings.ts:1378–1449`: aktif ortak kural varsa kart okuma kaydı; `{granted, readingId}`. Fiziksel açma komutu yok (F02); etkinlik/policy/tenant sorunları F03–F04. |
| Kendi dinamik QR'ını üretme — **çalışıyor** (kaynakta), fiziksel okuma **kanıtlanamadı** | Repository dışında `employeeCheckIn:createMyCheckInToken`, `{}` + token (`qr_scan_screen.dart:46–85`) | `employeeCheckIn.ts:10–29`: `{token,expiresAt}`. Gerçek sunucu kaydı oluşturur, demo değildir. TTL `lib/checkInUx.ts:9` ile **60 saniye**; mobildeki 10 saniye yorumu güncel davranışı yansıtmaz, UI dönen expiresAt'ı kullanır. |
| QR'ın fiziksel okuyucuda kullanımı — **kısmi / cihazda kanıtlanamadı** | Mobil tokenı QR olarak gösterir; tüketim panel/HTTP tarafında | `/card-reader` auth ve cihaz pinleme `http.ts:86–165`; UUID token tüketimi `cardReadings.ts:1063–1185`. Kullanılmış/expired token reddi ve kural kontrolü vardır; panel modelinin QR'ı bu kola ulaştırdığı sahada doğrulanmadı. IDE event kolu UUID kontrolünden önce çalışır (`cardReadings.ts:1021–1065`); bütün marka/firmware'lerde aynı QR desteği varsayılamaz. |
| QR'ın web tüketimi — **kısmi**, mobilde doğrudan çağrılmıyor | Mobilin ürettiği aynı token tablosu; web `src/pages/CheckIn.tsx:39` tüketir | `employeeCheckIn:checkInWithToken` public mutation `employeeCheckIn.ts:34–92`; bearer token, opsiyonel koordinat; cihazdan bağımsız geçiş kaydı. F05. |
| Şifre sıfırlama — **placeholder / yönlendirme** | `AuthProvider.resetPassword`, ağ çağrısı yok (`auth_provider.dart:106–110`) | Yönetici ile iletişim mesajı ve false; çalışan için mobil reset endpoint entegrasyonu yok. |
| Ziyaretçi — **placeholder** | `visitor_screen.dart:6–57` | “Çok yakında” ekranı; bu mobil uygulamada ziyaretçi repository/ağ entegrasyonu yok. |

### Timeout, retry ve oturum modeli

- Varsayılan istek timeout'u 15 saniye; query'ler en fazla **3 toplam deneme**, arada 250/500 ms bekler (`convex_config.dart:59–67,231–259`). `maxRetries` ismi üç ek tekrar anlamına gelmiyor. Tam timeout halinde bir query yaklaşık 45,75 saniye sürebilir; ağ/işletim sistemi süresi ayrıca değişebilir.
- Mutation/action varsayılan tek denemedir (`:102–115`); login, self-check-in ve token üretiminde otomatik yeniden yazma yoktur. Bu iyi bir temeldir; timeout, sunucunun yazmadığını garanti etmez. Mevcut `.timeout` isteğe iptal sinyali vermiyor (`:273–286`).
- “Subscription” gerçek push/WebSocket değil, ilk sorgu ve sonra 1 dakikalık HTTP polling'dir; ardışık hatalarda 5 dakikaya kadar geri çekilir (`:150–222`). İstek bitmeden yeni tur başlatılmaz. İptal geç gelen callback'i engeller; ağ isteğini iptal etmez.
- Mobil token JWT değildir; `sessionToken` fonksiyon argümanıdır. Backend wrapper bu argümandan çalışanı çıkarır (`customFunctions.ts:117–134`, `employeeAuth.ts:7–23`). Bu nedenle mobil çağrılarda Authorization başlığı olmaması tek başına auth bug'ı değildir; web `users` rollerinin employee oturumuyla aynı şey olmadığı dikkate alınmalıdır.
- Token sunucuda 32 rastgele byte'tan üretilir ve 90 gün geçerlidir (`employeeAuth.ts:6–14,176–186`). Refresh token/refresh endpoint yoktur. Lokal expiry kontrolü bootstrap'ta yapılır (`auth_provider.dart:50–55,150–154`); canlı kullanımda backend expiry sinyaline ihtiyaç vardır.

## 2. İyi çalışan temeller

1. Mobil endpoint isimleri mevcut, camelCase alanlar korunuyor; giriş, me, cihaz ve kart okuma başarılı yanıtları modellerle eşleşiyor. Eksik `departmentName` nullable destekleniyor.
2. Client tokenı employee çağrılarına kendisi ekliyor ve caller'ın aynı isimli argümanını eziyor (`convex_config.dart:118–147`). Backend employeeId'yi istemciden yetki kaynağı olarak almıyor; oturumdan çıkarıyor.
3. Session doğrulaması her mobil korumalı istekte token varlığı, süre, çalışan varlığı ve `isActive === false` kontrolü yapıyor (`lib/employeeAuth.ts:11–22`). Girişte eksik çalışan, eksik şifre ve yanlış şifre için aynı metin ve dummy bcrypt karşılaştırması kullanılıyor (`employeeAuth.ts:150–174`).
4. Cihaz listesi tam cihaz dokümanını döndürmüyor (`devices.ts:138–145`); geçmiş zenginleştirmesi de cihazın yalnız kimlik/ad/açıklama/seri alanlarını döndürüyor (`cardReadingAudit.ts:138–145`). İncelenen mobil yanıtlarda cihaz şifresi/apiToken sızıntısı görülmedi.
5. Query retry ile mutation tekrarını ayıran açık API, merkezi sealed AppError sınıfları ve TR/EN yerelleştirme girişi var. Polling hatasında eski kayıtlar korunuyor; lifecycle durdurma ve generation kontrolü var (`attendance_provider.dart:151–178,243–253`).
6. Lokal sign-out, sunucu çağrısı başarısız olsa da çalışıyor. Global expiry callback → provider → router zinciri kurulmuş (`main.dart:51–55`, `auth_provider.dart:132–139`, `app_router.dart:48–60`); sorun mekanizmanın yokluğu değil, gerçek hata biçiminin bu mekanizmaya ulaşmamasıdır.
7. Fiziksel okuyucu HTTP girişinde kimlik bilgisi çözümü ve token sahibi cihaza sabitleme var (`http.ts:86–165,223–250`). Mobil selfCheckIn için aynı tenant sınırının ayrıca uygulanması gerekiyor.

## 3. Kanıtlı bulgular

### NET-F01 — Convex fonksiyon hatası ve üretim auth expiry sözleşmesi bozuk

**P1 · Kesinlik: doğrulandı (HTTP 560 sınıflandırması, koordinatörün yerel mock transport deneyi); üretim redaksiyonu ve backend zinciri kaynak analizi.**

- **Kanıt zinciri:** Resmi yerel SDK `node_modules/convex/src/browser/http_client.ts:32` UDF hata durumunu 560 tanımlar; `:316–336` bu durumun gövdesini okuyup errorData/errorMessage ayırır. Mobil `convex_config.dart:299–301` ise bütün 5xx yanıtları JSON decode etmeden ServerError'a çevirir. JSON hata ayrımı ancak `:309–331` sonrasında; retry `:248–251`, expiry callback `:237–240`, polling durdurma `:205–212` bu nedenle yanlış yola girer.
- **Tetikleyici:** Backend'de yanlış şifre (`employeeAuth.ts:171–174`), silinmiş/geçersiz/süresi dolmuş employee session (`lib/employeeAuth.ts:15–21`) ile HTTP fonksiyon çağrısı. Backend bu koşulları plain `Error` ile fırlatıyor.
- **Beklenen / mevcut:** Yanlış şifre tek denemede anlaşılır iş hatası; geçersiz session tek sinyalle lokal oturumu kapatmalı. 560'da mevcut client sunucu hatası gösterir; query üç kez dener ve polling auth hatası gibi durmaz. Backend veriyi yine reddeder; bu bulgu veri erişim bypass'ı değildir.
- **Yerel yeniden üretim:** [Koordinatörün testi](../evidence/http560_repro_test.dart:12), aynı expired-session zarfını HTTP 200'de AuthExpiredError + callback=true, HTTP 560'ta ServerError + callback=false olarak doğruladı. Deney `maxRetries: 1` kullanır; üç deneme ve polling sonucu ayrıca kaynak zincirinden çıkarılmıştır. Canlı backend'e istek yapılmadı ve beklenen yanlış davranışı karakterize eden iki testin geçmesi düzeltmenin yapıldığı anlamına gelmez.
- **İkinci engel:** Yalnız 560 istisnası eklemek yetmez. Client metin eşleştiriyor (`:325–340`) ve `errorData` okumuyor; plain Error'lar production'da redakte edilir. Bu üretim davranışı [resmi Convex hata dokümanıyla](https://docs.convex.dev/functions/error-handling/) doğrulandı. Beklenen iş hataları için yapılandırılmış [ConvexError verisi](https://docs.convex.dev/functions/error-handling/application-errors) veya ayrık sonuç sözleşmesi gereklidir; canlı deployment'ın dev/prod türü bu auditte okunmadı.
- **Etki / kök neden / çözüm:** Login teşhisi, session iptalinde yönlendirme ve destek yükü etkilenir. HTTP durum kodu ile fonksiyon hata semantiği karıştırılmış ve metin hata protokolü olmuş. 560 zarfını parse et; auth/business/protocol/server ayrımını kararlı kodlarla kur; backend'e ilişkin sözleşme değişikliğini ayrı iş olarak planla. Mevcut test yalnız 401 üretir (`mobile/test/config/convex_config_test.dart:54–81`); testin geçmesi gerçek 560 yolunu kanıtlamaz.

### NET-F02 — “Kapıyı Aç” akışı fiziksel komut yerine başarılı geçiş kaydı yazıyor

**P1 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** Buton metni `mobile/lib/l10n/app_tr.arb:116`; `home_screen.dart:245–255` → `AttendanceProvider.quickUnlock` (`attendance_provider.dart:308–328`) → repository selfCheckIn (`attendance_repository.dart:32–37`) → `cardReadings.ts:1378–1449`. Handler yalnız cihaz/kural okur, yön çözer, `cardReadings` yazar ve granted döner; queue/action/kapı komutu çağrısı yoktur.
- **Tetikleyici:** Aktif ortak kurala sahip cihazı seçip hızlı açmaya basmak; aynı durum cihaz QR self-check-in için de geçerli.
- **Beklenen / mevcut:** Fiziksel kapı açma isteği komutun kabul/başarısızlık durumunu bildirmeli; gerçek geçiş sonucu ayrı olay olmalı. Mevcut yanıt erişim izninden türetilir; kapı açılma onayı olmadan `izin_verildi` kaydı yazılır ve UI başarı gösterir. Fiziksel kapının sahada açılmadığı test edilmedi; **incelenen uygulama çağrı zincirinin bunu gerçekleştiren komut üretmediği** saptandı.
- **Etki:** Kullanıcı kapıda kalabilir; fiilî geçiş olmadan devam/puantaj girdisi oluşabilir. `rawData.source = mobile_qr` yazılır (`cardReadings.ts:1443`); bu kaynak PDKS filtrelemesinde uygun sayılır (`lib/pdksSource.ts:62,73–81`). `resolveDirection` tekrar basışlarda onaylı son kayda göre entry/exit değiştirir (`cardReadingProcess.ts:54–72`).
- **Kök neden / çözüm:** İzin, komut ve fiziksel olay tek boolean'a indirgenmiş. Backend'de gerçek komut yolları var: IDE `openIdeDoor` (`actions/ideGatewayDevice.ts:332–366`), Hikvision `remoteOpenDoor` (`actions/hikGatewayDevice.ts:367–402`); bunlar web authedAction'dır, employee tokenını doğrudan bağlamak çözüm değildir. Ürün check-in istiyorsa metin/veri kaynağı bunu açıkça söylemeli; fiziksel açma istiyorsa employee yetkili, kapı bazlı yeni sözleşme ve command sonucundan ayrı geçiş kaydı gerekir.

### NET-F03 — Mobil erişim kararı pasif cihazı ve zaman programını denetlemiyor

**P1 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `devices:listForEmployee` pasif cihazları eler (`devices.ts:131–132`); fakat selfCheckIn cihazı aldıktan sonra `isActive` kontrolü yapmaz (`cardReadings.ts:1386–1402`). Ortak grupta yalnız `rule.isActive` okur (`:1417–1425`). Kuralın `startTime/endTime/days` alanları vardır (`schema.ts:395–408`), yönetim create yolu schedule doğrular (`accessRules.ts:673–698`) ve IDE permission'a bu alanları taşır (`actions/ideGatewayDevice.ts:303–307`). SelfCheckIn bunları hiç değerlendirmez.
- **Tetikleyici:** Önceden seçilmiş/QR'da bulunan cihazı yönetici pasife alır, fakat aktif kural bağları kalır; veya kural yalnız belirli saat/günlere izin verirken mesai dışında çağrı yapılır.
- **Beklenen / mevcut:** Pasif cihaz ve geçersiz zaman aralığında mobil izin reddedilmeli. Mevcut handler aktif ortak kural bulursa granted=true ve onaylı kayıt verir. Fiziksel panelin aynı anda ne yapacağı bu auditte denenmedi; bulgu sunucu mobil kararı ve kayıt doğruluğudur.
- **Etki / kök neden / çözüm:** Yönetim politikasıyla mobil veri/izin sonucu ayrışır. Listeyi güvenlik kapısı saymak ve ortak-kural bool'una indirgemek kök nedendir. Server'da çalışan/cihaz/kural/proje/zaman kararını ortaklaştır; sınır saatleri ve gece aşan programın ürün anlamını belirle. Cihaz listesi görünürlüğü ile anlık izin sözleşmesini ayrı adlandır.

### NET-F04 — Başka projedeki cihaza reddedilen istek bile yabancı cihaz bilgisini geçmişe taşıyor

**P1 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** Mobil yetkili caller selfCheckIn'e cihaz ID/seri verebilir (`attendance_repository.dart:22–35`). Handler cihazı global ID veya global seri indeksinden bulur (`cardReadings.ts:1386–1397`); `device.projectId === employee.projectId` ve projenin mevcut olması kontrol edilmez. Ortak grup yoksa hasAccess=false olur fakat yine `projectId: employee.projectId ?? device.projectId`, yabancı deviceId ve kendi employeeId ile kayıt yazar (`:1434–1445`). Sonra kendi geçmişi (`:1363–1369`) → `cardReadingAudit.ts:132–145` yabancı cihazın ad/açıklama/serisini döndürür.
- **Tetikleyici:** A projesindeki aktif çalışan, bildiği B projesi cihaz ID/serisini yollar; iki proje arasında ortak kural olması gerekmez. Normal cihaz listesi B'yi göstermese de sunucu endpoint'i doğrudan çağrılabilir.
- **Beklenen / mevcut:** Yabancı cihaz işlemi tenant sınırında durmalı; A geçmişinde B cihaz bilgisi oluşmamalı. Mevcut akış erişimi reddederken projeler arası referans ve cihaz metadata'sı üretir. **Başka projenin kapısını açma veya şifre sızdırma kanıtı yoktur.**
- **Etki / kök neden / çözüm:** Tenant metadata mahremiyeti ve audit veri bütünlüğü bozulur; aynı istekler reddedilmiş kayıtları çoğaltabilir. Auth doğrulaması kaynak tenant doğrulaması yerine kullanılmış. Proje eşitliği/orphan reddini lookup ve insert öncesinde uygula; seri aramasını proje ile daralt; ilişkilerin aynı projede olduğunu okuyucuda da doğrula. Meşru multi-project erişim varsa istisnayı açık ve denetlenebilir modelle tanımla.

### NET-F05 — Üretilmiş QR, çalışan pasife alındıktan sonra web tüketiminde hâlâ geçiş yazabiliyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** Mobil token üretimi employee auth guard'ından geçer (`employeeCheckIn.ts:10–25`). Aynı tokenın public web tüketimi süre/kullanım kontrolünden sonra yalnız çalışan varlığını doğrular (`:41–66`); `isActive` kontrolü yapmadan usedAt ve `izin_verildi` kart kaydı yazar (`:68–83`). Karşılaştırma: fiziksel UUID kolu pasif çalışanı reddeder (`cardReadings.ts:1119–1133`). TTL 60 saniyedir (`checkInUx.ts:9`).
- **Tetikleyici:** Aktifken token üret → yönetici çalışanı pasife alsın → daha önce tüketilmemiş tokenı süre dolmadan `checkInWithToken` üzerinden kullan.
- **Beklenen / mevcut:** İlk tüketim anında çalışan hâlâ erişebilir olmalı; mevcut handler pasif çalışana onaylı kayıt ekler. Tamamlanmış tokenın geçmiş başarılı sonucunu idempotent göstermesi ayrı bir davranıştır; onu yeniden geçiş yaratma olarak saymıyoruz.
- **Etki / kök neden / çözüm:** Kısa geçerlilik penceresinde iptal politikasına aykırı devam kaydı; fiziksel kapı açma iddiası yok. Üretim anındaki kontrol tüketim anındaki kontrolün yerine geçmiş. Ortak tüketim önkoşulu ekle; completed replay'in yeni kayıt yaratmadığını koru. Public bearer-token tasarımını tek başına güvenlik açığı saymıyoruz; gerçek tetikleyici pasife alma sonrasındaki ilk tüketimdir.

### NET-F06 — Yanıt bozulması boş listeye veya gerçek erişim reddine dönüştürülüyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `Attendance.listFromConvexJson` ve `Device.listFromConvexJson` liste dışı JSON'da `[]` döner, liste içindeki map olmayan elemanları sessizce atar (`models/attendance.dart:87–93`, `models/device.dart:41–47`). Device ID yoksa `.toString()` ile `"null"` üretilebilir (`device.dart:22`). selfCheckIn yanıtında map/granted yoksa false döner (`attendance_repository.dart:36–37`); eksik granted ile gerçek ret ayrılmaz. Auth repository'de bazı alanlar doğrulansa da yanlış primitive tip cast'leri standart protocol hatasına çevrilmez (`auth_repository.dart:68–80`).
- **Tetikleyici:** Backend sürüm uyuşmazlığında listelerin bir zarf nesnesi içine alınması, hatalı satır veya selfCheckIn'de granted alanının eksik/yanlış tipte olması. Güncel başarılı backend shape'inin bu hatayı ürettiği iddiası yok; tetikleyici somut bozuk sözleşmedir.
- **Beklenen / mevcut:** Kullanıcı “veri alınamadı / yanıt uyumsuz” görmeli; mevcut kod “kayıt yok / cihaz yok / erişim reddedildi” gibi geçerli iş sonucu üretir. Polling bu boş sonucu başarı sayıp eski listeyi ezer (`attendance_provider.dart:162–166`).
- **Etki / kök neden / çözüm:** Entegrasyon regresyonu saklanır; kullanıcı doğru verinin silindiğini/izin verilmediğini sanır. `dynamic` + permissive varsayımlar sınır doğrulamasının yerini almış. HTTP zarfı ve domain DTO'ları için açık decoder, gerekli alan/tip kontrolleri ve ayrı protocol error ekle; bozuk payload eski geçerli veriyi değiştirmesin.

### NET-F07 — Cihaz seçimi kullanıcı mesajı yerine ham hata gövdesini gösterebiliyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `ServerError.debugMessage` body'yi içerir; `AppError.toString` debugMessage döndürür (`errors.dart:17–18,60–71`). Cihaz seçimi `catch` içinde `error.toString()` saklar (`select_device_screen.dart:42–46`) ve doğrudan Text ile basar (`:102–110`). Buna ek olarak BusinessError ve localizer bilinmeyen metni olduğu gibi döndürür (`errors.dart:100–110`, `error_localizer.dart:25–35`); HTTP non-2xx/bozuk JSON dalları body'yi metne ekler (`convex_config.dart:303–317`).
- **Tetikleyici:** Cihaz listesi isteğine HTTP 503 gövdesi, proxy HTML yanıtı veya backend'in teknik hata açıklaması gelmesi.
- **Beklenen / mevcut:** Kısa ve yerelleştirilmiş hata, gerekirse güvenli istek referansı gösterilmeli; mevcut cihaz ekranı ham response/debug ayrıntısını gösterir. Diğer AppError kullanan ekranlarda daha iyi ayrım olsa da bilinmeyen business metni de kontrolsüzdür.
- **Etki / kök neden / çözüm:** Kullanıcı anlaşılmaz teknik mesaj görür; server/proxy gövdesinin içeriğine bağlı olarak iç sistem ayrıntıları açığa çıkabilir. Gerçek sır sızdığı tespit edilmedi. Debug/user ayrımı bütün tüketicilerde uygulanmamış. Güvenli yerelleştirilmiş hata kodu + destek referansı kullan; raw body'yi UI'a/log'a kontrolsüz taşımayı bırak.

### NET-F08 — Eksik ortam yapılandırması sabit deployment'a sessizce bağlanıyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt / tetikleyici:** `.env` yüklenemezse hata yalnız debug modunda yazılır (`convex_config.dart:24–35`); `CONVEX_URL` bulunmazsa kodda sabit deployment adresi seçilir (`:13–14`). Eksik release asset/anahtar ile uygulama yine network client oluşturur. Gerçek `.env` değerleri ve release paketinin içeriği incelenmedi.
- **Beklenen / mevcut:** Hedef backend açıkça seçilmeli; eksik yapılandırmada anlaşılır başlangıç hatası olmalı. Mevcut akış yazılımda gömülü deployment'a login bilgileri ve mutasyonlar gönderebilir; kullanıcının bunu görmesi gerekmiyor.
- **Etki / kök neden / çözüm:** Yanlış ortama giriş/veri yazma ve destek karmaşası riski. Sabit adresin production/dev/müşteri hedefi olduğu kanıtlanmadığından yanlış ortama fiilen yazıldı iddiası yok. Ortam gereksinimini build/startup doğrulamasıyla zorunlu kıl; release'te sessiz fallback'i kaldır, geliştirme varsayılanını açıkça sınırla ve URL şeması/host doğrula.

### NET-F09 — Geçmiş sözleşmesi olay zamanına göre sayfa garantisi vermiyor; polling büyüyen listenin tamamını okuyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** Backend `by_employee` indeksinde desc + take(limit) kullanır (`cardReadings.ts:1363–1367`); indeks yalnız employeeId'dir, olay zamanı içermez (`schema.ts:497`). Olay zamanlı employee indeksi zaten vardır (`:508–509`). Fiziksel offline IDE event'inde eski panel zamanı accessTime'a yazılır, yeni insert daha sonra yapılır (`cardReadings.ts:1028–1058`). Frontend gelen sıralamayı history'de yeniden sıralamaz (`history_screen.dart:1026–1050`). Provider “load more”da limit'i 50 arttırır ve tüm sorguyu tekrar kurar (`attendance_provider.dart:186–198`); sunucu limit için clamp/cursor uygulamaz (`cardReadings.ts:1358–1367`).
- **Tetikleyici:** Yeni olaylardan sonra sisteme ulaşan eski offline kayıtların son 50'ye girmesi; çok sayıda kayıt için tekrar tekrar daha fazla yükleme.
- **Beklenen / mevcut:** “Son hareketler” olay zamanı ve kararlı tie-break ile dönmeli; sonraki sayfa yalnız ilave veriyi almalı. Mevcut sıralama insert zamanına göre değişebilir; 50/100/150… tüm prefix her açılışta ve polling'de yeniden okunur. Büyük limitte hangi altyapı limitine ne zaman ulaşılacağı ölçülmedi; kesin kesinti eşiği ileri sürülmüyor.
- **Etki / kök neden / çözüm:** Eski olaylar güncel olayların önüne geçebilir; ilk pencere güncel kayıtları eksik içerebilir, büyüyen payload okuma/mobil veri maliyetini artırır. Limit büyütme pagination gibi kullanılmış. Olay-zamanı indeksi ve bounded cursor sözleşmesi kur; canlı son pencereyi arşiv sayfalarından ayır. Aylık istatistikler son N kaydın toplamı olacaksa bunu açıkça belirt, tam ay gerekecekse ayrı scope'lu özet sorgusu kullan.

## 4. Geliştirme iş paketleri

Aşağıdaki paketler öneridir; bu audit kapsamında backend veya mobil kodu değiştirilmedi. Backend gerektiren maddeler yalnız mobil yama ile tamamlanmış sayılamaz. S/M/L göreli kapsam tahminidir: gün/takvim taahhüdü değildir.

### NET-W01 — HTTP hata protokolü ve kararlı auth kodları

- **Kapsam:** NET-F01; transport zarfı, AppError ve employee auth hata sözleşmesi.
- **Bağımlılıklar:** Mobil ve backend ekipleri hata kodlarını ortak onaylamalı; mevcut production hata redaksiyonu korunmalı.
- **Yapılacaklar:** 560 için JSON/errorData decode; `SESSION_INVALID`, `SESSION_EXPIRED`, `EMPLOYEE_INACTIVE`, `INVALID_CREDENTIALS` gibi ayrık kodlar; auth ile yetki reddini ayırma; yalnız geçici network/servis hatasını tekrar etme; tek oturum sonlandırma olayını eşzamanlı hatalarda tekilleştirme; eski backend yanıtına güvenli fallback.
- **Gözlemlenebilir kabul:** 560 invalid-session tek HTTP denemesinde login'e yönlendirir ve polling durur; şifre hatası sunucu kesintisi sayılmaz; 503/timeout query deneme sayısı tanımlı kalır; mutation otomatik tekrarlanmaz; redakte production Error bilinmeyen güvenli hata olur, metin tahminiyle auth kararı verilmez.
- **Anlamlı testler:** Gerçek protokole benzer 560 errorData; 560 redakte plain Error; 200 success; 401/403 ayrımı; 429/503; eşzamanlı iki expiry; revoked session ile staging E2E. Mock repository yerine HTTP sınırı da test edilir.
- **Tahmin:** **M** — istemci ayrıştırması sınırlı, backend hata şeması ve geçiş uyumluluğu birlikte ele alınacak.

### NET-W02 — İzin, kapı komutu ve geçiş kaydını ayırma

- **Kapsam:** NET-F02; hızlı açma ve QR self-check-in ürün sözleşmesi.
- **Bağımlılıklar:** Önce check-in mi fiziksel kapı açma mı kararı; fiziksel açma için marka/transport/kapı kimliği ve backend employee yetki sınırı. NET-W03 yetki politikası olmadan komut uç noktası açılmaz.
- **Yapılacaklar:** Ayrık operation/result DTO'ları; gerekiyorsa employee yetkili komut akışı, requestId/operationId, bounded status sorgusu ve idempotency; kuyruklandı ile cihaz onayını farklı gösterme; fiziksel geçişi yalnız güvenilir olaydan kaydetme. Check-in seçilirse açık kaynak/niyet etiketi ve PDKS politikası; mevcut web authedAction'ları employee tokenıyla doğrudan yeniden kullanmama.
- **Gözlemlenebilir kabul:** Komut üretilmeden “kapı açıldı”/eşdeğer başarı gösterilmez; yalnız istek gönderilmesi fiilî geçiş oluşturmaz; timeout sonrası aynı requestId ile tekrar tek komut/tek mantıksal işlem üretir; offline panel kullanıcıya bekliyor/başarısız durumunu verir.
- **Anlamlı testler:** Grant olup kapı onayı gelmeyen panel; kuyruk ack/fail/timeout; iki kapılı IDE panelinde doğru actuator; Hik gateway/localBridge; yanıt kaybı ve tekrar; komut başarılı olsa da fiziksel geçiş olmayan durum; mobil kullanıcı web yönetim eylemine erişemez.
- **Tahmin:** **L** — ürün kararı, çoklu cihaz transport'u, yeni güven sınırı ve cihaz doğrulaması içerir.

### NET-W03 — Ortak erişim politikası ve tenant sınırı

- **Kapsam:** NET-F03–F04; selfCheckIn ve cihaz liste kararının açık sözleşmesi.
- **Bağımlılıklar:** Proje/orphan/multi-project politikası, schedule saat dilimi ve kapı bazlı yetki anlamı; W02 ile API tasarımı birlikte yapılır.
- **Yapılacaklar:** Çalışan/cihaz/kural proje tutarlılığı; serial lookup'ta tenant daraltma; aktif cihaz kontrolü; gün/saat/sınır saatleri değerlendirmesi; gerekiyorsa doorId seviyesinde karar; yabancı kaynak için normal employee geçmişine kayıt yazmayan güvenli ret; tarihî bozuk ilişkilerin salt okunur tespiti ve ayrı onaylı temizlik planı.
- **Gözlemlenebilir kabul:** A çalışanı B cihaz ID/serisini yolladığında ne B metadata'sı ne A geçmişinde B ilişkili kart kaydı oluşur; pasif cihaz grant üretmez; saat dışı kural grant üretmez; yetkili gün/saat/kapı senaryosu çalışır; cihaz listesinin “kural bağlı” mı “şu an izinli” mi olduğu API/UI sözleşmesinde nettir.
- **Anlamlı testler:** İki tenant, aynı seri; geçerli yabancı ID; projesiz çalışan/cihaz; eski ilişki; kural pasife alma; önceden seçili cihazın pasife alınması; gece aşan saat aralığı, gün değişimi, exact start/end; aynı panelde farklı kapı yetkisi.
- **Tahmin:** **L** — birden çok giriş yolunda politika tutarlılığı ve mevcut veri ilişkileri nedeniyle.

### NET-W04 — QR tüketim anında çalışan iptalini uygulama

- **Kapsam:** NET-F05; public web token tüketimi ile fiziksel token yolunun önkoşulları.
- **Bağımlılıklar:** W03 ortak aktif çalışan kararı; completed replay'in geçmiş snapshot mı yeni yetki kararı mı olduğunun ürün tanımı.
- **Yapılacaklar:** İlk tüketimden önce çalışan aktifliği kontrolü; expired/invalid/inactive ayrık kodları; tokenın transaction içinde tek tüketimi; mevcut completed snapshot davranışını yeni kayıt yaratmadan koruma; TTL yorumlarını gerçek sözleşmeyle hizalama.
- **Gözlemlenebilir kabul:** Aktifken üretilip pasife alma sonrası ilk tüketilen token reddedilir, usedAt ve kart kaydı oluşmaz; iki eşzamanlı tüketim en fazla bir yeni kayıt oluşturur; completed replay yeni kayıt yaratmaz; süresi dolan ilk tüketim reddedilir.
- **Anlamlı testler:** Üret → disable → tüket; üret → çalışan sil → tüket; expiry sınır anı; eşzamanlı web/fiziksel tüketim; completed token ve sonradan silinen çalışan.
- **Tahmin:** **M** — değişiklik dar, iki tüketim yolunun idempotent davranışını koruma gereği var.

### NET-W05 — Doğrulanan DTO'lar ve güvenli kullanıcı hataları

- **Kapsam:** NET-F06–F07; üç repository, doğrudan QR çağrısı, decoder ve hata tüketicileri.
- **Bağımlılıklar:** W01 hata kodları; güncel endpoint/DTO envanteri bu rapordaki tabloyla başlatılabilir.
- **Yapılacaklar:** Tek noktada zarf parse; gerekli alan/tip/null doğrulama; ProtocolError veya eşdeğer ayrık hata; malformed response'u ret/boş listeye çevirmeme; son geçerli veriyi koruma; bütün ekranlarda localizer üzerinden güvenli mesaj; raw body yerine redakte tanısal veri ve request reference.
- **Gözlemlenebilir kabul:** Liste yerine object, yanlış tarih/ID/granted tipi “boş liste/erişim reddi” olmaz; `id = "null"` oluşmaz; başarılı backend fixture'ları üç repository ve QR token consumer tarafından kabul edilir; body içindeki işaretleyici hiçbir hata ekranında görünmez; EN modunda bilinen hata kodları EN görünür.
- **Anlamlı testler:** Null/object/list varyantları, liste içindeki bozuk eleman, gerekli alan yok, yanlış primitive tip, bozuk ISO tarih; 503 HTML gövdesi, malformed JSON, bilinmeyen hata kodu; geçmiş veri varken bozuk polling yanıtı; geçerli null opsiyoneller.
- **Tahmin:** **M** — ortak decoder ve birkaç tüketici değişir; yeni state kaybı yaratmamak için sınır testleri gerekir.

### NET-W06 — Açık ve doğrulanan deployment yapılandırması

- **Kapsam:** NET-F08; startup/build ortam sözleşmesi.
- **Bağımlılıklar:** Release/staging hedeflerinin ürün/operasyon tarafından tanımı; gerçek secret değerlerini rapora veya test fixture'ına taşıma gereği yok.
- **Yapılacaklar:** Gerekli URL doğrulaması; development varsayılanı açık opt-in; release'te eksik/geçersiz hedef için güvenli başlangıç hatası; kullanıcıya gizli değer göstermeyen ortam teşhisi.
- **Gözlemlenebilir kabul:** Eksik/boş/geçersiz release URL ile hiçbir HTTP çağrısı yapılmaz; doğru hedefte request origin beklenen host olur; hata ekranı gizli veri içermez; staging ve release hedef karışımı CI/package kontrolünde yakalanır.
- **Anlamlı testler:** Asset yok, anahtar yok, boş değer, hatalı şema, trailing slash, beklenen staging/release host; init sonrasında client oluşup oluşmadığının gözlemi.
- **Tahmin:** **S** — dar yapılandırma ve başlangıç akışı; dağıtım ekibiyle hedef teyidi gerekir.

### NET-W07 — Olay zamanlı bounded geçmiş ve ayrı canlı pencere

- **Kapsam:** NET-F09; employee geçmiş query'si, repository/provider/history pagination sözleşmesi.
- **Bağımlılıklar:** W05 DTO; timestamp tie-break ve seçili tarih/device filtrelerinin server scope'u; aylık istatistik gereksinimi.
- **Yapılacaklar:** Olay zamanlı mevcut indeksi kullanma; sabit üst sayfa boyutu ve cursor; ilk canlı pencereyi geçmiş sayfalardan ayrı yenileme; ID ile tekilleştirme; isDone/continueCursor; gerekiyorsa tam dönem özet sorgusu.
- **Gözlemlenebilir kabul:** Sonradan gelen eski event güncel event'i ilk sayfanın önüne geçirmez; eşit zamanlı kayıtlar sayfalar arasında kaybolmaz/çoğalmaz; sayfa başına üst sınır aşılmaz; 20 arşiv sayfası yüklemek sonraki canlı polling payload'ını 20 kat büyütmez; tarih filtresi eksik pencereyi tam veri gibi sunmaz.
- **Anlamlı testler:** Offline backfill ile ters insert sırası, eşit accessTime, sayfalama esnasında yeni kayıt, aynı cursor tekrar, izin dışı employee/device filtresi, boş son sayfa, invalid/çok büyük limit, binlerce kayıtla okunan doküman/payload ölçümü.
- **Tahmin:** **M** — indeks mevcut; client state ve filtre/cursor geçişi asıl iş yükü.

## 5. Manuel cihaz / E2E doğrulama matrisi

**Aşağıdaki satırların tamamı planlanan doğrulamadır; bu auditte uygulanmadı.** Yalnız izole staging tenantları ve sentetik kullanıcı/kart verisiyle yürütülmeli. Üretim verisi değiştirilmedi.

| Kimlik | Ortam / tetikleyici | Gözlemlenecek sonuç |
|---|---|---|
| NET-E01 | Android ve iOS; doğru/yanlış şifre; dev ve redakte üretim benzeri hata yanıtı | İstek şekli, 560/errorData, güvenli iş hatası, login başarısı; şifre/token loglanmaz |
| NET-E02 | Aktif ekranda token silinmesi, süresinin dolması, çalışanın pasife alınması | Tek auth transition; cihaz listesi/QR/polling tutarlılığı; login redirect, eski kullanıcı verisinin görünmemesi |
| NET-E03 | Uçak modu, DNS başarısızlığı, 15 saniyeyi aşan yanıt, 503/429 | Query tekrar sayısı ve süre; mutation tekrar yok; doğru hata türü; yeniden bağlantıda veri toparlama |
| NET-E04 | Arka plan → ön plan, ekran kapatma, tab değişimi, aynı anda manuel refresh | Polling durur/yeniden başlar, geç gelen eski callback yeni kullanıcı verisini ezmez; isteğin iptal/timeout durumu ölçülür |
| NET-E05 | Android/iOS hızlı aç; IDE çok kapılı panel, Hik gateway ve localBridge | Doğru kapıya komut/ack; kuyruklandı ile onay ayrımı; fiziksel kapı ve kart okuma olayı ayrı gözlemlenir; response timeout sonrası tekrar tek işlem |
| NET-E06 | Pasif cihaz, hafta dışı/saat dışı kural, yetkisiz kapı, önceden seçilmiş cihaz | İzin reddi ve kullanıcıya nedeni; sahte onaylı PDKS kaydı oluşmaması |
| NET-E07 | A/B tenant; A tokenı ile B ID/seri; denied istek sonrası A geçmişi | B metadata'sı görünmez, projeler arası ilişki yazılmaz; sır alanları hiçbir yanıtta yok |
| NET-E08 | Mobil dinamik QR; desteklenen her marka/firmware | QR karakterlerinin doğru taşınması, 60 saniye sözleşmesi, expiry ve reuse reddi; IDE/Hik kolunun gerçek davranışı ayrıca kaydedilir |
| NET-E09 | Üret → disable → süre içinde web ve fiziksel tüketim | İlk tüketim her iki yolda reddedilir; completed replay yeni kayıt üretmez |
| NET-E10 | Offline panel eski kayıtları sonradan gönderir; çok sayfa history | Sıralama olay zamanı; cursor'da tekrar/kayıp yok; payload/okuma maliyeti bounded |
| NET-E11 | Geçerli veri üstüne bozuk JSON/shape, 503 HTML; TR/EN | Önceki veri korunur; anlaşılır yerelleştirme; body/debug ayrıntısı UI'a sızmaz |
| NET-E12 | Eksik yapılandırmalı release benzeri paket | Network başlamadan güvenli hata; sabit deployment fallback'i yok; hedef doğrulaması |

## 6. Açık sorular ve teslim sınırı

1. “Kapıyı Aç” fiilen fiziksel remote unlock mı, yoksa çalışanın kendi devam beyanı mı? İkinci durumda hangi PDKS/ücret hesabı bu beyanı kabul edecek ve kullanıcıya nasıl anlatılacak?
2. Mobil için panel/cihaz yerine **kapı** seçmek gerekiyor mu? Backend `groupDoors` ile aynı panelde farklı kapı yetkisi tutabiliyor (`schema.ts:445–457`), mevcut mobil selfCheckIn yalnız device ID/seri alıyor.
3. Çalışanların birden çok projedeki cihaza meşru erişimi var mı? Yoksa kesin same-project koşulu; varsa açık grant modeli ve audit attribution kararı gerekir.
4. Erişim zaman programı saat dilimi, gece aşan aralık, başlangıç/bitiş eşitliği ve izinli gün anlamı nedir? Mobil ile panel aynı kararı vermeli.
5. `checkInWithToken` web akışının iş amacı nedir: cihaz bağımsız check-in mi, fiziksel erişim mi? Tokenın ele geçirilmesine karşı ek bağlayıcı gereksinim ve konumun doğrulama mı yalnız beyan mı olduğu netleştirilmeli; koordinat gönderilmesi fiziksel yakınlığı kanıtlamaz.
6. Giriş endpoint'i için deployment/gateway seviyesinde rate limit veya abuse kontrolü var mı? İncelenen `employeeAuth:signIn` gövdesinde deneme sayacı/limiter görünmüyor; dış altyapı görülmediğinden fiilî limitsiz production brute-force açıklığı diye sınıflanmadı.
7. Şifre yenilemenin eski 90 günlük employee sessionlarını iptal etmesi ürün gereği mi? `employeeAuth.ts:116–122` ve `employees.ts:517–522` şifre yazar, session silmez; `getCurrentEmployee` parola sürümünü karşılaştırmaz. Mevcut politikanın kabulü veya session version/revoke-all işi ayrıca belirlenmeli; bu auditte bir hesap ihlali kanıtı yok.
8. Eksik release ortamında kullanılan sabit deployment hangi amaçla tutuluyor? Gerçek env/deployment türü okunmadığı için canlı hedef/production doğrulaması yapılamadı.
9. History ve aylık dashboard tam dönemi mi, yüklenen son N olayı mı temsil etmeli? API pagination ve özet ihtiyacı bu karara bağlıdır.
10. Canlı backend fonksiyonlarının bu çalışma ağacıyla aynı sürümde olduğu, platform TLS/pinning/OS network ayarları, paket içindeki ortam seçimi ve gerçek panel model desteği bu modülde kanıtlanmadı. Platform/kimlik modülleriyle birleştirilirken kaynak analizi cihaz testi gibi sunulmamalıdır.

İlk öncelik NET-W01 ile hata/oturum zincirini düzeltmek; NET-W02–W03 ile kapı komutu ve yetki sözleşmesini birlikte belirlemektir. NET-W04–W07 bunların veri doğruluğu ve dayanıklılık tamamlayıcılarıdır. Eksik test tek başına fonksiyonel bug olarak sayılmadı; mevcut mock testlerin gerçekte hangi sınırı doğruladığı ayrı belirtildi.
