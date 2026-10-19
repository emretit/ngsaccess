# UI Audit 2 — 02 Kişiler (/employees)

Tarih: 2026-10-19 · Aktif proje: "emre" (7 kişi) · Masaüstü 1639px + mobil 390px (iPhone 12 emülasyonu) · Yalnız okuma; kayıt/silme/cihaz gönderimi yapılmadı.

**Özet:** Sayfa A2 sonrası büyük ölçüde toparlanmış: tablo sıkı, kişi adı gerçek buton, sıralama başlıkta + `aria-sort`, filtre/sıra/sayfa adreste (URL), ayrıntı paneli erişim + cihaz senkron + son geçiş + KVKK gösteriyor, mobilde yatay kayma yok. Eski taramanın (PPL-UI-xx) çoğu kapanmış. Kalanlar çoğunlukla orta/düşük: yanlış boş-durum metni, onaysız "Cihazlara gönder", ham cihaz hata metni, küçük tıklama alanları, bileşen tutarsızlıkları.

| Önem | Adet |
|---|---|
| Yüksek | 0 |
| Orta | 8 |
| Düşük | 9 |

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 02-O1 | Orta | içerik | Alt birimi olmayan/boş departman (örn. "selam") seçilince "Aramanızla eşleşen personel yok" yazıyor. | Kullanıcı arama yapmadı; metin yanıltıcı. Boş departman ile arama sonucu aynı mesaj. | Filtre türüne göre metin: "Bu departmanda doğrudan bağlı kişi yok" (+ "Tüm personel'e dön"). | `src/pages/Employees.tsx:176`; `d-10-dept-selam.png` |
| 02-O2 | Orta | etkileşim | Satır menüsündeki **Cihazlara gönder** tek tıkla hemen cihaza komut yolluyor; onay yok (Sil ve Mobil bağlantı için diyalog var). | Yanlış tıklama gerçek cihaza yazar (cihaz verisi değişir); tutarsız güvenlik adımı. | Onay diyaloğu ya da en azından "N cihaza gönderilecek" özeti. | `src/components/employees/EmployeeTable.tsx:411-420`; `d-08-rowmenu.png` |
| 02-O3 | Orta | içerik | Ayrıntıda "Cihaz senkron durumu" altında ham SDK hatası: `NET_DVR_SendRemoteConfig failed: 17`. | Son kullanıcı için anlamsız, teknik sızıntı. | Kullanıcı dilinde özet ("Cihaza gönderilemedi") + ham hata "Teknik ayrıntı" açılırında. | `src/components/employees/EmployeeSyncSection.tsx:86-90`; `d-02-detail.png` |
| 02-O4 | Orta | erişilebilirlik | Satır ve başlık onay kutuları 16×16 px; mobilde de aynı (ölçüldü: `cb 16x16`). | WCAG 2.2 hedef boyutu (2.5.8) en az 24×24 ister; dokunmatikte kaçırılıyor. Plan "44px dokunma alanı" diyordu (eski PPL-UI tablosu). | Hücreyi/etiketi tıklanabilir yap veya checkbox'a `::after` ile 44px alan ver (mobilde). | `src/components/ui/checkbox.tsx:14`; `src/components/employees/EmployeeTable.tsx:292,334` |
| 02-O5 | Orta | etkileşim / ürün | Departman ekle / yeniden adlandır / sil menüleri her kullanıcıya görünüyor (`isAdmin` kontrolü yok); backend de `authedMutation` (herhangi bir oturumlu kullanıcı). Personel yazma işlemleri ise admin'e bağlı. | Tutarsız yetki; salt okunur kullanıcı organizasyonu değiştirebilir. "Ürün kararı" bölümü, soru 1. | Rol kararı sonrası hem UI'da gizle hem Convex'te kontrol et. | `src/components/departments/DepartmentTree.tsx:132`, `DepartmentTreeItem.tsx:73-87`; `convex/departments.ts:21,48,85` |
| 02-O6 | Orta | görsel | **Seçilenleri sil** (destructive) ile **Personel ekle** (primary) neredeyse aynı bordo; silme düğmesi "tehlikeli" görünmüyor, `Seçimi kaldır` ise düz metin. | Yıkıcı eylem ayırt edilemiyor; A2'de destructive token primary'ye çok yakın (`--destructive` 5° 47% 40% / `--primary` 0° 59% 30%). | Silmeyi outline + kırmızı metin ya da belirgin daha açık kırmızı yap; düğmeleri gruplayıp silmeyi sağa/ayır. | `src/components/employees/EmployeeBulkActions.tsx:93-104`; `src/index.css:52,61`; `d-07-bulk.png` |
| 02-O7 | Orta | görsel / içerik | Ayrıntıda "Son geçişler" 10 kayıt (uzun liste) KVKK'dan önce; KVKK kartı 2 ekran aşağıda. Liste 10'da kesiliyor ama "Tümünü gör" bağlantısı yok. | Sayfanın önemli bölümü (rıza) gömülü; 10'dan fazlası olduğu anlaşılmıyor. | Son geçişleri 3-5 satıra indir + "Tüm geçişler → Canlı İzleme/PDKS" linki; KVKK'yı yukarı al ya da sekme yap. | `src/components/employees/EmployeeRecentReadings.tsx:16-19`; `d-03-detail-scroll.png`, `d-04-detail-end.png` |
| 02-O8 | Orta | içerik | Formda "Erişim kuralı ekle" alanı **Kart / kimlik** bölümünün içinde; seçenek metni "Yeni kural ekleme" (yani "kural ekleme" demek). | Alan yanlış bölümde, varsayılan metin çelişkili okunuyor. | Ayrı "Erişim" bölümü; varsayılan "Kural eklenmesin / Seçilmedi". | `src/components/employees/EmployeeFormFields.tsx:140-146,86`; `d-06-form-end.png` |
| 02-D1 | Düşük | içerik | Tarihler `toLocaleString("tr-TR")` ile (saat dilimi belirtilmemiş) yazılıyor; KVKK kartı `date-fns` "dd MMM yyyy HH:mm" (ay adı) kullanıyor. | Bilgisayar saat dilimi farklıysa UTC+3 dışında görünür; aynı panelde iki farklı tarih biçimi. | Ortak yardımcı: `timeZone: "Europe/Istanbul"`, tek biçim (gg.aa.yyyy SS:dd). Not: bu makinede doğru görünüyor, başka saat diliminde doğrulanmadı. | `EmployeeRecentReadings.tsx:45`; `EmployeeSyncSection.tsx:83`; `EmployeeConsentsCard.tsx:165` |
| 02-D2 | Düşük | görsel | Filtre çubuğunda yerel (native) `<select>`, toplu çubukta ve sayfa boyutunda özel (shadcn) Select; görünüm/yükseklik farklı. | A2 bileşen tutarlılığı; OS'a göre görünüm değişir. | Hepsini ortak Select'e taşı. | `EmployeeFilters.tsx:25,35`; `EmployeeBulkActions.tsx`; `d-01-top.png`, `d-07-bulk.png` |
| 02-D3 | Düşük | görsel | Sıralama iki yerde (başlık düğmeleri + "Ad (A–Z)" açılırı) ve ikisi de görünür. | Gereksiz tekrar, filtre çubuğunu kalabalıklaştırır. | Açılırı kaldır (mobilde başlık yok → yalnız mobilde tut). | `EmployeeFilters.tsx:35-59`; `EmployeeTable.tsx:204-230` |
| 02-D4 | Düşük | içerik | Boş sonuçta altta "7 personelden 0 sonuç · 0–0 gösteriliyor" ve hem araç çubuğunda hem boş durumda "Filtreleri temizle" (iki tane). | Gürültü; "0–0" garip. | Boşken "0 sonuç" de, tek temizle eylemi bırak. | `Employees.tsx:176-200`; `d-09-empty.png` |
| 02-D5 | Düşük | görsel | "Pozisyon" sütunu bu projede tamamen "—" (7/7); yine de genişlik harcıyor. | Boş sütun değer katmıyor. | Hiç dolu değer yoksa sütunu gizle. | `EmployeeTable.tsx:322,385`; `d-01-top.png` |
| 02-D6 | Düşük | görsel | Seçilmemiş onay kutularının kenarı bordo (`border-primary`); hata/seçili gibi okunuyor. | Nötr A2 diliyle çelişiyor. | Pasif kenarı nötr gri, seçiliyken bordo. | `src/components/ui/checkbox.tsx:14`; `d-01-top.png` |
| 02-D7 | Düşük | erişilebilirlik | Form Sheet açılınca odak "Kapat (X)" düğmesine gidiyor; ilk alan (Ad) değil. | Klavye/ekran okuyucu kullanıcısı için ek Tab; yazmaya başlama gecikir. | Ad alanına `autoFocus` (yeni kayıt). | `src/components/employees/SlideOverPanel.tsx:57`; `d-05-form.png` (odak halkası X'te) |
| 02-D8 | Düşük | görsel | Bulk çubuğu görününce tablo ~69px aşağı itiliyor (yerleşim kayması). | Tıklama sırasında satırlar kayıyor. | Çubuğa sabit yer ayır veya tablo üstünde yapışkan/overlay. | `EmployeeTable.tsx:233-261`; `d-07-bulk.png` |
| 02-D9 | Düşük | performans / kod | Düzenleme formu varlık kontrolü için tüm proje listesini (`employees.list`) ayrıca abone oluyor; `onDelete={() => undefined}` ölü prop. | Gereksiz okuma; bakım kirliliği. | Tek kişi sorgusu (`employees.get`); ölü prop'u sil. | `EmployeeForm.tsx:81`; `Employees.tsx:194` |

(Not: Ayrıntıda "Bordro kodu yok" hem başlıkta hem "Bordro kodu —" satırında tekrarlanıyor — `EmployeeDetails.tsx:49`, çok küçük.)

## Eski bulgulardan durum (`docs/ui-scan/pages/02-kisiler/REPORT.md`)

- Kapanmış (ekranda doğrulandı): PPL-UI-03 (ad → ayrıntı), PPL-UI-05 (checkbox adı + aria-sort), PPL-UI-06 (süz→sırala→sayfala, `Employees.tsx` `filterAndSortEmployees`), PPL-UI-07 (URL durumu), PPL-UI-01 (mobil taşma yok, ölçülen `scrollWidth 390`), PPL-UI-18 (erişim + cihaz + son geçişler panelde), PPL-UI-12 (ağaçta `aria-pressed`, adlı expand), PPL-UI-14 (toplu departman proje kapsamlı), PPL-UI-02 (kart/StatCard kalktı).
- **Hâlâ açık:** PPL-UI-17 (içe aktarma yok — beklenen), PPL-UI-13 (form sonrası sonuç yalnız toast — kodda doğrulanmadı, bu turda test edilmedi), PPL-UI-08 kısmen (form tek sütun oldu ama bölüm sırası → 02-O8). Boş durum ayrımı (PPL-UI-15) kısmen: ilk kayıt boş ve filtre boş ayrı, ama departman-boş ayrı değil → 02-O1.

## Hızlı düzeltmeler (≤30 dk)

1. 02-O1 boş departman metni (10 dk)
2. 02-O3 ham SDK hatasını sakla/özetle (15 dk)
3. 02-O2 "Cihazlara gönder" onayı (20 dk)
4. 02-D6 + 02-O4 checkbox kenar rengi ve dokunma alanı (20 dk)
5. 02-D4 boş sonuç metni/çift buton (10 dk)
6. 02-D7 Ad alanı autoFocus (5 dk)
7. 02-D9 ölü prop sil (5 dk)

## Ürün kararı gereken

1. Departman ekleme/değiştirme/silme kimde olsun (yalnız admin mi, proje yöneticisi de mi)? (02-O5)
2. Ayrıntı panelinde sıra: KVKK rızaları mı, son geçişler mi önce? Son geçişler panelde kaç kayıt + "tümü" nereye gitsin? (02-O7)
3. Pozisyon verisi kullanılmayan projelerde sütun ve form alanı gizlensin mi? (02-D5)

## Kanıtlar (ekran görüntüleri: `docs/ui-audit-2/02-kisiler/`)

`d-01-top` liste · `d-02/03/04` ayrıntı paneli · `d-05/06` yeni kişi formu · `d-07-bulk` toplu çubuk · `d-08-rowmenu` satır menüsü · `d-09-empty` arama boş · `d-10-dept-selam` boş departman · `d-11-dept-ngs` departman filtresi · `m-s0/s200/s400/s600` mobil kaydırma (üst parça kırpıldı) · `m-dept` mobil departman özeti.

Kapsam dışı/kısıt: form doğrulama mesajları (zod, `useEmployeeFormSchema.ts`) kodda incelendi (`noValidate` açık, hatalar alan altında, ilk hataya odak), ekranda tetiklenmedi çünkü Kaydet'e basılmadı. Mobilde ayrıntı paneli/form ekranı görüntülenmedi (doğrulanmadı).

## Kararlar (Emre, 2026-10-19)
- 02-O5: departman yönetimi herkeste kalır (mevcut davranış) → düzeltme yok.
- 02-O7: KVKK rızaları üstte; son geçişler 5 satır + "Tüm geçişler" linki.
- 02-D5: Pozisyon sütunu her zaman görünür → düzeltme yok.
