# Geçiş Kontrol UX/UI audit — 01 Kurallar (/access-control)

**Özet:** 2026-10-19 auditindeki 6 hızlı düzeltmenin hepsi canlıda (İleri/Kaydet, çift "tüm kapılar", marka adları, gün kısaltmaları, uyarı düğmeleri). Kalan sorunlar teknik olmayan yönetici açısından: sihirbazda "Özel saat / Şablon kullan" seçimi görsel olarak ayırt edilmiyor, çevrimdışı cihaza gidemeyen gönderim "Kısmi sonuç" diye gösteriliyor ve kullanıcıya sonraki adım söylenmiyor. Departman seçimi anlık kopya; departmana sonradan katılan kişi kurala girmiyor.

| Yüksek | Orta | Düşük |
|---|---|---|
| 2 | 8 | 4 |

Kapsam: kural listesi + filtreler, 3 adımlı kural sihirbazı (kaydedilmedi), ayrıntı çekmecesi, gönderim ayrıntısı, "Tüm proje cihazlarına gönder" onayı (Vazgeç ile kapatıldı), 390px mobil. Tarayıcı paneli tarama sırasında 1440→817px daraldı; orta genişlik bulguları bu sayede görüldü.

## Senaryolar
- **S1 — "Talip'e hafta içi Giriş kapısı yetkisi ver":** 3 adım + 1 kaydet. Adım 1 ad, adım 2 kişi ağacı, adım 3 kapı ağacı + saat. Takılma: 3. adımda Özel saat/Şablon kullan hangisinin seçili olduğu belli değil (01-H1); kapı ağacında bölge/panel/kapı üç kavram (01-O8).
- **S2 — "Yönetim departmanının tamamı":** departman kutusu işaretleniyor ama "Sonradan katılanlar otomatik eklenmez" (01-O1). Yeni gelen kişi için kuralı yeniden düzenlemek ya da Kişiler formundan kural seçmek gerekiyor.
- **S3 — "Kural cihaza gitti mi?":** Ayrıntı → Kuralın son gönderimi → Ayrıntı = 3 tıklama. Sonuç "Kısmi sonuç · 2 atlandı · Cihaz çevrimdışı"; ne yapılacağı yazmıyor (01-H2).
- **S4 — Kişinin hangi kurallarda olduğunu bulmak:** "Kural adı" açılır kutusunu "Kişi adı" yapmak gerekiyor; bu seçenek keşfedilmiyor (01-O3).

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 01-H1 | Yüksek | görsel / etkileşim | 3. adımdaki "Özel saat" ve "Şablon kullan" düğmeleri seçiliyken de seçili değilken de aynı (beyaz zemin, aynı kenarlık). | Kullanıcı hangi zaman kaynağının kayda gideceğini bilmiyor; şablon seçtiğini sanıp özel saatle kaydedebilir. `aria-pressed` var ama görsel karşılığı yok. | Seçili olana `variant="default"` ver ya da A2 segment/ToggleGroup kullan. | `components/TimeSchedule.tsx:40-63`; eval: ikisinde de `bg=rgb(255,255,255)`; `01-kurallar/rule-step3.png`, `rule-step3-tpl.png` |
| 01-H2 | Yüksek | içerik / akış | Gönderim sonucu: iki cihaz da "Atlandı · Cihaz çevrimdışı", üst durum "Kısmi sonuç". Yeniden gönder düğmesi ya da "cihaz dönünce gider" bilgisi yok. | Hiçbir cihaza gitmediği halde "kısmi" deniyor; kullanıcı kuralın bir kısmının çalıştığını sanır. Sonraki adım yok. Cihaz yeniden bağlanınca otomatik gönderim kodda bulunamadı (`recordConnectivityTransition` sync tetiklemiyor; doğrulanmadı). | Tümü atlandıysa durum "Gönderilemedi"; satırda "Cihaz bağlanınca yeniden gönderin" + "Yeniden gönder" düğmesi, ya da cihaz çevrimiçi olunca otomatik gönder (ürün kararı). | `convex/lib/deviceSyncRun.ts:58` (`skipped>0 → partial`); `SyncRuns.tsx` RunResult; `01-kurallar/run-detail.png` |
| 01-O1 | Orta | akış / ürün | Kişi adımında departman işaretlenince o anki kişiler ekleniyor; "Sonradan katılanlar otomatik eklenmez." | Departmana yeni giren çalışan kapıdan geçemez; yönetici bunu fark etmez. Hik-Connect'te kişi grubu dinamik. Kişiler formunda kural seçimi var ama yönetici bunu bilmeyebilir. | Ürün kararı: dinamik departman üyeliği ya da yeni kişi kaydında "bu departmanın kuralları: X, Y — eklensin mi?" önerisi. | `01-kurallar/rule-step2-err.png`; `src/components/employees/EmployeeFormFields.tsx:113-153` |
| 01-O2 | Orta | görsel | 1280px altında (laptop, tablet, mobil) özel saatli kuralların gün/saat bilgisi satırda hiç görünmüyor; yalnız şablonlu kuralda alt satır var. | En çok bakılan bilgi (ne zaman geçer) orta ekranlarda kayboluyor. 817px'de "Ne zaman" sütunu yok. | `xl:hidden` alt satırı özel saatli kural için de göster (`formatWeekdaysAbbr` + saat). | `rules-list/RuleRow.tsx:73-80` |
| 01-O3 | Orta | etkileşim | Arama kutusunun yanında "Kural adı" yazan açılır kutu; aslında "arama alanı" seçicisi (Kural / Kişi / Kapı). | Değer gibi okunuyor, filtre sanılıyor; kişiye veya kapıya göre arama keşfedilmiyor. | Tek kutu "Kural, kişi veya kapı ara" ya da kutunun içinde önek "Ara: Kural ▾". | `rules-list/RulesFilters.tsx:31-41`; `01-kurallar/rules-0.png` |
| 01-O4 | Orta | içerik | Teknik metinler: "Gönderildi durumu teslim kanıtı değildir. Cihaz doğrulaması ayrıca gösterilir."; onayda "Hikvision gönderimi teslim kanıtı değildir; IDE cihaz onayı ayrıca izlenir."; sihirbaz altında "1 kişi → 0 panel / 0 açık kapı seçimi → 5 gün". | Teknik olmayan yönetici için anlamsız; "açık kapı seçimi" kapı açık kalacak sanılabilir. | Sade dil: "Cihaz aldığını bildirene kadar 'Gönderildi' görünür." / alt özet "1 kişi · 2 kapı · Pzt–Cum tüm gün". | `SyncRuns.tsx` SheetDescription + ProjectSyncButton; `CreateRuleDialog.tsx:276-285` |
| 01-O5 | Orta | akış | "Şablon kullan" seçilince boş açılır liste "Şablon seçin"; projede şablon yoksa yönlendirme yok. Liste yerel `<select>`, A2 Select değil. | Kullanıcı neden boş olduğunu ve şablonu nerede oluşturacağını bilmiyor. | Şablon yoksa "Henüz şablon yok — Zaman Şablonları sekmesinde oluşturun" + bağlantı; A2 Select. | `templates/TemplatePicker.tsx:32-47`; `01-kurallar/rule-step3-tpl.png` |
| 01-O6 | Orta | etkileşim | Ayrıntı çekmecesinde "Düzenle" ya da "Pasifleştir" düğmesi yok; düzenlemek için çekmeceyi kapatıp satır menüsüne dönmek gerekiyor. | Ayrıntıyı açan kullanıcı oradan düzenlemeyi bekler; fazladan 2 tıklama. | Çekmece başlığına "Düzenle" (canManage). | `rules-list/RuleRow.tsx:150-190`; `01-kurallar/rule-detail.png` |
| 01-O7 | Orta | içerik | Ana listedeki "Son gönderimler" sıfır sayaçlarla dolu ("0 kuyrukta · 0 gönderildi · …"). | Gürültü. **Başka oturumda düzeltiliyor** (Emre isteği: yalnız son gönderim; `SyncRuns.tsx` + `presentation.ts` çalışma ağacında değişik). | Diğer oturumun işi; burada tekrar ele alınmaz. | `01-kurallar/rules-0.png` |
| 01-O8 | Orta | içerik | Aynı şey için farklı kelimeler: "panel" (ayrıntı, alt özet, arama), "cihaz" (düğme "tüm kapıları ve cihazları seç"), ağaçta "NGS0001 — bu bölgede 1 kapı". | Kullanıcı panel ile cihazın farkını sorar; Cihazlar sayfası "cihaz" diyor. | Kullanıcıya tek terim: "cihaz". Ağaç: Bölge › Cihaz › Kapı. | `AccessRuleDetails.tsx:87`, `CreateRuleDialog.tsx:280`, `ZoneDeviceTree.tsx` |
| 01-D1 | Düşük | erişilebilirlik / görsel | Mobilde 4 sekme 2 satıra sarıyor, sekme yüksekliği 31px. | 44px dokunma hedefi altında; ikinci satırdaki tek sekme ortada kalıyor. | Mobilde yatay kaydırmalı sekme şeridi + `min-h-11`. | `UnifiedAccessControl.tsx:66`; eval: tablist 358x69, sekmeler 31px |
| 01-D2 | Düşük | içerik | "Bu sayfada 1 kural" sayacı. | Kullanıcı toplamı bekler; sayfa içi sayı bilgi taşımıyor (liste zaten görünüyor). | Kaldır ya da sunucudan toplam "N kural". | `AccessRulesList.tsx:76-86` |
| 01-D3 | Düşük | içerik | Adım başlıkları iki kez: "Kimler erişebilir?" + "Kim erişebilecek?", "Nerede ve ne zaman?" + "Hangi kapılarda?". | Tekrar, dikey yer kaybı. | Ağaç bileşenlerindeki iç başlığı kaldır ya da adım başlığını sadeleştir. | `01-kurallar/rule-step2-err.png`, `rule-step3.png` |
| 01-D4 | Düşük | içerik | "Geceyi aşan planlar için ayrı kurallar oluşturun." | Gece vardiyası (22:00–06:00) için iki kural gerekiyor; yönetici bunu hata sanabilir. | Saat aralığında bitiş < başlangıç ise otomatik "ertesi gün" olarak böl (ya da şablona yönlendir). | `components/TimeSchedule.tsx:84-87` |

