# C3-rules-fix — izlenen diff gönderimi

18.10.2026. Denetim #1, #3, #4, #6 düzeltildi. Şema, cihaz protokolü ve mevcut `startRuleSync` / `startProjectResync` dispatch akışı değiştirilmedi. Commit/push/deploy/migration, canlı DB yazma, paket kurma, `npx convex` veya uygulamaya giriş yapılmadı. Paylaşılan ağaçtaki diğer worker değişiklikleri korunmuştur.

## Run nasıl üretiliyor?

- `convex/accessRules.ts:918,1057,1159`: eski `updateWithGroups` ve yeni `updateWithGroupsTracked`, aynı `saveWithGroups` transaction yardımcısını çağırır. Relation diff canlı ilişkiler üzerine uygulandıktan sonra `createRuleDiffRun` **aynı mutation transaction'ında** run + hedefleri + scheduler işlerini yazar. Kayıt başarılıysa takip kaydı da vardır; run oluşturma sınırı/hatası kural yazılarını da geri alır. Boş gerçek diff için `runId:null`, cihaz işi ve yeni run yoktur.
- `convex/deviceSyncRuns.ts:402`: proje cihazları en çok 201 okunur; 200 aşılırsa kayıt reddedilir. Tüm proje cihazları C2b ile aynı şekilde hedef olur; pasif, çevrimdışı, desteklenmeyen/eksik bağlantılı cihaz baştan gerekçeli `skipped` olur. Uygun cihazlar `executeRuleDiffTarget` işine girer; bu cihaz için gerçek değişiklik yoksa gerekçeli `skipped`. Her run `kind:"rule_sync"`, `ruleId`, auth kullanıcısından `startedBy` içerir; mevcut `listRecent({projectId,ruleId})` bunu kuralın geçmişinde gösterir.
- `convex/deviceSyncRuns.ts:455`: çalışan işi yalnız `plan.removed ∪ plan.syncMembers` kümesine aittir. Salt üyelik değişiminde değişmeyen kişiler gönderilmez. Kapsam/aktiflik değişiminde tüm kalan kişiler planlanır; salt saat/gün gibi ayar değişiminde plan/izin gönderilir. Run işi `startRuleSync` çağırmaz.
- Hik ekleme → `syncEmployeeToDevicesInternal({employeeId,runId,targetDeviceIds})`; run yolu hafta planı/şablon/kart hatalarını da başarısız sayar. Çıkarılan kişinin eski hedefi `wasRuleTarget` ile korunur; artık erişimi yoksa `deleteEmployeeFromDevicesInternal` eski hedef snapshot'ı ile çağrılır. Başka aktif kuralla aynı cihaza erişimi sürüyorsa kişi silinmez, kalan yetkisi yeniden gönderilir. localBridge plan/kişi/silme op'larında runId vardır. Gateway sonuçları hedefte kalıcı olarak kaydedilir, cihaz doğrulaması diye sunulmaz.
- IDE ekleme/kalan yetki → mevcut `syncEmployeeToIdePanels` runId + hedef filtresiyle çağrılır. Orphan silme → `deleteIdeUserFromPanels` yeni opsiyonel runId ile `deleteUser` op'unu damgalar. Kapı bacağıyla korunan kartlar kanonik `resolvePanelAuthorizedCards` üzerinden korunur. Kapsam/aktiflik değişiminde etkilenen eski/yeni panel roster'ının yetkisiz kartları da aynı run'a bağlanır.
- `convex/actions/hikvisionSync.ts:493`: hafta planı action'ına opsiyonel `targetEmployeeIds` geldi. Diff dispatcher plan gönderirken `[]` verir, sonra seçilmiş kişi işlerini gönderir. Böylece eksik hafta planı tam kuralın üyelerini yeniden göndermeye neden olmaz. Arg yoksa eski full action tüm üyeleri gönderir; test bunu doğrular. Hik kişinin pasifleştiği yarışta run yolu silmeyi await eder; hedef dispatch silme enqueue edilmeden tamamlanmaz.
- Hedeflerde mevcut `finishTarget` ve C2b tek run refresh zinciri kullanılır: queued → Hik sent (teslim kanıtı yok), IDE bütün op'lar zaman damgalı ACK ise verified, hata failed, uygunsuz/işsiz skipped, kanıtsız/zaman aşımı unknown. Failure + bekleyen op kombinasyonu C2b gibi terminal kanıtı bekler. 5/15/30/60 sn backoff ve 10 dk watchdog aynen korunur; yeni hedef başına polling zinciri yoktur.

