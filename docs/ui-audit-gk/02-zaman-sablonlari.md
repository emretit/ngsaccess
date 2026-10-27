# Geçiş Kontrol UX/UI denetimi — 02 Zaman Şablonları

**27 Ekim 2026 · NGS projesi · localhost:8081/access-control?tab=templates**

Haftalık saat oluşturma ve geceyi aşan aralığı iki güne ayırma doğru çalışıyor; kaydedilmemiş değişiklik uyarısı da anlaşılır. Teknik olmayan kullanıcı için asıl eksikler şablonun kuralla ilişkisinin açıklanmaması, boş seçicide ilerleme yolu bulunmaması ve ortak şablonu değiştirirken hangi kuralların etkileneceğinin görünmemesi. Canlı projede arşivler dahil hiç şablon olmadığından mevcut şablon düzenleme ve seçili şablondan geçiş canlı ortamda doğrulanamadı; ilgili bulgular açıkça kod incelemesi olarak işaretlendi.

| Yüksek | Orta | Düşük | Toplam |
|---|---|---|---|
| 1 | 8 | 1 | 10 |

## Kapsam ve yöntem

- Masaüstü: **1440 × 1000 CSS piksel**; mobil: **iPhone 12, 390 × 844 CSS piksel**. İki ayrı denetim sekmesi açıldı; aktif proje değiştirilmedi.
- Yalnız form taslakları değiştirildi. Kaydet, silme, arşivleme, şablon çoğaltma, onaylama ve cihaz gönderimi yapılmadı; Convex mutation çalıştırılmadı. Günleri forma kopyalama yalnız kaydedilmemiş yerel taslakta denendi.
- Önceki `docs/ui-audit-2/05-gecis-kontrol.md` okundu; eski Kurallar bulguları yeniden sayılmadı. Tasarım karşılaştırması `docs/ui-scan/DESIGN_DIRECTION.md` ve `docs/ux-audit/DESIGN_SYSTEM.md` üzerinden yapıldı.
- **Görüntü aracı sınırı:** PNG'ler Orca tarafından yatay/dikey tekrar eden parçalarla üretildi. Mobilde yalnız ilk üst parça yaklaşık 312 CSS pikseli güvenilir gösteriyor; bu çalışmada masaüstü görüntülerinde de yatay tekrar var. Tekrarlar uygulama hatası olarak sayılmadı; taşma, boyut, görünür metin ve odak ayrıca DOM (sayfanın eleman ağacı) üzerinden ölçüldü. Görüntüler ham haliyle saklandı ve açılıp incelendi; görünmeyen alt alanlar için kod/ölçüm kanıtı kullanıldı.

## Senaryolar

Adım sayısında bir tıklama veya bir alanı doldurma bir adım; kaydırma, inceleme ve taslaktan çıkma ayrıca belirtilmiştir.

### S1 — Hafta içi 08:00–18:00, cumartesi 08:00–13:00

**7 adım:** Yeni şablon → ad gir → Pazartesi aralık ekle → bitişi 18:00 yap → Pazartesi'yi hafta içine kopyala → Cumartesi aralık ekle → bitişi 13:00 yap. Başlangıçlar varsayılan 08:00; önizleme tam olarak `Pzt–Cum 08:00–18:00 · Cmt 08:00–13:00` oldu ve Kaydet etkinleşti, basılmadı.
Saat kutularında görünen başlangıç/bitiş etiketi yok; sonuç ve cihaz sınırları haftanın tamamının altında. Escape → Kaydetmeden çık ile **2 ek adımda** taslak bırakıldı. Kanıt: [masaüstü önizleme](02-zaman-sablonlari/desktop-s1-preview.png).

### S2 — Var olan şablonu düzenleme ve etkisini anlama

**Canlı ortamda 1 kontrol adımı:** Arşivlenenleri göster açıldı; liste yine boş. Var olan kayıt oluşturulmadı, dolayısıyla düzenleme akışı **canlı doğrulanmadı**.
Kodda bağlı kuralı olan şablon için Düzenle → değişiklik → Kaydet ile etki alanına varılıyor; ilk Kaydet bu durumda yalnız önizleme sorgusu çalıştırıyor. Ancak kural adları hiç sunulmuyor, cihaz gönderim bilgisi bu aşamaya kadar gizli ve yalnız ad/açıklama değişikliğinde de aynı gönderim sözü veriliyor. Kanıt: `TemplateEditor.tsx:143`, `TemplateEditor.tsx:297`, `convex/accessScheduleTemplates.ts:129`.

