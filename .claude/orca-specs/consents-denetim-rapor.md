# KVKK rızaları kartı — salt-okuma denetimi (2026-10-22)

Kapılar (kendi koşum): tsc app 0 · tsc convex 0 · eslint src convex 0 hata · vitest (employeeConsents + src/components/employees) 21 dosya / 112 test yeşil.
Sonuç: P1 yok, P2 = 3, P3 = 6. Spec maddeleri (1-7) uygulanmış; aşağıdakiler boşluk/riskler.

## P1
Yok.

## P2

### P2-1 Tüketilmiş rıza belgesi başkası tarafından yeniden "claim" edilip 24 saat sonra cron ile SİLİNEBİLİR (rıza ispatı kaybı)
- convex/files.ts:22-35 `claimUpload` + files.ts:72-92 `cleanupPendingUploads`; convex/employeeConsents.ts:56-66 (grant pending'i siler).
- Senaryo: grant sonrası pending satırı silinir. `claimUpload` yalnızca `employees.by_photo_storage` bağlantısına bakar, `employeeConsents.documentStorageId` bağlantısına BAKMAZ. `getDocumentUrl` URL'si storageId içerir. Aynı projedeki başka bir yönetici (ya da URL'yi gören herkes) `claimUpload({storageId})` çağırır → kendi adına yeni pending satırı oluşur; 24 saat sonra cron, dosya employee/user fotoğrafı değilse `storage.delete` yapar → imzalı rıza formu yok olur, consent'te ölü `documentStorageId` kalır. Aynı pending ile aynı belge başka bir kişinin rızasına da bağlanabilir (grant'ta "belge zaten bir rızaya bağlı" kontrolü yok).
- Öneri: schema'ya `employeeConsents.by_document_storage` indeksi ekle; `claimUpload` ve `cleanupPendingUploads` consent bağlantısını da kontrol etsin; `grant` aynı storageId'nin başka rızaya bağlı olmadığını doğrulasın.

### P2-2 Aktif rıza varken belgeli grant sessizce başarılı döner, belge kaydedilmez
- convex/employeeConsents.ts:48-54 (`if (existing) return existing._id;` belge doğrulamasından ÖNCE).
- Senaryo: iki sekme / yarış / eski liste: yönetici belge yükler, "Rızayı kaydet" der → "Rıza alındı" bildirimi çıkar ama mevcut kayıt döner; yeni belge pending'de kalır, 24 saatte silinir. Kullanıcı belgenin arşivlendiğini sanır (KVKK ispat kaybı).
- Öneri: `existing` varken `documentStorageId` verilmişse ya hata at ("Zaten aktif rıza var") ya da belgeyi mevcut kayda (belge yoksa) bağla.

