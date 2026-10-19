# C2c W-11-api — backend sözleşmesi

## Teslim

- `convex/auditLog.ts:165`: yeni `actorOptions` adminQuery.
- `convex/auditLog.ts:76`: `list` için opsiyonel `actor: "system"`; mevcut argümanlar, sayfalama ve satır alanları korunur.
- `convex/lib/auditActors.ts:14`: saf indeks seçimi; `:23` maske; `:37` tarihsel aktör/üyelik birleştirmesi.
- `convex/lib/auditActors.test.ts:1`: 6 test; SDK undefined serileştirmesi, indeks önceliği, çelişki, snapshot, statüler, Türkçe arama, maskeler ve 4.001 aktör üst sınır örneği.
- `convex/_generated/api.d.ts:64`: yalnız `lib/auditActors` modül satırları eklendi. `auditLog.actorOptions` mevcut modülün tipinden otomatik görünür.
- Frontend, şema, audit yazıcıları, searchText üretimi değiştirilmedi; commit/push/deploy/migration veya canlı DB yazımı yapılmadı.

## `auditLog.actorOptions`

```ts
import type { Id } from "convex/_generated/dataModel";
import type { PaginationOptions } from "convex/server";

type Args = {
  projectId?: Id<"projects">;
  allProjects?: boolean;
  search?: string;
  paginationOpts?: PaginationOptions & { id?: number };
};
type Result = {
  actors: Array<{
    userId: Id<"users">;
    label: string;
    status: "active" | "member" | "deleted" | "removed";
    lastSeenAt?: number; // audit.timestamp, UTC epoch ms; taranan olaylardaki en son görülme
  }>;
  includesSystem: boolean;
  truncated: boolean;
};
```

Önerilen kullanım: `actorOptions({ projectId })` veya yalnız super_admin için `actorOptions({ allProjects: true })`. `paginationOpts` vermek gerekmez: bu endpoint cursor sayfalı seçenek listesi değildir, cursor dönüşü yoktur. Verilirse `cursor` null olmalı; `numItems` olay tarama bütçesini belirler (pozitif tam sayı, en çok 2.000), aktör sayısı sınırı değildir. Diğer pagination seçenekleri bu endpointte kullanılmaz; dahili olay sayfalamasının byte bütçesi sabittir.

Yetki `list` ile aynıdır: adminQuery rol kontrolü + resolveProjectScope. `allProjects: true` proje argümanını geçersiz kılar ve global/projesiz kayıtları kapsar; project_admin yalnız seçtiği yetkili projeyi görebilir. Üyelik ve olaylar aynı kapsamdan gelir; çağıran kullanıcı ayrıca dahildir. Tüm projelerde ilk 2.000 userProjects satırının kullanıcıları da eklenir; tüm users tablosu taranmaz.

Etiket sırası: güncel `fullName`, güncel `name`, taranan olaylardaki en yeni dolu `userName`, `Silinmiş kullanıcı`. Son olayın ad snapshotı boşsa daha eski dolu snapshot korunur. Snapshot/güncel ad içindeki e-postalar da maskelenir. Aynı Türkçe küçük harf etiketine sahip kişilerde `e***@alan.com · Aktör N` veya `Aktör N` eki kullanılır; masked e-posta da aynıysa N ayırır. N sabit bir kullanıcı kimliği değildir, seçenek kümesi değişince değişebilir. Tam e-posta veya başka kişisel kimlik alanı eklenmez; yalnız filtre için gereken `userId` döner.

`search` trim + Türkçe küçük harf dönüşümünden sonra nihai `label` üzerinde substring aramasıdır; e-posta/kimlik araması değildir. Tüm eşleşmeler tek cevapta, Türkçe etiket sırasıyla döner. `includesSystem` arama metninden bağımsızdır ve taranan olaylarda userId bulunmayan en az bir olay görüldüğünü bildirir; Sistem actors dizisine sahte userId ile eklenmez.

