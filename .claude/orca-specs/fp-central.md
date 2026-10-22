# FP-Central — parmak izi şablonunu şifreli sakla + tüm Hik cihazlarına yay (2026-10-22)

## Hedef (test edilebilir)
Bir Hik gateway cihazında okutulan parmak izi şablonu AES-256-GCM ile şifrelenip `employeeFingerprints`'e yazılır ve kişinin
erişim kapsamındaki DİĞER tüm Hik gateway cihazlarına otomatik gönderilir; kişi sonradan yeni bir cihaza senkronlanınca kayıtlı
şablonlar oraya da gider; rıza iptali / pasif / işten çıkış / kişi silme / biyometri imhasında şablon hem sistemden hem
cihazlardan silinir; kart değişiminde merkezi şablon KORUNUR ve yeni employeeNo ile yeniden gönderilir.

## Bağlam (okunacak)
- Mevcut akış (eb677f9): `convex/actions/hikFingerprint.ts` (enrollFingerprintOnDevice: cihazda yakala → aynı cihaza indir;
  şablon yalnız bellekte), `convex/fingerprintEnrollment.ts` (metadata tablosu `deviceFingerprintEnrollments`, `employeeDevices`
  kapsam mantığı, `enrollmentTarget` kontrolleri: aktif kişi, kart no, kapsam, capability, biyometri modülü, rıza),
  `convex/lib/employeeCardChange.ts` (`scheduleFingerprintPurge`), `src/components/employees/EmployeeFingerprintCard.tsx`.
