# Yön B son ekran görüntüleri

Repo kökünden:

```sh
cd mobile
flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/
flutter test --no-pub --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/
```

`after-b/INDEX.md` ekran, durum, dil, tema, genişlik, ölçek, kaynak ve rota matrisini aynı `shots` listesinden üretir. Golden karşılaştırması `--update-goldens` olmadan yapılır. Standart `flutter test --no-pub` yalnız `test/` paketidir; screenshot kapısı ayrıca çalıştırılır.

`AUDIT_OUTPUT_DIR` mobile çalışma dizinine göre çözülür; varsayılan after-b'dir. Boş hedef ve geçmiş `current/`, `after-d1/`, `after-d2/` hedefleri hatadır; bu referanslar değiştirilmez. Üretilen fixture verileri sentetiktir; backend, gerçek kapı komutu veya platform kamera çağrısı yapılmaz.

- Ana ekran matrisi: login, home, history, requests, visitor, profile, qr × TR/EN × açık/koyu × 320/390dp × 1.0/1.3/2.0. Her ekran için 24 kombinasyon vardır.
- Durum çekimleri: dolu/boş/yükleniyor/hata; request formları ve hata/submit; Home belirsiz kapı notice'i; 360dp takvim ızgarası ve 320dp liste; geçmiş ayrıntı/filtre/özet; ziyaretçi form alan ve onay hatası, ayrıntı/iptal, klavye; profil alt sayfaları ve tercih/çıkış sheet/diyalogları.
- DPR 2; 844dp yükseklik, üst/alt güvenli alan 47/34dp. `long` yalnız etkin sayfanın dikey scroll extent'ini kullanır, üst sınır 2400dp'dir. Arka branch veya yatay segment extent'i kullanılmaz.
- Klavye fixture'ı gerçek işletim sistemi klavyesini çizmez; 280dp viewInsets altında footer'ın y=564 sınırı üzerinde kaldığını doğrular.
- SDK Roboto tüm ağırlıkları/MaterialIcons ve paketten CupertinoIcons yüklenir. Ailesi olmayan render metinlerinin Ahem fallback'i Roboto'ya çözülür; boyut/renk/ağırlık ve ikon aileleri korunur. Gerçek gölgeler açıktır.
- Talepler, geçmiş ve ziyaretçi picker'ları sabit `auditNow` alır. Home başlığı/selamı ve göreli kapı sonucu metni sistem saatini kullanır; başka günde golden üretimi bunlarda güncelleme gerektirebilir. QR yalnız sentetik kısa ömürlü token veya mevcut kamera izin yer tutucusudur.
- Request alanları `request-notes`/`request-reason` altındaki editable, saatler `request-check-in-time`/`request-check-out-time`, CTA `request-submit` ile bulunur. Segmentler yerelleştirilmiş getter'dan seçilir ve selected semantics doğrulanır. Ziyaretçi ayrıntısı liste `AppListRow` adıyla açılır.
- UI kataloglarında ortak checkbox ve supporting satırı da görünür. Davranış testleri `test/ui_redesign/acceptance/kit_completion_test.dart` içindedir.

Çekimler font/render/layout denetimidir. iOS/Android sistem çubuğu, gerçek klavye/gesture inset, VoiceOver/TalkBack ve fiziksel QR/kamera kabulü ayrıca insan/cihaz kontrolü gerektirir; bunlar bu harness ile yapılmış sayılmaz.

QR'nin gerçek saate bağlı progress ucunda ölçülen 8–16px oynama için yalnız gerçek `LinearProgressIndicator` dikdörtgeninde en fazla 32 fiziksel piksel tolerans vardır. Kod, süre metni ve kalan tüm pikseller birebir karşılaştırılır; diğer ekranlarda tolerans yoktur. Kabul testi dışarıdaki tek pikseli, büyük çubuk değişimini ve boyut uyuşmazlığını reddeder.
