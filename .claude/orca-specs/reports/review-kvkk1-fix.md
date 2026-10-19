# Yeniden denetim — KVKK Faz 1 düzeltme turu (salt-okuma, 2026-10-19)

**Canlıya hazır: EVET (koşullu).** Düzeltmelerde KRİTİK ya da YÜKSEK regresyon yok. Y1-Y3, O1-O5 ve FE YÜKSEK-1/2 kapandı. Önceki denetimlerin kaçırdığı, bu turdan önce de var olan bir YÜKSEK yetki açığı var (`requireEmployeeAccess`, aşağıda Y-A). Deploy bu açığı büyütmüyor ama ayrı ve öncelikli düzeltilmeli. İki ORTA bulgu da tutanak doğruluğuyla ilgili.

## Kapılar (kendim koştum)
| Komut | Sonuç |
|---|---|
| `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` | exit 0, hata yok |
| `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | exit 0, 0 satır (demo/landing filtresine de gerek kalmadı) |
| `node_modules/.bin/eslint convex src/components/settings src/components/employees/EmployeeConsentsCard.tsx` | exit 0, 0 hata / 0 uyarı |
| `npx vitest run` | 126 dosya, 1273/1273 geçti |

Doğrulanamayanlar: tarayıcıda 1440/390 görsel tur, gerçek cihaz/köprü davranışı, canlı veride projesiz şablon ya da eski (<1825) saklama satırı olup olmadığı, önceki imha sürümünün canlıya deploy edilip edilmediği. Dosyalar untracked (`??`); memory'ye göre KVKK Faz 1 henüz deploy edilmedi.

## Önceki bulgular — durum tablosu
| Bulgu | Durum | Kanıt |
|---|---|---|
| Y1 self-signup biyometri açık | **kapandı** | `convex/onboarding.ts:56-58`, `:146-148`: insert ile aynı mutation'da `biometricEnabled:false` + audit (aktör: kullanıcı / secret yolunda `null`). Proje oluşturan diğer yollar yalnız seed dosyaları (`grep 'insert("projects"'`). |
| Y2 şablon başına poll zinciri | **kapandı** | Tarama sırasında kontrol planlanmıyor (`finishBatch` yalnız `pendingOpIds` biriktiriyor, `convex/biometricDestruction.ts:273-276`). Tek zincir tarama bitince başlıyor (`:128-132`). `attempt` eşitliği ikinci zinciri engelliyor (`:287`). Köprü çevrimdışıysa tek çağrıda bitiyor. Bağlı ama yanıtsız cihazda 30 sn → 5 dk → 5 dk → 30 dk aralığıyla 24 saatte ~51 çağrı; bu sayı şablon sayısından bağımsız. Run `completed` olunca zincir duruyor (`:287` status kontrolü). `watchRun` yalnız `running` durumundayken yeniden planlıyor. Kalan maliyet: tarama sırasındaki action/mutation sayısı hâlâ şablon × cihaz ile büyüyor (worker raporunda da yazıyor). |
| Y3 eski istemcide asistan kırık | **kapandı** | `convex/actions/openaiChat.ts:61-69`: tek proje → o proje, 0 ya da çoklu → dış çağrı yok. `forceMaskNames` yalnız `internalQuery` argümanı (`convex/privacyRetention.ts:60-61`), istemci bunu veremez. Proje izni yine `requireProject` ile kontrol ediliyor. Süper admin'de `getProjectIdsForUser` tüm projeleri döner; birden çok proje varsa dış çağrı yapılmaz, tek proje varsa erişimi zaten var. İstemcinin `dbContext` değeri kullanılmıyor. |
| O1 kullanıcı tablosu maskeli | **kapandı** | `getChatData.ts`'te `mask` geçmiyor; maskeleme yalnız `getAssistantContext`'te. |
| O2 projesiz şablon imhada yok | **kapandı** | Ayrıntı ve sınırlar aşağıda (O2 doğrulaması). |
| O3 capture kapısız | **kapandı** | Kapı (`convex/actions/hikGatewayDevice.ts:953`) `captureFaceOnDevice` dış çağrısından önce çalışıyor. Ayrıntı için D-6. |
| O4 audit şişmesi | **kapandı** | Run başına 3 satır: durum + başladı (`biometricDestruction.ts:89,92`) ve bitiş/hata (`:40-41`, yalnız terminal durumda). Cihaz özeti tutanak satırında (`destructionReport`). Enqueue ve gateway audit'leri kaldırıldı. Durum satırı yine de her şablonda patch'leniyor (bkz. D-4). |
| O5 saklama alt sınırı | **kapandı** | `MIN/MAX` 1825/3650 (`convex/lib/privacySettings.ts:23-24`). Doğrulama, mutation metni, UI zod şeması, input ve testler tutarlı. Eski geçersiz değeri dağıtıcı atlıyor (`privacyRetention.ts:81`), `retentionCutoff` de throw ediyor (`cardReadingRetention.ts:14`); silme olmuyor. |
| D1 engellenen bridge op temizlenmiyor | **kapandı** | `hikvisionSync.ts:562` `attemptCount:5`. `cleanupStaleSyncIssues` 24 saat sonra bunları kapatıyor (`:939`). Otomatik retry `attemptCount<max` koşuluyla bu op'ları almıyor (`:736`). Elle retry kapılı (`:981-984`). |
| D2 retry TOCTOU (kontrol ile kullanım arasında durum değişmesi) | **kapandı** | `hikQueueWorker.ts:161-169`: cihaza göndermeden hemen önce çalışan ve cihaz projesi yeniden kontrol ediliyor. Hata olursa normal retry hata yoluna dönüyor. |
| D3 24 saatten uzun run kilidi | **kapandı** | `biometricDestructionState.ts:13`: kilit artık heartbeat'in son 30 dakikada olmasına bağlı. Watchdog 10 dk bayatlıkta run'ı `failed` yapıyor; takılı run en geç ~20 dk'da kilidi bırakıyor, sağlıklı uzun run kilitli kalıyor. Heartbeat tam 30 dk ise `<` koşulu nedeniyle kilit açılıyor; bu sırada watchdog run'ı zaten kapatmış oluyor. `waitingDevices` durumu heartbeat'e bakmadan kilitli (en fazla tarama süresi + 24 saat). |
| D5 eski projede gerekçe kaydı | **kapandı** | `privacyBiometric.ts:39` |
| FE YÜKSEK-1 "PDKS silinmez" metni | **kapandı** | Kartta ve onayda aynı `RETENTION_EFFECT` metni var (`RetentionAssistantCard.tsx:18,44,64`). `grep "silinmez\|PDKS kayıtları"` saklama kartında sonuç vermiyor; test bu iddianın olmadığını doğruluyor. |
| FE YÜKSEK-2 ham JSON toast | **kapandı** | `EmployeeConsentsCard.tsx:96`, `:120` hata nesnesini doğrudan `notify.error`'a veriyor. |
| FE #3/#5/#6/#7 | **kapandı** | Rozet metni `BiometricDestructionCard.tsx:20-26`, "Convex'ten silindi" `lib/biometricDestruction.ts:102`. Maske kapatma onayı `RetentionAssistantCard.tsx:91,97`. `useSettingsFormState` imha kartında `:84` (erken return'den önce, hook sırası doğru). Rıza kartı: `htmlFor`/`id` `:213-214`, tür bazlı `aria-label` `:168,178`, iptal onayı `:238-245`, biyometrik düğme pasif `:179,232` (kart ve fotoğraf etkilenmiyor). |

## Bulgular

### KRİTİK
Yok.

### YÜKSEK

**Y-A — `requireEmployeeAccess` `project_user` rolünde proje kontrolü yapmıyor. Açık bu turdan önce de vardı, yeni sorgu da onu miras alıyor.**
- `convex/lib/auth.ts:123`: kontrol yalnız `role === "project_admin"` ise çalışıyor. `project_user` rolünde (ve rolü boş kullanıcıda) hiçbir proje kontrolü yok. `git diff convex/lib/auth.ts` boş, yani açık HEAD'de de var.
- Etkilenenler: yeni `getEmployeeBiometricModule` (`convex/privacyBiometric.ts:64-71`; sızan veri yalnız `{enabled}`). Daha önemlisi `employeeConsents.listForEmployee/hasActiveConsent/grant/revoke` (`convex/employeeConsents.ts:18,37,61,104`).
- Senaryo: A projesinin `project_user` hesabı B projesindeki bir çalışanın `employeeId`'sini öğrenir ve API'den `employeeConsents.revoke` ya da `grant` çağırır. B çalışanının KVKK rıza kaydı başka projeden değiştirilir; biyometrik rıza B'de modül açıksa verilebilir.
- Düzeltme: `requireEmployeeAccess` içinde super_admin dışındaki herkes için `getProjectIdsForUser(ctx).includes(employee.projectId)` şartı. Projesiz çalışanda super_admin dışındakileri reddet. Bu tur kapsamı dışında, ayrı ve öncelikli iş.

### ORTA

**O-A — Bridge dedupe anahtarı `fingerPrintID`'yi yok sayıyor: aynı çalışanın birden çok parmak izi tek kuyruk işlemine iniyor, tutanak aynı op'u birden çok kez sayıyor.**
- `convex/hikvisionSync.ts:501-509`: `localBridgeOperationKey` anahtarı önce `employeeId` alanından kuruyor; `fingerPrintID` hiç kullanılmıyor. İmha `runId` göndermediği için (`biometricDestruction.ts:224-227`) `:432-434` yalnız bu anahtarla eşleşiyor. Aynı cihazda bekleyen ya da başarısız aynı çalışan op'u varsa `payload` üzerine yazılıyor, `attemptCount:0` ile yeniden `pending` yapılıyor ve aynı `_id` dönüyor (`:437-449`).
- Senaryo: çalışanın 3 parmak izi var, köprü çevrimdışı ya da yavaş. Üç parti aynı op'u döndürüyor; cihaza yalnız son `fingerPrintID` silmesi gidiyor. `pendingOpIds` içinde aynı id üç kez bulunuyor (`:273`), `checkDeviceOperations` (`:294`) üçünü ayrı ayrı sayıyor. Bugün DS-K2804 köprüsü tüm biyometrik silmeleri reddettiği için (`bridge/windows/.../HikvisionClient.cs:73-74`) sonuç "başarısız" çıkıyor ve sahte başarı oluşmuyor. Köprü silmeyi desteklediği gün tutanak "3 silme tamam" diyecek ama cihazda 2 şablon kalacak.
- Düzeltme: imha op'larında `localBridgeOperationKey`'e `fingerPrintID` (ve `destructionRunId`) ekle ya da dedupe'u `payload.destructionRunId` varsa atla. `finishBatch`'te `queuedOpIds`'i tekilleştir.

**O-B — Temizlik işinin "done" yaptığı başarısız op'lar imha tutanağında başarılı sayılıyor.**
- `convex/hikvisionSync.ts:940-941`: `cleanupStaleSyncIssues` başarısız op'u `status:"done", dismissedAt` yapıyor. Cihaz silinmişse (`isOrphan`) ya da marka Hikvision değilse yaş şartı da aranmıyor. `convex/biometricDestruction.ts:298`: `op.status === "done"` başarı kabul ediliyor, `dismissedAt`'e bakılmıyor.
- Senaryo: imha sürerken bir köprü cihazı silinir ya da markası değişir. Op başarısız olur, temizlik cron'u onu "done" yapar, sonraki kontrol "cihaz hatası" yerine sessizce başarı sayar. Tutanak "Tamamlandı" der. Tarama 24 saati aşan çok büyük projelerde ilk partilerin op'ları için de aynısı olur.
- Düzeltme: `:298`'de `op.status === "done" && op.dismissedAt === undefined` ise başarı; `dismissedAt` varsa `deviceFailures` ya da `deviceUnconfirmed`.

### DÜŞÜK
- **D-1 Taşan op'ların hepsi "doğrulanamadı" sayılıyor** · `biometricDestruction.ts:273-275`: 500 sınırını aşınca en eski op'lar (büyük olasılıkla tamamlanmış olanlar) bakılmadan doğrulanamayan sayılıyor. Hesap tutucu yönde, sahte başarı yok. Ama köprü bağlıyken 10.000 şablonluk imhada tutanak ~9.500 "doğrulanamadı" gösterir. Düzeltme: düşen id'ler için `db.get` ile done/failed durumunu sayıp sonra at.
- **D-2 Projesiz tarama her türde tüm çalışanları geziyor** · `biometricDestruction.ts:136-159`: tür başına, çalışan başına en az 2 mutation (çalışan sayfası + boş şablon sayfası). 5.000 çalışanlı projede iki türle ~20.000 çağrı. Tek seferlik ve sınırlı, kota yangını değil. Düzeltme: iki tür için tek çalışan geçişi yapmak ya da projesiz şablon kalmadıysa geçişi atlamak.
- **D-3 Denetim filtresinde yazılmayan hedefler** · `convex/lib/auditLogQuery.ts:5-8`: `biometricDestructionCheck`, `biometricDestructionDeviceCheck`, `biometricDestructionDevice` artık hiçbir kodda yazılmıyor (`grep` yalnız test). İki seçenek aynı "Biyometrik Cihaz Kontrolü" etiketiyle `AuditFilters.tsx:42` açılır listesinde görünüyor. Test ve sayfa bozulmuyor (`AuditTable/AuditDetailPanel` `?? row.targetTable` yedekli). Canlıda eski satır yoksa bu üç anahtarı kaldır.
- **D-4 Durum satırı her şablonda patch'leniyor** · `biometricDestruction.ts:39`: auditLog satırı şablon başına 2-3 kez değişiyor. Denetim sayfası açıksa liste sorgusu her patch'te yeniden çalışıyor. Bant genişliği maliyeti, run ile sınırlı.
- **D-5 İyimser güncellemede yanlış uyarı** · `RetentionAssistantCard.tsx:33-38,79-83` + `SettingsFormState.tsx:27`: kayıt sürerken taslak hâlâ kirli, kaynak ise iyimser değere geçmiş durumda. Bu yüzden `remoteChanged` kısa süre true oluyor ve "Bu bölüm başka bir oturumda değişti" metni yanıp sönüyor. Başarısız kayıtta Convex iyimser değeri geri alıyor (doğru). İki form yalnız kendi alanını yazıyor, birbirini ezmiyor (doğru). Düzeltme: `pending` iken `remoteChanged`'i bastır.
- **D-6 Sınır değerleri UI'da sabit sayı** · `RetentionAssistantCard.tsx:16,29,58,59,64`: 1825/3650 elle yazılmış; `MIN/MAX_CARD_READING_RETENTION_DAYS` import edilmeli (Denetim bileşenleri zaten `convex/lib`'den import ediyor). Kayıtlı eski değer (<1825) varsa form hatayı gösteriyor ama "bu süre artık uygulanmıyor" demiyor.
- **D-7 Capture kapısı yalnız cihaz projesine bakıyor** · `hikGatewayDevice.ts:953-972`: `employeeId` modülü kapalı başka bir projedense (kullanıcının iki projeye de erişimi varsa) yakalama yine yapılır. Görüntü cihazın önündeki kişiye ait ve saklanmıyor; risk düşük. İstenirse `employee.projectId` için de `assertBiometricAllowed` ekle.

## O2 doğrulaması (soru 2)
- Başka projenin şablonu silinemiyor. Projesiz taramada yalnız `template.projectId === undefined` ve sahibi o anda hedef projede olan satırlar işleniyor (`biometricDestruction.ts:162-165`). Silme anında aynı şart yeniden kontrol ediliyor (`:254`, `:262`). Projesi olan ama sahibi bu projede olan şablonlar atlanıyor.
- Çalışanın projesi sonradan değişirse: tarama ile silme arasında çalışan taşınırsa silme yapılmıyor (`:254/:262`, atlanan sayılmıyor). A projesindeyken oluşmuş projesiz şablon, çalışan B'ye geçtiyse B'nin imhasında siliniyor, A'nın imhasında görünmüyor. Bu davranış tutarlı; A'nın tutanağı bu şablonu kapsamıyor.
- Sorgular sınırlı: önizleme en fazla 51 çalışan, çalışan başına `take(2)` yüz ve `take(11)` parmak izi okuyor. `capped` bayrağı ve bayrak true olduğunda UI uyarısı var (`BiometricDestructionCard.tsx:110`). İmha tek tek sayfalıyor (`paginate numItems:1`). Projesiz parmak izi örneklemi byte sınırı olmadan ~550 belge okuyor; şablon başına birkaç KB ile yaklaşık 1-2 MB, sınırın içinde.

## O4 doğrulaması (soru 3)
Denetim izi yeterli: başlangıç satırı (gerekçe, türler, proje) ve bitiş/hata satırı (silinen yüz/parmak/dosya, cihaz op/hata/doğrulanamayan, başlatan) korunuyor. Ara ilerleme yalnız durum satırında tutuluyor. Cihaz bazlı ayrıntı `hikPendingOperations` satırlarında (`payload.destructionRunId`) kalıyor. `AUDIT_TARGET_LABELS` değişikliği `auditLogQuery.test.ts:65-70` ile uyumlu ve test geçiyor. Denetim sayfası (`AuditTable`, `AuditFilters`, `AuditDetailPanel`, `auditLog.ts:145` `distinctTargetTables`) bozulmuyor; tek kusur D-3.
