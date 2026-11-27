# Convex sorgu sınırı işi — 3. tur denetim (salt okuma, 2026-11-27)

Denetçi: Claude (opus). Kod değiştirilmedi; `npx convex`, tam vitest/tsc ve commit yok. `git diff HEAD` okundu
(PDKS dosyaları; dashboard/schema kapsam dışı).

## Sonuç (kısaca)

2. turun **3 Düzeltilmeli kalemi kapandı**. Not-9 da kapandı (silinen çalışan artık yüklemeyi düşürmüyor; yetki hatası
ayrı mesaj veriyor).
Ama **1 yeni Engel** var: "bugün" canlı görünümü, kart okutulunca yalnız kişinin grubunu değil **bütün grupları**
yeniden çalıştırıyor. Sebep: her grup sorgusu projenin `devices` belgelerini okuyor, cihaz belgesi de her okutmada ve
her heartbeat'te yazılıyor. Ayrıca **3 Düzeltilmeli** var.

Koşulan testler (tek tek, 18 dosya): convex/pdksBatches, src/lib/pdksBatches, src/lib/pdksAnnual,
annualOvertimeBoundary, pdksSourceVersion, usePdksSnapshot.live, pdksErrors, readingAccess, HolidayCalendarManager,
OvertimeSettingsForm, PdksRulesSettings, LeaveRequestsPanel, AssignmentEditDialog, ShiftDeleteImpact, assignmentPlans,
ManualPdksEditDialog.refresh, CorrectionRequestsPanel, ReportPage → **139/139 geçti**.
Ancak canlı testi (`usePdksSnapshot.live.test.ts`) `useQueries`'i mock'luyor. Convex'in hangi yazımda hangi sorguyu
yeniden çalıştırdığını **hiçbir test ölçmüyor**. Ölçüm JSON'unda `dailyLive` için sayı yok, `productionUsageMeasured:false`.

## 2. tur kalemleri

| Kalem | Durum | Kanıt |
|---|---|---|
| D-1 ayar değişince eski okuma önbelleği | **Kapandı** | Anahtarda sürüm var (`src/lib/pdksBatches.ts:36,44`). Sürüm = workSettings/overtimeRates `updatedAt` + kural `_id,createdAt` + tatiller (`convex/pdksBatches.ts:47-57`). `saveOvertime` `updatedAt` yazıyor (`convex/settings.ts:186-202`). Kural `replace` edilince `createdAt` yenileniyor (`convex/pdksRules.ts:197`). Sunucu hem aralığı (`assertPdksSourceRange`, `:65-67`) hem sürümü (`:111-117`) kontrol ediyor. Test: günlük→haftalık (`convex/pdksSourceVersion.test.ts:9`). |
| D-2 yıllık ~1.650 çağrı | **Kapandı** | Ay başına tek parça, grup 64 (`src/lib/pdksAnnual.ts`). 500 kişi: 12 ay × 8 grup = 96 hesap çağrısı. Roster, yetki, sürüm ve bağlantısız kart sayfalarıyla toplam 115 (JSON + `src/lib/pdksAnnual.test.ts:83`). 1.000 kişide ~216. Çok gruplu + mükerrer/bağlantısız kart eşitlik testi eklendi (`convex/annualOvertimeBoundary.test.ts:32`). |
| D-3 bugün canlı değil | **Kapandı, ama Engel E-1 getirdi** | Bugün = başlangıç = bitiş ise `usePdksLiveTable` kullanılıyor (`src/hooks/usePdksSnapshot.ts:37-42`). Bugünü içeren snapshot aralıklarında önbellek atlanıyor (`src/lib/pdksBatches.ts:47`). "Son güncelleme / Canlı" etiketi eklendi (`src/pages/PDKSRecords.tsx:115-116`). Canlı ↔ snapshot eşitlik testi 500 ve 1.000 kişiyle var (`convex/pdksBatches.test.ts:210`). |
| Not-4 geçersizleştirme | **Büyük ölçüde kapandı** | Ayar, kural, tatil, vardiya, atama ve izin formları `invalidatePdksSnapshots()` çağırıyor. Sekmeler arası `storage` olayı da eklendi (`src/lib/pdksInvalidation.ts:7-18`). Eksik yollar aşağıda N-3'te. |
| Not-9 silinen çalışan / yetki mesajı | **Kapandı** | `calculate` silinen çalışanı atlıyor (`convex/pdksBatches.ts:119-123`), `month` da atlıyor (`convex/pdksAnnual.ts:50-55`). `PDKS_FORBIDDEN` ayrı mesaj veriyor (`src/lib/pdksErrors.ts:8`). |

---

## Engel

### E-1. Canlı "bugün" tablosunda her kart okutma ve her cihaz heartbeat'i bütün grupları yeniden hesaplatıyor

