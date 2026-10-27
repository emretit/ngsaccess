# Geçiş Kontrol Dalga 3 — çapraz denetim

**Karar: Düzeltme gerekli** (Engel yok; 3 Önemli, 12 Küçük). İstenen maddelerin hepsi yapılmış, Dalga 1/2 davranışlarında regresyon bulunamadı. Önemli bulgular kod/tarayıcı doğrulaması ister; tarayıcı kullanılmadığı için görsel olanlar "doğrulanmadı" diye işaretli.

## Kapılar (kendi koşumum)
| Kapı | Sonuç |
|---|---|
| `tsc -p tsconfig.app.json` | 0 hata |
| `tsc -p convex/tsconfig.json` | 0 hata |
| `eslint src/components/access-control` | 0 hata/uyarı |
| `vitest run src/components/access-control` | 29 dosya, 208 test geçti |
| `any` / `as any` / `!` taraması (eklenen satırlar) | yok; yeni alanlar camelCase |

## Madde kontrolü
01-O2, 01-O6, 01-D1, "teslim kanıtı", 01-O3, 02-O4, 03-O3..O8, 04-O1, 04-O4, 04-O7, 04-O5, 04-O6, 04-D1, GK-4: hepsi kodda var. `grep "teslim kanıtı"` kullanıcı metninde 0. Backend izni tutarlı: `convex/accessGrantStatus.ts:226` "tümü" → `devices.manage`, seçili/hatalı → `accessRules.manage`; UI ve `useRedistribution` aynı ayrımı yapıyor. C2: `updatePlans` yalnız verilen alanı yazıyor, seçilmeyen tür argümanda yok → hedefte korunuyor (doğrulandı, `convex/doors.ts:576-640`).

