# B2 — uygulama notları ve sözleşme eksikleri

4 Kasım 2026. `DESIGN_B.md` değiştirilmedi; aşağıdaki iki konu D2/D3 uygulamasından önce koordinatör tarafından sözleşme/l10n sahibiyle netleştirilmelidir. Mockup’lar statik görsel hedeflerdir; gerçek izin, kayıt gönderme veya kapı komutu çalıştırmaz.

## Açık bulgular — 2

| ID | Bölüm | Sorun ve kanıt | Önerilen düzeltme | Mockup kararı |
|---|---|---|---|---|
| GB-01 | DESIGN_B §5.5, kamera izni | Kamera reddinde “Ayarları aç” belirtiliyor; ilk kez izin istenecek durum ile kalıcı ret ayrı eylemlerle tarif edilmemiş. Yalnız bu metni uygulamak, ilk kullanımda gereksiz Ayarlar yönlendirmesi doğurabilir. | Mevcut permission state makinesini koruyarak henüz sorulmadı/yeniden sorulabilir durumda sistem izin isteği, kalıcı ret durumunda Ayarlar eylemi tanımlansın; yeni metin gerekirse `qrGrantCameraPermission`: “Kamera izni ver” / “Allow camera access”. | `qr-permission.html` **kalıcı ret** durumunu gösterir; mevcut “Ayarları aç” korunur. İlk izin diyaloğu işletim sistemine aittir, bu ekran onun yerine geçmez. |
| GB-02 | DESIGN_B §5.1 / §5.11 / §5.19 ile §6 | Ekranlarda istenen bazı yeni başlıkların §6’da anahtarı yok: “Başlatılıyor”, nötr “Kayıt ayrıntısı” ve profil grup başlıkları “Hesap / Tercihler / Destek”. Mevcut kaynakta `startupTitle` “NGS Plus başlatılıyor”; `historyDetailCheckIn/Out` yön özel başlıklar, nötr başlığın karşılığı değil. | L10n sahibi D2b/D3a başlamadan `startupBandTitle`, `historyRecordDetailTitle`, `profileAccountSection`, `profilePreferencesSection`, `profileSupportSection` anahtarlarını TR/EN eklesin; önerilen EN: “Starting”, “Record details”, “Account”, “Preferences”, “Support”. Alan/boş durum yardımcı cümleleri mevcut yerel anahtarlarla eşlensin; mockup’tan hardcoded string taşınmasın. | Görselde §5’in tarif ettiği Türkçe başlıklar kullanıldı; çalışan ARB veya üretilmiş Dart dosyalarına dokunulmadı. |

## Çelişki olmayan, uygulamada korunacak kararlar

- Eski `home.html`, `history.html`, `qr.html`, `home-dark.html` **değiştirilmedi**. Bunlar yön seçimi referansıdır; DESIGN_B §2 zaten eski 25px başlığın 26sp’ye ve kompakt kayıt satırının en az64dp’ye çıkacağını açıklar. Katalogda ayrı referans grubundadır. Yeni ekranların kaynak ölçüsü DESIGN_B’dir.
- Yeni görünüm sayısı **51**: 36 açık + 15 koyu. Yıldızlı ailelerin bütün istenen durumları koyuda da çizildi; yaklaşık40 ifadesi üst sınır alınmadı. Önceki dört görünümle toplam55 ekran HTML’si ve55 PNG; katalog ayrıca bir HTML’dir.
- Ekranlar390×844, PNG’ler780×1688. İçerik gerektiğinde dikey kayar; form footer’ı, alt gezinme ve sheet footer’ı kendi alanını ayırır. Klavye örneğinde footer klavyenin üstündedir; ikinci bottom safe inset yoktur.
- Formlarda görünen değerler örnektir; dosyalardaki readonly alanlar üretim etkileşim davranışı değildir. Onay checkbox’ı klavyeli form örneğinde önceden seçilmiştir; kaydırılarak tekrar görülebilir. Gerçek uygulamadaki onay/validation/busy kuralları korunur.
- Kamera, sistem durum çubuğu, home indicator ve klavye yerel çizimlerdir. Klavye tuş ölçüleri işletim sistemi tasviridir; 48px uygulama hedefi denetimi gerçek uygulama buton/alanlarına uygulanır.
- Geçmiş filtresinde4Kas tarihi taslak seçimdir; arkadaki2–4Kas kapsamı Apply öncesindeki aktif filtredir. Takvim Kasım2026’nın altı haftasını gösterir; seçili gün listesi nav üstündeki alan içinde kayar.
- Tek bekleyen izin talebi9–11Kas’tır. Kayıt düzeltme listesi onaylanmış geçmiş talepleri gösterir; Ana Sayfa’nın “1 bekleyen” bilgisiyle çelişmez.
- Açılış ve Giriş hata mesajları, belirsiz kapı sonucu ve ziyaretçi aktivasyon durumu farklı anlamlarını korur. Kapı komut onayı fiziksel geçiş gibi gösterilmez; davetin kaydedilmesi aktif erişim sayılmaz.
- QR paneli ve home durum kartı dışındaki içerikler gölgesizdir; sheet/diyalog gölgesi ve yerel klavye tasviri istisnadır. Bordo yalnız izin verilen bantlarda ve etkin katmanda tek birincil eylemdedir.

