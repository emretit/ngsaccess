# C2c W-12-api — 12 Admin backend: sunucu taraflı kullanıcı/proje/cihaz listeleri, ad doğrulaması, silme etki önizlemesi
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/12-admin/REPORT.md` ("Kapsam ve korunacak düzeltmeler", "Kolonlar, filtre ve gerçek veri", "Form ve onay
sözleşmeleri", "Backend gereksinimi") + `docs/ux-audit/` ADM-1A/1B/ADM-22 bulguları (grep).

## Hedef (test edilebilir)
Admin'in üç sekmesi (Kullanıcılar, Projeler, Cihaz havuzu) sunucuda filtrelenen, cursor'lı ve AÇIK alanlı listelerle beslenir; proje adı
sunucuda trim edilip boşsa reddedilir; proje silme öncesi salt okunur etki önizlemesi var (mutation yine kendi içinde yeniden kontrol eder).
Mevcut `users.list`, `projects.list/listActive/create/update/remove`, `userProjects.*`, `adminDevices.list/listForClaim` imzaları korunur.

## İş
1. `convex/users.ts`, `projects.ts`, `userProjects.ts`, `adminDevices.ts`, `convex/lib/adminGuards.ts` oku. Önce yetki taraması:
   `userProjects.getAll` (authedQuery) ve `projects.getById`/`listActive` (auth'suz `query`) kimlere ne döndürüyor — sızıntı varsa
   raporda yaz; imzayı KIRMADAN düzeltilebiliyorsa (ör. getAll'ı çağıranın kapsamına süzmek, eski tüketiciler sadece kendi projelerini
   kullanıyorsa) düzelt ve tüketicileri grep ile kanıtla. Emin değilsen DOKUNMA, raporla.
2. **`users.adminList({ search?, role?, project?: Id<"projects"> | "none", paginationOpts })` (superAdminQuery):** satır
   `{ _id, displayName, email, role, projects: Array<{ _id, name, isActive }>, isSelf: boolean, pendingSetup: boolean, setupExpiresAt? }`.
   Hassas alan (setupToken, telefon, image) YOK. Arama ad/e-posta Türkçe küçük harf; kullanıcı sayısı küçük olduğundan sayfa-içi süzme
   kabul ama dönüşte `filterScope` ve `totalScanned` dürüst bildirilsin (ya da tam sunucu süzgeci). Üyelikler tekilleştirilmiş yüklensin.
3. **`projects.adminList({ search?, status?: "active" | "inactive", paginationOpts })` (superAdminQuery):** satır
   `{ _id, name, description?, isActive, createdAt?, memberCount, deviceCount, ownerName? }` — sayımlar bounded (üst sınır + `+`).
4. **`projects.getDeletionImpact({ projectId })` (salt okunur):** `remove` ile AYNI blokaj/temizlik hesabını (`adminGuards`) kullanarak
   `{ canDelete, blockers: Array<{ table, label, count, capped }>, cleanup: Array<{ table, label, count, capped }> }`; Türkçe label.
   `remove` mantığını değiştirme, yalnız ortak hesabı paylaş.
5. **Ad doğrulaması:** `projects.create/update` sunucuda `name.trim()`; boşsa `ConvexError({ code: "PROJECT_NAME_REQUIRED", message })`;
   makul üst sınır (ör. 100) `PROJECT_NAME_TOO_LONG`. Aynı adlı aktif proje varsa uyarı/ret kararı: varsayılan RET YOK (raporla).
6. **`adminDevices.adminListPage({ search?, assignment?: "pool" | "assigned" | Id<"projects">, connection?: "online" | "offline" | "never",
   paginationOpts })`:** `list` ile aynı veri + açık alanlar; "çevrimiçi" eşiği mevcut kodda nasıl tanımlıysa onu kullan (yoksa raporda
   eşiği öner, tek sabit). Mevcut `list` kalır.
7. Kullanıcı silme/rol değiştirme mutation'larının mevcut atomiklik ve son-super_admin korumalarına DOKUNMA; yalnız raporda
   frontend'in göstereceği hata kodlarını listele.

## Ownership
convex/users.ts · convex/projects.ts · convex/userProjects.ts · convex/adminDevices.ts · convex/lib/adminGuards.ts ·
yeni convex/lib/adminLists.ts (+test) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend · yeni audit olayları · davet e-postası/yeniden gönder endpoint'i (mevcutsa yalnız raporla) · IDE servis sözleşmesi ·
pasif projeye sunucu engeli · schema.ts (ask).

## Rapor
`.claude/orca-specs/reports/c2c-12-api.md`: adminList/adminListPage/getDeletionImpact arg+dönüş tipleri, hata kodları + Türkçe metin,
yetki taraması sonucu (sızıntı var/yok, düzeltildi mi), süresi dolan davetleri listelemek için hangi alan/fonksiyon kullanılmalı.