- Eski şablon-tablosu modeli (ŞİFRESİZ, prod'da 0 satır — doğrulandı): `convex/schema.ts:892` `employeeFingerprints.fingerData`,
  `convex/employeeFingerprints.ts`, `convex/actions/hikvisionSync.ts:865` `syncEmployeeFingerprintToDevicesInternal` / `:941`
  `deleteEmployeeFingerprintFromDevicesInternal`, `convex/hikvisionSync.ts:~805` (retry/pending replay `fingerData` okuyor),
  `convex/devices.ts:1219` + `convex/lib/deviceSync.ts:40` (reconcile parmak izi roster bacağı), `convex/lib/employeeCascade.ts:36`,
  `convex/biometricDestruction.ts:58,152` (modül imhası).
- Gateway yardımcıları: `convex/lib/gateway/biometrics.ts` (`addFingerprintToDevice`, `deleteFingerprintFromDevice`, `captureFingerprintLive`).
- `convex/_generated/ai/guidelines.md` (Convex kuralları) ve proje `CLAUDE.md` (any yasak, camelCase, `filter(Boolean)` değil type guard).

## Değişiklik
1. **Şifreleme** — YENİ `convex/lib/fingerprintCrypto.ts` (runtime bağımsız `globalThis.crypto.subtle`, "use node" gerektirmesin):
   `encryptTemplate(plain, aad) → { encData, iv, keyVersion: "v1" }` ve `decryptTemplate({encData, iv, keyVersion}, aad) → string`.
   Anahtar env `FINGERPRINT_TEMPLATE_KEY` = base64, tam 32 bayt; yoksa/uzunluk yanlışsa `ConvexError("Parmak izi saklama anahtarı
   tanımlı değil")` — fail closed. IV 12 bayt rastgele. AAD = `${employeeId}:${fingerNo}`. Şifre/çözme YALNIZ action içinde.
   Anahtar, düz şablon, encData hiçbir log/hata mesajı/audit'e yazılmaz.
2. **Şema** `employeeFingerprints`: `fingerData` alanını KALDIR; ekle `encData: v.string()`, `iv: v.string()`, `keyVersion: v.string()`,
   `sourceDeviceId: v.optional(v.id("devices"))`, `enrolledBy: v.optional(v.id("users"))`. Mevcut alanlar/index'ler kalır. Düz şablon
   hiçbir tabloya yazılmaz. Başka tabloya dokunma.
3. **Kayıt** (`enrollFingerprintOnDevice`): yakalamadan ÖNCE anahtar kontrolü. Kaynak cihaza indirme + `upsert` başarılıysa →
   şifrele → internal mutation ile `employeeFingerprints` upsert (employeeId+fingerPrintID tek satır, varsa üzerine yaz) →
   `capture.fingerData = undefined` → `ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices,
   { employeeId, fingerNo, excludeDeviceId })`. Merkezi yazım başarısızsa kaynak cihazdaki kayıt kalır ama kullanıcıya Türkçe
   uyarı döner ("Cihazda kaydedildi, sisteme kaydedilemedi").
4. **Yayma** — YENİ `pushFingerprintToDevices({ employeeId, fingerNo?, deviceIds?, excludeDeviceId? })` internalAction:
   hedef = `employeeDevices` kapsamı (gateway Hik, aktif, aynı proje) ∩ capability `false` olmayan ∩ (deviceIds verilmişse o liste)
   − excludeDeviceId. Her hedefte `enrollmentTarget` kontrollerini TEKRAR koş (modül, rıza, aktiflik, kart); geçmezse sessiz atla.
   Cihazda bekleyen kayıt (`pendingUntil` > now) varsa atla. Çöz → `addFingerprintToDevice(devIndex, { employeeNo: cardNumber.trim(),
   fingerPrintID, fingerData })` → başarıda `deviceFingerprintEnrollments` satırı upsert (enrolledAt=now, enrolledBy=merkezi
   satırın enrolledBy'ı). Her cihaz için `deviceEvents.recordOperationInternal` "Parmak izi gönderimi: komut iletildi/başarısız".
   Gateway yanıt gövdesi/exception asla dışarı veya log'a çıkmaz (şablon içerebilir). Cihaz başı hata diğerlerini durdurmaz.
   Public `adminAction`/`authedAction` sarmalayıcı `resendFingerprint({ employeeId, fingerNo })` (isManager + proje erişimi) UI için.
5. **Yeni cihaz kancası** (`convex/actions/hikvisionSync.ts` `syncEmployeeDevices`): gateway cihazına kişi+kart başarıyla yazılınca,
   kişinin `employeeFingerprints` satırı varsa `pushFingerprintToDevices({ employeeId, deviceIds: [device._id] })` SCHEDULE et
   (await yok, ana senkronu asla bozmaz; localBridge cihazlara yok). Kart değişiminde mevcut purge eski employeeNo'yu siler,
   ardından gelen senkron bu kancayla yeni employeeNo'ya yeniden gönderir.
6. **Silme**:
   - `scheduleFingerprintPurge(ctx, employeeId, employeeNo, { deleteTemplates })`: `deleteTemplates: true` → aynı transaction'da
     kişinin TÜM `employeeFingerprints` satırları silinir. Kart değişimi (`scheduleEmployeeCardChange`) `false`; rıza iptali
     (`employeeConsents.ts:~121`), pasif, işten çıkış (`employeeTermination.ts`), kişi silme (`employeeCascade.ts`) `true`.
     Tüm çağrı yerlerini bul (`grep -rn scheduleFingerprintPurge convex`), hiçbirini atlama.
   - UI "Sil" → YENİ public `removeFingerprint({ employeeId, fingerNo })`: merkezi satırı sil + o parmağın tüm
     `deviceFingerprintEnrollments` satırları için cihazdan silme (mevcut `purgeFingerprintsOnDevices` deseni). Modül kapalı/rıza
     iptal olsa da silme çalışır. Eski `removeFingerprintFromDevice` kaldırılabilir ya da buna yönlendirilir.
   - `biometricDestruction.ts` zaten `employeeFingerprints`'i siliyor: yeni şemayla çalıştığını testle; cihazlardaki kayıtlar için
     purge tetiklenmiyorsa ekle.
7. **Eski yolların uyarlanması**: `syncEmployeeFingerprintToDevicesInternal` / `deleteEmployeeFingerprintFromDevicesInternal` /
   `employeeFingerprints.getOne` / `convex/hikvisionSync.ts:~805` retry replay / reconcile roster bacağı → ya yeni
   `pushFingerprintToDevices`'e yönlendir ya da şifreli alanlarla çalışacak şekilde uyarla (çözme yalnız action'da). Sonuç kapısı:
   `grep -rn "fingerData" convex` → DB insert/patch/return'de `fingerData` YOK; yalnız gateway çağrı argümanı + bellek.
8. **UI** `EmployeeFingerprintCard.tsx` (+test): bilgi metni → "Parmak izi şifreli olarak sistemde saklanır ve kişinin erişimi olan
   Hikvision cihazlarına otomatik gönderilir. Puantajda kullanılmaz." Liste PARMAK başına: "Sağ işaret · 3/4 cihazda · tarih"
   + cihaz adları; eksik cihaz varsa "Cihazlara yeniden gönder" (resendFingerprint); "Sil" = "Sistemden ve tüm cihazlardan sil"
   (onay diyaloğu). `listForEmployee` dönüşüne `templates: [{ fingerNo, enrolledAt, deviceIds }]` ekle — `encData`/`iv` ASLA dönmez.
   `EmployeeConsentsCard.tsx` parmak izi açıklaması → "Yalnız kapı erişimi; şifreli saklanır, mesai takibinde kullanılmaz" (yalnız bu metin).

## Ownership (yalnız bunlara yaz)
`convex/lib/fingerprintCrypto.ts` (yeni, + test) · `convex/schema.ts` (YALNIZ employeeFingerprints) · `convex/employeeFingerprints.ts` ·
`convex/fingerprintEnrollment.ts` · `convex/actions/hikFingerprint.ts` · `convex/actions/hikvisionSync.ts` (yalnız FP kancası + eski FP
fonksiyonları) · `convex/hikvisionSync.ts` (yalnız FP satırları) · `convex/lib/employeeCardChange.ts` · `convex/lib/deviceSync.ts` ·
`convex/devices.ts` (yalnız FP roster satırı) · `convex/employeeConsents.ts` · `convex/employeeTermination.ts` · `convex/employees.ts`
(yalnız purge çağrıları) · `convex/lib/employeeCascade.ts` · `convex/biometricDestruction.ts` · bu dosyaların `*.test.ts(x)`'leri ·
`src/components/employees/EmployeeFingerprintCard.tsx` (+test) · `src/components/employees/EmployeeConsentsCard.tsx` (yalnız metin) ·
`convex/_generated/api.d.ts` (yeni modül için ELLE, mevcut desenle; codegen ÇALIŞTIRMA).

## Kapsam dışı
Yüz tanıma · localBridge/DS-K2804 · IDE · Hik dışı cihaz · `mobile/**` · anahtar rotasyonu (keyVersion alanı yeter) ·
Convex env ayarı (koordinatör yapar) · başka UI/metin.

## Kapılar (hepsi senin koşumunla yeşil)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
2. `node_modules/.bin/eslint src convex` → 0 error
3. `npx vitest run` tam → yeşil. YENİ testler en az: crypto roundtrip; AAD uyuşmazlığında çözme hatası; anahtar yok/yanlış → fail
   closed; enroll sonrası encData yazılır + push schedule edilir; push kaynak cihazı hariç tutar, rızası/modülü olmayan kişide atlar;
   sync kancası schedule eder; rıza iptali/işten çıkış/silmede merkezi satır silinir, kart değişiminde kalır; `listForEmployee`
   ve hiçbir public fonksiyon `encData`/`iv`/`fingerData` döndürmez.
4. `grep -rn "fingerData" convex src` çıktısını rapora koy (madde 7 kapısı).

## YASAK
commit / push / deploy · `npx convex dev|deploy|codegen|env set|run` · DB yazma · migration çalıştırma · worktree açma ·
ownership dışı dosya. Şüphede `ask` ile koordinatöre sor.

## Rapor
`worker_done` ≤10 satır, file:line ile; ayrıntı `/tmp/fp-central-report.md` (değişen dosyalar, kapı çıktıları, grep çıktısı, açık riskler).
