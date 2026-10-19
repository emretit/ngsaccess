# NGS Plus — Public tasarım spesifikasyonu

V2 “Bordo sahne” · 19 Ekim 2026 · Tasarım teslimi, uygulama kodu değildir.

Bu belge public ekranlar için tek uygulama kaynağıdır. A2 token ailesi ve onaylı K1–K5 kararları esas alınır; PLAN.md içindeki eski seçenekler bu belgeyle geçersizdir. Ana referans `directions/V2/landing.html`; `landing-font.html` yalnız başlık fontu karşılaştırmasıdır. Diğer referanslar `login.html`, `register.html`, `status.html`. Her biri aynı dizinde `-1440.png` ve `-390.png` tam sayfa çıktısına sahiptir. HTML dosyaları yerel dosya olarak açılır, inline CSS kullanır, harici JS içermez; görseller depodaki göreli adreslerden gelir. Yalnız font karşılaştırması Google Fonts WOFF2 dosyalarını ağdan yükler.

## Tasarım kararı ve bölüm yapısı

Bordo üst sahne ürünün bordo sidebar’ına bağlanır. Büyük başlık solda, açıklama ve eylemler sağda; Ana Sayfa ekranı bandın alt kenarını aşarak açık zeminde tamamlanır. Pazarlama görseli ekranın kendisidir. Diğer içerik tipografi, hizalama ve ince çizgilerle ayrılır; özellikler sekme arkasına saklanmaz.

```
Logo / dört bağlantı / Giriş yap / Hesap oluştur
Bordo: büyük h1 | açıklama + iki eylem
        Gerçek Ana Sayfa ekranı
──────── bordodan açık zemine geçiş ────────
Hikvision / IDE Smart
Özellik özeti
Canlı İzleme     | ekran
PDKS ekranı     | PDKS metni
Geçiş Kontrol   | ekran
Vardiya ekranı  | Vardiya ve İzin metni
3 kurulum adımı + tek satırlık mobil notu
Proje, rol ve denetim kaydı
Plan ve iletişim / SSS
Bordo son CTA
Footer
```

390 px’de tüm bölümler tek sütun; hero ekranı görünür ve tam genişliktedir. Özellik satırlarında daima metin önce, görsel sonra gelir. 768–1023 px’de masaüstü nav yerine “Menü” açılır. Açılır menüde dört bölüm bağlantısı, Giriş yap ve Hesap oluştur bulunur. Menü düğmesi en az 44 px; uygulamada `aria-expanded`, `aria-controls`, Escape ile kapatma, seçim sonrası kapatma ve odağı tetikleyiciye geri verme sağlanır. Mockup native `details/summary` ile açılır. SSS native disclosure düzenidir; ilk yanıt açık başlar, diğerleri kapalıdır.

## Token’lar

A2 renkleri aynen korunur: `--canvas #fcfcfc`, `--surface #ffffff`, `--subtle #f3f3f2`, `--line #e2e2e0`, `--control #858582`, `--text #252523`, `--muted #646461`, `--primary #7a1f1f`, `--primary-hover #611919`, `--selected #f8eeee`, `--side-bg #551919`, `--side-text #f6ecea`, `--side-muted #d8bfbb`, `--side-indicator #f2c4bc`. Durum metni: A2 `--success #356047`, `--danger #963e36`, `--warning #795619`; hata yüzeyi `#faefed`, kenarlık yine nötr `--line`.

Public’e eklenen CSS değişkenleri:

| Değişken | Masaüstü | Mobil ≤600 px | Kullanım |
|---|---|---|---|
| `--public-max` | 1200px | 1200px | İçerik üst sınırı |
| `--public-gutter` | 32px | 20px | Dar görünümde sayfa kenarı; A2 uygulama içi 16px değerini değiştirmez |
| `--public-section` | 96px | 56px | Bölüm üst/alt boşluğu |
| `--public-hero-overlap` | 160px | 64px | Görselin bordo bantla kesişimi |
| `--public-form-max` | 400px | 400px | Auth formu |
| `--public-status-max` | 440px | 440px | Tek durum sayfası içerik genişliği |
| `--public-shot-shadow` | `0 16px 40px rgba(37,37,35,.08)` | Aynı | Yalnız hero ve auth ürün görseli çerçevesi |
| `--public-display` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif` | Aynı | Başlık ailesi; ana karar sistem fontu |

Public kabuk **açık tema** kullanır; `color-scheme: light` ve kabuk kapsamındaki açık A2 renkleriyle app’in global `.dark` tercihi public ekranlara sızmaz. Kullanıcının kayıtlı uygulama teması değiştirilmez. Bordo sahneler aynı kalır. `src/index.css` bazı renkleri HSL bileşenleri olarak tutar; uygulama worker’ı mevcut token temsilini korumalı, HEX değerlerini HSL bekleyen değişkenlere doğrudan atamamalıdır. Yukarıdaki renkler tasarım referansıdır; scope edilmiş `--color-*` veya eşdeğer mevcut tema kullanımını izleyin.

## Tipografi, boşluk ve kontroller

| Rol | 1440 px | 768–1023 px | 390 px |
|---|---|---|---|
| Hero h1 | 64 / 1.12 / 600 | 56 / 1.12 | 40 / 1.08 |
| Bölüm h2 | 40 / 1.12 / 600 | 40 / 1.12 | 30 / 1.12 |
| Özellik başlığı | 36 / 1.12 / 600 | 30 / 1.12 | 30 / 1.15 |
| Son CTA başlığı | 44 / 1.12 / 600 | 36 / 1.12 | 32 / 1.12 |
| Auth h1 | 36 / 1.12 / 600 | 36 / 1.12 | 30 / 1.12 |
| Durum h1 | 26 / 1.18 / 600 | 26 / 1.18 | 26 / 1.18 |
| Hero açıklaması | 19 / 1.6 / 400 | 19 / 1.6 | 17 / 1.6 |
| Ana gövde | 16 / 1.6 / 400 | 16 / 1.6 | 15 / 1.6 |
| Input / buton | 16 / 1.4, buton 15 / 600 | Aynı | Input 16 (iOS zoom yok), buton 15 |
| Label / nav | 14 / 1.6 / 500 | 14 | 14 |
| Yardım / yasal not | 12–13 / 1.6 | Aynı | 12–13 / 1.6 |

Sıra `px / line-height / weight`. Başlık harf aralığı `-.035em` (durum `-.025em`); hero mobil `-1.5px`. Gövdede normal harf aralığı. Başlığın tek kelimesi farklı renge veya italik stile ayrılmaz. Mobilde hero satır kırımı kaldırılırken kelimeler arasındaki boşluk korunur.

Ritim: 4/8/12/16/24/32/48/64/96. İçerik sütun aralığı 72; dar masaüstü 40, mobil 24–32. Hero üst 80, mobil 40. Özellik satırları üst/alt 56, mobil 32. Input ve birincil CTA 48 px; ikon ve text-link dokunma alanı ≥44 px. Kontrol radius 6; ürün çerçevesi ve durum yüzeyi 8. Kontrol kenarı 1px `--control`, bölümler 1px `--line`. Kart içinde kart yok. Hata mesajı metin + açıklama içerir; yalnız renge dayanmaz.

## Logo

`public/logo.svg` değişmez. İkon 36×36 (header), 32×32 (mobil), 30×30 (durum örneği); logotype 22px masaüstü, 20px mobil, 19px durum. Markayla ikon arasında 10px. Yazı daima “NGS Plus”; “Plus” aynı metin rengine sahiptir, sarı değildir. Ayrı `NGS` ve `Plus` span’leri varsa aynı renk mirasını kullanır.

Açık zeminde SVG doğal `#b00016` rengiyle, metin `--primary #7a1f1f` ile görünür. Bordoda SVG yalnız sunum seviyesinde `filter: brightness(0) invert(1)` ile beyaza çevrilir; metin `--side-text`. SVG kaynağı değiştirilmez, sahte harf logo yapılmaz. Metinli logoda ikon `alt=""`, bağlantı `aria-label="NGS Plus ana sayfa"`; ikon tek başınaysa `alt="NGS Plus"`.

