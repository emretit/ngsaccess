# C2b-05-api teslim raporu

## Sonuç ve koordinatör kararları

Yeni proje/kural gönderim API'leri kalıcı çalıştırma ve cihaz hedefleri oluşturur; Hikvision gateway/localBridge ve IDE permission + kişi yollarını kullanır. Eski public action'ların imza ve davranışları korunur. Yeni frontend, kayıt başarılı olduktan sonra yalnız `startRuleSync`, proje gönderiminde yalnız `startProjectResync` çağırmalı; aynı anda legacy sync action'larını da çağırmamalı.

Koordinatör `msg_7f4407e368a0` kararıyla **getDetails sınırı C3'e ertelendi**: eski açık frontend sekmeleri tam üyelik aldığını varsayıyor; kırpma + kaydetme okunmayan üyeleri silebilir. `getDetails` ve `readRuleScope` tamamen eski davranışla bırakıldı; üyeler ve ayrıntı ilişkilerinde sınırsız `.collect()` hâlâ var, yeni `membersTruncated` alanı eklenmedi. Yeni cursor sorgusu hazır. Bu, orijinal spec'in 6. maddesindeki sınır hedefinin koordinatör tarafından açıkça ertelenmesidir.

Koordinatör ayrıca legacy action'ların run üretmeden çalışmaya devam etmesini ve 200 cihaz / 100 kural aşımında açık hata verilmesini onayladı. 500'den fazla üyeli kuralda yeni hedef açık Türkçe hata ile `failed` olur; üyeler sessiz kırpılmaz. Büyük kural için batch/scheduler geliştirmesi bu teslimde yok.

## Dosyalar ve ana noktalar

- `convex/deviceSyncRuns.ts`: public başlatma/okuma API'leri, auth, scheduler, hedef izleme, watchdog, atomik Hik plan numarası ataması.
- `convex/lib/deviceSyncRun.ts` + `.test.ts`: saf durum/özet/atlama kararları, ortak `deviceConnection` kullanımı.
- `convex/accessRules.ts:574`: yeni `listRuleMembers`; mevcut getDetails değiştirilmedi.
- `convex/actions/hikvisionSync.ts`: internal week-plan action'a opsiyonel run/hedef bağlamı; run yolunda kart gönderme hatası sonucu da sayılır.
- `convex/actions/ideGatewayDevice.ts`: internal permission/employee action'larına opsiyonel run/hedef bağlamı.
- `convex/hikvisionSync.ts`, `convex/ideSync.ts`: runId damgalama ve run kapsamlı dedupe.
- `convex/_generated/api.d.ts`: yalnız deviceSyncRuns import/modül satırları eklendi; diğer worker satırlarına dokunulmadı.
- `schema.ts` worker tarafından yazılmadı; aşağıdaki tanımlar koordinatör tarafından eklendi.

## Tablo seçimi ve kanıt saklama

Ayrı `deviceSyncRuns` ve `deviceSyncRunTargets` tabloları kullanıldı. Hedef listesi run belgesinde gömülü değil; her hedef kendi durum belgesini günceller. Run özetini tek scheduler zinciri 5 saniyede bir günceller; her hedef aynı run belgesine yazmadığı için gereksiz OCC çekişmesi azaltılır. Public get/listRecent özetleri hedeflerden sorgu anında yeniden türetir; özet belge yazısını beklemez.

Koordinatörün eklediği şema:

- deviceSyncRuns: projectId, kind, ruleId?, startedBy, startedAt, finishedAt?, status, counts, dispatchFinished?; `by_project_started(projectId, startedAt)`.
- deviceSyncRunTargets: runId, deviceId, deviceName, brand, status, reason?, updatedAt, dispatchFinished?; `by_run(runId)`, `by_run_device(runId, deviceId)`.
- hikPendingOperations / idePendingOperations: opsiyonel runId + `by_run_device(runId, deviceId)`.
- accessRules: `by_hikWeekPlanNo(hikWeekPlanNo)`; yeni run yolu max+atamayı tek mutation içinde yapar. Legacy getMax/assign akışı değişmedi. Min yeni no 2 (eski max en az 1 kuralı); 1–65535 dışındaki mevcut veya üretilecek no açık hatadır. 65535 bridge ushort temsil sınırıdır; modele özgü daha düşük limitler cihaz hatası olarak görünür.