### S3 — Kural sihirbazı → Şablon kullan → şablonu düzenle

**7 adım:** Kurallar → Yeni kural → ad gir → İleri → bir kişi seç → İleri → Şablon kullan. Seçici açılıp incelendiğinde yalnız `Şablon seçin` seçeneği vardı; yeni şablon oluşturma bağlantısı yok, buna rağmen alt özet `Şablon kullanılıyor` dedi.
**Şablon seçme ve Şablonu düzenle geçişi canlı doğrulanmadı.** Kodda geçiş, taslağı kapatıp URL'yi Zaman Şablonları sekmesine yönlendiriyor; taslağı koruyarak geri dönüş yolu yok. Escape → Kaydetmeden çık ile çıkıldı. Kanıt: [boş seçici](02-zaman-sablonlari/desktop-picker-empty.png), `templates/model.ts:64`.

### S4 — Gece vardiyası 22:00–06:00

**5 adım:** Yeni şablon → ad gir → Pazartesi aralık ekle → başlangıç 22:00 → bitiş 06:00. Alt bölümde `Pazartesi 22:00–06:00: Ertesi güne taşan aralık → Pzt 22:00–24:00 · Sal 00:00–06:00` açıklaması ve doğru iki günlük önizleme oluştu; Kaydet'e basılmadı.
İşlev doğru, fakat açıklama giriş satırından uzak. Buna karşılık kuralın Özel saat bölümünün “Geceyi aşan planlar için ayrı kurallar oluşturun” yönlendirmesi bu daha kolay şablon yolunu göstermiyor. Kanıt: [gece önizlemesi](02-zaman-sablonlari/desktop-overnight.png), `components/TimeSchedule.tsx:81`.

## Bulgular

