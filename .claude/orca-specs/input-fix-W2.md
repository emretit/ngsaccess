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
