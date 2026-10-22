# W5.3 DENETİM — esnek vardiya + entegrasyon (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-pdks-rules` (taban HEAD `c8d2d4e`). İlk iş `cd` oraya. Denetlenen değişiklik = `git diff HEAD` (W5.3 yazımı STAGED + entegrasyon UNSTAGED) + yeni dosyalar (`git status --short`). Yazan: Codex (iki worker).
Kaynaklar: yazım spec'i `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-3-flexible-shift.md` + rapor `/tmp/w53-report.md`; entegrasyon spec'i `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-3-integration.md` + rapor `/tmp/w53-int-report.md`; tasarım `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §esnek vardiya ve `/Users/emreaydin/ngsaccess/.claude/designs/w4-w5-sentez.md` sonu (varsayılanlar).

## YASAK
Kod/dosya düzenleme (rapor dosyası hariç), `git add/stash/checkout/reset/commit`, push, deploy, `npx convex *`, DB yazma. Yalnız oku + kapıları koş.

## Odak (öncelik sırasıyla)
1. **Sabit vardiya birebirliği (en kritik):** esnek tanım olmayan projede tablo/detay/bordro/rapor/dashboard/SGK/mobil sonucu ve DB okuma izi `c8d2d4e` ile aynı mı. `convex/w5aLegacyEquivalence.test.ts` değişikliği yalnız `shifts.by_project` keşif sorgusunu mu ayırıyor (başka izi gizliyor mu?). Mevcut testlerde değişen beklenti var mı (`git diff HEAD -- '*.test.ts' '*.test.tsx'` — yalnız EKLEME beklenir). `pdksEvidence.ts`/`pdksDay.ts` değişikliği sabit dala sızıyor mu.
2. **Esnek hesap doğruluğu:** net hedef/eksik/fazla; mola (sabit/süre); giriş penceresi dışı giriş; tek yön/hiç okuma; izin/tatil/yarım tatil hedefi; gece çıkışı doğru güne (erken sabah çıkışı önceki güne kör yazılmıyor, `maxSpanMinutes`); aynı gün çoklu oturum; açık oturum çakışması; `flexiblePendingUntil` bitmeden final eksik/devamsız yok; haftalık 45 / fazla mesai havuzunda çift tüketim yok.
3. **Yollar arası tutarlılık:** aynı veriyle tablo == detay == bordro == `reportAttendance` == SGK/APHB == dashboard == mobil. `managesReading` yüklemi (`reportAttendance.ts:~344`) `reports.ts:91,210,340` ve `dashboard.ts:~262`'de çift sayımı ve gün KAYBINI önlüyor mu (bir gün ne iki kez ne sıfır kez). Assignment-only ve global (projectId'siz) esnek tanım.
4. **Check point / kural sürümü geçişi:** manuel D girişi + D+1 ham çıkış + D/D+1 arası sürüm değişimi (`cardReadings.ts` 471/678/1352 civarı loader sırası); giriş gününün politikası esas mı.
5. **Yetki/IDOR + doğrulama:** `convex/shifts.ts` create/update — rol kontrolü değişmedi mi, başka projenin vardiyası; esnek tanım update reddi; sunucu tarafı doğrulama (`pdksFlexible.ts`) istemciye güvenmiyor mu; form (`AddShiftDialog.tsx`, `shiftFormSchema.ts`) payload'u sabit vardiyada eskisiyle aynı mı.
6. **Kota/okuma:** raporlanan ek okumalar (`/tmp/w53-int-report.md` "Ek DB okuma hesabı") doğru mu; sabit projede reaktif dashboard'a eklenen keşif sorgusu maliyeti; yeni sınırsız `.collect()`, cron, polling yok; `take` sınırları + Türkçe hata; 500 kişilik ay tablosunda esnek varken ek manuel sorgu sayısı (kişi başı sorgu → N+1 riski?).
7. Şema geri uyumu (shifts'e yalnız opsiyonel alanlar, migration gerekmez), repo kuralları (`any`/`as any`/`!`/`filter(Boolean)` yok, camelCase).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (sayıları yaz).

## Rapor
`/tmp/w53-denetim.md`: 1-2 cümle sonuç · kapı sonuçları · ENGEL / DÜZELTİLMELİ / NOT, her biri file:line + somut senaryo (girdi → yanlış çıktı) + öneri. `worker_done`'da ≤10 satır özet + dosya yolu.
