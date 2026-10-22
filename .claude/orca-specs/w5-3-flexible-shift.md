# W5.3 — Esnek vardiya (backend + vardiya formu) (UYGULAMA)

## Çalışma dizini
`/Users/emreaydin/orca/workspaces/ngsaccess/w5-3-flexible-shift` (dal `emretit/w5-3-flexible-shift`, taban `2b67349`). Orada W5-A (+düzeltme 1) + W5-C + W5-D değişiklikleri STAGED (56 dosya). Senin değişikliklerin UNSTAGED kalsın: `git add`/`stash`/`checkout`/`reset` YASAK (koordinatör `git diff` ile ayıracak). Staged işi bozma; üstüne yaz.

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any`/`as any` YASAK (eslint error); `unknown` + narrowing; `!` yerine erken return; tip korumalı filtre, `filter(Boolean)` değil. Convex sonuçları frontend'de `any[]`'a açılmaz (`FunctionReturnType`); form payload'ı `z.infer<typeof schema>`.
- Convex: önce `convex/_generated/ai/guidelines.md`. Sınırsız `.collect()` yok; yeni cron/polling YOK (Convex Free kota).
- Şema: yalnız opsiyonel alan. Mevcut alan silme/daraltma yok, migration yok.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `mobile/**`, `bridge/**`, `package.json`/lock, `App.tsx`/route dosyaları, `convex/_generated/**`.
- Kullanıcıya görünen metinler Türkçe.

## Hedef (test edilebilir)
Vardiya "Esnek" tanımlanabilir (günlük net hedef süre + geçerli giriş/çıkış pencereleri + mola süresi); esnek günde geç/erken kalma yoktur, eksik süre dakika uyarısıdır (devamsızlık değil), fazla süre mevcut mesai kurallarına (dailyShift/weekly45) göre işler; `scheduleType` olmayan vardiyalar bugünküyle birebir aynı hesaplanır.

## Bağlam (kodda doğrula; satırlar kayabilir)
- Tasarım (otoriter, salt-okuma, mutlak yol): `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §1 (model, gün/süre/mesai kuralları 1-15, senaryo tablosu) + §5 (etki). Emre kararları: geç/erken yok; eksik süre = dakika uyarısı (DV değil), ücret/SGK gününe çevrilmez; tam gün tatil/izin hedef 0; geçmişe yeniden hesap yok (esnek düzenleme = yeni tanım + gelecek tarihli atama önerisi UI'da metinle).
- W5-A düzeltme 1 semantiği (koru): requirements'ta eksik yön kararı vardiya bitişi + erken çıkış toleransı geçene kadar `future` (gece: ertesi gün; vardiyasız: çalışma ayarı bitişi) — esnekte bu bitiş = en geç geçerli çıkış (`checkOutEnd` + gün farkı) ve `maxSpanMinutes`; sürümsüz projelerde ek okuma YOK (`convex/w5aLegacyEquivalence.test.ts` snapshot'ları değişmemeli); dashboard 'bugün' metrikleri ham izinli girişlerden. UI'da `reviewHint()` (`src/components/pdks/lib/presentation.ts`) yalnız İnceleme/ölçülemeyen günde ipucu gösterir.
- Bu dal W5-A'yı içerir (tarihli kural sürümü, `resolveAttendanceEvidence`, `incomplete`, `durationMeasured`, `punchQuality`): API özeti `/tmp/w5a-api.md`. Esnek dal bu kanıt çözümleyicisini KULLANIR, kopyalamaz.
- Vardiya: `convex/schema.ts` `shifts` (~931; `startTime/endTime` zorunlu), `convex/shifts.ts` (`create` ~382, `update` ~414, `validateShift`), `convex/lib/shiftUx.ts` (aralık/çakışma ~39), `convex/lib/shiftAssign.ts`, `convex/lib/shiftResolver.ts`. Hesap: `convex/lib/pdksDay.ts` `computePdksDay`, `convex/lib/pdksWorkDay.ts`, `convex/lib/overtimeCalc.ts`, `convex/lib/pdksCalc.ts`, `convex/lib/pdksTable.ts` (bekleme kuralı ~59). UI: `src/components/shifts/definitions/**`, `src/components/shifts/lib/**`.

## Değişiklik
1. **Şema (opsiyonel):** `shifts.scheduleType?: "fixed"|"flexible"`, `shifts.flexible?: { requiredNetMinutes, checkInStart, checkInEnd, checkOutStart, checkOutEnd, checkOutEndDayOffset (0|1), maxSpanMinutes, breakMode ("duration"|"existingLegal"), breakMinutes? }`. Yoksa fixed. Esnekte zorunlu `startTime/endTime` = giriş penceresi sınırları (uyumluluk değeri; hesap/etiket/çakışma bunları vardiya saati SAYMAZ).
2. **Doğrulama (backend + form):** tasarım §1 "Backend/UI doğrulama" maddesi birebir (tamsayı dakika, hedef>0, 0≤mola<azami≤1440, gün farkı 0/1, HH:MM, giriş penceresi aynı gün ve başlangıç≤bitiş, hedef+mola azami süreye sığar, her izinli girişten hedefe ulaşılabilen çıkış var). Geceyi geçen GİRİŞ penceresi reddedilir; cross-day çalışma desteklenir.
3. **Hesap:** tasarım §1 madde 2-15 (gün eşleme, brüt/net, süre molası bir kez ve gece/tatil segmentlerine oranlı, `isLate/isEarlyExit=false`, `requiredNetMinutes/shortfallMinutes/excessMinutes`, tek okutma ölçülemez → eksik süre `null`, dailyShift toleransı, weekly45 havuzu, gece modları korunur, esnek günde "Devam ediyor" en geç çıkış + azami oturum kapanana dek, tatil/izin hedef 0, esnekte mola ihlali üretilmez). W5-A kural sürümü (legacy/requirements) esnekte de geçerli: kanıt kararı W5-A çözümleyicisinden.
4. **Atama çakışması:** esnek pencere/azami süre ile iki atama çakışması fark edilsin (`shiftUx`); fixed davranışı aynı.
5. **Tüketiciler:** tablo/detay/bordro/rapor yeni alanları (`requiredNetMinutes`, `shortfallMinutes`, `excessMinutes`) döner; esnek gün "geç/erken" filtresine düşmez.
6. **Vardiya formu (`src/components/shifts/definitions/**`):** "Sabit / Esnek" seçimi; esnekte hedef süre, giriş/çıkış pencereleri, gün farkı, azami oturum, mola modu/süresi; Türkçe hata; mevcut sabit form davranışı aynı. Liste/etiket esnek vardiyayı "Esnek · 8 sa" gibi gösterir, pencere saatlerini vardiya saati gibi göstermez.

## Testler (en az)
- Tasarım §1 senaryo tablosunun 12 satırı (yeni `convex/lib/pdksFlexible.test.ts`).
- Fixed vardiya altın uyumluluk: mevcut test beklentileri DEĞİŞMEZ (değişmesi gerekirse dur, gerekçeyle bildir).
- Aynı okuma iki güne girmez; gece geçen oturum; weekly45 + splitAtMidnight hafta/ay sınırı; mola/gece dakika korunumu.
- Doğrulama reddi senaryoları; atama çakışması.
- Form: sabit/esnek geçişi, doğrulama mesajları, payload `z.infer` tipi.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
`convex/schema.ts` (yalnız `shifts` opsiyonel alanları) · `convex/shifts.ts` · `convex/lib/shiftUx.ts` · `convex/lib/shiftAssign.ts` · `convex/lib/shiftResolver.ts` · `convex/lib/pdksDay.ts` · `convex/lib/pdksWorkDay.ts` · `convex/lib/overtimeCalc.ts` · `convex/lib/pdksCalc.ts` · `convex/lib/pdksTable.ts` · `convex/lib/pdksDetail.ts` · `convex/lib/pdksPayroll.ts` · YENİ `convex/lib/pdksFlexible.ts` (+test) · `src/components/shifts/**` · ilgili mevcut test dosyaları.

## Kapsam dışı
Ayar/check point UI (W5-C) · export (W5-D) · gece başlayan giriş penceresi · çoklu oturum toplama · saatli izin · geçmişe yeniden hesap.

## Kapılar (kendin koş; node_modules kurulu)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w53-report.md` + `worker_done`'da ≤10 satır (file:line): değişen dosyalar · yeni alanlar · fixed birebirlik kanıtı · senaryo testleri · kapı sayıları.
