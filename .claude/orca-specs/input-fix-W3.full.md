# Input fix — W3 (Kişiler + Vardiya + PDKS + İzin + sayfalar tüketicileri)
Kaynak rapor: docs/ui-audit-inputs/W3-kisi-vardiya-pdks.md
Ownership: src/components/employees/**, src/components/shifts/**, src/components/pdks/** , src/components/leaves/**, src/components/reports/**, src/components/audit/**, src/pages/** (Settings.tsx HARİÇ — koordinatör düzeltti) + test eşleri. departments/** DOKUNMA.
Bulgular:
- Ham select → NativeSelect: #4 employees/EmployeeFormFields.tsx:141, #5 employees/EmployeeFingerprintCard.tsx:77, #6 employees/import/BatchCardAssignDialog.tsx:90, #8 leaves/LeaveForm.tsx:302 + #9 leaves/LeaveFilters.tsx:55 (selectClass leaves/EmployeePicker.tsx:11-12), #10 shifts/definitions/AddShiftDialog.tsx:400/:405/:482, #11 pdks/dashboard/export/PDKSExportColumns.tsx:40, #12 src/pages/Alarms.tsx:69 (select) + :70 ham input → Input.
- #14 BatchCardAssignDialog.tsx:98 — satır hatasında kart Input'una aria-invalid.
- #18 AddShiftDialog.tsx:400/:405 — aynı hataya bağlı select'lere de aria-invalid.
- #20 LeaveForm.tsx:290 / EmployeePicker.tsx:25 — kişi combobox (Button outline) hatada aria-invalid alsın.
- #21 LeaveFilters.tsx:96-121 — başlangıç tarihi hatası başlangıç alanına; aralık hatasında iki alan da aria-invalid.
- #26 audit/AuditFilters.tsx:46 — özel tarih tetikleyicisi Button variant="outline" değilse outline yap ya da aria-invalid'in kırmızı border verdiğini doğrula.
- #28 employees/EmployeeConsentsCard.tsx:242 — dosya Input'una belge hatasında aria-invalid.
- #13/#15/#16/#17/#19/#22-#25/#27 primitive/FormFieldWrapper ile çözüldü sayılır; yalnız kontrolde aria-invalid gerçekten gitmiyorsa düzelt.
Ertelenen (yapma): #7 MoveDepartmentDialog (departments/** başka oturumda).
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
