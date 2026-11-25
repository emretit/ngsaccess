# Ziyaretçi geçici PIN/QR + geçiş sayısı — tasarım (Claude, K3, 2026-11-25)

**Özet**
1. Öneri: ziyaretçiye **iki ayrı kimlik** — bulut için 128-bit rastgele QR token + 6 haneli PIN (yalnız hash saklanır); cihaz için kartın yerine geçen **rastgele 32-bit sanal kart no** (`employees.cardNumber`).
2. Faz 1 cihazdan bağımsız: sanal okuyucu (tablet) ziyaretçi QR'ını/PIN'ini bulutta doğrular, sayacı atomik düşer, kiosk bir kapıya bağlıysa mevcut uzaktan açma kanalıyla kapıyı açar.
3. Cihazda QR/PIN/sayaç (Hik `qrCode`/`maxOpenDoorTime`, IDE `max_uses`) kodda YOK ya da sahada doğrulanmadı → Faz 2-3, her biri tek cihazda saha kanıtına kapılı.
4. Kural/plan modeli değişmez: ziyaretçi kapıları yine `resolveVisitorDoorRule` ile kapı seti başına tek kurala bağlanır; geçiş sayısı kurala değil pass'e yazılır.
5. Efor: Faz 1 ~2,5 gün · Faz 2 ~2 gün + saha · Faz 3 ~1,5 gün + saha · Faz 4 (IDE sayaç) opsiyonel ~1 gün. En büyük risk: cihaz yolunda sayacın çevrimdışıyken aşılması.

## 0. Bugün ne var (kanıt)
- Ziyaretçi = `employees` satırı (`isVisitor`, `accessStartsAt/ExpiresAt`, `visitorStatus`) `convex/schema.ts:165-190`; `cardNumber: v.string()` zorunlu `convex/schema.ts:134`; boş kart reddi `convex/visitors.ts:383`, `:517`.
- Kapı seçimi → kapı seti başına tek her-zaman-açık visitor kuralı (Hik hafta planı slotu) `convex/lib/visitorDoorRule.ts:25-72`.
- Süre sonu: 5 dk cron `convex/crons.ts:66` → `expireVisitorAccess` `convex/visitors.ts:646`; çıkış `:606`; söküm yalnız bu ziyaretçinin snapshot'ı/kartı için `scheduleVisitorCardRemoval` `convex/visitors.ts:34-60`.
- Mobil QR: `checkInTokens` (UUID, tek kullanımlık, oturuma bağlı) `convex/schema.ts:216`, üretim `convex/employeeCheckIn.ts:22-30`, tüketim `convex/lib/processCardReadingCore.ts:333-367`. UUID deseni Hik/IDE'ye ASLA kart diye gitmez `processCardReadingCore.ts:89-100`.
- Sanal okuyucu: `devices` (brand `other` + tip) `convex/lib/virtualReader.ts:1-23`; `scan` yalnız UUID kabul eder `convex/virtualReaders.ts:68-99`; **kapı açmaz, yalnız kayıt** `convex/lib/mobileAccess.ts:164`.
- Uzaktan kapı açma 3 taşıma ile var (IDE MQTT / Hik köprü / Hik gateway) `convex/mobileAccess.ts:35-86`, `convex/mobileAccessGateway.ts:8-25`; ama `mobileAccessOperations.sessionId` zorunlu `convex/schema.ts:265` (çalışan oturumu varsayıyor).
- Kartsız kişi bayrağı `hikCardless` (cihaza kart yazılmaz, person yazılır) `convex/schema.ts:135`, `convex/lib/hikSyncEmployee.ts:316`.
- Kütüphaneler hazır: `qrcode.react`, `jsqr` (`package.json:60,65`). Proje SMTP: `deliverProjectMail` `convex/lib/projectMailer.ts:82`.

