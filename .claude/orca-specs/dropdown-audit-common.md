## Ortak kurallar (her worker)
Bağlam: ngsaccess web (React + Tailwind v4 + shadcn/Radix). Kullanıcı input border'larından sonra dropdown'ların da kontrol edilmesini istedi. Input audit'i bitti ve commit'lendi (aa045840; docs/ui-audit-inputs/). Ham `<select>`'ler artık `src/components/ui/native-select.tsx` kullanıyor, onları tekrar raporlama.
Dropdown = Radix Select (SelectTrigger/SelectContent/SelectItem), DropdownMenu, Popover (DatePicker dahil), cmdk Command combobox'ları (CommandInput/CommandList/CommandEmpty), elle yazılmış açılır listeler (absolute div, autocomplete, datalist).
Primitive'ler: src/components/ui/select.tsx, dropdown-menu.tsx, popover.tsx, command.tsx, date-picker.tsx. Overlay z-index'leri: dialog/sheet/alert-dialog/select/popover/dropdown hepsi z-50; 3 yerde `z-[9999]` var.

GÖREV: SALT OKUMA AUDIT. Kod DÜZELTME YOK. Kendi alanındaki her dropdown'ı bul, sorunlu olanları raporla.

Kategoriler (her bulguya birini yaz):
- P Primitive/tutarlılık: popup border, radius, gölge, arka plan, iç boşluk, öğe yüksekliği, hover/seçili/odak stili, ikon (check/chevron) farkları; aynı işi yapan iki farklı popup görünümü.
- Z Katman: Dialog/Sheet içinde açılan popup'ın altta kalma riski (portal yok, z-index eşit ve DOM sırası ters, `modal` ayarı), gereksiz `z-[9999]`.
- W Genişlik/metin: popup genişliği tetikleyiciyle uyumsuz (dar/geniş), uzun seçenek metni kesiliyor ya da taşıyor, `--radix-select-trigger-width` / `--radix-popover-trigger-width` kullanılmamış.
- K Kırpılma/yükseklik: portal kullanmayan popup'ın overflow container içinde kesilmesi, `max-h` + scroll yok → uzun listede ekrandan taşma, mobilde ekran dışına çıkma (collisionPadding yok).
- T Tetikleyici: dropdown tetikleyicisinin input'lardan farklı görünmesi (h-9 dışı yükseklik, border rengi, chevron yok/farklı, placeholder rengi, odak çerçevesi farklı), ikon-only tetikleyicide aria-label eksik.
- E Durum/erişilebilirlik: boş liste mesajı yok (CommandEmpty/SelectContent boş), yükleniyor durumu yok, devre dışı öğe görünmüyor, klavye ile açılmıyor/gezinilmiyor, seçili değer tetikleyicide görünmüyor.

Önem: Y = her kullanıcının gördüğü bozuk görünüm/kullanılamaz durum (ör. dialog içinde dropdown'ın altta kalması, listenin kesilmesi) · O = belirli ekranda tutarsızlık · D = kozmetik.
Primitive kaynaklı ortak sorunları her tüketicide tekrar yazma: "Ortak kök sebepler" bölümünde bir kez yaz, etkilenen dosyaları listele.

YASAK: src/ veya convex/ altında HİÇBİR dosyaya yazma. `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA. npm install/deploy/convex komutu YOK. Worktree açma.
Yazabileceğin TEK dosya: kendi rapor dosyan (aşağıda).

Rapor dosyası formatı (Türkçe):
1. Üstte özet: taranan dosya sayısı, dropdown sayısı, bulgu sayısı (Y/O/D), en çok tekrar eden kök sebep (1-2 cümle).
2. Tablo: | # | Önem | Kat. | file:line | Öğe | Kanıt (class / ata / prop file:line) | Ekran | Öneri (tek satır) |
3. "Ortak kök sebepler": tek düzeltmeyle çok yeri çözen primitive/wrapper ve etkilediği dosyalar.
Tahmin yazma: her bulguda kanıt satırı olsun; tarayıcıda doğrulanması gerekenleri "doğrulanmadı" diye işaretle.

Kapı: rapor dosyası var ve boş değil; `git status --porcelain src convex` çıktısı başladığın andaki ile aynı.
worker_done özeti ≤10 satır: bulgu sayıları + en önemli 3 bulgu file:line + rapor yolu (--report-path ile ver).
