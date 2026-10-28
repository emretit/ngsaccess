# Vardiya Paket C1 — atama arayüzü: departman, döngü, günde çok vardiya (Codex K3)

## Hedef (test edilebilir)
Vardiya atama diyaloğundan kişi VEYA departmana; haftalık (günde 1-8 vardiya) / gün döngüsü / hafta döngüsü planı atanabilir; takvim hücresi kaynağı
(kişi/departman/varsayılan/boş gün/çoklu) gösterir; plan sheet'te departman atamaları listelenir/düzenlenir/silinir. Mevcut kişi-tek-vardiya akışı aynen çalışır.

## Önce oku (zorunlu)
1. `.claude/design/vardiya-model.md` — OTORİTER sentez; §5.3 public API (Paket A yazdı, tüket; değiştirme).
2. `.claude/design/vardiya-model-claude.md` §4.1 (diyalog 3 adım), §4.2 (takvim hücresi tablosu, `planCells`), §7 "Arayüz (C)".
3. Paket A çıktısı: `convex/shifts.ts` (`plan?`, `includePlans`), `convex/shiftPlans.ts` (departman CRUD/önizleme/`planCells`), `convex/lib/shiftPlan.ts` (sabitler, `ShiftPlan`).
4. Proje kuralları `CLAUDE.md`: Convex sonuçları `FunctionReturnType<typeof api.X.Y>`, formlar `z.infer`, `any`/`!` yok.

## Yapılacaklar
1. `AssignShiftDialog.tsx` + `assignmentFormSchema.ts`: (1) Kime `[Kişiler | Departman]` — departman ağacından tek seçim + "Alt departmanlar da alır · N kişi · M kişide
   kişisel atama öncelikli" (`previewDepartmentAssign`); (2) Desen `[Haftalık | Gün döngüsü | Hafta döngüsü]` — haftalıkta `WeekdaySelection` + "Günün vardiyaları"
   (1..8, "+ Vardiya ekle", 30 dk ara/çakışma uyarısı satır altında); gün döngüsü 1–31 + hızlı kurucu `[Vardiya ▾] × [2] gün` / `[Boş] × [2] gün` + slot şeridi +
   örnek düğme "2 sabah · 2 akşam · 2 boş"; hafta döngüsü 1–52 hafta × 7 gün ızgara; hepsinde başlangıçtan 14 günlük renkli önizleme şeridi;
   (3) Önizleme: kişide bugünkü karar listesi, departmanda özet + aynı departman çakışmasında onay (`forceConfirm`). İstemci doğrulaması sunucu sabitleriyle aynı
   (≤8, ≥30 dk, döngü sınırları); asıl doğrulama sunucuda — ConvexError mesajını göster.
   Yeni bileşenler: `RotationEditor.tsx`, `DayShiftsPicker.tsx`, `DepartmentTargetPicker.tsx` (src/components/shifts/ altında).
2. Takvim (`calendar/**`, `ShiftCalendarCell.tsx`, `ShiftCalendarGrid.tsx`, `ShiftDayDetails.tsx`, `lib/**`): hücre verisi `api.shiftPlans.planCells`'ten (istemci kendi
   çözümleyicisini YAZMAZ); Claude §4.2 tablosundaki görünümler (departmandan = kesikli kenar + tooltip "Departmandan: X"; varsayılan = soluk; boş gün = gri tarama "Boş";
   çoklu = ilk 2 çip + "+N"). Hücre tıklama kaynağa göre kişi atamasını ya da departman atamasını açar; departmanda "Bu kişi için değiştir" = kişi ataması.
   `listAssignments` çağrılarına `includePlans: true` (yeni web plan satırlarını görür).
3. `AssignmentEditDialog.tsx`: plan'lı satırı düzenleyebilir (desen + günün vardiyaları); plan yoksa bugünkü form.
4. `ShiftPlanSheet.tsx`: "Departman atamaları" bölümü (departman, desen özeti, tarih aralığı, düzenle/sil) — `listDepartmentAssignments`, `removeDepartmentAssignment`.
5. `src/components/employees/EmployeeFormFields.tsx`: departman değiştirilince tek satır uyarı "Departman vardiya planı geçmiş günlere de uygulanır; kapanmış dönem için
   kişiye vardiya atayın." (yalnız mevcut çalışanda ve departman gerçekten değiştiğinde).

## Kapsam dışı (DOKUNMA)
`convex/**` (A bitti, B paralel çalışıyor; API'de eksik/hata bulursan DÜZELTME, `ask` ile koordinatöre sor) · `src/components/pdks/**` (PDKS hücre/gün detayı
segment gösterimi B'nin DTO'suna bağlı → ayrı takip işi C2) · `src/components/shifts/definitions/**` · `mobile/**` · yayın.

## Ownership
`src/components/shifts/**` (definitions hariç), `src/components/employees/EmployeeFormFields.tsx` (yalnız uyarı), ilgili `src/hooks/*` (yalnız vardiya atamasına ait
olanlar), bunların testleri (yeni test dosyaları serbest).

## Kurallar
- Mevcut A2 arayüz dilini ve bileşenlerini kullan (shadcn, mevcut renk/çip stilleri, `src/lib/tableRowClick.ts` deseni); yeni tema/renk paleti yok. Türkçe, kısa metin.
- Erişilebilirlik: segment kontroller klavyeyle, ızgara hücrelerinde aria-label (tarih + vardiya/Boş).
- TypeScript strict; `any` / `as any` / `!` YOK.
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`** — commit'i koordinatör atar.
- **YASAK: `npx convex` (dev/deploy/codegen/run dahil)**. DB yazma YOK. Dev server açma (Orca turunu koordinatör yapar). Yayın YOK.

## Kapılar (hepsi yeşil olmadan worker_done gönderme)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
```
Yeni testler (en az): döngü kurucusu slot üretimi ("2S·2A·2B" → 6 slot), hafta döngüsü ızgarası 7N slot, günün vardiyaları 9. ekleme engeli + 29 dk ara uyarısı,
14 gün önizleme, departman önizleme özeti, takvim hücresi 5 görünüm (kişi/departman/varsayılan/boş/çoklu), `includePlans: true` gönderimi, mevcut kişi-tek-vardiya
atama payload'ı DEĞİŞMEDİ (snapshot), departman değişikliği uyarısı.

## Paralel çalışma notu
Paket B (hesap motoru, yalnız convex/**) aynı anda başka bir worker'da çalışıyor (ownership ayrık). Kapılarda yalnız ONUN dosyalarından gelen geçici tsc/test hatası görürsen
DÜZELTME; kendi dosyalarının temiz olduğunu göster (ör. ilgili test dosyalarını ayrıca koş) ve `ask` ile koordinatöre bildir.
Paket A + düzeltmesi çalışma ağacında, COMMIT EDİLMEDİ (normal) — A dosyalarını değiştirme.

## A API notu (denetim sonrası)
- Saklı planı olan satırda `plan` göndermeden `shiftId` değiştirmek ConvexError verir → planlı satırda vardiya değişikliği daima `plan` ile gönderilir;
  tek vardiyaya dönüş = `plan: { kind: "weekly", shiftIds: [x] }`.
- Departman atamaları audit'e yazılıyor; yeni bir şey yapman gerekmez.

## Rapor
`worker_done` ≤10 satır: değişen/yeni dosyalar (file:line), kapı sonuçları (test sayısı), A API'sinde gördüğün eksik (varsa), açık sorular.