Op ACK/fail handler'ları değiştirilmedi. Dispatch tamamlanınca hedefin runId/deviceId op'ları 5 saniyede bir okunur; terminal sonuç hedefte kalıcı snapshot olur. Hedefte dispatchFinished, yalnız işlem üretimi tamamlanınca true olur; yarıda kesilen action'ın kısmi ACK'leri tüm cihazı verified yapamaz. Başlatmada 10 dakikalık watchdog planlanır. Tam dispatch için son op kanıtı tekrar okunur; bitmeyen/yarıda kesilen hedef unknown olur. Terminal snapshot daha sonra geç gelen ACK ile değiştirilmez.

Dedupe: IDE idempotency anahtarına yalnız yeni run yolunda runId eklenir. Hik dedupe aynı runId ve aynı payload ister; bir rule içindeki farklı çalışan payload'ları birbirini ezmez. Önceki run/legacy işlere runId sonradan yazılmaz ve önceki çalıştırmanın kanıtı sahiplenilmez. Eski runId'siz çağrılar eski anahtar davranışını sürdürür. Hik resolveTargetFailures, runId taşıyan kanıtı sonraki bir başarılı enqueue nedeniyle done yapmaz.

## Public frontend sözleşmesi

Tüm zamanlar epoch ms; Id/Doc tipleri `convex/_generated/dataModel` içinden. Frontend sonuçları `FunctionReturnType<typeof api.deviceSyncRuns.X>` ile kullanmalı.

```ts
type TargetStatus = "queued" | "sent" | "verified" | "failed" | "skipped" | "unknown";
type RunStatus = "running" | "done" | "partial" | "failed";
type RunCounts = Record<TargetStatus, number>;
type Run = {
  _id: Id<"deviceSyncRuns">;
  _creationTime: number;
  projectId: Id<"projects">;
  kind: "project_resync" | "rule_sync";
  ruleId?: Id<"accessRules">;
  startedBy: Id<"users">;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  counts: RunCounts;
  dispatchFinished?: boolean;
};
type Target = {
  _id: Id<"deviceSyncRunTargets">;
  _creationTime: number;
  runId: Id<"deviceSyncRuns">;
  deviceId: Id<"devices">;
  deviceName: string;
  brand: string; // hikvision | ide_smart | other; snapshot
  status: TargetStatus;
  reason?: string;
  updatedAt: number;
  dispatchFinished?: boolean;
};

startProjectResync({ projectId: Id<"projects"> }): Promise<{ runId: Id<"deviceSyncRuns"> }>;
startRuleSync({ ruleId: Id<"accessRules"> }): Promise<{ runId: Id<"deviceSyncRuns"> }>;
listRecent({ projectId: Id<"projects">, limit?: number }): Promise<Run[]>;
get({ runId: Id<"deviceSyncRuns"> }): Promise<Run & { targets: Target[] }>;
```

Başlatma admin (super_admin/project_admin) ve proje kapsamı ister; startedBy auth'tan türetilir, public userId alınmaz. Okumalar authenticated + run/project kapsamı ister; kayıp run hata verir. `listRecent` default 10, limit 1–20'ye sıkıştırılır, yeni→eski. Başlatma async kuyruğa alır; dönen runId cihaz başarısı değildir. `get` ile reaktif izlenebilir. Cihaz adı/markası başlangıç snapshot'ıdır (cihaz sonradan silinse de geçmiş okunur). Terminal status ilk sorguda görünürken finishedAt, özet mutation'ı tamamlanana kadar kısa süre undefined olabilir.

Her proje cihazı hedef olur: pasifler ve desteklenmeyenler açıkça skipped. Kural gönderiminde de projenin cihazları görünür; ilgili aktif kurala bağlı olmayan cihaz skipped/noRule olur. Bu yaklaşım, kuralı yetkisiz başka kapılara yaymaz. Proje yeniden gönderimi tüm aktif kuralları değerlendirir. Pasif kuralın startRuleSync çağrısı noRule atlaması üretir; mevcut pasifleştirme mutation'larının erişim kaldırma akışı korunur.

