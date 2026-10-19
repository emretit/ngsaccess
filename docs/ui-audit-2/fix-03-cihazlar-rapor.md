03-O1 → çevrimdışı kuyruk uyarısı + Aç ipucu; komut davranışı aynı: DeviceCommandCenter.tsx:387,464.
03-O2/O3/O4 → warning rozet, göreli son görülme/Türkiye title, marka/model, mobil bölge/seri: DeviceTableRow.tsx:53,55,78.
03-O5 → model seçilmeden sayı yok; özet altında footer payı: topologyPreview.ts:4, DeviceForm.tsx:182.
03-O6 → onOpenChange/guard zincirinde hata bulunmadı; temiz/kirli/bekleyen işlem testleri: DeviceDetailsPanel.test.tsx:62; gerçek fiziksel klavye doğrulaması bu çalışmada yapılamadı (DOM test ortamı yok).
03-O7 kullanımı kontrol edildi: DevicesContent.tsx:76; O8 → ortak TR tarihleri: DeviceCommandCenter.tsx:73, DeviceApiTokenCard.tsx:89, LocationDoorItem.tsx:39.
03-O9/D9/D10 → tam mevcut anahtar maskesi, sade açıklama/teknik ayrıntı, catch + notify.error: DeviceApiTokenCard.tsx:20,43,68; backend sırları korunmuştur.
03-D1/D2/D3 → sabit seçim şeridi/mixed çizgi, erişilebilir QR başlık/açıklama, sade filtreler/tek temizleme/boş sayfalama: DeviceList.tsx:93,108,164; QRCodeDialog.tsx:31,36,39; DeviceFilters.tsx:28,34.
03-D4/D5/D6 → cümle düzeni etiketler, tek yönlendirme, okuyucu adı + görünür durum; mevcut mobil menü görünürlüğü korundu: form-sections/DeviceBasicSection.tsx:70; DeviceHikvisionSection.tsx:92; LocationDoorItem.tsx:132,141.
03-D7/D8/D11 → kanal etiketleri/boş plan yok/açıklamalı Oku, mobil 44px düğmeler ve tıklanan seçim hücresi, ayarlar/projeler ertelendi + konumlu sayaç: DeviceCommandCenter.tsx:453,483,492; DeviceTableRow.tsx:65,84; DeviceAddMenu.tsx:29; DeviceDetailsPanel.tsx:23,60; DevicesContent.tsx:66.
Kapılar: tsc 0 hata; eslint 0 error/0 warning; vitest 13 dosya, 58 test geçti; git diff --check temiz (ilk geçici CardReadings.tsx dış hatası son çalıştırmada kalmadı).