## Yeniden üretim ve kontrol

Depo kökünden, yeni paket kurmadan:

```sh
python3 docs/mobile-ui-audit/directions/B/_build.py
python3 docs/mobile-ui-audit/directions/B/_catalog.py
node docs/mobile-ui-audit/directions/B/_capture.cjs
```

`_b.css` ortak kaynak; `_build.py` CSS’i her yeni HTML’ye gömer. Böylece tek ekran HTML’si dış font/CDN/görsel/CSS yüklemez. Katalog yalnız aynı klasör ağacındaki PNG/HTML’lere bağlantı verir. `_capture.cjs`, önceden kurulu `/Users/emreaydin/pafta/node_modules/playwright` Chromium’unu kullanır. Önceki dört HTML/PNG yeniden yazılmaz; SHA-256 karşılıkları `manifest.json` içinde kayıtlıdır.

`validation.json` her yeni ekran için yatay taşma, iç kaydırma alanı genişliği, 48px altı hedefler, etkin katmandaki primary sayısı, footer/klavye geometrisi, PNG boyutu, JavaScript hatası ve dış istek sonuçlarını taşır. Dikey içerik kaydırılması hata değildir; modal arkasındaki inert kontroller etkin hedef sayımına dahil edilmez. Statik mockup kontrolü Flutter cihaz testlerinin yerine geçmez.

## Tamamlanan görsel kontrol

- 51 yeni ekran Chromium ile çekildi;55 ekran PNG’sinin tamamı780×1688. 51 yeni ekranda yatay taşma0,48px altı uygulama hedefi0, birden çok etkin primary0, dış ağ isteği0 ve JavaScript hatası0.
- 10 form/sheet footer örneğinde eylem çubuğu görünür, içerik ondan önce sonlanıyor; iki klavyeli formda footer klavyenin üstünde. Sonuç: `catalog-validation.json`.
- Katalog1440px ve390px genişlikte yatay taşmasız;55 görselin tamamı yükleniyor. Önceki dört HTML’nin hash’i korundu.
- `view_image` ile açılan18 farklı yeni PNG: `login-error`, `login-empty-dark`, `home-loading`, `visitor-form-keyboard-dark`, `history-calendar`, `history-filter`, `leave-error-dark`, `requests-correction`, `door-recovery`, `profile-theme-dark`, `visitor-detail`, `qr-scan`, `visitors-filled`, `visitors-error-dark`, `correction-filled`, `startup-error`, `history-summary`, `home-empty`. Filtre ve tema sheet’i son düzeltmeden sonra tekrar açıldı; katalog üst bölümü ayrıca incelendi.
- Bileşen karşılaştırmasında açık/koyu input, badge, başlık, segment, buton ve sheet ölçüleri tutarlı. Takvim ve uzun listelerde kalan satırlar kontrollü dikey kaydırmada; nav üstünde ayrılmış gövde alanı var.

## Koordinatör kararı (2026-11-04)

- **GB-01 kabul:** mevcut izin durum makinesi korunur; henüz sorulmamış/yeniden sorulabilir → sistem izin isteği (`qrGrantCameraPermission` “Kamera izni ver” / “Allow camera access”), kalıcı ret → “Ayarları aç”. Uygulama D2a.
- **GB-02 kabul:** `startupBandTitle` (Başlatılıyor / Starting), `historyRecordDetailTitle` (Kayıt ayrıntısı / Record details), `profileAccountSection` (Hesap / Account), `profilePreferencesSection` (Tercihler / Preferences), `profileSupportSection` (Destek / Support) + GB-01 anahtarı → koordinatör D1 bittikten sonra, D2 başlamadan ARB'ye ekler.