## Durumlar

| Enum | Türkçe etiket | Kanıt |
|---|---|---|
| queued | Kuyrukta | Hik pending/processing; IDE pending/sent (ACK bekleniyor); dispatch hâlâ çalışıyor |
| sent | Gönderildi · teslim kanıtı yok | Hik op done veya gateway çağrılarının başarılı dönüşü |
| verified | Cihazda doğrulandı | IDE hedefin bütün op'ları acked ve her birinin ackedAt alanı mevcut |
| failed | Başarısız | Dispatch hatası / terminal op hatası; reason mevcut |
| skipped | Atlandı | Gönderim uygunluğu veya bağlı aktif kural yok |
| unknown | Bilinmiyor | Kanıt yok/eksik, okuma sınırı veya 10 dakika süre sonu |

Hik hiçbir durumda verified olmaz. IDE sent, teslim doğrulaması değildir ve queued görünür. Aynı hedefte pending + failed varsa bekleyenler sonuçlanana/süre dolana kadar queued kalır; hata nedeni görünür. ACK zaman damgası olmayan acked unknown sayılır.

Run: queued varsa veya dispatch henüz tamamlanmadıysa running; sadece sent/verified (veya sıfır hedef) done; başarı + sorun veya skipped bulunan sonuç partial; yalnız failed/unknown failed. counts cihaz sayısıdır; legacy synced/op sayılarıyla birleştirilmemeli. done etiketi tüm cihazlarda fiziksel doğrulama anlamına gelmez; sent sayıları ayrıca gösterilmeli.

Atlama sebepleri:
- Cihaz pasif.
- Cihaz markası desteklenmiyor.
- Cihaz çevrimdışı (status veya ortak deviceConnection kanıtı; hiç görülmemiş cihaz otomatik çevrimdışı sayılmaz).
- Cihaz bağlantı bilgileri eksik: IDE UUID/user/password; Hik gateway devIndex; localBridge IP/user/password.
- Cihaza bağlı gönderilecek aktif kural yok.

## Cursor üyelik sözleşmesi

```ts
type PageArgs = {
  ruleId: Id<"accessRules">;
  kind: "people" | "devices" | "doors";
  paginationOpts: PaginationOptions; // convex/server
};
type PersonRow = Doc<"groupMembers"> & {
  employees: {
    id: Id<"employees">; firstName: string; lastName: string; email?: string;
  } | null;
};
type DeviceRow = Doc<"groupDevices"> & {
  devices: {
    id: Id<"devices">; name: string;
    brand?: "hikvision" | "other" | "ide_smart";
    ideUuid?: string; deviceSerial?: string;
    zoneId?: Id<"zones">; doorId?: Id<"doors">;
  } | null;
};
type DoorRow = Doc<"groupDoors"> & {
  doors: { doorId: Id<"doors">; deviceId?: Id<"devices">; name: string } | null;
};
type Page<T, K> = PaginationResult<T> & { kind: K }; // convex/server
listRuleMembers(args: PageArgs): Promise<
  Page<PersonRow, "people"> | Page<DeviceRow, "devices"> | Page<DoorRow, "doors">
>;
```

`paginationOpts.numItems` 1–50 aralığına sıkıştırılır; ilk cursor null; continueCursor ile isDone true olana kadar devam. Her rule/kind için ayrı cursor tutulmalı. page numarası değil Convex cursor'ı kullanılır; standart paginate metadata'sı (isDone, continueCursor, varsa splitCursor/pageStatus) korunur. Kişiler project+group, cihazlar project+group, kapı bağları group index'inden okunur; relation karşılığı kayıp/yabancı projedeyse join null olur. Kişi API'si ziyaretçi üyelerini de içerir; sessiz personel filtresi yoktur.

Yeni editör tüm people/devices/doors sayfaları tamamlanmadan ilişkileri tam değiştiren updateWithGroups çağırmamalı. Kayıt sırasında değiştirilmemiş ilişki listesini göndermemek mevcut davranışı korur.

