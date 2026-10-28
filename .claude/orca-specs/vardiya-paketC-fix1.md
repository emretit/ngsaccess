# Vardiya Paket C1 — denetim düzeltmesi 1 (aynı worker)

## Hedef
`.claude/review-vardiya-paketC.md` bulguları: Önemli 1-3 + Düşük 1,2,3,5,6,7,8,9,10,11 düzeltilir. Düşük 4 (aylık hücre taşması) koordinatörün Orca turunda bakılacak,
Düşük 12 (ölü `calendarDayResolver`) ve 13 DOKUNULMAZ.

## Kararlar
1. **Önemli-1** dışa aktarma başlığı eski biçime döner (`19.10 Pzt`): `src/lib/shiftExport.ts` `shiftExportRows` çözülmüş hücreleri (planCells/getData) alacak şekilde genişlet ve
   `ShiftCalendarPlan.tsx` `exportPlan` onu kullansın (ölü kod kalmasın). Mevcut `shiftExport` testleri değişmeden geçer + çoklu vardiya/boş gün satırı testi.
2. **Önemli-2** `PlanQueryBoundary` yalnız `DepartmentLiveSummary`'yi sarar; departman select'i hata anında da değiştirilebilir. Test.
3. **Önemli-3** Sunucu davranışı ESKİSİYLE AYNI (pasif vardiyaya atama eskiden de reddediliyordu) → sunucuya dokunma. `AssignmentEditDialog`: mevcut vardiya pasifse
   seçeneğin altında "Bu vardiya pasif; kaydetmek için aktif bir vardiya seçin." notu; kaydet düğmesi pasif vardiya seçiliyken devre dışı. Test.
4. Düşük-1 roving tabindex (seçili/ilk hücre `tabIndex=0`, ok tuşlarıyla gezinme); Düşük-2 aria-label `filter(Boolean).join(", ")`; Düşük-3 opaklık hücreye değil
   yalnız çip/rozete (metin kontrastı korunur); Düşük-5 çakışma işareti `planShiftIds(row.plan)` üzerinden tüm vardiyalar; Düşük-6 kullanılmayan `shiftFilter` parametresi kalkar;
   Düşük-7 uzunluk girdisi yerel string state + `onBlur`'da sınırla; Düşük-8 plan varken mesaj sunucuyla aynı ("Döngüde en az bir dolu gün olmalıdır");
   Düşük-9 plan hatasında hata paragrafına odak; Düşük-10 özgün departman `employee?.departmentId`'den; Düşük-11 testler: eski `updateAssignment` payload'ı (plan anahtarı yok),
   `assignDepartment` payload'ı, kişide mevcut karar listesinin planlı atamada da göründüğü.

## Ownership
Önceki C1 ownership'i + `src/lib/shiftExport.ts` ve testi. `convex/**` (B çalışıyor), `src/components/pdks/**`, `definitions/**`, `mobile/**` DOKUNMA.

## Kurallar
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex`**. Dev server açma. Yayın YOK.
- TypeScript strict; `any` / `as any` / `!` YOK.
- B paralel çalışıyor: convex dosyalarından gelen geçici tsc/test hatasını DÜZELTME, raporda belirt.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint src
node_modules/.bin/vitest run src
```

## Rapor
Her bulguya 1 satır yanıtı `.claude/review-vardiya-paketC.md` sonuna "## Worker yanıtı" olarak ekle. `worker_done` ≤10 satır: file:line + kapı sonuçları.
