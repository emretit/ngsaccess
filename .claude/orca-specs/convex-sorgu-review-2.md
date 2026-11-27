# Convex sorgu sınırı işi — 2. tur denetim (salt okuma, 2026-11-27)

Denetçi: Claude (opus). Kod değiştirilmedi, `npx convex` / commit yok. Diff'in kendisi okundu (rapor değil).

## Sonuç (kısaca)

1. turdaki **Engel ve 4 Düzeltilmeli kapandı**. Yeni **Engel yok**. Önbellek başka projeye ya da başka kullanıcıya veri
sızdırmıyor. Eski istek yeni sonucu ezmiyor. Batch hesabın sonucu eski hesapla aynı.
Ama **3 yeni Düzeltilmeli** var:
- Okuma önbelleği mesai ayarı değişince eski kalıyor ve haftalık mesaiyi 5 dk boyunca sessizce yanlış hesaplayabiliyor.
- Yıllık hesap açılış başına ~1.650 fonksiyon çağrısı yapıyor; 1. turda bu ~54'tü.
- PDKS günlük "bugün" görünümü artık canlı değil ve sayfa yeniden açılınca 5 dk'lık önbellekten geliyor.

Koşulan testler (tek tek, 17 dosya): pdksBatches ×2, pdksTransport, annualOvertimeBoundary, pdksAnnual,
ManualPdksEditDialog.refresh, pdksBudgetRegression, w5aLegacyEquivalence, dashboardAnnualOvertime, pdksAvailability,
w5aFix1, w5aFix2, w53Integration, queryBounds, CorrectionRequestsPanel, PayrollPeriodPanel, usePdksAudit → **125/125 geçti**.

## 1. tur kalemleri

| Kalem | Durum | Kanıt |
|---|---|---|
| ENGEL günlük/tek gün bölünmemiş | **Kapandı** | `src/hooks/usePdksTableData.ts:101` her rapor türü için `usePdksTableSnapshot` kullanıyor, `ReportResults.tsx` DailyResults da batch'e geçti. İlk kayıt araması artık kişi başı 20 belge değil, 1 `first()` okuyor ve önceden yüklenmiş okumaları kullanıyor (`convex/lib/pdksAvailability.ts` `setPdksHistoryReadings` + `knownHistory`). Test: Cuma günlük görünüm 500 ve 1000 kişi (`convex/pdksBatches.test.ts:194`). |
| D1 metne bağlı bölme | **Kapandı** | `ConvexError({ code: "PDKS_READ_BUDGET" })` (`convex/lib/pdksTableQuery.ts:254,283,286`). İstemci `error.data.code`'a bakıyor (`src/lib/pdksErrors.ts:1-5`). Kullanıcı sabit Türkçe mesaj görüyor, ham Convex metni yok (`src/hooks/usePdksSnapshot.ts:27`). |
| D2 üç kez okuma, sıralı istekler | **Kapandı** (ilerleme göstergesi hariç) | Kaynak tek kez taranıyor (`unassignedDatesPage`, sayfa başına 2000 kayıt / 4 MB), okumalar `calculate`'e argüman olarak gidiyor. Hesap turu yalnız filtreye uyan grupları çalıştırıyor (`src/lib/pdksBatches.ts:132`). Eşzamanlılık 4 (`:52-65`). Ölçüm: 1,038x kaynak baytı, 133 işlem, tepe 4 (`docs/convex-audit/PDKS_DB_IO_2026-11-27.json`, `productionUsageMeasured:false`). "x/y grup" ilerleme göstergesi yok. |
| D3 düzeltme sonrası eski tablo | **Kapandı** (sayfa içi yollar) | `invalidatePdksSnapshots()` (sayacı artırır ve olay yayar) şu üç yerde çağrılıyor: manuel kayıt (`ManualPdksEditDialog.tsx:83`), düzeltme onayı (`CorrectionRequestsPanel.tsx:69`), içe aktarma (`PDKSImportDialog.tsx:85`, yalnız `inserted/updated > 0` olduğunda). Önbellek anahtarı bu sayacı içeriyor (`src/lib/pdksBatches.ts:31`, `src/lib/pdksAnnual.ts:113`). |
| D4 yıllık önbellek / iptal / yetki | **Kapandı** | 5 dk'lık paylaşılan sonuç (`src/lib/pdksAsync.ts:15`); Alert ile SmartPresets aynı anahtarı kullanıyor. İş, son izleyen bileşen kapanınca iptal ediliyor (`pdksAsync.ts:35-38`). Önbellekten dönmeden önce yetki yeniden kontrol ediliyor (`getAnnualOvertimeAccess`, `dashboard.ts:790`) ve anahtarda `accountId` var. Pazar→Pazartesi gece, kural yönetimli gün ve `splitAtMidnight` testi eklendi (`convex/annualOvertimeBoundary.test.ts:10`), ama yalnız tek kişiyle. **Yeni sorun:** çağrı sayısı (aşağıda D-2). |

