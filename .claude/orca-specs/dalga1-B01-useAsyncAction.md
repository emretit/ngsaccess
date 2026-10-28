# Dalga 1 / B01 — useAsyncAction'a geçiş (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga1-ortak.md

## Hedef (test edilebilir)
Aşağıdaki 6 dosyada elle yazılmış `pending state → try/await → notify → finally` zinciri `useAsyncAction` (src/hooks/useAsyncAction.ts)
ile değiştirilir; özellikle LeaveRequestsPanel onay/ret dialog'u hata olunca artık KAPANMAZ (bugün `finally { setDecision(null) }` ile kapanıyor,
yazılan not kayboluyor). CorrectionRequestsPanel zaten yalnız başarıda kapatıyor — aynı sözleşmeye hook ile getir.

## Ownership (yalnız bunlara yaz)
- src/components/leaves/LeaveRequestsPanel.tsx (+ LeaveRequestsPanel.test.tsx)
- src/components/pdks/CorrectionRequestsPanel.tsx (+ CorrectionRequestsPanel.test.tsx)
- src/components/employees/EmployeeConsentsCard.tsx (+ EmployeeConsentsCard.test.tsx)
- src/components/admin/components/AccountAccessActions.tsx (+ AccountAccessActions.test.tsx)
- src/components/admin/ProjectMembersContent.tsx (+ ProjectMembersContent.test.tsx)
- src/components/settings/sections/RolesSettings.tsx (+ RolesSettings.test.tsx)

## Kapsam dışı
- useAsyncAction.ts, ConfirmDestructive.tsx, diğer tüm dosyalar. Görsel düzen değişmez (yalnız davranış).
- LeaveRequestsPanel ve CorrectionRequestsPanel'deki reddet/onayla dialog'larını tek bileşende birleştirme — bu iş değil.

## Kapılar (koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/leaves src/components/pdks/CorrectionRequestsPanel.tsx src/components/employees/EmployeeConsentsCard.tsx src/components/admin src/components/settings/sections/RolesSettings.tsx`
- `node_modules/.bin/vitest run src/components/leaves src/components/pdks src/components/employees src/components/admin src/components/settings`
