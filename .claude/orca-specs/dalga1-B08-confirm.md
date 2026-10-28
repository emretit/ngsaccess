# Dalga 1 / B08 — silme onaylarını ConfirmDestructive sözleşmesine getir (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga1-ortak.md

## Hedef (test edilebilir)
1. PDKS kayıtlı görünüm silme (src/components/pdks/dashboard/PDKSSavedViews.tsx:83-87): bugün `remove(deleteId); setDeleteId(null)` ile
   sonuç beklenmeden kapanıyor. `ConfirmDestructive` (src/components/shared/ConfirmDestructive.tsx) kullan; bunun için
   `usePdksSavedViews.ts:99` civarındaki `removeView` gerçek bir Promise döndürmeli (`void persist(next)` yerine `return persist(next)`),
   hata durumunda reject etmeli/hatayı yutmamalı ki dialog yalnız başarıda kapansın.
2. SMTP hesabı kaldırma (src/components/settings/sections/MailSettings.tsx:~129, action ~65, onClick ~137): elle Dialog yerine
   `ConfirmDestructive`; pending sırasında butonlar disabled, başarıda kapanır, hatada açık kalır.
3. PDKS kural silme (src/components/settings/sections/components/pdksRulesConfirmation.tsx:31 `kind === "delete"` dalı +
   PdksRulesSettings.tsx:~240 handler): handler `preventDefault` ile onayı açık tutuyor ve satır içi hata gösteriyor.
   ConfirmDestructive'a geçince satır içi hata kaybolup yerine toast geliyorsa bu KABUL; ama yayınlama (publish) dalı ayrı kalır, dokunma.
   Geçiş satır içi hatanın taşıdığı bilgiyi (ör. hangi kural/neden) kaybettiriyorsa geçme, mevcut dialog'da yalnız pending/kapanma
   sözleşmesini düzelt ve raporla.

## Ownership (yalnız bunlara yaz)
- src/components/pdks/dashboard/PDKSSavedViews.tsx
- src/hooks/usePdksSavedViews.ts
- src/components/settings/sections/MailSettings.tsx
- src/components/settings/sections/components/pdksRulesConfirmation.tsx
- src/components/settings/sections/components/PdksRulesSettings.tsx (+ PdksRulesSettings.test.tsx)
- Yeni test dosyaları serbest: src/components/pdks/dashboard/PDKSSavedViews.test.tsx, src/hooks/usePdksSavedViews.test.ts,
  src/components/settings/sections/MailSettings.test.tsx

## Kapsam dışı
- ConfirmDestructive.tsx, useAsyncAction.ts ve diğer tüm dosyalar. Silme dışındaki dialog'lar.

## Kapılar (koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/pdks/dashboard src/hooks/usePdksSavedViews.ts src/components/settings/sections`
- `node_modules/.bin/vitest run src/components/pdks src/hooks src/components/settings`
