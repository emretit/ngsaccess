# C2c W-11-api — 11 Denetim Kaydı backend: tarihsel aktör seçenekleri + "Sistem" filtresi
Önce `.claude/orca-specs/c2c-common.md` (→ c2-common.md) ve `convex/_generated/ai/guidelines.md` oku. Bağlam:
`docs/ui-scan/pages/11-denetim-kaydi/REPORT.md` ("Filtre ve cursor davranışı", "Arama, maskeleme ve rol", "Backend gereksinimi" AUD-UI-07).

## Hedef (test edilebilir)
Kullanıcı filtresi seçenekleri seçili kapsamdaki denetim olaylarında GERÇEKTEN geçen aktörleri (silinmiş/eski üyeler dahil, olaydaki
`userName` snapshot'ıyla) ve ayrı bir "Sistem" seçeneğini içerir; `auditLog.list` "Sistem" (userId yok) olaylarını index'le süzebilir.
Mevcut `list`, `filterUsers`, `distinctTargetTables`, `getPdksAuditForEmployee` imzaları ve dönüşleri korunur.

## İş
1. `convex/auditLog.ts`, `convex/lib/audit*.ts` oku (`auditIndex`, `auditPageMatches`, `normalizeAuditSearch`, yazım tarafı).
2. **Yeni `auditLog.actorOptions({ projectId?, allProjects?, search?, paginationOpts? })` (adminQuery):** yetki `list` ile aynı
   (allProjects yalnız super_admin; project_admin tek yetkili proje). Kaynak: kapsamdaki `auditLog` satırlarından distinct `userId`
   (+ mevcut proje üyeleri ve çağıran kullanıcı). Tarama SINIRLI (ör. son N=2000 olay `by_project_timestamp` desc) — sınır `truncated`
   bayrağıyla döner; ölçüm/gerekçe raporda. Dönüş: `{ actors: Array<{ userId, label, status: "active" | "member" | "deleted" | "removed",
   lastSeenAt? }>, includesSystem: boolean, truncated: boolean }`. `label`: güncel kullanıcı adı varsa o; yoksa olaydaki son `userName`
   snapshot'ı; ikisi de yoksa "Silinmiş kullanıcı". Aynı adlı iki aktörü ayırt etmek için güvenli ek (ör. e-postanın maskeli hali
   `e***@alan.com`) — tam e-posta/kimlik döndürme. `search` verilirse label üzerinde Türkçe küçük harf süzgeci.
3. **`list`'e opsiyonel `actor?: "system"` arg'ı:** verildiğinde `userId` olmayan olaylar. Proje kapsamında
   `by_project_user_timestamp` üzerinde `q.eq("projectId", p).eq("userId", undefined)` (Convex eksik alanı undefined ile eşler — doğrula,
   testle), global kapsamda `by_user_timestamp` aynı şekilde. `userId` ile birlikte verilirse 400 benzeri net hata. Arama modunda
   searchIndex filterField'ı undefined desteklemiyorsa sayfa-içi süzgece düş ve dönüşte `actorFilterScope: "index" | "page"` bildir.
4. Saf yardımcıları (`actor` index seçimi, label/maske üretimi, distinct birleştirme) `convex/lib/auditActors.ts` (+test) içine koy.
5. Yazım tarafına (audit insert) ve `searchText` üretimine DOKUNMA (geriye dönük backfill YOK).

## Ownership
convex/auditLog.ts · yeni convex/lib/auditActors.ts (+test) · convex/lib/auditSearch.ts ve convex/lib/audit.ts YALNIZ okuma
(değişiklik gerekiyorsa ask) · convex/_generated/api.d.ts (kendi satırların)

## Kapsam dışı
Frontend · dışa aktarma · yeni audit olay türleri (rol/üyelik/ayar) · searchText backfill · schema.ts (ask).

## Rapor
`.claude/orca-specs/reports/c2c-11-api.md`: actorOptions arg+dönüş tipi, status enum'unun Türkçe etiket önerisi
(Aktif / Proje üyesi değil / Silinmiş kullanıcı …), "Sistem" filtresinin hangi modlarda index'li olduğu, tarama sınırı ve
`truncated` iken UI'nın göstermesi gereken dürüst metin.
