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
