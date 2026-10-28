# W2 — Ziyaretçi backend + sayfa (Z-Y1 backend, Z-O5, Z-O6, Z-D1, Z-D4)

## Hedef
Pasife alınan ziyaretçi "Sonlandırıldı" görünür. Liste ve özet ziyaretçi sayısıyla sınırsız büyümez. Sayfa yalnız yetkili rollere açılır, telefon ve not yalnız yöneticiye görünür. Ayrıntıdaki işe yaramayan düğme ve filtre satırındaki eylem düzelir.

## Ownership (yalnız bunlar)
- `convex/visitors.ts`, `convex/lib/visitorStatus.ts`, `convex/lib/visitorStatus.test.ts`
- `src/lib/routeMeta.ts` (yalnız `/visitors` satırı)
- `src/components/visitors/VisitorManagement.tsx`, `VisitorStats.tsx`, `VisitorFilters.tsx`, `VisitorTable.tsx`, `VisitorSlideOverPanel.tsx`, `visitors.test.tsx`
- `src/hooks/useVisitors.ts`, `src/types/visitor.ts`
- Ziyaretçi handler'larını çağıran mevcut convex testleri, YALNIZ ziyaretçi beklentileri değiştiyse: `convex/fixF2Cards.test.ts`, `convex/fixF5People.test.ts`, `convex/fixF2bIde.test.ts`, `convex/fixF0SideDoors.test.ts`, `convex/payVisibility.handlers.test.ts`, `convex/roles.admin.test.ts`. Yeni testler için `convex/visitorsAudit2.test.ts`.
- `convex/schema.ts` W4'ün dosyası. Index gerekiyorsa DUR, `ask` ile sor.

## Değişiklikler
1. **Z-Y1 (backend):** `update` pasife alırken (`activeChanged && isActive === false`) `visitorStatus: "checkedOut"` yazsın (bugün "preRegistered", `visitors.ts:515-518`). Aktifleştirme "checkedIn" kalsın. Mobil ön kayıt aktivasyonu ve `create` (isActive=false → preRegistered) DEĞİŞMEZ. Eski kayıtları düzeltme (migration) YOK.
2. **Z-O5 (ölçek):** `listPage` stream'ine okuma sınırı ekle (`maximumRowsRead`/`maximumBytesRead`, örnek: `convex/mobileVisitors.ts:47`). Sınıra takılınca boş ama bitmemiş sayfa için arayüz "Daha fazla kayıt tara" ile devam ettirsin (cursor'la), "kayıt yok" demesin. `summary` sınırlı tarasın (örnek: `mobileVisitors.ts:59-71`, sınır ~2000). Taşınca sayaçlar "2000+" gibi açıkça gösterilsin ve `nextExpiry` yine doğru hesaplansın: aktif kayıtların bitişini ayrı, sınırlı index sorgusuyla bul (`by_project_visitor_expiry` gte now, ilk aktif kayıt). `useVisitorClock` sözleşmesi korunur.
3. **Z-O6 (yetki):** `listPage`, `summary`, `getDetail` yalnız `visitors.manage` VEYA `reports.view` sahibine açık olsun (super_admin kuralı `convex/lib/permissions.ts`'teki mevcut desene uysun). `getDetail` ve liste satırında `visitorPhone`, `notes`, `visitPurpose` yalnız `visitors.manage` sahibine dönsün, diğerlerine `null`. `routeMeta.ts` `/visitors`: `anyPermission: ["visitors.manage", "reports.view"]`. `api.visitors.summary`/`listPage`'i kullanan başka yerleri bul (`grep -rn "api.visitors\." src`). Yetkisiz kullanıcıda sayfa kırılmasın; mevcut AccessDenied deseni kullanılsın.
4. **Z-D1:** `detail.sensitiveMasked` ise "Tam numarayı göster" düğmesi gizlensin (`VisitorSlideOverPanel.tsx:80-81`).
5. **Z-D4:** "Erişim bölgesi oluştur" filtre satırından çıksın, sayfa başlığında ikincil eylem olsun. `PageHeader`'da ikincil eylem desteği yoksa `PageHeader`'ı DEĞİŞTİRME; başlık bileşeninin mevcut bir slot'unu kullan, yoksa `ask` ile sor. Yetki `devices.manage` aynen kalsın.

## Kabul
- Testler: aktif ziyaretçi `update({isActive:false})` → `visitorStatus` "checkedOut", liste/özet "checkedOut" sayar. `reports.view` kullanıcısı listeyi görür ama telefon/not `null`. Teknik rolü (`devices.manage`, `reports.view` yok) list/summary/getDetail'de ret alır. Sınır testi: sınırdan fazla kayıtta özet taşma bayrağı ve doğru `nextExpiry`. Boş ama bitmemiş sayfada "Daha fazla kayıt tara" görünür.
- `src/components/visitors` ve ziyaretçi convex testleri yeşil.
