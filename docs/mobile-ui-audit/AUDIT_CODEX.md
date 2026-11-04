# NGS Plus mobil UI/UX — bağımsız Codex auditi

## 1. Özet

74 PNG tek tek `view_image` ile incelendi; Flutter kaynaklarıyla eşleştirildi (4 Kasım 2026).
Temel akışlar ve açık/koyu tema okunabilir; eski erişilebilirlik auditinin birçok düzeltmesi kaynakta mevcut.
En büyük üç sorun: QR tarama çağrısının kod gösterme sekmesine gitmesi, QR yenilemenin alt gezinmeyle örtüşmesi, ziyaretçi formunda hata/gönderim durumunun ilk görünüm dışında kalması.
Görsel dil; büyük pembe yüzeyler, farklı kartlar ve yüzen gezinme nedeniyle web A2 ailesinden ayrılıyor.
Öneri: nötr zemin, tipografik hiyerarşi, yalnız eylem/seçimde bordo, sabit alan ayıran yerel alt gezinme ve kısa işlem odaklı ekranlar.
Bulgular: **30 adet — Y: 3, O: 24, D: 3**; gerçek cihaz, klavye ve ekran okuyucu doğrulaması yapılmadı.
Kod değiştirilmedi; yalnız bu rapor ve `mockups/codex-home.html` üretildi.

## 2. Yöntem, kapsam ve kanıt sınırı

- PNG kökü `docs/mobile-ui-audit/current/`; aşağıdaki `lib/...:satır` referanslarının kökü `mobile/`.
- Görseller `current/INDEX.md` uyarınca 390×844 mantıksal piksel, DPR 2; uzun görüntüler büyütülmüş içerik tuvalidir, gerçek telefonda bütün içeriğin aynı anda görünmesi anlamına gelmez.
- `*_error_*` ve `*_loading_*` adları tek başına hata görünürlüğünü kanıtlamaz: ziyaretçi formunda bu üç durum ilk görünümde neredeyse aynıdır; kontrol ağacı ayrıca incelendi.
- Sadece login ve home için %130 yazı PNG’si var. Bu ikisinde sarı/siyah overflow şeridi görülmedi; home tek sütuna geçiyor, gezinme etiketleri iki satır oluyor. Diğer ekranlarda %130 taşma yoktur sonucu çıkarılmadı.
- Alt sayfalar (profil kişisel bilgiler, güvenlik, bildirimler, yardım, hakkında, gizlilik), tema/dil seçiciler, gün/kayıt ayrıntısı, ziyaretçi filtresi, tarih/saat seçiciler ve iptal onayları için ayrı PNG yok. Kaynakta varlıkları görüldü; görsel bulgu uydurulmadı. Aşağıdaki yeniden tasarım bölümü bu alt akışların da düzenini tanımlar; görsel kabul için çekim gerekir.
- Koyu profil PNG’sindeki “Açık tema” satırı, testte ThemeData ile provider tercihinin ayrı kurulmasından kaynaklanabilir; üretim hatası olarak sayılmadı. Home güncelleme saatinin hareketlerden önce olması ve geçmişte saat sırasının karışıklığı sentetik veri olabilir; sıralama/zaman hatası ilan edilmedi.
- Durumların erişilebilir anonsu ve 48dp gerçek hit alanı PNG’den ölçülemez. Kaynak minimumları ve semantik tanımları incelendi; görünür buton yüksekliği ile dokunma alanı birbirine eşit varsayılmadı.
- Önceki `docs/mobile-audit/modules/10-design-accessibility.md` bulguları kopyalanmadı: DA-F01 renk çiftleri, DA-F02 gezinme semantiği, DA-F03 login kontrolleri, DA-F07 home veri durumu ve DA-F08 boş geçmiş yenilemesi önemli ölçüde değişmiş. Güncel kaynak: `lib/theme/app_theme.dart:31`, `lib/widgets/app_bottom_navigation.dart:170`, `lib/screens/auth/login_screen.dart:344`, `lib/widgets/cards/attendance_status_card.dart:68`, `lib/widgets/history/history_records_list.dart:48`. DA-F05’in QR yerleşim konusu aşağıda yeni kabukla birlikte görsel olarak yeniden değerlendirildi.

### Görüntü kapsamı: 74/74 açıldı

Her satırdaki adlar `.png` uzantılıdır; **tamamı** tek tek görüntülendi.

| Grup | İncelenen dosyalar |
|---|---|
| Giriş (6) | `login_empty_light`, `login_filled_light`, `login_filled_dark`, `login_error_light`, `login_loading_light`, `login_textscale130_light` |
| Şifre yardımı (2) | `forgot_password_filled_light`, `forgot_password_filled_dark` |
| Açılış (3) | `splash_loading_light`, `splash_loading_dark`, `splash_error_light` |
| Ana Sayfa (7) | `home_empty_light`, `home_error_light`, `home_filled_light`, `home_filled_dark`, `home_loading_light`, `home_long_light`, `home_textscale130_light` |
| Geçmiş (10) | `history_filled_light`, `history_filled_dark`, `history_empty_light`, `history_error_light`, `history_loading_light`, `history_long_light`, `history_overview_light`, `history_calendar_light`, `history_filter_open_light`, `history_filter_open_dark` |
| QR (5) | `qr_filled_light`, `qr_filled_dark`, `qr_error_light`, `qr_loading_light`, `qr_camera_placeholder_light` |
| Kapı kurtarma (2) | `door_recovery_open_light`, `door_recovery_open_dark` |
| Talepler (7) | `requests_filled_light`, `requests_filled_dark`, `requests_empty_light`, `requests_error_light`, `requests_loading_light`, `requests_long_light`, `requests_corrections_light` |
| İzin formu (5) | `request_leave_form_empty_light`, `request_leave_form_error_light`, `request_leave_form_filled_light`, `request_leave_form_filled_dark`, `request_leave_form_loading_light` |
| Düzeltme formu (5) | `request_correction_form_empty_light`, `request_correction_form_error_light`, `request_correction_form_filled_light`, `request_correction_form_filled_dark`, `request_correction_form_loading_light` |
| Ziyaretçiler ve detay (8) | `visitor_empty_light`, `visitor_error_light`, `visitor_filled_light`, `visitor_filled_dark`, `visitor_loading_light`, `visitor_long_light`, `visitor_detail_open_light`, `visitor_detail_open_dark` |
| Ziyaretçi formu (6) | `visitor_form_empty_light`, `visitor_form_error_light`, `visitor_form_filled_light`, `visitor_form_filled_dark`, `visitor_form_loading_light`, `visitor_form_long_light` |
| Profil (3) | `profile_filled_light`, `profile_filled_dark`, `profile_long_light` |
| Kapı seçimi (5) | `select_device_empty_light`, `select_device_error_light`, `select_device_filled_light`, `select_device_filled_dark`, `select_device_loading_light` |

## 3. Önceliklendirilmiş bulgular

Y = temel işi zorlaştıran/görünür erişimi engelleyen; O = belirgin kullanılabilirlik veya tutarlılık sorunu; D = kozmetik. Kaynak çıkarımı olan sonuçlar özellikle belirtilmiştir; bunlar cihazda çalıştırılmış senaryo değildir.