## Bulgular
| ID | Önem | Dosya:satır | Sorun | Öneri |
|---|---|---|---|---|
| C1-1 | Önemli | `DoorStatusPlanEditor.tsx:153`, `door-dialog/DoorVerifyPlanEditor.tsx:161` | "Hafta içi" düğmesi tıklanınca mevcut haftalığın yalnız ilk aralığını (`flatMap(...)[0]`) alıp Pzt–Cum'a yayar; gün bazında farklı/çok aralıklı kurulum onaysız silinir, ilk aralık Cumartesi'ye aitse onu kopyalar. Testte yalnız basit hâl var. | Haftalık zaten doluysa onay iste ya da düğmeyi yalnız "Her gün aynı" modunda göster; "ilk aralığı Pzt–Cum'a uygular" yaz; çok aralıklı haftalıkla test ekle. |
| C1-2 | Önemli (görsel, doğrulanmadı) | `DoorStatusPlanSection.tsx:20`, `DoorVerifyPlanSection.tsx:30`, `DoorPlanDialog.tsx:246` | `Switch` (`h-[24px] w-[44px]`) `min-h-11` alıyor → 44×44 daire olur; ayrıca dialog geneli `[&_button]:min-h-11 [&_input]:min-h-11 [&_label]:min-h-11` hem masaüstünü etkiler (mobil önek yok) hem tatil onay kutusunu (native checkbox) ve tüm etiketleri uzatır. | Switch'ten `min-h-11` kaldır, dokunma alanını saran 44px etiketle ver; geniş seçicileri `max-sm:` ile sınırla, checkbox'ı hariç tut; Orca'da 390px + masaüstü ekran görüntüsü al. |
| D-1 | Önemli (görsel, doğrulanmadı) | `StatusFilters.tsx:69`, `StatusCounters.tsx:26`, `StatusPage.tsx` (Yenile) | `min-h-11` koşulsuz: masaüstünde bütün filtre/sayaç/düğmeler büyüyor ("Masaüstü düzeni korunur" ihlali). `[&>[role=search]>div:last-of-type]:order-first` FilterBar iç yapısına bağlı kırılgan seçici (FilterBar'a `end` eklenirse yanlış öğeyi taşır). | `max-lg:min-h-11` kullan; sıralamayı seçiciyle değil FilterBar'a `searchFirst` benzeri prop ile yap (paylaşılan dosya → ayrı onay). |
| D-2 | Küçük | `RedistributeControls.tsx:48` | `aria-label` rolsüz `<div>` üzerinde; ekran okuyucu okumaz. | `role="group"` ekle. |
| D-3 | Küçük | `RedistributeControls.tsx:57` | Masaüstünde seçim yokken düğme "Seçili 0 kaydı yeniden gönder" yazıyor; eski "(n/100)" sınır bilgisi kalktı, 100 sınırı yalnız hata olarak öğreniliyor. | 0'da "Seçilileri yeniden gönder"; sınırı "(n/100)" ya da yardımcı metinle göster. |
| D-4 | Küçük | `StatusPage.tsx:171` | Kapsam kontrolü yok: filtre cihazı listeden çıkarsa `expanded` açık kalır (spec "kapsamdaysa"). Test yalnız state'e bakıyor. | Cihaz seçeneklerinde/satırda yoksa kapat; ya da kabul edip belgele. |
| D-5 | Küçük | `RedistributeControls.tsx:139`, `StatusCounters.tsx:17`, `StatusResults.tsx:97`, `model.ts:54,51` | "kişi×cihaz" gitti ama "kişi–cihaz kaydı" jargonu hâlâ çok yerde. Backend hata metni (`accessGrantStatus.ts:231`) hâlâ "kişi×cihaz" ve kullanıcıya düşebilir (backend bu dalgada değişmez). | "yetki kaydı (kişi + cihaz)" gibi sadeleştir; backend metni sonraki dalgaya not. |
| D-6 | Küçük | testler | StatusPage'in kendisi (mobil "Filtreler" paneli açılıp kapanması, `devices.manage` ile sayfa bağı, odak sheet kapanışında gerçek tetikleyiciyle) test edilmiyor; yalnız bileşen parçaları. | Sayfa düzeyinde bir test ya da Orca turu. |
| C1-3 | Küçük | `DoorPlanImpactSummary.tsx:34-36` | Boş haftalıkta "Zaman aralığı yok; Cmt–Paz normal çalışır" çıkar (anlamsız); yalnız Pazar boşsa hafta sonu notu hiç çıkmaz; "Her gün aynı" planda hafta sonu notu yok. | Hafta tamamen boşsa yalnız "Zaman aralığı yok"; tek hafta sonu günü boşsa onu adlandır. |
| C1-4 | Küçük | `DoorVerifyPlanSection.tsx:41`, `DoorPlanDialog.tsx:~213` | Kapalı planın alanları gizli ama doğrulama (`normalizeVerifyPlan`/`normalizeDoorStatusPlan`) `changed` ise hâlâ koşuyor; geçersiz saatle kapatılan plan hata verir, hata kutusu gizli bölümde, odak hedefi (`#verify-plan`) DOM'da yok. | Kapalı planda alan doğrulamasını atla (payload davranışı değişmeden) ya da hata özetinde "planı açıp düzeltin" yaz; test ekle. |
| C1-5 | Küçük | `DoorPlanDialog.test.tsx` (04-O7) | "Mobil yapışkan/44px" testi yalnız sınıf adı arıyor; davranışı sınamıyor. Sticky `-bottom-4` padding'e (`p-4`) bağımlı, sessizce kayar. | Kabul edilebilir; Orca ile elle doğrula, sınıf eşleşmesini tek sabite çıkar. |
| C2-1 | Küçük | `CopyDoorPlansDialog.tsx:260` | `aria-label` rolsüz `<div>`'de; ham `<input type=checkbox>` (tasarım sistemindeki `Checkbox` değil). | `<fieldset><legend>` ya da `role="group"`; `Checkbox` bileşeni. |
| C2-2 | Küçük | `CopyDoorPlansDialog.tsx:38-60` | Kaynak planı kapalıysa özet "Plan etkin değil" der ama kopya yine gönderilir (hedefte planı kapatır); kullanıcı bunu önizlemeden anlamaz. | "Kapalı olarak kopyalanır" yaz. |
| C2-3 | Küçük | `DoorPlansTab.tsx:126` | Tablo `display:block` yapılınca mobilde tablo/satır/hücre rolleri düşer ve başlıklar `hidden`; ekran okuyucuda ilişki kaybolur. Diff'in büyük kısmı yalnız prettier yeniden biçimlendirmesi (gürültü; `DoorStatusPlanSection`, `schedule` vs. de). | Mobil için ayrı kart listesi ya da `role="table/row/cell"` ekle; biçim değişikliklerini ayrı commit'e al. |
| B-1 | Küçük | `schedule.ts:54` | Başlangıç = bitiş olunca aynı hata iki alanda iki kez `role="alert"` olarak çıkar. | Hatayı yalnız bitiş alanına bağla. |
| A-1 | Küçük | `UnifiedAccessControl.tsx:65` | Kaydırılabilir sekme şeridinde seçili sekme görünür alana kaydırılmıyor, kaydırma ipucu yok (390px'te 4 sekme sığmayabilir). | Seçiliyi `scrollIntoView` ile getir ya da kenar solması ekle. |

## Test kalitesi
- Çoğu yeni test `vi.mock("react")` ile `useState`'i çağrı sırasına göre taklit ediyor (RuleRow, CopyDoorPlansDialog, StatusInteractions); hook sırası değişince test yanlış nedenle kırılır, davranışı gerçek tarayıcı gibi sınamaz. Etkileşim (tıklama → state → çıktı) en çok C2 ve D'de var, iyi; A2 testi `RulesFilters`'ı fonksiyon gibi çağırıp ağaç geziyor (kırılgan ama anlamlı).
- Davranışı gerçekten sınayanlar: 25:00 aria bağı (B), yalnız-doğrulama kopyası (C2, status mock'u çağrılmıyor), `devices.manage` yetkisiz send engeli (D), Hafta içi payload'u (C1).
- Eksik: C1-1 (çok aralıklı haftalık), D sayfa düzeyi, mobil görsel.

## Regresyon kontrolü
Kaydet ve cihaza gönder / etki özeti / tekrar gönder / GK-1 / TemplatePicker boş durumu / rozet=filtre=sayaç + `aria-pressed` / Proje özeti metinleri: mevcut testler yeşil, ilgili kod değişmemiş. C1 kapalı plan gizleme payload'u değiştirmiyor (state korunuyor, yalnız render koşullu); RulesFilters'ın cead1059 SelectTrigger sınıfları korunmuş.

## Önerilen sıra
1. C1-1 (veri kaybı) + testi.
2. Orca'da 390px ve masaüstü ekran görüntüsü: C1-2 ve D-1 görsel doğrulama.
3. Küçükleri tek pakette.
