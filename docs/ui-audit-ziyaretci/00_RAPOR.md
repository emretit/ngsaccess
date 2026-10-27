# Ziyaretçiler (`/visitors`) audit — 2026-10-27

**Özet:** 2026-10-19 audit'inin (docs/ui-audit-2/06-ziyaretciler.md) 15 bulgusu kapalı kaldı, gerileme yok. Yeni 1 yüksek bulgu var: düzenleme formunda "Erişim izni ver" kutusunun işareti kaldırılınca ziyaretçi "Sonlandırıldı" yerine "Ön kayıt" görünüyor. Ortadaki bulgular kart okutma güvenilirliği, ziyaretçi verisinin saklama süresi ve okuma yetkisi.

| Yüksek | Orta | Düşük |
|---|---|---|
| 1 | 7 | 5 |

Yöntem: web bileşenleri + `convex/visitors.ts` / `mobileVisitors.ts` kod taraması, Orca'da ayrı sekmede masaüstü turu (1639×939). NGS projesinde 0 ziyaretçi ve 0 ziyaretçi bölgesi olduğu için **dolu liste, ayrıntı paneli ve düzenleme formu canlıda görülemedi**. Bu kısımlar yalnız koddan incelendi. Mobil görünüm yeniden test edilmedi: `orca set device` sayfa kimliği almıyor, Emre'nin sekmesini etkileyebilirdi. Yazma işlemi yapılmadı. Yalnız boş formda "Kaydet"e basıldı; doğrulama istemcide kaldı, sunucuya istek gitmedi.

## Bulgular

