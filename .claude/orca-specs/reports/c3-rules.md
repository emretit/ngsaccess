# C3-rules — fark tabanlı kural kaydı ve sınırlı detay okuması

18.10.2026. Yalnız görev Ownership dosyaları değiştirildi; ortak `convex/_generated/api.d.ts` içinde yalnız `lib/accessRuleDiff` import/kayıt satırları eklendi. Şema, Hik/IDE motor dosyaları, canlı veritabanı değiştirilmedi; commit/push/deploy/migration, paket kurma, `npx convex` ve uygulamaya giriş yapılmadı.

## Değişiklikler

- `convex/accessRules.ts:535`: getDetails üye okuması `take(101)` → en fazla 100 joined üye + `membersTruncated`. `readRuleScope` (`:135`) cihaz/kapı ilişkilerini ayrı `take(51)` ile okur; birinin 50 sınırı aşılırsa panel kapsamı çıkarılmaz ve ilişki listeleri boş döner. Boşaltılan, aslında satırı bulunan her liste için `devicesTruncated`/`doorsTruncated=true`, ayrıca `scopeTruncated=true`; boş liste artık “hiç üye yok” iddiası değildir. Panel başına fiziksel kapı okuması da `take(17)`; aşım panel ve genel scope flag'ine yansır. getDetails okuma zincirinde collect kalmadı.
- `convex/accessRules.ts:893`: mevcut updateWithGroups'a opsiyonel `relationDiff` eklendi. Fark canlı ilişkiler üzerine aynı transaction'da uygulanır; yalnız gerçekten eklenen bağlar insert, gerçekten çıkarılan bağlar delete olur. Korunan satırların kimliği ve createdAt değeri korunur. Üye, panel ve açık kapı farkları aynı kurala uyar; ziyaretçi üyelikleri eskisi gibi değiştirilmez.
- `convex/lib/accessRuleDiff.ts:10`: açılış snapshot'ı → kullanıcı seçimi farkı; canlı kümeye explicit add/remove uygulama; legacy sınır koruması; değişiklik türüne göre senkron iş planı. Tekrar gönderim idempotenttir; aynı id'yi hem add hem remove yapmak reddedilir.
- `src/components/access-control/unified/lib/loadRuleEditor.ts:8` + `AccessRulesList.tsx:94`: getDetails yalnız meta/önizleme içindir. Düzenle tıklamasında people/devices/doors için ayrı cursor zincirleri, sayfa başına 50 ile, isDone olana kadar okunur. Üç zincir de başarıyla tamamlanınca editör açılır; ikinci sayfa hatasında kısmi editör açılmaz. Snapshot abonelik tarafından yeniden yazılmaz. Sayfalar arasında atomik snapshot garantisi yoktur; güvenliği sağlayan sunucunun explicit fark uygulamasıdır.
- `unified/hooks/useRuleForm.ts:55,160`: açılış ilişkileri ve alan değerleri sabitlenir. Kayıtta tam employeeIds/deviceIds/doorIds gönderilmez; relationDiff gönderilir. Değişmeyen scalar alanlar da gönderilmez, saat temizleme null ve priority=0 korunur. Bu ayrıca eski editörde değiştirilmemiş ad/saat alanlarının diğer yöneticinin son değerini ezmesini önler.
- `unified/components/selectionHelpers.ts:80`: kapı seçimi yalnız etkilenen panelin tüm-kapı fallback'ini açar; aday ağaçta görünmeyen açık kapı seçimlerini ve dokunulmayan panel fallback'ini korur. Böylece görünmeyen kapılar yanlışlıkla removed listesine dönüşmez.
- `src/hooks/access-rules/useComplexAccessRuleMutations.ts:102`: eski çağrılar korunur; diff kaydından sonra tekrar tam startRuleSync başlatılmaz. Backend transaction zaten gereken Hik/IDE işleri planlar. Create ve legacy update yollarındaki startRuleSync korunur.
- `unified/CreateRuleDialog.tsx:144`: diff kayıt açıklaması arka plan işlemini cihaz teslim kanıtı olarak sunmaz.
- `useGroupDeviceMutations.ts`, `useGroupMemberMutations.ts`: useToast → notify.
- `src/hooks/useAccessRules.ts:8`: iki tüketici yalnız mutation kullandığından gereksiz legacy `accessRules.list` aboneliği ve kullanılmayan sorgu dönüş alanları kaldırıldı; mutation adları/alias'ları korundu.

## API: TAM argüman ve dönüş tipleri

Yeni public mutation adı yoktur; mevcut imza opsiyonel alanla genişletildi:

