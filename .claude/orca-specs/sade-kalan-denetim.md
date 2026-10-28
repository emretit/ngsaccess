# Denetim — Geçiş Kontrol kalan 3 iş (SALT OKUMA)

## Hedef
Claude'un yazdığı 3 değişikliği bağımsız denetle: davranış doğru mu, mevcut davranış bozuldu mu? Rapor: `docs/ui-audit-gk/sadelestirme/review-kalan.md`.

## Değişiklikler (incelenecek dosyalar: `.claude/pathspec-gk-kalan.txt`; her biri için `git diff HEAD -- <dosya>`, yeni dosyalar için `cat`)
1. **Bilinmiyor süzmesi** — `convex/accessGrantStatus.ts`: `listByProject` artık `state: "unknown"` kabul eder; kural grafiğinden (aktif kural → üye → cihaz) kaydı olmayan kişi×cihaz çiftlerini sentetik satır (`_id: null`, `state: "unknown"`) olarak döndürür, departman/cihaz/kural/arama filtreleri + `grant-scan:` offset sayfalama. `counts` içindeki iki grafik taraması (departman + proje) `unknownGrantPairs` yardımcısına taşındı. UI: `status/StatusCounters.tsx` Bilinmiyor düğmesi tıklanır (seçiliyken 0 olsa da görünür), `StatusViews.tsx` EmptyStatus metni, `StatusPage.tsx` Bilinmiyor seçiliyken ipucunu gizler.
2. **Plan editörleri ortak parça** — `src/components/access-control/door-dialog/weeklyPlan.tsx` (yeni: `TimeFields`, `useWeeklyPlanLayout`, `renderWeeklyPlan`); `DoorStatusPlanEditor.tsx` ve `door-dialog/DoorVerifyPlanEditor.tsx` bunu kullanır. Koordinatör eski/yeni HTML eşitliğini 5 senaryoda doğruladı.
3. **Gerekçe metinleri tek kaynak** — `convex/lib/syncReasons.ts` (yeni, bağımlılıksız `skipReasons`); `convex/lib/deviceSyncRun.ts` buradan re-export; `src/lib/pastAttempt.ts` ve `status/model.ts` `shortFailureReason` sabitleri buradan okur. `convex/_generated/api.d.ts` elle 1 import + 1 map satırı eklendi.

## Özellikle bak
- `counts` refaktörü sayıları değiştirdi mi (eski kod: `git show HEAD:convex/accessGrantStatus.ts`)? `people`, `capped`, 1000 sınırları, departman dalında `examinedPairs`, proje dalında `seen` + ikinci kuraldan gelen `ruleIds` birleştirmesi.
- `listByProject` unknown dalı: yetki (`authorize`) önce mi, sınırlar (1000) korunuyor mu, sayfalama `isDone`/imleç doğru mu, sentetik satır ön yüzde seçilip `redistribute` ile gönderilebilir mi (çift sahipliği kontrolü)?
- `useWeeklyPlanLayout` eski editör mantığıyla birebir mi (Her gün / Hafta içi / Günlere göre, veri kaybında `confirm`, Pazartesi boşken satır içi uyarı, Günlere göre düzenlerken panelin çökmemesi)? `toDaily` `weekly` alanını gerçekten çıkarıyor mu?
- `convex/lib/syncReasons.ts` web paketine sunucu kodu sızdırmıyor mu; `deviceSyncRun.ts` re-export'u tüketicileri bozmuyor mu?
- `any`/`as any`, `!` non-null, `filter(Boolean)` yok (CLAUDE.md).
- Kendi kapın: `node_modules/.bin/vitest run convex/accessGrantStatus.test.ts src/components/access-control src/lib/pastAttempt.test.ts` + `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` + `node_modules/.bin/tsc --noEmit -p convex`.

## Rapor biçimi (Türkçe)
En üstte karar: "Geçti" / "Düzeltme gerekli". Tablo: `# | Önem (Engel/Önemli/Küçük) | file:line | Sorun | Öneri`. En fazla 10 satır. Kanıtsız tahmin yazma; kodda doğrula.

## YASAK
Kaynak koda yazma (yalnız rapor dosyası). `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore` ÇALIŞTIRMA. `npx convex *` komutları ve DB yazma YASAK. Supabase MCP kullanma.

## worker_done
≤10 satır: karar + Engel/Önemli bulgular (file:line) + kapı sonuçları; `--report-path docs/ui-audit-gk/sadelestirme/review-kalan.md`.
