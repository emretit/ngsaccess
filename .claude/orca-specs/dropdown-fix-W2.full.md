# Dropdown fix — W2 (Kişi/İzin + Vardiya + PDKS + Rapor tüketicileri)
Hedef: aşağıdaki bulgular kapanır; tsc 0, eslint 0 error, ilgili vitest yeşil.
Kaynak rapor: docs/ui-audit-dropdowns/W2-kisi-pdks-ayar.md
Ownership (yalnız bunlar + *.test.tsx eşleri):
- src/components/shifts/ShiftSelect.tsx
- src/components/employees/EmployeeBulkActions.tsx
- src/components/leaves/EmployeePicker.tsx
- src/components/pdks/dashboard/PDKSSavedViews.tsx
- src/components/pdks/dashboard/PDKSFilterBar.tsx
- src/components/pdks/dashboard/PDKSDateNavigator.tsx
- src/components/pdks/chat/AiChatMessage.tsx
- src/components/shifts/calendar/CalendarNavigation.tsx
- src/components/reports/ReportScreen.tsx
Bulgular:
- #1 ShiftSelect yüksekliği: GEREK YOK (min-h-11 mobil dokunma hedefi UI audit 2'de bilinçli eklendi, a3b60391). Dokunma.
- #2 ShiftSelect: options boşken "__empty" disabled öğe; metni opsiyonel `emptyLabel` prop'u ile (varsayılan "Kayıt yok"); DepartmentTargetPicker/DayShiftsPicker'a dokunmadan varsayılan yeterli. EmployeeBulkActions departman Select'i: departments boşsa "__empty" "Departman bulunamadı".
- #3 + #4 EmployeePicker: Button + `⌄` glifi → `ComboboxTrigger` ({...control} ve aria-controls korunur; placeholder={!value}); PopoverContent → `COMBOBOX_CONTENT_CLASS` (align="start" kalsın). Seçili CommandItem'a ortak Check + sr-only "Seçili" (aria-selected prop'unu kaldır, cmdk kendi yönetiyor).
- #5 PDKSSavedViews max-height: GEREK YOK (primitive yaptı) — yalnız doğrula.
- #6 PDKSSavedViews uzun ad: menü öğesinde ad `min-w-0 truncate` span + `title={v.name}`; kayıt adı Input'una `maxLength={60}`.
- #7 PDKSFilterBar: departments/companies/positions === undefined iken "Tümü" öğesine ek "__loading" disabled "… yükleniyor"; ReportScreen departman Select'inde de yükleme durumu görünür olsun (placeholder işe yaramıyor çünkü value "all" — "__loading" disabled öğe ekle).
- #8 PDKSFilterBar: seçili departmentId/companyId/positionId liste yüklendiği halde listede yoksa ortak fallback `<SelectItem value={id}>Kaldırılmış kayıt</SelectItem>`.
- #9 AiChatMessage Debug Bilgisi tetikleyicisi: `h-7` → standart `size="sm"` (h-9); başka görünüm değişikliği yok.
- #10 PDKSDateNavigator + CalendarNavigation özel DatePicker tetikleyicileri: etiketin yanına `CalendarIcon` (lucide, `h-4 w-4 opacity-50`, aria-hidden) ekle.
Vitest alanı: `node_modules/.bin/vitest run src/components/shifts src/components/employees src/components/leaves src/components/pdks src/components/reports`
## Ortak kurallar (her worker)
Bağlam: ngsaccess web (React + Tailwind v4 + shadcn/Radix). Dropdown audit'i: docs/ui-audit-dropdowns/ (00_OZET.md + W1-primitive-gecis-cihaz.md + W2-kisi-pdks-ayar.md). Bulgu numaraları o raporlardaki tablolara aittir; satır numaraları audit anındakidir, kodu okuyarak yerini bul.