```ts
type Diff<T extends string> = { added: T[]; removed: T[] };
type RuleRelationDiff = {
  employees: Diff<Id<"employees">>;
  devices: Diff<Id<"devices">>;
  doors: Diff<Id<"doors">>;
};
type UpdateWithGroupsArgs = {
  ruleId: Id<"accessRules">;
  name?: string;
  targetType?: string;
  description?: string;
  startTime?: string | null;
  endTime?: string | null;
  days?: string[];
  priority?: number;
  accessDirection?: string;
  isActive?: boolean;
  employeeIds?: Id<"employees">[];
  deviceIds?: Id<"devices">[];
  doorIds?: Id<"doors">[];
  projectId?: Id<"projects">;
  relationDiff?: RuleRelationDiff;
};
updateWithGroups(args: UpdateWithGroupsArgs): Promise<Id<"accessRules">>;
```

relationDiff varsa üç alt alan zorunlu; değişmeyen ilişki için `{added:[],removed:[]}` gönderilir. relationDiff ile herhangi bir eski tam liste alanı birlikte verilemez. projectId mevcut kuralın projesini değiştirmez; mevcut yetki/proje ve bağlı kayıt doğrulamaları korunur. Visitor kuralında employee farkı uygulanmaz.

```ts
type DetailsArgs = { ruleId: Id<"accessRules">; projectId?: Id<"projects"> };
type PersonPreview = Doc<"groupMembers"> & {
  employees: { id: Id<"employees">; firstName: string; lastName: string; email?: string } | null;
};
type DevicePreview = Doc<"groupDevices"> & {
  devices: {
    id: Id<"devices">; name: string; brand?: "hikvision" | "other" | "ide_smart";
    ideUuid?: string; deviceSerial?: string; zoneId?: Id<"zones">; doorId?: Id<"doors">;
  } | null;
};
type SelectedDoor = { doorId: Id<"doors">; deviceId?: Id<"devices">; name: string };
type PanelPreview = {
  deviceId: Id<"devices">; name: string; totalDoors: number; selectedDoors: number;
  wholePanel: boolean; label: string;
  doors: { doorId: Id<"doors">; name: string; zoneName: string | null }[];
  doorsTruncated: boolean; scopeTruncated: boolean;
};
type Details = Doc<"accessRules"> & {
  groupMembers: PersonPreview[];
  groupDevices: DevicePreview[];
  groupDoors: SelectedDoor[];
  panels: PanelPreview[];
  unassignedDoors: { doorId: Id<"doors">; name: string }[];
  membersTruncated: boolean;
  devicesTruncated: boolean;
  doorsTruncated: boolean;
  scopeTruncated: boolean;
};
getDetails(args: DetailsArgs): Promise<Details>;
```

Dönüşte mevcut alanlar korunur, üç yeni bool eklenir. `scopeTruncated` önce de vardı; şimdi detailed yolda da doğrudur. `readRuleScope` ortak olduğundan listSummaries satırlarına da ek devicesTruncated/doorsTruncated alanları gelir; imza ve önceki alanları değişmedi. `listRuleMembers({ruleId,kind,paginationOpts})` imzası/dönüşü aynen C2b sözleşmesidir (1–50 satır, ayrı cursor, nullable join).

Yeni/değişen yardımcıların tam tipleri:

```ts
buildRelationDiff<T extends string>(before: readonly T[], after: readonly T[]): Diff<T>;
applyRelationDiff<T extends string>(live: readonly T[], diff: Diff<T>): T[];
assertLegacyRuleReplacement(counts: {members: number; devices: number; doors: number}): void;
ruleDiffSyncPlan<T extends string>(args: {
  live: readonly T[]; next: readonly T[];
  scopeChanged: boolean; settingsChanged: boolean; activeChanged: boolean;
}): { added: T[]; removed: T[]; syncMembers: T[]; syncRule: boolean; reconcileRoster: boolean };
loadRuleEditor(
  client: Pick<ConvexReactClient, "query">,
  ruleId: Id<"accessRules">,
  projectId?: Id<"projects">
): Promise<AccessRule>; // src/types/access-control.ts mevcut AccessRule, tam cursor ilişkileriyle

type DoorSelection = {selected_devices: string[]; selected_doors: string[]};
toggleDoors(
  doors: readonly {_id: string; deviceId?: string}[],
  selection: DoorSelection,
  ids: readonly string[],
  checked: boolean
): DoorSelection;
```

