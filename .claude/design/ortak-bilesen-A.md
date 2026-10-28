Liste/tablo keşfi A — 27 Ekim 2026; yalnız kaynak okuması, çalışma zamanı/görsel tarayıcı testi yapılmadı.
10 aday doğrulandı: 6 yeni ortak kalıp, 4 mevcut shared bileşene geçiş/genişletme.
P1: ResponsiveResults, MasterDetailListLayout, useListSelection, CollapsibleFilters, SegmentedViewControl, StatusBadge, EmptyState, FilterBar.
P2: SectionSkeleton geçişi ve LoadMoreFooter; sayfalama/RowActions/BulkBar için üç örnek eşiğini sağlayan ayrı bir atlama iddiası yok.
Yalnız bu rapor yazıldı; src/components/shifts/** bulguları değişiyor olarak işaretlendi, süreler kaba uygulama tahminidir.

## Okuma ve sayım yöntemi

`src/pages/*` ve görevdeki bileşen klasörleri `rg` ile tarandı; aşağıdaki kullanım noktaları satır numaralı kaynak okumalarıyla doğrulandı. Shared API'leri ayrıca okundu. Adetler tüm repoya ilişkin tahminler değil, aşağıda tek tek listelenen doğrulanmış kullanımlardır. Aynı dosyadaki birden çok kullanım ayrıca belirtilir; adayların etki sayıları birbirleriyle örtüşür, toplanmamalıdır. Yeni adayların her biri en az üç farklı iş modülünde görülür. `ui/` primitive'leri aday değildir.

İlgili mevcut altyapı: `src/components/shared/TreePanel.tsx:75` yalnız sol paneli kapsar; `src/components/shared/FilterBar.tsx:7` zorunlu arama girdisi içerir; `src/components/shared/StatusBadge.tsx:9`, `src/components/shared/EmptyState.tsx:21`, `src/components/shared/SectionSkeleton.tsx:10` tekrar kullanılabilir sunum API'leridir. API önerilerindeki `ReactNode`, `StatusTone` gibi türler ilgili mevcut importları ifade eder. Etkide “+1” yeni ortak dosyadır; test dosyası sayısı ayrıca öngörülmemiştir.

## 1. ResponsiveResults — yeni · P1

**Tekrar:** Aynı verinin masaüstü tablo ve mobil kart/listesi iki ayrı JSX ağacında üretiliyor; dış kabuk her defasında görünürlük, `min-w-0`, yatay kaydırma, kenarlık ve ayırıcıları tanımlıyor. Ziyaretçi/erişim/admin 761px eşiği kullanırken izin/PDKS `md` kullanıyor; örneğin 761px'de aynı tür sonuçlar farklı görünüme geçiyor. Öneri yalnız sonuç kabuğunu birleştirir; sütunları veya domain satırlarını şemaya dönüştürmez.

**Yerler — 7 kullanım / 7 dosya / 5 modül:**

- `src/components/visitors/VisitorTable.tsx:15` ve `:22` — mobil liste / masaüstü tablo.
- `src/components/access-control/CardReadingsTable.tsx:15` ve `:21` — tablo / mobil article listesi.
- `src/components/leaves/LeaveList.tsx:60` ve `:104` — `md:block` / `md:hidden`.
- `src/components/pdks/dashboard/PDKSTableView.tsx:67` ve `:75` — mobil kart bileşeni / tablo.
- `src/components/admin/components/UserTable.tsx:90` ve `:118` — aynı çerçeve ve breakpoint.
- `src/components/admin/projects/ProjectsTable.tsx:47` ve `:90` — aynı çerçeve ve breakpoint.
- `src/components/admin/AdminDevicesPanel.tsx:228` ve `:283` — aynı çerçeve ve breakpoint.

**API:**

```ts
type ResponsiveResultsProps = {
  label: string; desktop: ReactNode; mobile: ReactNode;
  footer?: ReactNode; className?: string;
};
```

**Etki:** 7 kullanım dosyası +1 ortak dosya · risk **orta** · **3–5 saat**. Mevcut DOM semantiği ve satır içi butonların `onRowActivate` davranışı korunmalı; ortak breakpoint ürün kararı olarak bir kez seçilmeli. İki görünüm birlikte render edildiği için kimlik ve odak kontrolleri yapılmalı.

## 2. MasterDetailListLayout — yeni · P1

**Tekrar:** Sol ağaç + sağ içerik için `flex min-w-0 flex-col ... min-[1100px]:flex-row min-[1100px]:gap-5`, sağda `min-w-0 flex-1 space-y-4` aynı. Kişiler mobilde `gap-6`, cihaz ve PDKS `gap-4` kullanıyor; sol panel ile sonuç alanı arasındaki boşluk farklı. Mevcut TreePanel yalnız sol tarafı çözüyor.

**Yerler — 3 kullanım / 3 dosya / 3 modül:**

- `src/pages/Employees.tsx:171`, sağ içerik `:177`.
- `src/components/devices/DevicesContent.tsx:83`, sağ içerik `:85`.
- `src/pages/PDKSRecords.tsx:116`, sağ içerik `:122` — ShiftTree sarmalayıcısı `:117`.

**API:**

```ts
type MasterDetailListLayoutProps = {
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
};
```

**Etki:** 3 kullanım dosyası +1 ortak dosya · risk **düşük** · **45–90 dk**. Ağaçların kendi mobil açılma davranışı TreePanel'de kalır. PDKS'de sınır bileşeninin genişliği korunmalıdır; bu aday ShiftTree içini değiştirmez.

## 3. useListSelection + ListSelectAll — yeni · P1

**Tekrar:** Görünen kimliklerden seçim üretme, tek satırı ekleme/çıkarma, seçim temizleme ve “tümü/kısmi/hiçbiri” türetme tekrar ediyor. Cihaz ve vardiya kısmi durumu gösterirken PDKS üst kutusu yalnız boolean hesaplıyor; personel ve cihaz kısmi seçim çizgisini de farklı CSS ile çiziyor.

**Yerler — 4 modül uygulaması / 7 kaynak dosyası:**

- Cihaz: `src/components/devices/DeviceList.tsx:128` (elle kısmi durum + CSS); bağlandığı `src/hooks/useDeviceTable.tsx:19`, `:31` (görünür seçim ve handler'lar).
- Personel: `src/components/employees/table/EmployeeSelectAll.tsx:14` (ayrı kısmi durum CSS'i); bağlandığı `src/hooks/useEmployeeTable.ts:13`, `:26`, `:42` (seçim ve görünür liste değişiminde sıfırlama).
- PDKS: `src/components/pdks/dashboard/PDKSTableView.tsx:53`, `:83` (Set toggle ve boolean select-all).
- Vardiya: `src/components/shifts/calendar/ShiftCalendarPlan.tsx:108`, `:114`, `:121`, `:132` — **değişiyor** (Set toggle ve üç durumlu seçim).
- PDKS kontrollü seçimin sahibi: `src/components/pdks/records/usePdksRecordsView.ts:28`; bu dosya üstteki PDKS uygulamasının parçasıdır, ayrı tekrar değildir.

Hook dosyaları kapsam içi listelerin davranışını doğrulamak için yardımcı kanıt olarak okundu; mutation/onay mantığı bu önerinin dışındadır.

**API:**

```ts
type SelectionInput<Id extends string> = {
  visibleIds: readonly Id[]; selected: ReadonlySet<Id>;
  onChange: (next: Set<Id>) => void;
};
declare function useListSelection<Id extends string>(p: SelectionInput<Id>): { toggle: (id: Id) => void; selectAll: (value: boolean) => void; checked: boolean | "indeterminate" };
declare function ListSelectAll(p: { label: string; checked: boolean | "indeterminate"; onChange: (value: boolean) => void; disabled?: boolean }): ReactNode;
```

**Etki:** 7 kaynak dosyası +1 ortak modül · risk **orta** · **4–6 saat**. Görünür liste değişince personel temizliyor, cihaz kesişimi koruyor (`useEmployeeTable.ts:26`, `useDeviceTable.tsx:23`); bu politikalar çağıranda kalmalı. Yalnız saf seçim işlemi ve gösterimi ortaklaştırılmalı, toplu silme/gönderme handler'ları taşınmamalıdır.

## 4. CollapsibleFilters — yeni · P1

**Tekrar:** `useState(false)` + “Filtreler” butonu + `aria-expanded` + koşullu görünürlük dört modülde var. PDKS butonunda `aria-controls` yok; audit ve izin ekliyor. Rapor/PDKS `sm`, audit `md`, izin ise `useIsMobile` kullanıyor; `src/hooks/use-mobile.tsx:30` izin eşiğinin `max-width: 768px` olduğunu doğruluyor.

**Yerler — 4 kullanım / 4 dosya / 4 modül:**

- `src/components/pdks/dashboard/PDKSFilterBar.tsx:50`, `:56`.
- `src/components/audit/AuditFilters.tsx:35`, `:39` — gelişmiş filtreler; `:40` hata varsa açılıyor.
- `src/components/leaves/LeaveFilters.tsx:37`, `:47`.
- `src/components/reports/ReportScreen.tsx:31`, `:63`.

**API:**

```ts
type CollapsibleFiltersProps = {
  label?: string; activeCount?: number; forceOpen?: boolean;
  children: ReactNode;
  desktopDisplay?: "block" | "contents";
};
```

**Etki:** 4 kullanım dosyası +1 ortak dosya · risk **orta** · **2–3 saat**. Ortak `useId` ile buton/içerik bağlantısı üretilmeli; audit'in hata halinde görünür olma ve masaüstünde `contents` davranışı korunmalı. Bu aday Sheet/Dialog içini veya filtre alanlarını değiştirmez.

## 5. SegmentedViewControl — yeni · P1

**Tekrar:** Küçük seçenek dizisi/değeri + aktif/pasif Button variant + onClick ile liste görünümü/dönemi değiştiriliyor. PDKS/izin/vardiya `secondary/ghost`, erişim durumu/alarm `default/outline`; erişim görünümünde `aria-pressed` yok, alarm `role="tablist"` altında normal Button kullanıyor. Ortaklaştırılacak şey gerçek Tabs primitive'i değil, bu elle kurulmuş seçim gruplarıdır.

**Yerler — 5 kullanım / 5 dosya / 5 modül:**

- `src/components/pdks/records/PdksPeriodSwitcher.tsx:5`, `:17`.
- `src/pages/Leaves.tsx:139`, `:142` — yalnız üst görünüm seçici; talep/onay akışı kapsam dışı.
- `src/components/shifts/calendar/CalendarNavigation.tsx:40` — **değişiyor**.
- `src/components/access-control/unified/status/StatusResults.tsx:13`, `:21`.
- `src/pages/Alarms.tsx:112`.

**API:**

```ts
type SegmentedViewControlProps<T extends string> = {
  label: string; value: T;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
};
```

**Etki:** 5 kullanım dosyası +1 ortak dosya · risk **orta** · **2–3 saat**. `role="group"` + `aria-pressed` sözleşmesiyle görünüm seçimi sunulabilir; gerçek tabpanel gereken tüketici mevcut Tabs kullanmalıdır. URL güncellemesi, seçim temizliği ve tarih sıfırlama çağıranda kalır.

## 6. StatusBadge — atlanan · P1

**Tekrar:** Durum bilgisi kimi listede genel Badge, kimi listede yalnız renkli metin; mevcut StatusBadge nokta + semantik renk eşlemesini zaten sağlıyor. Aynı erişim sonucu CardReadingsTable'da StatusBadge iken dashboard canlı akışında 11px renkli paragraf; çevrimdışı/arşivli/güncel değil durumlarında genel Badge kullanılmış. Proje/marka gibi kategorik rozetler bu adayın dışındadır.

**Yerler — 5 kullanım / 5 dosya / 3 modül:**

- `src/components/access-control/door-plans/DoorPlansTab.tsx:176` — çevrimdışı, `Badge secondary`.
- `src/components/access-control/unified/templates/TemplatesPage.tsx:105` — arşivli, `Badge secondary`.
- `src/components/access-control/unified/status/StatusViews.tsx:20` — güncel değil, `Badge outline`; ana durum hemen üst satırda StatusBadge.
- `src/pages/Alarms.tsx:116` — önem: elle `text-danger` / `text-warning` / `text-muted-foreground`.
- `src/components/dashboard/LiveFeed.tsx:81` — erişim sonucu: elle renkli metin.

Karşılaştırma: `src/components/access-control/CardReadingsTable.tsx:10` erişim sonucunu mevcut StatusBadge ile gösteriyor. Detay panelindeki `StatusViews.tsx:184` bu listenin adedine dahil edilmedi.

**API — mevcut sözleşme yeterli:**

```ts
type SharedStatusProps = {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
};
```

**Etki:** 5 kullanım dosyası · risk **düşük** · **1–2 saat**. Arşivli gibi nötr bir durum zorla uyarı rengine çevrilmemeli; domain → tone eşlemesi çağıranda kalmalı. Dashboard'un dar satırına sığma kontrolü gerekir.

## 7. EmptyState — atlanan · P1

**Tekrar:** Boş liste koşulları özel `<p>/<div>` metniyle çiziliyor; shared EmptyState başlık, açıklama, kompakt boşluk ve canlı durum bildirimini sağlıyor. Mevcut örneklerde merkezli `p-4`, stilsiz paragraf, 12px metin ve merkezli `py-6` farklı sunumlar oluşmuş. “Daha taranacak kayıt var” durumu tam boş veriyle bir tutulmamalıdır.

**Yerler — 6 kullanım / 5 dosya / 4 modül:**

- `src/components/employees/EngineeringDepartmentView.tsx:35` — çalışan bulunamadı.
- `src/components/access-control/unified/templates/TemplatesPage.tsx:95` — görünür şablon listesi boş.
- `src/components/access-control/unified/status/StatusResults.tsx:88` ve `:138` — kişi görünümü ve açık cihaz listesinde iki kullanım.
- `src/components/dashboard/ReadingsTimeline.tsx:46` — bugünkü okuma listesi/grafiği boş.
- `src/components/devices/LocationTree.tsx:220` — bölge ağacı boş.

**API — mevcut sözleşme yeterli:**

```ts
type ListEmptyProps = {
  title: string; description?: string; compact?: boolean;
  action?: { label: string; onClick: () => void };
  className?: string; live?: boolean;
};
```

**Etki:** 5 kullanım dosyası · risk **düşük** · **1–2 saat**. Ağaç ve dashboard için `compact` gerekir. StatusResults'te cursor varken metin yalnız “yüklenenlerde eşleşme yok” demeli; filtre temizleme callback'i mevcut değilse sırf bileşeni kullanmak için işlev uydurulmamalıdır.

## 8. FilterBar — atlanan, API genişlemesi gerekir · P1

**Tekrar:** Arama/filtre hizalama ve temizleme satırı ortak bileşen dışında kurulmuş. Doğrudan geçiş tüm örneklerde mümkün değil: mevcut API aramayı zorunlu kılıyor; raporun DepartmentFilters'ı bu yüzden neredeyse aynı flex/temizleme markup'ını aramasız yeniden çiziyor. Vardiyada temizleme yalnız aktifken görünüyor, izinde her zaman etkin, ortak FilterBar'da boş filtrelerde disabled.

**Yerler — 4 kullanım / 4 dosya / 4 modül:**

- `src/components/reports/ReportScreen.tsx:26` — DepartmentFilters; hangi raporların bunu kullandığı `:36`.
- `src/components/leaves/LeaveFilters.tsx:48`, temizleme `:83` — aramasız filtre satırı.
- `src/components/access-control/unified/status/StatusFilters.tsx:62`, arama `:118` — grid + arama, ortak temizleme yok.
- `src/components/shifts/calendar/ShiftCalendarPlan.tsx:161`, arama `:162`, temizleme `:170` — **değişiyor**.

**API — geriye uyumlu opsiyonel arama / yerleşim genişlemesi:**

```ts
type FilterBarExtension = {
  search?: string; onSearchChange?: (value: string) => void;
  children?: ReactNode; onClear: () => void; hasFilters?: boolean;
  label?: string; layout?: "wrap" | "grid";
};
```

**Etki:** 4 kullanım + mevcut FilterBar = **5 dosya** · risk **orta** · **2–4 saat**. Opsiyonel arama çifti gerçek uygulamada union ile tiplenmeli; mevcut tüketicilerin API'si kırılmamalı. Bu çalışma filtre alanlarının FormFieldWrapper/zod tanımlarına dokunmaz. #4 aç/kapa kabuğu, bu aday içerideki satırdır; aynı işi iki kez ortaklaştırma önerisi değildir.

## 9. SectionSkeleton — atlanan · P2

**Tekrar:** İlk liste yüklemesinde yerel spinner veya yalın metin üretiliyor; erişilebilir `role="status"`, `aria-label`, `aria-busy` ve satır yer tutucuları mevcut SectionSkeleton'da toplanmış. Bu adayın önceliği yükleme sözleşmesini birleştirmek; metin ve skeleton arasında ürünce kasıtlı olabilecek görünüm tercihinin uygulama öncesinde doğrulanması gerekir.

**Yerler — 3 kullanım / 3 dosya / 3 modül:**

- `src/components/employees/EngineeringDepartmentView.tsx:28` — etiketsiz CSS spinner.
- `src/components/pdks/dashboard/PDKSAuditTimeline.tsx:31` — audit olay listesi yüklenirken yalın metin; yalnız liste durumu, içinde gösterildiği Drawer'ın yapısı kapsam dışı.
- `src/components/devices/LocationTree.tsx:218` — `zonesData === undefined` halinde yalın metin.

**API — mevcut sözleşme yeterli:**

```ts
type LoadingListProps = {
  rows?: number;
  label?: string;
  className?: string;
};
```

**Etki:** 3 kullanım dosyası · risk **düşük** · **30–60 dk**. Konum ağacında az satır kullanılmalı. `StatusPage.tsx:104` ek sayfa/yenileme esnasında da çalışabilen `busy` bildirimi olduğundan listeyi skeleton ile değiştirme adedine dahil edilmedi; mevcut verinin kaybolması önerilmiyor. `PDKSTableView.tsx:59` yerel loading dalı da sayılmadı: gerçek çağıranı `src/components/pdks/records/PdksRecordsResults.tsx:12` zaten SectionSkeleton gösteriyor ve `:53` tabloya loading geçmiyor.

## 10. LoadMoreFooter — yeni · P2

**Tekrar:** Cursor/hasMore durumuna göre outline düğmesi, yüklenirken disabled/etiket değişimi ve sonuç sonu metni ayrı ayrı kuruluyor. Bu ileri yükleme davranışı PaginationBar'ın önceki/sonraki sayfa sözleşmesinden farklı; zorla sayfa numarasına dönüştürülmemeli. Ortaklaştırma sorguları değil yalnız yükleme kontrolünü kapsar.

**Yerler — 4 kullanım / 4 dosya / 4 modül:**

- `src/components/audit/AuditResultsContent.tsx:13` — yükleme, izin/aktiflik ve son durum metni.
- `src/components/reports/ReportResults.tsx:81` — `!snapshot.isDone`, loading ve loadMore.
- `src/components/access-control/unified/status/StatusResults.tsx:76` — cursor + busy + more.
- `src/pages/Alarms.tsx:117` — CanLoadMore halinde loadMore(50).

**API:**

```ts
type LoadMoreFooterProps = {
  hasMore: boolean; loading: boolean; disabled?: boolean;
  onLoadMore: () => void; summary?: ReactNode;
  loadingLabel?: string; exhaustedLabel?: string;
};
```

**Etki:** 4 kullanım dosyası +1 ortak dosya · risk **orta** · **1–2 saat**. Audit'in `active` koşulu, raporun “yalnız yüklenenler dışa aktarılır” bilgisi ve alarmın sayfa büyüklüğü çağıranda kalır. Cursor yönetimini ortak bir Convex hook'una taşımak bu adayın kapsamı değildir.

## Eşik altında kalanlar ve kapsam sınırları

- **RowActions / BulkBar:** ziyaretçi `VisitorTable.tsx:13`, izin `LeaveList.tsx:38`, personel `EmployeeTableBulkSelection.tsx:12`, vardiya `ShiftCalendarPlan.tsx:175` zaten ortak bileşenleri kullanıyor. Üç doğrulanmış atlama bulunmadığı için ayrı aday açılmadı.
- **PaginationBar:** cihaz `DeviceList.tsx:230`, kişi `Employees.tsx:232`, rapor `ReportPage.tsx:66`, ziyaretçi `VisitorManagement.tsx:77` ortak bileşeni kullanıyor. Önceki/sonraki dönem düğmeleri kayıt sayfalaması değildir; atlama sayılmadı.
- **Sayaçlar:** `VisitorStats.tsx:12` StatInline kullanıyor; `StatusCounters.tsx:15` etkileşimli filtre düğmeleri, `TodayStrip.tsx:49` animasyon/ilerleme içeren metrikler, `PdksCounters.tsx:7` birim ekleyen özet satırı. Mevcut StatInline API'sine doğrudan eşdeğer oldukları iddia edilmedi; yalnız benzer kelimelerle yeni aday üretilmedi.
- **Dışa/içe aktarma:** `Employees.tsx:197`–`:198` modal açıyor; `AuditExportButton.tsx:30` ilerleme/iptal sunuyor; `ReportPage.tsx:55` format menüsü açıyor; `CalendarHeader.tsx:23` alt menü kullanıyor. Üç modülde aynı markup + davranış kanıtı olmadığı için genel ExportButton önerilmedi; yalnız “Dışa aktar” metninin ortak olması yeterli değil.
- Dialog/Sheet/Drawer iç yapısı, form alanları, ayar formları, onay ve mutation akışları için bulgu çıkarılmadı. Backend dosyası incelenmedi/değiştirilmedi, Convex komutu çalıştırılmadı.
- Kaynak değişmediği için tsc/eslint/test çalıştırılmadı. Bulgular kaynak düzeyindedir; görünürlük/renk farkları className/JSX kanıtıdır, çalışır tarayıcıda ölçülmüş sonuç değildir.
