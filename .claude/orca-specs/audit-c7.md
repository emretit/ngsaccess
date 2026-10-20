# Denetim — C7 gece vardiyası kenar durumları N1/N2/N3/N5 (SALT-OKUMA; Codex yazdı, Claude denetler)

Repo: /Users/emreaydin/ngsaccess. Değişiklik commit'lenmemiş; aynı ağaçta başka ekibin değişiklikleri var — YALNIZ şu dosyaları incele:
`git diff -- convex/lib/pdksManual.ts convex/lib/pdksWorkDay.ts convex/lib/pdksAvailability.ts convex/lib/pdksSource.ts convex/lib/pdksManual.test.ts convex/lib/pdksAvailability.test.ts convex/lib/pdksSource.test.ts src/components/settings/sections/components/OvertimeSettingsForm.tsx src/components/pdks/lib/presentation.ts src/components/pdks/dashboard/PdksRowStatus.tsx src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx` + yeni dosyalar `src/components/settings/sections/components/OvertimeSettingsForm.test.tsx`, `src/components/pdks/dashboard/PdksExcludedReadingsNotice.tsx`, `PdksExcludedReadingsNotice.test.tsx`.
Spec: .claude/orca-specs/c7-night-notes.md · kaynak bulgular docs/ui-audit-2/review-wave3b.md R3B-N1..N5 · yazar raporu /tmp/c7-w4.md (rapora değil koda + kendi testine dayan).

## Hedef — her bulgu: önem, file:line, senaryo, düzeltme; yoksa "temiz"
- N1: eşit giriş/çıkış yalnız start===end vardiyada kabul; gece vardiyası (22→06) ve normal gündüz akışında REGRESYON var mı (ör. 08:00-17:00 normal, 22:00-06:00 gece, bulk/upsert/düzeltme onayı üçü de aynı doğrulamayı kullanıyor: convex/lib/pdksManualWrite.ts + convex/pdksRecords.ts bulk).
- N2: ilk kayıt seçimi izinli kaydı tercih ediyor; okuma sayısı/kota kötüleşti mi (take sınırı), izinli yoksa eski davranış.
- N3: sayaç doğru mu; UI alanı opsiyonel (sunucu göndermezse gösterge yok, tip hatası yok).
- N5: Select değer/etiket eşlemesi ve form submit eskisiyle aynı mı.
- CLAUDE.md kuralları (any yok, `!` yok, filter(Boolean) yok).

## Kapı (sen koş)
`node_modules/.bin/vitest run convex/lib/pdksManual.test.ts convex/lib/pdksAvailability.test.ts convex/lib/pdksSource.test.ts convex/lib/pdksNight.handlers.test.ts convex/lib/pdksManualWrite.test.ts convex/attendanceCorrections.test.ts src/components/settings/sections/components/OvertimeSettingsForm.test.tsx src/components/pdks/`

## Yasak
Repo dosyalarına YAZMA (rapor: /tmp/audit-c7.md). commit/push/deploy/`npx convex`/DB yazma/git index-checkout-stash YOK.

## Rapor
worker_done'da ≤10 satır, Türkçe.