## 1. Kimlik biçimi
**Bulut QR (Faz 1):** içerik `NGSV1.<base64url 22 karakter>` (128-bit `crypto.getRandomValues`). İmzalı JWT değil: doğrulama zaten DB satırı istiyor (sayaç, iptal), imza yalnız sızıntı yüzeyi ekler. Önek UUID desenine uymaz → mevcut `READER_TOKEN_PATTERN` yolu ve Hik/IDE kart yolu ile çakışmaz. DB'de yalnız `sha256(token)` saklanır; QR yeniden gösterilecekse **yeniden üretilir** (eskisi ölür).
**PIN (Faz 1):** 6 hane, sunucuda üretilir; proje içinde **aktif pass'ler arasında** benzersiz (`by_project_and_pinHash` ile kontrol, çakışırsa yeniden çek, ≤5 deneme). `pinHash = sha256(projectId + ":" + pin)`. 6 hane 10⁶ uzay → kaba kuvvete karşı okuyucu başına kilit (§4).
**Cihaz kimliği (Faz 2-3):** `employees.cardNumber` = rastgele 32-bit sayı (1..4294967295, W34 aralığı), `by_card` indeksiyle benzersiz (`convex/schema.ts:194`). Hik'te `employeeNo` da bu (`hikSyncEmployee.ts:287,303`). Cihaz QR'ı bu sayıyı içerir; bu **sır değildir** (kart numarası kadar korumalı), güvenliği süre + sayı + kapı kapsamı sağlar.

**Hangi cihaz neyi okur — bilinen / bilinmeyen**
| Aile | QR | PIN | Kaynak |
|---|---|---|---|
| Sanal okuyucu | Evet (kamera, `jsqr`) | Yok → Faz 1'de ekran tuş takımı eklenir | `src/pages/VirtualReaderKiosk.tsx:101-137` |
| Hik gateway (K1T804/K1T807/ANKA001) | **Bilinmiyor.** Probe var (`isSupportQRCodeInfo`) `convex/lib/gateway/capabilities.ts:183-186`, sonuç `devices.hikCapabilitiesSnapshot` `schema.ts:510`'da; canlı değer okunmadı. QR içeriğinin kart no olarak mı geldiği bilinmiyor | **Bilinmiyor.** Okuyucu `hikVerifyMode` saklanıyor `schema.ts:412`; UserInfo `password` alanı kodda yazılmıyor `convex/lib/gateway/persons.ts:131-148` | — |
| DS-K2804 (SDK köprüsü) | Kontrolcü; QR yalnız takılı okuyucu QR'ı Wiegand kart no olarak gönderiyorsa (kart yolu). Bilinmiyor | Tuş takımlı okuyucu + SDK şifre alanı: bilinmiyor | memory `hikvision_2804_sdk_bridge` |
| IDE Smart | Kullanıcı kimliği 64-bit tamsayı, "kart no veya QR değeri" `docs/ide-smart/05-crud-data-models-validation.md:5`; panelde QR okuyucu yok, Wiegand QR okuyucu takılırsa sayısal QR çalışır (sahada denenmedi) | Dokümanda PIN kavramı yok | `docs/ide-smart/09-access-control-logic.md:13-16` |
PDKS sınıflayıcı Hik `qr`/`pin` doğrulama modlarını zaten tanıyor `convex/lib/pdksSource.ts:55-56`.

## 2. Doğrulama nerede
- **Sanal okuyucu → bulut (Faz 1).** `virtualReaders.scan` önek `NGSV1.` ise `consumeVisitorPass`; yeni `scanPin` mutasyonu. Tek mutasyonda: pass bul → durum/süre/kapı/sayaç kontrol → `usedCount+1` → `cardReadings` yaz → (kiosk kapıya bağlıysa) kapı açma işi kuyruğa. Convex mutasyonu serileştirilebilir olduğundan sayaç yarışsız.
- **Kiosk kapıyı açarsa:** `devices.virtualReaderDoorId` (opsiyonel). Açma, `mobileAccess.requestOpen`'daki taşıma dalının (`convex/mobileAccess.ts:63-80`) `convex/lib/doorOpenDispatch.ts`'e çıkarılmış hâliyle yapılır; `mobileAccessOperations`'a `visitorPassId` eklenir, `sessionId`/`authVersion` opsiyonele genişler (migration yok). `mobileOperationAllowed` ziyaretçi dalında pass'i yeniden doğrular. Cihaz çevrimdışıysa açma **başarısız** gösterilir, sayaç geri alınmaz ama UI "Kapı açılamadı — resepsiyona başvurun" der (geçiş kaydı `reddedildi` değil `izin_verildi`+`doorOpen: failed` rawData).
- **Hik gateway / K2804 (Faz 2-3):** cihaz kendisi karar verir (bugünkü gibi `persistHikvisionReading` `processCardReadingCore.ts:93`); bulut yalnız kişi+kart(+QR/PIN) yazar ve olayları sayar.
- **IDE (Faz 4 ops.):** panel karar verir; sayaç `max_uses` ile (§3).
- **Desteklenmeyen kapı:** ziyaretçi formunda pass türü seçilince seçili kapıların cihaz ailesine göre rozet: "Bu kapıda QR yalnız sanal okuyucudan geçer" / "Bu cihaz PIN desteklemiyor". Hiç uygun yol yoksa kaydet butonu kapalı + açıklama (sessiz başarısızlık yok).

