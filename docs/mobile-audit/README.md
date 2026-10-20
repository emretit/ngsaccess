# NGS Plus mobil uygulama auditi

19 Ekim 2026. Kapsam: `mobile/` Flutter uygulaması ve kullandığı mevcut Convex sözleşmeleri. Audit yalnız inceleme ve geliştirme paketi üretir; uygulama düzeltmesi veya deploy içermez.

**12/12 modül auditi tamamlandı.** Her modül ayrı Orca worker'ıyla incelendi; raporlar okundu, ortak bulgular çapraz karşılaştırıldı ve tamamlanan worker oturumları arşivlenerek serbest bırakıldı. Kod düzeltmesi yapılmadı; mevcut mobil çalışma ağacı değişmedi.

**Başlangıç belgesi:** [Birleştirilmiş geliştirme paketi](development-package.md). Modül raporları 92 ayrıntılı alt iş paketi içeriyor; ortak kök nedenler MOB-00–MOB-23 altında **24 iş/karar paketinde** toplandı. [Bulgu dizinindeki](findings-index.md) 97 ham gözlem mükerrer modül bulguları içerir; 97 farklı bug anlamına gelmez.

## Mevcut durum

Gerçek çalışan oturumu, Convex bağlantısı, repository/provider ayrımı, korumalı navigasyon, polling, tema ve TR/EN temeli var. Statik analiz temiz, mevcut 44 test geçti. Ziyaretçi ekranı ve profil/ayarların önemli kısmı placeholder; README'nin özellik listesi mevcut kodu doğru yansıtmıyor. Bu kaynak auditi sıfırdan yeniden yazımı zorunlu kılan bir kanıt üretmedi; öncelik mevcut iş sözleşmelerini ve veri doğruluğunu düzeltmek.

İlk geliştirme diliminde ele alınacak konular:

1. Parolanın tercihler deposunda saklanması, açık logout sonrası yeniden otomatik giriş, parola değişiminde eski oturumların geçerliliği.
2. HTTP 560 işlev hatalarının sunucu hatası sayılması; yerel mock ile yeniden üretildi. Production hata kodu/redaksiyon sözleşmesi de tamamlanmalı.
3. Mobil check-in ve “Kapıyı Aç” işleminin fiziksel komut/onay olmadan gerçek hareket kaydı üretmesi; tekrar işlemlerde çift kayıt/yön değişimi.
4. Pasif cihaz, kural gün/saatleri, kapı bazlı izin ve tenant metadata sınırlarındaki eksikler.
5. Eski oturumun gecikmiş yanıtı; sınırlı geçmiş penceresinden dönem özeti; UTC takvim anahtarı ve gün/hafta/ay sınırı hataları.
6. Android release debug imzası ve eksik yapılandırmada sabit deployment'a sessiz dönüş.

Bunlar kaynak zinciri veya belirtilmiş yerel deney kanıtlarıdır; üretimde gerçekleşmiş olaylar olarak sunulmaz. Uygulama genelinde P0 kanıtı saptanmadı; bu ifade üretim güvenlik/uyumluluk sertifikası değildir.

## Modül sonuçları

