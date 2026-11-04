# NGS Plus landing — modern polish danışmanlığı

**Tarih:** 4 Kasım 2026 · **Kapsam:** `/` · **Çalışma:** salt okuma + bu rapor · **Dal:** `main`

## 1. Sonuç ve incelemenin sınırı

Mevcut sayfa iyi bir temele sahip. Bordo sahne, Overpass başlıklar, dört görünür özellik, gerçek ürün arayüzünden üretilmiş örnek ekranlar ve sade iletişim alanı korunmalı. En büyük kazanç yeni bölüm, font veya efekt eklemekten değil; hero’nun anlatımını keskinleştirmekten, mobilde ürün kanıtına ayrılan yüksekliği daha iyi kullanmaktan ve karar vermeyi kolaylaştıran küçük metinleri okunur kılmaktan gelir. Öneri, aynı sayfanın daha kontrollü ve tamamlanmış görünmesidir.

**İncelenen kaynaklar:** `src/pages/LandingPage.tsx`; `src/components/landing/` bileşenleri, `marketingFacts.ts`, `marketingFacts.test.ts`, `LiveFeedDemo.test.tsx`; `PublicHeader.tsx`, `PublicFooter.tsx`, `ProductShot.tsx`, `Section.tsx`, `public.css`; `src/hooks/usePublicTheme.ts`; `tailwind.config.ts`, `src/index.css`; Overpass dosyaları; 23 Ekim audit ve planı ile `DESIGN_PUBLIC.md`. Mobil menünün hareket kapsamını anlamak için ortak `sheet.tsx` de okundu. Başka worker raporu okunmadı.

