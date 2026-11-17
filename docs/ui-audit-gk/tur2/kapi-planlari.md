# Kapı Planları — ikinci tur denetimi

27 Ekim kararlarının ana parçaları uygulanmış; tek kapı etki özeti, plan türü seçimi ve mobil gönderim görünürlüğü belirgin biçimde iyileşmiş. Kalan en önemli sorun, tatil takvimi değiştikten sonra daha önce başarıyla gönderilmiş planı yeniden gönderecek yolun olmaması; liste etkileşimi ve haftalık kopya önizlemesi de ortak kalıpla tam uyumlu değil. Bilinen sayfa başlığı sorunu bu rapora dahil edilmedi.

| Yüksek | Orta | Düşük | Toplam |
|---|---|---|---|
| 1 | 3 | 3 | 7 |

**Kapsam:** 05.11.2026, NGS, `/access-control?tab=doors`; masaüstü 1639×939, kendi sekmemde 390×844 iframe ile mobil. Canlıda Giriş/NGS0001 ve Çıkış/NGS0002 var; ikisi de “Plan etkin değil / Gönderilmedi”. Kod ve canlı veri değiştirilmedi, gönderim/kaydetme/kopyalama son eylemleri çalıştırılmadı. Yalnız yerel taslak, seçim ve açma/kapatma kullanıldı. Tüm PNG'ler açılıp incelendi; mobil görüntüler 390 px genişliğindeki çerçeveyi solda, geri kalan boş tarayıcı yüzeyini sağda gösterir.

## Bulgular

Kaynak yolları depo köküne göredir. **DP** = `src/components/access-control/door-plans/`; **DD** = `src/components/access-control/door-dialog/`. Koddan doğrulanan dallarda ekran görüntüsü ilgili arayüzü gösterir; gerçek cihaz sonucu olarak kullanılmaz.

