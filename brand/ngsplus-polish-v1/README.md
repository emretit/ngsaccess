# NGS Plus — Logo polish v1

20 Ekim 2026 · Mevcut logonun karakterini koruyan rötuş ve kullanım paketi.

**Başlangıç:** `review/index.html` dosyasını tarayıcıda açın. Eski/yeni
karşılaştırmasını, farklı zeminleri ve boyutları deneyebilirsiniz.
`review/brand-board.png` paylaşılabilir sunum görselidir.

## Tasarım

- Ana renk, verilen SVG'deki **#B00016** olarak korundu.
- Piksel izlerinden oluşan çember, eşit kalınlıkta gerçek dairesel yay ile çizildi.
- N, G ve S harflerinin özgün biçimi korunarak konturları temizlendi.
- Çember uçları yuvarlatıldı, artı işareti simetrik hale getirildi.
- Tuval ve çevre boşlukları dengelendi.
- Ana sürüm 640 × 640 vektör tuval; yazı tipi gerektirmez.
- Yatay sürüm, aynı NGS harfleri ve artı işaretinden oluşur.
- Mikro N+ yalnızca çok küçük kullanım alanları için türetilmiştir.

Bu klasör ayrı bir teslim paketidir. Web ve Flutter uygulamasındaki mevcut
dosyalara entegrasyon yapılmadı. Orijinal dosyanın kopyası `source/original.svg`
altındadır.

## Hangi sürüm nerede?

| Kullanım | Dosya / klasör | Not |
|---|---|---|
| Açık zemin ana logo | `svg/ngsplus-mark-brand.svg` | Bordo, şeffaf |
| Koyu veya bordo zemin | `svg/ngsplus-mark-white.svg` | Beyaz, şeffaf |
| Nötr arayüz / belge | `svg/ngsplus-mark-ink.svg` | #18191D |
| Tam siyah baskı | `svg/ngsplus-mark-black.svg` | #000000 |
| Dar web başlığı | `svg/ngsplus-wordmark-*.svg` | Yatay NGS+ |
| Küçük tam logo | `svg/ngsplus-mark-small-*.svg` | Çember biraz daha kalın |
| 16–32 px favicon | `svg/ngsplus-micro-*.svg` | N+ |
| PNG isteyen ortamlar | `png/` | Şeffaf 256 / 512 / 1024 px |
| Web teslimi | `web/` | SVG, favicon, touch/PWA ikonları, OG görseli |
| Flutter teslimi | `flutter/` | SVG, ikon kaynakları ve üretim ayarı |
| Üretilmiş platform ikonları | `native/` | Android kaynakları ve iOS AppIcon kataloğu |
| Katmanlı kaynaklar | `platform-sources/` | Android ve Apple için ayrı ön/arka plan |

### Önerilen kullanım

- Ana yuvarlak logo: **48 px ve üzeri**; giriş/splash gibi alanlarda 96 px ve üzeri.
- Tam logo zorunlu olan 32–64 px alanlarda `mark-small` sürümünü değerlendirin.
- Yatay logo: yaklaşık **112 px genişlik ve üzeri**.
- Favicon: **16–32 px** için N+; bu işareti ana logonun yerine büyük kullanmayın.
- Logo çevresinde dış çember çapının yaklaşık %10'u kadar serbest alan bırakın.
  SVG'nin kendi payı dardır; arayüzde ek boşluk verin.
- En/boy oranını koruyun. Ek gölge, degrade veya çerçeve uygulamayın.
- Koyu zeminde bordo yerine beyaz sürümü kullanın.
- App ikonlarının yuvarlak köşelerini dosyaya işlemeyin; işletim sistemi maskeler.

## Web

`web/` içeriğini projenizin `public/branding/` klasörüne kopyalayabilirsiniz.
Örnek başlık etiketleri:

