# C2b-07-api — Canlı İzleme backend sözleşmesi

## Sonuç ve sahiplik

- `convex/cardReadings.ts:121`: `listFiltered`; `:199`: `listLiveSince`; `:229`: `getReading`; `:241`: `assignCardFromReading`.
- `convex/lib/cardReadingAudit.ts:37`: kaynak, kapı `_id`, kişi kimliği/adı enrichment; mevcut commitlenmemiş `loadDevicesById` optimizasyonu korundu.
- Yeni `convex/lib/liveReadings.ts` ve `convex/lib/liveReadings.test.ts`: kaynak adaptörü, watermark/sıralama/birleştirme, sonuç eşleme, atama önkoşulları; 39 test.
- `convex/_generated/api.d.ts`: yalnız `lib/liveReadings` import/modül satırı eklendi.
- Koordinatör `schema.ts` içine `cardReadings.by_project_employee_time` ekledi; ben şemaya yazmadım.
- Ownership dışı tek satır: koordinatörün açık izniyle `reportScope.test.ts` mock'una `adminMutation` ekledim; koordinatör sonrasında mock'u tüm wrapper'ları içerecek biçimde devraldı/genişletti ve dokunmama talimatı verdi. Dosyanın son hali koordinatöre ait.
- Frontend, ingest, `pdksSource.ts`, `employees.ts` değişmedi; commit/push/deploy/migration/DB komutu çalıştırılmadı.

## Ortak dönüş tipleri

Aşağıdaki `Doc`/`Id` tipleri `convex/_generated/dataModel`, pagination tipleri `convex/server` kaynaklıdır. Frontend son sözleşmeyi `FunctionArgs<typeof api.cardReadings.X>` ve `FunctionReturnType<typeof api.cardReadings.X>` ile tüketmeli.

```ts
type Source = "card" | "qr" | "mobile" | "biometric" | "unknown";
type Result = "granted" | "denied" | "unknown";
type Reading = Doc<"cardReadings">; // Mevcut tüm saklanan alanlar aynen korunur.
type EnrichedReading = Reading & {
  source: Source;
  devices: { name: string; deviceSerial?: string } | null;
  door: {
    _id: Id<"doors">;
    name: string;
    readerName?: string;
    readerDirection?: "entry" | "exit" | "both";
  } | null;
  employees: {
    _id: Id<"employees">;
    firstName: string;
    lastName: string;
    departments: { name: string } | null;
  } | null;
};
type PaginationOpts = {
  numItems: number;
  cursor: string | null;
  endCursor?: string | null;
  maximumRowsRead?: number;
  maximumBytesRead?: number;
};
type Page<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};
```

`Reading` tam alan listesi: zorunlu `_id: Id<"cardReadings">`, `_creationTime: number`, `cardNo: string`, `accessTime: string`; opsiyonel `projectId: Id<"projects">`, `deviceId: Id<"devices">`, `employeeId: Id<"employees">`, `employeeName: string`, `accessStatus: "izin_verildi" | "reddedildi"`, `direction: "entry" | "exit"`, `ideIoId: number`, `rawData: string`, `hikMajorEventType: number`, `hikSubEventType: number`, `hikCurrentVerifyMode: string`, `hikSerialNo: number`, `hikFrontSerialNo: number`, `hikDevIndex: string`, `hikPictureURL: string`, `hikDateTime: string`, `hikMask: string`, `hikHelmet: string`, `hikTemperature: number`, `hikEventState: string`, `hikDenialReason: string`, `createdAt: string`, `updatedAt: string`.

`employees` güncel kişi enrichment'idir; olayın tarihsel kişi alanları `employeeId`/`employeeName` aynen kalır. Kart ataması eski okumaya kişi bağlamaz. Kapı eşlemesi IDE `deviceId + ideIoId` → `doors.deviceId + doors.ioId` ve aynı proje ile yapılır; Hik kapı eşlemesi bu dalganın sözleşmesi değildir.

## Yeni API'ler

### `cardReadings.listLiveSince` — authedQuery

```ts
args: { projectId: Id<"projects">; afterCreationTime?: number; limit: number }
returns: { rows: EnrichedReading[]; latestCreationTime: number | null; hasMore: boolean }
```

