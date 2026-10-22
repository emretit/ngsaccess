# W5-A DÜZELTME 1 DOĞRULAMA (SALT-OKUMA, odaklı)

Çalışma dizini: `/tmp/hik-headbuild` — İLK İŞ `cd` oraya. Taban `2b67349`; W5-A = STAGED (`git diff --cached`), düzeltme 1 = UNSTAGED (`git diff`) + untracked `convex/w5aFix1.test.ts`, `convex/w5aLegacyEquivalence.test.ts`, `convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap`. İlk denetim: `/tmp/w5a-denetim.md`. Düzeltme spec'i: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-a-fix1.md`. Yazar raporu: `/tmp/w5a-fix1.md`. Güncel API: `/tmp/w5a-api.md`.

## YASAK
Kod/dosya düzenleme (rapor hariç), git index/stash/checkout/reset, commit, push, deploy, `npx convex *`, DB yazma.

## Soru: düzeltme 1, ilk denetimin ENGEL-1/2/3 ve D1-D6 + N bulgularını GERÇEKTEN kapattı mı, yeni gerileme getirdi mi?
1. **ENGEL-1/2/3:** denetçi probunu (`/tmp/w5a-scratch/probe.ts`) yeni kodla yeniden koş ya da eşdeğerini `w5aFix1.test.ts`'te bul; her biri için kanıt.
2. **D1 legacy eşdeğerlik (en kritik):** `w5aLegacyEquivalence.test.ts` gerçekten 2b67349 davranışını mı sabitliyor (snapshot taban kodla mı üretildi — rapor `/tmp/w5a-legacy-reference` diyor; dizin varsa doğrula), karşılaştırmadan çıkarılan alanlar/sorgular legacy'de ek okuma gizliyor mu; sürümsüz projede `loadRuleReportDays`/`buildBoundedShiftResolver` hiç çağrılmıyor mu; yeni 20k/10k sınırları legacy yolunda yok mu (`getAnnualOvertimeBalance` dahil).
3. **D2 SGK:** `blockedByReview` true iken xml boş; false iken XML 2b67349 ile birebir.
4. **ENGEL-2 bekleme:** vardiya bitiş+tolerans, gece (ertesi gün), vardiyasız çalışan; geçmiş günler artık sonsuza dek `future` kalmıyor mu (bitiş geçince karar veriliyor mu).
5. **D5 mobil:** yeni sürümlü yolun okuma maliyeti (tek paginate 10.000/8 MiB, atama/vardiya/izin yüklemeleri) mobil istemcinin çağrı sıklığına göre makul mü; sürümsüz yol birebir mi.
6. **Yeni kod:** `convex/lib/shiftResolver.ts` `buildBoundedShiftResolver` (ek), `pdksRules.ts` adminQuery; `any`/`!`/`filter(Boolean)` yok; 2b67349'daki test beklentileri değişmemiş (`git diff 2b67349 -- '*.test.ts'` yalnız ekleme + onaylı 2 istisna: auditLogQuery anahtarı, reportScope.test.ts:90 argümanı).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/vitest run convex` (sayı).

## Rapor
`/tmp/w5a-fix1-verify.md`: 1-2 cümle sonuç · her bulgu için KAPANDI / AÇIK + kanıt (file:line, test adı) · yeni ENGEL/DÜZELTİLMELİ varsa senaryo + öneri. `worker_done` ≤10 satır.
