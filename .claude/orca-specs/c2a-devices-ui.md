# C2a W-devices-ui — 03 Cihazlar sayfası A2 (frontend, backend yok) + DEV-1B
Önce `.claude/orca-specs/c2-common.md` oku. Hedef: `docs/ui-scan/pages/03-cihazlar/REPORT.md` (DEV-UI-01..18 + "Yeni tasarım": IA,
kolonlar, durum metinleri, ağaç/diyalog/formlar, 390px) + `docs/ui-scan/pages/03-cihazlar/mockup.html`. Ek bulgular:
`docs/ux-audit/01_CIHAZLAR.md` §5 UX-1B (DEV-16, DEV-26, DEV-28 demo sınırı, DEV-29, DEV-38) — kabul satırı oradadır.

## Hedef (test edilebilir)
`/devices` mockup düzeninde: PageHeader ("Cihazlar" + proje kapsamı, tek birincil "Cihaz ekle" → Yeni cihaz / Havuzdan ata) →
StatInline (Toplam/Çevrimiçi/Çevrimdışı/Henüz bağlanmadı; filtreden bağımsız) → FilterBar (arama, "Bağlantı: Tümü", "Tip: Tümü",
"Bölge ve kapı" sheet düğmesi, seçili konum chip'i, temizle) → tek yüzey 42px DataTable (# kolonu yok; ad düğmesi ayrıntı açar;
diğer eylemler tek RowActions menüsünde) + BulkBar + 25/50/100 yerel sayfalama. Cihaz ayrıntısı 620px Sheet: varsayılan
**Genel bakış**, sonra Ayarlar; dirty kapanış korumalı. Konum ağacı kalıcı sol panel değil, 480px Sheet. 1440/390'da yatay taşma yok.

## İş
1. Liste: `DevicesContent.tsx`, `DeviceList.tsx`, `DeviceTableRow.tsx`, `DeviceStats.tsx` → StatInline, `DeviceFilters.tsx` → FilterBar
   (URL/arama mantığı ve proje değişiminde sıfırlama korunur; C0'daki dev-tree değişiklikleri: zoneId/doorId URL, filtre temizliği,
   `DeviceListErrorBoundary` — KORU), `DeviceBulkActions.tsx` → BulkBar (onayda isimler; görünür seçim/kısmi sonuç sözleşmesi
   `useDeviceTable.ts` + `deviceSelection.test.ts` korunur). Kolon kırılımı rapordaki tabloya göre (390: seçim, ad, bağlantı, menü).
   Bağlantı rozeti `deviceConnection` ortak hesaplayıcısıyla: Çevrimiçi (success) / Çevrimdışı (nötr) / Henüz bağlanmadı (nötr).
2. Ayrıntı: `DeviceDetailsPanel.tsx` başlık = cihaz adı; sekmeler Genel bakış (bağlantı+son sinyal TR tarih-saat, kimlik/marka/transport,
   bekleyen/başarısız işlemler, kapılar ve okuyucular, teknik ayrıntı açılır) / Ayarlar (form + `DeviceApiTokenCard` — sır ilk bakışta
   açık değil). `DeviceCommandCenter.tsx`: kart-içinde-kart yerine 1px ayırıcılı bölümler; "Capability Snapshot" → "Cihaz özellikleri";
   komut onayı hedef kapı + cihaz adıyla, pending kilit; kuyruk metni "Komut sıraya alındı; cihaz onayı bekleniyor." (fiziksel açılış iddiası yok).
3. Formlar: `DeviceForm.tsx`, `BrandPickerStep.tsx` (nötr seçim satırları; IDE = "MQTT ile bağlanan çok kapılı panel", Hikvision =
   "Gateway veya yerel köprü"), `DeviceAddMenu.tsx`, `ClaimDeviceDialog.tsx`, `AssignLocationForm.tsx`, `form-sections/*`. Dirty kapanış
   `useUnsavedChangesGuard` + `UnsavedChangesDialog`; marka geri dönüşünde taslak korunur; pending'de kapanış kilitli; alan altı hata +
   üst hata özeti + ilk hataya odak. zod/form `name=` ve kaydetme API sözleşmesi DEĞİŞMEZ. DS-K2804'e ISAPI portu uydurma
   (memory: SDK port 8000). "Cihaz kaydedildi; bağlantı kurulamadı" kısmi başarı düzeltmesi korunur.
4. Konum: `ZoneDoorTreePanel.tsx` → Sheet (mobil tam genişlik), `ZoneDoorTree.tsx` bölge→kapı→okuyucu, sahip cihaz kapının yardımcı satırı,
   okuyucu eylemleri tek menü, silme engeli gerekçesi menüde; `AddZoneDialog`, `AddDoorDialog`, `EditDoorDialog`, `AddReaderDialog`,
   `EditReaderDialog`, `MoveReaderDialog` A2 form düzeni — `readerMove.ts`/`doorPlanResult.ts` doğrulamaları ve testleri korunur.
5. Durumlar: rapordaki Türkçe metinler (yükleniyor iskelet, hata + gerçek reset, proje boş, filtre boş, konum boş). Sabit renk/emoji kalmaz;
   toast `notify`.
6. Saf yardımcı çıkarırsan (`src/components/devices/lib/*.ts`) vitest yaz.

## Ownership
src/pages/Devices.tsx · src/components/devices/** (HARİÇ `VirtualReader.tsx` — koordinatörün) · src/hooks/useDeviceFilters.tsx ·
src/hooks/useDeviceTable.tsx · src/hooks/useDeviceForm.ts · src/hooks/useDevices.ts (DİKKAT: Visitors/GroupDevicesManager/
ZoneDeviceTree de kullanıyor — dışa açık imza geriye uyumlu) · src/components/access-control/{ZoneDoorTree,ZoneDoorTreePanel,
AddZoneDialog,AddDoorDialog,EditDoorDialog,AddReaderDialog,EditReaderDialog,MoveReaderDialog}.tsx · src/components/access-control/{readerMove,doorPlanResult}.ts (+test)

## Kapsam dışı
convex/** · src/components/sync/** (05'in; DeviceSyncStatusBanner yalnız tüket, SyncIssuesBanner kabukta) · access-control/unified/**,
CardReadings*, Group*Manager, ZonesAndDoors (05/07'nin) · src/pages/VirtualReaders.tsx · sunucu sayfalama · src/components/ui|shared|layout.
