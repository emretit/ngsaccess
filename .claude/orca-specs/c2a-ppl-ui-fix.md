# C2a W-ppl-ui takip — Kişiler ekran kıyası düzeltmeleri (aynı ownership: c2a-ppl-ui.md)
Koordinatör gerçek oturumla 1440/390 baktı (yatay taşma yok, konsol hatası yok; peopleActivity henüz deploy edilmediği için ayrıntıdaki
hata durumu beklenen). Düzelt:
1. `EmployeeFormFields.tsx:130` yerel `<input type="checkbox">` (mavi tarayıcı kutusu) → `@/components/ui/checkbox` (tablodaki ile aynı A2
   görünüm); label bağlantısı ve react-hook-form `name` korunur.
2. Tablo başlığındaki tümünü seç kutusu kısmi seçimde (1/7) tam işaretli görünüyor → `checked="indeterminate"` (Radix) kısmi seçimde.
3. BulkBar metinleri cümle düzeni: "Departmanı güncelle", "Cihazlara gönder", "Seçilenleri sil". Ayrıntıdaki "Tekrar Dene" → "Yeniden dene".
4. Mobil satır alt metni: bordro kodu yoksa "Bordro kodu yok" yazma — yalnız departman (her satırda tekrar eden gürültü). Ayrıntı başlığında
   "Bordro kodu yok" kalabilir.
5. Ayrıntıda senkron ve son geçiş bölümleri tek hata sınırını paylaşıyor; birinin hatası diğerini gizlemesin → her bölüm kendi
   QuerySectionBoundary/hata durumuyla ("Cihaz senkron durumu yüklenemedi." / "Son geçişler yüklenemedi.").
Kapılar: app tsc (kendi dosyaların 0; PDKS dosyaları başka worker'da), eslint src convex, npx vitest run, npx vite build.
commit/push/deploy YOK. worker_done ≤6 satır.