| ID | Öncelik | Ekran | Gözlem | Kanıt: PNG + kaynak | Öneri |
|---|---|---|---|---|---|
| CX-home-02 | Y | Ana Sayfa → QR | “QR kod tara” birincil eylemi `/qr` açıyor, ilk açılışta `TabController` 0 yani “QR Kodum”; kullanıcı taramak için yeniden sekme seçmek zorunda (görsel + kaynak). | `home_filled_light.png`, `qr_filled_light.png`; `lib/screens/home/home_screen.dart:194`, `lib/screens/qr_scan/qr_scan_screen.dart:71` | Tarama eylemini açıkça tarama moduna yönlendir; kod gösterme ayrı, aynı adla tanımlı hedef olsun. |
| CX-qr-01 | Y | QR Kodum | Dolu açık/koyu görünümde “Yenile” düğmesinin altı yüzen gezinmenin altında; sayfa kaydırılabilir olsa da yenileme ilk görünümde tam seçilemiyor. | `qr_filled_light.png`, `qr_filled_dark.png`; `lib/screens/qr_scan/qr_scan_screen.dart:290`, `lib/screens/qr_scan/qr_scan_screen.dart:377`, `lib/screens/main_navigation_shell.dart:100` | Kabuk gövdesine gerçek gezinme alanı ayır, yenilemeyi QR ve sayaçla aynı görünür bölümde tut. |
| CX-visitorform-01 | Y | Ziyaretçi formu | Boş/hata/yükleme çekimlerinde ilk görünüm aynı formu gösteriyor; mutation hatası ve gönderim spinner’ı tüm alanlardan sonra, Kaydet dolu görünümde ekran kenarında kesiliyor. | `visitor_form_error_light.png`, `visitor_form_loading_light.png`, `visitor_form_filled_light.png`, `visitor_form_long_light.png`; `lib/screens/visitor/visitor_form_screen.dart:412`, `lib/screens/visitor/visitor_form_screen.dart:426` | İşlem sonucunu görünür canlı durum alanına taşı, Kaydet’i klavye/güvenli alan uyumlu alt işlem çubuğunda sabitle. |
| CX-home-01 | O | Ana Sayfa | Büyük karşılama, durum kartı ve 112dp+ hızlı işlem kartları ilk görünümü tüketiyor; Taleplerim 390×844’te aşağıda, %130’da kapı kartı bile alt çubuk sınırında. | `home_filled_light.png`, `home_textscale130_light.png`; `lib/screens/home/home_screen.dart:107`, `lib/widgets/cards/quick_action_card.dart:44` | Karşılamayı tek başlığa indir, bugünkü durumu kartsız sun ve kapı/talep/davet işlemlerini kısa satırlara çevir. |
| CX-nav-01 | O | Ana kabuk | QR seçili olmasa da en doygun, gölgeli, 64dp yuvarlak hedef; seçili sekmeyle rekabet ediyor, %130’da “QR İşlemleri” iki satıra çıkıp barı büyütüyor. | `home_filled_dark.png`, `home_textscale130_light.png`; `lib/widgets/app_bottom_navigation.dart:68`, `lib/widgets/app_bottom_navigation.dart:215`, `lib/widgets/app_bottom_navigation.dart:245` | Eşit ağırlıklı beş `NavigationDestination`, kısa “QR” etiketi ve yalnız seçili hedefte bordo kullan. |
| CX-login-01 | O | Giriş | 36sp karşılama, açıklama ve ikinci “Giriş Yap” başlığı formdan önce büyük alan kaplıyor; bordo gradyan ve 28dp kart yarıçapı A2’den farklı ürün hissi veriyor. | `login_filled_light.png`, `login_filled_dark.png`, `login_textscale130_light.png`; `lib/screens/auth/login_screen.dart:116`, `lib/screens/auth/login_screen.dart:188`, `lib/screens/auth/login_screen.dart:269` | Nötr zeminde küçük marka, tek 26sp “Giriş yap” başlığı ve doğrudan alanlar kullan. |
| CX-login-02 | O | Giriş | Odaksız alan kenarlığı açıkta beyaza karşı 1,33:1; koyuda kart zeminine 1,77:1 ve alan dolgusuna 1,53:1; kontur çok silik. | `login_empty_light.png`, `login_filled_dark.png`; `lib/screens/auth/login_screen.dart:238`, `lib/screens/auth/login_screen.dart:250` | Alanların tanınmasını 3:1+ control konturu ve kalıcı görünür label ile güçlendir. |
| CX-login-03 | O | Giriş hata | “Mobil erişiminiz kapatıldı” mesajı var fakat sonraki adım yok; aynı parola formu tek çözüm gibi görünmeye devam ediyor. | `login_error_light.png`; `lib/screens/auth/login_screen.dart:205` | Yerel metinde kurum yöneticisine başvuru ve farklı hesapla giriş seçeneğini belirt. |
| CX-help-01 | O | Şifre yardımı | Yöneticiye iletilecek metinle açıklama aynı gövde stili; üç uzun paragraf ve çok uzun buton etiketi hızlı taramayı zorlaştırıyor. | `forgot_password_filled_light.png`, `forgot_password_filled_dark.png`; `lib/screens/auth/forgot_password_screen.dart:73`, `lib/screens/auth/forgot_password_screen.dart:77` | İki kısa adım, ayrı alıntı alanı ve “Talep metnini kopyala” düğmesi kullan. |
| CX-home-03 | O | Ana Sayfa yükleme | Normal ilk yükleme de hatayla aynı sarı uyarı panelinde; dolu/yükleme/hata arasında kart yüksekliği değişiyor. | `home_loading_light.png`, `home_error_light.png`, `home_filled_light.png`; `lib/widgets/cards/attendance_status_card.dart:170` | İlk yükleme için durum/saat yerini koruyan nötr iskelet, hata için ayrı uyarı kullan. |
| CX-qr-02 | O | QR durumları | “Süre sunucunun bitiş zamanına göre gösterilir” teknik bilgi; dört satırlı açıklama kod yokken de “Bu kodu…” diye devam ediyor. | `qr_filled_light.png`, `qr_error_light.png`, `qr_loading_light.png`; `lib/screens/qr_scan/qr_scan_screen.dart:372` | Duruma özel kısa talimat göster, fiziksel geçişin doğrulanmadığı açıklamayı ilgili sonuç yardımına taşı. |
| CX-door-01 | O | Kapı kurtarma | Görsel “durumu kontrol edin” diyor ama yalnız Kapat var; kaynak kontrol eylemini unresolved koşuluyla saklıyor, kullanıcıya neden yapılamadığı açıklanmıyor. | `door_recovery_open_light.png`, `door_recovery_open_dark.png`; `lib/widgets/door_operation_recovery_dialog.dart:119`, `lib/widgets/door_operation_recovery_dialog.dart:140` | Koşula uygun metin üret; kontrol edilemiyorsa açık sonraki adım, ediliyorsa kapı adıyla “Durumu kontrol et” sun. |
| CX-history-01 | O | Geçmiş kayıtları | Her hareket ayrı yuvarlak kart ve renkli ikon kutusu; aynı gün içindeki hareketler tek akış yerine bağımsız nesneler gibi görünüyor. | `history_filled_light.png`, `history_filled_dark.png`, `history_long_light.png`; `lib/widgets/history/history_record_tile.dart:61`, `lib/widgets/history/history_record_tile.dart:81` | Gün başlığı altında 64–72dp ayırıcılı satırlar ve sabit hizalı saat sütunu kullan. |
| CX-history-02 | O | Geçmiş özet | Üç büyük pembe metrik kutusu bir kartın içinde; giriş sayısı, çıkış sayısı ve gün sayısı eşit görsel ağırlıkta, red/belirsiz sonuçlar altta düz metin. | `history_overview_light.png`; `lib/screens/history/history_screen.dart:547` | Dönem başlığından sonra kartsız metrik dizisi ve metin/ikonlu ayrı istisna özeti kullan. |
| CX-filter-01 | O | Geçmiş filtre sheet | “Cihaz seçenekleri yüklenen kayıtlardan alınır” uygulama içi veri kapsamını teknik dille anlatıyor; kullanıcı tüm kapıları filtrelediğini düşünebilir. | `history_filter_open_light.png`, `history_filter_open_dark.png`; `lib/widgets/history/history_filter_sheet.dart:112` | Başlığı “Bu kayıtlardaki kapılar” yapıp kapsama dair kısa kullanıcı dili kullan. |
| CX-requests-01 | O | Talepler listesi | ISO tarih dizileri ve büyük nötr Chip’ler; “Bekliyor” ve “Onaylandı” görsel kalıbı ziyaretçi/home rozetlerinden farklı. | `requests_filled_light.png`, `requests_filled_dark.png`, `requests_corrections_light.png`; `lib/screens/requests/requests_screen.dart:128`, `lib/screens/requests/requests_screen.dart:212` | Yerel “9–11 Kas 2026” tarih biçimi ve ortak metin+ikon durum rozeti kullan. |
| CX-requests-02 | O | Talepler boş | Tek “Henüz talebiniz yok” cümlesi, uzak alt sağ FAB; hangi talebin oluşturulacağı boş durumun içinde anlaşılmıyor. | `requests_empty_light.png`; `lib/screens/requests/requests_screen.dart:107`, `lib/screens/requests/requests_screen.dart:183` | Seçili sekmeye özel açıklama ve aynı görünür grupta “İzin talebi oluştur” / “Kayıt düzelt” sun. |
| CX-leave-01 | O | İzin formu | Tarihler uzun ISO metinli eylem hapları, not ise altı çizili alan; zorunlu/opsiyonel ayrımı yok ve gönderim adı genel. | `request_leave_form_empty_light.png`, `request_leave_form_filled_dark.png`; `lib/screens/requests/requests_screen.dart:434`, `lib/screens/requests/requests_screen.dart:455` | Tarih seçicileri ortak label/değer alanı yap, notu isteğe bağlı belirt ve “İzin talebi gönder” kullan. |
| CX-correction-01 | O | Düzeltme formu | Boş saat “HH:mm” biçim kodu gibi; Türkiye saati bağlamı ve gerekli gerekçe bilgisi girişten önce gösterilmiyor. | `request_correction_form_empty_light.png`, `request_correction_form_filled_light.png`; `lib/screens/requests/requests_screen.dart:448`, `lib/screens/requests/requests_screen.dart:462` | “Giriş saati seç” ve “Türkiye saati” yardımcı metniyle zorunlu saat/gerekçeyi açıkça işaretle. |
| CX-forms-01 | O | İzin/düzeltme hata | Hata metni tüm alanların sonunda; alan validasyonu da aynı `_validation` alanına düşüyor, ilgili alan/odak bağlantısı kaynakta yok. | `request_leave_form_error_light.png`, `request_correction_form_error_light.png`; `lib/screens/requests/requests_screen.dart:346`, `lib/screens/requests/requests_screen.dart:465` | Alan hatasını ilgili `FormField` altında, ağ hatasını form banner’ında gösterip ilk geçersiz alana odaklan. |
| CX-visitor-01 | O | Ziyaretçiler | Arama sonrası başlık+üç büyük toplam hücresi; yalnız iki kayıt varken bile ilk davet ekranın yaklaşık orta yüksekliğinde başlıyor. | `visitor_filled_light.png`, `visitor_long_light.png`; `lib/screens/visitor/visitor_screen.dart:270`, `lib/widgets/visitor/visitor_cards.dart:133` | Özeti tek metin satırına indir, arama/filtre sonrası doğrudan davet listesini başlat. |
| CX-visitor-02 | O | Ziyaretçiler hata | Görsel “önceki kayıtlar gösteriliyor” diyor ama hiçbir kayıt görünmüyor; kaynak yalnız `loaded` kontrol ediyor, önceki listenin boş olmasını ayırmıyor. | `visitor_error_light.png`; `lib/screens/visitor/visitor_screen.dart:289` | Boş önceki sonuç ve dolu eski liste için farklı yerel hata metni kullan. |
| CX-visitor-03 | O | Ziyaretçiler boş | Boş durum kullanıcıyı “sağ üstteki Ekle”ye tarifle gönderiyor; yakın bir eylem yok ve hedef tek elle erişimin uzak bölgesinde. | `visitor_empty_light.png`; `lib/screens/visitor/visitor_screen.dart:324`, `lib/screens/visitor/visitor_screen.dart:150` | Boş durum altında doğrudan “Ziyaretçi davet et” düğmesi sun. |
| CX-visitorform-02 | O | Ziyaretçi formu | Pembe dolgu/soluk kontur alanların sınırını zayıflatıyor: açık kontur 1,29:1, koyu 1,40:1; talep formuyla tamamen farklı alan dili. | `visitor_form_empty_light.png`, `visitor_form_filled_dark.png`; `lib/screens/visitor/visitor_form_screen.dart:537`, `lib/screens/visitor/visitor_form_screen.dart:548` | Nötr dolgulu, 3:1+ konturlu ortak `AppTextField` kullan. |
| CX-visitordetail-01 | O | Davet detayı | Adın ardından fiziksel konum ve cihaz senkronizasyonu ziyaret saatinden önce geliyor; düzenle/iptal aynı bordo dilinde, detay tek metin yığını. | `visitor_detail_open_light.png`, `visitor_detail_open_dark.png`; `lib/widgets/visitor/visitor_detail.dart:97`, `lib/widgets/visitor/visitor_detail.dart:105`, `lib/widgets/visitor/visitor_detail.dart:148` | Ad/durum/tarih/amaç sırasını kullan, teknik ayrıntıyı açılır bölüme ve iptali danger tonuna taşı. |
| CX-profile-01 | O | Profil | Avatar+kimlik kartı yaklaşık 324dp; tema/dil/kapı dışında ayarlar, destek ve çıkış uzun kaydırmada kalıyor. | `profile_filled_light.png`, `profile_long_light.png`; `lib/screens/profile/profile_screen.dart:73`, `lib/screens/profile/profile_screen.dart:82` | Kimliği 72–96dp yatay özet yap, ayarları düz gruplanmış satırlara indir. |
| CX-device-01 | O | Kapı seçimi boş | Üstte “yeni bir hedef seçin”, altta “erişiminiz olan kapı yok”; yerine getirilemeyen talimat ve büyük boş alan var. | `select_device_empty_light.png`; `lib/screens/settings/select_device_screen.dart:168`, `lib/screens/settings/select_device_screen.dart:227` | Tek boş durum içinde erişimin değiştiğini açıklayıp Yenile ve kurum yöneticisine başvuru adımını göster. |
| CX-splash-01 | D | Açılış hata | Hata oluştuğunda da ana başlık “NGS Plus başlatılıyor”; gerçek durum alt metinde kalıyor. | `splash_error_light.png`; `lib/screens/splash_screen.dart:39` | Hata başlığını “Oturum doğrulanamadı” yap. |
| CX-home-04 | D | Ana Sayfa uzun | İşle ilgisiz günün sözü, kalın sol çizgi ve emoji etiketi; testte emoji eksik glif olarak görünüyor (cihaz glif hatası kanıtı değil). | `home_long_light.png`; `lib/screens/home/home_screen.dart:383`, `lib/screens/home/home_screen.dart:423` | Bu alanı kaldır, yerini gerekiyorsa son harekete ayır. |
| CX-device-02 | D | Kapı seçimi dolu | Seçili kapının köşeleri dikdörtgen, seçili olmayan kart yuvarlak; seçim şekli değiştirmiş gibi görünüyor. | `select_device_filled_light.png`, `select_device_filled_dark.png`; `lib/screens/settings/select_device_screen.dart:254`, `lib/screens/settings/select_device_screen.dart:261` | Aynı satır şeklini koruyup seçimi zemin+tık işaretiyle göster. |

