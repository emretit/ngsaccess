# Denetim 2 — VTP Faz 1 düzeltmeleri (Claude, salt okuma, 2026-11-25)

**Özet**
1. E1, D2, D3, D5 kapandı; D1 Emre kararıyla kapandı (çıkış kapıyı açar, sayılmaz); D4 kısmen (kilitliyken satır yazımı kalktı, okuyucu başına kilit DoS'u ve okuyucu sayısıyla çarpan deneme hızı aynen duruyor — tasarım kabulü olabilir).
2. Kart ziyaretçi akışı bozulmadı: tüm yeni dallar `visitorCredential === "pass"` koşullu; `undefined`/`"card"` için davranış eskisiyle aynı. Çıkış yolu kapı kapsamı, iptal, pasif, süre kontrollerinden sonra geliyor.
3. **Yeni 1 Düzeltilmeli:** E1 tekil sync'i susturdu ama kural/cihaz senkron koşuları (`deviceSyncRuns`) ve yetki durumu taraması pass ziyaretçiyi hâlâ hedef sayıyor → pass ziyaretçi içeren her kural senkronu "Kişi gönderilemedi" ile başarısız/kısmi düşer; ziyaretçi kapı kuralları kart ve pass ziyaretçide ortak olduğundan kart ziyaretçilerin senkron koşusu da kırmızıya döner.

İlgili testler: `vitest run convex/visitorPasses.test.ts convex/visitorDoorOpen.test.ts convex/lib/visitorPass.test.ts convex/visitorPassMailData.test.ts convex/hikvisionSync.test.ts` → 5 dosya, 88/88 geçti.

## Madde durumu

| Madde | Durum | Kanıt |
|---|---|---|
| E1 sanal kart cihaza yazılıyor | **Kapandı** (tekil yollar) — bkz. Y1 | create'te sync yok `convex/visitors.ts:450-453`; update `physicalCredential` kapısı `:533-546`; Hik çekirdek `convex/lib/hikSyncEmployee.ts:136`, hafta planı `:593`, kapı hakları `:649`; IDE `convex/actions/ideGatewayDevice.ts:127`; kural→Hik üye listesi `convex/hikvisionSync.ts:254`; söküm no-op `convex/visitors.ts:36`; `cardReadings.cardNo` artık `""` `convex/lib/visitorPass.ts:57,118` |
| D1 çıkış sayılmadan kapı açıyor | **Kapandı (karar)** | Emre: süre içinde çıkış hep açık, sayaçtan düşmez. Kalan risk: kiosk PDKS'de "çıkış" noktasıysa süre boyunca sınırsız açma (bkz. N1) |
| D2 limit dolunca çıkış reddi | **Kapandı** | `convex/lib/visitorPass.ts:120` yalnız `entry` + exhausted → EXHAUSTED; test `convex/visitorPasses.test.ts:81-88`. Teslimde exhausted bilinçli geçerli (`mobileOperationAllowed` yalnız `revoked`'u düşürüyor) |
| D3 sentetik e-posta | **Kapandı** | `convex/visitorPassMailData.ts:27` `@ngsaccess.local` → `NO_EMAIL` |
| D4 PIN kilidi | **Kısmen** | Kilitliyken ret satırı yok, yalnız 5. hata tek satır `convex/lib/visitorPass.ts:68-69`. Açık: kilit okuyucu başına (token sahibi 5 dk'da bir 5 yanlış PIN'le kioskun PIN girişini sürekli kilitler); N okuyucu = N× deneme; proje çapı sınır yok |
| D5 asılı `virtualReaderDoorId` | **Kapandı** | Kapı silme `deleteGroupDoorsForDoor` bağlı okuyucuları temizliyor `convex/lib/deviceHelpers.ts:17-25`; eski asılı kayıt için tüketimde tembel temizlik `convex/lib/visitorPass.ts:101-106` (bkz. N2) |

Ek doğrulama:
- **PIN çakışması (D2'nin yan etkisi) kapalı:** exhausted pass artık çıkışta PIN ile kullanıldığı için `issue` exhausted PIN'leri de rezerve ediyor (`convex/visitorPasses.ts:39-41`); tüketimde sıra active → exhausted → diğerleri (`convex/lib/visitorPass.ts:72-74`). Böylece yeni bir ziyaretçinin PIN'i limit dolmuş ziyaretçinin PIN'iyle çakışıp onun çıkışını başkasının girişine çeviremez. Test `convex/visitorPasses.test.ts:198`.
- **Çıkış yolu sırası:** revoked → REVOKED, `!isActive` → NOT_ACTIVE, süre → EXPIRED/NOT_STARTED, bağlı kapı + kural + üyelik + kapı linki → NOT_ALLOWED; yön ve exhausted kontrolü bunlardan **sonra** (`convex/lib/visitorPass.ts:90-120`). İptal edilmiş veya süresi dolmuş ziyaretçi çıkışla kapı açamaz; başka kapıya bağlı kioskta çıkış da reddedilir.
- **Kart ziyaretçi regresyonu yok:** `scheduleVisitorCardRemoval`, `update` cihaz söküm/sync blokları, Hik/IDE çekirdekleri yalnız pass'te erken dönüyor; kart ziyaretçide `needsDeviceSync`, `ideRemovalPanels`, `previousHikSnapshot` ifadeleri eskisiyle aynı değeri üretiyor.

## Yeni — Düzeltilmeli

### Y1 — Kural/cihaz senkron koşuları ve yetki durumu taraması pass ziyaretçiyi hedef sayıyor
- Yer:
  - `convex/deviceSyncRuns.ts:152-158` `readRuleDispatch`: kural üyelerinden aktif herkesi alıyor, pass filtresi yok.
  - `convex/deviceSyncRuns.ts:588-595`: hedef kişi için Hik `syncEmployeeToDevicesInternal` artık `synced: 0` dönüyor → `result.synced !== 1` → "Kişi gönderilemedi". IDE `queued: 0` → aynı.
  - `convex/deviceSyncRuns.ts:696-701`: cihaz yeniden senkronunda da aynı (`!result.synced` / `!result.queued`).
  - `convex/accessGrantStatus.ts:126-136`: üye×cihaz taramasında pass ziyaretçi atlanmıyor → cihaz satırı hiç oluşmayacağından "durumu bilinmiyor/bekliyor" listesinde kalır (muhtemel; UI'da doğrulanmadı).
  - `convex/lib/accessGraph.ts:196-205` `resolvePanelAuthorizedCards`: sanal kart "yetkili kart" kümesine giriyor. Zararsız (yalnız silmeyi engeller), ama sayımları şişirir.
- Senaryo: Kapı X için ziyaretçi kuralı R'de 1 kart + 1 pass ziyaretçi var. Kural/kapı değişikliği ya da "Senkron et" bir `deviceSyncRuns` koşusu açar. Pass ziyaretçi her cihaz için başarısız sayılır → koşu `failed`/kısmi, banner kırmızı, tekrar denemeler aynı sonucu verir. Kart ziyaretçi gerçekte yazılmış olsa da operatör senkronu bozuk görür.
- Düzeltme: üye toplama noktalarında pass'i baştan çıkar. `readRuleDispatch`'te filtreye `e.visitorCredential !== "pass"` ekle; `accessGrantStatus` üye döngüsünde ve `:30` tekil yolda da aynı koşul; `resolvePanelAuthorizedCards`'ta da hariç tut (tutarlılık için). Alternatif: Hik/IDE çekirdekleri pass için "atlandı" sonucunu ayrı bayrakla dönsün (`skipped: "visitor_pass"`) ve `deviceSyncRuns` bunu başarı saysın. Test: pass + kart ziyaretçili kuralda `deviceSyncRuns` koşusu `failures` boş bitmeli.

## Not

- **N1 Çıkış noktası kiosk = sınırsız açma (D1 kararının kalan riski):** kapıya bağlı kiosk PDKS'de `accessDirection: "exit"` ise her okutma çıkış olur, sayaç hiç artmaz, ziyaret süresi boyunca kapı sınırsız açılır; `"both"` modda N hak = 2N-1 açma. Karar gereği kabul ediliyorsa en azından `setDoor`/`create`'te (ya da Cihazlar diyaloğunda) "bu okuyucu çıkış noktası; limitli ziyaretçiler bu kapıyı sınırsız açabilir" uyarısı gösterin.
- **N2 Tembel temizlik sessizce davranış değiştiriyor:** `convex/lib/visitorPass.ts:103-106` asılı kapıyı görünce okuyucunun bağlantısını kaldırıp okutmayı **kapı açmadan** `izin_verildi` olarak kabul ediyor (kiosk "Giriş kaydedildi" der, kapı açılmaz). Kapı silmede artık cascade var; yalnız eski kayıtları etkiler. Daha güvenlisi: bağlantıyı temizle ama bu okutmayı `NOT_ALLOWED` ile reddet ya da `doorOpen: "failed"` ile işaretle.
- **N3 Pass ziyaretçi silinince IDE söküm işi:** `removeEmployeeRecord` (`convex/employees.ts:470-472` civarı) kural panellerine sanal kart için `deleteUser` kuyruğa alabilir (panelde olmayan bir kullanıcıyı siler). Etkisi yok; temizlik için pass'te atlanabilir. Önceki rapordaki N2-N8 aynen geçerli (PIN pepper, regenerate sayaç sıfırlama, `lastSeen` throttle, döngüsel import, kod ekranı kapatma onayı, pasif ziyaretçiye e-posta).
