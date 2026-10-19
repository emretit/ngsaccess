# C2a W-pdks-ui — 08 PDKS Kayıtları sayfası A2 (frontend)
Önce `.claude/orca-specs/c2-common.md` oku. Hedef: `docs/ui-scan/pages/08-pdks-kayitlari/REPORT.md` (PDKS-UI-01..21 + "Yeni tasarım":
IA, günlük kolonlar, puantaj, durumlar/renk, gün detayı + manuel form, dışa aktarma, Türkçe metinler, 390px) +
`docs/ui-scan/pages/08-pdks-kayitlari/mockup.html`. **Backend sözleşmesi:** `.claude/orca-specs/reports/c2a-pdks-api.md` (W-pdks-api
bitirdi; yeni arg'lar, gün durumu enum'u, sayısal süreler, upsertManual zorunlu gerekçe — oradaki adları kullan, uydurma).
Önceki PDKS planı: `docs/PDKS_KAYITLARI_UX_PLANI_2026-10-16.md` (UX-0 tarih gezgini / editDate güvenliği GERİ ALINMAZ).

## Hedef (test edilebilir)
`/pdks-records` mockup düzeninde: PageHeader ("PDKS Kayıtları" + "Proje · okunur tarih", tek birincil "Dışa aktar" menüsü, "Diğer"
içinde İçe aktar + Asistan) → dönem satırı (Günlük/Haftalık/Aylık + ◀▶ + tarih + Bugün; URL anchorDate/reportType korunur) → tek
FilterBar (ad/soyad arama, departman, "Diğer filtreler" sheet: şirket/pozisyon/vardiya; temizle tarih+projeyi korur) → kartsız sayaç
satırı (tek durum filtresi burada; günlükte "kişi", dönemde "kişi-gün") → Günlük = 42px sıralanabilir DataTable, Haftalık/Aylık =
puantaj (ayrı Heatmap sekmesi kalkar). Hücre/satır → çalışan+gün detayı → aynı güne "Manuel düzelt" (gerekçe zorunlu). Tüm sorgular
başlıktaki `projectId`'yi geçer. 1440/390'da belge yatay kaymaz (yalnız puantaj kabı kayar). Mevcut vitest'ler + yeni saf testler yeşil.

## İş
1. Sayfa iskeleti (`src/pages/PDKSRecords.tsx`): PDKS-UI-01 sırası; PDKSQuickPresets/SmartPresets/OvertimeAlert bilgileri tarih/uyarı
   menüsüne (kapsam etiketiyle: "2026 yılı", "son 30 gün", seçili gün); PDKSInlineQuery bandı ve floating asistan düğmesi kalkar →
   asistan isteğe bağlı Sheet. Mevcut dört görünüm sekmesi kalkar; Analiz ikincil görünüm ve aynı kapsam sözleşmesini (proje + filtreler)
   alır (PDKS-UI-16).
2. Tek filtre sahibi (PDKS-UI-02): `PDKSFilterBar.tsx` + `usePdksFilterParams.ts`; tablodaki yerel arama/durum kontrolleri kaldırılır;
   PDKSMobileDrawer aynı state'i kullanır. Durum sayaçları arama/organizasyon filtresinden sonra, durum filtresinden önce hesaplanır.
3. Günlük tablo (`PDKSTableView.tsx`, `PDKSMobileCardList.tsx`): rapordaki 9 kolon; başlık düğmeleri + `aria-sort` (ad Türkçe locale,
   saatler dakika, süreler sayısal alan — string "8h 5m" sıralanmaz); ad düğmesi detay açar; satır işlemleri tek RowActions; kart
   içinde kart/gradyan/zebra/emoji yok; saat "08:30", süre "08 sa 30 dk", tabular-nums; "ID" kolonu yok (kart no detayda).
4. Puantaj (`PDKSHeatmapView.tsx` evrilir): sticky çalışan sütunu, 72px gün sütunları, hücre metni kod+süre ("M · 08:30", "HT · —"),
   legend, her hücre `button` + tam `aria-label` (ad, tarih, durum, süre), Enter/Space detay. `future` → "Henüz gelmedi", `noData` →
   "Veri yok"; gelecekten devamsızlık gösterme (PDKS-UI-20). Dönem toplamı `days[]` dakikalarından.
5. Durum/renk tek kaynak (`src/components/pdks/statusMeta.ts`): A2 semantik token'ları — Mevcut success, Geç/Erken çıkış warning,
   Devamsız danger, İzinli info, Hafta tatili/Resmî tatil/Manuel/Fazla mesai nötr; üç kopya renk haritası kaldırılır. Biyometrik kaynak
   rozeti/filtresi/sütunu EKLENMEZ; tüm hareketlere "Kart" etiketi basılmaz.
6. Gün detayı (`PDKSEmployeeDetailDrawer.tsx`) + form (`ManualPdksEditDialog.tsx`): rapordaki sıra; loading / bulunamadı / erişim reddi
   ayrı (`!detail` sonsuz yükleme değil); yönü belirsiz hareket "Yön belirtilmemiş". Form: sabit çalışan + okunur Türkçe tarih,
   "Kart okumaları korunur; değişiklik denetim kaydına işlenir", giriş/çıkış alan altı hata ("Geçerli bir saat girin (08:30).",
   "Çıkış saati girişten sonra olmalı.", "En az bir saat girin."), **gerekçe zorunlu** (backend sınırlarıyla aynı), hata özeti,
   pending "Kaydediliyor…" + çift gönderim kilidi, sunucu hatası formda kalır, dirty kapanış `useUnsavedChangesGuard`. Gece yarısı
   aşan çıkış seçeneği taklit edilmez. Dönem hücresindeki "Manuel düzenle (yakında)" pasif durumu kalkar (PDKS-UI-04).
7. Dışa aktarma (`PDKSEnhancedExportPanel.tsx` → başlık menüsü): Excel/CSV/PDF + ayraç + Aylık bordro cetveli + SGK APHB; önizleme
   proje + dönem + filtre özeti + seçili/tüm satır sayısı; APHB uyarıları indirmeden ÖNCE listelenir; aylık çıktılar kişi filtresini
   uygulamıyorsa açıkça yazılır. `src/utils/pdksExport.ts` fonksiyonları korunur; seçim BulkBar'ı yalnız kapsamı değiştirir.
8. Durumlar: bölüm iskeleti (`role=status`, sayaçlar 0'a düşmez), gerçek hata sınırı (`usePdksTableData` sabit `error:null` kalkar;
   QuerySectionBoundary), ilk kullanım / filtre boş / günde hareket yok metinleri rapordaki gibi.
9. 390px: tek kolon kontrol akışı, gelişmiş filtre sheet, günlük liste çizgili satırlar (kart-içinde-kart yok), puantaj kontrollü yatay kaydırma.
10. Saf mantık (sıralama, sayaç, hücre etiketi, süre biçimi) için `src/components/pdks/lib/*.ts` veya `src/lib/pdks*.ts` + vitest.

## Ownership
src/pages/PDKSRecords.tsx · src/components/pdks/** · src/hooks/usePdks*.ts · src/lib/pdksSummary.ts (+test) · src/lib/pdksDateRanges.ts ·
src/utils/pdksExport.ts

## Kapsam dışı
convex/** (backend bitti; eksik/yanlış sözleşme görürsen DUR, `ask`) · Canlı İzleme / CardReadings* · sunucu sayfalama · Faz 2 hesap
motoru · net çalışma / mola / eksik okutma sayacı / dönem kilidi (backend yok — gösterme) · src/components/ui|shared|layout.
