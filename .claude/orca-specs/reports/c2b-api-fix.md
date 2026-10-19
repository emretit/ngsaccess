# C2b API düzeltmeleri

17.10.2026 — task_9d8803a25123 / ctx_b4fb87dd6faa.

## Tamamlanan maddeler ve sözleşme ekleri

| Madde | Dosya:satır | Sonuç | Sözleşme eklemesi |
|---|---|---|---|
| 1 | `convex/shifts.ts:271` | Eski sıfır başarılı çakışma `OVERLAP:n` hatası geri geldi; yeni mod kişi sonuçlarını döndürür; forceConfirm ve kısmi başarı korunur | `bulkAssignShift` arg `resultMode?: "detailed"`; dönüş aynı |
| 2 | `convex/shifts.ts:64` | Projesiz eski atama yalnız ilgili kişiyi Türkçe sebep ile atlatır; diğerleri devam eder | Preview/apply şekli aynı; `previewStatus:"skipped"` |
| 2 silme | `convex/shifts.ts:345`, `:357`, `:371`, `:468` | Projesiz eski seri etkiden hariç, silinmeden bırakılır; geçerli seriler silinir; gerçek sayılar döner | `assignmentDeleteImpact`, `definitionUsage`, `remove` dönüşlerine `skippedAssignments:number`; diğer alanlar aynı |
| 3 | `convex/lib/visitorStatus.ts:65`, `convex/visitors.ts:151`, `:534` | TR ofsetsiz ve UTC ISO aynı an/durum; liste/ayrıntı tarihleri ISO; expiry cron'u gerçek anı karşılaştırır | `visitStart/visitEnd:string|null` tipi aynı; değerler normalize ISO |
| 4 | `convex/deviceSyncRuns.ts:17`, `:29`, `:54`, `:166`, `:316`, `:345`; `convex/lib/deviceSyncRun.ts:63` | Tek run timer'ı, artan bekleme, değişmeyen patch yok; IDE kişi başına/run başına bir action, cihaz birleşimi; Hik sent / IDE acked verified korunur | Public shape aynı; internal `prepareIdeRule`, `executeIdeTargets` yeni; `refreshSummary.pollAttempt?:number` opsiyonel |
| 5 | `convex/visitors.ts:234`, `convex/lib/visitorStatus.ts:70` | Mevcut isManager ile admin tam kart/TC; member son dört hane | `getDetail.sensitiveMasked:boolean` yeni; cardNumber/tcNo alanları aynı |
| 6 | `convex/cardReadings.ts:242`, `convex/lib/liveReadings.ts:47` | Pasif kişi Türkçe hata; hedefsiz kart ataması dürüst sonuç | `syncStatus` yeni literal `noTargets`; hata kodu `EMPLOYEE_INACTIVE`; helper `employeeIsActive?:boolean` |
| 7 (koordinatör eki) | `convex/deviceSyncRuns.ts:360` | Kural geçmişi `by_rule_started` ile; kural proje/erişim kontrolü ve satır proje filtresi | `listRecent.ruleId?:Id<"accessRules">`; dönüş aynı |

## Frontend'in kullanacağı ek sözleşmeler

```ts
bulkAssignShift(args: BulkCommonArgs & { endDate: string; resultMode?: "detailed" }): Promise<ExistingBulkResult>;
assignmentDeleteImpact(args: { shiftId: Id<"shifts"> }): Promise<ExistingImpact & { skippedAssignments: number }>;
definitionUsage(args: { shiftId: Id<"shifts"> }): Promise<ExistingUsage & { skippedAssignments: number }>;
remove(args: { shiftId: Id<"shifts"> }): Promise<{ removedAssignments: number; skippedAssignments: number }>;
listRecent(args: { projectId: Id<"projects">; ruleId?: Id<"accessRules">; limit?: number }): Promise<Run[]>;
// getDetail mevcut ayrıntı alanlarına sensitiveMasked:boolean ekler.
// assignCardFromReading mevcut arglarıyla döner:
// {employeeId: Id<"employees">; cardNumber:string; syncStatus:"pending"|"notRequested"|"noTargets"}
```