### Ortak durum ve etkileşim değerlendirmesi

- **Yükleme:** home sarı panel, geçmiş/talep/QR spinner, ziyaretçi çizgi, kapı sayfa ortası spinner. Bunlar işlev yokluğu değildir; aynı veri yükleme işine farklı yerleşimler verir. İlk yüklemede gerçek içerik yerini tutan 3–5 nötr iskelet satır; yenilemede mevcut veri+ince ilerleme; komutta düğme içi spinner+“Gönderiliyor” önerilir. QR için sahte taranabilir iskelet üretmeyin, nötr kare ve metin kullanın. Splash spinner’ı uygundur.
- **Çevrimdışı:** incelenen hata PNG’lerinde bağlantı sebebi ve retry çoğunlukla var. Bunlar tam offline ürün modu kanıtı değil. Başarılı boş, hiç yüklenmemiş ve eski veri ayrı tutulmalı; son başarılı Türkiye saati ve hangi eylemin yeniden denenebileceği belirtilmeli. Kapı komutunda otomatik yeniden gönderim eklenmemeli; mevcut aynı-istek kurtarma koşulları korunmalı.
- **Semantics:** ana gezinme `lib/widgets/app_bottom_navigation.dart:170`, hızlı eylem `lib/widgets/cards/quick_action_card.dart:30`, geçmiş satırı `lib/widgets/history/history_record_tile.dart:69`, gün kayıt sayısı `lib/widgets/history/history_calendar.dart:118` açık tanımlı. Renk dışı durumlar metin, ikon veya seçim işaretiyle destekleniyor. Özel wrapper yok diye standart Material kontrolleri erişilemez sayılmadı. QR hata/sayaç ve form mutasyon mesajlarında gerçek cihaz anonsu doğrulanmalı; sayaç her saniye duyurulmamalı.
- **Dokunma:** Elevated/TextButton minimum 48dp (`lib/theme/app_theme.dart:122`, `:132`), gezinme minimum 48×52dp (`lib/widgets/app_bottom_navigation.dart:199`), hızlı kart min 48×112dp. Filled/Outlined/IconButton için uygulama geneli aynı açık sözleşme yok; Material'ın genişletilmiş hit alanı nedeniyle PNG’de 40/44dp görünen düğmelere doğrudan ihlal yazılmadı. Geçmiş takviminde 390dp görünümde yedi sütun yaklaşık 51dp; 320dp genişlik ayrıca ölçülmeli.
- **Klavye:** login `next/done`, autofill, drag ile kapatma içeriyor (`lib/screens/auth/login_screen.dart:140`, `:311`, `:336`). Ziyaretçi ve talep formları kaydırılabilir; “klavye kesin kapatıyor” iddiası yok. Form alanlarında tutarlı next/done ve ilk hata odağı; son eylemde viewInsets+SafeArea kabul testi gerekir.
- **Geri bildirim/onay:** şifre kopyalama ve ziyaretçi kaydında snackbar var; talep geri çekme ve davet iptalinde onay mevcut (`lib/screens/requests/requests_screen.dart:53`, `lib/widgets/visitor/visitor_detail.dart:152`). Bu onaylar kaldırılmamalı; nesne adı ve sonuç içermeli. Haptic çağrısı taranan UI kaynaklarında bulunmadı; eklenirse gerçek başarı/başarısızlığın metinsel sonucunu tamamlasın, fiziksel geçişi doğruluyor gibi davranmasın.
- **Uzun liste:** geçmiş ve kapı seçimi lazy sliver kullanıyor (`lib/widgets/history/history_records_list.dart:117`, `lib/screens/settings/select_device_screen.dart:245`); ziyaretçi `for` ve talepler `map.toList()` ile mevcut yüklü öğeleri kuruyor (`lib/screens/visitor/visitor_screen.dart:352`, `lib/screens/requests/requests_screen.dart:124`). 2–6 kayıt içeren “long” PNG’ler performans testi değildir; aynı bileşene geçerken 100+ yüklü öğede builder/sliver ve pagination korunmalı, profiler ile ölçülmeli.
- **İyi örnek:** kamera izin yer tutucusu açık sebep+“Ayarları aç” sunuyor (`qr_camera_placeholder_light.png`; `lib/screens/qr_scan/qr_scan_screen.dart:508`); bu ekrana zoraki problem eklenmedi.

