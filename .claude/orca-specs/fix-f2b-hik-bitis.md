# FAZ 2 DALGA B-1 — Hik cihazına erişim BİTİŞİ yaz (ziyaretçi + işten ayrılan)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK listesi dahil: git add/commit/stash/checkout YOK). Rapor: `/tmp/fix-f2b-hik-bitis-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/OZET.md` 2.5 ("ziyaretçi bitişi cihaza (Hik 2037)", "ayrılma tarihi cihaza bitiş olarak").

## Hedef (test edilebilir)
Hik kişi payload'unda `Valid.endTime`, kişinin `accessEndsAtMs(employee)` değeri varsa o anın TR duvar saati (`YYYY-MM-DDTHH:mm:ss`, ofsetsiz) olur; yoksa bugünkü gibi `2037-12-31T23:59:59`.

## Hazır yardımcı (koordinatör yazdı, DEĞİŞTİRME — yalnız çağır)
`convex/lib/accessEnd.ts` → `accessEndsAtMs({ accessExpiresAt, employmentEndDate }): number | undefined` (ziyaretçi bitişi; ayrılanın son günü TR 23:59:59.999; ikisi varsa erken olan).

## Ownership
`convex/lib/gateway/persons.ts` (+ `persons.test.ts`), `convex/lib/hikSyncEmployee.ts`, `convex/hikvisionSync.ts` (yalnız `getEmployeeWithDevices` dönüşü ve ~867'deki employee alanları), `convex/actions/hikQueueWorker.ts`,
`convex/employeeTermination.ts` (+ test), yeni `convex/fixF2bHikEnd.test.ts`.
DOKUNMA: `convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts`, `convex/deviceSyncRuns.ts`, `convex/visitors.ts`, `convex/lib/grantStatus.ts` (B-2 worker'ı) · `convex/lib/processCardReadingCore.ts`, `convex/lib/cardReadingProcess.ts`, `convex/http.ts`, `convex/schema.ts` (B-3 worker'ı) · `convex/lib/accessEnd.ts`.

## Değişiklikler
1. `persons.ts`: `hikValidEndFromAccessEnd(endMs: number | undefined): string | undefined` — TR duvar saati, saniyeye kırp (`hikValidBeginFromAccessStart` ile aynı biçim). `buildPersonPayload` `endTime` verilmişse onu kullanır (zaten `p.endTime ?? DEFAULT_VALID_END`).
   Kural: bitiş ≤ başlangıç olursa (geçmiş bitiş + bugünkü varsayılan başlangıç) `beginTime`'ı bitişten 1 dk önceye çek; cihaz begin>end'i reddetmesin. Bitiş geçmişte olsa da yazılır (cihaz reddeder = istenen).
2. `getEmployeeWithDevices` + `hikvisionSync.ts:~867` + `hikQueueWorker.ts:~147` + `hikSyncEmployee.ts:~261/270`: employee'den `accessExpiresAt` + `employmentEndDate` taşınsın, `endTime: hikValidEndFromAccessEnd(accessEndsAtMs(employee))` yazılsın. Validator'ları (`returns`) güncelle.
3. `employeeTermination.ts` `terminate`: son çalışma günü BUGÜN veya İLERİDE ise (bugün `closeAccess` çağrılmıyor) cihazlara bitişi yazmak için Hik + IDE yeniden senkronu planla:
   `internal.actions.hikvisionSync.syncEmployeeToDevicesInternal` + `internal.actions.ideGatewayDevice.syncEmployeeToIdePanels` (ikisi de `{ employeeId }`; `reinstate` ile aynı kalıp). Geçmiş tarih yolu (closeAccess) değişmez.

## Kabul (testler)
- Bitişsiz kişi → `2037-12-31T23:59:59` (geriye uyum). Ziyaretçi `accessExpiresAt=2026-10-26T15:00:00Z` → `endTime "2026-10-26T18:00:00"`. Ayrılan `employmentEndDate=2026-10-31` → `"2026-10-31T23:59:59"`.
- Geçmiş bitiş → begin < end. `terminate` ileri tarihli → iki senkron planlandı; geçmiş tarihli → eski davranış.
- Mevcut testler yeşil: `convex/lib/gateway/persons.test.ts`, `convex/hikvisionSync*.test.ts`, `convex/hikRevocation.test.ts`, `convex/employeeTermination*.test.ts`, `convex/hikQueueWorker*.test.ts` (varsa).

## Kapsam dışı
IDE tarafı (B-2), olay tekilleştirme (B-3), UI. Hik kişi güncellemesi tetikleyicilerinin başka yerleri (ziyaretçi düzenleme = B-2).
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
