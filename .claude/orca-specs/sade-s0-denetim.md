# S0 denetimi — zaman şablonlarının kaldırılması (SALT OKUMA)

## Hedef
S0 değişikliğini (Codex yazdı) bağımsız denetle: şablonsuz kural/kapı planı/yetki durumu davranışı değişmedi mi, silinen şablon yolundan geriye kırık/ölü kod ya da veri kaybı riski kaldı mı? Rapor: `docs/ui-audit-gk/sadelestirme/review-S0.md`.

## Bağlam
- Proje /Users/emreaydin/ngsaccess (React + Convex). Karar: zaman şablonları (accessScheduleTemplates) tamamen kaldırıldı; canlı veride şablon 0, hiçbir kural/kapı/gönderim şablon kullanmıyor.
- İncelenecek dosyalar: `.claude/pathspec-gk-s0.txt` (her biri için `git diff HEAD -- <dosya>`; silinenler için `git show HEAD:<dosya>`). Çalışma dizininde başka oturumların ilgisiz değişiklikleri var; listede olmayan dosyaları değerlendirme.
- Spec'ler: `.claude/orca-specs/sade-s0-web.md`, `.claude/orca-specs/sade-s0-convex.md`.
- Özellikle bak: `effectiveSchedule` ve Hik hafta planı / IDE izin segmenti üretimi şablonsuz kuralda birebir aynı mı (`convex/lib/accessSchedule.ts`, `convex/ideSync.ts`, `convex/hikvisionSync.ts`, `convex/lib/hikSync*.ts`); `grantStale` (`convex/accessGrantStatus.ts`); kapı planı kaydet/kopyala (`convex/doors.ts`, `door-plans/*`); `convex/lib/ruleDevices.ts` taşıması; kural formu payload'u (`useRuleForm.ts`, `useAccessRuleSchema.ts`); `convex/_generated/api.d.ts` elle düzenlemesi (yalnız 2 sil/2 ekle). "Ziyaretçi şablonu" ve parmak izi şablonuna dokunulmamış olmalı.
- Koordinatör kapıları zaten yeşil: tam vitest 5149/5149, tsc app+convex 0, eslint 0 hata, find-node-leak temiz, şablon grep 0. Kendi kapını koş: `node_modules/.bin/vitest run convex/lib/accessSchedule.test.ts convex/doorPlans.test.ts convex/accessGrantStatus.test.ts src/components/access-control`.

## Rapor biçimi (Türkçe)
En üstte karar: "Geçti" / "Düzeltme gerekli". Tablo: `# | Önem (Engel/Önemli/Küçük) | file:line | Sorun | Öneri`. En fazla 12 satır. Kanıtsız tahmin yazma; kodda doğrula.

## YASAK
Kaynak koda yazma (yalnız rapor dosyası). `git add/commit/stash/checkout/reset/restore` YASAK. `npx convex *` komutları ve DB yazma YASAK.

## worker_done
≤10 satır: karar + Engel/Önemli bulgular (file:line) + rapor yolu; `--report-path docs/ui-audit-gk/sadelestirme/review-S0.md`.