## 4. Ortak kök nedenler

| Tür | Eksik sözleşme | Kaynak / etkisi |
|---|---|---|
| Token | Marka rengi rol ve tema ayrımına tam taşınmamış | `primaryBurgundy` #800020, ikinci bordo #9E1B3B, seed’den çıkan primary ve login/nav özel tonları; A2 #7a1f1f ile ortak tek tanım yok. |
| Token | Kontur/dekoratif ayırıcı ayrımı | Formlarda `outlineVariant` alfa ile kullanılıyor; dekoratif çizgi ölçüsü kontrol sınırına uygulanıyor. |
| Token | Tipografi/radius/elevation | Ortak Card elevation 2, login 28 radius+özel gölge, nav blur 24, ziyaretçi elevation 0; metrik ve form türleri farklı. |
| Bileşen | Tek durum rozeti | Home `_StatusBadge`, visitor `VisitorStatusBadge`, talepler `Chip`, history renkli başlık. |
| Bileşen | Tek veri durumu sunumu | `_DataNotice`, HistoryRecordsList, talepler `_list`, ziyaretçi koşulları, kapı SliverFillRemaining ayrı kalıplar. |
| Kalıp | Gövde/alt gezinme/safe inset sahipliği | `extendBody:true` ve her branch’in ayrı Scaffold/scroll padding kararı; CTA görünürlüğü branch’e bırakılmış. |
| Kalıp | Ortak form ve tarih alanı | Login özel InputDecoration, talepler varsayılan underline+pill, ziyaretçi dolgu+kart; alan hata eşlemesi farklı. |
| Kalıp | Kullanıcı dili / durum dili | ISO tarih, HH:mm placeholder, teknik sunucu/senkronizasyon açıklamaları; görsel öncelik kullanıcı işine göre verilmemiş. |

