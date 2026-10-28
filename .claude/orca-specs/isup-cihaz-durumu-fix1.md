# ISUP CİHAZ DURUMU — DÜZELTME 1 (dar)
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Önceki iş commit'siz main'de: spec `.claude/orca-specs/isup-cihaz-durumu.md`, yazar raporu `/tmp/isup-durum-rapor.md`, denetim `/tmp/isup-durum-denetim.md` (ayrıntı orada — önce onu oku).
Rapor: `/tmp/isup-durum-fix1-rapor.md`.

## İşler
E1 (ENGEL). `infra/hik-event-bridge/bridge.mjs:194`: canlı `devStatusChanged` olayında `at` = köprünün alma anı (`Date.now()`); gateway `dateTime`'ı KULLANMA (saat/zaman dilimi kayması olayları sessizce düşürüyor ya da 5 dk beklemeyi atlatıyordu). Snapshot zaten alma anı. Node testi: gateway dateTime 3 sa geri/ileri olsa da gönderilen `at` alma anı.
D1. `convex/http.ts:30` + `convex/devices.ts:1306`: `at` alt sınırı `now - 10 dk`; altı 400 (http) ve mutation'da yok sayılır. Test: eski tarihli offline/online dizisi geçiş/alarm üretmez.
D2. `convex/devices.ts:1285` `isupOutageAlarm`: `first()` yerine ISUP alarmını güvenle bul — rawData'ya `source:"isup"` + `offlineFrom` yaz ve sınırlı okumayla (`take(10)` + eşleşme) ara. Test: denetimdeki senaryo (ISUP açık alarm → köprü susar → eski yoldan yeni çözülmüş arıza kaydı → köprü döner online) → ISUP alarmı çözülür.
N5. `bridge.mjs:318`: yeniden abonelikte son snapshot < 5 dk önceyse snapshot atla (saatlik zamanlayıcı aynen). Node testi.
N6. `bridge.mjs:262` `sendSnapshot`: kuyruk dolu düşmeleri `sent` sayılmasın.

## Ownership
`infra/hik-event-bridge/bridge.mjs`, `infra/hik-event-bridge/bridge.nodetest.mjs`, `infra/hik-event-bridge/RUNBOOK.md` (zaman notu), `convex/http.ts` (yalnız yeni route), `convex/devices.ts` (yalnız ISUP hunk'ları), `convex/hikIsupStatus.test.ts`.
## Kapsam dışı
Denetim N1 (kuyruk worker online tanımı), N3 (UI son görülme), N4 · schema · UI · başka her dosya.

commit/push/deploy/`npx convex`/DB/SSH YOK. Kapılar: iki tsc, değişen dosyalarda eslint, `vitest run convex/hikIsupStatus.test.ts convex/deviceConnectivity.test.ts convex/alarmDelivery.test.ts`, `node --test infra/hik-event-bridge/bridge.nodetest.mjs`, tam `vitest run`. `worker_done`'da ≤10 satır, file:line, `--files-modified` + `--report-path /tmp/isup-durum-fix1-rapor.md`.