| ID | Önem | Tür | Ne görülüyor | Sitenin geri kalanında nasıl | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| GK2-KP-H1 | Yüksek | mantık | Tatil metni “Tatil değişikliklerinde yeniden gönderin” diyor; fakat önceki gönderim başarılıysa `retryKeys` boş, düğme yok. Aynı yıl/mod korununca `updatePlans` değişiklik bulmuyor, Kaydet de gönderim yapmıyor. Takvimde tarih ekleme/silme kapı planını bekliyor olarak işaretlemiyor. Böylece fiziksel kapı eski tatil günlerini kullanabilir. Kontrol akışı koddan doğrulandı; gerçek takvim değişikliği ve cihaz etkisi **canlıda doğrulanmadı**. | Bu formun hata/bekleyen dalında açık yeniden gönderme eylemi var; başarılı planın takvim güncellemesinde aynı toparlanma yolu yok. | Etkin tatil planına değişikliksiz yeniden gönderme sağla; ayrıca takvim değiştiğinde ilgili planı gönderim bekliyor olarak işaretle. | `DP/DoorPlanDialog.tsx:139`, `:184`, `:278`, `:451`; `convex/doors.ts:619`, `:628`, `:749`; `convex/holidays.ts:63`, `:104`, `:123`; [tatil formu](kapi-planlari/desktop-holiday.png). |
| GK2-KP-O1 | Orta | tasarım | Plan sütununun tamamı tıklamayı kesiyor. “Plan etkin değil” metnine tıklandığında diyalog açılmadı (`dialog=false`); kapı adına tıklayınca açıldı. İmleç satırda pointer olmasına rağmen geniş bir alan tepkisiz. | Kişiler ve Ziyaretçiler satırın etkileşimli kontroller dışındaki her yerinden ayrıntı açar. | `stopPropagation` yalnız “Plan ayrıntıları” açılır kontrolünde kalsın; hücre boşluğu ve plan özeti satır eylemine geçsin. | `DP/DoorPlansTab.tsx:172`, `:217–219`; `src/components/employees/table/EmployeeTableRow.tsx:52`; [liste](kapi-planlari/desktop-list.png). |
| GK2-KP-O2 | Orta | tasarım | Arama/filtre ve sayfalama yok; çok kapıda yalnız elle tarama var. Sorgu ilk 1000 kapıyı alıp sonra uygun cihazları ayıklıyor; daha sonraki uygun kapılar görünmeyebilir. İki kapılı canlı projede kesilme **doğrulanmadı**. | Kişiler/Cihazlar/Ziyaretçiler aramayla başlayan FilterBar ve filtre temizleme kullanır. | Kapı/cihaz araması ve gönderim durumu filtresi ekle; sunucuda sayfalı uygun hedef sorgusuna geç, kesilmiş sonucu tam liste gibi sunma. | `DP/DoorPlansTab.tsx:113`, `:131`, `:168`; `convex/doors.ts:654–657`; `src/components/employees/EmployeeFilters.tsx:17`; `src/components/devices/DeviceFilters.tsx:28`; [liste](kapi-planlari/desktop-list.png). |
| GK2-KP-O3 | Orta | mantık | Haftalık kopya önizlemesi yalnız gün/aralık sayısını verir; hangi gün, saat ve sürekli açık/kilitli modunun kopyalandığı görülemez. Tarihli tatil önizlemesi de kopya akışında yalnız yıl/moda iner. 04-O5'in plan türü/hedef adları yapılmış, ayrıntılı kaynak özeti eksik kalmış. Canlı kaynaklar devre dışı; etkin haftalık örnek **canlıda doğrulanmadı**, metin üretimi koddan kesin. | Tek kapının etki özeti gün/saat/mod verir ve uzun metni “Tüm aralıkları göster” ile açar. | Aynı özet bileşenini kopyalamada kullan; haftalık aralıkları ve tatil tarihlerini açılabilir ayrıntı olarak göster. | `DP/CopyDoorPlansDialog.tsx:42–54`, `:203–208`; `DP/DoorPlanImpactSummary.tsx:129`; [kopya](kapi-planlari/desktop-copy.png), [tek kapı özeti](kapi-planlari/mobile-impact.png). |
| GK2-KP-D1 | Düşük | metin | IDE/Hik olmayan ve gateway bağlantısı olmayan Hik kapılar listeden sessizce çıkarılır. Liste boşsa “Plan kurulabilecek Hikvision kapısı yok” denir; gateway koşulu açıklanmaz. Dolu listede destek kapsamına dair açıklama yok. Bu cihaz çeşitleri canlı örnekte bulunmadığından mesaj dalları koddan incelendi. | Cihazlar listesinde cihazlar görünür; kullanıcı orada gördüğü kapının burada neden olmadığını anlayabilmeli. | Üste kısa kapsam metni: “Kapı planları Hikvision gateway kapılarında desteklenir”; boş durumda da aynı koşulu belirt. | `convex/doors.ts:657`; `DP/DoorPlansTab.tsx:94`, `:167`; [kapsam açıklaması olmayan liste](kapi-planlari/desktop-list.png). |
| GK2-KP-D2 | Düşük | metin | “Kapı Durum Planı”, “Doğrulama Modu Planı” başlıkları cümle düzeninde değil; kopyada aynı alan “Doğrulama planı”. “Kart veya Yüz / Parmak İzi” liste sözlüğünde de büyük harf kalmış. | Ortak etiket kuralı cümle düzeni; kopya seçimleri “Durum planı / Doğrulama planı / Tatil planı”. | Başlıkları “Kapı durum planı / Doğrulama planı” yap; mod adlarını tek sözlükte birleştir. | `DD/DoorStatusPlanSection.tsx:24`, `DD/DoorVerifyPlanSection.tsx:26`; `DP/DoorPlansTab.tsx:36`; [form](kapi-planlari/desktop-dialog.png), [kopya](kapi-planlari/desktop-copy.png). |
| GK2-KP-D3 | Düşük | tasarım | Mobilde ilk kapı çerçeveli kartken son kapının çerçevesi yok; iki kayıt farklı bileşen gibi görünüyor. | Aynı listedeki eşdeğer kayıtların sınır ve dolgu düzeni tutarlı olmalı. | Mobil kart sınırını `TableBody` son satır istisnasından ayır veya mobil listeyi ayrı kart öğeleriyle çiz. | `DP/DoorPlansTab.tsx:171`; `src/components/ui/table.tsx:63` (`last-child:border-0`); [mobil liste](kapi-planlari/mobile-list.png). |

