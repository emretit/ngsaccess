# Input border audit — W1 (ortak bileşenler + Geçiş Kontrol + Ziyaretçiler)
Alan (yalnız bunları tara): src/components/ui/, src/components/shared/, src/components/layout/, src/components/access-control/, src/components/visitors/
Ek görev: (1) Kategori B — ui/ primitive'lerini karşılaştır (input, textarea, select, command, date-picker, popover tetikleyici). (2) shared/ altındaki her overflow'lu wrapper'ı (FormDialog, drawer/sheet gövdeleri, FilterBar vb.) listele ve onları kullanan TÜM dosyaları (repo genelinde grep) "Ortak kök sebepler"e yaz — diğer worker'lar bu wrapper'ları tekrar analiz etmeyecek.
Rapor dosyası: docs/ui-audit-inputs/W1-ortak-gecis-ziyaretci.md
