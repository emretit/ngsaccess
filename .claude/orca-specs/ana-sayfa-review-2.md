# Ana sayfa özet/sayaç — 2. tur denetim (2026-11-27, Claude Opus, salt okuma)

Sonuç: 1. turdaki E1 ve D1-D4 kod olarak kapandı. Kişi silme ve saklama sonrası feed ile kanıt tablosunda ad ve
kart no kalmıyor, 8 shard doğru toplanıyor, eski binary sayfalar okunuyor, eski web cihaz adını alıyor.
**1 Engel** var: yeni sarmalayıcı, sahte `ctx` kullanan 16 test dosyasında 116 testi kırıyor. Bu canlı sistemi
bozmaz ama tam vitest kapısını kırar. Bunun dışında **2 Düzeltilmeli** var: migrations bileşeni hook'suz çalışıyor,
bekçi testi de bunu yakalamıyor.

Koşulan testler (tek tek, `--maxWorkers=2`):
- Geçenler: `dashboardSummary` 22/22, `dashboardWriters` 6/6, `w5aLegacyEquivalence` 1/1, `retention` 39/39,
  `auditPrivacy` 3/3, `cardReadings.readingAccess` 94/94, `privacyRetention.fairness` 5/5,
  `src/components/dashboard/dashboard.test.tsx` 12/12, `src/hooks/readingAccess.test.tsx` 4/4.
- Kalan sahte-ctx testleri de tarandı: 22 dosyalık grupta 7 dosya kırık, 60 dosyalık grupta 9 dosya kırık
  (aşağıda E-K1). PDKS dosyaları kapsam dışı bırakıldı.

---

## Engel

### E-K1 — Sahte `ctx` kullanan 16 test dosyasında 116 test kırık (kapı engeli, canlıyı etkilemez)
- Sebep: `convex/lib/dashboardMutations.ts:6-7` her mutation'a `withDashboardSummary` ekliyor. Bu da
  `convex/lib/dashboardSummary.ts:211` → `Triggers.wrapDB` → `node_modules/convex-helpers/server/triggers.js:184-186`
  yolunda `innerDb.get/query/normalizeId.bind(...)` çağırıyor. Elle yazılmış sahte `db` nesnelerinde bu metotlar
  yok → `TypeError: Cannot read properties of undefined (reading 'bind')`. Bazı testler `_generated/server`'ı
  `mutation` olmadan mock'luyor; orada da `No "mutation" export is defined on the "../_generated/server" mock`
  hatası çıkıyor. Bu hata `employeeFaces.test.ts` ve `lib/biometricDestruction.test.ts` dosyalarını hiç yükletmiyor
  (0 test).
- Kırık dosyalar (kırık/toplam):
  - `cardReadings.doorFilter` 2/20, `employeeAuth` 5/8, `invites` 39/58, `lib/visitorStatus` 2/18,
    `lib/privacyFixes` 2/7, `lib/deviceSyncRun` 7/32, `lib/cardReadingRetention` 4/29
  - `employeeImport` 10/40, `lib/leaveValidation` 13/37, `orphanGuards` 2/152, `requestAttachments` 23/35,
    `employees.cardless` 5/6, `hikvisionSync.facesCleanup` 1/1, `employeeFaces` (yüklenmiyor),
    `lib/biometricDestruction` (yüklenmiyor), `lib/liveReadings` 1/53
- `lib/liveReadings.test.ts:152` hatası farklı görünüyor: `expected 'old' to be '001234'`. Büyük ihtimalle sebep
  aynı (wrapper sahte `patch` yolunu atlıyor), ama HEAD'de koşup doğrulamadım (PLAUSIBLE).
- Düzeltme raporu "12 dosyada 257 test geçti" diyor. Bu dosyalar o 12 dosyanın içinde değil. Proje kuralı
  `feedback_full_vitest_gate` gereği kapı tam vitest olduğu için bu iş commit'lenemez.
- Düzeltme (~20-30 dk):
  1. Ortak bir sahte-db yardımcısı yaz: `get`, `query`, `normalizeId`, `system` alanları olsun.
  2. Ya da bu testlerde `vi.mock("./lib/dashboardMutations", …)` ile ham `_generated/server` builder'larına geç.
  3. `_generated/server` mock'larına `mutation`/`internalMutation` ekle.
  4. Üretim koduna dokunma.

## Düzeltilmeli

