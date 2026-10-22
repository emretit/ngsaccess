# W3b — Kullanıcı dondurma + erişim bitiş tarihi + 7 günlük oturum + guard açıkları (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex handler'ları schema alan adlarını olduğu gibi (camelCase) döner. Frontend'de Convex sonucu `any[]`'a açılmaz; `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>` kullan.
- `db.get` sonrası null süzme: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Convex kuralları: `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok; `take(N)` + sınır. Yeni cron/polling YOK (Convex Free kota).
- Şema: yalnız opsiyonel alan (migration yok). Mevcut kullanıcılar alanlar yokken bugünkü gibi çalışır.
- UI metinleri Türkçe, sade. Mevcut bileşen/stil desenini taklit et (`src/components/admin/**`, `src/components/ui/**`). Tarih/saat `Europe/Istanbul`.
- Audit: `writeAudit` (`convex/lib/audit.ts`); e-posta/IP/token yazma, yalnız olay kodu (`user.frozen`, `user.unfrozen`, `user.expiry_set`, `user.expiry_cleared`, `user.access_expired`).
- YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen/run), DB yazma, `convex/_generated/**` elle düzenleme (api.d.ts'ye yeni modül girişi gerekiyorsa mevcut desenle ekle ve raporda belirt), `mobile/**`.

## Hedef (test edilebilir)
Super_admin (her kullanıcı için) ve project_admin (kapsamı aşağıda) bir web kullanıcısını dondurabilir/çözebilir ve erişim bitiş zamanı atayabilir. Dondurulmuş ya da bitişi geçmiş kullanıcı giriş yapamaz, mevcut oturumları kapanır, hiçbir yetkili fonksiyon çağrısı geçmez. Yeni web oturumları 7 gün sürer. Mevcut iki guard açığı kapanır.

## Tasarım kaynağı
`.claude/designs/w3-2fa-claude.md` §4 ve `.claude/designs/w3-2fa-codex.md` §1 + §4 (yalnız dondurma/bitiş/guard kısımları). **2FA / OTP / MFA bu işte YOK** (Emre kararı: şimdilik 2FA olmayacak) — hiçbir MFA tablosu, alanı veya ekranı ekleme.

## Değişiklik
1. **Guard açıkları (önce bunlar):**
   - `authedAction` (`convex/lib/customFunctions.ts` ~104) gevşek `users.currentUser` (optionalAuthQuery) üstünden kullanıcı alıyor → tam guard kullanan internal query/mutation ile değiştir (verified + erişim kontrolü dahil).
   - `userProjects.getByCurrentUser` (`convex/userProjects.ts` ~6) yalnız oturum kontrolü yapıyor → tam guard.
   - `getValidAuthUserId` (`convex/lib/auth.ts` ~9-22) oturum satırının `expirationTime`'ını da kontrol etsin (geçmişse null).
2. **Şema (`convex/schema.ts`, YALNIZ `users` bloğu):** opsiyonel `disabledAt: v.number()`, `disabledBy: v.id("users")`, `accessExpiresAt: v.number()` (UTC epoch ms), `accessExpiryJobId: v.id("_scheduled_functions")`. Başka tabloya dokunma (ana ağaçta başka bir oturumun `employees` değişikliği var; çakışmasın).
3. **Tek kural (`convex/lib/accountAccess.ts`, saf):** `accessBlockReason(user, now): "disabled" | "expired" | null` (`accessExpiresAt <= now` → expired).
4. **Uygulama noktaları:** (a) `getValidAuthUserId` kullanıcıyı da okuyup bloklu ise null döner (tüm korumalı yollar buradan geçiyor; `getCurrentUser`'ın ikinci `db.get`'ini gereksizleştir); (b) `convex/auth.ts` `convexAuth({ callbacks: { beforeSessionCreation } })` bloklu kullanıcıda throw (genel "Giriş yapılamadı" mesajı; enumeration yok); kayıt (signUp) akışını ve `verified===false` davranışını bozma.
5. **Oturum süresi:** `convexAuth({ session: { totalDurationMs: 7 gün } })` (0.0.96 config alanını `node_modules/@convex-dev/auth` içinde doğrula; yoksa raporla, env önerme). Mevcut oturumlar kendi bitiş zamanlarıyla kalır.
6. **Oturum sonlandırma (`convex/lib/sessionRevoke.ts` + internalMutation):** kullanıcının `authSessions` satırlarını (`userId` index) `take(50)` ile sil, her biri için `authRefreshTokens`'ı (`sessionId` index) `take(100)` ile sil; artan varsa `ctx.scheduler.runAfter(0, internal...)` ile devam. Paketin sınırsız `invalidateSessions` yardımcısını kullanma.
7. **Yönetim mutation'ları (YENİ `convex/accountAccess.ts`):**
   - `freezeUser({ userId })`, `unfreezeUser({ userId })`, `setAccessExpiry({ userId, accessExpiresAt: number | null })`.
   - **Yetki:** super_admin → herkes. project_admin → yalnız hedef `role==="project_user"` VE hedefin TÜM `userProjects` üyelikleri çağıranın yönettiği projelerin alt kümesi ise; değilse Türkçe hata: "Bu kullanıcı başka projelerde de üye; yalnız sistem yöneticisi işlem yapabilir". project_user → yetkisiz.
   - **Korumalar** (`convex/lib/adminGuards.ts` genişlet): kendine işlem yok; son **etkin** (dondurulmamış ve süresi dolmamış) super_admin dondurulamaz/bitiş verilemez; `users.updateRole` ve `users.deleteUser`'daki son-admin sayımı da "etkin super_admin"e göre düzeltilsin. Kontrol ve yazma aynı mutation'da.
   - Freeze → `disabledAt/disabledBy` yaz + oturumları sonlandır + audit. Unfreeze → alanları temizle + audit (eski oturumlar zaten silinmiş).
   - setAccessExpiry → geçmiş zaman reddedilir (≥ şimdi+1 dk); eski `accessExpiryJobId` varsa `ctx.scheduler.cancel`; yeni tek seferlik `ctx.scheduler.runAt(accessExpiresAt, internal.accountAccess.expireAccess, { userId, expectedExpiresAt })` + job id yaz; null → alanları temizle + işi iptal. `expireAccess` alan hâlâ eşitse oturumları sonlandırır + audit, değilse no-op. **Cron yok.**
8. **Listeleme alanları:** `convex/lib/adminLists.ts` (`adminUserRow`) ve ilgili validator'lara `disabledAt`, `accessExpiresAt` ekle; `convex/lib/publicUser.ts` allowlist'ini genişletme (job id vb. istemciye gitmez).
9. **UI:**
   - `src/components/admin/AdminUsersPanel.tsx` (+ `hooks/useUserManagement.ts`, satır bileşenleri): satır aksiyonları "Dondur" / "Çöz" (onay diyaloğu: "Kullanıcının tüm oturumları kapanacak"), "Erişim bitişi" (tarih+saat, İstanbul; "Kaldır"), rozetler "Donduruldu", "Erişim bitti", "Bitiş: <tarih>". Hata toast; başarısızlıkta durum geri alınır.
   - project_admin'in kendi proje kullanıcılarını gördüğü bir ekran VARSA (`users.list` kullanan yer; ara) aynı aksiyonları orada da göster (sunucu yetkiyi zaten zorlar). YOKSA yeni sayfa AÇMA; raporda belirt.
   - `src/components/auth/AuthProvider.tsx`: bloklu kullanıcının oturumu silinince mevcut "orphan" mantığı çıkış yaptırıyor mu doğrula; giriş ekranında bloklu kullanıcıya genel hata metni.
10. **Testler** (`convex-test`, mevcut desen ör. `convex/users.test.ts`, `convex/invites.test.ts`):
    - Guard: dondurulmuş/bitişi geçmiş kullanıcı → authedQuery/authedMutation/adminMutation/authedAction ve `userProjects.getByCurrentUser` reddi; oturum süresi geçmiş → null.
    - beforeSessionCreation: bloklu kullanıcı signIn reddi; normal kullanıcı ve signUp etkilenmez.
    - Freeze oturum + refresh token siler (51+ oturumda devam işi zamanlanır); unfreeze sonrası yeni giriş çalışır.
    - Yetki matrisi: super_admin her hedef; project_admin yalnız tamamen kendi projelerindeki project_user; başka projede de üye hedef reddi; project_user reddi; kendine işlem reddi; son etkin super_admin koruması (+ updateRole/deleteUser).
    - Expiry: geçmiş zaman reddi; runAt zamanlanır; değiştirince eski iş iptal; `expireAccess` eşleşmeyen beklenen değerde no-op, eşleşende oturum siler.
    - `accessBlockReason` birim testleri. Mobil `employeeAuth*` testleri yeşil kalmalı.

## Ownership (yalnız bunlara yaz)
convex/schema.ts (yalnız users bloğu) · convex/auth.ts · convex/lib/auth.ts · convex/lib/customFunctions.ts · convex/users.ts · convex/userProjects.ts · convex/lib/adminGuards.ts · convex/lib/adminLists.ts · YENİ convex/accountAccess.ts (+test) · YENİ convex/lib/accountAccess.ts (+test) · YENİ convex/lib/sessionRevoke.ts (+test) · convex/_generated/api.d.ts (yalnız yeni modül girişleri) · src/components/admin/** · project_admin kullanıcı ekranı (bulunursa, raporda yolu yaz) · src/components/auth/AuthProvider.tsx · ilgili mevcut test dosyaları.

## Kapsam dışı
2FA/OTP/MFA (tamamı) · mobil çalışan girişi (`employeeAuth`) · özel rol tanımı · AD eşitleme · `employees` tablosu · `mobile/**`.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `npm ci` (worktree yeniyse) sonra:
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar, eklenen fonksiyonlar, kapı sonuçları (sayılarla), project_admin ekranı bulundu mu, bilinçli kararlar (file:line).