Hook update parametresi mevcut `{id,updates,employeeIds?,deviceIds?,doorIds?}` üzerine `relationDiff?: RuleRelationDiff` ekler; mutateAsync dönüşü yine `Promise<Id<"accessRules">>`, isPending boolean. Create parametre/dönüşü değişmez.

## Hata kodları ve eski istemci davranışı

- `RULE_DIFF_MIXED_MODE`: relationDiff ve bir tam liste birlikte geldi. Yazmadan reddedilir.
- `RULE_DIFF_CONFLICT`: aynı ilişki id'si hem added hem removed listesinde. Yazmadan reddedilir.
- `RULE_MEMBERS_TRUNCATED`: herhangi bir tam liste gönderilmişken canlı kuralda >100 üye veya >50 cihaz veya >50 kapı bağı var. Sınırlı probe ile, alan patch'i, ilişki silme, tam validation taraması ve scheduler çağrısından önce reddedilir. Kullanıcıya sayfayı yenileyip düzenleyiciyi yeniden açması söylenir.

**Tasarım kararı:** Eski imza korunur; küçük kurallar için tam liste değiştirme davranışı devam eder. Büyük kurallarda istemci tam veri gönderdiğini iddia etse bile doğrulanabilir açılış kanıtı olmadığından tüm legacy replacement isteği reddedilir. Sadece silinen id'lerin sayısını kontrol etmek, getDetails'in kapsam hesaplayamadığında boş döndürdüğü diğer ilişkilerin silinmesini önleyemez; bu nedenle tek bir taşan ilişki bütün legacy replacement isteğini durdurur. Tam liste vermeyen metadata update bu guard'a takılmaz. Küçük kurallarda eski yazılımın stale tam listeyle concurrent üyeyi silme davranışı geriye uyumluluk gereği hâlâ vardır; yarış koruması yeni diff editöründedir. Eski yazılımla yeni diff argümanı gönderilmez; backend'in frontend'den önce yayınlanması gerekir.

## Hik/IDE senkron davranışı

- Yalnız üyelik farkı: gerçekten eklenen kişi → `syncEmployeeToDevicesInternal` + `reconcileRemovedEmployeeIde` (mevcut helper IDE sync'i planlar); gerçekten çıkarılan kişi → `deleteEmployeeFromDevicesInternal` + eski panelleri aday alan `reconcileRemovedEmployeeIde`. Başka kuralla kalan IDE erişimi düşürülmez; orphan kart mevcut helper ile kaldırılır.
- Hik kişi sync'i plan/template'ı da hazırlar; IDE kişi sync'i permission record'u user record'dan önce hazırlar. Bu nedenle değişmeyen bütün üyeleri yeniden gönderen kural plan çağrısı üyelik-only diff için gerekli değildir.
- Cihaz/kapı farkı veya aktiflik değişimi: Hik plan + IDE permission tetikleri ve tüm canlı kalan üyelerin kişi sync/reconcile işlemleri çalışır. Eşzamanlı eklenen üyeler bu canlı kümede bulunur. Eski paneller kapı-bağı değişiminde de reconcile adayıdır. Panel roster reconcile korunur.
- Saat/gün/ad vb. gerçek alan değişimi: mevcut Hik plan + IDE permission tetikleri korunur. Ayrı kişi sync'i yalnız yeni üyeler için olur (Hik plan action'ının kendi tam üyelik gönderimi motor içinde eskisi gibi sürer).
- Boş fark + değişmeyen scalar alanlar: ilişki yazımı ve senkron işi yok; updatedAt patch'i sürer.
- Diff ilişkileri yalnız explicit intent uygular. Panel bağı çıkarılırken başka adminin eklediği açık kapı bağı silinmez; bu kapı üzerinden erişim sürebilir. Kullanıcının bildiği kapılar seçimden kaldırıldığında door diff içinde ayrıca çıkarılır. Legacy yalnız-deviceIds çağrısının stale kapı temizliği aynı kalır.
- Diff frontend'i ek tam `startRuleSync` çağrısı yapmaz; aksi halde bütün üyeler yeniden gönderilir. **Bu diff kayıtları yeni deviceSyncRun geçmişi üretmez.** Bildirim/metin kayıt ile cihaz teslimini ayırır; adminin açık “Cihazlara gönder” işlemi ve create/legacy yolları run geçmişi üretmeye devam eder. Senkron motoruna/run şemasına müdahale edilmedi. Bu karar koordinatöre `msg_a4ce1839dbf3` ile çalışma sırasında bildirildi.

## Testler ve kapılar

