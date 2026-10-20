# NGS Plus — Birleştirilmiş geliştirme paketi

19 Ekim 2026. Bu belge modül raporlarını uygulanabilir ortak işlere dönüştürür. Kod düzeltmeleri uygulanmadı. Modül raporlarındaki iş paketleri ayrıntılı alt görevlerdir; aşağıdaki MOB kimlikleri ortak kök nedenlerin tek sahipli üst işleridir. Aynı bug'ın home, QR, profil ve ağ raporunda görünmesi dört ayrı hata veya dört ayrı uygulama işi olarak sayılmaz.

## Mevcut durumun değerlendirmesi

Uygulamada çalışan bir temel var: repository/provider ayrımı, korumalı router, gerçek çalışan oturumu, gerçek Convex sorguları, polling, tema ve TR/EN altyapısı mevcut. Yerel analiz temiz ve mevcut 44 test başarılı. Sıfırdan yeniden yazım gerekliliği bu kanıtlarla ortaya konmuş değil; önce kritik sözleşmeleri düzeltip mevcut katmanları güçlendirmek daha somut bir başlangıçtır.

En önemli sorun görsel eskilik değil; **erişim izni, kapı komutu, fiziksel geçiş ve yoklama kaydının aynı başarı sonucuna indirgenmesi**. İkinci eksen oturum ve veri sahipliği; üçüncüsü günlük/dönemsel hesapların eksik kayıt penceresi ve farklı zaman kurallarıyla yapılmasıdır. Ziyaretçi ve profil ayarlarının önemli bölümü de tamamlanmamış yeteneklerdir.

[Doğrulama kanıtı](evidence/baseline.md): 44 mevcut test + HTTP 560 için iki ek yerel characterization vakası. Ek iki vakanın geçmesi mevcut yanlış davranışı yeniden üretir; sorunun giderildiğini göstermez. Cihaz/canlı backend/fiziksel kapı doğrulaması yapılmadı.

## Önce yazılı hale getirilecek ürün sözleşmeleri — MOB-00

**Sahip:** ürün + mobil + backend + cihaz entegrasyonu. **Büyüklük:** M; teslim tarihi tahmini değildir.

| Karar | Somut seçenek / açıklığa kavuşacak sınır | Etkilenen işler |
|---|---|---|
| Hızlı işlem ne yapar? | Fiziksel kapı açma komutu mu, uzaktan/manual check-in mi? Komut onayı ile gerçek geçiş ayrı olaylardır. | MOB-05–09 |
| Mobil hangi kanıtla yoklama üretir? | Okuyucuda tüketilmiş kısa ömürlü challenge mı; uzaktan self-check-in izinli mi ve hangi kaynak/güven seviyesinde? | MOB-06, MOB-07, MOB-10 |
| Mobil geçmiş neyi gösterir? | Ham erişim denemeleri ile resmi PDKS/vardiya sonucu ayrı mı? Ret, bilinmeyen yön ve kaynak uygunluğu açıkça tanımlanmalı. | MOB-10–12 |
| İş günü ve zaman | Proje/Türkiye günü, cihaz yereli ve vardiya günü ayrımı; gece yarısını aşan vardiya ve kural saatleri. | MOB-05, MOB-10, MOB-11 |
| Mobil hedef | Cihaz mı, kapı/IO/aktüatör mü? Çok kapılı panelde yalnız deviceId yeterli değildir. | MOB-05, MOB-06, MOB-14 |
| Oturum | Beni hatırla yalnız e-posta mı, kalıcı oturum mu? Açık logout, expiry ve parola değişimi farklı geçişlerdir. | MOB-01–04, MOB-19 |
| Mobil kullanıcı yetkileri | Çalışan hangi profil alanını değiştirebilir; ziyaretçide ev sahibi mi, saha operatörü mü? Mobil employee session web admin rolü değildir. | MOB-17, MOB-18 |

**Kabul:** Her karar için sahibi, örnek giriş/çıkış verisi, başarı/hata anlamı ve geriye uyumluluk notu olan kısa ADR hazırlanır. Açık kararlar çalışma sırasında varsayımla yetki genişletilerek kapatılmaz. Bu audit bu kararlar için kullanıcı yanıtı beklemeden teknik paketi hazırlamıştır.

## Ortak iş kartları

### MOB-01 — Parola saklamayı kaldır ve açık logout'u kalıcı yap