---

## Engel

Yok.

---

## Düzeltilmeli

### D-1. Okuma önbelleği mesai/kural ayarı değişince eski kalıyor; sunucu okumaların aralığı kapsadığını doğrulamıyor
- Kaynak anahtarı yalnız `epoch:projectId:from:to` (`src/lib/pdksBatches.ts:27-31`). Okuma aralığı ise sunucuda
  mesai ayarına göre hesaplanıyor: `overtimePeriodRange(..., rates.overtimeBasis, rates.nightShiftDayMode)` ve −1 gün
  (`convex/pdksBatches.ts:60-62`).
- `calculate` yalnız `readingEndISO` alıyor, başlangıcı almıyor (`convex/pdksBatches.ts:77`). Önceden yüklenmiş okumalar
  sunucunun kendi aralığına göre süzülüyor (`convex/lib/pdksTableQuery.ts:373-377`). Eksik gün varsa hata vermiyor,
  sessizce eksik hesaplıyor.
- Senaryo: Ayarlar'da mesai esası günlük → `weekly45` yapılır. 5 dk içinde PDKS'ye dönülür. Önbellekteki okumalar yalnız
  seçili günleri kapsar, Pazartesi–Perşembe okumaları yoktur. Cuma'nın haftalık fazla mesaisi **yanlış** çıkar ve
  uyarı gösterilmez.
- Ayar ve kural kaydeden formlar (`OvertimeSettingsForm.tsx:51` `saveOvertime`, `PdksRulesSettings.tsx:75-76`,
  `HolidayCalendarManager.tsx:58-60`) `invalidatePdksSnapshots()` çağırmıyor. Kural değişince `unassignedDate`
  (`convex/pdksBatches.ts:68`) da eski kalıyor.
- Öneri:
  - `calculate` ve `getAnnualOvertimePart` `readingStartISO` ile `readingEndISO` alsın. Sunucu kendi gerekli aralığını
    karşılaştırsın, kapsamıyorsa `ConvexError({ code: "PDKS_SOURCE_STALE" })` atsın; istemci önbelleği geçersizleştirip
    yeniden denesin.
  - Ek olarak ayar, kural ve tatil kayıtlarından sonra `invalidatePdksSnapshots()` çağrılsın.

### D-2. Yıllık hesap açılış başına ~1.650 fonksiyon çağrısı yapıyor (1. turda ~54)
- `src/lib/pdksAnnual.ts:79-80`: görev sayısı = hafta (53) × grup (20 kişi/grup). 500 kişide 53 × 25 =
  **1.325 `getAnnualOvertimePart`** sorgusu. Üstüne yaklaşık 14 aylık kaynak gelir: 44 bin okuma/ay ÷ 2000 ≈ 22 sayfa/ay
  → ~300 sayfa. Roster ve yetki çağrılarıyla toplam **~1.650 çağrı/açılış**. 200 kişide ~530 + kaynak.
- Haftalık bölmeye gerek yok. Batch modda okumalar argümanla geliyor ve sunucu yalnız çalışan, vardiya, izin ve kural
  okuyor (`dashboard.ts:233-251`). Yani bütçe baskısı okumalardan gelmiyor.
