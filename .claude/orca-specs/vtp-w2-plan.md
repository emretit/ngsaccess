# W2 kapı açma ve e-posta planı
1. Mobil taşıma kuyruğunu ortak doorOpenDispatch yardımcısına çıkar; çalışan akışını koru.
2. QR/PIN granted sonucunda bağlı kapıyı aynı mutasyonda kuyruğa al; offline hatasını sayaç geri almadan döndür.
3. Kuyruk tesliminde ziyaretçi pass/süre/kapı kapsamını yeniden doğrula; çalışan session daraltmasını düzelt.
4. Yetkili e-posta hazırlığını ayrı V8 internal query/mutation ile doğrula; Node action QR PNG eki ve PIN göndersin.
5. Mailer attachment desteği ve QR paketi için koordinatörden ownership/bağımlılık onayı al.
6. Hedefli mobil/kiosk/mail testleri, değişen dosyalarda eslint ve find-node-leak kontrolü çalıştır.
7. Scan granted ek alanları: doorOpen?: pending|confirmed|failed; doorOpenOperationId?; doorOpenMessage?.
8. Asenkron kiosk sonucu: api.mobileAccess.visitorDoorOpenStatus({readerToken,operationId}) query → null veya {doorOpen,doorOpenMessage?}; W3 pending sonucu bu query ile izler.
9. Mevcut localBridge güvenlik kapısı korunur; IDE izolasyon env kapısı korunur; gerçek cihaz komutu/test deploy çalıştırılmaz.
