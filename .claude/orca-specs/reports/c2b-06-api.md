# C2b-06-api teslim raporu

## Sonuç ve dosyalar

`convex/visitors.ts`: yeni `listPage`, `summary`, `getDetail`; eski `list` korunarak yalnız `status` eklendi. `create` ve `update` ortak TR bitiş doğrulaması kullanır. `convex/lib/visitorStatus.ts` saf durum/arama/maskeleme/zaman/doğrulama yardımcıları ve `visitorStatus.test.ts` eklendi. `convex/_generated/api.d.ts` yalnız `lib/visitorStatus` import ve modül satırı eklendi. Schema/frontend değişmedi; commit, push, deploy, migration, DB komutu çalıştırılmadı.

## Tam yeni API sözleşmesi

Frontend sonuç tiplerini `FunctionReturnType<typeof api.visitors.listPage>` / `summary` / `getDetail` ile türetsin. Aşağıdaki tüm nullable alanlar yanıtta bulunur; `?` yalnız argümanlarda ve Convex pagination metadata'sındadır.

```ts
import type { Doc, Id } from "convex/_generated/dataModel";
import type { PaginationOptions, PaginationResult } from "convex/server";
type VisitorStatus = "active" | "checkedOut" | "expired" | "preRegistered" | "inactive";
type VisitorRow = {
  _id: Id<"employees">;
  firstName: string;
  lastName: string;
  company: string | null;
  cardNumber: string; // daima maskeli: “•••• 5678” veya “İade edildi”
  hostName: string | null;
  presetRuleName: string | null;
  visitStart: string | null; // accessStartsAt, kayıt/log; erişimi etkilemez
  visitEnd: string | null; // accessExpiresAt
  status: VisitorStatus;
  lastSeenAt: string | null;
  lastDirection: string | null; // mevcut visitorPresence tipi; değer entry/exit/null
  presence: "inside" | "outside" | "unknown";
  hasKvkkConsent: boolean;
};
// listPage arg:
type ListPageArgs = {
  projectId: Id<"projects">;
  status?: VisitorStatus;
  search?: string;
  paginationOpts: PaginationOptions;
  refreshKey?: number;
};
// paginationOpts: numItems:number (tam sayı 1–100), cursor:string|null,
// endCursor?:string|null, maximumRowsRead?:number, maximumBytesRead?:number.
type ListPageResult = PaginationResult<VisitorRow> & {
  searchScope: "page";
  statusScope: "page";
  scannedCount: number;
  evaluatedAt: string;
};
// PaginationResult: page:VisitorRow[], isDone:boolean, continueCursor:string,
// splitCursor?:string|null, pageStatus?:"SplitRecommended"|"SplitRequired"|null.

type SummaryArgs = { projectId: Id<"projects">; refreshKey?: number };
type SummaryResult = {
  total: number;
  counts: { active:number; checkedOut:number; expired:number; preRegistered:number; inactive:number };
  accessActive: number;
  accessClosed: number;
  inside: number;
  truncated: boolean;
  scanLimit: number; // 500
  evaluatedAt: string;
};

type GetDetailArgs = { visitorId: Id<"employees">; refreshKey?: number };
type DetailResult = null | (VisitorRow & {
  projectId: Id<"projects">;
  cardNumber: string; // ayrıntıda gerçek değer; IADE: sentinel varsa cardReleased=true
  cardReleased: boolean;
  isActive: boolean;
  hostEmployeeId: Id<"employees"> | null;
  presetRuleId: Id<"accessRules"> | null;
  email: string;
  tcNo: string | null;
  visitorPhone: string | null;
  visitorCompany: string | null;
  visitPurpose: string | null;
  notes: string | null;
  kvkkConsent: null | { grantedAt: string; documentUrl: string | null; version: null };
  recentReadings: Array<{
    _id: Id<"cardReadings">;
    accessTime: string;
    accessStatus: "izin_verildi" | "reddedildi" | null;
    direction: "entry" | "exit" | null;
    deviceId: Id<"devices"> | null;
  }>;
});
```