- Proje Convex fonksiyon çağrısı kotası yüzünden daha önce sorun yaşadı (IDE poll, Hik roster poll). Uyarılar
  panelini her açışta ~1.650 çağrı, Free planın 1 M/ay kotasında ~600 açılış demek.
- Öneri: parçayı ay başına (tam haftalar, `startDate`=ayın ilk haftası, `endDate`=son haftası) tek çağrıya indir:
  12 × 25 = 300. Bütçe hatasında mevcut ikiye bölme zaten çalışıyor. Ya da grup boyunu yıllık için 50 yap.

### D-3. PDKS "bugün" görünümü canlılığını kaybetti; yeniden açılışta 5 dk'lık önbellekten geliyor
- HEAD'de `usePdksTableData` canlı `useQuery` kullanıyordu (`git diff HEAD -- src/hooks/usePdksTableData.ts`). Şimdi
  varsayılan günlük görünüm dahil hepsi tek seferlik snapshot.
- Kaynak önbelleğinin TTL'i iş bittikten sonra 5 dk (`src/lib/pdksAsync.ts:15,19`). Kullanıcı PDKS'den çıkıp
  ≤5 dk içinde dönerse hesap yeniden yapılır ama **okumalar eski** kalır. Yeni gelen kişi "gelmedi" görünür.
- PDKS sayfasında "açıldığı andaki veri" notu ya da son güncelleme saati yok. Tek yol `İşlemler → Verileri yenile`
  (`src/pages/PDKSRecords.tsx:92`). Rapor sayfasındaki "Rapor açıldığı andaki verileri gösterir" metni
  (`ReportResults.tsx:37`) önbellek yüzünden doğru değil.
- Öneri:
  - Kaynak önbelleğini yalnız eşzamanlı paylaşım için kullan: tamamlanınca TTL'i ~30 sn yap, ya da bugünü içeren
    aralıkları önbelleğe alma.
  - Tabloda "Son güncelleme HH:mm" göster.
  - Bugün görünümü için pencere odağında (focus) yenileme düşünülebilir.

---

## Not

1. **Önbellek ve yetki (sızıntı yok):**
   - Tablo kaynak önbelleği kullanıcıya bağlı değil, ama her yüklemede önce yetki kontrollü `rosterPage` çalışıyor
     (`src/lib/pdksBatches.ts:69-75` → `:93`, sunucuda `convex/pdksBatches.ts:44`). Yetkisi alınan kullanıcı önbelleğe
     ulaşamadan hata alır.
   - Okumalar zaten aynı izinle (`reports.view`) `listReportTransactions` üzerinden açık. Ücret alanı önbellekte yok,
     ücret gizleme sunucuda kullanıcı başına yapılıyor.
   - Yıllık önbellekte `accountId` anahtarda ve her önbellek isabetinden önce yetki yeniden kontrol ediliyor
     (test `src/lib/pdksAnnual.test.ts:57`).
2. **İstemciden gelen veri:** `calculate` ve `getAnnualOvertimePart` istemciden gelen okuma/roster'ı yalnız
   `projectId`'ye göre doğruluyor (`convex/pdksBatches.ts:87-88`, `dashboard.ts:495`). Kullanıcı sahte okumayla yalnız
   kendi görünümünü değiştirebilir; kalıcı yazım yok, çünkü bordro kapanışı okumaları sunucuda kendisi okuyor
   (`convex/payrollPeriods.ts:67-80`).
3. **Yarış (eski istek yeni sonucu ezmiyor):**
   - `usePdksRequest`: `active` bayrağı + `AbortController`, ve epoch değişince anahtar da değişiyor.
   - `pdksShared`: iş, son izleyen ayrılınca iptal ediliyor; hata olunca kayıt siliniyor.
   - `PDKSSmartPresets`: `aborted` korumaları var.
4. **Geçersizleştirme kapsamı:**
   - İzin, vardiya, tatil ve ayar değişiklikleri başka route'larda yapılıyor. PDKS'ye dönünce tablo sunucuda yeniden
     hesaplanıyor, eski kalan yalnız okumalar (D-1/D-3).
   - Yıllık sonuç ise bu değişikliklerden sonra ≤5 dk eski kalabilir.
   - Geçersizleştirme yalnız aynı sekmede çalışıyor; başka bir yöneticinin düzeltmesi "Yenile"ye basılana kadar görünmez.