### D-M1 — `@convex-dev/migrations` hook'suz; bekçi testi bunu göremiyor
- `convex/dataMigrations.ts:15` `new Migrations<DataModel>(components.migrations)` `internalMutation` seçeneği
  vermiyor. Bu durumda kütüphane kendi ham `internalMutationGeneric`'ini kullanıyor
  (`node_modules/@convex-dev/migrations/dist/client/index.js:232`:
  `(this.options?.internalMutation ?? internalMutationGeneric)`).
- Bu yüzden `migrations.define({ table, migrateOne })` ile yapılan her yazım trigger'sız çalışıyor.
- Bugünkü etki küçük: `backfillEmployeeDepartments` (`:46`) yalnız `employeeDepartmentHistory` yazıyor,
  `initializeDeviceHeartbeatChecks` (`:56`) cihazın `isActive`/`projectId` alanlarına dokunmuyor. Sayaç kaymaz.
- Risk: ileride `cardReadings`, `employees`, `devices` ya da `accessRules` için yazılacak bir migration (backfill,
  PII temizliği, proje taşıma) feed, kanıt ve sayaçları sessizce bozar. KVKK açısından da E1 boşluğu yeniden açılır.
- Bekçi testi bunu yakalamıyor. `convex/dashboardWriters.test.ts:9-25` yalnız uygulama kodundaki
  `_generated/server` ve `convex/server` import'larına bakıyor. Bileşen kütüphanesi içindeki ham builder görünmüyor.
- Düzeltme (~10 dk):
  1. `new Migrations<DataModel>(components.migrations, { internalMutation })` yaz. `internalMutation`
     `./lib/dashboardMutations`'tan gelsin; convex-helpers Triggers dokümanındaki desen budur.
  2. Bekçi testine kural ekle: her `new Migrations(` çağrısı `internalMutation` seçeneği taşımalı.

### D-M2 — D2 taşma işareti (`count:-1`) hiç sıfırlanmıyor
- `convex/lib/dashboardSummary.ts:175` 1000'i aşan projede `-1` yazıyor. `:183` `count < 0` ise atlıyor. Bu işareti
  geri alan bir yol yok (grep: `dashboardCounts` başka bir yerde yazılmıyor).
- Sonuç: proje 1000'in altına düşse de `getStats` (`convex/dashboard.ts:87-95`) o proje için kalıcı olarak eski
  sayım yoluna düşer. Doğruluk sorunu değil, yalnız performans sorunu (fail-safe). Tek başına bir sayacın sürüklenip
  negatife inmesi de aynı şekilde kalıcı eski yola düşürür.
- Öneri: bilinçli tercihse rapora "kalıcı" diye yaz ve elle kullanılacak bir
  `resetDashboardCounts(projectId)` internal mutation'ı ekle. Bu mutation satırı silsin ve
  `initializeDashboardCounts` yeniden koşsun.

## Not (doğrulananlar ve küçükler)

- **E1 kapandı.**
  - `convex/lib/employeeCascade.ts:3` artık hook'lu. Devam sayfaları (`:43-47`) trigger'la feed ve kanıtı aynı
    transaction'da güncelliyor.
  - Eksik, eski veya `formatVersion` olmayan günde `-1` yolu kanıtı siliyor (`dashboardSummary.ts:130`, `:139-141`).
  - Feed her durumda `after`'dan yeniden yazılıyor (`:188-197`).
  - Test `dashboardSummary.test.ts:199-218` gerçek `employees.remove` ve zamanlanmış devamla 251 satırı iki durumda
    doğruluyor. Retention `:220`, eski sayfa `:232`.
- **Zamanlanmış devam yarıda kalırsa:** her sayfa tek bir transaction. Zincir koparsa kalan okumalar kaynak
  `cardReadings`'te de anonimleşmemiş kalır. Özet tabloları kaynaktan fazla PII tutmaz, yani ek sızıntı yok. Ancak
  zincirin yeniden deneme veya tamamlanma denetimi yok (önceden de böyleydi).
- **Kişi kimliği:** kanıt satırı `employeeId` tutuyor (`dashboardSummary.ts:35`). Cascade `cardReadings.employeeId`'yi
  silmediği için kaynakla birebir aynı. Yeni bir sızıntı değil. KVKK "kimlik de gitsin" diyorsa cascade
  `employeeId`'yi de `unset` etmeli; özet bunu otomatik izler.