Tüm yeni sorgular `authedQuery`; proje `resolveProjectScope` ile doğrulanır. `getDetail` olmayan/ziyaretçi olmayan kayda `null`, yetkisiz veya projesiz kayda hata verir; bağlı ev sahibi, kural ve okumalar yalnız ziyaretçinin projesindeyse döner. Ayrıntının hassas alanları yetkili proje üyelerine sunulur; UI tam kart/iletişim/notu ancak açık istekte gösterir. Listede TC, telefon, e-posta, not veya çalışan doc spread'i yoktur. Kart geçmişi için ayrı audit taraması eklenmedi; mevcut gerçek kart/sentinel ve `cardReleased` ayrımı yeterlidir.

## Durum sözleşmesi

Öncelik sırası tek `visitorStatus` yardımcısındadır; liste, özet ve ayrıntı aynı sınıflamayı kullanır.

| Enum | Türkçe etiket | Ton | Kural |
|---|---|---|---|
| checkedOut | Ziyaret sonlandırıldı | neutral | visitorStatus=checkedOut; süre dolsa da korunur |
| expired | Süresi doldu | warning | visitorStatus=expired veya bitiş <= sunucu şimdi; cron beklenmez |
| active | Erişim aktif | success | yukarıdakiler değil ve isActive=true |
| preRegistered | Ön kayıt | neutral | aktif değil, visitorStatus=preRegistered |
| inactive | Pasif | neutral | diğerleri |

“İçeride/ayrıldı/bekleniyor” erişim enum'u olarak kullanılmadı: rapordaki **erişim/konum ayrımı** korundu. Son konum bağımsızdır; manuel sonlandırma ve expiry fiziksel exit üretmez. Başlangıç tarihi yalnız log alanıdır, gelecekte olması erişimi beklemeye almaz. Eksik/geçersiz eski bitiş tarihleri kendiliğinden expired sayılmaz; aktivasyon mutlaka geçerli gelecek bitiş ister.

`refreshKey` opsiyonel cache yenileme anahtarıdır, sunucu zamanını belirlemez. Frontend açık sayfa/panelde `Math.floor(Date.now()/60000)` değerini dakika başı yenileyerek üç sorguya versin; `Date.now()` tek başına Convex aboneliğini zaman geçişinde tetiklemez. `evaluatedAt` listede/özette sunucunun sınıflama anıdır. `undefined` sonuç sırasında sayaçlarda 0 değil iskelet gösterilmeli.

## Sayfalama, arama ve tarama sınırları

- Proje+ziyaretçi `by_project_visitor` indeksi üzerinden, en yeni kayıt önce, gerçek Convex `.paginate()` kullanılır. `numItems` 1–100. Cursor ham kayıt sayfasına aittir.
- Arama **sunucuda, yalnız alınan sayfa içinde**: trim + `toLocaleLowerCase('tr')`, ad/soyad/tam ad/şirket/gerçek kart substring. Mevcut ad/soyad search indeksleri dört alanlı substring davranışını sağlamadığı için kullanılmadı; schema/index ihtiyacı yok.
- Durum süzme de **sunucuda, sayfa içinde**; hem `searchScope` hem `statusScope` açıkça `page` döner. Süzme sonrası sayfa boş olup `isDone=false` olabilir; “hiç sonuç yok” veya “toplam eşleşme” iddiası kurulmaz. Cursor bitene kadar diğer sayfalara gidilebilir; proje/arama/status değişince pagination başa alınmalı.
- `summary` arama, durum ve görünen sayfadan bağımsız, son **500** proje ziyaretçisini sınıflar. Fazladan 1 kayıt okunarak `truncated` belirlenir. `false` ise tüm proje toplamları; `true` ise tüm sayaçlar sadece taranan son 500 kaydın sayılarıdır ve UI bunu açıkça yazmalıdır. `inside`, erişim aktif ve kapalı ile kesişir; dört sayaç birbirine toplanmaz.
- Konum sorgusu ziyaretçi başına `by_employee_status_time` ile son izinli olayı ve aynı zamandaki en fazla 51 olayı okur; 50'den çok eşzamanlı olayda yanlış kesinlik yerine unknown. Son olay yönsüzse unknown. Tüm kayıtlardaki retler konumu değiştirmez. Proje dışı son olay unknown; dış proje bilgisi gösterilmez.
- Ayrıntı son okumalar için izinli/ret/durumsuz üç index aralığından en fazla 10'ar kayıt alır; proje doğrulayıp zamana göre birleştirir, en fazla **10** döner. Bozuk çapraz proje ilişkilerinde güvenli biçimde daha az dönebilir.
- Rıza `by_employee_type(visitor_kvkk)` içinde en yeni aktif kayıt bulunana kadar iterasyonla aranır; keyfi ilk-N keserek yanlış “rıza yok” üretilmez. Olağandışı çok uzun tamamen iptal edilmiş rıza geçmişi Convex okuma sınırına takılabilir; ayrı aktif-rıza indeksi/counter ileride optimizasyon gerektirebilir. Şemada sürüm alanı yok; `version:null` dürüstçe döner, metin/sürüm uydurulmaz.