`Existing*`, `Run`, `BulkCommonArgs` önceki sayfa raporlarındaki tiplerdir; yerlerine yeni şekil tanımlanmadı. Frontend gerçek tipleri `FunctionArgs` / `FunctionReturnType` ile almalı. 05/06/07/09 raporlarına “Düzeltme (api-fix)” bölümleri eklendi; önceki metinle çelişen eski davranış açıklamalarını bu bölümler günceller. Koordinatöre canlı status mesajıyla yeni arg/literal/alanlar iletildi.

Internal yeni imzalar:

```ts
prepareIdeRule(args: { ruleId: Id<"accessRules">; deviceIds: Id<"devices">[]; projectId: Id<"projects"> }):
  Promise<{ employeeIds: Id<"employees">[]; deviceIds: Id<"devices">[] } | null>;
executeIdeTargets(args: { targetIds: Id<"deviceSyncRunTargets">[]; ruleIds: Id<"accessRules">[] }): Promise<void>;
refreshSummary(args: { runId: Id<"deviceSyncRuns">; pollAttempt?: number }): Promise<void>;
```

Değişen mevcut internal uçların korunmuş tam imzaları:

```ts
createRun(args: { projectId?: Id<"projects">; ruleId?: Id<"accessRules"> }): Promise<Id<"deviceSyncRuns">>;
prepareRule(args: { ruleId: Id<"accessRules">; deviceId: Id<"devices">; projectId: Id<"projects"> }): Promise<Id<"employees">[] | null>;
executeTarget(args: { targetId: Id<"deviceSyncRunTargets">; ruleIds: Id<"accessRules">[] }): Promise<void>;
finishTarget(args: { targetId: Id<"deviceSyncRunTargets">; failure?: string; skipped?: string; directSent?: boolean }): Promise<void>;
refreshTarget(args: { targetId: Id<"deviceSyncRunTargets">; failure?: string }): Promise<void>;
expireRun(args: { runId: Id<"deviceSyncRuns"> }): Promise<void>;
visitors.expireVisitorAccess(args: {}): Promise<{ expired: number }>;
```

Void handler wire dönüşü null'dır. `visitors.getDetail({visitorId:Id<"employees">,refreshKey?:number})` dönüşü önceki `DetailResult` null dalını korur, dolu ayrıntıya `sensitiveMasked:boolean` ekler; `listPage` arg/dönüş tipleri aynıdır. `cardReadings.assignCardFromReading({readingId:Id<"cardReadings">,employeeId:Id<"employees">,expectedCurrentCard:string|null})` dönüşü yukarıdaki üçlü enum'dur. Diğer internal arglar/dönüşler korunur. `refreshTarget` önceki deployment'tan kalmış scheduler işleri için tutulur, tekrar poll planlamaz.

## Çağrı maliyeti hesabı

Varsayım: 50 uygun IDE cihazı, tümüne bağlı 100 aktif kişi, bütün kurallarda aynı kişiler; başarılı çağrılar, retry yok. Run katmanı ve yeniden kullanılan IDE action'larının iç `runQuery/runMutation` çağrıları statik olarak sayıldı; fiziksel DB read sayısı, bridge/ACK servisleri, UI abonelikleri ve girişteki public action/createRun kapsam dışı.

| Örnek | Önce | Sonra |
|---|---:|---:|
| 1 kural: run katmanı çağrıları | 5.250 | 203 |
| 1 kural: IDE iç çağrıları dahil | 35.500 | 25.455 |
| 2 örtüşen kural: IDE iç çağrıları dahil | 100.850 | 40.609 |
| Tam 10 dk terminal olmayan izleme | yaklaşık 6.120 | en fazla 14 (watchdog dahil) |
| 1 kural + tam izleme | yaklaşık 41.620 | 25.469 |
| 2 kural + tam izleme | yaklaşık 106.970 | 40.623 |

