# C2c W-11-ui — teslim

- `src/pages/AuditLog.tsx:15`: doğrulanmış `/audit-log` rotasında PageHeader → FilterBar → sonuç/tablo → alt bilgi A2 akışı; ayrı super_admin kapsam anahtarı. Salt okunur; dışa aktarma/form/BulkBar yok.
- `src/components/audit/AuditFilters.tsx:13`: actorOptions tarihsel aktörleri, status alt metinleri, bağımsız Sistem seçeneği, yükleniyor/erişilemeyen aktör ve truncated açıklaması. Arama önce, desktop kullanıcı/eylem/varlık aynı satır; tarihler/temizle ikinci satır, mobil Filtreler açılır alanı.
- `src/components/audit/useAuditUrlState.ts:9`, `auditState.ts:11`: 300ms URL q, kapsamı koruyan temizle; Layout proje değişiminde sayfayı remount ettiği için son kapsam modül düzeyinde korunur. Kapsam değişince user silinmeden liste mount edilmez, cursor/snapshot yeni scope altında yeniden kurulur.
- `src/components/audit/AuditResults.tsx:15`: ilk sıfır eşleşmede en çok 5 otomatik devam; istek ref kilidi ve SDK koruması; QuerySectionBoundary dışında tutulan snapshot devam hatasında satırları korur. Tekrar dene query bileşenini yeniden kurar; önceki cursor yerine ilk sayfadan başlayarak güncel snapshot ile değiştirir.
- `src/components/audit/AuditTable.tsx:6`, `AuditDetailPanel.tsx:8`: 42px masaüstü tablo, mobil varlık hücresinde kullanıcı/zaman/proje, tek Ayrıntı eylemi; 720px/telefon tam genişlik modal, açan düğmeye odak dönüşü.
- `src/components/audit/AuditChangeDetail.tsx:21`, `auditLabels.ts:178`: props geriye uyumlu, yeni action/note opsiyonel; Alan/Önce/Sonra ayırıcıları, Kaydedilmedi açıklaması, Türkçe tarih/enum, sıfır/false korunumu; diff ve JSON mevcut maskelemeden geçer. Tam targetId ve gerçek clipboard sonucu. `rg AuditChangeDetail src` ile başka tüketici olmadığı doğrulandı; PDKSAuditTimeline kendi bileşenini kullanıyor, PDKS dosyaları değiştirilmedi.
- `src/components/audit/auditState.ts:27`: İstanbul başlangıç dahil 00:00/bitiş dahil 23:59:59.999; ters/geçersiz tarihte alan altı hata + iki input aria-describedby; list query mount edilmez, sıfır sonuç gösterilmez. Ortak DatePicker aria prop iletmediği ve ui ownership dışında olduğu için yerel etiketli native date input kullanıldı.
- `src/components/audit/auditState.test.tsx:19`: 8 yeni sözleşme testi (kapsam/temizle, Sistem userId yokluğu, tarih sınırları, formatter/maskeleme/legacy props, project_user query mount yokluğu); audit toplam 15 test geçti.

## Kapılar

- İlk app tsc koşumları 0 hata; son tam koşumda yalnız eşzamanlı sahiplik dışı `src/components/admin/AdminUsersPanel.tsx:41,49` users/loading hataları vardı; Audit dosyalarında hata yok.
- Convex tsc: 0 hata.
- Audit/page hedefli eslint: 0 hata/0 uyarı; son tam eslint: sahiplik dışı `AdminListParts.tsx:23-24` 4 refs hatası, `useAdminFormGuard.tsx:17` immutability hatası; ayrıca bu dosya:20 ve `leaves/LeaveList.tsx:1` uyarıları. Koordinatöre status mesajıyla bildirildi.
- Tam Vitest: 99 dosya, 1006 test geçti; son hedefli tekrar: 2 dosya, 15 test geçti.
- Vite production build geçti; mevcut 500kB chunk uyarısı var. `git diff --check` geçti.

## Koordinatörün gerçek oturumda bakacağı akışlar (1440 + 390)

1. Seçili proje ve Tüm projeler görünümü; filtreli kapsamda temizle proje/kapsamı korumalı, proje değişince kullanıcı ve cursor sıfırlanmalı; eski projenin satırları görünmemeli. URL q debounce/back/forward kontrolü.
2. Silinmiş/eski/aynı adlı kullanıcı etiketleri, Sistem+eylem+arama, truncated notu; seçeneklerin yükleme ve hata/tekrar dene durumu.
3. Ters tarih aralığı ve tek uçlu tarih; İstanbul gece sınırları; filtreli boş ve ara cursor boşluğu/en fazla 5 otomatik devam; çift tıkla yükleme, devam hatasında satırların kalması ve retry.
4. Mobil Filtreler aç/kapat, uzun ad/not/kimlik, Ayrıntı paneli Tab/Esc/odak dönüşü; tam ID kopyalama başarı/izin hatası, maskeli JSON ve önce/sonra karşılaştırması. project_user doğrudan URL ve Ana Sayfa bağlantısı.

1440/390 için min-w-0, sabit tablo yerleşimi, viewport ile sınırlı select popup, sarılan panel değerleri ve yalnız tablo kabında overflow-x-auto kod düzeyinde uygulandı; canlı tarayıcı/oturum ölçümü yapılmadı. Ortak kabuk/ui/shared/layout, convex ve PDKS değiştirilmedi; commit/push/deploy/migration/DB yazma veya paket kurma yapılmadı. Canlı entegrasyon/görsel-klavye doğrulaması koordinatörde; audit kapsamını genişletme/arama backfill/dışa aktarma bu faz dışında bırakıldı.
