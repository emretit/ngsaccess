# Astra — çapraz eleştiri ve nihai polish pozisyonu

4 Kasım 2026 · `fable.md` okundu; aşağıdaki dosya/satırlar mevcut kaynakta yeniden doğrulandı. Yalnız bu rapor yazıldı; yeni görsel ölçüm, kod değişikliği veya performans testi yapılmadı.

## Yedi ayrışmada nihai karar

### 1. Derinlik — gölge yalnız hero ürün görselinde kalsın

Fable’ın bütün ürün kırpımları, canlı kart ve iletişim kartına iki katmanlı gölge yayma önerisini almıyorum: mevcut `elevated` ayrımı aynı bileşenin tutarsızlığı değil, bağlama göre hiyerarşidir (`src/components/public/public.css:83`, `src/components/public/ProductShot.tsx:32`). Hero gölgesi gerekirse tek başına inceltilebilir; diğer yüzeylerde hizalama, okunurluk ve kenar dili daha yüksek getirili, karar değiştirmeyen polish işleridir.

### 2. Etkileşim — ek animasyon yok; durum geri bildirimi var

140 ms geçiş, CTA okunun kayması ve `translateY(1px)` aktif hareketi eklenmesin; hover/active anlık renk veya yüzey değişimiyle, focus mevcut görünür outline ile anlatılsın. Bu görevdeki “tek animasyon” şartını eski plandaki “tek otomatik hareket” ifadesine daraltmıyorum; FAQ’nin mevcut 200 ms dönüşü de kaldırılıp statik artı/eksi durumu kullanılmalı (`src/components/public/public.css:561`, `src/components/public/public.css:564`), CTA’ya işlev katmayan ok şart değil.

### 3. Hero H1 — kategori H1’de kalsın, eyleme açılsın

Kategori ifadesini yeni eyebrow’a taşımıyorum; nihai metin tercihim **“PDKS ve geçiş kontrolünü birlikte yönetin.”**, açıklamada giriş-çıkış, puantaj, vardiya ve izinlerin buluttan yönetilmesi. Kendi önceki “işyerinizin günlük akışı” ifadem kategoriyle fayda arasında biraz soyut kalıyordu; Fable’ın somutlaşma itirazını alıyorum, fakat “Kapıdaki her geçiş” hem kapsamı gereğinden mutlaklaştırıyor hem ürünü Canlı İzleme’ye daraltıyor (`src/components/landing/marketingFacts.ts:8`, `src/components/landing/marketingFacts.ts:10`).

### 4. LiveFeedDemo — üstte örnek etiketi ve kontrol; dört satır; pulse/fade yok

“Örnek veri” ve Durdur üst bölüme taşınsın; kart görünürken ne olduğu ve nasıl durdurulacağı hemen anlaşılsın (`src/components/landing/LiveFeedDemo.tsx:85`, `src/components/landing/LiveFeedDemo.tsx:109`). Mobilde dört satır ve mevcut giriş animasyonu korunsun; yükseklik önce boşluklardan azaltılsın, çıkış fade’i ve nokta pulse’ı eklenmesin: örneği anlamaya yeni katkı sunmuyorlar, dört satır mevcut render/test sözleşmesi (`src/components/landing/LiveFeedDemo.tsx:93`, `src/components/landing/LiveFeedDemo.test.tsx:50`).

### 5. Donanım — renkli, kompakt, iletişime bağlı

Fable’ın kutuların baskınlığı ve optik logo ağırlıkları eleştirisini benimsiyorum; renkleri/opacity’yi değiştirmeden daha hafif şerit, mobil 2×2 ve uygunluk metninden `/#iletisim` bağlantısı öneriyorum. Model adları ancak güncel ürün doğrulamasıyla P2’de eklenmeli; mevcut logolar bağlantı değil (`src/components/landing/HardwareStrip.tsx:24`), bu yüzden sırf grayscale’den renge dönsünler diye klavye odağı eklemek anlamsızdır.

### 6. Sticky header — hayır

Önce uzun ilk bölüm ve ürün kırpımları iyileştirilsin; kalıcı header mobil alanını azaltır ve mevcut “sticky yok” kararını değiştirmek için yalnız sayfa uzunluğu yeterli kanıt değildir. Ayrıca önerilen `header` üzerinde sticky, onu saran kısa `.pub-scene` kapsayıcısı nedeniyle doğrudan beklenen sayfa boyu davranışı vermeyebilir; öneri yalnız bir CSS satırı/observer işi değildir (`src/components/public/PublicHeader.tsx:26`, `src/components/public/PublicHeader.tsx:33`).

### 7. Final CTA — başlık değişikliği + ikincil “Bize yazın”

Burada Fable’ın ikinci temas yolu önerisini alıyorum: **“NGS Plus hesabınızı oluşturun.”** başlığı, ana **Hesap oluştur** ve daha sakin ikincil **Bize yazın** (`mailto:`) birlikte kullanılabilir. Mevcut düğme yalnız `/register` açarken başlık ilk kapıyı bağlamaya sıçrıyor (`src/components/landing/FinalCTASection.tsx:14`, `src/components/landing/marketingFacts.ts:188`); başlık gerçek sonraki adıma, ikincil eylem kurulum sorusu olan kişiye hizmet eder, fakat bunu P1 tutarım.

## Fable’dan aldığım, önceki raporumda atladığım üç bulgu

