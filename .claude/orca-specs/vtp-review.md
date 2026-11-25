# Denetim — Ziyaretçi geçici QR/PIN Faz 1 (Claude, salt okuma, 2026-11-25)

**Özet**
1. Kimlik bilgisi tarafı sağlam: QR 128-bit, PIN rejection-sampling, DB/audit/rawData/log'da yalnız hash; yeniden üretim ve iptal eski kodu ve bekleyen kapı işini öldürüyor; çalışan mobil açma yolu ve localBridge kapısı değişmedi.
2. **1 Engel:** kartsız (pass) ziyaretçinin rastgele sanal kart no'su Hik/IDE cihazlarına normal kart gibi yazılıyor; pass iptali/limiti/yeniden üretimi bu cihaz kimliğine etki etmiyor → Faz 1 "cihazdan bağımsız" değil, iptal edilmiş ziyaretçi klon kartla geçebilir.
3. Düzeltilmeli 5: çıkış okutması sayılmadan kapıyı açıyor (limit atlatma), limit dolunca çıkış reddi, sentetik e-postaya "gönderildi", PIN kilidinde sınırsız satır + kiosk kilitleme DoS, silinen kapıda asılı `virtualReaderDoorId`.

İlgili testler: `vitest run convex/visitorPasses.test.ts convex/visitorDoorOpen.test.ts convex/lib/visitorPass.test.ts convex/visitorPassMailData.test.ts` → 4 dosya, 36/36 geçti.

---

## Engel

### E1 — Pass ziyaretçinin sanal kartı fiziksel cihazlara yazılıyor, pass kontrolleri bu kimliği kapsamıyor
- Yer: `convex/visitors.ts:383` (sanal kart üretimi) → `convex/visitors.ts:451-457` (`syncEmployeeToDevicesInternal` + `syncEmployeeToIdePanels` koşulsuz). `visitorCredential` hiçbir sync yolunda okunmuyor (`grep visitorCredential` → yalnız schema/visitorPasses/mailData/mobileAccess/UI).
- Senaryo: Kartsız ziyaretçi oluşturulur → Hik'e person+kart (employeeNo = sanal no), IDE'ye kullanıcı (kart no) yazılır, kural kapılarında süre sonuna kadar geçerli. Sanal no sır değil ve görünür: `cardReadings.cardNo` (her QR/PIN okutmasında `convex/lib/visitorPass.ts:117`, retlerde `:54`), ziyaretçi detay sorgusunun `cardNumber` alanı, PDKS/geçiş kayıtları. Bu no ile 125 kHz/Wiegand kart klonlanır (ya da Hik QR okuyucuya sayısal QR gösterilir) → fiziksel okuyucudan geçiş. Operatör pass'i **iptal etse** (`visitorPasses.revoke` yalnız `status:"revoked"`) veya **yeniden üretse** cihaz kimliği aynen kalır; `maxUses` cihazda uygulanmaz. Limit dolunca `scheduleVisitorCardRemoval` (`convex/lib/visitorPass.ts:113`) cihazdan siler ama ziyaretçi `isActive`+grup üyesi kalır → sonraki herhangi bir kural/kişi resync'i onu geri yazar.
- Tasarım §1/§3: sanal kart yalnız Faz 2-3 cihaz kimliği; Faz 1 "cihazdan bağımsız".
- Düzeltme (öneri sırası): (a) Faz 1'de `visitorCredential === "pass"` için Hik (`syncEmployeeDevices`) ve IDE (`syncEmployeeToIdePanels`) sync çekirdeği erken dönsün — create/update/toplu kural resync yollarının hepsi bu çekirdeklerden geçtiği için tek nokta; (b) bunun testini ekle (pass ziyaretçide `hikPendingOperations`/`idePendingOperations` oluşmaz, Hik action'ı çağrılmaz); (c) (a) yapılınca `consumeVisitorPass` içindeki `scheduleVisitorCardRemoval` gereksiz olur (zararsız, kalabilir). Faz 2'de cihaz yazımı açılırken revoke/regenerate'e söküm eklenmeli.

