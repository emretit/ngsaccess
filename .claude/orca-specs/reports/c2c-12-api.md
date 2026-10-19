# C2c W-12-api — teslim sözleşmesi

## Değişiklik ve sınır

Yalnız `convex/users.ts`, `convex/projects.ts`, `convex/adminDevices.ts`, `convex/lib/adminGuards.ts`, yeni `convex/lib/adminLists.ts` + test ve `_generated/api.d.ts` kendi modül satırları değiştirildi. `userProjects.ts` incelendi, değiştirilmedi. Frontend/schema, kullanıcı silme/rol mutation'ları, eski listeler ve cihaz claim endpoint'i değiştirilmedi; commit/push/deploy/migration/DB yazma yapılmadı.

## Ortak liste dönüşü / frontend kullanımı

Aşağıdaki üç yeni liste yalnız **super_admin** içindir. `Id` = `convex/_generated/dataModel`; gerçek çağrı tipini `FunctionReturnType<typeof api.users.adminList>` / ilgili fonksiyondan türetin.

```ts
type Role = "super_admin" | "project_admin" | "project_user";
type PaginationOpts = {
  numItems: number; // tamsayı 1..50; projects.adminList için 1..25
  cursor: string | null; // ilk çağrıda null
  endCursor?: string | null;
  id?: number;
  maximumRowsRead?: number;
  maximumBytesRead?: number;
};
type Page<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  splitCursor?: string | null;
  filterScope: "server";
  totalScanned: number;
};
```

`paginationOptsValidator` ile mevcut Convex pagination alanları kabul edilir; `maximumRowsRead` sunucuda 500'e sabitlenir. Kurulu `convex-helpers/server/stream` filtreyi **sayfalamadan önce** uygular; sayfa başına en fazla 500 ana tablo satırı taranır (ilişki okumaları ayrıca). `totalScanned` bu çağrıda filtreye giren ana tablo satırı sayısıdır; eşleşenlerin genel toplamı veya kümülatif sayaç değildir. Tüm sonuçlar cursor takip edilerek ulaşılabilir; tarama bütçesinde boş/kısa sayfa ve `isDone:false` geçerlidir. Sonraki sayfa `continueCursor` ile alınır, yalnız `isDone:true` bitiştir; filtre/sekme değişince cursor sıfırlanır. Opaque cursor'ı endpoint'ler veya farklı filtreler arasında taşımayın. `endCursor` ile reaktif aralık yenilenirken sayfa `numItems`'ı aşabilir; tarama bütçesi yine 500'dür. Genel toplam endpoint'i eklenmedi; frontend `totalScanned` değerini toplam gibi göstermemeli.

Sıralama yeni kayıt önce (`_creationTime desc`). Arama trim + `toLocaleLowerCase("tr-TR")` + substring; boş sorgu tümünü eşler. Yeni aramalar query `.filter` yerine stream predicate kullanır. Tek istisna, eski proje silmenin `invites` filtresi aynı davranışı korumak için ortak yardımcıya taşındı; `invites` proje index'i bulunmuyor.

## users.adminList — convex/users.ts:365

```ts
args: {
  search?: string;
  role?: Role;
  project?: Id<"projects"> | "none";
  paginationOpts: PaginationOpts;
}
return: Page<{
  _id: Id<"users">;
  displayName: string;
  email: string;
  role: Role | null;
  projects: Array<{ _id: Id<"projects">; name: string; isActive: boolean }>;
  isSelf: boolean;
  pendingSetup: boolean;
  setupExpiresAt?: string; // ISO
}>
```

`role:null` eski, rolü henüz atanmamış kayıt için dürüst boş değerdir: “Rol atanmamış”; bir yetki varsayılmaz. `displayName`: trim fullName → trim name → email → “Adsız kullanıcı”; eksik email `""`. Arama fullName/name/email alanlarında. `pendingSetup = verified === false`: **e-posta doğrulaması bekliyor**, parola kurulumu/davet gönderildi kanıtı değil. `setupExpiresAt = users.tokenExpiresAt`; token değeri, telefon, image/photoUrl ve diğer profil alanları çıkmaz.

Üyelikler `by_user` ile alınır, projectId Set ile tekilleştirilir; aynı kullanıcı ve aynı proje dokümanı çağrı boyunca promise-cache ile yeniden okunmaz. Silinmiş projelere yetim üyelikler gösterilmez. `project:"none"` görünür/geçerli üyeliği olmayanları verir; belirli proje filtresi saklanan üyeliğe bakar. Süper adminin tüm projelere etkili erişimi ayrıca UI'da açıklanmalı; `projects` saklanan üyeliklerdir. Üyelikler eksiltilmeden döner; çok fazla üyeliği olan hesaplarda ilişki yükü ana tablo tarama sınırından bağımsızdır (küçük kullanıcı sayısı varsayımı).

