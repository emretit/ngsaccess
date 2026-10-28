# Vardiya Paket C1 — denetim raporu (Claude, salt okuma)

**Özet:** Engel yok. Eski kişi-tek-vardiya akışı payload düzeyinde korunmuş, API §5.3'e uygun kullanılmış (`plan`, `includePlans: true`, `planCells`), `any`/`!` yok, ownership dışı dosya değişmemiş. Kapılar: `tsc -p tsconfig.app.json` temiz, `vitest run src` 188 dosya / 1215 test yeşil. Dışa aktarma başlığındaki gerileme ve departman seçicinin hata anında kaybolması gerçek bulgular; gerisi küçük.

## Engel
Yok.

## Önemli
1. **Vardiya dışa aktarma başlığı değişti.** [ShiftCalendarPlan.tsx](../src/components/shifts/calendar/ShiftCalendarPlan.tsx) `exportPlan`: eski `shiftExportRows` başlığı `19.10 Pzt` idi; yeni satır başlığı ham ISO (`2026-10-19`). Ayrıca [shiftExport.ts](../src/lib/shiftExport.ts) artık üretimde kullanılmıyor (yalnız kendi testi) ve ona dokunulmamış. Düzeltme: `shiftExportRows`'u çözülmüş hücre (`getData`) alacak şekilde genişlet veya başlığı eski biçimde üret (`dd.mm Kısa gün`); ölü kalacaksa sil.
2. **Departman seçici sunucu hatasında kayboluyor.** [AssignShiftDialog.tsx](../src/components/shifts/AssignShiftDialog.tsx) `PlanQueryBoundary` hem `DepartmentTargetPicker`'ı (select + canlı özet) sarıyor. `DepartmentLiveSummary` ConvexError fırlatırsa (ör. geçersiz plan) select de yerini hata + "Yeniden dene"ye bırakıyor; `resetKey` yalnız `values` değişince sıfırlandığı için kullanıcı departmanı değiştiremez. Düzeltme: boundary'yi yalnız `DepartmentLiveSummary`'ye daralt, select dışarıda kalsın.
3. **Pasif vardiyalı eski satırı düzenlemek artık engelleniyor ama seçenekte duruyor.** [AssignmentEditDialog.tsx](../src/components/shifts/AssignmentEditDialog.tsx) seçeneklerde mevcut pasif vardiyayı bilerek gösteriyor; yeni `planFormError` → `validateShiftPlan` "Pasif vardiya atanamaz" ile reddediyor (eski sunucuda bu kontrol yoktu). Kullanıcı yalnız tarih değiştirmek istese bile kaydedemez. Düzeltme: koordinatörle karar al — ya `planFormError`'da yalnız değişen vardiya için pasiflik kontrolü, ya da sunucu A davranışı bilinçliyse diyalogda "Bu vardiya pasif; başka vardiya seçin" notu.