## Düzeltilmeli

### D1 — Çıkış okutması sayılmıyor ama bağlı kapıyı açıyor → limit atlatılır
- Yer: `convex/lib/visitorPass.ts:110-111` (`direction === "entry"` ise +1) + `convex/lib/doorOpenDispatch.ts:17` (yön bakmadan açar). Yön `resolveDirection` (`convex/lib/cardReadingProcess.ts:90-111`): kiosk `accessDirection: "exit"` ise hep çıkış; `"both"` ise aynı gün son izinli okuma girişse çıkış.
- Senaryo: Kiosk kapıya bağlı ve PDKS'de çıkış noktası → `maxUses=1` ziyaretçi kapıyı sınırsız açar (sayaç hiç artmaz). `"both"` modda giriş+çıkış dönüşümlü → `maxUses=N` ile 2N-1 kapı açma; QR'ı dışarıdaki birine verip "çıkış" okutturmak kapıyı sayaçsız açar.
- Düzeltme: Bağlı kioskta kapı yalnız `direction === "entry"` iken açılsın (çıkış yalnız kayıt) **veya** `maxUses` tanımlıysa kapıyı açan her okutma sayılsın. En basiti: `setDoor`/`create`'te kapı bağlanan sanal okuyucunun yönü "entry" olmaya zorlanır. Ürün kararı (Emre "yalnız girişler sayılır" dedi; kapı açmanın yönü konuşulmadı).

### D2 — Limit dolunca çıkış da reddediliyor
- Yer: `convex/lib/visitorPass.ts:90` (`status === "exhausted"` → EXHAUSTED, yön hesaplanmadan) ve `:109`.
- Senaryo: `maxUses=1` (form "Tek giriş" kısayolu) → giriş sayacı doldurur → ziyaretçi çıkarken kiosk "Giriş limiti doldu" der, çıkış kaydı `reddedildi`, PDKS'de içeride kalır. "Yalnız girişler sayılır" kararıyla çelişir.
- Düzeltme: exhausted durumda yönü çöz; `exit` ise izinli kayıt yaz (sayaç değişmez; kapı açma D1 politikasına göre), yalnız `entry` reddedilsin.

### D3 — Sentetik e-posta adresine gönderip "gönderildi" diyor
- Yer: `convex/visitorPassMailData.ts:26` (`visitor.email?.trim()` boş değilse gönder). E-posta verilmezse ziyaretçiye `ziyaretci-<uuid>@ngsaccess.local` yazılıyor (`convex/visitors.ts:415`).
- Senaryo: Formda e-posta boş bırakılır → "E-posta gönder" → Resend `.local` alıcıyı kabul eder → `ok:true`, audit "pass e-postası gönderildi", toast başarı; kimse almaz. SMTP'de SEND_FAILED (yanlış mesaj; doğrusu NO_EMAIL).
- Düzeltme: `prepare`'de `email.toLowerCase().endsWith("@ngsaccess.local")` → `NO_EMAIL` (aynı kontrol `convex/visitors.ts:326` ve `VisitorSlideOverPanel.tsx:91`'de var; ortak helper'a çıkar). Test ekle.

