# FAZ 2A — Hik'te erişimi geri alma: kart değişimi, kural silme, kişi silme, silme tekrarı

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Kanıt: `docs/genel-akis-audit/A-kisi-erisim.md` (bulgu 1 ve 3; A4 #2/#6, A5 #4/#5 satırları).
Rapor: `/tmp/akis-faz2a-rapor.md`. Bu faz Faz 1'in (rol kontrolleri) ÜSTÜNE gelir; `convex/accessRules.ts` ve `convex/cardReadings.ts`'teki Faz 1 değişikliklerini KORU.

## Temel olgu
Hik cihazında kişi kimliği (`employeeNo`) = kart numarası (`convex/actions/hikvisionSync.ts` ~:276 `employeeNo: employee.cardNumber`). Kart değişince eski kimlik silinmezse eski kart kapıyı açmaya devam eder.

## Hedef (test edilebilir)
Aşağıdaki 4 olayın her birinde, kişinin ÖNCEDEN yetkili olduğu her Hik cihazına (gateway/ISAPI ve localBridge yolu) eski `employeeNo` için silme işi gider; silme hatası kişi kaydından bağımsız yeniden denenir; cihaz onayı olmadan "tamam" sayılmaz.
1. Kart değişimi (`convex/lib/employeeCardChange.ts` `scheduleEmployeeCardChange`): şu an yalnız IDE eski kartı + parmak izi temizleniyor. Aynı transaction'da eski kartın Hik hedeflerini (kişinin mevcut Hik cihazları — ekleme yolunun kullandığı AYNI hedef çözümü: groupDevices + groupDoors) sabitle → eski `employeeNo` silme işi → sonra yeni kartla senkron.
2. Kural silme / kuraldan kişi veya cihaz çıkarma (`convex/accessRules.ts` remove ~:844-858 ve ilişki kaldıran diğer yazma yolları): ilişkiler silinmeden ÖNCE etkilenen kişi×Hik cihazı hedeflerini sabitle; sonra kişide o cihaz için başka geçerli kural kalmadıysa cihazdan sil, kaldıysa kalan kurallarla güncelle. `convex/actions/hikvisionSync.ts` ~:128 "hedef yoksa sessiz başarı" dönüşü: kişinin artık hiç kuralı yoksa ama önceden yetkili olduğu cihazlar varsa → silme.
3. Kişi silme (`convex/employees.ts` ~:317 → `convex/lib/peopleHikSnapshot.ts` ~:27/:45): silme snapshot'ı yalnız `groupDevices` okuyor; ekleme yolu `groupDoors`'u da okuyor (`convex/hikvisionSync.ts` ~:119). İkisi aynı ortak hedef çözücüyü kullansın.
4. Silme tekrarı: `convex/actions/hikQueueWorker.ts` ~:127 `deletePerson` retry'ı mevcut `employees` kaydını şart koşuyor; payload'daki eski kart/hedefle çalışsın (kişi silinmiş olsa da). `convex/deviceSyncRuns.ts` ~:714 yeniden dağıtım kişi yokken silme işlerini tekrar deneyebilsin. `convex/hikvisionSync.ts` ~:970 5 deneme sonrası "done/dismissed": silme işlerinde "başarısız — cihazda kalmış olabilir" durumu olarak görünür kalsın (Yetki Durumu / kuyruk ekranında), sessizce kapanmasın.

## Önerilen yol (karar senin, raporda gerekçele)
"Kişi hangi cihazlarda" defteri olarak W4.2 `accessGrantStatus` (cihaz başı yetki durumu) zaten var — önceki hedefleri buradan + anlık grafdan birleşik al. Yeni tablo gerekiyorsa DUR, `ask` (schema sahibi koordinatör).
IDE tarafında aynı 4 olayın durumu: değiştirme (IDE zaten eski panel listesini koruyor), yalnız eksik görürsen raporla.

## Testler
Her olay için: eski kart/kural/kişi → beklenen silme işi (cihaz + eski employeeNo) kuyruğa düşer; başka projenin cihazına iş gitmez; kalan kural varsa silme yerine güncelleme; retry kişi silinmişken çalışır; 5 deneme sonrası görünür başarısız durum.

## Ownership
`convex/lib/employeeCardChange.ts`, `convex/actions/hikvisionSync.ts`, `convex/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`, `convex/deviceSyncRuns.ts`, `convex/lib/peopleHikSnapshot.ts`, `convex/lib/accessGraph.ts`, `convex/accessRules.ts` (yalnız silme/ilişki kaldırma hunk'ları; Faz 1 rol kontrolleri kalır), `convex/employees.ts` (yalnız silme yolu hunk'ı), `convex/accessGrantStatus.ts` + bunların testleri. UI: kuyruk/Yetki Durumu ekranında "başarısız silme" gösterimi gerekirse ilgili `src/components/access-control/**` dosyası — önce `ask`.
## Kapsam dışı
Ziyaretçi süresi (Faz 2B) · parmak izi akışı (1f213ede, ayrı oturum) · IDE akışı değişikliği · `schema.ts` · `convex/cardReadings.ts`.
