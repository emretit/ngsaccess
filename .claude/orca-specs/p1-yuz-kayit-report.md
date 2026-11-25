# P1-3 yüz kayıt sonucu
- Kişi ayrıntısında biyometri yetkisiyle JPEG yükleme/değiştirme, cihazdan capture, silme, yeniden gönderme ve cihaz teslim durumları çalışır.
- Dosyalar: src/components/employees/EmployeeDetails.tsx; src/components/employees/faces/{EmployeeFaceCard.tsx,facePhoto.ts,EmployeeFaceCard.test.tsx}.
- Backend: convex/employeeFaces.ts; convex/employeeFaces.test.ts; convex/actions/hikGatewayDevice.ts; convex/actions/hikvisionSync.ts (yalnız yüz bölümü); convex/actions/hikvisionSync.faces.test.ts.
- Şema değişikliği: 0; yeni Convex modülü: 0; canlı cihaz/DB işlemi: 0; commit: 0.
- Vitest: 4 dosya, 39/39 test; ESLint: 0 hata; find-node-leak: 0; diff-check: 0.
- App tsc koordinatöre devredildi (koordinatör talimatıyla kendi sürecim durduruldu).
- 10 cihaz testi: toplam 2 toplu mutation çağrısı; yalnız aynı kişi+cihaz+yüz+kimlik eski hataları kapanır.
- Açık: gerçek cihaz denemesi Emre/koordinatörde; yalnız faceURL dönen capture JPEG yüklemeye yönlendirir (src/components/employees/faces/facePhoto.ts:5).
- Teslim durumu son cihaz yanıtıdır; cihazdaki güncel roster ayrıca doğrulanmış sayılmaz.
