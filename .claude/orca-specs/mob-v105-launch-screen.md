# MOB 1.0.5 — Marka açılış ekranı (iOS + Android, native)

## Hedef (test edilebilir)
Uygulama soğuk açılışında iOS ve Android native açılış ekranı beyaz/boş değil, marka kırmızısı `#B00016` zemin üstünde ortalanmış beyaz NGS logosu gösterir; `flutter build` uyarısı "Launch image is set to the default placeholder" kalkar; koyu modda da aynı (marka ekranı).

## Bağlam
- iOS: `mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage{,@2x,@3x}.png` 1×1 şeffaf yer tutucu; `mobile/ios/Runner/Base.lproj/LaunchScreen.storyboard` beyaz zemin (`backgroundColor` 1,1,1), `imageView image="LaunchImage"` contentMode center.
- Android: `mobile/android/app/src/main/res/drawable/launch_background.xml` (+ varsa `drawable-v21/launch_background.xml`) beyaz; `values/styles.xml` + `values-night/styles.xml` LaunchTheme. Android 12+ için `values-v31/styles.xml` ile `android:windowSplashScreenBackground` + `windowSplashScreenAnimatedIcon` (yoksa ekle).
- Kaynak görsel: `mobile/assets/launcher/android-foreground.png` (beyaz logo, adaptive foreground) ve `app-icon.png`. Yeni görsel ÜRETME yerine bunlardan yeniden boyutla (python3 + Pillow varsa, yoksa `sips`). iOS LaunchImage: logo ~120pt genişlik (1x 120px, 2x 240px, 3x 360px), şeffaf arka plan, beyaz logo.

## Ownership (yalnız bunlara yaz)
`mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/**`, `mobile/ios/Runner/Base.lproj/LaunchScreen.storyboard`, `mobile/android/app/src/main/res/drawable*/launch_background.xml`, `mobile/android/app/src/main/res/values*/styles.xml` (gerekirse yeni `values-v31/styles.xml`, `values-night-v31/styles.xml`), `mobile/android/app/src/main/res/drawable*/launch_logo*.png` veya `mipmap` altında yeni launch logo dosyaları. Başka dosya yok.

## Kapsam dışı
Flutter Dart kodu (`lib/**`, `splash_screen.dart` dahil), uygulama ikonu (AppIcon/mipmap ic_launcher DEĞİŞMEZ), pubspec, Gradle, Info.plist.

## Kapılar
- `plutil -lint` gerekmez; storyboard XML geçerli olmalı: `xmllint --noout` ile storyboard ve tüm değişen XML.
- Görseller: `file` çıktısı beklenen boyut/RGBA.
- Flutter/Gradle/Xcode build ÇALIŞTIRMA (SDK kilidi koordinatörde; derlemeyi koordinatör yapar).

## Yasaklar
git add / commit / stash / reset / checkout YASAK. push/deploy YOK. `.env` okuma YOK.

## Rapor
worker_done'da ≤10 satır: değişen/yeni dosyalar, görsel boyutları, xmllint sonucu.
