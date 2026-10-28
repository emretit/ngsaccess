# FAZ 2A — DÜZELTME 3 (dar)
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Denetim: `/tmp/akis-faz2a-denetim3.md` (D-1, D-2 ve NOT "Maliyet" — ayrıntı orada). Önceki işler commit'siz main'de (`akis-faz2a-fix1.md`, `akis-faz2a-fix2.md`).
Rapor: `/tmp/akis-faz2a-fix3-rapor.md`.

## Hedef (test edilebilir)
Cihazda 4096'dan fazla failed satır olsa da köprü claim/ack/manuel tekrar/cron fırlatmaz; temizlik cron'u en eski 500 failed satır silme satırı olsa da diğer terminal satırları kapatır; köprü ack'i bu cihaz+kart için failed silme satırı yoksa yetki grafını okumaz.

## İşler
D-1. `convex/hikvisionSync.ts:1122` `supersedeDeletions`: sınırda throw YOK; best-effort `take(4096)` ile işle ve dön. Hedef tek satır (`supersedeDeletion(op._id)`) ayrıca kapanmaya devam eder. Test: cihaza 4097 failed satır → claim ve ack hata vermez, hedef silme kapanır.
D-2. `convex/hikvisionSync.ts:990-1008` `cleanupStaleSyncIssues`: silme satırlarını atlayıp sayfalamaya devam et (aynı çalışmada sınırlı sayıda sayfa, ör. en fazla 4×500; şema/indeks değişikliği YOK). Silme satırları otomatik kapanmaz (D3 kuralı korunur). Test: 500 eski failed silme satırı + 1 eski terminal `addPerson` → cron `addPerson`'ı kapatır, silmeler açık kalır.
M1. Köprü ack (`:684`) ve gateway/kuyruk ekleme sonrası temizlikte: önce bu (cihaz, employeeNo) için failed `deletePerson/deleteCard` satırı var mı bak (mevcut indeksle, sınırlı okuma); yoksa `hasWritableHikCredential` / yetki grafını OKUMA. Test: failed silme satırı yokken ack graf okumaz (Proxy sayaç ya da spy), varken eski davranış.

## Ownership
`convex/hikvisionSync.ts`, `convex/actions/hikvisionSync.ts` (yalnız M1 çağrı noktası gerekiyorsa), `convex/actions/hikQueueWorker.ts` (yalnız M1), testler: `convex/hikRevocation.test.ts`, `convex/hikvisionSync.test.ts` ya da yeni `convex/hikRevocation.cleanup.test.ts`.
## Kapsam dışı
`convex/schema.ts` · denetimdeki N1 (taşınmış cihaz — koordinatör ayrı iş açacak) · D4 NOT'ları · UI · Faz 1 hunk'ları · başka her dosya.

commit/push/deploy/migration/DB yazma YOK. Kapılar: iki tsc, değişen dosyalarda eslint, ilgili test dosyaları + tam `vitest run`. Rapor: değişen her test beklentisi eski→yeni. `worker_done`'da ≤10 satır, file:line, `--files-modified` + `--report-path /tmp/akis-faz2a-fix3-rapor.md`.