Aşağıdaki kısa kaynak yolları `src/components/access-control/unified/` altındadır; `convex/` ile başlayanlar depo kökünden okunur. “Kod incelemesi” bulgularında canlı kayıt davranışı denenmemiştir.

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| **02-H1** | Yüksek | Etkiyi anlama / erişim yetkisi | **Kod incelemesi:** Ortak şablonun onayı yalnız “N kural, N cihaz güncellenecek” diyor; kuralların adları ve bağlantıları yok. Liste de yalnız bağlı kural sayısını veriyor. | Yönetici farklı kişi gruplarının geçiş saatlerini değiştirmeden önce etkilenen kuralları tanıyamıyor. Sayı, değişikliğin kapsamını denetlemek için yeterli değil. | Düzenleyicide “Bu şablonu kullanan kurallar” listesi, kural adı ve inceleme bağlantısı göster; değişen saatlerle birlikte onayda da sun. | `templates/TemplateEditor.tsx:297`; `templates/TemplatesPage.tsx:109`; `convex/accessScheduleTemplates.ts:181` yalnız sayıları döndürüyor. **Canlı doğrulanmadı.** |
| **02-O1** | Orta | Boş durum / içerik | Ana sayfada yalnız “Henüz zaman şablonu yok.” ve Yeni şablon düğmesi var. Ne için kullanıldığı ve kurala bağlanacağı açıklanmıyor. | Yeni kullanıcı bunun kişilerin geçiş saatleri mi, kapının otomatik açık kalma saatleri mi olduğunu ayırt etmekte zorlanabilir. | “Kişilerin geçebileceği gün ve saatleri tanımlayın; ardından Kurallar bölümünde bir kurala bağlayın” açıklaması ve örnek ekle. Kapı Planları farkını bir cümleyle belirt. | [Boş liste](02-zaman-sablonlari/desktop-empty.png); `templates/TemplatesPage.tsx:75`, `templates/TemplatesPage.tsx:96`. |
| **02-O2** | Orta | Görev akışı / boş seçici | Sihirbazdaki Şablon kullan seçicisi boşken yalnız “Şablon seçin” gösteriyor; oluşturma bağlantısı veya neden boş olduğuna ilişkin bilgi yok. | Kullanıcı 3. adıma kadar geldikten sonra ne yapacağını bilemiyor; şablon hazırlamak için sihirbazdan çıkması gerekiyor. | “Henüz şablon yok” durumu, “Zaman şablonu oluştur” yolu ve taslağı koruyarak dönüş ekle; Özel saat alternatifini açıkla. | [Sihirbaz boş seçici](02-zaman-sablonlari/desktop-picker-empty.png); `templates/TemplatePicker.tsx:39`, `templates/TemplatePicker.tsx:49`. |
| **02-O3** | Orta | Sekmeler arası devamlılık | **Kod incelemesi:** Şablonu düzenle, değişiklik uyarısından sonra kural diyaloğunu kapatıyor ve sekmeyi değiştiriyor. Kural taslağı saklanmıyor. | Şablonu küçük bir düzeltmeyle kullanmak isteyen kişi, önceki ad/kişi/kapı seçimlerini yeniden yapmak zorunda kalıyor. Uyarı veri kaybını engelliyor ama işin devamını sağlamıyor. | Şablonu iç içe düzenleme veya taslağı koruyup “Kurala dön” sunma seçeneklerinden birini uygula. | `templates/model.ts:64`; `CreateRuleDialog.tsx:257`; `UnifiedAccessControl.tsx:40`, `UnifiedAccessControl.tsx:88`. **Canlı doğrulanmadı.** |
| **02-O4** | Orta | Form / hata / erişilebilirlik | Saatler yalnız yan yana iki kutu; görünen başlangıç/bitiş etiketi yok. Mobilde Pazartesi bitişine `25:00` girince genel hata haftanın altında; alanın `aria-invalid` ve `aria-describedby` değerleri yok. | Hangi kutuyu düzelteceği ve kabul edilen biçim belirsiz. Ölçümde hatalı alan y≈90 iken hata y≈863; 844px yüksekliğindeki ekranda hata görünmüyor. | Başlangıç/Bitiş etiketleri, `22:00` biçim örneği, alanın hemen altında gün/aralık belirten hata ve erişilebilir hata bağlantısı ekle; geceye taşma açıklamasını da ilgili satıra yaklaştır. | [Hatalı mobil alan](02-zaman-sablonlari/mobile-invalid-field.png); `templates/TemplateEditor.tsx:70`, `templates/TemplateEditor.tsx:230`; `convex/lib/accessSchedule.ts:38`. DOM: `type=text`, `inputMode=''`, hata bağlantıları `null`. |
| **02-O5** | Orta | Dil / teknik bilgi | “Hik: gün başına en çok 1 aralık ✓(8) · IDE: 2 izin kaydı ✓(8)” ve “Birleştirilmiş önizleme” açıklamasız gösteriliyor. | Kullanıcı aralık ile izin kaydı arasındaki farkı ve parantezdeki 8'in ne olduğunu bilmiyor; normal senaryoda teknik kapasite sayıları dikkat dağıtıyor. | “Haftalık geçiş saatleri” başlığı kullan; kapasiteyi “Cihaz uyumluluğu” açıklamasına taşı. Sınır aşıldığında sade bir çözüm önerisi göster. | [S1 önizleme](02-zaman-sablonlari/desktop-s1-preview.png); `templates/TemplateEditor.tsx:225`, `templates/TemplateEditor.tsx:237`. |
| **02-O6** | Orta | Yönlendirme / terim tutarlılığı | Özel saat bölümünde geceyi aşan “planlar” için ayrı kurallar öneriliyor; zaman şablonu aynı gece aralığını zaten destekliyor. | Tek vardiya için gereksiz iki kural oluşturma yükü yaratıyor; “plan” sözcüğü Kapı Planları ile de karışabiliyor. | “Geceyi aşan geçiş saatleri için Şablon kullan seçeneğini kullanın” yönlendirmesi ve örnek ekle. | `components/TimeSchedule.tsx:81`; `templates/schedule.ts:42`; [çalışan gece şablonu](02-zaman-sablonlari/desktop-overnight.png). Metin ve kod doğrulandı. |
| **02-O7** | Orta | İşlem durumu / doğru beklenti | **Kod incelemesi:** Bağlı kuralı olan şablonda yalnız ad/açıklama değişse bile onay “20 sn içinde tek gönderim başlar” diyor. Backend gönderimi yalnız haftalık saatler değiştiğinde planlıyor. | Kullanıcı gerçekleşmeyecek bir cihaz gönderimini bekleyebilir; “kaydetme” ile “cihaza iletme” ilişkisi yanlış anlatılıyor. | Önce değişiklik türünü hesapla. Ad/açıklamada “Geçiş saatleri değişmedi; cihaz gönderimi gerekmiyor”; saatte otomatik gönderim ve izleme bağlantısı göster. | `templates/model.ts:55`; `templates/TemplateEditor.tsx:298`; `convex/accessScheduleTemplates.ts:129`. **Canlı doğrulanmadı.** |
| **02-O8** | Orta | Özet / sayı doğruluğu | Şablon seçilmemişken sihirbaz alt özeti “Şablon kullanılıyor” diyor. | Kullanıcı geçerli zaman kapsamının hazır olduğunu sanabilir; boş seçicinin eksikliği gizleniyor. | Seçim yokken “Zaman şablonu seçilmedi”; seçilince şablon adı ve kısa saat özeti göster. | [Seçilmemiş şablon özeti](02-zaman-sablonlari/desktop-picker-empty.png); `CreateRuleDialog.tsx:282`. Canlı DOM'da tek seçenek boş değerli “Şablon seçin”. |
| **02-D1** | Düşük | Ölçek / sorgu / hata dayanıklılığı | **Kod incelemesi:** Ana liste ve sihirbaz aynı sorguyla arşivler dahil bütün şablonları, haftalarını ve her şablonun kural sayısını alıyor. 200 şablon veya bir şablonda 100 kural sınırı aşılırsa sorgu hata atıyor; bu iki tüketicide yerel sorgu hata sınırı yok. | Şablon sayısı arttığında seçici için gereksiz okuma oluşur; limit hatasında bölüm içi açıklama/yeniden deneme yerine üst hata sınırına düşme riski var. Mevcut boş projede yavaşlık gözlenmedi. | Seçiciye yalnız gereken alanları veren sorgu; liste için sayfalama ve önceden hesaplanan kural sayısı; tüketicilere `QuerySectionBoundary` ekle. | `convex/accessScheduleTemplates.ts:12`, `convex/accessScheduleTemplates.ts:22`, `convex/accessScheduleTemplates.ts:95`; `templates/TemplatesPage.tsx:30`; `templates/TemplatePicker.tsx:22`; `UnifiedAccessControl.tsx:77`. **Yük ve hata görünümü canlı doğrulanmadı.** |