## Uyumlu olanlar

- **04-H1 düzeltildi:** boş sonuç başarı sayılmıyor (`src/components/access-control/doorPlanResult.ts:34`); değişikliksiz kayıt açıkça “cihaza bir şey gönderilmedi” diyor (`DP/DoorPlanDialog.tsx:185`). Hatalı/bekleyen kayıt yeniden açıldığında `persistedKeys` üzerinden tekrar gönderilebilir (`:133–146`). Toplu işlemde boş sonuç “Değişiklik yok, gönderilmedi” (`DP/bulk.ts:105`). Gerçek hata/gönderim çalıştırılmadı.
- **04-H2 uygulandı:** tek “Kaydet ve cihaza gönder” ve değişiklik olduğunda kapı/gün/saat/fiziksel etki özeti var (`DP/DoorPlanDialog.tsx:474`, `:493`). Mobilde Pzt–Cum 08:00–18:00 açık, Cmt–Paz normal özeti görüldü: [kanıt](kapi-planlari/mobile-impact.png).
- **04-O3 büyük ölçüde uygulandı:** seçilen yıldaki proje + Türkiye geneli tüm tatiller sorgulanıyor; dolu durumda tarih aralıkları/tam gün önizlemesi var (`convex/doors.ts:749`, `DP/DoorPlanDialog.tsx:387`). Yarım gün kayıtlarının tam gün uygulanacağı yazıyor. Takvim bağlantısı boş durumda var (`:370–384`), dolu durumda yok; 2026 boş durum ve bağlantı canlıda görüldü, dolu tarih listesi koddan doğrulandı. Takvim yenilemesi sonrası gönderme boşluğu H1'de.
- **04-O5 kısmen uygulandı:** durum/doğrulama/tatil ayrı seçiliyor; hedef adları açılabiliyor; kaynak hedeflerden çıkarılıyor; seçilmeyen veya kaynakta olmayan türler korunuyor (`DP/CopyDoorPlansDialog.tsx:81`, `:179`, `:217`; `DP/bulk.ts:17`). Kalan özet sorunu O3'te.
- Masaüstü isim altı çizgisiz, ad düğmesi klavye odağı alıyor; `ROW_CLICK_CLASS`, `Table resizeKey="door-plans"` ve `TableHead columnId` mevcut (`DP/DoorPlansTab.tsx:131`, `:160`, `:204`). Plan hücresi istisnası O1'de.
- Aktif proje içindeki yükleme/boş sonuçta `TableStateRow` tablo başlığını koruyor (`DP/DoorPlansTab.tsx:167`). Proje kapsamı henüz yüklenirken ayrı metin, proje yokken ayrı EmptyState var (`:99–110`); bu dallar canlıda zorlanmadı.
- Mobilde gönderim kapı adıyla aynı kartta; belge genişliği ve kaydırma genişliği 390 px. Kapalı plan formu iç genişlik/kaydırma genişliği 356/356, yüksekliği 649 px. Hafta içi açık taslakta 341/341, görünür yükseklik 758, içerik 1256 px; alt eylemler ve etki özeti kaydırılarak okunuyor. Önceki mobil sütun kaybı ve kapalı planların uzun editörü giderilmiş.
- Hafta içi seçeneği ve hafta sonunu boş bırakan başlangıç var (`DD/weeklyPlan.tsx:107`, `:214`). Normal davranış/kişi yetkileri açıklanıyor; saatlerde “TR saati”, gönderimde `formatTrDateTime` kullanılıyor. Kurallar kişi erişimini, bu sekme kapının genel davranışını anlatıyor; kavramsal ayrım daha açık.
- Çevrimdışı cihaz listeden çıkarılmaz, “Çevrimdışı” rozeti alır (`DP/DoorPlansTab.tsx:212`). Formda ayrı çevrimdışı açıklaması yok; işlem engellenmiyor, başarısız action sonucu satıra/forma taşınıyor. IDE ve diğer markalar listede yok; mutation da reddediyor (`convex/doors.ts:609`). `convex/lib/gatewayCommand.ts:719` ve `:684` plan hatasını kaydeder; tatil desteği bilinmiyorsa form gönderim öncesi denetleneceğini söyler (`DP/DoorPlanDialog.tsx:365`). Çevrimdışı/gerçek cihaz yanıtları bu çalışmada denenmedi.