```html
<link rel="icon" href="/branding/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/branding/favicon.svg" type="image/svg+xml" sizes="any">
<link rel="apple-touch-icon" href="/branding/apple-touch-icon.png">
<link rel="manifest" href="/branding/site.webmanifest">
<meta property="og:image" content="https://ngsplus.app/branding/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

OG adresini dağıtılan alan adına göre doğrulayın. Mevcut etiketleri birleştirin;
ikinci bir manifest veya favicon tanımı eklemeyin. Manifest, kök dizinden
çalışan uygulama için hazırlanmıştır; alt dizinde yayınlanıyorsa `start_url`
ve `scope` değerlerini uyarlayın.

```html
<img src="/branding/logo-brand.svg" alt="NGS Plus" width="64" height="64">
```

Uygulamanın kendi tema durumuna göre `logo-brand.svg` / `logo-white.svg` seçin.
`favicon.svg`, işletim sisteminin açık/koyu tercihine otomatik uyum sağlar.
`current` SVG'ler yalnızca sayfaya inline eklendiklerinde üst öğenin
`currentColor` rengini miras alır; `<img>` ile kullanırken sabit renkli dosyayı seçin.

PWA için 192 ve 512 px boyutlarında `any` ve `maskable` dosyaları ayrıdır.
Maskable sürümün bütün işareti merkezdeki %80 çaplı güvenli daire içindedir.
Apple touch icon 180 px; sosyal paylaşım görseli 1200 × 630 px'dir.

## Flutter

1. `flutter/assets/branding/` klasörünü Flutter projesindeki
   `assets/branding/` konumuna kopyalayın.
2. Projenin mevcut `pubspec.yaml` dosyasındaki `flutter.assets` listesine
   `- assets/branding/` ekleyin.
3. Uygulama içindeki SVG kullanımında mevcut `flutter_svg` paketini kullanın:

```dart
final isDark = Theme.of(context).brightness == Brightness.dark;
SvgPicture.asset(
  isDark
      ? 'assets/branding/ngsplus-mark-white.svg'
      : 'assets/branding/ngsplus-mark-brand.svg',
  width: 120,
  height: 120,
  semanticsLabel: 'NGS Plus',
);
```

Yerleştirildiği yüzeyin rengi temadan farklıysa sürümü yüzeye göre seçin.
`splash-light.png` ve `splash-dark.png` şeffaf kaynaklardır; native splash
entegrasyonu bu paketin parçası değildir.

### Launcher ikonları

`flutter/flutter_launcher_icons.yaml` dosyasını Flutter projesinin köküne
kopyalayıp çalıştırın:

```sh
dart run flutter_launcher_icons -f flutter_launcher_icons.yaml
```

Projenin kurulu **flutter_launcher_icons 0.14.4** sürümüyle bu ayar ayrı
bir üretim klasöründe çalıştırılmıştır. Çıktılar `native/` altındadır.
Konfigürasyon mevcut Android/iOS ikonlarını değiştirmek üzere hazırlanmıştır.

- Varsayılan iOS kaynağı: 1024 × 1024, opak, köşeleri maskelenmemiş.
- iOS koyu kaynak: 1024 × 1024, beyaz işaret, şeffaf arka plan.
- iOS tinted kaynak: 1024 × 1024, gri tonlamalı.
- Android ön plan / monochrome: ayrı şeffaf katmanlar.
- Android arka plan: #B00016.
- Android kaynaklarında güvenli boşluk zaten vardır; ek inset **0** olmalıdır.

Hazır native dosyaları kullanırsanız Android kaynaklarını ve renk tanımını
mevcut kaynaklarla birleştirin; `colors.xml` dosyasını bütünüyle değiştirmeyin.
iOS için `native/ios/AppIcon.appiconset` kataloğu normal/koyu/tinted
görünümlerini içerir.

Apple'ın yeni katmanlı Icon Composer iş akışı için `platform-sources/`
altında ayrı ön ve arka plan verilmiştir. Bu paket bir `.icon` / Liquid Glass
projesi içermez; mevcut Flutter projesinin PNG asset catalog akışına uygundur.

## Kontrol ve yeniden üretim

- Ana SVG'ler font, gömülü bitmap, filtre veya harici dosya bağımlılığı içermez.
- Altı Flutter SVG'si projenin `vector_graphics_compiler 1.3.2` derleyicisiyle doğrulandı.
- Android ve PWA güvenli bölgeleri piksel düzeyinde kontrol edildi.
- iOS varsayılan PNG'leri, katalog boyutları ve favicon boyutları kontrol edildi.
- Ayrıntı: `review/verification.json`.
- Gerçek cihazda launcher/splash testi ve uygulama entegrasyonu yapılmadı.

`build.mjs` vektör ve raster kaynakları, `review.mjs` sunum dosyalarını üretir.
Node.js ile `sharp` ve `png-to-ico` gerekir; mevcut ngsaccess projesinde
bu bağımlılıklar bulunur. Klasör yerleşimini koruyarak proje kökünden:

```sh
node brand/ngsplus-polish-v1/build.mjs
node brand/ngsplus-polish-v1/review.mjs
```

Native boyutlar ayrıca yukarıdaki Flutter launcher komutuyla üretilir.

## Başvurulan platform belgeleri

- [Android adaptive ikonlar ve güvenli bölge](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [Apple app ikonları](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Flutter Launcher Icons ayarları](https://pub.dev/packages/flutter_launcher_icons)
- [PWA ikonları ve maskable güvenli bölge](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)
