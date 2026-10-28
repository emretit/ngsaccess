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
