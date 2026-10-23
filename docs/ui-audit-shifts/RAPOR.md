# Vardiyalar (/shifts) UI audit + plan — 2026-10-23

Takvim, ekranın altında kalıyor. Laptopta (1231×775) tablo y=748'de başlıyor, telefonda (390×844) ajanda y=949'da, yani ekranın dışında. Üstte 7 ayrı satır var: başlık, 3 düğme ve bir not, sayaçlar, arama, gezinme, tarih yazısı, ipuçları. Diğer sayfalarda yaptığımız sadeleştirme buraya uygulanmadı: proje adı tekrar ediyor, sayaç satırı duruyor, dışa aktarma düğmeleri açıkta, "İşlemler" menüsü yok.
**1 Y / 12 O / 6 D, toplam 19 bulgu.** Backend değişikliği yok (yalnız vardiya rengi kararı "evet" olursa var).

## Plan (checklist)

### Faz 1: Başlık ve araç çubuğu (~1 sa, yalnız web)
- [x] V-O1 Başlık altındaki "NGS · Çalışma planı" kalkacak
- [x] V-O2 "İşlemler" menüsü: Dışa aktar › Excel / CSV (görünen sayfa ve dönem) + Toplu temizle. PDKS Kayıtları'ndaki kalıp kullanılacak.
- [x] V-O3 "Görünen çalışan · Proje genelinde aktif tanım" sayaç satırı kalkacak
- [x] V-Y1 + V-O10 Gezinme, dönem, arama ve filtre tek satıra toplanacak: `‹ Bugün ›  19–25 Ekim 2026  [Hafta|Ay]  ···  [Çalışan ara] [Tüm vardiyalar]`. Dönem seçimi PDKS'teki gibi düğme grubu olacak, tarih seçici aralık yazısına tıklayınca açılacak.

### Faz 2: Takvim ızgarası (~2 sa, yalnız web)
- [x] V-O4 Hafta görünümü 1231 px'e kaydırmasız sığacak (çalışan sütunu 216→~176, gün sütunu 112→~96; ad altındaki e-posta satırı kalkacak)
- [x] V-O5 Boş hücreler boş kalacak; "Atama yok" yazısı 14 kez tekrarlanmayacak. Yöneticiye üstüne gelince "+" görünecek. Bugün sütunu vurgulu, hafta sonu ve tatil sütunu hafif tonlu olacak.
- [x] V-O6 Yönetici boş hücreye tıklayınca atama formu doğrudan açılacak (kişi ve tarih dolu gelecek). Dolu hücre ayrıntı penceresini açacak. Penceredeki açıklama yazısı kapat düğmesinin altına giriyor, düzeltilecek.
- [x] V-O11 Başlık satırına "tümünü seç" kutusu eklenecek
- [x] V-O12 Ay görünümünde hücre yalnız saat aralığını tek satırda gösterecek

### Faz 3: Boş durum, tanımlar alt sayfası, renk (~2-3 sa)
- [x] V-O7 Tanım yokken tek bir boş durum gösterilecek (bugün 3 mesaj ve aynı yere giden 3 düğme var)
- [x] V-O8 Tanım panelindeki "…Ayarlar'da yönetilir" yazısı eskimiş. Yerine PDKS Kayıtları › Ayarlar bağlantısı konacak.
- [x] V-O9 Tanımlar alt sayfası `/shifts/definitions`: tablo (ad, tür, saat, mola, atama sayısı, durum) + satır tıkla düzenle, Sabit/Esnek iki düğmeli seçim; yan panel kalkacak
- [x] V-D2 `shifts.color` (opsiyonel) + formda renk seçici + hücrede sol kenar çizgisi (Convex → web)

### Faz 4: Kapılar ve doğrulama (~30 dk)
- [x] `tsc` 0 · `eslint src` · `npx vitest run --exclude "src/components/public/**"`
- [x] Orca'da masaüstü (hafta/ay) ve mobil tur. NGS'e test tanımı + 1 haftalık atama eklenecek, tur bitince silinecek (onaylı).
- [ ] Commit ve yayın CEO'da/Emre onayıyla. Sıra ZORUNLU: önce Convex (`shifts.color` + esnek tanımda ad/renk/aktiflik güncellemesi), sonra web.