Ölçülen kontrast: logotype/Plus bordo-beyaz **10,28:1**; açık metin-bordo **11,76:1**; muted sahne metni-bordo **7,85:1**; SVG kırmızısı-beyaz **7,35:1**. Normal gövde `--muted`/canvas **5,79:1**. A2 ürün mockup’larının kendi sidebar işareti kaynak ekran görüntüsünün parçasıdır; yeni public markası için kopyalanmaz.

## Bileşen envanteri ve prop sözleşmesi

Aşağıdakiler amaçlanan TypeScript arayüzleridir; bu teslim kod değiştirmez. Durum iş mantığı mevcut sayfada kalır. Bileşenler query/mutation çağırmaz.

```ts
type PublicAction =
  | { label: string; href: string; disabled?: boolean }
  | { label: string; onClick: () => void; disabled?: boolean };
type PublicHeaderProps = {
  variant?: 'marketing' | 'auth';
  tone?: 'light' | 'burgundy';
};
type PublicFooterProps = { variant?: 'marketing' | 'compact' };
type SectionProps = {
  id?: string;
  title?: string;
  description?: string;
  tone?: 'light' | 'burgundy';
  className?: string;
  children: React.ReactNode;
};
type ProductShotProps = {
  name: 'ana-sayfa' | 'canli-izleme' | 'pdks-kayitlari' |
    'gecis-kontrol' | 'vardiyalar' | 'izinler';
  alt: string;
  priority?: boolean;
  sizes?: string;
  caption?: string;
  elevated?: boolean;
  expandable?: boolean;
};
type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};
type StatusScreenProps = {
  title: string;
  description?: string;
  state: 'loading' | 'success' | 'error' | 'form' | 'info';
  children?: React.ReactNode;
  primaryAction?: PublicAction;
  secondaryAction?: PublicAction;
};
```

- `PublicHeader`: marketing’de dört anchor ve iki hesap eylemi; auth’ta solda logo, sağda “Ana sayfa”. Header sticky değildir. Mobil menü yalnız marketing’de. Bordo üstünde açık CTA, açık yüzeyde bordo CTA.
- `PublicFooter`: marka, “Personel ve geçiş yönetimi.”, Özellikler, İletişim, Giriş yap; alt çizgide yıl ve bilgi/aydınlatma talebi e-postası. Compact sürüm destek e-postası ve ana sayfa bağlantısını koruyabilir; ana referans görsellerde tam footer gösterilmiştir. Var olmayan yasal rotalara link yok.
- `Section`: `section` semantiği; title varsa h2 ve bağlı `aria-labelledby`; dört özellik satırı `article`, başlıkları h3. Section içine yeni Section/kart yığılmaz.
- `ProductShot`: `/marketing/{name}-800.webp` ve `-1600.webp` srcset; `width=1600 height=1000`, doğal oran 1.6. Hero `fetchPriority="high"` ve eager, diğerleri lazy. Hero sizes `(max-width: 600px) calc(100vw - 40px), (max-width: 1264px) calc(100vw - 64px), 1200px`; özellikler `(max-width: 600px) calc(100vw - 40px), 650px`. Gölge yalnız `elevated=true` ve hero/auth kullanımında. Büyük görsel bağlantısı gerçek WebP’ye gider, caption örnek veri olduğunu söyler. Mobilde display:none yapılmaz.
- `AuthShell`: ≥1024 px’de iki eşit sütun; sol form max400, üstte küçük logo; sağda düz bordo, ürün metni ve Ana Sayfa ekranı. Min-height 860px fakat form büyürse sayfa doğal uzar. Mobil/tablet sağ panel kalkar; formun üzerinde boş dekoratif alan kalmaz. Form alanları `FormFieldWrapper` ve `PasswordField` ile mevcut schema adlarını korur.
- `StatusScreen`: tek sayfada `main`, tek h1, marka ve max440px içerik. Desktop sayfa içinde merkez, mobil üst kenardan 32px sonra başlar, yanlarda20px; form uzunsa normal kaydırılır. Kutunun iç padding’i 24/32; yüzey sınırı 1px line, gölge yok. Başarı/hata işareti çıplak 28px çizgi ikon; renkli ikon kutusu yok. Katalogdaki her kutu ayrı sayfa örneğidir; katalog başlığı/rota etiketleri ve ızgara uygulamaya taşınmaz. Katalog h2’leri gerçek sayfada h1 olur. Loading’de h1 kalır; `SectionSkeleton` yalnız içerikte `role=status`, `aria-busy=true`. Başarı metni polite live region, hata `role=alert`. Tüm sayfayı live region içine koymayın.

## Erişilebilirlik ve hareket