## Sekmeler arası (koordinatör notu)
- Başlık tutarsız: Kurallar'da H1 "Geçiş Kontrol" + açıklama; Zaman Şablonları ve Yetki Durumu'nda H1 sekme adı; Kapı Planları'nda başlık ve açıklama hiç yok, sayfa "0 kapı seçildi (en fazla 50)" ile başlıyor. Sekme şeridi H1'in üstünde. Öneri: sabit H1 "Geçiş Kontrol" sekmelerin üstünde, her sekmede tek satır "bu sekme ne işe yarar" açıklaması. Kanıt: `01-kurallar/tab-doors.png`.
- Kapı Planları tablosunda "Durum planı: Kapalı" — kapı "kapalı/kilitli" diye okunabilir (plan kapalı demek). Ayrıntı 04 raporunda.

## Önceki audit (05, 2026-10-19) durumu
Kapandı: 05-H1, 05-O1, 05-O2, 05-O3 (etiket "Tüm proje cihazlarına gönder", nötr onay), 05-O4, 05-O5, 05-O6, 05-D1 (tür filtresi sunucuda), 05-D2 (A2 Select), 05-D5 (şerit kalktı).

## Hızlı düzeltmeler (≤30 dk)
1. 01-H1: seçili zaman kaynağı düğmesine dolu stil.
2. 01-O2: özel saatli kuralda `xl:hidden` gün/saat alt satırı.
3. 01-O5: şablon yoksa boş durum + Zaman Şablonları bağlantısı.
4. 01-O6: çekmeceye "Düzenle" düğmesi.
5. 01-O4 + 01-O8: metin ve terim sadeleştirmesi (panel → cihaz).

