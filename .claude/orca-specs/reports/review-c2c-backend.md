# C2c backend denetimi (10 izinler / 11 aktörler / 12 admin listeleri)

**Sonuç: Deploy'a hazır: EVET.** Kritik/yüksek bulgu yok; 5 orta, birkaç düşük. Kapılar yeşil.

## Kapılar (kendi koşum)
- `tsc --noEmit -p convex/tsconfig.json` → exit 0
- `eslint convex` → exit 0
- `vitest run convex` → 58 dosya / 717 test geçti

## Doğrulananlar (sorun yok)
- **Yetki:** `users.adminList`, `projects.adminList`, `adminDevices.adminListPage` superAdminQuery. `leaves.listPage/summary/employeeOptions` `resolveProjectScope(projectId)` ile proje doğruluyor; `update` kaydın projesini + çalışanı doğruluyor, ID ile başka proje okunamaz/yazılamaz. `auditLog.actorOptions`: proje yoksa hata, `allProjects` yalnız super_admin, project_admin için scope doğrulanıyor; kullanıcılar yalnız o projenin olay/üyelik ID'lerinden çekiliyor → başka projenin adı sızmıyor.
- **listActive/getById sıkılaştırma:** tek tüketici `ActiveProjectContext` (yalnız super_admin; dönüş = `Doc<"projects">[]`, aynı şekil) ve `actions/sendEmail.ts:233` (`authedAction` içinden `ctx.runQuery`; kimlik taşınır, davet eden üye/sahip/super_admin → kırılmaz). Scheduler/internal/http çağıran yok. Mobile/bridge/script tüketicisi yok.
- **İzin doğrulaması:** create ve update AYNI `validateLeaveRange` + `assertNoLeaveOverlap` (yalnız approved, `<=`/`>=` sınır dahil). Gerçek tarih (regex + round-trip), 366 gün inclusive. `update`: yalnız approved, `expectedUpdatedAt`, `notes:null` siler (`toPatch`), undefined dokunmaz, kişi/proje sabit, `updatedAt` her zaman artıyor. `listForRange` dönüş şekli = tam `Doc<"leaves">[]` (aynı). Takvim `visibleRange` her zaman geçerli YYYY-MM-DD, sıralı → yeni `calendarDays` doğrulaması takvimi kırmaz. Tek insert yeri `create` (hep approved).
- **Aktörler:** `actor:"system"` → `eq("userId", undefined)` index (convex `convexOrUndefinedToJson` ile search filtresinde de geçerli), ek olarak sayfa sonrası `userId===undefined` süzgeci; `actor`+`userId` net hata. `maskAuditEmail`/`safeLabel` label içine gömülü e-postaları da maskeliyor (`x***@alan`).
- **Silme önizlemesi:** `remove` ve `getDeletionImpact` aynı `projectDeletionCounts` + `projectDeletionCleanupQuery`'yi kullanıyor; remove davranışı aynı. Yetki (sahip/super_admin) aynı. Proje adı trim/boş/100 karakter ret create+update'te.
- **Geriye uyum:** mevcut imzalar korunmuş, yeni argümanlar opsiyonel. CLAUDE.md: `any`/`as any`/`!` yok, `NonNullable` type-guard kullanılmış. `api.d.ts` 3 modül için import+map tutarlı (sıralama alfabetik değil, `lib_leaveValidation` başta; codegen düzeltir, zararsız).

## Bulgular (önem sırasıyla)

