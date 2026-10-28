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