İçerik ilk render’da görünür. Mockup’larda giriş animasyonu yok. Uygulamada istenirse yalnız hero’ya tek 160ms CSS opacity geçişi; reduced-motion’da tamamen kapalı, JS veya intersection gözlemcisi görünürlüğün ön koşulu değildir. Bounce/stagger/hover zıplama yok. SSS ve menü açılışı için hareket zorunlu değildir. Reduced-motion’da smooth-scroll kapanır.

Her rota anlamlı document.title + tek h1 taşır. Skip link main’e gider. Odak 2px primary, offset3; bordoda side-indicator. Form hatası alana `aria-describedby` ile bağlanır, ilk geçersiz alan odaklanır. Genel kimlik doğrulama hatası role=alert; fieldset yalnız isteğin sürdüğü zamanda disabled. Şifre göster/gizle 44px ikon butonu, doğru `aria-label` ve `aria-pressed`; gerçek davranış mevcut `PasswordField`’dan gelir. Mockup butonları statik tasarım temsilleridir ve oturum/backend işlemi yapmaz. E-posta inputu autocomplete=email, login current-password, yeni şifre new-password. Durum başlıkları kod adı veya teknik hata dökümü içermez.

Yasaklar: renkli ikon kutusu tekrarı; kart içinde kart; genel gölge; her yerde büyük radius; gradyan, glow, cam efekti, bulanık daire, nokta deseni; renkli dekoratif sınır; emoji; büyük harf bölüm etiketleri; parıltı rozeti; hover ile yer değiştirme. Durum ikon rengi, alan hata sınırı ve birincil CTA bu dekorasyon yasağının dışında işlevsel semantiktir. Özellikler için numara yok; yalnız üç kurulum adımı numaralıdır.

## Akış kuralları ve rota başlıkları

| Rota | document.title | Davranış |
|---|---|---|
| `/` | Personel ve geçiş yönetimi · NGS Plus | Landing bölüm sırası sabit |
| `/login` | Giriş yap · NGS Plus | Tek uyarı, yardım disclosure |
| `/register` | Hesap oluştur · NGS Plus | Mevcut 5 alan; ayrı rıza checkbox’ı eklenmez |
| `/verify-email` | E-posta doğrulama · NGS Plus | Yükleniyor/başarı/hata/yeniden iste |
| `/user-setup` | Daveti kabul et · NGS Plus | Yeni/mevcut hesap seçimi korunur |
| `/admin-setup` | Yönetici kurulumu · NGS Plus | Zaten kurulu/form/yükleniyor/tamam |
| `/employee-setup` | Şifre belirle · NGS Plus | Bağlantı durumu/şifre/başarı |
| `/check-in` | QR ile giriş · NGS Plus | Mobil öncelikli, sonuç belirsizliği ayrılır |
| `/demo-request` | Hedef başlığı | `/register` yönlendirmesi; query’de hassas token aktarılmaz |
| `*` | Sayfa bulunamadı · NGS Plus | Ana sayfa + giriş bağlantısı |

Login önceliği: `showConfirmBanner || emailNotConfirmed` tek bilgi alanını açar. Kayıttan gelindiyse kayıt sonrası metni; yalnız doğrulanmamış giriş hatası varsa doğrulanmamış metni. Aynı anda iki kutu yok. Yeniden doğrulama eylemi yalnız bu alanda görünür, normal girişte yok. E-posta yoksa gönderim düğmesi disabled ve e-posta alanına yönlendiren yardım görünür. 60 saniyelik mevcut cooldown korunur. Şifremi unuttum bir satır içi açıklama açar; yeni şifre akışı/API/pencere yok.

UserSetup davet e-postası readonly/disabled olarak kalır. Mevcut hesap modunda şifre tekrarı ve yeni şifre kuralları gizlenir; mevcut şifre istenir. Yeni moddaki güçlü şifre kuralları korunur. AdminSetup yeni hesap için mevcut en az8 kuralı, existing modunda mevcut şifreyi kullanır; kurulum kodu gizlenebilir alandır. Başarıda oturum henüz hazır değilse “Oturum hazırlanıyor…” disabled eylemi gösterilir; user verified olduktan sonra `/home` için “Yönetim alanına geç”. Personel kurulum başarısı yönetici login’e zorlamaz; yöneticiye danışma + mevcut mobil notu gösterilir.

CheckIn başarı yalnız backend success sonrası. Kayıt kişi/zaman bilgisi backend’den gelir; mockup’taki Ayşe Demir ve tarih sabit üretim verisi değildir. İstanbul saat dilimiyle gösterin. Konum eklenme bilgisi yalnız `locationRecorded === true`; aksi durumda “Konum bilgisi eklenemedi.”. Ağ sonucu belirsizken “yeniden tara” veya tekrar kaydet düğmesi yok; önce yöneticiden kayıt kontrolü istenir. Token eksik/geçersiz/süresi dolmuşsa güncel QR giriş bağlantısı önerilir. Yeni mobil uygulama indirme bağlantısı veya mağaza rozeti eklenmez. Bu ayrım mevcut mutation/token güvenliğini değiştirmez.

## Metin

Aşağıdaki metinler son haldir; uygulamada kelimesi kelimesine kullanılır. Pazarlama metinleri `src/components/landing/marketingFacts.ts` içine tek kaynak olarak taşınır; bu tasarım teslimi o dosyaya dokunmaz. HTML `<br>` satır kırımı dışında metin değiştirmez. Auth ve durum metinleri ilgili ortak sabitlere veya mevcut sayfalara alınabilir.

### Pazarlama sabitleri

