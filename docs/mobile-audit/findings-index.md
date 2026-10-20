# Modül bulgu dizini

Bu dizin ham modül gözlemlerini gösterir. Aynı kök neden farklı tüketicilerde tekrar yer alır; toplam benzersiz bug sayısı değildir. Birleştirilmiş uygulama sahipliği [geliştirme paketindedir](development-package.md).

| Modül | Bulgular | P1 | P2 | P3 | Ayrıntılı alt iş paketi | Sonuç |
|---|---:|---:|---:|---:|---:|---|
| [01-auth](modules/01-auth.md) | 9 | 5 | 4 | 0 | 9 | Tamamlandı; rapor kabul edildi |
| [02-home](modules/02-home.md) | 9 | 5 | 4 | 0 | 8 | Tamamlandı; rapor kabul edildi |
| [03-attendance-history](modules/03-attendance-history.md) | 11 | 5 | 6 | 0 | 6 | Tamamlandı; rapor kabul edildi |
| [04-qr](modules/04-qr.md) | 10 | 7 | 3 | 0 | 8 | Tamamlandı; rapor kabul edildi |
| [05-visitor](modules/05-visitor.md) | 4 | 2 | 1 | 1 | 7 | Tamamlandı; rapor kabul edildi |
| [06-profile](modules/06-profile.md) | 6 | 2 | 3 | 1 | 9 | Tamamlandı; rapor kabul edildi |
| [07-devices](modules/07-devices.md) | 8 | 4 | 4 | 0 | 6 | Tamamlandı; rapor kabul edildi |
| [08-architecture-navigation](modules/08-architecture-navigation.md) | 8 | 2 | 5 | 1 | 7 | Tamamlandı; rapor kabul edildi |
| [09-network-backend](modules/09-network-backend.md) | 9 | 4 | 5 | 0 | 7 | Tamamlandı; rapor kabul edildi |
| [10-design-accessibility](modules/10-design-accessibility.md) | 8 | 2 | 6 | 0 | 7 | Tamamlandı; rapor kabul edildi |
| [11-localization](modules/11-localization.md) | 7 | 0 | 4 | 3 | 8 | Tamamlandı; rapor kabul edildi |
| [12-platform-quality](modules/12-platform-quality.md) | 8 | 2 | 6 | 0 | 10 | Tamamlandı; rapor kabul edildi |

Ham modül gözlemi: **97**; P0: 0, P1: 40, P2: 51, P3: 6. Ayrıntılı modül alt paketi: **92**. Bunlar **MOB-00–MOB-23** altında 24 ortak üst işe bağlanmıştır. Öncelik tanımları ve özellik açığı ayrımı README'dedir.

## Bulgu satırları

