# W5.3 ENTEGRASYON — esnek vardiyayı rapor/SGK/dashboard/mobil yollarına bağla (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-pdks-rules` (dal `emretit/w5-pdks-rules`, HEAD `c8d2d4e` = W3b..W5 commit'li). İçinde W5.3 esnek vardiya değişiklikleri **STAGED** (20 dosya) — KORU, index'e dokunma. Senin değişikliklerin UNSTAGED kalır.
Birleşik başlangıç kapısı YEŞİL: tsc 0/0, eslint 0, vitest 269/2830, build OK.

Otoriter kaynaklar: W5.3 yazar raporu `/tmp/w53-report.md` (özellikle "Koordinatöre bırakılan entegrasyonlar"), tasarım `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §esnek vardiya, W5-A API `/tmp/w5a-api.md`, resolver sözleşmesi `convex/lib/pdksWorkDay.ts:52-180` (`buildPdksWorkDateResolver` opsiyonları `readings` / `manualEntryFor` / `eligibleEntry`).

## Hedef (test edilebilir)
Esnek vardiyalı bir personelin gün sonucu (hedef/eksik/fazla dakika, devamsız değil, gece çıkışı doğru güne yazılı) rapor (`reportAttendance`), SGK/APHB, dashboard ve mobil devam özetinde PDKS tablo/detay/bordro handler'larıyla (`convex/cardReadings.ts`) AYNI çıkar — hem sürümsüz (legacy) hem sürümlü (`punchMode: "requirements"`) projede.

## Yapılacaklar
1. **reportScope.ts:50** `readReportReadings` varsayılan workDate yolu: kapsamda esnek vardiya varsa resolver'a ham (filtre ÖNCESİ) okumaları + giriş gününün check point politikasına göre `eligibleEntry` ver. Erken sabah çıkışı kör biçimde önceki güne / yeni gün politikasına yazılmaz; gerçek giriş + `maxSpanMinutes` esas.
2. **reportAttendance.ts:91 ve :242** (`loadRuleReportDays`): aynı sözleşmeyi bağla (ham okuma seti filtrelemeden önce hazırlanır; manuel giriş callback'i). **Legacy proje**: `loadRuleReportDays` şu an yalnız `requirements` günlerini tutuyor (`:268`, `:293`) → sürümsüz projede esnek vardiyalı günler rapor/SGK adaptörüne hiç girmiyor. Bunu düzelt: legacy projede esnek günün sonucu rapor/SGK'ya tablo handler'ıyla aynı değerlerle girsin. Sabit vardiyalı legacy günlerin yolu ve okuma sayısı DEĞİŞMEZ.
3. **dashboard.ts:258** ve **mobileAttendance.ts:135**: opsiyonel `readings` / `manualEntryFor` / `eligibleEntry` sözleşmesini bağla (yalnız esnek vardiya varken farklı davranış).
4. **cardReadings.ts:471, 673, 1341** (bilinen sınır): manuel D girişi + D+1 ham çıkış + arada check point kural sürümü değişiyorsa, manuel giriş resolver'a filtrelemeden ÖNCE verilmeli. Gerekli loader sıralama değişikliğini yap; yalnız esnek vardiya varken yeni sıra (sabit/legacy yolun okuma sırası ve sayısı aynı kalsın).

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK. Convex: sınırsız yeni `.collect()` yok, yeni cron/polling yok, mevcut sınırlara (take(20001) vb.) yeni okuma ekleme yok; ek DB okuması gerekiyorsa rapora say ve gerekçele.
- `convex/w5aLegacyEquivalence.test.ts` snapshot'ları DEĞİŞMEMELİ (sürümsüz + sabit vardiya yolu, DTO ve DB okuma izleri birebir). Mevcut test beklentileri değişmez (yalnız yeni test eklenir).
- Ownership (yazabileceğin dosyalar): `convex/lib/reportScope.ts`, `convex/lib/reportAttendance.ts`, `convex/dashboard.ts`, `convex/mobileAttendance.ts`, `convex/cardReadings.ts`, `convex/lib/pdksWorkDay.ts` (yalnız sözleşmeyi genişletmek gerekirse), bunların `*.test.ts` dosyaları + yeni test dosyaları (ör. `convex/w53Integration.test.ts`).
- Kapsam dışı / YASAK: `src/**`, `mobile/**`, `convex/schema.ts`, `convex/shifts.ts`, `convex/lib/pdksFlexible.ts`, `convex/lib/pdksDay.ts` (hata bulursan düzeltme yerine rapora yaz). Commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset/commit` YOK.

## Testler (convex-test, gerçek handler)
- Aynı veri setinde (legacy proje + sürümlü proje, her birinde esnek vardiyalı personel): tablo handler satırı == `reportAttendance` satırı == APHB/SGK adaptör günü == dashboard sayımı (hedef/eksik/fazla, durum). Gece çıkışı (D 22:00 giriş, D+1 06:30 çıkış) ve erken sabah çıkışının yanlış güne yazılmaması.
- Madde 4: manuel D girişi + D+1 ham çıkış + D/D+1 arasında check point sürüm değişimi → üç handler'da (tablo/bordro/detay) doğru gün.
- Sabit vardiya regresyonu: legacy snapshot aynı; mevcut 2830 test yeşil.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 · `node_modules/.bin/vitest run` → tamamı yeşil (sayı yaz) · `node_modules/.bin/vite build` → OK · `git diff --check` temiz.

## Rapor
`/tmp/w53-int-report.md`: her madde için file:line + test adı, değişen dosya listesi, ek DB okuma sayısı (varsa) + çözülemeyen sınırlar. `worker_done`'da ≤10 satır.
