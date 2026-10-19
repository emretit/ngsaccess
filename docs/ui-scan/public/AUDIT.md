# Oturumsuz (public) sayfalar — UI/UX audit (2026-10-19)

Kapsam: 10 rota — `/` · `/login` · `/register` · `/verify-email` · `/check-in` · `/demo-request` · `/user-setup` ·
`/admin-setup` · `/employee-setup` · `*` (404). Kaynak: kod (HEAD `cb22245`) + yerel sunucu ekran görüntüleri
`current/*.png` (1440 ve 390; `01-landing-scrolled*` animasyonlar tetiklendikten sonra). Önceki audit:
`docs/ux-audit/05_KABUK_DASHBOARD_GIRIS.md` (SHL-xx). Uygulama içi tasarım dili: `../DESIGN_DIRECTION.md` (A2).

**Özet:** Uygulama içi A2'ye geçti, public sayfalar geçmedi. İki farklı ürün gibi görünüyorlar: landing ve giriş ekranları
eski "şablon SaaS" dilinde (renkli ikon kutuları, gradyan + bulanık daireler, sahte gösterge paneli kartları, ✨ rozet),
durum ekranları ise biçimsiz (logo yok, h1 yok, küçük metin + tek buton). Ayrıca ürün kodunda olmayan özellikler
pazarlanıyor ve canlı web sitesi HEAD'in gerisinde.

## 0. Bloklayıcı (tasarımdan önce)

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| P-01 | 🔴 Kritik | **ngsplus.app web arayüzü HEAD'i yayınlamıyor.** Canlı CSS'te Poppins var, A2 token'ları (`--side-bg`, `--canvas`) yok; landing başlığı eski ("5 dakikada kurun", "14 gün"). Yani C1–C3 Convex'te canlı, web'de değil — eski arayüz yeni API'yi çağırıyor olabilir (handoff 2026-10-16 bu riski yazmıştı). | `curl https://ngsplus.app/assets/index-B4qHADXJ.css` → `Poppins` 2, `side-bg` 0; repo `src/index.css` → `side-bg` 4. GitHub commit status'ları boş (Netlify GitHub'a bağlı görünmüyor). |
| P-02 | 🟠 Yüksek | `index.html` her sayfada Lovable'ın `gptengineer.js` betiğini yüklüyor (üçüncü taraf kod, giriş ekranı dahil). | `index.html:55` |
| P-03 | 🟡 Orta | `og:description` "14 gün ücretsiz deneyin" diyor; ürün metni (`marketingFacts`) deneme süresi vaat etmiyor. | `index.html:19`, `src/components/landing/marketingFacts.ts:4` |

## 1. Görsel dil (modern/şık hedefinin önündeki engeller)

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| P-10 | 🟠 Yüksek | Landing ile uygulama arasında dil kopukluğu: landing renkli ikon kutusu + hover-zıplama kartları, gradyan, glow blob, nokta deseni, ✨ rozet; A2 bunların hepsini yasaklıyor. Sonuç: girişten sonra "başka ürün" hissi. | `FeaturesSection.tsx:293-296`, `HowItWorksSection.tsx:645-653`, `FinalCTASection.tsx:324-341`, `HeroSection.tsx:414-422,432-437` |
| P-11 | 🟠 Yüksek | Ürün görseli yok, sahte kart var: hero, giriş/kayıt sağ paneli ve telefon çizimi elle çizilmiş örnek kartlar (142 giriş, "NGS ACCESS" adı). Gerçek A2 ekranı (Ana Sayfa, Canlı İzleme, PDKS) gösterilmiyor. | `HeroSection.tsx:488-580`, `Login.tsx:236-307`, `Register.tsx:497-568`, `MobileAppSection.tsx:927-993` |
| P-12 | 🟠 Yüksek | Marka adı ve rengi tutarsız: "NGS ACCESS" (giriş paneli) · "NGS Plus" (logo) · "PDKS Sistemi" (başlıklar) · demo sayfasında "P" harfli sahte logo. Logo SVG parlak kırmızı, ürün bordo `#7a1f1f`; "Plus" yazısı `yellow-500` beyaz zeminde ~1,9:1 kontrast. | `Login.tsx:135,255`, `DemoRequestHero.tsx:9-11`, `src/components/ui/logo.tsx:24` |
| P-13 | 🟡 Orta | Landing'in yarısı varsayılan olarak görünmez: `whileInView` ile opacity 0 başlıyor. Tam sayfa önizleme / paylaşım kartı / yavaş cihazda "Kurulum", "Mobil" ve son CTA bölümleri boş bordo/beyaz alan. | `current/01-landing.png` vs `01-landing-scrolled.png`; `HowItWorksSection.tsx:639`, `MobileAppSection.tsx:861,920`, `FinalCTASection.tsx:345` |
| P-14 | 🟡 Orta | Mobilde ürün görseli hiç yok (hero mockup `lg` altında gizli); giriş ekranında 96px logo + "Ana sayfa" hapı formu ekranın ortasına itiyor. | `HeroSection.tsx:478`, `Login.tsx:106-134`, `current/02-login-mobil.png` |
| P-15 | 🟡 Orta | Özelliklerin 9/12'si sekme arkasında; ilk ekranda yalnız 3 kart görünüyor. Bölüm ritmi tekdüze (her bölüm ortalanmış başlık + alt metin + kart ızgarası). | `FeaturesSection.tsx:271-307` |
| P-16 | 🟡 Orta | Durum ekranları biçimsiz: logo/marka yok, h1 yok veya stilsiz `<h1>`, 12-13px metin ekranın ortasında yalnız. Altı ekran altı farklı düzen (Card, ErrorState, çıplak div, rounded-2xl kutu). | `UserSetup.tsx:86-91`, `AdminSetup.tsx:47,58`, `EmployeeSetup.tsx:63`, `CheckIn.tsx:79-82`, `NotFound.tsx:7`, `current/07..10-*.png` |
| P-17 | ⚪ Düşük | Giriş ve Kayıt sağ paneli birebir kopya (~70 satır × 2); ölü bileşenler `StatsSection`, `DemoStats` hiçbir sayfada kullanılmıyor. | `Login.tsx:236-307`, `Register.tsx:497-568`, `src/components/landing/StatsSection.tsx`, `src/components/demo/DemoStats.tsx` |