| ID | Öncelik | Gözlem | Kaynak rapor |
|---|---|---|---|
| AUTH-F01 | P1 | Parola ve uzun ömürlü bearer token güvenli saklama katmanı olmadan kalıcılaştırılıyor | [01-auth](modules/01-auth.md) |
| AUTH-F02 | P1 | Açık çıkış sonraki açılışta otomatik girişi engellemiyor | [01-auth](modules/01-auth.md) |
| AUTH-F03 | P1 | Parolanın yeniden kurulması mevcut mobil oturumları geçersiz kılmıyor | [01-auth](modules/01-auth.md) |
| AUTH-F04 | P1 | Eşzamanlı giriş/çıkış ve gecikmiş yanıtlar için oturum sahipliği koruması yok | [01-auth](modules/01-auth.md) |
| AUTH-F05 | P2 | Bootstrap geçici ağ hatası geçerli oturumu giriş ekranında bırakıyor | [01-auth](modules/01-auth.md) |
| AUTH-F06 | P2 | Çalışan pasifleştirme hatası istemcide oturum sonu olarak işlenmiyor | [01-auth](modules/01-auth.md) |
| AUTH-F07 | P2 | Kurtarma ekranı uygulanmamış e-posta akışını vaat ediyor ve eski hatayı gösterebiliyor | [01-auth](modules/01-auth.md) |
| AUTH-F08 | P2 | Public mobil parola doğrulamasında uygulama düzeyinde deneme sınırı yok | [01-auth](modules/01-auth.md) |
| AUTH-F09 | P1 | Convex HTTP 560 oturum hatası genel sunucu hatasına dönüşüyor | [01-auth](modules/01-auth.md) |
| HOME-F01 | P1 | P1 — Kapıyı Aç, fiziksel komut göndermeden yoklama kaydı oluşturuyor | [02-home](modules/02-home.md) |
| HOME-F02 | P1 | P1 — Tek kullanıcı niyeti, tekrarlı dokunmada birden fazla giriş/çıkış üretir | [02-home](modules/02-home.md) |
| HOME-F03 | P2 | P2 — Yükleniyor, hata ve gerçekten hareket yok durumları aynı görünüyor | [02-home](modules/02-home.md) |
| HOME-F04 | P1 | P1 — Dashboard özeti, son oluşturulan 50 kaydın eksik penceresinden hesaplanıyor | [02-home](modules/02-home.md) |
| HOME-F05 | P2 | P2 — Gün sınırı ve saat politikası backend ile aynı değil | [02-home](modules/02-home.md) |
| HOME-F06 | P2 | P2 — Bilinmeyen yön sessizce giriş ve İçeride kabul ediliyor | [02-home](modules/02-home.md) |
| HOME-F07 | P2 | P2 — Tercih edilen cihaz kullanıcıdan bağımsız saklanıyor | [02-home](modules/02-home.md) |
| HOME-F08 | P1 | P1 — Geciken tek seferlik sorgu, çıkıştan sonra eski çalışanın kayıtlarını yeniden yazabilir | [02-home](modules/02-home.md) |
| HOME-F09 | P1 | P1 — Kaydedilmiş cihaz pasife alınsa da selfCheckIn onaylı kayıt üretebiliyor | [02-home](modules/02-home.md) |
| AH-F01 | P1 | Takvim yerel günleri UTC anahtarlarıyla arıyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F02 | P1 | Eksik pencere tam dönem gibi sayılıyor; filtreli geçmiş ilerleyemiyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F03 | P1 | Ay/hafta/gün sınırları farklı ve hatalı | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F04 | P1 | Red ve bilinmeyen yön gerçek giriş/çıkış gibi sunuluyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F05 | P1 | Bekleyen refresh yanıtı logout/hesap değişimi sonrası eski veriyi geri yazabiliyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F06 | P2 | Zaman dilimi ve vardiya anlamı kaynaklar arasında ortak değil | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F07 | P2 | Geçmiş zaman yerine eklenme sırasına göre sınırlanıyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F08 | P2 | Cihaz filtresi/cihaz özeti ilk yükleme snapshot'ında kalıyor ve adları kimlik sayıyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F09 | P2 | Yükleme sırasında ekran kapanınca state güncellemesi korunmuyor; boş refresh yüzeyi yok | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F10 | P2 | Polling düzelince eski hata nesnesi kalıyor ve başka işleme yanlış hata taşınabiliyor | [03-attendance-history](modules/03-attendance-history.md) |
| AH-F11 | P2 | Sayfa sonu scroll callback'i dinleyen Provider okuması yapıyor | [03-attendance-history](modules/03-attendance-history.md) |
| QR-F01 | P1 | QR sözleşmesi ekran, model, provider ve üreticiler arasında tutarsız — P1 | [04-qr](modules/04-qr.md) |
| QR-F02 | P1 | Yoklama kaydı fiziksel geçiş başarısı gibi sunuluyor — P1 | [04-qr](modules/04-qr.md) |
| QR-F03 | P1 | Cihaz QR'ı tazelik veya fiziksel bulunma kanıtı sağlamıyor — P1 | [04-qr](modules/04-qr.md) |
| QR-F04 | P1 | Üç saniye sonra tekrar tarama ve belirsiz ağ sonucu çift kayıt/yön değişimi üretir — P1 | [04-qr](modules/04-qr.md) |
| QR-F05 | P1 | Aynı çalışan token'ı public tüketicide okuyucu/politika denetimini atlar — P1 | [04-qr](modules/04-qr.md) |
| QR-F06 | P1 | Mobil “kapı cihazına okutun” vaadi Hikvision/IDE token yoluyla örtüşmüyor — P1 | [04-qr](modules/04-qr.md) |
| QR-F07 | P2 | Kamera görünürlük ve app lifecycle yönetimi dış controller ile eksik — P2 | [04-qr](modules/04-qr.md) |
| QR-F08 | P2 | Bekleyen tarama ekran kaldırıldığında unmounted state güncelleniyor — P2 | [04-qr](modules/04-qr.md) |
| QR-F09 | P2 | Token süresi ve yenileme durumu kullanıcıya yanlış/eksik aktarılıyor — P2 | [04-qr](modules/04-qr.md) |
| QR-F10 | P1 | Mobil/self-check-in ve generic token kararı kuralın gün/saat sınırını uygulamıyor — P1 | [04-qr](modules/04-qr.md) |
| VIS-F01 | P1 | Mobil ana ziyaretçi akışı tamamen placeholder; çalışan oturumu için API sözleşmesi yok | [05-visitor](modules/05-visitor.md) |
| VIS-F02 | P1 | Projesiz eski ziyaretçide checkOut/releaseCard proje yetkisi kontrolünü atlıyor | [05-visitor](modules/05-visitor.md) |
| VIS-F03 | P2 | IDE kart gereksinimi kayıt öncesi doğrulanmıyor; başarılı kayıt sonradan senkronize edilemeyebilir | [05-visitor](modules/05-visitor.md) |
| VIS-F04 | P3 | İngilizce ekranda placeholder gövdesi Türkçe kalıyor | [05-visitor](modules/05-visitor.md) |
| PROFILE-F01 | P1 | Açık çıkıştan sonra beni hatırla otomatik olarak yeniden oturum açıyor | [06-profile](modules/06-profile.md) |
| PROFILE-F02 | P2 | Kapı tercihi hesaplar arasında taşınıyor ve geçersiz seçim temizlenemiyor | [06-profile](modules/06-profile.md) |
| PROFILE-F03 | P2 | Profil ve ayar menüsünün önemli bölümü tamamlanmamış | [06-profile](modules/06-profile.md) |
| PROFILE-F04 | P2 | Parola sıfırlama formunun vaadi gerçek yönetici akışıyla uyuşmuyor | [06-profile](modules/06-profile.md) |
| PROFILE-F05 | P1 | Hızlı erişim kapısı ayarı gerçek kapı komutuna bağlanmıyor, attendance kaydı oluşturuyor | [06-profile](modules/06-profile.md) |
| PROFILE-F06 | P3 | Hakkında ekranı manifest sürümünden farklı sabit sürüm gösteriyor | [06-profile](modules/06-profile.md) |
| DEV-F01 | P2 | Tercih kullanıcı/proje kapsamında değil; eski tercihi kurtarma akışı yok | [07-devices](modules/07-devices.md) |
| DEV-F02 | P1 | Karar anında pasif cihaz ve kuralın saat/gün kısıtları uygulanmıyor | [07-devices](modules/07-devices.md) |
| DEV-F03 | P1 | Yabancı proje cihazı reddedilse de kendi geçmişine bağlanıp metadata döndürülebiliyor | [07-devices](modules/07-devices.md) |
| DEV-F04 | P1 | “Kapıyı Aç” fiziksel işlem olmadan katılım kaydı yazıyor | [07-devices](modules/07-devices.md) |
| DEV-F05 | P1 | Yalnız kapı bağıyla verilen izin cihaz listesinde görünmüyor | [07-devices](modules/07-devices.md) |
| DEV-F06 | P2 | Tercih kayıt hatası kullanıcı akışında yönetilmiyor; bellek ve disk ayrışabiliyor | [07-devices](modules/07-devices.md) |
| DEV-F07 | P2 | Bozuk cihaz yanıtı boş yetki listesine veya seçilebilir sahte ID'ye dönüşebiliyor | [07-devices](modules/07-devices.md) |
| DEV-F08 | P2 | Liste ham teknik hatayı gösteriyor; hızlı açma farklı hataları “erişim reddi”ne indiriyor | [07-devices](modules/07-devices.md) |
| AN-F01 | P1 | Açık çıkış, yeniden başlatmada hatırlanan bilgilerle geri alınabiliyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F02 | P1 | Eski oturumun gecikmiş liste yanıtı yeni kullanıcının ortak verisine yazılabiliyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F03 | P2 | Deep link, bootstrap'ı atlayabiliyor ve girişten sonra hedef kayboluyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F04 | P2 | Korunan QR sekmesinin gizlenmesi kamera/tarama ömrünü sonlandırmıyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F05 | P2 | Seçili cihaz tercihi kullanıcı değişiminden sonra önceki hesaba ait kalıyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F06 | P2 | Geçici bootstrap ağ hatası, geçerli session olmasına rağmen login'e düşürüyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F07 | P2 | Eski isteğin expiry sinyali yeni session'ı temizleyebiliyor | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| AN-F08 | P3 | Composition root sahipliği ve DI sınırı tamamlanmamış | [08-architecture-navigation](modules/08-architecture-navigation.md) |
| NET-F01 | P1 | Convex fonksiyon hatası ve üretim auth expiry sözleşmesi bozuk | [09-network-backend](modules/09-network-backend.md) |
| NET-F02 | P1 | “Kapıyı Aç” akışı fiziksel komut yerine başarılı geçiş kaydı yazıyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F03 | P1 | Mobil erişim kararı pasif cihazı ve zaman programını denetlemiyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F04 | P1 | Başka projedeki cihaza reddedilen istek bile yabancı cihaz bilgisini geçmişe taşıyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F05 | P2 | Üretilmiş QR, çalışan pasife alındıktan sonra web tüketiminde hâlâ geçiş yazabiliyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F06 | P2 | Yanıt bozulması boş listeye veya gerçek erişim reddine dönüştürülüyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F07 | P2 | Cihaz seçimi kullanıcı mesajı yerine ham hata gövdesini gösterebiliyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F08 | P2 | Eksik ortam yapılandırması sabit deployment'a sessizce bağlanıyor | [09-network-backend](modules/09-network-backend.md) |
| NET-F09 | P2 | Geçmiş sözleşmesi olay zamanına göre sayfa garantisi vermiyor; polling büyüyen listenin tamamını okuyor | [09-network-backend](modules/09-network-backend.md) |
| DA-F01 | P2 | Sabit metin/durum renkleri açık ve koyu temada yetersiz kontrast üretiyor | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F02 | P1 | Alt gezinmenin QR kontrolü adsız; sekme rolü/seçili durum ve klavye etkileşimi tanımlanmamış | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F03 | P2 | Bazı form ve ikon kontrollerinde erişilebilir ad/hedef sözleşmesi eksik | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F04 | P2 | Şifre sıfırlama formu klavye ve kısa ekran için kaydırılamıyor | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F05 | P2 | QR gösterim gövdesi sabit yükseklikli içerikle kısa viewport'u aşıyor | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F06 | P2 | Ortak katılım satırı ve hızlı eylemler büyük metinde yeniden yerleşmiyor | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F07 | P1 | Ana sayfa yüklenmeyen/hatalı katılım verisini normal durum olarak gösteriyor | [10-design-accessibility](modules/10-design-accessibility.md) |
| DA-F08 | P2 | Geçmişin boş durumunda çekerek yenileme için Scrollable yok | [10-design-accessibility](modules/10-design-accessibility.md) |
| L10N-F01 | P2 | Profil dil tercihi uygulanmamış | [11-localization](modules/11-localization.md) |
| L10N-F02 | P2 | Şifre sıfırlama metni mevcut capability'yi yanlış anlatıyor | [11-localization](modules/11-localization.md) |
| L10N-F03 | P2 | Bazı hata yolları çevrilebilir domain hatası yerine ham metin gösteriyor | [11-localization](modules/11-localization.md) |
| L10N-F04 | P2 | Ziyaretçi placeholder'ı ve eksik cihaz fallback'i EN'de Türkçe kalıyor | [11-localization](modules/11-localization.md) |
| L10N-F05 | P3 | QR bilgi zamanları kullanıcı tarih/saat biçiminden geçmiyor | [11-localization](modules/11-localization.md) |
| L10N-F06 | P3 | EN adet mesajları tekil sayıyı karşılamıyor | [11-localization](modules/11-localization.md) |
| L10N-F07 | P3 | Profil sürüm bilgisi paket tanımıyla uyuşmuyor | [11-localization](modules/11-localization.md) |
| PLAT-F01 | P1 | Android release debug anahtarıyla imzalanıyor | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F02 | P1 | Eksik env sessizce sabit deployment'a yöneliyor | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F03 | P2 | Apple native lock grafikleri mevcut plugin setini temsil etmiyor | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F04 | P2 | Belgelenen SDK aralığı ile kilitli graph ve otomatik kalite kapısı arasında boşluk var | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F05 | P2 | Kullanılmayan dosya/galeri izinleri dağıtım sözleşmesini genişletiyor | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F06 | P2 | macOS runner dış ağ ve kamera kabiliyetlerini tamamlamıyor | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F07 | P2 | README kurulumu ve özellik durumu gerçek uygulamayla çelişiyor | [12-platform-quality](modules/12-platform-quality.md) |
| PLAT-F08 | P2 | Release hatalarının bağlamı merkezi olarak korunmuyor | [12-platform-quality](modules/12-platform-quality.md) |