- **Öncelik / sahip / büyüklük:** P1 · mobil auth · M.
- **Kaynak:** [AUTH-F01/F02, WP01/WP02](modules/01-auth.md); [PROFILE-F01/W01](modules/06-profile.md).
- **Kapsam:** Login/splash/provider arasında tek oturum saklama arayüzü; ham parola okuma/yazmanın kaldırılması; güvenli token saklama; eski tercih anahtarlarının sır loglamadan temizlenmesi. Açık logout yerel erişimi ağdan bağımsız sonlandırır ve otomatik yeniden giriş yetkisini kaldırır.
- **Bağımlılık:** MOB-00 kalıcılık kararı; MOB-03 ile ortak oturum nesli.
- **Kabul/test:** Remember-me açık/kapalı × online/offline logout → process kill → relaunch matrisinde kendiliğinden giriş olmaz. Tercih deposunda ham parola/token bulunmaz. Depolama hatası sahte başarılı giriş üretmez. Sunucu iptali başarısızken uzak token iptal edilmiş gibi raporlanmaz.

### MOB-02 — Oturum iptali, parola yaşam döngüsü ve giriş denemesi sınırı

- **Öncelik / sahip / büyüklük:** P1 (revocation), P2 (deneme sınırı) · backend auth · M.
- **Kaynak:** [AUTH-F03/F08, WP03/WP08](modules/01-auth.md).
- **Kapsam:** Bütün parola yazma yollarında eski mobil oturumları geçersiz kılan atomik sürüm/revocation politikası; normalize hesap bazlı kalıcı giriş sınırlama ve güvenli geri kazanım. Gerekli schema değişikliği için ayrı geçiş planı.
- **Bağımlılık:** MOB-04 kararlı hata kodları; MOB-00 oturum politikası.
- **Kabul/test:** İki cihazın eski tokenları parola değişiminden sonraki ilk query/mutation'da reddedilir; yeni giriş ve başka çalışan etkilenmez. Başarısız mutation rollback'i limiter sayacını geri almamalıdır. Eşzamanlı deneme, eşik sınırı ve süre penceresi gerçek kalıcı etkiyle sınanır.

### MOB-03 — Bütün async sonuçları oturum ve istek nesline bağla

- **Öncelik / sahip / büyüklük:** P1 · mobil state/mimari · M.
- **Kaynak:** [AUTH-F04/WP04](modules/01-auth.md), [AH-F05/F10/W05](modules/03-attendance-history.md), [HOME-F08/W05](modules/02-home.md).
- **Kapsam:** Auth generation/epoch; giriş, expiry, list, silent refresh, mutation sonucu, hata ve finally yazımlarında sahiplik kontrolü. Hesap değişiminde kayıt/hata/busy state'ini temizleme; eski küçük-limit isteğinin yeni büyük pencereyi ezmesini önleme.
- **Bağımlılık:** MOB-01 saklama sınırı; MOB-19 provider/router lifecycle düzeni.
- **Kabul/test:** Completer ile A-request → logout → B-login → B-response → A-response sırası zorlanır; A sonucu B'nin veri, hata veya loading state'ini değiştiremez. Eski token expiry yeni tokenı kapatmaz; logout sonrası geç login cevabı oturum açamaz; dispose sonrası notify/setState yoktur.

### MOB-04 — Convex HTTP hata protokolü ve tipli API sınırı

- **Öncelik / sahip / büyüklük:** P1 · backend API + mobil transport · M.
- **Kaynak:** [NET-F01/F06/F07, W01/W05](modules/09-network-backend.md), [AUTH-F09/WP09](modules/01-auth.md); [yerel yeniden üretim](evidence/http560-repro.txt).
- **Kapsam:** HTTP 560 UDF hata zarfını gerçek 5xx'ten ayırma; yapılandırılmış auth/business kodları ve production redaksiyonuyla uyum; geçerli DTO decode, protocol error ve güvenli kullanıcı mesajları. Repository'lerde eksik granted/yanlış liste/boş ID ret veya boş başarıya dönüşmez.
- **Bağımlılık:** MOB-03 eski-token kontrolü ile birlikte tasarım. Backend plain Error redaksiyonu nedeniyle yalnız durum kodunu düzeltmek yeterli değildir.
- **Kabul/test:** 560 expired oturumu tek denemede sonlandırır; yanlış parola sunucu arızası değildir; 503 query retry'ı sınırlıdır, mutation kendiliğinden tekrarlanmaz. Bozuk yanıt eski geçerli listeyi silmez; UI'da raw body/sınıf adı gösterilmez. 200/401/403/429/503/560, errorData ve redakte plain Error fixture'ları ile sınır testi; staging expiry E2E.

### MOB-05 — Tenant ve erişim kararını bütün kanallarda ortaklaştır