## Değişen mevcut fonksiyonlar

```ts
// list args ve tüm eski alanları aynı; ek status alanı:
type LegacyListArgs = { projectId?: Id<"projects"> };
type LegacyListResult = Array<Doc<"employees"> & {
  status: VisitorStatus;
  host: { _id:Id<"employees">; firstName:string; lastName:string } | null;
  presetRule: { _id:Id<"accessRules">; name:string } | null;
  lastDirection: string | null; lastReadingAt: string | null;
  presence: "inside" | "outside" | "unknown";
  hasKvkkConsent:boolean; kvkkConsentAt:string|null;
}>;
// Legacy list bütün çalışan doc'u ve sınırsız eski collect davranışını geçiş uyumluluğu
// için korur; yeni frontend listPage kullanmalıdır.

type CreateArgs = {
  projectId?: Id<"projects">;
  firstName:string; lastName:string; email?:string; cardNumber:string;
  presetRuleId:Id<"accessRules">; accessExpiresAt:string; accessStartsAt?:string;
  visitorPhone?:string; visitorCompany?:string; visitPurpose?:string;
  hostEmployeeId?:Id<"employees">; isActive?:boolean; notes?:string; kvkkConsent?:boolean;
};
type CreateResult = Id<"employees">;

type UpdateArgs = {
  visitorId: Id<"employees">;
  projectId?: Id<"projects">;
  firstName?:string; lastName?:string; cardNumber?:string; accessExpiresAt?:string;
  visitorPhone?:string|null; visitorCompany?:string|null; visitPurpose?:string|null;
  hostEmployeeId?:Id<"employees">|null; isActive?:boolean; notes?:string|null;
  kvkkConsent?:boolean;
};
type UpdateResult = Id<"employees">;
```

`create` imzası aynı; geçerli bitiş ortak yardımcıyla doğrulanır ve UTC ISO kaydedilir. Ofsetsiz `YYYY-MM-DDTHH:mm[:ss[.SSS]]` Türkiye +03:00 kabul edilir; ofsetli ISO anı korunur, geçersiz takvim günü/saat reddedilir. `visitorTime`/`visitorExpiryValidation` frontend'in de import edebileceği saf yardımcıdır.

`update` imzası aynı. Bitiş gönderilmezse veya birebir aynıysa geçmiş tarih kişisel bilgi düzenlemesini engellemez. Pasiften aktife geçişte args verilmemiş olsa dahi **etkin** bitiş yeniden doğrulanır; geçmiş/geçersiz bitişle aktifleşme olmaz. Değişen bitiş de geçerli gelecek zaman olmalı, UTC ISO kaydedilir. İade kartın aktifleşmesinde mevcut geçerli-yeni-kart kontrolü korunur; nullable temizleme ve cihazdan sökme/sync davranışı korunur. `presetRuleId` update'e eklenmedi; düzenlemede bölge salt okunur kalmalı.

