# FAZ 2 DALGA B-2 — IDE paketi: user.end + güncel kimlik koruması + yetki projeksiyonu + ziyaretçi küçükleri

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK listesi dahil: git add/commit/stash/checkout YOK). Rapor: `/tmp/fix-f2b-ide-rapor.md`.
Kaynak: `OZET.md` 2.5 · `/tmp/fix-f2-c-denetim.md` NOT 3 + NOT 4 · `/tmp/fix-f2-a-denetim.md` NOT 6 · IDE veri modeli `docs/ide-smart/05-crud-data-models-validation.md` (user `start`/`end` = UTC epoch saniye, 0 = sınırsız).

## Hedef (test edilebilir)
(a) IDE user kaydı `end` alanını `accessEndsAtMs(employee)`'den alır (yoksa 0). (b) Bir kartın gecikmiş `deleteUser` işi, o kart o panelde artık başka bir aktif kişiye aitse panele gönderilmez (superseded). (c) Yetki Durumu projeksiyonu IDE'de açık kapı seçimi çözülemezse tüm kapıları göstermez.

## Hazır yardımcı (koordinatör yazdı, DEĞİŞTİRME — yalnız çağır)
`convex/lib/accessEnd.ts` → `accessEndsAtMs({ accessExpiresAt, employmentEndDate }): number | undefined`. Sayısal kart anahtarı: `convex/lib/cardIdentity.ts` (`cardNumericKey`) — yalnız çağır.

## Ownership
`convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts`, `convex/deviceSyncRuns.ts` (yalnız ~738 IDE userRecord), `convex/lib/grantStatus.ts`, `convex/visitors.ts`, `convex/lib/reconcileMath.ts` (yalnız gerekirse start/end karşılaştırması),
ilgili mevcut testler + yeni `convex/fixF2bIde.test.ts`.
DOKUNMA: `convex/lib/gateway/persons.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`, `convex/employeeTermination.ts` (B-1 worker'ı) ·
`convex/lib/processCardReadingCore.ts`, `convex/lib/cardReadingProcess.ts`, `convex/http.ts`, `convex/schema.ts`, `scripts/**` (B-3 worker'ı) · `convex/lib/accessEnd.ts`, `convex/lib/cardIdentity.ts`.

## Değişiklikler
1. **IDE end** — `ideSync.ts`'e `ideUserEndFromAccessEnd(endMs: number | undefined): number` (saniyeye floor; yoksa 0). userRecord üreten HER yolda (`ideGatewayDevice.ts:~142/213`, `deviceSyncRuns.ts:~738`, varsa ideSync içi) `end` yazılsın; employee okuması `accessExpiresAt` + `employmentEndDate` içersin.
   Kural: `start > 0 && end > 0 && start >= end` ise `start = 0` (panel start≥end'i reddetmesin). Geçmiş bitiş de yazılır. Reconcile/roster farkı (`reconcileMath.ts` vb.) end'i karşılaştırıyorsa tutarlı olsun; karşılaştırmıyorsa dokunma.
2. **Güncel kimlik koruması (F2-C NOT 3)** — Hik'teki `protectCurrentCredential` (`hikvisionSync.ts:1163`, OKU, değiştirme) simetriği: IDE `deleteUser` işi panele teslim edilmeden hemen önce (`pollForBridge` / materialize noktası) ve ACK sonrası durum yazımında, aynı panelde (aynı `deviceId`) o kartı (`cardNumericKey` eşitliği) şu an taşıyan, AKTİF ve o panele erişimi olan başka bir kişi varsa iş `superseded` (ya da mevcut eşdeğer terminal durum) olsun, panele gitmesin.
   Kısa vade ek: ziyaretçi reclaim/iade yolunda ziyaretçi zaten `checkedOut/expired` ise IDE silmesi ikinci kez planlanmasın (`visitors.ts:~335`, `~562`).
3. **Projeksiyon (F2-A NOT 6)** — `grantStatus.ts:42-44`: `ruleIoIdsForPanel` (ideSync.ts:708) ile aynı mantık: açık kapı seçimi varsa YALNIZ çözülen io'lar; seçimde sayısal io yoksa kapsam boş (tüm kapılara / io=0'a GENİŞLEME YOK) + hata görünür (mevcut `door_io_unresolved` deseni). Seçim hiç yoksa bugünkü davranış.
4. **visitors.ts küçükleri** — (a) `scheduleVisitorCardRemoval` (~35) Hik cihazı yoksa (`snapshot.devices.length === 0`) Hik silme action'ını planlamasın (F2-C NOT 4). (b) Ziyaretçi düzenlemede yalnız `accessExpiresAt` değişse de Hik + IDE senkronu planlanıyor mu doğrula; planlanmıyorsa ekle (bitiş cihaza gitsin).

## Kabul (testler)
- Bitişsiz kişi `end: 0`; ziyaretçi bitişi → doğru epoch saniye; ayrılan `2026-10-31` → `Date.parse("2026-10-31T20:59:59Z")/1000`; start≥end → start 0.
- Eski kart A'dan silinirken aynı kart B'ye (aktif, aynı panel) atanmışsa deleteUser panele gitmez; B yoksa gider. Numerik eşdeğer (`00123`/`123`) de korunur.
- IDE kuralı seçili kapıları io'suzsa projeksiyon boş + hata; seçimsiz kural eski davranış.
- Hik cihazsız ziyaretçi checkout'unda Hik silme planlanmaz. Yalnız bitiş düzenlemesi senkron planlar.
- Yeşil: `convex/ideSync*.test.ts`, `convex/ideGatewayDevice*.test.ts`, `convex/deviceSyncRuns*.test.ts`, `convex/grantStatus*.test.ts` / `convex/lib/grantStatus*.test.ts`, `convex/mobileVisitors.test.ts`, `convex/visitors*.test.ts`, `convex/fixF2Cards.test.ts`.

## Kapsam dışı
Hik payload (B-1), olay işleme/köprü (B-3), kalıcı taşıma akışı (ayrı tasarım), UI. `scripts/**` köprü dosyaları.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