### D4 — PIN kilidi: kilitliyken sınırsız satır yazımı + kiosk kilitleme DoS + okuyucu sayısıyla çarpan deneme hızı
- Yer: `convex/lib/visitorPass.ts:65` (kilitliyken `deny("PIN_LOCKED")` her seferinde `cardReadings` insert), `:46-59`; kilit anahtarı yalnız `deviceId` (`visitorPassAttempts.by_deviceId`).
- Senaryo: Okuyucu token'ı kiosk URL'inde (tablet ekranında/fotoğrafta görünür) → herkes `virtualReaders.scanPin`'i uzaktan çağırabilir. (a) Kilitliyken her çağrı 1 mutasyon + 1 `cardReadings` satırı → sınırsız ret satırı (PDKS/geçiş ekranları, depolama, function-call kotası). (b) 5 dk'da bir 5 yanlış PIN → kioskun PIN girişi kalıcı kilitli (meşru ziyaretçiler PIN_LOCKED). (c) Projede N sanal okuyucu → N×5 deneme/5 dk; 50 aktif PIN'de tek okuyucu ~%7/gün isabet, 5 okuyucuda ~%30/gün.
- Düzeltme: kilitliyken ret satırı yazma (ya da kilit penceresi başına tek satır); proje başına ek üst sınır (ör. proje/saat ≤ 30 hatalı PIN → proje çapında kilit); kilit sırasında yalnız QR'ın çalışacağını kiosk metninde söyle. (b) tam çözülemez (token sahibi zaten okuyucu), ama proje sınırı + audit uyarısı tespit sağlar.

### D5 — Kapı silinince `virtualReaderDoorId` asılı kalıyor
- Yer: `convex/doors.ts:375` (`remove`) ve fiziksel cihaz silme yolu `virtualReaderDoorId`'yi temizlemiyor (alanı yalnız `convex/virtualReaders.ts:42,69` yazıyor).
- Senaryo: Kiosk'un bağlı olduğu kapı silinir → `consumeVisitorPass` (`convex/lib/visitorPass.ts:105`) her ziyaretçiyi `NOT_ALLOWED` reddeder; Cihazlar diyaloğu boş seçim gösterir, sebep görünmez. Fail-closed (güvenlik açığı değil), sessiz arıza.
- Düzeltme: kapı silmede `devices` içinde bu kapıya bağlı sanal okuyucuları bul (proje cihazları `by_project` + filtre, ≤500) ve `virtualReaderDoorId: undefined` patch'le; fiziksel cihaz silinince de o cihazın kapılarına bağlı okuyucular için aynı.

## Not

- **N1 Rastgelelik:** `generateVisitorToken` 16 bayt `crypto.getRandomValues` → 22 karakter base64url, 128-bit doğru (`convex/lib/visitorPass.ts:17-20`); PIN rejection sampling sınırı doğru (`:22-27`, 4 294 000 000 = 4294×10⁶). Mutasyon içinde Convex runtime rastgeleliği yürütme başına tohumlanır; reader/checkIn UUID'leri de aynı yolu kullanıyor, kabul edilebilir.
- **N2 PIN hash'inde gizli anahtar (pepper) yok:** `sha256(projectId:pin)` → DB okuma yetkisi olan biri 10⁶'yı anında çözer. İsteğe bağlı: env secret ile HMAC (`VISITOR_PIN_PEPPER`), action tarafında aynısı.
- **N3 Yeniden üretim sayacı sıfırlıyor** (`convex/visitorPasses.ts:43`): "kod kayboldu, yeniden ver" işlemi limiti sıfırlar; onay metninde yazıyor (operatör yetkisi), bilinçli olduğundan emin olun. Sayaç korunup yalnız kod dönebilir.
- **N4 Her izinli okutmada okuyucu satırına `lastSeen` patch'i** (`convex/lib/visitorPass.ts:122`), mevcut `scan` yolundaki 60 sn throttle'ı yok → `devices.list` abonelikleri her okutmada yeniden koşar. Throttle'ı uygula.
- **N5 Döngüsel import:** `convex/lib/visitorPass.ts` → `../visitors` (`scheduleVisitorCardRemoval`) ↔ `convex/visitors.ts` → `./lib/visitorPass`. Yalnız çalışma anı kullanımı, testler geçiyor; `scheduleVisitorCardRemoval`'ı `convex/lib/` altına taşımak daha temiz.
- **N6 Tek seferlik gösterim doğru:** sır yalnız React state'inde (`useVisitorFormSubmit` `issued`, `VisitorPassManagement` `secret`), route/sorgu/localStorage'da yok; `getForVisitor` hash döndürmüyor; print portal bileşenle birlikte kalkıyor. Ama kod ekranı açıkken form `isDirty=false` raporluyor (`VisitorForm.tsx:31`) → dışarı tıklayınca onaysız kapanır, kod kaybolur (yeniden üretim gerekir). Kapatmada "Kodu kaydettiniz mi?" onayı önerilir.
- **N7 Ön kayıtlı (isActive=false) ziyaretçiye e-posta** `PASS_MISMATCH` döner (`convex/visitorPassMailData.ts:24`), UI "Bu kod artık geçerli değil" der — yanıltıcı. Pasif ziyaretçiye e-postaya izin ver ya da ayrı sebep (`NOT_ACTIVE`) döndür.
- **N8** `employeeWithinAccessEpoch` ziyaretçide artık `visitorTime` kullanıyor (`convex/lib/mobileAccess.ts:46`): ofsetsiz yerel saatler +03:00 sayılır (doğru yönde), saat içermeyen değerler artık ret. Mevcut mobil ziyaretçi akışında davranış değişikliği; kayıtlar ISO-Z yazıldığı için pratik etki beklenmiyor.