| Modül | Sonuç ve rapor | Kalan uygulama/doğrulama sınırı |
|---|---|---|
| Kimlik doğrulama / oturum | [Tamamlandı](modules/01-auth.md) | Saklama/logout/revocation ve session yarışları; cihaz/canlı auth E2E |
| Ana sayfa / dashboard | [Tamamlandı](modules/02-home.md) | Tam günlük özet, komut ve veri durumları; fiziksel sonuç |
| Yoklama / geçmiş | [Tamamlandı](modules/03-attendance-history.md) | Cursor/aggregate, takvim/dönem/yön ve geç yanıt düzeltmeleri |
| QR / fiziksel geçiş | [Tamamlandı](modules/04-qr.md) | Payload/challenge/idempotency, marka ve kamera laboratuvarı |
| Ziyaretçi | [Tamamlandı](modules/05-visitor.md) | Mobil rol kararı; gerçek modül inşası ve cihaz senkronizasyonu |
| Profil / ayarlar | [Tamamlandı](modules/06-profile.md) | Self-service kapsamı, gerçek destek/ayar ve metadata |
| Cihaz seçimi / tercihler | [Tamamlandı](modules/07-devices.md) | Hesap kapsamı, kapı hedefi, aktiflik/yetki ve saklama |
| Mimari / navigasyon | [Tamamlandı](modules/08-architecture-navigation.md) | Bootstrap/deep link, DI/dispose ve cihaz geri hareketi |
| HTTP / Convex sözleşmeleri | [Tamamlandı](modules/09-network-backend.md) | 560/errorData, typed DTO, tenant ve production benzeri E2E |
| Tasarım / erişilebilirlik | [Tamamlandı](modules/10-design-accessibility.md) | Render kontrastı, büyük yazı, TalkBack/VoiceOver/klavye |
| Yerelleştirme | [Tamamlandı](modules/11-localization.md) | Dil seçimi, hata/fallback/çoğul/metadata ve iki dilli cihaz QA |
| Platform / test / yayın | [Tamamlandı](modules/12-platform-quality.md) | Signing/env/native restore/CI, gerçek paket ve mağaza doğrulaması |

## Dosyalar

- [Worker ve dosya kapsamı](coverage.md): 12 ayrı modül görevi, Task/Dispatch kimlikleri ve kaynak dosyaların eşlemesi.
- [Birleştirilmiş geliştirme paketi](development-package.md): sahiplik, bağımlılık, kabul/test ve dört teslim dilimi.
- [Bulgu dizini](findings-index.md): 12 modülün 97 ham gözlemi ve 92 ayrıntılı alt iş paketi envanteri.
- [Baz doğrulama](evidence/baseline.md): Flutter/Dart sürümü, çalışma ağacı sınırı ve test çıktıları.
- `modules/`: her modül için mevcut durum, satır kanıtlı bulgular, geliştirme işleri ve kabul kriterleri.
- `specs/`: worker'lara gönderilen tam görevler.
- [Başlatma kayıtları](workers.json): gerçek Orca worker-start makbuzları. Başlatma kaydı tamamlanma kanıtı değildir.
- [Tamamlanma ve arşiv kayıtları](evidence/final-workers.json): 12 completed dispatch / released worker, captured transcript kanıtı.

## Doğrulama sınırı

`flutter analyze --no-pub` temiz; `flutter test --no-pub --reporter expanded` ile 44 test geçti. Gerçek Android/iOS cihaz, kamera, fiziksel kapı ve canlı backend uçtan uca denemeleri bu baz kontrolün kapsamında değildir. Modül raporlarında kaynak analizi ile çalıştırılmış doğrulama ayrı belirtilir.

## Öncelik ve tahmin dili

| Öncelik | Anlamı |
|---|---|
| P0 | Kanıtlı acil veri/güvenlik sorunu veya kritik kesinti |
| P1 | Ana kullanıcı akışı, veri doğruluğu veya güçlü yetki riski |
| P2 | Dayanıklılık, kullanılabilirlik ve bakım |
| P3 | Düşük etkili iyileştirme |

S/M/L iş büyüklükleri göreli tahmindir; gün veya teslim tarihi taahhüdü değildir. Kaynakta görülen risk, üretimde gerçekleştiği kanıtlanan olay olarak sunulmaz. Eksik özellikler mevcut kapsam açığı olarak değerlendirilir; otomatik olarak kritik hata sayılmaz.

## Çalışma durumu

Audit ve geliştirme paketi teslimi tamamlandı. Açık kalanlar raporlardaki ürün kararları, kod uygulamaları ve manuel cihaz/canlı backend/release doğrulamalarıdır; auditin tamamlanması bu geliştirmelerin yapıldığı anlamına gelmez. Üretime veri yazılmadı, dış mesaj veya public yayın yapılmadı.
