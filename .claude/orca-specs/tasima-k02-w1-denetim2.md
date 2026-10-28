# DENETİM 2 — K-02 W1 FIX1 (ENGEL kapandı mı + canlı teslim yollarında regresyon var mı)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. İlk denetim: `/tmp/tasima-k02-w1-denetim.md`. Fix spec:
`.claude/orca-specs/tasima-k02-w1-fix1.md`. Worker raporu: `/tmp/tasima-k02-w1-fix1-rapor.md`. Rapor: `/tmp/tasima-k02-w1-denetim2.md`.
Dosyalar (`git diff HEAD -- <dosya>`): convex/employeeTermination.ts convex/lib/accessTransfer.ts convex/lib/grantStatus.ts convex/schema.ts convex/ideSync.ts
convex/hikvisionSync.ts convex/employees.ts convex/employeeTransfer.test.ts convex/actions/hikQueueWorker.ts. (İlk denetimden bu yana değişen kısma odaklan.)
SALT-OKUMA. Aynı ağaçta başka worker yok; başka oturumun mail/PDKS/rapor WIP'i var — dokunma.

Özel dikkat (önem sırasıyla):
1. **Canlı teslim regresyonu (EN ÖNEMLİ — taşıma hiç kullanılmasa da her gün çalışan yollar):**
   - `ideSync.ts` poll/markSent: "upsertUser poll yanıtından önce sent rezerve edilir" değişikliği köprü (`scripts/ide-mqtt-bridge.mjs`, `/ide-bridge/poll|sent|ack`
     sözleşmesi) ile uyumlu mu? Eski köprü (sunucudaki 1f7da54f, yeniden kurulmadı) markSent çağırmasa/geç çağırsa iş takılır mı, attempts yanlış artar mı,
     `requeueTimedOut` doğru geri alır mı? Kapı açma (`openDoor`, mobil, attempts=1) etkilendi mi?
   - `hikvisionSync.ts` gateway retry "ağdan önce processing rezervasyonu" + 2 dk çöken-worker geri alma: normal (taşımasız) Hik retry akışı, `listRetryCandidates`,
     yerel köprü claim/requeueStale ile çakışıyor mu; aynı op iki kez gönderilebilir mi; processing'de takılı kalan iş var mı.
   - `resolveTargetFailures` / eski ACK değişikliği (`hikvisionSync.ts:~654`) normal silme/ekleme hata temizliğini bozuyor mu.
   - Taşıma koruması yalnız `terminationType==="transfer"` veya aktif devir kaynağında mı; normal pasif kişi/ziyaretçi işleri hâlâ gidiyor mu (test var mı).
2. **İlk ENGEL kapandı mı:** start sonrası hiçbir yoldan (IDE pending/failed/sent upsert, Hik pending/failed/processing ekleme, yerel köprü, gateway sync action'ın
   doğrudan çağrısı `syncEmployeeToDevicesInternal`) A'nın kartı eski cihaza yazılabiliyor mu? Özellikle start'tan önce zamanlanmış ama henüz çalışmamış
   scheduler action'ları (ör. A'nın son düzenlemesinden kalan `syncEmployeeToDevicesInternal` / `syncEmployeeToIdePanels`).
3. **Bulgu 2/3/5/7:** requestedAt sınırı doğru alanla mı (`_creationTime`), forceNew yeni kayıt açınca dedupe/çift silme kuyruğu şişiyor mu; cihaz başı 4096 okuma
   bütçesi sorgu limitine (Convex okuma sınırı) güvenli mi; `getByEmailInternal` seçimi.
4. Kota: poll/claim yollarına eklenen kişi/devir okuması her poll'da ek sorgu mu (IDE köprüsü sık poll ediyor — eski kota yangını: `ide_poll_quota_incident`).
   Ek okuma iş başına mı, poll başına mı; boş poll'da sıfır ek okuma olmalı.