| Status | Anlam | Türkçe etiket önerisi |
|---|---|---|
| active | Kullanıcı kaydı mevcut, taranan olaylarda görülmüş; global kapsamda proje üyeliği koşulu yok | Aktif kullanıcı |
| member | Kullanıcı kaydı mevcut, taranan olaylarda görülmemiş; üyelik veya çağıran kullanıcı nedeniyle dahil | Proje üyesi / çağıran için Siz |
| deleted | users kaydı artık yok; olaydaki ad snapshotı korunabilir | Silinmiş kullanıcı |
| removed | Kullanıcı mevcut; tam taranmış seçili proje üyelik kümesinde ve çağıran olarak bulunmuyor | Proje üyesi değil |

`active` hesap etkinliği/oturum veya proje erişim yetkisi garantisi değildir; şemada kullanıcı aktiflik alanı yoktur. Üyelik taraması kesildiyse yokluk kesin bilinmediğinden `removed` çıkarımı yapılmaz, var olan tarihsel kullanıcı `active` kalır. `member` global kapsamda “Proje üyesi” olarak kullanılabilir; çağıranı userId ile “Siz” diye ayrıca göstermek uygundur.

## Tarama sınırı, ölçüm ve dürüst UI

Olaylar `by_project_timestamp` veya global `by_timestamp` üzerinden desc; varsayılan/en fazla 2.000 olay, dahili `.paginate` ile 4 MiB `maximumBytesRead` ve olay bütçesine eşit `maximumRowsRead` sınırı. Bu bütçe Convex'in sayfa kesme mekanizmasıdır; son okunan belge nedeniyle hedef byte sınırı aşılabilir. `!isDone` olduğunda `truncated=true`; dolayısıyla büyük payloadlar 2.000 olaydan önce de taramayı kesebilir. Üyelikler en fazla 2.001 satır okunur, 2.000'i birleştirilir; ekstra satır varsa yine truncated olur. Kullanıcı okumaları tekilleştirilir, olay + üyelik + çağıran için teorik en çok 4.001 `db.get` çağrısıdır. Ortak `resolveProjectScope` mevcut erişim çözümlemesi ayrıca çalışır; bu helper'ın mevcut collect davranışına dokunulmadı.

Gerekçe: geçmiş audit payloadlarını sınırsız okumadan yaygın araştırma aralığını kapsamak; olay başına kullanıcı tekrarını tekilleştirmek ve payload hacmi için byte bütçesi koymak. Yerel 2.000 farklı olay + 2.000 farklı üye + çağıran fixture'ı 4.001 farklı seçenek üretti; altı yardımcı/SDK testi toplam 28 ms (Vitest toplam 127 ms). Bu yerel CPU ölçümüdür, canlı DB gecikmesi ölçümü değildir. Çok uzun kullanıcı adları/büyük kullanıcı belgeleri için ayrı DB byte limitleri hâlâ geçerlidir; bounded scan tam geçmiş garantisi vermez.

`truncated=true` için öneri: **“Seçenekler sınırlı sayıdaki son kayıttan ve mevcut üyelerden derlendi; eski aktörler veya bazı üyeler listede olmayabilir.”** Sistem görülmediyse ve truncated ise **“Eski Sistem kayıtları bu seçenek taramasına dahil olmayabilir.”** Gösterilmelidir. `includesSystem=false && truncated=true`, kapsamda hiç Sistem olayı yok anlamına gelmez. UI isterse Sistem seçeneğini her zaman gösterebilir; backend bu seçeneği görülen olaylardan bağımsız kabul eder. Aktör araması da yalnız bu tarama penceresini süzer; daha eski kayıtları aradığı iddia edilmemelidir.

## `auditLog.list`

```ts
type Args = {
  projectId?: Id<"projects">;
  allProjects?: boolean;
  targetTable?: string;
  userId?: Id<"users">;
  actor?: "system"; // yeni; userId ile birlikte gönderilmez
  action?: "create" | "update" | "delete";
  search?: string;
  startDate?: string; // YYYY-MM-DD, İstanbul günü
  endDate?: string;
  paginationOpts: PaginationOptions & { id?: number };
};
type ListRow = Omit<Doc<"auditLog">, "userName"> & {
  userName: string | undefined;
  projectName: string;
};
type Result = PaginationResult<ListRow> & {
  actorFilterScope?: "index"; // actor=system verildiyse; verilmediyse alan eklenmez
};
```