### Orta
1. **Proje listesi okuma çoğalması + gereksiz invalidasyon** — `convex/projects.ts` `adminList` (~satır 140-148): sayfa başına 50 proje × (`userProjects` take 101 + `devices` take 101) ≈ 10 bin doküman okuması; ayrıca `devices` satırına her heartbeat/lastSeen yazımı bu reaktif sorguyu yeniden çalıştırır. Öneri: sayıları denormalize et (projects.memberCount/deviceCount) ya da yalnız görünür satırlarda lazım olduğunda say; en azından sayfa boyutunu ≤20 yap.
2. **Aktör seçici reaktif + ağır** — `convex/auditLog.ts` `actorOptions` (~satır 176-196): her çağrıda 2000 denetim satırı (4 MB'a kadar) okur ve projede her yeni denetim kaydında yeniden çalışır. Öneri: frontend seçici açılana kadar `"skip"` etsin (spec'e not düşülmeli) veya action/tek seferlik fetch.
3. **`listPage` eski geçmişi de tarar** — `convex/leaves.ts` `listPage` (~satır 98-108): `by_project_start lte rangeEnd` desc; aralık başlangıcından ÖNCE başlayan tüm eski izinler adayın içinde kalır, filtre sonrası sayfalar boş gelir ama `isDone=false` döner ("daha fazla yükle" tüm geçmişi gezer). Kasıtlı (eski >366 gün kayıtlar için) ama UX riski. Öneri: frontend boş sayfada otomatik devam etmesin / `scannedCount` ile "tüm geçmiş tarandı" göstersin; ya da alt sınır `startDate >= rangeStart-366g` + eski uzun kayıtlar için ayrı bayrak.
4. **Eski veride `update` kilitlenir** — `convex/leaves.ts` `update` (~satır 220-224): tarih verilmese bile mevcut tarihlerle `validateLeaveRange` + overlap çalışır. Eskiden 366 günü aşan, geçersiz tarih string'li veya mevcut çakışan onaylı kayıtlarda yalnız `notes`/`leaveType` düzenlemek `LEAVE_TOO_LONG/INVALID_DATE/OVERLAP` ile reddedilir. Öneri: yalnız tarih alanları değişiyorsa doğrula (`args.startDate ?? args.endDate !== undefined`), aksi halde atla.
5. **`listForRange` taşmada hata fırlatır** — `convex/leaves.ts` `listForRange` (~satır 276-288): `endDate >= startDate` adayları (her durumda, gelecek dahil) projeler toplamında 5000'i geçerse tüm takvim `LEAVE_SCAN_LIMIT` ile düşer. Büyük super_admin "tüm projeler" veya çok eski ay bakışında gerçekçi tetik. Öneri: aday eşiği proje başına uygulansın ve/veya `startDate <= endDate` için `by_project_start` ile iki yönlü daralt; ya da takvim hata yerine kısmi + bayrak göstersin (dönüş şeklini bozmadan ayrı sorgu).

### Düşük
- `leaves.create` artık `projectId`'si olmayan çalışanı reddediyor (`requireLeaveEmployee`, ~satır 14-17); eskiden izinliydi. Muhtemelen kasıtlı. Eski frontend yeni hata kodlarında `ConvexError` data'sını göstermez (genel "Server Error"): yeni frontend gelene dek hata mesajı bilgisiz kalır.
- `leaves.listPage/listForRange/list` `authedQuery` — `notes` (sağlık/izin açıklaması olabilir) project_user'a da dönüyor. `list` zaten öyleydi, regresyon değil; yeni sayfada `notes` alanını admin dışına maskelemek düşünülebilir.
- Eski `pending` izin `approve` edilirken overlap kontrolü yok (`approve`, ~satır 238) → onaylı çakışma oluşabilir. Yeni pending üretilmediği için dar.
- `adminDevices.adminListPage` satırlarda `idePassword` döndürüyor (superAdmin-only, mevcut `list` ile aynı). Listede şifre yerine `hasIdePassword` boolean daha güvenli olur.
- `projects.getById` mevcut olmayan ID için `null`, var olan yetkisiz ID için hata → proje ID'si var/yok ayrımı (varlık oracle'ı); ID'ler tahmin edilemez, etkisi önemsiz.
- `listActive` artık non-super için yalnız üye olduğu aktif projeleri döner (eskiden herkese tümü); tüketici yok, güvenli.

## Deploy notu
Backend frontend'den önce deploy edilebilir: eski frontend'in çağırdığı mevcut imzalar (`leaves.list/create/listForRange`, `projects.listActive/getById/remove`, `auditLog.list`) korunuyor; `create`'in reddettiği yeni durumlar (çakışma, 366+ gün, geçersiz tarih) yalnız yeni hata kodlarıyla döner. Yeni indeksler (`leaves` ×3) additive.
