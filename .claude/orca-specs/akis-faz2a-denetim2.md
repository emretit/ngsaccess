# YENİDEN DENETİM — Faz 2A düzeltme 1 (GÜVENLİK, salt-okuma)
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. İlk denetim: `/tmp/akis-faz2a-denetim.md` (E1/D1/D2/D3). Düzeltme spec'i: `.claude/orca-specs/akis-faz2a-fix1.md`. Yazar raporu: `/tmp/akis-faz2a-fix1-rapor.md` — rapora değil diff'e ve kendi koştuğun kapıya dayan.
Rapor: `/tmp/akis-faz2a-denetim2.md`.
Dosyalar (git diff HEAD): convex/actions/hikQueueWorker.ts, convex/actions/hikvisionSync.ts, convex/hikvisionSync.ts, convex/deviceSyncRuns.ts, convex/lib/employeeCardChange.ts, convex/lib/peopleHikSnapshot.ts, convex/accessRules.ts (yalnız silme/snapshot/parçalama hunk'ları; rol kontrolleri Faz 1'in), convex/employees.ts, src/components/sync/SyncIssuesBanner.tsx, src/components/audit/auditLabels.ts (yalnız hikPendingOperations hunk'ı), convex/lib/auditLogQuery.ts + testler: convex/hikRevocation.test.ts, convex/orphanGuards.test.ts, convex/accessGrantStatus.test.ts, convex/hikvisionSync.test.ts, convex/lib/deviceSyncRun.test.ts, convex/lib/auditLogQuery.test.ts, src/components/sync/SyncIssuesBanner.revocation.test.tsx.

## Odak
1. E1 kapandı mı: cron / manuel tekrar / yeniden dağıtım / bridge claim yollarının HEPSİNDE silme öncesi canlı kontrol var mı; Senaryo A (yeniden yetki) ve B (eski kart başka kişiye) testleri gerçek akışı mı sınıyor. Ters risk: kontrol fazla geniş mi — yetkisi gerçekten biten kişinin silinmesi atlanabilir mi (erişim AÇIK kalır = daha ağır). "superseded" kapanışı yanlış pozitif üretebilir mi (ör. aynı kart başka projede, pasif kişi, süresi dolmuş kural, kapı hedefi var ama cihaz hedefi yok).
2. Değişen test beklentileri (rapordaki "Eski→yeni" listesi): her biri meşru mu, yoksa fail-closed silmeyi gevşetiyor mu. Özellikle `hikvisionSync.test.ts` multi-plan bridge vakası ve `orphanGuards.test.ts:219` (silinmiş kişi için IDE reconcile çağrısı kaldırıldı — spec "IDE davranışı değişmez" diyordu: silinmiş kişinin IDE panelinden temizliği başka yoldan garanti mi?).
3. D1 parçalama: `reconcileHikRemovalBatch` / `deleteOfflineHikBatch` — ilişkiler hemen silinirken scheduler argümanlarına sabitlenen hedefler doğru mu; parça arası yarış (kişi yeniden eklenir, kart değişir, kural yeniden aktif edilir); scheduler argüman boyut sınırı; sonsuz yeniden zamanlama yok mu; parça hatası görünür mü.
4. D2: patch öncesi snapshot + proje değişiminde eski projenin cihazlarından silme, yeni kart senkronu.
5. D3: super_admin + zorunlu gerekçe + audit aynı transaction; gerçek (çözülebilir) silme hatası kapatılamıyor; UI'da super_admin olmayan silme satırını kapatamıyor; diğer satırlar değişmedi; 360px/klavye kod okumasıyla.
6. Maliyet: yeni reaktif sorgu/polling yok; canlı kontrolün okuma maliyeti (by_card indeks) makul.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint <dosyalar>` · `node_modules/.bin/vitest run <test dosyaları>`.

Salt-okuma: hiçbir dosyaya yazma (rapor hariç). commit/push/deploy/`npx convex`/DB YOK.
Rapor: ENGEL / DÜZELTİLMELİ / NOT, her biri file:line + senaryo + öneri; ilk denetimdeki E1/D1/D2/D3 için "kapandı / kısmen / açık". `worker_done`'da ≤10 satır + `--report-path /tmp/akis-faz2a-denetim2.md`.
