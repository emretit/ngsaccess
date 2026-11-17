# GK2-R1 denetimi — BC + D2 (salt okuma)

**Sonuç:** BC (ortak başlık, Kurallar düzeltmeleri) ve D2 (Kapı Planları) kodunda Kritik ve Önemli hata yok; `vitest run src/components/access-control` 27 dosya / 177 test yeşil. Asıl risk test boşluğu ve spec dışı iki küçük kaldırma.
**Sayılar:** Kritik 0 · Önemli 2 · Düşük 3.

| ID | Önem | file:line | Ne yanlış | Hangi durumda bozulur | Öneri |
|---|---|---|---|---|---|
| R1-1 | Önemli | src/components/access-control/unified/components/DepartmentTree.tsx:183-185 (diff: `allIds` + "Projedeki tüm kişileri seç/kaldır" düğmesi silindi) | Spec C5 "yalnız hiza, metin ve mantık DEĞİŞMEZ" diyor; toplu seç düğmesi kalktı. Bu dosyada başka oturum (tek pencere kural formu) değişikliği de olabilir. | Kural formunda 100+ kişiyi seçmek için artık tek tek / departman kutusu gerekir. | Kasıtlıysa plana yaz; değilse geri koy. Emre/koordinatör teyit etsin. |
| R1-2 | Önemli | src/components/access-control/unified/ (yeni hook + UnifiedAccessControl.tsx:57-61) | Başlık hook'u ve context için hiç test yok. status.test.tsx yalnız kaynak metnini arıyor (`toContain('useAccessControlHeader("Yenile", refresh, busy)')`) ve "Yenile" görünmüyor (`not.toContain(">Yenile<")`) diyor. RulesHeader/audit testleri yalnız "h1 yok" diyor. | Başlıkta düğmenin gerçekten çıkması, sekme değişince silinmesi, `canManage` yokken görünmemesi hiçbir testte ölçülmüyor; hook bozulsa test geçer. | `UnifiedAccessControl` için render testi: rules→status→doors geçişinde başlık düğmeleri; hook cleanup. |
| R1-3 | Düşük | src/components/access-control/unified/components/RuleBasicInfo.tsx:36-45 | Spec C4 yalnız "Kural adı" etiketi; "Açıklama ekle" `<details>` sarmalayıcısı da kaldırılmış (açıklama hep görünür). | Form 2 sütunlu grid'de açıklama alanı artık her zaman yer kaplar. Büyük olasılıkla tek pencere formu işi (kapsam dışı). | Diğer oturumun işiyse yok say. |
| R1-4 | Düşük | src/components/access-control/unified/audit.test.tsx:46 | `max-md:[&_button]:min-h-11` sınıf kontrolü silinip `not.toContain("<h1")` ile değişti; mobil dokunma hedefi kapsamı azaldı. | Sınıf elle silinirse yakalanmaz (zaten sınıf testiydi, davranış değil). | Gerek yok; bilgi. |
| R1-5 | Düşük | src/components/access-control/door-plans/DoorPlansTab.tsx:162-166 | Satır tıklaması (hücre → diyalog açar, `details` içi açmaz) ve yeni "Cihazlara git" boş durumu için test yok; DoorPlanDialog.test yalnız diyalog içeriğini ölçüyor. | `details` stopPropagation'ı kalkarsa Plan ayrıntıları açılırken diyalog da açılır, testler geçer. | Küçük bir render/olay testi. |

## Bakılan noktalar (kanıt)
1. **Başlık hook'u:** `useAccessControlHeader.tsx` — `report` (setState) stabil, `onClick` ref'te (`latest`), effect bağımlılığı `[label, disabled, report]` → render döngüsü yok. Cleanup `report(undefined)`; ayrıca düğme `tab === "status" &&` ile koşullu ve StatusPage sekme değişince unmount → eski düğme başlıkta kalmaz. Yetki: durum sekmesi `canManage` olmadan açılmıyor (UnifiedAccessControl.tsx:31-34), Yeni kural/Gönder `canManage && projectId` ile. Proje yokken StatusContent render edilmez → düğme yok.
2. **Sayfalama:** `result && (!result.isDone || cursors.length > 1)` (RulesPage.tsx:97). 2. sayfada `cursors.length>1` → çubuk kalır, geri dönülür; tek sayfa + isDone → gizli. Sorun yok.
3. **Tüm cihazlara gönder:** `disabled={!counts || counts.total === 0 || send.pending}` ve `ConfirmAction` aynen (SyncRuns.tsx:246-250). Test `state.select` ile disabled ve onay→start akışını ölçüyor (davranış testi).
4. **D2:** hücredeki `stopPropagation` kalktı, yalnız `details` üzerinde (DoorPlansTab.tsx:224); `onRowActivate` buton/link/label'ı zaten hariç tutuyor. Klavye: satırda tabIndex yok ama kapı adı `<button>` (aynı diyaloğu açar) → Enter/Space çalışır. `max-md:last:border!` Tailwind v4.2 (`package.json:101`) için geçerli (sondaki `!` important). "Tatil takvimini aç" artık `holiday.enabled` iken hep görünür, `guard.requestClose` korumalı.
5. **Testler:** ProjectSyncButton mock'u `Button`'a geçti, davranış hâlâ ölçülüyor. Kaldırılan test kapsamı: yalnız R1-4.
6. **CLAUDE.md:** değişen dosyalarda `any`, `!` ya da gereksiz tip yok.

## Sorunsuz bulunanlar
- Hook cleanup/render döngüsü, yetki koşulları, sayfalama koşulu
- ProjectSyncButton disabled + onay akışı
- Kapı Planları satır tıklaması / details / klavye yolu
- Tailwind `last:border!` sözdizimi
- Kopya diyalog testine `react-router-dom` mock'u (useNavigate) doğru eklenmiş