1. **Tablet kırpım aralığı — yeni P0:** Canlı İzleme ve Vardiya için mobil kaynak sınırı gerçekten 600 px (`src/components/landing/FeaturesSection.tsx:22`, `src/components/landing/FeaturesSection.tsx:67`); 601–1023 arası geniş masaüstü kırpımı kullanılıyor. Fable’ın “yaklaşık 6 px” ölçümünü bağımsız tekrarlamadım, fakat kaynakta kırpım boşluğunu doğruladım; PDKS/geçiş ikilisi de yalnız 600 altında tek sütuna geçtiğinden ayrıca incelenmeli (`src/components/landing/FeaturesSection.tsx:12`, `src/components/public/public.css:762`).
2. **İletişim hover’ında ikon kutusu zemine karışıyor:** Satır hover zemini ve ikon zemini aynı `--side-text` (`src/components/public/public.css:477`, `src/components/public/public.css:487`). Bu okunamayan ikon hatası değil, fark edilmeyen yüzey ayrımı; gerekiyorsa hover’da ikon yüzeyi beyaz yapılabilir veya kutu sadeleştirilebilir, animasyon gerekmez.
3. **İlk açık FAQ sorusunun seçimi:** `open={i === 0}` gerçekten hesap açıklamasını ilk açık tutuyor; cihaz uyumluluğu ikinci sırada (`src/components/landing/FAQSection.tsx:15`, `src/components/landing/marketingFacts.ts:160`, `src/components/landing/marketingFacts.ts:164`). Donanım tereddüdünü önce yanıtlamak iyi bir P1 içerik önerisi; hesap açıklaması silinmemeli, aynı anda birden fazla yanıtı açabilmek de korunmalı.

## Riskli veya desteklenmeyen öneriler

- **“CSS olduğu için Lighthouse etkisi 0”, “preload ile FOUT 0 / LCP +50–100 ms”** sonuçları ölçümsüz garanti edilemez; gölgeler boyama maliyeti taşır, component effect’inde eklenen preload ilk render sonrası geç kalabilir. Bunları P0 gerekçesi veya performans kazanımı diye kullanmayalım.
- **“Gradient değil” diye sunulan `linear-gradient` yine gradient’tir.** Ton farkının küçük olması düz bordo kararını koruduğu anlamına gelmez; bu ek dekorasyona ihtiyaç görmüyorum.
- **Aynı bileşende olması pulse’ı aynı hareket yapmaz.** Mevcut Durdur yalnız interval’i durduruyor (`src/components/landing/LiveFeedDemo.tsx:66`); eklenecek CSS pulse kendiliğinden durmaz, ayrıca bağlanması gerekir. Reduced-motion tek başına Durdur semantiğinin yerine geçmez.
- **Beşinci satır + 320 px maske çıkış animasyonunu çözmez:** Mevcut dört 80 px satır alanı dolduruyor, beşinci satır bütünüyle dışarıda kalır (`src/components/public/public.css:902`, `src/components/public/public.css:909`); önceki son satırı çıkış boyunca DOM’da tutan ayrı yaşam döngüsü gerekir. Öneri tarif edildiği kadar basit ve maliyetsiz değil.
- **“İkili kırpımlar zaten yarım sütun, sorun yok” güvenli değil:** Daha dar gösterim okunurluk riskini artırabilir; yalnız tam genişlik kaynaklarının breakpoint’ini 1023’e yükseltmek bütün tablet aralığını çözdü sayılmaz. Dikey mobil kırpımı tablet tam genişliğine yaymanın sayfa yüksekliği etkisi de ölçülmeli.
- **“B2B ziyaretçisinin yarısı konuşmak ister”, “şık hissin %60’ı gölge” ve “grayscale modern standardı”** kanıt değildir. Final CTA’daki temas yolunu bu oranlara değil gerçek iki kullanıcı niyetine dayandırıyorum; sayı, model, marka kullanım izni ve mağaza sürümü doğrulanmadan pazarlama metnine taşınmamalı.
- **Geçiş Kontrol’e özel 12 px köşeli, dolgulu ve gölgeli panel** mevcut dengeli ikiliye açıklanmayan bir önem farkı getirir; aynı anda “kart yığını yok” hedefini zayıflatır. Genel tasarım eksikliği gibi sunulan düz yüzey ve alt çizgili bağlantılar kendi başlarına kusur değildir.

## İki raporu birleştiren nihai P0 — beş madde

1. **Tablet ürün kırpımlarının okunurluğu:** 601/768/1023 px’de dört özelliği incele; uygun kaynak/breakpoint/kolon çözümünü seç, görsel yüksekliğini ve `sizes` değerlerini birlikte doğrula.
2. **Kategori + eylem taşıyan hero:** H1’i kısalt, açıklamayı iki kısa cümleye böl; Overpass, bordo ve mevcut ana/ikincil hero CTA rotalarını koru.
3. **Demo üstünde “Örnek veri” ve Durdur:** Dört satır ve mevcut durma davranışı korunarak kontrolü ilk görülen bölgeye taşı; yeni hareket ekleme.
4. **Kompakt entegrasyon şeridi:** Optik logo dengesi ve daha hafif kutu dili; renkli varlıklar, mobil 2×2 ve model uygunluğundan iletişime açık yol.
5. **Kritik küçük metinlerin okunurluğu:** Satın alma notu, örnek etiketi, red nedeni ve caption’larda 13–14 px hedefini yerleşimle birlikte dene; taşma ve kontrastı kontrol et.

Önceki raporumdaki hero ekranını yeniden kırpma işi, Fable’ın tablet bulgusuyla öncelik değiştirerek P1’e indi; yeni gölge sistemi, hover animasyonları ve sticky header ortak P0’a girmiyor. Performans alt sınırı 89 ve mevcut iddia yasakları aynen korunur; bu turda bu kapıların yeniden geçtiği iddia edilmez.
