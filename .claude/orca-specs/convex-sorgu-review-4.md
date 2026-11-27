# Convex sorgu sınırı işi — 4. tur denetim (salt okuma, 2026-11-27)

Denetçi: Claude (opus). Kod değiştirilmedi; `npx convex` ve commit yok. `git diff HEAD` + yeni dosyalar okundu.

## Sonuç (kısaca)

- **E-1 kapandı.** Grup sorgusu artık `devices` okumuyor. Heartbeat ve `hikLastSerialNo` yazımları grupları yeniden çalıştırmıyor.
- **D-2 ve D-3 kapandı.**
- **D-1 sık rastlanan durumda hâlâ açık:** projede bilinmeyen kart yoksa `todayAvailability` her okutmada günün bütün okumalarını baştan tarıyor.
- **Engel yok, 1 Düzeltilmeli var.**
- İstemciden gelen cihaz bilgisiyle sahtecilik yapılabilir, ama etkisi yalnız sahtecilik yapan kişinin kendi ekranında kalıyor. Bu yüzden Not seviyesinde.

Koşulan testler: `convex/pdksLiveDependencies`, `convex/pdksBatches`, `convex/pdksSourceVersion`,
`src/hooks/usePdksSnapshot.live`, `src/lib/pdksBatches`, `src/lib/pdksAnnual`, `convex/annualOvertimeBoundary`.
Sonuç: **7 dosya, 29/29 geçti** (33 sn).

## 3. tur kalemleri

