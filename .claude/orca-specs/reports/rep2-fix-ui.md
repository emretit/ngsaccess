# Raporlar D2 frontend düzeltmeleri
- `src/components/reports/ReportPage.tsx:54`, `ReportResults.tsx:45`: bitmemiş boş transactions taraması için özel mesaj + yükleme düğmesi; tamamlanınca mevcut EmptyState; kaynak süzgecinde biyometrik sayaç gizli, genel not kalır.
- `src/lib/reports/rows.ts:24,47,102`: günlük predicate/metin ve aylık geç/erken sayımları yalnız workday; çalışılan gün N (geç ve tek okutma dahil), izin çift sayılmaz; weekend/holiday çalışma ayrı; departman oranı N/(N+DV).
- `src/lib/reports/registry.ts:51,65,75`, `query.ts:9`, `ReportResults.tsx:22`: kişi/departmana Tatilde çalışma (gün); yalnız Okutma Kartı/Mola includePunches=true ve query key bağlantısı.
- `src/lib/reports/rows.ts:108`: kesilen okutmalarda `· +N okutma daha`.
- Değişen sözleşmeler: `ReportDefinition.includePunches?: boolean`; `AttendanceCounts.holidayWorkedDays: number`; `ReportPageProps.hasMoreTransactions?: boolean`; mevcut diğer export imzaları korunur.
- Tam değişen fonksiyon imzası: `dailyReportArgs(filters: ReportQueryFilters, definition?: ReportDefinition): { projectId: Id<'projects'>; startDate: string; endDate: string; viewMode: 'matrix'; departmentId: Id<'departments'> | undefined; person: string | undefined; includePunches?: boolean }`.
- Kapılar: app tsc 0; convex tsc 0; eslint src/lib/reports src/components/reports src/pages/Reports.tsx 0; vitest 8 dosya/51 test geçti; global git diff --check temiz. Yeni regresyonlar rows.test.ts, query.test.ts, ReportPage.test.tsx içinde.
- Tarayıcı kontrolü: Mobil boş sayfa→Daha fazla yükle→son boş durum; kişi/departman tatil kolonu ve %90,9 örneği; Okutma Kartı 30/24 kesilme; Mola detayları. Tarayıcı koşulmadı; D1 Aylık Durum kolonları ve totals.lateDays korunur.
- Ertelenen frontend maddesi yok; backend kapsamına yazılmadı; commit/push/deploy/npx convex/DB işlemi yapılmadı.
