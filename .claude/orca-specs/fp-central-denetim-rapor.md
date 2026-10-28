# FP-Central denetim raporu — 2026-10-22 (salt okuma)

**Sonuç:** 1 P1 · 5 P2 · 6 P3. Şablon sızıntısı yok, yetki kontrolleri doğru, kripto sağlam. Asıl risk: KVKK silmenin cihaz tarafında **yeniden denenmemesi** ve **her senkronda tüm şablonların yeniden yüklenmesi** (kota/cihaz yükü).

**Kapılar (kendi koşum):** `tsc --noEmit -p convex/tsconfig.json` → çıktı yok (0 hata). `vitest` 6 dosya → 89/89 geçti.

## Kontrol listesi özeti
| # | Madde | Hüküm |
|---|---|---|
| 1 | Şablon sızıntısı | Temiz. Düz şablon yalnız action belleğinde; scheduler argümanı/log/event/hata mesajı/public dönüşte yok. `convex/lib/gateway/core.ts:80-85` fingerprint path'lerinde REQ/RES loglamıyor. `encData`/`iv` yalnız internal fonksiyonlardan dönüyor (`employeeFingerprints.ts`), `listForEmployee` yalnız fingerNo/tarih/deviceIds. |
| 2 | Yetki | Temiz. `resendFingerprint` (`hikFingerprint.ts:174`) isManager + `authorizeEmployee` → `requireEmployeeAccess`; `removeFingerprint` action + mutation `adminMutation` + `requireEmployeeAccess`; `listForEmployee` adminQuery + erişim kontrolü. Push hedefleri `employeeDevices` ile aynı proje + aktif kural kapsamıyla sınırlı. |
| 3 | KVKK silme yolları | Çağrı yerleri tam (`grep scheduleFingerprintPurge`: rıza iptali, update(pasif), remove, cascade, termination, imha, removeFingerprint). Kart değişimi `deleteTemplates:false` (employeeCardChange.ts:13) + `employeeImport.ts:121` kart ataması `scheduleEmployeeCardChange` üzerinden → şablon korunuyor. **Ama P1-1 bkz.** |
| 4 | Yayma doğruluğu | Her hedefte `getPushTarget`→`enrollmentTarget` (modül/rıza/aktif/kart/kapsam/yetenek) + kaynak hariç + cihaz başı try/catch izolasyonu OK. Yarış: **P2-1**. |
| 5 | Döngü + kota | Sonsuz döngü yok (push → recordPush sync tetiklemiyor; purge→push şablonsuz boş dönüyor). Kota: **P2-2, P2-4, P2-5**. |
| 6 | Kripto | OK: rastgele 12B IV, AAD `employeeId:fingerNo`, 32B anahtar doğrulama, fail-closed, v1 sürüm kontrolü. `encode` offset tuzağı şu an tetiklenmiyor (**P3-1**). |
| 7 | Şema | `fingerData` okuyan kod kalmadı (`grep employeeFingerprints`: yalnız schema, devices roster, imha, cascade, adminGuards sayım listesi). |
| 8 | UI | Doğru; any/`!` yok. **P3-3, P3-4**. |

## P1

### P1-1 Cihaz silme başarısız olursa yeniden deneme yok → KVKK silme sessizce yarım kalır
`convex/actions/hikFingerprint.ts:116-123`, `convex/lib/employeeCardChange.ts:41`; cron yok (`grep purgeFingerprintsOnDevices` → yalnız bu iki yer).
Senaryo: kişi işten çıkarılır / silinir / rıza iptal edilir, merkezi şablon DB'den hemen silinir; cihaz o anda çevrimdışı → `deleteFingerprintFromDevice` hata verir, `catch {}` yutar, satır `deletionEmployeeNo` ile kalır, tekrar schedule eden hiçbir şey yok. Parmak izi cihazda kalır. Kişi silindiyse (`employees.ts:356`) UI'dan elle yeniden deneme yolu da yok (satır yetim). Ayrıca `getPushTarget` (`fingerprintEnrollment.ts:231`) bu cihaza o kişi için push'u sonsuza dek engeller.
Düzeltme: purge'e `attempts` + `ctx.scheduler.runAfter(backoff)` ile kendini yeniden planlama (en fazla N deneme) ya da `deletionEmployeeNo` satırlarını tarayan günlük cron; kalıcı başarısızlıkta admin'e görünür uyarı.

