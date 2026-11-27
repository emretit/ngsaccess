# Convex sorgu sınırı işi — denetim (salt okuma, 2026-11-27)

Denetçi: Claude (opus). Yazan: Codex. Kapsam: E1–E5/D7 diff'i + yeni `convex/pdksBatches.ts`, `src/lib/pdksBatches.ts`, `src/hooks/usePdksSnapshot.ts`.
Kod değiştirilmedi, `npx convex` koşulmadı.

## Sonuç (kısaca)

Parçalı (batch) aylık tablo/bordro hesabı eski tek-sorgu hesabıyla **mantıksal olarak eşdeğer**. Mükerrer kart,
şirket filtresi, gece ve esnek vardiyada kişi/gün kaybı ya da çift sayım bulmadım. Batch uçlarında IDOR yok.
**Ama asıl hedef yarım kaldı:** PDKS sayfası varsayılan olarak **günlük** görünümle açılıyor ve bu görünüm hâlâ
bölünmemiş canlı sorgu kullanıyor. Bu yüzden ~250+ kişilik projede bütçe hatası verir.
Ayrıca batch'i bölme (split) mekanizması hata **metnine** bakıyor. Prod deployment'a geçince bu metin "Server Error"
olarak gizlenir ve bölme çalışmaz.

Koşulan testler (tek tek, 13 dosya): pdksBatches ×2, queryBounds, dashboardAnnualOvertime, pdksBudgetRegression,
w5aLegacyEquivalence, w5aFix1, w5aFix2, w53Integration, cardReadings.readingAccess, readingAccess.test.tsx,
pdksExport, pdksExportColumns → **208/208 geçti**.

Varsayım: bir `cardReadings` satırı ≈ 1,8 KB (`rawData` dahil, audit §2 ile aynı).

---

## Engel

### E-1. Günlük PDKS görünümü ve tek günlük rapor hâlâ bölünmemiş canlı sorgu (E4 varsayılan ekranda çözülmedi)
- [src/hooks/usePdksTableData.ts:52](src/hooks/usePdksTableData.ts) `isMatrix = reportType !== "daily"`. Varsayılan `reportType: "daily"` ([src/pages/PDKSRecords.tsx:27](src/pages/PDKSRecords.tsx)). Günlük görünümde
  `useQuery(api.cardReadings.getPdksTableData)` çağrılıyor (satır 104-106), yani batch değil eski monolitik yol.
  [src/components/reports/ReportResults.tsx](src/components/reports/ReportResults.tsx) `DailyResults` için de tek gün = canlı yol.
- Monolitik yolun bir günde okuduğu veri:
  - Haftalık mesai aralığı: `overtimePeriodRange` Pazartesiden başlıyor, `pdksWorkDayRange` +1 gün ekliyor ([convex/lib/overtimeCalc.ts:103](convex/lib/overtimeCalc.ts)). Sonuç: Cuma görünümü projenin **6 günlük** okumalarını okur.
  - Satır başına `pdksFirstRecordDate` → `.take(20)` tam okuma belgesi ([convex/lib/pdksAvailability.ts:78](convex/lib/pdksAvailability.ts), çağrı [convex/lib/pdksTableQuery.ts:187](convex/lib/pdksTableQuery.ts)). Kişi başı 20 belge × 1,8 KB = 36 KB.
- Hesap (500 kişi, günde 2 geçiş, Cuma): 6.000 okuma × 1,8 KB ≈ 10,8 MB, artı 10.000 belge × 1,8 KB ≈ 18 MB → **≈29 MB**. Bütçe 15 MiB → "Okuma sınırı aşıldı" hatası.
  200 kişide günde 4 geçişle ≈ 15,8 MB → yine sınırı aşar. Eşik kabaca **~250 kişi (2 geçiş) / ~190 kişi (4 geçiş)**.
