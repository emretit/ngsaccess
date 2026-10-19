# UI Audit 2 — Sayfa 11: Raporlar (`/reports`)

**Özet:** 16 raporun hepsi masaüstünde açıldı; 8'i farklı parametreyle çalıştırıldı (dönem, özel aralık, ay, kişi araması, sonuç filtresi, hatalı aralık). Mobil (390px) DOM ölçümüyle denetlendi. En ciddi sorun: **veri başlamadan önceki günler "Devamsız (DV)" görünüyor** (Eylül'de 22 gün devamsız); aylık ve günlük raporlar aynı gün için farklı süre gösteriyor. Ücret gizleme tarafında sorun yok: Raporlar'ın 16 raporunda ücret sütunu hiç yok. Biyometrik (yüz/parmak izi) kayıtlar PDKS raporlarına girmiyor, ekranda not var.

| Yüksek | Orta | Düşük |
|---|---|---|
| 2 | 7 | 6 |

> Not: Dışa aktarma butonları yalnız açılıp incelendi (Excel/CSV/PDF menüsü görüldü), hiçbir dosya indirilmedi. Mobil ekran görüntüsü emülasyon hatası nedeniyle bozuk (`m02–m04`, üst/orta parça karışık); mobil bulgular DOM ölçümüne dayanır.

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 11-H1 | Yüksek | hata / içerik | Kişinin kaydı olmayan günler "DV" (devamsız). Ekim'de 12, Eylül'de 22 gün "Devamsız"; "Devamsızlar" raporu 01–16 Ekim için 12 satır üretiyor. Gerçek okutma yalnız 19.10'da var. "Departman Bazlı Devam" oranı da bu yüzden %7,7. | Sahte devamsızlık (01-O1 / 08-H1 türü). Bordro ve İK kararında yanlış veri. Arka uçta "veri yok" durumu (`noData`) var ama hiç devreye girmiyor: `availableDateKeys` hiçbir çağıran tarafından verilmiyor, `?? true` hep geçerli oluyor; aylık sayfa `classifyPdksDay`'i `dataAvailable` olmadan çağırıyor. Vardiya atanmamış kişide ("Vardiya —") varsayılan 09:00–18:00 planı kullanılıyor. | Kişinin işe başlama / ilk kayıt tarihinden önceki günleri "—" (veri yok) say; vardiyası olmayan kişiyi devamsız sayma. `availableDateKeys`'i gerçekten doldur. | `convex/lib/pdksTable.ts:173,256,426`; `convex/lib/pdksPayroll.ts:124`; `d18-devamsiz-ozel.png`, `d26-aylik-eylul.png`, `d27-kisi-eylul.png`, `d17-dept-devam.png` |
| 11-H2 | Yüksek | içerik (sayı doğruluğu) | 19.10 için günlük raporlar: Toplam süre **0 sa 08 dk**, Fazla mesai **0 sa 42 dk**. Aynı gün Aylık Durum'da "N" (normal) ama Toplam süre / Fazla mesai **0 sa 00 dk**; Aylık Çalışma Süresi'nde 19.10 hücresi boş; Kişi Bazlı Devam'da "Çalışılan gün 1" ama süre 0. | Fazla mesai toplam süreden büyük olamaz; aylık ve günlük rapor aynı kişi-gün için çelişiyor. Kök neden **doğrulanmadı** (`pdksDetail.ts:97` kuralı 8 dk için 0 üretir; günlük rapor başka bir hesap yolundan geliyor olabilir). | Günlük matris ile aylık sayfanın aynı `totalMinutes`/`overtimeMinutes` fonksiyonunu kullandığını doğrula; çelişkiyi yakalayan bir test ekle. | `d05-puantaj.png` (satır: 574 / 0 sa 08 dk / 0 sa 42 dk), `d14-aylik-durum.png`, `d15-aylik-sure.png`; `convex/lib/pdksDetail.ts:97` |
| 11-O1 | Orta | içerik / performans | Ham/Mobil Okutmalar'da **Kişi ve Departman filtresi yalnız yüklenen 50'lik sayfaya** uygulanıyor. `?q=zzz` → "Yüklenen 4 kayıt · Filtreye uyan 0" ve "Kayıt bulunamadı". Altta "Bu sayfada eşleşme bulunmasa da daha fazla kayıt yükleyebilirsiniz" notu. | Sayfa içi filtre (06-H1 türü): kayıt başka sayfada olsa da "yok" deniyor; kullanıcı elle "Daha fazla yükle" basmak zorunda. Sunucu `employeeId` filtresini zaten destekliyor ama UI göndermiyor. Mobil Okutmalar `sources` ile her sayfada 1000 satır okuyor. | Kişi seçimini sunucuya (`employeeId`) taşı; departman için sunucu filtresi ekle. | `src/components/reports/ReportResults.tsx:37-39,49-50`; `convex/cardReadings.ts:1758-1800`; `src/lib/reports/rows.ts:92-95`; `d24-ham-q.png` |
| 11-O2 | Orta | içerik | Aylık Çalışma Süresi'nde çalışılmayan günlerin hücresi **boş**; Aylık Durum'da aynı durum "—" / "DV". "Aylık Durum" açıklaması "— henüz gelmedi / veri yok" diyor. | Boş hücre "0 mı, veri yok mu, devamsız mı?" sorusunu cevaplamıyor. | 0 → "0:00" veya "—"; gelecek/veri yok → "—". | `src/lib/reports/rows.ts:115-117` (`formatShortMinutes` 0'da `''`); `src/lib/reports/registry.ts:87`; `d15-aylik-sure.png` |
| 11-O3 | Orta | içerik | Departmanı olmayan kişi "Departman" sütununda **"-"** (kısa tire), "Departman Bazlı Devam" raporunda departman adı olarak "-" satırı. Ham Okutmalar'da ise "—" (uzun tire). | Tutarsız yer tutucu; "-" bir departman adı gibi okunuyor, Excel/CSV'de de "-". Arka uç ayrıca başka yerde "Belirtilmemiş" kullanıyor. | Tek bir yer tutucu ("—" / "Belirtilmemiş"); backend sentinel'ini kaldır. | `convex/cardReadings.ts:834`; `convex/lib/reportAttendance.ts:97`; `d17-dept-devam.png`, `d02-ham.png` |
| 11-O4 | Orta | görsel / etkileşim | Aylık Durum tablosu **3597 px** genişliğinde (31 gün); her gün sütun başlığı "01.10.2026" (10 karakter). Ad Soyad sütunu yatay kaydırmada sabit kalmıyor. `pinnedColumns` yalnız PDF'te kullanılıyor. | Kaydırınca hangi satırın kimin olduğu kayboluyor; başlıklar gereksiz geniş. | Ad Soyad sütununu `sticky left-0` yap; gün başlığını "01" ya da "1 Per" yap. | `src/lib/reports/registry.ts:85-88`; `src/components/reports/ReportPage.tsx:55`; mobil ölçüm tableW=3597 (wrap 356); `d14-aylik-durum.png` |
| 11-O5 | Orta | görsel (mobil) | 390px'te filtreler alt alta (Ad, Dönem, Departman, Sonuç, Temizle, Yenile); tablo ekranın ~590–658 px aşağısında başlıyor (görünür alan ~780 px). Günlük raporlarda tablo 1414 px, ilk satır kıvrımın hemen altında. | İlk veri satırı kaydırma olmadan görünmüyor. | Mobilde filtreleri "Filtreler" açılır paneline topla veya iki sütuna sıkıştır; Yenile'yi filtre satırıyla birleştir. | DOM ölçümü (tableTop 658 / 609 / 590); `src/components/reports/ReportScreen.tsx:59-71` |
| 11-O6 | Orta | içerik | Günlük raporlar varsayılan olarak **16 sütun** gösteriyor (Geç Kalanlar, Devamsızlar, Erken Çıkanlar, İstisnalar, Fazla Mesai'de hepsi: Plan giriş/çıkış, Okutma sayısı, Manuel …). Rapor adıyla ilgisiz sütunlar. | Geç Kalanlar'da en önemli sütun ("Geç (dk)") 11. sırada, sağa kaydırınca görünüyor. Kullanıcı her raporda "Kolonlar"la elle ayıklamak zorunda. | Her raporun `columns` listesini odaklı yap (ör. Geç Kalanlar: Tarih, Ad, Departman, Plan giriş, İlk giriş, Geç dk). | `src/lib/reports/registry.ts:55,68-70,73-74`; `d06-gec.png`, `d07-devamsiz.png` |
| 11-O7 | Orta | içerik | "Resmi" grubundaki 3 satır (SGK Aylık, Fazla Mesai Özeti, Departman Maliyet) **üçü de aynı adrese** (`/settings?tab=reports`) gidiyor. | Hangi raporun açılacağı belli olmuyor; Raporlar menüsünde 16 değil "19 rapor" gibi görünüp ayrı bir modüle atılıyor. | Satırlara `?tab=reports&report=...` derin bağlantı ver ya da tek "Resmi raporlar" bağlantısı bırak. | `src/pages/Reports.tsx:19`; `d28-resmi.png` |
| 11-D1 | Düşük | erişilebilirlik (mobil) | Raporlar ana sayfasında grup başlığı bağlantıları ("Kayıtlar", "Günlük", "Aylık", "Resmi") **24 px** yüksekliğinde dokunma hedefi; alt rapor bağlantıları 44 px. | 44 px hedefin altında, yanlış dokunma. | `min-h-11` ekle. | `src/pages/Reports.tsx:25`; mobil ölçüm (small: 24 px) |
| 11-D2 | Düşük | içerik | Özel dönemde tarih alanları "01 Ekim 2026" (uzun ay adı), sayfanın geri kalanı "01.10.2026". Hata durumunda hem kırmızı hata hem "Dönem seçimini düzeltin." iki kez söyleniyor. | Biçim tutarsızlığı, tekrar. | Tek biçim (GG.AA.YYYY); ikinci cümleyi kaldır. | `src/components/reports/ReportScreen.tsx:67,70`; `d20-aralik-hata.png` |
| 11-D3 | Düşük | içerik | Dışa aktarılan Excel başlığı ve PDF başlığında dönem **ISO** biçimde ("2026-10-01 – 2026-10-18"). Ekranda "01.10.2026". | ISO tarih (09-O3 türü); dosya içi/ekran tutarsız. Dosya adı ISO kalabilir. Doğrulama dosya indirilmeden yapıldı (kod). | `formatReportDate` kullan. | `src/lib/reports/export.ts:70,118` |
| 11-D4 | Düşük | içerik | Yan not blokları: Ham Okutmalar altında 4 satır not + devre dışı "Tüm kayıtlar yüklendi" düğmesi. "Yenile ile güncel kayıtları getir" ama Convex sorguları zaten canlı güncelleniyor; ayrıca Excel'e "yalnız yüklenen kayıtlar" uyarısı tabloyla alakasız bir yerde. | Gürültü; "Yenile" gerçekte sayfa birikimini sıfırlıyor. | Notları tek satıra indir; "Tüm kayıtlar yüklendi" düğmesini gizle; Yenile metnini düzelt. | `src/components/reports/ReportResults.tsx:46-53`; `d02-ham.png` |
| 11-D5 | Düşük | içerik | "Devamsızlar", "Erken Çıkanlar", "Mola İhlalleri" boşken "Kayıt bulunamadı — filtreleri değiştirebilirsiniz". | İyi haber (kimse devamsız değil) kötü haber gibi okunuyor; Filtreleri temizle eylemi yok. | Rapora özel metin: "Bu dönemde devamsız kişi yok." + eylem düğmesi. | `src/components/reports/ReportPage.tsx:54`; `d07-devamsiz.png`, `d12-erken.png` |
| 11-D6 | Düşük | içerik | Excel'de süreler metin ("0 sa 08 dk"), toplanamaz; aylık raporda tüm sütun genişlikleri sabit 22. Sütun gizleme seçimi `localStorage`'da proje/kullanıcıdan bağımsız. | Bordro verisi Excel'de toplanamıyor. | Süreleri dakika (sayı) olarak ek sütun yap. | `src/lib/reports/export.ts:120-122`; `src/lib/reports/columns.ts:3` |

## Doğrulanan iyi taraflar (bulgu değil)
- Ücret: Raporlar'daki 16 raporda ücret alanı yok; Resmi → Ayarlar'daki fazla mesai kartı `totalOvertimePayTRY` null/0'da kartı hiç göstermiyor (sahte "0 ₺" yok): `src/components/settings/sections/ReportsSettings.tsx:184-186`. Arka uç `maskPay` ile null dönüyor: `convex/lib/payVisibility.ts`, `convex/reports.ts:152,258`.
- KVKK: ham okutmalar ve günlük kartta biyometrik kayıtlar çıkarılıyor + açıklama notu var (`ReportResults.tsx:24,47-48`).
- Saat dilimi: dönem "bugün" `todayInTurkey()` ile, saatler `timeZone: 'Europe/Istanbul'` ile; başlıkta "İstanbul saati (UTC+3)" yazıyor (`ReportScreen.tsx:76`, `rows.ts:127`).
- CSV/Excel formül enjeksiyonuna karşı `safeSpreadsheetValue` var (`export.ts:19-23`).
- Hata durumu: 36+ günlük (günlükte 31) dönem seçilince anlaşılır hata ve sorgu atlanıyor (`d20-aralik-hata.png`).

## Hızlı düzeltmeler (≤30 dk)
1. `formatShortMinutes` 0 için "—"/"0:00" döndürsün (11-O2).
2. Departman yer tutucusunu tek yap, "-" sentinel'ini "—"ya çevir (11-O3).
3. Hub'daki grup başlığı bağlantılarına `min-h-11` (11-D1).
4. Özel tarih alanı ve Excel/PDF başlığı için GG.AA.YYYY, hata metni tekrarını kaldır (11-D2, 11-D3).
5. Ham Okutmalar altındaki notları tek satıra indir, devre dışı düğmeyi gizle (11-D4).
6. Boş durum metinlerini rapora göre ayır (11-D5).
7. Aylık gün başlığını "01" biçimine kısalt (11-O4'ün yarısı).

## Ürün kararı gereken
1. **"Veri yok" mu "Devamsız" mı?** Kişinin ilk kayıt/işe başlama tarihinden önce ve vardiyası olmayan kişi için günler nasıl sayılsın? (11-H1)
2. **Kişi/departman filtresi ham okutmalarda sunucu tarafına mı taşınsın?** Maliyet: indeksli sorgu eklemek; fayda: doğru "kayıt yok" sonucu. (11-O1)
3. **"Resmi" raporlar Raporlar menüsünde mi kalsın, Ayarlar'a mı gitsin?** Şu an iki yerde, derin bağlantısız. (11-O7)

## Ekran görüntüleri
`docs/ui-audit-2/11-raporlar/`: `d01` hub · `d02–d17` 16 rapor varsayılan · `d18` devamsız özel aralık · `d19` geçen ay · `d20` aralık hatası · `d22` Kolonlar menüsü · `d23` Dışa aktar menüsü (indirme yok) · `d24` kişi araması · `d25` sonuç=Reddedildi · `d26–d27` Eylül aylık · `d28` Resmi · `m02–m04` mobil (emülasyon artefaktı).

## Kararlar (Emre, 2026-10-19)
- 11-H1: işe başlama (yoksa ilk kayıt) tarihinden önceki günler "—", hesaba girmez; 08-H1 "Veri yok" düzeltmesiyle birlikte yapılır.
- 11-H2: günlük/aylık süre ve fazla mesai çelişkisinin kök nedeni toplu düzeltmede araştırılacak (tek hesap yolu hedefi).
- 11-O1: ham okutmalarda kişi/departman filtresi sunucuya taşınır.
- 11-O7: "Resmi" raporlar Raporlar'da kalır, her satır derin bağlantıyla kendi raporunu açar.
