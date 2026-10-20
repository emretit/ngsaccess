# E1-W3 — Rapor ücret görünürlüğü + çift session okuması

## Hedef
1. `src/components/settings/sections/ReportsSettings.tsx` (:156-157) "Ücret bilgisi olmayanlar için saatlik ücret" girdisi ücret göremeyen kullanıcıya (project_user; sunucu kuralı convex/lib/payVisibility.ts `canSeePay`) GÖRÜNMEZ; mesai ücreti tutarları (:192-196 vb.) da gösterilmez. İstemci rol bilgisi için kod tabanındaki mevcut kalıbı kullan (useAuth / capabilities).
2. Ücret göremeyen kullanıcının rapor dışa aktarımlarında (src/lib/reports/** ve ReportsSettings'in kendi export'u) ücret sütunları "—" dolu çıkmaz, SÜTUN HİÇ YOK. Ücret göreni etkilemez.
3. `convex/lib/auth.ts` `getProjectIdsForUser` (:63) her çağrıda `getCurrentUser` ile session+user'ı yeniden okur; customFunctions (convex/lib/customFunctions.ts) ctx.user'ı zaten koyuyor. ctx'te geçerli `user` (Doc<"users">) varsa onu kullan, yoksa mevcut davranış. Yetki değişmez; testle göster.

## Ownership
src/components/settings/sections/ReportsSettings.tsx · src/lib/reports/registry.ts · src/lib/reports/export.ts · src/lib/reports/rows.ts (gerekirse) · ilgili testler (src/components/settings/*.test.tsx, src/lib/reports/*.test.ts) · convex/lib/auth.ts · convex/lib/auth.test.ts

## Kapsam dışı
Sunucu ücret maskeleme mantığı (payVisibility — canlı), diğer sayfalar, mobile/**.

Ortak kurallar: `.claude/orca-specs/e1-common.md` (oku, uy). Rapor dosyası: /tmp/e1-w3.md
