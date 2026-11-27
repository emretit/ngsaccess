# Ana sayfa özet/sayaç — denetim (2026-11-27, Claude Opus, salt okuma)

Sonuç: Tasarım (convex-helpers Triggers + `dashboardMutations` sarmalayıcısı, eksik günde eski yola dönüş) genel olarak
doğru; gece yarısı/saat kovası, dedup, proje taşıma, pasif personel, yetki tarafında fark bulmadım. **1 Engel**
(silinen kişinin adı/kartı gölge tablolarda kalıyor — KVKK), **4 Düzeltilmeli** (OCC sıcak belge, >1000 proje
yeniden-başlatma döngüsü, bekçi testinin kapsamı, yayın sırası) var.

Koşulan testler (tek tek, `--maxWorkers=2`): `convex/dashboardSummary.test.ts`, `convex/dashboardWriters.test.ts`,
`convex/lib/deviceHelpers.test.ts`, `convex/lib/processCardReadingCore.cardless.test.ts` → **4 dosya, 27/27 geçti**.

---

## Engel

### E1 — Kişi silme anonimleştirmesinin devam sayfaları hook'suz → ad + kart no gölge tablolarda kalır
- `convex/lib/employeeCascade.ts:3` `internalMutation`'ı hâlâ `../_generated/server`'dan alıyor (ham, trigger yok).
- `cascadeRemoveEmployeePII` → `anonymizeReadingsPage` (`:191`) ilk 200 okumayı hook'lu ctx ile (employees.ts authedMutation)
  yamalar; `readings.isDone` değilse kalanlar `internal.lib.employeeCascade.anonymizeReadings` (`:45`, `:51`) ile
  **ham** mutation'da `ctx.db.patch(reading._id, { employeeName: "[silindi]", cardNo: hash })` (`:43`) yapılır.
- Sonuç: 200'den fazla okuması olan her silinen personel/ziyaretçide (≈100 iş günü) `dashboardReadingFeed`
  satırları gerçek `employeeName` + ham `cardNo`'yu, `dashboardEvidence` sayfaları ham `cardNo`'yu süresiz tutar.
  Bu, kart okumalarındaki silme/anonimleştirme garantisinin yeni tablolarda delinmesi (KVKK). Bugünün okumaları ise
  eski yolla farklı görünür (feed adı gösterir, cardReadings "[silindi]").
- Aynı dosyada `maskEmployeeAudit`, `deleteCheckInTokens`, `clearHostedVisitors` de ham; sadece okuma yamalayan
  `anonymizeReadings` özet açısından kritik.
- Düzeltme: `employeeCascade.ts:3` → `import { internalMutation } from "./dashboardMutations";` (ya da
  `anonymizeReadingsPage` başına `ctx = withDashboardSummary(ctx)`). Test: >200 okumalı kişiyi gerçek
  `employees.remove` + `t.finishAllScheduledFunctions` ile sil, feed/evidence'ta ad/kart kalmadığını doğrula
  (mevcut testler hook'u `withDashboardSummary(raw).db.delete` ile doğrudan çağırıyor, üretim mutation'ını değil —
  `dashboardSummary.test.ts:63,74`).

## Düzeltilmeli

### D1 — OCC: proje × saat başına tek sayaç + tek "son sayfa" belgesi (shard yok)
- `convex/lib/dashboardSummary.ts:106-118`: her kart okuması aynı `dashboardHours` (proje,gün,saat) belgesini ve
  `dashboardEvidence` son sayfasını (`order("desc").first()`) okuyup yazar. Aynı projede aynı saatteki **tüm**
  `processCardReading`/backfill mutation'ları birbirleriyle çakışır; önceden ortak bir belge yoktu (cihaz başına
  `lastSeen` vardı).
- Risk: 200 cihazlı tek projede vardiya girişi veya cihaz geri gelince gelen toplu Hik/IDE backfill'i canlı okumalarla
  çakışır → otomatik yeniden deneme, kapı kararı gecikmesi; uzun süren toplu backfill mutation'ı (çok satır yazan) her
  denemede baştan koşar, sınırda OCC hatasıyla düşebilir. Rapor da "canlı OCC ölçülmedi" diyor
  (`docs/convex-audit/DASHBOARD_SUMMARY_2026-11-27.md` Ölçüm §).
- 20 firma ayrı projelerde olduğundan firmalar arası çakışma yok; sorun tek büyük projede.
- Öneri: saat belgesini ve evidence sayfasını `deviceId` (ya da `readingId` hash % N, N≈8) ile shard'la; okuyucu
  tarafı zaten `take(25)`/sayfa toplamı yaptığı için `take(25*N)` ile toplar. En azından yük testinde eşzamanlı
  100 insert ile retry sayısını ölç.

### D2 — >1000 kayıtlı projede sayaç her yazımda yeniden 1001 satır okur (durmayan başlatma)
- `dashboardSummary.ts:140-146`: >1000 ise sayaç belgesi **yazılmıyor**; `changeCount` (`:152-154`) sayaç yoksa her
  seferinde `initializeDashboardCounts` çağırıyor; `changeReading` de her yeni günde (`:101`) çağırıyor.
