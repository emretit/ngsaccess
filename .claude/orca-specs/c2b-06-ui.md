# C2b W-06-ui — 06 Ziyaretçiler sayfası A2 (frontend) + ACC-1C
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/06-ziyaretciler/REPORT.md` (tüm "Yeni tasarım":
bilgi mimarisi, kolonlar ve 390px, durum sözleşmesi, boş/yükleniyor/hata metinleri, kayıt/kart yakalama/ayrıntı) + `mockup.html`.
Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2b-06-api.md` — visitors.listPage / summary / getDetail / update.
Ek: `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md` UX-1 §1C (bölge oluşturup dönünce taslak korunur; bitişten sonra "aktif" kalmaz).

## Hedef (test edilebilir)
`/visitors` A2 düzende: PageHeader (tek birincil "Ziyaretçi kaydet") → StatInline (`summary`, undefined iken iskelet, geçici 0 yok)
→ DeviceSyncStatusBanner (tek yerde, başlık altında) → FilterBar (durum + arama; sunucu/sayfa-içi kapsamı dürüst) → `listPage` ile
cursor'lı 42px tablo (ad = ayrıntı düğmesi, tek satır menüsü) → ayrıntı Sheet'i (`getDetail`) → kayıt/düzenleme formu tek sütun,
dirty korumalı. 1440/390'da yatay taşma yok (bugün mobilde tablo taşıyor); vitest + build yeşil.

## İş
1. `src/pages/Visitors.tsx`, `VisitorManagement.tsx`: URL state (q, status); eski `visitors.list` tüketimi `listPage`+`summary`'ye geçer
   (`useVisitors.ts` dışa açık imzası başka yerde kullanılıyorsa geriye uyumlu tut; grep ile kontrol).
2. `VisitorStats.tsx` → StatInline; `VisitorFilters.tsx` → FilterBar (içindeki tekrar başlık/ikon kutusu kalkar); `VisitorTable.tsx` →
   rapordaki kolon önceliği, mobil liste; durum rozeti backend durum enum'undan (tek eşleme dosyası `components/visitors/lib/status.ts` + test).
3. Ayrıntı (`VisitorSlideOverPanel.tsx`): görüntüleme önce, Düzenle ayrı; hassas alanlar yalnız ayrıntıda; rıza durumu (sürüm/tarih);
   son okumalar; kart iadesi/sonlandır/sil mevcut ConfirmDestructive sözleşmesiyle.
4. Form (`VisitorForm.tsx`, `VisitorFormFields.tsx`, `hooks/useVisitorForm*.ts`, `VisitorZoneDialog.tsx`, `VisitorCardCapture.tsx`):
   tek sütun, sticky FormActions, alan altı hata, `useUnsavedChangesGuard`; ev sahibi ve bölge Combobox; düzenlemede bölge KAPALI
   (backend yok — açıklayıcı metin); bölge oluşturma dialoğundan dönünce taslak korunur ve yeni bölge seçili gelir; pasif kayıt
   düzenlemede değişmeyen geçmiş bitiş gönderilmez (backend raporundaki kural). zod alan adları YENİDEN ADLANDIRILMAZ;
   `cardCaptureSession` mantığı korunur.
5. Boş/yükleniyor/hata/erişim yok durumları rapordaki Türkçe metinlerle; QuerySectionBoundary bölüm bazında.

## Ownership
src/pages/Visitors.tsx · src/components/visitors/** (yeni dosyalar dahil) · src/hooks/useVisitors.ts · src/types/visitor.ts

## Kapsam dışı
convex/** (ask) · DeviceSyncStatusBanner (05'in; yalnız tüket) · kişi bazlı cihaz senkron gösterimi · bölge değişimi · ui|shared|layout.
