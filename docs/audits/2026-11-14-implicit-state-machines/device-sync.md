# Alan A — Cihaz, entegrasyon ve senkron örtük durum makineleri

## Özet

25 durum makinesi/kümelenmiş akış saptandı (plan türleri ve aynı transactionı paylaşan hedefler birlikte sayıldı).
8 bulgu: **critical 1, high 4, medium 1, low 2**.
En kritik bulgu A-01: köprü olay kuyruğu taşma/yeniden deneme sonrasında kart olaylarını kalıcı kaybedebilir.
Denetim mevcut kirli çalışma ağacında salt okunur yapıldı; test, mutation/action, deploy ve migration çalıştırılmadı. Bulgular statik kaynak kanıtıdır; canlı cihaz ve dağıtılmış binary doğrulaması yapılmadı.

## Keşif sayımları

Önce AGENTS.md ve convex/_generated/ai/guidelines.md okundu. Convexte DB triggerı, FK veya unique index kısıtı yoktur; schema literal union yalnız değer kümesini zorlar, geçişleri zorlamaz. Geçiş ön-koşulları aşağıda mutation olarak ayrıca gösterildi.

Tüm beş kökte içerik tabanlı geniş sahiplik taraması yapıldı; dosya adı listesiyle sınırlandırılmadı. İlgili metni kullanan testler ve sınır dosyaları da sayıldı; bu nedenle aşağıdaki sayılar yalnız production durum alanı sayısı değildir. `-i` nedeniyle discovery geniş bir üst kümedir.

```sh
rg -li 'devices?|readers?|doors?|hik|ide[A-Z_]|sync|gateway|fingerprint|Fingerprint|biometric|Biometric|cardReadings?|CardReading|retention|Retention|accessTransfer|mobileAccess|mqtt' convex src mobile/lib infra bridge
# çıkan dosya listesi FILES olarak kullanıldı; her komut rg -o eşleşme sayısını verir.
rg -o '\bstatus\b' $FILES | wc -l   # 3123
rg -o '\bstate\b' $FILES | wc -l    # 2157
rg -o '\bphase\b' $FILES | wc -l    # 75
rg -o 'v\.literal\(' $FILES | wc -l # 590
rg -o '\b\w*At\s*:' $FILES | wc -l # 2537
rg -o '\bis[A-Z]\w*' $FILES | wc -l # 3755
```

Keşif dosyası: 1101. Sayımlar aynı `rg` komutlarını Python subprocess üzerinden dosya argümanlarıyla çalıştırarak alındı; shell glob/kelime bölme kullanılmadı.

### Şemadaki ilgili tabloların tam alan dökümü

Aşağıdaki bloklarda yorum/indexler dahil ilgili tablo tanımları eksiksiz verilir; iç içe alanlar da böylece görünür. İçe aktarılan plan/backfill validatorları ayrıca kendi kaynaklarında tanımlıdır: convex/lib/doorStatusPlan.ts, convex/lib/gateway/backfillState.ts.

<details><summary>mobileAccessOperations — convex/schema.ts:227</summary>

```ts
227:   mobileAccessOperations: defineTable({
228:     projectId: v.id("projects"),
229:     employeeId: v.id("employees"),
230:     sessionId: v.id("employeeSessions"),
231:     authVersion: v.number(),
232:     requestId: v.string(),
233:     deviceId: v.id("devices"),
234:     doorId: v.optional(v.id("doors")),
235:     deviceName: v.string(),
236:     requestedAt: v.string(),
237:     status: v.union(v.literal("pending"), v.literal("sent"), v.literal("confirmed"), v.literal("failed"), v.literal("unknown")),
238:     errorCode: v.optional(v.string()),
239:     ideOperationId: v.optional(v.id("idePendingOperations")),
240:     hikOperationId: v.optional(v.id("hikPendingOperations")),
241:     transport: v.union(v.literal("ide_mqtt"), v.literal("hik_local_bridge"), v.literal("hik_gateway")),
242:     actuator: v.number(),
243:   })
244:     .index("by_status_and_requestedAt", ["status", "requestedAt"])
245:     .index("by_employeeId_and_requestId", ["employeeId", "requestId"]),
```

</details>

<details><summary>devices — convex/schema.ts:392</summary>

```ts
392:   devices: defineTable({
393:     name: v.string(),
394:     projectId: v.optional(v.id("projects")),
395:     zoneId: v.optional(v.id("zones")),
396:     doorId: v.optional(v.id("doors")),
397:     // Cihazın kontrol ettiği genel kapı/röle sayısı (marka bağımsız, 1–8). Formda
398:     // kapı seçimi yerine bu sayı girilir; kapılar ayrıca bölge altında yönetilir.
399:     doorCount: v.optional(v.number()),
400:     deviceType: v.optional(v.string()),
401:     deviceIp: v.optional(v.string()),
402:     deviceSerial: v.optional(v.string()),
403:     accessDirection: v.optional(
404:       v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
405:     ),
406:     status: v.optional(v.string()),
407:     isActive: v.optional(v.boolean()),
408:     description: v.optional(v.string()),
409:     lastSeen: v.optional(v.string()),
410:     deviceUsername: v.optional(v.string()),
411:     devicePassword: v.optional(v.string()),
412:     // Marka (Hikvision / generic / IDE Smart panel). Form akışını + alan setini belirler.
413:     brand: v.optional(
414:       v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))
415:     ),
416:     // IDE Smart panel entegrasyonu. Komutlar MQTT (Hetzner broker + bridge +
417:     // idePendingOperations kuyruğu) üzerinden iletilir; Convex panele doğrudan bağlanmaz.
418:     // Panel = bölge (zoneId); kapılar zone altındaki doors (ioId 0..N-1).
419:     ideUuid: v.optional(v.string()), // SYSTEM.UUID — event lookup + dst-id eşleşmesi
420:     ideUser: v.optional(v.string()), // panel kimliği (MQTT login token'ı için; örn "admin")
421:     idePassword: v.optional(v.string()), // panel şifresi (AUTH.USER1..5)
422:     ideHttpPort: v.optional(v.number()), // opsiyonel LAN yedeği (HTTPSERVER.PORT)
423:     ideDoorCount: v.optional(v.number()), // panel aktüatör/kapı sayısı (default 4)
424:     // Hik Device Gateway entegrasyonu
425:     hikDevIndex: v.optional(v.string()),
426:     ehomeID: v.optional(v.string()),
427:     ehomeKey: v.optional(v.string()),
428:     hikModel: v.optional(v.string()),
429:     // Hikvision transport:
430:     // - gateway: Convex -> Hik Device Gateway -> device (current cloud path)
431:     // - localBridge: Windows bridge polls Convex and talks to HCNetSDK on LAN
432:     hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
433:     hikLastSeenAt: v.optional(v.number()),
434:     hikOfflineHint: v.optional(v.string()),
435:     heartbeatCheckAt: v.optional(v.number()),
436:     heartbeatOfflineEventId: v.optional(v.id("deviceEvents")),
437:     // Eski kayıt-sonrası temizlik bayrağı; temizlik kaldırıldı (2026-10-28), artık okunmuyor.
438:     hikRosterReconcilePending: v.optional(v.boolean()),
439:     hikIsupOnline: v.optional(v.boolean()),
440:     hikIsupStatusAt: v.optional(v.number()),
441:     hikIsupOfflineSince: v.optional(v.number()),
442:     // En son işlenen event'in serialNo'su — sonraki event'in frontSerialNo'su ile karşılaştırılır.
443:     // Eşleşmezse aradaki event'ler düşmüş demektir (Phase 5.2'de AcsEvent backfill).
444:     hikLastSerialNo: v.optional(v.number()),
445:     // Cihazdaki fiziksel kapı sayısı (Door/capabilities). Person RightPlan'ı
446:     // 1..N kapı için entry üretmek zorunda — eksik kapı reddedilir.
447:     hikDoorCount: v.optional(v.number()),
448:     // localBridge: panelin SDK portu (default 8000). Panel kullanıcı/şifresi
449:     // deviceUsername/devicePassword alanlarında tutulur (tek-yer yönetim modeli).
450:     hikPort: v.optional(v.number()),
451:     hikLastRebootAt: v.optional(v.number()),
452:     // AcsEvent backfill: son işlenen event'in serialNo'su (canlı hikLastSerialNo'yu kirletmez).
453:     hikBackfillCursor: v.optional(v.number()),
454:     // AcsEvent backfill: son başarılı run'ın epoch ms zamanı.
455:     hikLastBackfillAt: v.optional(v.number()),
456:     // AcsEvent backfill: yarım kalan pencerenin devam kaydı; pencere bitince temizlenir (CIH-04).
457:     hikBackfillPending: v.optional(hikBackfillPendingValidator),
458:     hikWorkStatus: v.optional(
459:       v.object({
460:         updatedAt: v.number(),
461:         doorStatus: v.optional(v.array(v.number())),
462:         magneticStatus: v.optional(v.array(v.number())),
463:         cardReaderOnlineStatus: v.optional(v.array(v.number())),
464:         batteryVoltage: v.optional(v.number()),
465:         powerSupplyStatus: v.optional(v.string()),
466:         raw: v.optional(v.string()),
467:       })
468:     ),
469:     // Hikvision capability snapshot. Dynamic firmware/model response'lari string JSON
470:     // olarak saklanir; parsed summary action/UI tarafinda type guard ile okunur.
471:     hikCapabilitiesSnapshot: v.optional(v.string()),
472:     hikCapabilitiesUpdatedAt: v.optional(v.number()),
473:     apiToken: v.optional(v.string()),
474:     apiTokenCreatedAt: v.optional(v.string()),
475:     // adminDevices geri bağlantısı — claim ile oluşturulur, release ile temizlenir.
476:     adminDeviceId: v.optional(v.id("adminDevices")),
477:     createdAt: v.string(),
478:     updatedAt: v.string(),
479:   })
480:     .index("by_project", ["projectId"])
481:     .index("by_zone", ["zoneId"])
482:     .index("by_device_serial", ["deviceSerial"])
483:     .index("by_device_ip", ["deviceIp"])
484:     .index("by_hik_dev_index", ["hikDevIndex"])
485:     .index("by_ehome_id", ["ehomeID"])
486:     .index("by_api_token", ["apiToken"])
487:     .index("by_ide_uuid", ["ideUuid"])
488:     .index("by_admin_device", ["adminDeviceId"])
489:     .index("by_project_active", ["projectId", "isActive"])
490:     .index("by_active", ["isActive"]),
491: 
492:   /**
493:    * Bir LAN bridge kurulumunun kimliği. Tek-yer modelinde bridge EXE'ye yalnızca
494:    * bu token girilir; bridge bu token ile ait olduğu projedeki tüm localBridge
495:    * cihazlarını (IP/port/kullanıcı/şifre + bekleyen işler) /hik-bridge/roster'dan
496:    * çeker. Panel bilgileri artık bridge'de değil ngsplus'ta yönetilir.
497:    */
```

</details>

<details><summary>adminDevices — convex/schema.ts:1178</summary>

```ts
1178:   adminDevices: defineTable({
1179:     // IDE Smart paneller için SYSTEM.UUID; non-IDE cihazlarda kullanılmaz.
1180:     ideUuid: v.optional(v.string()),
1181:     // QR/Hikvision/diğer donanımlar için seri no.
1182:     deviceSerial: v.optional(v.string()),
1183:     name: v.string(),
1184:     brand: v.optional(
1185:       v.union(v.literal("ide_smart"), v.literal("hikvision"), v.literal("other"))
1186:     ),
1187:     ideUser: v.optional(v.string()),
1188:     idePassword: v.optional(v.string()),
1189:     ideHttpPort: v.optional(v.number()),
1190:     ideDoorCount: v.optional(v.number()),
1191:     lastSeen: v.optional(v.string()),
1192:     // devices.create/createIdePanel ile otomatik oluşturuldu; cihaz silinince bu da silinir.
1193:     createdFromDevice: v.optional(v.boolean()),
1194:     // Projeye atandığında set edilir; clear olunca havuza geri döner.
1195:     assignedDeviceId: v.optional(v.id("devices")),
1196:     assignedProjectId: v.optional(v.id("projects")),
1197:     createdAt: v.string(),
1198:     updatedAt: v.string(),
1199:   })
1200:     .index("by_ide_uuid", ["ideUuid"])
1201:     .index("by_device_serial", ["deviceSerial"])
1202:     .index("by_assigned_device", ["assignedDeviceId"]),
```

</details>

<details><summary>readers — convex/schema.ts:363</summary>

```ts
363:   readers: defineTable({
364:     // Sahip kapı (zorunlu). Cascade: kapı silinince okuyucuları da silinir.
365:     doorId: v.id("doors"),
366:     // door.deviceId denormalize — by_device sorgusu + readerStatus RBAC için.
367:     deviceId: v.optional(v.id("devices")),
368:     projectId: v.optional(v.id("projects")),
369:     zoneId: v.optional(v.id("zones")),
370:     name: v.string(),
371:     direction: v.union(v.literal("entry"), v.literal("exit"), v.literal("both")),
372:     // Hikvision fiziksel okuyucu index'i — kapı N için entry=2N-1, exit=2N.
373:     // Şu an sadece görsel/ileriye dönük; izin kapı bazlı olduğundan panele yazılmaz.
374:     hikReaderNo: v.optional(v.number()),
375:     hikVerifyMode: v.optional(v.string()),
376:     hikCardReaderName: v.optional(v.string()),
377:     hikCardReaderPlanTemplateNo: v.optional(v.number()),
378:     hikCardReaderAntiSneakEnabled: v.optional(v.boolean()),
379:     hikLastCfgSnapshot: v.optional(v.string()),
380:     hikLastCfgAt: v.optional(v.number()),
381:     // IDE Smart aktüatör index'i (door.ioId ile eşlenir) — son okuma çözümünde kullanılır.
382:     ioId: v.optional(v.number()),
383:     status: v.optional(v.string()), // "active" | "inactive"
384:     createdAt: v.string(),
385:     updatedAt: v.string(),
386:   })
387:     .index("by_door", ["doorId"])
388:     .index("by_device", ["deviceId"])
389:     .index("by_project", ["projectId"])
390:     .index("by_zone", ["zoneId"]),
```

</details>

<details><summary>doors — convex/schema.ts:304</summary>

```ts
304:   doors: defineTable({
305:     name: v.string(),
306:     projectId: v.optional(v.id("projects")),
307:     // Kapının bölgesi (mantıksal alan). Variant 1: panele bağlı kapılar panelin
308:     // bölgesini (device.zoneId) yansıtır; panel taşınınca eşitlenir.
309:     zoneId: v.optional(v.id("zones")),
310:     // Kapıyı kontrol eden fiziksel cihaz/panel (controller). IDE Smart panellerde
311:     // panel device'ı; tek-kapılı cihazlarda da bağlanabilir. Boşsa manuel kapı.
312:     deviceId: v.optional(v.id("devices")),
313:     location: v.optional(v.string()),
314:     doorCode: v.optional(v.string()),
315:     status: v.optional(v.string()),
316:     // IDE Smart aktüatör index'i (io_id 0–3). Diğer markalarda boş.
317:     ioId: v.optional(v.number()),
318:     // Kapıda fiziksel "kapı açıldı" sensörü var mı → panel ACTUATOR{ioId}.REQUIRE_SENSOR_ACTIVATION.
319:     // true = sensör onayı beklenir (1); false = pulse sensör beklemeden tamamlanır (0).
320:     // Boşsa panelin mevcut değerine dokunulmaz. Sensörsüz kapıda false yapılmazsa actuator "busy"de takılır.
321:     requireSensor: v.optional(v.boolean()),
322:     // Okuyucu (Wiegand giriş yüzü) — kapıyla 1:1. Boşsa UI door.name'den türetir.
323:     readerName: v.optional(v.string()),
324:     // Okuyucu yön etiketi (görsel). Boşsa ioId'den türetilir (0=entry,1=exit,diğer=both).
325:     readerDirection: v.optional(
326:       v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
327:     ),
328:     // Hikvision fiziksel kapı numarası (1..N). IDE Smart'ta boş (ioId kullanılır).
329:     // openDoor/setDoorParam ile tutarlı; boşsa 1 default.
330:     hikDoorNo: v.optional(v.number()),
331:     // Kapı durum planı (DoorStatusPlan) — mesai saatinde kapıyı otomatik açık/kapalı tutar.
332:     hikDoorStatusPlan: v.optional(doorStatusPlanValidator),
333:     // Doğrulama planı (VerifyWeekPlan) — saate göre doğrulama modunu değiştirir.
334:     hikVerifyPlan: v.optional(verifyPlanValidator),
335:     hikVerifyPlanSavedAt: v.optional(v.string()),
336:     hikVerifyPlanReaderNos: v.optional(v.array(v.number())),
337:     hikDoorHolidayPlan: v.optional(holidayPlanValidator),
338:     hikDoorHolidaySlots: v.optional(v.array(v.number())),
339:     hikPlanSavedAt: v.optional(v.string()),
340:     hikPlanRevision: v.optional(v.number()),
341:     hikPlanPendingReason: v.optional(v.string()),
342:     hikPlanAppliedAt: v.optional(v.string()),
343:     hikPlanApplyError: v.optional(v.string()),
344:     hikPlanResults: v.optional(v.object({
345:       status: v.optional(v.object({ revision: v.number(), appliedAt: v.optional(v.string()), error: v.optional(v.string()), failedAt: v.optional(v.string()) })),
346:       verify: v.optional(v.object({ revision: v.number(), appliedAt: v.optional(v.string()), error: v.optional(v.string()), failedAt: v.optional(v.string()) })),
347:     })),
348:     createdAt: v.optional(v.string()),
349:     updatedAt: v.optional(v.string()),
350:   })
351:     .index("by_project", ["projectId"])
352:     .index("by_zone", ["zoneId"])
353:     .index("by_device", ["deviceId"])
354:     .searchIndex("search_name", { searchField: "name", filterFields: ["projectId"] }),
355: 
356:   /**
357:    * Okuyucu (kart/yüz tarama yüzü) — kapıyla N:1. Bir kapı 1..2 okuyucu taşır
358:    * (giriş + çıkış). Önceden okuyucu doors.readerName/readerDirection ile 1:1
359:    * modelleniyordu; o alanlar legacy fallback olarak korunur, yeni kayıtlar bu
360:    * tabloya yazılır. İzin modeli kapı bazlı kalır — okuyucular panele gönderilmez
361:    * (Hik event'i okuyucu no taşımaz; hikReaderNo şimdilik görsel/ileriye dönük).
362:    */
```

</details>

<details><summary>hikBridges — convex/schema.ts:498</summary>

```ts
498:   hikBridges: defineTable({
499:     projectId: v.id("projects"),
500:     token: v.string(),
501:     name: v.optional(v.string()),
502:     lastSeenAt: v.optional(v.number()),
503:     /** Son roster çağrısının User-Agent'ı (köprü sürümü + makine adı; ≤200 karakter). */
504:     lastClientInfo: v.optional(v.string()),
505:     /** Planlanmış bir sonraki uyandırma zamanı (ms) — enqueue debounce'u (≤1 uyandırma / 2 sn). */
506:     nextWakeAt: v.optional(v.number()),
507:     createdAt: v.number(),
508:   })
509:     .index("by_token", ["token"])
510:     .index("by_project", ["projectId"]),
```

</details>

<details><summary>hikPendingOperations — convex/schema.ts:778</summary>

```ts
778:   hikPendingOperations: defineTable({
779:     projectId: v.optional(v.id("projects")),
780:     deviceId: v.id("devices"),
781:     operation: v.union(
782:       v.literal("addPerson"),
783:       v.literal("updatePerson"),
784:       v.literal("deletePerson"),
785:       v.literal("addCard"),
786:       v.literal("deleteCard"),
787:       v.literal("addFace"),
788:       v.literal("deleteFace"),
789:       v.literal("addFingerprint"),
790:       v.literal("deleteFingerprint"),
791:       v.literal("syncWeekPlan"),
792:       v.literal("syncHoliday"),
793:       v.literal("syncDoorParam"),
794:       v.literal("openDoor"),
795:       v.literal("rebootDevice"),
796:       v.literal("syncDoorStatusPlan"),
797:       v.literal("syncVerifyPlan"),
798:       // NOT: IDE Smart komutları Faz 1'de anlık (action) çalışır, kuyruğa girmez.
799:       // Faz 2'de offline retry kuyruğu eklenecekse buraya ide* op literal'leri +
800:       // worker case'leri + recordSyncFailure union'ı birlikte eklenmeli.
801:     ),
802:     /**
803:      * Operation-spesifik payload. Şekil:
804:      * - addPerson/updatePerson/deletePerson/addCard/deleteCard: { employeeId, cardNumber? }
805:      * - addFace/deleteFace: { employeeId, faceStorageId? }
806:      * - addFingerprint/deleteFingerprint: { employeeId, fingerPrintID }
807:      * - syncWeekPlan: { accessRuleId, weekPlanNo }
808:      * - syncHoliday: { holidayGroupNo, accessRuleId? }
809:      * - syncDoorParam: { doorNo, param: { openDuration?, magneticAlarmEnable? } }
810:      * - openDoor: { doorNo }
811:      */
812:     payload: v.any(),
813:     status: v.union(
814:       v.literal("pending"),
815:       v.literal("processing"),
816:       v.literal("done"),
817:       v.literal("failed"),
818:     ),
819:     attemptCount: v.number(),
820:     /** Bir sonraki retry için epoch ms. pending status için worker bu eşiği bekler. */
821:     nextRetryAt: v.optional(v.number()),
822:     /** localBridge claim zamanı. Stuck processing kayıtları bununla geri pending yapılır. */
823:     processingStartedAt: v.optional(v.number()),
824:     lastError: v.optional(v.string()),
825:     createdAt: v.number(),
826:     completedAt: v.optional(v.number()),
827:     /**
828:      * Bu op'u claim eden bridge. Aynı projede iki bridge token varsa, B bridge'i
829:      * A'nın claim ettiği op'u ack edemesin (cross-bridge çift-uygulama sinyali).
830:      * Stale-requeue bunu temizler; yeni claim yeniden damgalar.
831:      */
832:     claimedBy: v.optional(v.id("hikBridges")),
833:     /** Kullanıcı uyarıyı kapattı; operasyon sonucu (status) DEĞİŞMEZ. */
834:     dismissedAt: v.optional(v.number()),
835:     dismissedBy: v.optional(v.id("users")),
836:     /** Bu op'u üreten cihaz gönderim çalıştırması (deviceSyncRuns); eski op'larda yok. */
837:     runId: v.optional(v.id("deviceSyncRuns")),
838:   })
839:     .index("by_device_status", ["deviceId", "status"])
840:     .index("by_status_created", ["status", "createdAt"])
841:     .index("by_status_nextRetry", ["status", "nextRetryAt"])
842:     .index("by_project_status_created", ["projectId", "status", "createdAt"])
843:     .index("by_project_status_dismissed_created", ["projectId", "status", "dismissedAt", "createdAt"])
844:     .index("by_run_device", ["runId", "deviceId"]),
```

</details>

<details><summary>idePendingOperations — convex/schema.ts:858</summary>

```ts
858:   idePendingOperations: defineTable({
859:     projectId: v.optional(v.id("projects")),
860:     deviceId: v.id("devices"),
861:     opType: v.union(
862:       v.literal("openDoor"),
863:       v.literal("upsertUser"),
864:       v.literal("deleteUser"),
865:       v.literal("upsertPermission"),
866:       v.literal("deletePermission"),
867:       v.literal("triggerSync"),
868:       v.literal("parameterWrite"),
869:     ),
870:     /**
871:      * Bridge'in MQTT envelope üretmesi için materialize edilmiş alanlar.
872:      * Şekil (opType'a göre; hepsi bridge'in envelopeForOp'una geçer):
873:      * - openDoor:         { dstId, ioId, keep }
874:      * - upsertUser:       { dstId, mode:"create"|"update", userRecord:{id,start?,end?,status?,permissions?} }
875:      * - deleteUser:       { dstId, ideUserId }
876:      * - upsertPermission: { dstId, mode, permissionRecord:{id,io,schedule,...} }
877:      * - deletePermission: { dstId, ideId }
878:      * - triggerSync:      { dstId, reset }
879:      * - parameterWrite:   { dstId, parameterName, parameterRecord:{[name]:number|string} }
880:      */
881:     payload: v.any(),
882:     status: v.union(
883:       v.literal("pending"), // yazıldı, teslim girişimi yok
884:       v.literal("sent"), // bridge publish etti, panel ack bekleniyor
885:       v.literal("acked"), // panel result:"success" — terminal
886:       v.literal("failed"), // terminal hata (maxAttempts aşıldı / kalıcı red)
887:     ),
888:     /** Bridge'in ürettiği transaction msx-id — panel response correlation anahtarı. */
889:     msxId: v.optional(v.number()),
890:     /** (deviceId|opType|hedef) — aynı pending op'un çift insert'ini engeller. */
891:     idempotencyKey: v.string(),
892:     attempts: v.number(),
893:     maxAttempts: v.optional(v.number()),
894:     /** pending için: bridge bu eşikten önce çekmez (backoff). epoch ms. */
895:     nextRetryAt: v.optional(v.number()),
896:     /** "sent"e geçiş — ack timeout hesabı. epoch ms. */
897:     sentAt: v.optional(v.number()),
898:     lastError: v.optional(v.string()),
899:     responseMessage: v.optional(v.string()),
900:     createdAt: v.number(),
901:     ackedAt: v.optional(v.number()),
902:     /** Kullanıcı uyarıyı kapattı; operasyon sonucu (status) DEĞİŞMEZ. */
903:     dismissedAt: v.optional(v.number()),
904:     dismissedBy: v.optional(v.id("users")),
905:     /** Bu op'u üreten cihaz gönderim çalıştırması (deviceSyncRuns); eski op'larda yok. */
906:     runId: v.optional(v.id("deviceSyncRuns")),
907:   })
908:     .index("by_status_and_createdAt", ["status", "createdAt"])
909:     .index("by_device_status", ["deviceId", "status"])
910:     .index("by_status_nextRetry", ["status", "nextRetryAt"])
911:     .index("by_msx", ["deviceId", "msxId"])
912:     .index("by_idempotency", ["idempotencyKey"])
913:     .index("by_project_status_created", ["projectId", "status", "createdAt"])
914:     .index("by_project_status_dismissed_created", ["projectId", "status", "dismissedAt", "createdAt"])
915:     .index("by_run_device", ["runId", "deviceId"]),
916: 
917:   /** Cihazlara gönderim çalıştırması (proje geneli veya tek kural); hedef satırları deviceSyncRunTargets'ta. */
```

</details>

<details><summary>ideSequences — convex/schema.ts:847</summary>

```ts
847:   ideSequences: defineTable({
848:     name: v.literal("permissionNo"),
849:     last: v.number(),
850:   }).index("by_name", ["name"]),
851: 
852:   /**
853:    * IDE Smart bulut→panel komut kuyruğu. Convex serverless MQTT tutamaz; Hetzner'daki
854:    * ide-mqtt-bridge daemon bu kuyruğu /ide-bridge/poll ile çeker, broker'a publish eder,
855:    * panel response'unu msx-id ile /ide-bridge/ack'e bildirir.
856:    * (hikPendingOperations'ın MQTT eşdeğeri — ayrı tablo, op tipleri IDE'ye özgü.)
857:    */
```

</details>

<details><summary>deviceSyncRuns — convex/schema.ts:918</summary>

```ts
918:   deviceSyncRuns: defineTable({
919:     projectId: v.id("projects"),
920:     kind: v.union(v.literal("project_resync"), v.literal("rule_sync")),
921:     ruleId: v.optional(v.id("accessRules")),
922:     startedBy: v.id("users"),
923:     startedAt: v.number(),
924:     finishedAt: v.optional(v.number()),
925:     status: v.union(
926:       v.literal("running"),
927:       v.literal("done"),
928:       v.literal("partial"),
929:       v.literal("failed"),
930:     ),
931:     counts: v.object({
932:       queued: v.number(),
933:       sent: v.number(),
934:       verified: v.number(),
935:       failed: v.number(),
936:       skipped: v.number(),
937:       unknown: v.number(),
938:     }),
939:     dispatchFinished: v.optional(v.boolean()),
940:   })
941:     .index("by_status_and_finishedAt", ["status", "finishedAt"])
942:     .index("by_project_started", ["projectId", "startedAt"])
943:     .index("by_project_kind_startedAt", ["projectId", "kind", "startedAt"])
944:     .index("by_rule_started", ["ruleId", "startedAt"]),
945: 
946:   /** Çalıştırma başına hedef cihaz durumu (Hik done = sent; IDE acked = verified). */
```

</details>

<details><summary>deviceSyncRunTargets — convex/schema.ts:947</summary>

```ts
947:   deviceSyncRunTargets: defineTable({
948:     runId: v.id("deviceSyncRuns"),
949:     deviceId: v.id("devices"),
950:     deviceName: v.string(),
951:     brand: v.string(),
952:     status: v.union(
953:       v.literal("queued"),
954:       v.literal("sent"),
955:       v.literal("verified"),
956:       v.literal("failed"),
957:       v.literal("skipped"),
958:       v.literal("unknown"),
959:     ),
960:     reason: v.optional(v.string()),
961:     updatedAt: v.number(),
962:     /** Hedef action op üretimini tamamladı; watchdog yarım kalan dispatch'i verified saymaz. */
963:     dispatchFinished: v.optional(v.boolean()),
964:   })
965:     .index("by_run", ["runId"])
966:     .index("by_run_device", ["runId", "deviceId"]),
967: 
968:   /**
969:    * IDE Smart panelinde GERÇEKTE bulunan kullanıcıların (kart) takibi.
970:    * Convex panele doğrudan bağlanamadığı için "panelde kim var?" sorusunu okuyamayız;
971:    * bunun yerine başarılı upsertUser/deleteUser ack'lerini burada işleyerek panel
972:    * roster'ının yansımasını tutarız (markAck). Kural güncellemede (reconcilePanelRosterIde)
973:    * "panelde olan − yetkili" farkını silmek için kullanılır → O(çıkarılan), 1000 kullanıcıda
974:    * tüm roster'ı taramaz. ideUuid bazlı: panel yeniden-claim edilse (device _id değişse) bile
975:    * aynı fiziksel panelin roster'ı korunur. cardNumber normalize edilir: String(Number(x))
976:    * (panel id'si sayısal; "0008219041" → "8219041").
977:    */
```

</details>

<details><summary>idePanelUsers — convex/schema.ts:978</summary>

```ts
978:   idePanelUsers: defineTable({
979:     ideUuid: v.string(),
980:     deviceId: v.id("devices"),
981:     cardNumber: v.string(), // normalize: String(Number(employee.cardNumber))
982:     projectId: v.optional(v.id("projects")),
983:     syncedAt: v.number(),
984:     // true = ngsplus yazdı (upsert ack); false/undefined = panelden içeri alınmış/belirsiz → otomatik söküm yok.
985:     managedByNgsplus: v.optional(v.boolean()),
986:   })
987:     .index("by_uuid", ["ideUuid"])
988:     .index("by_uuid_card", ["ideUuid", "cardNumber"]),
```

</details>

<details><summary>cardReadings — convex/schema.ts:640</summary>

```ts
640:   cardReadings: defineTable({
641:     projectId: v.optional(v.id("projects")),
642:     deviceId: v.optional(v.id("devices")),
643:     employeeId: v.optional(v.id("employees")),
644:     cardNo: v.string(),
645:     employeeName: v.optional(v.string()),
646:     accessTime: v.string(),
647:     accessStatus: v.optional(
648:       v.union(v.literal("izin_verildi"), v.literal("reddedildi"))
649:     ),
650:     direction: v.optional(
651:       v.union(v.literal("entry"), v.literal("exit"))
652:     ),
653:     // IDE Smart panel: hangi aktüatör/kapıdan (io_id) okundu. Okuyucu-bazlı
654:     // canlı son-okuma için gerekli. deviceId panel cihazını tanımlar.
655:     ideIoId: v.optional(v.number()),
656:     rawData: v.optional(v.string()),
657:     // Hikvision event detayları (Device Gateway / ISAPI event push)
658:     hikMajorEventType: v.optional(v.number()),
659:     hikSubEventType: v.optional(v.number()),
660:     hikCurrentVerifyMode: v.optional(v.string()),
661:     hikCardReaderNo: v.optional(v.number()),
662:     hikSerialNo: v.optional(v.number()),
663:     hikFrontSerialNo: v.optional(v.number()),
664:     hikDevIndex: v.optional(v.string()),
665:     hikPictureURL: v.optional(v.string()),
666:     hikDateTime: v.optional(v.string()),
667:     hikMask: v.optional(v.string()),
668:     hikHelmet: v.optional(v.string()),
669:     hikTemperature: v.optional(v.number()),
670:     hikEventState: v.optional(v.string()),
671:     // Reddedildi ise spesifik neden (UI'da "Reddedildi (Yetki yok)" gibi).
672:     hikDenialReason: v.optional(v.string()),
673:     createdAt: v.optional(v.string()),
674:     updatedAt: v.optional(v.string()),
675:   })
676:     .index("by_project", ["projectId"])
677:     .index("by_device", ["deviceId"])
678:     .index("by_employee", ["employeeId"])
679:     .index("by_access_time", ["accessTime"])
680:     .index("by_project_access_time", ["projectId", "accessTime"])
681:     .index("by_device_access_time", ["deviceId", "accessTime"])
682:     .index("by_project_status_time", ["projectId", "accessStatus", "accessTime"])
683:     .index("by_status_time", ["accessStatus", "accessTime"])
684:     .index("by_employee_device_time", ["employeeId", "deviceId", "accessTime"])
685:     .index("by_employee_accessTime", ["employeeId", "accessTime"])
686:     .index("by_device_io_time", ["deviceId", "ideIoId", "accessTime"])
687:     .index("by_device_hik_serial", ["deviceId", "hikSerialNo"])
688:     .index("by_project_device_time", ["projectId", "deviceId", "accessTime"])
689:     .index("by_project_device_status_time", ["projectId", "deviceId", "accessStatus", "accessTime"])
690:     .index("by_project_device_employee_time", ["projectId", "deviceId", "employeeId", "accessTime"])
691:     .index("by_employee_status_time", ["employeeId", "accessStatus", "accessTime"])
692:     .index("by_project_employee_time", ["projectId", "employeeId", "accessTime"])
693:     .index("by_project_card_time", ["projectId", "cardNo", "accessTime"]),
```

</details>

<details><summary>deviceEvents — convex/schema.ts:697</summary>

```ts
697:   deviceEvents: defineTable({
698:     projectId: v.optional(v.id("projects")),
699:     deviceId: v.optional(v.id("devices")),
700:     source: v.union(
701:       v.literal("hikvision"),
702:       v.literal("ide_smart"),
703:       v.literal("system"),
704:     ),
705:     eventTime: v.string(),
706:     category: v.union(
707:       v.literal("access"),
708:       v.literal("alarm"),
709:       v.literal("exception"),
710:       v.literal("operation"),
711:       v.literal("status"),
712:       v.literal("unknown"),
713:     ),
714:     severity: v.union(
715:       v.literal("info"),
716:       v.literal("warning"),
717:       v.literal("critical"),
718:     ),
719:     label: v.string(),
720:     major: v.optional(v.number()),
721:     minor: v.optional(v.number()),
722:     cardNo: v.optional(v.string()),
723:     rawData: v.optional(v.string()),
724:     deviceSerial: v.optional(v.string()),
725:     deviceIp: v.optional(v.string()),
726:     hikDevIndex: v.optional(v.string()),
727:     hikEhomeID: v.optional(v.string()),
728:     hikSerialNo: v.optional(v.number()),
729:     hikFrontSerialNo: v.optional(v.number()),
730:     hikEventState: v.optional(v.string()),
731:     ideUuid: v.optional(v.string()),
732:     // Alarm merkezi: yönetici onayı (P1). category alarm/exception + severity warning/critical olaylar alarm sayılır.
733:     ackedAt: v.optional(v.string()),
734:     ackedBy: v.optional(v.id("users")),
735:     ackNote: v.optional(v.string()),
736:     // Eski kayıtlarda planlama damgası; yeni akışta yalnız servis kabulünden sonra yazılır.
737:     alarmNotifiedAt: v.optional(v.string()),
738:     // Yeni akışın debounce rezervasyonu gönderim sonucundan ayrıdır.
739:     alarmQueuedAt: v.optional(v.string()),
740:     resolvedAt: v.optional(v.string()),
741:     alarmEmailTest: v.optional(v.boolean()),
742:     alarmEmailStatus: v.optional(v.union(v.literal("queued"), v.literal("sending"), v.literal("retryScheduled"), v.literal("sent"), v.literal("failed"), v.literal("skipped"))),
743:     alarmEmailAttempts: v.optional(v.number()),
744:     alarmEmailAttemptAt: v.optional(v.string()),
745:     alarmEmailError: v.optional(v.string()),
746:     alarmEmailRetryAt: v.optional(v.string()),
747:     alarmEmailRecipients: v.optional(v.array(v.string())),
748:     alarmEmailContent: v.optional(v.object({ from: v.string(), subject: v.string(), html: v.string() })),
749:     createdAt: v.string(),
750:     updatedAt: v.string(),
751:   })
752:     .index("by_eventTime", ["eventTime"])
753:     .index("by_project", ["projectId"])
754:     .index("by_device", ["deviceId"])
755:     .index("by_project_and_event_time", ["projectId", "eventTime"])
756:     .index("by_project_category_event_time", ["projectId", "category", "eventTime"])
757:     .index("by_device_and_event_time", ["deviceId", "eventTime"])
758:     .index("by_device_category_label_alarmQueuedAt", ["deviceId", "category", "label", "alarmQueuedAt"])
759:     .index("by_device_category_label_alarmNotifiedAt", ["deviceId", "category", "label", "alarmNotifiedAt"])
760:     .index("by_device_category_label_event_time", ["deviceId", "category", "label", "eventTime"])
761:     .index("by_device_and_hik_serial", ["deviceId", "hikSerialNo"]),
```

</details>

<details><summary>deviceFingerprintEnrollments — convex/schema.ts:1328</summary>

```ts
1328:   deviceFingerprintEnrollments: defineTable({
1329:     employeeId: v.id("employees"),
1330:     deviceId: v.id("devices"),
1331:     projectId: v.optional(v.id("projects")),
1332:     fingerNo: v.number(),
1333:     enrolledAt: v.string(),
1334:     enrolledBy: v.id("users"),
1335:     deletionEmployeeNo: v.optional(v.string()),
1336:     deletionRequestedAt: v.optional(v.number()),
1337:     enrolledEmployeeNo: v.optional(v.string()),
1338:     // Short-lived command state makes cancellation server-visible; no biometric data.
1339:     attemptId: v.optional(v.string()),
1340:     pendingUntil: v.optional(v.number()),
1341:     cancelRequested: v.optional(v.boolean()),
1342:   })
1343:     .index("by_employee", ["employeeId"])
1344:     .index("by_device", ["deviceId"])
1345:     .index("by_employee_device_finger", ["employeeId", "deviceId", "fingerNo"])
1346:     .index("by_device_pendingUntil", ["deviceId", "pendingUntil"]),
```

</details>

<details><summary>employeeFaces — convex/schema.ts:993</summary>

```ts
993:   employeeFaces: defineTable({
994:     employeeId: v.id("employees"),
995:     projectId: v.optional(v.id("projects")),
996:     pictureStorageId: v.id("_storage"),
997:     addedAt: v.number(),
998:   })
999:     .index("by_employee", ["employeeId"])
1000:     .index("by_project", ["projectId"]),
```

</details>

<details><summary>employeeFingerprints — convex/schema.ts:1004</summary>

```ts
1004:   employeeFingerprints: defineTable({
1005:     employeeId: v.id("employees"),
1006:     projectId: v.optional(v.id("projects")),
1007:     fingerPrintID: v.number(), // 1-10
1008:     encData: v.string(),
1009:     iv: v.string(),
1010:     keyVersion: v.string(),
1011:     sourceDeviceId: v.optional(v.id("devices")),
1012:     enrolledBy: v.optional(v.id("users")),
1013:     fingerType: v.optional(v.string()), // "normalFP" | "duressFP" | ...
1014:     addedAt: v.number(),
1015:   })
1016:     .index("by_employee", ["employeeId"])
1017:     .index("by_employee_fingerprint", ["employeeId", "fingerPrintID"])
1018:     .index("by_project", ["projectId"]),
```

</details>

<details><summary>accessTransfers — convex/schema.ts:513</summary>

```ts
513:   accessTransfers: defineTable({
514:     kind: v.union(v.literal("employee"), v.literal("ide_panel")),
515:     status: v.union(v.literal("requested"), v.literal("revoking"), v.literal("revoked"), v.literal("provisioning"), v.literal("done"), v.literal("stuck"), v.literal("cancelled")),
516:     sourceProjectId: v.id("projects"), targetProjectId: v.id("projects"),
517:     employeeId: v.id("employees"), targetEmployeeId: v.id("employees"), cardNumber: v.string(),
518:     targetPlan: v.object({ accessRuleIds: v.array(v.id("accessRules")), departmentId: v.optional(v.id("departments")) }),
519:     // İptalde A'nın silinen üyeliklerini aynı transaction içinde geri kurmak için.
520:     sourceAccessRuleIds: v.array(v.id("accessRules")),
521:     requestedBy: v.id("users"), requestedAt: v.number(), deadlineAt: v.number(),
522:     completedAt: v.optional(v.number()), stuckReason: v.optional(v.string()), lastError: v.optional(v.string()),
523:   }).index("by_status_deadline", ["status", "deadlineAt"])
524:     .index("by_employee_status", ["employeeId", "status"])
525:     .index("by_target_employee_status", ["targetEmployeeId", "status"])
526:     .index("by_source_project_requested_at", ["sourceProjectId", "requestedAt"]),
```

</details>

<details><summary>accessTransferTargets — convex/schema.ts:528</summary>

```ts
528:   accessTransferTargets: defineTable({
529:     transferId: v.id("accessTransfers"), employeeId: v.id("employees"), deviceId: v.id("devices"),
530:     brand: v.union(v.literal("hikvision"), v.literal("ide_smart")),
531:     state: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed"), v.literal("superseded"), v.literal("deviceRemoved")),
532:     lastError: v.optional(v.string()), confirmedAt: v.optional(v.number()), updatedAt: v.number(),
533:   }).index("by_transfer_state", ["transferId", "state"])
534:     .index("by_device_state", ["deviceId", "state"])
535:     .index("by_employee_device", ["employeeId", "deviceId"]),
```

</details>

## Makine listesi

| # | Varlık | Saklama | Durumlar | Zorlama yeri | Bulgu sayısı |
|---|---|---|---|---|---|
| 1 | Cihaz etkinliği | devices.status/isActive; convex/schema.ts:392 | active/inactive; legacy online/offline; undefined | mutation normalizasyonu; schema string/boolean | 0 |
| 2 | Cihaz bağlantısı ve ISUP | devices.lastSeen/hikLastSeenAt/hikOfflineHint/hikIsupOnline/hikIsupStatusAt/hikIsupOfflineSince/heartbeatCheckAt/heartbeatOfflineEventId; convex/schema.ts:392 | never/online/offline; zamanlayıcı bekliyor/alarm açık/çözüldü | mutation zaman ve sahiplik kontrolü; türetilen saf fonksiyon | 0 |
| 3 | Provizyon ve havuz rezervasyonu | adminDevices.assignedDeviceId/assignedProjectId/createdFromDevice + devices.adminDeviceId; convex/schema.ts:1178 | boş/rezerveli/atanmış/serbest/silinmiş | mutation ön-kontrolü; index unique değildir | 0 |
| 4 | Kapı ve okuyucu etkinliği | doors.status, readers.status/direction; convex/schema.ts:304,363 | active/inactive; entry/exit/both; serbest string status | direction schema validator; status serbest string | 1 |
| 5 | Kapı durum/doğrulama/tatil planı | doors.hikDoorStatusPlan/hikVerifyPlan/hikDoorHolidayPlan + hikPlanRevision/SavedAt/AppliedAt/Results/PendingReason/ApplyError; convex/schema.ts:335 | enabled/disabled; remainOpen/normal/remainClosed; kaydedildi/bekliyor/uygulandı/hata/eski revizyon | schema plan enumları; mutation normalizasyonu ve revizyon kontrolü | 0 |
| 6 | Okuyucu ve fiziksel iş durumu anlık görüntüsü | readers.hikVerifyMode/hikCardReaderAntiSneakEnabled/hikLastCfgAt; devices.hikWorkStatus; convex/schema.ts:377,461 | cihazdan gelen mod/string/doorStatus/magneticStatus/cardReaderOnlineStatus | snapshot shape schema; ham değer enum zorlaması yok | 0 |
| 7 | Hik bridge kimliği ve uyandırma | hikBridges.token/lastSeenAt/lastClientInfo/nextWakeAt; convex/schema.ts:498 | kayıtlı/uyandırma planlı/iptal; hiç görülmedi/görüldü | mutation yetki kontrolü; nextWakeAt debounce | 1 |
| 8 | Hik işlem kuyruğu | hikPendingOperations.status/operation/attemptCount/processingStartedAt/nextRetryAt/completedAt/claimedBy; convex/schema.ts:778 | pending/processing/done/failed; 17 operation türü | schema enum + claim/ACK mutation kontrolleri; deneme kimliği yok | 1 |
| 9 | IDE işlem kuyruğu ve MQTT | idePendingOperations.status/opType/msxId/attempts/maxAttempts/nextRetryAt/sentAt/ackedAt; convex/schema.ts:858 | pending/sent/acked/failed; openDoor/upsertUser/deleteUser/upsertPermission/deletePermission/triggerSync/parameterWrite | schema enum; mutation ön-kontrolü; normal ACK msxId opsiyonel | 1 |
| 10 | IDE izin numarası sayacı | ideSequences.name/last; convex/schema.ts:847 | yok/başlatılmış/monoton artan | schema name literal; mutation transaction içinde max+artırım | 0 |
| 11 | IDE panel roster sahipliği | idePanelUsers.managedByNgsplus/syncedAt/deviceId/ideUuid; convex/schema.ts:978 | yok/ithal-belirsiz/yönetilen/silinmiş | mutation upsertPanelUser; schema boolean | 0 |
| 12 | Senkron çalıştırması | deviceSyncRuns.kind/status/counts/dispatchFinished/finishedAt; convex/schema.ts:918 | running/done/partial/failed; project_resync/rule_sync | schema enum; mutation summarizeRun | 0 |
| 13 | Senkron cihaz hedefi | deviceSyncRunTargets.status/dispatchFinished/reason/updatedAt; convex/schema.ts:947 | queued/sent/verified/failed/skipped/unknown | schema enum; mutation queued kontrolü | 0 |
| 14 | Senkron sorun görünürlüğü | hikPendingOperations/idePendingOperations.dismissedAt/dismissedBy + failed; schema.ts:834,905 | açık hata/kapatılmış hata/retry bekliyor; upToDate/unknown | mutation failed kontrolü; yalnız UI değil | 0 |
| 15 | Kart işleme ve olay sınıflama | cardReadings.accessStatus/direction/hikEventState/hikSerialNo; deviceEvents.source/category/severity/resolvedAt; schema.ts:640,697 | izin_verildi/reddedildi; entry/exit; olay açık/çözülmüş; access/alarm/exception/operation/status/unknown | schema enum + process mutation; processed alanı yok | 0 |
| 16 | Backfill ve gateway reconcile | devices.hikLastSerialNo/hikBackfillCursor/hikLastBackfillAt/hikBackfillPending; schema.ts:445,456 | yok/arama açık/sayfa ilerliyor/hata-yeniden başlat/tamamlandı; roster beklenen/mevcut/fark | mutation compare-and-set; schema nested validator | 0 |
| 17 | Sanal okuyucu ve kiosk | devices.deviceType/isActive/apiToken/lastSeen; schema.ts:392; src/components/virtual-reader/readerKiosk.ts | reader_invalid/denied/granted; bağlantı/tarama/hata UI evreleri | mutation token/aktiflik kontrolü + dönüş validatorı; UI yerel evre | 0 |
| 18 | Parmak izi enrollment ve silme | deviceFingerprintEnrollments.enrolledAt/attemptId/pendingUntil/cancelRequested/deletionRequestedAt/deletionEmployeeNo/enrolledEmployeeNo; schema.ts:1328 | boş/kayıt bekliyor/iptal istendi/kayıtlı/silme bekliyor/silinmiş | mutation attempt eşitliği + süre; schema alan kombinasyonunu zorlamaz | 0 |
| 19 | Biyometrik şablon ve cihaza yazım | employeeFaces.pictureStorageId/addedAt; employeeFingerprints.encData/iv/keyVersion/addedAt; schema.ts:993,1004 | yok/kayıtlı/değişti/silindi; cihaz pending/failed/done kuyruktan | mutation modül/rıza/kimlik kapıları; teslim queue enumu | 0 |
| 20 | Biyometrik imha işi | auditLog.newValue (targetTable biometricDestructionRun); convex/lib/biometricDestruction.ts:60 | running/waitingDevices/completed/failed; phase face/fingerprint; scan project/legacy | Zod parse + mutation batch/status kontrolü; auditLog DB validatorı bu shapei zorlamaz | 0 |
| 21 | Mobil kapı açma ve istemci kurtarma | mobileAccessOperations.status/transport/requestId/authVersion; schema.ts:227; mobil store | pending/sent/confirmed/failed/unknown; ide_mqtt/hik_local_bridge/hik_gateway; istemcide unresolved | schema enum + mutation kimlik/süre/oturum kontrolü; DTO türetme | 1 |
| 22 | Proje erişim taşıması ve hedefleri | accessTransfers.status/kind/deadlineAt; accessTransferTargets.state/confirmedAt; schema.ts:513,528 | requested/revoking/revoked/provisioning/done/stuck/cancelled; pending/confirmed/failed/superseded/deviceRemoved | schema enum; mutation ön-durum ve tüm hedef onayı | 1 |
| 23 | Köprü runtime ve olay spool kuyruğu | infra/hik-event-bridge/queue.mjs dosyaları; bridge/windows/.../Services/PanelWorker.cs:27,33; relay SSE bağlantıları | queued/inflight/retry/delivered/dropped; stopped/connecting/connected/error; SSE bağlı/kopuk | yerel kod; DB zorlaması yok | 2 |
| 24 | Saklama ve temizleme zinciri | scheduler args stage/batch/runAt/cursor; convex/privacyRetention.ts:195; cardReadings ve operasyon createdAt | operations/events/access grupları; aşama/sayfa/devam/bitti/bütçe doldu | mutation valid/stageGroup/20 çağrı sınırı; kalıcı job enumu yok | 1 |
| 25 | Cihazdan kişi içe aktarma | convex/lib/hikDeviceImport.ts:27; React yerel preview/busy/confirmation | new/matched/conflict/manual; preview/import/null; onay bekliyor | sınıflama fonksiyonu + mutation yeniden sınıflama; UI busy kilidi | 0 |

## Makineler

Her makinenin özet geçiş tablosu aşağıdadır; yazan yolların tam çağrı/satır dökümü bölüm sonundaki ortak envanterdedir. `→ yok` silmeyi, DTO okuma sırasında hesaplanan değeri, ACK cihaz/taşıma yanıtını anlatır. Tabloda toplu verilen yollar aynı makinenin alternatif giriş noktalarıdır. Okuyan kopyalar web/mobil yoksa açıkça belirtilmiştir; genel dosya referanslarının satırları ortak okuyucu envanterinde bulunur.

### 1. Cihaz etkinliği

**Saklama:** devices.status/isActive; convex/schema.ts:392. **Durumlar:** active/inactive; legacy online/offline; undefined.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → active/inactive; active ↔ inactive | convex/lib/deviceProvision.ts:149,218,320; convex/devices.ts:165,288; convex/lib/devicePool.ts:43 | mutation normalizasyonu; schema string/boolean |

**Okuyan kopyalar:** src/components/devices/form-sections/DeviceStatusSection.tsx; src/components/devices/hooks/deviceUpdatePatch.ts; convex/lib/mobileAccess.ts:131.

Yeni cihazda deviceActive normalizasyonu; update yetki kontrolü. status bir enum değildir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 2. Cihaz bağlantısı ve ISUP

**Saklama:** devices.lastSeen/hikLastSeenAt/hikOfflineHint/hikIsupOnline/hikIsupStatusAt/hikIsupOfflineSince/heartbeatCheckAt/heartbeatOfflineEventId; convex/schema.ts:392. **Durumlar:** never/online/offline; zamanlayıcı bekliyor/alarm açık/çözüldü.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| never/offline → online (sinyal); online → offline (5 dk veya ISUP); offline → online (çözülme) | convex/devices.ts:356,543,994,1070,1120; convex/lib/deviceConnection.ts:47,92,104 | mutation zaman ve sahiplik kontrolü; türetilen saf fonksiyon |

**Okuyan kopyalar:** src/lib/deviceStatus.ts:21; src/components/admin/AdminDevicesPanel.tsx:103; src/components/devices/hooks/deviceConnectionBadge.ts.

ISUP 2.5 saat taze; 120 sn gelecek toleransı; eski at reddedilir. Heartbeat checkAt eşitliği eski timerı eler.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 3. Provizyon ve havuz rezervasyonu

**Saklama:** adminDevices.assignedDeviceId/assignedProjectId/createdFromDevice + devices.adminDeviceId; convex/schema.ts:1178. **Durumlar:** boş/rezerveli/atanmış/serbest/silinmiş.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| boş → rezerveli → atanmış; atanmış → serbest veya silinmiş; atanmış → başka proje | convex/adminDevices.ts:78,123,151,206,222; convex/lib/deviceAssignment.ts:45,105,204; convex/lib/devicePool.ts:14; convex/devices.ts:321 | mutation ön-kontrolü; index unique değildir |

**Okuyan kopyalar:** src/components/admin/AdminDevicesPanel.tsx:115; src/components/admin/AdminDeviceDialog.tsx; src/components/devices/ClaimDeviceDialog.tsx.

Kimlik/proje ve mevcut atama kontrolleri mutation içindedir. Yalnız assignedProjectId rezervasyonu ifade edebilir; tek başına çelişki değildir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 4. Kapı ve okuyucu etkinliği

**Saklama:** doors.status, readers.status/direction; convex/schema.ts:304,363. **Durumlar:** active/inactive; entry/exit/both; serbest string status.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → active; her status → kullanıcı string değeri; direction değişimi | convex/doors.ts:165,258,230,247; convex/readers.ts:61,109,164,183,249,283; convex/lib/devicePool.ts | direction schema validator; status serbest string |

**Okuyan kopyalar:** src/components/access-control/EditDoorDialog.tsx; src/components/access-control/EditReaderDialog.tsx; convex/lib/mobileAccess.ts:132.

Yetki/topoloji kontrolü var; status değer kümesi kontrolü yok. A-06.

**Bulgular:** A-06

### 5. Kapı durum/doğrulama/tatil planı

**Saklama:** doors.hikDoorStatusPlan/hikVerifyPlan/hikDoorHolidayPlan + hikPlanRevision/SavedAt/AppliedAt/Results/PendingReason/ApplyError; convex/schema.ts:335. **Durumlar:** enabled/disabled; remainOpen/normal/remainClosed; kaydedildi/bekliyor/uygulandı/hata/eski revizyon.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| değişiklik → revision+1/bekliyor; gönderim → appliedAt veya error; eski yanıt → yeniden gönderin | convex/doors.ts:258,597,689,736,771; convex/doorPlanInvalidation.ts:19; convex/lib/gatewayCommand.ts:688,712,834 | schema plan enumları; mutation normalizasyonu ve revizyon kontrolü |

**Okuyan kopyalar:** src/components/access-control/doorPlanResult.ts; src/components/access-control/door-plans/DoorPlansTab.tsx; src/components/access-control/door-dialog/DoorSaveResults.tsx.

recordPlanResult eski revizyonu başarı saymaz. Fiziksel ISAPI çağrıları DB transaction dışındadır; iki gönderimin cihazda atomik/sıralı olacağı kanıtlanmadı (şüpheli, doğrulanmadı; sayılan bulgu değil).

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 6. Okuyucu ve fiziksel iş durumu anlık görüntüsü

**Saklama:** readers.hikVerifyMode/hikCardReaderAntiSneakEnabled/hikLastCfgAt; devices.hikWorkStatus; convex/schema.ts:377,461. **Durumlar:** cihazdan gelen mod/string/doorStatus/magneticStatus/cardReaderOnlineStatus.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| bilinmiyor → snapshot; snapshot → yeni snapshot | convex/readers.ts:197,208; convex/devices.ts:813; convex/lib/gatewayCommand.ts | snapshot shape schema; ham değer enum zorlaması yok |

**Okuyan kopyalar:** src/components/devices/DeviceDetailsPanel.tsx; src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx.

Bu alanlar komut teslim kanıtından ayrıdır; kapının fiziksel açık/kapalı durumunu sırf openDoor ACK ile doğrulamıyor.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 7. Hik bridge kimliği ve uyandırma

**Saklama:** hikBridges.token/lastSeenAt/lastClientInfo/nextWakeAt; convex/schema.ts:498. **Durumlar:** kayıtlı/uyandırma planlı/iptal; hiç görülmedi/görüldü.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → kayıtlı; kayıtlı → planlı; kayıtlı → silinmiş | convex/hikBridge.ts:22,29,38,73; convex/actions/hikBridgeWake.ts:8 | mutation yetki kontrolü; nextWakeAt debounce |

**Okuyan kopyalar:** src/components/settings/sections/integrations/BridgeIntegrationCard.tsx.

Son görülme yazarı bulunamadı. Aktif /poll kimliği cihaz tokenıdır; bridge token protokolüyle eşleşmez. A-02, A-08.

**Bulgular:** A-08

### 8. Hik işlem kuyruğu

**Saklama:** hikPendingOperations.status/operation/attemptCount/processingStartedAt/nextRetryAt/completedAt/claimedBy; convex/schema.ts:778. **Durumlar:** pending/processing/done/failed; 17 operation türü.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → pending veya failed; pending → processing; processing → done/failed; processing → pending (stale); failed → pending/processing/done | convex/hikvisionSync.ts:373,412,440,546,664,709,806,918,931,950,1015,1047,1115,1188; convex/doors.ts:799; convex/biometricDestruction.ts:225,256; convex/lib/accessTransfer.ts:73 | schema enum + claim/ACK mutation kontrolleri; deneme kimliği yok |
| pending → processing | convex/hikvisionSync.ts:621 | due/cihaz/transfer/biyometri kontrolü; claim atomik |
| processing → done/failed | convex/hikvisionSync.ts:683,691,701 | processing kontrolü; deneme kimliği yok (A-03) |
| processing → pending/failed | convex/hikvisionSync.ts:709,733 | stale süre; mobil komutta failed |
| failed → processing | convex/hikvisionSync.ts:912 | transfer addition rezervasyonu |
| failed/pending/processing → pending | convex/hikvisionSync.ts:461,477 | dedupe anahtarı; eski claim geçersizliği tokenla korunmuyor |
| failed → pending/failed | convex/hikvisionSync.ts:1115,1137,1142 | yetki/failed kontrolü; transporta göre retry |

**Okuyan kopyalar:** src/components/access-control/unified/SyncRuns.tsx:55; src/lib/syncErrorMessages.ts; convex/mobileAccess.ts:37.

ACK yalnız processing ve cihaz eşleşmesi arar; opId sabit, attempt token yok. OpenDoor otomatik tekrarında özel sınırlamalar var. A-03.

**Bulgular:** A-03

### 9. IDE işlem kuyruğu ve MQTT

**Saklama:** idePendingOperations.status/opType/msxId/attempts/maxAttempts/nextRetryAt/sentAt/ackedAt; convex/schema.ts:858. **Durumlar:** pending/sent/acked/failed; openDoor/upsertUser/deleteUser/upsertPermission/deletePermission/triggerSync/parameterWrite.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → pending/failed; pending → sent; sent → acked/failed/pending; failed → pending (manuel); failed → acked (devirde geç silme kanıtı) | convex/ideSync.ts:293,369,433,487,530,587,722,953; convex/lib/accessTransfer.ts:76 | schema enum; mutation ön-kontrolü; normal ACK msxId opsiyonel |
| pending → sent | convex/ideSync.ts:487,522,530,552 | poll rezervasyonu veya markSent; aktif teslim/TTL |
| sent → acked | convex/ideSync.ts:603,613,622 | sent kontrolü var; msx opsiyonel |
| sent → pending | convex/ideSync.ts:664,708,742 | already_exists mode update veya retry bütçesi |
| sent → failed | convex/ideSync.ts:703,738 | attempts/maxAttempts; openDoor tek deneme |
| failed → acked | convex/ideSync.ts:600 | yalnız aktif devir deleteUser + tam msx geç başarı |
| failed → pending | convex/ideSync.ts:953,969 | yetki ve failed ön-kontrolü |

**Okuyan kopyalar:** src/components/access-control/unified/SyncRuns.tsx:55; convex/mobileAccess.ts:31; infra/mqtt/RUNBOOK.md.

/ide-bridge/poll → pollForBridge; /sent → markSent; /ack → markAck. already_exists create→update yeniden denemesi; not_found silmede başarı. MQTT daemon kaynağı infra/mqtt altında yok; runtime davranışı doğrulanmadı. A-04.

**Bulgular:** A-04

### 10. IDE izin numarası sayacı

**Saklama:** ideSequences.name/last; convex/schema.ts:847. **Durumlar:** yok/başlatılmış/monoton artan.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → sayaç; last → last+count | convex/ideSync.ts:769,792,800 | schema name literal; mutation transaction içinde max+artırım |

**Okuyan kopyalar:** convex/ideSync.ts:812,821; web/mobil sayaç okumuyor.

Emekli slotlar dahil numara tekrar kullanılmıyor; index fiziksel unique constraint değildir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 11. IDE panel roster sahipliği

**Saklama:** idePanelUsers.managedByNgsplus/syncedAt/deviceId/ideUuid; convex/schema.ts:978. **Durumlar:** yok/ithal-belirsiz/yönetilen/silinmiş.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → ithal (seed); yok/ithal → yönetilen (create ACK); yönetilen → güncel; delete ACK → yok | convex/ideSync.ts:185,195,197,569,620,682; convex/actions/ideGatewayDevice.ts | mutation upsertPanelUser; schema boolean |

**Okuyan kopyalar:** convex/ideSync.ts roster reconcile; convex/lib/accessTransfer.ts:30; web/mobil doğrudan sahiplik enumu yok.

seed mevcut sahipliği korur; update ACK tek başına ngsplus oluşturdu kanıtı değildir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 12. Senkron çalıştırması

**Saklama:** deviceSyncRuns.kind/status/counts/dispatchFinished/finishedAt; convex/schema.ts:918. **Durumlar:** running/done/partial/failed; project_resync/rule_sync.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → running; running → done/partial/failed; sonuç counts ile türetilir | convex/deviceSyncRuns.ts:24,74,324,347,353,440,644 | schema enum; mutation summarizeRun |

**Okuyan kopyalar:** src/components/access-control/unified/SyncRuns.tsx:72; src/components/access-control/unified/status/RunNotice.tsx.

Hik done→sent, IDE acked→verified; sent etiketi teslim kanıtı yok der. 10 dk watchdog unknown sonuç üretir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 13. Senkron cihaz hedefi

**Saklama:** deviceSyncRunTargets.status/dispatchFinished/reason/updatedAt; convex/schema.ts:947. **Durumlar:** queued/sent/verified/failed/skipped/unknown.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → queued/skipped; queued → sent/verified/failed/unknown; dispatch bitmeden başarı yok | convex/deviceSyncRuns.ts:37,101,324,458,662 | schema enum; mutation queued kontrolü |

**Okuyan kopyalar:** src/components/access-control/unified/SyncRuns.tsx:55; convex/lib/deviceSyncRun.ts:12,39.

Hedef terminali geçmiş çalıştırmanın kanıtıdır, sonraki retry eski hedefi yeniden yazmaz; bu davranış hata diye sayılmadı.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 14. Senkron sorun görünürlüğü

**Saklama:** hikPendingOperations/idePendingOperations.dismissedAt/dismissedBy + failed; schema.ts:834,905. **Durumlar:** açık hata/kapatılmış hata/retry bekliyor; upToDate/unknown.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| failed açık → dismissed; failed → retry (dismiss temizlenir); özet unknown/inFlight/failed | convex/hikvisionSync.ts:778,1047,1089,1115; convex/ideSync.ts:913,927,953; convex/lib/syncStatusLogic.ts:60 | mutation failed kontrolü; yalnız UI değil |

**Okuyan kopyalar:** src/lib/syncErrorMessages.ts:63; src/components/access-control/unified/status; convex/lib/syncStatusLogic.ts:1.

dismiss durum değiştirmez; kapatılmış failure da failed sayılır. syncErrors ortak backend kaynağından yeniden export edilir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 15. Kart işleme ve olay sınıflama

**Saklama:** cardReadings.accessStatus/direction/hikEventState/hikSerialNo; deviceEvents.source/category/severity/resolvedAt; schema.ts:640,697. **Durumlar:** izin_verildi/reddedildi; entry/exit; olay açık/çözülmüş; access/alarm/exception/operation/status/unknown.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| girdi → duplicate iade veya granted/denied insert; exception → resolvedAt | convex/lib/processCardReadingCore.ts:174,237,297,353,356,377,396,426,453; convex/deviceEvents.ts; convex/lib/deviceConnection.ts:62,71,76,128; convex/devices.ts:1093,1129 | schema enum + process mutation; processed alanı yok |

**Okuyan kopyalar:** src/components/access-control/CardReadingsTable.tsx; src/components/access-control/CardReadingsFilters.tsx; convex/lib/lateReading.ts:18.

Hik serial dedup içerikle doğrulanır. QR usedAt ile atomik tüketilir. notifyLateReading ilk uygun entry için aynı transactionda scheduler kaydı açar; vardiya hesabı Alan B.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 16. Backfill ve gateway reconcile

**Saklama:** devices.hikLastSerialNo/hikBackfillCursor/hikLastBackfillAt/hikBackfillPending; schema.ts:445,456. **Durumlar:** yok/arama açık/sayfa ilerliyor/hata-yeniden başlat/tamamlandı; roster beklenen/mevcut/fark.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → pending; position artar; failCount artar/restart searchID değişir; tamamlanma → pending yok | convex/devices.ts:860,885; convex/lib/processCardReadingCore.ts:234; convex/lib/gatewayBackfill.ts:224,260,291,347; convex/lib/gatewayReconcile.ts:98 | mutation compare-and-set; schema nested validator |

**Okuyan kopyalar:** src/components/devices/DeviceHistoryImportCard.tsx; src/components/devices/deviceImportView.ts.

expectedSearchID/position/failCount kontrolleri eski actionın cursor geri almasını engeller. Reconcile ayrı kalıcı phase tutmaz; farkı action içinde hesaplar.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 17. Sanal okuyucu ve kiosk

**Saklama:** devices.deviceType/isActive/apiToken/lastSeen; schema.ts:392; src/components/virtual-reader/readerKiosk.ts. **Durumlar:** reader_invalid/denied/granted; bağlantı/tarama/hata UI evreleri.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → sanal cihaz; token → connect; scan → granted/denied/reader_invalid | convex/virtualReaders.ts:14,43,68,94; convex/lib/processCardReadingCore.ts:353 | mutation token/aktiflik kontrolü + dönüş validatorı; UI yerel evre |

**Okuyan kopyalar:** src/pages/VirtualReaderKiosk.tsx; src/components/virtual-reader/readerKiosk.ts; src/components/virtual-reader/useQrCamera.ts.

Fiziksel kapı açmaz; connect heartbeat ve scan sonucu ayrı. Mobil genericReaderTokenAllowed bunu açıkça ayırır.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 18. Parmak izi enrollment ve silme

**Saklama:** deviceFingerprintEnrollments.enrolledAt/attemptId/pendingUntil/cancelRequested/deletionRequestedAt/deletionEmployeeNo/enrolledEmployeeNo; schema.ts:1328. **Durumlar:** boş/kayıt bekliyor/iptal istendi/kayıtlı/silme bekliyor/silinmiş.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| boş/kayıtlı → attempt; attempt → iptal/kayıtlı/temizlenmiş; silme isteği → delete op; onay → satır yok | convex/fingerprintEnrollment.ts:120,144,177,190,212,213,260,278,295,314,327; convex/actions/hikFingerprint.ts:32 | mutation attempt eşitliği + süre; schema alan kombinasyonunu zorlamaz |
| boş/kayıtlı → pending attempt | convex/fingerprintEnrollment.ts:120,138 | hedef/yetki/aktif girişim/slot kontrolü |
| attempt → cancelRequested | convex/fingerprintEnrollment.ts:144,151 | attemptId eşitliği |
| attempt → enrolled | convex/fingerprintEnrollment.ts:177,184 | girişim ve kişi kimliği kontrolü |
| attempt → önceki kayıt/yok | convex/fingerprintEnrollment.ts:190,197 | matching attempt; eski sonuç temizleyemez |
| pending push → silme bekliyor | convex/fingerprintEnrollment.ts:314,320 | hedef/kimlik cleanup |
| silme bekliyor → yok | convex/fingerprintEnrollment.ts:212; convex/actions/hikFingerprint.ts:83 | silme ACK sonrası; günlük stale purge retry |

**Okuyan kopyalar:** src/components/employees/EmployeeFingerprintCard.tsx:35,104; src/components/employees/table/EmployeeBiometricsCell.tsx.

attemptId eski capture/push sonucunu eler; pendingUntil süresince eşzamanlı işlem engeli. enrolledAt boş string bekleyen yeni kaydı anlatır, tek başına başarı değildir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 19. Biyometrik şablon ve cihaza yazım

**Saklama:** employeeFaces.pictureStorageId/addedAt; employeeFingerprints.encData/iv/keyVersion/addedAt; schema.ts:993,1004. **Durumlar:** yok/kayıtlı/değişti/silindi; cihaz pending/failed/done kuyruktan.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yerel yok → kayıtlı; kayıtlı → yeni template; kayıtlı → yok; bağımsız her cihaz kuyruğu | convex/employeeFaces.ts; convex/employeeFingerprints.ts; convex/fingerprintEnrollment.ts:260; convex/actions/hikvisionSync.ts; convex/lib/hikSyncEmployee.ts; convex/hikDeviceImport.ts:94 | mutation modül/rıza/kimlik kapıları; teslim queue enumu |

**Okuyan kopyalar:** src/components/employees/table/EmployeeBiometricsCell.tsx; src/components/employees/EmployeeFingerprintCard.tsx.

Yerel şablonun varlığı cihaza teslim değildir; tablo başına ayrı syncedAt/status bulunmaz. Fingerprint aktarımı enrollment kaydına da yazılır.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 20. Biyometrik imha işi

**Saklama:** auditLog.newValue (targetTable biometricDestructionRun); convex/lib/biometricDestruction.ts:60. **Durumlar:** running/waitingDevices/completed/failed; phase face/fingerprint; scan project/legacy.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → running; face → fingerprint; running → waitingDevices/completed/failed; waitingDevices → completed (sayaçlarla) | convex/biometricDestruction.ts:34,91,125,225,242,256,268,306,354; convex/actions/biometricDestruction.ts | Zod parse + mutation batch/status kontrolü; auditLog DB validatorı bu shapei zorlamaz |

**Okuyan kopyalar:** src/components/settings/sections/privacy/BiometricDestructionCard.tsx:20,77; convex/lib/biometricDestructionState.ts:5.

Tamamlandı etiketi deviceFailures/deviceUnconfirmed ile birlikte okunur. waitingDevices modül açmayı engeller; running 30 dk heartbeat ile aktif kabul edilir.

**Bulgular:** Bu incelemede kanıtlanmış ek bulgu yok.

### 21. Mobil kapı açma ve istemci kurtarma

**Saklama:** mobileAccessOperations.status/transport/requestId/authVersion; schema.ts:227; mobil store. **Durumlar:** pending/sent/confirmed/failed/unknown; ide_mqtt/hik_local_bridge/hik_gateway; istemcide unresolved.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → pending; gateway pending → sent → confirmed/unknown; kuyruk DTO pending → sent → confirmed/failed/unknown; süre → failed/unknown | convex/mobileAccess.ts:27,56,133,150,162; convex/mobileAccessGateway.ts:8; convex/ideSync.ts:487,530,587 | schema enum + mutation kimlik/süre/oturum kontrolü; DTO türetme |
| yok → pending | convex/mobileAccess.ts:56,81 | oturum/target/authVersion/requestId |
| pending → sent | convex/mobileAccess.ts:133,145 | mobileOperationAllowed; gateway claim |
| sent → confirmed/unknown | convex/mobileAccess.ts:150,154 | gateway ve sent kontrolü |
| pending → failed | convex/mobileAccess.ts:162,182 | TTL + unsent; terminal kuyrukta yazım yok |
| pending/sent → confirmed/failed/unknown (DTO) | convex/mobileAccess.ts:27,33,43 | yalnız query hesaplaması; DB status değişmez |

**Okuyan kopyalar:** mobile/lib/models/door_operation.dart:3,40,53; mobile/lib/providers/door_operation_provider.dart; mobile/lib/services/door_operation_store.dart; mobile/lib/widgets/cards/door_command_status_card.dart.

Mobil yerel unresolved unknown içerir; yeniden kapı açmayı kurtarma akışı yönetir. Server requestId tekrarını tekilleştirir, 30 sn teslim kapısı var. A-05.

**Bulgular:** A-05

### 22. Proje erişim taşıması ve hedefleri

**Saklama:** accessTransfers.status/kind/deadlineAt; accessTransferTargets.state/confirmedAt; schema.ts:513,528. **Durumlar:** requested/revoking/revoked/provisioning/done/stuck/cancelled; pending/confirmed/failed/superseded/deviceRemoved.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| yok → revoking; tüm hedef onayı → revoked → provisioning → done; timeout/failure → stuck; stuck → revoking; revoking/stuck → cancelled | convex/employeeTermination.ts:197,217,226,241,250,263,297,319; convex/lib/transferGuard.ts:109,118,149; convex/lib/accessTransfer.ts:112 | schema enum; mutation ön-durum ve tüm hedef onayı |
| yok → revoking | convex/employeeTermination.ts:197 | preflight/online/busy kontrolü |
| revoking/stuck → revoked | convex/lib/transferGuard.ts:109 | tüm hedefler confirmed/deviceRemoved |
| revoked → provisioning → done | convex/employeeTermination.ts:226,241,250 | ön-durum ve tüm hedef doğrulaması |
| revoking → stuck | convex/employeeTermination.ts:319 | deadline cron |
| stuck → revoking | convex/employeeTermination.ts:297,302 | superseded hedef yok |
| revoking/stuck → cancelled | convex/employeeTermination.ts:263,267 | ön-durum/yetki; hedef ve işlem kapatma aynı mutation |
| pending/failed → confirmed/failed/superseded | convex/lib/transferGuard.ts:118,125 | confirmed/deviceRemoved geriye dönmez |
| pending/failed/superseded → deviceRemoved | convex/lib/transferGuard.ts:149 | cihaz kaynak projeden ayrıldı |

**Okuyan kopyalar:** src/components/employees/lib/employment.ts:19; src/components/employees/EmployeeTransferStatus.tsx; convex/employeeTermination.ts:337.

Cihaz silme kanıtı Alan A; personel yaşam döngüsü Alan B ile sınır. requested ve ide_panel yazarı yok: A-07. accessGrantStatus değişimleri markAck/markOpDone/claim üzerinden effective/removed/failed/pending; belgeleme sahibi C.

**Bulgular:** A-07

### 23. Köprü runtime ve olay spool kuyruğu

**Saklama:** infra/hik-event-bridge/queue.mjs dosyaları; bridge/windows/.../Services/PanelWorker.cs:27,33; relay SSE bağlantıları. **Durumlar:** queued/inflight/retry/delivered/dropped; stopped/connecting/connected/error; SSE bağlı/kopuk.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| event → kuyruk; HTTP 2xx → dosyayı sil; hata → retry; kapasite → drop; SDK bağlanma → connected/error | infra/hik-event-bridge/bridge.mjs:183,212; infra/hik-event-bridge/queue.mjs:8; bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:73,114,136; infra/hik-relay/server.mjs:100 | yerel kod; DB zorlaması yok |

**Okuyan kopyalar:** bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs; bridge/windows/NgAccess.HikvisionBridge/Models.cs; infra/hik-relay/RUNBOOK.md.

Linux spool atomic rename/fsync kullanır; Windows kuyruk yalnız bellekte. Relay wake teslim onayı değildir. A-01, A-02.

**Bulgular:** A-01, A-02

### 24. Saklama ve temizleme zinciri

**Saklama:** scheduler args stage/batch/runAt/cursor; convex/privacyRetention.ts:195; cardReadings ve operasyon createdAt. **Durumlar:** operations/events/access grupları; aşama/sayfa/devam/bitti/bütçe doldu.

| Kaynak → hedef | Yazan yol | Ön-koşul / zorlama |
|---|---|---|
| başlat → stage; sayfa → aynı stage veya sonraki; limit/bitiş → dur; uygun terminal kayıt → yok | convex/privacyRetention.ts:91,99,218,244,253,270,285,303,338; convex/crons.ts:95 | mutation valid/stageGroup/20 çağrı sınırı; kalıcı job enumu yok |

**Okuyan kopyalar:** src/components/settings/sections/privacy/RetentionAssistantCard.tsx; convex/lib/cardReadingRetention.ts.

Açık revocation hataları korunur; card retention proje ayarına bağlıdır. Mobil sent/pending satırları terminal purge dışında: A-05.

**Bulgular:** A-05 (mobil saklama)

### 25. Cihazdan kişi içe aktarma ve önizleme

**Saklama:** `convex/lib/hikDeviceImport.ts:27` ImportRow.status geçici sonuçtur; kalıcı ayrı import job tablosu yoktur. `src/components/employees/import/DevicePersonImportDialog.tsx:112` preview/selected/busy/confirmation React durumlarıdır.

| Kaynak → hedef | Yazan yol | Ön-koşul kontrolü |
|---|---|---|
| kişi yanıtı → new/matched/conflict/manual | convex/lib/hikDeviceImport.ts:28 | kart eşleşmesi/çakışması/çoklu kart kontrolü |
| new → personel oluşturuldu / yeniden sınıflandırılmış satır | convex/hikDeviceImport.ts:46,58 | mutation içinde yeniden sınıflama; yalnız new oluşturulur |
| matched/new → kaynak biyometri kaydı | convex/hikDeviceImport.ts:94; convex/actions/hikDeviceImport.ts | biyometri modülü ve kullanıcı yetkileri; slot kabul/atlama |
| idle → preview → idle; idle → confirmation → import → idle | src/components/employees/import/DevicePersonImportDialog.tsx:115,142,158,165 | busy/current ref çift çağrıyı sınırlar; backend yetki ayrı |
| başarı → senkron planlandı | convex/hikDeviceImport.ts:117 | yerel kayıt ve cihaz teslimi ayrı |

**Okuyan kopyalar:** web status label map `src/components/employees/import/DevicePersonImportDialog.tsx:86`, seçim ve sonuç gösterimi `devicePersonImportView.ts`; backend new/matched/conflict/manual aynı kümeyi taşır. Mobilde bu import ekranı veya aynı enum kopyası bulunmadı. **Bulgular:** kanıtlanmış ek bulgu yok.

### HTTP, cron ve dış tüketici giriş haritası

| Giriş | İlerleyen makine / yazan zincir |
|---|---|
| convex/http.ts:18 /hik-gateway/device-status | cihaz ISUP → devices.applyIsupStatus → zaman damgası/olay/alarm |
| convex/http.ts:90 /card-reader | parse/auth → processCardReadingCore → cardReadings/deviceEvents, heartbeat, lateReading scheduler |
| convex/http.ts:338 /ide-bridge/event | IDE ham olay → kart/bağlantı işleme |
| convex/http.ts:380,395,412 /ide-bridge/poll,sent,ack | IDE pending→sent→acked/failed/retry; roster ve transfer/grant sonuçları |
| convex/http.ts:437,456 /hik-bridge/poll,ack | per-device token → claimLocalBridgeOperations/ackLocalBridgeOperation |
| Windows ConvexBridgeClient.cs:51,67 | kaldırılmış roster/roster-ack: A-02 |
| convex/crons.ts:16,24,32 | 3 dk Hik retry, 10 dk stale issue cleanup, 3 dk stale local claim requeue |
| convex/crons.ts:40,49 | günlük saat sync ve AcsEvent backfill |
| convex/crons.ts:63 | 10 dk IDE ACK timeout → pending/failed |
| convex/crons.ts:5 | 15 dk transfer deadline → stuck |
| convex/crons.ts:95,100,103 | günlük card purge, fingerprint purge retry ve operasyon/olay/erişim retention zincirleri |

Mobil mutation çağrıları: mobile/lib/repositories/door_operation_repository.dart requestOpen/getOperation/getRequestOperation yollarını; device_repository.dart listTargets yolunu kullanır. Kiosk connect/scan public mutationları sanal okuyucuyu ilerletir. HikGatewayDevice/ideGatewayDevice actionları komut helperlarına; hikQueueWorker failed işlerin retry yollarına; hikFingerprint enrollment/push/cleanup mutationlarına; hikDeviceImport sınıflama/kayıt/kuyruk yollarına gider. HikBridgeWake yalnız relay wake gönderir, işlem ACK üretmez.

### Tüm yazan çağrılar ve durum atamaları — kaynak envanteri

Aşağıdaki üretim kaynakları bütün köklerden tablo/özellik adıyla yeniden seçildi. Her `db.patch/insert/replace/delete` çağrısı ve durum alanı ataması satır numarasıyla verilir; 1–3 satırlık alıntılar multi-line patch gövdelerinin başlangıcını gösterir. Bazı dosyalar C/B sahipliğindeki sınırları da içerir; burada yalnız cihaz tarafı geçiş bağı için envanterdedir. Schema/generated/test kaynakları yazan yol kabul edilmedi.

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs (4 yazma/durum eşleşmesi)</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:268:       var status = Marshal.PtrToStringAnsi(statusBuffer) ?? "";
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:269:       return SdkResult.Failure($"NET_DVR_STDXMLConfig failed {NET_DVR_GetLastError()}: {status}");
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:381:       var status = type;
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:382:       if (type == CallbackTypeStatus && buffer != IntPtr.Zero && bufferLength >= sizeof(uint))
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:384:         status = unchecked((uint)Marshal.ReadInt32(buffer));
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:385:       }
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:390:       else if (status == CallbackStatusFailed)
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:391:       {
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs (2 yazma/durum eşleşmesi)</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:218:   private static async Task JsonAsync(HttpListenerResponse response, object body, int status = 200)
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:219:   {
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:228:   private static async Task HtmlAsync(HttpListenerResponse response, string html, int status = 200)
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:229:   {
```

</details>

<details><summary>convex/accessGrantStatus.ts (18 yazma/durum eşleşmesi)</summary>

```text
convex/accessGrantStatus.ts:26:   if (row.appliedAt === undefined || row.state === "removed") return false;
convex/accessGrantStatus.ts:27:   let current = memberships.get(row.employeeId);
convex/accessGrantStatus.ts:30:       if (!employee || employee.isActive === false) return [];
convex/accessGrantStatus.ts:31:       const links = bounded(await ctx.db.query("groupMembers").withIndex("by_project_employee", q =>
convex/accessGrantStatus.ts:35:         entry.rule !== null && entry.rule.projectId === row.projectId && entry.rule.isActive === true);
convex/accessGrantStatus.ts:36:     })();
convex/accessGrantStatus.ts:97:       if (employee.isActive === false) continue;
convex/accessGrantStatus.ts:98:       let graph: Awaited<ReturnType<typeof employeeGrantGraph>>;
convex/accessGrantStatus.ts:129:       if (!employee || employee.projectId !== projectId || employee.isActive === false) continue;
convex/accessGrantStatus.ts:130:       for (const scope of scopes) {
convex/accessGrantStatus.ts:152:   args: { projectId: v.id("projects"), state: v.optional(v.union(grantState, v.literal("unknown"))), departmentId: v.optional(v.id("departments")),
convex/accessGrantStatus.ts:153:     deviceId: v.optional(v.id("devices")), ruleId: v.optional(v.id("accessRules")),
convex/accessGrantStatus.ts:166:     if (args.state === "unknown") {
convex/accessGrantStatus.ts:167:       // Unknown pairs have no stored row: enumerate the bounded rule graph, filter, then page.
convex/accessGrantStatus.ts:176:           departmentId: pair.employee.departmentId, state: "pending", ruleIds: pair.ruleIds, updatedAt: 0 }, scopes, new Map([[pair.employee._id, pair.employee]])),
convex/accessGrantStatus.ts:177:         state: "unknown" as const,
convex/accessGrantStatus.ts:177:         state: "unknown" as const,
convex/accessGrantStatus.ts:178:       })));
convex/accessGrantStatus.ts:181:     const state = args.state;
convex/accessGrantStatus.ts:182:     const base = () => deviceId
convex/accessGrantStatus.ts:230:     if (deviceId && departmentRows) return { personCount: people.size, all: departmentRows.length, effective: departmentRows.filter(row => row.state === "effective").length,
convex/accessGrantStatus.ts:231:       pending: departmentRows.filter(row => row.state === "pending").length, failed: departmentRows.filter(row => row.state === "failed").length,
convex/accessGrantStatus.ts:231:       pending: departmentRows.filter(row => row.state === "pending").length, failed: departmentRows.filter(row => row.state === "failed").length,
convex/accessGrantStatus.ts:232:       removed: departmentRows.filter(row => row.state === "removed").length, unknown: 0, capped };
convex/accessGrantStatus.ts:232:       removed: departmentRows.filter(row => row.state === "removed").length, unknown: 0, capped };
convex/accessGrantStatus.ts:233:     const count = async (state?: Doc<"accessGrantStatus">["state"]) => {
convex/accessGrantStatus.ts:234:       if (departmentRows) return departmentRows.filter(row => !state || row.state === state).length;
convex/accessGrantStatus.ts:235:       const rows = await ctx.db.query("accessGrantStatus").withIndex("by_project_state", q => state ? q.eq("projectId", args.projectId).eq("state", state) : q.eq("projectId", args.projectId)).take(1001);
convex/accessGrantStatus.ts:274:         departmentId: employee.departmentId, state: "pending", ruleIds: scope.ruleIds, updatedAt: 0 }, scopes, employees);
convex/accessGrantStatus.ts:275:       rows.push({ ...synthetic, ...diagnose(deviceId), _id: null, state: "unknown" as const, authorized: true, removalRequired: false });
convex/accessGrantStatus.ts:275:       rows.push({ ...synthetic, ...diagnose(deviceId), _id: null, state: "unknown" as const, authorized: true, removalRequired: false });
convex/accessGrantStatus.ts:276:     }
convex/accessGrantStatus.ts:279:     return { rows, unauthorizedDoors: doors.filter(door => door.deviceId && !allowedDoors.has(door._id)).map(door => ({ doorId: door._id, doorName: door.name, deviceId: door.deviceId ?? null, state: "unauthorized" as const })) };
convex/accessGrantStatus.ts:280:   },
convex/accessGrantStatus.ts:284:   args: { results: v.array(v.object({ projectId: v.id("projects"), employeeId: v.id("employees"), deviceId: v.id("devices"), state: grantState,
convex/accessGrantStatus.ts:285:     ruleIds: v.optional(v.array(v.id("accessRules"))), lastError: v.optional(v.string()), lastRunId: v.optional(v.id("deviceSyncRuns")) })) },
```

</details>

<details><summary>convex/accessRules.ts (49 yazma/durum eşleşmesi)</summary>

```text
convex/accessRules.ts:116:       if (employee.projectId !== panel.projectId || employee.isActive === false) continue;
convex/accessRules.ts:117:       const remaining = await resolveEmployeeIdeDeviceIds(ctx, employee._id, panel.projectId);
convex/accessRules.ts:209:   await Promise.all(staleIds.map((id) => ctx.db.delete(id)));
convex/accessRules.ts:210: }
convex/accessRules.ts:481:   const query = (phase: "active" | "legacy") => {
convex/accessRules.ts:482:     const isActive = phase === "active" ? true : undefined;
convex/accessRules.ts:482:     const isActive = phase === "active" ? true : undefined;
convex/accessRules.ts:483:     return search
convex/accessRules.ts:501:     next.phase === "active" &&
convex/accessRules.ts:502:     next.cursor === null &&
convex/accessRules.ts:505:     next.phase = "legacy";
convex/accessRules.ts:506:   const result = await query(next.phase).paginate({
convex/accessRules.ts:512:     next.phase === "active" &&
convex/accessRules.ts:513:     (await query("legacy").first())
convex/accessRules.ts:518:       continueCursor: JSON.stringify({ scope, phase: "legacy", cursor: null }),
convex/accessRules.ts:519:     };
convex/accessRules.ts:525:       phase: next.phase,
convex/accessRules.ts:526:       cursor: result.continueCursor,
convex/accessRules.ts:536:   status: "all" | "active" | "inactive",
convex/accessRules.ts:537:   paginationOpts: PaginationOptions,
convex/accessRules.ts:543:   const query = (phase: number) => {
convex/accessRules.ts:544:     const stage = stages[phase];
convex/accessRules.ts:548:       return stage.isActive === "all" ? named : named.eq("isActive", stage.isActive);
convex/accessRules.ts:549:     });
convex/accessRules.ts:550:     const isActive = stage.isActive;
convex/accessRules.ts:551:     return isActive === "all"
convex/accessRules.ts:551:     return isActive === "all"
convex/accessRules.ts:552:       ? ctx.db.query("accessRules").withIndex("by_project_targetType", q => q.eq("projectId", projectId).eq("targetType", stage.targetType)).order("desc")
convex/accessRules.ts:557:     async phase => (await query(phase).first()) !== null);
convex/accessRules.ts:558: }
convex/accessRules.ts:584:     status: v.optional(
convex/accessRules.ts:585:       v.union(v.literal("all"), v.literal("active"), v.literal("inactive")),
convex/accessRules.ts:593:     const status = args.status ?? "all";
convex/accessRules.ts:594:     const type = args.type ?? "all";
convex/accessRules.ts:624:         : status === "active"
convex/accessRules.ts:625:           ? await listActiveRules(ctx, args.projectId, search, paginationOpts)
convex/accessRules.ts:634:                       return status === "inactive"
convex/accessRules.ts:635:                         ? named.eq("isActive", false)
convex/accessRules.ts:638:                 : status === "inactive"
convex/accessRules.ts:639:                   ? ctx.db
convex/accessRules.ts:790:     isActive: v.optional(v.boolean()),
convex/accessRules.ts:791:     isTemplate: v.optional(v.boolean()),
convex/accessRules.ts:801:     const ruleId = await ctx.db.insert("accessRules", {
convex/accessRules.ts:802:       ...args,
convex/accessRules.ts:803:       isActive: args.isActive ?? true,
convex/accessRules.ts:804:       createdAt: now,
convex/accessRules.ts:822:     isActive: v.optional(v.boolean()),
convex/accessRules.ts:823:     isTemplate: v.optional(v.boolean()),
convex/accessRules.ts:841:     const hikMembers = updates.isActive === false ? await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", ruleId)).take(4097) : [];
convex/accessRules.ts:842:     if (hikMembers.length > 4096) throw new Error("Kural üye sınırı aşıldı");
convex/accessRules.ts:844:     await ctx.db.patch(ruleId, clean);
convex/accessRules.ts:845:     await writeAudit(ctx, { user: ctx.user, projectId: rule.projectId, action: "update", targetTable: "accessRules", targetId: ruleId,
convex/accessRules.ts:858:         ...(updates.isActive === false ? { targetEmployeeIds: [] } : {}),
convex/accessRules.ts:859:       });
convex/accessRules.ts:866:     if (updates.isActive === false) {
convex/accessRules.ts:867:       const idePanels = await resolveRuleIdeDeviceIds(ctx, ruleId, rule.projectId);
convex/accessRules.ts:880:     if (updates.isActive === true) {
convex/accessRules.ts:881:       // Önce kuralın IDE paneli var mı çöz (deaktivasyon dalıyla simetrik). Hikvision-only
convex/accessRules.ts:955:     await Promise.all([...members, ...devices, ...doors].map(link => ctx.db.delete(link._id)));
convex/accessRules.ts:956:     const departmentLinks = await ctx.db.query("groupDepartments").withIndex("by_group", q => q.eq("groupId", args.ruleId)).take(101);
convex/accessRules.ts:958:     for (const link of departmentLinks) await ctx.db.delete(link._id);
convex/accessRules.ts:959: 
convex/accessRules.ts:960:     await ctx.db.delete(args.ruleId);
convex/accessRules.ts:961:     await writeAudit(ctx, { user: ctx.user, projectId: rule.projectId, action: "delete", targetTable: "accessRules", targetId: args.ruleId,
convex/accessRules.ts:988:     isActive: v.optional(v.boolean()),
convex/accessRules.ts:989:     employeeIds: v.optional(v.array(v.id("employees"))),
convex/accessRules.ts:1010:     isActive: v.optional(v.boolean()),
convex/accessRules.ts:1011:     employeeIds: v.optional(v.array(v.id("employees"))),
convex/accessRules.ts:1094:     const allHikDevices = removedMembers.length || affectedDeviceIds.size || updates.isActive === false ? await ruleHikDevices(ctx, rule) : [];
convex/accessRules.ts:1095:     const affectedMembers = updates.isActive === false || affectedDeviceIds.size ? oldEmployeeIds : removedMembers;
convex/accessRules.ts:1095:     const affectedMembers = updates.isActive === false || affectedDeviceIds.size ? oldEmployeeIds : removedMembers;
convex/accessRules.ts:1096:     const hikSnapshots = await snapshotRuleHikEmployees(ctx, affectedMembers, rule.projectId, allHikDevices);
convex/accessRules.ts:1100:     await ctx.db.patch(ruleId, { ...toPatch(updates), updatedAt: now });
convex/accessRules.ts:1101:     if (departmentSelections !== undefined) await writeRuleDepartments(ctx, ruleId, rule.projectId, departmentSelections);
convex/accessRules.ts:1106:       await Promise.all(oldMembers.filter(m => changed.removed.includes(m.employeeId)).map((m) => ctx.db.delete(m._id)));
convex/accessRules.ts:1107:       await Promise.all(
convex/accessRules.ts:1109:           ctx.db.insert("groupMembers", {
convex/accessRules.ts:1110:             groupId: ruleId,
convex/accessRules.ts:1121:         if ((member.source ?? "manual") !== source) await ctx.db.patch(member._id, { source });
convex/accessRules.ts:1122:       }
convex/accessRules.ts:1128:       await Promise.all(oldDevices.filter(d => changed.removed.includes(d.deviceId)).map((d) => ctx.db.delete(d._id)));
convex/accessRules.ts:1129:       await Promise.all(
convex/accessRules.ts:1131:           ctx.db.insert("groupDevices", {
convex/accessRules.ts:1132:             groupId: ruleId,
convex/accessRules.ts:1160:       await Promise.all(oldDoors.filter(d => changed.removed.includes(d.doorId)).map((d) => ctx.db.delete(d._id)));
convex/accessRules.ts:1161:       await Promise.all(
convex/accessRules.ts:1164:           await ctx.db.insert("groupDoors", {
convex/accessRules.ts:1165:             groupId: ruleId,
convex/accessRules.ts:1219:         ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: ruleId, ...(updates.isActive === false ? { targetEmployeeIds: [] } : {}) }),
convex/accessRules.ts:1220:         ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncPermissionToIdePanels, { accessRuleId: ruleId }),
convex/accessRules.ts:1239:     if (relationDiff || employeeIds !== undefined || removedIdePanels.length > 0 || updates.isActive === false) {
convex/accessRules.ts:1240:       for (const empId of relationDiff ? diffPlan.syncMembers : survivingMemberIds) {
convex/accessRules.ts:1248:             candidatePanels: updates.isActive === false || (relationDiff && diffPlan.reconcileRoster) ? ruleIdePanelsBefore : removedIdePanels,
convex/accessRules.ts:1249:           }),
convex/accessRules.ts:1254:     // Salt reaktivasyon: üye listesi ve panel değişmeden isActive:true yapıldığında yukarıdaki
convex/accessRules.ts:1255:     // kalan-üye döngüsü (employeeIds !== undefined || removedIdePanels.length > 0 koşulu)
convex/accessRules.ts:1261:       updates.isActive === true &&
convex/accessRules.ts:1262:       employeeIds === undefined &&
```

</details>

<details><summary>convex/actions/hikDebug.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/actions/hikDebug.ts:29:       status: result.status,
convex/actions/hikDebug.ts:30:       raw: result.raw,
```

</details>

<details><summary>convex/actions/hikDeviceImport.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/actions/hikDeviceImport.ts:113:   if (transferFingers && classified.some(row => (row.status === "new" || row.status === "matched") && row.fingerCount > 0)) await assertTemplateKey();
convex/actions/hikDeviceImport.ts:114:   const result: ImportResult = { created: 0, matched: 0, conflicts: 0, manual: 0, fingerprintsStored: 0, fingerprintsSkipped: 0, ruleId: null };
convex/actions/hikDeviceImport.ts:117:     const matchedEmployeeId = created.row.status === "matched" ? created.row.matchedEmployeeId : undefined;
convex/actions/hikDeviceImport.ts:118:     if (created.row.status === "matched") result.matched++;
convex/actions/hikDeviceImport.ts:118:     if (created.row.status === "matched") result.matched++;
convex/actions/hikDeviceImport.ts:119:     const employeeId = created.employeeId ?? matchedEmployeeId;
convex/actions/hikDeviceImport.ts:121:       if (created.row.status === "conflict") result.conflicts++;
convex/actions/hikDeviceImport.ts:122:       else if (created.row.status === "manual") result.manual++;
convex/actions/hikDeviceImport.ts:122:       else if (created.row.status === "manual") result.manual++;
convex/actions/hikDeviceImport.ts:123:       if (matchedEmployeeId) result.fingerprintsSkipped += person.fingerCount;
```

</details>

<details><summary>convex/actions/hikFingerprint.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/actions/hikFingerprint.ts:31:   args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), attemptId: v.optional(v.string()) },
convex/actions/hikFingerprint.ts:32:   returns: v.null(),
convex/actions/hikFingerprint.ts:40:     const attemptId: string = args.attemptId ?? await ctx.runMutation(api.fingerprintEnrollment.beginEnrollment, { employeeId: args.employeeId, deviceId: args.deviceId, fingerNo: args.fingerNo });
convex/actions/hikFingerprint.ts:41:     const attempt = { employeeId: args.employeeId, deviceId: args.deviceId, fingerNo: args.fingerNo, attemptId };
convex/actions/hikFingerprint.ts:166:         let reservation: { enrollmentId: Id<"deviceFingerprintEnrollments">; attemptId: string } | undefined;
convex/actions/hikFingerprint.ts:167:         let employeeNo: string | undefined;
convex/actions/hikFingerprint.ts:171:           const reserved: { current: true } | { enrollmentId: Id<"deviceFingerprintEnrollments">; attemptId: string } | null = await ctx.runMutation(internal.fingerprintEnrollment.beginPush, { employeeId: args.employeeId, deviceId, fingerNo: template.fingerPrintID, templateId: template._id, addedAt: template.addedAt, expectedCardNumber: target.employee.cardNumber, force: args.force });
convex/actions/hikFingerprint.ts:172:           if (reserved && "current" in reserved) continue;
convex/actions/hikFingerprint.ts:181:           await ctx.runMutation(internal.fingerprintEnrollment.recordPush, { employeeId: args.employeeId, deviceId, fingerNo: template.fingerPrintID, templateId: template._id, addedAt: template.addedAt, expectedCardNumber: target.employee.cardNumber, enrolledBy: template.enrolledBy, attemptId: reservation.attemptId });
convex/actions/hikFingerprint.ts:182:           ok = true;
```

</details>

<details><summary>convex/actions/hikQueueWorker.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/actions/hikQueueWorker.ts:31:  * 1. status=failed olan ops'ları çek (attemptCount<5, deviceId online).
convex/actions/hikQueueWorker.ts:32:  * 2. Operation tipine göre uygun gateway helper'ını çağır.
convex/actions/hikQueueWorker.ts:33:  * 3. Başarı → status=done; başarısızlık → attemptCount++ + lastError güncelle,
convex/actions/hikQueueWorker.ts:34:  *    attemptCount>=5 ise terminal failed bırak.
```

</details>

<details><summary>convex/actions/hikvisionSync.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/actions/hikvisionSync.ts:371:     if (loaded.op.status === "done") return { ok: true };
convex/actions/hikvisionSync.ts:372:     let result: { ok: boolean; removed?: boolean; error?: string };
```

</details>

<details><summary>convex/actions/ideGatewayDevice.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/actions/ideGatewayDevice.ts:99:  * Employee → IdeUserRecord: id=cardNumber(numeric), status=isActive?1:0, permissions=[...permNo].
convex/actions/ideGatewayDevice.ts:100:  *
convex/actions/ideGatewayDevice.ts:144:     const status: 0 | 1 = data.employee.isActive === false ? 0 : 1;
convex/actions/ideGatewayDevice.ts:145:     const { start, end } = ideUserAccessWindow(data.employee, Date.now());
```

</details>

<details><summary>convex/adminDevices.ts (13 yazma/durum eşleşmesi)</summary>

```text
convex/adminDevices.ts:53:       lastSeen: v.optional(v.string()),
convex/adminDevices.ts:54:     })
convex/adminDevices.ts:72:         lastSeen: d.lastSeen,
convex/adminDevices.ts:73:       }));
convex/adminDevices.ts:93:     await ctx.db.patch(device._id, {
convex/adminDevices.ts:94:       assignedProjectId: args.projectId,
convex/adminDevices.ts:123:     return await ctx.db.insert("adminDevices", {
convex/adminDevices.ts:124:       ideUuid,
convex/adminDevices.ts:151:       const adminDeviceId = await ctx.db.insert("adminDevices", {
convex/adminDevices.ts:152:         name: device.name,
convex/adminDevices.ts:160:         lastSeen: device.lastSeen,
convex/adminDevices.ts:161:         assignedDeviceId: device._id,
convex/adminDevices.ts:167:       await ctx.db.patch(device._id, { adminDeviceId, updatedAt: now });
convex/adminDevices.ts:168:       count++;
convex/adminDevices.ts:187:     await ctx.db.delete(args.adminDeviceId);
convex/adminDevices.ts:188:   },
convex/adminDevices.ts:200:       await ctx.db.patch(device._id, { lastSeen: new Date().toISOString() });
convex/adminDevices.ts:201:     }
convex/adminDevices.ts:213:     await ctx.db.patch(args.adminDeviceId, {
convex/adminDevices.ts:214:       assignedDeviceId: args.deviceId,
convex/adminDevices.ts:227:     await ctx.db.patch(args.adminDeviceId, {
convex/adminDevices.ts:228:       assignedDeviceId: undefined,
convex/adminDevices.ts:277:           lastSeen: signal.lastSeen,
convex/adminDevices.ts:278:           ...("hikTransport" in signal ? { hikTransport: signal.hikTransport } : {}),
convex/adminDevices.ts:281:           ...("hikIsupOnline" in signal ? { hikIsupOnline: signal.hikIsupOnline } : {}),
convex/adminDevices.ts:282:           ...("hikIsupStatusAt" in signal ? { hikIsupStatusAt: signal.hikIsupStatusAt } : {}),
```

</details>

<details><summary>convex/alarms.ts (13 yazma/durum eşleşmesi)</summary>

```text
convex/alarms.ts:29: const status = v.union(v.literal("open"), v.literal("acked"), v.literal("all"));
convex/alarms.ts:30: 
convex/alarms.ts:56:         && (args.status === "all" || (args.status === "acked" ? event.ackedAt !== undefined : event.ackedAt === undefined));
convex/alarms.ts:57:     }).paginate({ ...args.paginationOpts, numItems: Math.min(100, Math.max(1, Math.floor(args.paginationOpts.numItems))), maximumRowsRead: 2000, maximumBytesRead: 2_000_000 });
convex/alarms.ts:96:       await ctx.db.patch(id, { ackedAt: now, ackedBy: ctx.user._id, ackNote: args.note?.trim() || undefined, updatedAt: now });
convex/alarms.ts:97:       await writeAudit(ctx, { user: ctx.user, projectId: event.projectId, action: "update", targetTable: "deviceEvents", targetId: id, oldValue: { ackedAt: null }, newValue: { ackedAt: now }, note: args.note?.trim() });
convex/alarms.ts:97:       await writeAudit(ctx, { user: ctx.user, projectId: event.projectId, action: "update", targetTable: "deviceEvents", targetId: id, oldValue: { ackedAt: null }, newValue: { ackedAt: now }, note: args.note?.trim() });
convex/alarms.ts:98:       acknowledged += 1;
convex/alarms.ts:114:       lastEmail: last ? { status: last.alarmEmailStatus, attempts: last.alarmEmailAttempts ?? 0, at: last.alarmEmailAttemptAt ?? last.alarmQueuedAt, error: last.alarmEmailError, retryAt: last.alarmEmailRetryAt, test: last.alarmEmailTest ?? false } : null,
convex/alarms.ts:115:     };
convex/alarms.ts:128:     if (existing) await ctx.db.patch(existing._id, values); else await ctx.db.insert("alarmSettings", { projectId: args.projectId, ...values });
convex/alarms.ts:129:     await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: existing ? "update" : "create", targetTable: "alarmSettings", targetId: existing?._id ?? args.projectId, oldValue: existing ? { emailEnabled: existing.emailEnabled, minSeverity: existing.minSeverity, recipientCount: existing.recipients.length } : undefined, newValue: { emailEnabled: args.emailEnabled, minSeverity: args.minSeverity, recipientCount: recipients.length } });
convex/alarms.ts:160:     const eventId = await ctx.db.insert("deviceEvents", {
convex/alarms.ts:161:       projectId: args.projectId, source: "system", category: "operation", severity: "info", label: "Alarm test e-postası",
convex/alarms.ts:166:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId, lastTestRequestedAt: now });
convex/alarms.ts:167:     await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "create", targetTable: "deviceEvents", targetId: eventId, newValue: { alarmEmailTest: true, recipientCount: settings.recipients.length } });
convex/alarms.ts:185:       await ctx.db.patch(event._id, { alarmEmailStatus: "skipped", alarmEmailError: "Gönderim güncel alarm ayarları nedeniyle durduruldu", alarmEmailRetryAt: undefined, updatedAt: now });
convex/alarms.ts:186:       return null;
convex/alarms.ts:188:     await ctx.db.patch(event._id, { alarmEmailStatus: "sending", alarmEmailAttempts: args.attempt, alarmEmailAttemptAt: now, alarmEmailRetryAt: undefined, updatedAt: now });
convex/alarms.ts:189:     await ctx.scheduler.runAfter(10 * 60_000, internal.alarms.recoverEmail, { eventId: event._id, attempt: args.attempt });
convex/alarms.ts:202:     await ctx.db.patch(event._id, { alarmEmailContent: args.content });
convex/alarms.ts:203:     return args.content;
convex/alarms.ts:220:     await ctx.db.patch(event._id, {
convex/alarms.ts:221:       alarmEmailStatus: failed.length === 0 ? "sent" : retryAt ? "retryScheduled" : "failed",
convex/alarms.ts:241:     await ctx.db.patch(event._id, { alarmEmailStatus: retry ? "retryScheduled" : "failed", alarmEmailRetryAt: retry ? now : undefined, alarmEmailError: "E-posta gönderimi kesildi; yeniden deneme sınırını kontrol edin", updatedAt: now });
convex/alarms.ts:242:     if (retry) await ctx.scheduler.runAfter(0, internal.actions.sendAlarmEmail.send, { eventId: event._id, attempt: args.attempt + 1 });
```

</details>

<details><summary>convex/biometricDestruction.ts (26 yazma/durum eşleşmesi)</summary>

```text
convex/biometricDestruction.ts:33:   return parsed.success ? { row, projectId: row.projectId, state: parsed.data } : null;
convex/biometricDestruction.ts:34: }
convex/biometricDestruction.ts:35: async function saveState(ctx: MutationCtx, row: Doc<"auditLog">, state: DestructionState, note: string) {
convex/biometricDestruction.ts:36:   if (state.status === "failed") {
convex/biometricDestruction.ts:36:   if (state.status === "failed") {
convex/biometricDestruction.ts:37:     state.deviceUnconfirmed += state.pendingOpIds.length;
convex/biometricDestruction.ts:41:   await ctx.db.patch(row._id, { newValue: state });
convex/biometricDestruction.ts:42:   if (state.status !== "completed" && state.status !== "failed") return;
convex/biometricDestruction.ts:45: async function settleIfReady(ctx: MutationCtx, row: Doc<"auditLog">, state: DestructionState) {
convex/biometricDestruction.ts:46:   if (state.status === "waitingDevices" && state.pendingDeviceChecks === 0) {
convex/biometricDestruction.ts:46:   if (state.status === "waitingDevices" && state.pendingDeviceChecks === 0) {
convex/biometricDestruction.ts:47:     state.status = "completed";
convex/biometricDestruction.ts:47:     state.status = "completed";
convex/biometricDestruction.ts:48:     state.finishedAt = Date.now();
convex/biometricDestruction.ts:50:   await saveState(ctx, row, state, state.status === "completed" ? "Biyometrik imha tutanağı" : "Biyometrik imha ilerlemesi");
convex/biometricDestruction.ts:51: }
convex/biometricDestruction.ts:54: function trackPending(state: DestructionState, ids: readonly string[]) {
convex/biometricDestruction.ts:55:   const pending = [...new Set([...state.pendingOpIds, ...ids])];
convex/biometricDestruction.ts:57:     state.status = "failed";
convex/biometricDestruction.ts:58:     state.finishedAt = Date.now();
convex/biometricDestruction.ts:103:     const state = initialDestructionState(project.name, args.kinds, args.reason, Date.now());
convex/biometricDestruction.ts:104:     await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "create", targetTable: STATE_TABLE, targetId: args.projectId, newValue: state, note: "Biyometrik imha çalışma durumu" });
convex/biometricDestruction.ts:137:       if (state.phase === "face" && state.kinds.includes("fingerprint")) {
convex/biometricDestruction.ts:138:         state.phase = "fingerprint"; state.scan = "project"; state.cursor = null;
convex/biometricDestruction.ts:138:         state.phase = "fingerprint"; state.scan = "project"; state.cursor = null;
convex/biometricDestruction.ts:139:         state.employeeCursor = null; state.legacyEmployeeId = null;
convex/biometricDestruction.ts:142:         state.status = "waitingDevices";
convex/biometricDestruction.ts:143:         if (state.pendingOpIds.length) {
convex/biometricDestruction.ts:155:       if (state.phase === "fingerprint") {
convex/biometricDestruction.ts:156:         // Source-only captures (central save failed) also need device erasure.
convex/biometricDestruction.ts:170:     const page = state.phase === "face"
convex/biometricDestruction.ts:171:       ? await (employeeId
convex/biometricDestruction.ts:201:       state.status = "failed"; state.finishedAt = Date.now(); state.error = "Projedeki cihaz sayısı güvenli işlem sınırını (50) aşıyor. Bu partide şablon silinmedi; destek ile iletişime geçin.";
convex/biometricDestruction.ts:202:       await saveState(ctx, row, state, state.error); return;
convex/biometricDestruction.ts:221:     return Boolean(run && run.state.status === "running" && run.state.batch === args.batch);
convex/biometricDestruction.ts:222:   },
convex/biometricDestruction.ts:232:     const opId = await ctx.db.insert("hikPendingOperations", {
convex/biometricDestruction.ts:233:       projectId: run.projectId, deviceId: args.deviceId, operation: args.kind === "face" ? "deleteFace" : "deleteFingerprint",
convex/biometricDestruction.ts:235:       status: "processing", processingStartedAt: Date.now(), attemptCount: 1, createdAt: Date.now(),
convex/biometricDestruction.ts:236:     });
convex/biometricDestruction.ts:264:     await ctx.db.patch(args.opId, { status: args.ok ? "done" : "failed", completedAt: Date.now(), attemptCount: args.ok ? op.attemptCount : 5, lastError: args.ok ? undefined : "Biyometrik şablon cihazdan silinemedi." });
convex/biometricDestruction.ts:265:   },
convex/biometricDestruction.ts:281:         await ctx.db.delete(face._id); state.deletedFaces += 1;
convex/biometricDestruction.ts:282:       } else if (face) state.skippedChanged += 1;
convex/biometricDestruction.ts:325:           state.status = "failed";
convex/biometricDestruction.ts:326:           state.finishedAt = now;
convex/biometricDestruction.ts:336:       if (op.status === "failed") { state.deviceFailures += 1; continue; }
convex/biometricDestruction.ts:337:       if (op.status === "done") continue;
convex/biometricDestruction.ts:337:       if (op.status === "done") continue;
convex/biometricDestruction.ts:338:       if (!deviceCache.has(op.deviceId)) deviceCache.set(op.deviceId, await ctx.db.get(op.deviceId));
convex/biometricDestruction.ts:362:     run.state.status = "failed"; run.state.finishedAt = Date.now();
convex/biometricDestruction.ts:363:     run.state.error = "İmha işlemi kesildi. Silinen kayıtlar geri alınmadı; kalan şablonları yeniden sayın. Son cihaz partisinin sonucu doğrulanamadı.";
```

</details>

<details><summary>convex/cardReadings.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/cardReadings.ts:157:       cardNumber: person.cardNumber, isActive: person.isActive,
convex/cardReadings.ts:158:     }));
convex/cardReadings.ts:210:     const status = args.result === "granted" ? "izin_verildi" : args.result === "denied" ? "reddedildi" : undefined;
convex/cardReadings.ts:211:     const query = stream(ctx.db, schema).query("cardReadings");
convex/cardReadings.ts:802:       const eventId = await ctx.db.insert("deviceEvents", {
convex/cardReadings.ts:803:         projectId: device.projectId,
convex/cardReadings.ts:851:     await ctx.db.insert("cardReadings", {
convex/cardReadings.ts:852:       projectId,
convex/cardReadings.ts:908:     const status = args.result === "granted" ? "izin_verildi" : args.result === "denied" ? "reddedildi" : undefined;
convex/cardReadings.ts:909:     const query = stream(ctx.db, schema).query("cardReadings");
```

</details>

<details><summary>convex/crons.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/crons.ts:64: // → mevcut isActive=false desync yolu cihazdan söker.
convex/crons.ts:65: crons.interval(
```

</details>

<details><summary>convex/dashboard.ts (3 yazma/durum eşleşmesi)</summary>

```text
convex/dashboard.ts:538:       const count = row.days.filter(day => day.status === "late").length;
convex/dashboard.ts:539:       if (count) lateCountByEmp.set(employeeId, (lateCountByEmp.get(employeeId) ?? 0) + count);
convex/dashboard.ts:685:         if ((day.status === "present" || day.status === "late") && (usesPlanDayRules(dataset.shiftResolver.resolvePlan(id, day.date)) || usesShiftDayRules(dataset.shiftResolver.resolve(id, day.date)))) presentRules.add(id);
convex/dashboard.ts:686:       }
convex/dashboard.ts:711:       incompleteDays: ruleCells.filter(c => c.day.status === "incomplete").length,
convex/dashboard.ts:712:       insideBuilding: hasReadings ? daily.insideBuilding : null,
```

</details>

<details><summary>convex/debugIde.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/debugIde.ts:51:         .map((r) => ({ _id: r._id, name: r.name, isActive: r.isActive })),
convex/debugIde.ts:52:       deviceLegRuleIds,
```

</details>

<details><summary>convex/deviceCenter.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/deviceCenter.ts:40:         lastSeen: device.lastSeen,
convex/deviceCenter.ts:41:         hikTransport: device.hikTransport,
convex/deviceCenter.ts:46:         hikIsupOnline: device.hikIsupOnline,
convex/deviceCenter.ts:47:         hikIsupStatusAt: device.hikIsupStatusAt,
```

</details>

<details><summary>convex/deviceEvents.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/deviceEvents.ts:48:     const eventId = await ctx.db.insert("deviceEvents", {
convex/deviceEvents.ts:49:       projectId: device.projectId,
convex/deviceEvents.ts:148:     const eventId = await ctx.db.insert("deviceEvents", {
convex/deviceEvents.ts:149:       projectId,
```

</details>

<details><summary>convex/deviceSyncRuns.ts (37 yazma/durum eşleşmesi)</summary>

```text
convex/deviceSyncRuns.ts:30:   const summary = summarizeRun(targets.map(t => t.status), run.dispatchFinished === true);
convex/deviceSyncRuns.ts:31:   const next = { ...summary, finishedAt: summary.status === "running" ? undefined : run.finishedAt ?? Date.now() };
convex/deviceSyncRuns.ts:31:   const next = { ...summary, finishedAt: summary.status === "running" ? undefined : run.finishedAt ?? Date.now() };
convex/deviceSyncRuns.ts:32:   if (summaryChanged(run, next)) await ctx.db.patch(runId, next);
convex/deviceSyncRuns.ts:32:   if (summaryChanged(run, next)) await ctx.db.patch(runId, next);
convex/deviceSyncRuns.ts:33:   return summary.status;
convex/deviceSyncRuns.ts:43:     const patch = { status: "unknown" as const, reason: "Süre doldu; cihaz sonucu doğrulanamadı", updatedAt: Date.now() };
convex/deviceSyncRuns.ts:44:     await ctx.db.patch(target._id, patch);
convex/deviceSyncRuns.ts:44:     await ctx.db.patch(target._id, patch);
convex/deviceSyncRuns.ts:45:     return { ...target, ...patch };
convex/deviceSyncRuns.ts:52:   const status = ops.length > MAX_OPS ? "unknown" : !ops.length && !failure && target.brand === "ide_smart" ? "verified" : targetStatus(statuses, timedOut);
convex/deviceSyncRuns.ts:53:   const reason = (ops.length > MAX_OPS ? "İşlem okuma sınırı aşıldı (2000)"
convex/deviceSyncRuns.ts:54:     : failure ?? ops.find(op => op.status === "failed")?.lastError
convex/deviceSyncRuns.ts:55:       ?? (status === "unknown" ? "Cihaz sonucu doğrulanamadı" : undefined))?.slice(0, 2000);
convex/deviceSyncRuns.ts:55:       ?? (status === "unknown" ? "Cihaz sonucu doğrulanamadı" : undefined))?.slice(0, 2000);
convex/deviceSyncRuns.ts:56:   if (target.status === status && target.reason === reason) return target;
convex/deviceSyncRuns.ts:56:   if (target.status === status && target.reason === reason) return target;
convex/deviceSyncRuns.ts:57:   const patch = { status, reason, updatedAt: Date.now() };
convex/deviceSyncRuns.ts:58:   await ctx.db.patch(target._id, patch);
convex/deviceSyncRuns.ts:59:   return { ...target, ...patch };
convex/deviceSyncRuns.ts:93:     const runId = await ctx.db.insert("deviceSyncRuns", {
convex/deviceSyncRuns.ts:94:       projectId, kind: args.ruleId ? "rule_sync" : "project_resync", ruleId: args.ruleId,
convex/deviceSyncRuns.ts:95:       startedBy: user._id, startedAt, status: "running",
convex/deviceSyncRuns.ts:96:       counts: summarizeRun([], false).counts, dispatchFinished: true,
convex/deviceSyncRuns.ts:96:       counts: summarizeRun([], false).counts, dispatchFinished: true,
convex/deviceSyncRuns.ts:97:     });
convex/deviceSyncRuns.ts:101:       const targetId = await ctx.db.insert("deviceSyncRunTargets", {
convex/deviceSyncRuns.ts:102:         runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other",
convex/deviceSyncRuns.ts:103:         status: reason ? "skipped" : "queued", reason, updatedAt: startedAt,
convex/deviceSyncRuns.ts:104:       });
convex/deviceSyncRuns.ts:111:     const status = await updateSummary(ctx, runId);
convex/deviceSyncRuns.ts:112:     if (status === "running") await ctx.scheduler.runAfter(refreshDelay(0), internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
convex/deviceSyncRuns.ts:112:     if (status === "running") await ctx.scheduler.runAfter(refreshDelay(0), internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
convex/deviceSyncRuns.ts:113:     return runId;
convex/deviceSyncRuns.ts:147:   if (!rule || rule.projectId !== args.projectId || rule.isActive === false) return null;
convex/deviceSyncRuns.ts:148:   const devices = await scheduleRuleDevices(ctx, rule);
convex/deviceSyncRuns.ts:158:     .filter(e => e.projectId === args.projectId && e.isActive === true).map(e => e._id))] };
convex/deviceSyncRuns.ts:159: }
convex/deviceSyncRuns.ts:256:     await ctx.db.patch(rule._id, { hikWeekPlanNo: weekPlanNo });
convex/deviceSyncRuns.ts:257:     return weekPlanNo;
convex/deviceSyncRuns.ts:329:     const status = args.skipped ? "skipped" : args.failure ? "failed" : args.directSent ? "sent" : "queued";
convex/deviceSyncRuns.ts:330:     const reason = (args.skipped ?? args.failure)?.slice(0, 2000);
convex/deviceSyncRuns.ts:331:     if (target.dispatchFinished === true && target.status === status && target.reason === reason) return;
convex/deviceSyncRuns.ts:332:     await ctx.db.patch(target._id, { dispatchFinished: true, status, reason, updatedAt: Date.now() });
convex/deviceSyncRuns.ts:332:     await ctx.db.patch(target._id, { dispatchFinished: true, status, reason, updatedAt: Date.now() });
convex/deviceSyncRuns.ts:333:   },
convex/deviceSyncRuns.ts:356:     const status = await refreshRun(ctx, args.runId);
convex/deviceSyncRuns.ts:357:     if (status !== "running") return;
convex/deviceSyncRuns.ts:384:       return { ...run, ...summarizeRun(targets.map(t => t.status), run.dispatchFinished === true) };
convex/deviceSyncRuns.ts:385:     }));
convex/deviceSyncRuns.ts:400:     const candidate = rule.isActive === false ? null : await ctx.db.query("deviceSyncRuns")
convex/deviceSyncRuns.ts:401:       .withIndex("by_project_kind_startedAt", q => q.eq("projectId", projectId).eq("kind", "project_resync"))
convex/deviceSyncRuns.ts:417:     return { ...run, ...summarizeRun([...targets.map(t => t.status), ...uncovered], run.dispatchFinished === true), targets, ...scopeInfo };
convex/deviceSyncRuns.ts:418:   },
convex/deviceSyncRuns.ts:428:     return { ...run, ...summarizeRun(targets.map(t => t.status), run.dispatchFinished === true), targets };
convex/deviceSyncRuns.ts:429:   },
convex/deviceSyncRuns.ts:451:   const runId = await ctx.db.insert("deviceSyncRuns", {
convex/deviceSyncRuns.ts:452:     projectId: args.projectId, kind: "rule_sync", ruleId: args.ruleId,
convex/deviceSyncRuns.ts:453:     startedBy: args.startedBy, startedAt, status: "running",
convex/deviceSyncRuns.ts:454:     counts: summarizeRun([], false).counts, dispatchFinished: true,
convex/deviceSyncRuns.ts:454:     counts: summarizeRun([], false).counts, dispatchFinished: true,
convex/deviceSyncRuns.ts:455:   });
convex/deviceSyncRuns.ts:458:     const targetId = await ctx.db.insert("deviceSyncRunTargets", {
convex/deviceSyncRuns.ts:459:       runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other",
convex/deviceSyncRuns.ts:460:       status: reason ? "skipped" : "queued", reason, updatedAt: startedAt,
convex/deviceSyncRuns.ts:461:     });
convex/deviceSyncRuns.ts:521:       removableOrphanCards: orphans.filter(row => row.managedByNgsplus === true).map(row => row.cardNumber),
convex/deviceSyncRuns.ts:522:     };
convex/deviceSyncRuns.ts:639:   if (runs.some(run => run.status === "running")) throw new ConvexError("Bu projede bir gönderim zaten çalışıyor");
convex/deviceSyncRuns.ts:640:   if (runs.length > 1000) throw new ConvexError("Gönderim geçmişi okuma sınırı aşıldı; çalışan gönderim denetlenemedi");
convex/deviceSyncRuns.ts:659:   const runId = await ctx.db.insert("deviceSyncRuns", { projectId: args.projectId, startedBy: args.startedBy, kind: "project_resync", status: "running", startedAt: now, counts: summarizeRun([], false).counts, dispatchFinished: true });
convex/deviceSyncRuns.ts:660:   for (const { device, employeeIds } of byDevice.values()) {
convex/deviceSyncRuns.ts:662:     const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other", status: reason ? "skipped" : "queued", reason, updatedAt: now });
convex/deviceSyncRuns.ts:663:     if (!reason) await ctx.scheduler.runAfter(0, internal.deviceSyncRuns.executeGrantTarget, { targetId, employeeIds: [...employeeIds] });
```

</details>

<details><summary>convex/devices.ts (43 yazma/durum eşleşmesi)</summary>

```text
convex/devices.ts:140:     status: v.optional(v.string()),
convex/devices.ts:141:     isActive: v.optional(v.boolean()),
convex/devices.ts:141:     isActive: v.optional(v.boolean()),
convex/devices.ts:142:     description: v.optional(v.string()),
convex/devices.ts:178:     status: v.optional(v.string()),
convex/devices.ts:179:     isActive: v.optional(v.boolean()),
convex/devices.ts:179:     isActive: v.optional(v.boolean()),
convex/devices.ts:180:     description: v.optional(v.union(v.null(), v.string())),
convex/devices.ts:181:     lastSeen: v.optional(v.string()),
convex/devices.ts:182:     deviceUsername: v.optional(v.string()),
convex/devices.ts:272:           await ctx.db.patch(poolDevice._id, { ideUuid, updatedAt: new Date().toISOString() });
convex/devices.ts:273:         }
convex/devices.ts:278:       clean.isActive = active;
convex/devices.ts:279:       clean.status = active ? "active" : "inactive";
convex/devices.ts:279:       clean.status = active ? "active" : "inactive";
convex/devices.ts:280:     }
convex/devices.ts:282:       const signal = deviceLastSignal({ ...device, lastSeen: args.lastSeen });
convex/devices.ts:283:       const nowMs = Date.now();
convex/devices.ts:288:     await ctx.db.patch(deviceId, toPatch(clean));
convex/devices.ts:289:     const changedSecrets = Object.entries(args).filter(([key, value]) =>
convex/devices.ts:303:           ctx.db.patch(door._id, { zoneId: args.zoneId, updatedAt: new Date().toISOString() })
convex/devices.ts:304:         )
convex/devices.ts:313:           ctx.db.patch(reader._id, { zoneId: args.zoneId, updatedAt: new Date().toISOString() })
convex/devices.ts:314:         )
convex/devices.ts:340:           await ctx.db.delete(device.adminDeviceId);
convex/devices.ts:341:         } else {
convex/devices.ts:342:           await ctx.db.patch(device.adminDeviceId, {
convex/devices.ts:343:             assignedDeviceId: undefined,
convex/devices.ts:413:       await ctx.db.patch(device._id, {
convex/devices.ts:414:         lastSeen: now,
convex/devices.ts:414:         lastSeen: now,
convex/devices.ts:415:         hikLastSeenAt: Date.parse(now),
convex/devices.ts:426:         await ctx.db.patch(adminDevice._id, { lastSeen: now });
convex/devices.ts:427:       }
convex/devices.ts:444:   await ctx.db.patch(deviceId, {
convex/devices.ts:445:     apiToken: token,
convex/devices.ts:532:         await ctx.db.patch(poolDevice._id, { ideUuid, updatedAt: new Date().toISOString() });
convex/devices.ts:533:       }
convex/devices.ts:535:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:536:       ideUuid,
convex/devices.ts:550:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:551:       lastSeen: now,
convex/devices.ts:551:       lastSeen: now,
convex/devices.ts:552:       status: "active",
convex/devices.ts:552:       status: "active",
convex/devices.ts:553:       updatedAt: now,
convex/devices.ts:579:     status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
convex/devices.ts:580:     projectId: v.optional(v.id("projects")),
convex/devices.ts:630:     status: v.optional(v.string()),
convex/devices.ts:631:     description: v.optional(v.string()),
convex/devices.ts:785:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:786:       hikDevIndex: args.hikDevIndex ?? undefined,
convex/devices.ts:796:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:797:       hikDoorCount: args.doorCount,
convex/devices.ts:806:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:807:       hikOfflineHint: args.hint,
convex/devices.ts:827:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:828:       hikWorkStatus: args.workStatus,
convex/devices.ts:841:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:842:       hikCapabilitiesSnapshot: args.snapshot,
convex/devices.ts:852:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:853:       hikLastRebootAt: args.at,
convex/devices.ts:880:     await ctx.db.patch(args.deviceId, { hikBackfillPending: args.pending });
convex/devices.ts:881:     return true;
convex/devices.ts:898:     await ctx.db.patch(args.deviceId, {
convex/devices.ts:899:       ...(args.cursor !== undefined ? { hikBackfillCursor: args.cursor } : {}),
convex/devices.ts:1038:     await ctx.db.patch(device._id, {
convex/devices.ts:1039:       // Offline durum sorgusu başarılı cihaz sinyali değildir.
convex/devices.ts:1045:       ...(args.online ? { lastSeen: nowIso } : {}),
convex/devices.ts:1046:     });
convex/devices.ts:1073:     status: v.union(v.literal("online"), v.literal("offline")), at: v.number(),
convex/devices.ts:1074:     source: v.optional(v.literal("snapshot")),
convex/devices.ts:1084:     const online = args.status === "online";
convex/devices.ts:1085:     const offlineFrom = device.hikIsupOfflineSince;
convex/devices.ts:1087:       await ctx.db.patch(device._id, { hikIsupStatusAt: args.at });
convex/devices.ts:1088:       return true;
convex/devices.ts:1093:       await ctx.db.insert("deviceEvents", {
convex/devices.ts:1094:         deviceId: device._id, projectId: device.projectId, source: "hikvision",
convex/devices.ts:1103:         await ctx.db.patch(alarm._id, { resolvedAt: new Date(args.at).toISOString(), updatedAt: new Date(now).toISOString() });
convex/devices.ts:1104:       }
convex/devices.ts:1106:     await ctx.db.patch(device._id, {
convex/devices.ts:1107:       hikIsupOnline: online, hikIsupStatusAt: args.at,
convex/devices.ts:1107:       hikIsupOnline: online, hikIsupStatusAt: args.at,
convex/devices.ts:1108:       hikIsupOfflineSince: online ? undefined : args.at,
convex/devices.ts:1129:     const eventId = await ctx.db.insert("deviceEvents", {
convex/devices.ts:1130:       deviceId: device._id, projectId: device.projectId, source: "hikvision",
```

</details>

<details><summary>convex/doorPlanInvalidation.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/doorPlanInvalidation.ts:19:     await ctx.db.patch(door._id, {
convex/doorPlanInvalidation.ts:20:       hikPlanRevision: revision,
```

</details>

<details><summary>convex/doors.ts (19 yazma/durum eşleşmesi)</summary>

```text
convex/doors.ts:173:     status: v.optional(v.string()),
convex/doors.ts:174:     ioId: v.optional(v.number()),
convex/doors.ts:226:     const doorId = await ctx.db.insert("doors", {
convex/doors.ts:227:       ...args,
convex/doors.ts:230:       status: args.status ?? "active",
convex/doors.ts:231:       createdAt: now,
convex/doors.ts:238:     await ctx.db.insert("readers", {
convex/doors.ts:239:       doorId,
convex/doors.ts:247:       status: "active",
convex/doors.ts:248:       createdAt: now,
convex/doors.ts:266:     status: v.optional(v.string()),
convex/doors.ts:267:     ioId: v.optional(v.number()),
convex/doors.ts:326:     await ctx.db.patch(doorId, { ...updates, updatedAt: now, ...(plansChanged ? {
convex/doors.ts:327:       hikPlanSavedAt: now, hikPlanRevision: (door.hikPlanRevision ?? 0) + 1,
convex/doors.ts:351:           await ctx.db.patch(reader._id, {
convex/doors.ts:352:             ...(name !== undefined ? { name } : {}),
convex/doors.ts:409:     await ctx.db.delete(args.doorId);
convex/doors.ts:410:     await Promise.all(ruleSnapshots.map((snapshot) =>
convex/doors.ts:636:       ...(!changed.includes("status") && door.hikPlanResults?.status ? { status: { ...door.hikPlanResults.status, revision } } : {}),
convex/doors.ts:637:       ...(!changed.includes("verify") && door.hikVerifyPlanSavedAt && door.hikPlanResults?.verify ? { verify: { ...door.hikPlanResults.verify, revision } } : {}),
convex/doors.ts:639:     await ctx.db.patch(door._id, {
convex/doors.ts:640:       ...(holidayChanged ? { hikDoorHolidayPlan: args.hikDoorHolidayPlan } : {}),
convex/doors.ts:661:         const result = key === "status" ? door.hikPlanResults?.status : door.hikPlanResults?.verify;
convex/doors.ts:662:         const plan = key === "status" ? door.hikDoorStatusPlan : door.hikVerifyPlanSavedAt && door.hikVerifyPlan;
convex/doors.ts:699:       await ctx.db.patch(door._id, {
convex/doors.ts:700:         hikPlanResults: { ...door.hikPlanResults, [args.key]: { revision: door.hikPlanRevision ?? 0, error, failedAt: new Date().toISOString() } },
convex/doors.ts:710:     await ctx.db.patch(door._id, { hikPlanResults: results, hikPlanApplyError: error || undefined,
convex/doors.ts:711:       ...(complete && !error ? { hikPlanAppliedAt: now, hikPlanPendingReason: undefined } : {}) });
convex/doors.ts:749:     await ctx.db.patch(doorId, { hikDoorHolidaySlots: slots });
convex/doors.ts:750:     return slots.slice(0, count);
convex/doors.ts:779:     await ctx.db.patch(door._id, { hikVerifyPlanReaderNos: [...readers] });
convex/doors.ts:780:   },
convex/doors.ts:803:     if (!op || op.status === "done") return;
convex/doors.ts:804:     const payload: unknown = op.payload;
convex/doors.ts:807:     await ctx.db.patch(op._id, { status: args.ok ? "done" : "failed", completedAt: args.ok ? Date.now() : undefined, attemptCount: op.attemptCount + 1, lastError: args.ok ? undefined : args.error ?? "Kapı yetkisi gönderilemedi" });
convex/doors.ts:808:     if (!employeeId || !op.projectId) return;
convex/doors.ts:811:     await upsertGrantStatus(ctx, { projectId: op.projectId, employeeId, deviceId: op.deviceId, state: args.ok ? args.removed ? "removed" : "effective" : "failed", lastRunId: op.runId, lastOperationId: op._id, lastError: args.error });
convex/doors.ts:812:   },
```

</details>

<details><summary>convex/employeeFingerprints.ts (3 yazma/durum eşleşmesi)</summary>

```text
convex/employeeFingerprints.ts:29:       if (delivery.fingerNo === args.fingerNo && delivery.deviceId !== args.sourceDeviceId && delivery.enrolledAt) await ctx.db.patch(delivery._id, { enrolledAt: "" });
convex/employeeFingerprints.ts:30:     }
convex/employeeFingerprints.ts:31:     if (existing) await ctx.db.replace(existing._id, value);
convex/employeeFingerprints.ts:32:     else await ctx.db.insert("employeeFingerprints", value);
convex/employeeFingerprints.ts:32:     else await ctx.db.insert("employeeFingerprints", value);
convex/employeeFingerprints.ts:33:     return null;
```

</details>

<details><summary>convex/employeeTermination.ts (37 yazma/durum eşleşmesi)</summary>

```text
convex/employeeTermination.ts:36:   await ctx.db.patch(employee._id, { isActive: false, updatedAt: now });
convex/employeeTermination.ts:37:   await scheduleFingerprintPurge(ctx, employee._id, employee.cardNumber, { deleteTemplates: true });
convex/employeeTermination.ts:85:     await ctx.db.patch(employeeId, updates);
convex/employeeTermination.ts:86:     if (args.employmentEndDate < today) {
convex/employeeTermination.ts:92:     await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: { ...updates, isActive: args.employmentEndDate < today ? false : employee.isActive }, note: "İşten ayrılma" });
convex/employeeTermination.ts:93:     return null;
convex/employeeTermination.ts:105:     await ctx.db.patch(employeeId, {
convex/employeeTermination.ts:106:       employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined,
convex/employeeTermination.ts:108:       isActive: true, updatedAt: new Date().toISOString(),
convex/employeeTermination.ts:109:     });
convex/employeeTermination.ts:189:     const targetEmployeeId = await ctx.db.insert("employees", {
convex/employeeTermination.ts:190:       projectId: args.targetProjectId, firstName: employee.firstName, lastName: employee.lastName,
convex/employeeTermination.ts:194:       departmentId: args.departmentId, companyId, cardNumber: "", isActive: true, transferredFromEmployeeId: employee._id,
convex/employeeTermination.ts:195:       createdAt: now, updatedAt: now,
convex/employeeTermination.ts:197:     const transferId = await ctx.db.insert("accessTransfers", {
convex/employeeTermination.ts:198:       kind: "employee", status: "revoking", sourceProjectId: employee.projectId, targetProjectId: args.targetProjectId,
convex/employeeTermination.ts:198:       kind: "employee", status: "revoking", sourceProjectId: employee.projectId, targetProjectId: args.targetProjectId,
convex/employeeTermination.ts:199:       employeeId: employee._id, targetEmployeeId, cardNumber: employee.cardNumber,
convex/employeeTermination.ts:206:       await ctx.db.insert("accessTransferTargets", { transferId, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
convex/employeeTermination.ts:207:     }
convex/employeeTermination.ts:208:     await ctx.db.patch(employee._id, { isActive: false, employmentEndDate: trTodayKey(), terminationType: "transfer", terminatedAt: now, terminatedBy: ctx.user._id, transferredToEmployeeId: targetEmployeeId, updatedAt: now });
convex/employeeTermination.ts:209:     await closeAccess(ctx, employee, now, [...devices.values()], transferId);
convex/employeeTermination.ts:210:     for (const member of memberships) await ctx.db.delete(member._id);
convex/employeeTermination.ts:211:     for (const table of ["employeeSessions", "employeeAuth"] as const) {
convex/employeeTermination.ts:213:       for (const row of rows) await ctx.db.delete(row._id);
convex/employeeTermination.ts:214:     }
convex/employeeTermination.ts:217:       await ctx.db.patch(transferId, { status: "revoked" });
convex/employeeTermination.ts:218:       await finishTransfer(ctx, transferId);
convex/employeeTermination.ts:238:     await ctx.db.patch(transferId, { status: "stuck", stuckReason: error, lastError: error });
convex/employeeTermination.ts:239:     return;
convex/employeeTermination.ts:241:   await ctx.db.patch(transferId, { status: "provisioning" });
convex/employeeTermination.ts:242:   const now = new Date().toISOString();
convex/employeeTermination.ts:243:   await ctx.db.patch(source._id, { cardNumber: "", transferredCardNumber: transfer.cardNumber, updatedAt: now });
convex/employeeTermination.ts:244:   await ctx.db.patch(target._id, { cardNumber: transfer.cardNumber, departmentId: transfer.targetPlan.departmentId, companyId, updatedAt: now });
convex/employeeTermination.ts:244:   await ctx.db.patch(target._id, { cardNumber: transfer.cardNumber, departmentId: transfer.targetPlan.departmentId, companyId, updatedAt: now });
convex/employeeTermination.ts:245:   await recordDepartmentChange(ctx, target._id);
convex/employeeTermination.ts:250:   await ctx.db.patch(transferId, { status: "done", completedAt: Date.now(), stuckReason: undefined, lastError: undefined });
convex/employeeTermination.ts:251:   const user = await ctx.db.get(transfer.requestedBy);
convex/employeeTermination.ts:252:   for (const projectId of [transfer.sourceProjectId, transfer.targetProjectId]) await writeAudit(ctx, { user, projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "done", employeeId: source._id, targetEmployeeId: target._id }, note: "Başka projeye taşıma tamamlandı" });
convex/employeeTermination.ts:253: }
convex/employeeTermination.ts:267:     await ctx.db.patch(transferId, { status: "cancelled", completedAt: Date.now() });
convex/employeeTermination.ts:268:     const targets = await transferTargets(ctx, transferId);
convex/employeeTermination.ts:270:       if (row.state !== "confirmed" && row.state !== "deviceRemoved") await ctx.db.patch(row._id, { state: "superseded", lastError: "Taşıma iptal edildi", updatedAt: Date.now() });
convex/employeeTermination.ts:271:       for (const status of ["pending", "processing", "failed"] as const) {
convex/employeeTermination.ts:273:         for (const op of ops) if ((op.operation === "deletePerson" || op.operation === "deleteCard") && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: "Taşıma iptal edildi" });
convex/employeeTermination.ts:274:       }
convex/employeeTermination.ts:277:         for (const op of ops) if (op.opType === "deleteUser" && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: "Taşıma iptal edildi" });
convex/employeeTermination.ts:278:       }
convex/employeeTermination.ts:280:     await ctx.db.patch(source._id, { employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined, sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined, transferredToEmployeeId: undefined, isActive: true, updatedAt: new Date().toISOString() });
convex/employeeTermination.ts:281:     for (const ruleId of transfer.sourceAccessRuleIds) {
convex/employeeTermination.ts:288:     await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "cancelled" }, note: "Başka projeye taşıma iptal edildi" });
convex/employeeTermination.ts:289:     return null;
convex/employeeTermination.ts:299:     if (targets.some(target => target.state === "superseded")) transferError("TRANSFER_SUPERSEDED", "Bir silme işi geçersiz kılındı. Taşımayı iptal edin veya ilgili cihazı kaynak projeden kaldırın.");
convex/employeeTermination.ts:300:     const source = await ctx.db.get(transfer.employeeId);
convex/employeeTermination.ts:302:     await ctx.db.patch(transferId, { status: "revoking", deadlineAt: Date.now() + TRANSFER_WINDOW_MS, stuckReason: undefined, lastError: undefined });
convex/employeeTermination.ts:303:     // Pending may itself have exhausted its Hik worker retries; requeue every unconfirmed target.
convex/employeeTermination.ts:304:     for (const row of targets) if (row.state === "failed" || row.state === "pending") {
convex/employeeTermination.ts:305:       const device = await ctx.db.get(row.deviceId);
convex/employeeTermination.ts:307:       await ctx.db.patch(row._id, { state: "pending", lastError: undefined, updatedAt: Date.now() });
convex/employeeTermination.ts:308:       await enqueueTransferDeletion(ctx, source, device, transferId);
convex/employeeTermination.ts:311:     await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "revoking" }, note: "Başka projeye taşıma yeniden denendi" });
convex/employeeTermination.ts:312:     return null;
convex/employeeTermination.ts:320:     for (const transfer of batch.page) await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "24 saat içinde tüm cihazlardan silme onayı alınamadı. Yeniden deneyin veya taşımayı iptal edin." });
convex/employeeTermination.ts:321:     if (!batch.isDone) await ctx.scheduler.runAfter(0, internal.employeeTermination.expireTransfers, { cursor: batch.continueCursor });
convex/employeeTermination.ts:353:       return { deviceId: target.deviceId, deviceName: device?.name ?? "Kaldırılan cihaz", brand: target.brand, state: target.state, lastSeen: device ? deviceLastSignal(device) ?? null : null, lastError: target.lastError ?? null, confirmedAt: target.confirmedAt ?? null };
convex/employeeTermination.ts:354:     }));
convex/employeeTermination.ts:355:     return { transferId: transfer._id, status: transfer.status, counterpartProjectName: counterpart?.name ?? "Silinen proje",
convex/employeeTermination.ts:356:       requestedAt: transfer.requestedAt, deadlineAt: transfer.deadlineAt, completedAt: transfer.completedAt ?? null,
convex/employeeTermination.ts:356:       requestedAt: transfer.requestedAt, deadlineAt: transfer.deadlineAt, completedAt: transfer.completedAt ?? null,
convex/employeeTermination.ts:357:       stuckReason: canSeeSource ? transfer.stuckReason ?? null : null, lastError: canSeeSource ? transfer.lastError ?? null : null,
convex/employeeTermination.ts:359:       targets, canCancel: canManage && (transfer.status === "revoking" || transfer.status === "stuck"),
convex/employeeTermination.ts:360:       canRetry: canManage && transfer.status === "stuck" && !rows.some(target => target.state === "superseded") };
convex/employeeTermination.ts:360:       canRetry: canManage && transfer.status === "stuck" && !rows.some(target => target.state === "superseded") };
convex/employeeTermination.ts:361:   },
```

</details>

<details><summary>convex/employees.ts (19 yazma/durum eşleşmesi)</summary>

```text
convex/employees.ts:96:     if (existing.source === "department") await ctx.db.patch(existing._id, { source: "manual" });
convex/employees.ts:97:     return false;
convex/employees.ts:99:   await ctx.db.insert("groupMembers", {
convex/employees.ts:100:     groupId: accessRuleId,
convex/employees.ts:231:     isActive: v.optional(v.boolean()),
convex/employees.ts:232:     notes: v.optional(v.string()),
convex/employees.ts:262:     const id = await ctx.db.insert("employees", {
convex/employees.ts:263:       ...args,
convex/employees.ts:268:       isActive: args.isActive ?? true,
convex/employees.ts:269:       createdAt: now,
convex/employees.ts:311:     isActive: v.optional(v.boolean()),
convex/employees.ts:312:     notes: v.optional(v.union(v.null(), v.string())),
convex/employees.ts:388:     await ctx.db.patch(employeeId, { ...toPatch(updates), ...photo, updatedAt: new Date().toISOString() });
convex/employees.ts:389:     if (updates.departmentId !== undefined || updates.companyId !== undefined) await recordDepartmentChange(ctx, employeeId, emp);
convex/employees.ts:397:       if (auth) await ctx.db.patch(auth._id, {
convex/employees.ts:398:         email: updates.email || undefined, setupToken: undefined, tokenExpiresAt: undefined, updatedAt: new Date().toISOString(),
convex/employees.ts:419:     if (activeChanged && updates.isActive === false) await scheduleFingerprintPurge(ctx, employeeId, emp.cardNumber, { deleteTemplates: true });
convex/employees.ts:420:     if (emp.employmentEndDate && updates.isActive === true && emp.isActive !== true) {
convex/employees.ts:420:     if (emp.employmentEndDate && updates.isActive === true && emp.isActive !== true) {
convex/employees.ts:421:       throw new Error("İşten ayrılan kişiyi aktifleştirmek için 'Geri al' kullanın.");
convex/employees.ts:472:     await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));
convex/employees.ts:473: 
convex/employees.ts:478:         await ctx.db.delete(record._id);
convex/employees.ts:479:       }
convex/employees.ts:485:     await ctx.db.delete(emp._id);
convex/employees.ts:486: }
convex/employees.ts:545:         await ctx.db.patch(emp._id, { departmentId: dept._id, updatedAt: new Date().toISOString() });
convex/employees.ts:546:         await recordDepartmentChange(ctx, emp._id, emp);
convex/employees.ts:562:     return candidates.find(row => row.isActive === true && row.terminationType !== "transfer") ?? candidates.find(row => row.terminationType !== "transfer") ?? employee;
convex/employees.ts:563:   },
convex/employees.ts:587:     return await ctx.db.insert("employeeAuth", {
convex/employees.ts:588:       employeeId: args.employeeId,
convex/employees.ts:620:     await ctx.db.patch(args.employeeId, {
convex/employees.ts:621:       projectId: args.projectId,
convex/employees.ts:639:         isActive: v.optional(v.boolean()),
convex/employees.ts:640:       }),
convex/employees.ts:671:         isActive: employee.isActive,
convex/employees.ts:672:       },
```

</details>

<details><summary>convex/fingerprintEnrollment.ts (31 yazma/durum eşleşmesi)</summary>

```text
convex/fingerprintEnrollment.ts:37:     if (!rule || rule.isActive === false || rule.projectId !== employee.projectId) continue;
convex/fingerprintEnrollment.ts:38:     const [links, doors] = await Promise.all([
convex/fingerprintEnrollment.ts:71:     enrollments: v.array(v.object({ _id: v.id("deviceFingerprintEnrollments"), deviceId: v.id("devices"), fingerNo: v.number(), enrolledAt: v.string(), deviceName: v.string() })),
convex/fingerprintEnrollment.ts:72:     templates: v.array(v.object({ fingerNo: v.number(), enrolledAt: v.string(), deviceIds: v.array(v.id("devices")) })),
convex/fingerprintEnrollment.ts:72:     templates: v.array(v.object({ fingerNo: v.number(), enrolledAt: v.string(), deviceIds: v.array(v.id("devices")) })),
convex/fingerprintEnrollment.ts:73:     active: v.boolean(),
convex/fingerprintEnrollment.ts:81:       _id: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, enrolledAt: row.enrolledAt,
convex/fingerprintEnrollment.ts:82:       deviceName: (await ctx.db.get(row.deviceId))?.name ?? "Silinmiş cihaz",
convex/fingerprintEnrollment.ts:85:       fingerNo: template.fingerPrintID, enrolledAt: new Date(template.addedAt).toISOString(),
convex/fingerprintEnrollment.ts:86:       deviceIds: [...new Set(rows.filter(row => row.fingerNo === template.fingerPrintID && !!row.enrolledAt && row.deletionEmployeeNo === undefined).map(row => row.deviceId))],
convex/fingerprintEnrollment.ts:90:       if (row.enrolledAt && !templates.some(template => template.fingerNo === row.fingerNo)) templates.push({ fingerNo: row.fingerNo, enrolledAt: row.enrolledAt, deviceIds: rows.filter(item => item.fingerNo === row.fingerNo && !!item.enrolledAt && item.deletionEmployeeNo === undefined).map(item => item.deviceId) });
convex/fingerprintEnrollment.ts:91:     }
convex/fingerprintEnrollment.ts:95:     })), enrollments, active: employee.isActive === true };
convex/fingerprintEnrollment.ts:96:   },
convex/fingerprintEnrollment.ts:137:     const state = { attemptId: crypto.randomUUID(), pendingUntil: Date.now() + 180_000, cancelRequested: false };
convex/fingerprintEnrollment.ts:138:     if (existing) await ctx.db.patch(existing._id, state);
convex/fingerprintEnrollment.ts:138:     if (existing) await ctx.db.patch(existing._id, state);
convex/fingerprintEnrollment.ts:139:     else await ctx.db.insert("deviceFingerprintEnrollments", { ...args, projectId: employee.projectId, enrolledAt: "", enrolledBy: ctx.user._id, ...state });
convex/fingerprintEnrollment.ts:139:     else await ctx.db.insert("deviceFingerprintEnrollments", { ...args, projectId: employee.projectId, enrolledAt: "", enrolledBy: ctx.user._id, ...state });
convex/fingerprintEnrollment.ts:140:     return state.attemptId;
convex/fingerprintEnrollment.ts:145:   args: { ...targetArgs, attemptId: v.string() },
convex/fingerprintEnrollment.ts:146:   returns: v.null(),
convex/fingerprintEnrollment.ts:151:     if (row?.attemptId === args.attemptId) await ctx.db.patch(row._id, { cancelRequested: true });
convex/fingerprintEnrollment.ts:152:     return null;
convex/fingerprintEnrollment.ts:157:   args: { ...targetArgs, attemptId: v.string() },
convex/fingerprintEnrollment.ts:158:   returns: v.boolean(),
convex/fingerprintEnrollment.ts:161:     return row?.attemptId === args.attemptId && !row.cancelRequested && (row.pendingUntil ?? 0) > Date.now();
convex/fingerprintEnrollment.ts:162:   },
convex/fingerprintEnrollment.ts:173:     await ctx.db.patch(op._id, { status: "done", completedAt: now, lastError: undefined });
convex/fingerprintEnrollment.ts:174:   }
convex/fingerprintEnrollment.ts:178:   args: { ...targetArgs, attemptId: v.string(), enrolledBy: v.id("users"), expectedCardNumber: v.string() },
convex/fingerprintEnrollment.ts:179:   returns: v.null(),
convex/fingerprintEnrollment.ts:184:     await ctx.db.patch(row._id, { enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber.trim(), enrolledBy: args.enrolledBy, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
convex/fingerprintEnrollment.ts:185:     await resolveFingerprintFailures(ctx, args.employeeId, args.deviceId, args.fingerNo);
convex/fingerprintEnrollment.ts:191:   args: { ...targetArgs, attemptId: v.string(), clearEnrolled: v.optional(v.boolean()) },
convex/fingerprintEnrollment.ts:192:   returns: v.null(),
convex/fingerprintEnrollment.ts:195:     if (row?.attemptId === args.attemptId && row.deletionEmployeeNo === undefined) {
convex/fingerprintEnrollment.ts:196:       if (!row.enrolledAt || args.clearEnrolled) await ctx.db.delete(row._id);
convex/fingerprintEnrollment.ts:196:       if (!row.enrolledAt || args.clearEnrolled) await ctx.db.delete(row._id);
convex/fingerprintEnrollment.ts:197:       else await ctx.db.patch(row._id, { attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
convex/fingerprintEnrollment.ts:197:       else await ctx.db.patch(row._id, { attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
convex/fingerprintEnrollment.ts:198:     }
convex/fingerprintEnrollment.ts:212: export const remove = internalMutation({ args: { enrollmentId: v.id("deviceFingerprintEnrollments") }, returns: v.null(), handler: async (ctx, args) => { if (await ctx.db.get(args.enrollmentId)) await ctx.db.delete(args.enrollmentId); return null; } });
convex/fingerprintEnrollment.ts:213: export const removeAllForEmployee = internalMutation({
convex/fingerprintEnrollment.ts:261:   args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), templateId: v.id("employeeFingerprints"), addedAt: v.number(), expectedCardNumber: v.string(), attemptId: v.string(), enrolledBy: v.optional(v.id("users")) },
convex/fingerprintEnrollment.ts:262:   returns: v.null(),
convex/fingerprintEnrollment.ts:271:     const value = { employeeId: args.employeeId, projectId: employee.projectId, deviceId: args.deviceId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber.trim(), enrolledBy, deletionEmployeeNo: undefined, deletionRequestedAt: undefined, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined };
convex/fingerprintEnrollment.ts:272:     await ctx.db.patch(row._id, value);
convex/fingerprintEnrollment.ts:272:     await ctx.db.patch(row._id, value);
convex/fingerprintEnrollment.ts:273:     await resolveFingerprintFailures(ctx, args.employeeId, args.deviceId, args.fingerNo);
convex/fingerprintEnrollment.ts:297:   returns: v.union(v.object({ current: v.literal(true) }), v.object({ enrollmentId: v.id("deviceFingerprintEnrollments"), attemptId: v.string() }), v.null()),
convex/fingerprintEnrollment.ts:298:   handler: async (ctx, args) => {
convex/fingerprintEnrollment.ts:307:     const state = { attemptId: crypto.randomUUID(), pendingUntil: Date.now() + 180_000, cancelRequested: false, deletionEmployeeNo: employee.cardNumber.trim(), deletionRequestedAt: Date.now() };
convex/fingerprintEnrollment.ts:308:     const enrollmentId = row ? row._id : await ctx.db.insert("deviceFingerprintEnrollments", { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: "", enrolledBy: template.enrolledBy, ...state });
convex/fingerprintEnrollment.ts:308:     const enrollmentId = row ? row._id : await ctx.db.insert("deviceFingerprintEnrollments", { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: "", enrolledBy: template.enrolledBy, ...state });
convex/fingerprintEnrollment.ts:309:     if (row) await ctx.db.patch(row._id, state);
convex/fingerprintEnrollment.ts:309:     if (row) await ctx.db.patch(row._id, state);
convex/fingerprintEnrollment.ts:310:     return { enrollmentId, attemptId: state.attemptId };
convex/fingerprintEnrollment.ts:310:     return { enrollmentId, attemptId: state.attemptId };
convex/fingerprintEnrollment.ts:311:   },
convex/fingerprintEnrollment.ts:320:     await ctx.db.patch(row._id, { deletionEmployeeNo: args.employeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), pendingUntil: undefined, cancelRequested: true });
convex/fingerprintEnrollment.ts:321:     await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots: [{ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: args.employeeNo }] });
```

</details>

<details><summary>convex/hikBridge.ts (3 yazma/durum eşleşmesi)</summary>

```text
convex/hikBridge.ts:29:     await ctx.db.patch(bridge._id, { nextWakeAt: plan.fireAt });
convex/hikBridge.ts:30:     await ctx.scheduler.runAt(plan.fireAt, internal.actions.hikBridgeWake.wake, { bridgeId: bridge._id });
convex/hikBridge.ts:44:     const bridgeId = await ctx.db.insert("hikBridges", {
convex/hikBridge.ts:45:       projectId: args.projectId,
convex/hikBridge.ts:79:     await ctx.db.delete(args.bridgeId);
convex/hikBridge.ts:80:   },
```

</details>

<details><summary>convex/hikDeviceImport.ts (9 yazma/durum eşleşmesi)</summary>

```text
convex/hikDeviceImport.ts:29:   if (row.status === "matched" && row.matchedEmployeeId) {
convex/hikDeviceImport.ts:30:     const employeeId = row.matchedEmployeeId;
convex/hikDeviceImport.ts:62:     const employeeId = await ctx.db.insert("employees", {
convex/hikDeviceImport.ts:63:       ...splitDevicePersonName(row.name), email: "", cardNumber: row.employeeNo,
convex/hikDeviceImport.ts:75:         ruleId = await ctx.db.insert("accessRules", { name, projectId: device.projectId, isActive: true, startTime: "00:00", endTime: "23:59", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], createdAt: now, updatedAt: now });
convex/hikDeviceImport.ts:76:         await ctx.db.insert("groupDevices", { groupId: ruleId, deviceId: args.deviceId, projectId: device.projectId, createdAt: now });
convex/hikDeviceImport.ts:76:         await ctx.db.insert("groupDevices", { groupId: ruleId, deviceId: args.deviceId, projectId: device.projectId, createdAt: now });
convex/hikDeviceImport.ts:77:       } else {
convex/hikDeviceImport.ts:82:         if (!rule || rule.isActive === false || rule.startTime !== "00:00" || rule.endTime !== "23:59" || rule.days?.length !== 7 || links.length !== 1 || links[0]?.deviceId !== args.deviceId || doors.length) throw new Error("Aktarım kuralı değiştirilmiş; erişim kapsamını kontrol edin");
convex/hikDeviceImport.ts:83:       }
convex/hikDeviceImport.ts:110:     const value = { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber, enrolledBy: user._id };
convex/hikDeviceImport.ts:111:     if (existing) await ctx.db.patch(existing._id, value);
convex/hikDeviceImport.ts:111:     if (existing) await ctx.db.patch(existing._id, value);
convex/hikDeviceImport.ts:112:     else await ctx.db.insert("deviceFingerprintEnrollments", value);
convex/hikDeviceImport.ts:112:     else await ctx.db.insert("deviceFingerprintEnrollments", value);
convex/hikDeviceImport.ts:113:     await ctx.db.insert("employeeFingerprints", { employeeId: args.employeeId, projectId: employee.projectId, fingerPrintID: args.fingerNo, encData: args.encData, iv: args.iv, keyVersion: args.keyVersion, sourceDeviceId: args.deviceId, enrolledBy: args.userId, addedAt: Date.now() });
convex/hikDeviceImport.ts:113:     await ctx.db.insert("employeeFingerprints", { employeeId: args.employeeId, projectId: employee.projectId, fingerPrintID: args.fingerNo, encData: args.encData, iv: args.iv, keyVersion: args.keyVersion, sourceDeviceId: args.deviceId, enrolledBy: args.userId, addedAt: Date.now() });
convex/hikDeviceImport.ts:114:   },
```

</details>

<details><summary>convex/hikvisionSync.ts (66 yazma/durum eşleşmesi)</summary>

```text
convex/hikvisionSync.ts:87:     return employee ? { isActive: employee.isActive, terminationType: employee.terminationType, projectId: employee.projectId, cardNumber: employee.cardNumber } : null;
convex/hikvisionSync.ts:88:   },
convex/hikvisionSync.ts:171:       isActive: employee.isActive,
convex/hikvisionSync.ts:172:       accessStartsAt: employee.accessStartsAt,
convex/hikvisionSync.ts:266:         isActive: rule.isActive,
convex/hikvisionSync.ts:267:         startTime: rule.startTime,
convex/hikvisionSync.ts:294:     await ctx.db.patch(rule._id, { hikWeekPlanNo: weekPlanNo });
convex/hikvisionSync.ts:295:     return weekPlanNo;
convex/hikvisionSync.ts:398:     await ctx.db.insert("hikPendingOperations", {
convex/hikvisionSync.ts:399:       deviceId: args.deviceId,
convex/hikvisionSync.ts:403:       status: "failed",
convex/hikvisionSync.ts:404:       attemptCount: 1,
convex/hikvisionSync.ts:421:     const id = await ctx.db.insert("hikPendingOperations", {
convex/hikvisionSync.ts:422:       deviceId: args.deviceId, projectId: args.projectId, runId: args.runId, operation: "deletePerson",
convex/hikvisionSync.ts:424:       status: "failed", attemptCount: 0, createdAt: Date.now(), lastError: "Silme onayı bekleniyor — cihazda kalmış olabilir",
convex/hikvisionSync.ts:425:     });
convex/hikvisionSync.ts:477:         await ctx.db.patch(existing._id, {
convex/hikvisionSync.ts:478:           projectId: args.projectId,
convex/hikvisionSync.ts:480:           status: "pending",
convex/hikvisionSync.ts:481:           attemptCount: 0,
convex/hikvisionSync.ts:482:           nextRetryAt: now,
convex/hikvisionSync.ts:483:           processingStartedAt: undefined,
convex/hikvisionSync.ts:484:           completedAt: undefined,
convex/hikvisionSync.ts:485:           claimedBy: undefined,
convex/hikvisionSync.ts:493:     const opId = await ctx.db.insert("hikPendingOperations", {
convex/hikvisionSync.ts:494:       deviceId: args.deviceId,
convex/hikvisionSync.ts:499:       status: "pending",
convex/hikvisionSync.ts:500:       attemptCount: 0,
convex/hikvisionSync.ts:501:       nextRetryAt: now,
convex/hikvisionSync.ts:502:       createdAt: now,
convex/hikvisionSync.ts:572:           ctx.db.patch(op._id, {
convex/hikvisionSync.ts:573:             status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
convex/hikvisionSync.ts:573:             status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
convex/hikvisionSync.ts:574:             nextRetryAt: now,
convex/hikvisionSync.ts:574:             nextRetryAt: now,
convex/hikvisionSync.ts:575:             lastError: "Bridge claim timeout; pending'e alındı",
convex/hikvisionSync.ts:592:         await ctx.db.patch(op._id, { status: "done", completedAt: now, lastError: TRANSFER_INVALID_OPERATION });
convex/hikvisionSync.ts:593:         continue;
convex/hikvisionSync.ts:597:         await ctx.db.patch(op._id, { status: "failed", lastError: "MOBILE_COMMAND_NOT_DELIVERABLE" });
convex/hikvisionSync.ts:598:         continue;
convex/hikvisionSync.ts:603:         await ctx.db.patch(op._id, { status: "failed", attemptCount: 5, lastError: "Biyometri modülü kapalı; işlem gönderilmedi." });
convex/hikvisionSync.ts:604:         continue;
convex/hikvisionSync.ts:607:         await ctx.db.patch(op._id, { status: "failed", lastError: deletionUnresolvableReason(op, device) });
convex/hikvisionSync.ts:608:         continue;
convex/hikvisionSync.ts:621:         ctx.db.patch(op._id, {
convex/hikvisionSync.ts:622:           status: "processing",
convex/hikvisionSync.ts:622:           status: "processing",
convex/hikvisionSync.ts:623:           attemptCount: op.attemptCount + 1,
convex/hikvisionSync.ts:691:       await ctx.db.patch(args.opId, {
convex/hikvisionSync.ts:692:         status: "done",
convex/hikvisionSync.ts:692:         status: "done",
convex/hikvisionSync.ts:693:         completedAt: Date.now(),
convex/hikvisionSync.ts:693:         completedAt: Date.now(),
convex/hikvisionSync.ts:694:         lastError: undefined,
convex/hikvisionSync.ts:701:     await ctx.db.patch(args.opId, {
convex/hikvisionSync.ts:702:       status: "failed",
convex/hikvisionSync.ts:702:       status: "failed",
convex/hikvisionSync.ts:703:       lastError: message ?? "Bridge operation failed",
convex/hikvisionSync.ts:732:         ctx.db.patch(op._id, {
convex/hikvisionSync.ts:733:           status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
convex/hikvisionSync.ts:733:           status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
convex/hikvisionSync.ts:734:           nextRetryAt: now,
convex/hikvisionSync.ts:734:           nextRetryAt: now,
convex/hikvisionSync.ts:735:           lastError: "Bridge processing timeout; pending'e alındı",
convex/hikvisionSync.ts:744:  * UI banner için: çözümlenmemiş (status=failed) sync hatalarını döner.
convex/hikvisionSync.ts:745:  * payload field'ı UI'ya **döndürülmez** (PII leak vektörünü kapatmak için).
convex/hikvisionSync.ts:765:         status: op.status, lastError: op.lastError ?? null, createdAt: op.createdAt,
convex/hikvisionSync.ts:766:         nextRetryAt: op.nextRetryAt,
convex/hikvisionSync.ts:766:         nextRetryAt: op.nextRetryAt,
convex/hikvisionSync.ts:767:         operation: op.operation, deviceBrand: device?.brand ?? null, attemptCount: op.attemptCount, attempts: op.attemptCount, maxAttempts: 5, canRetry: isPersonDeletion(op) ? deletionUnresolvableReason(op, device) === undefined : device?.hikTransport === "localBridge",
convex/hikvisionSync.ts:794:         oldValue: { status: op.status }, newValue: { status: op.status, dismissedAt: now }, note: `Çözülemez silme uyarısı açıkça kapatıldı: ${reason}` });
convex/hikvisionSync.ts:795:     }
convex/hikvisionSync.ts:797:     await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
convex/hikvisionSync.ts:798:   },
convex/hikvisionSync.ts:802:  * Worker için retry kandidatlarını döner — status=failed, attemptCount<max,
convex/hikvisionSync.ts:803:  * device.hikLastSeenAt son N ms içinde güncellenmiş, ihtiyaç duyulan ilişkili
convex/hikvisionSync.ts:822:       if (device?.hikTransport !== "localBridge") await ctx.db.patch(op._id, { status: "failed", nextRetryAt: now, lastError: "İşlem zaman aşımına uğradı; yeniden denenecek" });
convex/hikvisionSync.ts:823:     }
convex/hikvisionSync.ts:839:             await ctx.db.patch(f._id, { status: "done", completedAt: now, lastError: TRANSFER_INVALID_OPERATION });
convex/hikvisionSync.ts:840:             return null;
convex/hikvisionSync.ts:844:             await ctx.db.patch(f._id, { nextRetryAt: Number.MAX_SAFE_INTEGER });
convex/hikvisionSync.ts:845:             return null;
convex/hikvisionSync.ts:850:             await ctx.db.patch(f._id, { nextRetryAt: permanent ? Number.MAX_SAFE_INTEGER : now + 3 * 60 * 1000 });
convex/hikvisionSync.ts:851:             return null;
convex/hikvisionSync.ts:861:             ? device.hikIsupOnline === true
convex/hikvisionSync.ts:862:             : device.hikLastSeenAt !== undefined && device.hikLastSeenAt >= onlineCutoff;
convex/hikvisionSync.ts:912:     for (const candidate of candidates) if (isTransferAddition(candidate)) await ctx.db.patch(candidate._id, { status: "processing", processingStartedAt: now });
convex/hikvisionSync.ts:913:     return candidates;
convex/hikvisionSync.ts:922:     if (!op || (op.status !== "failed" && !(op.status === "processing" && isTransferAddition(op)))) return;
convex/hikvisionSync.ts:923:     if (op.operation === "deletePerson" || op.operation === "deleteCard") await transferOperationFailed(ctx, op, args.reason, "superseded");
convex/hikvisionSync.ts:924:     await ctx.db.patch(args.id, { status: "done", completedAt: Date.now(), lastError: args.reason });
convex/hikvisionSync.ts:925:   },
convex/hikvisionSync.ts:935:     if (!op || op.status === "done" || op.dismissedAt !== undefined) return;
convex/hikvisionSync.ts:936:     if (op && ["addPerson", "updatePerson", "addCard", "deletePerson"].includes(op.operation)) await grantStatusForOperation(ctx, op, op.operation === "deletePerson" ? "removed" : "effective");
convex/hikvisionSync.ts:937:     await ctx.db.patch(args.id, {
convex/hikvisionSync.ts:938:       status: "done",
convex/hikvisionSync.ts:938:       status: "done",
convex/hikvisionSync.ts:939:       completedAt: Date.now(),
convex/hikvisionSync.ts:939:       completedAt: Date.now(),
convex/hikvisionSync.ts:940:       lastError: undefined,
convex/hikvisionSync.ts:1000:         if (args.cardNumber && ["deletePerson", "deleteCard"].includes(f.operation)) writes.push(ctx.db.patch(f._id, { dismissedAt: now }));
convex/hikvisionSync.ts:1001:         continue;
convex/hikvisionSync.ts:1004:         ctx.db.patch(f._id, { status: "done", completedAt: now }),
convex/hikvisionSync.ts:1005:       );
convex/hikvisionSync.ts:1022:     if (!row || row.status === "done" || row.dismissedAt !== undefined) return;
convex/hikvisionSync.ts:1023:     const lastError = row.operation === "deletePerson" || row.operation === "deleteCard"
convex/hikvisionSync.ts:1026:     await ctx.db.patch(args.id, {
convex/hikvisionSync.ts:1027:       status: "failed",
convex/hikvisionSync.ts:1027:       status: "failed",
convex/hikvisionSync.ts:1028:       attemptCount: row.attemptCount + 1,
convex/hikvisionSync.ts:1078:         patches.push(ctx.db.patch(f._id, { status: "done", completedAt: now, dismissedAt: now }));
convex/hikvisionSync.ts:1079:       }
convex/hikvisionSync.ts:1105:     const targets = requested.filter((op) => op.operation !== "deletePerson" && op.operation !== "deleteCard" && op.status === "failed" && op.dismissedAt === undefined).slice(0, 100);
convex/hikvisionSync.ts:1106:     const now = Date.now();
convex/hikvisionSync.ts:1108:       await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
convex/hikvisionSync.ts:1109:     }
convex/hikvisionSync.ts:1137:       await ctx.db.patch(op._id, { status: "failed", nextRetryAt: Date.now(), attemptCount: 0, dismissedAt: undefined, dismissedBy: undefined });
convex/hikvisionSync.ts:1138:       await ctx.scheduler.runAfter(0, internal.actions.hikQueueWorker.processHikOperation, { issueId: op._id });
convex/hikvisionSync.ts:1142:     await ctx.db.patch(op._id, {
convex/hikvisionSync.ts:1143:       status: "pending", nextRetryAt: Date.now(),
convex/hikvisionSync.ts:1143:       status: "pending", nextRetryAt: Date.now(),
convex/hikvisionSync.ts:1144:       attemptCount: 0, processingStartedAt: undefined, completedAt: undefined, claimedBy: undefined,
convex/hikvisionSync.ts:1144:       attemptCount: 0, processingStartedAt: undefined, completedAt: undefined, claimedBy: undefined,
convex/hikvisionSync.ts:1145:       dismissedAt: undefined, dismissedBy: undefined, lastError: undefined,
convex/hikvisionSync.ts:1188:   await ctx.db.patch(id, { status: "done", completedAt: Date.now(), lastError: SUPERSEDED_DELETION });
convex/hikvisionSync.ts:1189: }
convex/hikvisionSync.ts:1206:     if (employee.projectId !== device.projectId || employee.isActive === false) continue;
convex/hikvisionSync.ts:1207:     if (await hasWritableHikCredential(ctx, employee, device)) {
convex/hikvisionSync.ts:1223:     if (!op || op.status === "done" || op.dismissedAt !== undefined) return true;
convex/hikvisionSync.ts:1224:     const cardNumber = deletionIdentity(op);
convex/hikvisionSync.ts:1247:   const rows = (await Promise.all((["failed", "pending", "processing"] as const).map(status =>
convex/hikvisionSync.ts:1248:     ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", args.deviceId).eq("status", status)).take(1001),
```

</details>

<details><summary>convex/http.ts (16 yazma/durum eşleşmesi)</summary>

```text
convex/http.ts:26:     if (credentials.kind !== "token") return new Response(null, { status: 401 });
convex/http.ts:27:     const device = await ctx.runQuery(internal.devices.getByApiToken, { token: credentials.token });
convex/http.ts:28:     if (!device) return new Response(null, { status: 401 });
convex/http.ts:29:     let body: unknown;
convex/http.ts:30:     try { body = await request.json(); } catch { return new Response(null, { status: 400 }); }
convex/http.ts:31:     if (typeof body !== "object" || body === null ||
convex/http.ts:36:       ("source" in body && body.source !== "snapshot")) return new Response(null, { status: 400 });
convex/http.ts:37:     if (device.brand !== "hikvision" || device.hikTransport === "localBridge" || device.hikDevIndex !== body.devIndex) {
convex/http.ts:38:       return new Response(null, { status: 403 });
convex/http.ts:39:     }
convex/http.ts:41:       deviceId: device._id, devIndex: body.devIndex, status: body.status, at: body.at,
convex/http.ts:42:       ...("source" in body ? { source: "snapshot" as const } : {}),
convex/http.ts:44:     return new Response(null, { status: accepted ? 200 : 403 });
convex/http.ts:45:   }),
convex/http.ts:66:     { status: 401, headers: { "Content-Type": "application/json" } },
convex/http.ts:67:   );
convex/http.ts:80:       { status: 200, headers: { "Content-Type": "application/json" } }
convex/http.ts:81:     );
convex/http.ts:179:             { status: 403, headers: { "Content-Type": "application/json" } },
convex/http.ts:180:           );
convex/http.ts:239:           status: 200,
convex/http.ts:240:           headers: { "Content-Type": "application/json" },
convex/http.ts:291:         status: 200,
convex/http.ts:292:         headers: { "Content-Type": "application/json" },
convex/http.ts:299:         { status: 500, headers: { "Content-Type": "application/json" } }
convex/http.ts:300:       );
convex/http.ts:319:       status: 401,
convex/http.ts:320:       headers: { "Content-Type": "application/json" },
convex/http.ts:326: const jsonResponse = (body: unknown, status = 200): Response =>
convex/http.ts:327:   new Response(JSON.stringify(body), {
convex/http.ts:484:       status: 200,
convex/http.ts:485:       headers: { "Content-Type": "application/json" },
```

</details>

<details><summary>convex/ideDefaults.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/ideDefaults.ts:47:       await ctx.db.patch(existing._id, {
convex/ideDefaults.ts:48:         ideUser: args.ideUser,
convex/ideDefaults.ts:55:     return await ctx.db.insert("ideDefaults", {
convex/ideDefaults.ts:56:       ideUser: args.ideUser,
```

</details>

<details><summary>convex/ideSync.ts (57 yazma/durum eşleşmesi)</summary>

```text
convex/ideSync.ts:187:   managedByNgsplus: boolean,
convex/ideSync.ts:188: ): Promise<void> {
convex/ideSync.ts:195:     await ctx.db.patch(existing._id, { deviceId, projectId, syncedAt: Date.now() });
convex/ideSync.ts:196:   } else {
convex/ideSync.ts:197:     await ctx.db.insert("idePanelUsers", {
convex/ideSync.ts:198:       ideUuid,
convex/ideSync.ts:218:   if (existing) await ctx.db.delete(existing._id);
convex/ideSync.ts:219: }
convex/ideSync.ts:336:       const open = existing.find((o) => o.status === "pending" || o.status === "sent");
convex/ideSync.ts:337:       if (open) {
convex/ideSync.ts:338:         await ctx.db.patch(open._id, {
convex/ideSync.ts:339:           payload,
convex/ideSync.ts:341:           status: doorError ? "failed" : "pending",
convex/ideSync.ts:342:           msxId: undefined,
convex/ideSync.ts:343:           nextRetryAt: now,
convex/ideSync.ts:344:           lastError,
convex/ideSync.ts:351:     const opId = await ctx.db.insert("idePendingOperations", {
convex/ideSync.ts:352:       projectId: args.projectId,
convex/ideSync.ts:357:       status: doorError ? "failed" : "pending",
convex/ideSync.ts:358:       lastError,
convex/ideSync.ts:362:       nextRetryAt: now,
convex/ideSync.ts:363:       createdAt: now,
convex/ideSync.ts:397:       if (employee.projectId !== device.projectId || employee.isActive === false || cardNumericKey(employee.cardNumber) !== key) continue;
convex/ideSync.ts:398:       const end = accessEndsAtMs(employee);
convex/ideSync.ts:411:       if (latestUpsert?.status === "failed") continue;
convex/ideSync.ts:412:       let writable = false;
convex/ideSync.ts:433:   await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), responseMessage: "superseded: Kart aktif bir kişinin güncel kimliği; silme atlandı", lastError: undefined });
convex/ideSync.ts:434: }
convex/ideSync.ts:495:       await ctx.db.patch(op._id, { status: "pending", sentAt: undefined, nextRetryAt: Date.now() });
convex/ideSync.ts:496:     }
convex/ideSync.ts:501:         await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/ideSync.ts:502:         continue;
convex/ideSync.ts:510:         await ctx.db.patch(op._id, { status: "failed", lastError: reason });
convex/ideSync.ts:511:         if (op.opType === "deleteUser") await transferOperationFailed(ctx, op, reason);
convex/ideSync.ts:522:         await ctx.db.patch(op.opId, { status: "sent", msxId: undefined, sentAt: Date.now(), nextRetryAt: Date.now() + DEFAULT_ACK_TIMEOUT_MS, attempts: queued.attempts + (op.opType === "upsertUser" ? 0 : 1) });
convex/ideSync.ts:523:       }
convex/ideSync.ts:535:     const reserved = op && (mobile || op.opType === "upsertUser" || op.opType === "openDoor") && op.status === "sent" && op.msxId === undefined;
convex/ideSync.ts:536:     if (mobile && (!Number.isSafeInteger(args.msxId) || (op.status !== "pending" && !reserved) || !(await mobileQueueAllowed(ctx, op)))) {
convex/ideSync.ts:541:       await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/ideSync.ts:542:       return false;
convex/ideSync.ts:549:       await ctx.db.patch(op._id, { status: "failed", lastError: "Komut süresi doldu" });
convex/ideSync.ts:550:       return false;
convex/ideSync.ts:552:     await ctx.db.patch(args.opId, {
convex/ideSync.ts:553:       status: "sent",
convex/ideSync.ts:553:       status: "sent",
convex/ideSync.ts:554:       msxId: args.msxId,
convex/ideSync.ts:555:       sentAt: Date.now(),
convex/ideSync.ts:556:       nextRetryAt: Date.now() + DEFAULT_ACK_TIMEOUT_MS,
convex/ideSync.ts:556:       nextRetryAt: Date.now() + DEFAULT_ACK_TIMEOUT_MS,
convex/ideSync.ts:557:       attempts: reserved && op.opType !== "upsertUser" ? op.attempts : op.attempts + 1,
convex/ideSync.ts:600:     const lateTransferSuccess = op.status === "failed" && op.opType === "deleteUser" &&
convex/ideSync.ts:601:       (args.result === "success" || (args.result === "fail" && (args.errorCode === "not_found" || (args.errorCode === undefined && isAlreadyGoneError(args.message))))) &&
convex/ideSync.ts:622:       await ctx.db.patch(args.opId, {
convex/ideSync.ts:623:         status: "acked",
convex/ideSync.ts:623:         status: "acked",
convex/ideSync.ts:624:         ackedAt: Date.now(),
convex/ideSync.ts:624:         ackedAt: Date.now(),
convex/ideSync.ts:625:         responseMessage: args.message,
convex/ideSync.ts:664:         await ctx.db.patch(args.opId, {
convex/ideSync.ts:665:           payload: { ...payload, mode: "update" },
convex/ideSync.ts:666:           status: "pending",
convex/ideSync.ts:667:           msxId: undefined,
convex/ideSync.ts:668:           nextRetryAt: Date.now(),
convex/ideSync.ts:669:           lastError: "already exists → update_data ile yeniden denenecek",
convex/ideSync.ts:682:       await ctx.db.patch(args.opId, {
convex/ideSync.ts:683:         status: "acked",
convex/ideSync.ts:683:         status: "acked",
convex/ideSync.ts:684:         ackedAt: Date.now(),
convex/ideSync.ts:684:         ackedAt: Date.now(),
convex/ideSync.ts:685:         responseMessage: args.message,
convex/ideSync.ts:703:       await ctx.db.patch(args.opId, {
convex/ideSync.ts:704:         status: "failed",
convex/ideSync.ts:704:         status: "failed",
convex/ideSync.ts:705:         lastError: args.message ?? args.result,
convex/ideSync.ts:708:       await ctx.db.patch(args.opId, {
convex/ideSync.ts:709:         status: "pending",
convex/ideSync.ts:709:         status: "pending",
convex/ideSync.ts:710:         msxId: undefined,
convex/ideSync.ts:711:         nextRetryAt: Date.now() + backoffMs(op.attempts),
convex/ideSync.ts:712:         lastError: args.message ?? args.result,
convex/ideSync.ts:738:           await ctx.db.patch(op._id, { status: "failed", lastError: "ack timeout (cron)" });
convex/ideSync.ts:739:           if (op.opType === "deleteUser") await transferOperationFailed(ctx, op, "ack timeout (cron)");
convex/ideSync.ts:742:           await ctx.db.patch(op._id, {
convex/ideSync.ts:743:             status: "pending",
convex/ideSync.ts:743:             status: "pending",
convex/ideSync.ts:744:             msxId: undefined,
convex/ideSync.ts:745:             nextRetryAt: now,
convex/ideSync.ts:746:             lastError: "ack timeout (cron)",
convex/ideSync.ts:751:         await ctx.db.patch(op._id, { nextRetryAt: deadline });
convex/ideSync.ts:752:       }
convex/ideSync.ts:792:       const id = await ctx.db.insert("ideSequences", { name: "permissionNo", last });
convex/ideSync.ts:793:       sequence = await ctx.db.get(id);
convex/ideSync.ts:800:     await ctx.db.patch(sequence._id, { last });
convex/ideSync.ts:801:   }
convex/ideSync.ts:805:   if (primary !== rule.idePermissionNo || JSON.stringify(patch.ideExtraPermissionNos) !== JSON.stringify(rule.ideExtraPermissionNos ?? [])) await ctx.db.patch(rule._id, patch);
convex/ideSync.ts:806:   const retired = old.filter(n => !nos.includes(n));
convex/ideSync.ts:885:         status: op.status, lastError: op.lastError ?? null, createdAt: op.createdAt,
convex/ideSync.ts:886:         nextRetryAt: op.nextRetryAt,
convex/ideSync.ts:886:         nextRetryAt: op.nextRetryAt,
convex/ideSync.ts:887:         opType: op.opType, attempts: op.attempts, maxAttempts: op.maxAttempts ?? 5, canRetry: device?.brand === "ide_smart",
convex/ideSync.ts:903:         status: o.status,
convex/ideSync.ts:904:         opType: o.opType,
convex/ideSync.ts:922:     await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, Date.now()));
convex/ideSync.ts:923:   },
convex/ideSync.ts:943:     const targets = requested.filter((op) => op.status === "failed" && op.dismissedAt === undefined).slice(0, 100);
convex/ideSync.ts:944:     const now = Date.now();
convex/ideSync.ts:946:       await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
convex/ideSync.ts:947:     }
convex/ideSync.ts:968:     await ctx.db.patch(op._id, {
convex/ideSync.ts:969:       status: "pending", nextRetryAt: Date.now(),
convex/ideSync.ts:969:       status: "pending", nextRetryAt: Date.now(),
convex/ideSync.ts:970:       attempts: 0, msxId: undefined, sentAt: undefined, ackedAt: undefined, responseMessage: undefined,
convex/ideSync.ts:970:       attempts: 0, msxId: undefined, sentAt: undefined, ackedAt: undefined, responseMessage: undefined,
convex/ideSync.ts:971:       dismissedAt: undefined, dismissedBy: undefined, lastError: undefined,
```

</details>

<details><summary>convex/lib/accessDecision.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/accessDecision.ts:19:   /** isActive === true olan kural id'leri */
convex/lib/accessDecision.ts:20:   activeRuleIds: ReadonlySet<T>;
```

</details>

<details><summary>convex/lib/accessGraph.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/accessGraph.ts:155:       if (!rule || rule.isActive === false) return;
convex/lib/accessGraph.ts:156:       activeRuleIds.add(ruleId);
```

</details>

<details><summary>convex/lib/accessRuleRead.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/accessRuleRead.ts:112:       isActive: rule.isActive,
convex/lib/accessRuleRead.ts:113:       groupMembers: groupMembers.map(({ employeeId }) => ({ employeeId })),
```

</details>

<details><summary>convex/lib/accessRuleSummary.ts (13 yazma/durum eşleşmesi)</summary>

```text
convex/lib/accessRuleSummary.ts:36:   isActive: boolean | undefined,
convex/lib/accessRuleSummary.ts:37:   status: "all" | "active" | "inactive",
convex/lib/accessRuleSummary.ts:37:   status: "all" | "active" | "inactive",
convex/lib/accessRuleSummary.ts:38: ) {
convex/lib/accessRuleSummary.ts:39:   return status === "all" || (isActive ?? true) === (status === "active");
convex/lib/accessRuleSummary.ts:40: }
convex/lib/accessRuleSummary.ts:96: ): { phase: "active" | "legacy"; cursor: string | null } {
convex/lib/accessRuleSummary.ts:97:   if (!cursor) return { phase: "active", cursor: null };
convex/lib/accessRuleSummary.ts:97:   if (!cursor) return { phase: "active", cursor: null };
convex/lib/accessRuleSummary.ts:98:   const value: unknown = JSON.parse(cursor);
convex/lib/accessRuleSummary.ts:111:   return { phase: value.phase, cursor: value.cursor };
convex/lib/accessRuleSummary.ts:112: }
convex/lib/accessRuleSummary.ts:122:   status: "all" | "active" | "inactive",
convex/lib/accessRuleSummary.ts:123:   personnelTypes: (string | undefined)[] = [],
convex/lib/accessRuleSummary.ts:127:     status === "active" ? [true, undefined] : status === "inactive" ? [false] : ["all"];
convex/lib/accessRuleSummary.ts:128:   return types.flatMap(targetType => activeStates.map(isActive => ({ targetType, isActive })));
convex/lib/accessRuleSummary.ts:128:   return types.flatMap(targetType => activeStates.map(isActive => ({ targetType, isActive })));
convex/lib/accessRuleSummary.ts:129: }
convex/lib/accessRuleSummary.ts:139:   let phase = 0;
convex/lib/accessRuleSummary.ts:140:   let nativeCursor: string | null = null;
convex/lib/accessRuleSummary.ts:144:     phase = value.phase;
convex/lib/accessRuleSummary.ts:145:     nativeCursor = value.cursor;
convex/lib/accessRuleSummary.ts:148:   if (phase === stages) return { page: [] as T[], isDone: true, continueCursor: "" };
convex/lib/accessRuleSummary.ts:149:   const result = await fetch(phase, nativeCursor);
convex/lib/accessRuleSummary.ts:152:   return { ...result, isDone: phase === stages, continueCursor: phase === stages ? "" : JSON.stringify({ scope, phase, cursor: null }) };
convex/lib/accessRuleSummary.ts:153: }
```

</details>

<details><summary>convex/lib/accessRuleWrite.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/lib/accessRuleWrite.ts:58:   const ruleId = await ctx.db.insert("accessRules", {
convex/lib/accessRuleWrite.ts:59:     ...ruleData,
convex/lib/accessRuleWrite.ts:60:     isActive: ruleData.isActive ?? true,
convex/lib/accessRuleWrite.ts:61:     createdAt: now,
convex/lib/accessRuleWrite.ts:69:         ctx.db.insert("groupMembers", {
convex/lib/accessRuleWrite.ts:70:           groupId: ruleId,
convex/lib/accessRuleWrite.ts:83:         ctx.db.insert("groupDevices", {
convex/lib/accessRuleWrite.ts:84:           groupId: ruleId,
convex/lib/accessRuleWrite.ts:98:         await ctx.db.insert("groupDoors", {
convex/lib/accessRuleWrite.ts:99:           groupId: ruleId,
```

</details>

<details><summary>convex/lib/accessTransfer.ts (7 yazma/durum eşleşmesi)</summary>

```text
convex/lib/accessTransfer.ts:56:     hik.push(...rows.filter(op => (op.status === "processing" || op.dismissedAt === undefined) && transferOperationBelongsTo(op, employee)));
convex/lib/accessTransfer.ts:57:   }
convex/lib/accessTransfer.ts:67:   return ops.hik.some(op => op.status === "processing" && isTransferAddition(op)) || ops.ide.some(op => op.status === "sent" && isTransferAddition(op) && op.msxId !== undefined);
convex/lib/accessTransfer.ts:68: }
convex/lib/accessTransfer.ts:72:     for (const op of ops.hik) if (isTransferAddition(op) && (op.status === "pending" || op.status === "failed"))
convex/lib/accessTransfer.ts:73:       await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/lib/accessTransfer.ts:73:       await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/lib/accessTransfer.ts:74:     // A reserved upsert without msxId was never published; markSent rejects it after start.
convex/lib/accessTransfer.ts:75:     for (const op of ops.ide) if (isTransferAddition(op) && (op.status === "pending" || op.status === "failed" || (op.status === "sent" && op.msxId === undefined)))
convex/lib/accessTransfer.ts:76:       await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/lib/accessTransfer.ts:76:       await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
convex/lib/accessTransfer.ts:77:   }
convex/lib/accessTransfer.ts:93:   const activeVisitorCount = visitors.filter(visitor => visitor.isActive === true && visitor.visitorStatus !== "checkedOut" && visitor.visitorStatus !== "expired" && (!visitor.accessExpiresAt || visitor.accessExpiresAt > new Date().toISOString())).length;
convex/lib/accessTransfer.ts:94:   if (activeVisitorCount) block("TRANSFER_ACTIVE_VISITORS", `Bu kişi ${activeVisitorCount} aktif ziyaretçinin ev sahibi. Önce ziyaretleri kapatın veya ev sahibini değiştirin.`);
```

</details>

<details><summary>convex/lib/adminLists.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/lib/adminLists.ts:33:   _id: Doc<"projects">["_id"]; name: string; isActive: boolean;
convex/lib/adminLists.ts:34: }[]) {
convex/lib/adminLists.ts:50:     ideDoorCount: device.ideDoorCount, lastSeen: device.lastSeen,
convex/lib/adminLists.ts:51:     createdFromDevice: device.createdFromDevice, assignedDeviceId: device.assignedDeviceId,
```

</details>

<details><summary>convex/lib/alarmNotify.ts (4 yazma/durum eşleşmesi)</summary>

```text
convex/lib/alarmNotify.ts:51:     await ctx.db.patch(eventId, { alarmQueuedAt: notifiedAt, alarmEmailStatus: "queued", alarmEmailAttempts: 0, alarmEmailRecipients: settings.recipients, updatedAt: notifiedAt });
convex/lib/alarmNotify.ts:52:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
convex/lib/alarmNotify.ts:52:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
convex/lib/alarmNotify.ts:53:   } catch {
convex/lib/alarmNotify.ts:54:     await ctx.db.patch(eventId, { alarmEmailStatus: "failed", alarmEmailError: "Alarm e-postası zamanlanamadı", alarmEmailAttemptAt: notifiedAt, updatedAt: notifiedAt });
convex/lib/alarmNotify.ts:55:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
convex/lib/alarmNotify.ts:55:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
convex/lib/alarmNotify.ts:56:   }
```

</details>

<details><summary>convex/lib/biometricDestruction.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/lib/biometricDestruction.ts:58:   status: z.enum(["running", "waitingDevices", "completed", "failed"]),
convex/lib/biometricDestruction.ts:59:   phase: kindSchema,
convex/lib/biometricDestruction.ts:59:   phase: kindSchema,
convex/lib/biometricDestruction.ts:60:   cursor: z.string().nullable(),
convex/lib/biometricDestruction.ts:86:     status: "running", phase: normalized[0] ?? "face", cursor: null, batch: 0, heartbeatAt: now,
convex/lib/biometricDestruction.ts:87:     deletedFaces: 0, deletedFingerprints: 0, deletedFiles: 0, deviceOperations: 0,
convex/lib/biometricDestruction.ts:92: export function destructionReport(projectId: string, state: DestructionState) {
convex/lib/biometricDestruction.ts:93:   return {
convex/lib/biometricDestruction.ts:101: export function destructionSummary(state: Pick<DestructionState, "deletedFaces" | "deletedFingerprints" | "deletedFiles" | "deviceOperations" | "deviceFailures" | "deviceUnconfirmed">) {
convex/lib/biometricDestruction.ts:102:   return `${state.deletedFaces} yüz, ${state.deletedFingerprints} parmak izi ve ${state.deletedFiles} dosya Convex'ten silindi. Cihaz işlemi: ${state.deviceOperations}; cihaz silmesi başarısız: ${state.deviceFailures}; cihaz sonucu doğrulanamadı: ${state.deviceUnconfirmed}.${state.deviceOperations === 0 ? " Cihazlardaki şablonlar ayrıca silinmeli." : ""}`;
```

</details>

<details><summary>convex/lib/biometricDestructionState.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/lib/biometricDestructionState.ts:9:   const state: unknown = row?.newValue;
convex/lib/biometricDestructionState.ts:10:   if (!state || typeof state !== "object" || !("status" in state)) return false;
convex/lib/biometricDestructionState.ts:11:   if (state.status === "waitingDevices") return true;
convex/lib/biometricDestructionState.ts:12:   if (state.status !== "running") return false;
```

</details>

<details><summary>convex/lib/cardReadingList.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/cardReadingList.ts:30:   const status = args.accessFilter === "granted" ? "izin_verildi" : args.accessFilter === "denied" ? "reddedildi" : undefined;
convex/lib/cardReadingList.ts:31:   const query = ctx.db.query("cardReadings");
```

</details>

<details><summary>convex/lib/cardReadingProcess.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/cardReadingProcess.ts:165:   const activeRules = rules.filter((r): r is NonNullable<typeof r> => r?.isActive === true);
convex/lib/cardReadingProcess.ts:166:   const openRuleIds = new Set<Id<"accessRules">>();
```

</details>

<details><summary>convex/lib/deviceAssignment.ts (8 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceAssignment.ts:150:     await ctx.db.patch(args.adminDeviceId, { name: newName, updatedAt: now });
convex/lib/deviceAssignment.ts:151:   }
convex/lib/deviceAssignment.ts:156:       await ctx.db.patch(adminDevice.assignedDeviceId, {
convex/lib/deviceAssignment.ts:157:         name: newName,
convex/lib/deviceAssignment.ts:179:     await ctx.db.patch(args.adminDeviceId, {
convex/lib/deviceAssignment.ts:180:       assignedDeviceId: undefined,
convex/lib/deviceAssignment.ts:226:         await ctx.db.delete(adminDeviceId);
convex/lib/deviceAssignment.ts:227:       } else {
convex/lib/deviceAssignment.ts:228:         await ctx.db.patch(adminDeviceId, {
convex/lib/deviceAssignment.ts:229:           assignedDeviceId: undefined,
convex/lib/deviceAssignment.ts:231:           lastSeen: device.lastSeen ?? undefined,
convex/lib/deviceAssignment.ts:232:           updatedAt: new Date().toISOString(),
convex/lib/deviceAssignment.ts:245:         await ctx.db.delete(existing._id);
convex/lib/deviceAssignment.ts:246:       } else {
convex/lib/deviceAssignment.ts:247:         await ctx.db.patch(existing._id, {
convex/lib/deviceAssignment.ts:248:           assignedDeviceId: undefined,
```

</details>

<details><summary>convex/lib/deviceConnection.ts (16 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceConnection.ts:19:   return isHikGateway(device) && typeof device.hikIsupOnline === "boolean" &&
convex/lib/deviceConnection.ts:20:     device.hikIsupStatusAt !== undefined && Number.isFinite(device.hikIsupStatusAt) &&
convex/lib/deviceConnection.ts:53:     await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
convex/lib/deviceConnection.ts:54:     await ctx.scheduler.runAfter(DEVICE_ONLINE_WINDOW_MS + 1, internal.devices.checkHeartbeatOffline, { deviceId: device._id, checkAt });
convex/lib/deviceConnection.ts:62:   await ctx.db.insert("deviceEvents", {
convex/lib/deviceConnection.ts:63:     deviceId: device._id, projectId: device.projectId,
convex/lib/deviceConnection.ts:71:     await ctx.db.patch(previous._id, { resolvedAt: now, updatedAt: now,
convex/lib/deviceConnection.ts:72:       rawData: JSON.stringify({ offlineFrom, offlineTo: nowMs, durationMs: nowMs - offlineFrom }) });
convex/lib/deviceConnection.ts:73:     await ctx.db.patch(device._id, { heartbeatOfflineEventId: undefined });
convex/lib/deviceConnection.ts:74:     return true;
convex/lib/deviceConnection.ts:76:   const eventId = await ctx.db.insert("deviceEvents", {
convex/lib/deviceConnection.ts:77:     deviceId: device._id, projectId: device.projectId,
convex/lib/deviceConnection.ts:80:     eventTime: now, createdAt: now, updatedAt: now, resolvedAt: now,
convex/lib/deviceConnection.ts:81:     rawData: JSON.stringify({ offlineFrom, offlineTo: nowMs, durationMs: nowMs - offlineFrom }),
convex/lib/deviceConnection.ts:93:   if (!expectsHeartbeat(device) || device.isActive === false || device.heartbeatCheckAt || device.heartbeatOfflineEventId) return;
convex/lib/deviceConnection.ts:94:   const now = Date.now();
convex/lib/deviceConnection.ts:98:   await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
convex/lib/deviceConnection.ts:99:   await ctx.scheduler.runAfter(checkAt - now, internal.devices.checkHeartbeatOffline, { deviceId: device._id, checkAt });
convex/lib/deviceConnection.ts:106:   if (!expectsHeartbeat(device) || device.isActive === false) {
convex/lib/deviceConnection.ts:107:     await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
convex/lib/deviceConnection.ts:107:     await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
convex/lib/deviceConnection.ts:108:     return;
convex/lib/deviceConnection.ts:113:     await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
convex/lib/deviceConnection.ts:114:     return;
convex/lib/deviceConnection.ts:118:     await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
convex/lib/deviceConnection.ts:119:     await ctx.scheduler.runAfter(checkAt - nowMs, internal.devices.checkHeartbeatOffline, { deviceId: device._id, checkAt });
convex/lib/deviceConnection.ts:122:   await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
convex/lib/deviceConnection.ts:123:   if (device.heartbeatOfflineEventId) {
convex/lib/deviceConnection.ts:128:   const eventId = await ctx.db.insert("deviceEvents", {
convex/lib/deviceConnection.ts:129:     deviceId: device._id, projectId: device.projectId,
convex/lib/deviceConnection.ts:134:   await ctx.db.patch(device._id, { heartbeatOfflineEventId: eventId });
convex/lib/deviceConnection.ts:135:   await notifyAlarmIfNeeded(ctx, eventId);
```

</details>

<details><summary>convex/lib/deviceHelpers.ts (13 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceHelpers.ts:24:     await Promise.all(links.map((link) => ctx.db.delete(link._id)));
convex/lib/deviceHelpers.ts:25:   }
convex/lib/deviceHelpers.ts:46:   await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));
convex/lib/deviceHelpers.ts:47: 
convex/lib/deviceHelpers.ts:55:   await Promise.all(ownedDoors.map((d) => ctx.db.delete(d._id)));
convex/lib/deviceHelpers.ts:56: 
convex/lib/deviceHelpers.ts:65:   await Promise.all(pendingOps.map((op) => ctx.db.delete(op._id)));
convex/lib/deviceHelpers.ts:66: 
convex/lib/deviceHelpers.ts:68:   await ctx.db.delete(deviceId);
convex/lib/deviceHelpers.ts:69: }
convex/lib/deviceHelpers.ts:75:   for (const row of rows) await ctx.db.delete(row._id);
convex/lib/deviceHelpers.ts:76:   if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.ideSync.purgeDeviceOperations, { deviceId });
convex/lib/deviceHelpers.ts:128:   return await ctx.db.insert("zones", {
convex/lib/deviceHelpers.ts:129:     name: zoneName || opts.fallbackName,
convex/lib/deviceHelpers.ts:152:   return await ctx.db.insert("readers", {
convex/lib/deviceHelpers.ts:153:     doorId: opts.doorId,
convex/lib/deviceHelpers.ts:161:     status: "active",
convex/lib/deviceHelpers.ts:162:     createdAt: opts.now,
convex/lib/deviceHelpers.ts:200:     const doorId = await ctx.db.insert("doors", {
convex/lib/deviceHelpers.ts:201:       name,
convex/lib/deviceHelpers.ts:206:       status: "active",
convex/lib/deviceHelpers.ts:207:       createdAt: opts.now,
convex/lib/deviceHelpers.ts:263:     const doorId = await ctx.db.insert("doors", {
convex/lib/deviceHelpers.ts:264:       name: doorName,
convex/lib/deviceHelpers.ts:269:       status: "active",
convex/lib/deviceHelpers.ts:270:       createdAt: opts.now,
```

</details>

<details><summary>convex/lib/devicePool.ts (6 yazma/durum eşleşmesi)</summary>

```text
convex/lib/devicePool.ts:45:   const deviceId = await ctx.db.insert("devices", {
convex/lib/devicePool.ts:46:     name: panelName,
convex/lib/devicePool.ts:55:     isActive: true,
convex/lib/devicePool.ts:56:     status: "active",
convex/lib/devicePool.ts:56:     status: "active",
convex/lib/devicePool.ts:57:     lastSeen: adminDevice.lastSeen,
convex/lib/devicePool.ts:57:     lastSeen: adminDevice.lastSeen,
convex/lib/devicePool.ts:58:     description: opts.description,
convex/lib/devicePool.ts:76:   await ctx.db.patch(deviceId, { zoneId, updatedAt: now });
convex/lib/devicePool.ts:77: 
convex/lib/devicePool.ts:80:   await ctx.db.patch(adminDevice._id, {
convex/lib/devicePool.ts:81:     assignedDeviceId: deviceId,
```

</details>

<details><summary>convex/lib/deviceProvision.ts (17 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceProvision.ts:149:   const deviceId = await ctx.db.insert("devices", {
convex/lib/deviceProvision.ts:150:     ...deviceArgs,
convex/lib/deviceProvision.ts:154:     isActive: deviceActive(args.status, args.isActive),
convex/lib/deviceProvision.ts:155:     status: deviceActive(args.status, args.isActive) ? "active" : "inactive",
convex/lib/deviceProvision.ts:155:     status: deviceActive(args.status, args.isActive) ? "active" : "inactive",
convex/lib/deviceProvision.ts:156:     createdAt: now,
convex/lib/deviceProvision.ts:159:   const adminDeviceId = await ctx.db.insert("adminDevices", {
convex/lib/deviceProvision.ts:160:     name: args.name,
convex/lib/deviceProvision.ts:174:   await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
convex/lib/deviceProvision.ts:175:   return deviceId;
convex/lib/deviceProvision.ts:218:   const deviceId = await ctx.db.insert("devices", {
convex/lib/deviceProvision.ts:219:     name: args.name,
convex/lib/deviceProvision.ts:231:     isActive: deviceActive(args.status),
convex/lib/deviceProvision.ts:232:     status: deviceActive(args.status) ? "active" : "inactive",
convex/lib/deviceProvision.ts:232:     status: deviceActive(args.status) ? "active" : "inactive",
convex/lib/deviceProvision.ts:233:     description: args.description,
convex/lib/deviceProvision.ts:249:   await ctx.db.patch(deviceId, { zoneId, updatedAt: now });
convex/lib/deviceProvision.ts:250: 
convex/lib/deviceProvision.ts:252:   const adminDeviceId = await ctx.db.insert("adminDevices", {
convex/lib/deviceProvision.ts:253:     name: args.name,
convex/lib/deviceProvision.ts:266:   await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
convex/lib/deviceProvision.ts:267: 
convex/lib/deviceProvision.ts:320:   const deviceId = await ctx.db.insert("devices", {
convex/lib/deviceProvision.ts:321:     name: args.name,
convex/lib/deviceProvision.ts:336:     isActive: deviceActive(args.status),
convex/lib/deviceProvision.ts:337:     status: deviceActive(args.status) ? "active" : "inactive",
convex/lib/deviceProvision.ts:337:     status: deviceActive(args.status) ? "active" : "inactive",
convex/lib/deviceProvision.ts:338:     description: args.description,
convex/lib/deviceProvision.ts:359:   await ctx.db.patch(deviceId, { zoneId, updatedAt: now });
convex/lib/deviceProvision.ts:360: 
convex/lib/deviceProvision.ts:363:   const adminDeviceId = await ctx.db.insert("adminDevices", {
convex/lib/deviceProvision.ts:364:     name: args.name,
convex/lib/deviceProvision.ts:373:   await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
convex/lib/deviceProvision.ts:374: 
```

</details>

<details><summary>convex/lib/deviceSync.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceSync.ts:48:     if (!device || device.isActive === false || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex || fingerprintCapability(device.hikCapabilitiesSnapshot) === false || !(await isBiometricEnabled(ctx, device.projectId))) return [];
convex/lib/deviceSync.ts:49:   }
```

</details>

<details><summary>convex/lib/deviceSyncRun.ts (14 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceSyncRun.ts:20:   if (device.isActive === false) return skipReasons.inactive;
convex/lib/deviceSyncRun.ts:21:   if (device.brand !== "hikvision" && device.brand !== "ide_smart") return skipReasons.unsupported;
convex/lib/deviceSyncRun.ts:22:   if (device.status === "offline" || deviceConnection(device, now) === "offline") return skipReasons.offline;
convex/lib/deviceSyncRun.ts:23:   if (device.brand === "ide_smart") {
convex/lib/deviceSyncRun.ts:31: export function operationStatus(brand: string, op: { status: string; ackedAt?: number }): TargetStatus {
convex/lib/deviceSyncRun.ts:32:   if (op.status === "failed") return "failed";
convex/lib/deviceSyncRun.ts:32:   if (op.status === "failed") return "failed";
convex/lib/deviceSyncRun.ts:33:   if (op.status === "pending" || op.status === "processing" || (brand === "ide_smart" && op.status === "sent")) return "queued";
convex/lib/deviceSyncRun.ts:33:   if (op.status === "pending" || op.status === "processing" || (brand === "ide_smart" && op.status === "sent")) return "queued";
convex/lib/deviceSyncRun.ts:34:   if (brand === "hikvision" && op.status === "done") return "sent";
convex/lib/deviceSyncRun.ts:34:   if (brand === "hikvision" && op.status === "done") return "sent";
convex/lib/deviceSyncRun.ts:35:   if (brand === "ide_smart" && op.status === "acked" && op.ackedAt !== undefined) return "verified";
convex/lib/deviceSyncRun.ts:35:   if (brand === "ide_smart" && op.status === "acked" && op.ackedAt !== undefined) return "verified";
convex/lib/deviceSyncRun.ts:36:   return "unknown";
convex/lib/deviceSyncRun.ts:44:   if (statuses.every((status) => status === "verified")) return "verified";
convex/lib/deviceSyncRun.ts:45:   if (statuses.every((status) => status === "sent" || status === "verified")) return "sent";
convex/lib/deviceSyncRun.ts:45:   if (statuses.every((status) => status === "sent" || status === "verified")) return "sent";
convex/lib/deviceSyncRun.ts:46:   return "skipped";
convex/lib/deviceSyncRun.ts:49: export function summarizeRun(statuses: readonly TargetStatus[], dispatchFinished: boolean): { counts: RunCounts; status: RunStatus } {
convex/lib/deviceSyncRun.ts:50:   const counts: RunCounts = { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 };
convex/lib/deviceSyncRun.ts:54:   const status: RunStatus = !dispatchFinished || counts.queued > 0 ? "running"
convex/lib/deviceSyncRun.ts:55:     : issues === 0 ? "done" : success > 0 || counts.skipped > 0 ? "partial" : "failed";
convex/lib/deviceSyncRun.ts:64: export function summaryChanged(current: { status: RunStatus; counts: RunCounts; finishedAt?: number },
convex/lib/deviceSyncRun.ts:65:   next: { status: RunStatus; counts: RunCounts; finishedAt?: number }): boolean {
convex/lib/deviceSyncRun.ts:65:   next: { status: RunStatus; counts: RunCounts; finishedAt?: number }): boolean {
convex/lib/deviceSyncRun.ts:66:   return current.status !== next.status || current.finishedAt !== next.finishedAt
convex/lib/deviceSyncRun.ts:67:     || (Object.keys(next.counts) as TargetStatus[]).some(status => current.counts[status] !== next.counts[status]);
convex/lib/deviceSyncRun.ts:68: }
```

</details>

<details><summary>convex/lib/deviceUx.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/deviceUx.ts:10:   return status === "inactive" ? false : status === "active" ? true : isActive ?? true;
convex/lib/deviceUx.ts:11: }
```

</details>

<details><summary>convex/lib/doorTargetSync.ts (15 yazma/durum eşleşmesi)</summary>

```text
convex/lib/doorTargetSync.ts:64:     for (const link of before.links) await ctx.db.patch(link._id, { deviceId: after.deviceId });
convex/lib/doorTargetSync.ts:65:     for (const { rule } of before.rules) {
convex/lib/doorTargetSync.ts:71:         for (const link of deviceLinks.filter(link => link.deviceId === before.door.deviceId)) await ctx.db.delete(link._id);
convex/lib/doorTargetSync.ts:72:       }
convex/lib/doorTargetSync.ts:74:         await ctx.db.insert("groupDevices", { projectId, groupId: rule._id, deviceId: after.deviceId, createdAt: new Date(now).toISOString() });
convex/lib/doorTargetSync.ts:75:       }
convex/lib/doorTargetSync.ts:83:     await ctx.db.patch(rule._id, { updatedAt: new Date(now).toISOString() });
convex/lib/doorTargetSync.ts:84:     const runId = await ctx.db.insert("deviceSyncRuns", { projectId, ruleId: rule._id, kind: "rule_sync", startedBy, startedAt: now, status: "running", dispatchFinished: true, counts: summarizeRun([], false).counts });
convex/lib/doorTargetSync.ts:84:     const runId = await ctx.db.insert("deviceSyncRuns", { projectId, ruleId: rule._id, kind: "rule_sync", startedBy, startedAt: now, status: "running", dispatchFinished: true, counts: summarizeRun([], false).counts });
convex/lib/doorTargetSync.ts:85:     const ruleDeviceIds = new Set(beforeDeviceIds);
convex/lib/doorTargetSync.ts:88:       const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other", status: "queued", dispatchFinished: true, updatedAt: now });
convex/lib/doorTargetSync.ts:89:       if (blanket && device.brand === "hikvision") {
convex/lib/doorTargetSync.ts:90:         await ctx.db.patch(targetId, { dispatchFinished: false });
convex/lib/doorTargetSync.ts:91:         await ctx.scheduler.runAfter(0, internal.doors.syncDoorBlanketRule, { ruleId: rule._id, deviceId: device._id, targetId, runId });
convex/lib/doorTargetSync.ts:95:         await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "pending", lastRunId: runId });
convex/lib/doorTargetSync.ts:96:         if (device.brand !== "hikvision") continue;
convex/lib/doorTargetSync.ts:99:         const operationId = await ctx.db.insert("hikPendingOperations", {
convex/lib/doorTargetSync.ts:100:           projectId, deviceId: device._id, runId, operation: "updatePerson", status: "processing", processingStartedAt: now, attemptCount: 0, createdAt: now, nextRetryAt: now,
convex/lib/doorTargetSync.ts:100:           projectId, deviceId: device._id, runId, operation: "updatePerson", status: "processing", processingStartedAt: now, attemptCount: 0, createdAt: now, nextRetryAt: now,
convex/lib/doorTargetSync.ts:101:           lastError: "Kapı yetkisi gönderimi bekleniyor",
convex/lib/doorTargetSync.ts:106:         await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "pending", lastRunId: runId, lastOperationId: operationId });
convex/lib/doorTargetSync.ts:107:         await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncDoorRightsOperation, { operationId });
convex/lib/doorTargetSync.ts:126:           await ctx.db.patch(targetId, { dispatchFinished: false });
convex/lib/doorTargetSync.ts:127:           await ctx.scheduler.runAfter(0, internal.doors.syncDoorBlanketRule, { ruleId: rule._id, deviceId: device._id, targetId, runId });
convex/lib/doorTargetSync.ts:129:           await ctx.db.patch(targetId, { dispatchFinished: false });
convex/lib/doorTargetSync.ts:130:           await ctx.scheduler.runAfter(0, internal.doors.syncDoorIdeTarget, { employeeIds, deviceId: device._id, targetId, runId });
convex/lib/doorTargetSync.ts:133:           for (const employee of employees) await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "removed", lastRunId: runId });
convex/lib/doorTargetSync.ts:134:         }
convex/lib/doorTargetSync.ts:136:       if (!employees.length && device.brand === "hikvision") await ctx.db.patch(targetId, { status: "skipped", reason: "Etkilenen kişi yok" });
convex/lib/doorTargetSync.ts:137:     }
```

</details>

<details><summary>convex/lib/employeeCardChange.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/lib/employeeCardChange.ts:43:       if (options.fingerNo === undefined || template.fingerPrintID === options.fingerNo) await ctx.db.delete(template._id);
convex/lib/employeeCardChange.ts:44:     }
convex/lib/employeeCardChange.ts:51:     await ctx.db.patch(row._id, { deletionEmployeeNo: oldEmployeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), cancelRequested: true });
convex/lib/employeeCardChange.ts:52:     snapshots.push({ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: oldEmployeeNo });
```

</details>

<details><summary>convex/lib/employeeCascade.ts (10 yazma/durum eşleşmesi)</summary>

```text
convex/lib/employeeCascade.ts:18:     await ctx.db.patch(row._id, { ...values, note: "Kişi kaydı silindi; geçmiş kişisel veri kopyası kaldırıldı",
convex/lib/employeeCascade.ts:19:       searchText: auditSearchText({ targetTable: "employees", userName: row.userName }) });
convex/lib/employeeCascade.ts:42:     await ctx.db.patch(reading._id, { employeeName: "[silindi]", cardNo: hashCardNo(reading.cardNo) });
convex/lib/employeeCascade.ts:43:   }
convex/lib/employeeCascade.ts:62:   for (const token of tokens) await ctx.db.delete(token._id);
convex/lib/employeeCascade.ts:63:   if (tokens.length === CASCADE_BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.lib.employeeCascade.deleteCheckInTokens, { employeeId });
convex/lib/employeeCascade.ts:81:     await ctx.db.patch(visitor._id, {
convex/lib/employeeCascade.ts:82:       hostEmployeeId: undefined,
convex/lib/employeeCascade.ts:122:   for (const period of departmentHistory) await ctx.db.delete(period._id);
convex/lib/employeeCascade.ts:123: 
convex/lib/employeeCascade.ts:135:     if (correction.status === "pending") await ctx.db.patch(correction._id, {
convex/lib/employeeCascade.ts:136:       status: "withdrawn", decisionNote: "Kişi kaydı silindi", decidedAt,
convex/lib/employeeCascade.ts:136:       status: "withdrawn", decisionNote: "Kişi kaydı silindi", decidedAt,
convex/lib/employeeCascade.ts:137:       decidedBy: undefined, updatedAt: decidedAt,
convex/lib/employeeCascade.ts:141:     if (leave.source === "employee" && leave.status === "pending") await ctx.db.delete(leave._id);
convex/lib/employeeCascade.ts:142:   }
convex/lib/employeeCascade.ts:151:     await ctx.db.delete(f._id);
convex/lib/employeeCascade.ts:152:   }
convex/lib/employeeCascade.ts:174:       await ctx.db.patch(c._id, { revokedAt: now });
convex/lib/employeeCascade.ts:175:       consentsRevoked += 1;
```

</details>

<details><summary>convex/lib/gateway/biometrics.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gateway/biometrics.ts:114:     new Promise<{ status: number; raw: string }>((_, reject) => {
convex/lib/gateway/biometrics.ts:115:       timeoutHandle = setTimeout(
convex/lib/gateway/biometrics.ts:121:   let result: { status: number; raw: string };
convex/lib/gateway/biometrics.ts:122:   try {
convex/lib/gateway/biometrics.ts:201:   const status = (data as { FingerPrintStatus?: { StatusList?: unknown; totalStatus?: unknown } } | undefined)?.FingerPrintStatus;
convex/lib/gateway/biometrics.ts:202:   if (!status || status.totalStatus !== 1) return { done: false, ok: false };
convex/lib/gateway/biometrics.ts:441:     (byEmployee && wrap?.status === "OK" && Array.isArray(wrap?.FingerPrintList) && wrap.FingerPrintList.length > 0);
convex/lib/gateway/biometrics.ts:442: 
convex/lib/gateway/biometrics.ts:482:     if (wrap.status === "NoFP" || wrap.status === "NO MATCH") break;
convex/lib/gateway/biometrics.ts:483:     if (wrap.status !== "OK") throw new Error("Parmak izi okunamadı");
```

</details>

<details><summary>convex/lib/gateway/core.ts (9 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gateway/core.ts:32:   status: number;
convex/lib/gateway/core.ts:33:   data: unknown;
convex/lib/gateway/core.ts:92:       `[hikGateway] ${method} ${gatewayLogPath(path)} devIndex=${devIndex ?? "-"} status=${result.status}` +
convex/lib/gateway/core.ts:93:         (/fingerprint/i.test(path) ? "" :
convex/lib/gateway/core.ts:97:   return { status: result.status, data, raw: result.body };
convex/lib/gateway/core.ts:98: }
convex/lib/gateway/core.ts:109: ): Promise<{ status: number; raw: string }> {
convex/lib/gateway/core.ts:110:   const { host, user, pass } = getGatewayConfig();
convex/lib/gateway/core.ts:114:   return { status: result.status, raw: result.body };
convex/lib/gateway/core.ts:115: }
convex/lib/gateway/core.ts:190:   return { status: result.status, data, raw: result.body };
convex/lib/gateway/core.ts:191: }
convex/lib/gateway/core.ts:252:   if (result.status === 200 && (data?.statusCode === 1 || data?.statusString === "OK")) {
convex/lib/gateway/core.ts:253:     if (alreadyExists) return { ok: false, alreadyExists: true, error: nestedSub };
convex/lib/gateway/core.ts:263:   if (result.status === 200 && data?.statusCode === undefined && nestedSub !== undefined) {
convex/lib/gateway/core.ts:264:     const codes = collectNestedSubStatusCodes(data);
convex/lib/gateway/core.ts:271:   if (result.status === 200) {
convex/lib/gateway/core.ts:272:     return {
```

</details>

<details><summary>convex/lib/gateway/devices.ts (6 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gateway/devices.ts:67:   if (firstDevice?.status === "fail") {
convex/lib/gateway/devices.ts:68:     const sub = firstDevice.subStatusCode;
convex/lib/gateway/devices.ts:219:   if (result.status === 200 && parseHikJsonStatus(result).ok) return { ok: true };
convex/lib/gateway/devices.ts:220:   const xml = `<?xml version="1.0" encoding="UTF-8"?><Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><timeMode>manual</timeMode><localTime>${iso}</localTime><timeZone>${tz}</timeZone></Time>`;
convex/lib/gateway/devices.ts:222:   if (fallback.status === 200 && !/<statusCode>(?!1<)/.test(fallback.raw)) return { ok: true };
convex/lib/gateway/devices.ts:223:   return { ok: false, error: `HTTP ${result.status}/${fallback.status}: ${fallback.raw.slice(0, 200)}` };
convex/lib/gateway/devices.ts:361:   const status = parseHikJsonStatus(result);
convex/lib/gateway/devices.ts:362:   if (status.ok || status.alreadyExists) return { ok: true };
convex/lib/gateway/devices.ts:376:   const status = parseHikJsonStatus(result);
convex/lib/gateway/devices.ts:377:   if (status.ok) return { ok: true };
convex/lib/gateway/devices.ts:447:     status: {
convex/lib/gateway/devices.ts:448:       doorStatus,
```

</details>

<details><summary>convex/lib/gateway/isapiResult.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gateway/isapiResult.ts:11:   result: { status: number; data: unknown },
convex/lib/gateway/isapiResult.ts:12:   expectedField?: string,
```

</details>

<details><summary>convex/lib/gateway/readers.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gateway/readers.ts:88:   status: number,
convex/lib/gateway/readers.ts:89:   data: unknown,
```

</details>

<details><summary>convex/lib/gatewayBackfill.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gatewayBackfill.ts:27: function recoveryStartTime(completedAt: number | undefined, previousStart?: string): string {
convex/lib/gatewayBackfill.ts:28:   return completedAt !== undefined
```

</details>

<details><summary>convex/lib/gatewayCommand.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/gatewayCommand.ts:444:     return { ok: true, status: workStatus };
convex/lib/gatewayCommand.ts:445:   });
```

</details>

<details><summary>convex/lib/grantStatus.ts (21 yazma/durum eşleşmesi)</summary>

```text
convex/lib/grantStatus.ts:63:   if (!employee.projectId || employee.isActive === false) return graph;
convex/lib/grantStatus.ts:64:   const links = bounded(await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id)).take(101), 100);
convex/lib/grantStatus.ts:105:   state: GrantState; ruleIds?: Id<"accessRules">[]; lastError?: string; lastRunId?: Id<"deviceSyncRuns">; lastOperationId?: string;
convex/lib/grantStatus.ts:106: };
convex/lib/grantStatus.ts:109:   const transferSource = args.state === "effective" || args.state === "removed" ? await ctx.db.get(args.employeeId) : null;
convex/lib/grantStatus.ts:110:   const sourceRun = await sourceTransfer(ctx, transferSource);
convex/lib/grantStatus.ts:111:   if (args.state === "effective") {
convex/lib/grantStatus.ts:112:     const employee = transferSource;
convex/lib/grantStatus.ts:122:           await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "failed" }, note: `Taşıma sırasında geç yazım yakalandı; silme kuyruğa alınamadı: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) });
convex/lib/grantStatus.ts:123:           return;
convex/lib/grantStatus.ts:127:         if (row) await ctx.db.patch(row._id, { state: "pending", confirmedAt: undefined, updatedAt: Date.now() });
convex/lib/grantStatus.ts:128:         else if (device.brand === "hikvision" || device.brand === "ide_smart") await ctx.db.insert("accessTransferTargets", { transferId: transfer._id, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
convex/lib/grantStatus.ts:128:         else if (device.brand === "hikvision" || device.brand === "ide_smart") await ctx.db.insert("accessTransferTargets", { transferId: transfer._id, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
convex/lib/grantStatus.ts:129:         if (transfer.status === "revoked") await ctx.db.patch(transfer._id, { status: "revoking" });
convex/lib/grantStatus.ts:129:         if (transfer.status === "revoked") await ctx.db.patch(transfer._id, { status: "revoking" });
convex/lib/grantStatus.ts:130:         await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "pending" }, note: "Taşıma sırasında geç yazım yakalandı; cihaz silmesi yeniden kuyruğa alındı" });
convex/lib/grantStatus.ts:130:         await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "pending" }, note: "Taşıma sırasında geç yazım yakalandı; cihaz silmesi yeniden kuyruğa alındı" });
convex/lib/grantStatus.ts:131:       }
convex/lib/grantStatus.ts:135:   if (args.state === "removed") {
convex/lib/grantStatus.ts:136:     const transfer = sourceRun;
convex/lib/grantStatus.ts:147:     args.state === "effective" || args.state === "removed" ? Promise.resolve(transferSource) : ctx.db.get(args.employeeId), ctx.db.get(args.deviceId),
convex/lib/grantStatus.ts:148:     ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId)).unique(),
convex/lib/grantStatus.ts:151:   const ruleIds = args.ruleIds ?? (args.state === "pending" && employee
convex/lib/grantStatus.ts:152:     ? (await employeeGrantGraph(ctx, employee)).get(args.deviceId)?.ruleIds ?? []
convex/lib/grantStatus.ts:156:     lastError: args.state === "failed" ? (args.lastError ?? "Cihaz işlemi başarısız").slice(0, 2000) : undefined,
convex/lib/grantStatus.ts:157:     appliedAt: args.state === "effective" ? now : existing?.appliedAt, updatedAt: now };
convex/lib/grantStatus.ts:157:     appliedAt: args.state === "effective" ? now : existing?.appliedAt, updatedAt: now };
convex/lib/grantStatus.ts:158:   if (existing) await ctx.db.patch(existing._id, value);
convex/lib/grantStatus.ts:158:   if (existing) await ctx.db.patch(existing._id, value);
convex/lib/grantStatus.ts:159:   else await ctx.db.insert("accessGrantStatus", value);
convex/lib/grantStatus.ts:159:   else await ctx.db.insert("accessGrantStatus", value);
convex/lib/grantStatus.ts:160:   if (args.state === "removed") await updateTransferTarget(ctx, args.employeeId, args.deviceId, "confirmed");
convex/lib/grantStatus.ts:160:   if (args.state === "removed") await updateTransferTarget(ctx, args.employeeId, args.deviceId, "confirmed");
convex/lib/grantStatus.ts:161: }
convex/lib/grantStatus.ts:166: }, state: GrantState, lastError?: string) {
convex/lib/grantStatus.ts:167:   if (!op.payload || typeof op.payload !== "object") return;
convex/lib/grantStatus.ts:186:   const transfer = deletion && state === "removed" ? await sourceTransfer(ctx, await ctx.db.get(employeeId)) : null;
convex/lib/grantStatus.ts:187:   if (transfer?.employeeId === employeeId) {
convex/lib/grantStatus.ts:211:     lastRunId: op.runId, lastOperationId: op._id, lastError: typeof payload.grantError === "string" && state === "effective" ? payload.grantError : lastError,
convex/lib/grantStatus.ts:212:     ...(typeof payload.grantError === "string" && state === "effective" ? { state: "failed", lastError: payload.grantError } : {}) });
convex/lib/grantStatus.ts:212:     ...(typeof payload.grantError === "string" && state === "effective" ? { state: "failed", lastError: payload.grantError } : {}) });
convex/lib/grantStatus.ts:213: }
```

</details>

<details><summary>convex/lib/hikDeviceImport.ts (7 yazma/durum eşleşmesi)</summary>

```text
convex/lib/hikDeviceImport.ts:16:   if (valid?.enable === false) return { isActive: true };
convex/lib/hikDeviceImport.ts:17:   const utc = (value?: string) => value ? toUtcISO(valid?.timeType === "UTC" && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? `${value}Z` : value) : undefined;
convex/lib/hikDeviceImport.ts:22:     isActive: intervalValid && Date.parse(accessExpiresAt) > now,
convex/lib/hikDeviceImport.ts:23:     ...(accessStartsAt ? { accessStartsAt } : {}),
convex/lib/hikDeviceImport.ts:27: export type ImportRow = ImportPerson & { status: "new" | "matched" | "conflict" | "manual"; matchedEmployeeId?: Id<"employees">; storedFingerCount?: number; reason?: string };
convex/lib/hikDeviceImport.ts:28: export function classifyImportPerson(person: ImportPerson, projectId: Id<"projects">, duplicates: readonly Pick<Doc<"employees">, "_id" | "cardNumber" | "projectId">[]): ImportRow {
convex/lib/hikDeviceImport.ts:33:   if (relevant.some(employee => employee._id !== match?._id)) return { ...person, status: "conflict", reason: "Kart numarası başka bir kayıtta kullanılıyor." };
convex/lib/hikDeviceImport.ts:34:   if (match) return { ...person, status: "matched", matchedEmployeeId: match._id };
convex/lib/hikDeviceImport.ts:34:   if (match) return { ...person, status: "matched", matchedEmployeeId: match._id };
convex/lib/hikDeviceImport.ts:35:   if (person.cards.length > 1 || (person.cards.length === 1 && person.cards[0] !== person.employeeNo)) return { ...person, status: "manual", reason: "Cihaz kişi numarası ve kartları elle eşleştirilmeli." };
convex/lib/hikDeviceImport.ts:35:   if (person.cards.length > 1 || (person.cards.length === 1 && person.cards[0] !== person.employeeNo)) return { ...person, status: "manual", reason: "Cihaz kişi numarası ve kartları elle eşleştirilmeli." };
convex/lib/hikDeviceImport.ts:36:   return { ...person, status: "new" };
convex/lib/hikDeviceImport.ts:36:   return { ...person, status: "new" };
convex/lib/hikDeviceImport.ts:37: }
```

</details>

<details><summary>convex/lib/hikSyncEmployee.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/lib/hikSyncEmployee.ts:145:   // (Valid.enable cihazda true olarak yazılıydı). isActive: false olunca delete tetiklenir.
convex/lib/hikSyncEmployee.ts:146:   if (data.employee.isActive === false) {
convex/lib/hikSyncEmployee.ts:146:   if (data.employee.isActive === false) {
convex/lib/hikSyncEmployee.ts:147:     if (args.runId) {
convex/lib/hikSyncEmployee.ts:287:       if (!current || current.terminationType === "transfer" || current.isActive === false || current.projectId !== employee.projectId || current.cardNumber !== employee.cardNumber) {
convex/lib/hikSyncEmployee.ts:288:         return { skipped: true as const, ok: false as const, device: t.device, operation: "addPerson" as const };
convex/lib/hikSyncEmployee.ts:382:       state: result.grantRemoved ? "removed" as const : result.ok && !result.grantError ? "effective" as const : "failed" as const,
convex/lib/hikSyncEmployee.ts:383:       ruleIds: rulesByDevice.get(device._id) ?? [],
convex/lib/hikSyncEmployee.ts:607:   const rules = data.employee.isActive === false ? [] : data.deviceRules.filter(entry => entry.device._id === device._id);
convex/lib/hikSyncEmployee.ts:608:   const scopes = [];
```

</details>

<details><summary>convex/lib/mobileAccess.ts (5 yazma/durum eşleşmesi)</summary>

```text
convex/lib/mobileAccess.ts:35:   if (rule.isActive === false || accessScheduleError(rule)) return false;
convex/lib/mobileAccess.ts:36:   return isRuleOpenAt(rule, now);
convex/lib/mobileAccess.ts:40:   if (employee.isActive === false || !Number.isFinite(now)) return false;
convex/lib/mobileAccess.ts:41:   // Son çalışma günü (TR, dahil) sonrası ret: işten çıkış cron'u isActive'i kapatana kadarki
convex/lib/mobileAccess.ts:73:   if (!project || project.isActive === false) return [];
convex/lib/mobileAccess.ts:74:   const memberships: Doc<"groupMembers">[] = bounded<Doc<"groupMembers">>(await ctx.db.query("groupMembers")
convex/lib/mobileAccess.ts:131:       const reason = device.isActive === false ? "DEVICE_INACTIVE"
convex/lib/mobileAccess.ts:132:         : door?.status && door.status !== "active" ? "DOOR_INACTIVE"
convex/lib/mobileAccess.ts:162:   if (!employee.projectId || employee.projectId !== device.projectId || device.isActive === false || !employeeWithinAccessEpoch(employee, now)) return false;
convex/lib/mobileAccess.ts:163:   if (device.brand === "ide_smart" || device.brand === "hikvision") return false;
```

</details>

<details><summary>convex/lib/mobileVisitors.ts (17 yazma/durum eşleşmesi)</summary>

```text
convex/lib/mobileVisitors.ts:26:   return visitor.isActive === false && visitor.visitorStatus === "preRegistered" &&
convex/lib/mobileVisitors.ts:27:     visitor.cardNumber.startsWith("PRE:") && !visitor.accessRuleId;
convex/lib/mobileVisitors.ts:82:     status: visitorStatus(visitor, now), canEdit: editableInvitation(visitor),
convex/lib/mobileVisitors.ts:83:   };
convex/lib/mobileVisitors.ts:127: export function mobileVisitorMatches(visitor: Doc<"employees">, search: string, status: MobileVisitorStatus | undefined, now: number) {
convex/lib/mobileVisitors.ts:128:   return Boolean(visitor.mobileVisitorRequestId) && (!status || visitorStatus(visitor, now) === status) &&
convex/lib/mobileVisitors.ts:150: export function encodeVisitorCursor(cursor: string, host: Doc<"employees">, search: string, status: MobileVisitorStatus | undefined, evaluatedAt: number) {
convex/lib/mobileVisitors.ts:151:   return JSON.stringify({ version: 1, host: host._id, project: host.projectId, search, status: status ?? null, evaluatedAt, cursor });
convex/lib/mobileVisitors.ts:151:   return JSON.stringify({ version: 1, host: host._id, project: host.projectId, search, status: status ?? null, evaluatedAt, cursor });
convex/lib/mobileVisitors.ts:152: }
convex/lib/mobileVisitors.ts:155: export interface VisitorSyncEvidence { status: VisitorSyncStatus; observedAt: number; bounded: boolean }
convex/lib/mobileVisitors.ts:156: const SYNC_TARGET_LIMIT = 16;
convex/lib/mobileVisitors.ts:166:   const unknown = (bounded = false): VisitorSyncEvidence => ({ status: "unknown", observedAt, bounded });
convex/lib/mobileVisitors.ts:167:   if (!visitor.projectId || visitor.cardNumber.startsWith("PRE:")) return unknown();
convex/lib/mobileVisitors.ts:176:     if (rule.isActive === false) continue;
convex/lib/mobileVisitors.ts:177:     const [devices, doors] = await Promise.all([
convex/lib/mobileVisitors.ts:192:       if (device.isActive === false) continue;
convex/lib/mobileVisitors.ts:193:       targets.set(id, device);
convex/lib/mobileVisitors.ts:205:       const pages = await Promise.all((["pending", "sent", "acked", "failed"] as const).map(status =>
convex/lib/mobileVisitors.ts:206:         ctx.db.query("idePendingOperations").withIndex("by_device_status", q => q.eq("deviceId", target._id).eq("status", status)).order("desc").take(SYNC_OPERATION_LIMIT + 1)));
convex/lib/mobileVisitors.ts:214:         return op.opType === "upsertUser" && user !== null && user.status === 1 && String(user.id) === String(Number(visitor.cardNumber));
convex/lib/mobileVisitors.ts:215:       }).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
convex/lib/mobileVisitors.ts:217:       const operationState = (op: Doc<"idePendingOperations"> | undefined): VisitorSyncStatus => !op ? "unknown" : op.status === "failed" ? "failed" :
convex/lib/mobileVisitors.ts:218:         op.status === "pending" || op.status === "sent" ? "pending" : op.ackedAt !== undefined && op.ackedAt >= op.createdAt ? "applied" : "unknown";
convex/lib/mobileVisitors.ts:218:         op.status === "pending" || op.status === "sent" ? "pending" : op.ackedAt !== undefined && op.ackedAt >= op.createdAt ? "applied" : "unknown";
convex/lib/mobileVisitors.ts:219:       const targetStates = [operationState(operation)];
convex/lib/mobileVisitors.ts:236:         targetStates.every(state => state === "applied") ? "applied" : "unknown");
convex/lib/mobileVisitors.ts:237:     } else if (target.brand === "hikvision") {
convex/lib/mobileVisitors.ts:238:       const pages = await Promise.all((["pending", "processing", "done", "failed"] as const).map(status =>
convex/lib/mobileVisitors.ts:239:         ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", target._id).eq("status", status)).order("desc").take(SYNC_OPERATION_LIMIT + 1)));
convex/lib/mobileVisitors.ts:248:       statuses.push(!operation ? "unknown" : operation.status === "failed" ? "failed" : operation.status === "done" ? "unknown" : "pending");
convex/lib/mobileVisitors.ts:249:     } else statuses.push("unknown");
convex/lib/mobileVisitors.ts:251:   const status: VisitorSyncStatus = statuses.includes("failed") ? "failed" : statuses.includes("pending") ? "pending" :
convex/lib/mobileVisitors.ts:252:     !bounded && statuses.length > 0 && statuses.every(value => value === "applied") ? "applied" : "unknown";
```

</details>

<details><summary>convex/lib/pdksDay.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/pdksDay.ts:364:       pendingUntil: flexiblePendingUntil(flex, date, firstISO),
convex/lib/pdksDay.ts:365:       leaveWorkWarning: !!params.hasLeave && (!!firstISO || !!lastISO),
```

</details>

<details><summary>convex/lib/pdksDetail.ts (9 yazma/durum eşleşmesi)</summary>

```text
convex/lib/pdksDetail.ts:53:   const status = classifyPdksDay({
convex/lib/pdksDetail.ts:54:     noShift: day.noShift,
convex/lib/pdksDetail.ts:65:     pendingUntil: day.pendingUntil,
convex/lib/pdksDetail.ts:66:     durationMeasured: day.durationMeasured,
convex/lib/pdksDetail.ts:94:       status === "incomplete" || status === "future" || status === "noData" || status === "notEmployed"
convex/lib/pdksDetail.ts:95:         ? "—"
convex/lib/pdksDetail.ts:115:   days: ReadonlyArray<OvertimeDay & { status: string }>,
convex/lib/pdksDetail.ts:116:   options: Parameters<typeof calculatePeriodOvertime>[1],
convex/lib/pdksDetail.ts:122:       if (d.status === "present" || d.status === "late") acc.workedDays += 1;
convex/lib/pdksDetail.ts:123:       if (d.status === "late") acc.lateDays += 1;
convex/lib/pdksDetail.ts:123:       if (d.status === "late") acc.lateDays += 1;
convex/lib/pdksDetail.ts:124:       if (d.status === "absent") acc.absentDays += 1;
convex/lib/pdksDetail.ts:124:       if (d.status === "absent") acc.absentDays += 1;
convex/lib/pdksDetail.ts:125:       if (d.status === "incomplete") acc.incompleteDays += 1;
convex/lib/pdksDetail.ts:125:       if (d.status === "incomplete") acc.incompleteDays += 1;
convex/lib/pdksDetail.ts:126:       if (d.status === "leave") acc.leaveDays += 1;
convex/lib/pdksDetail.ts:126:       if (d.status === "leave") acc.leaveDays += 1;
convex/lib/pdksDetail.ts:127:       return acc;
```

</details>

<details><summary>convex/lib/pdksPayroll.ts (3 yazma/durum eşleşmesi)</summary>

```text
convex/lib/pdksPayroll.ts:51:   const status = classifyPdksDay({
convex/lib/pdksPayroll.ts:52:     noShift: day.noShift,
convex/lib/pdksPayroll.ts:63:     pendingUntil: day.pendingUntil,
convex/lib/pdksPayroll.ts:64:     durationMeasured: day.durationMeasured,
convex/lib/pdksPayroll.ts:83:       status === "incomplete" || status === "future" || status === "noData" || status === "notEmployed"
convex/lib/pdksPayroll.ts:84:         ? "—"
```

</details>

<details><summary>convex/lib/pdksPayrollQuery.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/lib/pdksPayrollQuery.ts:146:     .flat().filter(l => l.status === "approved" && l.endDate >= startDate);
convex/lib/pdksPayrollQuery.ts:147: 
convex/lib/pdksPayrollQuery.ts:222:           if (c.status === "incomplete") acc.incompleteDays += 1;
convex/lib/pdksPayrollQuery.ts:223:           if (c.payrollCode === "DV") acc.absentDays += 1;
```

</details>

<details><summary>convex/lib/pdksTable.ts (13 yazma/durum eşleşmesi)</summary>

```text
convex/lib/pdksTable.ts:66:   const status = resolveDayStatus({
convex/lib/pdksTable.ts:67:     ...params,
convex/lib/pdksTable.ts:75:     if (status === "weekend" || status === "holiday" || status === "leave") return status;
convex/lib/pdksTable.ts:76:     if (params.pendingUntil === undefined && params.attendanceDecision !== "present" && params.shiftEnd) {
convex/lib/pdksTable.ts:76:     if (params.pendingUntil === undefined && params.attendanceDecision !== "present" && params.shiftEnd) {
convex/lib/pdksTable.ts:77:       const endDate = params.shiftStart && params.shiftEnd <= params.shiftStart
convex/lib/pdksTable.ts:82:     if (status === "absent" && params.firstRecordDate === null && !params.hasAttendance) return "noData";
convex/lib/pdksTable.ts:83:     if (!params.hasAttendance && params.firstRecordDate && params.date < params.firstRecordDate) return "notEmployed";
convex/lib/pdksTable.ts:84:     if (status === "absent" && !params.dataAvailable) return "noData";
convex/lib/pdksTable.ts:85:     return status;
convex/lib/pdksTable.ts:144:   status: PdksDayStatus;
convex/lib/pdksTable.ts:145:   leaveType: string | null;
convex/lib/pdksTable.ts:182:   status: PdksDayStatus;
convex/lib/pdksTable.ts:183:   isLate: boolean;
convex/lib/pdksTable.ts:344:     const status = noShift ? "noData" : outsideEmployment ? "notEmployed" : classifyPdksDay({
convex/lib/pdksTable.ts:345:       date,
convex/lib/pdksTable.ts:357:       pendingUntil: day.pendingUntil,
convex/lib/pdksTable.ts:358:       durationMeasured: day.durationMeasured,
convex/lib/pdksTable.ts:385:         status === "incomplete" || status === "future" || status === "noData" || status === "notEmployed"
convex/lib/pdksTable.ts:386:           ? "—"
convex/lib/pdksTable.ts:460:   const status = first?.cell.status ?? "noData";
convex/lib/pdksTable.ts:461:   const flexibleDays = calculations.filter(c => c.day.scheduleType === "flexible");
convex/lib/pdksTable.ts:471:     incompleteDays: calculations.filter(c => c.cell.status === "incomplete").length,
convex/lib/pdksTable.ts:472:     durationMeasured: assignedCalculations.length > 0 && assignedCalculations.every(c => c.day.durationMeasured),
convex/lib/pdksTable.ts:537:     return row.status === statusFilter;
convex/lib/pdksTable.ts:538:   });
```

</details>

<details><summary>convex/lib/pdksTableQuery.ts (1 yazma/durum eşleşmesi)</summary>

```text
convex/lib/pdksTableQuery.ts:169:     .flat().filter(l => l.status === "approved" && l.endDate >= startDate);
convex/lib/pdksTableQuery.ts:170: 
```

</details>

<details><summary>convex/lib/peopleActivity.ts (8 yazma/durum eşleşmesi)</summary>

```text
convex/lib/peopleActivity.ts:20:     status: "pending" | "processing" | "failed" | "done";
convex/lib/peopleActivity.ts:21:     processingStartedAt?: number;
convex/lib/peopleActivity.ts:26:     status: "pending" | "sent" | "failed" | "acked";
convex/lib/peopleActivity.ts:27:     opType: string;
convex/lib/peopleActivity.ts:91:   if (op.status === "pending") return "queued";
convex/lib/peopleActivity.ts:92:   if (op.status === "processing" || op.status === "sent") return "processing";
convex/lib/peopleActivity.ts:92:   if (op.status === "processing" || op.status === "sent") return "processing";
convex/lib/peopleActivity.ts:93:   if (op.status === "failed") return "failed";
convex/lib/peopleActivity.ts:93:   if (op.status === "failed") return "failed";
convex/lib/peopleActivity.ts:94:   // Silme onayı kişi kaydının hedef cihazda bulunduğunu kanıtlamaz.
convex/lib/peopleActivity.ts:96:     op.status === "acked" && op.ackedAt !== undefined && Number.isFinite(op.ackedAt)) {
convex/lib/peopleActivity.ts:97:     return "verified";
convex/lib/peopleActivity.ts:130:     const status: EmployeeSyncState = truncated ? "unknown" : op ? stateForOperation(op) :
convex/lib/peopleActivity.ts:131:       roster ? "verified" : "unknown";
convex/lib/peopleActivity.ts:141:     if (row.status === "queued" || row.status === "processing") summary.pending++;
convex/lib/peopleActivity.ts:142:     else summary[row.status]++;
```

</details>

<details><summary>convex/lib/peopleHikSnapshot.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/lib/peopleHikSnapshot.ts:45:     if (grant.state === "removed" || known.has(grant.deviceId)) continue;
convex/lib/peopleHikSnapshot.ts:46:     const device = await ctx.db.get(grant.deviceId);
convex/lib/peopleHikSnapshot.ts:75:   if (!device.isActive || device.brand !== "hikvision" || employee.isActive === false || employee.projectId !== device.projectId) return false;
convex/lib/peopleHikSnapshot.ts:76:   if (device.hikTransport !== "localBridge" && !device.hikDevIndex) return false;
```

</details>

<details><summary>convex/lib/processCardReadingCore.ts (14 yazma/durum eşleşmesi)</summary>

```text
convex/lib/processCardReadingCore.ts:84:   const state: ReadingState = { accessTime, projectForRow, hikFields, findDeviceCardEmployee };
convex/lib/processCardReadingCore.ts:85:   const device = await resolveReadingDevice(ctx, args);
convex/lib/processCardReadingCore.ts:166:   state: ReadingState,
convex/lib/processCardReadingCore.ts:167: ): Promise<{ granted: boolean }> {
convex/lib/processCardReadingCore.ts:234:     await ctx.db.patch(device._id, { hikLastSerialNo: args.hikSerialNo });
convex/lib/processCardReadingCore.ts:235:   }
convex/lib/processCardReadingCore.ts:237:   await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:238:     projectId: projectForRow(employee?.projectId, device.projectId),
convex/lib/processCardReadingCore.ts:261:   state: ReadingState,
convex/lib/processCardReadingCore.ts:262: ): Promise<{ granted: boolean }> {
convex/lib/processCardReadingCore.ts:297:   await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:298:     projectId: projectForRow(employee?.projectId, device.projectId),
convex/lib/processCardReadingCore.ts:353:   await ctx.db.patch(tokenRow._id, { usedAt: consumedAt, employeeName, locationRecorded: false });
convex/lib/processCardReadingCore.ts:354:   const direction = await resolveDirection(ctx, { device, employeeId: tokenEmployee._id, nowISO: consumedAt });
convex/lib/processCardReadingCore.ts:356:   await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:357:     projectId: device.projectId, deviceId: device._id, employeeId: tokenEmployee._id,
convex/lib/processCardReadingCore.ts:369:   state: ReadingState,
convex/lib/processCardReadingCore.ts:370: ): Promise<{ granted: boolean }> {
convex/lib/processCardReadingCore.ts:377:     await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:378:       projectId: projectForRow(undefined, device?.projectId),
convex/lib/processCardReadingCore.ts:395:       !device || device.isActive === false) {
convex/lib/processCardReadingCore.ts:396:     await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:396:     await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:397:       projectId: projectForRow(employee.projectId, device?.projectId),
convex/lib/processCardReadingCore.ts:426:     await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:427:       projectId: projectForRow(employee.projectId, device.projectId),
convex/lib/processCardReadingCore.ts:453:   const readingId = await ctx.db.insert("cardReadings", {
convex/lib/processCardReadingCore.ts:454:     projectId: projectForRow(employee.projectId, device.projectId),
```

</details>

<details><summary>convex/lib/reportAttendance.ts (6 yazma/durum eşleşmesi)</summary>

```text
convex/lib/reportAttendance.ts:54:     ...(params.policyFor ? { incompleteDays: row.days.filter(day => day.status === "incomplete").length } : {}),
convex/lib/reportAttendance.ts:55:     expectedDays: issues.length ? null : expectedDays,
convex/lib/reportAttendance.ts:86:       leaveLists[index].filter(leave => pdksLeaveMatchesProject(leave, projectId) && leave.status === "approved" && leave.endDate >= startDate)]));
convex/lib/reportAttendance.ts:87:     const calendarIssues = attendanceCalendarIssues(year, periodDateKeys, holidayMap);
convex/lib/reportAttendance.ts:185: export function readingResult(status: Doc<"cardReadings">["accessStatus"]): ReportTransactionResult {
convex/lib/reportAttendance.ts:186:   if (status === "izin_verildi") return "granted";
convex/lib/reportAttendance.ts:186:   if (status === "izin_verildi") return "granted";
convex/lib/reportAttendance.ts:187:   if (status === "reddedildi") return "denied";
convex/lib/reportAttendance.ts:187:   if (status === "reddedildi") return "denied";
convex/lib/reportAttendance.ts:188:   return "unknown";
convex/lib/reportAttendance.ts:355:         allLeaves: leaves.filter(l => l.status === "approved" && pdksLeaveMatchesProject(l, projectId)), holidayMap,
convex/lib/reportAttendance.ts:356:         workSettings, overtimeRates, resolveShift: shifts.resolve, resolvePlan: shifts.resolvePlan, resolveLast: shifts.resolveLast, manualEditedBy: null,
```

</details>

<details><summary>convex/lib/syncStatusLogic.ts (6 yazma/durum eşleşmesi)</summary>

```text
convex/lib/syncStatusLogic.ts:3:   rows: ReadonlyArray<{ status: string; dismissedAt?: number }>,
convex/lib/syncStatusLogic.ts:4: ) {
convex/lib/syncStatusLogic.ts:7:     failed: rows.filter((row) => row.status === "failed").length,
convex/lib/syncStatusLogic.ts:8:     dismissedFailed: rows.filter((row) => row.status === "failed" && row.dismissedAt !== undefined).length,
convex/lib/syncStatusLogic.ts:8:     dismissedFailed: rows.filter((row) => row.status === "failed" && row.dismissedAt !== undefined).length,
convex/lib/syncStatusLogic.ts:9:   };
convex/lib/syncStatusLogic.ts:34:   read: (projectId: P | undefined, status: S, limit: number) => Promise<R[]>,
convex/lib/syncStatusLogic.ts:35:   resolveLegacyProject: (row: R) => Promise<P | undefined>,
convex/lib/syncStatusLogic.ts:63: export function canRetrySync(status: string) {
convex/lib/syncStatusLogic.ts:64:   return status === "failed";
convex/lib/syncStatusLogic.ts:64:   return status === "failed";
convex/lib/syncStatusLogic.ts:65: }
```

</details>

<details><summary>convex/lib/transferGuard.ts (13 yazma/durum eşleşmesi)</summary>

```text
convex/lib/transferGuard.ts:19:   return activeTransferStatuses.some(status => status === transfer.status);
convex/lib/transferGuard.ts:20: }
convex/lib/transferGuard.ts:37:   // Point lookups per status: a prefix scan would be crowded out by old cancelled runs.
convex/lib/transferGuard.ts:38:   for (const status of activeTransferStatuses) {
convex/lib/transferGuard.ts:102:     if (!transfer || transfer.status === "cancelled") continue;
convex/lib/transferGuard.ts:103:     const matches = op.opType ? String(identity) === cardNumericKey(transfer.cardNumber) : identity === transfer.cardNumber;
convex/lib/transferGuard.ts:114:   await ctx.db.patch(transferId, { status: "revoked", stuckReason: undefined, lastError: undefined });
convex/lib/transferGuard.ts:115:   await ctx.scheduler.runAfter(0, internal.employeeTermination.completeTransfer, { transferId });
convex/lib/transferGuard.ts:118: export async function updateTransferTarget(ctx: MutationCtx, employeeId: Id<"employees">, deviceId: Id<"devices">, state: "confirmed" | "failed" | "superseded", lastError?: string): Promise<void> {
convex/lib/transferGuard.ts:119:   const rows = transferBound(await ctx.db.query("accessTransferTargets").withIndex("by_employee_device", q => q.eq("employeeId", employeeId).eq("deviceId", deviceId)).take(TRANSFER_LIMIT + 1));
convex/lib/transferGuard.ts:122:     if (!transfer || (!transferIsActive(transfer) && !(transfer.status === "done" && state !== "superseded")) || row.state === "confirmed" || row.state === "deviceRemoved") continue;
convex/lib/transferGuard.ts:123:     if (row.state === "superseded" && state === "failed") continue;
convex/lib/transferGuard.ts:123:     if (row.state === "superseded" && state === "failed") continue;
convex/lib/transferGuard.ts:124:     // A later failure/supersede cannot undo a positive physical acknowledgement.
convex/lib/transferGuard.ts:125:     await ctx.db.patch(row._id, { state, lastError: state === "confirmed" ? undefined : lastError?.slice(0, 2000), confirmedAt: state === "confirmed" ? Date.now() : undefined, updatedAt: Date.now() });
convex/lib/transferGuard.ts:126:     if (state === "superseded") await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "Silme işi başka bir işlem tarafından geçersiz kılındı. Taşımayı iptal edin veya cihazı kaynak projeden kaldırın.", lastError });
convex/lib/transferGuard.ts:126:     if (state === "superseded") await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "Silme işi başka bir işlem tarafından geçersiz kılındı. Taşımayı iptal edin veya cihazı kaynak projeden kaldırın.", lastError });
convex/lib/transferGuard.ts:127:     if (state === "confirmed") await advanceTransfer(ctx, transfer._id);
convex/lib/transferGuard.ts:127:     if (state === "confirmed") await advanceTransfer(ctx, transfer._id);
convex/lib/transferGuard.ts:128:   }
convex/lib/transferGuard.ts:130: export async function transferOperationFailed(ctx: MutationCtx, op: { payload: unknown; deviceId: Id<"devices"> }, reason: string, state: "failed" | "superseded" = "failed"): Promise<void> {
convex/lib/transferGuard.ts:131:   const payload = operationPayload(op.payload);
convex/lib/transferGuard.ts:149:       await ctx.db.patch(row._id, { state: "deviceRemoved", updatedAt: Date.now(), lastError: undefined });
convex/lib/transferGuard.ts:150:       await writeAudit(ctx, { user: ctx.user ?? null, projectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId, state: "deviceRemoved" }, note: "Taşıma hedefi kapandı: cihaz kaynak projeden kaldırıldı" });
convex/lib/transferGuard.ts:150:       await writeAudit(ctx, { user: ctx.user ?? null, projectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId, state: "deviceRemoved" }, note: "Taşıma hedefi kapandı: cihaz kaynak projeden kaldırıldı" });
convex/lib/transferGuard.ts:151:       await advanceTransfer(ctx, transfer._id);
```

</details>

<details><summary>convex/maintenance.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/maintenance.ts:21:         await ctx.db.delete(row._id);
convex/maintenance.ts:22:         hikDeleted++;
convex/maintenance.ts:32:         await ctx.db.delete(row._id);
convex/maintenance.ts:33:         ideDeleted++;
```

</details>

<details><summary>convex/migrations.ts (7 yazma/durum eşleşmesi)</summary>

```text
convex/migrations.ts:40:         await ctx.db.patch(door._id, {
convex/migrations.ts:41:           deviceId: zone.ideDeviceId,
convex/migrations.ts:74:         await ctx.db.delete(door._id);
convex/migrations.ts:75:         doorsDeleted++;
convex/migrations.ts:77:       await ctx.db.delete(zone._id);
convex/migrations.ts:78:       zonesDeleted++;
convex/migrations.ts:149:         await ctx.db.patch(employee._id, { email: email ?? "" });
convex/migrations.ts:150:         updated++;
convex/migrations.ts:154:         await ctx.db.patch(auth._id, { email: normalizeEmployeeEmail(auth.email) });
convex/migrations.ts:155:       }
convex/migrations.ts:178:       await ctx.db.patch(shift._id, { color: undefined });
convex/migrations.ts:179:       cleared++;
convex/migrations.ts:214:         if (!dryRun) await ctx.db.patch(row._id, { weekPattern });
convex/migrations.ts:215:       }
```

</details>

<details><summary>convex/mobileAccess.ts (31 yazma/durum eşleşmesi)</summary>

```text
convex/mobileAccess.ts:13:   status: "pending" | "sent" | "confirmed" | "failed" | "unknown";
convex/mobileAccess.ts:14:   deviceId: Id<"devices">;
convex/mobileAccess.ts:28:   let status = row.status;
convex/mobileAccess.ts:29:   let errorCode = row.errorCode;
convex/mobileAccess.ts:33:     status = !command ? "unknown" : command.status === "acked" ? "confirmed"
convex/mobileAccess.ts:34:       : command.status === "failed" ? command.attempts > 0 ? "unknown" : "failed"
convex/mobileAccess.ts:34:       : command.status === "failed" ? command.attempts > 0 ? "unknown" : "failed"
convex/mobileAccess.ts:35:       : command.status;
convex/mobileAccess.ts:39:     status = !command ? "unknown" : command.status === "done" ? "confirmed"
convex/mobileAccess.ts:40:       : command.status === "processing" ? "sent"
convex/mobileAccess.ts:40:       : command.status === "processing" ? "sent"
convex/mobileAccess.ts:41:       : command.status === "failed" ? command.attemptCount > 0 ? "unknown" : "failed" : "pending";
convex/mobileAccess.ts:41:       : command.status === "failed" ? command.attemptCount > 0 ? "unknown" : "failed" : "pending";
convex/mobileAccess.ts:42:   }
convex/mobileAccess.ts:43:   if ((status === "pending" || status === "sent") && now - Date.parse(row.requestedAt) >= OPERATION_LIFETIME_MS) {
convex/mobileAccess.ts:44:     status = status === "sent" ? "unknown" : "failed";
convex/mobileAccess.ts:44:     status = status === "sent" ? "unknown" : "failed";
convex/mobileAccess.ts:45:     errorCode = status === "unknown" ? "COMMAND_OUTCOME_UNKNOWN" : "COMMAND_EXPIRED";
convex/mobileAccess.ts:45:     errorCode = status === "unknown" ? "COMMAND_OUTCOME_UNKNOWN" : "COMMAND_EXPIRED";
convex/mobileAccess.ts:46:   }
convex/mobileAccess.ts:47:   if (status === "unknown") errorCode ??= "COMMAND_OUTCOME_UNKNOWN";
convex/mobileAccess.ts:48:   if (status === "failed") errorCode ??= "COMMAND_FAILED";
convex/mobileAccess.ts:48:   if (status === "failed") errorCode ??= "COMMAND_FAILED";
convex/mobileAccess.ts:49:   return {
convex/mobileAccess.ts:77:     const operationId = await ctx.db.insert("mobileAccessOperations", {
convex/mobileAccess.ts:78:       projectId: employee.projectId, employeeId: employee._id, requestId: args.requestId,
convex/mobileAccess.ts:81:       deviceName: target.name, requestedAt: new Date(now).toISOString(), status: "pending",
convex/mobileAccess.ts:82:       transport: target.transport, actuator: target.actuator,
convex/mobileAccess.ts:87:       const ideOperationId = await ctx.db.insert("idePendingOperations", {
convex/mobileAccess.ts:88:         projectId: employee.projectId, deviceId: device._id, opType: "openDoor",
convex/mobileAccess.ts:90:         idempotencyKey: `mobile:${operationId}`, status: "pending", attempts: 0, maxAttempts: 1, nextRetryAt: now, createdAt: now,
convex/mobileAccess.ts:91:       });
convex/mobileAccess.ts:92:       await ctx.db.patch(operationId, { ideOperationId });
convex/mobileAccess.ts:93:     } else if (target.transport === "hik_local_bridge") {
convex/mobileAccess.ts:94:       const hikOperationId = await ctx.db.insert("hikPendingOperations", {
convex/mobileAccess.ts:95:         projectId: employee.projectId, deviceId: device._id, operation: "openDoor",
convex/mobileAccess.ts:97:         status: "pending", attemptCount: 0, nextRetryAt: now, createdAt: now,
convex/mobileAccess.ts:98:       });
convex/mobileAccess.ts:99:       await ctx.db.patch(operationId, { hikOperationId });
convex/mobileAccess.ts:100:       await scheduleBridgeWakeForProject(ctx, employee.projectId);
convex/mobileAccess.ts:105:     return { operationId, status: "pending", deviceId: target.deviceId,
convex/mobileAccess.ts:106:       ...(target.doorId ? { doorId: target.doorId } : {}), deviceName: target.name, requestedAt: new Date(now).toISOString() };
convex/mobileAccess.ts:139:       await ctx.db.patch(row._id, { status: "failed", errorCode: "TARGET_NOT_ALLOWED" });
convex/mobileAccess.ts:140:       return null;
convex/mobileAccess.ts:145:     await ctx.db.patch(row._id, { status: "sent" });
convex/mobileAccess.ts:146:     return { devIndex: device.hikDevIndex, actuator: row.actuator };
convex/mobileAccess.ts:151:   args: { operationId: v.id("mobileAccessOperations"), status: v.union(v.literal("confirmed"), v.literal("unknown")) },
convex/mobileAccess.ts:152:   handler: async (ctx, args): Promise<null> => {
convex/mobileAccess.ts:154:     if (row?.transport === "hik_gateway" && row.status === "sent") {
convex/mobileAccess.ts:155:       await ctx.db.patch(row._id, { status: args.status, ...(args.status === "unknown" ? { errorCode: "COMMAND_OUTCOME_UNKNOWN" } : {}) });
convex/mobileAccess.ts:155:       await ctx.db.patch(row._id, { status: args.status, ...(args.status === "unknown" ? { errorCode: "COMMAND_OUTCOME_UNKNOWN" } : {}) });
convex/mobileAccess.ts:156:     }
convex/mobileAccess.ts:170:       if (command?.status === "pending") {
convex/mobileAccess.ts:171:         await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
convex/mobileAccess.ts:171:         await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
convex/mobileAccess.ts:172:         unsent = true;
convex/mobileAccess.ts:177:       if (command?.status === "pending") {
convex/mobileAccess.ts:178:         await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
convex/mobileAccess.ts:178:         await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
convex/mobileAccess.ts:179:         unsent = true;
convex/mobileAccess.ts:182:     if (unsent) await ctx.db.patch(row._id, { status: "failed", errorCode: "COMMAND_EXPIRED" });
convex/mobileAccess.ts:183:     return null;
```

</details>

<details><summary>convex/mobileAccessGateway.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/mobileAccessGateway.ts:13:     let status: "confirmed" | "unknown" = "unknown";
convex/mobileAccessGateway.ts:14:     try {
convex/mobileAccessGateway.ts:19:       if (result.ok) status = "confirmed";
convex/mobileAccessGateway.ts:20:     } catch {
```

</details>

<details><summary>convex/mobileAttendance.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/mobileAttendance.ts:165:       allLeaves: leaves.filter(leave => leave.status === "approved" && (!leave.projectId || leave.projectId === projectId)),
convex/mobileAttendance.ts:166:       holidayMap: new Map([...globalHolidays, ...projectHolidays].map(holiday => [holiday.date, holiday])),
convex/mobileAttendance.ts:169:     const presentDates = new Set(row.days.filter(day => day.status === "present" || day.status === "late").map(day => day.date));
convex/mobileAttendance.ts:170:     const summary = summarizeMovements(calendarReadings, args.startDate, args.endDate, projectId, new Date().toISOString(), policyFor, { workDate, presentDates }, date => resolvePlan(employee._id, date).kind !== "none");
```

</details>

<details><summary>convex/pdksRules.ts (6 yazma/durum eşleşmesi)</summary>

```text
convex/pdksRules.ts:201:       for (const row of await selections(ctx, id)) await ctx.db.delete(row._id);
convex/pdksRules.ts:202:       await ctx.db.replace(id, data);
convex/pdksRules.ts:202:       await ctx.db.replace(id, data);
convex/pdksRules.ts:203:     } else id = await ctx.db.insert("pdksRuleVersions", data);
convex/pdksRules.ts:203:     } else id = await ctx.db.insert("pdksRuleVersions", data);
convex/pdksRules.ts:204:     for (const snapshot of snapshots) await ctx.db.insert("pdksCheckpointSelections", { ...snapshot, projectId: args.projectId, ruleVersionId: id });
convex/pdksRules.ts:204:     for (const snapshot of snapshots) await ctx.db.insert("pdksCheckpointSelections", { ...snapshot, projectId: args.projectId, ruleVersionId: id });
convex/pdksRules.ts:205:     await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: existing ? "update" : "create", targetTable: "pdksRuleVersions", targetId: id, oldValue: existing, newValue: data });
convex/pdksRules.ts:217:     for (const row of await selections(ctx, ruleVersionId)) await ctx.db.delete(row._id);
convex/pdksRules.ts:218:     await ctx.db.delete(ruleVersionId);
convex/pdksRules.ts:218:     await ctx.db.delete(ruleVersionId);
convex/pdksRules.ts:219:     await writeAudit(ctx, { user: ctx.user, projectId: version.projectId, action: "delete", targetTable: "pdksRuleVersions", targetId: ruleVersionId, oldValue: version });
```

</details>

<details><summary>convex/peopleActivity.ts (3 yazma/durum eşleşmesi)</summary>

```text
convex/peopleActivity.ts:48:       Promise.all((hasHik ? hikStatuses : []).map(status => ctx.db.query("hikPendingOperations")
convex/peopleActivity.ts:49:         .withIndex("by_project_status_created", q => q.eq("projectId", projectId).eq("status", status))
convex/peopleActivity.ts:51:       Promise.all((hasIde ? ideStatuses : []).map(status => ctx.db.query("idePendingOperations")
convex/peopleActivity.ts:52:         .withIndex("by_project_status_created", q => q.eq("projectId", projectId).eq("status", status))
convex/peopleActivity.ts:102:     const batches = await Promise.all(statuses.map(status => ctx.db.query("cardReadings")
convex/peopleActivity.ts:103:       .withIndex("by_employee_status_time", q => q.eq("employeeId", employeeId).eq("accessStatus", status))
```

</details>

<details><summary>convex/privacyRetention.ts (20 yazma/durum eşleşmesi)</summary>

```text
convex/privacyRetention.ts:72:     const sample = maskChatNames(readings.slice(0, 5).map(row => ({ employeeId: row.employeeId, employeeName: row.employeeName, time: row.accessTime, status: row.accessStatus })), aiMaskNames)
convex/privacyRetention.ts:73:       .map(({ employeeName, time, status }) => ({ employeeName, time, status }));
convex/privacyRetention.ts:103:     for (const row of rows) await ctx.db.delete(row._id);
convex/privacyRetention.ts:104:     const deleted = args.deleted + rows.length;
convex/privacyRetention.ts:174:     if (row) await ctx.db.patch(row._id, patch);
convex/privacyRetention.ts:175:     else await ctx.db.insert("projectPrivacySettings", { projectId, ...patch });
convex/privacyRetention.ts:175:     else await ctx.db.insert("projectPrivacySettings", { projectId, ...patch });
convex/privacyRetention.ts:176:     await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "projectPrivacySettings", targetId: projectId,
convex/privacyRetention.ts:235: const elapsedRetryAt = (nextRetryAt: number | undefined, runAt: number) =>
convex/privacyRetention.ts:236:   nextRetryAt !== undefined && nextRetryAt < Number.MAX_SAFE_INTEGER && nextRetryAt <= runAt ? nextRetryAt : 0;
convex/privacyRetention.ts:236:   nextRetryAt !== undefined && nextRetryAt < Number.MAX_SAFE_INTEGER && nextRetryAt <= runAt ? nextRetryAt : 0;
convex/privacyRetention.ts:237: const opts = (args: BatchArgs) => ({ numItems: PURGE_BATCH_SIZE, cursor: args.cursor ?? null });
convex/privacyRetention.ts:252:     const status = stages[args.stage][1] === "done" ? "done" : "failed";
convex/privacyRetention.ts:253:     const before = cutoff(args, OPERATION_RETENTION_DAYS);
convex/privacyRetention.ts:258:       const unresolvedRevocation = row.status === "failed" && (row.operation.startsWith("delete") || row.operation === "addPerson" || row.operation === "updatePerson") && row.dismissedAt === undefined;
convex/privacyRetention.ts:259:       if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
convex/privacyRetention.ts:259:       if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
convex/privacyRetention.ts:260:     }
convex/privacyRetention.ts:269:     const status = stages[args.stage][1] === "acked" ? "acked" : "failed";
convex/privacyRetention.ts:270:     const before = cutoff(args, OPERATION_RETENTION_DAYS);
convex/privacyRetention.ts:274:       const unresolvedRevocation = row.status === "failed" && (row.opType.startsWith("delete") || row.opType === "upsertUser") && row.dismissedAt === undefined;
convex/privacyRetention.ts:275:       if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
convex/privacyRetention.ts:275:       if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
convex/privacyRetention.ts:276:     }
convex/privacyRetention.ts:286:     const status = value === "done" || value === "partial" ? value : "failed";
convex/privacyRetention.ts:287:     let deleted = 0;
convex/privacyRetention.ts:294:       for (const target of targets) await ctx.db.delete(target._id);
convex/privacyRetention.ts:295:       deleted += targets.length;
convex/privacyRetention.ts:296:       if (targets.length < capacity) { await ctx.db.delete(run._id); deleted++; }
convex/privacyRetention.ts:297:     }
convex/privacyRetention.ts:307:     for (const row of page.page) await ctx.db.delete(row._id);
convex/privacyRetention.ts:308:     await advance(ctx, args, page.isDone, page.continueCursor);
convex/privacyRetention.ts:322:       if (!row.usedAt || row.usedAt < before) await ctx.db.delete(row._id);
convex/privacyRetention.ts:323:     }
convex/privacyRetention.ts:333:     for (const row of page.page) await ctx.db.delete(row._id);
convex/privacyRetention.ts:334:     await advance(ctx, args, page.isDone, page.continueCursor);
convex/privacyRetention.ts:343:     const status = value === "confirmed" || value === "unknown" ? value : "failed";
convex/privacyRetention.ts:344:     const page = await ctx.db.query("mobileAccessOperations").withIndex("by_status_and_requestedAt", q => q.eq("status", status).lt("requestedAt", isoCutoff(args, MOBILE_OPERATION_RETENTION_DAYS))).paginate(opts(args));
convex/privacyRetention.ts:345:     for (const row of page.page) await ctx.db.delete(row._id);
convex/privacyRetention.ts:346:     await advance(ctx, args, page.isDone, page.continueCursor);
```

</details>

<details><summary>convex/projects.ts (14 yazma/durum eşleşmesi)</summary>

```text
convex/projects.ts:38:       return projects.filter(p => p.isActive === true);
convex/projects.ts:39:     }
convex/projects.ts:42:     return projects.filter((p): p is NonNullable<typeof p> => p !== null && p.isActive === true);
convex/projects.ts:43:   },
convex/projects.ts:63:     isActive: v.optional(v.boolean()),
convex/projects.ts:64:   },
convex/projects.ts:68:     const id = await ctx.db.insert("projects", {
convex/projects.ts:69:       name: projectName(args.name),
convex/projects.ts:72:       isActive: args.isActive ?? true,
convex/projects.ts:73:       createdAt: now,
convex/projects.ts:76:     await ctx.db.insert("userProjects", { userId: ctx.user._id, projectId: id, role: "admin", createdAt: now });
convex/projects.ts:77:     await upsertPrivacySettings(ctx, id, { biometricEnabled: true });
convex/projects.ts:89:     isActive: v.optional(v.boolean()),
convex/projects.ts:90:   },
convex/projects.ts:104:     await ctx.db.patch(projectId, updateData);
convex/projects.ts:105:     return projectId;
convex/projects.ts:126:       for (const row of rows) await ctx.db.delete(row._id);
convex/projects.ts:127:     }
convex/projects.ts:129:     await ctx.db.delete(args.id);
convex/projects.ts:130:     return args.id;
convex/projects.ts:136:     search: v.optional(v.string()), status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
convex/projects.ts:137:     paginationOpts: paginationOptsValidator,
convex/projects.ts:143:       return (!args.status || (project.isActive === true) === (args.status === "active")) && adminSearch(args.search, project.name, project.description);
convex/projects.ts:144:     }).paginate(adminPaginationOptions(args.paginationOpts, 25));
convex/projects.ts:154:         return { _id: project._id, name: project.name, description: project.description, isActive: project.isActive === true,
convex/projects.ts:155:           createdAt: project.createdAt, memberCount: memberCount.count, memberCountCapped: memberCount.capped,
convex/projects.ts:193:         .filterWith(async row => row.isActive === true && row.isVisitor !== true && row.cardNumber.trim().length > 0).first(),
convex/projects.ts:194:       ctx.db.query("accessRules")
```

</details>

<details><summary>convex/readers.ts (11 yazma/durum eşleşmesi)</summary>

```text
convex/readers.ts:67:     status: v.optional(v.string()),
convex/readers.ts:68:   },
convex/readers.ts:98:     return await ctx.db.insert("readers", {
convex/readers.ts:99:       doorId: args.doorId,
convex/readers.ts:109:       status: args.status ?? "active",
convex/readers.ts:110:       createdAt: now,
convex/readers.ts:152:     await ctx.db.patch(args.readerId, {
convex/readers.ts:153:       doorId: args.targetDoorId,
convex/readers.ts:172:     status: v.optional(v.string()),
convex/readers.ts:173:   },
convex/readers.ts:183:     await ctx.db.patch(readerId, {
convex/readers.ts:184:       ...updates,
convex/readers.ts:208:     await ctx.db.patch(args.readerId, {
convex/readers.ts:209:       hikLastCfgSnapshot: args.snapshot,
convex/readers.ts:230:     await ctx.db.delete(args.readerId);
convex/readers.ts:231:   },
convex/readers.ts:274:       await ctx.db.insert("readers", {
convex/readers.ts:275:         doorId: door._id,
convex/readers.ts:283:         status: "active",
convex/readers.ts:284:         createdAt: now,
convex/readers.ts:307:   await Promise.all(readers.map((r) => ctx.db.delete(r._id)));
convex/readers.ts:308: }
```

</details>

<details><summary>convex/seedCardReaderTest.ts (12 yazma/durum eşleşmesi)</summary>

```text
convex/seedCardReaderTest.ts:19:       projectId = await ctx.db.insert("projects", {
convex/seedCardReaderTest.ts:20:         name: "Test Projesi",
convex/seedCardReaderTest.ts:21:         isActive: true,
convex/seedCardReaderTest.ts:22:         createdAt: now,
convex/seedCardReaderTest.ts:33:       deviceId = await ctx.db.insert("devices", {
convex/seedCardReaderTest.ts:34:         name: "Hikvision Kart Okuyucu (192.168.1.212)",
convex/seedCardReaderTest.ts:39:         isActive: true,
convex/seedCardReaderTest.ts:40:         status: "active",
convex/seedCardReaderTest.ts:40:         status: "active",
convex/seedCardReaderTest.ts:41:         createdAt: now,
convex/seedCardReaderTest.ts:52:       employeeId = await ctx.db.insert("employees", {
convex/seedCardReaderTest.ts:53:         projectId,
convex/seedCardReaderTest.ts:59:         isActive: true,
convex/seedCardReaderTest.ts:60:         createdAt: now,
convex/seedCardReaderTest.ts:71:       ruleId = await ctx.db.insert("accessRules", {
convex/seedCardReaderTest.ts:72:         name: "Kart Okuyucu Test Grubu",
convex/seedCardReaderTest.ts:74:         isActive: true,
convex/seedCardReaderTest.ts:75:         createdAt: now,
convex/seedCardReaderTest.ts:86:       await ctx.db.insert("groupMembers", {
convex/seedCardReaderTest.ts:87:         groupId: ruleId,
convex/seedCardReaderTest.ts:100:       await ctx.db.insert("groupDevices", {
convex/seedCardReaderTest.ts:101:         groupId: ruleId,
convex/seedCardReaderTest.ts:122:         await ctx.db.insert("cardReadings", {
convex/seedCardReaderTest.ts:123:           projectId,
```

</details>

<details><summary>convex/seedHikvisionLanDevice.ts (8 yazma/durum eşleşmesi)</summary>

```text
convex/seedHikvisionLanDevice.ts:34:       projectId = await ctx.db.insert("projects", {
convex/seedHikvisionLanDevice.ts:35:         name: "Varsayılan Proje",
convex/seedHikvisionLanDevice.ts:36:         isActive: true,
convex/seedHikvisionLanDevice.ts:37:         createdAt: now,
convex/seedHikvisionLanDevice.ts:48:       await ctx.db.patch(existing._id, {
convex/seedHikvisionLanDevice.ts:49:         name,
convex/seedHikvisionLanDevice.ts:57:         isActive: true,
convex/seedHikvisionLanDevice.ts:58:         status: "active",
convex/seedHikvisionLanDevice.ts:58:         status: "active",
convex/seedHikvisionLanDevice.ts:59:         updatedAt: now,
convex/seedHikvisionLanDevice.ts:68:     const deviceId = await ctx.db.insert("devices", {
convex/seedHikvisionLanDevice.ts:69:       name,
convex/seedHikvisionLanDevice.ts:77:       isActive: true,
convex/seedHikvisionLanDevice.ts:78:       status: "active",
convex/seedHikvisionLanDevice.ts:78:       status: "active",
convex/seedHikvisionLanDevice.ts:79:       createdAt: now,
```

</details>

<details><summary>convex/seedTestCardAccess.ts (11 yazma/durum eşleşmesi)</summary>

```text
convex/seedTestCardAccess.ts:30:       const deviceId = await ctx.db.insert("devices", {
convex/seedTestCardAccess.ts:31:         name: args.deviceName ?? `ESP32 Reader (${args.deviceSerial.slice(-6)})`,
convex/seedTestCardAccess.ts:36:         isActive: true,
convex/seedTestCardAccess.ts:37:         status: "active",
convex/seedTestCardAccess.ts:37:         status: "active",
convex/seedTestCardAccess.ts:38:         createdAt: now,
convex/seedTestCardAccess.ts:51:       const empId = await ctx.db.insert("employees", {
convex/seedTestCardAccess.ts:52:         projectId,
convex/seedTestCardAccess.ts:58:         isActive: true,
convex/seedTestCardAccess.ts:59:         createdAt: now,
convex/seedTestCardAccess.ts:65:       await ctx.db.patch(employee._id, { isActive: true, updatedAt: now });
convex/seedTestCardAccess.ts:66:     }
convex/seedTestCardAccess.ts:76:       const ruleId = await ctx.db.insert("accessRules", {
convex/seedTestCardAccess.ts:77:         name: ruleNameFinal,
convex/seedTestCardAccess.ts:85:         isActive: true,
convex/seedTestCardAccess.ts:86:         createdAt: now,
convex/seedTestCardAccess.ts:92:       await ctx.db.patch(rule._id, { isActive: true, updatedAt: now });
convex/seedTestCardAccess.ts:93:     }
convex/seedTestCardAccess.ts:105:       await ctx.db.insert("groupMembers", {
convex/seedTestCardAccess.ts:106:         groupId: rule._id,
convex/seedTestCardAccess.ts:120:       await ctx.db.insert("groupDevices", {
convex/seedTestCardAccess.ts:121:         groupId: rule._id,
```

</details>

<details><summary>convex/virtualReaders.ts (15 yazma/durum eşleşmesi)</summary>

```text
convex/virtualReaders.ts:26:       brand: "other", deviceType: VIRTUAL_READER_TYPE, status: "active",
convex/virtualReaders.ts:27:     });
convex/virtualReaders.ts:30:     await ctx.db.patch(deviceId, { apiToken: readerToken, apiTokenCreatedAt: now, updatedAt: now });
convex/virtualReaders.ts:31:     return { deviceId, readerToken };
convex/virtualReaders.ts:47:     isActive: v.boolean(),
convex/virtualReaders.ts:48:     projectName: v.union(v.string(), v.null()),
convex/virtualReaders.ts:54:     const lastSeen = device.lastSeen ? Date.parse(device.lastSeen) : NaN;
convex/virtualReaders.ts:55:     if (!Number.isFinite(lastSeen) || now - lastSeen >= LAST_SEEN_THROTTLE_MS) {
convex/virtualReaders.ts:56:       await ctx.db.patch(device._id, { lastSeen: new Date(now).toISOString() });
convex/virtualReaders.ts:57:     }
convex/virtualReaders.ts:61:       isActive: device.isActive !== false,
convex/virtualReaders.ts:62:       projectName: project?.name ?? null,
convex/virtualReaders.ts:72:       status: v.literal("granted"),
convex/virtualReaders.ts:73:       employeeName: v.string(),
convex/virtualReaders.ts:78:       status: v.literal("denied"),
convex/virtualReaders.ts:79:       reason: v.union(
convex/virtualReaders.ts:84:     v.object({ status: v.literal("reader_invalid") }),
convex/virtualReaders.ts:85:   ),
convex/virtualReaders.ts:88:     if (!device) return { status: "reader_invalid" as const };
convex/virtualReaders.ts:89:     if (device.isActive === false) return { status: "denied" as const, reason: "READER_INACTIVE" as const };
convex/virtualReaders.ts:89:     if (device.isActive === false) return { status: "denied" as const, reason: "READER_INACTIVE" as const };
convex/virtualReaders.ts:90:     const value = code.trim();
convex/virtualReaders.ts:91:     if (!READER_TOKEN_PATTERN.test(value)) return { status: "denied" as const, reason: "TOKEN_INVALID" as const };
convex/virtualReaders.ts:92:     const outcome = await consumeReaderTokenDetailed(ctx, value, device);
convex/virtualReaders.ts:93:     if (!outcome.granted) return { status: "denied" as const, reason: outcome.reason };
convex/virtualReaders.ts:94:     await ctx.db.patch(device._id, { lastSeen: outcome.accessTime });
convex/virtualReaders.ts:94:     await ctx.db.patch(device._id, { lastSeen: outcome.accessTime });
convex/virtualReaders.ts:95:     return {
convex/virtualReaders.ts:96:       status: "granted" as const,
convex/virtualReaders.ts:97:       employeeName: outcome.employeeName,
```

</details>

<details><summary>convex/visitors.ts (34 yazma/durum eşleşmesi)</summary>

```text
convex/visitors.ts:40:   const alreadyEnded = visitor.isActive === false && (visitor.visitorStatus === "checkedOut" || visitor.visitorStatus === "expired");
convex/visitors.ts:41:   const cardKey = alreadyEnded ? cardNumericKey(visitor.cardNumber) : null;
convex/visitors.ts:54:         (op.status === "pending" || op.status === "sent" || (op.status === "acked" && !op.responseMessage?.startsWith("superseded"))));
convex/visitors.ts:55:     }
convex/visitors.ts:89:   const consentId = await ctx.db.insert("employeeConsents", {
convex/visitors.ts:90:     employeeId,
convex/visitors.ts:127: // isActive=false yapar → mevcut desync yolu cihazdan söker.
convex/visitors.ts:128: 
convex/visitors.ts:150:         endTime: r.endTime ?? null, days: r.days ?? [], isActive: r.isActive !== false,
convex/visitors.ts:151:         projectId: r.projectId, hasDoors,
convex/visitors.ts:196:     status: visitorStatus(visitor, now),
convex/visitors.ts:197:     lastSeenAt: presence?.lastReadingAt ?? null,
convex/visitors.ts:208:     status: v.optional(v.union(v.literal("active"), v.literal("checkedOut"), v.literal("expired"), v.literal("preRegistered"))),
convex/visitors.ts:209:     search: v.optional(v.string()),
convex/visitors.ts:226:     const indexed = args.status === "expired"
convex/visitors.ts:227:       ? mergedStream([
convex/visitors.ts:232:       : args.status === "active"
convex/visitors.ts:233:         ? mergedStream([
convex/visitors.ts:270:       const status = visitorStatus(visitor, now);
convex/visitors.ts:271:       const expiry = visitorTime(visitor.accessExpiresAt);
convex/visitors.ts:272:       if ((status === "active" || status === "preRegistered") && expiry > now && (nextExpiry === null || expiry < nextExpiry)) nextExpiry = expiry;
convex/visitors.ts:273:     };
convex/visitors.ts:321:       isActive: visitor.isActive ?? false,
convex/visitors.ts:322:       hostEmployeeId: visitor.hostEmployeeId ?? null,
convex/visitors.ts:366:     isActive: v.optional(v.boolean()),
convex/visitors.ts:367:     notes: v.optional(v.string()),
convex/visitors.ts:391:         dupCard.isActive === false &&
convex/visitors.ts:392:         dupCard.cardNumber === cardNumber &&
convex/visitors.ts:398:         await ctx.db.patch(dupCard._id, {
convex/visitors.ts:399:           cardNumber: `IADE:${cardNumber}:${dupCard._id}`,
convex/visitors.ts:417:     const isActive = args.isActive ?? true;
convex/visitors.ts:418:     const now = new Date().toISOString();
convex/visitors.ts:419:     const id = await ctx.db.insert("employees", {
convex/visitors.ts:420:       projectId: args.projectId,
convex/visitors.ts:477:     isActive: v.optional(v.boolean()),
convex/visitors.ts:478:     notes: v.optional(v.union(v.null(), v.string())),
convex/visitors.ts:492:     if (assigningPreset && !(visitor.mobileVisitorRequestId && visitor.isActive === false &&
convex/visitors.ts:493:         visitor.visitorStatus === "preRegistered" && visitor.cardNumber.startsWith("PRE:") && !visitor.accessRuleId)) {
convex/visitors.ts:519:     if (cardChanged || args.isActive === true || assigningPreset) {
convex/visitors.ts:520:       const card = newCard ?? visitor.cardNumber;
convex/visitors.ts:524:     if (cardChanged || args.isActive === true || assigningPreset) {
convex/visitors.ts:525:       await validateVisitorPresetCard(ctx, visitor.projectId, assignedRuleId ?? visitor.accessRuleId,
convex/visitors.ts:530:     const deactivating = activeChanged && args.isActive === false;
convex/visitors.ts:531:     const needsDeviceSync = cardChanged || activeChanged || (expiryChanged && effective.isActive !== false);
convex/visitors.ts:535:     // syncEmployeeToIdePanels YETMEZ — pasif kişiyi status=0 ile upsert eder, kart kaydı
convex/visitors.ts:536:     // panelde kalır. reconcileRemovedEmployeeIde de işe yaramaz: ziyaretçi kuralına bağlı
convex/visitors.ts:538:     // syncEmployeeToIdePanels'ı kartı status=0 ile geri yazardı.
convex/visitors.ts:539:     let ideRemovalPanels: Id<"devices">[] = [];
convex/visitors.ts:561:       patch.isActive = args.isActive;
convex/visitors.ts:562:       patch.visitorStatus = args.isActive ? "checkedIn" : "checkedOut";
convex/visitors.ts:564:     await ctx.db.patch(args.visitorId, patch);
convex/visitors.ts:565:     if (assigningPreset) {
convex/visitors.ts:588:     // aktivasyon). Deaktivasyonda push YAPMA: yukarıdaki fiziksel sökmeyi status=0 upsert ile
convex/visitors.ts:589:     // geri alırdı.
convex/visitors.ts:605: /** Manuel çıkış: erişimi geri al (isActive=false → cihazdan söker), durumu checkedOut yap. */
convex/visitors.ts:606: export const checkOut = authedMutation({
convex/visitors.ts:612:     if (visitor.isActive === false) return args.visitorId;
convex/visitors.ts:613:     await scheduleVisitorCardRemoval(ctx, visitor);
convex/visitors.ts:614:     await ctx.db.patch(args.visitorId, {
convex/visitors.ts:615:       isActive: false,
convex/visitors.ts:615:       isActive: false,
convex/visitors.ts:616:       visitorStatus: "checkedOut",
convex/visitors.ts:636:     await ctx.db.patch(args.visitorId, {
convex/visitors.ts:637:       cardNumber: `IADE:${visitor.cardNumber}:${args.visitorId}`,
convex/visitors.ts:662:       await ctx.db.patch(vz._id, {
convex/visitors.ts:663:         isActive: false,
convex/visitors.ts:663:         isActive: false,
convex/visitors.ts:664:         visitorStatus: "expired",
```

</details>

<details><summary>convex/zones.ts (2 yazma/durum eşleşmesi)</summary>

```text
convex/zones.ts:54:     return await ctx.db.insert("zones", { ...args, createdAt: now, updatedAt: now });
convex/zones.ts:55:   },
convex/zones.ts:79:     await ctx.db.delete(args.zoneId);
convex/zones.ts:80:   },
```

</details>

<details><summary>infra/hik-event-bridge/bridge.mjs (10 yazma/durum eşleşmesi)</summary>

```text
infra/hik-event-bridge/bridge.mjs:168:         if (res.ok || (res.status < 500 && res.status !== 429)) return { status: res.status };
infra/hik-event-bridge/bridge.mjs:169:         log({ event: 'post_retry', attempt, status: res.status });
infra/hik-event-bridge/bridge.mjs:169:         log({ event: 'post_retry', attempt, status: res.status });
infra/hik-event-bridge/bridge.mjs:170:         const retryAfter = res.headers.get('retry-after');
infra/hik-event-bridge/bridge.mjs:180:     return { status: 0 };
infra/hik-event-bridge/bridge.mjs:181:   }
infra/hik-event-bridge/bridge.mjs:187:       const result = token ? await post(job.path, job.body, token) : { status: 0 };
infra/hik-event-bridge/bridge.mjs:188:       if (result.status >= 200 && result.status < 300) {
infra/hik-event-bridge/bridge.mjs:191:         log({ event: 'forward', ...job.summary, status: result.status });
infra/hik-event-bridge/bridge.mjs:192:       } else {
infra/hik-event-bridge/bridge.mjs:193:         log({ event: 'post_pending', ...job.summary, status: result.status });
infra/hik-event-bridge/bridge.mjs:194:         if (!stopped) {
infra/hik-event-bridge/bridge.mjs:236:       devIndex: alert.devIndex, status: alert.status, at, ...(source ? { source } : {}),
infra/hik-event-bridge/bridge.mjs:237:     }, resolveToken(tokens, alert), {
infra/hik-event-bridge/bridge.mjs:273:         log({ event: 'device_status', type: alert.eventType, devIndex: alert.devIndex, status: alert.status });
infra/hik-event-bridge/bridge.mjs:274:       }
infra/hik-event-bridge/bridge.mjs:298:         const alert = { devIndex: device.devIndex, deviceID: device.EhomeParams?.EhomeID, status: device.devStatus, at };
infra/hik-event-bridge/bridge.mjs:299:         if (!resolveToken(tokens, alert)) continue;
infra/hik-event-bridge/bridge.mjs:350:         throw new Error(`subscribe_failed status=${res.status}`);
infra/hik-event-bridge/bridge.mjs:351:       }
```

</details>

<details><summary>mobile/lib/screens/home/home_screen.dart (3 yazma/durum eşleşmesi)</summary>

```text
mobile/lib/screens/home/home_screen.dart:71:     _isAppActive = state == AppLifecycleState.resumed;
mobile/lib/screens/home/home_screen.dart:72:     if (_isAppActive) _updateClock();
mobile/lib/screens/home/home_screen.dart:158:       status: attendance.attendanceStatus,
mobile/lib/screens/home/home_screen.dart:159:       isLoading: attendance.isSummaryLoading,
mobile/lib/screens/home/home_screen.dart:217:         commands.operation?.status == DoorOperationStatus.unknown ||
mobile/lib/screens/home/home_screen.dart:218:         (commands.hasUnresolvedOperation &&
```

</details>

<details><summary>src/components/access-control/AddDoorDialog.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/AddDoorDialog.tsx:25:     await create({ name: name.trim(), projectId, zoneId, doorCode: doorCode.trim() || undefined, status: "active" });
src/components/access-control/AddDoorDialog.tsx:26:     notify.success("Kapı eklendi");
```

</details>

<details><summary>src/components/access-control/CardReadingsTable.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/CardReadingsTable.tsx:18:     <Table resizeKey="access-readings" density="compact"><TableHeader><TableRow>{[["time", "Zaman (TR)"], ["person", "Kişi / kart"], ["door-device", "Kapı / cihaz"], ["direction", "Yön"], ["result", "Sonuç"], ["source", "Kaynak"], ["actions", "İşlem"]].map(([id, label]) => <TableHead key={id} columnId={id} resizable={id !== "actions"}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{message ? <TableStateRow colSpan={7} state="custom">{message}</TableStateRow> : loading ? <TableStateRow colSpan={7} state="loading" label="Erişim okumaları yükleniyor" /> : !readings.length ? <TableStateRow colSpan={7} state="empty" title="Okuma bulunamadı" description={emptyMessage} action={emptyAction} /> : readings.map(r => <TableRow key={r._id} className={`${ROW_CLICK_CLASS} ${freshIds?.has(r._id) ? "bg-info-bg" : ""}`} onClick={openRow(r)}>
src/components/access-control/CardReadingsTable.tsx:19:       <TableCell className="whitespace-nowrap tabular-nums text-xs">{freshIds?.has(r._id) && <span className="mr-1">Yeni</span>}{trTime(r.accessTime)}</TableCell>
```

</details>

<details><summary>src/components/access-control/door-plans/CopyDoorPlansDialog.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:77:   const status = useAction(api.actions.hikGatewayDevice.applyDoorStatusPlan);
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:78:   const verify = useAction(api.actions.hikGatewayDevice.applyVerifyPlan);
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:129:           status: (doorId) => status({ doorId }),
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:130:           verify: (doorId) => verify({ doorId }),
```

</details>

<details><summary>src/components/access-control/door-plans/DoorPlanDialog.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/door-plans/DoorPlanDialog.tsx:158:         status: () => applyDoorStatusPlan({ doorId: door.doorId }),
src/components/access-control/door-plans/DoorPlanDialog.tsx:159:         verify: () => applyVerifyPlan({ doorId: door.doorId }),
```

</details>

<details><summary>src/components/access-control/door-plans/DoorPlansTab.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/door-plans/DoorPlansTab.tsx:181:           {targets === undefined ? <TableStateRow colSpan={4} state="loading" label="Kapı planları yükleniyor…" /> : filtered.length === 0 ? <TableStateRow colSpan={4} state="empty" title={term ? "Aramaya uygun kapı bulunamadı" : "Plan kurulabilecek Hikvision kapısı yok"} description={term ? "Kapı, cihaz veya bölge adını değiştirin." : scopeDescription} action={term ? undefined : devicesAction} /> : null}
src/components/access-control/door-plans/DoorPlansTab.tsx:182:           {visible.map((door) => (
```

</details>

<details><summary>src/components/access-control/door-plans/bulk.ts (2 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/door-plans/bulk.ts:12:   status: "Durum planı",
src/components/access-control/door-plans/bulk.ts:13:   verify: "Doğrulama planı",
src/components/access-control/door-plans/bulk.ts:86:         status: () => apply.status(doorId),
src/components/access-control/door-plans/bulk.ts:87:         verify: () => apply.verify(doorId),
```

</details>

<details><summary>src/components/access-control/unified/AccessRuleDetails.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/unified/AccessRuleDetails.tsx:28:       {status === "LoadingFirstPage" ? (
src/components/access-control/unified/AccessRuleDetails.tsx:29:         <SectionSkeleton rows={2} />
src/components/access-control/unified/AccessRuleDetails.tsx:56:               {status === "LoadingMore" ? "Yükleniyor…" : "Daha fazla yükle"}
src/components/access-control/unified/AccessRuleDetails.tsx:57:             </Button>
```

</details>

<details><summary>src/components/access-control/unified/SyncRuns.tsx (3 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/unified/SyncRuns.tsx:197:         target.status === "failed" ||
src/components/access-control/unified/SyncRuns.tsx:198:         target.status === "skipped" ||
src/components/access-control/unified/SyncRuns.tsx:198:         target.status === "skipped" ||
src/components/access-control/unified/SyncRuns.tsx:199:         target.status === "unknown",
src/components/access-control/unified/SyncRuns.tsx:199:         target.status === "unknown",
src/components/access-control/unified/SyncRuns.tsx:200:     ) ?? [];
```

</details>

<details><summary>src/components/access-control/unified/UnifiedAccessControl.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/unified/UnifiedAccessControl.tsx:24:     status: "Kişi yetkilerinin cihazlara ulaşıp ulaşmadığı",
src/components/access-control/unified/UnifiedAccessControl.tsx:25:     doors: "Kapıların herkes için sürekli açık ya da kilitli kalacağı saatler",
```

</details>

<details><summary>src/components/access-control/unified/components/ZoneDeviceTree.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/unified/components/ZoneDeviceTree.tsx:66:   const state = (doorIds: string[], deviceIds: string[]) =>
src/components/access-control/unified/components/ZoneDeviceTree.tsx:67:     scopeSelectionState(
```

</details>

<details><summary>src/components/access-control/unified/status/StatusPage.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/unified/status/StatusPage.tsx:114:       <EmptyStatus unknownCount={filters.state === "unknown" ? 0 : (projectCounts?.unknown ?? 0)} />
src/components/access-control/unified/status/StatusPage.tsx:115:       {busy && (rows.length > 0 || view === "device") && <p role="status">Yükleniyor…</p>}
```

</details>

<details><summary>src/components/access-control/unified/status/model.ts (4 yazma/durum eşleşmesi)</summary>

```text
src/components/access-control/unified/status/model.ts:71:       row.state === "failed"
src/components/access-control/unified/status/model.ts:72:         ? ("danger" as const)
src/components/access-control/unified/status/model.ts:73:         : row.state === "pending"
src/components/access-control/unified/status/model.ts:74:           ? ("warning" as const)
src/components/access-control/unified/status/model.ts:75:           : row.state === "effective"
src/components/access-control/unified/status/model.ts:76:             ? ("success" as const)
src/components/access-control/unified/status/model.ts:78:     hint: row.state === "failed" ? shortFailureReason(row.lastError) : undefined,
src/components/access-control/unified/status/model.ts:79:   };
```

</details>

<details><summary>src/components/admin/AdminDevicesPanel.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/components/admin/AdminDevicesPanel.tsx:103:   const status = (device: AdminDevice) => {
src/components/admin/AdminDevicesPanel.tsx:104:     const connection = deviceConnection(device, now);
src/components/admin/AdminDevicesPanel.tsx:246:                 {!result ? <TableStateRow colSpan={6} state="loading" label="Cihaz havuzu yükleniyor" /> : result.page.length === 0 ? <TableStateRow colSpan={6} state="custom">{listState}</TableStateRow> : null}
src/components/admin/AdminDevicesPanel.tsx:247:                 {result?.page.map((device) => (
```

</details>

<details><summary>src/components/alarms/AlarmFilters.tsx (4 yazma/durum eşleşmesi)</summary>

```text
src/components/alarms/AlarmFilters.tsx:12:   status: "open" | "acked" | "all";
src/components/alarms/AlarmFilters.tsx:13:   severity: "" | "warning" | "critical";
src/components/alarms/AlarmFilters.tsx:19: export const DEFAULT_ALARM_FILTERS: AlarmFiltersValue = { status: "open", severity: "", deviceId: "", fromDay: "", toDay: "" };
src/components/alarms/AlarmFilters.tsx:20: 
src/components/alarms/AlarmFilters.tsx:24:     <FilterField label="Durum" htmlFor="alarm-status"><Select value={value.status} onValueChange={status => { if (status === "open" || status === "acked" || status === "all") onChange({ ...value, status }); }}><SelectTrigger id="alarm-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Açık</SelectItem><SelectItem value="acked">Onaylı</SelectItem><SelectItem value="all">Tüm durumlar</SelectItem></SelectContent></Select></FilterField>
src/components/alarms/AlarmFilters.tsx:25:     <FilterField label="Önem" htmlFor="alarm-severity"><Select value={value.severity || "all"} onValueChange={severity => { if (severity === "all" || severity === "critical" || severity === "warning") onChange({ ...value, severity: severity === "all" ? "" : severity }); }}><SelectTrigger id="alarm-severity"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm önemler</SelectItem><SelectItem value="critical">Kritik</SelectItem><SelectItem value="warning">Uyarı</SelectItem></SelectContent></Select></FilterField>
src/components/alarms/AlarmFilters.tsx:38:   return { projectId, category, status: value.status, severity: value.severity || undefined, deviceId: value.deviceId || undefined, from: isoDay(value.fromDay), to: isoDay(value.toDay, true) };
src/components/alarms/AlarmFilters.tsx:39: }
```

</details>

<details><summary>src/components/audit/auditLabels.ts (6 yazma/durum eşleşmesi)</summary>

```text
src/components/audit/auditLabels.ts:40:   ackedAt: "Onaylanma zamanı",
src/components/audit/auditLabels.ts:41:   emailEnabled: "E-posta bildirimi",
src/components/audit/auditLabels.ts:77:   status: "Durum",
src/components/audit/auditLabels.ts:78:   note: "Not",
src/components/audit/auditLabels.ts:113:   accessTransfers: { employeeId: "Kaynak kişi", targetEmployeeId: "Hedef kişi", sourceProjectId: "Kaynak proje", targetProjectId: "Hedef proje", targetDeviceCount: "Silme beklenen cihaz sayısı", deviceId: "Cihaz", state: "Hedef durumu", status: "Taşıma durumu" },
src/components/audit/auditLabels.ts:114:   accessTransferTargets: { transferId: "Taşıma", deviceId: "Cihaz", state: "Silme durumu", lastError: "Son hata" },
src/components/audit/auditLabels.ts:114:   accessTransferTargets: { transferId: "Taşıma", deviceId: "Cihaz", state: "Silme durumu", lastError: "Son hata" },
src/components/audit/auditLabels.ts:115:   hikPendingOperations: { dismissedAt: "Uyarının kapatılma zamanı" },
src/components/audit/auditLabels.ts:120:   mailSettings: { smtpHost: "SMTP sunucusu", smtpPort: "SMTP portu", smtpUsername: "SMTP kullanıcı adı", fromEmail: "Gönderen e-posta", isActive: "Raporlar bu hesaptan", passwordChanged: "Şifre değişti" },
src/components/audit/auditLabels.ts:121:   employees: {
src/components/audit/auditLabels.ts:125:     isActive: "Aktif",
src/components/audit/auditLabels.ts:126:   },
```

</details>

<details><summary>src/components/dashboard/DeviceHealth.tsx (4 yazma/durum eşleşmesi)</summary>

```text
src/components/dashboard/DeviceHealth.tsx:44:             const status = device.connectionStatus ?? "never";
src/components/dashboard/DeviceHealth.tsx:45:             const detail = status === "online" ? "Çevrimiçi" : status === "never" ? "Hiç bağlanmadı" : (timeAgoTr(device.lastSeen, now) ?? "Çevrimdışı");
src/components/dashboard/DeviceHealth.tsx:45:             const detail = status === "online" ? "Çevrimiçi" : status === "never" ? "Hiç bağlanmadı" : (timeAgoTr(device.lastSeen, now) ?? "Çevrimdışı");
src/components/dashboard/DeviceHealth.tsx:46:             return (
src/components/dashboard/DeviceHealth.tsx:51:                     className={cn("h-2 w-2 shrink-0 rounded-full", status === "online" ? "status-success-bg" : status === "offline" ? "status-danger-bg" : "bg-muted-foreground/40")}
src/components/dashboard/DeviceHealth.tsx:52:                   />
src/components/dashboard/DeviceHealth.tsx:54:                   <span className={cn("shrink-0 text-xs", status === "offline" ? "text-danger" : "text-muted-foreground")}>{detail}</span>
src/components/dashboard/DeviceHealth.tsx:55:                 </Link>
```

</details>

<details><summary>src/components/dashboard/SetupChecklist.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/dashboard/SetupChecklist.tsx:34:   const status = useQuery(api.projects.getSetupStatus, !loading && canManage && projectId && !hidden && !completed ? { projectId } : "skip");
src/components/dashboard/SetupChecklist.tsx:35:   useEffect(() => {
```

</details>

<details><summary>src/components/devices/DeviceDetailsPanel.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/DeviceDetailsPanel.tsx:184:                 className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1 data-[state=inactive]:hidden"
src/components/devices/DeviceDetailsPanel.tsx:185:               >
src/components/devices/DeviceDetailsPanel.tsx:206:                   className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
src/components/devices/DeviceDetailsPanel.tsx:207:                 >
```

</details>

<details><summary>src/components/devices/DeviceList.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/DeviceList.tsx:153:             <TableStateRow colSpan={colCount} state="loading" label="Cihazlar yükleniyor" />
src/components/devices/DeviceList.tsx:154:           ) : filteredDevices.length > 0 ? (
src/components/devices/DeviceList.tsx:178:               state="empty"
src/components/devices/DeviceList.tsx:179:               icon={Smartphone}
```

</details>

<details><summary>src/components/devices/DeviceTableRow.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/DeviceTableRow.tsx:87:       data-state={selected ? "selected" : undefined}
src/components/devices/DeviceTableRow.tsx:88:       className={ROW_CLICK_CLASS}
```

</details>

<details><summary>src/components/devices/DevicesContent.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/DevicesContent.tsx:69:       status: "all",
src/components/devices/DevicesContent.tsx:70:       type: "all",
```

</details>

<details><summary>src/components/devices/hooks/buildDeviceFormValues.ts (3 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/hooks/buildDeviceFormValues.ts:62:       status: "active",
src/components/devices/hooks/buildDeviceFormValues.ts:63:       ehome_id: "",
src/components/devices/hooks/buildDeviceFormValues.ts:91:     status: (device.status === "active" || device.status === "inactive"
src/components/devices/hooks/buildDeviceFormValues.ts:92:       ? device.status
src/components/devices/hooks/buildDeviceFormValues.ts:93:       : device.isActive === false
src/components/devices/hooks/buildDeviceFormValues.ts:94:         ? "inactive"
```

</details>

<details><summary>src/components/devices/hooks/deviceUpdatePatch.ts (1 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/hooks/deviceUpdatePatch.ts:9:   status: "status", deviceSerial: "device_serial", deviceIp: "device_ip",
src/components/devices/hooks/deviceUpdatePatch.ts:10:   deviceUsername: "device_username", devicePassword: "device_password", brand: "brand",
```

</details>

<details><summary>src/components/devices/hooks/useDeviceFormSubmission.ts (4 yazma/durum eşleşmesi)</summary>

```text
src/components/devices/hooks/useDeviceFormSubmission.ts:75:           status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:76:           name: panelName,
src/components/devices/hooks/useDeviceFormSubmission.ts:134:           status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:135:           description: values.description || undefined,
src/components/devices/hooks/useDeviceFormSubmission.ts:215:                 status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:216:                 ...connectionFields,
src/components/devices/hooks/useDeviceFormSubmission.ts:257:                 status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:258:                 brand: values.brand,
```

</details>

<details><summary>src/components/employees/EmployeeFingerprintCard.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/components/employees/EmployeeFingerprintCard.tsx:34:   const [attempt, setAttempt] = useState<{ deviceId: Id<"devices">; fingerNo: number; attemptId: string } | null>(null);
src/components/employees/EmployeeFingerprintCard.tsx:35:   const [status, setStatus] = useState("");
src/components/employees/EmployeeFingerprintCard.tsx:47:       const attemptId = await begin(target);
src/components/employees/EmployeeFingerprintCard.tsx:48:       setStatus("Cihazda parmağınızı okutun; yaklaşık 30 saniye beklenir.");
```

</details>

<details><summary>src/components/employees/EmployeeSyncConfirmDialog.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/employees/EmployeeSyncConfirmDialog.tsx:24:   const inactiveCount = employees.filter(employee => employee.isActive === false).length;
src/components/employees/EmployeeSyncConfirmDialog.tsx:25:   const activeCount = employees.length - inactiveCount;
```

</details>

<details><summary>src/components/employees/import/BatchCardAssignDialog.tsx (5 yazma/durum eşleşmesi)</summary>

```text
src/components/employees/import/BatchCardAssignDialog.tsx:15: type AssignResult = { employeeId: string; status: "assigned" | "error"; message: string };
src/components/employees/import/BatchCardAssignDialog.tsx:16: type Props = { open: boolean; onOpenChange: (open: boolean) => void; projectId: Id<"projects">; employees: Employee[] };
src/components/employees/import/BatchCardAssignDialog.tsx:86:     setRows((current) => current.map((row) => row.employeeId === employeeId ? { ...row, cardNumber, status: undefined, message: undefined } : row));
src/components/employees/import/BatchCardAssignDialog.tsx:87:   };
src/components/employees/import/BatchCardAssignDialog.tsx:125:           <div><Input aria-invalid={row.status === "error"} aria-describedby={row.message ? `batch-card-${row.employeeId}-message` : undefined} aria-label={`${row.employeeName} kart numarası`} value={row.cardNumber} disabled={busy || row.status === "assigned"} onChange={(event) => updateCard(row.employeeId, event.target.value)} onPaste={(event) => { const pasted = event.clipboardData.getData("text"); if (pasted.includes("\n")) { event.preventDefault(); pasteCards(pasted); } }} />{row.message && <p id={`batch-card-${row.employeeId}-message`} className={row.status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{row.message}</p>}</div>
src/components/employees/import/BatchCardAssignDialog.tsx:126:         </div>)}
src/components/employees/import/BatchCardAssignDialog.tsx:128:         {saved && <p role="status">Atanan: {rows.filter((row) => row.status === "assigned").length} · Hatalı: {rows.filter((row) => row.status === "error").length}</p>}
src/components/employees/import/BatchCardAssignDialog.tsx:129:         <div className="flex flex-wrap justify-end gap-2">
src/components/employees/import/BatchCardAssignDialog.tsx:131:           <Button disabled={busy || rows.every((row) => !row.cardNumber.trim() || row.status === "assigned")} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Kaydet"}</Button>
src/components/employees/import/BatchCardAssignDialog.tsx:132:         </div>
```

</details>

<details><summary>src/components/employees/import/DevicePersonImportDialog.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/employees/import/DevicePersonImportDialog.tsx:283:                         {row.status === "matched" && isSelectablePerson(row) && (
src/components/employees/import/DevicePersonImportDialog.tsx:284:                           <p className="mt-1 text-xs text-muted-foreground">Parmak izi ngsplus'a aktarılacak</p>
```

</details>

<details><summary>src/components/employees/import/EmployeeImportDialog.tsx (4 yazma/durum eşleşmesi)</summary>

```text
src/components/employees/import/EmployeeImportDialog.tsx:83:   const validCount = results.filter((result) => result.status === "created").length;
src/components/employees/import/EmployeeImportDialog.tsx:84:   const duplicateCount = results.filter((result) => result.status === "skippedDuplicate").length;
src/components/employees/import/EmployeeImportDialog.tsx:84:   const duplicateCount = results.filter((result) => result.status === "skippedDuplicate").length;
src/components/employees/import/EmployeeImportDialog.tsx:85:   const errorResults = results.filter((result) => result.status === "error");
src/components/employees/import/EmployeeImportDialog.tsx:85:   const errorResults = results.filter((result) => result.status === "error");
src/components/employees/import/EmployeeImportDialog.tsx:86: 
src/components/employees/import/EmployeeImportDialog.tsx:101:         <p>{results.filter((result) => result.status === "created" && result.message === "Kişi oluşturuldu").length} kişi oluşturuldu · {duplicateCount} yinelenen · {errorResults.length} hatalı{wasCancelled ? " · İptal edildi" : ""}</p>
src/components/employees/import/EmployeeImportDialog.tsx:102:         {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
```

</details>

<details><summary>src/components/live-monitoring/MonitoringPersonPicker.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/live-monitoring/MonitoringPersonPicker.tsx:28:     {term === search && people?.map(person => <CommandItem key={person._id} disabled={!allowClear && person.isActive === false} value={person._id} onSelect={() => { onChange(person); setOpen(false); }}>{person.firstName} {person.lastName}{person.isActive === false ? " · Pasif" : ""}{value === person._id && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>)}
src/components/live-monitoring/MonitoringPersonPicker.tsx:29:   </CommandList></Command><p className="px-3 py-2 text-xs text-muted-foreground">En fazla 40 kişi gösterilir. Sonucu daraltmak için ad veya soyad yazın.</p></PopoverContent></Popover>;
```

</details>

<details><summary>src/components/live-monitoring/lib/assignment.ts (1 yazma/durum eşleşmesi)</summary>

```text
src/components/live-monitoring/lib/assignment.ts:8:   if (selected.isActive === false) return "Pasif kişiye kart atanamaz";
src/components/live-monitoring/lib/assignment.ts:9:   if (selected.cardNumber !== values.expectedCurrentCard) return "Kişinin kartı değişti. Güncel kartı kontrol edip yeniden onaylayın";
```

</details>

<details><summary>src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:43:   state: { error: string | null } = { error: null };
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:44:   static getDerivedStateFromError(error: unknown) {
```

</details>

<details><summary>src/components/pdks/lib/presentation.ts (14 yazma/durum eşleşmesi)</summary>

```text
src/components/pdks/lib/presentation.ts:40: export function segmentDecisionLabel(segment: PdksSegment, status: PdksPlanDay["status"]): string {
src/components/pdks/lib/presentation.ts:41:   if (segment.decision === "absent") {
src/components/pdks/lib/presentation.ts:42:     if (status === "future") return "Bekleniyor";
src/components/pdks/lib/presentation.ts:43:     if (status === "leave" || status === "holiday" || status === "weekend") return "—";
src/components/pdks/lib/presentation.ts:43:     if (status === "leave" || status === "holiday" || status === "weekend") return "—";
src/components/pdks/lib/presentation.ts:44:   }
src/components/pdks/lib/presentation.ts:61: export function displayDuration(minutes: number, status: PdksCell["status"], durationMeasured?: boolean): string {
src/components/pdks/lib/presentation.ts:62:   if (durationMeasured === false) return "Süre hesaplanamadı";
src/components/pdks/lib/presentation.ts:63:   return minutes === 0 && status !== "present" && status !== "late" || status === "future" || status === "noData" || status === "notEmployed" ? "—" : formatDuration(minutes);
src/components/pdks/lib/presentation.ts:64: }
src/components/pdks/lib/presentation.ts:90: export function reviewHint(item: { noShift?: boolean; status: string; punchQuality?: string; durationMeasured?: boolean } | undefined): string {
src/components/pdks/lib/presentation.ts:91:   if (!item || item.noShift || (item.status !== "incomplete" && item.durationMeasured !== false)) return "";
src/components/pdks/lib/presentation.ts:126:   const status = cell?.status ?? "noData";
src/components/pdks/lib/presentation.ts:127:   const duration =
src/components/pdks/lib/presentation.ts:128:     cell?.durationMeasured === false ? "Süre hesaplanamadı" : status === "future" || status === "noData" || status === "notEmployed"
src/components/pdks/lib/presentation.ts:129:       ? "Süre yok"
src/components/pdks/lib/presentation.ts:136:       day.status === "future" || day.status === "noData" || day.status === "notEmployed"
src/components/pdks/lib/presentation.ts:137:         ? sum
src/components/pdks/lib/presentation.ts:167:   status: "all" | keyof typeof STATUS_META | undefined,
src/components/pdks/lib/presentation.ts:168: ): PdksRow[] {
src/components/pdks/lib/presentation.ts:169:   if (!status || status === "all") return rows;
src/components/pdks/lib/presentation.ts:170:   return rows.filter((row) => {
src/components/pdks/lib/presentation.ts:172:     if (status === "overtime")
src/components/pdks/lib/presentation.ts:173:       return row.days.length > 1
src/components/pdks/lib/presentation.ts:182:       ? row.days.some((day) => !day.noShift && day.status === status)
src/components/pdks/lib/presentation.ts:183:       : row.status === status;
src/components/pdks/lib/presentation.ts:183:       : row.status === status;
src/components/pdks/lib/presentation.ts:184:   });
```

</details>

<details><summary>src/components/settings/sections/privacy/BiometricDestructionCard.tsx (6 yazma/durum eşleşmesi)</summary>

```text
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:20: export function destructionStatusLabel(run: { status: string; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number }): string {
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:21:   if (run.status === "running") return "İmha sürüyor";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:21:   if (run.status === "running") return "İmha sürüyor";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:22:   if (run.status === "waitingDevices") return "Cihaz onayı bekleniyor";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:22:   if (run.status === "waitingDevices") return "Cihaz onayı bekleniyor";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:23:   if (run.status === "failed") return "İşlem kesildi";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:23:   if (run.status === "failed") return "İşlem kesildi";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:24:   if (run.deviceOperations === 0) return "Convex'ten silindi; cihazlardaki şablonlar ayrıca silinmeli";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:77:   const active = latestRun?.status === "running" || latestRun?.status === "waitingDevices";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:78:   const { run: count, pending: counting } = useAsyncAction(async () => {
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:120:         <StatusBadge className="max-w-full whitespace-normal break-words" tone={latestRun.status === "failed" || latestRun.deviceFailures || latestRun.deviceUnconfirmed ? "warning" : active ? "info" : "neutral"}>
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:121:           {destructionStatusLabel(latestRun)}
```

</details>

<details><summary>src/components/sync/SyncIssuesBanner.tsx (4 yazma/durum eşleşmesi)</summary>

```text
src/components/sync/SyncIssuesBanner.tsx:199:         const count = results.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value.count : 0), 0);
src/components/sync/SyncIssuesBanner.tsx:200:         const failure = results.find((result) => result.status === "rejected");
src/components/sync/SyncIssuesBanner.tsx:200:         const failure = results.find((result) => result.status === "rejected");
src/components/sync/SyncIssuesBanner.tsx:201:         if (failure?.status === "rejected") throw new Error(`${count} uyarı kapatıldı; kalan uyarılar kapatılamadı. ${errorMessage(failure.reason)}`);
src/components/sync/SyncIssuesBanner.tsx:201:         if (failure?.status === "rejected") throw new Error(`${count} uyarı kapatıldı; kalan uyarılar kapatılamadı. ${errorMessage(failure.reason)}`);
src/components/sync/SyncIssuesBanner.tsx:202:         notify.success(`${count} uyarı kapatıldı`, results.some((result) => result.status === "fulfilled" && result.value.hasMore) ? "Kapsamda başka uyarılar var." : undefined);
src/components/sync/SyncIssuesBanner.tsx:202:         notify.success(`${count} uyarı kapatıldı`, results.some((result) => result.status === "fulfilled" && result.value.hasMore) ? "Kapsamda başka uyarılar var." : undefined);
src/components/sync/SyncIssuesBanner.tsx:203:       }} />
```

</details>

<details><summary>src/components/visitors/VisitorForm.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/visitors/VisitorForm.tsx:43:         <VisitorFormFields formData={formData} setFormData={setFormData} assignedDoors={visitor?.presetRuleName} hostEmployees={hostEmployees} hostSearch={hostSearch} onHostSearchChange={setHostSearch} hostsLoading={hostsLoading} isCurrentlyActive={visitor?.isActive === true} isEditing={!!visitor} isPreRegistration={isPreRegistration} kvkkConsentAt={visitor?.kvkkConsent?.grantedAt} errors={fieldErrors} />
src/components/visitors/VisitorForm.tsx:44:         {failed && <FormFeedback tone="error">Ziyaretçi kaydedilemedi. Girişleriniz korundu; bilgileri kontrol edip tekrar deneyin.</FormFeedback>}
```

</details>

<details><summary>src/components/visitors/VisitorSlideOverPanel.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/visitors/VisitorSlideOverPanel.tsx:65:   const status = visitorStatusInfo[displayVisitorStatus(detail, now)];
src/components/visitors/VisitorSlideOverPanel.tsx:66:   const needsCard = detail.cardNumber.startsWith("PRE:");
```

</details>

<details><summary>src/components/visitors/VisitorTable.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/components/visitors/VisitorTable.tsx:29:       </TableRow></TableHeader><TableBody>{loading ? <TableStateRow colSpan={7} state="loading" label="Ziyaretçiler yükleniyor" /> : !visitors.length ? <TableStateRow colSpan={7} state="custom">{emptyState}</TableStateRow> : visitors.map(visitor => <TableRow key={visitor._id} className={ROW_CLICK_CLASS} onClick={onRowActivate(() => onOpen(visitor))}>
src/components/visitors/VisitorTable.tsx:30:         <TableCell className="truncate"><button type="button" className="max-w-full truncate text-left font-medium focus-visible:outline-primary" title={`${visitor.firstName} ${visitor.lastName}`} onClick={() => onOpen(visitor)}>{visitor.firstName} {visitor.lastName}</button></TableCell><TableCell className="truncate" title={visitor.hostName ?? undefined}>{visitor.hostName ?? "—"}</TableCell>
```

</details>

<details><summary>src/components/visitors/hooks/useVisitorFormData.ts (3 yazma/durum eşleşmesi)</summary>

```text
src/components/visitors/hooks/useVisitorFormData.ts:22:   isActive: boolean;
src/components/visitors/hooks/useVisitorFormData.ts:23:   notes: string;
src/components/visitors/hooks/useVisitorFormData.ts:40:   isActive: true,
src/components/visitors/hooks/useVisitorFormData.ts:41:   notes: "",
src/components/visitors/hooks/useVisitorFormData.ts:91:         isActive: visitor.isActive ?? true,
src/components/visitors/hooks/useVisitorFormData.ts:92:         notes: visitor.notes || "",
```

</details>

<details><summary>src/components/visitors/hooks/useVisitorFormSchema.ts (1 yazma/durum eşleşmesi)</summary>

```text
src/components/visitors/hooks/useVisitorFormSchema.ts:9:   isActive: z.boolean().optional(),
src/components/visitors/hooks/useVisitorFormSchema.ts:10:   isEditing: z.boolean().optional(),
```

</details>

<details><summary>src/components/visitors/lib/formPayload.ts (1 yazma/durum eşleşmesi)</summary>

```text
src/components/visitors/lib/formPayload.ts:15:   const shared = { firstName: parsed.firstName, lastName: parsed.lastName, isActive: visitor?.isActive === true ? true : formData.isActive, kvkkConsent: formData.kvkkConsent, kvkkDocumentVersion: formData.kvkkDocumentVersion };
src/components/visitors/lib/formPayload.ts:16:   if (visitor) {
```

</details>

<details><summary>src/hooks/useDeviceFilters.tsx (4 yazma/durum eşleşmesi)</summary>

```text
src/hooks/useDeviceFilters.tsx:12:   const { search, status: statusFilter, type: typeFilter } = readDeviceFilters(params);
src/hooks/useDeviceFilters.tsx:13:   const setSearch = (search: string) => setParams(current => writeDeviceFilters(current, { search }));
src/hooks/useDeviceFilters.tsx:14:   const setStatusFilter = (status: string) => setParams(current => writeDeviceFilters(current, { status }));
src/hooks/useDeviceFilters.tsx:15:   const setTypeFilter = (type: string) => setParams(current => writeDeviceFilters(current, { type }));
src/hooks/useDeviceFilters.tsx:16:   const clearFilters = () => setParams(current => writeDeviceFilters(current, { search: '', status: 'all', type: 'all', zoneId: null, doorId: null }));
src/hooks/useDeviceFilters.tsx:17: 
src/hooks/useDeviceFilters.tsx:27:     search, status: statusFilter, type: typeFilter, zoneId: selectedZoneId, doorId: selectedDoorId,
src/hooks/useDeviceFilters.tsx:28:   })), [devices, selectedZoneId, selectedDoorId, search, statusFilter, typeFilter]);
```

</details>

<details><summary>src/hooks/useDeviceTable.tsx (1 yazma/durum eşleşmesi)</summary>

```text
src/hooks/useDeviceTable.tsx:16:   const failed = targets.filter((_, index) => results[index].status === "rejected");
src/hooks/useDeviceTable.tsx:17:   return { failed, deleted: targets.length - failed.length };
```

</details>

<details><summary>src/hooks/useDevices.ts (4 yazma/durum eşleşmesi)</summary>

```text
src/hooks/useDevices.ts:34:     return { ...dev, status: computedStatus };
src/hooks/useDevices.ts:35:   });
src/hooks/useDevices.ts:48:         isActive: deviceData.isActive ?? true,
src/hooks/useDevices.ts:49:         description: deviceData.description,
src/hooks/useDevices.ts:69:         isActive: updates.isActive,
src/hooks/useDevices.ts:70:         description: updates.description,
src/hooks/useDevices.ts:71:         lastSeen: updates.lastSeen,
src/hooks/useDevices.ts:72:       });
```

</details>

<details><summary>src/lib/pdksSummary.ts (11 yazma/durum eşleşmesi)</summary>

```text
src/lib/pdksSummary.ts:38:           day.status === "future" ||
src/lib/pdksSummary.ts:39:           day.status === "noData"
src/lib/pdksSummary.ts:39:           day.status === "noData"
src/lib/pdksSummary.ts:40:         )
src/lib/pdksSummary.ts:44:           day.status === "present" ||
src/lib/pdksSummary.ts:45:           day.status === "late" ||
src/lib/pdksSummary.ts:45:           day.status === "late" ||
src/lib/pdksSummary.ts:46:           day.status === "absent" ||
src/lib/pdksSummary.ts:46:           day.status === "absent" ||
src/lib/pdksSummary.ts:47:           day.status === "leave"
src/lib/pdksSummary.ts:47:           day.status === "leave"
src/lib/pdksSummary.ts:48:         )
src/lib/pdksSummary.ts:52:       if (record.status === "future" || record.status === "noData") continue;
src/lib/pdksSummary.ts:53:       if (
src/lib/pdksSummary.ts:54:         record.status === "present" ||
src/lib/pdksSummary.ts:55:         record.status === "late" ||
src/lib/pdksSummary.ts:55:         record.status === "late" ||
src/lib/pdksSummary.ts:56:         record.status === "absent" ||
src/lib/pdksSummary.ts:56:         record.status === "absent" ||
src/lib/pdksSummary.ts:57:         record.status === "leave"
src/lib/pdksSummary.ts:57:         record.status === "leave"
src/lib/pdksSummary.ts:58:       )
```

</details>

<details><summary>src/lib/reports/rows.ts (5 yazma/durum eşleşmesi)</summary>

```text
src/lib/reports/rows.ts:26:   devamsizlar: cell => cell.status === 'absent',
src/lib/reports/rows.ts:27:   'fazla-mesai': cell => cell.overtimeMinutes > 0,
src/lib/reports/rows.ts:30:   istisnalar: cell => (cell.detail?.dayType === 'workday' && (cell.isLate || cell.detail.isEarlyExit)) || cell.status === 'absent' || flexibleShortfall(cell) > 0,
src/lib/reports/rows.ts:31:   'erken-cikanlar': cell => cell.detail?.dayType === 'workday' && cell.detail.isEarlyExit,
src/lib/reports/rows.ts:50:     if (cell.status === 'future' || cell.status === 'noData') continue;
src/lib/reports/rows.ts:51:     if (cell.durationMeasured !== undefined) counts.incompleteDays ??= 0;
src/lib/reports/rows.ts:52:     if (cell.status === 'incomplete') { counts.incompleteDays = (counts.incompleteDays ?? 0) + 1; continue; }
src/lib/reports/rows.ts:53:     if (cell.payrollCode === 'N') counts.workedDays += 1;
src/lib/reports/rows.ts:106:   if (cell.status === 'absent') parts.push('Devamsız');
src/lib/reports/rows.ts:107:   if (cell.detail?.dayType === 'workday' && cell.isLate) parts.push(`Geç ${cell.lateMinutes} dk`);
```

</details>

<details><summary>src/lib/reports/testFixtures.ts (3 yazma/durum eşleşmesi)</summary>

```text
src/lib/reports/testFixtures.ts:5:   return { date: '2026-10-19', firstEntry: '09:05', lastExit: '18:00', totalMinutes: 535, status: 'present', leaveType: null, isLate: false, lateMinutes: 0, payrollCode: 'N', overtimeMinutes: 0, detail: { dayType: 'workday', shiftName: null, plannedStart: '09:00', plannedEnd: '18:00', isEarlyExit: false, earlyExitMinutes: 0, readingCount: 0, isManual: false, punches: [], plannedBreakStart: null, plannedBreakEnd: null, breakViolation: false }, ...overrides };
src/lib/reports/testFixtures.ts:6: }
src/lib/reports/testFixtures.ts:8:   return { excludedUnknownReadings: 0, id: 'employee-a', name: 'Ayşe Yılmaz', employeeId: '123', cardNumber: '123', payrollCode: 'N', payrollEmployeeCode: 'P01', department: 'Üretim', firstEntry: '09:05', lastExit: '18:00', totalHours: '8 sa 55 dk', totalMinutes: 535, overtimeMinutes: 0, overtime: '0m', overtimeHours: 0, overtimeMultiplier: 1, overtimePayTRY: null, hourlyRate: null, yearlyOvertimeLimit: 270, leaveType: '-', status: 'present', isLate: false, isEarlyExit: false, isManual: false, manualNote: null, manualEditedBy: null, detailedLogs: [], days };
src/lib/reports/testFixtures.ts:9: }
src/lib/reports/testFixtures.ts:12:     cells: [{ date: '2026-10-19', status: 'present', payrollCode: 'N', totalMinutes: 535, rawTotalMinutes: 535, nightMinutes: 0, overtimeMinutes: 0, multiplier: 0, overtimePayTRY: null, isLate: false, isEarlyExit: false, isManual: false, classification: 'workday' }],
src/lib/reports/testFixtures.ts:13:     totals: { totalMinutes: 535, overtimeMinutes: 0, overtimePayTRY: null, leaveDays: 0, absentDays: 0, lateDays: 0, exceedsDaily11h: [] } }] };
```

</details>

<details><summary>src/lib/reports/transactions.ts (2 yazma/durum eşleşmesi)</summary>

```text
src/lib/reports/transactions.ts:6: export function transactionReducer(state: TransactionSnapshots, action: TransactionAction): TransactionSnapshots {
src/lib/reports/transactions.ts:7:   if (action.type === 'reset') return { pages: {} };
src/lib/reports/transactions.ts:10: export function transactionSnapshot(state: TransactionSnapshots, cursor: string | null, current?: TransactionPage): {
src/lib/reports/transactions.ts:11:   rows: TransactionPage['page']; isDone: boolean; continueCursor: string | null;
```

</details>

<details><summary>src/pages/Alarms.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/pages/Alarms.tsx:142:   const { results, status: pageStatus, loadMore } = usePaginatedQuery(api.alarms.list,
src/pages/Alarms.tsx:143:     projectId ? alarmListArgs(projectId, category, filters) : "skip", { initialNumItems: 50 });
src/pages/Alarms.tsx:145:     <Table framed scrollLabel="Alarm kayıtları" resizeKey="alarms" className="w-full text-left text-sm"><TableHeader className="bg-subtle"><TableRow>{canManage && <TableHead columnId="select" resizable={false} className="p-3">Seç</TableHead>}<TableHead columnId="time" className="p-3">Zaman</TableHead><TableHead columnId="device" className="p-3">Cihaz</TableHead><TableHead columnId="event" className="p-3">Olay</TableHead><TableHead columnId="severity" className="p-3">Önem</TableHead><TableHead columnId="status" className="p-3">Durum</TableHead>{isAdmin && <TableHead columnId="email" className="p-3">E-posta</TableHead>}{canManage && <TableHead columnId="actions" resizable={false} className="p-3">İşlem</TableHead>}</TableRow></TableHeader><TableBody>{loading || pageStatus === "LoadingFirstPage" ? <TableStateRow colSpan={5 + (canManage ? 2 : 0) + (isAdmin ? 1 : 0)} state="loading" label="Olaylar yükleniyor." /> : !results.length ? <TableStateRow colSpan={5 + (canManage ? 2 : 0) + (isAdmin ? 1 : 0)} state="empty" title={pageStatus === "CanLoadMore" ? "Daha fazla yükle" : "Olay bulunamadı"} description={pageStatus === "CanLoadMore" ? "Tarama sınırına ulaşıldı. Daha fazla olay için aşağıdaki düğmeyi kullanın." : "Seçili filtrelerde gösterilecek olay yok."} /> : results.map(row => <TableRow key={row._id} className="border-t border-line">{canManage && <TableCell className="p-3">{!row.ackedAt && <input aria-label={`${row.label} seç`} type="checkbox" disabled={selected.length >= 50 && !selected.includes(row._id)} checked={selected.includes(row._id)} onChange={event => setSelected(current => event.target.checked ? (current.includes(row._id) || current.length >= 50 ? current : [...current, row._id]) : current.filter(id => id !== row._id))} />}</TableCell>}<TableCell className="p-3">{new Date(row.eventTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</TableCell><TableCell className="p-3 truncate" title={row.deviceName}>{row.deviceName}</TableCell><TableCell className="p-3"><span className="block truncate" title={row.label}>{row.label}</span>{row.resolvedAt && <p className="text-xs text-muted-foreground">Bağlantı geri geldi · {new Date(row.resolvedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}{row.resolvedAt && <OfflineDuration offlineDurationMs={row.offlineDurationMs} />}</TableCell><TableCell className="p-3"><StatusBadge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "neutral"}>{row.severity === "critical" ? "Kritik" : row.severity === "warning" ? "Uyarı" : "Bilgi"}</StatusBadge></TableCell><TableCell className="p-3">{row.ackedAt ? `Onaylandı · ${new Date(row.ackedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}` : "İnceleme bekliyor"}</TableCell>{isAdmin && <TableCell className="p-3"><AlarmEmailStatus delivery={{ status: row.alarmEmailStatus, attempts: row.alarmEmailAttempts, at: row.alarmEmailAttemptAt ?? row.alarmQueuedAt, error: row.alarmEmailError, retryAt: row.alarmEmailRetryAt }} /></TableCell>}{canManage && <TableCell className="p-3">{!row.ackedAt && <AlarmAcknowledgeButton onAcknowledge={() => void acknowledgeRows([row._id])} />}</TableCell>}</TableRow>)}</TableBody></Table>
src/pages/Alarms.tsx:146:     <LoadMoreFooter hasMore={pageStatus === "CanLoadMore" || pageStatus === "LoadingMore"} loading={pageStatus === "LoadingMore"} onLoadMore={() => loadMore(50)} />
```

</details>

<details><summary>src/pages/Devices.tsx (2 yazma/durum eşleşmesi)</summary>

```text
src/pages/Devices.tsx:53:   // Device panel state: device=null → sıfırdan yeni cihaz (marka seçici), device=X → düzenleme.
src/pages/Devices.tsx:54:   const [devicePanel, setDevicePanel] = useState<{
src/pages/Devices.tsx:189:         state={virtualReader}
src/pages/Devices.tsx:190:         projectId={projectId}
```

</details>

### Web/mobil ve köprü okuyan kopyalar — satır envanteri

Aşağıdaki enum/karşılaştırma/rozet/evre eşleşmeleri aynı içerik keşfinden gelir. Runtime HTTP response.status gibi taşıma kodları iş durumu değildir; envanterde bağlam kaybolmaması için korunmuştur.

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Models.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Models.cs:225:   [JsonPropertyName("state")] public string State { get; init; } = "stopped";
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:268:       var status = Marshal.PtrToStringAnsi(statusBuffer) ?? "";
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:269:       return SdkResult.Failure($"NET_DVR_STDXMLConfig failed {NET_DVR_GetLastError()}: {status}");
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:381:       var status = type;
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:384:         status = unchecked((uint)Marshal.ReadInt32(buffer));
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:386:       if (status is CallbackStatusSuccess or CallbackStatusFinish)
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:390:       else if (status == CallbackStatusFailed)
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs:74:       _logger.LogWarning("Ack failed for {OpId}: HTTP {Status}", opId, (int)response.StatusCode);
bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs:94:       _logger.LogWarning("Card event post failed: HTTP {Status}", (int)response.StatusCode);
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:138:         wakeChannel = _wake.State,
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:218:   private static async Task JsonAsync(HttpListenerResponse response, object body, int status = 200)
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:220:     response.StatusCode = status;
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:228:   private static async Task HtmlAsync(HttpListenerResponse response, string html, int status = 200)
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:230:     response.StatusCode = status;
bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:297: function badge(s){const m={connected:'ok',error:'err',connecting:'idle',stopped:'idle'};return '<span class="badge '+(m[s.state]||'idle')+'">'+s.state+(s.panelLoggedIn?' · login':'')+'</span>'}
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Services/PanelManager.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Services/PanelManager.cs:213:           // referans olduğundan değişiklik status/log/op'lara yansır (#6).
bridge/windows/NgAccess.HikvisionBridge/Services/PanelManager.cs:262:       return _workers.Values.Select(w => w.Worker.Status()).ToList();
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:52:   public PanelStatus Status() => new()
bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:59:     State = _state,
```

</details>

<details><summary>bridge/windows/NgAccess.HikvisionBridge/Services/WakeStreamClient.cs</summary>

```text
bridge/windows/NgAccess.HikvisionBridge/Services/WakeStreamClient.cs:48:   public string State => _state;
bridge/windows/NgAccess.HikvisionBridge/Services/WakeStreamClient.cs:140:       _logger.LogWarning("Uyandırma kanalı koptu: HTTP {Status}", (int)response.StatusCode);
```

</details>

<details><summary>infra/hik-event-bridge/bridge.mjs</summary>

```text
infra/hik-event-bridge/bridge.mjs:39:   if (first.status !== 401) return first;
infra/hik-event-bridge/bridge.mjs:168:         if (res.ok || (res.status < 500 && res.status !== 429)) return { status: res.status };
infra/hik-event-bridge/bridge.mjs:169:         log({ event: 'post_retry', attempt, status: res.status });
infra/hik-event-bridge/bridge.mjs:180:     return { status: 0 };
infra/hik-event-bridge/bridge.mjs:187:       const result = token ? await post(job.path, job.body, token) : { status: 0 };
infra/hik-event-bridge/bridge.mjs:188:       if (result.status >= 200 && result.status < 300) {
infra/hik-event-bridge/bridge.mjs:191:         log({ event: 'forward', ...job.summary, status: result.status });
infra/hik-event-bridge/bridge.mjs:193:         log({ event: 'post_pending', ...job.summary, status: result.status });
infra/hik-event-bridge/bridge.mjs:232:     if (typeof alert.devIndex !== 'string' || !['online', 'offline'].includes(alert.status)) return;
infra/hik-event-bridge/bridge.mjs:233:     // Live status and snapshots share the bridge clock, regardless of gateway clock skew.
infra/hik-event-bridge/bridge.mjs:235:     return enqueuePost('/hik-gateway/device-status', {
infra/hik-event-bridge/bridge.mjs:236:       devIndex: alert.devIndex, status: alert.status, at, ...(source ? { source } : {}),
infra/hik-event-bridge/bridge.mjs:238:       type: 'devStatusChanged', devIndex: alert.devIndex, deviceStatus: alert.status, source,
infra/hik-event-bridge/bridge.mjs:273:         log({ event: 'device_status', type: alert.eventType, devIndex: alert.devIndex, status: alert.status });
infra/hik-event-bridge/bridge.mjs:291:       if (!res.ok) { await res.body?.cancel(); throw new Error(`device_list_status=${res.status}`); }
infra/hik-event-bridge/bridge.mjs:298:         const alert = { devIndex: device.devIndex, deviceID: device.EhomeParams?.EhomeID, status: device.devStatus, at };
infra/hik-event-bridge/bridge.mjs:350:         throw new Error(`subscribe_failed status=${res.status}`);
```

</details>

<details><summary>infra/hik-event-bridge/queue.mjs</summary>

```text
infra/hik-event-bridge/queue.mjs:18:         if (!['/card-reader', '/hik-gateway/device-status'].includes(job.path) ||
```

</details>

<details><summary>infra/hik-relay/server.mjs</summary>

```text
infra/hik-relay/server.mjs:57:     const reply = (status, body, headers = {}) => {
infra/hik-relay/server.mjs:58:       res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
infra/hik-relay/server.mjs:60:       log('request', bridgeId, status);
```

</details>

<details><summary>mobile/lib/l10n/app_localizations_en.dart</summary>

```text
mobile/lib/l10n/app_localizations_en.dart:485:   String get homeDataUnavailable => 'Today’s status could not be loaded';
mobile/lib/l10n/app_localizations_en.dart:497:   String get homeStatusUnknown => 'Status unknown';
mobile/lib/l10n/app_localizations_en.dart:531:       'Unable to verify code status. Check again.';
mobile/lib/l10n/app_localizations_en.dart:655:       'The result is uncertain. Check its status before sending another command.';
mobile/lib/l10n/app_localizations_en.dart:658:   String get homeCommandCheckStatus => 'Check status';
mobile/lib/l10n/app_localizations_en.dart:867:   String get visitorSyncTitle => 'Device status';
mobile/lib/l10n/app_localizations_en.dart:980:       'No invitations match the search or access status.';
mobile/lib/l10n/app_localizations_en.dart:1023:       'The visitor request could not be safely saved or read. Check its status again before continuing.';
```

</details>

<details><summary>mobile/lib/models/device.dart</summary>

```text
mobile/lib/models/device.dart:13:   final bool? canOpen;
mobile/lib/models/device.dart:28:     this.canOpen,
mobile/lib/models/device.dart:57:       canOpen: _optionalBool(json, 'canOpen'),
mobile/lib/models/device.dart:117:               device.canOpen == null ||
mobile/lib/models/device.dart:125:           device.canOpen == true &&
```

</details>

<details><summary>mobile/lib/screens/auth/forgot_password_screen.dart</summary>

```text
mobile/lib/screens/auth/forgot_password_screen.dart:17:   State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
mobile/lib/screens/auth/forgot_password_screen.dart:20: class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
```

</details>

<details><summary>mobile/lib/screens/home/home_screen.dart</summary>

```text
mobile/lib/screens/home/home_screen.dart:32:   State<HomeScreen> createState() => _HomeScreenState();
mobile/lib/screens/home/home_screen.dart:35: class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
mobile/lib/screens/home/home_screen.dart:70:   void didChangeAppLifecycleState(AppLifecycleState state) {
mobile/lib/screens/home/home_screen.dart:71:     _isAppActive = state == AppLifecycleState.resumed;
mobile/lib/screens/home/home_screen.dart:158:       status: attendance.attendanceStatus,
mobile/lib/screens/home/home_screen.dart:217:         commands.operation?.status == DoorOperationStatus.unknown ||
mobile/lib/screens/home/home_screen.dart:374:       if (target == null || target.canOpen != true) {
```

</details>

<details><summary>mobile/lib/screens/settings/select_device_screen.dart</summary>

```text
mobile/lib/screens/settings/select_device_screen.dart:19:   State<SelectDeviceScreen> createState() => _SelectDeviceScreenState();
mobile/lib/screens/settings/select_device_screen.dart:22: class _SelectDeviceScreenState extends State<SelectDeviceScreen> {
mobile/lib/screens/settings/select_device_screen.dart:281:                       if (device.canOpen == false)
mobile/lib/screens/settings/select_device_screen.dart:291:                       device.canOpen == true,
```

</details>

<details><summary>src/components/access-control/AddDoorDialog.tsx</summary>

```text
src/components/access-control/AddDoorDialog.tsx:25:     await create({ name: name.trim(), projectId, zoneId, doorCode: doorCode.trim() || undefined, status: "active" });
```

</details>

<details><summary>src/components/access-control/CardReadingsTable.tsx</summary>

```text
src/components/access-control/CardReadingsTable.tsx:18:     <Table resizeKey="access-readings" density="compact"><TableHeader><TableRow>{[["time", "Zaman (TR)"], ["person", "Kişi / kart"], ["door-device", "Kapı / cihaz"], ["direction", "Yön"], ["result", "Sonuç"], ["source", "Kaynak"], ["actions", "İşlem"]].map(([id, label]) => <TableHead key={id} columnId={id} resizable={id !== "actions"}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{message ? <TableStateRow colSpan={7} state="custom">{message}</TableStateRow> : loading ? <TableStateRow colSpan={7} state="loading" label="Erişim okumaları yükleniyor" /> : !readings.length ? <TableStateRow colSpan={7} state="empty" title="Okuma bulunamadı" description={emptyMessage} action={emptyAction} /> : readings.map(r => <TableRow key={r._id} className={`${ROW_CLICK_CLASS} ${freshIds?.has(r._id) ? "bg-info-bg" : ""}`} onClick={openRow(r)}>
```

</details>

<details><summary>src/components/access-control/door-dialog/DoorStatusPlanSection.tsx</summary>

```text
src/components/access-control/door-dialog/DoorStatusPlanSection.tsx:22:         <Label htmlFor="status-enabled" className="text-sm font-medium">
src/components/access-control/door-dialog/DoorStatusPlanSection.tsx:31:             id="status-enabled"
```

</details>

<details><summary>src/components/access-control/door-dialog/weeklyPlan.tsx</summary>

```text
src/components/access-control/door-dialog/weeklyPlan.tsx:11: /** Shared by the door status and verify-mode plan editors; only the mode field differs. */
```

</details>

<details><summary>src/components/access-control/door-plans/CopyDoorPlansDialog.tsx</summary>

```text
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:48:     type === "status" ? source?.hikDoorStatusPlan : source?.hikVerifyPlan;
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:68:     "status",
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:77:   const status = useAction(api.actions.hikGatewayDevice.applyDoorStatusPlan);
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:88:     type === "status"
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:129:           status: (doorId) => status({ doorId }),
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:249:               <p role="status">
```

</details>

<details><summary>src/components/access-control/door-plans/DoorPlanDialog.tsx</summary>

```text
src/components/access-control/door-plans/DoorPlanDialog.tsx:57: // hikDoorStatusPlan form state tipi — schema shape ile birebir
src/components/access-control/door-plans/DoorPlanDialog.tsx:136:     persistedKeys.push("status");
src/components/access-control/door-plans/DoorPlanDialog.tsx:158:         status: () => applyDoorStatusPlan({ doorId: door.doorId }),
src/components/access-control/door-plans/DoorPlanDialog.tsx:232:         errors["status-plan"] = errorMessage(error);
src/components/access-control/door-plans/DoorPlanDialog.tsx:279:               <div role="status" className="mb-4 space-y-2 text-sm">
src/components/access-control/door-plans/DoorPlanDialog.tsx:312:                     id="status-plan"
src/components/access-control/door-plans/DoorPlanDialog.tsx:316:                     aria-invalid={!!timeErrors["status-plan"]}
src/components/access-control/door-plans/DoorPlanDialog.tsx:318:                       timeErrors["status-plan"]
src/components/access-control/door-plans/DoorPlanDialog.tsx:319:                         ? "status-plan-error"
src/components/access-control/door-plans/DoorPlanDialog.tsx:326:                       invalid={!!timeErrors["status-plan"]}
src/components/access-control/door-plans/DoorPlanDialog.tsx:328:                         timeErrors["status-plan"]
src/components/access-control/door-plans/DoorPlanDialog.tsx:329:                           ? "status-plan-error"
src/components/access-control/door-plans/DoorPlanDialog.tsx:333:                     {timeErrors["status-plan"] && (
src/components/access-control/door-plans/DoorPlanDialog.tsx:335:                         id="status-plan-error"
src/components/access-control/door-plans/DoorPlanDialog.tsx:338:                         {timeErrors["status-plan"]}
```

</details>

<details><summary>src/components/access-control/door-plans/DoorPlansTab.tsx</summary>

```text
src/components/access-control/door-plans/DoorPlansTab.tsx:116:         <p role="status">Kapı planları yükleniyor…</p>
src/components/access-control/door-plans/DoorPlansTab.tsx:181:           {targets === undefined ? <TableStateRow colSpan={4} state="loading" label="Kapı planları yükleniyor…" /> : filtered.length === 0 ? <TableStateRow colSpan={4} state="empty" title={term ? "Aramaya uygun kapı bulunamadı" : "Plan kurulabilecek Hikvision kapısı yok"} description={term ? "Kapı, cihaz veya bölge adını değiştirin." : scopeDescription} action={term ? undefined : devicesAction} /> : null}
```

</details>

<details><summary>src/components/access-control/door-plans/bulk.ts</summary>

```text
src/components/access-control/door-plans/bulk.ts:10: export type CopyPlanType = "status" | "verify" | "holiday";
src/components/access-control/door-plans/bulk.ts:12:   status: "Durum planı",
src/components/access-control/door-plans/bulk.ts:31:     ...(types.includes("status") && source.hikDoorStatusPlan
src/components/access-control/door-plans/bulk.ts:86:         status: () => apply.status(doorId),
```

</details>

<details><summary>src/components/access-control/unified/AccessRuleDetails.tsx</summary>

```text
src/components/access-control/unified/AccessRuleDetails.tsx:14:   const { results, status, loadMore } = usePaginatedQuery(
src/components/access-control/unified/AccessRuleDetails.tsx:28:       {status === "LoadingFirstPage" ? (
src/components/access-control/unified/AccessRuleDetails.tsx:50:           {status !== "Exhausted" && (
src/components/access-control/unified/AccessRuleDetails.tsx:53:               disabled={status !== "CanLoadMore"}
src/components/access-control/unified/AccessRuleDetails.tsx:56:               {status === "LoadingMore" ? "Yükleniyor…" : "Daha fazla yükle"}
src/components/access-control/unified/AccessRuleDetails.tsx:96:           <p role="status">
src/components/access-control/unified/AccessRuleDetails.tsx:106:               role="status"
```

</details>

<details><summary>src/components/access-control/unified/SyncRuns.tsx</summary>

```text
src/components/access-control/unified/SyncRuns.tsx:34:   runDisplay,
src/components/access-control/unified/SyncRuns.tsx:36:   targetLabels,
src/components/access-control/unified/SyncRuns.tsx:55:           <StatusBadge tone={targetTone(target.status)}>
src/components/access-control/unified/SyncRuns.tsx:56:             {targetLabels[target.status]}
src/components/access-control/unified/SyncRuns.tsx:72:   const display = runDisplay(run.status, run.counts);
src/components/access-control/unified/SyncRuns.tsx:75:       <div role="status">
src/components/access-control/unified/SyncRuns.tsx:85: /** Header row already shows status and counts; the dropdown only lists the devices. */
src/components/access-control/unified/SyncRuns.tsx:125:   "kind" | "startedAt" | "status" | "counts"
src/components/access-control/unified/SyncRuns.tsx:128:   const display = runDisplay(run.status, run.counts);
src/components/access-control/unified/SyncRuns.tsx:197:         target.status === "failed" ||
src/components/access-control/unified/SyncRuns.tsx:198:         target.status === "skipped" ||
src/components/access-control/unified/SyncRuns.tsx:199:         target.status === "unknown",
src/components/access-control/unified/SyncRuns.tsx:297:       <p role="status" className="flex-1 min-w-0">
```

</details>

<details><summary>src/components/access-control/unified/UnifiedAccessControl.tsx</summary>

```text
src/components/access-control/unified/UnifiedAccessControl.tsx:11: import StatusPage from "./status/StatusPage";
src/components/access-control/unified/UnifiedAccessControl.tsx:24:     status: "Kişi yetkilerinin cihazlara ulaşıp ulaşmadığı",
src/components/access-control/unified/UnifiedAccessControl.tsx:33:       : params.get("tab") === "status" && canManage
src/components/access-control/unified/UnifiedAccessControl.tsx:34:       ? "status"
src/components/access-control/unified/UnifiedAccessControl.tsx:62:             if (value === "status" || value === "doors")
src/components/access-control/unified/UnifiedAccessControl.tsx:75:           {tab === "status" && headerAction && <Button variant="outline" className="min-h-11 md:min-h-9" disabled={headerAction.disabled} onClick={headerAction.onClick}>{headerAction.label}</Button>}
src/components/access-control/unified/UnifiedAccessControl.tsx:90:           {canManage && <TabsTrigger value="status">Yetki Durumu</TabsTrigger>}
src/components/access-control/unified/UnifiedAccessControl.tsx:96:           <TabsContent value="status">
```

</details>

<details><summary>src/components/access-control/unified/components/ZoneDeviceTree.tsx</summary>

```text
src/components/access-control/unified/components/ZoneDeviceTree.tsx:66:   const state = (doorIds: string[], deviceIds: string[]) =>
src/components/access-control/unified/components/ZoneDeviceTree.tsx:132:             checked={state(
src/components/access-control/unified/components/ZoneDeviceTree.tsx:197:                     checked={state(doorIds, noDoors)}
```

</details>

<details><summary>src/components/access-control/unified/status/RunNotice.tsx</summary>

```text
src/components/access-control/unified/status/RunNotice.tsx:8: import { runDisplay } from "../lib/presentation";
src/components/access-control/unified/status/RunNotice.tsx:24:     if (run && run.status !== "running" && !completed.current) {
src/components/access-control/unified/status/RunNotice.tsx:29:   const display = run ? runDisplay(run.status, run.counts) : null;
src/components/access-control/unified/status/RunNotice.tsx:32:       <div role="status">
```

</details>

<details><summary>src/components/access-control/unified/status/StatusFilters.tsx</summary>

```text
src/components/access-control/unified/status/StatusFilters.tsx:72:     ([key, value]) => key !== "search" && key !== "state" && Boolean(value),
src/components/access-control/unified/status/StatusFilters.tsx:82:         hasFilters={activeCount > 0 || Boolean(filters.state)}
```

</details>

<details><summary>src/components/access-control/unified/status/StatusPage.tsx</summary>

```text
src/components/access-control/unified/status/StatusPage.tsx:114:       <EmptyStatus unknownCount={filters.state === "unknown" ? 0 : (projectCounts?.unknown ?? 0)} />
src/components/access-control/unified/status/StatusPage.tsx:115:       {busy && (rows.length > 0 || view === "device") && <p role="status">Yükleniyor…</p>}
```

</details>

<details><summary>src/components/access-control/unified/status/model.ts</summary>

```text
src/components/access-control/unified/status/model.ts:18:   state?: GrantRow["state"];
src/components/access-control/unified/status/model.ts:65:   row: Pick<EmployeeDetail["rows"][number], "state"> & Partial<Pick<GrantRow, "stale" | "lastError" | "doorUnresolved">>,
src/components/access-control/unified/status/model.ts:68:     label: labels[row.state],
src/components/access-control/unified/status/model.ts:71:       row.state === "failed"
src/components/access-control/unified/status/model.ts:73:         : row.state === "pending"
src/components/access-control/unified/status/model.ts:75:           : row.state === "effective"
src/components/access-control/unified/status/model.ts:78:     hint: row.state === "failed" ? shortFailureReason(row.lastError) : undefined,
```

</details>

<details><summary>src/components/access-control/unified/status/useStatusData.ts</summary>

```text
src/components/access-control/unified/status/useStatusData.ts:26: // Status UI reads only _id/name from devices; keeping the old array when those
```

</details>

<details><summary>src/components/admin/AdminDeviceDialog.tsx</summary>

```text
src/components/admin/AdminDeviceDialog.tsx:288:                 <div role="status" className="rounded-md border p-3 text-sm">
```

</details>

<details><summary>src/components/admin/AdminDevicesPanel.tsx</summary>

```text
src/components/admin/AdminDevicesPanel.tsx:103:   const status = (device: AdminDevice) => {
src/components/admin/AdminDevicesPanel.tsx:141:         <p role="status" className="text-sm text-muted-foreground">
src/components/admin/AdminDevicesPanel.tsx:145:         <p role="status" className="text-sm text-muted-foreground">
src/components/admin/AdminDevicesPanel.tsx:246:                 {!result ? <TableStateRow colSpan={6} state="loading" label="Cihaz havuzu yükleniyor" /> : result.page.length === 0 ? <TableStateRow colSpan={6} state="custom">{listState}</TableStateRow> : null}
src/components/admin/AdminDevicesPanel.tsx:270:                       {status(device)}
src/components/admin/AdminDevicesPanel.tsx:305:                   {status(device)}
```

</details>

<details><summary>src/components/alarms/AlarmFilters.tsx</summary>

```text
src/components/alarms/AlarmFilters.tsx:12:   status: "open" | "acked" | "all";
src/components/alarms/AlarmFilters.tsx:19: export const DEFAULT_ALARM_FILTERS: AlarmFiltersValue = { status: "open", severity: "", deviceId: "", fromDay: "", toDay: "" };
src/components/alarms/AlarmFilters.tsx:24:     <FilterField label="Durum" htmlFor="alarm-status"><Select value={value.status} onValueChange={status => { if (status === "open" || status === "acked" || status === "all") onChange({ ...value, status }); }}><SelectTrigger id="alarm-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Açık</SelectItem><SelectItem value="acked">Onaylı</SelectItem><SelectItem value="all">Tüm durumlar</SelectItem></SelectContent></Select></FilterField>
src/components/alarms/AlarmFilters.tsx:38:   return { projectId, category, status: value.status, severity: value.severity || undefined, deviceId: value.deviceId || undefined, from: isoDay(value.fromDay), to: isoDay(value.toDay, true) };
```

</details>

<details><summary>src/components/audit/auditLabels.ts</summary>

```text
src/components/audit/auditLabels.ts:77:   status: "Durum",
src/components/audit/auditLabels.ts:113:   accessTransfers: { employeeId: "Kaynak kişi", targetEmployeeId: "Hedef kişi", sourceProjectId: "Kaynak proje", targetProjectId: "Hedef proje", targetDeviceCount: "Silme beklenen cihaz sayısı", deviceId: "Cihaz", state: "Hedef durumu", status: "Taşıma durumu" },
src/components/audit/auditLabels.ts:114:   accessTransferTargets: { transferId: "Taşıma", deviceId: "Cihaz", state: "Silme durumu", lastError: "Son hata" },
src/components/audit/auditLabels.ts:120:   mailSettings: { smtpHost: "SMTP sunucusu", smtpPort: "SMTP portu", smtpUsername: "SMTP kullanıcı adı", fromEmail: "Gönderen e-posta", isActive: "Raporlar bu hesaptan", passwordChanged: "Şifre değişti" },
src/components/audit/auditLabels.ts:125:     isActive: "Aktif",
src/components/audit/auditLabels.ts:262:     if ((key === 'consentType' || key === 'status' || key === 'minSeverity') && auditEnumLabels[value]) return auditEnumLabels[value];
```

</details>

<details><summary>src/components/dashboard/DeviceHealth.tsx</summary>

```text
src/components/dashboard/DeviceHealth.tsx:44:             const status = device.connectionStatus ?? "never";
src/components/dashboard/DeviceHealth.tsx:45:             const detail = status === "online" ? "Çevrimiçi" : status === "never" ? "Hiç bağlanmadı" : (timeAgoTr(device.lastSeen, now) ?? "Çevrimdışı");
src/components/dashboard/DeviceHealth.tsx:51:                     className={cn("h-2 w-2 shrink-0 rounded-full", status === "online" ? "status-success-bg" : status === "offline" ? "status-danger-bg" : "bg-muted-foreground/40")}
src/components/dashboard/DeviceHealth.tsx:54:                   <span className={cn("shrink-0 text-xs", status === "offline" ? "text-danger" : "text-muted-foreground")}>{detail}</span>
```

</details>

<details><summary>src/components/dashboard/LiveFeed.tsx</summary>

```text
src/components/dashboard/LiveFeed.tsx:37:               <span className="absolute inline-flex h-full w-full animate-ping rounded-full status-success-bg opacity-60 motion-reduce:animate-none" />
src/components/dashboard/LiveFeed.tsx:38:               <span className="relative inline-flex h-2 w-2 rounded-full status-success-bg" />
```

</details>

<details><summary>src/components/dashboard/SetupChecklist.tsx</summary>

```text
src/components/dashboard/SetupChecklist.tsx:34:   const status = useQuery(api.projects.getSetupStatus, !loading && canManage && projectId && !hidden && !completed ? { projectId } : "skip");
src/components/dashboard/SetupChecklist.tsx:36:     if (!loading && canManage && projectId && !hidden && !completed && status?.complete) {
src/components/dashboard/SetupChecklist.tsx:40:   }, [loading, canManage, projectId, hidden, completed, status?.complete, doneKey]);
src/components/dashboard/SetupChecklist.tsx:41:   if (loading || !canManage || !projectId || hidden || completed || !status || status.complete) return null;
src/components/dashboard/SetupChecklist.tsx:46:   return <DashboardPanel title="Kurulumu tamamlayın" context={`${status.steps.filter(step => step.done).length}/5 adım tamam`}
src/components/dashboard/SetupChecklist.tsx:49:       {status.steps.map(step => <li key={step.key} className="min-w-0 py-3">
```

</details>

<details><summary>src/components/devices/DeviceCommandCenter.tsx</summary>

```text
src/components/devices/DeviceCommandCenter.tsx:81:         <p role="status" className="py-2 text-sm">
src/components/devices/DeviceCommandCenter.tsx:86:         <p role="status" className="py-2 text-sm">
src/components/devices/DeviceCommandCenter.tsx:91:         <p role="status" className="py-2 text-sm text-warning">
```

</details>

<details><summary>src/components/devices/DeviceDetailsPanel.tsx</summary>

```text
src/components/devices/DeviceDetailsPanel.tsx:103:     commandPending || tokenPending || gatewayPending || Object.values(formStates).some((state) => state?.pending);
src/components/devices/DeviceDetailsPanel.tsx:104:   const dirty = Object.values(formStates).some((state) => state?.dirty);
src/components/devices/DeviceDetailsPanel.tsx:184:                 className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1 data-[state=inactive]:hidden"
src/components/devices/DeviceDetailsPanel.tsx:206:                   className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
```

</details>

<details><summary>src/components/devices/DeviceForm.tsx</summary>

```text
src/components/devices/DeviceForm.tsx:295:           <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3 text-sm">
```

</details>

<details><summary>src/components/devices/DeviceHistoryImportCard.tsx</summary>

```text
src/components/devices/DeviceHistoryImportCard.tsx:115:         <p role="status" className="text-sm text-warning">
src/components/devices/DeviceHistoryImportCard.tsx:160:           <p role="status" className="rounded-md bg-muted p-3 text-sm">
src/components/devices/DeviceHistoryImportCard.tsx:166:         <p role="status" className="text-sm">
```

</details>

<details><summary>src/components/devices/DeviceList.tsx</summary>

```text
src/components/devices/DeviceList.tsx:153:             <TableStateRow colSpan={colCount} state="loading" label="Cihazlar yükleniyor" />
src/components/devices/DeviceList.tsx:178:               state="empty"
```

</details>

<details><summary>src/components/devices/DeviceTableRow.tsx</summary>

```text
src/components/devices/DeviceTableRow.tsx:87:       data-state={selected ? "selected" : undefined}
```

</details>

<details><summary>src/components/devices/DevicesContent.tsx</summary>

```text
src/components/devices/DevicesContent.tsx:69:       status: "all",
```

</details>

<details><summary>src/components/devices/LocationDoorItem.tsx</summary>

```text
src/components/devices/LocationDoorItem.tsx:141:                       <span className="status-warning-badge shrink-0 rounded-sm px-1 text-[10px] font-medium">APB</span>
```

</details>

<details><summary>src/components/devices/hooks/buildDeviceFormValues.ts</summary>

```text
src/components/devices/hooks/buildDeviceFormValues.ts:20:   status?: string;
src/components/devices/hooks/buildDeviceFormValues.ts:21:   isActive?: boolean;
src/components/devices/hooks/buildDeviceFormValues.ts:62:       status: "active",
src/components/devices/hooks/buildDeviceFormValues.ts:91:     status: (device.status === "active" || device.status === "inactive"
src/components/devices/hooks/buildDeviceFormValues.ts:92:       ? device.status
src/components/devices/hooks/buildDeviceFormValues.ts:93:       : device.isActive === false
```

</details>

<details><summary>src/components/devices/hooks/deviceUpdatePatch.ts</summary>

```text
src/components/devices/hooks/deviceUpdatePatch.ts:9:   status: "status", deviceSerial: "device_serial", deviceIp: "device_ip",
```

</details>

<details><summary>src/components/devices/hooks/useDeviceFormSubmission.ts</summary>

```text
src/components/devices/hooks/useDeviceFormSubmission.ts:75:           status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:134:           status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:215:                 status: values.status,
src/components/devices/hooks/useDeviceFormSubmission.ts:257:                 status: values.status,
```

</details>

<details><summary>src/components/devices/useDeviceDeepLink.ts</summary>

```text
src/components/devices/useDeviceDeepLink.ts:40:     unguardedReplace(navigator)({ ...location, search: search ? `?${search}` : "" }, location.state);
```

</details>

<details><summary>src/components/employees/EmployeeFingerprintCard.tsx</summary>

```text
src/components/employees/EmployeeFingerprintCard.tsx:35:   const [status, setStatus] = useState("");
src/components/employees/EmployeeFingerprintCard.tsx:104:     <p role="status" aria-live="polite" className="text-xs">{status}</p>
```

</details>

<details><summary>src/components/employees/EmployeeSyncConfirmDialog.tsx</summary>

```text
src/components/employees/EmployeeSyncConfirmDialog.tsx:13:   const deviceIds = new Set(rules.filter(rule => rule.isActive && rule.groupMembers.some(member => employees.some(employee => employee._id === member.employeeId && !!employee.cardNumber))).flatMap(rule => rule.groupDevices.map(link => link.deviceId)));
src/components/employees/EmployeeSyncConfirmDialog.tsx:14:   return new Set(devices.filter(device => deviceIds.has(device._id) && device.isActive && device.brand === "hikvision").flatMap(device => {
src/components/employees/EmployeeSyncConfirmDialog.tsx:24:   const inactiveCount = employees.filter(employee => employee.isActive === false).length;
```

</details>

<details><summary>src/components/employees/import/BatchCardAssignDialog.tsx</summary>

```text
src/components/employees/import/BatchCardAssignDialog.tsx:15: type AssignResult = { employeeId: string; status: "assigned" | "error"; message: string };
src/components/employees/import/BatchCardAssignDialog.tsx:86:     setRows((current) => current.map((row) => row.employeeId === employeeId ? { ...row, cardNumber, status: undefined, message: undefined } : row));
src/components/employees/import/BatchCardAssignDialog.tsx:114:       {rows.length === 0 ? <p role="status">Seçili kişilerin hepsinde kart var.</p> : <>
src/components/employees/import/BatchCardAssignDialog.tsx:125:           <div><Input aria-invalid={row.status === "error"} aria-describedby={row.message ? `batch-card-${row.employeeId}-message` : undefined} aria-label={`${row.employeeName} kart numarası`} value={row.cardNumber} disabled={busy || row.status === "assigned"} onChange={(event) => updateCard(row.employeeId, event.target.value)} onPaste={(event) => { const pasted = event.clipboardData.getData("text"); if (pasted.includes("\n")) { event.preventDefault(); pasteCards(pasted); } }} />{row.message && <p id={`batch-card-${row.employeeId}-message`} className={row.status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{row.message}</p>}</div>
src/components/employees/import/BatchCardAssignDialog.tsx:127:         {message && <p role="status" className="text-sm">{message}</p>}
src/components/employees/import/BatchCardAssignDialog.tsx:128:         {saved && <p role="status">Atanan: {rows.filter((row) => row.status === "assigned").length} · Hatalı: {rows.filter((row) => row.status === "error").length}</p>}
src/components/employees/import/BatchCardAssignDialog.tsx:131:           <Button disabled={busy || rows.every((row) => !row.cardNumber.trim() || row.status === "assigned")} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Kaydet"}</Button>
```

</details>

<details><summary>src/components/employees/import/DevicePersonImportDialog.tsx</summary>

```text
src/components/employees/import/DevicePersonImportDialog.tsx:182:     {!connected && <p role="status" className="text-sm text-warning">Cihaz çevrimdışı — aktarım yapılamaz</p>}
src/components/employees/import/DevicePersonImportDialog.tsx:190:               <p role="status" className="text-sm">
src/components/employees/import/DevicePersonImportDialog.tsx:203:                 <p role="status" className="text-sm text-warning">
src/components/employees/import/DevicePersonImportDialog.tsx:235:                     <TableHead columnId="status">Durum</TableHead>
src/components/employees/import/DevicePersonImportDialog.tsx:279:                           tone={statuses[row.status].tone}
src/components/employees/import/DevicePersonImportDialog.tsx:281:                           {statuses[row.status].label}
src/components/employees/import/DevicePersonImportDialog.tsx:283:                         {row.status === "matched" && isSelectablePerson(row) && (
src/components/employees/import/DevicePersonImportDialog.tsx:307:                 <p role="status" className="text-sm text-warning">Bu projede biyometri modülü kapalı; parmak izleri aktarılmaz (Ayarlar → Gizlilik)</p>
```

</details>

<details><summary>src/components/employees/import/EmployeeImportDialog.tsx</summary>

```text
src/components/employees/import/EmployeeImportDialog.tsx:83:   const validCount = results.filter((result) => result.status === "created").length;
src/components/employees/import/EmployeeImportDialog.tsx:84:   const duplicateCount = results.filter((result) => result.status === "skippedDuplicate").length;
src/components/employees/import/EmployeeImportDialog.tsx:85:   const errorResults = results.filter((result) => result.status === "error");
src/components/employees/import/EmployeeImportDialog.tsx:93:       {stage === "file" && <div className="space-y-3"><Input aria-label="Excel dosyası seç" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} />{busy && <p role="status">Dosya kontrol ediliyor ve önizleme hazırlanıyor…</p>}</div>}
src/components/employees/import/EmployeeImportDialog.tsx:101:         <p>{results.filter((result) => result.status === "created" && result.message === "Kişi oluşturuldu").length} kişi oluşturuldu · {duplicateCount} yinelenen · {errorResults.length} hatalı{wasCancelled ? " · İptal edildi" : ""}</p>
src/components/employees/import/EmployeeImportDialog.tsx:103:         {!canResync && <p role="status">Kişiler cihazlara otomatik gönderilecek</p>}
src/components/employees/import/EmployeeImportDialog.tsx:104:         {syncMessage && <p role="status" className="text-sm">{syncMessage}</p>}
```

</details>

<details><summary>src/components/live-monitoring/AssignReadingCardForm.tsx</summary>

```text
src/components/live-monitoring/AssignReadingCardForm.tsx:46:     {success ? <p role="status" className="text-xs">{success}</p> : <Button type="submit" disabled={pending || !selected || changed}>{pending ? "Atanıyor…" : "Atamayı onayla"}</Button>}
```

</details>

<details><summary>src/components/live-monitoring/LiveStatus.tsx</summary>

```text
src/components/live-monitoring/LiveStatus.tsx:11:     {live && <><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${connected ? "animate-pulse bg-success" : "bg-danger"}`} /><span role="status" className="font-medium text-foreground">{connected ? "Canlı" : "Bağlantı kesildi"}</span></>}
```

</details>

<details><summary>src/components/live-monitoring/MonitoringPersonPicker.tsx</summary>

```text
src/components/live-monitoring/MonitoringPersonPicker.tsx:26:   return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><ComboboxTrigger ref={buttonRef} placeholder={!selected && !allowClear} id={id} aria-label={id ? undefined : "Kişi"} aria-expanded={open} disabled={disabled}>{selected ? `${selected.firstName} ${selected.lastName}` : allowClear ? "Tüm kişiler" : "Bir kişi seçin"}</ComboboxTrigger></PopoverTrigger><PopoverContent className={COMBOBOX_CONTENT_CLASS}><Command shouldFilter={false}><CommandInput value={search} onValueChange={setSearch} placeholder="Ad veya soyad ara…" aria-label="Projede kişi ara" /><CommandList>{people === undefined || term !== search ? <p role="status" className="py-6 text-center text-sm">Aranıyor…</p> : people.length === 0 ? <p role="status" className="py-6 text-center text-sm">Kişi bulunamadı</p> : null}
src/components/live-monitoring/MonitoringPersonPicker.tsx:28:     {term === search && people?.map(person => <CommandItem key={person._id} disabled={!allowClear && person.isActive === false} value={person._id} onSelect={() => { onChange(person); setOpen(false); }}>{person.firstName} {person.lastName}{person.isActive === false ? " · Pasif" : ""}{value === person._id && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>)}
```

</details>

<details><summary>src/components/live-monitoring/lib/assignment.ts</summary>

```text
src/components/live-monitoring/lib/assignment.ts:6: export function assignmentValidation(values: Assignment, selected: { cardNumber: string; isActive?: boolean } | undefined, cardNo: string) {
src/components/live-monitoring/lib/assignment.ts:8:   if (selected.isActive === false) return "Pasif kişiye kart atanamaz";
```

</details>

<details><summary>src/components/live-monitoring/useLiveReadings.ts</summary>

```text
src/components/live-monitoring/useLiveReadings.ts:9:   const [state, dispatch] = useReducer(feedReducer<Reading>, undefined, initialFeed<Reading>);
src/components/live-monitoring/useLiveReadings.ts:12:   const response = useQuery(api.cardReadings.listLiveSince, enabled ? { projectId, source: source === "all" ? undefined : source, limit: LIVE_LIMIT, afterCreationTime: state.watermark } : "skip");
src/components/live-monitoring/useLiveReadings.ts:19:   useEffect(() => { if (state.reloadRequired) reload(); }, [state.reloadRequired, reload]);
src/components/live-monitoring/useLiveReadings.ts:21:   return { rows: state.rows, initialized: state.initialized, truncated: state.truncated, day, loading: !state.initialized };
```

</details>

<details><summary>src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx</summary>

```text
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:43:   state: { error: string | null } = { error: null };
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:48:     if (!this.state.error) return this.props.children;
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:50:       this.state.error,
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:148:             { key: "raw", label: "Brüt süre", value: displayDuration(day.rawTotalMinutes ?? day.totalMinutes, day.status, day.durationMeasured) },
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:149:             { key: "total", label: "Toplam süre (mola sonrası)", value: displayDuration(day.totalMinutes, day.status, day.durationMeasured) },
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:150:             { key: "overtime", label: "Fazla mesai", value: displayDuration(day.overtimeMinutes, day.status, day.durationMeasured) },
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:151:             { key: "night", label: "Gece süresi", value: displayDuration(day.nightMinutes ?? 0, day.status, day.durationMeasured) },
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:215:           {canManage && day.status !== "future" && (
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:218:           {editing === day.date && day.status !== "future" && (
```

</details>

<details><summary>src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx</summary>

```text
src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:225:             <div role="status" className="border-y py-3 text-sm">
```

</details>

<details><summary>src/components/pdks/lib/presentation.ts</summary>

```text
src/components/pdks/lib/presentation.ts:10: export type PdksPlanDay = Pick<PdksCell, "segments" | "planKind" | "status">;
src/components/pdks/lib/presentation.ts:40: export function segmentDecisionLabel(segment: PdksSegment, status: PdksPlanDay["status"]): string {
src/components/pdks/lib/presentation.ts:42:     if (status === "future") return "Bekleniyor";
src/components/pdks/lib/presentation.ts:43:     if (status === "leave" || status === "holiday" || status === "weekend") return "—";
src/components/pdks/lib/presentation.ts:54:   | "status";
src/components/pdks/lib/presentation.ts:61: export function displayDuration(minutes: number, status: PdksCell["status"], durationMeasured?: boolean): string {
src/components/pdks/lib/presentation.ts:63:   return minutes === 0 && status !== "present" && status !== "late" || status === "future" || status === "noData" || status === "notEmployed" ? "—" : formatDuration(minutes);
src/components/pdks/lib/presentation.ts:90: export function reviewHint(item: { noShift?: boolean; status: string; punchQuality?: string; durationMeasured?: boolean } | undefined): string {
src/components/pdks/lib/presentation.ts:91:   if (!item || item.noShift || (item.status !== "incomplete" && item.durationMeasured !== false)) return "";
src/components/pdks/lib/presentation.ts:113:       key === "status" ? statusMetaFor(a).label : a[key]
src/components/pdks/lib/presentation.ts:115:       key === "status" ? statusMetaFor(b).label : b[key],
src/components/pdks/lib/presentation.ts:126:   const status = cell?.status ?? "noData";
src/components/pdks/lib/presentation.ts:128:     cell?.durationMeasured === false ? "Süre hesaplanamadı" : status === "future" || status === "noData" || status === "notEmployed"
src/components/pdks/lib/presentation.ts:131:   return `${name}, ${readableDate(date)}, ${statusMetaFor(cell ?? { status }).label}, ${duration}${reviewHint(cell) ? `, ${reviewHint(cell)}` : ""}${planDayLabel(cell) ? `, ${planDayLabel(cell)}` : ""}${cell?.segments && cell.segments.length > 1 ? `, ${cell.segments.length} vardiya, ${segmentTimeRange(cell.segments)}` : ""}`;
src/components/pdks/lib/presentation.ts:136:       day.status === "future" || day.status === "noData" || day.status === "notEmployed"
src/components/pdks/lib/presentation.ts:167:   status: "all" | keyof typeof STATUS_META | undefined,
src/components/pdks/lib/presentation.ts:169:   if (!status || status === "all") return rows;
src/components/pdks/lib/presentation.ts:172:     if (status === "overtime")
src/components/pdks/lib/presentation.ts:177:               day.status !== "future" &&
src/components/pdks/lib/presentation.ts:178:               day.status !== "noData",
src/components/pdks/lib/presentation.ts:182:       ? row.days.some((day) => !day.noShift && day.status === status)
src/components/pdks/lib/presentation.ts:183:       : row.status === status;
```

</details>

<details><summary>src/components/reports/ReportResults.tsx</summary>

```text
src/components/reports/ReportResults.tsx:32:   const [state, setState] = useState<{ data?: PdksTableData; error?: unknown }>({});
src/components/reports/ReportResults.tsx:42:   if (state.error !== undefined) throw state.error;
src/components/reports/ReportResults.tsx:43:   return state.data;
```

</details>

<details><summary>src/components/settings/sections/privacy/BiometricDestructionCard.tsx</summary>

```text
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:20: export function destructionStatusLabel(run: { status: string; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number }): string {
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:21:   if (run.status === "running") return "İmha sürüyor";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:22:   if (run.status === "waitingDevices") return "Cihaz onayı bekleniyor";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:23:   if (run.status === "failed") return "İşlem kesildi";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:77:   const active = latestRun?.status === "running" || latestRun?.status === "waitingDevices";
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:97:     {module.enabled && <p className="text-sm text-warning" role="status">Biyometri modülü açık. Devam etmek için önce modülü kapatın.</p>}
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:106:     {preview && <div className="space-y-2 text-sm" role="status">
src/components/settings/sections/privacy/BiometricDestructionCard.tsx:120:         <StatusBadge className="max-w-full whitespace-normal break-words" tone={latestRun.status === "failed" || latestRun.deviceFailures || latestRun.deviceUnconfirmed ? "warning" : active ? "info" : "neutral"}>
```

</details>

<details><summary>src/components/sync/SyncIssuesBanner.tsx</summary>

```text
src/components/sync/SyncIssuesBanner.tsx:199:         const count = results.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value.count : 0), 0);
src/components/sync/SyncIssuesBanner.tsx:200:         const failure = results.find((result) => result.status === "rejected");
src/components/sync/SyncIssuesBanner.tsx:201:         if (failure?.status === "rejected") throw new Error(`${count} uyarı kapatıldı; kalan uyarılar kapatılamadı. ${errorMessage(failure.reason)}`);
src/components/sync/SyncIssuesBanner.tsx:202:         notify.success(`${count} uyarı kapatıldı`, results.some((result) => result.status === "fulfilled" && result.value.hasMore) ? "Kapsamda başka uyarılar var." : undefined);
```

</details>

<details><summary>src/components/visitors/VisitorCardCapture.tsx</summary>

```text
src/components/visitors/VisitorCardCapture.tsx:157:             <StatusBadge tone="success" role="status">
src/components/visitors/VisitorCardCapture.tsx:162:             <span role="status" className="flex items-center gap-1.5 text-muted-foreground">
src/components/visitors/VisitorCardCapture.tsx:166:           ) : <span role="status" className="text-muted-foreground">{captureError ?? (starting ? "Okuma başlatılıyor…" : timedOut ? "30 saniyede kart okunmadı. Okuyucuyu kontrol edin veya numarayı elle girin." : "Dinleme kapalı")}</span>}
```

</details>

<details><summary>src/components/visitors/VisitorForm.tsx</summary>

```text
src/components/visitors/VisitorForm.tsx:24:     const result = visitorFormSchema.safeParse({ ...formData, isEditing: !!visitor, isPreRegistration, originalExpiry: visitor ? isoToLocalInput(visitor.visitEnd ?? "") : undefined, wasActive: visitor?.isActive });
src/components/visitors/VisitorForm.tsx:43:         <VisitorFormFields formData={formData} setFormData={setFormData} assignedDoors={visitor?.presetRuleName} hostEmployees={hostEmployees} hostSearch={hostSearch} onHostSearchChange={setHostSearch} hostsLoading={hostsLoading} isCurrentlyActive={visitor?.isActive === true} isEditing={!!visitor} isPreRegistration={isPreRegistration} kvkkConsentAt={visitor?.kvkkConsent?.grantedAt} errors={fieldErrors} />
src/components/visitors/VisitorForm.tsx:46:       <FormActions isLoading={isLoading} onClose={onClose} busyLabel="Kaydediliyor…" submitLabel={isPreRegistration && formData.isActive ? "Erişimi etkinleştir" : visitor ? "Değişiklikleri kaydet" : "Ziyaretçiyi kaydet"} />
```

</details>

<details><summary>src/components/visitors/VisitorFormFields.tsx</summary>

```text
src/components/visitors/VisitorFormFields.tsx:45:     {isCurrentlyActive ? <p className="text-sm text-muted-foreground">Erişimi kapatmak için ayrıntıdaki 'Ziyareti sonlandır'ı kullanın.</p> : <div className="flex items-center gap-2"><Checkbox id="v_active" checked={formData.isActive} onCheckedChange={checked => change("isActive", checked === true)} /><Label htmlFor="v_active">Erişim izni ver</Label></div>}<p className="text-xs text-muted-foreground">Erişim geçerlilik bitişiyle sınırlıdır; süresi dolan kayıt aktif sayılmaz.</p>
```

</details>

<details><summary>src/components/visitors/VisitorSlideOverPanel.tsx</summary>

```text
src/components/visitors/VisitorSlideOverPanel.tsx:17: import { displayVisitorStatus, visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
src/components/visitors/VisitorSlideOverPanel.tsx:65:   const status = visitorStatusInfo[displayVisitorStatus(detail, now)];
src/components/visitors/VisitorSlideOverPanel.tsx:78:     <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={status.tone}>{status.label}</StatusBadge>{canManage && <Button variant="outline" onClick={onEdit}>{canAssignVisitorPreset(detail) ? "Kart ve erişim ata" : "Düzenle"}</Button>}</div>
src/components/visitors/VisitorSlideOverPanel.tsx:97:       {detail.isActive && <Button variant="outline" onClick={() => setConfirmation("checkout")}>Ziyareti sonlandır</Button>}
src/components/visitors/VisitorSlideOverPanel.tsx:99:         {!detail.isActive && !detail.cardReleased && !needsCard && <DropdownMenuItem onSelect={() => setConfirmation("release")}>Kartı serbest bırak</DropdownMenuItem>}
```

</details>

<details><summary>src/components/visitors/VisitorTable.tsx</summary>

```text
src/components/visitors/VisitorTable.tsx:10: import { visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
src/components/visitors/VisitorTable.tsx:17:   const badge = (visitor: Visitor) => <StatusBadge tone={visitorStatusInfo[visitor.status].tone}>{visitorStatusInfo[visitor.status].label}</StatusBadge>;
src/components/visitors/VisitorTable.tsx:29:       </TableRow></TableHeader><TableBody>{loading ? <TableStateRow colSpan={7} state="loading" label="Ziyaretçiler yükleniyor" /> : !visitors.length ? <TableStateRow colSpan={7} state="custom">{emptyState}</TableStateRow> : visitors.map(visitor => <TableRow key={visitor._id} className={ROW_CLICK_CLASS} onClick={onRowActivate(() => onOpen(visitor))}>
```

</details>

<details><summary>src/components/visitors/hooks/useVisitorFormData.ts</summary>

```text
src/components/visitors/hooks/useVisitorFormData.ts:22:   isActive: boolean;
src/components/visitors/hooks/useVisitorFormData.ts:40:   isActive: true,
src/components/visitors/hooks/useVisitorFormData.ts:68:     name: `${e.firstName} ${e.lastName}${e.isActive ? "" : " (Pasif)"}`,
src/components/visitors/hooks/useVisitorFormData.ts:91:         isActive: visitor.isActive ?? true,
```

</details>

<details><summary>src/components/visitors/hooks/useVisitorFormSchema.ts</summary>

```text
src/components/visitors/hooks/useVisitorFormSchema.ts:9:   isActive: z.boolean().optional(),
src/components/visitors/hooks/useVisitorFormSchema.ts:18:   if (!data.isEditing || data.accessExpiresAt !== data.originalExpiry || (data.isActive && !data.wasActive)) {
src/components/visitors/hooks/useVisitorFormSchema.ts:22:   if (((!data.isEditing || data.isPreRegistration || data.isActive !== false) && !data.cardNumber) || isVisitorCardPlaceholder(data.cardNumber)) {
```

</details>

<details><summary>src/components/visitors/lib/formPayload.ts</summary>

```text
src/components/visitors/lib/formPayload.ts:14:   const parsed = visitorFormSchema.parse({ ...formData, isEditing: !!visitor, isPreRegistration, originalExpiry, wasActive: visitor?.isActive });
src/components/visitors/lib/formPayload.ts:15:   const shared = { firstName: parsed.firstName, lastName: parsed.lastName, isActive: visitor?.isActive === true ? true : formData.isActive, kvkkConsent: formData.kvkkConsent, kvkkDocumentVersion: formData.kvkkDocumentVersion };
```

</details>

<details><summary>src/hooks/access-rules/useComplexAccessRuleMutations.ts</summary>

```text
src/hooks/access-rules/useComplexAccessRuleMutations.ts:39:     isActive?: boolean;
```

</details>

<details><summary>src/hooks/useDeviceFilters.tsx</summary>

```text
src/hooks/useDeviceFilters.tsx:12:   const { search, status: statusFilter, type: typeFilter } = readDeviceFilters(params);
src/hooks/useDeviceFilters.tsx:14:   const setStatusFilter = (status: string) => setParams(current => writeDeviceFilters(current, { status }));
src/hooks/useDeviceFilters.tsx:16:   const clearFilters = () => setParams(current => writeDeviceFilters(current, { search: '', status: 'all', type: 'all', zoneId: null, doorId: null }));
src/hooks/useDeviceFilters.tsx:27:     search, status: statusFilter, type: typeFilter, zoneId: selectedZoneId, doorId: selectedDoorId,
```

</details>

<details><summary>src/hooks/useDeviceTable.tsx</summary>

```text
src/hooks/useDeviceTable.tsx:16:   const failed = targets.filter((_, index) => results[index].status === "rejected");
```

</details>

<details><summary>src/hooks/useDevices.ts</summary>

```text
src/hooks/useDevices.ts:30:     let computedStatus: Device["status"] = "offline";
src/hooks/useDevices.ts:34:     return { ...dev, status: computedStatus };
src/hooks/useDevices.ts:48:         isActive: deviceData.isActive ?? true,
src/hooks/useDevices.ts:69:         isActive: updates.isActive,
```

</details>

<details><summary>src/lib/pdksSummary.ts</summary>

```text
src/lib/pdksSummary.ts:6:   "status" | "overtimeHours" | "days"
src/lib/pdksSummary.ts:38:           day.status === "future" ||
src/lib/pdksSummary.ts:39:           day.status === "noData"
src/lib/pdksSummary.ts:44:           day.status === "present" ||
src/lib/pdksSummary.ts:45:           day.status === "late" ||
src/lib/pdksSummary.ts:46:           day.status === "absent" ||
src/lib/pdksSummary.ts:47:           day.status === "leave"
src/lib/pdksSummary.ts:49:           summary[day.status] += 1;
src/lib/pdksSummary.ts:52:       if (record.status === "future" || record.status === "noData") continue;
src/lib/pdksSummary.ts:54:         record.status === "present" ||
src/lib/pdksSummary.ts:55:         record.status === "late" ||
src/lib/pdksSummary.ts:56:         record.status === "absent" ||
src/lib/pdksSummary.ts:57:         record.status === "leave"
src/lib/pdksSummary.ts:59:         summary[record.status] += 1;
```

</details>

<details><summary>src/lib/reports/rows.ts</summary>

```text
src/lib/reports/rows.ts:26:   devamsizlar: cell => cell.status === 'absent',
src/lib/reports/rows.ts:30:   istisnalar: cell => (cell.detail?.dayType === 'workday' && (cell.isLate || cell.detail.isEarlyExit)) || cell.status === 'absent' || flexibleShortfall(cell) > 0,
src/lib/reports/rows.ts:40:   return rows.flatMap(row => row.days.filter(cell => cell.status !== 'future' && cell.status !== 'noData' && predicate(cell)).map(cell => ({
src/lib/reports/rows.ts:50:     if (cell.status === 'future' || cell.status === 'noData') continue;
src/lib/reports/rows.ts:52:     if (cell.status === 'incomplete') { counts.incompleteDays = (counts.incompleteDays ?? 0) + 1; continue; }
src/lib/reports/rows.ts:106:   if (cell.status === 'absent') parts.push('Devamsız');
src/lib/reports/rows.ts:109:   if (cell.status !== 'absent' && flexibleShortfall(cell) > 0) parts.push(`Eksik ${flexibleShortfall(cell)} dk`);
```

</details>

<details><summary>src/lib/reports/testFixtures.ts</summary>

```text
src/lib/reports/testFixtures.ts:5:   return { date: '2026-10-19', firstEntry: '09:05', lastExit: '18:00', totalMinutes: 535, status: 'present', leaveType: null, isLate: false, lateMinutes: 0, payrollCode: 'N', overtimeMinutes: 0, detail: { dayType: 'workday', shiftName: null, plannedStart: '09:00', plannedEnd: '18:00', isEarlyExit: false, earlyExitMinutes: 0, readingCount: 0, isManual: false, punches: [], plannedBreakStart: null, plannedBreakEnd: null, breakViolation: false }, ...overrides };
src/lib/reports/testFixtures.ts:8:   return { excludedUnknownReadings: 0, id: 'employee-a', name: 'Ayşe Yılmaz', employeeId: '123', cardNumber: '123', payrollCode: 'N', payrollEmployeeCode: 'P01', department: 'Üretim', firstEntry: '09:05', lastExit: '18:00', totalHours: '8 sa 55 dk', totalMinutes: 535, overtimeMinutes: 0, overtime: '0m', overtimeHours: 0, overtimeMultiplier: 1, overtimePayTRY: null, hourlyRate: null, yearlyOvertimeLimit: 270, leaveType: '-', status: 'present', isLate: false, isEarlyExit: false, isManual: false, manualNote: null, manualEditedBy: null, detailedLogs: [], days };
src/lib/reports/testFixtures.ts:12:     cells: [{ date: '2026-10-19', status: 'present', payrollCode: 'N', totalMinutes: 535, rawTotalMinutes: 535, nightMinutes: 0, overtimeMinutes: 0, multiplier: 0, overtimePayTRY: null, isLate: false, isEarlyExit: false, isManual: false, classification: 'workday' }],
```

</details>

<details><summary>src/lib/reports/transactions.ts</summary>

```text
src/lib/reports/transactions.ts:6: export function transactionReducer(state: TransactionSnapshots, action: TransactionAction): TransactionSnapshots {
src/lib/reports/transactions.ts:8:   return { pages: { ...state.pages, [action.cursor ?? 'first']: action.page } };
src/lib/reports/transactions.ts:10: export function transactionSnapshot(state: TransactionSnapshots, cursor: string | null, current?: TransactionPage): {
src/lib/reports/transactions.ts:13:   const pages = current ? transactionReducer(state, { type: 'page', cursor, page: current }).pages : state.pages;
```

</details>

<details><summary>src/pages/Alarms.tsx</summary>

```text
src/pages/Alarms.tsx:96:   const { status } = filters;
src/pages/Alarms.tsx:110:     {canManage && status !== "acked" && <BulkBar count={selected.length} onClear={() => setSelected([])}><Button onClick={() => void acknowledgeRows(selected)}>Seçilenleri onayla ({selected.length})</Button></BulkBar>}
src/pages/Alarms.tsx:142:   const { results, status: pageStatus, loadMore } = usePaginatedQuery(api.alarms.list,
src/pages/Alarms.tsx:145:     <Table framed scrollLabel="Alarm kayıtları" resizeKey="alarms" className="w-full text-left text-sm"><TableHeader className="bg-subtle"><TableRow>{canManage && <TableHead columnId="select" resizable={false} className="p-3">Seç</TableHead>}<TableHead columnId="time" className="p-3">Zaman</TableHead><TableHead columnId="device" className="p-3">Cihaz</TableHead><TableHead columnId="event" className="p-3">Olay</TableHead><TableHead columnId="severity" className="p-3">Önem</TableHead><TableHead columnId="status" className="p-3">Durum</TableHead>{isAdmin && <TableHead columnId="email" className="p-3">E-posta</TableHead>}{canManage && <TableHead columnId="actions" resizable={false} className="p-3">İşlem</TableHead>}</TableRow></TableHeader><TableBody>{loading || pageStatus === "LoadingFirstPage" ? <TableStateRow colSpan={5 + (canManage ? 2 : 0) + (isAdmin ? 1 : 0)} state="loading" label="Olaylar yükleniyor." /> : !results.length ? <TableStateRow colSpan={5 + (canManage ? 2 : 0) + (isAdmin ? 1 : 0)} state="empty" title={pageStatus === "CanLoadMore" ? "Daha fazla yükle" : "Olay bulunamadı"} description={pageStatus === "CanLoadMore" ? "Tarama sınırına ulaşıldı. Daha fazla olay için aşağıdaki düğmeyi kullanın." : "Seçili filtrelerde gösterilecek olay yok."} /> : results.map(row => <TableRow key={row._id} className="border-t border-line">{canManage && <TableCell className="p-3">{!row.ackedAt && <input aria-label={`${row.label} seç`} type="checkbox" disabled={selected.length >= 50 && !selected.includes(row._id)} checked={selected.includes(row._id)} onChange={event => setSelected(current => event.target.checked ? (current.includes(row._id) || current.length >= 50 ? current : [...current, row._id]) : current.filter(id => id !== row._id))} />}</TableCell>}<TableCell className="p-3">{new Date(row.eventTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</TableCell><TableCell className="p-3 truncate" title={row.deviceName}>{row.deviceName}</TableCell><TableCell className="p-3"><span className="block truncate" title={row.label}>{row.label}</span>{row.resolvedAt && <p className="text-xs text-muted-foreground">Bağlantı geri geldi · {new Date(row.resolvedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}{row.resolvedAt && <OfflineDuration offlineDurationMs={row.offlineDurationMs} />}</TableCell><TableCell className="p-3"><StatusBadge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "neutral"}>{row.severity === "critical" ? "Kritik" : row.severity === "warning" ? "Uyarı" : "Bilgi"}</StatusBadge></TableCell><TableCell className="p-3">{row.ackedAt ? `Onaylandı · ${new Date(row.ackedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}` : "İnceleme bekliyor"}</TableCell>{isAdmin && <TableCell className="p-3"><AlarmEmailStatus delivery={{ status: row.alarmEmailStatus, attempts: row.alarmEmailAttempts, at: row.alarmEmailAttemptAt ?? row.alarmQueuedAt, error: row.alarmEmailError, retryAt: row.alarmEmailRetryAt }} /></TableCell>}{canManage && <TableCell className="p-3">{!row.ackedAt && <AlarmAcknowledgeButton onAcknowledge={() => void acknowledgeRows([row._id])} />}</TableCell>}</TableRow>)}</TableBody></Table>
```

</details>

<details><summary>src/pages/Devices.tsx</summary>

```text
src/pages/Devices.tsx:53:   // Device panel state: device=null → sıfırdan yeni cihaz (marka seçici), device=X → düzenleme.
src/pages/Devices.tsx:189:         state={virtualReader}
```

</details>

<details><summary>src/types/access-control.ts</summary>

```text
src/types/access-control.ts:53:   status?: string;
src/types/access-control.ts:106:   isActive?: boolean;
src/types/access-control.ts:127:   isActive?: boolean;
```

</details>

<details><summary>src/types/device.ts</summary>

```text
src/types/device.ts:15:   status?: "online" | "offline" | "expired" | "active" | "inactive" | string;
src/types/device.ts:18:   isActive?: boolean;
src/types/device.ts:60:   isActive?: boolean;
src/types/device.ts:73:   status?: "online" | "offline" | "expired" | "active" | "inactive" | string;
src/types/device.ts:76:   isActive?: boolean;
```

</details>

## Bulgular

| ID | Şiddet | Makine | Başlık | Kanıt | Senaryo | Önerilen düzeltme |
|---|---|---|---|---|---|---|
| A-01 | critical | 23 | Windows olay kuyruğu kalıcı veri kaybediyor | bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:29,153; infra/hik-event-bridge/bridge.mjs:217 | Ağ kesintisinde 257. kart olayı en eski olayı düşürür; beş başarısız HTTP denemesi mevcut olayı atlar. Servis kapanınca bellek kuyruğu da kaybolur; kart geçmişi ve bununla hesaplanan PDKS eksik olur. Linux kuyruğu dolunca olay spool yazılmadan düşer. | Kalıcı disk kuyruğu ve onaydan sonra silme; taşmada kaynağı durdurma veya geri doldurma kanıtı. |
| A-02 | high | 23 | Windows köprüsünün roster protokolü backendden kaldırılmış | bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs:51,67; convex/http.ts:437,473 | Repo kaynaklarından derlenen köprü /hik-bridge/roster ve /roster-ack çağırır; backend yalnız cihaz tokenlı /poll ve /ack sunar. 404 sonrası panel listesi/claim gelmez; kuyruk pending kalır. Deployed binarynin sürümü doğrulanmadı; kaynak uyumsuzluğu kesin. | Windows istemcisini mevcut cihaz tokenlı protokole geçir; iki taraf sürüm sözleşmesini doğrula. |
| A-03 | high | 8 | Hik eski deneme ACKi yeni payloadı done yapabilir | convex/hikvisionSync.ts:477,621,664,684; convex/http.ts:464 | A opId X ve payload P1 processing iken dedupe X payloadını P2 yapıp pending açar. B X/P2yi yeniden claim eder; Adan geciken ACK yalnız X ve processing kontrolünden geçer, P2 başarısız olsa bile done ve grant effective yazılır. Aktif per-device poll/ack protokolü kullanan tüketicide mümkündür; repo Windows istemcisi önce A-02ye takılır. | Her claim için generation/attempt token üret; ACKde payload revizyonu ve token eşitliği zorunlu olsun. |
| A-04 | high | 9 | IDE normal ACKde msxId zorunlu değil | convex/http.ts:418; convex/ideSync.ts:610,613,622 | Mobil olmayan sent iş için yalnız opId+success içeren gecikmiş ACK kabul edilir. Dedupe aynı opIdyi yeni payloadla yeniden gönderdiğinde önceki yanıtta msxId yoksa yeni komut acked, roster güncel ve grant effective gösterilir; yeni işlem gerçekte henüz bitmemiş olabilir. | Her normal ACK için beklenen msxId tanımlı ve birebir eşit olmalı; eski protokolü açık sürüm kapısıyla reddet. |
| A-05 | high | 21 | Mobil kuyruk ve yarım gateway işlemi terminal saklama aşamasına hiç girmiyor | convex/mobileAccess.ts:27,166,182; convex/privacyRetention.ts:201,344 | IDE işlem 30 sn içinde acked olduğunda DTO confirmed döner ama mobileAccessOperations.status pending kalır; expireQueue terminal komuta bakıp unsent=false bırakır. Gateway sent sonrası action biterse satır sent kalır, DTO yalnız unknown türetir. Purge sadece confirmed/failed/unknown okuduğundan bu satırlar 30 gün sonra da tutulur; kuyruk satırı silinince eski başarılı DTO unknowna döner. IDE mobil özelliği env kapısı açıkken oluşur. | Sonucu kalıcı ve idempotent mutationla mobile satırına işle; stale pending/sent için yaş sınırına göre terminalleştir veya ayrı purge yolu ekle. |
| A-06 | medium | 4 | Kapı/okuyucu status değerleri serbest string | convex/schema.ts:315,383; convex/doors.ts:266; convex/readers.ts:172,183 | Yetkili API istemcisi status="actve" gönderir; schema ve update kabul eder. Mobil kapı kontrolü active dışını DOOR_INACTIVE sayar, arayüzün active/inactive seçim kümesi kayıtla ayrışır. | Schema ve mutationlarda active/inactive union kullan; mevcut bilinmeyen değerleri raporlayıp normalize et. |
| A-07 | low | 22 | Taşıma enumunda yazılmayan requested ve ide_panel değerleri | convex/schema.ts:514,515; convex/employeeTermination.ts:198; convex/lib/transferGuard.ts:10 | Mevcut başlatıcı employee/revoking yazar; requested ve ide_panel yalnız schema/okuma kontrolünde bulunur. Bu değerler için repo içinde başlangıç geçişi yok, gelecekteki kullanım niyeti belirsiz. | Rezerve değerleri açıkça belgele veya desteklenen akışla birlikte daralt. |
| A-08 | low | 7 | Bridge liveness ve claim sahipliği alanları artık yazılmıyor | convex/schema.ts:502,504,832; convex/hikvisionSync.ts:485; convex/hikBridge.ts:54 | Yeni bridge token kaydı oluşturulur fakat aktif HTTP yolları hikBridges.lastSeenAt/lastClientInfo güncellemez; claimedBy sadece temizlenir. Ayarlar son görülmeyi boş gösterir; schemadaki cross-bridge koruma yorumu aktif protokolde uygulanmaz. | Eski roster alanlarını kaldır veya yeni protokolde gerçek liveness/claim kimliği üret; dokümantasyonu eşitle. |

### A-01 — Windows olay kuyruğu kalıcı veri kaybediyor

**critical.** Ağ kesintisinde 257. kart olayı en eski olayı düşürür; beş başarısız HTTP denemesi mevcut olayı atlar. Servis kapanınca bellek kuyruğu da kaybolur; kart geçmişi ve bununla hesaplanan PDKS eksik olur. Linux kuyruğu dolunca olay spool yazılmadan düşer.

**Kanıt alıntıları:**

`bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:27`
```text
27:   private readonly Channel<CardReaderEventPayload> _cardEvents =
28:     Channel.CreateBounded<CardReaderEventPayload>(
29:       new BoundedChannelOptions(CardEventQueueCapacity) { FullMode = BoundedChannelFullMode.DropOldest });
```

`bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:153`
```text
156:               "[{Panel}] card event cardNo={Card} {Attempts} denemede gönderilemedi, atlanıyor",
157:               _panel.Name, ev.CardNo, CardEventMaxAttempts);
158:             break;
```

`infra/hik-event-bridge/bridge.mjs:217`
```text
217:     if (queued >= maxQueue) {
218:       log({ event: 'drop', reason: 'queue_full', ...summary });
219:       return false;
```

**Düzeltme:** Kalıcı disk kuyruğu ve onaydan sonra silme; taşmada kaynağı durdurma veya geri doldurma kanıtı.

### A-02 — Windows köprüsünün roster protokolü backendden kaldırılmış

**high.** Repo kaynaklarından derlenen köprü /hik-bridge/roster ve /roster-ack çağırır; backend yalnız cihaz tokenlı /poll ve /ack sunar. 404 sonrası panel listesi/claim gelmez; kuyruk pending kalır. Deployed binarynin sürümü doğrulanmadı; kaynak uyumsuzluğu kesin.

**Kanıt alıntıları:**

`bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs:51`
```text
51:     using var request = new HttpRequestMessage(HttpMethod.Post, "hik-bridge/roster");
52:     request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _bridgeToken);
53:     request.Content = JsonContent.Create(new { max = Math.Clamp(_pollMax, 1, 25) });
```

`bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs:67`
```text
67:     using var request = new HttpRequestMessage(HttpMethod.Post, "hik-bridge/roster-ack");
```

`convex/http.ts:473`
```text
473: // /hik-bridge/roster + /hik-bridge/roster-ack kaldırıldı (2026-10-19): 2026-06-19'dan kalan sahipsiz test köprüsü
474: // roster'ı 3 sn'de bir çağırıp Convex kotasını tüketiyordu. Köprü baştan yazılacak; yeni sürüm yeni bir yol kullanmalı.
```

**Düzeltme:** Windows istemcisini mevcut cihaz tokenlı protokole geçir; iki taraf sürüm sözleşmesini doğrula.

### A-03 — Hik eski deneme ACKi yeni payloadı done yapabilir

**high.** A opId X ve payload P1 processing iken dedupe X payloadını P2 yapıp pending açar. B X/P2yi yeniden claim eder; Adan geciken ACK yalnız X ve processing kontrolünden geçer, P2 başarısız olsa bile done ve grant effective yazılır. Aktif per-device poll/ack protokolü kullanan tüketicide mümkündür; repo Windows istemcisi önce A-02ye takılır.

**Kanıt alıntıları:**

`convex/hikvisionSync.ts:477`
```text
478:           projectId: args.projectId,
479:           payload: args.payload,
480:           status: "pending",
```

`convex/hikvisionSync.ts:621`
```text
622:           status: "processing",
623:           attemptCount: op.attemptCount + 1,
624:           processingStartedAt: now,
```

`convex/hikvisionSync.ts:683`
```text
684:     // A dedupe may have replaced the in-flight payload; let the bridge fetch it again.
685:     if (op.status !== "processing") return { ok: true };
686:     const deletion = op.operation === "deletePerson" || op.operation === "deleteCard";
```

`convex/http.ts:464`
```text
464:       const body = await readBridgeBody(request, z.object({ opId: z.string().min(1), ok: z.boolean(), message: z.string().nullable().optional() }));
```

**Düzeltme:** Her claim için generation/attempt token üret; ACKde payload revizyonu ve token eşitliği zorunlu olsun.

### A-04 — IDE normal ACKde msxId zorunlu değil

**high.** Mobil olmayan sent iş için yalnız opId+success içeren gecikmiş ACK kabul edilir. Dedupe aynı opIdyi yeni payloadla yeniden gönderdiğinde önceki yanıtta msxId yoksa yeni komut acked, roster güncel ve grant effective gösterilir; yeni işlem gerçekte henüz bitmemiş olabilir.

**Kanıt alıntıları:**

`convex/http.ts:418`
```text
418:       const body = await readBridgeBody(request, z.object({ opId: z.string().min(1), msxId: z.number().finite().optional(), result: z.string().optional(), message: z.string().optional(), errorCode: z.string().optional() }));
```

`convex/ideSync.ts:610`
```text
611:         (op.msxId === undefined || args.msxId === undefined || op.msxId !== args.msxId)) return;
612:     // Eski/yinelenen ack'i ele: beklenen msxId ile eşleşmeli (markSent her zaman msxId yazar).
613:     if (args.msxId != null && op.msxId != null && op.msxId !== args.msxId) return;
```

`convex/ideSync.ts:622`
```text
622:       await ctx.db.patch(args.opId, {
623:         status: "acked",
624:         ackedAt: Date.now(),
```

**Düzeltme:** Her normal ACK için beklenen msxId tanımlı ve birebir eşit olmalı; eski protokolü açık sürüm kapısıyla reddet.

### A-05 — Mobil kuyruk ve yarım gateway işlemi terminal saklama aşamasına hiç girmiyor

**high.** IDE işlem 30 sn içinde acked olduğunda DTO confirmed döner ama mobileAccessOperations.status pending kalır; expireQueue terminal komuta bakıp unsent=false bırakır. Gateway sent sonrası action biterse satır sent kalır, DTO yalnız unknown türetir. Purge sadece confirmed/failed/unknown okuduğundan bu satırlar 30 gün sonra da tutulur; kuyruk satırı silinince eski başarılı DTO unknowna döner. IDE mobil özelliği env kapısı açıkken oluşur.

**Kanıt alıntıları:**

`convex/mobileAccess.ts:31`
```text
33:     status = !command ? "unknown" : command.status === "acked" ? "confirmed"
34:       : command.status === "failed" ? command.attempts > 0 ? "unknown" : "failed"
35:       : command.status;
```

`convex/mobileAccess.ts:168`
```text
171:         await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
172:         unsent = true;
173:       }
```

`convex/mobileAccess.ts:182`
```text
182:     if (unsent) await ctx.db.patch(row._id, { status: "failed", errorCode: "COMMAND_EXPIRED" });
```

`convex/privacyRetention.ts:343`
```text
343:     const status = value === "confirmed" || value === "unknown" ? value : "failed";
344:     const page = await ctx.db.query("mobileAccessOperations").withIndex("by_status_and_requestedAt", q => q.eq("status", status).lt("requestedAt", isoCutoff(args, MOBILE_OPERATION_RETENTION_DAYS))).paginate(opts(args));
345:     for (const row of page.page) await ctx.db.delete(row._id);
```

**Düzeltme:** Sonucu kalıcı ve idempotent mutationla mobile satırına işle; stale pending/sent için yaş sınırına göre terminalleştir veya ayrı purge yolu ekle.

### A-06 — Kapı/okuyucu status değerleri serbest string

**medium.** Yetkili API istemcisi status="actve" gönderir; schema ve update kabul eder. Mobil kapı kontrolü active dışını DOOR_INACTIVE sayar, arayüzün active/inactive seçim kümesi kayıtla ayrışır.

**Kanıt alıntıları:**

`convex/doors.ts:266`
```text
266:     status: v.optional(v.string()),
```

`convex/readers.ts:172`
```text
172:     status: v.optional(v.string()),
```

`convex/lib/mobileAccess.ts:131`
```text
131:       const reason = device.isActive === false ? "DEVICE_INACTIVE"
132:         : door?.status && door.status !== "active" ? "DOOR_INACTIVE"
133:         : !employeeWithinAccessEpoch(employee, now) ? "ACCESS_EPOCH_DENIED"
```

**Düzeltme:** Schema ve mutationlarda active/inactive union kullan; mevcut bilinmeyen değerleri raporlayıp normalize et.

### A-07 — Taşıma enumunda yazılmayan requested ve ide_panel değerleri

**low.** Mevcut başlatıcı employee/revoking yazar; requested ve ide_panel yalnız schema/okuma kontrolünde bulunur. Bu değerler için repo içinde başlangıç geçişi yok, gelecekteki kullanım niyeti belirsiz.

**Kanıt alıntıları:**

`convex/schema.ts:514`
```text
514:     kind: v.union(v.literal("employee"), v.literal("ide_panel")),
515:     status: v.union(v.literal("requested"), v.literal("revoking"), v.literal("revoked"), v.literal("provisioning"), v.literal("done"), v.literal("stuck"), v.literal("cancelled")),
```

`convex/employeeTermination.ts:197`
```text
197:     const transferId = await ctx.db.insert("accessTransfers", {
198:       kind: "employee", status: "revoking", sourceProjectId: employee.projectId, targetProjectId: args.targetProjectId,
199:       employeeId: employee._id, targetEmployeeId, cardNumber: employee.cardNumber,
```

**Düzeltme:** Rezerve değerleri açıkça belgele veya desteklenen akışla birlikte daralt.

### A-08 — Bridge liveness ve claim sahipliği alanları artık yazılmıyor

**low.** Yeni bridge token kaydı oluşturulur fakat aktif HTTP yolları hikBridges.lastSeenAt/lastClientInfo güncellemez; claimedBy sadece temizlenir. Ayarlar son görülmeyi boş gösterir; schemadaki cross-bridge koruma yorumu aktif protokolde uygulanmaz.

**Kanıt alıntıları:**

`convex/schema.ts:502`
```text
502:     lastSeenAt: v.optional(v.number()),
503:     /** Son roster çağrısının User-Agent'ı (köprü sürümü + makine adı; ≤200 karakter). */
504:     lastClientInfo: v.optional(v.string()),
```

`convex/hikvisionSync.ts:483`
```text
483:           processingStartedAt: undefined,
484:           completedAt: undefined,
485:           claimedBy: undefined,
```

**Düzeltme:** Eski roster alanlarını kaldır veya yeni protokolde gerçek liveness/claim kimliği üret; dokümantasyonu eşitle.

### Sınırlar ve doğrulama kaydı

Bu raporda action içindeki dış çağrıların cihaz tarafı atomikliği veya daemon sürümü denenmedi. Statik kaynakta gösterilen koşullar yeterli olmadığı yerde sonuç kesin güvenlik ihlali diye yükseltilmedi. Örneğin kapı planı paralel gönderimi şüpheli olarak ayrı not edildi; critical sayısına eklenmedi.

Başlangıç `git diff --stat | tail -1`: `211 files changed, 4049 insertions(+), 2058 deletions(-)`. Bu görev yalnız bu rapor yoluna yazdı; diğer değişiklikler eşzamanlı oturumlara aittir. Son kontrolde `git diff --stat | tail -1` yine `211 files changed, 4049 insertions(+), 2058 deletions(-)` döndü; mevcut tracked değişiklik özeti aynı kaldı. `git status --short docs/audits/2026-11-14-implicit-state-machines/device-sync.md` yalnız `?? docs/audits/2026-11-14-implicit-state-machines/device-sync.md` döndü. Untracked rapor diff stat toplamına katılmaz; bu karşılaştırma tek başına başka oturumların hiçbir dosya değiştirmediği iddiası değildir, kendi tek yazım hedefim bu rapordur.