**Canlı inceleme:** [ngsplus.app](https://ngsplus.app/) üzerinde Orca tarayıcısında 1440×1000 ve 390×844 CSS px görünüm; yerel `http://localhost:8081/` üzerinde 1440 px kaynak karşılaştırması yapıldı. Mobil hero ekran görüntüsü okunabildi; masaüstü ekran görüntüleri tekrar eden karolar, aşağı kaydırılmış mobil görüntü boş yüzey üretti. Bu çıktılar tasarım hatası olarak yorumlanmadı. Masaüstü ve sayfanın alt bölümlerindeki değerlendirmeler kaynak kodu, DOM, hesaplanan boyutlar ve içerik incelemesine dayanır; bütün sayfa için görsel QA tamamlandı iddiası yoktur.

**Ölçülen durum:** Canlı masaüstü DOM’unda tek h1, Overpass font ailesi, 500×450 px LiveFeedDemo ve 1200 px içerik alanı bulunuyor; yerelde aynı hero metni ve canlı kart geometrisi görüldü. Mobilde `innerWidth/clientWidth/scrollWidth = 390/390/390`; ilk durumdaki sayfa yüksekliği yaklaşık 8639 px. Menü açıldığında dört bölüm bağlantısı, giriş ve hesap oluşturma eylemi erişilebilir ağaçta görüldü. Bu, tam klavye/ekran okuyucu denetimi değildir.

| Canlı mobil ölçüm | Sayfa üstünden yaklaşık konum / boyut | Tasarım anlamı |
|---|---|---|
| Hero başlığı | y=112, h=137 px | 44 px başlık üç satır; kategori açık, son satır yalnız “Sistemi” |
| Hero CTA grubu | y=379, h=48 px | İlk ekranda ulaşılabilir; korunması gereken başarı |
| LiveFeedDemo | y=490, h=450 px | Alt kontrol ve örnek veri açıklaması 844 px ekranın altında |
| Ana Sayfa görseli alanı | y=972, h≈505 px | Canlı akıştan hemen sonra ikinci uzun ürün kanıtı |
| Donanım şeridi | y=1477, h≈344 px | Dört logo ve başlık için mobilde ciddi yükseklik |
| Özellikler | y=1821, h≈3263 px | Tek başına uzun değil; öncesindeki tekrarlarla birlikte ritim ağırlaşıyor |
| İletişim | y≈6417 | Cihaz uyumluluğunu konuşmak isteyen kişi için ilk hero’dan uzak |

Bunlar 4 Kasım’daki tek ölçüm anının CSS koordinatlarıdır; dönüşüm oranı, kullanıcı davranışı veya performans testi değildir. Fontlar ve örnek akış yüklenmişti; ekran dışındaki lazy görsellerin henüz yüklenmemesi arıza sayılmadı. Lighthouse yeniden çalıştırılmadı. **89 performans, eski planın ölçüm sonucu ve bu işin alt sınırıdır; güncel skor diye sunulmaz.**

### Önceki kararlarla ilişki

- 19 Ekim belgesindeki sistem fontu kararı, 23 Ekim planındaki **Overpass 700** kararıyla değişmiş. Yeni font seçimi yapılmamalı. Mevcut iki WOFF2 toplam **38.252 byte**; eski plandaki tahmini dosya boyutları güncel gerçek dosyaları temsil etmiyor.
- 23 Ekim audit’inde istenen font, LiveFeedDemo, özellik kırpımları, farklı özellik düzenleri, açık güvenlik bandı ve şirket atfı zaten uygulanmış. Bunları yeniden “eksik” diye önermek yanlış olur.
- Eski plandaki “anında” hero metni ile modelsiz/logo kullanılmayan donanım taslağı güncel kodla aynı değil. Güncel kaynak kategori odaklı başlık ve dört marka logosu kullanıyor. Raporda bunlar mevcut durum kabul edildi; eski kararlar otomatik geri alınmadı.
- Örnek verili mevcut ürün gösterimi korunur ve açıkça etiketlenir. “Sahte veri yok” kuralı, pazarlama kanıtı gibi sunulan uydurma müşteri, referans ve ölçümlerin yasaklanması olarak uygulanır; mevcut etiketli demo gerçek kullanım istatistiğine dönüştürülmez.

## 2. Tasarım yönü

**“İşyerinin günlük kontrolünü sakin ve açık biçimde gösteren, sağlam bir yönetim ürünü”** hissi hedeflenmeli: bordo kimlik ve tabela karakterli Overpass korunurken metin, tablo ve gerçek ekran kırpımları daha iyi hizalanmalı; dikkat çekici tek unsur kapı geçiş akışı olmalı. Bu yaklaşım İK’nın kayıt doğruluğu, güvenlik amirinin yetki görünürlüğü ve işletme yöneticisinin kurulum açıklığı beklentisine uyar. Referans alınacak kalıplar, [Linear’ın](https://linear.app/) ürün arayüzünü açıklamanın doğrudan kanıtı olarak kullanması, [Ramp’in](https://ramp.com/) yetenekleri somut iş akışlarına göre adlandırması ve [Mercury’nin](https://mercury.com/) mevcut kullanıcı girişi ile yeni hesap eylemini ayrı isimlendirmesidir. Bu siteler 4 Kasım’da resmi sayfalarından içerik/yapı düzeyinde incelendi; renkleri, hareketleri, AI söylemleri veya istatistikleri örnek alınmıyor. NGS Plus’a aktarılacak şey içerik hiyerarşisi, ürünün görünürlüğü ve eylemlerin açıklığıdır.

## 3. Bölüm bölüm mevcut durum

Satır adresleri incelenen çalışma ağacına aittir. “Zayıflık” her zaman işlevsel hata anlamına gelmez; görsel ağırlık, anlatım veya karar kolaylığı fırsatlarını da kapsar.

### Header

**Güçlü:** Bordo sahneyle bütünleşen kimlik, dört anlaşılır bölüm bağlantısı, ayrı giriş/hesap eylemleri. Skip link, menü etiketi, expanded durumu ve 44 px tetikleyici mevcut. Sticky olmayan header içerik alanını kapatmıyor.

**Zayıflık:** Masaüstü header ile hero’da aynı açık dolgulu hesap düğmesinin art arda kullanımı iki eşdeğer başlangıç noktası yaratıyor (`src/components/public/PublicHeader.tsx:20`, `src/components/landing/HeroSection.tsx:18`, `src/components/public/public.css:219`). Bu bir CTA sayısı problemi değil; header eyleminin görsel ağırlığı biraz azaltılabilir. Mobilde giriş de dahil bütün hesap eylemleri menüye taşınıyor (`src/components/public/public.css:677`, `src/components/public/PublicHeader.tsx:74`); mevcut müşterinin giriş yolu ilk bakışta görünmüyor. Girişin ayrıca gösterilmesi ürün tercihi olarak değerlendirilmeli, header’a üçüncü düğme sıkıştırılmamalı.

### Hero

**Güçlü:** “Bulut PDKS ve Geçiş Kontrol Sistemi” ürün kategorisini doğrudan söylüyor. Alt açıklama kart/terminal/QR ile vardiya ve izin kapsamını bağlıyor. CTA rotaları doğru anlam taşıyor; hesap açmanın satın alma olmadığı açıklanıyor. Canlı kart ürünün karakteristik işini gösteriyor.

**Zayıflık:** Başlık bir kategori adı olarak kalıyor; ziyaretçinin hangi günlük işinin kolaylaşacağını ilk cümlede anlatmıyor (`src/components/landing/marketingFacts.ts:8`). Açıklama tek uzun cümlede çok sayıda kavram taşıyor (`src/components/landing/marketingFacts.ts:10`). Başlık, 500 px sabit üst sınırlı kart ve alttaki tam ekran üç kuvvetli odak yaratıyor (`src/components/public/public.css:228`, `src/components/landing/HeroSection.tsx:27`, `src/components/landing/HeroSection.tsx:30`). Mobilde üç satırlı başlığın sonundaki tek “Sistemi” satırı ve 12 px satın alma notu, etkileyici başlık ile zayıf açıklama hiyerarşisi oluşturuyor (`src/components/public/public.css:726`, `src/components/public/public.css:748`). Çözüm font değiştirmek değil; cümle uzunluğu, kolon oranı ve alt metin ölçeğini ayarlamak.

### LiveFeedDemo

**Güçlü:** Gerçek HTML metni olduğu için görüntüden daha okunur. Sonuçlar yalnız renkle değil metinle ayrılıyor. Sabit dört satır ve deterministik zaman üretimi yerleşimi koruyor. Görünmez sekme, ekran dışı olma, hover/odak ve reduced-motion için düşünülmüş durma koşulları var; ekran okuyucuya her üç saniyede duyuru yapılmıyor.

**Zayıflık:** “Örnek veri” ve Durdur en altta; mobil ilk ekranda “Canlı” etiketi göründüğü halde örnek olduğu ve durdurulabildiği görünmüyor (`src/components/landing/LiveFeedDemo.tsx:85`, `src/components/landing/LiveFeedDemo.tsx:109`). 64+320+64 px iç yapı mobilde de korunuyor (`src/components/public/public.css:879`, `src/components/public/public.css:902`, `src/components/public/public.css:909`). Red nedeni ve sonuç chip’i 11 px (`src/components/public/public.css:930`, `src/components/public/public.css:935`); içerik ürünün ana kanıtıysa bu metinler daha rahat okunmalı. Üstte örnek etiketi ve kontrol, aşağıda dört satır öneriyorum. Bu yer değiştirme mevcut erişilebilirlik grubunu, durma semantiğini ve reduced-motion davranışını bozmaz.

### HardwareStrip

**Güçlü:** Gerçek entegrasyon marka varlıkları ve “modelinizi birlikte değerlendirelim” açıklaması, fiziksel cihaz dünyasıyla bağlantıyı açık kuruyor. Marka listesi test tarafından sabitlenmiş; alt metin ve ölçüler var.

**Zayıflık:** Masaüstünde 112 px, mobilde 88 px yüksek dört ayrı beyaz kutu, teknik uyumluluk bilgisini müşteri logosu bandına yaklaştırıyor (`src/components/public/public.css:294`, `src/components/public/public.css:721`). Başlık anlaşılır olsa da logoların kart görünümü gereğinden güçlü. Logoların 18–52 px arasında değişen gösterim yüksekliği optik eşitleme gerektiriyor; aynı piksel yüksekliğine zorlamak da doğru değil (`src/components/landing/HardwareStrip.tsx:5`). Model uygunluğunu konuşma çağrısı düz metin olarak kalıyor (`src/components/landing/HardwareStrip.tsx:18`, `src/components/landing/marketingFacts.ts:57`). Kompakt 2×2 mobil düzen korunarak dış kutular hafifletilebilir ve açıklama iletişime bağlanabilir; desteklenmeyen model listesi eklenmemeli.

### Features

**Güçlü:** Dört özellik sekmesiz görünür; canlı izleme tam genişlik, PDKS/geçiş ikilisi ve vardiya şeridi iyi bir ritim oluşturuyor. Mobil ayrı kaynaklar, açıklayıcı alt metinler ve özelliğe özel caption’lar mevcut. Önceki audit’in temel çözümü uygulanmış.

**Zayıflık:** Modül adı + fayda başlığı + açıklama + üç madde + caption aynı fikri birkaç kez okuyabiliyor (`src/components/landing/FeaturesSection.tsx:94`, `src/components/landing/marketingFacts.ts:64`). Örneğin “kart okumalarını izleyin” ile “geçişleri olurken görün” birbirine çok yakın. Birincil canlı demo, Ana Sayfa son okumaları ve ilk canlı izleme özelliği aynı ürün anını arka arkaya gösteriyor (`src/components/landing/marketingFacts.ts:11`, `src/components/landing/marketingFacts.ts:64`). PDKS/geçiş görsellerinin oranları farklı: 1200×1029 ve 1200×780; eşlenen başlık satırları olsa da görsel sonrası maddelerin başlangıçları farklılaşır (`src/components/landing/FeaturesSection.tsx:33`, `src/components/landing/FeaturesSection.tsx:48`, `src/components/landing/FeaturesSection.tsx:103`). Tüm bölümü kartlara çevirmeden metin fazlalığı azaltılmalı ve görsel/kanıt hizası düzenlenmeli.

### HowItWorks

**Güçlü:** Numaralar gerçek üç adımlı sırayı gösteriyor. Mobilde 36 px numara sütunu ve yanında açıklama, yatay sürükleme gerektirmeyen düzgün bir kurulum özeti.

**Zayıflık:** “Cihazlarınızı bağlayın” adımı, uyumlu cihaz şartını söylese de bağlantı hazırlığının nasıl netleşeceğini bu noktada göstermiyor (`src/components/landing/marketingFacts.ts:123`). “Üç adım” süre vaadi değildir; fakat ağ/kurulum hazırlığına ilişkin yol görünmezse fazlaca kolay algılanabilir. Altındaki “Mobil uygulama yakında” notu geleceğe dönük ürün durumuyla mevcut QR kullanımını tek cümlede birleştiriyor (`src/components/landing/HowItWorksSection.tsx:17`, `src/components/landing/marketingFacts.ts:6`). Teknik detay eklemek yerine ikinci adımda “Cihaz uyumluluğunu görüşün” bağlantısı ve mobil durumun ürün sahibi tarafından doğrulanması yeterli.

### Security

**Güçlü:** Somut proje/rol/denetim yapısı anlatılıyor; sertifika rozetleri veya hukuki uygunluk garantileri yok. Tek açık ton bant sayfada iyi bir durak. Güvenlik, pazarlama süsü değil yönetim sorusu olarak ele alınıyor.

**Zayıflık:** “Her yönetim işlemi kayda geçer” mutlak kapsam iddiası ve “5 rol, 13 yetki” sayısı bakım gerektiriyor (`src/components/landing/marketingFacts.ts:132`, `src/components/landing/marketingFacts.ts:141`). Bu rapor backend kapsamını doğrulamadı; yanlış oldukları sonucunu çıkarmıyorum. Görsel ağırlığı sayıya vermek yerine “Roller ve yetkiler” başlığı, somut mevcut açıklamayla birlikte daha kalıcı olur. Veri bilgilendirmesi metni, güvenlik açıklaması ve üç madde aynı bölgede yoğunlaşıyor (`src/components/landing/SecuritySection.tsx:12`); notu daha okunur fakat ikincil tutmak gerekir. Üç ayrı kalkan kartı eklememek doğru karar.

### Pricing / İletişim

**Güçlü:** Kod adı PricingSection olsa da kullanıcıya uydurma paketler gösterilmiyor. Kapsamın çalışan kapasitesi ve ihtiyaçlarla netleştiği açıklanıyor; e-posta/telefon gerçek bağlantılar. Büyük iletişim satırları ulaşılabilir.

**Zayıflık:** Plan açıklaması, “plan ve kullanım koşulları için ulaşın” notu ve kartın altındaki kurulum notu benzer çağrıyı üç kez yapıyor (`src/components/landing/PricingSection.tsx:12`, `src/components/landing/PricingSection.tsx:13`, `src/components/landing/PricingSection.tsx:43`). Satın alma sorusuna yanıt “kime ulaşırım” düzeyinde; ilk mesajda hangi bilgilerin işe yarayacağı görünmüyor. Konumun e-posta ve telefonla aynı ikon/kutu dili kullanması statik bilgiyle etkileşimi eşit gösteriyor (`src/components/landing/PricingSection.tsx:34`, `src/components/public/public.css:464`). E-posta başlığını eylem diliyle netleştirmek ve konumu sakin metne almak yeterli; yeni form gerekmiyor.

### FAQ

**Güçlü:** Native `details/summary`, ilk yanıtın açık olması, görünür açılma kontrolü ve masaüstü sticky giriş alanı iyi. Sorular gerçek karar engellerini kapsıyor: hesap, cihaz, QR, rapor, proje ve plan.

**Zayıflık:** Açılan artı ikonunun 45° dönüşü “eksi” yerine “çarpı/kapat” işareti oluşturuyor ve 200 ms hareket ekliyor (`src/components/public/public.css:561`, `src/components/public/public.css:564`). Kullanıcının bu görevdeki daha katı “tek animasyon” kısıtı için statik artı/eksi durumu daha temizdir; native açıklama açılışı korunur. Altı kutu ve her kutuda yuvarlak ikon sınırı, sayfanın sonuna doğru kart dilini tekrar ağırlaştırıyor (`src/components/public/public.css:530`, `src/components/public/public.css:559`). Sadece ikon çevresindeki çemberi kaldırmak yeterli bir P1 düzeltmedir; akordeon yeniden yazılmamalı.

### FinalCTA

**Güçlü:** Bordo bandın dönüşü sayfayı kapatıyor. Tek eylem ve mobil tam genişlik düğme mevcut; hero’daki satın alma açıklaması gereksiz yere tekrarlanmıyor.

**Zayıflık:** “Projenizi açın, ilk kapıyı bağlayın” hesabı oluşturmaktan sonraki kurulum adımına kadar uzanan bir çağrı (`src/components/landing/marketingFacts.ts:188`); uyumluluk görüşmesi gereken ziyaretçi için fazla hızlı bir sıçrama. CTA ise yalnız kayıt açıyor (`src/components/landing/FinalCTASection.tsx:14`). Daha doğru, kısa bir kapanış başlığı “İşyerinizin kayıtlarını birlikte düzenleyin” gibi belirsiz bir slogan değil, **“NGS Plus hesabınızı oluşturun.”** olabilir; gerçek sonraki adıma odaklanır. Başlığı değiştirmek mevcut hesap CTA hiyerarşisini korur.

### Footer

**Güçlü:** “NGS Teknoloji ürünüdür” atfı, şehir, gerçek telefon ve e-posta güvenin temelini sağlıyor. Hayali sosyal hesaplar, sahte referanslar veya boş yasal rotalar yok.

**Zayıflık:** Açıklama 13 px, alt satır 12 px; şirket ve iletişim bilgisi güven sinyali olmasına rağmen görsel olarak çok ikincil (`src/components/public/public.css:598`, `src/components/public/public.css:609`). “Bilgi ve aydınlatma metni talepleri” ile genel telefonun aynı flex satırında bulunması görevleri karıştırıyor (`src/components/public/PublicFooter.tsx:24`). Tam ticari unvan ve adres mevcut kaynakta yok (`src/components/landing/marketingFacts.ts:189`); uydurulmadan, Emre’den gelirse eklenmeli. Adres bulunmayışını yasal ihlal olarak değerlendirmiyorum.

## 4. Somut polish listesi

Eforlar bir geliştiricinin mevcut yapıda uygulama + dar kapsamlı görsel kontrol tahminidir; ürün kararı bekleme, yeni varlık üretme izni ve kapsamlı yayın QA’sı hariçtir. P0, “hata/acil durum” değil, ilk cilalama turunda en yüksek etki anlamına gelir.

### P0 — önce yapılacak beş iş

| # | Ne değişir | Neden | Dosya(lar) | Kaba efor |
|---|---|---|---|---|
| P0.1 | Hero başlığını aşağıdaki A metniyle iki/üç dengeli satıra getir; alt açıklamayı iki kısa cümleye ayır; mevcut 72/44 ölçeğiyle başla, yalnız hero’da gerektiğinde 68–72/42–44 aralığını dene | Ürün kategorisi korunurken günlük fayda anlaşılır; yeni font veya bölüm gerektirmeden ilk izlenim iyileşir | `src/components/landing/marketingFacts.ts`, `HeroSection.tsx`, `src/components/public/public.css`; metin değişirse `index.html` açıklamaları tutarlılık kontrolü | 1–1,5 sa |
| P0.2 | LiveFeed üst bölümünde “Örnek veri”yi başlıkla birlikte göster; Durdur kontrolünü üstte veya hemen başlık altındaki kontrol satırına taşı; dört satır korunurken mobilde gereksiz başlık/alt şerit yüksekliğini azalt | İlk ekranda gerçek veri sanılmasını ve kontrolün ekran altında kalmasını önler; sayfanın en özgün parçasını daha iyi sunar | `LiveFeedDemo.tsx`, `marketingFacts.ts`, `public.css`, davranış değişirse `LiveFeedDemo.test.tsx` | 1,5–2 sa |
| P0.3 | Hero altındaki Ana Sayfa ekranını mevcut ekranın daha odaklı, yatay bir kırpımıyla sun: gün özeti + sınırlı son okumalar; mobil kırpımda boşluk/tekrarlanan navigasyonu azalt, görseli saklama | Canlı akıştan sonra ikinci uzun tablo gösterimini hafifletir; donanım ve özellikler daha erken görünür | `HeroSection.tsx`, `ProductShot.tsx` yalnız gerekli props, `public.css`, uygulama aşamasında ilgili `public/marketing/` varlıkları | 2–3 sa |
| P0.4 | Kritik küçük metinleri 13–14 px düzeyine çıkar: satın alma notu, örnek etiketi, görsel açıklaması, red nedeni; satır/kolon ölçülerini birlikte ayarla | Modern görünümü küçük ve soluk metne bağımlı olmaktan çıkarır; gerçek ürün bilgisi okunur olur | `public.css` özellikle 175, 245, 261, 748, 930, 935, 948 çevresi | 1–1,5 sa |
| P0.5 | HardwareStrip’i kutu ağırlığı az bir uyumluluk şeridine dönüştür; mobil 2×2 korunsun, başlangıç denemesi olarak 88→72 px logo satırı; uygunluk açıklamasına `/#iletisim` bağlantısı ekle | Şerit daha erken taranır, gerçek müşteri logosu bandıyla karışmaz; yeni satış akışı eklemeden doğru kişiye yol açar | `HardwareStrip.tsx`, `marketingFacts.ts`, `public.css` | 1–1,5 sa |

P0.3 için 390 px’de görsel yüksekliği **yaklaşık 280–330 px başlangıç tasarım hedefi** olabilir; bu yayın kabul koşulu değil, okunurlukla birlikte denenecek aralıktır. İlgili yazılar okunamayacak kadar küçülüyorsa yükseklik artırılmalı. Görseli `height` ile ezmek, `object-fit: cover` ile anlamlı satırı kesmek veya ilk ekrandan ürün kanıtını kaldırmak kabul edilmez. Dört demo satırı korunur; sırf ekranı kısaltmak için üçüncü satıra düşürme önerilmiyor.

### P1 — tutarlılık ve güven turu

| # | Ne değişir | Neden | Dosya(lar) | Kaba efor |
|---|---|---|---|---|
| P1.1 | Özellik modül adı ve açıklamasındaki tekrarları azalt; her özelliğe bir görev cümlesi, mevcut üç maddede farklı ve kanıtlı yetenekler bırak | Kullanıcı aynı fikri beş kez okumaz; dört özellik ve semantik hiyerarşi korunur | `marketingFacts.ts`, `FeaturesSection.tsx` | 1–1,5 sa |
| P1.2 | PDKS/geçiş ikilisinde ekranların kritik satırlarını eşdeğer bir görsel alanına yerleştir; farklı oranı zorla esnetme; gerekirse metin maddelerini ortak üst hizaya al | Eş sütunlarda rastgele boşluk hissini azaltır; gerçek UI yapısını bozmaz | `FeaturesSection.tsx`, `public.css`, gerekirse ilgili mevcut görsel kırpımları | 1,5–2 sa |
| P1.3 | Genel bölüm aralığını 96/56 px koru; bölüm içi başlık→gövde→görsel ritmini 16/24/32 px basamaklarla toparla; FAQ ve iletişimde gereksiz tekrar notlarını kaldır | Tüm sayfayı sıkıştırmadan daha düzenli bir okuma temposu sağlar | `public.css`, `PricingSection.tsx`, `marketingFacts.ts`; `src/index.css` global tokenları değiştirmeden | 1–1,5 sa |
| P1.4 | İletişimde e-posta alanına “Kapsamı e-postayla görüşün” eylem dili; kısa yardımcı metin “Çalışan sayınızı, işyeri sayınızı ve cihaz modelinizi paylaşabilirsiniz”; konumu daha sakin bilgi satırına al | İletişime geçme eşiğini düşürür ve statik bilgiyle eylemi ayırır; yanıt süresi veya teklif garantisi vermez | `PricingSection.tsx`, `marketingFacts.ts`, `public.css` | 45–75 dk |
| P1.5 | Hesap açma ile ilk kapıyı bağlama arasındaki farkı kapanışta netleştir; kurulum ikinci adımına uyumluluk bağlantısı koy | Başlangıç akışı mevcut ürüne sadık kalır; kurulum için destek isteyen kişiyi kayda zorlamaz | `FinalCTASection.tsx`, `HowItWorksSection.tsx`, `marketingFacts.ts` | 30–60 dk |
| P1.6 | FAQ çemberini kaldır veya sadeleştir; açık durumda statik eksi göster; hover’da metin/zemin, focus’ta mevcut outline; geçiş animasyonu ekleme | Mikro-etkileşim durum bildirir; tek animasyon sınırı korunur | `FAQSection.tsx`, `public.css` | 30–45 dk |
| P1.7 | Header’daki hesap düğmesini hero’dan daha sakin yap; aynı ad ve rotayı koru; mobil menüde gezinme ile hesap eylemleri arasına boşluk/ince çizgi ekle | Yeni kullanıcı eylemi belirgin kalır, navigasyon yarışmaz; mobilde görev grupları daha kolay taranır | `PublicHeader.tsx`, `public.css` | 30–60 dk |
| P1.8 | Güvenlikte sayı yerine “Roller ve yetkiler” başlığını değerlendir; denetim açıklamasının kapsamını ürün sahibi teyit etsin; footer iletişimini 14 px, alt bilgiyi 13 px yap | Güvenin kaynağı okunur ve sürdürülebilir ürün açıklaması olur | `SecuritySection.tsx`, `PublicFooter.tsx`, `marketingFacts.ts`, `public.css` | 45–75 dk + doğrulama |
| P1.9 | Public menüde overlay ve kapatma düğmesi dahil hareket kapsamını gözden geçir; yalnız içerikte `animate-none` verilmesine güvenme | Sheet içeriği durdurulmuş olsa da ortak overlay animasyon sınıfları taşıyor; bu görevdeki katı tek animasyon şartına uyum gerekir | `PublicHeader.tsx:62`, `src/components/ui/sheet.tsx:22`, `sheet.tsx:90`, `sheet.tsx:98`; çözüm public kullanımına sınırlı olmalı | 30–60 dk |

P1.9 bulgusu kaynak düzeyindedir; portal içeriği `.pub-page` altında olmayabileceği için yalnız `.pub-page` CSS seçicisiyle çözüm varsayılmamalı. Uygulama içindeki bütün sheet’lerin hareketini küresel olarak kapatmak bu polish kapsamını aşar. FAQ geçişi reduced-motion’da zaten kapalı (`public.css:1000`); öneri normal tercihte de ilave hareket bırakmamaktır.

### P2 — ürün kararı veya ek varlık gerektiren işler

| # | Ne değişir | Neden | Dosya(lar) | Kaba efor |
|---|---|---|---|---|
| P2.1 | Onaylı cihaz model listesini mevcut marka açıklamasına kısa metin olarak ekle; kullanılacaksa tek gerçek cihaz fotoğrafı | Donanım tarafındaki güveni büyütür; lisans/uyumluluk ve fotoğraf kalitesi doğrulanmadan eklenmez | `HardwareStrip.tsx`, `marketingFacts.ts`, uygulama aşamasında `public/brands/` veya mevcut varlık düzeni | Varlık hazırsa 1–2 sa |
| P2.2 | NGS Teknoloji tam ticari unvanı/adresi ve varsa gerçekten yayımlanmış bilgilendirme sayfasını footer’da göster | Kurumsal kimliği daha somut yapar; boş belge/rota üretmez | `PublicFooter.tsx`, `marketingFacts.ts` | Bilgi hazırsa 30–45 dk |
| P2.3 | Mevcut müşteri trafiği bunu gerektiriyorsa mobil header’da bağımsız “Giriş yap” bağlantısını dene | Günlük giriş yapan kişilerin menü açmasını azaltabilir; 320 px ve uzun metinlerde sıkışma kontrolü şart | `PublicHeader.tsx`, `public.css` | 45–75 dk |
| P2.4 | Hero masaüstü `srcSet`’ine ihtiyaç varsa 1200w seçenek; mevcut `sizes` ölçüleriyle eşleşmesini doğrula | Tek 2400w masaüstü kaynağının 1× ekranlara maliyetini azaltabilir; küçük dosya diye daha fazla kaynak otomatik eklenmez | `HeroSection.tsx:33`, `ProductShot.tsx`, ilgili `public/marketing/` varlığı | 45–60 dk |

## 5. Görsel sistem için uygulamaya hazır sınırlar

### Tipografi

| Rol | Masaüstü | Mobil | Karar |
|---|---|---|---|
| H1 | 68–72 px / 1.04–1.08 | 42–44 px / 1.08 | Overpass 700; önce metni ve kolonu düzelt, global ölçeği değiştirme |
| H2 | 48–52 px / 1.08–1.12 | 32–34 px / 1.12 | Başlıklar arasındaki göreli hiyerarşi korunur |
| Özellik H3 | 28 px / 1.2 | 24 px / 1.2 | Uzun Türkçe başlıklarda iki satır doğal; tek satıra zorlama yok |
| Diğer H3 | 22 px / 1.25 | 21 px / 1.25 | Kurulum ve güvenlik bilgisi |
| Hero açıklaması | 18–19 px / 1.55–1.6 | 17 px / 1.6 | Yaklaşık 48–58 karakterlik satır; tek uzun pazarlama cümlesi yok |
| Gövde | 17 px / 1.6 | 16 px / 1.6 | Mevcut sistem fontu |
| CTA / nav | 14–15 px / 1.4–1.6 | 14–15 px | Tıklama yüksekliği 44–48 px korunur |
| Anlamlı not/caption | 13–14 px / 1.5–1.6 | 13 px / 1.5–1.6 | 11 px yalnız dekoratif ayrıntıya bile varsayılan olmamalı |

Başlıklarda mevcut `-0.025em` başlangıç değeri korunmalı; mobil satır taşmasını çözmek için daha fazla sıkıştırma yapılmamalı. `<br>` ile bütün genişliklerde aynı kırımı dayatmak yerine, dilde doğal birleşimleri ve mevcut `text-wrap: balance` davranışını kontrol edin. `Geçiş Kontrol` içindeki bölünmez boşluk 320 px ve yakınlaştırmada ayrıca değerlendirilmeli. Yeni font ağırlığı ve harici font isteği yok; `font-display: swap` ile metrik ayarlı fallback korunur.

### Renk, yüzey ve derinlik

Altı temel renk mevcut tokenlardan gelir: **bordo sahne #551919**, **bordo vurgu #7A1F1F**, **canvas #FCFCFC**, **beyaz yüzey #FFFFFF**, **mürekkep #252523**, **açık pembe #F6ECEA**. Yeni bir vurgu rengi önerilmiyor. `--line` ayırıcı, `--control` etkileşim sınırı olarak ayrılmalı; açık dekoratif çizginin tek başına düğme tanımlaması beklenmemeli. Yeşil/kırmızı yalnız geçiş sonucu semantiğinde kalır.

Derinlik yalnız hero ürün ekranındaki mevcut düşük opaklıklı gölgeyle anlatılsın. Demo, logo, FAQ ve iletişim alanlarının her birine yeni gölge eklenmesin. Panel 8 px, düğme 6 px köşeleri korunsun. Logo hücreleri ve FAQ ikon halkalarını hafifletmek, mevcut kartları daha da yuvarlatmaktan daha fazla fark yaratır. Güvenlikteki tek açık bant korunmalı; bölüm bölüm yeni pastel zemin yapılmamalı. Bölüm çizgisi üretmek için kullanılan aynı renkli `linear-gradient` bir dekoratif gradient değildir; sırf sözcük taramasıyla kaldırılmamalı.

### İkonografi ve etkileşim

Mevcut Lucide çizgi ailesi yeterli; 18–20 px eylem ikonları ve tutarlı çizgi kalınlığı kullanılabilir. Mail/telefon işlev taşır, konum bilgi taşır; aynı güçlü kutuyu hepsine vermemek daha iyi. Özellik başlıklarının her birine yeni ikon eklemeye gerek yok. Demo sonucuna ikon eklenirse metni desteklesin ve dekoratif olarak gizlensin; sonuç metni kaldırılmasın.

Hover’da alt çizgi veya anlık yüzey/kenar değişimi; focus’ta mevcut 2 px outline + 3 px offset. Kart yükselmesi, scale, spring, ok kayması, numara sayacı, marquee yok. Hover efekti olmayan dokunmatik cihazda hiçbir bilgi kaybolmamalı. Durdur düğmesinin `aria-pressed` durumu, görünür etiketi ve reduced-motion davranışı aynı kalmalı. Tek otomatik/animasyonlu gösterim LiveFeedDemo’dur.

### Mobil düzen ve dark mode

390 px’de 20 px yan boşluk, tek sütun ve okunur dört özellik devam eder. Hero’nun mevcut yan yana iki CTA’sı bu genişlikte sığıyor; gereksiz yere alt alta dizip yeni yükseklik üretmeyin. 320 px, %200 metin büyütme veya uzun çeviri taşırırsa doğal sarma/alt alta geçiş kullanılmalı. Canlı kartın kontrolü içerikten önce erişilir olmalı. Sabit alt CTA veya sticky hero eklemek ekranı daraltacağı için bu turda önerilmiyor.

Public sayfa **dark mode sunmuyor**: `usePublicTheme()` `.dark` sınıfını kaldırıyor; `.pub-page` `color-scheme: light` kullanıyor (`src/hooks/usePublicTheme.ts:7`, `src/components/public/public.css:37`). Bordo sahne, koyu tema seçeneği değildir. Bu karar korunmalı; uygulamanın kayıtlı koyu tercihiyle landing/auth geçişinde renk sıçraması ve menü portalı kontrol edilmeli. Yeni dark mode ayrı tasarım ve kontrast matrisi gerektirir; polish’e gizlice eklenmemeli.

## 6. Hero için somut öneri

### Düzen

Mevcut iki sütun + altta ürün görseli korunur. Masaüstünde 1200 px içerikte başlangıç denemesi **700 px metin / 32 px ara / 468 px demo**; bu kesin piksel şartı değil, üç satırlı başlığın dengesini iyileştiren oran önerisidir. Mevcut alt hizalama korunabilir. Hero üst boşluğu 80’den önce 64 px denenebilir; header yüksekliğini küçültmek zorunlu değil. Alttaki ekran hâlâ bordo ile açık zemini bağlar; yeni üç boyutlu cihaz çerçevesi kullanılmaz.

```text
1440 px: aynı bordo sahne ve 1200 px içerik
NGS Plus       Özellikler  Nasıl çalışır?  Güvenlik  İletişim    Giriş  [Hesap]

PDKS ve geçiş kontrolü,                 ┌ Canlı İzleme       Örnek veri ┐
işyerinizin günlük akışı.               │                     [Durdur] │
                                       │ saat  kişi / kapı  sonuç      │
Giriş-çıkış kayıtlarından puantaja...    │ mevcut dört örnek satır      │
Kapı yetkileri, vardiyalar ve izinler... │ sonuç + gerekirse red nedeni │
                                       └──────────────────────────────┘
[Hesap oluştur] [Özellikleri incele]
Hesap oluşturmak ücretli plan satın almaz.

        [ Ana Sayfa: gün özeti odaklı gerçek ekran kırpımı ]
        Ana Sayfa: günün özeti. Ekrandaki veriler örnektir.
──────────── kompakt entegrasyon markaları + uygunluk bağlantısı ───────────

390 px:
Logo                                          Menü
Başlık (2–3 doğal satır)
İki kısa açıklama cümlesi
[Hesap oluştur]  [Özellikleri incele]
Okunur satın alma notu
Canlı İzleme / Örnek veri
[Durdur]       ← akışın üstünde, görünür
Mevcut dört örnek satır
Odaklı Ana Sayfa kırpımı + örnek veri caption’ı
Kompakt 2×2 entegrasyon şeridi
```

Başlık A için önerilen satır düzeni 1440 ve 390’da gerçek fontla denenmeli; ASCII taslakta görünen kırımlar her ekrana zorlanmamalı. Ekran yüksekliğini azaltma hedefi, tüm hero’nun mobilde tek ekrana sığması değildir. Başlık, karar eylemi ve demo kontrolünün anlaşılması yeterlidir.

### Metin seçenekleri

**A — önerilen, kategori + günlük iş dengesi**

- Başlık: **“PDKS ve geçiş kontrolü, işyerinizin günlük akışı.”**
- Alt başlık: **“Kart, terminal ve QR giriş-çıkışlarını puantaj kayıtlarıyla takip edin. Kapı yetkilerini, vardiyaları ve izinleri buluttan yönetin.”**
- Neden: PDKS ve geçiş kontrolü ilk satırda kalır; mevcut kategori başlığını tamamen soyut bir fayda sloganına çevirmez. “Bulut” açıklamada görünür. Yeni otomasyon, hız veya entegrasyon vaadi eklemez.

**B — daha eylem odaklı**

- Başlık: **“Geçişleri izleyin, çalışma gününü takip edin.”**
- Alt başlık: **“NGS Plus, bulut tabanlı PDKS ve geçiş kontrol sistemidir. Giriş-çıkış kayıtlarını, kapı yetkilerini, vardiyaları ve izinleri yönetin.”**
- Neden: Ekran örneğiyle doğrudan konuşur. Kategori bilgisi H1’den alt başlığa iner; organik arama konumlandırması nedeniyle Emre’nin seçimi gerekir.

**C — en düşük değişiklikli seçenek**

- Başlık: **“Bulut PDKS ve geçiş kontrolü.”**
- Alt başlık: **“Kart, terminal ve QR giriş-çıkışları puantaja dönüşür. Kapı yetkileri, vardiyalar ve izinler aynı hesapta.”**
- Neden: Mevcut başlığı kısaltır, “Sistemi” yalnız satırını kaldırır ve mevcut açıklamayı böler. Dönüşüm iddiası güncel kaynakta zaten bulunduğundan korunur; yeni bir yetenek değildir.

**CTA’lar:** Varsayılan ana eylem **Hesap oluştur → `/register`**, ikincil **Özellikleri incele → `/#ozellikler`** kalmalı. İkincili “Canlı demo” diye adlandırmak yanlış beklenti yaratır; hedef özellik bölümüdür. “Ücretsiz dene”, “Demo talep et” veya “Hemen kullanmaya başla” mevcut akışın yerine geçirilmemeli. Satış görüşmesini birincil eylem yapmak bu raporun otomatik önerisi değildir; aşağıdaki ürün kararına bağlıdır.

**Görsel:** LiveFeedDemo tek hareketli kanıt; alttaki Ana Sayfa ekranı ürünün geniş bağlamı. Mevcut örnek ekranın gün özeti ve ürün navigasyonunu tanımaya yetecek kısmı kullanılmalı; gerçek uygulamada olmayan grafik, sayı veya kart üretilmemeli. Demo ve ekranın ikisinde de örnek veri işareti görülebilir olmalı. Yeni cihaz fotoğrafı, AI üretilmiş dashboard veya mağaza rozeti hero’ya eklenmemeli.

## 7. Yapılmaması gerekenler ve riskler

### Şablon görünümüne götüren tercihler

- Mor/mavi gradient blob, ışıklı bordo parıltı, cam efekti, noktalı “teknoloji” fonu: mevcut kapı/işyeri bağını zayıflatır.
- Eş boyutlu altı özellik kartı, her satırda ikon kutusu, üst üste gölgeler, her başlık üstünde büyük harfli etiket: mevcut iyi tipografik yapıyı jenerik SaaS kitine çevirir.
- Emoji ikonları, sahte müşteri logosu bandı, uydurma yorum ve ölçümler, otomatik artan sayaç: marka güvenini üretmez. Entegrasyon markalarını müşteri referansı gibi adlandırmak da aynı risktir.
- Başlığın bir kelimesini farklı renk, italik veya gradient yapmak; Overpass’ı daha “trend” fontla değiştirmek: bu sayfada karakter zaten var.
- Yapay telefon mockup’ı, interaktif olduğu sanılan statik dashboard, ürün ekranına sonradan uydurulmuş sayı: ürüne ilişkin yanlış beklenti yaratır.
- Sayfayı yeniden sıralamak, özellikleri sekme/slider arkasına almak, fiyatlandırma kartları icat etmek: polish kapsamını aşar.

### Performans

Mevcut desktop hero WebP **76.156 byte**, mobil 700w karşılığı **22.576 byte**. Bunlar küçük varlıklardır; temel öneri sıkıştırmadan önce **anlatılan içeriğin seçimini** iyileştirmektir. Retina çözünürlüğü azaltıp bulanıklaştırmak doğru kazanç değildir. Yeni JS kütüphanesi, video autoplay, three.js/lottie/framer-motion, dış font veya yeni üçüncü taraf widget eklenmemeli. Hero’nun eager/high önceliği korunurken alttaki görseller lazy kalmalı; hepsine preload vermek ilk ekranı yavaşlatabilir. Görsel değişimlerinde `width/height`, `<source>` boyutları ve gerçek oran birlikte güncellenmeli; aksi halde CLS oluşabilir.

### Erişilebilirlik

Notları büyütmek tek başına WCAG uygunluğu sağlamaz. Normal metinde 4,5:1; büyük metinde 3:1; kontrol/durum göstergelerinde uygulanabilir 3:1 kontrast koşulları yeni kombinasyonlarla ölçülmeli. 44 px dokunma hedefi bu projenin tercihidir; WCAG AA minimumunun her durumda 44 px olduğunu iddia etmiyorum. Odak görünür olmalı, hareketli akış durdurulabilmeli ve durum yalnız renkle anlatılmamalı. Durdur kontrolü yukarı taşınırken klavye sırası da taşınmalı; CSS ile görsel sıra değiştirilip DOM geride bırakılmamalı. Dar ekran, metin büyütme ve reflow’da kayıt adı/red nedeni kırpılmamalı. Statik ekran görsellerinin alt metni işlevini anlatmalı; görseldeki her hücreyi transkribe etmek gerekmez.

### İddia ve ürün doğruluğu

`marketingFacts.test.ts:6` yasaklı ifadeleri, `marketingFacts.test.ts:23` dört özellik/dört marka sözleşmesini koruyor. Regex’ten geçmek yeni bir iddianın doğru olduğu anlamına gelmez. Mevcut “5 rol, 13 yetki”, denetim kapsamı ve “mobil uygulama yakında” durumu bağımsız ürün doğrulaması ister. E-posta ve telefon doğrulanmış mevcut kaynaktan alınmalı; cevap süresi, SLA, veri barındırma ülkesi, sertifika, yedekleme garantisi, mevzuat uygunluğu veya yeni fiyat eklenmemeli. Kullanıcının belirttiği yasaklı biyometri/KVKK iddiaları önerilen pazarlama metinlerinde kullanılmadı.

### Açıkça ayrılan karar değişikliği önerileri

Ana P0/P1 önerileri Overpass, A2 palet, tek hareketli demo, dört görünür özellik ve mevcut kayıt rotasıyla uyumludur. **Font değişimi, yeni hareket veya dark mode önerilmiyor.** Aşağıdaki tercihler yalnız ürün sahibinin kararıyla ayrı kapsam olur:

1. **Satış görüşmesini hero’nun ana CTA’sı yapmak:** Özel kurulum ağırlıklı satış modeli varsa anlamlı olabilir; mevcut hesap oluşturma önceliğini değiştirir. Yeni akış onaylanmadan uygulanmamalı, `/register` “Demo talep et” diye yeniden etiketlenmemeli.
2. **Kısa hero başlığı için kategori terimini H1’den çıkarmak (B seçeneği):** Daha görev odaklı ifade sağlar; mevcut kategori/arama stratejisini değiştirir. A veya C seçilirse buna gerek yok.
3. **Mobil uygulamayı mevcut özellik olarak sergilemek:** Ürün bağlamında mobil uygulama bulunsa da pazarlama kaynağı “yakında” diyor. Dağıtım/kullanılabilirlik doğrulanmadan bu durum değiştirilemez.

Eski 23 Ekim model listesine geri dönmek de otomatik bir “polish” değildir. Güncel dört marka sözleşmesini değiştirmek gerekirse ürün doğrulaması ve ilgili test kararı birlikte ele alınmalıdır.

## 8. Uygulama yapılırsa kabul kontrolü

Bu rapor kod teslimi değildir; aşağıdaki kontroller çalıştırılmış sonuçlar değil, sonraki uygulama için ölçülebilir kapılardır.

1. 1440/1024/768/390/320 px ve metin büyütmede yatay taşma, kesilen başlık ve üst üste binen CTA yok. 390×844’te örnek akışın etiketi ve Durdur kontrolü, akışın üstünde görülebilir.
2. Overpass 700 self-host kalır; yeni font/bağımlılık/üçüncü taraf istek yok. Değişen kırpımlar anlamlı kayıtları okunur tutar; örnek veri açıklaması yerinde; görsellerin oranı bozulmamış.
3. Klavyeyle skip link, mobil menü aç/kapat/odak dönüşü, hero CTA’ları, demo kontrolü, FAQ ve iletişim bağlantıları kullanılabilir. Menü portalı ve açık/kapalı FAQ durumları ayrıca kontrol edilir.
4. Reduced-motion’da demo sabit; normal durumda Durdur/Sürdür, sekme gizleme ve viewport dışına çıkma mevcut davranışını korur. Demo dışında yeni geçiş animasyonu yok.
5. Üretim build’iyle aynı Lighthouse mobil koşullarında önce/sonra ölçüm: **performans 89 altına düşmez**, CLS için önceki tasarım hedefi `<0,05` korunur. Tek gürültülü ölçüm yerine aynı ortamda tekrarlı karşılaştırma; yeni skor raporlanır, eski sonuç kopyalanmaz.
6. Uygulama sahibinin kapıları: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`; `node_modules/.bin/eslint src convex`; değişiklikle ilişkili mevcut landing/public testleri ve yayın politikasının istediği diğer kontroller. `marketingFacts.test.ts` yasağı ve `LiveFeedDemo` davranış sözleşmesi gevşetilmez.
7. Ortak `public.css` nedeniyle login/register/status başlıklarının ve public menünün görünümü gerilememeli. Landing’e özgü yeni ölçüler gerekiyorsa global H1 veya uygulama tokenlarını değiştirerek çözülmemeli.

## 9. Emre’ye açık sorular — en fazla beş

1. İlk ziyaretçiden öncelikli beklenti **kendi hesabını açması mı**, yoksa **cihaz uyumluluğu/kapsam görüşmesi başlatması mı**? Varsayılan öneri mevcut hesap önceliğini korumak.
2. H1’de “Bulut PDKS ve Geçiş Kontrol” kategori ifadesinin tam biçimde kalması bilinçli bir arama/konumlandırma kararı mı? Öyleyse C; değilse A ile küçük bir anlatım iyileştirmesi öneriyorum.
3. “Mobil uygulama yakında” bugün hâlâ doğru mu; kullanılabilir durumdaysa kimler, hangi dağıtım kanalı ve hangi mevcut özelliklerle erişebiliyor? Doğrulanana kadar mevcut ifade korunmalı.
4. Dört entegrasyon markası için yayımlanabilecek onaylı model listesi ve kullanılabilir gerçek cihaz fotoğrafı var mı? Yoksa mevcut koşullu marka şeridini kompaktlaştırmak yeterli.
5. Footer için onaylı ticari unvan/adres ve yayımlanmış bilgilendirme sayfası var mı; güvenlikteki rol/yetki sayısı ile “her yönetim işlemi” kapsamı güncel olarak doğrulanabiliyor mu? Bu bilgiler gelmezse sayı büyütmek veya yeni güven rozetleri eklemek yerine mevcut somut mekanizmalar anlatılmalı.

---

**Teslim notu:** Yalnız bu rapor dosyası yazıldı. Kaynak kod, `convex/`, `public/`, bağımlılıklar ve git index’i değiştirilmedi; commit, deploy, migration veya DB yazma yapılmadı. Çalışma ağacında başlangıçta mevcut başka işlere ait değişiklikler vardı ve bunlara dokunulmadı. Kaynak değişmediği için tsc/eslint/build veya uygulama testleri bu danışmanlık tesliminde çalıştırılmadı.