- **Hash (önceden de böyleydi):** `employeeCascade.ts:224-229` kart no'yu tuzsuz 32-bit hash'le `anon-xxxxxxxx`
  yapıyor. 8-10 haneli kartlar kaba kuvvetle saniyeler içinde geri bulunabilir. Feed ve kanıt aynı değeri taşıyor.
  Ayrı bir KVKK konusu.
- **D1 doğru.**
  - `dashboardShard` (`:11-15`) cihaz id'siyle, cihaz yoksa okuma id'siyle 8 kovaya dağıtıyor.
  - `-1` her zaman `oldDoc`'un cihazıyla hesaplandığı için doğru shard'dan siliyor.
  - Okuma `take(25*8=200)` 24×8=192 satırı karşılıyor (`:102`). Shard'sız eski satırlar yalnız `complete:false`
    günlerde var ve okunmuyor.
  - Shard cihaz bazlı. Cihazı az olan projede çakışma cihaz seviyesinde kalıyor; bu kaçınılmaz. 8'den fazla cihazda
    aynı kovayı paylaşan cihazlar hâlâ çakışabilir (8 kat azalma, sıfır değil). Canlı OCC ölçümü yok.
- **Codec geriye uyumlu.**
  - Yeni sayfalar `[255,0]` önekiyle başlıyor. Eski kodlayıcı 127 değerini tek bayt (127) yazdığı için `255,0` dizisi
    eski veride oluşamaz; ayrım belirsiz değil.
  - 11 bitlik `commonColumns` doğru; boş sayfa güvenli.
  - Eski format fixture testi geçiyor (`dashboardSummary.test.ts:290`).
  - Kod tek satırlara sıkışık, okunması zor ama doğru.
- **D2 sayımı doğru.** Eşzamanlı ilk başlatmada Convex OCC çift satırı önlüyor. 1006 kişide tek tarama testi
  geçiyor (`:246`).
- **D4 uyumlu.**
  - Varsayılan `includeDevices` boş olunca cihazlar dönüyor (`convex/dashboard.ts:707`, `:715-724`).
  - Eski `LiveFeed.tsx:63-79` yalnız `_id`, `employeeName`, `cardNo`, `accessTime`, `accessStatus`, `direction` ve
    `devices.name` kullanıyor; dönen şekilde hepsi var.
  - Yeni hook'ta (`src/hooks/useDashboard.ts:35-38`) `enabled` için `projectId` zorunlu, yani sonsuz yükleme yok.
  - Sıra şartı: önce Convex, sonra web yayınlanmalı. Yeni web eski Convex'e bağlanırsa `includeDevices` argümanı ve
    `getReadingDevices` reddedilir.
  - Küçük davranış farkı: başka projeye taşınmış cihazın adı artık `null` dönüyor (yetki filtresi, `:719`).
    Bu bir iyileştirme.
- **W5a snapshot** yalnız okuma izi: `w5aLegacyEquivalence.test.ts.snap:77` tek satır, `dashboardDays` için
  `unique` okuması. Sonuç ve DTO satırları değişmemiş, test geçiyor.
- **Geçersiz `accessTime`:** `trDateKey` (`convex/lib/trDate.ts:9`) geçersiz tarihte `RangeError` atıyor. Çağrı
  `dashboardSummary.ts:112`'de, saat kontrolü (`:114`) ise bundan sonra geliyor. Yani geçersiz `accessTime` içeren
  bir `cardReadings` yazımı artık tüm mutation'ı düşürür. Ingest yolları zaten doğruluyor (`processCardReadingCore.ts:181-185`
  geri dönüşlü, `cardReadings.ts:801-802`). Pratik risk düşük; istenirse `:112`'den önce `Number.isFinite(Date.parse(...))`
  ile erken dön.
- **Boyut sınırı:** `MAX_PAGES=512` × sayfa başı 48 KB üst sınır teorik olarak 16 MiB okuma sınırını aşar
  (`:8-9`, `:93`, `:152`). Gerçekte 64 satırlık sayfa yaklaşık 4-8 KB, yani 512 sayfa 2-4 MB eder. Risk yok.
  Shard sonrası gün başına en az sayfa sayısı 24'ten 192'ye çıktı; eşik yine yaklaşık 20 bin okuma.
- Auth (`convex/auth.ts`) ve rate-limiter bileşeni özet tablolarına yazmıyor. Bekçi kapsamı dışında başka bir ham
  yazıcı bulamadım. Kontrol edilenler: `.js/.mjs/.tsx` dosyası yok, `convex/server`'dan builder import'u yok.