## Uygulama durumu (2026-10-23 ~15:00)
- Codex A (araç çubuğu), B (ızgara), C (tanımlar alt sayfası + renk) bitti; Claude denetimi `review.md`: 0 Engel / 4 Önemli / 6 Düşük. 4 Önemli + Düşük 3/5 koordinatörde düzeltildi (renk yalnız değişince gönderilir, tüm tanımlar pasifken takvim görünür + uyarı, esnek tanımda ad/renk/aktiflik yerinde güncellenir, yetkisizde seçim kutusu yok, ay görünümü 10px + aria-label'da vardiya adı).
- Görsel turda ek: ay görünümü açılışta bugüne kayar, saat taşması giderildi, araç çubuğu aralığı, renk seçici tek satır, "Mesai etkin" açıklaması kutuya bağlı, atama önizlemesinden sonra "Önizlenen kişilere uygula" görünür alana kayar (V-O13).
- Kapılar: tsc app+convex 0, eslint 0 (25 dosya), vitest 352 dosya / 3944 test.
- Tarayıcı: masaüstü takvim y=239 (önce 748), yatay kaydırma yok; mobil ajanda y=292 (önce 949). Test tanımı + 2 kişiye 19–23 Ekim ataması UI'dan eklendi, doğrulandı, UI'dan silindi (DB'de 0 kayıt).
- Açık (Düşük, ayrı iş): `ShiftListSidebar.tsx` adı artık tablo (yeniden adlandırma), seçim durumu yardımcısı 3 kopya (`selectionState`), renk canlıda Convex yayınından sonra doğrulanacak.

## Kapsam ve sınırlar
- Mevcut çalışma ağacı (HEAD bb7d942a) incelendi. Girişli localhost:8081'de kendi Orca sekmem açıldı ve iş bitince kapatıldı. Emre'nin sekmesine dokunulmadı. Kayıt, atama ya da silme yapılmadı.
- NGS projesinde **0 vardiya tanımı ve 2 çalışan** var. Canlıdaki tek tanım ("NGS", 08:30–18:00) başka projede. Bu yüzden dolu hücre, çakışma, izin ve tatil rozetleri ile atama önizlemesi tarayıcıda görülemedi; yalnız koddan okundu.
- Ekran görüntüleri müşteri e-postası içerdiği için repoya konmadı: `/tmp/shifts-audit/{d-0,d-1,d-daydetail,d-sheet,d-defform,m-0}.png`.

## Bulgular

| ID | Önem | Ne görülüyor | Öneri | Kanıt |
|---|---|---|---|---|
| V-Y1 | Yüksek | Takvim ilk ekranda görünmüyor: masaüstünde tablo y=748'de (ekran 775), mobilde ajanda y=949'da (ekran 844). Öncesinde 7 kontrol/metin satırı var. | Faz 1'deki tek araç çubuğu ve O1–O3 ile takvim ~y=250'ye çıkar. | `d-0.png`, `m-0.png`; `ShiftCalendarPlan.tsx:131-174` |
| V-O1 | Orta | Başlık altında "NGS · Çalışma planı" yazıyor; üst çubuk zaten "NGS" gösteriyor. Kişiler'de bu tekrar kaldırılmıştı. | `scope` kaldırılacak. | `CalendarHeader.tsx:13` |
| V-O2 | Orta | "Toplu temizle", "Excel'e aktar", "CSV'ye aktar" ve not ayrı bir satırda duruyor; mobilde 2 satır kaplıyor. | PDKS'teki gibi "İşlemler" menüsü: Dışa aktar alt menüsü + Toplu temizle. | `ShiftCalendarPlan.tsx:134-139` |
| V-O3 | Orta | "Görünen çalışan 2 · Proje genelinde aktif tanım 0" satırı alttaki "1–2 / 2 çalışan" bilgisini tekrarlıyor. | Kaldırılacak (Kişiler'de de kaldırıldı). | `ShiftCalendarPlan.tsx:141-146` |
| V-O4 | Orta | Hafta görünümü 1231 px'te sığmıyor: tablo 1000 px, alan 934 px. Pazar sütunu kesik, yatay kaydırma ve "takvimi yatay kaydırın" ipucu çıkıyor. | Sütunlar daraltılacak, e-posta satırı kalkacak (gerekirse `title`'da kalır). | `d-1.png`; `ShiftCalendarGrid.tsx:51` |
| V-O5 | Orta | Her boş hücrede "Atama yok" yazıyor. Bugün yalnız başlıkta "Bugün" yazısıyla belli (iki satıra kırılıyor). Hafta sonu ayırt edilmiyor. | Boş hücre boş kalacak. Bugün sütunu tonlu olacak, hafta sonu ve tatil sütunu hafif gri. | `d-1.png`; `ShiftCalendarCell.tsx:42-44`, `ShiftCalendarGrid.tsx:63-74` |
| V-O6 | Orta | Boş hücreye tıklayınca içinde yalnız "Atama yok" ve "Bu tarihe vardiya ata" olan bir pencere açılıyor; atamaya 2 tıkta ulaşılıyor. Açıklama yazısı kapat (×) düğmesinin altına giriyor. | Yöneticide boş hücre doğrudan atama formunu açacak. Açıklamaya `pr-8` eklenecek. | `d-daydetail.png`; `ShiftDayDetails.tsx:50-57,83-88` |
| V-O7 | Orta | Tanım yokken aynı yere giden 3 düğme var ("Önce vardiya tanımla", "Vardiya tanımları", "Tanımları aç"). Ayrıca "Bu dönemde atama yok." yazısı ve her hücresi "Atama yok" olan bir takvim görünüyor. | Tek boş durum gösterilecek ("Önce vardiya tanımlayın" + tek düğme). Takvim ve filtreler gizlenecek. | `d-0.png`; `CalendarHeader.tsx:14-20`, `ShiftCalendarPlan.tsx:186-197,226-230` |
| V-O8 | Orta | Tanım paneli "genel mesai ve tatil politikaları Ayarlar'da yönetilir" diyor. Bunlar artık PDKS Kayıtları › Ayarlar'da (`/pdks-records/settings`). | Metin düzeltilecek ve bağlantı verilecek. | `d-sheet.png`; `ShiftListSidebar.tsx:63-66` |
| V-O9 | Orta | "Yeni vardiya tanımla" formu panelin üstünde ikinci katman olarak açılıyor ve arka plan iki kez kararıyor. "Vardiya türü" tarayıcının kendi `<select>` kutusu (Sabit/Esnek). | Karar: alt sayfa `/shifts/definitions` mı, panel içi form mu? Türü iki düğmeli seçime çevir. | `d-defform.png`; `AddShiftDialog.tsx:239-244` |
| V-O10 | Orta | Etiketler tutarsız: "Çalışan ara" kalın ve büyük, "Vardiya", "Tarih", "Dönem" küçük. Gezinme ayrı satırda, tarih aralığı ayrı bir satırda tekrar yazıyor ("19 Ekim 2026 Pzt – 25 Ekim 2026 Paz"). | Tek araç çubuğu; aralık kısa yazılacak ("19–25 Ekim 2026"). Önceki/Sonraki ok ikonlu olacak, `aria-label` korunacak. | `d-0.png`; `CalendarNavigation.tsx`, `FilterBar` |
| V-O11 | Orta | Toplu atama için "tümünü seç" yok; 50 kişiye atamak 50 tık. | Başlık hücresine üç durumlu "tümünü seç" kutusu eklenecek. | `ShiftCalendarGrid.tsx:58-64` |
| V-O12 | Orta | Ay görünümü 31 × 92 px = ~3070 px genişliğinde, hücreler hafta görünümüyle aynı yükseklikte. | Ayda kompakt hücre (yalnız saat ya da kısa ad), satır yüksekliği düşük. | `ShiftCalendarGrid.tsx:51` |
| V-D1 | Düşük | "Diğer günler için takvimi yatay kaydırın." ipucu hafta görünümünde de çıkıyor. | O4'ten sonra yalnız ayda ve mobilde kalır. | `ShiftCalendarGrid.tsx:39-41` |
| V-D2 | Düşük | Vardiyalar renksiz; dolu bir haftada "Gündüz" ve "Gece" ancak yazı okunarak ayrılıyor. | Karar: tanıma renk alanı (6–8 sakin ton, hücrede sol kenar çizgisi) ya da nötr kalsın. | `ShiftCalendarCell.tsx:27-36` |
| V-D3 | Düşük | Gün penceresindeki "Bu tarihe vardiya ata" düğmesi tam genişlikte; diğer pencerelerde düğmeler sağa hizalı. | O6 ile birlikte pencere alt düğmeleri sağa alınacak. | `d-daydetail.png` |
| V-D4 | Düşük | Tanım formunda "Mesai etkin" ile açıklaması arasında büyük boşluk var (`min-h-11` kuralı yüzünden). | Açıklama `aria-describedby` ile kutunun hemen altına. | `d-defform.png`; `AddShiftDialog.tsx:281-292` |
| V-D5 | Düşük | Mobilde başlık düğmeleri 2 satıra kırılıyor ("Vardiya tanımları" + "Önce vardiya tanımla"). | O2'den sonra "İşlemler" + ana düğme tek satıra sığar. | `m-0.png` |
| V-D6 | Düşük | Alt çubukta "· İstanbul saati" notu sayfalama özetine yapışık. | Notu aralık yazısının yanına taşı (ör. "19–25 Ekim 2026 · İstanbul"). | `d-1.png` |

## Eski audit'ten (docs/ui-audit-2/09-vardiyalar.md) durum
Kapandı: O1 ("Önce vardiya tanımla" etiketi), O3 (ISO tarih → `shortDate`), O4 ("+1 gün", `shiftTimeLabel`), O5 ("Düzenlemeye dön"), O6 (tek `definitionImpacts` sorgusu), D1 ("Gün 7" kutusu), D4 (`accent-primary`), D10 (`shortDayLabel`).
Açık: O2 (V-O7 olarak burada), D5 (`AddShiftDialog` türü hâlâ yerel select, V-O9), O7 (50 kişi × 5000 satır sınırı, atama sayısı artınca ölçülecek).

## Hedef görünüm (masaüstü)
```
Vardiyalar                                   [İşlemler ▾] [Vardiya tanımları] [Vardiya ata]
[‹] [Bugün] [›]  19–25 Ekim 2026   [Hafta|Ay]            [🔍 Çalışan ara] [Tüm vardiyalar ▾]
┌───────────────┬────────┬────────┬────────┬────────┬▓Cum 23▓┬░Cmt 24░┬░Paz 25░┐
│☐ Çalışan      │ Pzt 19 │ Sal 20 │ Çar 21 │ Per 22 │▓bugün ▓│░      ░│░      ░│
├───────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│☐ Emre Aydın   │▌Gündüz │▌Gündüz │        │▌Gece   │   +    │        │        │
│               │08:30–18│08:30–18│        │22–06+1 │        │        │        │
└───────────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
2 çalışan                                                         ‹ 1 / 1 ›
```

## Kararlar (Emre)
2026-10-23:
- **Tanımlar alt sayfaya taşınacak:** `/shifts/definitions` (PDKS Ayarlar kalıbı, başlıktaki "Vardiya tanımları" düğmesiyle açılır). Tablo + satır tıkla düzenle. Yan panel kalkacak. → V-O9
- **Tanıma renk alanı eklenecek:** 6–8 sakin ton, hücrede sol kenar çizgisi. Şema değişikliği (`shifts.color` opsiyonel) var, yayın sırası önce Convex sonra web. Çalışma ağacında başka oturumların `convex/schema.ts` değişikliği var; Convex yayını temiz export'tan ya da CEO paketiyle yapılacak. → V-D2
- **Boş hücre (yönetici) atama formunu doğrudan açacak.** Dolu hücre ayrıntıyı açacak. → V-O6
- **Test verisi:** NGS projesine 1 test tanımı ve 2 kişiye 1 haftalık atama eklenecek, doğrulamadan sonra silinecek (Emre onayı).