Yeni saf testler ve gerçek handler'ların DB/scheduler mock'ları: `convex/lib/accessRuleDiff.test.ts` 29 test. İki sekme yarışı, görünmeyen üyenin korunması, başka adminin kaldırdığını geri eklememe, panel/kapı farkları, idempotency/dedupe, çelişkili fark, inclusive 100/50 sınırları ve aşım, yalnız değişen kişiye sync, kapsam/aktiflik/takvim işleri, gerçek mutation'ın yalnız hedef satırları yazması, legacy guard'ın hiçbir write/collect/schedule öncesinde çalışması, ziyaretçi koruması, sınırlı getDetails okumaları ve dürüst flag'ler kapsanır. Auth ve fiziksel motorlar bu testlerde mock'tur; canlı Convex transaction testi iddiası yoktur.

`loadRuleEditor.test.ts` 2 test: her kind için cursor tükenene kadar okuma ve getDetails önizlemesini üyelik saymama; ikinci sayfa hatasında editörün kısmi açılmaması. `selectionHelpers.test.ts` +2 regresyon: aday listede görünmeyen açık kapıyı koruma ve dokunulmayan panel fallback'ini değiştirmeme.

Son ortak ağaç kontrolü (18.10.2026, 15:11 çalışma):

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: 0.
- `node_modules/.bin/eslint src convex`: 0 hata/uyarı.
- `npx vitest run`: **106 dosya / 1101 test geçti**.
- Görev odaklı suite: **5 dosya / 49 test geçti**.
- `npx vite build`: 0; mevcut >500 kB chunk uyarısı var.
- `git diff --check`: 0.

## Koordinatör: gerçek oturumda 1440 + 390 kontrol akışları

1. Aynı kuralı yeni uygulamanın iki sekmesinde aç. A sekmesinde editör açık kalsın; B sekmesinde yeni kişi ekleyip kaydet. A'da yalnız adı değiştir veya başka bir üyeyi çıkarıp kaydet. Ayrıntının cursor kişi listesinde B'nin yeni kişisi korunmalı; A'nın explicit çıkarma/eklemesi uygulanmalı. Buradaki “eski editör”, yeni sürümün önceden açılmış snapshot'ıdır; eski frontend derlemesi değildir.
2. Aynı yarışı panel ve açık kapı için tekrarla. Bir panel bağı kaldırılırken B'nin eklediği açık kapı bağı korunur; kapsam açıklamasında kapı üzerinden kalan erişimi doğrula.
3. 101+ üyeli / 51+ cihaz veya kapılı kuralda getDetails flag'lerini kontrol et; Düzenle cursor zincirleri tamamlanınca tüm seçimlerle açılmalı. Ağda bir sonraki cursor isteğini başarısız yap: editör açılmamalı ve yeniden deneme çalışmalı.
4. Büyük kuralı eski frontend sekmesinden tam listeyle kaydet: RULE_MEMBERS_TRUNCATED, hiçbir alan/üye/cihaz/kapı değişmemeli. 100 üye / 50 cihaz / 50 kapı sınırına eşit küçük legacy kayıt kabul edilmeli.
5. Üyelik-only diff'te değişmeyen kişilere yeniden tam gönderim oluşmamalı; çıkarılan üyede başka kuralla erişim varsa korunmalı. Cihaz/kapı ekleme, kaldırma ve aktif/pasif geçişlerinde tüm etkilenen mevcut üyeler gönderilmeli/reconcile edilmeli. Gerçek Hik/IDE donanım sonucu ayrıca gözlenmeli; kayıt toast'ı teslim kanıtı değildir.
6. 1440 ve 390'da Kimler/Nerede adımları, uzun adlar, toplu seçim, dirty kapatma/proje değişimi, pending kaydı ve hata sonrası taslak korunmasını dene. Ziyaretçi şablonu, priority=0, saat temizleme ve görünmeyen kapı seçimini koruma akışlarını dene.

## Bilerek kalan sınırlar

Mutation ve mevcut access graph / validation yardımcılarının canlı bütün-kural collect taramaları korunur; bu iş getDetails public okumasını sınırlar, sınırsız büyüklükte kuralın tek transaction'da kaydedilebildiği iddiasında bulunmaz. Editör ilişkileri cursor ile sunucuda sınırlı sayfalardan okur ama açılmadan önce tüm snapshot'ı istemci belleğinde toplar; çok büyük kurallarda açılış daha uzun sürer. Tam dağıtık snapshot/sürüm kilidi, diff run audit geçmişi, fiziksel cihaz testi ve motor içi enqueue optimizasyonu kapsam dışıdır. Yeni UI'yi eski backend'e karşı yayınlamayın; opsiyonel argümanın validator'ı önce backend'de bulunmalıdır.