## Diğer düzeltmeler

- `convex/accessRules.ts:165`: `devicesTruncated` ve `doorsTruncated` ayrı ayrı `length > SUMMARY_RELATION_LIMIT` (50) kullanır; karşı liste aştığı için küçük liste artık yanlışlıkla truncated sayılmaz.
- `convex/accessRules.ts:958` + `convex/lib/accessRuleDiff.ts:52`: diff'in açıkça çıkardığı cihazlara ait kapılar canlı `doors.deviceId` ile bulunur ve next door listesinden çıkarılır; `relationDiff.doors.added` içindekiler korunur. Eşzamanlı eklenmiş eski bağ da bu temizlikten geçer; kapı başka cihaza taşınmışsa canlı sahipliği kullanılır. Silme tek ilişki diff'i içinde olduğundan aynı satır iki kez silinmez.
- `convex/lib/accessRuleDiff.ts:33`: `missingWeekPlan && added.length > 0` halinde `syncRule:true`. Üye listesindeki değişmeyenler `syncMembers` içine alınmaz; boş diff eksik plan var diye gönderim başlatmaz. Dispatcher `ensureWeekPlan` ile atomik plan atar.

## Frontend ve eski istemci davranışı

- `src/hooks/access-rules/useComplexAccessRuleMutations.ts:113`: relationDiff taşıyan istemci yeni mutation'ı çağırır ve `{ruleId,runId}` geri bildirimini üst bileşene iletir. Hook'un dış `mutateAsync` dönüşü eskisi gibi rule Id kalır. Legacy tam-liste update ve create mevcut background full-send yolunu sürdürür.
- `UnifiedAccessControl.tsx:30` + `SyncRuns.tsx:201`: editör kapandıktan sonra kalıcı kayıt bildirimi görünür. Run varsa **Gönderim sonucunu aç**, o kaydın tam runId'siyle mevcut `SyncRunSheet` açar. Toast bu bağlantıya yönlendirir; uygulanmış/teslim edilmiş diye başarı iddiası yoktur.
- Run yoksa bildirim **Değişiklik yok; cihazlara yeni işlem gönderilmedi** der ve **Cihazlara gönder** butonu mevcut `startRuleSync({ruleId})` yolunu çalıştırır. Başlatılan run aynı sheet'te açılır; beklerken çift çağrı `useAsyncAction` ile engellenir, hata `notify` ile görünür. Bu retry kural kapsamındadır; mevcut proje gönderim butonu değişmedi.
- Eski `updateWithGroups` arg ve dönüş sözleşmesi korunur: relationDiff yoksa eski scheduler akışı, varsa yeni takipli diff akışı çalışır; her durumda `Id<"accessRules">` döner. Yeni mutation yalnız ek API'dir. Yeni callback parametreleri opsiyoneldir. `_generated/api.d.ts` değişikliği gerekmedi: mevcut modül import'ları yeni export'ların tiplerini otomatik taşır.

## Yeni/değişen fonksiyonların tipleri

`Id` / `Doc`: `convex/_generated/dataModel`; `MutationCtx`: generated server. Aşağıdaki callable imzalar Convex handler'ların wire giriş/çıkışlarını gösterir; void handler wire'da null olur.

