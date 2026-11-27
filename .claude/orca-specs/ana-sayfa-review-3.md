# Ana sayfa özet/sayaç — 3. tur denetim (2026-11-27, Claude Opus, salt okuma)

Sonuç: E-K1, D-M1 ve D-M2 kod olarak kapandı. 60 sn lastSeen seyreltmesi alarm, heartbeat ve Hik dedup
davranışını bozmuyor. **Engel yok.** **1 Düzeltilmeli** var: proje silmeye eklenen 5 özet tablosundan
`dashboardHours` ve `dashboardDays` satırları hiç silinmiyor. Bu yüzden bir süre kullanılmış proje, okumaları
silinse bile 500 satır sınırına takılıp kalıcı olarak silinemez hale geliyor.

Koşulan testler (`vitest run --maxWorkers=2`, 27 dosya): **27/27 dosya, 692/692 test geçti.** Kapsam: 2. turdaki
16 kırık dosya + `deviceAssignment`, `deviceHelpers`, `processCardReadingCore.cardless`, `dashboardSummary`,
`dashboardWriters`, `deviceConnectivity`, `fixF5Consistency`, `w5aLegacyEquivalence`, `auditFixes`,
`readingAccess`, `dashboard.test.tsx`. Tam vitest koşusunu tekrarlamadım (rapordaki 6384/6384 değerine dayanmadım).

---

## Engel

Yok.

## Düzeltilmeli

### D-S1 — Proje silme: `dashboardHours`/`dashboardDays` birikiyor, 500 sınırı silmeyi kalıcı kilitliyor
- `convex/lib/adminGuards.ts:68-72` beş özet tablosunu `delete` politikasıyla ekliyor.
  `convex/projects.ts:121-125` her tabloyu `take(501)` ile okuyor, 500'ü aşarsa tüm işlemi `ConvexError` ile reddediyor.
- `dashboardHours` satırı sayaç 0'a inince silinmiyor, yalnız patch ediliyor (`convex/lib/dashboardSummary.ts:146-148`).
  `dashboardDays` satırı da hiç silinmiyor. Saklama (`convex/privacyRetention.ts:103-104`) yalnız `cardReadings`'i
  siliyor. Bu iki tabloyu silen başka bir yol yok (grep: `schema.ts`, `dashboard.ts:729`, `adminGuards.ts` dışında yok).
- Sayı: gün × okuma olan saat × shard. Tek cihazlı ve günde 10 aktif saati olan bir proje yaklaşık 50 günde 500'ü geçer.
  `dashboardDays` için eşik yaklaşık 500 gün.
- Senaryo: Proje pilot olarak 2 ay kullanılıyor. Sonra kişiler, cihazlar ve kurallar kaldırılıyor, okumalar saklama
  ile siliniyor (`cardReadings` = 0, engel yok). `getDeletionImpact` `canDelete:true` diyor. Sayı önizlemede 101'de
  kesildiği için yalnız "en az 101" görünüyor. `projects.remove` ise "Proje temizleme sınırı aşıldı; önce bağlı
  kayıtları azaltın" hatası veriyor. Kullanıcının bu satırları azaltacak bir arayüzü yok, yani proje kalıcı olarak
  silinemez. HEAD'de böyle bir proje silinebiliyordu, yani bu bir gerileme.
- KVKK: işlem atomik, yarım kalan silme yok. `cardReadings` 0 iken feed (`syncReadingFeed`, `:205`) ve kanıt
  (`removeEvidence`, `:121-131`) zaten boş. Takılan iki tablo yalnız sayı tutuyor, kişisel veri içermiyor.
  Yani doğrudan sızıntı yok. Risk dolaylı: proje silinemediği için ona bağlı "delete" politikalı tablolar da
  (davetler, `employeeAuth`, SMTP ayarları vb.) silinemiyor.
- Fix seçenekleri (önerilen ilk sırada):
  1. (~15 dk) `changeReading`'de `total`, `granted` ve `denied` 0'a inince `dashboardHours` satırını sil.
     O günün saat satırı kalmadıysa `dashboardDays` satırını da sil ya da `complete:true` boş gün olarak bırak.
     Not: gün satırı silinirse, sonraki ilk okuma o günü `prior.take(2)` kontrolüyle yeniden doğru kurar
     (`:134-139`). Saat satırı silinirse sayaç `?? 0` ile yeniden başlar.
  2. Proje silmede bu 3 sayısal tabloyu (`dashboardDays`, `dashboardHours`, `dashboardCounts`) 500 sınırından çıkar.
     Proje silindikten sonra bunları zamanlanmış bir `internalMutation` sayfa sayfa temizlesin. Bu satırlarda kişisel
     veri yok, yani atomik olmaları gerekmiyor. Feed ve kanıt atomik sınırda kalsın.
  - Teste ekle: 501 sıfırlanmış `dashboardHours` satırı olan projede `remove` başarılı olsun.
    Şu anki test (`convex/fixF5Consistency.test.ts:186-220`) tabloda yalnız 1 satır kullanıyor.

## Not (doğrulananlar)