- Bu sorgu canlı abonelik (subscription). Projedeki her yeni kart okuması onu yeniden çalıştırır ve her çalıştırma ~10-15 MB okur → DB I/O (veritabanı okuma trafiği) yükü D3 ile aynı sınıfta.
- Testler bunu yakalamıyor: `pdksBudgetRegression` 200 kişi testi `rawData: "x".repeat(192)` kullanıyor ([convex/pdksBudgetRegression.test.ts:31](convex/pdksBudgetRegression.test.ts)), gerçekçi 1,6 KB değil. Tek gün / 500 kişi testi yok.
- Öneri: `pdksFirstRecordDate` için kişi başı 20 tam belge okumak yerine çalışana kalıcı bir `firstRecordDate` alanı ya da tek belge (`first()`) okunmalı. Günlük görünüm de batch yoluna alınmalı ya da kişi sayfalaması yapılmalı.

---

## Düzeltilmeli

### D-1. Bölme ve hata mesajı `Error.message` metnine bağlı; prod'da çalışmaz
- [src/lib/pdksBatches.ts:59](src/lib/pdksBatches.ts) regex'i `Okuma sınırı|Sorgu aralığı sınırı|Too many…` metnini arıyor. Sunucu ise düz `throw new Error(...)` atıyor ([convex/lib/pdksTableQuery.ts:253](convex/lib/pdksTableQuery.ts), `:282`, `:286` civarı).
- Convex prod deployment'ta `ConvexError` olmayan hataların metnini "Server Error" olarak gizler. Bugün canlı ortam dev deployment (`notable-tern-4`), o yüzden çalışıyor. Audit §5.1'deki Pro + gerçek prod geçişinden sonra:
  bölme devreye girmez, yoğun bir grup bütün yüklemeyi düşürür, kullanıcı da yalnız "Server Error" görür.
- Bugünkü dev ortamında da [src/hooks/usePdksSnapshot.ts:20](src/hooks/usePdksSnapshot.ts) ham Convex metnini (`[CONVEX Q(pdksBatches:calculate)] [Request ID …] Server Error Uncaught Error: …`) olduğu gibi ekrana basıyor.
- Öneri: `ConvexError({ code: "PDKS_READ_LIMIT" })` at, istemcide `error.data.code` ile ayırt et ve kullanıcıya Türkçe sabit bir mesaj göster.

### D-2. Fonksiyon çağrısı ve DB I/O büyümesi (500 kişi, 1 ay)
Çağrılar sırayla gidiyor ([src/lib/pdksBatches.ts:67](src/lib/pdksBatches.ts) ve `:82`):
| Adım | Çağrı |
|---|---|
| `rosterPage` (100/sayfa) | 5 |
| `calculate` müsaitlik turu (20 kişi/grup) | 25 |
| `unassignedDatesPage`: **projenin tüm ay okumaları** 512/sayfa ([convex/pdksBatches.ts:62](convex/pdksBatches.ts)) | ~53 (2 geçiş) – ~86 (4 geçiş) |
| `calculate` hesap turu | 25 |
| **Toplam (tablo)** | **~108–141**; aylık bordro da ayrıca aynı kadar |
- Okunan veri ≈ ay okumalarının **3 katı**: müsaitlik turu, eşleşmeyen tarih taraması ve hesap turu üçü de aynı okumaları okuyor. 2 geçişte ≈ 145 MB, 4 geçişte ≈ 290 MB/açılış. Pro'nun 50 GB I/O kotası ≈ 170–345 açılış/ay demek. DB I/O, audit'te maliyetin 1 numaralı kalemi.
- Test bunu doğruluyor: `transactions > 100` ([convex/pdksBatches.test.ts](convex/pdksBatches.test.ts), 500 kişi testi).
- Kişi, şirket ya da `employeeId` filtresi işi azaltmıyor: roster tüm projeyi döndürüyor, 500 kişinin hepsi hesaplanıp sonra sunucuda filtreleniyor.
- Müsaitlik turu erken dönmeden önce izinleri ve departmanları da boşuna okuyor (`readPdksLeaves` [convex/lib/pdksTableQuery.ts:151](convex/lib/pdksTableQuery.ts), erken dönüş `:166`).
- Hepsi sıralı. ~110 ağır sorgu × 0,2–0,4 sn ≈ **20–45 sn** açılış süresi; ilerleme göstergesi yok.
- Öneri: eşleşmeyen tarih taramasını `by_project_employee_time` + `employeeId = undefined` aralığına daralt. Hesap turunda yalnız filtreye uyan grupları çalıştır (müsaitlik zaten global). Sınırlı paralellik (ör. 3-4) ve "x/y grup" ilerleme göstergesi ekle.