## 3. Geçiş sayısı
- **Kural:** sayaç tek doğruluk kaynağı olarak **bulutta** `visitorPasses.usedCount`; `maxUses` boşsa sınırsız (süreyle sınırlı). Bir "geçiş" = izinli okuma (`izin_verildi`) — çıkış okuması sayılsın mı ürün sorusu (§7-S2).
- **Bulut yolu (Faz 1):** kesin; aşım imkânsız (atomik mutasyon).
- **Hik cihaz yolu (Faz 2):** (a) cihaz destekliyorsa UserInfo `maxOpenDoorTime` (Hik ISAPI belgesinde var; **kodda yok, cihazlarımızda doğrulanmadı**) yazılır → çevrimdışıyken de kesin. (b) Desteklemiyorsa bulut sayacı olayla artar (`persistHikvisionReading` içinde visitor+pass varsa `usedCount+1`); limit dolunca `scheduleVisitorCardRemoval` + `visitorStatus:"expired"`. **Çevrimdışı tutarlılık:** cihaz çevrimdışıyken olaylar gelmez, sınır aşılabilir; backfill (`hikBackfillCursor` `schema.ts:492`) gelince sayaç düzelir, aşım raporda "sınır aşıldı (çevrimdışı)" görünür. UI bunu açıkça yazar.
- **IDE (Faz 4):** `max_uses` izne (permission) bağlı ve **periyot kovası** (günlük/haftalık…) ile, sayaç (kullanıcı, hedef bölge) başına `docs/ide-smart/05-crud-data-models-validation.md:39-53`, `09-access-control-logic.md:64-67`. "Toplam N geçiş" değil "günde N" → yalnız tek günlük pass'te birebir; izin kapı seti × N başına paylaşılır (ziyaretçi başına izin açılmaz).
- **Süre bitince / sayı dolunca söküm:** yalnız bu ziyaretçinin kendi kimliği, mevcut `scheduleVisitorCardRemoval` zinciriyle (`visitors.ts:34-60`): Hik'te o kişinin snapshot'ı, IDE'de o kart no'nun `deleteUser` işi. Roster karşılaştırıp "listede olmayanı sil" YAPILMAZ → "cihaz kişileri asla otomatik silinmez" kuralı korunur (söküm kayıtlı ziyaretçinin kendi yaşam döngüsü, bugünkü kart ziyaretçisiyle aynı yol). Cihazda `Valid.endTime` de ziyaret sonuna yazılıyor `persons.ts:136-140` → söküm gecikse bile cihaz süre sonunda reddeder.

## 4. Teslim, KVKK, güvenlik
- **Teslim:** (1) Oluşturunca ekranda QR + PIN tek seferlik gösterilir, "Yazdır" (A6 rozet: ad, geçerlilik, kapılar, QR, PIN). (2) E-posta: proje SMTP ile `deliverProjectMail`; QR PNG eki + PIN; e-postada link yok. (3) Link (`/pass#<token>`, token `#` sonrası — `virtualReaderPath` ile aynı ilke `convex/lib/virtualReader.ts:17-20`) Faz 1'de YOK, ürün sorusu (§7-S3).
- **Tahmin edilemezlik:** QR 128-bit; PIN 6 hane + okuyucu başına 5 hatalı PIN/5 dk → 5 dk kilit (`visitorPassAttempts` tablosu, okuyucu başına 1 satır). Sanal kart no 32-bit, sır sayılmaz.
- **Sızıntı / yeniden kullanım / ekran görüntüsü:** QR statik olduğundan ekran görüntüsü paylaşılabilir — azaltım: kısa süre, `maxUses`, kapı kapsamı, "tekrar giriş için önce çıkış" (anti-passback benzeri, bulutta yön kontrolü — ops.), her geçişte kiosk ekranında ziyaretçi adı gösterilir (görevli kontrolü). Dönen (TOTP) QR cihaz yolunda imkânsız, bulutta e-postayla teslimde de ziyaretçinin uygulaması olmadığı için yok.
- **Saklama:** düz token/PIN DB'de yok; e-posta adresi zaten ziyaretçi kaydında. Ziyaretçi silinince (`removeVisitor` `visitors.ts:335`) pass satırları da silinir; KVKK metnine "geçici geçiş kodu" ibaresi eklenmeli (aydınlatma sürümü artar `visitors.ts:114`).