**Zincir:**
1. Grup hesabı (`availabilityOnly:false`) projenin bütün cihazlarını okuyor:
   `withPdksDeviceAvailability` → `ctx.db.query("devices").withIndex("by_project")` (`convex/lib/pdksTableQuery.ts:169-171` →
   `convex/lib/pdksAvailability.ts:38`). Keşif sorgusu buraya gelmeden çıkıyor (`pdksTableQuery.ts:162`), sonuç sorgusu ise geliyor.
2. Cihaz belgeleri sık yazılıyor:
   - Hik'te her olayda: `ctx.db.patch(device._id, { hikLastSerialNo })` (`convex/lib/processCardReadingCore.ts:246`).
   - `/card-reader`'a gelen her POST'ta, heartbeat dahil: `updateLastSeen` → `patch({ lastSeen, hikLastSeenAt })`.
     Seyreltme yok (`convex/http.ts:189-193`, `convex/devices.ts:413-417`).
   - Sanal okuyucu ve QR: `virtualReaders.ts:96,137`, `lib/visitorPass.ts:133`.
3. Convex, okunan aralıktaki bir belge değişince sorguyu yeniden çalıştırır. Bu yüzden **her cihaz yazımı bütün
   sonuç gruplarını** yeniden çalıştırıyor.

Kodun iddiası "one new badge event recomputes its group" (`src/hooks/usePdksLiveTable.ts:11`). Bu iddia, cihaz belgesi
yazan her yol için **yanlış**. Pratikte bütün yollar cihaz belgesi yazıyor.

**Sayılar** (grup 64 kişi, `usePdksLiveTable.ts:14`):

| | 500 kişi | 1.000 kişi |
|---|---|---|
| Grup | 8 | 16 |
| Eşzamanlı abonelik (2×grup + roster + bilinmeyen kart) | **18** | **34** |
| Kart okutma başına yeniden çalışma (tüm sonuç grupları + kendi keşfi + `todayAvailability`) | **10** | **18** |
| Cihaz heartbeat'i başına yeniden çalışma | 8 | 16 |

**Neden ağır:** varsayılan mesai esası `weekly45` (`convex/lib/pdksHelpers.ts:96`). Bu yüzden "bugün" için okunan aralık
Pazartesi'den bugüne uzanıyor (`convex/lib/overtimeCalc.ts:108-110`). Cuma günü bir grup ≈ 64 × 5 gün × 4 okuma ≈
1.280 okuma okuyor. Gerçek belge ~0,5–1 KB → grup başına ~0,6–1,3 MB.

**Tahmini DB I/O (kaba; üretim ölçümü yok):**
- Bir tam yeniden çalışma: 500 kişide ~5–10 MB, 1.000 kişide ~10–20 MB.
- Günlük okutmalar 2.000 / 4.000 → sayfa açıkken **~8 GB/gün (500)**, **~30 GB/gün (1.000)**. Heartbeat yazımları
  buna ek.
- Free planın DB I/O sınırı 1 GB/ay (`docs/convex-audit/CONVEX_OLCEK_2026-11-27.md:34`). Sabah girişlerinde bu sınır
  saatler içinde dolar.
- Fonksiyon çağrısı: 500 kişide okutma başına 10 → ~20 bin/gün. Dakikada 1 heartbeat atan 10 cihaz ise
  14.400 × 8 = ~115 bin/gün daha ekler. Bu, açık her kullanıcı için ayrı sayılır: authed sorgunun önbelleği kimliğe bağlı.
- `dailyShift` esasında bile 500 kişi ≈ 3 GB/gün.
- Rapor sayfası da günlük "bugün"de aynı canlı yolu kullanıyor (`src/components/reports/ReportResults.tsx`).

**Öneri (biri yetmez, ilk ikisi birlikte):**
1. Grup sorgusu `devices` okumasın. Cihaz tamlık bilgisini (brand, hikTransport, isActive, hikLastBackfillAt,
   hikBackfillPending) tek bir küçük `todayDeviceAvailability` aboneliği döndürsün, gruplara argüman olarak gitsin.
   Bu değerler yalnız backfill olunca değişir; `lastSeen` ve `hikLastSerialNo` değişimleri grupları tetiklemez.
