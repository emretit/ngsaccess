# UI Audit 2 — 05 Geçiş Kontrol (/access-control)

**Özet:** Yeni A2 arayüzü sayfada temiz görünüyor (tek h1, sade tablo, Türkçe ve UTC+3 tarihler doğru, odak halkaları çalışıyor). En önemli sorun kural sihirbazında: "İleri" butonu 3. adımda "Kuralı kaydet"e dönüşürken tıklama formu otomatik gönderiyor (3. adıma girer girmez kırmızı hata çıkıyor). Diğerleri metin/tutarlılık ve ölü kod sorunları.

| Yüksek | Orta | Düşük |
|---|---|---|
| 1 | 6 | 6 |

**Kapsam notu:** Bölge/kapı ekle-taşı diyalogları (AddZone/AddDoor/EditDoor/MoveReader) ve ZonesAndDoors / GroupMembers / GroupDevices / AccessControlSidebar bu sayfada YOK; `LocationTree` üzerinden Cihazlar sayfasında kullanılıyor (`src/components/devices/LocationTree.tsx:10-15`). Bu sayfada denetlenenler: kural listesi, ayrıntı çekmecesi, 3 adımlı kural diyaloğu, gönderim onayı, durum şeridi, gönderim geçmişi. Hiçbir kaydet/sil/gönder onaylanmadı (yalnız Escape/Çık). Mobil (390px): içerik ekrana sığdığı için (main 780px) ekran görüntüsü yalnız üst 312px'i verdi; alt kısım ölçümle (eval) denetlendi. Eski tarama (`docs/ui-scan/pages/05-gecis-kontrol/REPORT.md`) bulgularının çoğu giderilmiş: adım adım sihirbaz, ayrı başlıklar, sayfalı liste, "Tüm gün" radyosu, yerel saat notu var. Eski ACC-UI-17 (düğme etiketi "Cihazlara gönder" ama kapsam Hikvision/IDE karışık) hâlâ açık, onay metni artık kapsamı açıklıyor.

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 05-H1 | Yüksek | hata / etkileşim | 2. adımda "İleri"ye basınca 3. adıma geçiliyor ve cihaz seçmeden "Lütfen en az bir cihaz, bölge veya kapı seçin." kırmızı hatası hemen görünüyor. | İleri ve Kuralı kaydet aynı konumdaki aynı `<Button>`; `type` "button"→"submit" olunca aynı tıklama formu gönderiyor (tarayıcı varsayılan davranışı). Oluştururken doğrulama yakalıyor; **Düzenle modunda** (kayıtlı kuralın cihazı zaten dolu) 2→3 geçişinde kural istenmeden kaydedilip cihaz gönderimi tetiklenebilir — doğrulanmadı (kayıt riski nedeniyle denenmedi). | İki buton için farklı `key` ver ya da İleri'yi `type="button"` + submit'i ayrı eleman yap; geçişte `stepError`/`errors` temizle. | `unified/CreateRuleDialog.tsx:299-315`; `desktop-create-step3.png` |
| 05-O1 | Orta | içerik | Kural satırında "Deneme1 — tüm kapılar · tüm kapılar" (ifade iki kez). | Backend etiketi zaten "— tüm kapılar" içeriyor, arayüz bir daha ekliyor. | `scopeText`'te ya yalnız `panel.label` ya da ad + durumu birleştir. | `AccessRulesList.tsx:56` + `convex/lib/accessRuleSummary.ts:30`; `desktop-0.png` |
| 05-O2 | Orta | içerik | Gönderim onayı "Marka dağılımı: other: 1, hikvision: 2, ide_smart: 1" gösteriyor. | Ham teknik anahtarlar (ide_smart, other) son kullanıcıya gösteriliyor. | Marka adı sözlüğü (Hikvision, IDE Smart, Diğer). | `SyncRuns.tsx:150-156`; `desktop-send-confirm2.png` |
| 05-O3 | Orta | içerik / etkileşim | Gönderim onayı `ConfirmDestructive` (yıkıcı onay bileşeni) kullanıyor; düğme "Cihazlara gönder" ama kapsam tüm proje. Ayrıca marka sayımı için tüm `devices.list` sonucu çekiliyor. | Yıkıcı olmayan işlem yıkıcı stille sunuluyor (doğrulanmadı: stil animasyon sırasında yakalandı); tüm cihaz listesi yalnız sayım için sayfaya yükleniyor. | Nötr onay diyaloğu; sayımı sunucuda hesapla ya da etiketi "Tüm proje cihazlarına gönder" yap (eski ACC-UI-17). | `SyncRuns.tsx:137-170` |
| 05-O4 | Orta | içerik | Gün kısaltmaları tutarsız: tabloda "Pzt, Sal, Çar, Per, Cum", formda "Pt, Sa, Ça, Pe, Cu, Ct, Pz". "Pz" formda Pazar, tabloda "Pzt" Pazartesi. | Aynı gün iki farklı yazılış; "Pt/Pz" karışıklığa yol açar. | Form düğmelerinde de `abbr` (Pzt…Paz) kullan veya sütun genişliği için tek set seç. | `components/weekdays.ts:18-24`; `desktop-create-step3.png` |
| 05-O5 | Orta | içerik | Ayrıntı çekmecesi **personel** kuralında bile "Ziyaretçiler şablona Ziyaretçiler ekranından eklenir…" açıklamasını gösteriyor; kural açıklaması boşsa boş `<p>` kalıyor. | Alakasız metin; asıl bilgi (panel/kapı) altta. Panel listesi ile "Açık kapı seçimleri" (Kapı 1-4, panel adı yok) aynı bilgiyi iki kez veriyor. | Metni yalnız ziyaretçi şablonunda göster; kapıları panel altında grupla. | `AccessRuleDetails.tsx:73-77`, `AccessRulesList.tsx:192`; `desktop-detail-sheet.png` |
| 05-O6 | Orta | etkileşim | Kaydedilmemiş değişiklik uyarısında düğmeler "Vazgeç" / "Çık". Ana diyalogda "Vazgeç" = kapat, uyarıda "Vazgeç" = kal. | Aynı kelime iki zıt anlamda; yanlışlıkla taslak kaybı. | Uyarıda "Düzenlemeye dön" / "Çık ve sil". | Uyarı iletişim kutusu (Escape ile açıldı); `CreateRuleDialog.tsx:281-288` |
| 05-D1 | Düşük | etkileşim | "Tür" filtresi yalnız o sayfanın 20 kaydını daraltıyor; "Bu sayfada N kural" ve boş durum buna göre değişiyor. | Sonraki sayfada eşleşen kayıt olsa bile "Eşleşen kural yok" görünebilir (metin uyarıyor ama kullanıcı yükü). | Tür filtresini sunucu sorgusuna taşı. | `AccessRulesList.tsx:250-266,461-470` |
| 05-D2 | Düşük | görsel | Filtre `<select>`'leri yerel HTML select, 12px; diğer sayfalardaki A2 Select bileşeni değil. Mobilde 12px alan iOS'ta odakta sayfayı yakınlaştırır (doğrulanmadı, cihazda denenmedi). | Bileşen tutarsızlığı + mobil. | A2 Select kullan veya `text-base` mobilde. | `AccessRulesList.tsx:473-486` |
| 05-D3 | Düşük | erişilebilirlik | Mobilde Önceki/Sonraki/Yeni kural/Cihazlara gönder 36px yüksek; "NGS" kural adı bağlantısı 28×19px. İşlem menüsü 44px (doğru). | 44px dokunma hedefi altında. | Mobilde `min-h-11` ver; ad bağlantısını satır genişliğinde yap. | Mobil ölçüm (eval); `AccessRulesList.tsx:104-110` |
| 05-D4 | Düşük | erişilebilirlik | Kişi/kapı ağacındaki onay kutuları 16×16px. | WCAG 2.2 hedef boyutu (24px) altında; etiket tıklanabiliyorsa etkisi sınırlı (doğrulanmadı). | Satırı tam genişlikte tıklanabilir yap. | `DepartmentTree.tsx`, `ZoneDeviceTree.tsx`; ölçüm (eval) |
| 05-D5 | Düşük | içerik | Durum şeridi "Geçmiş doğrulanmış cihaz onayı: 20.06.2026" (4 ay önce) yanında "Bekleyen işlem yok" rozeti; eski onay uyarı olarak vurgulanmıyor. | Kullanıcı eski onayı "güncel" sanabilir. | 7 günden eskiyse warning tonu + "son onay 4 ay önce". | `DeviceSyncStatusBanner.tsx:45-56`; `desktop-0.png` |
| 05-D6 | Düşük | performans / kod | `ZonesAndDoors`, `GroupMembersManager`, `GroupDevicesManager`, `AccessControlSidebar`, `UnifiedAccess`, `CardReadings*` hiçbir yerden import edilmiyor (ölü kod, ~700 satır). | Bakım yükü, yanlış yere düzenleme riski. | Silmeyi planla (ürün onayı sonrası). | `grep` sonucu: yalnız `LocationTree.tsx` Add/Edit/Move diyaloglarını import ediyor |

