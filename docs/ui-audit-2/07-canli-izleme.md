# UI Audit 2 · 07 Canlı İzleme (`/live-monitoring`)

**Özet:** A2 sonrası sayfa büyük ölçüde sağlam: Canlı/Geçmiş ayrımı, durdurma kontrolü, ayrıntı paneli (URL + geri tuşu dahil), ret nedeni, kaynak etiketi ve dürüst filtre metinleri eski taramadaki ana sorunları kapatmış. Kalan sorunlar küçük ama gerçek: kaydırmada otomatik durdurma ölü kod, tarih alanı Canlı görünümü sessizce Geçmiş'e çeviriyor, açıklama metinleri jargonlu, filtreler diğer sayfalardan farklı (yerel `<select>`).
Canlı veri bugün boş olduğu için canlı akışın kayması/durdurması tarayıcıda denenemedi (yalnız kod okundu); Geçmiş görünümü gerçek 100 kayıtla denendi. Kart atama formu açıldı, kişi listesi görüldü, ATAMA YAPILMADI.

| Yüksek | Orta | Düşük |
|---|---|---|
| 0 | 4 | 7 |

Test notları (sorun değil): URL `?reading=` ile panel açılıyor ve anında kapanmıyor; tarayıcı geri/ileri paneli kapatıp açıyor (`history.back()` doğrulandı); Escape ile kapanıyor; 390px'te yatay taşma yok (`scrollWidth=390`), panel tam genişlik, kapat butonu 36px.

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 07-O1 | Orta | etkileşim | Kaydırınca akışı durduran dinleyici `window.scrollY > 80` bakıyor; ama sayfa `main` içinde kayıyor, `window.scrollY` hep 0. | Canlı akışta kullanıcı aşağı kaydırırken yeni satırlar listeyi kaydırıp okunan satırı yerinden oynatabilir (eski LIVE-UI-03'ün kaydırma kısmı **hâlâ açık**). Odak/tıklama ile durdurma çalışıyor; fare tekerleği ile kaydırma durdurmuyor. Canlı akış boş olduğundan davranış canlıda denenemedi. | Dinleyiciyi `main` elemanına bağla (`document.querySelector('main')`) ya da IntersectionObserver ile "üst sentinel görünmüyorsa durdur". | `src/components/access-control/CardReadings.tsx:63`; ölçüm: `main.scrollTop=600` iken `window.scrollY=0` |
| 07-O2 | Orta | içerik | Geçmiş görünümü açıklaması: "100 aday kayıt tarandı. Filtre sunucuda her aday sayfasına uygulanır; boş sayfadan sonra da devam edilebilir. Yüklenen sayfalar sabittir. Bu sayılar günlük toplam değildir." | Jargon ("aday sayfa", "sabit"), tek uzun 12px satır; operatör ne anlayacağını bilemez. | 2 kısa cümle: "100 kayıt tarandı, 100 gösteriliyor. Daha eski kayıtlar için 'Daha eski kayıtları yükle'ne basın." Teknik açıklama bilgi ikonu/ayrıntıya. | `CardReadings.tsx:40`; `d02-gecmis.png` |
| 07-O3 | Orta | etkileşim | "Diğer filtreler" içindeki Başlangıç/Bitiş tarihi seçilince mod otomatik "Geçmiş"e geçiyor (`mode:"history"`). Canlı görünümde tarih alanı gösteriliyor. | Canlı'dayken tarih seçen kullanıcı canlı akıştan habersiz çıkar; ekranda uyarı yok. Davranış yalnız kodda görüldü (doğrulanmadı). | Canlı'da tarih alanlarını gizle/devre dışı bırak, ya da geçişi bir satırla bildir. | `CardReadingsFilters.tsx:28-29`; `lib/readings.ts:22` |
| 07-O4 | Orta | içerik | Geçmişteki 100 kaydın 88'inde "Kapı eşleşmedi", çoğunda Yön "Bilinmiyor" ve Okuyucu "Okuyucu bilinmiyor"; cihaz adı biliniyor. | Etiketler dürüst ama veri eksikliği her satırda tekrar ediyor; gerçek kapı verisi gelmiyorsa sütun gürültü. Kaynağı (eski kayıt mı, eşleme eksiği mi) doğrulanmadı. | Veri kaynağını kontrol et; kapı yoksa sütunda yalnız cihaz adını göster, "Kapı eşleşmedi"yi soluk/tek satır yap. | `CardReadingsTable.tsx:15-16`; `d02-gecmis.png` |
| 07-D1 | Düşük | içerik | Biyometrik olay ayrıntısında "Kart numarası: 1", kişi yokken "Departman: Bilinmiyor", "Proje: emre" satırı. | Parmak izi olayında "kart numarası 1" yanıltıcı; eşleşmemiş kişi için "Bilinmiyor" departman uydurma gibi; proje satırı üst çubukla tekrar. | Biyometrikte kart satırını gizle; kişi yoksa departmanı "—"; proje satırını kaldır. | `ReadingDetailPanel.tsx:17`; `d05-biyometrik-detay.png` |
| 07-D2 | Düşük | görsel | Cihaz/Sonuç/Kapı/Kişi filtreleri yerel `<select>`; Ziyaretçiler filtreleri A2 `Select` bileşenini kullanıyor. | Açılan liste işletim sistemi görünümünde, tutarsız. | `ui/select`'e geç (liste uzunsa aranabilir). | `CardReadingsFilters.tsx:21-27` vs `visitors/VisitorFilters.tsx:4` |
| 07-D3 | Düşük | erişilebilirlik | "Canlı / Geçmiş" düğme grubu `<div aria-label="Görünüm">`; rol yok, erişilebilirlik ağacında adsız `generic`. | Ekran okuyucu etiketi okumaz. | `role="group"` ekle (ya da ToggleGroup bileşeni). | `CardReadings.tsx:102`; snapshot: `generic "Görünüm"` |
| 07-D4 | Düşük | etkileşim | Satırı açmanın tek yolu sağdaki "⋯" (masaüstü ~40px, mobil 40×40). Satır/ad tıklanınca bir şey olmuyor. | Tıklama hedefi küçük; "⋯" ayrıntı olduğunu söylemiyor. | Satırı/kişi hücresini tıklanabilir yap veya "Ayrıntı" metin butonu. | `CardReadingsTable.tsx:9,12` |
| 07-D5 | Düşük | içerik | Canlı boş durumda başlık "Okuma bulunamadı" + "Henüz erişim okuması yok…"; bugün için okuma yoksa son okumanın ne zaman geldiği gösterilmiyor ("Son olay" yalnız satır varken çıkıyor). | Sessiz gün ile bozuk bağlantı ayırt edilemiyor; "Abonelik bağlı" bunu kısmen karşılıyor. | Boşken "Bugün okuma yok · Son okuma 18.08.2026 16:06" göster; başlığı "Bugün okuma yok" yap. | `CardReadingsTable.tsx:10`; `LiveFeedControls.tsx:15`; `d01-ust.png` |
| 07-D6 | Düşük | performans | Kart atama formu açılınca `employees.list` ile projedeki TÜM kişileri çekiyor (yalnız atanabilir kişi seçmek için). Filtre seçenekleri de aynı listeyi kullanıyor (Convex aynı aboneliği paylaşır). | Binlerce kişili projede panel açılışı ağırlaşır; doğrulanmadı (yalnız 7-8 kişilik projede denendi). | Kişi arama sunucuda `limit`'li sorguya taşınsın. | `AssignReadingCardForm.tsx:11`; `CardReadingsFilters.tsx:13` |
| 07-D7 | Düşük | içerik | Geçersiz/başka projeye ait `?reading=` bağlantısında panel boş gövde + çıplak "Bu okuma artık görüntülenemiyor" metni; yönlendirme/kapat önerisi yok. | Üstte yine panel başlığı duruyor, kullanıcı ne yapacağını bilmez. | `EmptyState` + "Listeye dön" düğmesi. | `ReadingDetailPanel.tsx:16` |

## Hâlâ açık (eski taramadan)
- Eski LIVE-UI-03 (liste kaymasının kaydırmada durmaması) → **07-O1** olarak kaldı.
- Eski LIVE-UI-10 (kaynak filtresi, ör. Kart/QR/Biyometrik yok) → filtre satırında hâlâ yok; düşük öncelik, ürün kararı 2'ye bak.
- Eski LIVE-UI-13 mobil: kapandı (taşma yok, kart görünümü var); mobilde ilk satıra inmek için filtre bloğu ~440px yer kaplıyor (ilk satır y≈603/844) — 07-D2/ürün kararı 1 ile birlikte düşünülebilir.
- Kapanmış: 01-O2 benzeri bayat "Canlı" iddiası yok ("Abonelik bağlı / Bağlantı kesildi" gerçek bağlantı durumunu yazıyor); ham marka/hata kodu yok (ret sebepleri Türkçe katalogdan; ham kod yalnız kapalı "Teknik ayrıntı" içinde: "Olay kodu: 5/39"); 06-H1 benzeri sessiz filtre sorunu yok (Canlı'da filtre metni "yalnız yüklenen canlı kayıtlarda" diyor, aramada da etiket var).

## Hızlı düzeltmeler (≤30 dk)
1. 07-O1: kaydırma dinleyicisini `main`'e bağla (~10 dk).
2. 07-D3: `role="group"` (~2 dk).
3. 07-O2: açıklama metnini sadeleştir (~10 dk).
4. 07-D1: biyometrikte kart satırı / departman "—" / proje satırı (~15 dk).
5. 07-D7: geçersiz bağlantı için EmptyState + "Listeye dön" (~15 dk).

## Ürün kararı gereken
1. Canlı görünümde tarih filtresi olsun mu (07-O3)? Öneri: Canlı'da gizle, tarih yalnız Geçmiş'te.
2. Kaynak (Kart/QR/Mobil/Biyometrik) filtresi eklensin mi? Biyometrik olayları operatör ayrı görmek isteyebilir (KVKK/PDKS dışı etiketi zaten var).
3. "Kapı eşleşmedi" satırları veri sorunu mu, normal mi (07-O4)? Okuma→kapı eşlemesi (readers tablosu) geçmiş kayıtlarda doldurulacak mı?

## Ekran görüntüleri (`docs/ui-audit-2/07-canli-izleme/`)
`d01-ust.png` (Canlı, boş durum) · `d02-gecmis.png` (Geçmiş, 100 kayıt) · `d03-detay.png` (ayrıntı paneli + Kartı kişiye ata) · `d04-kisi-combobox.png` (kişi seçici açık) · `d05-biyometrik-detay.png` (biyometrik ayrıntı).
Mobil (390px) ekran görüntüsü emülasyon hatası nedeniyle okunur çıkmadı (üst parça bozuk döşeme); mobil bulgular DOM ölçümüyle (taşma, buton boyutu, panel) alındı.

## Kararlar (Emre, 2026-10-19)
- 07-O3: Canlı görünümde tarih alanları gizlenir; tarih yalnız Geçmiş'te.
- 07-O4: "Kapı eşleşmedi" kaynağı araştırılacak (eski kayıtlar readers/kapı eşlemesi, backfill gerekir mi).
- Kaynak filtresi (Kart / QR / Mobil / Biyometrik) eklenecek.