```ts
type RelationDiff<T extends string> = { added: T[]; removed: T[] };
type UpdateWithGroupsArgs = {
  ruleId: Id<"accessRules">;
  name?: string; targetType?: string; description?: string;
  startTime?: string | null; endTime?: string | null;
  days?: string[]; priority?: number; accessDirection?: string; isActive?: boolean;
  employeeIds?: Id<"employees">[]; deviceIds?: Id<"devices">[]; doorIds?: Id<"doors">[];
  projectId?: Id<"projects">;
  relationDiff?: {
    employees: RelationDiff<Id<"employees">>;
    devices: RelationDiff<Id<"devices">>;
    doors: RelationDiff<Id<"doors">>;
  };
};
type RuleSaveResult = { ruleId: Id<"accessRules">; runId: Id<"deviceSyncRuns"> | null };
updateWithGroups(args: UpdateWithGroupsArgs): Promise<Id<"accessRules">>;
updateWithGroupsTracked(args: UpdateWithGroupsArgs): Promise<RuleSaveResult>;
// Tracked API, relationDiff yoksa yazmadan "İzlenen kayıt için ilişki farkı gerekli" hatası verir.
saveWithGroups(ctx: MutationCtx & { user: Doc<"users"> }, args: UpdateWithGroupsArgs): Promise<RuleSaveResult>;

type RuleDiffDispatch = {
  syncMembers: Id<"employees">[]; removed: Id<"employees">[];
  syncRule: boolean; reconcileRoster: boolean;
};
createRuleDiffRun(ctx: MutationCtx, args: {
  ruleId: Id<"accessRules">; projectId: Id<"projects">; startedBy: Id<"users">;
  beforeDeviceIds: Id<"devices">[]; plan: RuleDiffDispatch;
}): Promise<Id<"deviceSyncRuns"> | null>;
// Normal TS yardımcısı; public/internal Convex endpoint değildir.

diffIdeContext(args: {
  deviceId: Id<"devices">; reconcileRoster: boolean;
}): Promise<{ authorizedCards: string[]; orphanCards: string[] }>;
executeRuleDiffTarget(args: {
  targetId: Id<"deviceSyncRunTargets">; ruleId: Id<"accessRules">;
  syncMembers: Id<"employees">[]; removed: Id<"employees">[];
  syncRule: boolean; reconcileRoster: boolean; wasRuleTarget: boolean;
}): Promise<void>;

ruleDiffSyncPlan<T extends string>(args: {
  live: readonly T[]; next: readonly T[];
  scopeChanged: boolean; settingsChanged: boolean; activeChanged: boolean;
  missingWeekPlan?: boolean;
}): { added: T[]; removed: T[]; syncMembers: T[]; syncRule: boolean; reconcileRoster: boolean };
retainedDiffDoorIds<T extends string, D extends string>(
  next: readonly T[], doorDeviceById: ReadonlyMap<T, D | undefined>,
  removedDevices: ReadonlySet<D>, explicitlyAdded: ReadonlySet<T>
): T[];

syncEmployeeToDevicesInternal(args: {
  employeeId: Id<"employees">; allowedProjectIds?: Id<"projects">[];
  runId?: Id<"deviceSyncRuns">; targetDeviceIds?: Id<"devices">[];
}): Promise<{ synced: number; failed: number; errors: string[] }>;

type DeleteDevice = {
  _id: Id<"devices">; name: string;
  brand?: "hikvision" | "other" | "ide_smart"; projectId?: Id<"projects">;
  hikDevIndex?: string; hikTransport?: "gateway" | "localBridge"; hikDoorCount?: number;
};
deleteEmployeeFromDevicesInternal(args: {
  employeeId: Id<"employees">; allowedProjectIds?: Id<"projects">[];
  runId?: Id<"deviceSyncRuns">; targetDeviceIds?: Id<"devices">[];
  snapshot?: { cardNumber: string; projectId?: Id<"projects">; devices: DeleteDevice[] };
}): Promise<{ removed: number; failed: number; errors: string[] }>;
syncWeekPlanToDevicesInternal(args: {
  accessRuleId: Id<"accessRules">; allowedProjectIds?: Id<"projects">[];
  runId?: Id<"deviceSyncRuns">; targetDeviceIds?: Id<"devices">[];
  targetEmployeeIds?: Id<"employees">[];
}): Promise<{ synced: number; failed: number; errors: string[]; employeesSynced: number }>;
deleteIdeUserFromPanels(args: {
  cardNumber: string; deviceIds: Id<"devices">[]; projectId?: Id<"projects">;
  runId?: Id<"deviceSyncRuns">;
}): Promise<{ ok: boolean; queued: number }>;

getAccessRuleWithDevices(args: { accessRuleId: Id<"accessRules"> }): Promise<{
  rule: {
    _id: Id<"accessRules">; name: string; isActive: boolean;
    startTime: string | undefined; endTime: string | undefined; days: string[] | undefined;
    hikWeekPlanNo: number | undefined; idePermissionNo: number | undefined;
    projectId: Id<"projects"> | undefined;
  };
  devices: (DeleteDevice & { deviceIp?: string; deviceSerial?: string })[];
  employees: { _id: Id<"employees">; firstName: string; lastName: string; cardNumber: string }[];
} | null>;
// Değişiklik: rule.isActive eklendi; employee._id string'den Id<"employees"> olarak daraltıldı.

RuleSaveNotice(props: { result: RuleSaveResult; onDismiss: () => void }): React.JSX.Element;
// useComplexAccessRuleMutations(onDiffSaved?: (result: RuleSaveResult) => void)
// ve useRuleForm(editingRule: AccessRule | null | undefined, open: boolean,
//   onClose: () => void, onDiffSaved?: (result: RuleSaveResult) => void)
// yalnız opsiyonel callback ile genişletildi; mevcut dönüş nesneleri aynen korundu.
// CreateRuleDialog props tam şekli:
type CreateRuleDialogProps = {
  open: boolean; onOpenChange: (open: boolean) => void;
  editingRule?: AccessRule | null; onClose: () => void;
  onDiffSaved?: (result: RuleSaveResult) => void;
};
```