**updateWithGroups incelemesi:** employeeIds verildiğinde (visitor kural hariç) tüm eski üyeleri silip istemci listesini yazar; deviceIds ve doorIds için de aynı tam değiştirme yapılır. Fonksiyon içindeki eski üyelik okumaları collect olup başka take/kırpma bulunmadı. Bu yüzden herhangi bir eksik frontend sayfası veri kaybına dönüşebilir; frontend sayfalama tamamlanma koruması zorunlu. Bu mutation bu görevde değiştirilmedi.

## Internal ve değişen fonksiyonların tam tipleri

Aşağıdaki fonksiyonlar public değildir; scheduler/action çağrısı için internal referansları kullanılır. Void handler'lar wire üzerinde null döner.

| Fonksiyon | Args | Dönüş |
|---|---|---|
| deviceSyncRuns.createRun | { projectId?: Id<"projects">; ruleId?: Id<"accessRules"> } | Id<"deviceSyncRuns"> |
| deviceSyncRuns.loadTarget | { targetId: Id<"deviceSyncRunTargets"> } | { target: Doc<"deviceSyncRunTargets">; run: Doc<"deviceSyncRuns">; device: Doc<"devices"> } | null |
| deviceSyncRuns.prepareRule | { ruleId: Id<"accessRules">; deviceId: Id<"devices">; projectId: Id<"projects"> } | Id<"employees">[] | null |
| deviceSyncRuns.ensureWeekPlan | { ruleId: Id<"accessRules">; projectId: Id<"projects"> } | number |
| deviceSyncRuns.executeTarget | { targetId: Id<"deviceSyncRunTargets">; ruleIds: Id<"accessRules">[] } | null |
| deviceSyncRuns.finishTarget | { targetId: Id<"deviceSyncRunTargets">; failure?: string; skipped?: string; directSent?: boolean } | null |
| deviceSyncRuns.refreshTarget | { targetId: Id<"deviceSyncRunTargets">; failure?: string } | null |
| deviceSyncRuns.expireRun | { runId: Id<"deviceSyncRuns"> } | null |
| deviceSyncRuns.refreshSummary | { runId: Id<"deviceSyncRuns"> } | null |
| actions.hikvisionSync.syncWeekPlanToDevicesInternal | { accessRuleId: Id<"accessRules">; allowedProjectIds?: Id<"projects">[]; runId?: Id<"deviceSyncRuns">; targetDeviceIds?: Id<"devices">[] } | { synced: number; failed: number; errors: string[]; employeesSynced: number } |
| actions.ideGatewayDevice.syncPermissionToIdePanels | { accessRuleId: Id<"accessRules">; runId?: Id<"deviceSyncRuns">; targetDeviceIds?: Id<"devices">[] } | { ok: boolean; queued: number; skipped: string[]; opIds: Id<"idePendingOperations">[]; error?: string } |
| actions.ideGatewayDevice.syncEmployeeToIdePanels | { employeeId: Id<"employees">; runId?: Id<"deviceSyncRuns">; targetDeviceIds?: Id<"devices">[] } | { ok: boolean; queued: number; skipped: string[]; opIds: Id<"idePendingOperations">[]; error?: string } |
| hikvisionSync.enqueueLocalBridgeOperation | { deviceId: Id<"devices">; projectId?: Id<"projects">; operation: Doc<"hikPendingOperations">["operation"]; payload: unknown; runId?: Id<"deviceSyncRuns"> } | Id<"hikPendingOperations"> |
| ideSync.enqueueIdeOp | { deviceId: Id<"devices">; projectId?: Id<"projects">; opType: Doc<"idePendingOperations">["opType"]; payload: unknown; maxAttempts?: number; runId?: Id<"deviceSyncRuns"> } | Id<"idePendingOperations"> |
| hikvisionSync.resolveTargetFailures | { deviceId: Id<"devices">; operations: Doc<"hikPendingOperations">["operation"][]; employeeId?: Id<"employees">; accessRuleId?: Id<"accessRules"> } | number (çözülen satır sayısı) |

