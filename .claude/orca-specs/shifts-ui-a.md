# Görev A — Vardiyalar başlık + araç çubuğu + boş durum + bağlantılar (Faz 1 + V-O6/V-O7/V-O11 bağlantısı)

**Hedef:** /shifts sayfasında 1231×775 pencerede takvim tablosu ilk ekranda (üstü ≤ ~y=300) görünür; başlık altında proje adı, sayaç satırı ve açık dışa aktarma düğmeleri yok; tüm kontroller tek araç çubuğunda.

**Ownership (yalnız bunlara yaz):**
- src/components/shifts/calendar/ShiftCalendarPlan.tsx
- src/components/shifts/calendar/CalendarHeader.tsx
- src/components/shifts/calendar/CalendarNavigation.tsx
- src/components/shifts/calendar/useShiftCalendarData.ts
- src/components/shifts/lib/auditFixes.test.tsx, src/components/shifts/calendar/*.test.ts(x) (yeni test dosyası açabilirsin)
- yeni dosya açabilirsin: src/components/shifts/calendar/ altında

**Yapılacaklar:**
1. V-O1: CalendarHeader'da `scope` ("NGS · Çalışma planı") kaldır; `projectName` prop'u yalnız dışa aktarma dosya adında kalsın.
2. V-O2: PDKS Kayıtları kalıbı (src/pages/PDKSRecords.tsx:60-101): başlıkta `İşlemler` DropdownMenu (outline). İçinde: `Dışa aktar` alt menüsü (DropdownMenuSub) → "Excel (.xlsx)", "CSV" + küçük açıklama "Görünen sayfa ve dönem" (DropdownMenuLabel ya da muted metin); `reports.view` yoksa alt menü yok. `Toplu temizle` öğesi yalnız `schedule.manage`. Hiç öğe yoksa İşlemler düğmesi hiç görünmesin. ShiftCalendarPlan'daki açık düğme satırını (Toplu temizle/Excel/CSV/not) kaldır. Başlık sırası: [İşlemler] [Vardiya tanımları (outline, openDefinitions)] [Vardiya ata (primary, yalnız schedule.manage ve aktif tanım varken)].
3. V-O3: StatInline satırını kaldır.
4. V-Y1 + V-O10 + V-D6: Tek araç çubuğu satırı (masaüstü tek satır, dar ekranda wrap): sol grup → ikon düğmeler ChevronLeft/ChevronRight (aria-label "Önceki dönem"/"Sonraki dönem"), "Bugün", kısa aralık etiketi ("19–25 Ekim 2026"; ay sınırı geçerse "27 Eki – 2 Kas 2026"; ay görünümü "Ekim 2026"; mobil gün "23 Ekim 2026 Cum") + yanına muted "İstanbul saati". Aralık etiketine tıklayınca tarih seçici açılsın (src/components/ui/date-picker.tsx'teki DatePicker/DateInput'tan uygun olanı kullan; ayrı "Tarih" etiketli kutu kalksın). Dönem: PdksPeriodSwitcher (src/components/pdks/records/PdksPeriodSwitcher.tsx) gibi "Hafta | Ay" düğme grubu (variant secondary/ghost + aria-pressed), compact (≤760px) modda gizli. Sağ grup → arama input'u (görünür büyük etiket yok, aria-label "Çalışan ara", placeholder "Çalışan ara") + vardiya filtresi ShiftSelect + filtre aktifken "Temizle" ghost düğmesi. Ayrı satırdaki "19 Ekim 2026 Pzt – 25 Ekim 2026 Paz" yazısını kaldır. Pagination özeti: "1–2 / 2 çalışan" ("İstanbul saati" oradan kalkar).
5. V-O7: aktif tanım yokken (active.length===0) yalnız TEK EmptyState göster: başlık mevcut mantık ("Henüz vardiya tanımlanmamış"/"Atanabilir vardiya yok"), açıklama "Atama yapmak için önce bir vardiya tanımlayın.", eylem (yalnız schedule.manage) "Vardiya tanımlarına git" → openDefinitions. Bu durumda araç çubuğu, BulkBar, takvim ve pagination render edilmesin; başlıkta "Vardiya ata" görünmesin ("Önce vardiya tanımla" etiketi de kalksın, başlıkta "Vardiya tanımları" zaten var). Aktif tanım varken atama yoksa takvimin üstünde tek satır muted "Bu dönemde atama yok." kalsın (ipucu cümlesi yok).
6. V-O6 bağlantısı: takvim `onOpen(employee, date)`: `canManage && active.length>0 && getData(employee,date).records.length===0` ise ayrıntı penceresi yerine doğrudan `setAssign({ employeeIds:[employee._id], startDate:date, endDate:date })`; aksi halde mevcut detail.
7. V-O11 bağlantısı: calendarProps'a `canAssign: canManage && active.length>0` ve `selectAll` ekle: checked = görünen tüm çalışanlar seçiliyse true, bir kısmı ise "indeterminate", yoksa false; onToggle → hepsi seçiliyse temizle, değilse görünen tüm çalışanları seç. (Prop tipleri `CalendarProps`'ta hazır: src/components/shifts/ShiftCalendarGrid.tsx — o dosyaya YAZMA, B'nin.)
8. Mobil (390×844): başlık + araç çubuğu ajandayı ilk ekranın altına itmesin; düğmeler min-h-11 kuralını korusun.

**Kapsam dışı:** ShiftCalendarGrid/Cell/Agenda/DayDetails görünümü (B), tanımlar paneli/sayfası ve ShiftCalendarView.tsx (C), renk.
**Kabul:** tsc 0 (senin dosyaların), eslint temiz, `npx vitest run src/components/shifts` yeşil; testte: proje adı başlıkta yok, İşlemler menüsünde Dışa aktar/Toplu temizle yetkiye göre, aktif tanım yokken tek boş durum ve takvim yok, boş hücre tıklaması atama formunu açar.