- **Öncelik / sahip / büyüklük:** P1 · backend erişim · L.
- **Kaynak:** [DEV-F02/F03/F05, W02/W04](modules/07-devices.md), [NET-F03/F04/W03](modules/09-network-backend.md), [QR-F10/W08](modules/04-qr.md), [VIS-F02/W02](modules/05-visitor.md).
- **Kapsam:** Çalışan/cihaz/kural/kapı proje tutarlılığı; scope'lu seri lookup; aktif cihaz; kural gün/saat/gece aralığı; groupDevices + groupDoors anlamı; geçmiş zenginleştirmesinde tenant savunması. Ziyaretçi checkOut/releaseCard orphan guard'ı dar, bağımsız alt iş olarak önce yapılabilir.
- **Bağımlılık:** MOB-00 zaman ve hedef sözleşmesi; mevcut tarihî bozuk ilişkilerin veri düzeltmesi ayrıca planlanır.
- **Kabul/test:** A çalışanı bilinen B cihaz ID/serisini gönderdiğinde B metadata'sı veya A geçmişinde yabancı ilişki oluşmaz. Pasif cihaz, saat dışı ve yanlış kapı onaylı hareket yazamaz. Çok kapılı panelde bir kapının izni diğer kapıya genişlemez. Project admin projesiz ziyaretçiyi değiştiremez. Gerçek auth wrapper'lı iki tenant fixture ve sınır saatleri kullanılır.

### MOB-06 — Erişim izni, cihaz komutu ve gerçekleşmiş hareketi ayır

- **Öncelik / sahip / büyüklük:** P1 · ürün + backend cihaz entegrasyonu + mobil · L.
- **Kaynak:** [HOME-F01/W01](modules/02-home.md), [QR-F02/F06/W02](modules/04-qr.md), [DEV-F04/W03](modules/07-devices.md), [NET-F02/W02](modules/09-network-backend.md), [PROFILE-F05/W07](modules/06-profile.md).
- **Kapsam:** Sonuç DTO'sunda karar nedeni, operation/reading ID, server zamanı ve yön; gerçek unlock isteniyorsa dar employee yetkili komut, doğru kapı/aktüatör, queued/sent/confirmed/failed/unknown durumları. Komut denemesi gerçekleşmiş geçiş sayılmaz. Yalnız self-check-in seçilirse UI ve PDKS kaynağı açıkça buna göre değişir.
- **Bağımlılık:** MOB-00, MOB-05, MOB-09. Mevcut web admin action'ını employee tokenıyla doğrudan açmak çözüm değildir.
- **Kabul/test:** Komut kabulü, cihaz onayı ve fiziksel olay ayrı izlenir. Panel offline, ack kayıp ve komut başarılı ama geçiş yok vakaları doğru görünür. Desteklenen generic/Hikvision/IDE taşıma yolları ve çok kapılı panel laboratuvarda ayrı doğrulanır; salt grant sonucu “kapı açıldı/geçiş başarılı” değildir.

### MOB-07 — QR challenge ve tüketici güven sınırı

- **Öncelik / sahip / büyüklük:** P1 · backend QR/erişim · L.
- **Kaynak:** [QR-F03/F05/W03](modules/04-qr.md), [NET-F05/W04](modules/09-network-backend.md).
- **Kapsam:** Statik cihaz tanıtıcısı ile fiziksel bulunma kanıtını ayırma; token amacı/okuyucu/cihaz bağlamı; tüketim anında aktif çalışan ve erişim kuralı; public ve reader tüketicilerinin ortak transaction/tek tüketim semantiği. Uzaktan yol izinliyse ayrı kaynak/güven seviyesi.
- **Bağımlılık:** MOB-00 fiziksel kanıt kararı; MOB-05, MOB-06 ve MOB-09 ile ortak model.
- **Kabul/test:** Token üret → çalışanı pasifleştir → ilk tüketim, grant/usedAt üretmez. Yanlış amaç/okuyucu/proje reddedilir. Eşzamanlı public/reader tüketiminde en fazla tek mantıksal sonuç; completed replay ikinci hareket oluşturmaz. Kopyalanmış statik ID fiziksel yoklama kanıtı sayılmaz.

### MOB-08 — Tek, sürümlü ve tipli QR payload sözleşmesi

- **Öncelik / sahip / büyüklük:** P1 · mobil QR + ilgili üretici sahibi · M.
- **Kaynak:** [QR-F01/W01](modules/04-qr.md).
- **Kapsam:** Tek normalize/decode noktası; açık deviceId/deviceSerial alanları; prefix sezgisinin kaldırılması; JSON/Base64, tanıtım etiketi ve çalışan QR'ı için ayrı tip/amaçlar; güvenli tarih parse. Başarı ekranı canonical server bilgilerini kullanır.
- **Bağımlılık:** MOB-00 ve MOB-06 çıktı sözleşmesi.
- **Kabul/test:** Eşdeğer destekli JSON/Base64 aynı sonucu verir; ham seri etiketi ürünce tanımlı mesajla karşılanır. Null/array/bool ID/bozuk tarih/future timestamp kontrollü ele alınır; kayıt sonrasında modal parse hatası yoktur. Gerçek üretici→parser→repository fixture zinciri çalışır.