## projects.adminList — convex/projects.ts:125

```ts
args: { search?: string; status?: "active" | "inactive"; paginationOpts: PaginationOpts }
return: Page<{
  _id: Id<"projects">;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  memberCount: number;
  memberCountCapped: boolean;
  ownerName?: string;
}>
```

Arama ad + açıklama. `isActive === true` aktif; false/undefined pasif. Sahip adı fullName → name → email; sahibi olmayan/silinmiş kayıtta undefined. Her proje için yalnız `userProjects.by_project` en fazla 101 satır okunur; `devices` okunmaz, `deviceCount/deviceCountCapped` dönmez (cihaz heartbeat'i bu sorguyu geçersiz kılmaz). Üye sayısı ilk 100 üyelikteki **tekil userId** sayısıdır; 101'inci üyelik varsa `memberCountCapped:true`, kesin toplam değildir (eski duplicate üyelikler şişirmez). Capped üye sayısı `n+` / “en az n” olarak gösterilir; duplicate yoğun veride n, 100'den küçük olabilir. `paginationOpts.numItems` en fazla 25; daha büyük değer INVALID_PAGE_SIZE döner. Normal sayfada en fazla 2.525 üyelik satırı + en fazla 25 sahip okuması yapılır; reaktif `endCursor` aralıkları Convex pagination sözleşmesine göre daha fazla satır döndürebilir.

## adminDevices.adminListPage — convex/adminDevices.ts:216

```ts
args: {
  search?: string;
  assignment?: "pool" | "assigned" | Id<"projects">;
  connection?: "online" | "offline" | "never";
  paginationOpts: PaginationOpts;
}
return: Page<{
  _id: Id<"adminDevices">;
  _creationTime: number;
  name: string;
  ideUuid?: string;
  deviceSerial?: string;
  brand?: "ide_smart" | "hikvision" | "other";
  ideUser?: string;
  idePassword?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
  lastSeen?: string;
  createdFromDevice?: boolean;
  assignedDeviceId?: Id<"devices">;
  assignedProjectId?: Id<"projects">;
  createdAt: string;
  updatedAt: string;
  assignedProjectName: string | null;
  connectionStatus: "online" | "offline" | "never";
}> & { evaluatedAt: number }
```

Eski `list` alanları **tek tek seçilerek** korunur; credential alanları eski uç gibi yalnız super_admin'a açıktır, tablolarda/özetlerde/loglarda render edilmemeli. Arama ad/UUID/seri/ham marka/proje adı; proje dokümanları çağrıda tekilleştirilir. `pool`: assignedDeviceId yok; `assigned`: assignedDeviceId var; proje ID: assignedProjectId eşleşir. Bu envanter listesidir; claim picker'ın ek `!createdFromDevice` kuralı değişmedi.

Bağlantı mevcut `convex/lib/deviceConnection.ts:1` sabiti **5 dakika** ile hesaplanır; yeni sabit yok. Havuz dokümanında son sinyal `lastSeen`; sinyal yok/geçersiz → never, son 5 dakika (`signal <= now && signal > now - 300000`) → online, diğer → offline. Tüm sayfa aynı `evaluatedAt` zamanını kullanır. Salt zaman geçişi Convex aboneliğini uyandırmaz: frontend mevcut dakika saatini korumalı; bağlantı **sunucu filtresi** açıkken sorguyu da aralıklarla yenilemek gerekir (gerekirse mevcut pagination akışını yeniden başlatın; sözleşmeye saat argümanı eklenmedi).

Etiketler: online “Çevrimiçi”, offline “Çevrimdışı”, never “Henüz bağlanmadı”; pool “Havuzda”, assigned “Projeye atanmış”.

## projects.getDeletionImpact — convex/projects.ts:158

```ts
args: { projectId: Id<"projects"> }
return: {
  canDelete: boolean;
  blockers: Array<{ table: string; label: string; count: number; capped: boolean }>;
  cleanup: Array<{ table: string; label: string; count: number; capped: boolean }>;
}
```

Yetki **remove ile aynı**: doğrulanmış proje sahibi veya super_admin. Sadece query, yazma yok. `adminGuards.projectDeletionCounts` (convex/lib/adminGuards.ts:83) hem önizlemede hem mutation transaction'ında yeniden çalışır; `projectDeletionCleanupQuery` (:127) ikisinin de temizlik predicate'idir. Engelleyici 21 tablo ve temizlenecek 11 tablo eski constant'lardır. Sıfır satırlar dizilere alınmaz. Her tabloda 101'de durulur; dönen count en fazla 100, capped ise `100+`. Blokaj varsa `cleanup` yapılacak iş değil, blokaj kalkarsa silinecek kayıtların bilgisidir. `canDelete` önizleme anına aittir; onay sırasında veri değişirse mutation tekrar engelleyebilir.

Türkçe temizlik etiketleri: Kullanıcı proje üyelikleri, Genel ayarlar, E-posta ayarları, Bildirim ayarları, Çalışma ayarları, Fazla mesai oranları, Tatiller, Rapor zamanlamaları, İzin bakiyeleri, Sohbetler, Davetler. Blokaj etiketleri mevcut adminGuards sözlüğü (personel, cihaz, bölge, kapı, okuyucu, Hikvision köprüsü, erişim kuralı, kart okuma kaydı, PDKS kaydı, izin, vardiya, vardiya ataması, firma, departman, pozisyon, yüz kaydı, parmak izi kaydı, grup üyeliği, grup cihaz bağlantısı, grup kapı bağlantısı, cihaz olayı). auditLog korunur, önizleme temizlenecekmiş gibi göstermez. Mutation silme sırası, mesajı ve izin koşulları korunur.

## Proje ad doğrulaması / mevcut imzalar

- `projects.create({ name:string, description?:string, isActive?:boolean }): Id<"projects">` — convex/projects.ts:52.
- `projects.update({ id:Id<"projects">, name?:string, description?:string, isActive?:boolean }): Id<"projects">` — convex/projects.ts:72.
- Her iki uçta gönderilen name trim edilir, boşsa reddedilir, trim sonrası JS length >100 reddedilir; update'te name yoksa dokunulmaz. Aynı adlı aktif proje **reddedilmez**; yeni unique kuralı veya uyarı API'si yok.
- `projects.remove({id:Id<"projects">}): Id<"projects">` imzası ve eski hata davranışı korunur.
- `users.list`, `projects.list`, `userProjects.*`, `adminDevices.list/listForClaim` arg+dönüşleri değişmedi.

## Hata kodları ve Türkçe metinler

Yeni yapılandırılmış `ConvexError.data`:

| code | message |
|---|---|
| PROJECT_NAME_REQUIRED | Proje adını girin. |
| PROJECT_NAME_TOO_LONG | Proje adı en fazla 100 karakter olabilir. |
| INVALID_PAGE_SIZE | projects.adminList: Sayfa boyutu 1 ile 25 arasında olmalıdır.; diğer listeler: Sayfa boyutu 1 ile 50 arasında olmalıdır. |

Mevcut `users.updateRole` / `deleteUser` hatalarında **code alanı yoktur**, string `ConvexError.data` korunmuştur; uydurma code beklemeyin:

| Kaynak | Gösterilecek mevcut metin |
|---|---|
| Silme/rol hedefi bulunamadı | Kullanıcı bulunamadı |
| updateRole proje bulunamadı | Proje bulunamadı |
| Son super_admin silme | Sistemdeki son süper admin silinemez |
| Son super_admin rol düşürme | Sistemdeki son süper adminin rolü düşürülemez |
| Kendi hesabını silme | Kendi hesabınızı silemezsiniz |
| Kendi rolünü düşürme | Kendi rolünüzü düşüremezsiniz |

Öncelik son-admin korumasında; iki koruma aynı anda doğruysa son-admin metni döner. Üyelik+rol tek mutation transaction'ında kalır, korumalar değişmedi (`users.ts:62`, `users.ts:221`, `adminGuards.ts:3`).

Mevcut auth helper'ları `Error` atar (yapılandırılmış kod yok): “Giriş yapmanız gerekiyor”, “Kullanıcı bulunamadı”, “E-posta adresinizi doğrulamanız gerekiyor”, “Bu işlem için süper admin yetkisi gerekli”. Proje update/remove/preview: “Proje bulunamadı”; remove/preview yetkisiz: “Sadece proje sahibi veya süper admin silebilir”. `getById` kapsam dışı: “Bu projeye erişim yetkiniz yok”. Proje silme blokajı eskisi gibi string ConvexError: “Bu projeye bağlı … var; önce bunları taşıyın veya silin. Geçmiş kayıtlarını korumak için projeyi pasife alabilirsiniz.” Auth plain Error metinlerinin production istemcide ayrıntılı görünmesi garanti edilmez; genel yetki/oturum hatası UI'sı gerekir.

## Yetki taraması / tüketici kanıtı

`rg -n 'api\.(userProjects\.getAll|projects\.(getById|listActive))' src convex` ile tarandı:

- `userProjects.getAll` authedQuery olmasına rağmen handler'da **super_admin değilse “Yetki yok”** kontrolü zaten var (`convex/userProjects.ts:101`); sızıntı yok, değiştirilmedi. Tek frontend tüketici `src/components/admin/AdminProjectsPanel.tsx:53` (super_admin paneli).
- `projects.listActive` önceden public query olarak bütün aktif proje dokümanlarını anonim/başka kiracıya açıyordu: **sızıntı vardı, düzeltildi** (`convex/projects.ts:26`). Aynı `{}` arg ve proje dokümanı dizisi korunur; artık authedQuery. super_admin tüm aktifler, diğer roller yalnız üyelik projelerinin aktiflerini alır. Bilinen tüketici `src/contexts/ActiveProjectContext.tsx` yalnız `isAuthenticated && isSuperAdmin` koşuluyla çağırır (paralel worker bu dosyada çalıştığından satır kayabilir).
- `projects.getById` önceden public query olarak ID bilen herkese proje dokümanı açıyordu: **sızıntı vardı, düzeltildi** (`convex/projects.ts:39`). `{projectId}` ve `Doc<"projects"> | null` dönüşü korunur; authedQuery + super_admin/proje sahibi/üyelik kapsamı. Bilinen tek tüketici `convex/actions/sendEmail.ts:233`, `sendUserInviteEmail` authedAction'ı; ondan önce `invites.create` aynı super_admin/owner/project_admin kapsamını doğrular. Meşru tüketici korunur; anonim çapraz-proje erişimi kapanır. Proje yoksa eskisi gibi null.

Public endpoint'e anonim erişimin reddedilmesi amaçlanan yetki düzeltmesidir; bilinmeyen repo dışı public tüketici varsa auth gerekecektir. Pasif projeye yeni sunucu yazma/erişim engeli eklenmedi.

## Süresi dolan davet / doğrulama ayrımı

**Davetler** için mevcut `api.invites.listExpired({})` kullanılmalı (`convex/invites.ts:182`): superAdminQuery; en yeni en fazla 50 kullanılmamış ve `expiresAt < now` satırı; `{_id,email,projectId,role,expiresAt}[]`, token içermez, cursor yok. Bu sınır nedeniyle “tüm süresi dolan davetler” toplamı sunulamaz. Kullanıcısı henüz oluşturulmamış davetler users.adminList'te bulunmaz. `pendingSetup/setupExpiresAt` ise `users.verified/tokenExpiresAt` **self-signup e-posta doğrulama** bilgisidir; davetlerin son kullanma tarihi değildir. Cron tokenı temizlerse doğrulanmamış hesap pending kalabilir ama setupExpiresAt silinir; “süre bilgisi yok” denmeli.

Yeniden davet için ayrı yeni endpoint yok; mevcut `api.actions.sendEmail.sendUserInviteEmail({ email, projectId, role, type?:"invite"|"reset" }): Promise<{success:boolean,error?:string}>` var (`convex/actions/sendEmail.ts:214`), aynı davet akışını tekrar kullanır. Yeni e-posta/yeniden gönder endpoint'i yazılmadı; mevcut frontend başarıyı yalnız `success:true` ile göstermeli.

## Doğrulama

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` geçti.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` geçti (ilk paralel ara koşudaki auditActors/bağımlılık hataları son koşuda yok).
- `node_modules/.bin/eslint src convex` geçti, 0 hata/uyarı; kendi değişen dosyalar ayrıca kontrol edildi.
- `node_modules/.bin/vitest run`: 97 dosya / 991 test geçti; yeni adminLists testi + mevcut admin koruma testi 20 kontrol geçti.
- Yeni testler Türkçe arama, sayfalama giriş sınırı, ad hata kodları, hassas kullanıcı alanlarının çıkmaması, envanter açık alan projeksiyonu, 5 dakika eşiği, tüm silme blokaj/temizlik tablolarının ortak politikası ve capped sayımı kapsar. Canlı Convex/DB veya tarayıcı testi yapılmadı; sunucu pagination ölçek/abonelik testleri canlı kabulde ayrıca incelenebilir.
