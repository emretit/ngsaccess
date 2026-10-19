# UI Audit 2 · 12 · Denetim Kaydı (/audit-log)

## Özet

Sayfa A2 diline oturmuş, sağlam: filtre, tarih (UTC+3), Sistem filtresi, sayfalama, yan panel, klavye/Escape ve odağın geri dönmesi çalışıyor; gizli alanlar (şifre/token) ve T.C. no/ücret ayrıntıda görünmüyor. Asıl sorunlar **içerik/veri etiketi** tarafında: en yeni kayıt ham teknik anahtarlarla (`projectPrivacySettings`, `biometricEnabled`) gösteriliyor, bu varlık filtrelenemiyor, e-posta liste ile filtrede tutarsız maskeleniyor. Yüksek bulgu yok; 3 Orta, 5 Düşük.

| Yüksek | Orta | Düşük |
|---|---|---|
| 0 | 3 | 5 |

Ortam notu: kapsamdaki projede (NGS) yalnız **1 kayıt** var (19.10.2026 16:19:03, Oluşturuldu, `projectPrivacySettings`). Sayfalama ("Daha fazla yükle") ve çoklu satır davranışı canlıda görülemedi; kod okumasına dayanır. Mobil emülasyon ekran görüntüsü bilinen üçlü tekrar hatasıyla güvenilmez çıktı; mobil bulgular ölçüme (`scrollWidth`, tablo metni) dayanır.

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 12-O1 | Orta | içerik | Varlık sütununda ve ayrıntı başlığında ham anahtar: `projectPrivacySettings` (masaüstünde "…Setting/s" diye alt satıra bölünüyor). | Kullanıcıya teknik anahtar gösteriliyor (05-O2). Bu tablo 6 yerde yazılıyor ama etiket sözlüğünde yok. | `AUDIT_TARGET_LABELS`'a "Proje Gizlilik Ayarları" (ve `cardReadings`) ekle. | `convex/lib/auditLogQuery.ts:3-14`; `AuditTable.tsx:15`; `AuditDetailPanel.tsx:12`; `d01-ust.png`, `d02-detay.png`; yazım yerleri `convex/projects.ts:77`, `privacyRetention.ts:34,45`, `onboarding.ts:57` |
| 12-O2 | Orta | işlev/içerik | "Varlık" filtresi yalnız sözlükteki 10 tabloyu listeler; `projectPrivacySettings` ve `cardReadings` yazılıyor ama seçilemiyor. Üstelik sayfadaki tek kayıt bu türden. | Kullanıcı en yeni olayı varlık filtresiyle bulamaz; kayıt kapsamı dürüst görünmüyor. | Filtre seçeneklerini sözlükle birlikte güncelle (O1 ile aynı düzeltme). | `AuditFilters.tsx:42`; `convex/auditLog.ts` `distinctTargetTables` (sözlük anahtarlarını döndürür); `d01-ust.png` |
| 12-O3 | Orta | içerik/gizlilik | Aynı kişi liste ve ayrıntıda tam e-posta (`emre@ngsteknoloji.com`) olarak görünürken, Kullanıcı filtresinde maskeli (`e***@ngsteknoloji.com`) ve "Proje üyesi değil" etiketiyle listeleniyor; ayrıca ayrı bir "Silinmiş kullanıcı · Proje üyesi" seçeneği var. | Maskeleme tutarsız: bir yerde gizlenen e-posta başka yerde açık. Aktör seçeneği hangi kişi olduğunu söylemiyor, "Proje üyesi değil" yanıltıcı (kişi bu kaydı bu projede yazdı). Sır değil, kişisel veri. | Ad yoksa e-postayı her yerde aynı biçimde (maskeli) göster; yazma anında `userName` için e-posta yerine ad/maskeli e-posta sakla. Aktör durum etiketlerini gözden geçir. | `convex/lib/audit.ts:19-21` (userName = ad ?? e-posta); `convex/auditLog.ts:96-99` (liste e-postaya düşüyor); `convex/lib/auditActors.ts:35-41` (filtre maskeliyor); `d03-kullanici-menu.png`, `d02-detay.png` |
| 12-D1 | Düşük | içerik | Ayrıntıda alan adı ham: `biometricEnabled` (Önce: Kaydedilmedi, Sonra: Hayır). | Ham alan anahtarı (05-O2). | `commonLabels`'a `biometricEnabled: "Biyometrik veri işleme"`, `cardReadingRetentionDays`, `aiMaskNames` ekle. | `auditLabels.ts:1-40` (etiket yok); `d02-detay.png` |
| 12-D2 | Düşük | içerik | Boş sonuçta aynı bilgi üç kez: üstte "0 eşleşen kayıt yüklendi · Kapsamın sonuna ulaşıldı", ortada "Filtrelere uygun kayıt yok", altta "Bu kapsamdaki tüm eşleşmeler yüklendi." Ayrıca "Filtreleri temizle" iki kez (üst ghost + gövdede). Geçersiz aralıkta hata iki cümle: "Başlangıç tarihi bitiş tarihinden sonra olamaz." + "Tarih aralığını düzeltin." | Gürültü; ADHD/okuma yükü. | Sıfır sonuçta sayaç ve alt durum satırını gizle; gövde butonunu kaldır ya da üsttekini yeterli say; ikinci aralık cümlesini kaldır. | `AuditResults.tsx:50-53`; `AuditLog.tsx:30`; `d04-sistem.png`, `d05-aralik-hata.png` |
| 12-D3 | Düşük | içerik | Tarih biçimi tutarsız: tarih seçici "20 Ekim 2026", liste/ayrıntı "19.10.2026 16:19:03" (09-O3 türü, hâlâ açık sayılır). | Aynı sayfada iki biçim. | Seçici görüntüsünü `GG.AA.YYYY` yap (ortak DatePicker ayarı). | `date-picker.tsx` (`formatDateString`/gösterim); `d05-aralik-hata.png` vs `d01-ust.png` |
| 12-D4 | Düşük | erişilebilirlik | Tarih seçici düğmelerinin erişilebilir adı yalnız "Başlangıç"/"Bitiş"; seçili değer ve boş durum ("Tarih seçin") anons edilmiyor. | Ekran okuyucu seçili tarihi bilmez. | Düğme adına değeri ekle (örn. "Başlangıç: 20 Ekim 2026"). | `snapshot`: `button "Başlangıç"`; `AuditFilters.tsx:44` |
| 12-D5 | Düşük | görsel | Hata mesajı tarih alanlarının yanında, giriş kutularıyla dikey hizası kaymış (baseline ~9px aşağıda) ve "Filtreleri temizle"yi sağa itiyor. | Küçük hiza bozukluğu. | Hata satırını alanların altına al (tam genişlik). | `AuditFilters.tsx:44-45`; `d05-aralik-hata.png` |