Koordinatör ŞUNLARI ZATEN YAPTI (dokunma, kullan):
- ui/popover.tsx ve ui/dropdown-menu.tsx içerikleri artık `max-h-(--radix-*-content-available-height) overflow-y-auto` alıyor → tüketicide yükseklik/scroll sınıfı EKLEME.
- ui/select.tsx SelectTrigger: boş seçimde placeholder rengi (`data-placeholder:text-muted-foreground`) primitive'de.
- ui/date-picker.tsx: ay/yıl listeleri Radix Popover'a taşındı, z-[9999] kaldırıldı.
- YENİ src/components/ui/combobox-trigger.tsx:
  - `ComboboxTrigger` (forwardRef <button>, role="combobox" varsayılan): SelectTrigger görünümü (h-9, border-input, bg-surface, ring offset 0, aria-invalid → kırmızı border, ChevronDown). Prop'lar: `placeholder` (true → seçim yokken muted renk), `wrap` (true → uzun metin alt satıra kayar, h-auto min-h-9). Çocuğu tek bir metin/ReactNode ver; truncate span'ı ve ikonu bileşen kendisi çizer. `PopoverTrigger asChild` içinde kullan; aria-expanded/aria-controls Radix tarafından verilir, mevcut aria-label/aria-describedby/aria-invalid/id/disabled/ref/{...control} geçişlerini KORU.
  - `COMBOBOX_CONTENT_CLASS`: popup genişliği tetikleyici genişliği (`--radix-popover-trigger-width`), en az min(240px, ekran-32px), en fazla ekran-32px, p-0. Combobox PopoverContent'inde eski sabit `w-[min(...)]` yerine bunu kullan.
- Seçili öğe göstergesi kalıbı (ProjectSwitcher ile aynı): CommandItem içinde metinden sonra `{selected && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}` (Check: lucide-react).
- Boş/yükleniyor kalıbı (Radix Select): veri `undefined` iken `<SelectItem value="__loading" disabled>… yükleniyor</SelectItem>`, dizi boşken `<SelectItem value="__empty" disabled>… bulunamadı</SelectItem>`. Value'lar gerçek ID'lerle çakışmasın; form state'ine bu değerler asla yazılmasın (disabled zaten seçilemez). Mevcut "Tümü"/"Yeni oluştur" gibi öğeler yerinde kalır; boş mesajı onlara EK olarak, gerçek seçenek sayısı 0 olduğunda gösterilir.
- Kaybolan seçim kalıbı: seçili ID listede yoksa ve liste yüklendiyse, o ID için disabled olmayan bir fallback `<SelectItem value={id}>Kaldırılmış kayıt</SelectItem>` göster (filtrelerde kullanıcı "Tümü"ne dönerek temizler).
Raporun "Öneri" sütunu yön verir; rapor yanlışsa (kod zaten doğruysa veya primitive düzeltmesi yetiyorsa) değiştirme, rapora "gerek yok" diye yaz.

YASAKLAR:
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore`, `git switch` ÇALIŞTIRMA. npm install / deploy / convex komutu YOK. Worktree açma. Commit atarsan iş geçersiz sayılır.
- src/components/ui/** ve src/components/shared/** dosyalarına YAZMA (koordinatörün).
- Ownership listesi dışındaki dosyaya yazma. İşe başlamadan önce her ownership dosyası için `git status --porcelain <dosya>` çalıştır; boş değilse (başka oturum kirli) o dosyayı atla, rapora "ertelendi: başka oturumda kirli" yaz.
- convex/** dosyalarına yazma. Testler: yalnız ownership dosyalarının `*.test.tsx` eşleri (class string'i/metni assert eden test kırılırsa güncelle; davranış testini zayıflatma).
- Görünür Türkçe metinler kısa ve düz olsun ("Bölge bulunamadı", "Projeler yükleniyor…").

Kapılar (kendin koş, çıktıyı rapora yaz):
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` — hata 0.
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>` — error 0.
- `node_modules/.bin/vitest run <alan dizinlerin>` — hepsi yeşil.
Rapor: worker_done ≤10 satır: düzeltilen bulgu #'ları, ertelenen/gerek-yok olanlar (sebep), kapı sonuçları; `--files-modified` ile dosya listesi.
