# UI Audit 2 — 06 Ziyaretçiler (`/visitors`)

**Özet:** A2 görünümü sayfada tutarlı (bordo birincil buton, nötr zemin, kartsız sayaç şeridi); form, bölge diyaloğu ve doğrulama çalışıyor, Escape/odak davranışı doğru. Asıl sorunlar listeleme mantığında: arama/durum filtresi yalnız o sayfadaki 25 kayda uygulanıyor, sayaç/liste her dakika yeniden sorgulanıyor ve form uzun/tek sütun. Aktif proje ("emre") 0 ziyaretçi içerdiği için **dolu liste, satır ve ayrıntı paneli ekranda görülemedi**; bu kısımlar yalnız koddan incelendi (aşağıda "doğrulanmadı" diye işaretli).

| Yüksek | Orta | Düşük |
|---|---|---|
| 1 | 7 | 7 |

Kapsam dışı bırakılanlar (yasak): kaydet, çıkış/sonlandır, sil, kart okutma başlatma, bölge oluştur onayı. "Ziyaretçiyi kaydet"e yalnız boş formda basıldı (doğrulama hataları çıktı, istek gitmedi). Form tek adımlı; "İleri/Kaydet" aynı yerde buton sorunu (05-H1) **yok** (`VisitorForm.tsx:46-49`: Vazgeç `type="button"`, Kaydet `type="submit"`).

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 06-H1 | Yüksek | etkileşim / içerik | Arama ve durum filtresi sunucuda sayfa alındıktan **sonra** süzüyor; eşleşme yoksa sayfa boş ("Bu sayfada eşleşen ziyaretçi yok"), kullanıcıya "Sonraki"ye basıp tek tek sayfa gezmesi söyleniyor. | 100 ziyaretçili projede "Süresi doldu" seçince çoğu zaman boş liste görülür; kullanıcı kaydın olmadığını sanır. Üst sayaç ise tüm projeyi sayıyor, ikisi çelişir. (eski VIS-UI-03/17 — hâlâ açık, yalnız uyarı metniyle örtülmüş) | Filtreyi indeks/sunucu tarafında tam uygula (durum için `by_project_visitor` + status alanı veya türetilmiş alan), ya da filtre aktifken boş sayfayı otomatik sonraki sayfaya ilerlet. Kısa vadede boş-durum metnine "Sonraki sayfada ara" düğmesi ekle. | `convex/visitors.ts:196-199` (paginate sonrası `filter`), `VisitorFilters.tsx:25`, `VisitorManagement.tsx:75-78` |
| 06-O1 | Orta | performans | `refreshKey` her dakika değişiyor; bu yüzden `listPage`, `summary` ve açık panelde `getDetail` her dakika yeniden çalışıyor. `summary` her seferinde 500'e kadar ziyaretçinin son okumasını sorguluyor. Ayrıca 1 sn'lik `setInterval` boşta çalışıyor. | Hiçbir veri değişmese de dakikada bir yeniden okuma (Convex kota yangını geçmişi var: `ide_poll_quota_incident`). Ziyaretçi sayısı arttıkça dakikalık N+1 okuma. | Süre dolumunu istemcide `visitEnd` ile türet; `refreshKey`'i yalnız sonraki bitiş anında (en yakın `visitEnd`) tetikle. Interval'i 60 sn'ye çıkar veya `setTimeout` ile hizala. `summary`'yi sayaç tablosu/cron ile besle. | `VisitorManagement.tsx:30-34`, `convex/visitors.ts:211-235`, `VisitorStats.tsx:9` |
| 06-O2 | Orta | içerik | "Erişimi kapalı" = toplam − aktif; bu yüzden **Ön kayıt** (henüz başlamamış) ve **Pasif** kayıtlar da "kapalı" sayılıyor. | Ön kayıt "kapalı" değil, "bekliyor"; ekrandaki sayı ile durum etiketleri tutmaz. Filtredeki seçeneklerle (5 durum) sayaçlar (4 kutu) eşleşmiyor. (doğrulanmadı: ön kayıt kaydı oluşturulamadığından canlıda görülmedi) | Sayaçları durum filtresiyle aynı kırılıma getir (Aktif / Süresi doldu / Sonlandırıldı / Ön kayıt) ya da "Erişimi kapalı" tanımını altına yaz. | `convex/visitors.ts:226-227`, `VisitorStats.tsx:15`, `lib/status.ts:4-10` |
| 06-O3 | Orta | içerik / hata | "Kayıt okuyucusu" listesi projedeki **tüm cihazları** sayıyor (NGS QR, NGS cikis, ide smart, Deneme1…), kart okuyabilen/olmayan ayrımı yok. | Kullanıcı kart okutamayacak bir cihazı seçip 30 sn bekler, "kart okunmadı" görür. Seçilen cihaz sessizce `localStorage`'a yazılıyor. | Yalnız kart/Wiegand okuyucu tipindeki cihazları listele; cihaz tipini adın yanına yaz. | `VisitorCardCapture.tsx:117-121`, ekran: `desktop-reader-select.png` (seçenekler snapshot'tan) |
| 06-O4 | Orta | görsel / erişilebilirlik | Bölge diyaloğunda gün düğmelerinde seçili (Pt–Cu, `aria-pressed=true`) ile seçili olmayan (Ct, Pz) hâl neredeyse aynı: seçili zemin `rgb(243,243,242)`, seçili olmayan saydam (≈ beyaz); kenarlık aynı. | Hangi günlerin açık olduğu görsel olarak okunmuyor (WCAG 1.4.11 – bileşen durumu kontrastı < 3:1). Ortak `TimeSchedule` bileşeni; 02/05 sayfalarında da etkiler. | Seçili: dolu bordo/nötr-koyu zemin + beyaz yazı; seçili değil: çerçeveli beyaz. | `src/components/access-control/unified/components/TimeSchedule.tsx` (düğmeler), ekran: `desktop-zone-days.png` |
| 06-O5 | Orta | içerik / KVKK | Formda "KVKK rıza kaydı alındı" kutusu var ama rıza **metni** gösterilmiyor/bağlantısı yok; altında "Metin sürümü kaydedilmiyor" yazıyor, ayrıntıda "Sürüm: Kaydedilmedi". | Operatör neyin onaylandığını göremiyor, kayıt hangi metne dayandığı belirsiz (hukuki izlenebilirlik). (eski VIS-UI-19 — hâlâ açık) | Metin + sürüm numarasını göster ve kaydet; en azından metne bağlantı. Ürün kararı (aşağıda). | `VisitorFormFields.tsx:41`, `VisitorSlideOverPanel.tsx:77-78`, `desktop-form-02.png` |
| 06-O6 | Orta | içerik | Ayrıntı panelinde "E-posta" alanı var; form e-posta almıyor, backend boşsa sahte adres üretiyor (`ziyaretci-<uuid>@ngsaccess.local`). Bu adres ayrıntıda "E-posta" olarak gösterilir (doğrulanmadı: dolu kayıt görülemedi, koddan çıkarıldı). | Kullanıcı hiç girmediği bir e-posta görür; gerçek e-posta sanılabilir, dışa aktarımlara sızabilir. | Sentetik adresleri UI'da gizle (`@ngsaccess.local` süz) ya da alanı ayrıntıdan çıkar; gerekiyorsa forma opsiyonel e-posta ekle. | `VisitorSlideOverPanel.tsx:75`, `convex/visitors.ts:319-322`, `VisitorFormFields.tsx` (e-posta yok) |
| 06-O7 | Orta | görsel | Yeni ziyaretçi formu tek sütunda ~1300px (752px görünür alan); alt başlıklar + 11 alan, "Ek bilgiler" (Telefon, Notlar) kapalı `<details>` içinde, "Şirket" açıkta. Sabit alt çubuk iyi, ama zorunlu alanlar (Bölge, Bitiş, Kart) 2 kaydırma aşağıda. | Zorunlu alanları görmek için kaydırma; doğrulama hatası ilk alana odaklanıyor ama kart/bölge hatası görünür alanın dışında kalır. Native `<details>` oku (▶) A2 chevron'larından farklı. | Zorunlu üç alanı ("Erişim") üste al; Ad/Soyad yan yana (masaüstü). `details` yerine A2 collapsible. | `VisitorFormFields.tsx:20-41`, `desktop-form-01.png`, `desktop-form-02.png`; mobilde sheet içeriği 1349px/752px (eval ölçümü) |
| 06-D1 | Düşük | içerik | Boş durumda hem başlıkta hem ortada aynı "Ziyaretçi kaydet" düğmesi; altta "Sayfa 1 · 0 kayıt tarandı · 0 kayıt gösteriliyor" ve devre dışı sayfalayıcı. "tarandı" teknik. | Gereksiz tekrar; 0 kayıtta sayfalama çubuğu değer katmıyor. | Boş durumda sayfalamayı gizle; özetinde "0 kayıt" yeterli. | `VisitorManagement.tsx:75-81`, `desktop-01.png` |
| 06-D2 | Düşük | içerik | "Proje cihaz durumu · Bekleyen işlem yok · Geçmiş doğrulanmış cihaz onayı: 20.06.2026 12:20 (TR saati; yeni gönderimin sonucu değildir)". | 4 ay eski tarih ve uzun açıklama ziyaretçi sayfasında dikkat dağıtıyor; mobilde 2+ satır. | Tarihi yalnız sorun/bekleyen varsa göster; açıklamayı tooltip'e al. | `DeviceSyncStatusBanner` (kullanım `VisitorManagement.tsx:51`), `desktop-01.png`, `mobile-01.png` (kesilmiş görünür) |
| 06-D3 | Düşük | görsel | Filtre satırında "Erişim durumu" etiketi görünür, arama kutusunun etiketi gizli (`sr-only`); ikisi aynı hizada değil (etiket yüksekliği kadar fark, arama kutusu aşağıda). | Satır dengesiz görünür. | Her iki alana da görünür etiket ya da ikisinde de yalnız placeholder/aria-label. | `VisitorFilters.tsx:15`, `FilterBar.tsx:12`, `desktop-01.png` |
| 06-D4 | Düşük | içerik | Aynı boş değer iki farklı yazılıyor: tabloda Ziyaret edilen "Seçilmedi", Erişim bölgesi "—"; ayrıntıda bölge "Kaydedilmedi". | Tutarsız yer tutucu. | Tek kural: "—" (tablo), "Belirtilmedi" (ayrıntı). | `VisitorTable.tsx:25-26`, `VisitorSlideOverPanel.tsx:62-63` |
| 06-D5 | Düşük | içerik | Bölge diyaloğunda "Bölge adı" zorunlu olduğu hâlde `*` yok (ziyaretçi formunda var); "0 kapı"lık bölge (NGS GİRİŞ) seçilebilir görünüyor. | Tutarsız zorunlu alan işareti; kapısız bölge oluşturma yanlışa açık. | `*` ekle; 0 kapılı bölgeyi pasif göster. | `VisitorZoneDialog.tsx:98`, `desktop-zone-dialog.png` |
| 06-D6 | Düşük | erişilebilirlik | Doğrulama hatasında alanın kenarlığı kırmızı olmuyor, yalnız altındaki metin kırmızı (Kart numarası, Bölge). | Yalnız renkli metinle ayırt etme; alan hatası görsel olarak bağlanmıyor. (`aria-invalid` mevcut; stil doğrulanmadı) | `aria-invalid` için `border-destructive` stili. | `desktop-form-validation-2.png`, `VisitorCombobox.tsx:14` |
| 06-D7 | Düşük | performans | Kullanılmayan görünen eski `list` sorgusu hâlâ tüm ziyaretçileri `collect()` ediyor, her biri için 3 sorgu. | Yanlışlıkla çağrılırsa ağır; ölü kod (çağıran var mı doğrulanmadı). | Çağıranı yoksa kaldır. | `convex/visitors.ts:94-125` |

