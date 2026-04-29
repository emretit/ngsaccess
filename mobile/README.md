# NGS Plus - Yoklama Takip Uygulaması

Modern ve kullanıcı dostu bir Flutter uygulaması ile QR kod tabanlı yoklama takip sistemi.

## 🎯 Özellikler

### 🔐 Kimlik Doğrulama
- E-posta/şifre ile giriş yapma
- Kullanıcı kaydı oluşturma
- Şifre sıfırlama
- Oturum kalıcılığı (uygulamayı yeniden açtığında giriş yapmış kalma)

### 📱 Ana Sayfa
- Kişiselleştirilmiş karşılama mesajı
- Günlük yoklama durumu kartı:
  - Henüz giriş yapmadıysa: "QR Kod Tara - Giriş Yap" butonu
  - Giriş yapmış ama çıkış yapmamışsa: "QR Kod Tara - Çıkış Yap" butonu
  - Günlük yoklama tamamlanmışsa: durum özeti
- Aylık istatistikler (Toplam Gün, Mevcut Günler, Geç Kalma Sayısı)
- Günlük motivasyon mesajları

### 📊 QR Kod Tarama
- Profesyonel kamera arayüzü
- Tarama çerçevesi ve köşe işaretçileri
- Flash açma/kapama özelliği
- Demo tarama özelliği (gerçek kamera entegrasyonu için hazır)
- Otomatik giriş/çıkış tespiti
- Başarılı/başarısız tarama bildirimleri

### 📈 Geçmiş Kayıtları
- Son 50 yoklama kaydının listelenmesi
- Tarih aralığı filtresi
- Giriş/çıkış durumlarının renkli gösterimi
- Çek-yenile özelliği
- Ayrıntılı kayıt bilgileri (tarih, saat, kapı adı)

### 👥 Ziyaretçi Yönetimi
- Ziyaretçi listesi
- Yeni ziyaretçi ekleme
- Ziyaretçi durumu takibi (Bekleniyor, İçeride, Çıktı)
- Ziyaretçi giriş/çıkış işlemleri
- İstatistiksel özet kartları

### 👤 Profil Yönetimi
- Kullanıcı bilgileri görüntüleme
- Profil düzenleme seçenekleri
- Uygulama ayarları
- Güvenlik ayarları
- Tema tercihleri
- Çıkış yapma

## 🎨 Tasarım Özellikleri

### Renk Paleti
- **Açık Tema**: Birincil burgundy (#800020), Tab Bar (#F5F5F5)
- **Koyu Tema**: Birincil burgundy (#9E1B3B), Arka plan (#121212)
- Inactive gri (#6B6B6B)

### Tipografi
- **Poppins** font ailesi
- Modern ve okunabilir font boyutları
- Tutarlı font ağırlıkları

### UI Bileşenleri
- Yuvarlatılmış köşeler ve gölgeli kartlar
- Tutarlı aralık ve padding değerleri
- Responsive tasarım
- Accessibility desteği
- Skeleton loader ve spinner'lar

## 🛠 Teknik Özellikler

### Mimari
- **State Management**: Provider
- **Navigasyon**: 5 ana tab (Ana Sayfa, Geçmiş, QR Tarama, Ziyaretçi, Profil)
- **Veri Katmanı**: Convex entegrasyonu (web admin paneli ile aynı backend)
- **Yerel Depolama**: SharedPreferences (oturum yönetimi)

### Bağımlılıklar
Güncel sürümler için [pubspec.yaml](pubspec.yaml) dosyasına bakın. Öne çıkan paketler:
- `convex_flutter` — Convex backend istemcisi
- `provider` — state management
- `shared_preferences` — yerel oturum
- `mobile_scanner` — QR tarama
- `permission_handler` — kamera/depolama izinleri
- `flutter_dotenv` — env yapılandırması

## 🚀 Kurulum

### Gereksinimler
- Flutter SDK (3.5.0+)
- Dart SDK
- Android Studio / VS Code
- Çalışan bir Convex deployment (web admin paneli ile aynı)

### Adımlar

1. **Projeyi klonlayın**
```bash
git clone [repository-url]
cd ngsplusapp
```

2. **Bağımlılıkları yükleyin**
```bash
flutter pub get
```

3. **Environment dosyasını oluşturun**
```bash
cp env.example .env
```

4. **Convex yapılandırması**
`.env` dosyasını düzenleyerek Convex deployment URL'inizi girin:
```env
CONVEX_URL=https://<your-deployment>.convex.cloud
```

**⚠️ Önemli**: `.env` dosyası git'e commit edilmez. Güvenlik için bu dosyayı gizli tutun.

5. **Şema ve fonksiyonlar**
Veri şeması ve query/mutation fonksiyonları repo kökündeki `convex/` klasöründe yer alır (web admin paneli ile paylaşılır). Yeni şema değişikliklerini `npx convex dev` ile deploy edin.

6. **Uygulamayı çalıştırın**
```bash
flutter run
```

## 📱 Kullanım

### İlk Kurulum
1. Uygulamayı açın
2. "Kayıt Ol" ile yeni hesap oluşturun
3. E-posta adresinizi doğrulayın
4. Giriş yapın

### Günlük Kullanım
1. Ana sayfada yoklama durumunuzu kontrol edin
2. QR kod tarama ile giriş/çıkış yapın
3. Geçmiş sayfasından kayıtlarınızı inceleyin
4. Profil sayfasından ayarlarınızı yönetin

## 🏗 Proje Yapısı

```
lib/
├── config/
│   └── convex_config.dart        # Convex yapılandırması
├── models/
│   └── attendance.dart           # Veri modelleri
├── providers/
│   ├── auth_provider.dart        # Kimlik doğrulama yönetimi
│   └── attendance_provider.dart  # Yoklama veri yönetimi
├── screens/
│   ├── auth/                     # Giriş/kayıt ekranları
│   ├── home/                     # Ana sayfa
│   ├── history/                  # Geçmiş kayıtları
│   ├── qr_scan/                  # QR tarama
│   ├── visitor/                  # Ziyaretçi yönetimi
│   ├── profile/                  # Profil
│   ├── splash_screen.dart        # Başlangıç ekranı
│   └── main_navigation.dart      # Ana navigasyon
├── theme/
│   └── app_theme.dart           # Tema yapılandırması
└── main.dart                    # Uygulama giriş noktası
```

## 🔧 Konfigürasyon

### Tema Özelleştirme
`lib/theme/app_theme.dart` dosyasından renkleri ve stilleri özelleştirebilirsiniz.

### Notifikasyon Ayarları
QR tarama sonuçları için bildirim mesajları `lib/screens/qr_scan/qr_scan_screen.dart` dosyasından düzenlenebilir.

### İstatistik Hesaplamaları
Aylık istatistik hesaplamaları `lib/providers/attendance_provider.dart` dosyasında yapılandırılabilir.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 📞 Destek

Sorularınız için:
- Issue açın
- E-posta: support@ngsplus.com
- Dokümantasyon: [wiki sayfası]

## 🚀 Gelecek Özellikler

- [ ] Gerçek QR kamera entegrasyonu
- [ ] Push notification'lar
- [ ] Offline mod desteği
- [ ] Çoklu dil desteği
- [ ] Export/import özellikleri
- [ ] Admin paneli
- [ ] Gelişmiş raporlama
- [ ] Biometric authentication 