## Hızlı düzeltmeler (≤30 dk)
1. 05-H1: İleri/Kaydet butonlarına ayrı `key` + geçişte hata temizle (CreateRuleDialog.tsx:299).
2. 05-O1: `scopeText` çift "tüm kapılar" (AccessRulesList.tsx:56).
3. 05-O2: marka adı sözlüğü (SyncRuns.tsx:150).
4. 05-O4: form gün düğmelerinde `abbr`.
5. 05-O5: ziyaretçi notunu koşullu göster.
6. 05-O6: uyarı düğme etiketleri.

## Ürün kararı gereken
1. "Cihazlara gönder" tüm proje cihazlarına mı, yalnız Hikvision'a mı gidecek; etiket/onay ona göre mi (eski ACC-UI-17)?
2. Tür filtresi sunucu tarafına taşınsın mı (Convex index değişikliği gerekebilir)?
3. Ölü bileşenler (ZonesAndDoors vb.) silinsin mi?

## Kanıt dosyaları
`05-gecis-kontrol/`: desktop-0, desktop-detail-sheet, desktop-send-confirm2, desktop-create-dialog, desktop-create-error, desktop-create-step2, desktop-create-step3, mobile-0 (yalnız üst 312px).

## Kararlar (Emre, 2026-10-19)
- 05-H1: HEMEN düzeltildi (İleri/Kaydet düğmelerine ayrı `key`). Tarayıcıda doğrulandı: 2→3 geçişinde hata/gönderim yok; tsc + access-control testleri yeşil. Commit bekliyor.
- 05-D6: ölü bileşenler toplu düzeltmede silinecek.