Frontend hook dönüş sözleşmeleri (önceki alanlar değişmedi):

```ts
type CreateRuleWithMembersParams = {
  rule: {
    name: string; description?: string; targetType: string;
    startTime?: string; endTime?: string; days: string[];
    accessDirection: string; priority: number; projectId?: Id<"projects">;
  };
  employeeIds?: Id<"employees">[]; deviceIds?: Id<"devices">[]; doorIds?: Id<"doors">[];
};
type UpdateRuleWithMembersParams = {
  id: Id<"accessRules">;
  updates: {
    name?: string; description?: string; targetType?: string;
    startTime?: string | null; endTime?: string | null; days?: string[];
    accessDirection?: string; priority?: number; projectId?: Id<"projects">; isActive?: boolean;
  };
  relationDiff?: UpdateWithGroupsArgs["relationDiff"];
  employeeIds?: Id<"employees">[]; deviceIds?: Id<"devices">[]; doorIds?: Id<"doors">[];
};
useComplexAccessRuleMutations(onDiffSaved?: (result: RuleSaveResult) => void): {
  createAccessRuleWithMembers: {
    mutateAsync: (params: CreateRuleWithMembersParams) => Promise<Id<"accessRules">>;
    isPending: boolean;
  };
  updateAccessRuleWithAdditionalMembers: {
    mutateAsync: (params: UpdateRuleWithMembersParams) => Promise<Id<"accessRules">>;
    isPending: boolean;
  };
};
type RuleFormData = {
  name: string; description: string;
  target_type: "all" | "department" | "position" | "individual" | "visitor";
  selected_employees: string[]; selected_devices: string[]; selected_doors: string[];
  start_time: string; end_time: string; days: string[];
  access_direction: "entry" | "exit" | "both"; priority: number;
};
useRuleForm(editingRule: AccessRule | null | undefined, open: boolean,
  onClose: () => void, onDiffSaved?: (result: RuleSaveResult) => void): {
  isDirty: boolean; projectId: Id<"projects"> | undefined;
  formData: RuleFormData; setFormData: React.Dispatch<React.SetStateAction<RuleFormData>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  errors: Record<string, string>; isSubmitting: boolean;
};
```

## Testler ve kapılar

