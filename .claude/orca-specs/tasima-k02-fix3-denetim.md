# DENETİM (Codex, SALT-OKUMA) — K-02 FIX3 (koordinatör Claude yazdı)
Çalışma dizini `/Users/emreaydin/ngsaccess`. SALT-OKUMA: dosya düzenleme YOK, git add/commit/stash/checkout/reset/restore YOK, npx convex YOK, DB YOK.
Yalnız rapor yaz: `/tmp/tasima-k02-fix3-denetim.md` (≤ 40 satır, Türkçe). Karar: ENGEL / DÜZELTİLMELİ / TEMİZ. `worker_done` ≤5 satır + `--report-path`.
Bağlam: `/tmp/tasima-k02-w1-denetim3.md` (DÜZELT 1-2, NOT 3-4 bu fix'in hedefi). CLAUDE.md + `convex/_generated/ai/guidelines.md` kuralları geçerli.

Koordinatörün değiştirdiği yerler (git diff tüm worker değişikliklerini içerir; yalnız bunlara odaklan):
1. `convex/lib/transferGuard.ts`: YENİ `sourceTransfer(ctx, employee)` — aktif (`isActive !== false`) ve `terminationType !== "transfer"` kişide sorgu yok; aksi halde
   `by_employee_status` employeeId önekiyle tek aralık `take(50)`. `transferOperationFailed` artık bunu kullanıyor; `updateTransferTarget` `done` devirde
   `failed`'ı da yazıyor (superseded hariç).
2. `convex/lib/accessTransfer.ts`: `transferDeviceBusy` IDE'de yalnız `msxId !== undefined` olan `sent` upsert'i meşgul sayar; `invalidateTransferAdditions`
   msxId'siz `sent` upsert'i de `acked/"Taşıma başladı: geçersiz"` yapar.
3. `convex/lib/grantStatus.ts` `upsertGrantStatus`: effective/removed için kişi bir kez okunur + `sourceTransfer`; sonraki `Promise.all` aynı kişi belgesini
   yeniden kullanır; geç yazım silmesi (`enqueueTransferDeletion`) try/catch ile sarıldı (hata → audit, batch düşmez). `grantStatusForOperation` removed dalı
   da `sourceTransfer` kullanıyor.
4. `convex/lib/hikSyncEmployee.ts`: `getEmployeeDeliveryState` yeniden okuması sync başına bir kez (memoize promise).
5. Testler: `convex/employeeTransfer.test.ts` (yeni: rezervasyon busy değil + start'ta iptal; done devirde başarısız geç silme → target failed),
   `convex/hikvisionSync.test.ts` (runQuery sayısı 2).

Kontrol et:
- **Doğruluk:** `sourceTransfer` kapısı ("aktif devrin kaynağı her zaman `isActive:false`") her yolda geçerli mi — start, cancel (A yeniden aktif → devir cancelled),
  completeTransfer, retry; `isActive` undefined olan eski kayıtlar. Bu kapı yüzünden onay (removed) ya da geç yazım (effective) kaçırılan bir durum var mı?
  `employeeTransfer` (kaynak VEYA hedef) yerine yalnız kaynağa bakmak, eski çağrıların `transfer.employeeId === id` koşuluyla eşdeğer mi?
- **IDE rezervasyon:** msxId'siz `sent` upsert start'ta acked yapılınca, eşzamanlı gelen `/sent` (markSent) ve `/ack` doğru reddediliyor mu; panele gitmiş olabilir mi
  (köprü publish'ten ÖNCE `/sent` çağırıyor mu — `scripts/ide-mqtt-bridge.mjs` ve eski sürüm git geçmişi)?
- **try/catch:** Convex mutation'da yakalanan hatadan önce yapılmış kısmi yazım kalıyor mu; sessiz veri bozulması riski.
- **Okuma sayısı:** normal aktif kişide effective/removed başına okuma = kişi + cihaz + grant (+ removed'da hedef aralığı) mı.
- Kapılar (kendin koş): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/vitest run convex/employeeTransfer.test.ts convex/hikvisionSync.test.ts convex/ideSync.test.ts convex/accessGrantStatus.test.ts convex/fixF2bHikEnd.test.ts convex/employeeImport.test.ts`.
