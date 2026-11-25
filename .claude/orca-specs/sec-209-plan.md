# SEC-209 dar uygulama planı
1. Ham storageId, yükleyenin kimliğini kanıtlamaz; mevcut claim ilk çağıranı sahip yapıyor.
2. Koordinatörün seçimi: şema değişmeden bytes alan authenticated upload action.
3. Action ≤5 MiB ve JPEG/PNG/WebP/PDF magic byte + MIME eşleşmesini doğrular.
4. storage.store sonrası tek internal mutation pendingUploads sahipliğini yazar.
5. Kayıt başarısızsa action yeni blob'u siler; storageId yalnız başarıda döner.
6. generateUploadUrl kaldırılır; claimUpload yalnız önceden doğrulanmış sahibin kaydını kabul eder.
7. İki foto istemcisi action'a file.arrayBuffer gönderir; talep eki akışı değişmez.
8. Gerçek convex-test: yabancı/raw blob claim reddi, foto ve rıza yükleme tüketimi.
9. captureFaceFromDevice izni zaten employeeId dışında; regresyon testi eklenir.
10. reports employeesByCard boş kartı cardKey ile ayıklar; hedefli test eklenir.
11. Yalnız ilgili vitest, değişen dosya eslint ve find-node-leak çalıştırılır.