```json
{
  "accountCta": "Hesap oluştur",
  "accountDescription": "Bu işlem bir kullanıcı hesabı oluşturur. Satış talebi göndermez ve ücretli plan satın almaz.",
  "setupDescription": "Hesabınızı oluşturun, projenizi adım adım hazırlayın.",
  "planDescription": "Plan kapsamı, çalışan kapasitesi ve ücretlendirme kuruluşunuzun ihtiyaçlarına göre netleştirilir. Hesap oluşturmak ücretli plan satın almaz.",
  "mobileDescription": "Mobil uygulama yakında. Şimdilik işyerinizin web QR girişini kullanın; erişim için yöneticinize başvurun.",
  "heroTitle": "İşyerindeki hareketi <br>tek yerden yönetin.",
  "heroDescription": "Personel girişlerini, kapı yetkilerini ve çalışma planlarını NGS Plus ile aynı yerde takip edin.",
  "productCaption": "NGS Plus ürün ekranı · Örnek proje ve kayıtlar",
  "authTitle": "İşyerinizin günlük akışı,<br>aynı ekranda.",
  "authDescription": "Giriş kayıtlarından çalışma planlarına, yetkili olduğunuz projenin verileriyle çalışın.",
  "privacyNote": "Kişisel verileriniz hesap oluşturmak için işlenir. Aydınlatma metnini talep etmek için info@ngsplus.app adresine yazabilirsiniz.",
  "forgotHelp": "Şifrenizi yöneticiniz sıfırlayabilir. Yöneticinize ulaşamıyorsanız info@ngsplus.app adresine yazın.",
  "loginError": "Giriş yapılamadı. E-posta adresinizi ve şifrenizi kontrol edin.",
  "confirmNotice": "Hesabınız oluşturuldu. Giriş yapmak için e-posta adresinizi doğrulayın. Gelen kutunuzu ve spam klasörünü kontrol edin; yeniden kayıt olmanız gerekmez.",
  "emailNotConfirmed": "Giriş yapmak için e-posta adresinizi doğrulayın. Gelen kutunuzdaki doğrulama bağlantısını açın veya yeni bağlantı isteyin.",
  "resendDone": "Doğrulama gerekiyorsa bağlantı gönderimi istendi. Gelen kutunuzu ve spam klasörünü kontrol edin."
}
```

### Landing bölüm metinleri

Header bağlantıları: **Özellikler · Nasıl çalışır? · Güvenlik · İletişim**. Hesap eylemleri: **Giriş yap · Hesap oluştur**. Mobil tetikleyici: **Menü**. Hero ikincil eylemi: **Özellikleri incele**.

Donanım şeridi: **Kart okuyucu entegrasyonları**; **Hikvision**; **IDE Smart**; “Model ve bağlantı uygunluğunu birlikte değerlendirelim.”

Özellik bölümü başlığı: **Günün tamamı. Aynı çalışma alanı.** Açıklaması: “Kapıdaki ilk geçişten çalışma raporuna kadar, ihtiyacınız olan kayıtlar ve kontroller bir arada.”

#### Canlı İzleme

**Geçişleri olurken görün.**

İşyerinizdeki kart okumalarını tek akışta izleyin.

- İzin verilen ve reddedilen geçişleri ayırt edin.
- Personel, cihaz ve zaman bilgilerini inceleyin.
- Akışı duraklatıp kayıtları kendi hızınızda kontrol edin.

#### PDKS Kayıtları

**Çalışma gününü kayıtlardan okuyun.**

Giriş ve çıkış kayıtlarını inceleyin, raporlarınızı hazırlayın.

- Kayıtları kişi ve tarih aralığına göre süzün.
- Sonuçları Excel veya PDF olarak dışa aktarın.
- PDKS yapay zekâ asistanına kayıtlarınızla ilgili soru sorun.

#### Geçiş Kontrol

**Kimin, hangi kapıdan geçeceği belli olsun.**

Geçiş kurallarını projenizdeki kapılar ve kişiler için düzenleyin.

- Kişi ve grupların kapı yetkilerini yönetin.
- Kuralların gün ve saat aralıklarını belirleyin.
- Ziyaretçi kayıtlarını aynı projede takip edin.

#### Vardiya ve İzin

**Plan ile kaydı birlikte takip edin.**

Çalışma takvimini ve izinleri aynı yönetim alanında tutun.

- Personelin vardiya atamalarını planlayın.
- İzin kayıtlarını ve onay durumlarını takip edin.
- Günlük çalışma planını takvim üzerinde inceleyin.

Vardiya satırı ek bağlantısı: **İzinler ekranını incele** → `/marketing/izinler-1600.webp`.

Kurulum başlığı: **Çalışma alanınızı adım adım hazırlayın.** Açıklama `setupDescription`.

1. **Projenizi açın.** Hesabınızı oluşturun ve çalışma alanınızı bir proje altında hazırlayın.
2. **Cihazlarınızı bağlayın.** Uyumlu kart okuyucuları projenize ekleyin, kapı ve okuyucu eşleştirmelerini yapın.
3. **Kişileri ve kuralları ekleyin.** Personeli tanımlayın, geçiş yetkilerini ve çalışma planını düzenleyin.

Ardından yalnız `mobileDescription` gösterilir; ayrı mobil bölümü yok.

Güvenlik başlığı: **Erişimi tanımlayın. İşlemleri izleyin.** Açıklama: “Proje, rol ve denetim kaydıyla yönetim alanınızın sınırlarını belirleyin.” Not: “Kişisel verilerin işlenmesine ilişkin bilgi ve aydınlatma metni talepleriniz için info@ngsplus.app.”

- **Proje bazlı erişim:** Kullanıcılar, yetkili oldukları projelerin verileriyle çalışır.
- **Roller ve yetkiler:** Yönetim işlemlerini kullanıcının rolüne göre sınırlandırın.
- **Denetim kaydı:** Yönetim işlemlerinin kayıtlarını inceleyin.

Plan başlığı: **İşyerinize uygun kapsamı konuşalım.** Açıklama `planDescription`. Alt not: “Plan ve kullanım koşulları için bize ulaşın.” İletişim: **info@ngsplus.app** → `mailto:info@ngsplus.app`; **0 (212) 577 35 72** → `tel:+902125773572` (mevcut LandingFooter kaynağındaki numara). Ek not: “Cihaz uyumluluğu ve kurulum için de yazabilirsiniz.”

SSS başlığı: **Merak ettikleriniz.**

- **Hesap oluşturduğumda ne olur?** Bu işlem bir kullanıcı hesabı oluşturur. Satış talebi göndermez ve ücretli plan satın almaz.

- **Mevcut kart okuyucularımı kullanabilir miyim?** Hikvision ve IDE Smart entegrasyonları desteklenir. Modelinizin ve bağlantı yönteminizin uygunluğunu kurulumdan önce bizimle değerlendirin.

- **QR ile giriş nasıl çalışır?** İşyerinizin web QR giriş bağlantısı üzerinden giriş kaydı oluşturabilirsiniz. Erişim ve kurulum için yöneticinize başvurun.

- **Raporları dışa aktarabilir miyim?** PDKS kayıtlarını Excel veya PDF olarak dışa aktarabilirsiniz.

- **Birden fazla projeyi yönetebilir miyim?** Yetkili olduğunuz projeler arasında geçiş yapabilir, her projenin verileriyle ayrı çalışabilirsiniz.