## Üst düğmeler — PageHeader çalışması için

| Metin | Görünürlük / işlev | Dosya:satır |
|---|---|---|
| **Planı kopyala** | Yalnız en az bir kapı seçilince görünür; kopyalama diyaloğunu açar. Seçim sınırı 50. Kalıcı üst eylem yok. | `src/components/access-control/door-plans/DoorPlansTab.tsx:117`, düğme `:122`, metin `:127` |

“Tüm kapıları seç” düğme değil tablo başlığındaki onay kutusu (`:136`). “Kaydet ve cihaza gönder”, “Cihaza tekrar gönder” ve “Tatil takvimini aç” diyalog içi eylemlerdir; sayfa başlığı eylemi değildir. Planı kopyala taşınırsa seçim sayısı bağlamı korunmalı; ortak `BulkBar` da mevcut seçim davranışı için değerlendirilebilir.

## Hızlı düzeltmeler

Her madde bağımsız ≤30 dakikalık iş; bu denetimde uygulanmadı.

1. O1: Plan hücresindeki tıklama kesmeyi yalnız `details` içine taşı — `DP/DoorPlansTab.tsx:219`.
2. D1: Hikvision gateway kapsamını üst açıklamaya ve boş duruma ekle — `DP/DoorPlansTab.tsx:94`, `:167`.
3. D2: Form başlıklarını ve doğrulama modlarını cümle düzenine getir — `DD/DoorStatusPlanSection.tsx:24`, `DD/DoorVerifyPlanSection.tsx:26`, `DP/DoorPlansTab.tsx:30`.
4. D3: Son mobil kart sınırını koru — `DP/DoorPlansTab.tsx:166`, `src/components/ui/table.tsx:63` (diğer tabloların masaüstü görünümünü değiştirmeden).
5. Tatil takvimi bağlantısını dolu durumda da göster — `DP/DoorPlanDialog.tsx:370`.

H1 gönderim/bekleme mantığı ve O2 sunucu sayfalaması bu süreye sığan metin düzenlemeleri sayılmamalı.

## Ürün kararı gereken

1. **Takvim değişikliği nasıl gönderilsin?** A) Önerilen: ilgili kapıları “gönderim bekliyor” yapıp açık yeniden gönderme eylemi sun. B) Takvim kaydından sonra etkilenen kapıları gösteren onaylı toplu gönderim akışı. Otomatik fiziksel etki üretmeden yöneticiye kontrol bırakılmalı.
2. **Desteklenmeyen kapılar nasıl anlatılsın?** A) Önerilen: mevcut uygun hedef listesini koru, kısa kapsam açıklaması ve Cihazlar bağlantısı ekle. B) Diğer kapıları da nedenleriyle pasif satır olarak göster.

## Doğrulama sınırı

Kaynak değişmediği için derleme/test çalıştırılmadı. Boş liste, IDE, çevrimdışı cihaz, etkin haftalık kopya ve başarılı gönderilmiş tatil planı örnekleri canlı projede üretilmedi; ilgili değerlendirmeler kod kanıtına dayanır. Kurallar ve Yetki Durumu yeniden denetlenmedi; yalnız ortak bileşen/terim kıyası yapıldı. Ekran görüntüsü dosyaları: masaüstü liste, form, tatil ve kopya; mobil liste, form ve etki özeti.

Kendi tarayıcı sekmesini kapatma isteği `browser_tab_not_found` döndürdü; sekme artık erişilebilir değildi, başka sekmelere müdahale edilmedi.