### D-3. Hafta/ay görünümü ve aylık bordro artık canlı değil; manuel düzeltme tabloya yansımıyor
- Matris görünümü ve `MonthlyPayrollView` artık tek seferlik snapshot ([src/hooks/usePdksTableData.ts:108](src/hooks/usePdksTableData.ts), [src/components/pdks/records/MonthlyPayrollView.tsx:23](src/components/pdks/records/MonthlyPayrollView.tsx)).
  `ManualPdksEditDialog` ile kayıt düzeltilince ([src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:231](src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx)) `refresh` çağrılmıyor. Arkadaki tablo, kullanıcı "Verileri yenile"ye basana kadar eski değeri gösteriyor. Eski davranış canlıydı, bu bir gerileme.
- Öneri: düzeltme kaydedildikten sonra (`onSaved`) `view.refresh()` çağrılsın, ya da en azından ilgili satır yeniden hesaplansın.

### D-4. Yıllık mesai action'ı (E1 ara çözümü): maliyet, iptal yok, test kapsamı dar
- [convex/dashboard.ts:486](convex/dashboard.ts): her açılışta 53 haftalık `runQuery` sırayla çalışıyor. Tüm yıl ≈ 1,3 kat okunuyor (her hafta ±1 bağlam günü ve tüm çalışan listesi tekrar okunuyor). 200 kişi, 2 geçişte ≈ **190 MB I/O/açılış**.
  `PDKSSmartPresets` "annual-overtime-near" aynı action'ı bir kez daha çalıştırıyor. `PDKSOvertimeAlert` kapanınca bile action sunucuda sürüyor (iptal yok).
- Hafta parçasında bölme yok: 500 kişi × 2 geçiş × 9 gün × 1,8 KB ≈ 12–13 MB, üstüne çalışanlar ve vardiyalar → 15 MiB'e dayanıyor. 4 geçişte hata. Aralık sayısı kişi başı ~3-4 (vardiya ataması, eski izin, kural raporu) → ~1.000 kişide 4.090 sınırı.
- Eşitlik testi ([convex/queryBounds.test.ts:38](convex/queryBounds.test.ts)) tek kişi ve 08–17 vardiyasıyla, üstelik eski sorguyla değil `annualOvertimePart`'ın tüm yıl çağrısıyla kıyaslıyor. Kapsamadığı durumlar: Pazar→Pazartesi gece vardiyası, kural tarafından yönetilen (`ruleRows`) günler, `nightShiftDayMode: "splitAtMidnight"`.
  Kod incelemesinde hafta sınırında kayıp görmedim (±1 bağlam günü var, `managedDates` ve `ruleRows` aralığa filtreli). Yine de bu durumlar testsiz.
- Kalıcı çözüm tasarımı ([docs/convex-audit/E1_OZET_TABLO_TASARIM.md](docs/convex-audit/E1_OZET_TABLO_TASARIM.md)) uygulanana kadar en azından sonuç önbelleğe alınmalı (aynı proje/yıl için 5-10 dk) ve iki bileşen aynı sonucu paylaşmalı.

---

## Not

