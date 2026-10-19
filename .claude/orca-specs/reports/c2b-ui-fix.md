# C2b UI düzeltme raporu

## Uygulanan düzeltmeler
- `src/components/visitors/hooks/useStableQuery.ts:5`: aynı veri kapsamında son çözümlenmiş sonucu tutan küçük, tipli hook; yalnız `undefined` beklemesini yumuşatır, `null` ve boş sonuçları kabul eder. Ref yerine koşullu aynı-bileşen state güncellemesi kullanır.
- `src/components/visitors/VisitorSlideOverPanel.tsx:44`: dakikalık `refreshKey` değişiminde ayrıntı korunur; `VisitorForm` iskeletle değiştirilmediği için yerel girişler ve dirty/pending durumu korunur. Çözümlenmiş yeni ayrıntı gelir; formun mevcut ID tabanlı reset kuralı korunur.
- `src/components/visitors/VisitorManagement.tsx:66`: liste sayfası aynı hook ile korunur. Cursor değişiminde cache temizlenir; proje/arama/durum/sayfa boyutu değişiminde mevcut `resetKey` bileşeni yeniden bağlar. Satırlar ve sayfalama bilgisi aynı korunmuş sayfadan türetilir.
- `src/components/visitors/VisitorStats.tsx:9`: özet yenilenirken sayaçlar korunur; proje değişimi/skip eski özeti temizler.
- `src/components/settings/SettingsTabs.tsx:17`: Vardiyalar bağlantısı tablist dışındaki açıklama satırına taşındı; tablist yalnız tab tetikleyicileri içerir. Dar ekranda sekmeler sarılır, bağlantı görünür klavye odağı taşır.
- `src/components/shifts/ShiftCalendarView.tsx:101,337`: Kişileri aç eylemi `useNavigate()` kullanır.
- `src/components/shifts/BulkAssignShiftDialog.tsx`: silmeden önce `rg 'BulkAssignShiftDialog' src` yalnız ölü re-export buldu; dosya silindi, son arama eşleşme vermiyor.
- `src/components/access-control/unified/SyncRuns.tsx:135`: Ayrıntı düğmesine TR saat dilimli gönderim tarihi içeren `aria-label` eklendi.

## Doğrulama
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: çıkış 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: çıkış 0.
- `node_modules/.bin/eslint src convex`: çıkış 0, çıktı/hata/uyarı yok.
- `npx vitest run`: 94 dosya / 946 test geçti.
- `npx vite build`: çıkış 0; mevcut büyük chunk uyarısı var (excel-pdf ~1,331 kB).
- `git diff --check`: temiz.
- Yeni `src/components/visitors/hooks/useStableQuery.test.tsx`: gerçek React state ile ardışık server render testleri; ilk yükleme, tekrarlanan pending refresh, yeni yanıt, scope değişimi, skip ve silinmiş kayıt (`null`) kapsanır. Hedefli ziyaretçi testleri 10/10 geçti.

## Koordinatörün ekran kontrolü / sınırlar
- Gerçek oturumla ziyaretçi düzenlemesi açıp alanları değiştirin ve dakika sınırını aşın: form ve girişler korunmalı; liste ve özet iskelete dönmemeli.
- Proje/filtre/sayfa değişiminde eski satır/özet görünmemeli; gerçek silinmiş ayrıntı boş durum göstermeli.
- Ayarlar sekmelerini klavyeyle ve Vardiyalara git bağlantısını ayrı Tab durağı olarak doğrulayın; gönderim ayrıntısının erişilebilir adını kontrol edin.
- 1440/390 için yeni sabit genişlik eklenmedi; mevcut ziyaretçi min-w-0/taşma sınırları korundu, Ayarlar tablist max-w-full + wrap kullanıyor. Tarayıcıda oturumlu görsel kontrol yapılmadı; form unmount davranışı DOM testiyle değil veri sürekliliği regresyonu ve bileşen akışı incelemesiyle doğrulandı.
- Yalnız ownership dosyaları ve bu istenen rapor değiştirildi; ortak hook/API sözleşmeleri, backend ve DB değiştirilmedi. Commit/push/deploy/migration veya `npx convex` çalıştırılmadı.