## P2

### P2-1 Rıza iptali ile eşzamanlı push: cihazdaki şablon sahipsiz kalabilir
`hikFingerprint.ts:157-163`. `recordPush` (rıza yeniden kontrolü) hata verirse `deleteFingerprintFromDevice` best-effort çağrılır; dönüş `{ok:false}` kontrol edilmiyor, throw ederse dıştaki `catch` yutuyor. Bu noktada metadata satırı yok → purge snapshot'ı onu görmez.
Senaryo: push gateway'e yazar → aynı anda rıza iptali (purge hiçbir satır görmez) → `recordPush` fırlatır → silme isteği zaman aşımı → iptal edilmiş kişinin şablonu cihazda kalır, kimse izlemiyor.
Düzeltme: gönderimden ÖNCE `deletionEmployeeNo`'lu bir izleme satırı (veya "pending push" satırı) yaz; silme başarısızsa P1-1'deki retry mekanizmasına devret.

### P2-2 Her senkron tüm şablonları cihaza yeniden yükler (dedupe yok) + (çalışan×cihaz) başına fazladan query
`convex/actions/hikvisionSync.ts:300-306` + `hikFingerprint.ts:141-168`. Push, satırda `enrolledAt` güncel olsa bile şablonu yeniden `FingerPrintDownload` + progress polling ile yazar. Hook her `syncEmployeeDevices` çağrısında çalışır: `hikGatewayDevice.ts:242` (cihaz bazlı tüm roster) ve `hikvisionSync.ts:698` (kural değişince tüm çalışanlar). Ayrıca hook her cihaz için `listInternal` runQuery çağırır (şablonsuz kişide action schedule etmiyor — bu kısım doğru — ama query her (çalışan×cihaz) için ödeniyor).
Senaryo: 500 çalışan, ortalama 2 parmak, 3 cihaz → tek bir kural kaydında ~3000 cihaz yazımı + ~9000 function call (getPushTarget/getOne/recordPush/event) — daha önce yanan Convex kotası ve cihaz flash yazımı.
Düzeltme: push'ta satır `enrolledAt >= new Date(template.addedAt).toISOString()` ve `deletionEmployeeNo===undefined` ise atla (resend için `force` bayrağı); hook'ta `listInternal`'ı cihaz döngüsü dışında bir kez çağır (ya da `getEmployeeWithDevices` içine "hasFingerprint" bayrağı koy).

### P2-3 Push hatası yeniden deneme kuyruğuna girmiyor; kuyruk worker'ı sahte başarı döndürüyor
`hikFingerprint.ts:164` (hata yalnız device event) ve `convex/actions/hikQueueWorker.ts:155-162`: `addFingerprint` kolu push'u schedule edip `{ok:true}` döner → mevcut retry kaydı "çözüldü" olur; push başarısızsa iz kalmaz. Eski akış `recordSyncFailure` ile retry ediyordu.
Senaryo: cihaz 10 dk kapalı → push başarısız → kimse tekrar denemez; UI'da "x/y cihazda" eksik görünür, yalnız elle "yeniden gönder" çözer (otomatik tek telafi P2-2'deki gereksiz yeniden yükleme).
Düzeltme: push başarısızlığında `recordSyncFailure(operation:"addFingerprint", payload:{employeeId, fingerPrintID})`; worker kolunda push'u `runAction` ile bekleyip gerçek sonucu dön (veya sonucu satır durumundan oku). P2-2 dedupe'u eklenince bu zorunlu hale gelir.