### MOB-09 — Tek kullanıcı işlemi, idempotency ve belirsiz sonuç uzlaşması

- **Öncelik / sahip / büyüklük:** P1 · backend operasyon + mobil · L.
- **Kaynak:** [HOME-F02/W02](modules/02-home.md), [QR-F04/W04](modules/04-qr.md).
- **Kapsam:** Kullanıcı niyeti boyunca kalıcı requestId; backend tek sonuç; sonuç sorgusu; farklı meşru geçişleri birleştirmeden retry güvenliği. Hızlı işlem busy state'i, modal bitene kadar tarama kilidi ve kod sahneden kalkmadan yeniden silahlandırmama.
- **Bağımlılık:** MOB-05–08 ile operasyon sözleşmesi; MOB-03 oturum sahipliği.
- **Kabul/test:** Aynı ID ile 10 eşzamanlı/ardışık çağrı tek etki ve tek yön değişimi üretir. Commit sonrası yanıt kaybında önceki sonuç bulunur. İlk istek sürerken ikinci dokunma/modal altı tarama yeni işlem açmaz. Sonradan yapılan bilinçli yeni geçiş ayrı işlem olarak çalışır.

### MOB-10 — Olay zamanlı geçmiş, bounded cursor ve bağımsız özetler

- **Öncelik / sahip / büyüklük:** P1 · backend attendance + mobil veri · L.
- **Kaynak:** [AH-F02/F07/W02](modules/03-attendance-history.md), [HOME-F04/W03](modules/02-home.md), [NET-F09/W07](modules/09-network-backend.md).
- **Kapsam:** Mevcut olay-zamanı indeksini değerlendirme; kararlı cursor ve sabit sayfa sınırı; server tarih/cihaz filtreleri; küçük canlı pencere + ayrı arşiv sayfaları; günlük/dönemsel özetin liste penceresinden ayrılması. “Limiti yükseltmek” kesin çözüm sayılmaz.
- **Bağımlılık:** MOB-11 dönem sözleşmesi, MOB-12 hareket uygunluğu, MOB-03 istek sahipliği.
- **Kabul/test:** 150 kayıtlı ayın toplamı scroll ile değişmez; eski sayfada bulunan tek filtre eşleşmesi bulunur. Eski backfill güncel olayı ilk sayfadan çıkarmaz. Eşit zamanlı olaylar kaybolmaz/çoğalmaz. 20 arşiv sayfası yüklemek canlı polling payload'ını 20 kat büyütmez; belge/byte/süre ölçümü kayıt altındadır.

### MOB-11 — Tek iş günü, takvim anahtarı ve vardiya zamanı politikası