Kontrol edilip sorun çıkmayanlar: İstanbul saati başlıkta ve `time` etiketinde açık; masaüstü/390px'te yatay taşma yok (tablo 356/356 px); Escape paneli kapatıp odağı "Ayrıntı" düğmesine geri veriyor; Sistem filtresi çalışıyor (bu projede 0 kayıt); "Filtreleri temizle" proje kapsamını koruyor (karara uygun, `FilterBar.tsx:5`); CSV dışa aktarma yok (karara uygun); sır/T.C. no/ücret ayrıntıda görünmedi (`auditLabels.ts` maskeleme + `redactAuditValue`; canlı kayıtta yalnız boolean var, ücret/TC içeren kayıt bu projede yok — doğrulanmadı).

Eski taramadan (ui-scan 11) **hâlâ açık**: AUD-UI-17 kayıt kapsamı (yönetim eylemlerinin çoğu denetlenmiyor; sayfa her şeyin günlüğü gibi duruyor) — yeni açıklama metni eklenmiş değil. Diğerleri (kapsam koruyan temizle, tarihsel aktör, Sistem filtresi, İstanbul saati, "Oluşturuldu/Güncellendi/Silindi") kapanmış.

## Hızlı düzeltmeler (≤30 dk)

1. `AUDIT_TARGET_LABELS`'a `projectPrivacySettings` + `cardReadings` ekle (O1, O2).
2. `commonLabels`'a gizlilik alanlarını ekle (D1).
3. Sıfır sonuç durumunda tekrar eden metin/butonları sadeleştir; ikinci aralık cümlesini kaldır (D2).
4. Tarih seçici düğme adına değeri ekle; hata satırını altına taşı (D4, D5).

## Ürün kararı gereken

1. Ad yokken denetim kaydında e-posta nasıl gösterilsin: tam, maskeli, ya da hiç? (O3)
2. Kayıt kapsamı açıklaması: sayfaya "Hangi eylemler kaydedilir" bilgisi eklensin mi, yoksa önce kapsam genişletilsin mi? (AUD-UI-17)

Kanıt dosyaları: `docs/ui-audit-2/12-denetim-kaydi/` (d01–d06 masaüstü, m01 mobil üst — emülasyon tekrar hatası nedeniyle sınırlı).

## Kararlar (Emre, 2026-10-19)
- 12-O3: adı olmayan aktörün e-postası her yerde (liste, ayrıntı, filtre) TAM gösterilir; "Proje üyesi değil" etiketi düzeltilir.
- Başlık altına "Hangi eylemler kaydedilir" kısa açılır listesi eklenir.
