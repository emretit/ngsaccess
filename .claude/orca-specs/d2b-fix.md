# Dalga 2b — Denetim düzeltmeleri (backend + frontend)

**Hedef:** Claude denetiminin orta/düşük bulguları kapanır: personel güncellemesi yalnız değişen ilişkileri doğrular, bekleyen yüklemeler temizlenir, kapatılmış Hik hatası yeniden başarısız olunca tekrar görünür, denetim kaydı boş sayfada takılmaz ve arama debounce'lu olur, rapor zamanlama formu kaydedilmemiş girişi ezmez, tarih varsayılanları Türkiye günüdür.

Bağlam: Dalga 2b worker'ları spec'leri `.claude/orca-specs/d2b-*.md`. Bu görev yalnız aşağıdaki maddeleri yapar; başka refactor yok.

## Backend
1. **employees.update ilişki doğrulaması** (`convex/employees.ts` ≈296, `convex/lib/peopleRelations.ts`): `{...emp, ...patch}` ile TÜM ilişkiler yeniden doğrulanıyor → eski bozuk/çapraz-proje ilişkili kayıtta ilgisiz alan (isActive vb.) bile reddediliyor. Yalnız `updates` içinde GELEN ilişki alanlarını (departmentId, companyId, positionId, shift vb. — dosyadaki kümeye bak) ve projectId değişiyorsa tümünü doğrula. Saf fonksiyon + test (eski bozuk ilişki + isActive değişimi → geçer; yeni çapraz-proje departmanı → reddedilir).
2. **pendingUploads temizliği** (`convex/files.ts`, `convex/crons.ts`): internalMutation — `by_created` ile 24 saatten eski pending satırları batch (≤200) al; storage'ı başka bir kayda (employees.by_photo_storage veya users.photo — kullanıcı fotoğrafının nasıl saklandığına bak) bağlı DEĞİLSE `ctx.storage.delete` + satırı sil; bağlıysa yalnız satırı sil. Günlük cron ekle (mevcut crons.ts desenine uy). Batch dolarsa kendini `scheduler.runAfter(0, ...)` ile devam ettir.
3. **Kapatılmış Hik hatası tekrar başarısız olunca görünür** (`convex/hikvisionSync.ts` `markOpRetried` ≈856): mevcut patch'e `dismissedAt: undefined, dismissedBy: undefined` ekle (yeni deneme yeni sonuçtur). Başka pipeline değişikliği YOK.
4. **departments döngü** (`convex/departments.ts` update ≈63): yalnız self-parent engelleniyor; yeni parent'tan yukarı doğru (en çok 50 adım) yürüyüp kendisine ulaşıyorsa "Departman kendi alt departmanının altına taşınamaz" hatası. Saf yardımcı + test.
5. **sendScheduledReports** (`convex/actions/sendScheduledReports.ts`): zamanlama başına try/catch — bir zamanlamanın hatası diğerlerini durdurmasın; hata loglansın, markReportSent yalnız başarıda (mevcut davranış).
6. `convex/cardReadings.ts` `getRecentByProjects`: ölü `isSuperAdmin` arg'ını kaldır (çağıran yok — grep ile doğrula).

## Frontend
7. **ShiftSettings.tsx:25** `shifts.list` → aktif `projectId` (useActiveProjectScope; projectId yoksa "skip"). Aynı dosyadaki assignments sorgusu da aynı kapsam. (PDKS filtre dosyaları PDKSFilterBar/PDKSActiveFilterChips/PDKSInlineQuery `{}` KALSIN — PDKS verisi şimdilik tüm izinli projeler; kapsamı PDKS planında ele alınacak.)
8. **AuditLog.tsx**: (a) aktif proje / "tüm projeler" kapsamı değişince URL'deki `user` paramını sil; (b) `user` filtresi seçeneklerde yoksa ham id yerine "Bilinmeyen kullanıcı" göster; (c) `q` metin araması debounce (~300 ms; `src/hooks/useDebouncedValue.ts` yoksa ekle) — URL ve sorgu debounced değerle güncellensin; (d) sayfa içi (action/metin) filtre sonucu boş ama `status === "CanLoadMore"` ise üst sınırlı (ör. en çok 5 ardışık) otomatik `loadMore`, sınır dolunca "Yüklenen kayıtlarda eşleşme yok — daha fazla yükle" mesajı. Backend `auditLog.ts`'e dokunma.
9. **ReportsSettings.tsx** zamanlama formu: `useEffect([scheduleData, projectId])` reaktif her güncellemede kaydedilmemiş e-posta/switch/rapor türünü eziyor → formu yalnız projectId değişince ve ilk veri gelişinde doldur (dirty takibi veya "hydratedFor" ref).
10. **Türkiye günü varsayılanları**: `src/lib/date.ts`'e `todayInTurkey(): string` (YYYY-MM-DD, `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' })`) ekle + test; `CardReadingsFilters.tsx` ve `ReportsSettings.tsx`'te "bugün"/varsayılan tarih `toLocalDateString()` yerine bunu kullansın. CardReadingsFilters: bitiş boşsa "Bitiş boşsa yalnız başlangıç günü" ipucu metni. `toLocalDateString`'in mevcut imzası/davranışı DEĞİŞMEZ.
11. **Düşük**: `SyncIssuesBanner.tsx` 0 hata varken kalıcı şerit göstermesin (yalnız hata varsa veya kullanıcı açtıysa); `src/pages/Devices.tsx` aktif proje değişince `?deviceId` paramını temizle.

## Ownership (yalnız bunlara yaz)
convex/employees.ts · convex/lib/peopleRelations.ts (+ test) · convex/files.ts · convex/crons.ts · convex/hikvisionSync.ts (YALNIZ markOpRetried) · convex/departments.ts · convex/lib/departmentTree*.ts (yeni) · convex/actions/sendScheduledReports.ts · convex/cardReadings.ts (YALNIZ getRecentByProjects arg) · src/components/settings/sections/ShiftSettings.tsx · src/pages/AuditLog.tsx · src/hooks/useDebouncedValue.ts (yeni) · src/components/settings/sections/ReportsSettings.tsx · src/lib/date.ts (+ test) · src/components/access-control/CardReadingsFilters.tsx · src/components/sync/SyncIssuesBanner.tsx · src/pages/Devices.tsx

## Kapsam dışı
schema.ts (koordinatör; index gerekiyorsa `ask`) · PDKS ekranları · bridge pipeline fonksiyonları (markOpRetried dışında) · Dalga 3 tasarım göçü. Paralel başka worker YOK; tüm kapılar senin koşumunda yeşil olmalı.