resolveTargetFailures imzası değişmedi; yalnız runId'li kanıtlar kapsam dışına alındı. Eski payload validator'ları aynen korundu; tabloda yeni payload şeması tanımlanmadı.

Saf modül:
- `operationStatus(brand: string, op: { status: string; ackedAt?: number }): TargetStatus`
- `targetStatus(statuses: readonly TargetStatus[], timedOut?: boolean): TargetStatus`
- `summarizeRun(statuses: readonly TargetStatus[], dispatchFinished: boolean): { counts: RunCounts; status: RunStatus }`
- `skippedReason(device: { brand?: string; isActive?: boolean; status?: string; hikTransport?: string; hikDevIndex?: string; deviceIp?: string; deviceUsername?: string; devicePassword?: string; ideUuid?: string; ideUser?: string; idePassword?: string; hikLastSeenAt?: number; lastSeen?: string; hikOfflineHint?: string }, now: number): string | undefined`

## Sınırlar ve riskler

- Başlatma proje cihazlarını 201, proje kurallarını 101 satırla okur; 200/100 aşımı hiçbir run/op üretmeden ConvexError. Pasif kayıtlar da bu liste sınırlarına dahildir.
- prepareRule en fazla 201 groupDevice ve 501 groupMember okur; aşım hedef hatasıdır. 500+ üye mesajı: “Kural 500’den fazla kişi içeriyor; bu çalıştırmada gönderilemedi. Kuralı daha küçük gruplara ayırın.”
- Hedef kanıt okuması en fazla 2001 op; 2000 aşılırsa unknown, başarı çıkarılmaz.
- get en fazla 201 hedef; listRecent en fazla 20 run + run başına 201 hedef. Cursor sayfası en fazla 50 ilişki + 50 join okur.
- Run yalnız hedef sonucu geçmişidir; rule revision snapshot'ı veya yeniden deneme API'si eklenmedi. Kullanıcı yeni run başlatabilir.
- 10 dakika sonunda unknown hedefler için geç gelen ACK geçmişi yeniden açmaz. Kuyruktaki fiziksel işler timeout ile iptal edilmez. Yeni gönderim eski gönderimi iptal etmez; cihaz üstünde sıra/sürüm garantisi mevcut köprüye bağlıdır.
- Aktarımda mevcut legacy graph reader'ları ve IDE permission numarası ataması kullanılır; onların bazı collect okumaları hâlâ sınırsızdır. Yeni public geçmiş/cursor okumaları sınırlıdır; eski helper'ların tümünü yeniden yazmak bu scope'ta yapılmadı.
- Gerçek Convex scheduler/DB entegrasyonu ve fiziksel cihaz denenmedi; paket kurulmadı. Node helper'ların donanım/model davranışları mevcut entegrasyonun sınırlarını taşır.
- getDetails collect maliyeti bilinçli olarak C3'e ertelendi; frontend cursor geçişi zorunlu takip işidir.
- Legacy frontend bu dalga tek başına çalışırken run geçmişi üretmez; yeni API'ye frontend geçişi gerekir (koordinatör onayı).

## Kapılar

17.10.2026, mevcut paylaşılan çalışma ağacı:
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: 0.
- `node_modules/.bin/eslint convex`: 0.
- `node_modules/.bin/eslint src convex`: 0.
- `npx vitest run`: 87 dosya / 867 test geçti (yeni saf mantık: 5 test).
- `git diff --check`: 0.
- Frontend build bu backend görevinde gerekli değil. Commit/push/deploy/migration/Convex run-dev-deploy veya canlı DB işlemi yapılmadı.

Koordinatör frontend kontrolde: runId ile kalıcı sonuç aboneliği; queued/sent/verified ayrımı; 0 hedef ve tamamı skipped sonucu; failure reason görünürlüğü; tüm sayfalar gelmeden edit kaydının engellenmesi; legacy sync'in yeni sync ile çift çağrılmaması.

## Düzeltme (api-fix)

17.10.2026; bu bölüm önceki izleme/gönderim açıklamalarının ilgili kısımlarını günceller.