## Düşük
1. [RotationEditor.tsx](../src/components/shifts/RotationEditor.tsx) ızgara: hafta döngüsünde 364 ayrı Tab durağı. Düzeltme: roving tabindex + ok tuşları (veya yalnız seçili hücre `tabIndex=0`).
2. [ShiftCalendarCell.tsx](../src/components/shifts/ShiftCalendarCell.tsx) aria-label: boş gün + kişi kaynağında `"Boş, , ayrıntıları aç"` (çift virgül). Düzeltme: parçaları `filter(Boolean).join(", ")` ile birleştir.
3. [ShiftCalendarCell.tsx](../src/components/shifts/ShiftCalendarCell.tsx) varsayılan kaynakta tüm hücreye `opacity-50`: soluk metin kontrastı WCAG 1.4.3 altına inebilir. Düzeltme: yalnız çipleri/rozeti soluklaştır veya `text-muted-foreground` kullan, hücrenin opaklığını düşürme.
4. [ShiftCalendarCell.tsx](../src/components/shifts/ShiftCalendarCell.tsx): `resolved` varken `compact` hücrede de limit 2 (önceden 1); `min-h-10` aylık hücrede taşabilir. Orca turunda aylık görünümde bak; taşarsa compact'ta 1 çip + "+N".
5. [shiftCalendarModel.ts](../src/components/shifts/calendar/shiftCalendarModel.ts) `resolvedCalendarDay` çakışma işareti: `scheduleIntervals` yalnız satırın `shiftId`'sine (ilk vardiya) bakıyor; çok vardiyalı/döngü planlı kişisel satırlarda çakışma kaçar. Düzeltme: `planShiftIds(row.plan)` üzerinden dön veya işareti planlı satırlar için sunucu kararına bırak (not düş).
6. [useShiftCalendarData.ts](../src/components/shifts/calendar/useShiftCalendarData.ts): `shiftFilter` artık kullanılmıyor ama parametre tipinde duruyor; filtre istemcide `getData` içinde. Parametreyi kaldır.
7. [RotationEditor.tsx](../src/components/shifts/RotationEditor.tsx) uzunluk girdisi: alanı silince `|| 1` yüzünden anında 1'e dönüyor ("12" yazmak için önce "1" kalıyor). Düzeltme: yerel string state, `onBlur`'da kıs.
8. [AssignmentPatternEditor.tsx](../src/components/shifts/AssignmentPatternEditor.tsx) / [assignmentFormSchema.ts](../src/components/shifts/assignmentFormSchema.ts): tüm slotları boş döngüde mesaj "Vardiya seçin" (`shiftId` min(1)); sunucu mesajı "Döngüde en az bir dolu gün olmalıdır". Düzeltme: `plan` varken `shiftId` kuralını atla veya mesajı eşitle.
9. Odak yönetimi: 3 adım tek kaydırmalı form; `Önizle` sonrası yalnız `scrollIntoView` var, `planFormError` dalında `aria-invalid` odağı yok (sadece `role="alert"`). Düzeltme: plan hatasında hata paragrafına odak ver.
10. [EmployeeFormFields.tsx](../src/components/employees/EmployeeFormFields.tsx) `DepartmentShiftWarning`: `useState(formData.departmentId)` ilk mount'taki değeri "özgün" sayıyor. Taslak (`draft`) önbelleğinden yeniden açılışta değişmiş departman "özgün" olur, uyarı gelmez. Düzeltme: özgün değeri `employee?.departmentId` prop'undan al.
11. Test boşlukları ([assignmentPlans.test.tsx](../src/components/shifts/assignmentPlans.test.tsx)): snapshot `bulkAssignmentRequest` yardımcısında (diyalog onu çağırdığı için geçerli) ama eski `updateAssignment` payload'ı (plan anahtarı yok) ve `assignDepartment` payload'ı test edilmemiş; çok bileşen mock'lı. Spec'teki "kişide bugünkü karar listesi" önizlemesi bu pakette eklenmemiş (PreviewPanel yalnız başlık değişti) — kasıtlıysa koordinatör onaylasın.
12. `calendarDayResolver` üretimde kullanılmıyor, yalnız eski testte; "legacy adapter" yorumu var. Ölü kod, sonraki temizlikte silinebilir.
13. 14 günlük önizleme şeridi çok vardiyalı günde yalnız ilk vardiyanın rengini gösteriyor (etiket tam). Kabul edilebilir.

