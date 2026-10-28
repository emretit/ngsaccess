# Vardiya Faz 1 — sabit vardiyada kurallar (Codex K3)

## Hedef (test edilebilir)
Sabit (`scheduleType` "fixed" ya da boş) vardiyaya 5 OPSİYONEL kural eklenir, PDKS gün hesabı bunlara uyar, vardiya formunda
"Gelişmiş" bölümünden girilir. **Alanlar boşken hesap sonucu bugünküyle birebir aynıdır** (mevcut tüm testler değişmeden geçer).

## Kurallar (yalnız sabit vardiya; esnek vardiyada form göstermez, backend reddeder)
1. `validWindow?: { checkInStart, checkInEnd, checkOutStart, checkOutEnd: "HH:MM"; checkOutEndDayOffset: 0 | 1 }`
   Geçerli giriş/çıkış penceresi (esnek vardiyadaki alanlarla aynı biçim, `convex/schema.ts` `shifts.flexible`).
   Pencere dışındaki okutma o günün giriş/çıkışı olarak KULLANILMAZ; okutma silinmez, gün detayında görünür ve gün
   **"incelenecek"** işaretlenir (mevcut "review" mekanizması: `pdksRuleVersions.missingRequiredPunch: "review"` nasıl gösteriliyorsa aynısı).
   Gece vardiyası (bitiş < başlangıç) için `checkOutEndDayOffset: 1`.
2. `absentAfterLateMinutes?: number` — geç kalma bu dakikayı AŞARSA gün devamsız sayılır.
3. `minWorkMinutes?: number` — net çalışma (mola düşülmüş) bu dakikanın ALTINDAYSA gün devamsız sayılır.
4. `missingCheckInLateMinutes?: number` — giriş okutması yok, çıkış var → gün bu kadar dakika geç sayılır. Kural sürümündeki
   (`pdksRuleVersions.requireCheckIn` / `missingRequiredPunch`) davranıştan ÖNCE gelir (vardiya alanı doluysa o kazanır).
5. `holidayWorkRequired?: boolean` — true ise resmi tatil günü bu vardiyadaki kişi için normal iş günüdür (devamsızlık/geç sayılır,
   tatil fazla mesaisi uygulanmaz). Hafta sonu (`workingDays`) davranışı değişmez.

## Yapılacaklar
- `convex/schema.ts` `shifts` tablosuna alanlar (yalnız ekleme; başka tabloya dokunma).
- `convex/shifts.ts` `create`/`update` argümanları + doğrulama (HH:MM, 0..1440, pencere tutarlılığı: giriş penceresi vardiya başlangıcını,
  çıkış penceresi bitişini kapsamalı; esnek vardiyada bu alanlar ConvexError). Türkçe hata mesajı.
- Hesap: `convex/lib/pdksDay.ts` (geç/devamsız, satır ~180-320), gerekiyorsa `pdksWorkDay.ts`, `pdksPunchPairs.ts`, `shiftResolver.ts`
  (`thresholdsForShift`), `pdksHelpers.ts`, `pdksPayroll.ts`, `reportAttendance.ts`. Aynı karar tek yerde olsun (kopya mantık yok).
- Form: `src/components/shifts/definitions/AddShiftDialog.tsx` + `shiftFormSchema.ts` → kapalı açılır "Gelişmiş" bölümü
  (5 alan, kısa Türkçe yardım metinleri, boş = kural yok). `useShiftDefinitionActions.ts` payload'ı taşır.
  Eski web/yeni backend uyumu: `update`'te alan gönderilmezse dokunulmaz; temizlemek için açık `null`/boş değer yolu.

## Kapsam dışı (DOKUNMA)
`shiftAssignments` tablosu ve atama mutasyonları · `src/components/shifts/AssignShiftDialog.tsx`, `calendar/**`, `ShiftTree.tsx`,
`ShiftPlanSheet.tsx` · `mobile/**` · `convex/_generated/**` · yayın.
Paralelde 2 TASARIM worker'ı (salt okuma) Faz 2-4 veri modelini çiziyor; senin alanlarınla uyumlu olacaklar, onlara bağımlılığın yok.

## Ownership
`convex/schema.ts` (yalnız `shifts` bloğu), `convex/shifts.ts`, `convex/lib/pdks*.ts`, `convex/lib/shiftResolver.ts`, `convex/lib/shiftUx.ts`,
`convex/lib/reportAttendance.ts`, `src/components/shifts/definitions/**`, `src/components/shifts/useShiftDefinitionActions.ts`,
`src/components/shifts/lib/**` (gerekirse), bu dosyaların testleri.

## Kurallar
- TypeScript strict; `any` / `as any` / `!` YOK. Convex: önce `convex/_generated/ai/guidelines.md` oku. Node modülü import eden convex dosyası yok.
- **`git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git worktree` ÇALIŞTIRMA.**
  **`npx convex` (dev/deploy/codegen/run) ÇALIŞTIRMA** (codegen bile canlıda index kurar). DB yazma YOK. Worktree açma.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```
Yeni testler (her kural için en az 1 olumlu + 1 sınır): pencere dışı giriş → review; gece vardiyası penceresi; 31 dk geç + eşik 30 → devamsız,
30 dk → geç; minWork altı → devamsız; giriş yok + missingCheckInLateMinutes → geç X dk (kural sürümü absent olsa bile);
holidayWorkRequired tatilde devamsız; esnek vardiyaya alan verilince ConvexError; **alanlar boşken eski sonuç** (mevcut testler + 1 karşılaştırma testi).

## Rapor
`worker_done` ≤10 satır: değişen dosyalar (file:line), kapı sonuçları (test sayısı), bilinen sınırlar / koordinatöre sorular.
