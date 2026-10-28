# Geçiş Kontrol Dalga 1 — çapraz denetim (salt okuma)

## Hedef
Codex'in yazdığı Dalga 1 değişikliklerini denetle; bulguları `docs/ui-audit-gk/review-dalga1.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kapsam (yalnız bu dosyaların diff'i: `git diff -- <dosyalar>` + yeni dosya)
- src/components/access-control/door-plans/DoorPlanDialog.tsx, DoorPlanDialog.test.tsx, DoorPlanImpactSummary.tsx (yeni, untracked), src/components/access-control/doorPlanResult.ts(+test)
- src/components/access-control/unified/components/TimeSchedule.tsx, unified/CreateRuleDialog.tsx, unified/lib/presentation.ts(+test), unified/SyncRuns.tsx(+test), unified/status/RunNotice.tsx(+test), unified/templates/TemplateEditor.tsx, templates/templates.test.tsx
- convex/accessGrantStatus.ts(+test), unified/status/model.ts, StatusViews.tsx, status.test.tsx
Diğer M dosyalar (devices/*, employees/*) başka oturumun; denetleme.

## Ne istendi (doğrula)
Spec'ler: `.claude/orca-specs/gk-dalga1-A-kapi.md`, `-B-kural.md`, `-D-yetki.md`. Bulgu bağlamı `docs/ui-audit-gk/00_OZET.md`.
Kontrol et: (1) her madde gerçekten yapılmış mı; (2) davranış hatası/regresyon (özellikle DoorPlanDialog kaydet/tekrar gönder akışı, boş gönderimde sahte başarı kalmadı mı, CreateRuleDialog özet, accessGrantStatus filtre/sayaç tutarlılığı ve dönüş tipi kullanan diğer tüketiciler — `grep -rn accessGrantStatus src convex`); (3) CLAUDE.md kuralları (any yok, `!` yok, camelCase); (4) Türkçe metin sade ve tutarlı ("cihaz" terimi); (5) testler davranışı gerçekten sınıyor mu.

## Kapılar (kendin koş)
`node_modules/.bin/vitest run src/components/access-control convex/accessGrantStatus.test.ts` ve `node_modules/.bin/eslint <kapsam dosyaları>`. (App tsc'de `useEmployeeFormData.ts:99` hatası başka oturumun, sayma.)

## Yasaklar
Kod/dosya değiştirme (yalnız rapor). git add/commit/stash/checkout/reset, push, deploy, convex run YASAK. Tarayıcı kullanma.

## Rapor
`docs/ui-audit-gk/review-dalga1.md`: üstte karar (Geçti / Düzeltme gerekli), tablo: ID | önem (Engel/Önemli/Küçük) | dosya:satır | sorun | öneri. worker_done ≤10 satır.
