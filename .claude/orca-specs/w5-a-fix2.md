# W5-A DÜZELTME 2 — yıllık bakiye çift okuma + "Devam ediyor" etiketi (UYGULAMA, küçük)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-pdks-rules` (taban `2b67349`; içinde commit'siz W5-A + düzeltme 1 + W5-C + W5-D — KORU). Doğrulama raporu (otoriter): `/tmp/w5a-fix1-verify.md` (DÜZELTİLMELİ-1, NOT-1). API: `/tmp/w5a-api.md`.

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK (mevcut eski satırlara dokunma). Convex: sınırsız yeni `.collect()` yok; yeni cron/polling yok. Türkçe metin.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset`, `mobile/**`, `convex/shifts.ts`, `src/components/shifts/**`, `convex/lib/{pdksDay,pdksWorkDay,overtimeCalc,pdksCalc,shiftUx,shiftAssign}.ts` (W5.3 başka worktree'de bunlarla çalışıyor — çakışma olmasın).
- `convex/w5aLegacyEquivalence.test.ts` snapshot'ları DEĞİŞMEMELİ (sürümsüz yol birebir). 2b67349'daki test beklentileri değişmez.

## Düzeltilecekler
1. **Yıllık bakiye çift okuma (sürümlü projeler)** — `convex/lib/reportAttendance.ts:218-241` `loadRuleReportDays`, `convex/dashboard.ts:178-221` `loadPdksDataset`, `getAnnualOvertimeBalance` (~370). Sürümlü projede aynı yıl okumaları iki kez okunuyor ve `take(20001)` sınırı yıllık kartı ~80 okuma/gün projede bozuyor. Çözüm: `loadRuleReportDays`'e önceden yüklenmiş okumaları verebilme (ör. `options.preloadedReadings` + yalnız eksik ön aralık `start-7 … start` için ayrı sınırlı okuma); dashboard çağrıları (`loadPdksDataset`) okumaları bir kez yükleyip bunu geçsin. Sürümlü yolda yıllık aralık için ek `take(20001)` tavanı kalmasın (Convex'in kendi sınırları + legacy ile aynı davranış). Sürümsüz yol DEĞİŞMEZ.
2. **"Devam ediyor" etiketi** — requirements'ta giriş okutması olan ama kararı vardiya bitişine kadar bekleyen gün `status: "future"` dönüyor ve UI "Henüz gelmedi" yazıyor (yanlış). `src/components/pdks/**`'da durum etiketini tek yardımcıdan üret (ör. `statusMetaFor(item)` `src/components/pdks/statusMeta.ts`): `status === "future"` VE ilk giriş saati varsa "Devam ediyor" (nötr/bilgi tonu), aksi halde mevcut `STATUS_META[status]`. Tüm görüntüleme yerlerinde (tablo rozeti `PdksRowStatus`, detay çekmecesi, mobil kart, ısı haritası/hücre etiketi `presentation.ts` `cellLabel`, varsa filtre) kullan. Giriş yoksa etiket aynen "Henüz gelmedi".

## Testler
- Yıllık bakiye: sürümlü projede okumalar bir kez yüklenir (convex-test ile okuma sayısı ya da sorgu kaydı), 20.000'den fazla yıllık okumada hata yok (küçük bir sınırla parametrik test kabul), sonuç öncekiyle aynı; sürümsüz snapshot'lar aynı.
- Etiket: future + giriş → "Devam ediyor"; future + giriş yok → "Henüz gelmedi"; diğer durumlar değişmez; legacy satır anlık görüntüsü değişmez.
- Mevcut testlerin tamamı yeşil.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w5a-fix2.md` (file:line + test adı) + `worker_done` ≤10 satır. Değiştirdiğin dosyaların tam listesini rapora yaz (koordinatör W5.3 worktree'sine aktaracak).