## 5. Veri modeli, kota, audit
Yeni tablolar (ekleme, migration yok):
```ts
visitorPasses: defineTable({
  projectId: v.id("projects"), visitorId: v.id("employees"),
  tokenHash: v.optional(v.string()), pinHash: v.optional(v.string()),
  maxUses: v.optional(v.number()), usedCount: v.number(),
  status: v.union(v.literal("active"), v.literal("exhausted"), v.literal("revoked")),
  lastUsedAt: v.optional(v.string()), createdBy: v.id("users"),
  createdAt: v.string(), updatedAt: v.string(),
}).index("by_tokenHash", ["tokenHash"])
  .index("by_projectId_and_pinHash", ["projectId", "pinHash"])
  .index("by_visitorId", ["visitorId"]),
visitorPassAttempts: defineTable({ deviceId: v.id("devices"), windowStart: v.number(), failures: v.number(), lockedUntil: v.optional(v.number()) })
  .index("by_deviceId", ["deviceId"]),
```
Genişletmeler (opsiyonel alan): `devices.virtualReaderDoorId`, `mobileAccessOperations.visitorPassId` + `sessionId`/`authVersion` opsiyonel, `employees.visitorCredential: "card"|"pass"` (UI ayrımı; `cardNumber` pass'te sanal no).
Süre/geçerlilik pass'e kopyalanmaz: ziyaretçinin `accessStartsAt/ExpiresAt` + `isActive` okunur (tek kaynak, uzatma otomatik geçerli).
**Kota:** yoklama yok. Doğrulama okutma başına 1 mutasyon (bugünkü `scan` gibi); kiosk heartbeat mevcut 2 dk `virtualReader.ts:9`. Hik sayacı mevcut olay mutasyonuna gömülür (ek çağrı yok). Süre sonu mevcut 5 dk cron'u; sayı dolunca söküm aynı mutasyonda tetiklenir (cron yok).
**Audit:** her geçiş `cardReadings` (`rawData: {source:"qr"|"pin", protocol:"visitor_pass", passId}`; PDKS sınıflayıcısı `qr`/`pin`'i tanır `pdksSource.ts:55-56,63`); pass oluştur/yeniden üret/iptal `auditLog` (`schema.ts:1459`, `targetTable:"visitorPasses"`, PIN/token değeri yazılmaz). Ret de `cardReadings`'e `reddedildi` + sebep (bugünkü token yolu reti yazmıyor `processCardReadingCore.ts:332` — ziyaretçi için yazılmalı, tahmin denemesi görünür olsun).

## 6. Fazlı plan
**Faz 1 — Bulut QR/PIN + kiosk (~2,5 gün, 3 paralel worker)** Tek başına değer: kart dağıtmadan resepsiyon tabletinden ziyaretçi girişi + sayaç + (bağlıysa) kapı açma.
- W1 backend-pass: `convex/schema.ts`, `convex/visitorPasses.ts` (yeni: issue/regenerate/revoke/getForVisitor), `convex/lib/visitorPass.ts` (yeni: üretim, hash, `consumeVisitorPass`, PIN kilidi), `convex/virtualReaders.ts` (önek dalı + `scanPin`), `convex/visitors.ts` (`credential:"pass"` → sanal kart no üret, `cardNumber` zorunluluğunu bu modda kaldır), testler `convex/visitorPasses.test.ts`, `convex/lib/visitorPass.test.ts`.
- W2 backend-kapı: `convex/lib/doorOpenDispatch.ts` (yeni), `convex/mobileAccess.ts`, `convex/lib/mobileAccess.ts`, `convex/mobileAccessGateway.ts`, `convex/actions/visitorPassMail.ts` (yeni) + testleri. Şema değişikliğini W1'e spec olarak verir (schema'ya yalnız W1 yazar). W1'den sonra koşar (W1 `consumeVisitorPass` imzasını sabitler).
- W3 frontend: `src/components/visitors/VisitorFormFields.tsx`, `VisitorForm.tsx`, `src/components/visitors/VisitorPassCard.tsx` (yeni: QR+PIN+yazdır+e-posta), `src/pages/VirtualReaderKiosk.tsx`, `src/components/virtual-reader/readerKiosk.ts` (PIN tuş takımı, ziyaretçi sonucu), `src/components/devices/VirtualReaderDialog.tsx` (kapı bağla).
- Kabul: (1) kartsız ziyaretçi oluşur, QR+PIN bir kez görünür; (2) `maxUses=2` → 3. okutma `EXHAUSTED`, satır `reddedildi`; (3) süre dışı/iptal/yeniden üretilmiş eski QR red; (4) 5 hatalı PIN → kilit; (5) kiosk kapıya bağlı + IDE/Hik köprü işi kuyruğa düşer, çevrimdışıda "açılamadı"; (6) çalışan UUID QR akışı ve `virtualReaders.test.ts` aynen geçer; kapılar `tsc`, `eslint src convex`, tam `vitest run` (memory: kısmi vitest yetmez).
**Faz 2 — Hik cihaz QR + sayaç (~2 gün + 1 saha günü)** Önkoşul: tek cihazda (öneri K1T807 NGS0002) `qrCode` probe true + sanal kart no'lu QR'ın kart olayı olarak düştüğü saha kanıtı; `maxOpenDoorTime` deneme yazımı.
- W1: `convex/lib/gateway/persons.ts` (`maxOpenDoorTime` ops.), `convex/lib/hikSyncEmployee.ts`, `convex/lib/processCardReadingCore.ts` (Hik olayında pass sayacı), `convex/lib/visitorPass.ts` (sayaç dolunca söküm). W2: `src/components/visitors/*` kapı-uygunluk rozeti, `convex/lib/gateway/capabilities.ts` okuma yardımcısı. Kabul: cihaz QR'ıyla N geçiş → N+1 red (cihaz sayacı) veya bulut sayacı dolunca söküm işi; yalnız o ziyaretçinin `employeeNo`'su silinir (test: diğer kişilere delete işi yok).
**Faz 3 — Hik/K2804 PIN (~1,5 gün + saha)** Önkoşul: UserInfo `password` + okuyucu doğrulama modunun PIN-yalnız kabul ettiği saha kanıtı (K2804'te SDK karşılığı ayrıca). Dosyalar: `convex/lib/gateway/persons.ts`, köprü op payload'u (`enqueueLocalBridgeOp` çağrısı `hikSyncEmployee.ts:286`), Windows köprü kaynağı (ayrı repo). **Uyarı:** cihaza PIN düz yazılmak zorunda → PIN'i cihaz yolu için bulut hash'inden ayrı tutmak gerekir (düz PIN ancak teslim anında elde; sonra sadece cihazda).
**Faz 4 (ops.) — IDE `max_uses`:** `convex/lib/visitorDoorRule.ts` anahtarına `maxUses` ekle (kapı seti × N başına tek izin), `convex/actions/ideGatewayDevice.ts` izin yazımı. Yalnız "günlük N" anlamı; ürün onayı gerekir.

**Bilinmeyenler (uydurulmadı, sahada ölçülecek):** Hik cihazlarımızın `isSupportQRCodeInfo` değeri; QR içeriğinin Hik olayında `cardNo` olarak mı geldiği; `maxOpenDoorTime`/`password` alanlarının K1T804/K1T807/ANKA001 firmware'inde kabulü; K2804 okuyucularının QR/tuş takımı; IDE panellerine QR okuyucu takılı olup olmadığı.

## 7. Emre'ye ürün soruları (önerili)
- **S1 — Kiosk kapıyı açsın mı?** Öneri: **Evet, kiosk bir kapıya bağlanabilsin** (bağlanmazsa bugünkü gibi yalnız giriş kaydı). Bağlanmazsa Faz 1 kart dağıtımını yalnız resepsiyon kaydında kaldırır, turnike/kapıda kart yine gerekir.
- **S2 — "Geçiş sayısı" neyi sayar?** Öneri: **yalnız girişler** (çıkış okuması sayılmaz); varsayılan limit boş = süre boyunca sınırsız, form "tek giriş" kısayolu sunsun.
- **S3 — Kod ziyaretçiye nasıl gider?** Öneri: **ekranda göster + yazdır + e-posta (QR eki, PIN metinde)**; SMS ve tıklanabilir link şimdilik yok (link iletilmesi kolay → sızıntı yüzeyi).