5. **Yenile maliyeti:** yıllık karttaki "Yenile" global epoch'u artırıyor (`usePdksSnapshot.ts:32`). Açık tablo ve
   bordro da baştan hesaplanıyor (~133 çağrı).
6. **Eski-yeni sonuç farkı:**
   - Eşitlik testi eski `getPdksTableData`/`getMonthlyPayrollSheet` ile `toEqual` karşılaştırıyor
     (`convex/pdksBatches.test.ts:99`). Mükerrer kart "0", şirket filtresi, esnek, gece ve sahipsiz okuma kapsamda.
   - Taşıma DTO'su, hesapta kullanılan tüm alanları içeriyor. Grep ile çıkan alanlar: `_id`, `_creationTime`,
     `accessStatus`, `accessTime`, `cardNo`, `direction`, `employeeId`, `projectId`, `deviceId`, `ideIoId`,
     `hikCardReaderNo`. `pdksSource` sunucuda önceden hesaplanıyor (`pdksSource.ts:32`).
   - Kenar durum: önceden yüklenmiş okuma yolunda boş kart numarası koruması yok (`pdksTableQuery.ts:375-377`,
     sunucu yolunda `employee.cardNumber &&` var). `buildPdksEmployeeReadingMap` boş kartı zaten elediği için sonuç
     değişmiyor; yalnız fazladan veri taşınıyor.
   - Test boşluğu: yıllık sınır testi tek kişilik; çok gruplu ve mükerrer kartlı yıllık eşitlik testi yok.
7. **w5a snapshot gerçekten yalnız okuma izi mi:**
   - Evet, sonuç tarafında değişiklik yok. 8 bloğun hepsinde yalnız `reads` dizileri değişmiş; diff'te `reads`
     dışında eklenen/silinen satır **0**.
   - Değişen okumalar:
     - `collect/take` → async iterator (bütçe proxy'si).
     - Dashboard ve yıllıkta `leaves.filter.collect` (tüm tablonun taranması) ve `departments.collect` yerine
       indeksli `by_project_end` + eski kayıtlar için `by_project_employee_end` + `db.get`. Bu bir kapsam değişikliği,
       ama `leaveToday` başka proje izinlerini zaten `scopedPdksPlan(l.projectId)` ile eliyordu (`dashboard.ts:394-397`),
       pratikte fark yok.
     - `userProjects by_user` okuması 2-3 kez tekrarlanıyor (fazladan `resolveReadingScope` çağrısı; küçük I/O).
   - "annual" bloğu artık istemcinin kullandığı yolu değil, internal `annualOvertimePart`'ı tam yıl için izliyor.
     İstemci yolu yalnız `annualOvertimeBoundary.test` ile ölçülüyor.
8. **Ölü uç:** `getAnnualOvertimeBalance` public action hâlâ duruyor (`dashboard.ts:462`) ve istemci kullanmıyor
   (mobil uygulamada da yok). Tek çağrısı tüm projeyi okuyan 53 haftalık `runQuery` çalıştırıyor. Internal yapılmalı
   ya da kaldırılmalı.
9. **1. tur Not-4 hâlâ açık:**
   - Roster alındıktan sonra bir çalışan silinirse tüm yükleme düşüyor (`convex/pdksBatches.ts:87`).
   - İstemcide bu hata ve yetki hatası aynı genel "Hesaplama tamamlanamadı" mesajına dönüşüyor (`pdksErrors.ts:7`).
     Kullanıcı yetkisinin olmadığını anlayamıyor.
10. **Argüman boyutu:** bölünemeyen tek bir kart kümesi (ör. binlerce okumalı bir test kartı) `calculate` argüman
    sınırına yaklaşabilir. Bölme yalnız bütçe hatasında devreye giriyor, argüman boyutu hatasında değil. Bugünkü ölçekte
    risk düşük (20 kişi × ay × 4 okuma ≈ 0,9 MB).
