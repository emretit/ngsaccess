# FAZ 2A — DÜZELTME 2
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Önceki işler: `.claude/orca-specs/akis-faz2a-fix1.md` (commit'siz, main'de), yazar raporu `/tmp/akis-faz2a-fix1-rapor.md`, yeniden denetim `/tmp/akis-faz2a-denetim2.md` (yer/senaryo/öneri ayrıntısı orada — önce onu oku).
Rapor: `/tmp/akis-faz2a-fix2-rapor.md`.

## Hedef (test edilebilir)
Cihaza yazılamayan hak (Windows köprüsü çoklu plan) silmeyi korumaz — geri alınan kapı cihazda açık kalmaz; parçalı geri almada tek parçanın hatası kalan parçaları kaybettirmez ve görünür kuyruk satırı bırakır; başarılı ekleme sonrası kapatma kuyruk taramasını karesel büyütmez ve kart yazımını engellemez.

## İşler
E2 (ENGEL). `convex/hikvisionSync.ts:1102` `protectCurrentCredential`: "geçerli hedef" = ekleme yolunun cihaza YAZABİLDİĞİ hak. `localBridge` cihazda canlı kuralların bu cihazdaki farklı week-plan sayısı >1 ise (ya da `buildDoorPlans` boş dönüyorsa) koruma `false`. `removeScopedPerson` (`convex/actions/hikvisionSync.ts:105/:241`) ve bridge claim (`:592`) aynı kararı versin. `convex/hikvisionSync.test.ts:71` eski beklentisine dönsün (`deleteCard pending`, claim'de kapatılmaz) + yeni test: çoklu planda claim silmeyi bridge'e teslim eder. Senaryo testi: denetimdeki P / kural A-C / kapı 2 çıkarma akışı → P'nin silmesi gider.
D4. `convex/deviceSyncRuns.ts:458` `deleteOfflineHikBatch` ve `convex/accessRules.ts:52` `reconcileHikRemovalBatch`: devam parçasını İŞLEMEDEN ÖNCE zamanla; her girdiyi try/catch ile sar, hata alan için `recordSyncFailure` ile `deletePerson` + `employeeNo` satırı yaz (kişi verisi loglama yok). Mutation parçasında hata tüm transaction'ı geri almasın (girdi başına izolasyon ya da hatalıları ayrı kayda düşürme — tasarım senin). Sonsuz yeniden zamanlama yok (boş parça → dur). Test: cihaz bekleme sırasında başka projeye taşınır/silinir → kalan parçalar çalışır, hata satırı görünür.
D5. `convex/hikvisionSync.ts:1091` `supersedeDeletions`: başarılı ekleme/ack sonrası kapatmada YALNIZ `failed` statüsünü tara (pending/processing'i claim ve cron zaten koruyor). Gateway yolunda (`convex/actions/hikvisionSync.ts:300`, `convex/actions/hikQueueWorker.ts:129`) bu çağrı `addCardToDevice`'tan SONRA olsun ya da hatası kart yazımını engellemesin. Şema/indeks değişikliği YOK. Test: 500 pending addPerson ack'inde okuma sayısı doğrusal (Proxy sayaç), failed satır yine kapanır.
N1. Takılı kalan satırlar: cihaz başka projeye taşınmış ya da gateway kaydı (`hikDevIndex`) yoksa satırı D3 kapatması için "çözülemez" say; manuel tekrar bu durumda `queued:true` yerine gerçek durumu dönsün (`hikvisionSync.ts:801`, `:1050`).
N2. `listSyncIssues` satır başına `canDismiss` dönsün (çözülemez silme + super_admin); `src/components/sync/SyncIssuesBanner.tsx` X düğmesini yalnız `canDismiss` olan silme satırında göstersin; "Vazgeç" sonrası odak X düğmesine dönsün. Diğer satırlar değişmez.
N3. `reconcileHikRemovalBatch` scheduler argümanı: cihaz listesini parça başına bir kez taşı, üye başına yalnız `{employeeId, cardNumber}`.

## Ownership
`convex/hikvisionSync.ts`, `convex/actions/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`, `convex/deviceSyncRuns.ts`, `convex/accessRules.ts` (yalnız 2A parçalama/snapshot hunk'ları), `convex/lib/peopleHikSnapshot.ts`, `convex/lib/employeeCardChange.ts`, `src/components/sync/SyncIssuesBanner.tsx`, testler: `convex/hikRevocation.test.ts`, `convex/hikvisionSync.test.ts`, `convex/lib/deviceSyncRun.test.ts`, `convex/accessGrantStatus.test.ts`, `src/components/sync/SyncIssuesBanner.revocation.test.tsx`; yeni test dosyası açabilirsin (`convex/hikRevocation.*.test.ts`).
## Kapsam dışı
`convex/schema.ts` (gerekirse DUR, `ask`) · Faz 1 rol/audit hunk'ları · `convex/cardReadings.ts`, `convex/pdksRecords.ts` · `executeRuleDiffTarget` süre sınırı ve "yalnız proje değişimi" (denetim NOT'ları — rapora "bilinçli bırakıldı" yaz) · parmak izi · IDE akışı · Layout ve diğer UI.

commit/push/deploy/migration/DB yazma YOK. Rapor: değişen her test beklentisi eski→yeni + gerekçe. `worker_done`'da ≤10 satır, file:line, `--files-modified` + `--report-path /tmp/akis-faz2a-fix2-rapor.md`.
