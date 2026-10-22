# Yayın sonrası mobil kontrol — 20 Ekim 2026

CEO, Emre’nin yayın onayını aldığını ve `71163d0` sürümünü Convex `notable-tern-4` ile Netlify web tarafına yayınladığını orchestration üzerinden bildirdi. Bu rapor mobil taraftaki bağımsız doğrulamadır. Backend/web yayını bu ajan tarafından yapılmadı.

## Sonuç

Mobilin kullandığı **21 API’nin 21’i mevcut**; önceki 15 eksik fonksiyon kapanmıştır. Yedi salt okunur sorgu, geçersiz oturumu yapılandırılmış `SESSION_INVALID` ile reddetmiştir. Gerçek mevcut oturumla iPhone 17 Pro / iOS 27.0 simülatöründe menüler yeniden kontrol edildi.

| Menü | Sonuç |
|---|---|
| Ana sayfa / yoklama | Kart ve güncelleme zamanı yüklendi; veri hatası kalktı |
| Geçmiş / Tümü | Gerçek erişim kayıtları yüklendi |
| Geçmiş / Bu Ay | Takvim ve dönem özeti yüklendi |
| Geçmiş / İstatistik | Aylık ve haftalık özetler yüklendi |
| QR Kodum | QR üretildi, sayaç ve sunucu durum sorgusu çalıştı |
| Ziyaretçi | Liste boş durumu ve tüm sayaçlar yüklendi |
| Yeni ziyaretçi | Form açıldı; gerçek kayıt oluşturulmadı |
| Profil / Kapı seç | Dört hedef yüklendi; tümünde mobil açma desteklenmiyor bilgisi var |
| Güvenlik | Form ve güncel 8 karakter + büyük/küçük harf/rakam metni açıldı; parola değiştirilmedi |
| Tara | Native kamera başlatma hatası var; izin uyarısına yanlış eşlenmesi düzeltildi. Fiziksel kamera E2E bekliyor |

## Düzeltilen mobil hatalar

Convex yanıtındaki tam sayı değerleri `0.0` biçiminde geldiğinde Dart modellerinin `int` kontrolü özetleri ve kapı hedeflerini reddediyordu. Ortak çözücü sadece kesirsiz, sonlu, JSON güvenli aralıktaki sayıları normalize eder. Kesirler, büyük değerler ve negatif sıfır korunur. Yeni regresyon testi düzeltme öncesi kırıldı; düzeltme sonrası yukarıdaki canlı ekranlar yüklendi.

Kamera için hem iOS AVFoundation (`authorized=3`) hem izin eklentisi (`granted=1`) çalışma anında izin verildiğini doğruladı. Tarayıcının `errorBuilder` yolu native başlatma hatasını yanlışlıkla izin gereksinimi diye gösteriyordu. Generic/unsupported hataları artık yerelleştirilmiş kamera başlatma mesajı gösterir; ham native hata metni kullanıcıya aktarılmaz. İki regresyon testi eklendi.

Mobil düzeltmeler yalnız altı `mobile/**` dosyasıyla `305f227` commitine kaydedildi; push yapılmadı.

**448 Flutter testi geçti**, `flutter analyze` temiz; son iOS simülatör derlemesi kuruldu. Önceki alt bar SafeArea düzeltmesi ve regresyon testi korunuyor.

## Kalan doğrulama

Bu bir mağaza sürümü onayı değildir. Gerçek telefonda kamera ile QR okuma, desteklenen kapıda donanım sonucu ve gerçek ziyaretçi yazma akışları henüz uçtan uca doğrulanmadı. Fiziksel iPhone yansıtma önceki turda cihaz kullanımda olduğu için engelliydi. Bildirimler önceki turda bilgi sayfasıydı; push teslimatı doğrulanmış sayılmaz.

`summary.json`, `native-assertions.json`, `function-compatibility.json` ve test çıktıları kanıttır. `*-redacted.json` dosyaları sadece bilinen statik çeviri metinlerini içerir; ham ekran ağacı, kullanıcı kimliği ve QR/token içerikleri depoya alınmamıştır. `*-before` ve ilk hata ekranları düzeltme öncesini gösterir; `*-fixed` dosyaları sonuca aittir.