| ID | Önem | Ne oluyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|
| Z-Y1 | Yüksek | Aktif ziyaretçi düzenlenip "Erişim izni ver" kutusunun işareti kaldırılınca kayıt `visitorStatus: "preRegistered"` olarak yazılıyor. Liste, sayaç ve filtre ziyaretçiyi **Ön kayıt** gösteriyor. | Erişimi kapatılan ziyaretçi henüz gelmemiş biri gibi görünüyor. "Ön kayıt" sayacı şişiyor, "Sonlandırıldı" filtresinde bu kayıt çıkmıyor. Aynı iş için iki yol var ("Ziyareti sonlandır" ve kutunun işaretini kaldırmak) ve sonuçları farklı. | Pasife almada durumu `checkedOut` yap (ya da kutuyu düzenlemede gizle, kapatma yalnız "Ziyareti sonlandır"dan yapılsın). Durumu yanlış yazılmış eski kayıtlar için düzeltme betiği yaz. | `convex/visitors.ts:515-518`, `convex/lib/visitorStatus.ts:33-39`, `VisitorFormFields.tsx:34` |
| Z-O1 | Orta | Kart okutma, tarayıcı saati (`sinceTime`) ile cihaz saatini (`accessTime`) karşılaştırıyor. Hik cihaz saati 7 güne kadar geride olsa da kabul ediliyor. | Cihaz saati birkaç saniye bile geride kalırsa yeni okuma `sinceTime`'dan eski sayılıyor ve 30 sn sonra "kart okunmadı" çıkıyor. Tarayıcı saati ileri giderse de aynı sorun oluyor. Kullanıcı okuyucuyu bozuk sanar. | Başlangıç zamanını sunucudan al, karşılaştırmada sunucunun kaydı aldığı zamanı (`createdAt`) kullan. Bunun için index'e alan ekle ya da kısa bir pencerede tara. | `VisitorCardCapture.tsx:101`, `convex/cardReadings.ts:78-82`, `convex/lib/processCardReadingCore.ts:172-176` |
| Z-O2 | Orta | İade edilmemiş pasif ziyaretçi kartı okutulunca kart o ziyaretçiyle eşleşiyor (`employeeId` dolu geliyor). Okuyucudan yakalama yalnız "bilinmeyen kart" aradığı için bu kart forma düşmüyor. | `create` bu kartı zaten otomatik geri alıyor, ama yeniden verilen ziyaretçi kartı okuyucudan alınamıyor, numara elle yazılıyor. En sık iş (kartı tekrar vermek) en zor yoldan yapılıyor. | Yakalama sorgusunda aynı projedeki pasif ziyaretçiye ait okumaları da kabul et. | `convex/cardReadings.ts:80`, `convex/cardReadings.ts:456-460`, `convex/visitors.ts:345-360` |
| Z-O3 | Orta | "Kayıt okuyucusu" listesi elle girilen cihaz tipi metnine bakıyor. NGS0001 ve NGS0002 aynı model (DS-K1T807) olduğu halde listede yalnız NGS0002 var. "Yüz Tanıma", "Turnike" ve "Parmak İzi Okuyucu" tipleri hiç listelenmiyor. | Kart okuyucusu olan terminal, tipi farklı girildiği için kullanılamıyor. | Cihaz modelinin kart okuma yeteneğine bak (Hik model spec / `family`). Tip metnini yalnız yedek olarak kullan. | `lib/readerCapability.ts:4-13`, canlı: okuyucu seçeneği yalnız `NGS0002 · Hikvision · Erişim Terminali` |
| Z-O4 | Orta | Ziyaretçi kişisel verileri (ad, telefon, şirket, not, ziyaret amacı, kart) süresiz tutuluyor. Kart okumalarını temizleyen görev var, ziyaretçi kayıtlarını temizleyen görev yok. | KVKK veri minimizasyonu ilkesine aykırı (gerekenden fazla veri tutmama). Kayıt sayısı sürekli büyüyor (bkz. Z-O5). | Proje ayarına "ziyaretçi saklama süresi" ekle; süresi geçen pasif kayıtları anonimleştir ya da sil. Süreyi Emre belirler. | `convex/crons.ts:66-68` (yalnız expire), `convex/privacyRetention.ts` (ziyaretçi yok) |
| Z-O5 | Orta | `summary` her veri değişikliğinde projenin **tüm** ziyaretçilerini tarıyor. `listPage` aramada/filtrede okuma sınırı olmadan tarıyor; mobil listede `maximumRowsRead: 200` var, web listesinde yok. | Geçmiş ziyaretçi sayısı binleri bulunca sorgu Convex okuma limitine takılır ve function call maliyeti artar (kota yangını geçmişi var). | Kısa vadede: tarama sınırı + "daha fazla" durumu. Uzun vadede: durum sayaçlarını ayrı bir tabloda tut. Z-O4 ile birlikte çözülürse yük kendiliğinden azalır. | `convex/visitors.ts:249-257`, `convex/visitors.ts:227-229`, karşılaştırma `convex/mobileVisitors.ts:47` |
| Z-O6 | Orta | Ziyaretçiler menüsü ve ayrıntı paneli, `visitors.manage` yetkisi olmayan her proje üyesine açık (İK, Teknik, Görüntüleyici). Telefon, not, şirket ve ziyaret amacı görünüyor; yalnız kart maskeli. `visitors.view` diye bir yetki yok. | Kişisel veriye gerekenden geniş erişim (KVKK). Özellikle "Teknik" rolünün ziyaretçi telefonunu görmesi gerekmiyor. | Ya menüyü `visitors.manage` / `reports.view` yetkisine bağla, ya da yetkisiz kullanıcıdan telefon ve notu gizle. Ürün kararı. | `src/lib/routeMeta.ts:11`, `convex/visitors.ts:203`, `convex/visitors.ts:267-290`, `convex/lib/roleCatalog.ts:91-94` |
| Z-O7 | Orta | Aydınlatma metni tanımlı değilken KVKK kutusu devre dışı. Altındaki "Mevcut kayıt sistemine rıza bilgisi ekler" cümlesi anlaşılmıyor. Ayarlar'a giden bağlantı yok. | Operatör rıza kaydedemiyor ve nedenini ya da nasıl düzelteceğini bilmiyor. | Metin tanımlı değilse "Ayarlar › Gizlilik'te aydınlatma metni tanımlayın" bağlantısı göster (yetkisi varsa). Açıklamayı düz yaz: "Ziyaretçi aydınlatma metnini onayladıysa işaretleyin." | `VisitorFormFields.tsx:46`, `ekran/04-form-bottom.png` |
| Z-D1 | Düşük | Kart maskeli geldiğinde (yetkisiz kullanıcı) "Tam numarayı göster" düğmesi yine görünüyor; basınca aynı maskeli değer çıkıyor. | İşe yaramayan düğme. | `detail.sensitiveMasked` ise düğmeyi gizle. | `VisitorSlideOverPanel.tsx:80-81`, `convex/lib/visitorStatus.ts:69-74` |
| Z-D2 | Düşük | Boş formda "Kaydet"e basınca odak "Ad" alanına gidiyor. Ekrandaki ilk hata ise en üstteki bölge, sonra kart. | Küçük ekranda üstteki hatalar görülmeden geçiliyor. | Odağı ekrandaki sıraya göre ilk hatalı alana ver (zone → expires → card → ad → soyad). | `VisitorForm.tsx:36-37`, `ekran/06-validation-clean.png` |
| Z-D3 | Düşük | Okuyucu değiştirilince `timedOut` sıfırlanmıyor. Yeni okuyucu seçildiğinde eski "30 saniyede kart okunmadı" mesajı ve "Yeniden dene" etiketi kalıyor. | Yanıltıcı durum metni. | `setReaderId` içinde `setTimedOut(false)` çağır. | `VisitorCardCapture.tsx:85-95` |
| Z-D4 | Düşük | "Erişim bölgesi oluştur" bir oluşturma eylemi ama filtre satırında duruyor. "Filtreleri temizle" filtre yokken soluk olarak görünüyor. | Eylem filtreyle karışıyor. | Bölge oluşturmayı başlıktaki ikincil eyleme taşı. | `VisitorFilters.tsx:23`, `ekran/01-desktop.png` |
| Z-D5 | Düşük | "Ziyaret edilen kişi" listesi için projedeki tüm kişiler (`employees.list`) form her açıldığında çekiliyor. | Büyük projede form yavaş açılır. | Arama tabanlı, sınırlı bir sorgu kullan. | `hooks/useVisitorFormData.ts:51-54` |