Yeni izleme anları yaklaşık 5, 20, 50, 110, 170, 230, 290, 350, 410, 470, 530, 590, 600 sn; terminal sonuçta daha erken durur. IDE kişi action adedi 1 kuralda 5.000 → 100, 2 kuralda 10.000 → 100; mevcut kişi action'ı cihaz bazında permission/user enqueue yapmayı sürdürür, bu yüzden toplam çağrı sayısı 100'e düşmez. Hedef/özet değişmediyse yeni döngü DB patch yazmaz.

## Doğrulama

- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: **0**, son kaynak değişikliğinden sonra tekrar geçti.
- `node_modules/.bin/eslint convex`: **0 hata/uyarı**, son kaynak değişikliğinden sonra tekrar geçti. Ek ortak kapı `node_modules/.bin/eslint src convex` de **0 hata/uyarı**.
- `npx vitest run`: **93 dosya / 943 test geçti** (20:26 yerel). Yeni testler eski/detailed toplu atama, projesiz kayıt/silme, iki tarih formatı, gerçek query wrapper'larıyla rol maskeleme, expiry cron'u, inactive/noTargets, run tek timer/no-op/terminal/timeout, kişi-cihaz birleşimi ve ruleId geçmişini kapsar.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: son koşuda yalnız **`src/components/visitors/visitors.test.tsx:19` TS2741**, fixture'da yeni `sensitiveMasked` eksik. Bu dosya 06 frontend ownership'inde; dokunulmadı ve koordinatöre `msg_b755fa3d8b39` ile iletildi. Backend tsc temizdir.
- `git diff --check`: 0.
- Gerçek Convex runtime, scheduler, cihaz, oturum veya E2E çalıştırılmadı; testler saf helper ve gerçek registered handler/auth wrapper mantığını bellek DB/scheduler adaptörleriyle sınar.

## Sınırlar ve koordinatör kontrolü

- `schema.ts`, `src/**`, actions/legacy sync dosyaları, generated API ve ownership dışı kaynaklara yazılmadı. `by_rule_started` indeksini koordinatör önceden ekledi; worker schema değişmedi. Commit/push/deploy/migration/paket kurulumu/kalıcı DB işlemi ve herhangi bir `npx convex` çağrısı yapılmadı.
- Gönderim run kanıtları tek transaction'da okunur; 200 cihaz / 100 kural / kural başına 500 üye / hedef başına 2000 op sınırları korunur. Büyük payload/çok hedefte run mutation'ının toplam Convex read/byte sınırı canlıda izlenmelidir; runtime kota ölçümü yapılmadı. Hata/ACK belirsizliği başarıya çevrilmez.
- Çok cihazlı bir action kısmen başarısızsa tam cihazı belirleyemeyen hata tüm ilgili hedeflerde saklanır; bu ihtiyatlı failed sonucu yaratabilir, teslimi kanıtsız verified yapmaz. 10 dk watchdog yarım dispatch'i unknown kapatır.
- Hedef araştırması 101 üyelik/201 linkte kesilirse `noTargets` iddiası yapılmaz; `pending` korunur. Eski çalışan update sync yolu ayrıca çalışmayı sürdürür.
- Projesiz eski vardiya serileri silinmeden bırakılır; sayaç `skippedAssignments` ile açıklanmalıdır. Sonraki veri temizliği ayrı görevdir.
- Frontend doğrulaması: bulk payload `resultMode:"detailed"`; noTargets etiketi; sensitiveMasked modunda hassas düzenleme beklentisi; ruleId geçmişi; queued/sent/verified ayrımı. 06 fixture tipi yeni alanla güncellenmeli.