### P2-3 Belge türü istemci beyanına dayanıyor (içerik doğrulanmıyor)
- convex/employeeConsents.ts:59-62: `metadata.contentType` upload isteğindeki `Content-Type` başlığıdır; yükleyen `application/pdf` diyerek HTML/SVG/exe yükleyebilir. `getDocumentUrl` dosyayı beyan edilen türle servis eder (HTML için stored XSS yüzeyi sınırlı: storage origin ayrı, ama yine de).
- Öneri: `ctx.storage.get` ile ilk baytları (`%PDF-`, `FFD8FF`, `89504E47`) sihirli bayt kontrolü; ya da en azından kabul listesini koru + indirmeyi `Content-Disposition` ile zorla. (Bilinçli kabul edilirse P3'e düşer.)

## P3

1. Revoke sonrası purge başarısızsa kullanıcıya görünmez: `revoke` tekrar çağrılınca (convex/employeeConsents.ts:97) erken döner, yeniden purge planlanmaz; satır `deletionEmployeeNo` ile kalır, `beginEnrollment` "Önce cihazdaki eski kaydı silin" der. Elle `removeFingerprintFromDevice` yolu var ama kartta bildirim/ipucu yok. Öneri: kartta "silme bekliyor" göstergesi veya iptal edilmiş + bekleyen satır varken yeniden purge tetikleme.
2. `purgeCount` (employeeConsents.ts:100-103) tüm satırları sayar (bekleyen `enrolledAt: ""` denemeleri ve zaten `cancelRequested` olanlar dahil); audit notundaki sayı şişebilir. Ayrıca satırlar iki kez sorgulanıyor (burada + `scheduleFingerprintPurge`). Öneri: `scheduleFingerprintPurge` sayı döndürsün.
3. Spec 7: iptal etki metninde "N kayıt" yok (EmployeeConsentsCard.tsx:271); `fingerprintEnrollment.listForEmployee` kullanılmamış. Yalnız genel cümle var.
4. Revoke edilmiş rızanın belgesi arayüzde açılamıyor (EmployeeConsentsCard.tsx:168 yalnız `active`). İptal sonrası ispat/denetim için belge erişilemez (backend `getDocumentUrl` revoked için de çalışır). Öneri: geçmiş listesi veya audit sayfasında bağlantı.
5. "Belgeyi aç": `window.open` async `convex.query` sonrası çağrılıyor (EmployeeConsentsCard.tsx:170-172); iOS Safari/popup engelleyici engelleyebilir. Öneri: boş sekmeyi önce aç, sonra `location` ata. Belge açılışı audit'e yazılmıyor (hassas belge; `writeAudit` önerilir).
6. Belge hatası (`document.error`) Kaydet'i kilitliyor (EmployeeConsentsCard.tsx:263) ama belge zorunlu değil; kullanıcı "Belgeyi kaldır"a basmak zorunda — hata mesajı bunu söylemiyor. Ayrıca `role="alert"` metni kırmızı/vurgusuz (destructive sınıfı yok — spec ile uyumlu, yalnız not).

## Odak maddeleri — özet

1. Güvenlik: `assertUploadOwner(pending?.userId)` pending yoksa reddediyor (iyi); tür/boyut `ctx.db.system.get` ile sunucuda (iyi, 10 MB dahil testli); pending yalnız doğrulama geçince siliniyor (iyi). `getDocumentUrl` = `adminQuery` + `requireEmployeeAccess` → project_user ve başka proje reddedilir (testli). Açıklar: P2-1/2/3.
2. Parmak izi: `scheduleFingerprintPurge(ctx, employeeId, employee.cardNumber)` doğru; yüzde çağrılmıyor; tekrar iptal erken dönüyor; yeniden rıza + kayıt yarışı `beginEnrollment`'taki `deletionEmployeeNo` kilidi ve purge'deki `deletionEmployeeNo !== snapshot.employeeNo` koruması ile kapalı. Kalan: P3-1, P3-2.
3. Kart: grant validator'dan `card` çıktı (testli), eski aktif kart rızası iptal edilebilir (testli), `listForEmployee`/UI satırı yalnız aktif kartta görünür. `grant` içindeki `CONSENT_TYPES` dizisi `card` içeriyor (yalnız okuma tarafı, sorun değil).
4. UI: modül kapalı → nötr "Kapalı" + "Biyometri modülü kapalı." + yalnız yöneticiye bağlantı, "Rıza al" yok; destructive rozet yok; yükleme sürerken Kaydet kapalı; role=status/alert var; project_user'da buton/belge bağlantısı yok. Küçük eksikler: P3-3/4/5/6.
5. Convex guidelines: `getDocumentUrl` `returns` validator'lı ve index'li; `by_storage`/`by_employee` indeksleri kullanılıyor. `grant`/`revoke`/`listForEmployee` `returns` validator'sız (guidelines gerektiriyorsa eklenmeli; pre-existing). `.filter` (revokedAt undefined) `by_employee_type` üstünde — pre-existing, küçük sonuç kümesi. Cascade (employeeCascade.ts:45-56) belgeyi silmiyor, yalnız revoke ediyor (spec uyumlu; değişmemiş).