## Ekran ve etkileşim kontrolü

- **Doğru çalışanlar:** Yeni şablon açılması, gün aralığı ekleme, hafta içine yerel kopyalama, canlı saat önizlemesi, geceyi bölme ve arşiv görünürlüğü anahtarı çalıştı. Ad boşken Kaydet devre dışı; geçerli S1 taslağında etkin. Geçersiz `25:00` için önizleme kaldırılıyor ve hata üretiliyor; sorun hata konumu ve açıklaması.
- **Klavye/odak:** Düzenleyici açılışında odak Ad alanına geldi. Mobilde Tab Ad → Açıklama geçişi yaptı; hesaplanan odak halkası 2px bordo. Escape değişiklik uyarısını açtı; “Düzenlemeye dön / Kaydetmeden çık” metinleri net. Taslaklar Kaydetmeden çık ile kapatıldı. Eski rapordaki belirsiz “Vazgeç / Çık” uyarısı bu akışta tekrar görülmedi.
- **Mobil:** Düzenleyicinin `clientWidth=356`, `scrollWidth=356`; yatay taşma ölçülmedi. Boş formun içeriği 1512px, görünür yüksekliği 810px; Kaydet ve Vazgeç alt uçta, sabit işlem çubuğu yok. Saat alanları ve çoğu düğme 36px, Kapat 36×36px; istenen 44px hedef altında. Ortak bileşen düzeyindeki eski küçük hedef bulgusu tekrar sayılmadı; bu yeni ekran da iyileştirmeden yararlanmalı.
- **A2:** Sistem fontu, nötr zemin, bordo odak/önizleme, sade çerçeveler uyumlu. Ana başlık `text-xl` (20px), A2 sayfa başlığı ölçeği 26px; `PageHeader` kullanılmıyor. Dolu liste kodunda kart başına dört ayrı işlem var; A2 satır işlemleri menüsüyle tutarlılık değerlendirilebilir, ancak dolu liste canlı görülemediği için ayrı görsel bulgu yazılmadı.
- **Saat/tarih:** Düzenleyici açıklaması Türkiye saatini söylüyor; önizleme `Europe/Istanbul` ve `00:00–24:00` bilgisini veriyor. Backend zaman kontrolü aynı saat dilimini kullanıyor (`convex/lib/accessSchedule.ts:60`). Tarih içeren bir alan bu boş veriyle görünmedi.
- **Denenmeyenler:** Dolu karttaki Düzenle/Kopyala/Arşivle/Geri al/Sil ve etki onayı için veri yok; kaydetme/gönderim etkisi yasak nedeniyle çalıştırılmadı. Bunların çalıştığı iddia edilmiyor. Sunucu hatası veya gecikme yapay olarak tetiklenmedi; yükleme için `SectionSkeleton` bulunduğu koddan doğrulandı.

## Hızlı düzeltmeler

