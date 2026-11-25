# P1 denetimi — 2. tur (düzeltme doğrulaması)

**Özet**
1. Toplam 13 madde: **12 kapandı, 1 kısmen** (E2: eski yüz işleri yeni indekste görünmüyor; kabul edilebilir). **Yeni Engel yok.**
2. Yeni küçük riskler (hepsi Not): yüz işleri stale temizlikten çıkarıldığı için başarısız `deleteFace` satırları süresiz kalıyor; `pdksWorkDay` kart yedeği kaldırıldığı için davranış değişti; legacy okuyucularda canlı ve geçmiş eşlemesi farklı sonuç verebilir.
3. Hedefli testler 7 dosya / 82 test geçti (`facesCleanup`, `cardReadingAudit.hik`, `doorTargetSync.cardless`, `processCardReadingCore.cardless`, `employeeFaces`, `doorFilter`, `fixF5Consistency`). `find-node-leak` çıkışı 0.

## Bulgu durumu

| # | Durum | Kanıt / not |
|---|---|---|
| E1 boş kart = kimlik | **Kapandı** | `cardKey()` (`convex/lib/employeeUx.ts`) eklendi ve şu yollara uygulandı: `findDeviceCardEmployee` (`cardReadings.ts:507` + core sarmalayıcı), mobil token `cardNo` (core:358), `byCard` Map'leri (dashboard 283/316/486, pdksWorkDay 244, reportAttendance 326/368/382), `pdksAvailability:89` / `pdksPayrollQuery:303` (artık `!employeeId` şartı var). `pdksCalc.matchEmployeeKey` ve `pdksTable` zaten `""` için falsy kontrol yapıyordu. **Kartlı eşleşme bozulmadı:** Map anahtarı yine ham `cardNumber`, `cardKey` yalnız boş mu diye bakıyor. |
| E2 yüz sorgusu proje taraması | **Kısmen** | `hikPendingOperations.employeeId` + `by_employee_operation` eklendi, op başına `take(50)`, 1000 sınırında hata fırlatma kalktı; `finishDelivery` de aynı indeksi kullanıyor. Kalan: eski yüz işleri üst seviye `employeeId` taşımadığı için görünmüyor (bkz. N-a). |
| D1 Hik canlı akış kapısı | **Kapandı** | `enrichReadingsForList` Hik cihazı başına `doors.by_device` + `readers.by_device` ile `readerNo → kapı` haritası kuruyor; çakışan numara `null` (yanlış kapıya bağlamıyor). |
| D2 `hikReaderNo` boş okuyucu | **Kapandı** | Ortak `hikDoorReaderNumbers` (`convex/lib/hikDoorReaders.ts:8`) okuyucu başına türetiyor, `both` için iki numara üretiyor. `doors.ts getPlanReaders` HEAD ile aynı (diff yok), plan tarafındaki regresyon geri alınmış. |
| D3 kartsız `employeeNo ""` cihaz yazımı | **Kapandı** | `doorTargetSync.ts:96,126,135,138` kartsızı atlıyor; `syncEmployeeDoorRights` başında `cardKey` kontrolü var (`hikSyncEmployee.ts:643`). |
| D4 geçmiş employeeNo ile başkasının yüzü | **Kapandı** | `employeeFaces.ts queueDelivery`: silmede `findDuplicateCard(employeeNo, employee._id)` başka sahip bulursa o kimliği atlıyor. |
| D5 24 saat sonra "done" | **Kapandı** | `hikvisionSync.ts:1081` `addFace`/`deleteFace`'i stale temizlikten çıkarıyor; `listForEmployee` `dismissedAt`'i "failed" gösteriyor; `delivered()` `dismissedAt`'li satırı teslim saymıyor. **Kişi silme dalları etkilenmedi:** `isPersonDeletion` filtresi ve döngüdeki `deletePerson/deleteCard` atlaması aynen duruyor. |
| D6 profil fotoğrafı blob'u | **Kapandı** | `deleteUnusedFaceBlob` (`employeeFaces.ts:61`) değiştirmede (:157) ve silmede (:182) kullanılıyor. |
| N1 bekleyen slot sayımı | **Kapandı** | `requestAttachments.ts:58-60`: tüketilmiş ve 60 sn'yi geçmiş, dosyasız slot sayılmıyor. |
| N5 kartlı kişide kartı silme | **Kapandı** | `employeeFormSchemaFor(existingCard)` hem `EmployeeForm.tsx:165` hem `useEmployeeFormSubmit.ts:68` içinde kullanılıyor. |
| N6 silinmiş cihazda yüz kilidi | **Kapandı** | `queueDelivery` kilidi ve `busy` yalnız güncel hedef cihazlara bakıyor. |
| Talep eki politika matrisi | **Kapandı** | `adminGuards.ts:64` `requestAttachments` → `block` (scan); `fixF5Consistency` geçiyor. |
| Çalışan cascade | **Kapandı** | `employeeCascade.ts:130-140`: çalışan başına en fazla 1000 ek; sınırı aşarsa hiçbir şey silinmeden hata fırlatıyor; storage ve satır birlikte siliniyor. Biletler ek silinince `consumeDownload`'da null dönüyor, cron temizliyor. |