- **Plan ve kullanım koşullarını nasıl öğrenebilirim?** Plan kapsamı, çalışan kapasitesi ve ücretlendirme için info@ngsplus.app adresine yazın veya 0 (212) 577 35 72 numarasını arayın.

Son CTA: **İşyerinizi NGS Plus ile yönetmeye başlayın.** Altında `accountDescription`, eylem `accountCta`. Footer: **Personel ve geçiş yönetimi.** Alt satır: **© {yıl} NGS Plus**; **Bilgi ve aydınlatma metni talepleri: info@ngsplus.app**. Footer bağlantıları **Özellikler · İletişim · Giriş yap**.

### Auth metinleri

| Konum | Son metin |
|---|---|
| Login h1 | NGS Plus’a giriş yapın. |
| Login açıklaması | İşyerinizin yönetim alanına devam edin. |
| Normal alanlar | E-posta · Şifre |
| Yardım tetikleyici | Şifremi unuttum |
| Form eylemi | Giriş yap |
| Çalışan istek | Giriş yapılıyor… |
| Alt bağlantı | Hesabınız yok mu? Hesap oluştur |
| Hata özeti başlığı | Bilgilerinizi kontrol edin |
| Doğrulama özeti başlığı | E-posta doğrulaması bekleniyor |
| Doğrulama eylemi | Doğrulama bağlantısını tekrar iste |
| Register h1 | NGS Plus hesabınızı oluşturun. |
| Register açıklama | Hesabınızı oluşturun, projenizi adım adım hazırlayın. |
| Alanlar (schema adları değişmez) | Ad · Soyad · Firma adı · E-posta · Şifre |
| Şifre yardımı | En az 8 karakter kullanın. |
| Form eylemi | Hesap oluştur |
| Çalışan istek | Hesap oluşturuluyor… |
| Register alt bağlantı | Zaten hesabınız var mı? Giriş yap |
| Ortak destek | Yardıma ihtiyacınız varsa info@ngsplus.app |
| Auth üst bağlantı | Ana sayfa |
| Sağ panel alt not | Personel ve geçiş yönetimi · NGS Plus |
| Şifre görünürlük etiketleri | Şifreyi göster · Şifreyi gizle |
| İlk admin yokken koşullu bağlantı | İlk yönetici kurulumu |

Yasal not `privacyNote`, hesap açıklaması `accountDescription`; ikisi kayıt formu eyleminin altında ayrı küçük paragraflardır. Sağ panel başlık/açıklama `authTitle` ve `authDescription`. Login `loginError`, `confirmNotice`, `emailNotConfirmed`, `forgotHelp`, `resendDone` sabitlerini kullanır.

### Durum ekranlarının metinleri

Katalog `status.html` 18 örnek içerir. Aşağıdaki `/home` eylemleri katalogda canlı yönetime gitmemek için ana alana bağlanır; uygulamada `/home` kullanılır.

| Rota / durum | h1 | Açıklama | Birincil eylem |
|---|---|---|---|
| `/verify-email` / Yükleniyor | E-postanız doğrulanıyor. | Doğrulama bağlantınız kontrol ediliyor. Bu sayfayı açık tutun. | Form / destek aşağıda |
| `/verify-email` / Başarılı | E-postanız doğrulandı. | Artık NGS Plus hesabınızla giriş yapabilirsiniz. | Giriş yap |
| `/verify-email` / Hata + yeniden gönder | Bağlantınızın süresi dolmuş. | E-posta adresinizi yazın ve yeni doğrulama bağlantısı isteyin. | Form / destek aşağıda |
| `/user-setup` / Geçersiz davet | Davet bağlantısı geçersiz. | Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni davet isteyin. | Giriş yap |
| `/user-setup` / Yeni hesap formu | Davetinizi kabul edin. | Davetiniz doğrulandı. Yeni bir hesap oluşturun veya mevcut hesabınızla devam edin. | Form / destek aşağıda |
| `/user-setup` / Tamamlandı | Hesabınız etkinleştirildi. | Projenizin yönetim alanına geçebilirsiniz. | Yönetim alanına geç |
| `/admin-setup` / Zaten kurulu | İlk yönetici kurulumu tamamlanmış. | Mevcut yönetici hesabınızla giriş yapabilirsiniz. | Giriş yap |
| `/admin-setup` / Kurulum formu | İlk yöneticiyi oluşturun. | İlk yönetici hesabını kurulum sorumlusundan aldığınız kodla etkinleştirin. | Form / destek aşağıda |
| `/admin-setup` / Tamamlandı | Yönetici kurulumu tamamlandı. | NGS Plus yönetim alanına geçebilirsiniz. | Yönetim alanına geç |
| `/employee-setup` / Geçersiz bağlantı | Şifre bağlantısı geçersiz. | Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni bir şifre belirleme bağlantısı isteyin. | Form / destek aşağıda |
| `/employee-setup` / Şifre formu | Şifrenizi belirleyin. | Personel hesabınız için bir şifre oluşturun. | Form / destek aşağıda |
| `/employee-setup` / Başarılı | Şifreniz belirlendi. | Personel hesabınız etkinleştirildi. QR giriş adresi ve kurulum yardımı için yöneticinize başvurun. | Form / destek aşağıda |
| `/check-in` / Yükleniyor | Girişiniz kaydediliyor. | Konum bilgisi bekleniyor… | Form / destek aşağıda |
| `/check-in` / Başarılı | Girişiniz kaydedildi. | Bu sayfayı kapatabilirsiniz. | Form / destek aşağıda |
| `/check-in` / Sonuç belirsiz | Giriş sonucu alınamadı. | Yeni kod taramadan önce yöneticinizden giriş kaydınızı kontrol etmesini isteyin. | Form / destek aşağıda |
| `/check-in` / Geçersiz bağlantı | Giriş bağlantısı geçersiz. | İşyerinizdeki güncel QR giriş bağlantısını kullanın. Yardım için yöneticinize başvurun. | Form / destek aşağıda |
| `*` / 404 | Bu sayfayı bulamadık. | Bağlantı değişmiş veya adres yanlış yazılmış olabilir. Ana sayfadan devam edebilirsiniz. | Ana sayfaya dön |
| `/user-setup` / Mevcut hesap formu | Davetinizi kabul edin. | Davet edilen e-posta adresine ait mevcut hesabınızla devam edin. | Form / destek aşağıda |

Durum formu alan ve eylemleri:

