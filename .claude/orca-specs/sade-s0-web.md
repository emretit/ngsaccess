# S0-web — zaman şablonu arayüzünü tamamen sil

## Hedef
`src/` içinde zaman şablonuna hiçbir referans kalmaz; kural formu, kural listesi/ayrıntısı, yetki durumu ve kapı planları yalnız kendi saatleriyle çalışır; testler yeşil.

## Ownership (yalnız bunlar)
- SİL: `src/components/access-control/unified/templates/` klasörü (TemplatesPage, TemplateEditor, TemplatePicker, RuleScheduleSummary, model.ts ve testleri). İçindeki `schedule.ts` başka yerde (şablon dışı) kullanılıyorsa uygun yere taşı (ör. `unified/lib/schedule.ts`) ve import'ları güncelle; kullanılmıyorsa sil.
- DÜZENLE: `src/components/access-control/**` (unified/hooks/useRuleForm.ts, useAccessRuleSchema.ts → `scheduleMode`/`scheduleTemplateId` kalkar; rules-list/RuleRow.tsx, RulesFilters.tsx; AccessRuleDetails.tsx; status/* içindeki "Şablon" filtresi/kolonu/etiketi; door-plans/DoorPlanDialog.tsx "Zaman şablonu kullan" + TemplatePicker + useTemplate state; door-plans/CopyDoorPlansDialog.tsx "Zaman şablonu (durum planı)" seçeneği; door-plans/DoorPlanImpactSummary.tsx, bulk.ts; door-dialog/DoorStatusPlanSection.tsx metni "Kurallar ve Zaman Şablonları'nda" → "Kurallar'da"), `src/hooks/access-rules/useComplexAccessRuleMutations.ts`, `src/types/access-control.ts` ve bu dosyaların testleri.
- Başka `src/` dosyasında şablon referansı çıkarsa (grep ile bul) onu da düzelt ve raporda belirt.

## Kapsam dışı
- `convex/` (S0-convex'in). Sadeleştirme/yeniden tasarım (sonraki dalga). Davranış değişikliği yalnız şablon yolunun kalkması.

## Kapılar (kendin koş)
- `grep -rnE "accessScheduleTemplates|scheduleTemplateId|hikDoorStatusTemplateId|TemplatePicker|TemplatesPage|scheduleMode|templateName" src` → 0 satır (visitor/fingerprint "şablon" metinleri hariç).
- `node_modules/.bin/vitest run src` → yeşil.
- `node_modules/.bin/eslint src/components/access-control src/hooks/access-rules src/types` → error 0.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → `src/` içinde 0 hata (convex/ kaynaklı geçici hatalar raporda).

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
