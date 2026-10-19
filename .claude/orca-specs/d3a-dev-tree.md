# Dalga 3a — DEV UX-1A + ACC UX-1D: Cihaz listesi/ağaç yerleşimi ve okuyucu iş akışı

**Hedef:** Cihaz listesi ve bölge/kapı/okuyucu ağacı 320–1280 px'de erişilebilir, filtreler URL'de kalır ve geri/ileri ile döner, IDE özel adı ağaç ve tabloda aynı görünür ve UUID ile aranabilir, model kolonu gerçek modeli gösterir; okuyucu yerinde düzenlenir (ad/yön/sensör), taşıma yönü korur ve ağaç eylemleri hover olmadan klavyeyle bulunur.

(Raporlar: `docs/ux-audit/01_CIHAZLAR.md` §3 DEV-03/04/05/09/10/11 + §5 UX-1A; `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md` §3 ACC-36/37/39 + §5 UX-1D. Ortak kurallar aşağıda.)

## Bulgular
1. **DEV UX-1A** — DEV-04, DEV-05, DEV-09, DEV-10, DEV-11 + DEV-03'ün URL/filtre görünürlüğü: raporun öneri sütunu ve UX-1A kabul maddeleri (320/375/768/1280 px ve %200 zoom'da ana içerik; filtre ve "filtreyi temizle" klavyeyle; checkbox'lar cihaz adını söyler; IDE özel adı ağaç+tabloda aynı ve UUID ile bulunur; model kolonunda gerçek model; tarayıcı geri/ileri filtreyi geri getirir). URL state'i için mevcut `?deviceId` deep-link'ini (Dalga 2b) koru ve aynı search-params mekanizmasına filtreleri ekle; proje değişince deviceId temizleme davranışı kalsın. Saf filtre/URL eşleme mantığı → `src/lib/deviceDisplay.ts` / `src/hooks/useDeviceFilters.tsx` + vitest.
2. **ACC-36** — `EditReaderDialog` ağaçtan erişilebilir olsun: okuyucunun mevcut kapısında ad/yön/sensör düzenleme (mevcut `readers.update` mutation'ı; backend değişikliği yok). `useAsyncAction` + başarıda kapan, hatada form açık.
3. **ACC-37** — Okuyucu/kapı eylemleri hover'a ek olarak `focus-within` ile görünür, ≥32px hedef, adlı; katlanmış alt ağaçlar DOM'dan çıkarılır veya `hidden`/`inert` (gizli odak hedefi kalmasın); açık ağaç sabit max-height (1500/2000px) ile kesilmesin.
4. **ACC-39** — `MoveReaderDialog`: hedef kapı otomatik seçilmesin (kullanıcı seçer), mevcut yön korunur; hedefte aynı yön doluysa açık uyarı ve kullanıcı seçimi — sessiz yön değişikliği yok. Karar mantığı saf fonksiyon + test.
5. Sahip olduğun dosyalarda tasarım sistemi göçü (ortak kurallar).

## Ownership (yalnız bunlara yaz)
src/hooks/useDeviceFilters.tsx · src/components/devices/{DevicesContent,DeviceFilters,DeviceList,DeviceTableRow,DeviceStats,DevicesHeader,DeviceBulkActions}.tsx · src/lib/deviceDisplay.ts (+ test) · src/components/devices/DeviceListErrorBoundary.tsx (yeni, gerekirse) · src/components/access-control/{ZoneDoorTreePanel,ZoneDoorTree,EditReaderDialog,MoveReaderDialog,ZonesAndDoors}.tsx · src/components/access-control/readerMove*.ts (yeni saf mantık + test)
`src/pages/Devices.tsx` → Dalga 3b'de DEV-1B worker'ının; bu görevde Devices.tsx'e YALNIZ filtre URL state bağlantısı için minimal dokunuş gerekiyorsa `ask` ile iste.

## Kapsam dışı
Cihaz ayrıntı/form/komut merkezi (DEV-1B, Dalga 3b) · `ZoneDoorTree` silme onayı ve `EditDoorDialog` (Dalga 2b'de yapıldı — koru) · backend · ortak bileşenler (SHL).