- `deviceSyncRuns.ts:17,29,54,345`: hedef başına 5 sn `refreshTarget` zinciri kaldırıldı; tek run `refreshSummary` zinciri kanıtları ve özeti birlikte okur. Bekleme 5 → 15 → 30 → 60 sn, sonra 60 sn; 10 dk sınırında son okuma, tüm hedefler terminalse zincir durur. `refreshTarget` eski planlanmış işler için tek seferlik uyumluluk girişidir. `expireRun` da hedef başına iş planlamaz.
- Hedef ve run için durum/sebep/sayaç değişmemişse patch yok; `updatedAt`/`finishedAt` zaman damgası değişiklik üretmek için kullanılmaz. `finishTarget` tek patch yapar, yinelenen çağrı no-op olur; hedef başına yeni timer yoktur.
- `deviceSyncRuns.ts:166`: yeni IDE run dispatcher'ı aynı kişiyi bütün kurallar arasında tekilleştirir; `syncEmployeeToIdePanels` **kişi başına/run başına bir kez**, eşleşen cihazların birleşimiyle çağrılır. Kural permission çağrısı da kural başına tek, cihaz dizisiyle yapılır. Hedefler ancak bütün dispatch bittiğinde `dispatchFinished=true` olur; eksik/yarım dispatch başarı sayılmaz. Kısmi action hatası ilgili hedeflerde başarısızlık kanıtı olarak saklanır; tek cihazı belirleyemeyen toplu hata tüm ilgili hedeflere ihtiyatlı biçimde yansıtılır.
- Public ek: `listRecent({projectId: Id<"projects">, ruleId?: Id<"accessRules">, limit?: number}): Promise<Run[]>`. `ruleId` varsa koordinatörün eklediği `by_rule_started(ruleId, startedAt)` kullanılır; kuralın projesi ve erişimi doğrulanır, farklı proje run'ı dönmez. Dönüş şekli/limit davranışı aynı.
- Internal ekler: `prepareIdeRule({ruleId: Id<"accessRules">, deviceIds: Id<"devices">[], projectId: Id<"projects">}): Promise<{employeeIds: Id<"employees">[], deviceIds: Id<"devices">[]} | null>`; `executeIdeTargets({targetIds: Id<"deviceSyncRunTargets">[], ruleIds: Id<"accessRules">[]}): Promise<void>`. `refreshSummary` mevcut `runId` yanında opsiyonel `pollAttempt?: number` alır; wire dönüşü null kalır. Diğer public sözleşmeler aynı.
- 50 IDE cihazı / 100 aynı kişi / 1 kural örneğinde run katmanı çağrıları yaklaşık **5.250 → 203**; yeniden kullanılan action'ların iç query/mutation çağrıları dahil yaklaşık **35.500 → 25.455**. 2 örtüşen kuralda aynı hesap **100.850 → 40.609**. 10 dk terminal olmayan izleme ayrıca yaklaşık **6.120 → en fazla 14** çağrı (watchdog dahil) olur. Böylece 1 kural + tam süre izleme toplamı yaklaşık **41.620 → 25.469**; 2 kuralda **106.970 → 40.623**. Başlatma, bridge/ACK servisleri, UI abonelikleri ve transaction retry'ları bu tahminde yoktur; fiziksel cihaz×kişi enqueue maliyeti sürer.
- Hik `done=sent`, IDE yalnız `acked + ackedAt=verified` aynen korunur. Grup boyutu/cihaz/kural/kanıt sınırları korunur; çok büyük kanıt kümeleri artık aynı run mutation'ında okunduğu için Convex transaction okuma/byte sınırı canlıda ayrıca izlenmelidir. Gerçek scheduler/cihaz çalıştırılmadı.
- Kapılar: Convex tsc 0, eslint convex 0; tam Vitest **93 dosya / 943 test** yeşil. Uygulama tsc'de yalnız 06 frontend fixture'ında yeni `sensitiveMasked` alanı eksikti; koordinatöre bildirildi, src yazılmadı. Ayrıntı: `c2b-api-fix.md`.