## Kapılar

- İlk tam tur: app tsc ve convex tsc 0 hata, eslint 0 hata; Vitest 85 dosya / 805 test geçti (yeni 4 saf sözleşme testi dahil).
- Son ortak ağaç turu: app ve convex tsc, ownership dışı `convex/accessRules.ts:590,601,602,611` içinde toplam 14 TS18047 (nullable employee/device/door) ile başarısız; ziyaretçi dosyalarında hata yok.
- Son ortak ağaç turu: `node_modules/.bin/eslint src convex` geçti, 0 hata.
- Son ortak ağaç turu: `npx vitest run` 85 dosya / 809 test geçti, 1 suite başarısız: `convex/lib/reportScope.test.ts` içindeki `customFunctions` mock'unda `authedMutation` export'u eksik (`convex/ideSync.ts:590` import zinciri). Bu dosyalara dokunulmadı, koordinatöre ask ile bildirildi.
- Hedefli doğrulama: `npx vitest run convex/lib/visitorStatus.test.ts convex/lib/visitorPresence.test.ts` 2 dosya / 21 test geçti; kendi kaynak dosyalarında tsc tanısı yok ve eslint temiz.
- Koordinatör ask yanıtı: dış hata ayrımıyla teslim; 05/07 sahipleri düzeltmeleri yapıyor, birleşik kapıyı koordinatör koşacak.
- Frontend çalışması olmadığı için Vite build/görsel kapı uygulanmadı. Canlı veri, gerçek yetkili oturum veya cihaz E2E çalıştırılmadı; paket kurulmadı.

Koordinatör ekran kontrolü: maskeli kart, doğru erişim etiketi/bağımsız konum, boş ara sayfada ileri gitme, truncated sayaç açıklaması, dakika yenilemesi, pasif eski kayıt düzenleme ve gelecekte bitişsiz yeniden aktivasyonun reddi. Hassas alanlar ve KVKK sürümü için ürün/yasal kapsam bu görevde genişletilmedi.

## Düzeltme (api-fix)

- `convex/lib/visitorStatus.ts:65` `visitorTimeISO(value: string | undefined): string | null`; `getDetail` ve `listPage` içindeki `visitStart`/`visitEnd` artık geçerli eski TR `datetime-local` ve yeni UTC ISO için aynı UTC ISO anını döndürür. Geçersiz/eksik tarih null; alan tipleri değişmedi. Durum hesabı ortak `visitorTime` ile iki formatta aynıdır.
- `convex/visitors.ts:534`: expiry cron'u iki formatı kapsayan indeks üst sınırı alıp gerçek normalize anla süzer; legacy TR kayıtlar üç saat gecikmez, pencereye giren gelecekteki UTC kayıtlar erken kapanmaz. Önceki collect/senkron yolları korunur; migration/backfill yapılmadı.
- `convex/visitors.ts:234` `getDetail`: mevcut `isManager` admin kontrolü kullanılır. `super_admin`/`project_admin` tam kart/TC görür; diğer roller kartı `•••• 5678`, TC'yi son dört hane biçiminde görür. **Yeni alan `sensitiveMasked: boolean`**, argümanlar ve diğer alanlar aynı. `IADE:` kartı admin olmayana “İade edildi” görünür. Önceki “yetkili proje üyelerine tam hassas alan” açıklaması bu iki alan için geçersizdir.
- Saf zaman/durum, gerçek query wrapper'larıyla admin/member maskeleme ve liste/ayrıntı normalizasyonu, expiry cron'u için test eklendi. Kapılar: Convex tsc 0, eslint convex 0; tam Vitest 93 dosya / 943 test yeşil. App tsc'de 06 test fixture'ının `sensitiveMasked` alanı eksik; src ownership dışı olduğu için koordinatöre iletildi.