- Verify-email hata: **E-posta**; **Yeni doğrulama bağlantısı iste**; ikincil **Zaten doğruladıysanız giriş yapın**.
- User-setup: **Mevcut hesabımla devam et** / **Yeni hesap oluştur** mod düğmesi; **E-posta**, **Yeni şifre**, **Şifre tekrarı**; mevcut modda **Mevcut şifreniz**; eylem **Daveti kabul et**; pending **Davet kabul ediliyor…**.
- Yeni kullanıcı/personel şifre yardımı: **Yeni şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.** Kurallar ayrı işaretlenecekse: **En az 8 karakter · Büyük harf · Küçük harf · Rakam**. Sadece başarı rengini kullanmayın; koşul karşılandı/karşılanmadı bilgisi erişilebilir metinle de verilsin.
- Admin-setup: **Mevcut hesabımla devam et** / **Yeni hesap oluştur**; **E-posta**, **Şifre**, **Kurulum kodu**; yardım **Yeni hesap şifresi en az 8 karakter olmalıdır.**; kod yardımı **Kurulum kodunu bilmiyorsanız kurulum sorumlusuna başvurun.**; eylem **Yönetici hesabını etkinleştir**; pending **Kurulum tamamlanıyor…**. Mevcut hesap yardımı **Mevcut hesabınızın şifresini kullanın.**
- Employee-setup: **E-posta: {email}** yalnız biliniyorsa; **Yeni şifre**, **Şifre tekrarı**; eylem **Şifremi belirle**; pending **Kaydediliyor…**. Başarı sonrası `mobileDescription`.
- Check-in yükleniyor: **Konum bilgisi bekleniyor…** → **Giriş kaydediliyor…**; yardım **Konum alınamazsa kayıt, konum eklenmeden oluşturulur.**; geçiş bildirimi **Konum alınamadı; giriş kaydı konum eklenmeden oluşturuluyor.**; desteklenmeyen tarayıcı **Bu tarayıcı konum bilgisi sağlayamıyor; konum eklenmeden devam ediliyor.**
- Check-in başarı alanları: **Personel · Tarih · Saat**; zaman dilimi eki **İstanbul**; konum eklendi **Konum bilgisi kayda eklendi.**; konum eklenemedi **Konum bilgisi eklenemedi.**
- Kurulum geçersiz/sonuç belirsiz ikincil bağlantısı: **Destek: info@ngsplus.app** (mailto). 404 ikincil: **Hesabınıza giriş yapın**.

### İkincil durumlar, doğrulama ve hata sözlüğü

Bu metinler mockup’ın statik görünümüne sığmayan koşulları tamamlar. Backend iş mantığına yeni başarı veya hata koşulu eklemez. API’den gelen teknik hata, token veya stack trace kullanıcıya basılmaz.

| Koşul | Son metin |
|---|---|
| E-posta geçersiz | Geçerli bir e-posta adresi girin. |
| Login şifre boş | Şifrenizi girin. |
| Kayıt ad boş | Adınızı girin. |
| Kayıt soyad boş | Soyadınızı girin. |
| Firma boş | Firma adını girin. |
| Kayıt kısa şifre | Şifre en az 8 karakter olmalıdır. |
| Kayıt genel hata | Hesap oluşturulamadı. Bilgilerinizi kontrol edin; mevcut hesabınız varsa giriş yapın. |
| Kayıt sayfası yükleniyor h1 | Hesap bilgileri kontrol ediliyor. |
| Login sayfası yükleniyor h1 | Oturumunuz kontrol ediliyor. |
| İlk admin bağlantısı | İlk yönetici kurulumu |
| Yeniden gönderim e-posta boş | Doğrulama bağlantısı istemek için e-posta adresinizi girin. |
| Gönderim sürüyor | Gönderiliyor… |
| Gönderim bekleme | {saniye} saniye sonra tekrar isteyin |
| Gönderim hata | Gönderim istenemedi. Birkaç dakika sonra yeniden deneyin. |
| Verify token eksik başlık | Doğrulama bağlantısı eksik. |
| Verify token eksik açıklama | E-posta adresinizi yazın ve yeni doğrulama bağlantısı isteyin. |
| Verify geçersiz/kullanılmış başlık | Doğrulama tamamlanamadı. |
| Verify geçersiz/kullanılmış açıklama | Bağlantı geçersiz veya daha önce kullanılmış. Hesabınız doğrulanmışsa giriş yapın; aksi halde yeni bağlantı isteyin. |
| User davet sorgusu başlık | Davetiniz kontrol ediliyor. |
| User davet sorgusu açıklama | Davet bilgileri yükleniyor. Bu sayfayı açık tutun. |
| User yanlış davet tipi | Bu ekran yalnız hesap davetleri içindir. Şifre yardımı için yöneticinizle iletişime geçin. |
| User yeni şifre geçersiz | Şifre gereksinimlerini ve şifre tekrarını kontrol edin. |
| User davet kabulü hata | Davet kabul edilemedi. Bilgilerinizi kontrol edin. Hesabınız oluştuysa mevcut hesap seçeneğiyle devam edin; sorun sürerse yöneticinizden yeni davet isteyin. |
| Başarı sonrası oturum bekleme eylemi | Oturum hazırlanıyor… |
| Admin sorgusu başlık | Kurulum kontrol ediliyor. |
| Admin sorgusu açıklama | Yönetici hesabının durumu yükleniyor. |
| Admin form eksik/geçersiz | E-posta, şifre ve kurulum kodunu kontrol edin. Yeni hesap şifresi en az 8 karakter olmalıdır. |
| Admin kurulum hata | Kurulum tamamlanamadı. Bilgilerinizi ve kurulum kodunu kontrol edin. Hesabınız oluştuysa mevcut hesap seçeneğiyle devam edin veya kurulum sorumlusuna başvurun. |
| Employee bağlantı sorgusu başlık | Bağlantınız kontrol ediliyor. |
| Employee bağlantı sorgusu açıklama | Şifre belirleme bağlantısı doğrulanıyor. |
| Employee bağlantı süresi dolmuş | Bu şifre belirleme bağlantısının süresi dolmuş. Yöneticinizden yeni bağlantı isteyin. |
| Employee kaydetme hata | Şifre belirlenemedi. Bağlantınızın süresi dolmuş veya kullanılmış olabilir. Yöneticinizden yeni bağlantı isteyin. |
| Check-in bilinen reddetme başlık | Girişiniz kaydedilemedi. |
| Check-in bilinen reddetme açıklama | Giriş bağlantısını yöneticinizle kontrol edin. |
| Check-in süresi dolmuş başlık | Giriş bağlantısının süresi dolmuş. |
| Check-in süresi dolmuş açıklama | İşyerinizdeki güncel QR giriş bağlantısını kullanın. Yardım için yöneticinize başvurun. |