- `limit` 1–500 tam sayı; server `.take(limit + 1)` kullanır.
- İlk çağrı: **Türkiye gününde sunucuya alınan** son N kayıt; bugün tanımı `_creationTime >= TR 00:00`dır. Bu nedenle bugün geç teslim edilmiş, `accessTime` değeri dünde olan olay da gösterilir. Geçmiş olay günü araması `listFiltered` tarih filtreleriyle yapılır.
- Sonraki çağrı: `_creationTime > afterCreationTime`; cihaz olay zamanı/`createdAt` watermark değildir. Yeniden bağlantıda aynı watermark korunur.
- Sıralama `_creationTime` azalan; eşitlikte `_id` azalan; `_id` ile tekilleştirme yapılır. Boş delta önceki watermark'ı korur; tamamen boş ilk snapshot `null` döner.
- `hasMore` limit taşmasını bildirir. Delta taşmasında eksiksiz yakalama iddiası yok: “Yeni kayıtlar var · Yeniden yükle” göster, eski snapshot'ı koru; kullanıcının yeniden yüklemesi son N'yi yeni snapshot olarak alır.
- İlk snapshot'taki `hasMore` yalnız bugünün daha eski kayıtlarının tampon dışında kaldığını bildirir; snapshot kabul edilir, daha eski veriler Geçmiş görünümündedir.
- `by_project` index'inin Convex tarafından eklenen `_creationTime` son alanı kullanılır; yeni creation index gerekmedi.
- Proje değişiminde watermark/buffer/snapshot temizlenmeli. TR gün değişiminde yeniden başlangıç sorgusu yapılmalı; `Date.now()` tek başına reaktif gece yarısı tetikleyicisi değildir.

