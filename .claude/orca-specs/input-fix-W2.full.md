# Input fix — W2 (Cihazlar + Ayarlar + Admin + Sync tüketicileri)
Kaynak rapor: docs/ui-audit-inputs/W2-cihaz-ayar-admin.md
Ownership: src/components/devices/**, src/components/settings/**, src/components/admin/**, src/components/sync/**, src/components/live-monitoring/** (ReadingDetailPanel.tsx HARİÇ — koordinatör düzeltti), src/components/profile/** + test eşleri.
Bulgular:
- Ham select → NativeSelect: #5 settings/SettingsSidebar.tsx:25, #6 settings/sections/general/CompanyInfoForm.tsx:20, #7 settings/sections/MailSettings.tsx:96 (selectStyle :22), #8 settings/sections/ReportsSettings.tsx:141/:146/:152/:157 (selectStyle :39), #9 settings/sections/reports/ReportReminderSettings.tsx:49/:65 (selectStyle :22), #10 settings/sections/privacy/RetentionAssistantCard.tsx:54, #11 admin/components/UserFormDialog.tsx:153/:264, #12 admin/projects/ProjectEditor.tsx:117, #13 admin/components/AdminListParts.tsx:22 (AdminSelect; outline-primary yerine NativeSelect görünümü), #14 admin/ProjectMembersContent.tsx:22, #16 sync/SyncIssuesBanner.tsx:165.
- #15 sync/SyncIssuesBanner.tsx:102 ham textarea → Textarea.
- #17 devices/ClaimDeviceDialog.tsx:351 — `...control`'den gelen aria-invalid'i ezme; iki doğrulamayı OR'la.
- #18 devices/form-sections/DeviceLocationSection.tsx:185 — yeni bölge adı hatasını input'a aria-invalid (+ görünür hata metni varsa describedby) ile bağla; yalnız toast varsa alan state'i ekle.
- #34 settings/sections/components/OvertimeSettingsForm.tsx:98/:109/:123 — SelectTrigger'a FormFieldWrapper render-slot control prop'larını (id, aria-invalid, aria-describedby) ilet.
- #35 settings/sections/components/pdksRulesPunchFields.tsx:24/:59 (+ PdksRulesSettings.tsx:187-192) — şema alan hatalarını ilgili DateInput/Input'a aria-invalid ile bağla.
- #19-#33 primitive/FormFieldWrapper ile çözüldü sayılır; yalnız kontrolde aria-invalid gerçekten gitmiyorsa düzelt (kontrol et, rapora yaz).
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
