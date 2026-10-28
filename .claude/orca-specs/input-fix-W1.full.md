# Input fix — W1 (Geçiş Kontrol + Ziyaretçiler tüketicileri)
Kaynak rapor: docs/ui-audit-inputs/W1-ortak-gecis-ziyaretci.md
Ownership: src/components/access-control/** ve src/components/visitors/** (DOKUNMA listesi hariç) + bunların test dosyaları.
Bulgular:
- #16 DoorVerifyPlanSection.tsx:38 + door-dialog/DoorVerifyPlanEditor.tsx:33/:43/:53/:110 — hatayı ilgili kontrollere aria-invalid ile bağla; :53/:110 ham select → NativeSelect (#22).
- #17 + #21 DoorStatusPlanEditor.tsx:33/:43/:53/:102 — ham select'ler → NativeSelect; editöre opsiyonel `invalid` prop'u ekleyip kontrollere aria-invalid ver (DoorPlanDialog.tsx'ten geçirme kısmı ERTELENDİ, o dosyaya dokunma).
- #19 + #25 unified/templates/TemplatePicker.tsx:33 — ham select → NativeSelect; opsiyonel `aria-invalid`/`aria-describedby` prop'larını select'e geçir (TimeSchedule.tsx'ten geçirme ERTELENDİ).
- #20 CardReadingsFilters.tsx:30-31 (+ CardReadings.tsx:53) — badDate'i iki tarih tetikleyicisine aria-invalid olarak ver.
- #23 door-plans/CopyDoorPlansDialog.tsx:119/:132/:150 — ham select'ler → NativeSelect.
Ertelenen (yapma): #17 DoorPlanDialog kısmı, #18 TemplateEditor, #19 TimeSchedule kısmı, #24 DoorPlanDialog.
## Ortak kurallar (her worker)
Bağlam: ngsaccess web (React + Tailwind v4 + shadcn). Input border audit'i: docs/ui-audit-inputs/ (00_OZET.md + W1/W2/W3 raporları). Bulgu numaraları o raporlardaki tablolara aittir.
Koordinatör ŞUNLARI ZATEN YAPTI (dokunma, kullan):
- src/components/ui/native-select.tsx YENİ: `NativeSelect` (forwardRef <select>) + `nativeSelectClass`. Görünüm SelectTrigger ile aynı (h-9, border-input, bg-surface, focus-visible:ring-2 offset-0, aria-invalid → kırmızı border).
- ui/input, textarea, select(Trigger), button(outline), date-picker tetikleyicisi artık `aria-invalid="true"` olunca kırmızı border alır. Yani hata görünümü için tüketicinin YAPACAĞI TEK ŞEY kontrole doğru `aria-invalid` vermek; ekstra border-destructive sınıfı EKLEME.
- FormFieldWrapper (shared) zaten çocuk kontrole aria-invalid geçirir; FormControl (ui/form) da öyle. Bunlarla sarılı alanlar çözülmüş sayılır.

Yapılacak iş türleri:
1. Ham `<select className="...">` → `<NativeSelect>` (import { NativeSelect } from "@/components/ui/native-select"). Davranış birebir aynı kalsın: value/onChange/disabled/id/name/aria-*/data-testid/option'lar. Görünümü tanımlayan eski sınıfları (h-*, border, bg-*, rounded, px/p, text-sm, focus/outline) SİL; yalnız yerleşim sınıflarını (w-24, min-w-0, flex-1, max-sm:min-h-11 vb.) className olarak bırak. Kullanılmaz hale gelen yerel `selectStyle`/`selectClass` sabitlerini kaldır (başka yerden import ediliyorsa importları da güncelle).
2. Ham `<textarea>`/`<input>` (görünür, border'lı) → `Textarea`/`Input` primitive.
3. Hata metni gösterilen ama kontrolüne `aria-invalid` gitmeyen alanlarda kontrole `aria-invalid={Boolean(hata)}` (ve mümkünse `aria-describedby` hata id'si) ver.
Raporun "Öneri" sütunu yön verir; rapor yanlışsa (kod zaten doğruysa) değiştirme, rapora "gerek yok" diye yaz.

YASAKLAR:
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA. npm install / deploy / convex komutu YOK. Worktree açma.
- src/components/ui/** ve src/components/shared/** dosyalarına YAZMA (koordinatörün).
- Başka oturumun açık işi olan dosyalara YAZMA: aşağıdaki "DOKUNMA" listesi + işe başlamadan önce `git status --porcelain <dosya>` boş olmayan herhangi bir dosya (senin bu turda değiştirdiklerin hariç). Böyle bir dosyaya iş düşerse atla, rapora "ertelendi: başka oturumda kirli" yaz.
- Ownership listesi dışındaki dosyaya yazma. Testler: yalnız kendi ownership dosyalarının `*.test.tsx` eşleri (class string'i assert eden test kırılırsa güncelle; davranış testini zayıflatma).
DOKUNMA (başka oturum aktif): src/components/access-control/door-plans/DoorPlanDialog.tsx, src/components/access-control/unified/components/TimeSchedule.tsx, src/components/access-control/unified/templates/TemplateEditor.tsx, src/components/access-control/unified/CreateRuleDialog.tsx, src/components/departments/** , src/hooks/useDepartments.ts, convex/**

Kapılar (kendin koş, çıktıyı rapora yaz):
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` — senin dosyalarında hata 0 (src/hooks/useDepartments.ts hatası başka oturumun, yok say).
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>` — error 0.
- `node_modules/.bin/vitest run <alan dizinlerin>` — hepsi yeşil.
Rapor: worker_done ≤10 satır: düzeltilen bulgu #'ları, ertelenen/gerek-yok olanlar (sebep), kapı sonuçları; `--files-modified` ile dosya listesi.