Her madde ayrı ele alındığında **30 dakika veya altı** küçük değişiklik hedefidir; uygulanmadı.

1. **02-O1:** Boş listeye kişilerin geçiş saatlerini ve kurala bağlama adımını anlatan iki cümle ekle.
2. **02-O2:** Boş seçicide “Bu projede zaman şablonu yok” açıklaması göster; taslağı koruyan geçiş hazır değilse önce gerekli adımı açıkça anlat.
3. **02-O8:** Alt özeti seçili şablon kimliğine göre “Seçilmedi / [şablon adı]” olarak üret.
4. **02-O6:** Geceyi aşan saat ipucunu Şablon kullan yoluna yönlendir; “plan” yerine “geçiş saatleri” de.
5. **02-O5:** Önizleme başlığını sadeleştir, Hik/IDE kapasite satırına kullanıcı dilinde açıklama ekle.
6. **02-O4:** Saat çiftine görünen Başlangıç/Bitiş etiketleri ve biçim ipucu ekle. Gün bazlı hata eşleme daha büyük ayrı iş olarak ele alınmalı.

## Ürün kararı gereken

1. **Kuraldan şablon düzenlemeye nasıl geçilmeli?** A) Şablonu aynı sihirbaz içinde düzenle; B) Taslağı sakla, ayrı sekmeden “Kurala dön” sun; C) Çıkışta taslak kaybını koru ve geçiş öncesi açıkça bildir. Öneri: B.
2. **Ortak şablon değişikliğinde kapsam nasıl onaylanmalı?** A) Kural adları ve cihazlar her zaman görünür, saat değişikliği ayrıca onaylanır; B) “Etkilenen kuralları göster” açılır listesi; C) Mevcut yalnız sayı özeti. Öneri: A.
3. **İlk kullanım ne sunmalı?** A) Açıklama + boş form; B) “Hafta içi mesai / 7 gün 24 saat / gece vardiyası” hazır taslakları; C) Önce kısa gün-saat sihirbazı. Öneri: B, şablonların yalnız kurala bağlanınca etkili olduğunu açıklayarak.

## Ekran görüntüleri

Görüntü aracının tekrar/eksik alt alan sınırı nedeniyle bunlar tam sayfa doğrulaması değildir; yukarıdaki dosya/satır kanıtları ve DOM ölçümleriyle birlikte okunmalıdır.

- [Masaüstü boş liste](02-zaman-sablonlari/desktop-empty.png)
- [S1 doğru saat önizlemesi](02-zaman-sablonlari/desktop-s1-preview.png)
- [S4 geceyi aşan saat](02-zaman-sablonlari/desktop-overnight.png)
- [S3 boş şablon seçicisi](02-zaman-sablonlari/desktop-picker-empty.png)
- [Mobil boş liste](02-zaman-sablonlari/mobile-empty.png)
- [Mobil düzenleyici üstü](02-zaman-sablonlari/mobile-editor-top.png)
- [Mobil hatalı saat alanı](02-zaman-sablonlari/mobile-invalid-field.png)
- [Mobil alt bölüme kaydırma denemesi](02-zaman-sablonlari/mobile-error-bottom.png) — hata satırı görüntü parçasının dışında; hata metni DOM'dan doğrulandı.
- [Mobil çıkış uyarısı sırasında görüntü](02-zaman-sablonlari/mobile-unsaved.png) — uyarı katmanı ilk görüntü parçasının dışında; işleyiş etkileşimle doğrulandı.

**Teslim:** Yalnız bu rapor ve `02-zaman-sablonlari/` altındaki ekran görüntüleri üretildi; uygulama kodu ve canlı kayıtlar değiştirilmedi.

## Kararlar (Emre, 2026-10-27)
- 02-O3 kuraldan şablon düzenleme: **taslak saklanır**, şablon sekmesinde "Kurala dön" ile kaldığı yere döner.
- 02-H1 etki: düzenleyicide ve onayda **kural adları + cihazlar her zaman görünür**, saat değişikliği ayrıca onaylanır.
- 02-O1 ilk kullanım: **hazır taslaklar** ("Hafta içi mesai", "7/24", "Gece vardiyası") + kısa açıklama.
- 02-O6 / 01-D4 gece saati: kuralın Özel saat bölümü de 22:00–06:00 gibi aralığı **otomatik böler** (ayrı kural gerekmez).
- Koordinatör doğrulaması: 02-H1 (`convex/accessScheduleTemplates.ts:181` yalnız sayı döner) ve 02-O7 (`:129` gönderim yalnız `week` değişince) kodda doğrulandı.
