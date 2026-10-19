# Dalga 2b — ACC: Canlı izleme kayıt listesi dürüstlüğü + proje kapsamı + ziyaretçi ilişki doğrulaması

**Hedef:** Geçiş kayıtları listesi filtreyi sayfalamadan önce sunucuda uygular, cursor ile ilerler ve kesin olmayan toplamı "toplam" diye göstermez; liste ve ziyaretçi ekranları aktif projeyle sınırlıdır; ziyaretçi/kural/ev sahibi ilişkileri aynı projede doğrulanır; yön/sonuç bilinmiyorsa "bilinmiyor" görünür ve zamanlar TR saatiyle gösterilir.

(Ortak kurallar aşağıda; modül raporu: `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md`.)

## Bulgular
1. **ACC-11 (🔴)** — `cardReadings.list` (≈ satır 174) son 300 kaydı tarayıp toplam sayıyor, arama/durum filtresi sonra çalışıyor; 5000 üst sınırı UI'da yazmıyor.
   - Convex `paginate` + `paginationOptsValidator` (cursor) ile yeniden yaz; frontend `usePaginatedQuery` + "Daha fazla yükle". Filtreler (proje, cihaz, durum, tarih aralığı) index ile limit'ten ÖNCE: `by_project_access_time`, `by_project_status_time`, `by_project_device_time` (yeni). Serbest metin araması (isim/kart) index'lenemiyorsa: sayfa içi filtre yapıp bunu açıkça "yüklenen kayıtlarda arama" diye etiketle VE eşleşme yoksa "daha eski kayıtlarda olabilir — daha fazla yükle" de; asla kesin "kayıt yok" deme. Kart no tam eşleşme için index varsa (`by_card` yok — gerekirse `ask`) kullan.
   - Kesin toplam yoksa "N kayıt yüklendi" + devam bilgisi; eski "toplam" alanını kaldır.
   - Çoklu proje (açık "tüm projeler" seçimi) için cursor birleştirme karmaşıksa: varsayılan tek aktif proje; tüm-projeler modu yalnız super_admin için `by_access_time` paginate. Tasarımı raporla.
2. **ACC-30 (🔴)** — Aktif proje kapsamı: `useProjectFilteredCardReadings.ts` / `useCardReadings.ts` aktif `projectId` göndersin; `cardReadings.list`, `getRecentByProjects`, `getLastUnknownByDevice` ve `visitors.list`/`presetRules` `resolveProjectScope` kullansın. `visitors.create/update`: seçilen kural, ev sahibi personel, bölge/kapı ve `args.projectId` aynı proje değilse Türkçe hata (saf fonksiyon + test). `useVisitorFormData.ts` personel seçeneği: `employees.list`'e **`{ projectId }`** gönder (PPL worker bu arg'ı ekliyor; eski `projectIds/isSuperAdmin` arg'ları geçici olarak hâlâ kabul ediliyor — sen YENİ sözleşmeyi kullan). Kural/bölge seçenekleri de aktif proje.
   - `accessRules.ts` create/update(WithGroups) ve grup üye/cihaz ekleme: personel/cihaz/kapı kuralın projesinde mi doğrula (mevcut kontrol varsa yalnız boşlukları kapat).
3. **ACC-13 (🟠)** — `CardReadingsTable.tsx`: eksik `direction` → "Bilinmiyor" (nötr), eksik `accessStatus` → "Bilinmiyor"; yön nötr renk, karar semantik renk (`StatusBadge`). Normal çıkış kırmızı olmasın.
4. **ACC-17 (🟠)** — Canlı geçiş zamanı Europe/Istanbul biçimleyicisiyle + görünür "TR saati" etiketi; tarih filtresi ACC-10 sözleşmesiyle aynı (TR günü → `trDayRangeISO`).
5. **Ziyaretçi konumu performansı** — "içeride" hesabı son kabul edilmiş okumaya bakıyorsa yeni `cardReadings.by_employee_status_time` index'ini kullan (N+1/tam tarama yerine).

## Ownership (yalnız bunlara yaz)
convex/cardReadings.ts — **YALNIZ** `list`, `getRecentByProjects`, `getLastUnknownByDevice` ve bunların özel yardımcıları (`loadScopedCardReadings`, `normalizePage*`, `dayBounds`). PDKS fonksiyonlarının (`getPdksTableData`, `getPdksChartData`, `getMonthlyPayrollSheet`, `processCardReading`, `listForEmployee`, `selfCheckIn`, `getEmployeeAttendanceDetail`, `backfillHikEventRow`) davranışı ve imzası DEĞİŞMEZ; ortak yardımcıya dokunman gerekirse `ask`.
convex/visitors.ts · convex/accessRules.ts · convex/lib/accessScope*.ts / convex/lib/cardReadingList*.ts (yeni)
src/components/access-control/CardReadings.tsx · CardReadingsTable.tsx · CardReadingsFilters.tsx · src/hooks/useCardReadings.ts · src/hooks/useProjectFilteredCardReadings.ts · src/hooks/useVisitors.ts · src/components/visitors/** · src/types/visitor.ts · src/hooks/access-rules/** · src/components/access-control/ altındaki kural diyalogları (CreateRuleDialog vb.; ZoneDoorTree/EditDoorDialog HARİÇ)
`getRecentByProjects` / `getLastUnknownByDevice` çağıranları (dashboard vb.) imza değişirse güncellemek için önce `ask`.

## Kapsam dışı
employees.ts / useEmployees (PPL worker) · ZoneDoorTree / EditDoorDialog / doors.ts / zones.ts (ACC-ağaç worker) · PDKS ekranları · schema.ts (koordinatör) · Dalga 3 tasarım göçü.