### P2-4 Reconcile roster'ı tek query içinde N× `employeeDevices` okuyor
`convex/lib/deviceSync.ts:51-54` (`getHikDeviceFingerprintRoster`, `devices.ts:1212`). Şablonu olan her çalışan için `enrollmentTarget` (groupMembers + kurallar + groupDevices + groupDoors + doors) çalışır. Tek query okuma limitine (≈16K doküman / 8 MB) takılabilir; büyük projede reconcile (`hikGatewayDevice.ts:885`) komple düşer.
Düzeltme: kapsamı zaten `resolveAuthorizedEmployeeIds` çözdü → `enrollmentTarget` yerine yalnız ucuz kontroller (aktif, kart, rıza, modül, cihaz yeteneği) veya kümeleri sayfalayarak.

### P2-5 `getPushTarget`/`beginEnrollment` cihaz başı 1001 satır okur; >1000 satırda push sessizce hiç gitmez
`convex/fingerprintEnrollment.ts:229-231` (aynı desen `:128-129`). Her (cihaz×şablon) gönderiminde `by_device` tüm satırları taranır (read amplification) ve 1000'i aşınca `null` → cihaz sessizce atlanır (event bile yazılmaz çünkü `continue`).
Düzeltme: `by_device` yerine "bekleyen işlem" için ayrı indeks/alan (`pendingUntil` filtreli indeks) ya da yalnız ilgili satırlara bakan indeks; limit aşımında hata event'i yaz.

## P3
1. `convex/lib/fingerprintCrypto.ts:8`: `value instanceof ArrayBuffer ? value : value.buffer` — Uint8Array offset'li ise (ör. subarray) yanlış byte'ları kodlar; farklı realm'den ArrayBuffer gelirse `.buffer` undefined → boş çıktı. Bugün iki çağrı da tam buffer; yine de `new Uint8Array(value.buffer, value.byteOffset, value.byteLength)` kullanın.
2. Anahtar rotasyonu yok (`keyVersion` sabit `"v1"`, tek env anahtar); anahtar kaybı = tüm şablonlar kaybı. Deploy öncesi `FINGERPRINT_TEMPLATE_KEY` Convex env'e (notable-tern-4) konmalı, yoksa kayıt fail-closed; yedek prosedürü yazılmalı.
3. `fingerprintEnrollment.ts` (`removeFingerprint`, `recordPush`) ve `hikFingerprint.ts` yeni silme/yeniden gönderme/dağıtımlar için `writeAudit` çağırmıyor (yalnız device event). KVKK hesap verebilirliği için silme ve resend'e audit eklenmesi önerilir.
4. `EmployeeFingerprintCard.tsx`: `templates` sıralı değil (kaynak-only satırlar sona eklenir); "x/y cihazda" paydası yetenek taraması `false` olan cihazları hariç tutuyor — kullanıcıya açıklanmıyor.
5. `employees.ts:318` + `employeeCascade.ts:42`: kişi silerken `scheduleFingerprintPurge` iki kez çalışır (2. çağrıda satırların `deletionEmployeeNo`'su dolu) → aynı snapshot'larla 2 purge action'ı (çift gateway silme + çift event). `cascade` içindeki `fingerprints` okuması yalnız sayı için kaldı.
6. `removeFingerprintFromDevice` (`hikFingerprint.ts:84-92`): merkezi silme önce yapılıyor; cihaz silme hata verirse kullanıcıya "silinemedi" denir ama merkezi şablon gitmiştir (UI mesajı yanıltıcı).

## Notlar
- Modül kapalıyken şifreli şablonlar DB'de kalır (yalnız push durur); silme KVKK imha modülüyle olur — bilinçli ise sorun değil.
- Yeni kod hiçbir yerde `any`/`!` kullanmıyor; eslint kapısı yazar raporunda 0.