## Ürün kararı gereken
1. Departman seçimi dinamik mi olsun? (a) departmana katılan otomatik girer (b) bugünkü gibi anlık kopya + yeni kişi kaydında öneri (c) kuralda "departmanı takip et" seçeneği.
2. Çevrimdışı cihaz yüzünden atlanan gönderim: (a) cihaz bağlanınca otomatik gönder (b) "Yeniden gönder" düğmesi (c) ikisi.
3. Kullanıcıya görünen terim: "panel" mi "cihaz" mı?

## Kanıt dosyaları
`01-kurallar/`: rules-0, rule-step1, rule-step2-err, rule-step3, rule-step3-tpl, rule-detail, run-detail, send-confirm, m-rules-0 (mobil, yalnız üst parça gerçek), tab-doors.

## Kararlar (Emre, 2026-10-27)
- 01-O1 departman: **dinamik** — departmana sonradan katılan kişi kurala otomatik girer (Hik-Connect kişi grubu gibi).
- 01-H2 çevrimdışı: **ikisi de** — cihaz yeniden bağlanınca otomatik gönderim + sonuç ekranında "Yeniden gönder" düğmesi.
- 01-O8 terim: kullanıcıya **"cihaz"** (panel kelimesi arayüzden kalkar). Ağaç: Bölge › Cihaz › Kapı.
- 10:25 proje gönderimini Emre bastı; araştırma kapandı.
