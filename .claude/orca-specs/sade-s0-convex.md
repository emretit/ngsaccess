# S0-convex — zaman şablonu backend'ini tamamen sil

## Hedef
`convex/` içinde zaman şablonu tablosu, alanları, API'si ve senkron dalları kalmaz; şablonsuz kural/kapı planı senkron davranışı birebir aynı kalır (mevcut testler kanıtlar).

## Ownership (yalnız bunlar)
- SİL: `convex/accessScheduleTemplates.ts` ve `convex/accessScheduleTemplates.test.ts`. Başka yerde kullanılan yardımcıları (`scheduleRuleDevices`, `boundedScheduleRows`, `ideScheduleImpact`, varsa diğerleri) önce `convex/lib/` altında yeni bir dosyaya (ör. `convex/lib/ruleDevices.ts`) taşı, import'ları güncelle; şablona özgü olanları (`readTemplate`, `templateRules`, `weekValidator` yalnız şablonda kullanılıyorsa) sil.
- `convex/schema.ts`: `accessScheduleTemplates` tablosu; `accessRules.scheduleTemplateId` + `by_template` index; `doors.hikDoorStatusTemplateId` + `hikDoorStatusTemplateUpdatedAt`; `deviceSyncRuns.templateId` + `kind` içindeki `template_sync`.
- `convex/deviceSyncRuns.ts` (template_sync yolu, şablon gönderim action'ı, `latestForRule` içindeki `template_sync` dalı), `convex/accessRules.ts`, `convex/doors.ts`, `convex/ideSync.ts`, `convex/hikvisionSync.ts`, `convex/accessGrantStatus.ts`, `convex/lib/{accessSchedule,ruleSchedule,accessRuleWrite,accessRuleUx,grantStatus,mobileAccess,hikSync,hikSyncEmployee,cardReadingProcess,adminGuards}.ts`, `convex/actions/hikQueueWorker.ts` ve bunların `*.test.ts` dosyaları; grep ile bulunan diğer convex dosyaları.
- `convex/_generated/api.d.ts`: YALNIZ silinen modülün `import type * as accessScheduleTemplates` satırı ile `accessScheduleTemplates: typeof accessScheduleTemplates;` satırını sil; yeni lib dosyası eklediysen mevcut desene uygun iki satırı ekle (ör. `lib_ruleDevices`). Başka satıra dokunma (codegen çalıştırma YASAK).
- `effectiveSchedule(rule, template)` gibi imzalar şablonsuz hale gelir (`effectiveSchedule(rule)`); şablonsuz çıktı bugünküyle birebir aynı olmalı.
- Yetki durumu güncellik hesabı (`grantStale`) yalnız kural tarihleriyle çalışır.

## Kapsam dışı
- `src/` (S0-web'in). `convex/_generated/` içinde yukarıdaki iki satır dışında her şey. Sadeleştirme/yeni özellik.

## Kapılar (kendin koş)
- `grep -rnE "accessScheduleTemplates|scheduleTemplateId|hikDoorStatusTemplate|template_sync|templateRules" convex --exclude-dir=_generated` → 0 satır.
- `node_modules/.bin/vitest run convex` → yeşil.
- `node_modules/.bin/eslint convex` → error 0 (`no-explicit-any` 0).
- `node scripts/find-node-leak.mjs` → temiz.
- `node_modules/.bin/tsc --noEmit -p convex` (ya da convex tsconfig) → 0; app tsc'deki `src/` kaynaklı hatalar raporda.

## Bağlam
- Proje: /Users/emreaydin/ngsaccess (React + Vite + Convex). Ürün kararı (Emre, 2026-10-27): **zaman şablonları (accessScheduleTemplates) tamamen kaldırılıyor.** Canlı veri teyit edildi: şablon tablosu 0 satır; hiçbir kural (`scheduleTemplateId`), kapı (`hikDoorStatusTemplateId`) ya da gönderim (`templateId`, `kind: "template_sync"`) şablon kullanmıyor. Migrasyon gerekmez.
- Zaman Şablonları sekmesi ve kural formundaki "Şablon kullan" seçimi zaten kaldırıldı (commit 2a7a057c). Kurallar ve kapı planları yalnız kendi saatleriyle çalışacak.
- Bu dalgada 2 worker paralel çalışıyor: **S0-web** (`src/`) ve **S0-convex** (`convex/`). Diğer worker'ın alanındaki geçici tsc hataları senin sorunun değil: düzeltme, raporda belirt. Sözleşme: şablonla ilgili her API fonksiyonu, argüman ve dönüş alanı KALKAR; yeni alan EKLENMEZ.
- Proje kuralları: `/Users/emreaydin/ngsaccess/CLAUDE.md` (any yasak, camelCase, `filter(Boolean)` yerine tip korumalı filtre). Convex için önce `convex/_generated/ai/guidelines.md` oku.
- Çalışma dizininde başka oturumların ilgisiz commit'lenmemiş değişiklikleri var (mobile/, visitors, employees, privacy vb.). Onlara DOKUNMA.
- **"Ziyaretçi şablonu"** (visitor tipi kural) ve **parmak izi şablonu** (fingerprint template: `convex/fingerprintEnrollment.ts`, `convex/actions/hikFingerprint.ts`) zaman şablonu DEĞİL: dokunma.

## YASAK
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore` YASAK. Commit/push/deploy YOK.
- `npx convex dev`, `npx convex deploy`, `npx convex codegen`, `npx convex run`, DB'ye yazan her komut YASAK. Supabase MCP kullanma.
- Ownership dışındaki dosyaya yazma.

## Rapor
`worker_done` özetinde ≤10 satır: ne silindi/taşındı (file:line), kapı sonuçları (komut + sayı), diğer worker'a ait kalan hata varsa listesi. `--files-modified` gerçek liste (silinenler dahil).