- Sonuç: >1000 personelli projede her personel insert/delete/proje taşıma 1001 employee belgesi okur. Tek mutation'da
  toplu ekleme (`hikDeviceImport.createPersons`, Excel içe aktarma, toplu silme) N × 1001 okuma → 16 MiB / belge
  okuma sınırına birkaç düzine kayıtta takılıp tüm işlem düşebilir; ayrıca tüm employee aralığını read-set'e aldığı için
  eşzamanlı personel yazımlarıyla OCC çakışır.
- Öneri: taşma durumunda `{ kind, count: -1 }` (veya `overflow: true`) işaret belgesi yaz, `changeCount` bunu görünce
  hiçbir şey yapmasın; `getStats` işaretliyse eski yola düşsün.

### D3 — Bekçi testi yalnız `insert("cardReadings")` metnine bakıyor
- `convex/dashboardWriters.test.ts:9-13`: patch/delete/replace yolları, `employees/devices/accessRules` yazıcıları ve
  "hook'lu dosyadaki yardımcıyı ham mutation'dan çağırma" deseni kapsanmıyor. E1 tam bu boşluktan geçti.
- Ayrıca dosya `dashboardMutations` import ediyorsa geçiyor; aynı dosyada ham `internalMutation` da olabilir.
- Öneri: `convex/**` içinde `from "…/_generated/server"` ile `mutation|internalMutation` import eden üretim dosyası
  sayısını 0'a zorla (izinli liste: `lib/dashboardMutations.ts`). Şu an bu durumdaki 30 dosya var (ör.
  `accessRules.ts:32`, `hikDeviceImport.ts:5`, `doors.ts:7`, `users.ts:11`, `lib/employeeCascade.ts:3`); bugün
  özet-etkili yazım yaptığını gördüğüm tek yer E1, ama `hikDeviceImport.ts:88` hook'suz `insert("accessRules")`
  yapıyor (şimdilik `isActive:true` → sayaca katkı 0, kırılgan).

### D4 — Yayın sırası: eski web paketi `devices` alanını kaybeder
- `convex/dashboard.ts:751-752` `getRecentReadings` artık `devices` döndürmüyor; cihaz adı
  `getReadingDevices` (`:819`) + `src/hooks/useDashboard.ts:37` ile birleşiyor.
- Convex önce yayınlanıp web (Netlify elle) sonra yayınlanırsa, aradaki sürede canlı ana sayfa "Son okumalar"da
  her satır "Cihaz bilgisi yok" gösterir (`src/components/dashboard/LiveFeed.tsx:64`). Veri kaybı yok, görsel.
- Öneri: Convex + web aynı yayın penceresinde, ya da bir sürüm boyunca sunucuda `devices` alanını da döndür.

## Not

- **Gün sınırı / dedup / backfill / taşıma / pasif**: `trDateKey` + `trCalendarDate().getUTCHours()` sayaçla birebir
  (`dashboardTimeline.ts`); dedup yolları insert yapmadığı için çift sayım yok; geç gelen okuma kendi gününün belgesine
  gider; yayın öncesi verisi olan gün `complete:false` kalır (`dashboardSummary.ts:97-99`) ve eski yol sürer; patch'te
  -1/+1 ile gün/proje değişimi doğru; sayaç semantiği eski indekslerle aynı (employees=tümü dahil pasif/ziyaretçi,
  devices=isActive true, accessRules=isActive false). Fark bulmadım.
- **Yetki/IDOR**: `getStats`/`getTodayTimeline`/`getRecentReadings` özet yoluna yetki kontrolünden sonra giriyor;
  `getReadingDevices` `resolveReadingScope` (üye değilse/izin yoksa throw) + `device.projectId === projectId` filtreli.
  Sorun yok.
- **Retention/silme**: `privacyRetention.ts` hook'lu → feed/evidence/sayaç düşüyor. Ancak eski günlerin silinmesi
  her proje×gün için `complete:false` boş `dashboardDays` satırı üretir (`dashboardSummary.ts:96-103`); bu tablolar
  ve `dashboardHours`/boş evidence sayfaları hiç temizlenmiyor. `dashboardReadingFeed` her okuma için kalıcı kopya
  (cardReadings ile birlikte siliniyor, ama depolama ~+%20-30). Küçük; ileride gün > N olanları silen cron.
- **Yayın günü geçişi**: tek seferlik işlem gerekmez, doğru. Teorik pencere: yayın anında eski sürüm mutation'ı yeni
  sürümün "günün ilk okuması"ndan sonra commit olursa o okuma o gün özette eksik kalır (ms seviyesinde; yayını gece
  yarısına yakın yapmamak yeter).
- Çift-sarma (`hookMarker`) güvenli: başka `db` sarmalayıcısı yok (grep `wrapDB|innerDb|wrapDatabaseWriter`).
- Kapsam dışı dokunuş: `convex/lib/pdksTableQuery.ts:375` değişikliği bu işin diff'inde görünüyor (cardNumber boş
  koruması) — PDKS worker'ının dosyası; sahibi kim, koordinatör netleştirsin.
