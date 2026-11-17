# W3 — Hafta tatili vardiya planından: arayüz

## Hedef (test edilebilir)
Atama formunda gün kutuları her zaman görünür ve Pzt–Cum seçili açılır, seçilmeyen gün her yerde "Hafta tatili"
olarak gösterilir, PDKS Ayarları'ndaki "Çalışma günleri" kartı kalkar; ilgili src vitest testleri geçer.

## Ownership (yalnız bunlar + bunların *.test.ts(x) dosyaları)
- `src/components/shifts/AssignmentPatternEditor.tsx`, `AssignShiftDialog.tsx`, `AssignmentEditDialog.tsx`,
  `ShiftDayDetails.tsx`, `WeekdaySelection.tsx`, `assignmentFormSchema.ts`
- `src/components/shifts/lib/planForm.ts`, `src/components/shifts/lib/calendarOverlays.ts`, `src/components/shifts/lib/planning.ts`
- `src/components/pdks/settings/PdksSettingsPanel.tsx`, `src/components/pdks/settings/WorkingDaysSettings.tsx` (silinecek)
- `src/components/settings/sections/hooks/useGeneralSettings.ts`

## Paralel çalışma notu
W1 aynı anda backend'de `convex/lib/shiftPlan.ts` `slotForDate`'i değiştiriyor: haftalık planda seçilmeyen gün
`null` yerine `[]` (rest) dönecek; haftalık yazımda boş `weekPattern` reddedilecek. Convex dosyalarına DOKUNMA.
UI'ı bu yeni sözleşmeye göre yaz (önizlemede `[]` → "Hafta tatili"; boş pattern gönderme).

## Yapılacaklar (plan "W3" bölümü)
1. Atama formu: "Belirli günler" kutusu ve "Her gün uygulanır" metni kalkar; `WeekdaySelection` hep görünür,
   varsayılan Pzt–Cum (`MON..FRI`). Açıklama: "Seçilmeyen günler hafta tatili sayılır." `specificDays` alanı kalkar,
   `weekPattern` haftalık planda zorunlu (≥1 gün, hata metni "En az bir çalışma günü seçin."). Düzenlemede kayıtlı
   pattern boşsa (eski satır) kutular Pzt–Cum seçili açılır. Kişi + departman ataması aynı payload'ı kullanır.
2. 14 günlük önizleme: seçilmeyen gün "Uygulanmaz"/"Boş" yerine "Hafta tatili".
3. `ShiftDayDetails.tsx`: "Boş gün (döngü)" → "Hafta tatili"; seri özetinde "Her gün" yerine seçili gün adları
   (7 gün seçiliyse "Her gün").
4. `calendarOverlays.ts`: çalışma aralığı (gece kuyruğu dahil) ile takvim sahipliği ayrı fonksiyonlar; çakışma uyarısı
   sahipliği kullanır (aynı kişide tarih aralığı kesişen iki atama uyarı verir).
5. PDKS Ayarları: `WorkingDaysSettings` kartı ve dosyası kalkar; sağ sütunda yalnız Tatil takvimi. Panel üst notuna
   tek cümle: "Hafta tatili günleri vardiya planında seçilir." + `/pdks-records?plan=1` linki ("Vardiya planı").
   Düzen 1b1be4ee commit'indeki kart ızgarası korunur.
6. `useGeneralSettings.ts`: `workingDays` tip alanı kalkar. `src/components/audit/auditLabels.ts` DOKUNULMAZ.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/vitest run src/components/shifts src/components/pdks src/components/settings`
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>`

## Rapor yolu
`/tmp/hafta-tatili-W3-rapor.md`
## Bağlam (önce oku)
- Onaylı plan: `.claude/plan-calisma-gunleri-vardiya.md` ("Tasarım" + kendi W bölümün + "Kabul testleri"). Plan otoritedir.
- Audit raporları: `/tmp/calisma-gunleri-audit-codex.md`, `/tmp/calisma-gunleri-audit-claude.md`.
- Kararlar (Emre): K1 haftalık planda seçilmeyen gün HER ZAMAN hafta tatili (rest), alt atamaya/departmana düşmez.
  K2 tatil gününde okutma varsa hesap atanmış vardiyanın kurallarıyla (mola, FM açık/kapalı, gece, holidayWorkRequired) yapılır.
- Proje kuralları: `CLAUDE.md` (any/as any yasak, `!` yerine erken return, Convex alanları camelCase,
  `filter((p): p is NonNullable<typeof p> => p !== null)`), Convex kodu için önce `convex/_generated/ai/guidelines.md`.
- Aynı çalışma dizininde başka worker'lar paralel çalışıyor: YALNIZ kendi ownership listendeki dosyalara yaz.
  Ownership dışı bir dosyada değişiklik gerekiyorsa yazma, `ask` ile koordinatöre sor.

## Yasaklar
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA.
- `npx convex dev|deploy|run|import|codegen` ÇALIŞTIRMA; DB yazma yok; Supabase/MCP araçlarını KULLANMA.
- Yeni npm paketi ekleme.

## Rapor
- Ayrıntılı rapor dosyası (yol aşağıda): değişen dosyalar, her davranış değişikliği file:line, eklenen testler,
  kapı çıktılarının son satırları, açık kalan sorular.
- `worker_done` özeti ≤10 satır, file:line ile; `--report-path` ver.
