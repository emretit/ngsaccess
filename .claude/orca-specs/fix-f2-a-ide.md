# FAZ 2-A — IDE köprü teslim paketi (C-04, C-06, C-09, A2-5, timeout cron)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Rapor: `/tmp/fix-f2-a-ide-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (C-04, C-06, C-09) + `M2-cihaz.md` (C-04/06/09, eski A2-5). Önceki commit 428382a4 C-03 errorCode zincirini ekledi — onu koru.

## Ownership
`convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts`, `convex/lib/deviceHelpers.ts`, `convex/crons.ts` (YALNIZ IDE timeout satırı), `convex/http.ts` (YALNIZ /ide-bridge/* yolları),
`scripts/ide-mqtt-bridge.mjs`, `scripts/lib/ide-mqtt-routing.mjs` (+ `.nodetest.mjs`), `convex/ideSync.test.ts`, yeni `convex/fixF2Ide.test.ts`.
DOKUNMA: `convex/lib/processCardReadingCore.ts`, `convex/lib/cardReadingProcess.ts` (başka oturum yazıyor), `convex/visitors.ts`, `convex/employees.ts`.
`deleteIdeUserFromPanels`/`syncEmployeeToIdePanels` imzalarını değiştirme (yalnız opsiyonel alan ekleyebilirsin) — başka worker çağırıyor.

## Değişiklikler
1. **C-04** — `pendingForBridge`: cihazı olmayan / IDE olmayan işler `pending` bırakılmasın → terminal duruma (`failed`, `lastError: "Cihaz bulunamadı"`). `purgeDeviceCascade`
   (`lib/deviceHelpers.ts`) cihazın `idePendingOperations` kayıtlarını da silsin (sınırlı, sayfalı). Köprüde panel login hatası → ilgili işler için `errorCode: "login_failed"` ile ack;
   sunucu deneme sayacını artırsın, `maxAttempts` sonunda `failed`.
2. **C-09** — Web `openDoor` payload'una `expiresAt` (şimdi + 30 sn) ve `maxAttempts: 1`. `pendingForBridge` süresi geçmiş komutu göndermez → `failed` ("Komut süresi doldu").
   Köprü de yayınlamadan önce `expiresAt`'i kontrol etsin. Mobil kapı komutunun mevcut tek-deneme mantığıyla tutarlı olsun.
3. **C-06** — Köprü dayanıklılığı: (a) kart olayı POST'u başarısızsa olay yerel kalıcı kuyruğa (JSON satırları; dizin `IDE_BRIDGE_SPOOL_DIR`, varsayılan `./ide-bridge-spool`) yazılır,
   üstel geri çekilmeyle yeniden gönderilir, başarıda silinir; (b) ACK: HTTP başarılı olana kadar pending kaydı silinmez, ACK geri çekilmeyle tekrarlanır; sunucu `markAck` aynı
   msxId için idempotent kalsın (testle göster). Kuyruk boyutuna üst sınır (ör. 10.000 satır) + uyarı logu.
4. **Timeout cron** — `crons.ts`'te yorumdaki `requeue-ide-timeouts` 10 dakikada bir açılsın; iş yalnız index'le eski `sent` kayıtları okur (boşsa ~1 sorgu). Kota: ~4.320 çağrı/ay — rapora yaz.
5. **A2-5** — `ideSync.ts` (~649): kuralda açık kapı seçimi var ama hiçbir kapının sayısal `ioId`'si çözülemiyorsa TÜM kapılara düşme; erişim verme ve işi açık hatayla
   (`errorCode: "door_io_unresolved"`) işaretle.

## Kabul
- Testler: sahipsiz iş terminal olur ve arkasındaki sağlıklı iş gönderilir; cihaz silinince IDE kuyruğu temizlenir; süresi geçmiş web komutu gönderilmez; login_failed sayaç/terminal;
  markAck idempotent; timeout cron işi sent→pending/failed; A2-5 çözülemeyen kapı → erişim yok.
- Node testleri: olay POST hatası → spool'a yazılır, tekrar başarıda silinir; ACK HTTP hatası → pending silinmez, tekrar denenir.
- `convex/ideSync.test.ts`, `convex/doorPlanGateway.test.ts`, `convex/mobileAccess*.test.ts`, `convex/fixF0Devices.test.ts` yeşil; `node --test scripts/lib/ide-mqtt-routing.nodetest.mjs` yeşil.
