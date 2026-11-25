# P1-3 yüz kayıt planı

- Mevcut: `EmployeeDetails.tsx:107` yalnız parmak izi kartını gösteriyor.
- `employeeFaces.ts:13` yalnız internal storage sorgusu içeriyor.
- `hikGatewayDevice.ts:298` capture var; `hikvisionSync.ts:192` gönderiyor.
- `schema.ts:1035` tek merkezi yüz kaydı var; cihaz teslim alanı yok.
- `hikvisionSync.ts:245` yalnız başarısız teslimi kaydediyor; başarı kalıcı değil.
- Yetki: parmak izi gibi `biometrics.manage` + kişi proje erişimi + modül.
- Değişecek: EmployeeDetails, yeni faces/** UI ve testleri, employeeFaces ve testleri.
- Gerekirse capture wrapper'a kişi/cihaz kayıt öncesi kapsam doğrulaması.
- JPEG yükle/değiştir, cihazdan capture, sil onayı, yeniden dağıtım ve cihaz durumları.
- Şema değişikliği önerilmiyor; mevcut hikPendingOperations durum kayıtları kullanılır.
- Ownership genişletmesi onaylandı: hikvisionSync.ts yalnız yüz sync/delete bölümü.
- Cihaz teslimleri tek startDelivery + tek finishDelivery mutation ile toplu yazılır.
- hikGatewayDevice capture wrapper'ı kişi/cihaz kapsamını kayıt öncesi doğrular.
- Cihazdan yalnız URL dönerse yükleme önerilir; cihaz URL'si tarayıcıdan açılmaz.
- Test: yetki/modül/proje/aktif kişi, JPEG boyut/tür, replace/storage cleanup,
  silme kuyruğu, hedef cihazlar, mock capture, UI yetki/boş/yükleme/hata durumları.
- Kapılar: app tsc, değişen dosyalara eslint, ilgili vitest, find-node-leak.
