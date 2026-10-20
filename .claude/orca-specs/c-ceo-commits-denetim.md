# CEO commit denetimi (SALT-OKUMA) — Claude yazdı, Codex denetler

Dil: rapor Türkçe. Repo: /Users/emreaydin/ngsaccess. İncelenecek fark: `git diff c07c1ed 04126f5` (4 commit:
f19efab C3 Hik katalog, 5fb0954 C4 CSV/minSeverity/import akışı, 68f5404 C1 alarm tetiği, 04126f5 C2 elle PDKS ortak yazım).
Çalışma ağacında başka oturumların (Flutter) commit'lenmemiş değişiklikleri var — onları DEĞİL yalnız bu commit aralığını incele
(`git show <sha>`; dosya okurken `git show 04126f5:<yol>` kullan).

## Hedef
Bu 4 commit'te doğruluk hatası (davranış değişikliği, veri kaybı, yetki/proje sınırı kaçağı, regresyon) var mı; her bulgu için
file:line + somut senaryo + önerilen düzeltme. Bulgu yoksa "temiz" de.

Özellikle bak:
- C2: `convex/lib/pdksManualWrite.ts` — upsertManual / bulkUpsertManual / attendanceCorrections.decision eski davranışla birebir mi
  (patch'te undefined alan silme semantiği, audit şekli, `now`/`editedAt`, bulk sayaçları, hata yakalama, vardiya doğrulaması sırası).
- C1: `convex/cardReadings.ts` backfillHikEventRow tetiği + `isFreshAlarmEvent` (10 dk) — canlı köprü yolunu etkiliyor mu, saat dilimi/parse.
- C4: `src/lib/employees/employeeImportFlow.ts` + `EmployeeImportDialog.tsx` — refactor öncesiyle aynı akış mı (iptal, hata, sıralama,
  wasCancelled, busy); `neutralizeSpreadsheetFormula` PDKS CSV'de doğru sırada mı (önce nötrle sonra tırnakla).
- C3: `convex/lib/hikEventCatalog.ts` 0x15/0x16.

## Ownership
Hiçbir repo dosyasına YAZMA. Rapor: `/tmp/c-ceo-denetim.md` (tek yazılabilir yol).

## Kapılar (sen koş, sonucu yapıştır)
Temiz worktree `/tmp/ceo-headbuild` (04126f5'te, node_modules kurulu) içinde:
`node_modules/.bin/vitest run convex/lib/pdksManualWrite.test.ts convex/attendanceCorrections.test.ts convex/lib/pdksNight.handlers.test.ts convex/lib/alarmNotify.test.ts src/lib/employees/ convex/lib/hikEventCatalog.test.ts`
(Bu worktree'de dosya değiştirme; başka bir kapı aynı anda koşuyor olabilir.)

## Yasak
commit / push / deploy / `npx convex *` / migration / DB yazma YOK. git index / checkout / stash / reset YOK.

## Rapor
`worker_done`'da ≤10 satır: bulgu sayısı + her biri tek satır (önem, file:line, özet). Ayrıntı `/tmp/c-ceo-denetim.md`.