## Doğru çalışanlar
- 10-19 düzeltmeleri yerinde: sunucu tarafı filtre, dört sayaç, sınır anında yenileme (`useVisitorClock`), yalnız kart okuyabilen cihaz listesi, sentetik e-postanın gizlenmesi, "Erişim" bölümünün üstte olması.
- Doğrulama: 4 hata mesajı çıkıyor, hatalı alanın çerçevesi kırmızı, istek gitmiyor.
- Geçerlilik bitişi varsayılanı TR saatiyle +8 sa (15:47 → 23:47).
- Yetki: tüm yazma işlemleri (`create/update/checkOut/releaseCard/removeVisitor`) `visitors.manage` + proje kapsamı istiyor. Bölge ataması yalnız mobil ön kayıtta yapılabiliyor.

## Ürün kararı gereken
1. **Z-Y1:** Düzenleme formundaki "Erişim izni ver" kutusu kalsın mı (işaret kaldırılınca durum `checkedOut` olur), yoksa kapatma yalnız "Ziyareti sonlandır"dan mı yapılsın?
2. **Z-O4:** Ziyaretçi kaydı kaç gün saklansın; süre dolunca silinsin mi, anonimleştirilsin mi?
3. **Z-O6:** Ziyaretçiler sayfasını kimler görsün? Seçenekler: (a) yalnız `visitors.manage`, (b) + `reports.view`, (c) herkes ama telefon/not gizli.

## Önerilen dalgalar
- **Dalga 1 (~45 dk, karar gerektirmez):** Z-O2, Z-O3, Z-O7 metni, Z-D1, Z-D2, Z-D3.
- **Dalga 2 (~1 sa):** Z-Y1 (karar 1'den sonra) + Z-O1 (kart yakalamada sunucu zamanı).
- **Dalga 3 (karar 2-3'ten sonra):** Z-O4 saklama + Z-O5 sayaç/tarama sınırı + Z-O6 yetki.

## Ek kanıt
`docs/ui-audit-ziyaretci/ekran/`: `01-desktop.png` (boş liste), `02-form-top.png`, `04-form-bottom.png` (KVKK devre dışı), `06-validation-clean.png` (doğrulama).