Check-in bilinen iş kuralı hata mesajı daha açıklayıcıysa mevcut doğrulanmış kullanıcı mesajı korunabilir; teknik hata halinde tabloda verilen fallback kullanılır. Metinler bilinmeyen sonucu “kayıt başarısız” diye kesinleştirmez. Kayıt sonrası e-posta gönderimi başarısızlığı `verificationQueued` üzerinden biliniyorsa doğrulama alanı tek kalır, açıklama: **Hesabınız oluşturuldu. Doğrulama e-postasının gönderimi tamamlanamadı. E-posta adresinizle yeni bağlantı isteyin; yeniden kayıt olmanız gerekmez.**

## Ürün görselleri ve kaynak doğrulaması

Görseller DB kullanılmadan A2 HTML’lerinden Playwright Chromium ile 1440×900 viewport’ta çekildi; mockup senaryo araçları screenshot sırasında gizlendi, kaynak dosyalar değişmedi. Görseller sharp ile 1600×1000 ve 800×500 boyutlarına dönüştürüldü. 1440 kaynaktan 1600’e ölçekleme teslim koşuludur; piksel yoğunluğu2 çekilmiş yeni/uydurma ürün arayüzü değildir. WebP kalite76/82, effort6. İsimler üretim kullanımına hazırdır.

| WebP | Ölçü | Byte | KB (1000) |
|---|---|---:|---:|
| `ana-sayfa-1600.webp` | 1600×1000 | 40964 | 40.96 |
| `ana-sayfa-800.webp` | 800×500 | 18110 | 18.11 |
| `canli-izleme-1600.webp` | 1600×1000 | 50816 | 50.82 |
| `canli-izleme-800.webp` | 800×500 | 22006 | 22.01 |
| `pdks-kayitlari-1600.webp` | 1600×1000 | 43590 | 43.59 |
| `pdks-kayitlari-800.webp` | 800×500 | 19454 | 19.45 |
| `gecis-kontrol-1600.webp` | 1600×1000 | 41500 | 41.50 |
| `gecis-kontrol-800.webp` | 800×500 | 18034 | 18.03 |
| `vardiyalar-1600.webp` | 1600×1000 | 56122 | 56.12 |
| `vardiyalar-800.webp` | 800×500 | 24742 | 24.74 |
| `izinler-1600.webp` | 1600×1000 | 41614 | 41.61 |
| `izinler-800.webp` | 800×500 | 18444 | 18.44 |

Ana Sayfa → `docs/ui-scan/pages/01-ana-sayfa/mockup.html`; Canlı İzleme → `07-canli-izleme`; PDKS Kayıtları → `08-pdks-kayitlari`; Geçiş Kontrol → `05-gecis-kontrol`; Vardiyalar → `09-vardiyalar`; İzinler → `10-izinler`. Diğer kaynakların tamamı aynı `pages/{dizin}/mockup.html` yolundadır. Hero büyük dosya **40.964 byte <150.000 byte**. Alt metinler HTML’lerde bulunur; tüm ekranların caption’ı `productCaption`.

İddiaların yerel kod kanıtı:

| Metin | Kanıt |
|---|---|
| Web QR giriş | `src/pages/CheckIn.tsx` |
| Hikvision / IDE Smart | `src/components/admin/AdminDevicesPanel.tsx`, `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx`, `src/components/admin/IdeProvisioningCard.tsx` |
| Kapı/grup yetkisi, gün/saat | `src/components/access-control/unified/CreateRuleDialog.tsx`, `components/TimeSchedule.tsx` |
| Canlı akış/duraklat | `src/components/live-monitoring/useLiveReadings.ts`, `lib/feed.ts` |
| Excel/PDF ve AI sohbet | `src/components/pdks/PDKSAiChat.tsx`, `chat/useExportUtils.ts`, `AiDrawer.tsx` |
| Vardiya/izin | `src/components/shifts/ShiftCalendarView.tsx`, `src/pages/Leaves.tsx` |
| Ziyaretçi | `src/components/visitors/VisitorManagement.tsx` |
| Proje/rol/denetim | `src/pages/AuditLog.tsx`, `src/components/auth/AuthProvider.tsx`, mevcut proje seçici |

Personel içe aktarma, push bildirim, çevrimdışı çalışma, biyometrik PDKS, garantili mevzuat uyumu, fiyat/deneme süresi, müşteri/referans sayısı ve üstünlük iddiaları kullanılmaz. Güvenlik bölümü yalnız proje erişimi, rol ve denetim kaydını anlatır; hukuki uygunluk garantisi vermez. Kişisel veri metni kullanıcı onaylı kısa bilgilendirmedir; hukuki sayfa üretilmemiştir.

## Display font karşılaştırması

Asıl tasarım sistem fontudur. `landing-font.html` yalnız h1/h2/h3 için **Plus Jakarta Sans 600** önerisini gösterir; logo, gövde, nav ve kontroller sistem fontunda kalır. Google Fonts’tan gelen Latin ve Latin-ext iki WOFF2 dosyası Türkçe karakterleri kapsar: **27.272 + 21.688 = 48.960 byte (48,96 KB)**. Google CSS 600 ve700 tanımlarını aynı iki dosyaya bağlar; dosyalar tekrar indirilmez. HTML’de 600 kullanılır, `font-display: swap`. Yeni font production dependency’si veya font dosyası repoya eklenmemiştir. Font seçimi sistem fontu kararını değiştirmez; varyant inceleme içindir.

Kaynak: [Google Fonts — Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans). Ölçülen dosyalar: [Latin WOFF2](https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yygg_vb.woff2), [Latin-ext WOFF2](https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko40yygg_vbd-E.woff2). Ölçüm tarihi 19 Ekim2026. Tarayıcı font setinde iki600 yüzünün `loaded` olduğu ayrıca kontrol edildi.

## Audit bulgularının tasarım karşılığı