Frontend döngüsü (kavramsal; abonelik callback'i veya reconnect sorgusu):

```ts
type Live = FunctionReturnType<typeof api.cardReadings.listLiveSince>;
let watermark: number | undefined;
let buffer: Live["rows"] = [];
let reloadRequired = false;

function consume(response: Live) {
  const initial = watermark === undefined;
  if (!initial && response.hasMore) {
    reloadRequired = true;
    return; // Eksik aralığı sessizce geçip watermark ilerletme.
  }
  const byId = new Map((initial ? [] : buffer).map(row => [row._id, row]));
  for (const row of response.rows) byId.set(row._id, row);
  const all = [...byId.values()].sort((a, b) =>
    b._creationTime - a._creationTime || b._id.localeCompare(a._id));
  // Sunucu delta sınırı aşılmasa bile duraklatılmış yerel tampon taşabilir.
  if (!initial && all.length > 500) reloadRequired = true;
  buffer = all.slice(0, 500);
  watermark = response.latestCreationTime ?? undefined;
}
// Sorgu argümanı: { projectId, limit: 500, afterCreationTime: watermark }
// Duraklatma yalnız görünür snapshot'ı sabitler; buffer alımı devam eder.
// “Yeniden yükle”: watermark=undefined, buffer=[], reloadRequired=false;
// ilk yanıtı yeni snapshot yap. İlk snapshot satırları “yeni olay” sayılmaz.
```

Canlı endpoint kişi/kapı/sonuç argümanı almaz. Canlı tampon içinde filtreleme ve “yüklenen kayıtlarda” arama yereldir; eksiksiz tarihsel kişi/kapı/sonuç taraması için aşağıdaki sunucu sorgusu kullanılır. Yeni olay sayacı yalnız seçili filtreyle eşleşen benzersiz tampon satırlarından üretilmelidir.

### `cardReadings.listFiltered` — authedQuery

```ts
args: {
  projectId: Id<"projects">;
  deviceId?: Id<"devices">;
  employeeId?: Id<"employees">;
  doorId?: Id<"doors">;
  result?: "granted" | "denied" | "unknown";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  paginationOpts: PaginationOpts;
}
returns: Page<EnrichedReading> & { scannedCount: number; filterScope: "candidatePage" }
```

`numItems` pozitif tam sayı; server en fazla 200 aday satır ve `maximumRowsRead: 200` uygular. `page.length <= scannedCount`; bu sayı eşleşme toplamı veya günlük toplam değildir. Cursor filtre **öncesi** aday sayfasına aittir. `page: []` ile `isDone: false` geçerlidir; cursor sonuna kadar ilerletilince bütün seçili kapsam taranır. Filtreler sunucuda uygulanır fakat tek çağrı eşleşmeyen sayfaları sınırsız atlamaz. `pageStatus`/`splitCursor` Convex pagination alanları aynen aktarılır; usePaginatedQuery bunları yönetebilir.

Tarih sınırları TR gününün dahil UTC aralığıdır, `accessTime` üzerinden çalışır. Tek tarih tek gün; ikisi yoksa tüm zamanlar. Geçersiz/ters tarih reddedilir.

Index önceliği:

| Filtre | Index | Sayfa sonrası kalan denetim |
|---|---|---|
| Kapı (+diğerleri) | Mevcut `by_device_io_time` | Proje, kişi, sonuç |
| Kişi + cihaz | Mevcut `by_project_device_employee_time` | Sonuç |
| Kişi | **Koordinatör ekledi:** `by_project_employee_time` | Sonuç |
| Cihaz + sonuç | Mevcut `by_project_device_status_time` | Savunma amaçlı proje/sonuç |
| Sonuç | Mevcut `by_project_status_time` | Savunma amaçlı proje/sonuç |
| Cihaz | Mevcut `by_project_device_time` | Proje |
| Diğer | Mevcut `by_project_access_time` | Proje |

Her yolda tarih index aralığına uygulanır. `unknown` = `accessStatus` alanı bulunmayan kayıt, ret değildir. Kapının ve cihazın seçili projeye ait olduğu doğrulanır; kapı index'i proje içermediğinden dönen adaylarda ayrıca `projectId` kontrolü vardır. Kapı `deviceId/ioId` eşleşmiyorsa açıklayıcı hata döner; başka cihazla birlikte seçilemez. Kişi ID'si de proje kontrolünden geçer. `by_project_device_io_time` koordinatör kararıyla eklenmedi.

### `cardReadings.getReading` — authedQuery

```ts
args: { readingId: Id<"cardReadings"> }
returns: EnrichedReading | null
```

Projesiz, silinmiş veya kullanıcının erişemediği okuma `null`; geçerli okuma kişi/cihaz/kapı/kaynak ve mevcut `hikDenialReason` dahil döner. Kullanıcı giriş kontrolü zorunlu. Null metni: “Bu okuma artık görüntülenemiyor”. Teknik eski alanlar mevcut liste shape'iyle korunur; frontend fotoğraf/ham biyometri alanlarını görünür panele taşımamalı.

### `cardReadings.assignCardFromReading` — adminMutation

```ts
args: {
  readingId: Id<"cardReadings">;
  employeeId: Id<"employees">;
  expectedCurrentCard: string | null;
}
returns: {
  employeeId: Id<"employees">;
  cardNumber: string;
  syncStatus: "pending" | "notRequested";
}
```

- Her iki kayıt erişilebilir aynı projede olmalı; okumada `employeeId` zaten varsa reddedilir.
- Kaynak **ortak** `classifyReadingSource` sonucu `card` olmalı. QR, mobil, biyometri, PIN, manuel, bilinmeyen kaynak reddedilir.
- Fiziksel kart biçimi 1–32 ASCII harf/rakam/`_`/`-`; boşluk, URI, `IADE:` gibi işaretler, sıfırdan oluşan değerler ve `unknown/null/undefined/none` reddedilir. UUID QR kaynak kuralıyla reddedilir. Başındaki sıfırlar korunur; sayı dönüşümü/trim yoktur. Bu biçim kontrolü donanımda credential geçerliliği garantisi değildir.
- `expectedCurrentCard` birebir karşılaştırılır. Mevcut schema `cardNumber: string` zorunlu olduğundan boş kart `""` ise frontend **`""` göndermeli**, null'a çevirmemeli. null yalnız eksik eski alanla uyum içindir.
- Duplicate kuralı `employees.findDuplicateEmployee` ile aynı: global `by_card`, tam string eşitliği, hedef kişi hariç. En fazla iki aday yeterlidir; başka projedeki aynı kart da çakışır. Sıfır normalizasyonu yapılmaz.
- Yazma/senkron için `ctx.runMutation(api.employees.update, { employeeId, cardNumber })` çağrılır; aynı transaction içindeki alt transaction'dır. Mevcut update yetki/duplicate kontrolü, eski IDE kartını temizleme ve Hik+IDE yeni kart senkron planlaması korunur. Audit aynı dış mutation içindedir. Okuma satırı **patch edilmez**.
- `pending`: kart değişti, mevcut update senkron işlerini planladı; cihazda uygulandığı doğrulanmadı. Metin: “Kart kişiye atandı; cihaz uygulama durumu bekleniyor”.
- `notRequested`: aynı kart zaten bu kişide, mevcut update yeni senkron planlamadı. Metin: “Kart zaten bu kişiye atanmış; cihaz durumu bu işlemle doğrulanmadı”.

Atama önkoşul hataları `ConvexError<{code, message}>`:

| code | message |
|---|---|
| READING_NOT_FOUND | Bu okuma artık görüntülenemiyor |
| EMPLOYEE_NOT_FOUND | Kişi bulunamadı |
| PROJECT_MISMATCH | Okuma ve kişi aynı projede olmalı |
| READING_ALREADY_ASSIGNED | Bu okuma zaten bir kişiyle eşleşmiş |
| INVALID_CARD_SOURCE | Yalnız fiziksel kart okumalarından kart atanabilir |
| INVALID_CARD_NUMBER | Okumadaki kart numarası geçerli bir fiziksel kart değil |
| CARD_CHANGED | Kişinin kartı değişti. Güncel kartı kontrol edip yeniden onaylayın |
| DUPLICATE_CARD | Bu kart numarası başka bir personelde kullanılıyor |

Auth wrapper'ın “Giriş yapmanız gerekiyor”, “Bu işlem için yetkiniz yok” ve iç update'in genel hataları yapılandırılmış kod taşımayabilir; standart hata alanı da korunmalı. Tanımsız/erişimsiz kişi, bilgi sızdırmamak için EMPLOYEE_NOT_FOUND olur; iki erişilebilir ama farklı projedeki kayıt PROJECT_MISMATCH olur.

## Geriye uyumlu genişleyen mevcut API'ler

```ts
// cardReadings.list
args: {
  projectId: Id<"projects">; deviceId?: Id<"devices">;
  paginationOpts: PaginationOpts; startDate?: string; endDate?: string;
  accessFilter?: "all" | "granted" | "denied";
}
returns: Page<EnrichedReading>

// cardReadings.getRecentByProjects
args: { projectId?: Id<"projects">; projectIds?: Id<"projects">[]; limit?: number }
returns: (Reading & {
  source: Source;
  access_granted: boolean;
  device_name: string;
})[]

// cardReadings.listForEmployee — employeeAuthedQuery
args: { sessionToken: string; limit?: number }
returns: (Reading & {
  source: Source;
  device: {
    _id: Id<"devices">; name: string;
    description: string | null; deviceSerial: string | null;
  } | null;
})[]
```

Eski argümanlar kaldırılmadı. `getRecentByProjects` içindeki snake_case alanlar eski istemci sözleşmesidir; yeniden mapping eklenmedi/değiştirilmedi. Kaynak eklemesi dışındaki mevcut tarih, limit ve authorization davranışları korunur.

## Kaynak ve sonuç etiketleri

| source | Önerilen Türkçe etiket |
|---|---|
| card | Kart |
| qr | QR |
| mobile | Mobil |
| biometric | Biyometrik · PDKS dışı |
| unknown | Kaynak bilinmiyor |

PIN/manual ortak sınıflandırıcıda ayrı olsa da bu API'nin beşli enum'unda `unknown` olur. Hik kart+VEYA+yüz ve kanıtlı kart minor olayı `card`; VE/karma veya açık biyometrik minor `biometric` kalır. Sınıflandırıcı değişmedi. `granted` → “İzin verildi”, `denied` → “Reddedildi”, `unknown` → “Sonuç bilinmiyor”. Ret sebebi yoksa “Neden bilinmiyor”. Kaynak `card` otomatik PDKS uygunluk iddiası değildir.

## Saf helper sözleşmeleri

`liveReadings.ts` public Convex endpoint üretmez:

- `liveReadingSource(reading: PdksSourceReading): Source`
- `readingResult(accessStatus?: string): Result`
- `matchesReadingResult(accessStatus: string | undefined, result?: Result): boolean`
- `mergeLiveReadings<T extends {_id: string; _creationTime: number}>(previous: readonly T[], incoming: readonly T[], limit: number): T[]`
- `liveReadingWindow<T extends {_id: string; _creationTime: number}>(candidates: readonly T[], limit: number, afterCreationTime?: number): {rows: T[]; latestCreationTime: number | null; hasMore: boolean}`
- `isPhysicalCardNumber(cardNo: string): boolean`
- `assignmentPrecondition(input: {reading: PdksSourceReading & {cardNo: string; employeeId?: string}; employeeProjectId?: string; currentCard: string | null; expectedCurrentCard: string | null; duplicate: boolean}): AssignCardErrorCode | null`

Enrichment helper'ları `ctx: QueryCtx, readings: Doc<"cardReadings">[]` alır; `enrichReadingsForList` → `Promise<EnrichedReading[]>`, `enrichWithDeviceName` → yukarıdaki getRecentByProjects satır tipi dizisi Promise, `enrichWithDeviceInfo` → listForEmployee satır tipi dizisi Promise.

## Kapılar ve kalan sınırlar

- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: **0**.
- `node_modules/.bin/eslint src convex`: **0** hata/uyarı; backend dahil.
- `npx vitest run`: **87 test dosyası, 866 test geçti**; bu görevdeki test sayısı 39.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: ilk koşu **0**; son koşu paralel 06 frontend değişiklikleri başladıktan sonra **14 hata**, tümü `src/components/visitors/**` (eski formun daraltılmış list tipini kullanması, Object.hasOwn/Array.at, refreshKey prop). 07 kaynaklı hata yok; koordinatöre bildirildi.
- `git diff --check`: **0**.
- Testler gerçek registered handler ve gerçek dış/iç admin wrapper'larını çalıştırır; kimlik/proje lookup ve DB/scheduler transport test doubles'dır. Member reddi, iç update proje reddi, eski IDE kart temizliği sırası, iki cihaz senkronu, audit, eski okuma değişmezliği, duplicate/stale/biometric/foreign hata dalları, TR sınırı, geç gelen olay, taşma, boş filtre sayfası ve cursor devamı doğrulandı. Convex runtime transaction/optimistic retry ve gerçek cihaz teslimi çalıştırılmadı; DB/deploy yasağı korundu.
- Enrichment'teki cihaz batch yüklemesi korundu. Mevcut kapı enrichment helper'ı cihaz başına kapıları `.collect()` ile alır; bu görevde yeni sınırsız cardReadings taraması eklenmedi. Eski employees.update/accessGraph senkron çözüm yollarının tarama davranışı korunur.
- Canlı tampon eksiksiz arşiv değildir; sayısal watermark taşmasında yeniden yükleme gerekir. İlk gün tanımı sunucu alım günü olarak açıkça anlatılmalı; cihaz olay günü farklı olabilir.
- Frontend worker: pause/snapshot, overflow UI, boş sayfada devam, `_id` doğrudan panel açılışı, expectedCurrentCard'ın boş string dahil birebir iletimi ve “DB kaydı ≠ cihaz teslimi” metinlerini uygulamalı. Canlı ortam/devices üzerinde doğrulama yapılmadı.

## Düzeltme (api-fix)

- `convex/cardReadings.ts:242` / `convex/lib/liveReadings.ts:47`: `isActive=false` kişi yazım/senkron/audit öncesinde `ConvexError<{code:"EMPLOYEE_INACTIVE",message:"Pasif kişiye kart atanamaz"}>` ile reddedilir. Önkoşul helper'ına opsiyonel `employeeIsActive?: boolean` eklendi.
- `assignCardFromReading` args aynı; dönüş `syncStatus: "pending" | "notRequested" | "noTargets"`. **Yeni literal `noTargets`** kart değiştiği halde etkin kurallardan erişilen aktif desteklenen Hik/IDE hedefi bulunamadığında döner; önerilen metin “Kart atandı; gönderilecek cihaz yok”. Hedef okuması ortak `getEmployeeTargetDevices` ile 101 üyelik / 201 link sınırında yapılır; okuma kesilmişse hedefsizlik iddia edilmez, `pending` kalır. Aynı kart `notRequested` kalır; gerçek update/scheduler yolu korunur.
- Gerçek admin wrapper'ı testleri pasif kişi için hiçbir yan etki olmadığını, hedefsiz ve pasif cihazlı durumda `noTargets`, aktif IDE hedefinde `pending` sonucunu doğrular. Tam Vitest 93 dosya / 943 test, Convex tsc 0, eslint convex 0. Yeni literal frontend'e koordinatör aracılığıyla bildirildi.