## Kontrol edilenler (sorun yok)
- **Eski akış:** `assignmentFields` plan yokken `plan` anahtarını hiç göndermiyor; `bulkAssignmentRequest` payload'ı eskisiyle aynı (satır içi snapshot var). Mevcut test beklentileri silinmemiş/değiştirilmemiş (testlerde yalnız ekleme: `EmployeeFormFields.test`, `ShiftPlanSheet.test` +1 mock). Eski düzenleme yolu: `weekPattern` ve plan anahtarı davranışı korunmuş.
- **API:** planlı satırda düzenleme daima `plan` ile gidiyor (`storedPlan` → tek vardiyada `weekly` plan); `listAssignments` `includePlans: true`; takvim `planCells` kullanıyor (istemci çözümleyici yok), aralık `rangeStart-1` + ay uzunluğu (≤32 gün, sunucu sınırı 42) ve ≤50 kişi; departman CRUD doğru mutation adlarıyla.
- **Doğrulama:** istemci `validateDayShifts`/`validateShiftPlan`/`validatePlanStructure`'ı sunucu modülünden alıyor (≤8, ≥30 dk, 1–31 gün, 1–52 hafta); sunucu hatası `shiftError`/`shiftMessage` ile kullanıcıya gösteriliyor; yükleniyor durumları `SectionSkeleton`, hata durumu `PlanQueryBoundary` + "Yeniden dene".
- **Erişilebilirlik:** segment kontroller `aria-pressed` + native `Button` (klavye), ızgara/önizleme hücrelerinde tarih + vardiya/Boş aria-label, "Boş" yalnız renkle verilmemiş, hata metinleri `role="alert"`.
- **Tipler:** `FunctionReturnType` (planning.ts), `z.infer` (BulkAssignmentFormValues); yeni dosyalarda `any`/`!` yok; Convex sonuçları `any[]`'e açılmamış.
- **Ownership:** yalnız `src/components/shifts/**` (definitions hariç) ve `EmployeeFormFields` (+testi) değişmiş; `pdks/**`, `definitions/**` dokunulmamış; yeni renk/tema yok (kesik kenar, `bg-subtle`, `--border` degrade — spec'li).

## Worker yanıtı
- Önemli 1: `src/lib/shiftExport.ts:2` çözümlenmiş `getData` alır; `calendar/ShiftCalendarPlan.tsx:90` ortak yardımcıyı kullanır, `19.10 Pzt` başlığı ve eski testler korunur; çoklu/boş satır testi eklendi (`src/lib/shiftExport.test.ts:24`).
- Önemli 2: Sınır yalnız `DepartmentLiveSummary` çevresinde (`src/components/shifts/DepartmentTargetPicker.tsx:24`); hata görünürken seçimin değiştirilebildiği test edildi (`DepartmentTargetPicker.test.tsx:13`).
- Önemli 3: Sunucu değiştirilmedi; seçili pasif vardiya için açıklama ve kapalı Kaydet eylemi var (`src/components/shifts/AssignmentEditDialog.tsx:79`, `:171`, `:241`), aktif/pasif durum testleri geçti.
- Düşük 1: Izgarada tek Tab durağı; oklar, Home/End ve Ctrl+Home/End odak taşır (`src/components/shifts/RotationEditor.tsx:13`); 364 hücrede 1/363 tabindex ve sınır testleri geçti.
- Düşük 2: Hücre aria-label parçaları `filter(Boolean).join(", ")` ile birleştirilir (`src/components/shifts/ShiftCalendarCell.tsx:48`); kişi boş gün etiketinde çift virgül olmadığı test edildi.
- Düşük 3: Opaklık hücre/metin yerine yalnız dekoratif renk çubuğunda (`src/components/shifts/ShiftCalendarCell.tsx:69`); ad, saat, rozet ve odak çerçevesi opak kalır, test eklendi.
- Düşük 4: Değiştirilmedi; aylık iki çip taşma kontrolü koordinatörün Orca turunda.
- Düşük 5: Referans haritası açıkça `planShiftIds(row.plan)` üzerinden kurulur (`src/components/shifts/calendar/shiftCalendarModel.ts:44`); ortak `scheduleIntervals` zaten planın tüm vardiyalarını işler, haftalık/gün döngüsü ikinci vardiya çakışması ve boş gün regresyonları eklendi.
- Düşük 6: Kullanılmayan `shiftFilter` hook parametresi, çağrısı ve test argümanı kaldırıldı (`src/components/shifts/calendar/useShiftCalendarData.ts:13`).
- Düşük 7: Uzunluk ve kurucu gün girdileri yerel string taslağı tutar, yalnız blur'da 1–31/1–52 sınırı uygulanır (`src/components/shifts/RotationEditor.tsx:21`); boşaltma, 12 yazma, üst/alt sınır testleri geçti.
- Düşük 8: `shiftId` boşluk kontrolü yalnız plansız forma uygulanır (`src/components/shifts/assignmentFormSchema.ts:31`); boş döngü tek hata olarak sunucunun “Döngüde en az bir dolu gün olmalıdır” mesajını üretir.
- Düşük 9: Her iki diyalog plan hatası paragrafına ref/tabIndex=-1 ile odak verir (`src/components/shifts/lib/planForm.ts:66`, `AssignShiftDialog.tsx:101`, `AssignmentEditDialog.tsx:101`); odak ve paragraf testi eklendi.
- Düşük 10: Özgün departman `employee?.departmentId` prop'undan gelir (`src/components/employees/EmployeeForm.tsx:187`, `EmployeeFormFields.tsx:195`); değişmiş taslakla yeniden mount ve özgün değere dönüş testi geçti (`EmployeeFormFields.test.tsx:73`).
- Düşük 11: Gerçek edit mutation callback'inin plansız `updateAssignment` payload'ı, üretimde kullanılan `assignDepartment` payload yardımcısı ve planlı `PreviewPanel` karar listesi test edildi (`src/components/shifts/assignmentPlans.test.tsx:198`).
- Düşük 12: `calendarDayResolver` değiştirilmedi; sonraki temizlikte ele alınabilir.
- Düşük 13: Önizlemenin ilk vardiya rengini kullanması değiştirilmedi.
- Son kapılar: `tsc --noEmit -p tsconfig.app.json` PASS; `eslint src` PASS (0 hata/uyarı); `vitest run src` PASS (189 dosya / 1228 test); `git diff --check` PASS; bu turda backend kaynaklı geçici kapı hatası yok.
