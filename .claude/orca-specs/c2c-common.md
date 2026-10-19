# Faz C2c — ortak ek (C2b sonrası)
ÖNCE `.claude/orca-specs/c2-common.md` oku; oradaki tüm kurallar geçerli. Bu dosya yalnız C2c farklarını ekler.
- Repo HEAD `dbcb81f` (C2b canlı: 05/06/07/09). C2c sayfaları: 10 İzinler, 11 Denetim Kaydı, 12 Admin, 13 Ayarlar.
- Akış: Dalga 1 = 10/11/12 backend worker'ları + 13 frontend (13 backend gerektirmiyor). Koordinatör kapısı + denetimden sonra
  Dalga 2 = 10/11/12 frontend worker'ları, backend raporundaki sözleşmeyle. Backend worker `src/**`'a DOKUNMAZ.
- Canlıdaki eski frontend, bu backend deploy edildiğinde de çalışmalı: mevcut query/mutation imzalarını KIRMA. Yeni ihtiyaç = yeni
  fonksiyon veya opsiyonel yeni arg. Başka sayfaların kullandığı imzalar (aşağıda) özellikle korunur:
  `leaves.listForRange` (Vardiyalar takvimi) · `auditLog.getPdksAuditForEmployee` (PDKS) · `projects.list` (Cihazlar) ·
  `adminDevices.listForClaim` (Cihaz sahiplenme).
- Ürün varsayılanları (`docs/ui-scan/00_OZET.md` §5, kullanıcı itiraz etmedi):
  10: eski pending/rejected kayıtlar salt okunur · aynı kişide örtüşen onaylı izin ENGELLENİR · yalnız tam gün.
  11: "Filtreleri temizle" proje kapsamını korur · tarihsel aktör + "Sistem" filtresi dahil · dışa aktarma YOK (buton da yok).
  12: super_admin kullanıcıları Admin'den yönetir, proje yöneticisi Ayarlar'dan davet eder (TEK bileşen) · pasif proje yalnız
      seçiciden kalkar (yeni sunucu engeli yok) · IDE kurulum kartı mevcut haliyle kalır, yeni iddia eklenmez.
  13: tema taşıma/kişiselleştirme bu fazda YOK (mevcut davranış korunur, yeni toggle açılmaz) · iki bildirim alanı birleştirilmez ·
      günlük rapor Ayarlar'da kalır · kurulum sihirbazı yok.
- C2a/C2b ortak parçalarını yeniden yazma, kullan: `convex/lib/projectScope.ts` `resolveProjectScope`, `useActiveProjectScope`,
  `useUnsavedChangesGuard`, `QuerySectionBoundary`, `ConfirmDestructive`, `notify`, `useAsyncAction`, `nullablePatch/toPatch`.
  Dakikalık/arka plan yenilemede form ve liste kaybolmasın: gerekiyorsa `src/components/visitors/hooks/useStableQuery.ts` kalıbını
  kendi klasörüne kopyala (06'nın dosyasını import etme, değiştirme).
- Router v7 dersi (C2b'de canlıda yakalandı): `useState` + `setSearchParams` ikilisini senkronlayan `useEffect`, URL güncellemesi
  transition ile geç geldiği için yeni açılan paneli kapatabilir. URL↔state senkronunda URL'nin DEĞİŞTİĞİNİ ref ile izle
  (örnek: `src/components/access-control/CardReadings.tsx` `syncedReading`), ya da tek kaynak olarak yalnız URL'yi kullan.
- **Proje değişiminde taslak koruması (YENİ, koordinatör ekledi; `src/contexts/ActiveProjectContext.tsx` DEĞİŞMEZ):** Layout sayfayı
  proje değişince yeniden kurar, kirli taslak sessizce gider. Kirli formu olan her sayfa/panel şunu kullanır:
  `useProjectChangeGuard(dirty || pending, pending ? () => {} : guard.requestClose)` (`guard = useUnsavedChangesGuard(dirty)`);
  onaylanınca proje değişir. Eski "projeyi geri al + sor" kalıbını (SlideOverPanel/DeviceDetailsPanel) yeni kodda KULLANMA.
- Paralel worker'lar aynı ağaçta. Ownership listeleri ayrık; `convex/_generated/api.d.ts` ortak — yalnız KENDİ modül satırlarını ekle.
- Şema: `convex/schema.ts` koordinatörde. Koordinatör önden ekledi: `leaves.by_project_start [projectId,startDate]`,
  `leaves.by_project_end [projectId,endDate]`, `leaves.by_employee_start [employeeId,startDate]`. Başka index/alan gerekiyorsa
  `ask` ile TAM tanımı gönder (gerekçe + satır); beklerken şemaya bağlı olmayan işe devam et. Yeni alan `v.optional` (widen).
- Kapılar: app tsc · convex tsc · `node_modules/.bin/eslint src convex` 0 hata · `npx vitest run` yeşil (yeni saf mantık testleriyle) ·
  frontend için ek `npx vite build`.
- Rapor (backend): `worker_done` ≤10 satır + `.claude/orca-specs/reports/c2c-<ad>.md`: her yeni/değişen fonksiyonun TAM arg + dönüş tipi
  (frontend worker YALNIZ bu dosyayla çalışacak), hata kodları/mesajları, Türkçe etiket önerileri, tarama sınırları, açık riskler.
- Rapor (frontend): `worker_done` ≤10 satır + `.claude/orca-specs/reports/c2c-<ad>.md`: değişen dosyalar, koordinatörün gerçek
  oturumda ekranda bakması gereken akışlar (1440 + 390), bilerek ertelenenler.