## Sayfada doğru çalışanlar (tekrar yazılmadı)
- Yeni ziyaretçi sheet'i: Escape ve Vazgeç kapatıyor; bölge diyaloğu üstte açılınca Escape yalnız diyaloğu kapatıyor.
- Boş form doğrulaması: 4 mesaj çıkıyor, ilk alana odak gidiyor (`document.activeElement = v_first_name`).
- Mobil 390px: yatay taşma yok (`scrollWidth=390`), sheet tam ekran (390×844), kontroller 36px yüksekliğinde.
- Süre: Türkiye saati ve `Europe/Istanbul` biçimi tutarlı (`visitorTime.ts`).
- Eski rapordan kapananlar: ACC-19 kart yakalama başlatma/timeout, ACC-29/30, VIS-UI-04/05/09/10/11 (bölge diyaloğu adlandırması, etiketli alanlar, mobil taşma).

## Hızlı düzeltmeler (≤30 dk)
1. 06-D1: boş durumda `PaginationBar`'ı gizle.
2. 06-D4: boş değer metinlerini tekilleştir.
3. 06-D5: "Bölge adı *" ve 0 kapılı bölge pasifleştirme.
4. 06-D3: filtre satırı etiket tutarlılığı.
5. 06-O4: gün düğmesi seçili stili.
6. 06-O6: `@ngsaccess.local` e-postasını ayrıntıda gizle.
7. 06-O3: okuyucu listesini cihaz tipine göre süz.
8. 06-D7: ölü `list` sorgusunu kaldır.

