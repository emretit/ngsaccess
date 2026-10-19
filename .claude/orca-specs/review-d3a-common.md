# Görev: Dalga 3a denetimi (SALT-OKUMA)
Repo: /Users/emreaydin/ngsaccess. 4 Codex worker Dalga 3a'yı (UX-1 sadeleştirme) uyguladı; commit'siz, çalışma ağacında.
Spec'ler: `.claude/orca-specs/d3-common.md` + `d3a-shl.md`, `d3a-dev-tree.md`, `d3a-acc-rules.md`, `d3a-adm-audit.md`.
Bulgu ayrıntıları `docs/ux-audit/0[1-5]*.md`, ortak kurallar `docs/ux-audit/DESIGN_SYSTEM.md`. Bağımsız denetçisin; raporu değil DİFF'i oku.
Koordinatör ek değişikliği: `src/pages/AccessControl.tsx` legacy `useAccessRulesQuery` + tam ekran spinner kaldırıldı (bunu da denetle:
`useAccessRules.ts` hâlâ legacy sorguyu kullanan başka tüketici var mı, sayfa yüklemesi artık bölüm düzeyinde mi).
HARİÇ (bu işe ait değil, yorumlama): `convex/lib/cardReadingAudit.ts`, `mobile/**`, `docs/ui-scan/**`, `.claude/**`.

## Genel kontrol
- UX-0 sözleşmeleri korunmuş mu: aktif proje kapsamı, `useAsyncAction`, `notify`, `ConfirmDestructive`, cursor sayfalama, TR saati.
- CLAUDE.md: `any`/`as any` yok, `!` yok, Convex sonuç tipleri `FunctionReturnType` (yerel tip kopyası yok), backend camelCase.
- Silinen dosyalar (Header.tsx, AttendanceChart.tsx, StatusCard.tsx, dashboard/CalendarCard.tsx, demo/DemoRequestForm.tsx) hiçbir yerden import edilmiyor mu.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run

## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. Tarayıcı açma yok (yalnız kod okuma). Paralel başka salt-okuma denetçisi ve
docs/ui-scan altında yazan tarama worker'ları var; onların dosyalarına bakma.

## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
