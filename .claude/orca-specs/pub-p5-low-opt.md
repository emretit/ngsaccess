# P5-düşük / W-opt — çıkışta hata atan 3 sorguyu oturumsuzken boş döndür (optionalAuth)

HEDEF (test edilebilir): Geçerli oturum yokken (`getValidAuthUserId` null) `projects.listActive` `[]`, `ideSync.listSyncIssues` ve `hikvisionSync.listSyncIssues` boş sonuç (aynı dönüş şekli, `items: []`) döner, hata ATMAZ. Diğer tüm durumlarda davranış AYNEN korunur.

## Bağlam
Oturum silinince (çıkış) bu 3 abonelik sunucuda yeniden koşup `getCurrentUser` → "Giriş yapmanız gerekiyor" atıyor (Convex loguna gürültü). UI etkilenmiyor; amaç log gürültüsünü kaldırmak, güvenliği DEĞİŞTİRMEMEK.

## Yapılacak
- `convex/lib/auth.ts`'teki `getValidAuthUserId(ctx)` kullan. Handler başında: `if (!(await getValidAuthUserId(ctx))) return <boş>;` sonra mevcut mantık (getCurrentUser / resolveProjectScope / ctx.user) aynen.
- `authedQuery` yerine `query` (veya `optionalAuthQuery`) kullanırsan: `verified === false` kullanıcı için davranış ŞU ANKİYLE AYNI kalmalı (hata atması dahil) — `optionalAuthQuery` verified kontrolü YAPMAZ, dikkat. En güvenlisi: `query` + erken boş dönüş + ardından `getCurrentUser(ctx)` (mevcut guard'lar).
- listSyncIssues'ın şu anki dönüş objesinin TÜM alanlarını koru (frontend `FunctionReturnType<...>["items"][number]` kullanıyor: src/components/sync/SyncIssuesBanner.tsx). Boş durumda diğer alanlar için mevcut boş-sonuç değerlerini kullan (ör. sayaçlar 0).
- Mümkünse `returns` validator ekleme zorunlu DEĞİL (mevcut shape'i bozma riski); eklemeyeceksen dokunma.
- Yalnız bu 3 export'a dokun; dosyalardaki diğer fonksiyonlar kapsam dışı.

## Ownership
convex/projects.ts (yalnız listActive), convex/ideSync.ts (yalnız listSyncIssues), convex/hikvisionSync.ts (yalnız listSyncIssues), yeni test dosyası convex/syncIssuesAuth.test.ts (veya mevcut ilgili testin yanına yeni dosya; mevcut test dosyalarına ancak zorunluysa ekle).

## Kapsam dışı / DOKUNMA
src/** (frontend değişmez), convex/lib/auth.ts, convex/schema.ts, convex/cardReadings.ts, convex/lib/pdks*, convex/dashboard.ts, mobile/**, diğer worker'ların dosyaları (convex/employeeAuth.ts, convex/actions/**, convex/auth.ts, convex/invites.ts, src/components/auth/**). Ağaçta başka oturumların commit'siz işi var; dokunma/revert etme.

## Testler (zorunlu)
- Kimliksiz çağrı → 3 fonksiyon boş döner, throw yok.
- Silinmiş oturumlu (JWT var, session yok) çağrı → boş (convex/lib/auth.test.ts'teki kalıba bak).
- Normal oturumlu kullanıcı → mevcut sonuç (en az listActive için).
- verified=false kullanıcı → önceki davranışla aynı (throw).

## Kapılar (kendin koş, çıktıyı rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (başka oturumun dosyasından gelen hata varsa ayrı listele)
- `node_modules/.bin/eslint convex/projects.ts convex/ideSync.ts convex/hikvisionSync.ts <yeni test>` → 0 error
- `node_modules/.bin/vitest run <yeni test> <ideSync/hikvisionSync/projects ile ilgili mevcut testler>` → yeşil

## Yasak
commit / push / deploy / `convex dev` / `convex run` / migration / canlı DB yazma YOK. `any` yasak.

## Rapor
`/tmp/pub-p5/fix-low-opt.md` (≤20 satır, file:line) + worker_done'da ≤10 satır, `--files-modified` gerçek liste.