| Kalem | Durum | Kanıt |
|---|---|---|
| E-1 cihaz yazımı tüm grupları tetikliyor | **Kapandı** | Grup sorgusu `batch.deviceAvailability` kullanıyor (`convex/lib/pdksTableQuery.ts:170`, `convex/lib/pdksAvailability.ts:54`). Cihazı okuyan tek abonelik `todayDeviceAvailability` (`convex/pdksBatches.ts:204-209`). Bu abonelik yalnız tamlık için gereken alanları döndürüyor; `lastSeen` ve `hikLastSerialNo` dönen değerde yok (`pdksAvailability.ts:13-24`). Değer değişmediği sürece grup argümanları aynı kalıyor ve gruplar yeniden çalışmıyor. Heartbeat başına maliyet: açık istemci başına 1 küçük sorgu (önceden 8/16 grup). |
| D-1 `todayAvailability` erken çıkmıyor | **Kısmen** | Aşağıda D-1 |
| D-2 sunucu tarihi | **Kapandı** | `todayRoster` ve `todayAvailability` istemciden `date` alıyor (`convex/pdksBatches.ts:168,180`). Hook seçili günü gönderiyor (`src/hooks/usePdksLiveTable.ts:17`). Gece yarısı testi var (`convex/pdksLiveDependencies.test.ts:84-99`). |
| D-3 grup boyu global yarılanıyor | **Kapandı** | Yalnız hata veren grubun anahtarı `splitIds`'e giriyor ve yalnız o grup bölünüyor (`usePdksLiveTable.ts:36-41,61-65`). Test: `src/hooks/usePdksSnapshot.live.test.ts:92` (sağlıklı abonelikler ve tarih argümanı değişmiyor). |
| N-3 geçersizleştirme | **Kapandı** | 7 yolun hepsi başarılı yazımdan sonra `invalidatePdksSnapshots()` çağırıyor: `DeviceHistoryImportCard.tsx:91`, `useEmployeeFormSubmit.ts:135`, `EmployeeTerminateDialog.tsx:33`, `EmployeeTransferDialog.tsx:48`, `EmployeeImportDialog.tsx:78`, `BatchCardAssignDialog.tsx:102` (100'lük parça başına), `DevicePersonImportDialog.tsx:169`. |

---

## Engel

Yok.

---

## Düzeltilmeli

### D-1. `todayAvailability`: bilinmeyen kart yoksa ikinci döngü günün tamamını tarıyor

`convex/pdksBatches.ts:190-196`.

1. İlk döngü yalnız bağlantısız okumalara bakıyor (`employeeId: undefined`). Uygun bir okuma bulursa hemen dönüyor. Bu kısım doğru: personel okutmaları bu aralığa düşmüyor.
2. İkinci döngü `by_project_access_time` ile **günün bütün okumalarını** geziyor (`:194`). `break` yalnız uygun bir okuma bulununca çalışıyor (`:195`).
3. Sık rastlanan durum şu: bütün okumalar roster'daki çalışanlara ait, bilinmeyen kart veya roster dışı bağlı okuma yok. Bu durumda uygun okuma hiç çıkmıyor ve `break` hiç çalışmıyor. Sorgu günün bütün aralığını okuyor; her yeni okutma onu yeniden çalıştırıyor ve tarama baştan başlıyor.
4. Sonuç: 3. turdaki karesel maliyet (≈ n²/2 belge) bu durumda aynen sürüyor. 500 kişide ~1–2 GB/gün, 1.000 kişide ~4–8 GB/gün (gerçek belge boyuyla kaba tahmin).
5. Ek risk: günde 31.000'den fazla okuma olursa okuma bütçesi (`pdksReadBudget` rows 31.000, `convex/lib/pdksTableQuery.ts:241`) hata atar ve canlı tablo hata gösterir.

**Öneri:** ikinci döngüde okumaları değil, roster dışı **çalışanları** gez.

1. `employees.by_project` ile projenin çalışanlarını oku. Bu belgeler okutmada yazılmıyor.
2. Roster'da olmayan her çalışan için `by_project_employee_time` aralığında bugünün okumalarına bak (yalnız o kişinin günü).
3. Bu şekilde okunan aralıklar personel okutmalarını kapsamaz; personel okutmaları sorguyu tetiklemez.

**Kabul testi:** `pdksLiveDependencies` izleyicisiyle `todayAvailability` için de aralıkları kaydet. Roster çalışanı adına eklenen bir okumanın hiçbir aralıkla eşleşmediğini doğrula.

---

## Not

1. **İstemciden gelen `deviceAvailability` ile sahtecilik (düşük risk).**
   - Sunucu yalnız `projectId` alanının istekteki projeyle aynı olduğunu kontrol ediyor (`convex/pdksBatches.ts:127`). `_id` cihazın gerçekten var olduğunu ya da o projeye ait olduğunu kanıtlamıyor. `hikLastBackfillAt` ve `hikBackfillPending` değerleri de kontrol edilmiyor.
   - Bu yolla neler yapılabilir:
     - Boş dizi `[]` gönderilirse cihaz okuması yapılmaz (`??` boş diziyi geçerli sayıyor, `pdksAvailability.ts:54`). Takip edilen cihaz olmadığı için "veri bekleniyor" durumu kaybolur ve kişi devamsız görünür.
     - Uydurma bir `hikBackfillPending` gönderilirse herkes "eksik veri" görünür.
     - Başka projenin cihaz `_id`'si gönderilirse hiçbir veri sızmaz: sunucu bu ID ile okuma yapmıyor.
   - Etki yalnız çağıranın kendi sonucunda kalıyor:
     - Bordro kapanışı uygunluğu sunucuda kendisi hesaplıyor (`convex/payrollPeriods.ts:58`).
     - `calculate` çıktısı hiçbir yerde saklanmıyor.
     - Aynı güven modeli zaten `readings`, `roster` ve `availableDates` argümanlarında da var: çağıran kendi görünümünü zaten değiştirebilir. Okuma yetkisi her çağrıda sunucuda kontrol ediliyor (`:111`).
   - Öneri (isteğe bağlı): `pdksBatches.ts:124-126` yorumuna "calculate çıktısı asla kalıcı kayda veya başka kullanıcıya gitmemeli" kuralını yaz. Bu sonuç ileride bordro kapanışına ya da paylaşılan bir önbelleğe bağlanırsa risk Engel olur.
2. **`pdksLiveDependencies` testi gerçek bağımlılığı ölçüyor, kendini doğrulamıyor. Ama dar.**
   - Neden güvenilir:
     - Gerçek `calculate` handler'ını gerçek convex-test veritabanıyla çalıştırıyor.
     - `withIndex` içindeki `eq` alanlarını kaydediyor ve bunları gerçek yazılan okumayla karşılaştırıyor.
     - `affected == [1]` beklentisi anlamlı: herhangi bir grup proje genelinde bir okuma aralığı tarasaydı test kırılırdı.
     - Cihaz patch'i sonrası `todayDeviceAvailability` değerinin aynı kaldığı da gerçek sorguyla doğrulanıyor (`:71`).
   - Eksikleri:
     - (a) Yalnız `db.query` izleniyor, `db.get` izlenmiyor. Şu an cihaz `get` ile okunmuyor. Ama ileride eklenecek bir `ctx.db.get(reading.deviceId)` gizli kalır.
     - (b) Negatif kontrol yok. `deviceAvailability` gönderilmeden bir çağrı yapılıp `devices` aralığının kaydedildiği gösterilmiyor; yani izleyicinin cihaz okumasını yakalayabildiği kanıtlanmıyor.
     - (c) Keşif sorgusu (`availabilityOnly:true`), `todayAvailability` ve `todayRoster` izlenmiyor. D-1 bu yüzden yakalanmadı.
     - (d) `_handler` iç API'si kullanılıyor. Kırılgan, ama convex-test'te tepkisellik olmadığı için makul.
     - (e) Aralık sınırları (`gte`/`lte`) yok sayılıyor. Bu, gerçek bağımlılıktan fazlasını sayar; güvenli tarafta kalır.
3. **Eski–yeni eşitlik: cihaz tamlık yolu eşitlik testinde hiç çalışmıyor.**
   - Canlı ↔ snapshot eşitlik testi (`convex/pdksBatches.test.ts:211-229`) 2026-06-05 tarihini ve Hikvision olmayan cihazları kullanıyor.
   - `PDKS_COMPLETENESS_START = 2026-11-17` olduğu için `withPdksDeviceAvailability` hemen çıkıyor (`pdksAvailability.ts:53`). Yani yeni `deviceAvailability` argümanı eşitlik testinde hiç kullanılmıyor.
   - Kod okumasına göre davranış eşit:
     - `trackedDevices` ve `pdksDataPending` yalnız `_id`, `_creationTime`, `brand`, `hikTransport`, `isActive`, `hikLastBackfillAt`, `hikBackfillPending` alanlarını kullanıyor; hepsi projeksiyonda var.
     - Tip `PdksDeviceAvailability`'ye daraltıldığı için başka bir alan kullanımı tsc'de yakalanır.
     - `hikBackfillPendingValidator` şemayla aynı (`convex/schema.ts:562`).
   - Öneri: eşitlik testine 2026-11-17 sonrası bir gün ve 1 gateway Hikvision cihazı (biri backfill bekleyen) ekle.
4. **D-2 tarih argümanı doğrulanmıyor.**
   - `date` serbest metin. Bozuk bir değer `trDayRangeISO` içinde `RangeError` atar; sonuç sorgu hatası olur, güvenlik açığı değil.
   - Geçmiş bir tarih gönderilirse o günün okumaları taranır. Bütçe ve proje yetkisiyle sınırlı.
   - Gelecek bir tarih boş sonuç döner.
   - TR saat dilimi tutarlı: istemci `trTodayKey`, sunucu `+03:00` kullanıyor.
   - Öneri (isteğe bağlı): `/^\d{4}-\d{2}-\d{2}$/` kontrolü ile anlaşılır bir hata mesajı ver.
5. **D-3 kalıntısı.** Bölme anahtarı grubun üye listesi. Gün içinde roster değişirse (yeni işe giren kişi) kümeler kayar ve yoğun grup yeniden birleşir. Sonrasında bir kez daha bütçe hatası verip tekrar bölünür: kısa bir "yükleniyor" ve birkaç fazla çağrı. Kalıcı patlama yok; abonelik sayısı yalnız hata veren gruplarda artıyor.
6. **Geçersizleştirme kenar durumları.**
   - `DeviceHistoryImportCard.tsx:91`: `backfill` hata atarsa (kısmi yazımdan sonra bile) `invalidatePdksSnapshots()` çağrılmıyor. Önbellek en fazla 5 dk eski kalır.
   - `catch` bloğuna da çağrı eklenebilir. Diğer 6 yol uygun.

---

## 5. tur — D-1 düzeltmesi (salt okuma, 2026-11-27)

**Sonuç:**
- D-1 kapandı: roster çalışanının okutması artık `todayAvailability`'yi tetiklemiyor ve test bunu gerçekten ölçüyor.
- Sonuç, eski tam gün taraması ile aynı. Tek fark onaylı sınırlama: bugün silinen ya da başka projeye taşınan kişinin bugünkü okuması canlı göstergeye katılmıyor.
- **1 Düzeltilmeli var:** roster dışı kişi başına 1 sorgu açılıyor. Eski çalışan ve eski ziyaretçi sayısı büyüdükçe bu, sorgu aralığı sınırını aşar.

Koşulan testler: `pdksLiveDependencies`, `pdksLiveAvailability`, `pdksBatches`, `pdksSourceVersion`, `usePdksSnapshot.live` → **5 dosya, 22/22 geçti**.

### Kontroller

| Soru | Cevap | Kanıt |
|---|---|---|
| Roster okutması `todayAvailability`'yi tetikliyor mu? | **Hayır** | Okunan aralıklar üç tane: (1) bağlantısız okumalar (`employeeId: undefined`), (2) `employees.by_project`, (3) yalnız roster dışı kişilerin günlük `by_project_employee_time` aralıkları (`convex/pdksBatches.ts:192-202`). Roster okutması bu aralıkların hiçbirine düşmüyor. |
| Test gerçekten ölçüyor mu? | **Evet** | İzleyici `eq` ile birlikte artık `gte`/`lte` sınırlarını ve `db.get` çağrılarını da kaydediyor (`convex/pdksLiveDependencies.test.ts:10-28,41-42`). Negatif kontroller hem aralık okumasının hem `get` çağrısının yakalandığını kanıtlıyor (`:96-101`). Gerçek eklenen okuma için `dependsOnReading(availability.reads) === false` doğrulanıyor (`:111`). Ayrıca roster çalışanı adına hiç aralık açılmadığı (`:113`) ve roster dışı aralığın gerçekten var olduğu (`:114`) kontrol ediliyor. Keşif sorgusu ve `todayRoster` de izleniyor. |
| Eski hesapla aynı mı? | **Evet** (onaylı sınırlama hariç) | 9 vakalık eşitlik testi eski tam gün taramasıyla birebir karşılaştırıyor: roster, eski çalışan, eski çalışan + roster kartı, bağlantısız kart, gün sınırları, kanıtsız Hik olayı (`convex/pdksLiveAvailability.test.ts:31-58`). Bugün aktif ziyaretçi roster'da; bugün çıkışı yapılmış ziyaretçi roster dışında kalıp tarandığı için o da eskisiyle aynı. Silinen/taşınan kişi canlı göstergeden düşüyor, ama tablo ve bordro değişmiyor (`:60-78`). |
| Tamlık eşitliği | **Kapandı** (4. tur Not-3) | 2026-11-27 gününde, biri tamamlanmış biri bekleyen 2 gateway Hik cihazıyla canlı = snapshot. `awaitingData` ↔ `absent` geçişi de kontrol ediliyor (`convex/pdksBatches.test.ts:233-277`). |
| Çalışan belgesi yazımı sorguyu tetikler mi? | **Evet, ama seyrek** | Kart okutma yolu `employees` belgesine yazmıyor (`processCardReadingCore`'da employee patch yok). Çalışan yazımları `patchEmployee` üzerinden yalnız yönetici işlemlerinde, içe aktarmada, işten çıkarmada ve ziyaretçi giriş/çıkışında oluyor. `todayRoster` zaten aynı aralığı okuyor, yani bu bağımlılık yeni değil. Her yeniden çalışmanın maliyeti: tüm çalışan belgeleri + roster dışı kişi sayısı kadar küçük sorgu. |

### Düzeltilmeli

**5-D1. Roster dışı kişi sayısı büyüdükçe `todayAvailability` sorgu aralığı sınırını aşar**

`convex/pdksBatches.ts:198-202` ve `convex/lib/pdksTableQuery.ts:286`.

1. Roster dışındaki her kişi için ayrı bir `ctx.db.query` açılıyor. Okuma bütçesi her `query`/`get` çağrısını 1 aralık sayıyor ve 4.090'da `PDKS_READ_BUDGET` hatası atıyor. Convex'in kendi sınırı da 4.096 çağrı.
2. Roster dışı kişiler iki gruptan oluşuyor:
   - eski çalışanlar,
   - **eski ziyaretçiler**: ziyaretçiler de `employees` tablosunda aynı `projectId` ile tutuluyor; çıkış yapınca `isActive:false` oluyor (`convex/lib/employment.ts:10`).
3. Günde 15–20 ziyaretçi alan bir sahada bu sayı 1 yılda ~4.000–7.000'e çıkar. Bu noktadan sonra "bugün" canlı tablosu kalıcı olarak "Sorgu aralığı sınırı aşıldı" hatası gösterir. Kullanıcı bu hatayı düzeltemez: tarih veya kişi filtresi daraltmak işe yaramaz.
4. Satır ve bayt bütçesi (31.000 satır / 15 MB) de aynı taramadan yeniyor:
   - Çalışan belgesi `listKeys` ve `listSearch` alanları yüzünden ~1–2 KB.
   - 10.000 kayıt ≈ 10–20 MB. Bu, hem bu sorguda hem `todayRoster`'da bayt sınırına yaklaşır.
   - Bu bayt riski `todayRoster`'da önceden de vardı; 5. tur yeni getirmedi.
5. Öneri (biri yeterli):
   - **(a)** Bugün okuması olabilecek adayları daralt. Okuması olamayacak eski kayıtları atla:
     - `employmentEndDate` 2 günden eski olan eski çalışanlar;
     - `isVisitor && isActive === false` olup son güncellemesi bugünden eski olan ziyaretçiler.
     - Dikkat: bu, cihazın geç gönderdiği okumayı kaçırabilir. O durum onaylı sınırlama kapsamına yazılmalı.
   - **(b)** Roster dışı aday sayısı 4.000'i geçerse kişi başı sorgu yerine eski tam gün taramasına (`by_project_access_time`) geri dön. Bu yalnız yedek yol olur; o projede D-1'in karesel maliyeti geri gelir.
   - **(c)** En azından bugünkü sınırı açıkça koy: roster dışı aday 4.000'i geçerse taramayı atla ve canlı göstergeyi "bilinmiyor" say. Şu anki davranış ise tüm tabloyu hataya düşürmek.
6. **Kabul testi:** 4.100 eski ziyaretçili bir projede `todayAvailability` hata vermemeli.

### Not

- `employees.by_project` taraması `for await` ile sınırsız yapılıyor (`:198`). Yalnız okuma bütçesi koruyor. `todayRoster` ise `readBoundedPdks` kullanıyor. İkisi aynı aralığı okuduğu için tutarlı, ama hata mesajları farklı.
- Erken dönüş (`return [today]`, `:201`) uygun okuma bulununca okunan aralığı orada bitiriyor. Gün içinde bir kez uygun okuma bulunduktan sonra sonraki yazımlar sorguyu çok daha az tetikliyor.