`Doc`, `PaginationResult` sırasıyla generated dataModel ve `convex/server` tipleridir; pagination page/isDone/continueCursor ve SDK'nın opsiyonel splitCursor/pageStatus metadata alanları aynen korunur. Mevcut frontend `FunctionReturnType<typeof api.auditLog.list>` kullanmaya devam edebilir. Eski çağrılar ek argüman gerektirmez; `filterUsers`, `distinctTargetTables`, `getPdksAuditForEmployee` imza ve gövdeleri değişmedi.

| Mod | Sistem filtresi |
|---|---|
| Seçili proje, metin araması yok | `by_project_user_timestamp`, `eq(projectId,p).eq(userId,undefined)`; tarih aralığı aynı indekste |
| Tüm projeler, metin araması yok | `by_user_timestamp`, `eq(userId,undefined)`; tarih aralığı aynı indekste |
| Metin araması, iki kapsam | `search_text`, `eq(userId,undefined)`; proje/varlık/işlem arama indeksinde eşitlik |

Sistem seçimi eylem/varlık indeks önceliğini geçersiz kılar. Metin araması olmayan modda eylem ve varlık eski sayfa-içi yardımcıyla süzülür. Aramada tarih sınırları sayfa sonrasında uygulanmaya devam eder; cursor sayfası boş olabilir, isDone=false iken devam edilmelidir. `actorFilterScope="index"` yalnız aktör koşulunun indeksli olduğunu anlatır, diğer filtreler için garanti değildir. SDK ve resmi dokümanlar arama için de undefined desteğini doğruladığından `page` fallback gerekli olmadı.

Doğrulama: kurulu Convex SDK normal proje/global range ve full-text arama filtrelerinde undefined'ı `{ $undefined: null }` olarak serileştiriyor; SDK üzerinden çalışan test bunu kontrol ediyor. Resmi [veri türleri](https://docs.convex.dev/database/types) ve [metin araması](https://docs.convex.dev/search/text-search) belgeleri eksik alan eşleşmesini açıklar. Canlı deployment sorgusu/DB testi yapılmadı; `convex-test` kurulu değil ve paket kurma yasak olduğundan SDK sözleşme testi + saf mantık testleri kullanıldı.

## Hatalar

Mevcut altyapıyla uyumlu `Error` atılır; ayrı HTTP status/numeric kod eklenmedi. Yeni argüman çelişkisi istemci doğrulama hatası olarak gösterilmelidir:

- `Sistem ve kullanıcı filtresi birlikte kullanılamaz` — list actor + userId.
- `Aktör seçenekleri cursor ile sayfalanmaz` — actorOptions dolu cursor.
- `Aktör tarama sınırı pozitif tam sayı olmalı` — actorOptions geçersiz numItems.
- `Tüm projeler görünümü süper admin gerektirir; bir proje seçin` — iki sorguda yetkisiz global kapsam.
- `Denetim kaydı için bir proje seçin` — iki sorguda kapsam yok.
- `Bu projeye erişim yetkiniz yok` — ortak scope kontrolü.
- Kimlik/rol ve tarih hataları mevcut altyapıdan aynen gelir.

## Kapılar ve kalan doğrulama

App tsc ve Convex tsc: 0 hata. `eslint src convex`: son tam koşumda 0 hata ve 0 uyarı (önceki ara koşumda sahiplik dışı leaves.ts uyarıları vardı, ilgili worker düzeltti). Tam Vitest: 96 dosya, 961 test geçti; yeni aktör modülünde 6 test. Koordinatör sonraki frontend dalgasında silinmiş/eski aktör, aynı ad, Sistem+arama, kapsam değişimi, boş ara cursor ve truncated metinlerini gerçek oturumda kontrol etmeli. Bu backend tesliminde frontend işi kalmadı; gerçek DB entegrasyon doğrulaması koordinatöre aittir.