## 2. İçerik dürüstlüğü (tasarımla birlikte düzelmeli)

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| P-20 | 🟠 Yüksek | Kodda olmayan özellik pazarlanıyor: "Çalışanlarınızı Excel ile içe aktarın" (personel içe aktarma Faz C dışı, kod yok); mobilde "push bildirim" ve "çevrimdışı çalışır, otomatik senkron" (mobil kodda karşılığı bulunamadı). | `HowItWorksSection.tsx:593`, `MobileAppSection.tsx:850-851` |
| P-21 | 🟠 Yüksek | Demo sayfası "RFID kart ve biyometrik teknolojiler" diyor. KVKK 2026/921: mesai takibinde biyometri açık rızayla bile yasak — PDKS ürünü bunu vaat etmemeli. | `DemoFeatures.tsx:16`; memory `kvkk_biometric_pdks_ban` |
| P-22 | 🟡 Orta | Doğrulanmamış iddialar: "Türkiye'nin modern PDKS platformu", "IT ekibinize gerek yok", "tek satır kod gerekmez", "Hikvision uyumlu — yeni donanım almanız gerekmez" (IDE Smart da destekli ama hiç anılmıyor). | `HeroSection.tsx:437`, `HowItWorksSection.tsx:600,624`, `FeaturesSection.tsx:171` |
| P-23 | 🟡 Orta | Yasal metin yok: kayıt formu kişisel veri topluyor ama KVKK aydınlatma bağlantısı yok; footer "yasal metinler henüz yayımlanmadı" diyor. | `Register.tsx:440-479`, `LandingFooter.tsx:693` |
| P-24 | ⚪ Düşük | Mobil bölümü iki sahte mağaza rozeti + "Yakında"; personel kurulum başarısı da "mobil uygulama henüz yok" diyor. Büyük bölüm, karşılığı olmayan ürün. | `MobileAppSection.tsx:889-916`, `EmployeeSetup.tsx:104-110` |

## 3. Akış / işlev hataları (yeniden tasarımda kapanacak)

| # | Önem | Bulgu | Kanıt |
|---|---|---|---|
| P-30 | 🟠 Yüksek | Kayıttan sonra giriş ekranında **aynı uyarı iki kez** çıkıyor: `?confirmEmail=true` iken hem "Hesabınız oluşturuldu…" hem "E-posta adresiniz henüz doğrulanmamış…" kutusu render ediliyor. | `Login.tsx:142` (`showConfirmBanner && !emailNotConfirmed`) + `Login.tsx:152` (`emailNotConfirmed \|\| showConfirmBanner`) |
| P-31 | 🟠 Yüksek | Giriş ekranında "Şifremi unuttum" yok (SHL-16 hâlâ açık). Bunun yerine her ziyaretçiye formun üstünde soluk "Doğrulama bağlantısı iste" düğmesi gösteriliyor — ilk göz ağırlığı yanlış yerde. | `Login.tsx:174`, `current/02-login.png` |
| P-32 | 🟡 Orta | `/demo-request` = ikinci kayıt formu: form sayfanın en üstünde, altındaki hero'nun "Hesap oluştur" düğmesi kullanıcıyı yukarı geri kaydırıyor (ters sıra). Satış talebi alınmıyor. | `DemoRequest.tsx:31-33`, `DemoRequestHero.tsx:41-44`, `EnhancedDemoRequestForm.tsx:19` |
| P-33 | 🟡 Orta | h1 eksik: `/check-in`, `/user-setup` (hata), `/employee-setup` (hata) — ekran okuyucu için sayfa başlığı yok. Tüm rotalarda `document.title` aynı. | Playwright çıktısı `h1=""`; `index.html:7` |
| P-34 | 🟡 Orta | Koyu tema public sayfalarda test edilmemiş: `useDarkMode` global, ama telefon çizimi `bg-white`/`bg-gray-900`, mağaza rozetleri `bg-black/40` sabit. | `App.tsx:47`, `MobileAppSection.tsx:892,1011-1016` |

İlgili ama A2 tasarımından bağımsız açık kalanlar (eski audit): SHL-18 kayıt ↔ doğrulama atomik değil, SHL-23/24 davet
akışı, SHL-26 QR token ömrü. Plan bunları yalnız ekranı değiştirdiği ölçüde ele alır.