2. `lastSeen` / `hikLastSerialNo` gibi sık yazılan alanları `devices` belgesinden ayrı bir tabloya taşı, ya da
   `lastSeen` yazımını seyrelt (ör. 60 sn'den eskiyse yaz). Bu, cihaz belgesi okuyan bütün canlı sorgulara (ana sayfa dahil) fayda sağlar.
3. Kabul testi: convex-test ile bir cihaz `patch` ve bir kart okutma sonrası hangi grupların yeniden çalıştığını ölçen
   test (ör. sorgu başına okunan tabloları kaydeden bir sarmalayıcı).

---

## Düzeltilmeli

### D-1. `todayAvailability` her okutmada günün bütün okumalarını baştan tarıyor ve erken çıkmıyor
- `convex/pdksBatches.ts:185-187`: projenin bugünkü bütün okumaları `for await` ile geziliyor. `dates.add(today)`'den
  sonra `break` yok. Sorgu her yeni okumada yeniden çalışıyor, çünkü okunan aralık günün tamamı.
- Maliyet gün içinde karesel büyüyor. Günde n okuma için toplam ≈ n²/2 belge:
  - 500 kişi (2.000 okuma) ≈ 2 M belge ≈ **1–2 GB/gün**.
  - 1.000 kişi (4.000 okuma) ≈ 8 M belge ≈ **4–8 GB/gün**.
  - Bu, E-1'e ek.
- Test yalnız tek çalışmanın boyutunu ölçüyor (`convex/pdksSourceVersion.test.ts:59-79`), yeniden çalışmayı ölçmüyor.
- Öneri: ilk uygun okumada `break`. Böylece okunan aralık o belgede biter ve sonraki okumalar sorguyu tetiklemez.
  Daha iyisi önce `by_project_employee_time` + `employeeId: undefined` ile yalnız bağlantısız okumalara bakmak.
  Roster dışı bir çalışana bağlı okumalar için ikinci, `take`'li bir tarama gerekir.

### D-2. `todayRoster` / `todayAvailability` tarihi sunucuda hesaplıyor; gece yarısından sonra dünün sonucu kalıyor
- İkisi de `trTodayKey()` kullanıyor ve `date` argümanı almıyor (`convex/pdksBatches.ts:168,180`).
- Convex sorgu sonucunu argümana göre önbelleğe alır; zaman geçti diye sorguyu yeniden çalıştırmaz. Gece yarısından
  sonra aynı `{projectId, roster}` ile dünün sonucu döner:
  - `todayAvailability` dünün aralığını okuduğu için oraya yeni yazım gelmez; sonuç uzun süre eski kalır.
  - `todayRoster` dünün `employedDuring` sonucunu verir: bugün başlayan kişi eksik, dün ayrılan kişi listede.
- İstemci yeni günü seçince `calculate` argümanında `date` değişiyor, ama bu iki abonelik değişmiyor.
- Öneri: iki sorguya da istemcinin gönderdiği `date` (bugün) argümanı ekle ve sunucuda o tarihi kullan.

### D-3. Bütçe hatasında grup boyu bütün tablo için yarıya iniyor ve geri büyümüyor
- `src/hooks/usePdksLiveTable.ts:51`: tek bir yoğun küme bütçeyi aşınca (ör. binlerce okumalı test kartı)
  `groupSize` herkes için 64 → 32 → … → 1'e kadar iniyor.
- `:52`'deki sıfırlama yalnız argüman değişince çalışıyor.
- 1.000 kişide grup boyu 1'e inerse ~2.000 abonelik açılır. E-1 ile birlikte her cihaz yazımı 1.000 sorguyu yeniden
  çalıştırır.
- Snapshot yolunda bölme yalnız hata veren grupta yapılıyor (`src/lib/pdksBatches.ts:128-133`). Canlı yol bu
  davranıştan ayrışıyor.
- Öneri: bölmeyi yalnız hata veren grup için yap (grup başına alt bölme haritası). Global boyu değiştirme.

---

## Not

1. **Yeniden deneme döngüsü sonsuz değil:**
   - Tablo/bordro: `retryStale` en fazla 1 kez tekrar deniyor (`src/lib/pdksBatches.ts:180-183`).
   - Yıllık: `retry` 1 olunca hata atılıyor (`src/lib/pdksAnnual.ts:98-105`).
   - Canlı yolda otomatik tekrar yok. Yarıya bölme en fazla 6 adım sürüyor.
   - `storage` olayı yalnız yerel olay yayıyor, localStorage'a geri yazmıyor; sekmeler arası ping-pong yok
     (`src/lib/pdksInvalidation.ts:10-14`).
2. **Önbellek sızıntısı yok:**
   - Kaynak önbelleği istemci başına (`WeakMap`). Anahtar proje + sürüm + epoch içeriyor.
   - Önbelleğe ulaşmadan önce `rosterPage` ve `sourceVersion` çalışıyor; ikisi de `requirePdksReportAccess` ile kontrollü
     (`convex/pdksBatches.ts:42-45,58-63`).
   - Okuma yetkisi proje düzeyinde, departman kapsamı yok (`convex/lib/readingAccess.ts:13-27`). Aynı projeyi gören iki
     kullanıcının aynı okumaları paylaşması sızıntı değil.
   - Yıllık anahtarda `accountId` var ve önbellek isabetinden önce yetki yeniden kontrol ediliyor.
   - localStorage yalnız zaman damgası tutuyor.
3. **Geçersizleştirmenin eksik kaldığı yollar** (hepsi en fazla 5 dk eski kalır, "Verileri yenile" düzeltir):
   - Cihaz geçmişi aktarımı (`src/components/devices/DeviceHistoryImportCard.tsx:60`, `backfillDeviceEvents`) geçmiş
     günlere okuma yazıyor ama çağrı yok. Geçmiş haftanın okuma önbelleği eski kalır.
   - Çalışan formu, işten çıkarma, transfer, Excel içe aktarma, toplu kart atama ve cihazdan kişi aktarma
     (`useEmployeeFormSubmit.ts`, `EmployeeTerminateDialog.tsx`, `EmployeeTransferDialog.tsx`,
     `EmployeeImportDialog.tsx`, `BatchCardAssignDialog.tsx`, `DevicePersonImportDialog.tsx`) çağrı yapmıyor. Tablo
     roster'ı her yüklemede taze, ama yıllık sonuç roster'ı içerdiği için 5 dk eski kalabilir.
   - Kapı ↔ okuyucu ataması değişirse kural kapsamı değişir ve önbellekteki `unassignedDate` eskir. Bu durum sürüm
     anahtarında yok.
   - Mobil: izin ve düzeltme talepleri web'de onaylanınca geçersizleştiriliyor. Mobil giriş "bugün"e düştüğü için canlı
     yoldan görünüyor. Cihazın çevrimdışı tamponu (HTTP/MQTT ile geçmiş tarihli olaylar) ve başka yöneticinin
     düzenlemeleri tarayıcıya sinyal vermiyor; yalnız 5 dk süre sınırı koruyor.
4. **Eski–yeni sonuç farkı (yıllık):**
   - `unlinkedPage` yalnız `employeeId: undefined` okumaları getiriyor (`convex/pdksAnnual.ts:35`). `month` ise yalnız
     roster çalışanının `employeeId`'sine bağlı okumaları okuyor (`:69-70`).
   - 2. turdaki istemci yolu ve tablo hesabı (`convex/lib/pdksTableQuery.ts:376-377,383-385`), **roster dışı bir
     çalışana bağlı ama kartı artık aktif bir çalışanda olan** okumaları kart sahibine sayıyordu. Yıllık artık saymıyor.
   - Sonuç: kart başka kişiye devredilmişse yıllık toplam ile PDKS tablosu farklı çıkabilir. Bu durum test edilmiyor.
   - Hangisinin doğru olduğu ürün kararı. İki yolun aynı kuralı kullanması gerekir.
5. **Yıllık hesabın I/O'su:**
   - Ölçüm fixture'ında açılış başına 1,10 GB okunuyor (`PDKS_REVIEW_2_2026-11-27.json`; okuma başına 1.600 B dolgu var).
     Gerçek belge boyuyla 500 kişi × tam yıl ≈ 0,3–0,5 GB eder.
   - Yalnız Uyarılar panelinde, isteğe bağlı açılıyor (`PdksWarningsSheet.tsx:22-27`). 5 dk önbellekli.
   - Free planda ayda 2–3 açılış sınırı doldurur. Uzun vadede aylık hazır özet tablosu gerekir.
6. **Etiket:** snapshot görünümünde, veri az önce hesaplanmış olsa bile hep "· Önbellekteki son hesaplama" yazıyor
   (`src/pages/PDKSRecords.tsx:116`). Bugünü içeren haftalık/aylık görünüm canlı değil; yalnız önbellek atlanıyor
   (`src/lib/pdksBatches.ts:47`). Bilinçli tercih olabilir, ama kullanıcıya söylenmeli.
7. **Küçük maliyetler:**
   - Tam roster (1.000 kişi ≈ 60 KB) her grup aboneliğinin argümanında gidiyor (34 abonelik).
   - `updatedAt` için her render'da tüm satırlar `JSON.stringify` ediliyor (`usePdksLiveTable.ts:60`).
   - `pdksSourceVersion`, her `calculate` ve `month` çağrısında projenin ve global tatillerin tamamını (bütün yıllar) ve
     kural sürümlerini yeniden okuyor (`convex/pdksBatches.ts:48-54`).
8. **Karışık diff:** `src/components/shifts/definitions/AddShiftDialog.tsx`'te geçersizleştirmeden bağımsız bir form
   düzeni değişikliği de var (esnek mola alanları yan yana). Commit ayrılırken pathspec'e dikkat edilmeli.