18.10.2026, paylaşılan çalışma ağacında:

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: 0 hata.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: 0 hata.
- `node_modules/.bin/eslint src convex`: 0 hata, 0 uyarı.
- `npx vitest run`: **107 dosya / 1121 test geçti**.
- `npx vite build`: geçti; yalnız mevcut >500 kB chunk uyarısı.
- `git diff --check`: temiz.

Önemli yeni regresyonlar: yalnız eklenen/çıkarılan kişi planı; no-op run/scheduler üretmeme; iki marka için runId + targetDeviceIds; eski hedef snapshot'ı ile Hik silme; IDE orphan silme runId'si; hedef hatasının failed olarak korunması; plan-only Hik action'ının değişmeyen üyeleri göndermemesi; opsiyonel arg yokken full action'ın bütün üyeleri göndermesi; canlı kapı sahipliği + eşzamanlı explicit added kapı koruması; ayrı truncation bayrakları; eksik Hik planı; boş kayıtta retry ve normal kayıtta sonuç bağlantısı.

Dosyalar: `convex/lib/accessRuleDiff.test.ts`, `convex/lib/deviceSyncRun.test.ts`, `src/components/access-control/unified/SyncRuns.test.tsx`. Testler saf planlama, in-memory gerçek handler çağrıları ve statik React render kullanır; canlı scheduler veya fiziksel cihaz entegrasyonu iddiası yoktur.

## Koordinatörün gerçek oturumda bakacağı akışlar (1440 + 390)

1. Hik + IDE hedefli, en az iki üyeli aktif kurala bir kişi ekle, kaydet. **Gönderim sonucunu aç** o kaydın run'ını açmalı; kural ayrıntısındaki **Kuralın son gönderimi** ile proje **Son gönderimler** aynı run'ı göstermeli. Eski üyeler için kişi op'u oluşmamalı. Hik sent, IDE ACK gelene kadar queued ve bütün zaman damgalı ACK'lerden sonra verified olmalı.
2. Bir kişiyi çıkar: yalnız bu kuralla bağlı eski Hik cihazına delete, IDE paneline deleteUser; başka kuralla yetki sürüyorsa kişi silinmeden kalan yetkiler güncellenmeli. Hata durumunda hedef adı + reason görünmeli.
3. Kuralı yeniden açıp hiçbir alanı değiştirmeden kaydet: yeni run oluşmamalı; **Cihazlara gönder** önerisi görünmeli. Buton mevcut tam kural gönderimini başlatmalı ve sonucunu açmalı; beklerken ikinci tık engellenmeli.
4. Kapsam cihazını çıkar: o cihaza ait eski groupDoors bağları temizlenmeli; aynı isteğin doors.added listesinde bulunan kapı korunmalı. Kapsam değişiminde kalan üyelerin yeni izinleri ve eski panel orphan silmeleri aynı run'da görünmeli.
5. hikWeekPlanNo atanmamış aktif kurala yalnız kişi ekle: plan atanıp gönderilmeli; değişmeyen üyeler tekrar gönderilmemeli.
6. 390px'te bildirim metni ve butonları sarmalı; run sheet yatay taşmamalı, cihaz nedenleri okunabilmeli. Proje değişiminde Layout remount kayıt bildirimi state'ini temizlemeli.

## Sınırlar / ertelenenler

Run başarısı cihaz teslim onayıyla eşitlenmez; C2b timeout/terminal snapshot semantiği değişmedi. Yeni diff yolu 200 proje cihazı / 500 benzersiz etkilenen kişi sınırında kayıt reddeder; roster 2000 üzerinde hedef açık hata verir, sessiz kırpma yoktur. Eski access graph / getEmployeeWithDevices / getAccessRuleWithDevices yardımcılarının sınırsız graph okumaları korunmuştur; bu görev bütün senkron motorunun ölçekleme yeniden yazımı değildir. Gönderim action'ları çalışırken canlı yetki grafını okur; kural revizyon snapshot'ı veya cihazlar arasında fiziksel sıra garantisi eklenmedi. Gerçek oturum, ACK ve cihaz doğrulaması koordinatörde; denetim #2/#5/#7/#8 ve sayfa düzeni kapsam dışıdır.
