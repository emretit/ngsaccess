# Dalga 2b — ADM-0C/0E: Admin cihaz paneli + denetim kaydı (cursor, filtre, TR günü) + yükleme/boş/hata durumları

**Hedef:** Denetim kaydı filtreleri index'le limit'ten önce uygulanır ve cursor ile sayfalanır (eski kayıt "yok" görünmez), kullanıcı/işlem/metin filtresi URL'de kalır ve tarih TR günüdür; admin cihaz durumu zamanla güncellenir ve kayıt+atama yarıda kalırsa tekrar atama yapılabilir; yükleniyor/boş/hata durumları ayrı görünür.

(Ortak kurallar aşağıda; modül raporu: `docs/ux-audit/04_AYARLAR_ADMIN.md` §3 ADM-23/24/28/29/30 + §5.)

## Bulgular
1. **ADM-28 (🔴)** — `auditLog.list` son 200 kaydı alıp tarih/hedef filtresini sonra uyguluyor; pagination yok; `distinctTargetTables` global ilk 500'den.
   - `paginate` + `paginationOptsValidator`; kapsam `resolveProjectScope` (aktif proje varsayılan; super_admin için açık "tüm projeler"). Index seçimi: proje+tablo → `by_project_table_timestamp`; proje+kullanıcı → `by_project_user_timestamp`; yalnız proje → `by_project_timestamp`; super_admin tüm projeler → `by_timestamp` / `by_table_timestamp` / `by_user_timestamp`. Tarih aralığı index'in `timestamp` ucunda (`gte/lte`). Index'lenemeyen ikincil filtre (ör. action, metin) sayfa içinde uygulanırsa UI "yüklenen kayıtlarda" der ve "daha fazla yükle" sunar — kesin "kayıt yok" demez.
   - Hedef tablo seçenekleri: sabit desteklenen hedef sözlüğü (kodda auditLog yazan yerlerden derle; Türkçe etiketlerle) — global tarama değil.
   - Çok projeli (super_admin dışı, birden fazla proje + "tüm projeler") cursor birleştirme karmaşıksa: tüm-projeler modunu tek projeye zorlamak yerine proje seçimi zorunlu yap; tasarımı raporla.
   - `getPdksAuditForEmployee` imzası/davranışı DEĞİŞMEZ (PDKS ekranı kullanıyor).
2. **ADM-29 (🟠)** — `AuditLog.tsx`: kullanıcı, işlem türü (create/update/delete), hedef tablo ve metin araması filtreleri; filtreler URL search params'ta (paylaşım/yenileme korur); etkin kapsam çipi + "Tüm filtreleri temizle" (tüm-projeler anahtarı dahil); başlangıç ≤ bitiş doğrulaması; tarih Europe/Istanbul günü (`trDayRange` benzeri: backend `convex/lib/trDate.ts`, frontend `src/lib/date.ts`) + gösterimde "TR saati".
3. **ADM-30 (🟡)** — loading / proje yok / boş / filtrelenmiş-boş / hata ayrı: `AuditLog.tsx` (`rows ?? []` → "Kayıt bulunamadı" kalksın), `AdminUsersPanel.tsx` + `useUserManagement.ts` loading kullansın, `HolidayCalendarManager.tsx` (`?? []`), `AdminDashboard.tsx` kartları başlangıç 0 yerine iskelet. `SectionSkeleton`, `EmptyState`, `ErrorState`; sahte "yenile" eylemi ekleme.
4. **ADM-23 (🟠)** — `AdminDevicesPanel.tsx:24` `nowMs` modül yüklenirken bir kez hesaplanıyor. Görünürken periyodik saat hook'u (ör. `src/hooks/useNow.ts`, 30 sn; sayfa gizliyken durur) + "son görülme X dk önce" + TR "Çevrimiçi/Çevrimdışı". Eşik testi fake timer ile. `src/lib/deviceStatus.ts` başka ekranlarca kullanılıyor; imzasını değiştirme (gerekirse yeni yardımcı ekle).
5. **ADM-24 (🟠)** — `AdminDeviceDialog.tsx`: `adminDevices.register` başarılı + `devices.claimDevice` başarısızsa: register sonucunu state'te tut, "Cihaz kaydedildi, projeye atama başarısız — Tekrar ata" durumu; tekrar deneme yalnız atama adımını çağırır (yeniden register yok → "UUID zaten kayıtlı" hatası kalkar). Kimlik doğrulaması: markaya göre gerçek sözleşme (IDE `ideUuid` = 15 haneli SYSTEM.UUID, 16 haneli seri DEĞİL; diğer markalar için mevcut alan kuralını koru) — frontend zod + backend `adminDevices.register` aynı saf doğrulayıcıyı kullansın (`convex/lib/deviceIdentity*.ts` + test). `convex/devices.ts` senin değil; `claimDevice` sözleşmesi yetmiyorsa `ask`.

## Ownership (yalnız bunlara yaz)
convex/auditLog.ts · convex/adminDevices.ts · convex/lib/auditLogQuery*.ts / convex/lib/deviceIdentity*.ts (yeni)
src/pages/AuditLog.tsx · src/components/admin/** · src/components/devices/ClaimDeviceDialog.tsx (yalnız kimlik doğrulayıcıyı paylaşmak için) · src/components/settings/sections/AdminDashboard.tsx · src/components/settings/sections/components/HolidayCalendarManager.tsx · src/hooks/useNow.ts (yeni)

## Kapsam dışı
`convex/devices.ts` · `convex/reports.ts` / `ReportsSettings.tsx` (ADM-rapor worker) · PDKS ekranları (`PDKSAuditTimeline.tsx`) · schema.ts (koordinatör) · Dalga 3 tasarım göçü.
