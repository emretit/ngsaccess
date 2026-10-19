# KVKK Faz 1 — ortak kurallar
Repo: /Users/emreaydin/ngsaccess, HEAD `cb22245`. ÖNCE `CLAUDE.md` ve `convex/_generated/ai/guidelines.md` oku (cron: `crons.interval`/`crons.cron`
kullan, `daily/hourly/weekly` YOK). Plan: `docs/PDKS_AUDIT_VE_PLAN_2026-10-16.md` §4 Faz 1.

## Bağlam
KVKK Kurulu 2026/921 kararı: mesai/PDKS takibi için yüz/parmak izi açık rızayla bile yasak. Biyometri yalnız erişim amaçlı, opt-in, imha
aracıyla. PDKS tarafında biyometrik olayların PDKS'ten çıkarılması ZATEN canlı (`convex/lib/pdksSource.ts`) — dokunma. Bu iş kalan 4 parçadır.

## Koordinatörün hazırladığı sözleşme (DEĞİŞTİRME; ihtiyaç = `ask`)
- `convex/schema.ts` → `projectPrivacySettings` tablosu (`by_project`): `biometricEnabled, biometricReason, biometricChangedAt, biometricChangedBy,
  cardReadingRetentionDays, aiMaskNames, updatedAt`. schema.ts'e YAZMA.
- `convex/lib/privacySettings.ts` → `getPrivacySettings`, `getPrivacyRow`, `isBiometricEnabled(ctx, projectId)`, `upsertPrivacySettings(ctx, projectId, patch)`
  (KISMİ patch: yalnız verdiğin alanları yazar), `DEFAULT_PRIVACY`, `MIN/MAX_CARD_READING_RETENTION_DAYS` (365/3650).
  Satır YOKSA: biyometri AÇIK (canlı sistemi bozmamak için), saklama süresiz, asistan isimleri MASKELİ. Yeni projeler biyometri KAPALI başlar.
  Bu dosyayı DEĞİŞTİRME; yeni yardımcı lazımsa kendi dosyanda yaz.
- UI kabuğu: `src/components/settings/sections/PrivacySettings.tsx` ("Gizlilik ve KVKK" sekmesi, `/settings?tab=privacy`, `capabilities.ts` + `SettingsSidebar.tsx` +
  `Settings.tsx` kayıtlı) üç yer tutucu kart çağırır: `privacy/BiometricModuleCard.tsx` (Worker A), `privacy/RetentionAssistantCard.tsx` (Worker C),
  `privacy/BiometricDestructionCard.tsx` (Worker B). Her kartın imzası `({ projectId }: { projectId: Id<"projects"> })` — imzayı koru, YALNIZ kendi kartının gövdesini yaz.
- Yetki kalıbı: `convex/settings.ts` (`adminQuery`/`adminMutation` = super_admin + project_admin; `getProjectIdsForUser` ile proje izni; izinsiz projeye yazma = hata).
  Her yazma `writeAudit` (`convex/lib/audit.ts`) ile kayıt düşer. Hata mesajı Türkçe; kullanıcıya dönen kodlu hata = `ConvexError({ code, message })`.

## Paralel çalışma / dokunma listesi
Aynı çalışma ağacında başka Claude oturumları var (public sayfalar + sayfa sınırı işleri). ASLA dokunma / geri alma / format: `src/components/landing/**`,
`src/components/demo/**`, `src/pages/{Login,Register,Employees,Leaves}.tsx`, `src/components/{employees,leaves,visitors,departments,admin,layout}/**`,
`src/components/devices/DeviceList.tsx`, `src/components/access-control/unified/AccessRulesList.tsx`, `src/components/shifts/ShiftCalendarView.tsx`,
`src/App.tsx`, `src/components/Layout.tsx`, `src/components/ui/logo.tsx`, `src/hooks/useDarkMode.ts`, `src/index.css`, `index.html`, `mobile/**`.
`npx tsc -p tsconfig.app.json` şu an landing/demo dosyalarında hata verir (başka oturumun yarım işi) — bunlar SENİN değil; kapıyı kendi dosyalarına süzerek koş
(`... | grep -E "settings|privacy|convex/"`). `npx vite build` bu yüzden kırık olabilir: koordinatör temiz worktree'de koşar, sen koşma.

## Kurallar
- Aynı dosyaya iki worker yazmaz: Ownership listene SADIK kal; listede olmayan dosya gerekiyorsa `ask`. `convex/_generated/api.d.ts` ortak: yalnız kendi yeni modül satırlarını ekle.
- Canlıdaki frontend yeni backend'le de çalışmalı: var olan query/mutation imzalarını KIRMA; yeni ihtiyaç = yeni fonksiyon veya OPSİYONEL arg.
- Bütün sorgular sınırlı (`take`/`paginate`), `filter` yok (index). Silme/temizlik toplu işleri batch + `ctx.scheduler.runAfter(0, ...)` ile kendini sürdürür.
- UI: A2 dili (`docs/ui-scan/DESIGN_DIRECTION.md`, `docs/ux-audit/DESIGN_SYSTEM.md`): `notify`, `useAsyncAction`, `ConfirmDestructive`, token renkler, emoji/gradyan/kart-içinde-kart YOK,
  `useToast` YOK. 390px'te taşma yok. Türkçe metinler sade; hukuki iddia KURMA ("KVKK'ya uygundur" deme) — metinler "yasal danışmanınıza doğrulatın" notu taşır.
- Saf mantık için vitest testi yaz (convex: `convex/lib/*.test.ts` kalıbı; UI: `*.test.tsx`).
- Kapılar (kendi koşumunla yeşil olmadan worker_done YOK): `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · app tsc (kendi dosyalarına süzülü) ·
  `node_modules/.bin/eslint <kendi dosyaların>` 0 hata · `npx vitest run <kendi test dosyaların>` · `git diff --check`.
- YASAK: commit/push/deploy/migration; `npx convex` koşma; canlı DB'ye yazma/okuma; paket kurma; uygulamaya giriş; `rm -rf`.
- Rapor: `.claude/orca-specs/reports/kvkk1-<ad>.md` (değişen dosya:satır → ne; yeni/değişen fonksiyonların TAM arg+dönüş tipi; koordinatörün gerçek oturumda bakması gereken akışlar;
  bilerek ertelenenler) + `worker_done` ≤10 satır.