## Yeni / kalan notlar (Engel yok)

- **N-a — eski yüz işleri görünmüyor (E2 kalıntısı):** düzeltmeden önce kuyruğa giren `addFace/deleteFace` satırlarında üst seviye `employeeId` yok. Yüz kartında bu satırlar görünmüyor ve silmede o cihazlar "geçmiş hedef" sayılmıyor; yalnız güncel hedef cihazlardan siliniyor. Eski akış başarıları zaten kaydetmiyordu (yalnız `recordSyncFailure`), P1 de henüz yayında değil. Bu yüzden canlıdaki etki eski başarısız satırlarla sınırlı. İstenirse tek seferlik bir backfill `payload.employeeId → employeeId` yazar.
- **N-b — başarısız `deleteFace` satırları süresiz kalıyor:** `cleanupStaleSyncIssues` artık bu satırları atlıyor, `purgeHik` de silinmemiş `delete*` işleri `unresolvedRevocation` sayıp saklıyor. `cleanupStaleSyncIssues` her koşuda `failed` indeksinin en eski 2000 satırına bakıyor (`CLEANUP_BATCH_SIZE*4`, cursor yok). Bu satırlar çok birikirse pencereyi doldurup daha yeni stale hataların kapanmasını engeller. Bugün olası değil. Kalıcı çözüm: taramayı `paginate` cursor'ı ile ilerletmek ya da yüz/kişi silmelerini ayrı bir indeksle hariç tutmak.
- **N-c — `pdksWorkDay.ts:251` davranış değişikliği:** okumada `employeeId` varsa ama o kişi listede yoksa artık kart yedeğine düşülmüyor. Önceden kart yeniden atanmışsa ya da kişi yeniden oluşturulmuşsa, eski kişinin okuması yeni kart sahibine yazılıyordu; yeni davranış daha doğru. Bilinçli bir değişiklik olarak commit notuna yazılmalı.
- **N-d — legacy okuyucu tutarsızlığı:** canlı zenginleştirme `readers.by_device` kullanıyor; `deviceId` alanı boş (denormalize edilmemiş) eski okuyucu kayıtları bu sorguda gelmiyor ve kapı okuyucusuz sayılıp 2N-1/2N türetiliyor. Geçmiş filtresi ise `readers.by_door` ile bu kayıtları görüyor. Özel `hikReaderNo` verilmiş eski kayıtta canlı ve geçmiş farklı kapı gösterebilir. Ayrıca bir Hik cihazında 100 kapıyı ya da 200 okuyucuyu aşınca `listLiveSince` hata fırlatıyor; pratikte olası değil.
- **N-e — `reports.ts:44`:** `employeesByCard` hâlâ ``${projectId}:${cardNumber}`` ile kuruluyor ve boş kartı ayıklamıyor. Yalnız ziyaretçi atlama kontrolünde kullanıldığı için kişiye yazma riski yok. Tutarlılık için `cardKey` eklenebilir.