- **E-K1 kapandı, test zayıflatılmamış.**
  - 18 test dosyasının sonuna `vi.mock("…/dashboardSummary", …withDashboardSummary: ctx => ctx)` eklenmiş. Örnekler:
    `convex/invites.test.ts:553-557`, `convex/lib/liveReadings.test.ts:370-374`, `convex/lib/deviceHelpers.test.ts:83`.
  - Bu mock'lar `importOriginal` ile modülün geri kalanını koruyor. İki `_generated/server` mock'una yalnız
    `mutation` export'u eklenmiş (`convex/employeeFaces.test.ts:6`, `lib/biometricDestruction.test.ts`).
  - Bu dosyalarda silinen tek bir `expect` yok (diff'te `-expect` satırı yok). Yalnız `readingAccess.test.tsx:37`
    beklenen `skip` sayısı 4'ten 5'e çıkmış: yeni `getReadingDevices` sorgusu bunu gerektiriyor ve doğru.
  - Bedeli: bu birim testlerde trigger artık çalışmıyor. Gerçek trigger kapsamı `dashboardSummary.test.ts`'te
    (`employees.remove`, retention ve eski sayfa) ve `dashboardWriters` bekçisinde. Bu kabul edilebilir.
  - Yeni test `processCardReadingCore.cardless.test.ts:108-127` `hikLastSerialNo`'nun aynı değerde yazılmadığını,
    değişince bir kez yazıldığını doğruluyor.
- **D-M1 kapandı.**
  - `convex/dataMigrations.ts:16` `new Migrations(components.migrations, { internalMutation })` kullanıyor.
    `internalMutation` hook'lu sarmalayıcıdan geliyor (`:8`).
  - Bekçi (`convex/dashboardWriters.test.ts:25-53`, `:78-85`) şunları yakalıyor: alias, `new x.Migrations`,
    eksik veya boş seçenek, yanlış değer.
  - İsim kontrolü yalnız tanımlayıcı adına bakıyor, kaynağına bakmıyor. Ancak `_generated/server`'dan ham
    `internalMutation` import'u ayrıca `unsafeRegistrations` tarafından yakalanıyor. Yani pratik bir boşluk yok.
- **D-M2 kapandı.**
  - `convex/dataMigrations.ts:148-158` üç sayaç satırını siliyor ve aynı transaction'da `initializeDashboardCounts`
    çağırıyor. Proje hâlâ 1000'den büyükse sayaç yeniden `-1` oluyor.
  - Silme hook'lu `ctx` üzerinden yapılıyor. `dashboardCounts` trigger tablosu olmadığı için yan etkisi yok.
  - `-1`'in kalıcı olduğu düzeltme raporunda açıkça yazılmış.
- **60 sn seyreltme davranışı bozmuyor** (`convex/devices.ts:413-424`, `convex/http.ts:194-213`).
  - Atlama yalnız şu koşulların hepsi doğruysa yapılıyor: `lastSeen` ve `hikLastSeenAt` son 60 sn içinde ve
    gelecekte değil; `hikOfflineHint` yok ya da ISUP durumu taze; `heartbeatOfflineEventId` yok; heartbeat bekleyen
    cihazda `heartbeatCheckAt` kurulu.
  - Bu koşullar altında `recordConnectivityTransition` (`convex/lib/deviceConnection.ts:48-87`) zaten hiçbir şey
    yazmazdı. Cihaz online, zamanlayıcı kurulu ve ISUP otoritesi aynı patch'le korunuyor (`devices.ts:427`).
  - Çevrimdışı alarm: zamanlayıcı kayıtlı son sinyale göre kuruluyor (`deviceConnection.ts:116`). Kayıtlı sinyal
    gerçek sinyalden en fazla 60 sn eski. Alarm, gerçek sessizlik 4-5 dk olduğunda çıkıyor (5 dk yerine); raporda
    yazıldığı gibi. Yanlış alarm yok: aralık 60 sn'den kısaysa kayıt aralığı 120 sn'yi geçmiyor, uzunsa her sinyal
    kaydediliyor. Test `deviceConnectivity.test.ts:290-312`.
  - Yeniden bağlanma: `heartbeatOfflineEventId` dolu olduğunda atlama olmuyor, alarm kapanıyor (test `:309-311`).
  - Tüm online eşikleri 5 dk. Kontrol edilenler: `src/lib/deviceStatus.ts:15`, `src/hooks/useDevices.ts:32`,
    `convex/doors.ts:118`, `:551`, `lib/doorOpenDispatch.ts:35`, `lib/mobileAccess.ts:290`. 60 sn gecikme
    hiçbirini etkilemiyor. Cihaz ekranında "x dk önce" en fazla 1 dk geç görünür.
  - Hik dedup `cardReadings.by_device_hik_serial` içerikle yapılıyor (`processCardReadingCore.ts:188-205`).
    lastSeen'e bağlı değil ve diff'te değişmemiş. `hikLastSerialNo` eşitlik koşulu da önceden vardı (`:242-247`).
  - `http.ts`'teki ön kontrol, istek başında okunan `authedDevice` snapshot'ına bakıyor. En kötü durumda bir
    mutation daha koşar, mutation kendi kontrolünü yine yapar. Güvenli tarafta.
- **Kapsam dışı ama gördüm:** `convex/pdksBatches.test.ts`, `src/lib/pdksAnnual.test.ts` ve
  `src/lib/pdksBatches.test.ts` ciddi biçimde yeniden yazılmış. Örnekler: haftalıktan aylık sorguya geçiş;
  `it.each([500,1000])` günlük görünüm testi "today… bounded live group" testine dönmüş. Bunlar PDKS işine ait,
  bu turda denetlenmedi. PDKS denetçisi bakmalı.
- `dashboardDays`/`dashboardHours` saklama ile hiç budanmıyor. Kişisel veri yok ama sınırsız büyüyor. D-S1 için
  önerilen 1. fix bu büyümeyi de çözer.

---

## 4. tur — D-S1 düzeltmesi (2026-11-27, Claude Opus, salt okuma)

Sonuç: **D-S1 kapandı.** Engel yok, düzeltilmesi gereken yok. Proje silme artık sayısal özet satırları yüzünden 500
sınırına takılmıyor. Kişisel veri içeren tablolar (feed ve kanıt) hâlâ aynı transaction'da, atomik siliniyor.

Testler (`vitest run --maxWorkers=2`): `fixF5Consistency`, `dashboardSummary`, `dashboardWriters` ve
`orphanGuards` dosyaları **4/4 dosya, 195/195 test geçti.** Convex `tsc` bu dosyalarda 0 hata verdi.

### Doğrulananlar
- **500 sınırı artık takmıyor.**
  - `convex/lib/adminGuards.ts:68-70` yalnız `dashboardCounts`, `dashboardDays` ve `dashboardHours` tablolarını
    `cleanup:"scheduled"` olarak işaretliyor. `:104` bu üç tablonun listesini çıkarıyor.
  - `convex/projects.ts:157` bu tabloları atomik 501 kontrolünün dışında bırakıyor. İlk 200 satır, proje silme ile
    aynı transaction'da siliniyor (`:166`).
  - Test `fixF5Consistency.test.ts:222` şu projeyi kullanıyor: 600 sıfır saat satırı, 60 gün satırı ve 3 sayaç.
    Silme başarılı oluyor ve zamanlanmış görevler bitince hedef projenin beş tablosunda da 0 satır kalıyor.
- **Feed ve kanıt (kişisel veri) hâlâ atomik.**
  - Bu iki tablo zamanlanmış listede yok, yani 500 sınırı onlar için aynen geçerli (`projects.ts:159-161`).
  - Test `:267` iki tabloda da 501 satırla silmenin reddedildiğini doğruluyor: proje, satırlar ve sayaç korunuyor,
    zamanlanmış görev oluşmuyor.
  - Test `:244-247` kişisel verinin zamanlanmış görevler çalışmadan önce silindiğini doğruluyor.
- **Zamanlanmış temizlik idempotent.**
  - Her parça indeksin başından `take(remaining)` ile okuyor, toplam 200 satır siliyor
    (`projects.ts:116-126`). Tam 200 satırla bitmezse kendini yeniden zamanlıyor.
  - Aynı işi tekrar çalıştırmak zararsız. Tam 200 satırda bittiğinde fazladan bir boş çalışma oluyor; bu zararsız.
  - Test `:259-260` eski bir görevin yeniden çalışmasını da deniyor.
- **Canlı projenin özeti silinemez.**
  - `cleanupDashboardSummaries` bir `internalMutation` (`projects.ts:129`), yani istemciden çağrılamıyor. Hook'lu
    sarmalayıcıdan geliyor (`:12`), bekçi testine uyuyor.
  - Proje hâlâ varsa görev hemen çıkıyor (`:134`). Convex id'leri yeniden kullanılmadığı için silinen projeyle aynı
    id'de yeni bir proje oluşamaz.
  - Test `:260` canlı başka bir proje için çağrıldığında o projenin satırının korunduğunu doğruluyor.

### Not
- **Görev zinciri yarıda kalırsa:**
  - Convex, zamanlanmış mutation'ları geçici hatada kendisi yeniden deniyor. Kalıcı bir hatada zincir durur.
  - Bu durumda kalan satırlar yalnız sayı tutar, kişisel veri yoktur. Elle yeniden çalıştırmak güvenli ve
    idempotent: `internal.projects.cleanupDashboardSummaries({ projectId })`.
  - Kendiliğinden yeniden deneyen bir cron yok. Silme sonrası işler için bu kabul edilebilir.
- **Silinmiş proje için yeni satır oluşur mu:** silme için cihaz, kişi, kural ve okuma sayısının 0 olması şart. Bu
  yüzden silmeden sonra o `projectId` ile yeni okuma ya da sayaç yazan bir yol görmedim. Teorik olarak sonradan
  yazılan bir satır, zincir bittiyse yetim kalır, ama yalnız sayı tutar.
- `dashboardDays` ve `dashboardHours` canlı projelerde saklama ile hâlâ budanmıyor; sınırsız büyüyor, kişisel veri
  yok. Bu 3. turdaki notun aynısı, D-S1'in kapsamı dışında kaldı.