| Bulgu | Karşılık / tamamlanma sınırı |
|---|---|
| P-01 | Deploy sorunu tasarımla çözülemez; koordinatörün yayın kapısı. Bu teslim deploy yapmaz. |
| P-02 | Public HTML’lerde üçüncü taraf JS yok. Canlı `gptengineer.js` kaldırımı index sahibi worker/koordinatörün işi. |
| P-03 | Meta açıklaması son `heroDescription` ile aynı olmalı. Deneme süresi vaadi kaldırılır; index dosyasına bu teslim dokunmadı. |
| P-10 | A2 aile, düz bordo sahne, çizgiyle ayrılan açık içerik. |
| P-11 | Altı gerçek A2 ürün ekranı; fake dashboard/telefon yok. |
| P-12 | NGS Plus adı, özgün SVG ve ölçülen Plus kontrastı. |
| P-13 | Varsayılan görünür içerik; JS/scroll tetikleyicisi gerektirmiyor. |
| P-14 | Mobil hero görseli mevcut; auth küçük logo ve üstte form. |
| P-15 | Dört açık özellik satırı, sekme yok; farklı bölüm ritimleri. |
| P-16 | Tek StatusScreen, h1, logo, açıklama, yapılabilir sonraki adım. |
| P-17 | Ortak AuthShell; ölü StatsSection/DemoStats/DemoFeatures/telefon bileşenleri uygulama worker’ının temizliği. |
| P-20, P-21, P-22 | Kod kanıtlı iddialar; desteklenmeyen vaatler çıkarıldı. |
| P-23 | K5 kısa bilgilendirme ve mailto; yayımlanmamış yasal sayfaya link yok. |
| P-24 | Tek mobil notu, mağaza rozeti yok. |
| P-30 | Login uyarıları tek alanda öncelikli seçilir. |
| P-31 | Şifremi unuttum inline yardım; yeniden gönder yalnız gerektiğinde. |
| P-32 | Demo-request register yönlendirmesi; satış mailto/tel. |
| P-33 | Rota title tablosu + ortak h1 sözleşmesi. |
| P-34 | Public kapsamlı açık tema, global dark tercihinden izolasyon; görsel kontrol kapısı. |

Eski audit SHL-18 kayıt/doğrulama atomikliği, SHL-23/24 davet semantiği ve SHL-26 QR token ömrü backend kapsamındadır; görsel tasarım bunların çözülmüş olduğunu iddia etmez. Mevcut akış ve izin koşulları korunur.

## Teslim ve doğrulama raporu

Üretim betikleri (repo dışı): `/tmp/pub-p1/assets.cjs`, `/tmp/pub-p1/build.py`, `/tmp/pub-p1/capture.cjs`, `/tmp/pub-p1/spec.py`; ölçüm JSON’ları aynı geçici dizinde. Yeniden üretim sırasında sıra assets → build → capture → spec. Font CSS ve ölçüm dosyaları geçici dizindedir; teslim HTML’leri betik olmadan açılır.

### Kapı sonuçları — geçti

1. **5 HTML + 10 tam sayfa PNG mevcut.** Her HTML 1440 ve390 genişlikte çekildi; aşağıdaki tablo gerçek tarayıcı ölçümüdür. Bozuk görsel0, JavaScript sayfa hatası0.
2. **Görsel yasak taraması0:** `gradient|blur\(|backdrop|✨|text-transform:\s*uppercase` tüm HTML’lerde eşleşme vermedi. Her dosyada ortak CSS nedeniyle bir adet `box-shadow` tanımı var; yalnız ürün çerçevesine uygulanır. Harici veya inline script0.
3. **12 WebP mevcut:** altı ekranın 1600/800 çifti, tüm ölçüler yukarıdaki tabloda; hero40.964byte ile150KB sınırının altında.
4. **İddia taraması0:** `Excel ile içe|push|çevrimdışı|biyometr|14 gün|ücretsiz deneme` hiçbir HTML’de bulunmadı. Kanıt tablosundaki ürün kodları yerelden okundu; DB çağrısı yapılmadı.
5. **Ownership korundu:** bu worker’ın ürettiği28 dosya yalnız `DESIGN_PUBLIC.md`, `directions/V2/` ve `public/marketing/` altında. `git status --porcelain` başta ve sonda incelendi; mevcut src/mobile/index değişiklikleri ve diğer oturumların sonradan eklediği `.claude/handoff-sayfa-duzenleme.md`, `src/hooks/usePageTitle.ts` bu worker’a ait değildir. Ortak çalışma ağacı temizmiş gibi raporlanmaz. Bu worker src/convex/mobile/index/logo dosyalarına yazmadı.

| Mockup | 1440 scrollWidth | 390 scrollWidth | PNG yüksekliği 1440 /390 |
|---|---:|---:|---:|
| `landing` | 1440 | 390 | 6639 / 6943 |
| `landing-font` | 1440 | 390 | 6639 / 6943 |
| `login` | 1440 | 390 | 1927 / 2797 |
| `register` | 1440 | 390 | 1308 / 1283 |
| `status` | 1440 | 390 | 4313 / 9445 |

Ek kontroller: landing menüsü320/390/768/1023px’de açıldı, altı bağlantı görünür, yatay taşma0. Beş sayfada dark media + reduced-motion birlikte denendi: açık canvas `rgb(252,252,252)`, `color-scheme: light`, smooth-scroll `auto`, opacity0 başlayan başlık/paragraf/görsel0. Display varyantı Chrome platform-font ölçümünde **Plus Jakarta Sans / PlusJakartaSans-Regular_SemiBold / isCustomFont:true** olarak doğrulandı; ana ve font varyantı PNG hash’leri farklı. Ana hero, auth ve durum örnekleri görsel olarak da incelendi; mobil kelime birleşmesi düzeltildi ve PNG’ler yeniden çekildi.

Sunucu başlatılmadı; yalnız file:// sayfaları açıldı, tarayıcılar kapatıldı. Commit/push/deploy/Convex komutu yok. Kaynak kod değişmediği için tsc/eslint/build bu tasarım kapısında çalıştırılmadı; uygulama worker’larının kapısıdır. Geçici test kanıtları `/tmp/pub-p1/checks.json` ve `/tmp/pub-p1/gates.json`; kalıcı sonuç özeti bu belgededir.

**Açık tasarım sorusu yok.** Uygulama worker’ları ana sistem fontu varyantıyla ilerleyebilir. P-01 yayın, P-02/03 index temizliği/meta ve çalışma akışının gerçek uygulamadaki testleri sonraki sahiplerin işidir; bu teslim bunların kapandığını iddia etmez.