1. **Eski hesapla eşdeğerlik (analiz):**
   - Kart eşleşmesi korunuyor. `employeeId` yolu ve `owners` son-sahip kart yolu ([convex/lib/pdksTableQuery.ts](convex/lib/pdksTableQuery.ts) `readPdksBatchReadings`) her okumayı tek bir kişiye veriyor. Aynı kişi içindeki tekrar `_id` Map'iyle siliniyor.
   - Mükerrer kartlar aynı gruba toplanıyor ve bölmede birlikte kalıyor ([src/lib/pdksBatches.ts](src/lib/pdksBatches.ts) clusters). Bu sayede şirket filtresinde kartın filtrelenmiş kişiye düşmesi eski davranışla aynı.
   - Esnek vardiya: `forceFlexible` önceki günü tüm gruplara okutuyor, aralık eskisiyle aynı (önceki günün 00:00'ından dönem başına −1 ms).
   - Kapanmış bordro artık 25 kişide kesilmiyor (iyileştirme).
   - Test boşluğu: eşitlik testinde mükerrer kart, onaylı izin, manuel `pdksRecords`, departman/kişi filtresi ve kapanmış bordro yok.
2. **Yetki / IDOR (bir kullanıcının başka projenin verisine erişmesi):** 4 public batch ucunun hepsi önce `resolveReadingScope(..., REPORT_READING_PERMISSIONS)` çalıştırıyor (test: `every batch endpoint checks…`). `calculate` gelen `employeeIds`'in seçili projeye ait olduğunu doğruluyor ([convex/pdksBatches.ts:83](convex/pdksBatches.ts)).
   `roster`, `cardOwners`, `availableDates` ve `forceFlexible` istemciden geliyor ve doğrulanmıyor. Ama yalnız aynı projenin okumalarını kime/hangi güne bağladığını etkiliyor. Kullanıcı zaten o projeyi görüyor, yani başka projeye sızıntı yok; olsa olsa kendi görünümünü bozabilir.
   `annualOvertimePart` internal ve her parçada yeniden yetki kontrolü yapıyor.
3. **Bütçe kapsamı:**
   - Proxy `db.query` ve `db.get`'in tüm okumalarını (yinelenen, `collect`, `take`, `first`, `unique`, `paginate`) aynı bütçeye sayıyor. Gerçek Convex `QueryImpl` ile uyumlu (private field yok, `return()` güvenli).
   - Sayılmayanlar:
     - `customCtx` auth okumaları sarmalamadan önce yapılıyor (birkaç belge; aralık payı 4.096−4.090 = 6, dar).
     - `annualOvertimePart` içinde `getEffectiveWorkSettings` sarmalanmamış `ctx` ile okuyor ([convex/dashboard.ts:509](convex/dashboard.ts)).
     - Sunucu tarafı `.filter()` ile elenen satırları proxy göremez. Bugün bu yolda `.filter()` yok, ama ileride eklenirse sayım eksik kalır.
     - Proxy `take(n)` yerel `limit(n)` yerine akış + `break` kullanıyor.
4. `calculate`: roster alındıktan sonra bir çalışan silinirse tüm yükleme "Çalışan seçili projeye ait değil" hatasıyla düşer. Mesaj yanıltıcı.
5. D7: `listAssignments` aralıksız yol hâlâ tüm geçmişi okuyor, yalnız sınıra gelince hata veriyor. Tek UI çağıranı ([src/components/shifts/calendar/useShiftCalendarData.ts:27](src/components/shifts/calendar/useShiftCalendarData.ts)) zaten aralık veriyor, şu an risk yok.
6. UI yarış durumu iyi: `usePdksSnapshot` anahtar + `active` bayrağı + `AbortController` kullanıyor, eski istek yeni sonucu ezmiyor. Yeni çağrılar sorgu aralarında kesiliyor.
   Excel/CSV/PDF dışa aktarım tamamlanmış `records`'u bekliyor; yükleme sırasında `records.length === 0` olduğu için buton kapalı. Bordro dışa aktarımı `loadPdksPayroll` ile tüm parçaları bekliyor.
   Hata varken `isLoading` true kalıyor, bu yüzden menüdeki "Verileri yenile" kapalı. Sonuç alanındaki "Yeniden dene" butonu çalışıyor.
