# Dalga 3a denetimi — B: kabuk/ortak bileşenler/auth + Cihaz ağacı
Önce `.claude/orca-specs/review-d3a-common.md` oku ve uygula.
## Kapsam
`git diff -- src/App.tsx src/App.css src/index.css src/styles src/components/Layout.tsx src/components/ErrorBoundary.tsx src/components/layout src/components/auth src/contexts src/lib src/pages src/components/shared src/components/ui src/components/dashboard src/components/landing src/components/demo src/components/devices src/hooks/useDeviceFilters.tsx src/components/access-control/ZoneDoorTree*.tsx src/components/access-control/{EditReaderDialog,MoveReaderDialog,ZonesAndDoors}.tsx`
+ yeni dosyalar (git status ??): shared/{PasswordField,QuerySectionBoundary,UnsavedChangesDialog,authFormSchemas,unsavedChanges}*, lib/routeMeta.ts, styles/contrast*, landing/marketingFacts.ts, devices/DeviceListErrorBoundary.tsx, lib/deviceDisplay*, access-control/readerMove*.
(src/pages/AuditLog.tsx ve AccessControl.tsx diğer denetçide.)
## Özellikle bak
1. Güvenlik: `?next=` dönüş hedefi yalnız iç yol mu (`//evil.com`, `/\evil`, `javascript:` reddi); protected-route guard tek mi; oturum yokken korumalı içerik bir an görünüyor mu.
2. ActiveProjectContext soğuk açılış: saklı proje seçimi boş `projectIds` ile silinmiyor mu; proje değişiminde sayfa durumları sıfırlanıyor mu.
3. Ortak bileşenler: UnsavedChangesDialog/guard (dirty form kapanışı, çift onay, Esc), QuerySectionBoundary (yalnız bölümü kapatıyor mu, retry gerçekten yeniden deniyor mu), FormFieldWrapper ARIA'yı control'e iletiyor mu, PasswordField erişilebilirliği.
4. Tema/kontrast: index.css token değişiklikleri açık+koyu temada ≥4,5:1 mi (contrast testi gerçekten kullanılan token'ları mı ölçüyor).
5. Cihaz ağacı: Devices.tsx URL state (zoneId/doorId) geri/ileri davranışı, proje değişiminde filtre temizliği, readerMove saf mantığı (zone-only taşıma, kapasite), DeviceListErrorBoundary.
6. Landing/demo: marketingFacts — doğrulanmamış rakam iddiası kaldı mı; reduced-motion.
