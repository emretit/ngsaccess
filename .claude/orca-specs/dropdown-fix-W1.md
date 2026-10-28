# Dropdown fix — W1 (Cihazlar + Canlı izleme + Ziyaretçiler tüketicileri)
Hedef: aşağıdaki bulgular kapanır; tsc 0, eslint 0 error, ilgili vitest yeşil.
Kaynak rapor: docs/ui-audit-dropdowns/W1-primitive-gecis-cihaz.md
Ownership (yalnız bunlar + *.test.tsx eşleri):
- src/components/live-monitoring/MonitoringPersonPicker.tsx
- src/components/devices/AssignLocationForm.tsx
- src/components/devices/ClaimDeviceDialog.tsx
- src/components/devices/form-sections/DeviceZoneSection.tsx
- src/components/devices/form-sections/DeviceLocationSection.tsx
- src/components/visitors/VisitorCombobox.tsx
Bulgular:
- #6 + #7 MonitoringPersonPicker: Button tetikleyici → `ComboboxTrigger` (placeholder={!selected}; buttonRef'i ref'e geçir; aria-label="Kişi" kalsın); PopoverContent → `COMBOBOX_CONTENT_CLASS`.
- #8 MonitoringPersonPicker: allowClear satırı yüzünden CommandEmpty hiç görünmüyor. Durumu gerçek kişi sayısına göre göster: arama sürerken (people === undefined || term !== search) ve sonuç 0 iken CommandEmpty dışında `<p role="status" className="py-6 text-center text-sm">` ile "Aranıyor…" / "Kişi bulunamadı" (EmployeePicker'daki kalıp). İki mesaj aynı anda çıkmasın.
- #13 MonitoringPersonPicker + VisitorCombobox: seçili CommandItem'a ortak Check + sr-only "Seçili" göstergesi (allowClear "Tüm kişiler"/"Seçilmedi" satırı da seçim boşken seçili sayılır).
- VisitorCombobox tetikleyici: Button + ChevronsUpDown → `ComboboxTrigger wrap placeholder={!seçili}` (id, aria-label, aria-invalid, aria-describedby, disabled korunur; eski aria-[invalid=true]:border-destructive sınıfını sil, primitive yapıyor). PopoverContent genişliği zaten trigger-width; `COMBOBOX_CONTENT_CLASS`'a geçir.
- #9 AssignLocationForm: bölge listesi boşsa ve kapı listesi (filteredDoors) boşsa ortak "__empty" disabled öğesi ("Bölge bulunamadı" / "Bu bölgede kapı yok"); kapı listesi boşken mevcut disabled koşuluna `filteredDoors.length === 0` ekleme — onun yerine boş öğe yeter, seçici açılabilir kalsın.
- #10 ClaimDeviceDialog: proje Select'inde projects === undefined → "__loading" "Projeler yükleniyor…", [] → "__empty" "Proje bulunamadı".
- #11 DeviceZoneSection + DeviceLocationSection: gerçek bölge sayısı 0 iken (allowCreate seçeneği olsa da) "__empty" "Bölge bulunamadı" disabled öğesi; iki wrapper aynı sözleşmeyi kullansın.
Kapsam dışı: RulesFilters (#12, koordinatör yaptı), primitive bulguları #1-#5.
Vitest alanı: `node_modules/.bin/vitest run src/components/live-monitoring src/components/devices src/components/visitors`