## Doğrulanan (sorun yok)
- Düz token/PIN yalnız `issue/regenerate` dönüşünde ve e-posta gövdesi/ekinde; audit `newValue` yalnız status/maxUses/usedCount; `rawData` yalnız `passId`+sebep+doorOpen; `requestId` yalnız `tokenHash` (hash) taşıyor; action exception'ı log'lamıyor; mailer hata log'u gövde içermiyor.
- Regenerate/revoke: bekleyen kapı işi `mobileOperationAllowed` ziyaretçi dalında `hash !== pass.tokenHash` / `revoked` ile teslimden önce düşüyor (`convex/lib/mobileAccess.ts:275-277`); exhausted son giriş bilinçli teslim ediliyor.
- Sayaç tek mutasyonda atomik; süre/iptal/aktif değil/başlamadı kontrolleri sayaçtan önce; bağlı kiosk başka kapıdaysa kural+üyelik+kapı linki kontrolü `NOT_ALLOWED` (`convex/lib/visitorPass.ts:100-108`), teslimde yeniden doğrulanıyor.
- `visitorDoorOpenStatus`: okuyucu token'ı + `requestId` okuyucu segmenti + proje eşleşmesi; başka okuyucunun/projenin işlemi `null`. Kiosk aboneliği yalnız `result` fazında ve `operationId` varken.
- Çalışan mobil açma: `requestOpen` taşıma dalı `dispatchDoorOpen`'a birebir taşındı; çalışan satırında `sessionId`/`authVersion` yoksa `false` (fail-closed, `convex/lib/mobileAccess.ts:297`); localBridge `unsupported` kapısı korunuyor (`:64`), IDE yine env bayrağına bağlı.
- E-posta: `visitors.manage` + proje kapsamı + iki hash eşleşmesi; alıcı/ad/kapı/tarih DB'den, HTML escape'li, link yok, gerçek PNG eki; `"use node"` yalnız `actions/visitorPassMail.ts`, `qrcode` yalnız orada; `visitorPassMailData.ts` node'suz.
- Cascade: ziyaretçi silme → `cascadeRemoveEmployeePII` pass satırlarını siliyor; cihaz silme → `visitorPassAttempts` siliniyor; proje silme `visitorPasses` ile bloklanıyor; cihaz kişileri için roster temizliği yok (söküm yalnız bu ziyaretçinin snapshot'ı).
- Kota: yeni poll/setInterval yok; okumalar `take(201)` / `GRAPH_LIMIT` sınırlı; satır başına runMutation yok.