## Ürün kararı gereken
1. **Filtre kapsamı (06-H1):** Filtre tüm proje kayıtlarında mı çalışsın (sunucu maliyeti artar), yoksa "sayfa içi filtre" uyarısı kabul edilebilir mi?
2. **KVKK rıza metni (06-O5):** Rıza kutusu hangi metne bağlanacak, sürüm numarası saklansın mı?
3. **"Erişimi kapalı" tanımı (06-O2):** Ön kayıt ve pasif bu sayıya dahil mi olsun?

## Ek kanıt dosyaları
`docs/ui-audit-2/06-ziyaretciler/`: `desktop-01.png`, `desktop-form-01.png`, `desktop-form-02.png`, `desktop-form-validation.png`, `desktop-form-validation-2.png`, `desktop-zone-dialog.png`, `desktop-zone-days.png`, `desktop-reader-select.png`, `desktop-focus.png`, `mobile-01.png` (mobil kaydırmalı çekimler emülasyon hatasıyla bozuk çıktığı için yalnız ilk ekran saklandı; mobil form ölçümleri `eval` ile alındı).

## Kararlar (Emre, 2026-10-19)
- 06-H1 (+ 05-D1): filtre sunucuda, tüm proje kayıtlarında çalışacak (Convex index + sorgu).
- 06-O2: sayaçlar filtreyle aynı kırılım (Aktif / Süresi doldu / Sonlandırıldı / Ön kayıt).
- 06-O5: rıza kutusuna aydınlatma metni bağlantısı + onaylanan sürüm kayda yazılır (metnin kendisi Emre'nin hukuki kararı).