`AppSpacing` 4/8/12/16/24/32 ve 480/720 sınırları zaten var; yeniden icat edilmeli değil, tüketimi yaygınlaştırılmalı. `AppBreakpoints` 600/1024 genişliği tarif ediyor; kritik satır kırılması ise `LayoutBuilder` ile **içeriğe kalan genişlik** üzerinden olmalı. ResponsiveCardGrid’in metin ölçeği uyarlaması korunmalı; büyük kartları küçültmeden sadece sütun sayısını artırmak çözüm değildir.

## 5. Kontrast hesabı ve önerilen mobil tasarım sistemi

### Hesap yöntemi

JavaScript/Python ile sRGB bağıl parlaklık hesabı uygulandı: kanal `c=byte/255`; `c≤0.04045` ise `c/12.92`, aksi durumda `((c+0.055)/1.055)^2.4`; `L=0.2126R+0.7152G+0.0722B`; oran `(Lmax+0.05)/(Lmin+0.05)`. Tablolar iki ondalığa yuvarlanır; kabul yuvarlanmamış oranla yapılır. Alfa varsa önce sRGB üzerinde `α×ön+(1−α)×arka` bileştirilir.

Normal metin hedefi ≥4,5:1, büyük metin ≥3:1; alan tanımlayan kontrol sınırı hedefi ≥3:1. Dekoratif ayırıcılar ve devre dışı bileşenler aynı eşiğe zorlanmaz. Konturu zayıf bir alanın etiketi/diğer işaretleri varsa yalnız kontur hesabı tüm kontrolün kesin WCAG ihlali olduğu anlamına gelmez; CX-login-02 ve CX-visitorform-02 bu yüzden kullanılabilirlik bulgusudur. [W3C kontrast açıklaması](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) ve [Flutter erişilebilirlik kontrol listesi](https://docs.flutter.dev/ui/accessibility) referans alındı; bu rapor uyumluluk sertifikası değildir.

Mevcut ziyaretçi PNG’lerinin düz renkleri Python standart kütüphanesi PNG/zlib çözümlemesiyle kontrol edildi; anti-alias kenar örnekleri alınmadı. Açık alan `#fff0f0`, kontur `#e7d4d4`; koyu alan `#221919`, kontur `#3f3232`. Bunlar kaynakta yarı saydam outlineVariant kullanımının render sonucudur.

| Mevcut çift (ön / arka) | Oran | Yorum |
|---|---:|---|
| Login kontur #e5dde1 / beyaz | 1,33 | Silik; alan dolgusu #f8f5f6 karşısında 1,23. |
| Login koyu kontur #51404a / #211a20 | 1,77 | Alan dolgusu #30252c karşısında 1,53. |
| Ziyaretçi kontur #e7d4d4 / #fff0f0 | 1,29 | Dış beyaz yüzeye karşı 1,42. |
| Ziyaretçi koyu kontur #3f3232 / #221919 | 1,40 | Dış #1e1e1e yüzeye karşı 1,36. |
| Home/visitor başarı #14532d / #dcfce7 | 8,30 | Mevcut durum metni AA hedefini geçiyor. |
| Home/visitor uyarı #713f12 / #fef3c7 | 7,79 | Mevcut durum metni AA hedefini geçiyor. |
| Koyu başarı #b7f5cd / #123b29 | 10,07 | Korunabilir erişilebilir çift. |
| Koyu uyarı #ffe0a3 / #49320b | 9,43 | Korunabilir erişilebilir çift. |

### Renk token’ları

A2’nin sakin nötr ailesi mobilde sürer; webdeki 42px tablo satırı veya 11px rozet metni doğrudan kopyalanmaz. Koyu temada bordo zeminli buton beyaz yazıyla korunabilir; bordo **metin** koyu zemin üzerine konmaz, açık marka tonu kullanılır.

| Token / kullanım | Açık | Koyu | Kontrast (açık / koyu) |
|---|---|---|---|
| canvas | #fcfcfc | #181817 | Zemin, tek başına oran aranmaz. |
| surface / subtle | #ffffff / #f3f3f2 | #20201e / #2a2a27 | Yüzeyler; durum taşımaz. |
| text | #252523 | #f3f3f0 | canvas üzerinde **14,97 / 15,98** |
| muted | #646461 | #b8b8b2 | surface üzerinde **5,94 / 8,19** |
| primary fill / onPrimary | #7a1f1f / #ffffff | #7a1f1f / #ffffff | Buton metni **10,28 / 10,28** |
| accent text / focus | #7a1f1f | #e7b3ad | surface üzerinde **10,28 / 8,90** |
| selected / onSelected | #f8eeee / #7a1f1f | #3a2827 / #e7b3ad | **9,03 / 7,57** |
| control | #858582 | #9a9a93 | surface üzerinde **3,70 / 5,76**; açık subtle üzerinde **3,33** |
| line | #e2e2e0 | #3c3c37 | Yalnız dekoratif 1dp ayırıcı; input sınırı değil. |
| success fg / bg | #356047 / #edf4ef | #bbdcc6 / #21362a | **6,44 / 8,71** |
| warning fg / bg | #795619 / #faf3e5 | #eacd97 / #3d321d | **6,02 / 8,18** |
| danger fg / bg | #963e36 / #faefed | #f0bbb5 / #422927 | **6,13 / 7,91** |
| info fg / bg | #3b5c76 / #edf2f7 | #b7d3e8 / #253440 | **6,26 / 8,21** |

Koyu bordo düğmenin karanlık yüzeye sınırı zayıf kalırsa açık accent konturu eklenir; okunur buton metni tek başına sınır görünürlüğü garantisi değildir. Focus: 2dp accent + 3dp boşluk. Disabled için ayrı tema state çözümlemesi, yalnız opaklığı rastgele azaltma yok.

### Ölçek ve yüzey politikası

- Sistem fontu: Android Roboto, iOS sistem fontu; `TextTheme` üzerinden. Sayfa başlığı 26sp/32 satır, bölüm 18/24 semibold, satır başlığı 16/22 medium, gövde 15/22, yardımcı 13/18, gezinme 12/16, saat 24/30 semibold tabular. Ekranda aynı anda 3–4 anlamlı boyut; 36sp karşılama yok.
- `AppSpacing`: 4/8/12/16/24/32dp; sayfa kenarı 16–20, bölüm arası 24, label/alan arası 8, ilişkili satır arası 12. Metin büyüdükçe min yükseklik büyür; sabit height ile metin sıkıştırılmaz.
- Radius: input/buton 8dp, nadir bütünlüklü panel 12, rozet 4, sheet üst köşe 20, avatar daire. Yerel sheet’in rahat tutuşunu web 8px diyaloga zorlamayın.
- Elevation: sayfa/kart/buton/nav **0**; 1dp ayırıcı. Modal katmanda scrim ve gerekirse tek hafif elevation 2; blur/glow/gradyan yok. Durum renkleri küçük rozet veya gerekli hata alanında; normal bilgi pembe panel değil.
- Eylemler: bir birincil eylem, min 48×48dp ve tercihen 52–56dp yüksekliği; ikon 20–24dp. Görsel min-height ile tap alanı ayrı ölçülür. Buton etiketi büyürse yükseklik artar.

### Flutter bileşen envanteri

Yeni adlar öneridir; bu audit içinde kod oluşturulmadı. `ColorScheme` standart roller, `ThemeExtension<AppUiTokens>` semantik çiftler/çizgi/control/radius; `TextTheme` tipografi ve mevcut `AppSpacing` boşlukların tek kaynağı olsun.

| Bileşen | Flutter karşılığı / sözleşme | Yerine geçeceği mevcut yapı |
|---|---|---|
| AppScaffold + AppPageHeader | `Scaffold`, `SafeArea`, AppBar/SliverAppBar; gövde nav üstünde, tek inset sahibi, başlık semantics | MainNavigationShell `extendBody`, ekranların farklı header/padding yapıları; home `_buildHeader` |
| AppStatusBadge | `ThemeExtension` tone çifti + Wrap/Row + metin/isteğe bağlı ikon | Home `_StatusBadge`, VisitorStatusBadge, requests Chip |
| AppListRow | Material+InkWell/ListTile, min 64dp, genişleyen alt metin, birleşik ad/rol | HistoryRecordTile dış kartı, VisitorRecordCard, profile `_tile`, kapı seçim Card |
| AppEmptyState | Başlık+sebep+tek yerel eylem, scrollable içerik | HistoryRecordsList empty, requests `_list`, visitor empty, kapı SliverFillRemaining empty |
| AppDataNotice | info/warning/error, önceki veri bağlamı, retry, seçici liveRegion | `_DataNotice` ve dağınık liste/form hata metinleri |
| AppSkeleton | İçerikle aynı ölçülü nötr bloklar, tek semantics label; reduced motion’da sabit | İlk yükleme spinner/çizgi ile boşalan liste alanları |
| AppPrimaryButton + AppFormActionBar | `FilledButton`, min 52dp, busy metni+spinner, SafeArea ve klavye inset | QR yenileme, request submit, visitor save; ElevatedButton/özel login düğmesi |
| AppSheet | `showModalBottomSheet`, showDragHandle, başlık/kapat, Flexible scroll, sabit alt eylem | HistoryFilterSheet ve VisitorDetail ortak kabuğu; profil seçim diyalogları |
| AppSegmentControl | `SegmentedButton` veya semantik TabBar; 48dp+, metin ölçeğinde kaydırılabilir | History özel kutulu TabBar, QR ikonlu yüksek TabBar, requests TabBar |
| AppBottomNavigation | `NavigationBar` + beş `NavigationDestination`, label 12sp; nav yüksekliği gövdeden düşülür | AppBottomNavigation blur, büyük QR dairesi ve gölge |
| AppTextField / AppDateTimeField | `TextFormField` + InputDecorationTheme; readOnly tarih alanı, yerel format, errorText | Login fieldDecoration, requests TextField/pill tarih, visitor `_field`/`_dateButton` |
| AppDoorAction / AppDoorResult | Kapı adı+yer+eylem, pending/confirmed/unknown metni; haptic isteğe bağlı | QuickActionCard kapı varyantı, DoorCommandStatusCard ve kurtarma diyaloğu sunumu |

## 6. Ekran bazında yeni düzen (üstten alta)

### Açılış

1. Nötr canvas ve küçük marka; iki temada aynı yerleşim.
2. “Oturum kontrol ediliyor” başlığı ve tek anlamlı ilerleme anonsu.
3. Hata olursa başlık+yerel sebep, eski loading metnini kaldır.
4. “Yeniden dene”, ardından “Giriş ekranına dön”; destek metni en altta.

### Giriş

1. Küçük NGS Plus marka satırı, 26sp “Giriş yap”.
2. Tek kısa kurum hesabı açıklaması; sonlanmış erişim uyarısı varsa eylemiyle burada.
3. Kalıcı etiketli e-posta/şifre; görünürlük kontrolü ≥48dp, next/done ve autofill korunur.
4. “E-postamı hatırla” tek birleşik kontrol.
5. 52dp “Giriş yap”, busy sırasında metin+spinner; alan hataları kendi altında.
6. “Şifre yardımı” metin düğmesi; ekran ve klavye kaydırması korunur.

### Şifre yardımı

1. Geri + “Şifre yardımı” başlığı.
2. “Şifrenizi kurum yöneticiniz yeniler” kısa açıklaması.
3. İki adım: talebi ilet, gelen bağlantıyla şifreni oluştur.
4. Seçilebilir örnek mesaj ve “Talep metnini kopyala”; kopyalama sonucu snackbar.
5. “Girişe dön”; e-posta gönderildiği yönünde sahte başarı yok.

### Ana Sayfa

1. Küçük marka/kullanıcı satırı; “Bugün” ve Türkiye tarihini göster.
2. “Yoklama durumu” + küçük metin/ikon rozeti; son giriş/çıkış iki hizalı sütun.
3. Son başarılı güncelleme; eski veride uyarı ve retry bu alanın içinde.
4. Tam genişlik “QR kod tara” doğrudan tarama moduna gider.
5. Nötr konturlu kapı satırı: “Kapıyı aç”, seçili kapı/yer; kapı değiştirme bağlamsal sheet’te.
6. Taleplerim ve Ziyaretçi davet et kısa satırları; bekleyen sayı yalnız gerçek veriden.
7. Kısa son hareket ve beş eşit alt gezinme hedefi; günün sözü yok.

Mockup: [codex-home.html](mockups/codex-home.html), 390px, harici kaynak yok; sentetik Türkçe veri, 13:05 güncelleme ve 13:00 son hareket tutarlı. “1 bekleyen” ve son hareket önerilen içeriktir; mevcut home veri sözleşmesine ek bağlantı gerekebilir. HTML statiktir; butonlar gerçek kapı/QR işlemi yapmaz.

### Geçmiş — kayıtlar

1. “Geçmiş” başlığı, bilgi ve yenile ikonları erişilebilir adlarıyla.
2. Kayıtlar / Takvim / Özet tek segment kalıbında.
3. Filtre düğmesi + varsa kısa aktif kapsam; Türkiye saati yardımcı etiketi.
4. Gün başlığı, altında yön+kapı+tabular saat ve açık ret/unknown metniyle satırlar.
5. Boşta sebep+Yenile/filtre temizle; ilk yüklemede liste iskeleti.
6. Lazy liste ve ayrı yükle-daha-fazla hatası; alt gezinme üstünde son satır boşluğu.

### Geçmiş — takvim

1. Ortak başlık ve segmentler.
2. Mevcut desteklenen ay + “Türkiye saati”; olmayan ay gezinmesi vaat edilmez.
3. Yedi sütunlu min 48dp hedefler; büyük yazı/dar genişlikte alternatif gün listesi.
4. Bugün çerçeve, seçili gün dolgu, kayıt sayısı semantics; renk dışı işaretler korunur.
5. “Bir gün seçerek kayıtları görüntüleyin”; seçim kayıtlar sekmesine taşıyorsa geçiş duyurulur.

### Geçmiş — özet

1. Ortak segmentler, Bu ay / Bu hafta seçimi.
2. Yerel başlangıç/bitiş tarihi ve kartsız 3 metrik satırı.
3. Reddedilen/belirsiz sayısı küçük ikon+metinle ayrı bölüm.
4. Güncellik ve stale uyarısı; veri yokken sıfır başarı sayısı üretilmez.
5. Alt gezinme normal konumunda; sayfa sadece raporlama işini yapar.

### Geçmiş — filtre sheet

1. Tutamak, “Filtrele”, 48dp Kapat.
2. Seçili tarih/“Tüm tarihler”; date picker açılımı.
3. “Bu kayıtlardaki kapılar” ve tek seçim listesi; uzun liste kaydırılabilir.
4. Alt sabit alanda “Temizle” ve “Filtreleri uygula”; kapatınca taslak seçim uygulanmaz.

### QR — kod gösterme

1. “QR” başlığı ve “Kodumu göster / Tara” kısa segmentleri.
2. Nötr merkez alanında beyaz quiet zone’lu gerçek QR; mevcut okuyucu boyutu fiziksel test olmadan küçültülmez.
3. “44 sn geçerli” metni ve süre göstergesi; aralıklarla gerekli anons.
4. “Bu kodu okuyucuya gösterin” tek cümle; süre sonu/kullanıldı/hata durumuna özgü metin.
5. Görünür “Yeni kod oluştur/Yenile”; kod hatasında sebep+retry aynı yerde.
6. Fiziksel geçiş açıklaması bilgi detayında; alt nav içerik örtmez.

### QR — tarama/kamera

1. Ortak QR segmenti, Ana Sayfa tarama eylemi bu segmenti seçer.
2. Kamera alanı ve kısa çerçeve talimatı; uzun metin önizlemeyi kaplamaz.
3. İzin yoksa mevcut iyi kalıp: neden+İzin ver/Ayarları aç; nötr yer tutucu.
4. Flaş/kamera değiştir ≥48dp; toggle durumu semantikte, cihaz yeteneğine göre etkin.
5. İşlem sürüyor overlay’i ve gerçek sonuç metni; tekrar algılama/kurtarma sözleşmesi korunur.

### Kapı işlem kurtarma

1. Sheet/diyalog başlığı: “Kapı işlemi”; kapı adı ilk bağlam satırı.
2. Sonuç rozeti: Bekliyor / Doğrulandı / Başarısız / Sonuç bilinmiyor.
3. Duruma özel kısa anlam; doğrulanan komut ile fiziksel geçiş ayrımı korunur.
4. “Durumu kontrol et”; aynı istek yeniden gönderme yalnız mevcut güvenli koşul sağlanınca ayrı eylem.
5. Koşul sağlanmıyorsa neden ve sonraki adım, ardından Kapat; genel metinle olmayan eylemi tarif etme.

### Talepler

1. Geri+Taleplerim; İzin / Kayıt düzeltme segmenti.
2. Gerekirse bekleyen sayısını küçük nötr özet satırında göster.
3. Tarih+talep türü+ortak durum rozeti; uzun gerekçe ve karar notu ayrıntıda.
4. Bekleyende Geri çek bağlamsal eylemi; ad/tarih içeren açık onay.
5. Boşta ilgili talep türüyle açıklama ve oluştur eylemi; hata+retry aynı kalıp.
6. Alt sabit “İzin talebi oluştur” veya “Kayıt düzelt”; listede eylem örtüşmesi yok.

### İzin formu

1. Geri+“İzin talebi”; gerekirse değişiklikten vazgeçme onayı.
2. İzin türü ortak select alanı.
3. Başlangıç ve bitiş yerel tarih alanları; aralık hatası ilgili alanda.
4. “Not (isteğe bağlı)” ve karakter sayacı; kısa yardımcı örnek.
5. Gönderim hatası görünür banner, ilk alan hatasına odak.
6. Klavye üstünde/güvenli alanda “İzin talebi gönder”; pending çift gönderimi engeller.

### Kayıt düzeltme formu

1. Geri+“Kayıt düzeltme”; kısa hangi kayıt için açıklama.
2. Giriş / Çıkış / İkisi seçimi, tarih alanı.
3. Türkiye saati etiketiyle gerekli saat seçicileri; HH:mm yerine seçim çağrısı.
4. Gerekçe zorunlu, örnek+300 karakter sayacı.
5. Alan bazlı hata ve bağlantı için ayrı banner.
6. “Düzeltme talebi gönder”; sonucu belirsiz isteklerde mevcut tekrar koruması sürer.

### Ziyaretçi listesi

1. “Ziyaretçiler” başlığı; oluşturma eylemi kolay erişilen konumda.
2. Arama+filtre, aktif filtrelerin açık metni.
3. “2 davet, 1 aktif, 1 aktivasyon bekliyor” gibi tek nötr satır; tüm davet kapsamı açık.
4. Ad, yerel ziyaret aralığı, ortak durum rozetiyle kısa liste satırları.
5. Boşta yakın “Ziyaretçi davet et”; stale-boş/dolu farklı metin, retry.
6. Lazy sayfalama ve gerçek sonuç sınırı; alt nav için ayrılmış alan.

### Ziyaretçi detay sheet

1. Tutamak+ad+Kapat; altta ortak durum rozeti.
2. Ziyaret başlangıç/bitişi ve Türkiye saati.
3. Amaç, telefon, not; eksik değerde boş etiket yerine “Eklenmedi”.
4. “Erişim ayrıntıları” açılımı: konum bilinmiyor, cihaz senkronizasyonu; iddia güçlendirilmez.
5. Düzenle ve danger tonlu Daveti iptal et; iptal onayı isim/tarih/sonucu belirtir.
6. Gerekli bilgilendirme belgesi erişilebilir bağlantı/seçilebilir içerikle ayrı bölüm.

### Ziyaretçi formu

1. “Ziyaretçi davet et” veya “Daveti düzenle”; aktivasyon gereksinimi tek kısa bilgi satırı.
2. Ad ve soyad 390dp’de gerekirse tek kolon; kalıcı label ve sıradaki alana geçiş.
3. Telefon isteğe bağlı; amaç zorunlu; alanlar nötr dolgu/okunur kontur.
4. Başlangıç/bitiş ortak tarih-saat alanı ve Türkiye saati bağlamı.
5. Not ve gerekiyorsa bilgilendirme onayı; mevcut iş kuralları korunur.
6. Üstte görünür gönderim/sonuç alanı; alan validasyonu yerinde, sonuç belirsizliği ayrı anlatılır.
7. Alt sabit Kaydet/Davet oluştur; klavye açıkken erişilir, spinner yanında işlem metni kalır.

### Profil

1. Başlık+yardım; yatay 48dp avatar, isim, proje, e-posta özeti.
2. Kişisel bilgiler satırı; profil ayrıntısına gider.
3. Tema, Dil, Hızlı erişim kapısı; seçim değeri sağda/ikinci satırda.
4. Güvenlik ve Bildirimler düz liste grubu.
5. Yardım, Hakkında, Gizlilik ikinci grup; Çıkış yap ayrı danger satırı ve onay.
6. Tema/dil sheet’leri aynı tek seçim kalıbı, değişiklik sonrası doğru selected anonsu.

### Profil bilgi alt sayfaları (PNG eksik; öneri)

1. Geri+sayfa adı; düz, kaydırılabilir içerik.
2. Kişisel bilgilerde etiket/değer; güvenlikte mevcut şifre yardım eylemi.
3. Bildirimler/yardım/gizlilikte yalnız gerçekten sunulan işlem ve belge; çalışmayan ayar taklidi yok.
4. Hakkında sürüm/derleme en altta; uzun metin 15sp/22, linkler ≥48dp etkileşim alanı.

### Kapı seçimi

1. Geri+“Hızlı erişim kapısı”; bunun tercih seçimi olduğu kısa açıklama.
2. Kapı/konum arama; gerekirse “Seçimi kaldır” ikincil eylemi.
3. Konum+kapı adlı tek seçim satırları; şekil sabit, seçili zemin ve tık işareti.
4. Kayıt sırasında satırda ilerleme ve başarı geri bildirimi; başarılı seçim önceki ekrana döner.
5. Yetki kalktı/kapı yok/arama eşleşmedi durumlarını birbirinden ayır; ilk ikisinde uygulanabilir retry/destek.

## 7. Uygulama sırası ve çakışmasız dosya sahipliği

Bu tablo sonraki geliştirme için **önerilen** iş bölümü; bu görevde worker açılmadı. Bir dosyanın sahibi tüm dalgalarda sabittir; ortak dosyaya başka worker doğrudan yazmaz. Yeni widget arayüzü önce sabitlenir, tüketiciler sonra uyarlanır.

| Dalga / sahip | Dosya sahipliği | İş / bağımlılık |
|---|---|---|
| 0–1 / DS sahibi | `mobile/lib/theme/app_theme.dart`, `mobile/lib/core/spacing.dart`, `mobile/lib/core/breakpoints.dart`, yeni `mobile/lib/theme/app_ui_tokens.dart`, yeni `mobile/lib/widgets/ui/**`, `mobile/lib/widgets/responsive_container.dart`, `mobile/lib/widgets/responsive_card_grid.dart`, `mobile/lib/widgets/cards/section_header.dart`, `stat_card.dart`, `progress_hero_card.dart` | Token/kontrast, ortak form/list/state/sheet/button API; kullanılmayan kartları sırf audit için ürün kapsamına sokma. |
| 1–2 / Kabuk-erişim sahibi | `mobile/lib/screens/main_navigation_shell.dart`, `mobile/lib/widgets/app_bottom_navigation.dart`, `mobile/lib/router/**`, `mobile/lib/screens/home/**`, `mobile/lib/screens/qr_scan/**`, `mobile/lib/screens/settings/**`, `mobile/lib/widgets/cards/attendance_status_card.dart`, `quick_action_card.dart`, `door_command_status_card.dart`, `mobile/lib/widgets/door_operation_recovery_dialog.dart` | Önce QR örtüşmesi ve tarama yönlendirmesi, sonra home; DS bileşenleri hazır olunca görünüm geçişi. |
| 2 / Kimlik-profil sahibi | `mobile/lib/screens/auth/**`, `mobile/lib/screens/splash_screen.dart`, `mobile/lib/screens/profile/**`, `mobile/lib/widgets/brand_mark.dart` | Giriş ve profil yoğunluğu, şifre yardım copy’si; DS tokenlarına bağlanır. |
| 2–3 / Geçmiş-talepler sahibi | `mobile/lib/screens/history/**`, `mobile/lib/widgets/history/**`, `mobile/lib/screens/requests/**` | Liste/özet/filtre/form geçişi; `requests_screen.dart` iki worker arasında bölünmez. |
| 2–3 / Ziyaretçi sahibi | `mobile/lib/screens/visitor/**`, `mobile/lib/widgets/visitor/**` | Önce görünür form sonucu ve alt eylem, sonra liste/detay; mevcut kurtarma ve aktivasyon koşulları korunur. |
| Her dalga / Entegrasyon-l10n sahibi | `mobile/lib/l10n/**`, `mobile/lib/main.dart`; gerekiyorsa `mobile/lib/providers/**`, `mobile/lib/models/**`, `mobile/lib/core/attendance_date.dart`, `mobile/lib/core/error_localizer.dart` | Her ekran sahibi ihtiyaç listesini iletir; TR/EN ve generated l10n tek kişi üretir, yeni veri bağlantısını bu sahip yapar. |
| 4 / QA sahibi | Yeni `mobile/test/ui_redesign/**` ve mevcut `mobile/screenshot_test/**` | Kaynak sahiplerinin işini tekrar düzenlemeden golden/semantics/cihaz kabulü; mevcut başka test dosyalarına değişiklik gerekiyorsa sahibi önceden atanır. |

Dalga 0: görsel olmayan mevcut davranışları ve yerel hata/Türkiye saati sözleşmesini kayda al; route/sekme koruması, belirsiz komut, session boundary değiştirilmez. Dalga 1: kontrast ve kabuk; dalga 2: Y bulguları ve home/auth; dalga 3: listeler/formlar/detay; dalga 4: kabul ve kalan O/D maddeleri.

Kabul: 390×844 açık/koyu tüm durumlar; 320/360 genişlik ve %130/%200 metin; klavye açık formlar; son satır/CTA gezinmeyle örtüşmez; gerçek semantics ad/rol/selected; 48dp hit ölçümü; TR/EN; mevcut veri üzerinde offline/refresh ayrımı; gerçek Android/iOS kamera ve fiziksel okuyucu testi. Komut başarı anonsu fiziksel geçiş anonsuna dönüştürülmez. Yeni rapor görselleri ile her Y/O bulgu kapatılmalı; yalnız unit test sayısı yeterli değildir.

## 8. Teslim ve çalışma ağacı kontrolü

- Mockup Chromium/Playwright ile 390×844 açıldı ve ekran görüntüsü gözle kontrol edildi: belge 390×844, yatay taşma yok; QR 350×54px, kapı 350×62px, alt hedefler 76×58px ve tüm eylemler görünür; harici kaynak listesi boş. Bu ölçüm HTML içindir, Flutter hit testi değildir.
- Bu worker uygulama/test kodunu değiştirmedi; `git diff --stat -- mobile` boş.
- Başlangıçta `git status --short -- mobile` çıktısı zaten `?? mobile/screenshot_test/` idi; aynı untracked çekim dizini bu workerın değişikliği değildir.
- Dolayısıyla görevdeki **tamamen boş status kapısı mevcut paylaşılan ağaçta sağlanmıyor**; kanıt üreten diğer oturumun dosyaları silinmedi veya gizlenmedi. Koordinatör bu mevcut durumu kendi tesliminde uzlaştırmalı.
- `AUDIT_CLAUDE.md` okunmadı; backend, src ve convex dosyalarına dokunulmadı. Commit/stash/reset/restore çalıştırılmadı.
