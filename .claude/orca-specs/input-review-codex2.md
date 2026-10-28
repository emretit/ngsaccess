# Denetim — koordinatör diff, ertelenen 4 bulgu (input border audit)
Dosyalar (Claude koordinatör yazdı, sen denetle). DİKKAT: bu dosyalarda başka bir oturumun (Geçiş Kontrol audit) commit'lenmemiş değişiklikleri de var; yalnız aşağıdaki hunk'ları denetle, diğerlerini yok say:
- src/components/access-control/door-plans/DoorPlanDialog.tsx — Input/NativeSelect importları; "Şablon kapı modu" ve "Tatil kapı modu" select → NativeSelect; "Tatil yılı" input → Input; DoorStatusPlanEditor'a `invalid` + `aria-describedby="status-plan-error"`.
- src/components/access-control/unified/components/TimeSchedule.tsx — TemplatePicker'a aria-invalid/aria-describedby + hata <p>'ye id="schedule-template-error".
- src/components/access-control/unified/templates/schedule.ts — yeni `invalidTimeField`.
- src/components/access-control/unified/templates/TemplateEditor.tsx — WeekEditor saat Input'larına `aria-invalid={invalidTimeField(r, field)}`.
- src/components/access-control/unified/templates/schedule.test.ts — invalidTimeField testi.
Referans: convex/lib/accessSchedule.ts validTime/splitOvernight kuralları; invalidTimeField bunlarla tutarlı mı (24:00 yalnız bitişte, start===end geçersiz).
Ek: Tatil kapı modu NativeSelect `className="w-auto"` eski içerik genişliğini korur mu; DoorPlanDialog.test.tsx bu alanları rol/label ile buluyor mu (class assert kırılması).

## Kurallar
SALT OKUMA DENETİM. Hiçbir dosyaya YAZMA. `git add/commit/stash/reset/checkout/restore` ÇALIŞTIRMA. npm install/deploy/convex YOK. Worktree açma.
Kontrol et: davranış korunmuş mu (value/onChange/aria-label), aria-invalid doğru koşulda mı, describedby var olan id'ye mi işaret ediyor, any / non-null assertion eklenmiş mi.
Kendi kapın: `node_modules/.bin/vitest run src/components/access-control` ve değişen dosyalarda `node_modules/.bin/eslint`.
Rapor: worker_done ≤8 satır: bulgu varsa file:line + sorun + öneri (Y/O/D); yoksa "temiz".