- **Öncelik / sahip / büyüklük:** P1 (takvim/dönem bug'ları), P2 (vardiya uyumu) · attendance domain · M/L.
- **Kaynak:** [AH-F01/F03/F06, W01/W04](modules/03-attendance-history.md), [HOME-F05/W04](modules/02-home.md).
- **Kapsam:** Takvim callback'lerinin UTC günleriyle yerel map anahtarlarını ortak yıl/ay/gün anahtarına normalize etme; gün/hafta/ay için `[başlangıç, sonraki başlangıç)`; enjekte saat; cihaz gösterim saati ile iş günü ayrımı; vardiya tabanlı sonuç gerekiyorsa backend çözümleyicisi.
- **Bağımlılık:** MOB-00 zaman kararı. Takvim ve dönem sınırı düzeltmeleri dar alt iş olarak başlayabilir; gece vardiyası anlamı ayrıca kararlaştırılır.
- **Kabul/test:** UTC+3 takvim işareti/liste/detay aynı kayıtlardır. Önceki ayın son günü yeni ay sayılmaz, pazartesi 09:00 haftaya dahildir, tam 00:00 yalnız tek güne girer. 23:00 giriş/01:00 çıkış kararlaştırılmış vardiya anlamıyla kapanır. UTC/Türkiye/DST/gün-ay-yıl sınır fixture'ları kullanılır.

### MOB-12 — Attendance anlamı ve güvenilir ekran durumları

- **Öncelik / sahip / büyüklük:** P1 · mobil home/history · M.
- **Kaynak:** [AH-F04/F08/F09/F10/F11, W03/W05/W06](modules/03-attendance-history.md), [HOME-F03/F06/W06](modules/02-home.md), [DA-F07/F08, W05/W06](modules/10-design-accessibility.md).
- **Kapsam:** Entry/exit/unknown ve granted/denied/unknown; retlerin ham geçmişte gösterilip katılım toplamından ayrılması; loading/başarılı boş/error/stale ayrımı; liste ile komut hata kanallarını ayırma; ID bazlı dinamik cihaz facet'i; saf filtre helper'ı ve güvenli mounted/refresh yüzeyi.
- **Bağımlılık:** MOB-04 hata/DTO; MOB-10/11 tam veri ve zaman sözleşmeleri. Temel lifecycle/helper düzeltmeleri bağımsız yapılabilir.
- **Kabul/test:** İlk veri gelmeden “Henüz Yok” kesin iş sonucu değildir; bilinmeyen yön içeride sayılmaz; ret yeşil başarılı giriş değildir. Boş listede refresh çalışır, debug scroll Provider assertion üretmez, picker/yükleme sırasında logout dispose hatası yaratmaz. Aynı isimli iki cihaz ayrı filtrelenir; sonradan gelen cihaz seçeneklerde görünür.

### MOB-13 — Kamera ve QR token görünümünün lifecycle'ı

- **Öncelik / sahip / büyüklük:** P2 · mobil QR · M.
- **Kaynak:** [QR-F07/F08/F09, W05/W06/W07](modules/04-qr.md).
- **Kapsam:** Resumed + görünür branch + aktif scanner sekmesine bağlı tek kamera state'i; izin yok/kamera yok/kalıcı ret/ayar dönüşü; mounted ve generation guard; TTL metni server sözleşmesinden; consumed/expired/refreshing/refreshFailed ayrımı.
- **Bağımlılık:** MOB-19 branch görünürlüğü; MOB-09 tarama kilidi; MOB-07 tüketim durumu.
- **Kabul/test:** QR'dan ayrılınca kamera ve tarama mutation'ı durur; geri dönünce tek stream çalışır. İzin ayarından dönüş, ekran kilidi ve kamera kesintisi kurtarılır. 60 saniyelik mevcut server TTL ile 10 saniye metin çelişkisi kalmaz; mevcut token varken refresh hatası da görünür. Android/iOS fiziksel cihazla doğrulanır.

### MOB-14 — Hesap/proje kapsamlı cihaz tercihi ve kapı hedefleri

- **Öncelik / sahip / büyüklük:** P2 (tercih), P1 (kapı yetkisi kapsam kaybı) · mobil cihaz + backend · M/L.
- **Kaynak:** [DEV-F01/F05/F06, W01/W04/W05](modules/07-devices.md), [PROFILE-F02/W02/W09](modules/06-profile.md), [HOME-F07/W07](modules/02-home.md).
- **Kapsam:** Employee/proje/backend bağlamlı sürümlü tek tercih; auth değişiminde bellek izolasyonu; legacy kaydı başka hesaba atamama; listeyle yeniden doğrulama ve “tercihi kaldır”; sıralı/atomik kaydetme ve hata görünümü. Kapı bazlı DTO/IO hedefi MOB-05/06 ile birlikte.
- **Bağımlılık:** MOB-03 hesap sınırı, MOB-05 geçerli hedefler; MOB-04 DTO.
- **Kabul/test:** A'nın kapı adı/id'si B altında görünmez/kullanılmaz. Silinmiş/pasif/yetkisi kalkmış seçim açıklamalı düzeltilir; ağ hatası yetki kaldırıldı sanılmaz. İki alan yazımı yarıda kalınca karışık ad/ID oluşmaz; hızlı iki seçimde son doğrulanmış tercih korunur.

### MOB-15 — Tema, erişilebilir navigasyon ve duyarlı bileşenler

- **Öncelik / sahip / büyüklük:** P1 (ana navigation erişimi), P2 (diğer sunum) · mobil UI · M.
- **Kaynak:** [DA-F01–F06, W01–W04/W07](modules/10-design-accessibility.md).
- **Kapsam:** Semantik renk çiftleri; QR dahil adı/rolü/seçili durumu/klavye odağı olan navigation; ikon tooltip/semantics; ilişkili checkbox etiketi; kısa viewport ve büyük metin için scroll/reflow; yerel constraints kullanan QR boyutu, 2×2/dinamik hızlı eylem düzeni.
- **Bağımlılık:** MOB-19 shell davranışı korunur; fiziksel okuyucu minimum QR boyutu MOB-06/13 ile doğrulanır.
- **Kabul/test:** Açık/koyu tema ve normal/büyük metinde gerçek render kontrastı doğrulanır; alt gezinmenin tüm hedefleri TalkBack/VoiceOver ve klavyeyle ad/seçim/aktivasyon sağlar. 320/360 genişlik, landscape, klavye ve %200 yazıda temel işlemler erişilebilir; QR yalnız sığdırmak için okunamaz boyuta küçültülmez. Kaynak kontrast hesabı cihaz QA yerine geçmez.

### MOB-16 — Dil tercihi, hata metinleri ve dinamik metadata

- **Öncelik / sahip / büyüklük:** P2/P3 · mobil yerelleştirme · M.
- **Kaynak:** [L10N-F01–F07, W01–W08](modules/11-localization.md), [PROFILE-F06/W08](modules/06-profile.md).
- **Kapsam:** Sistem/TR/EN tercihi ve kalıcılık; her hata UI sınırında çeviri; modeldeki sabit Türkçe fallback'leri sunuma taşıma; QR tarih anlamı/formatı; EN ICU plural; sürüm/build bilgisini runtime metadata'dan okuma; ARB/generated drift kapısı.
- **Bağımlılık:** MOB-04 hata kodları; MOB-11 zaman politikası; tercih kapsamı MOB-00.
- **Kabul/test:** Dil değişiminde açık ekran/sonradan dialog/datepicker tutarlı; relaunch tercihi korur. EN token/liste/ret hatası teknik veya Türkçe metin göstermez. 0/1/2/1000 adet doğal görünür; kurulu binary sürümü profil ve About'ta aynıdır. Katalogdaki 229 eşleşen mesajın varlığı bütün görünür akışın çevrildiği sayılmaz.

### MOB-17 — Profil, kurtarma, destek ve politika kapsamını tamamla

- **Öncelik / sahip / büyüklük:** P2 · ürün + mobil + gerekirse backend · M; self-service reset/bildirim altyapısı ayrı L.
- **Kaynak:** [PROFILE-F03/F04, W03–W06](modules/06-profile.md), [AUTH-F07/WP07](modules/01-auth.md).
- **Kapsam:** Yönetici kurulum modeli seçilirse gönderilmeyen reset e-postası vaadini kaldırıp gerçek başvuru yolu; önceki hatayı temizleme. Düzenlenebilir kendi profil alanları için dar yetki/API veya dürüst read-only açıklama; gerçek destek/politika içeriği. Bildirim yönetimi ancak gerçek teslimat/OS izin sözleşmesiyle sunulur.
- **Bağımlılık:** MOB-00 self-service alan/rol kararı; MOB-02 reset revocation; MOB-16 metinler.
- **Kabul/test:** Görünür ayar kaydedildi diyorsa gerçek state değişir; destek/politika eylemi gerçek içerik açar. İzin verilmeyen alan/başka employee güncellenemez. Kurtarma güncel ve doğru mesaj gösterir; gerçek reset seçilmediyse gönderim yapılmış izlenimi yoktur. Push teslimi geliştirilmeden bildirim anahtarı işlevsel sayılmaz.

### MOB-18 — Ziyaretçi modülünü ayrı ürün artımı olarak geliştir

- **Öncelik / sahip / büyüklük:** Ürün kapsamı P1/P2; mevcut güvenlik guard alt işi P1 · ürün + backend + mobil · L.
- **Kaynak:** [VIS-F01–F04, W01–W07](modules/05-visitor.md).
- **Kapsam:** Mobil ev sahibi/operatör izin matrisi; employee session'a uygun dar API ve minimal DTO; liste/detail/filter/cursor; ön kayıt, düzenleme, rıza ve sonlandırma; cihaz kabiliyetine göre kart doğrulaması; kayıt ile donanım senkronizasyon sonucu ve fiziksel presence'ın ayrı gösterimi.
- **Bağımlılık:** MOB-00 rol kararı, MOB-05 güvenlik, MOB-04 DTO, MOB-03 state, MOB-16 dil. Mobil placeholder, mevcut web admin endpoint'leri açık hale getirilerek tamamlanmaz.
- **Kabul/test:** Başka ev sahibi/projenin kayıt ve kişisel alanlarına erişilemez. İdari checkOut fiziksel çıkış diye etiketlenmez. IDE'nin kabul etmeyeceği kart DB yazımından önce reddedilir. Panel offline iken “cihaza uygulandı” denmez. Create timeout tekrarında ikinci ziyaretçi oluşmaz; opsiyonel alan temizliği null sözleşmesinde gerçekten uygulanır. Detaylı kabul matrisi VIS raporundadır.

### MOB-19 — Tek bootstrap, deep link geri dönüşü ve kaynak sahipliği

- **Öncelik / sahip / büyüklük:** P2 (startup/link), P3 (DI bakımı) · mobil mimari · M.
- **Kaynak:** [AN-F03/F06/F08, WP03/WP04/WP07](modules/08-architecture-navigation.md), [AUTH-F05/WP05](modules/01-auth.md).
- **Kapsam:** Bootstrap'ı görsel Splash ömründen çıkarıp initializing/authenticated/retryableFailure/unauthenticated state'ine bağlama; bir kez restore; izinli yerel dönüş URI'si; özel şema normalizasyonu, `/`/bilinmeyen rota ve stack'siz seçim ekranı geri hedefi. Composition root'ta aynı client/session store enjeksiyonu; QR repository sınırı; owned notifier/client/router/callback için simetrik kapama.
- **Bağımlılık:** MOB-01, MOB-03, MOB-04; MOB-00 link ve offline doğrulama politikası.
- **Kabul/test:** Geçerli kayıtlı session + soğuk `/history` açılışı bir kez restore edip hedefe devam eder. Offline açılışta görünür retry, ağ düzelince parola gerektirmeden restore sağlar; geçersiz token sonsuz retry'a girmez. `ngsplus://history` ve ürünce desteklenen path biçimi kararla eşleşir. Root kaldırıldığında eski callback/state bildirimi kalmaz; gerçek MyApp/router fake servislerle izole test edilebilir.

### MOB-20 — Doğrulanan ortam ve Android/iOS dağıtım kimliği

- **Öncelik / sahip / büyüklük:** P1 · release sahibi + mobil · M.
- **Kaynak:** [PLAT-F01/F02, WP01/WP02](modules/12-platform-quality.md), [NET-F08/W06](modules/09-network-backend.md).
- **Kapsam:** Android release için onaylı upload key; debug fallback reddi; mevcut yayın varsa update/signer sürekliliği. Açık staging/release ortamı, gerekli URL/şema/host doğrulaması; eksik config ile HTTP başlamaması. iOS archive/export ve dağıtım kimliği doğrulaması. Kamuya açık URL asset olabilir; asset gizli kasa sayılmaz.
- **Bağımlılık:** Mevcut dağıtım kimliğinin release sahibi tarafından belirlenmesi; MOB-19 güvenli başlangıç hata görünümü. Audit yeni anahtar üretmedi veya eski imzayı değiştirmedi.
- **Kabul/test:** Gerçek release paketinin signer'ı beklenen kimliktir; eksik signing bilgisi debug'a düşmez. Eksik/boş/bozuk release URL ile login payload'ı dahil hiçbir HTTP isteği atılmaz. Staging/release hedefi paket kanıtında doğrulanır; Android mevcut sürümden upgrade ve iOS test dağıtımı fiziksel cihazda geçer.

### MOB-21 — SDK/native lock uzlaştırması ve risk odaklı CI

- **Öncelik / sahip / büyüklük:** P2 · mobil platform + CI · M/L.
- **Kaynak:** [PLAT-F03/F04, WP03/WP04/WP09/WP10](modules/12-platform-quality.md).
- **Kapsam:** Seçilmiş Flutter/Dart ve JDK/Xcode/CocoaPods beklentisi; CocoaPods/SPM yönteminin ve native lock/plugin graph'ının uzlaşması; temiz restore/build kanıtı; mobile değişiklikleri için analyze/test/native build kapısı; kritik auth/transport/history/QR kabul testleri. Font/asset ağ bağımlılığının ilk açılışta deterministik olması ayrıca doğrulanır.
- **Bağımlılık:** MOB-20 dağıtım hedefleri; testler her MOB davranışının teslimiyle birlikte eklenir, bu işin sonuna ertelenmez.
- **Kabul/test:** Temiz checkout tanımlı araç zinciriyle beklenmeyen lock diff'i olmadan restore/build olur. Android/iOS plugin registration ve kamera başlangıcı smoke testi geçer. CI 44 mevcut testi ve anlamlı yeni regresyonları çalıştırır; 560/A-B session/takvim/tekrar işlem gibi riskler mock repository sınırının ötesinde doğrulanır. Native lock farkı tek başına mevcut build'in bozuk olduğu diye raporlanmaz; gerçek build sonucu kaydedilir.

### MOB-22 — Desteklenen platform ve izin sözleşmesi

- **Öncelik / sahip / büyüklük:** P2 · ürün + mobil platform · M.
- **Kaynak:** [PLAT-F05/F06, WP05/WP06](modules/12-platform-quality.md).
- **Kapsam:** Android/iOS dışı runner varlığını ürün destek taahhüdünden ayırma; kullanılmayan storage/galeri beyanlarını gerçek yayımlanan akışla uzlaştırma; kamera gerekliliği kararı. macOS desteklenecekse network.client/kamera entitlement/açıklama ve sandbox release doğrulaması; Windows/Linux/web için kabiliyet bazlı QR görünümü.
- **Bağımlılık:** MOB-00 ve MOB-13 QR modu; yeni dosya/export özelliği gerekirse ayrı iş.
- **Kabul/test:** Destek matrisi belgeli; merged manifest/entitlement yalnız gerçek ihtiyaçları içerir. macOS destekleniyorsa imzalı sandbox paket dış ağa ve izinli kameraya erişir; desteklenmiyorsa ürün bunu çalışıyor diye sunmaz. Kamera izni ret/kalıcı ret ve kamerasız hedef kullanıcıyı çıkışsız bırakmaz. Güncel mağaza kurallarına uygunluk ancak yayın aşamasındaki güncel kontrolle sonuçlandırılır.

### MOB-23 — Güvenli üretim teşhisi ve kodla eşleşen dokümantasyon

- **Öncelik / sahip / büyüklük:** P2 · mobil operasyon + dokümantasyon sahibi · M.
- **Kaynak:** [PLAT-F07/F08, WP07/WP08](modules/12-platform-quality.md), [L10N-W07/W08](modules/11-localization.md).
- **Kapsam:** Stack ve runtime sürüm/platform/işlem türünü koruyan güvenli hata hook'u; PII/token/parola/kart/ham response taşımayan redaksiyon; ölçülü crash/network/işlem gözlemi. README'de çalışan kurulum, mevcut/placeholder/planlı kabiliyetler, yönetici hesap kurulumu, ortam ve release adımları.
- **Bağımlılık:** MOB-04 hata kodu/safe diagnostics; MOB-16 runtime metadata; ürün/release destek sözleşmesi.
- **Kabul/test:** Sentetik hata production benzeri build'de temizlenmiş stack ve işlem referansıyla bulunur; testte gövdeye konan hassas işaretleyici telemetry/UI'a çıkmaz. Yeni geliştirici README adımlarını temiz ortamda çalıştırabilir; bulunmayan env.example adımı, ziyaretçi tamamlandı veya kamera yalnız demo gibi çelişkiler kalmaz. Dış telemetry servisi seçimi ve veri politikası ayrıca belirlenir; audit dış sisteme kayıt göndermedi.

## Uygulama ve teslim sırası

| Dilim | Amaç | İşler | Çıkış kanıtı |
|---|---|---|---|
| A | Oturum, tenant ve işlem bütünlüğünü güvenceye al | MOB-00, 01–05; 06/07/09 sözleşmesi ve kritik düzeltmeleri; MOB-20 ortam/imza sınırı | Açık logout-relaunch, 560 expiry, parola revocation, A/B tenant, pasif/saat dışı hedef ve eski yanıt yarışları testleri; doğru hedef/signer |
| B | Yoklama sonucunu doğru ve tekrara dayanıklı hale getir | MOB-06–12, MOB-14 | Tek işlem/tek etki; fiziksel kanıt sınırı; tam dönem özeti; UTC takvim ve sınır tarihleri; filtre/cursor doğruluğu |
| C | Temel mobil akışları erişilebilir ve kurtarılabilir yap | MOB-13, 15–17, 19, 21–23 | Kamera izin/lifecycle; açık/koyu/büyük yazı; ekran okuyucu; TR/EN; gerçek destek/kurtarma; temiz native build ve teşhis kanıtı |
| D | Yeni yetenekleri ve donanım kapsamını tamamla | MOB-18 ve ürünce seçilen gerçek unlock/push/self-service kapsamları | Rol bazlı ziyaretçi E2E, gerçek cihaz marka/firmware matrisi, operasyonel sonuç ve destek akışı |

Bu dilimler sprint veya tarih taahhüdü değildir. Farklı worker'ların P1/P2 sınıfları, aynı kök nedenin bağlamına göre değişebilir; merkezi sahip/iş MOB kartıdır. Özellik tamamlama işi, mevcut güvenlik açığıyla aynı aciliyet varsayımıyla otomatik sıralanmaz.

## Ortak tamamlanma ölçütü

1. Değişen davranışın gerçek tetikleyicisini sınayan regresyon testleri ve ilgili modül kabul kriterleri geçer; yalnız implementation kopyası test yazılmaz.
2. `flutter analyze` ve mevcut testler geçer; sözleşme değişikliğinde mobil/backend iki tarafı birlikte doğrulanır. İlgili backend kodu değişirse proje TypeScript/lint kontrolleri de tamamlanır.
3. Tenant/auth sınırı testlerinde gerçek wrapper/izin politikası devrededir; yalnız guard'ı mock'layan test güvenlik kanıtı sayılmaz.
4. Kamera/kapı/donanım davranışı iddiası ilgili Android/iOS cihaz ve panel sonucu olmadan tamamlandı sayılmaz. Kayıt kaydedilmesi, komut onayı ve fiziksel geçiş kanıtları ayrıdır.
5. Önceden mevcut veriyi dönüştürme gerekiyorsa widen/migrate/narrow ve geriye uyumluluk planı ayrı hazırlanır; audit üretim verisi temizleme yetkisi veya uygulanmış migration değildir.
6. Her teslimde çalışan sürüm/build, ilgili davranış, bilinen sınır ve geri alma yolu kayıtlıdır. Takip edilemeyen “yakında” veya sahte başarıyla iş kapanmaz.
