# W3a — Web yönetici 2FA ve hesap erişim yaşam döngüsü

Salt-okuma tasarım, 21.10.2026. Bu rapor dışında dosya değiştirilmedi; canlı sisteme çağrı/yazma yapılmadı.
`notable-tern-4` ve Free plan kısıtları görev girdisidir; canlı yapılandırma **[teyit]**. Satırlar inceleme anındaki çalışma ağacına aittir.

## §1 — Mimari kararı ve doğrulanmış mevcut durum

**Öneri: (a), oturum başına MFA kapısı; bunun önkoşulu bütün web veri yollarının aynı erişim kararından geçmesidir.**
Şifre oturumu kimlik kanıtıdır; uygulama erişimi ancak hesap etkin, e-posta uygun ve gerekiyorsa aynı oturumun OTP'si doğrulanmışsa verilir.
`package.json:29` aralığı `^0.0.96`; kurulu paket `node_modules/@convex-dev/auth/package.json:3` = `0.0.96`. W3b bu sürümle doğrulasın; bu işte paket yükseltmesin.
Mevcut Password provider `convex/auth.ts:7`; e-posta normalizasyonu `convex/lib/authEmail.ts:1`, yeni parola politikası `convex/lib/passwordPolicy.ts:1`, JWT issuer `convex/auth.config.ts:4`.
`users` authTables üzerine genişletilmiş, eski `verified=undefined` hesaplar kabul ediliyor (`convex/schema.ts:11`, `convex/schema.ts:34`). Bu geçiş davranışı korunmalı.

| Seçenek | Güvenlik ve refresh | Değişiklik / sürüm uyumu | Karar |
| --- | --- | --- | --- |
| (a) Password + bekleyen oturum | JWT tek başına yeterli olmaz; bir açık guard bütün MFA'yı aşar. Refresh aynı sessionId'yi korur, onay üretmez. | `getAuthSessionId` mevcut; ortak guard, action, ham query ve UI düzeltmesi gerekir. 0.0.96 ile ek provider gerektirmez. | Önerilen; guard envanteri yayına çıkış şartı. |
| (b) ConvexCredentials iki adım | OTP öncesi oturum yok; fakat eski Password signIn açık kalırsa tam bypass. Refresh yine provider authorize'a uğramaz. | Account provider id/hash uyumu, kayıt/davet/reset akışlarının yeniden kurulması gerekir. API var; `authorize` özel challenge cevabı döndüremez, yalnız `{userId,sessionId?}` veya null. Başlangıç için ayrı action + opak challenge gerekir. | Daha büyük kimlik geçişinde düşünülsün. |
| (c) Password verify/reset veya Email | `verify` yalnız doğrulanmamış account için; her girişin ikinci faktörü değildir. Email tek başına şifresiz giriş, reset ise kurtarmadır. MFA kapısı eklenmeden kullanılırsa bypass. | Yerleşik ve sürüm uyumlu ama bu gereksinimi tek başına karşılamaz; `emailVerified` değerini her girişte silmek yarış/hesap bağlama riski yaratır. | Önerilmez. |

Kanıt: `node_modules/@convex-dev/auth/src/providers/ConvexCredentials.ts:48` ve `:62`; `node_modules/@convex-dev/auth/src/providers/Password.ts:153`, `:178`, `:208`, `:229`.
Provider'sız refresh yolu `node_modules/@convex-dev/auth/src/server/implementation/signIn.ts:54`; sessionId korunması `node_modules/@convex-dev/auth/src/server/implementation/mutations/refreshSession.ts:64`.
Resmî genel kapsam da OTP, parola reset ve e-posta doğrulamayı ayrı akışlar olarak listeler: [Convex Auth](https://labs.convex.dev/auth).

**Guard sınırı ve somut kapatılacak yollar:**
- `getValidAuthUserId` session varlığı/sahipliğine bakıyor, session expiration kontrolü yok (`convex/lib/auth.ts:9`). `getCurrentUser` yalnız verified kontrolünü ekliyor (`:27`).
- `authedQuery/Mutation`, admin ve superAdmin sarmalayıcıları merkezi guard kullanıyor (`convex/lib/customFunctions.ts:13`, `:47`, `:75`).
- **Açık yol:** `authedAction`, `currentUser` üzerinden nullable/gevşek kullanıcı alıp `Doc` cast ediyor (`convex/lib/customFunctions.ts:104`); `currentUser` optional guard kullanıyor (`convex/users.ts:27`). Bunu tam guard kullanan internal kontrolle değiştir.
- **Açık yol:** `userProjects.getByCurrentUser` yalnız session kontrolünden sonra proje isimlerini döndürüyor (`convex/userProjects.ts:6`). Tam guard'a geçir.
- `projects.listActive`, Hik/IDE `listSyncIssues` zaten sonraki satırda tam guard çağırıyor; gereksiz bypass diye raporlama (`convex/projects.ts:33`, `convex/hikvisionSync.ts:632`, `convex/ideSync.ts:585`).
- Ham kayıt/davet istisnaları: `users.initializeAdmin` ve `invites.consume` (`convex/users.ts:147`, `convex/invites.ts:220`). Yeni doğrulanmamış hesap için dar kurulum izni kalsın; mevcut hesapta frozen/expired/MFA kontrolü zorunlu. Davet MFA'yı tamamlamaz.
- HTTP auth rotaları `convex/http.ts:12`; cihaz `/card-reader` ayrı relay/device yetkisi kullanıyor (`:87`). Web HTTP/action veri yolları tam guard; cihaz rotaları MFA'ya bağlanmaz. `auth.isAuthenticated` sadece identity varlığını ölçer, uygulama yetkisi değildir (paket `src/server/implementation/index.ts:460`).

**Akış:** Password → sunucudan `getAuthSessionId` → minimal `sessionStatus` → gerekiyorsa OTP iste/gir → atomik session onayı → uygulama sorguları.
MFA gereken kullanıcıda session durum kaydının **yokluğu da bekliyor** demektir; ilk OTP isteğinin yapılmaması yetki vermez. Başka oturumun onayı kullanılamaz.
`getCurrentUser` sırası: kimlik/session sahipliği ve süresi → kullanıcı erişim kısıtı/revocation → verified → güncel MFA politikası + session onayı → rol/proje.
`getCurrentUserOrNull` korumalı veriye tam yetkili kullanıcı veya null döndürsün; UI için ayrı status query yalnız durum, maskeli e-posta ve bekleme zamanı döndürsün.
Bekleyen kullanıcı yalnız status, kendi OTP işlemleri, signOut ve dar kurulum akışlarını çağırabilir; profil, projeler, dosya URL'leri, cihaz işlemleri ve e-posta gönderim yetkisi yoktur.
Action başlangıcında taze internal mutation ile erişim kontrolü; dış yan etki öncesi ve sonuç döndürmeden önce uzun işler tekrar kontrol edilir. İç DB yazısı kendi transaction'ında yeniden kontrol eder.
Scheduled action'a kullanıcı auth bağlamı taşınacağı varsayılmaz; kullanıcı kaynaklı işler server-derived actor/session/revision ile tekrar yetkilendirilir. Cihazın bağımsız iş kuyruğu ayrı kalır.

## §2 — OTP protokolü, kötüye kullanım ve kayıtlar

- Node action'da kriptografik RNG ile **8 rakam**, baştaki sıfırlar korunur; `Math.random` kullanılmaz. Salt 128 bit, nonce 128 bit; süre 5 dakika.
- Saklama: `HMAC-SHA256(serverPepper, purpose | sessionId | nonce | salt | code)`; DB yalnız digest/salt/nonce tutar. Kısa kod için yalnız tuzlu SHA256 offline aramayı engellemez; pepper env'de, keyVersion saklanır.
- Kod/şifre/token log, audit, URL, localStorage veya scheduler argümanına konmaz. Kod yalnız action belleği ve Resend isteğinde bulunur; API argümanları için platform log/redaction davranışı **[teyit]**, debug log kapalı olmalı.
- Tek session/purpose için tek güncel challenge; resend eskisini derhal geçersiz kılar. `login`, `enable`, `disable`, `adminReset` amaçları karıştırılamaz; yönetim challenge'ı hedef kullanıcı ve istenen işlemin digest'ine de bağlıdır.
- Challenge başına 5 yanlış deneme; hesap başına tüm oturumlarda 15 dakikada 10 deneme. Yeni session/resend bu hesabın bütçesini sıfırlamaz.
- Resend en erken 60 saniye; hesap başına saatte 5, günde 20 gönderim; deployment genel gönderim bütçesi de olmalı. Başarısız sağlayıcı isteği bütçeyi tüketir; otomatik tekrar döngüsü yok.
- Hazır limiter `convex/lib/rateLimit.ts:4` ve `convex/convex.config.ts:5`; tek transaction'daki hesap limitini tercih et. Deneme/limit yazısından sonra throw edilirse transaction geri alınır: başarısızlıkta typed sonuç dön, UI hata gösterir.
- Verify action salt/nonce'u internal query'den alır, candidate digest hesaplar; internal mutation güncel nonce, session, kullanıcı, politika, expiry, attempts ve purpose'u yeniden kontrol ederek digest'i sabit uzunlukta karşılaştırır.
- Aynı mutation içinde attempt artırılır veya challenge tüketilip `verifiedAt`/`mfaVersion` yazılır. Eşzamanlı iki doğru istekten yalnız biri başarılı; kod tüketimi ile MFA grant farklı transaction'lara ayrılmaz.
- OTP gönderim action'ı kod üretir → internal mutation limit/rezerve/hash kaydı → Resend → internal mutation generation eşleşiyorsa delivery sonucunu kaydeder. Yanıt kaybında yeni kod değil mevcut durum gösterilir; kullanıcı kontrollü resend gerekir.
- E-posta yalnız DB'deki hesaptan alınır; istemci `email`, `userId`, `sessionId` ile başka hesaba kod yollayamaz. Post-password endpoint hesap araması yapmaz; maskeli adres ancak bu kimlikten sonra görünür.
- Şifre aşamasında olmayan hesap/yanlış şifre/dondurulmuş hesap için aynı hata; normalizasyon sabit. Mevcut UI zaten genel mesaj gösteriyor (`src/pages/Login.tsx:80`), fakat doğrudan auth API hata/zaman farkı ayrıca test edilmeli.
- Yerleşik Password'ün timing eşitliği varsayılmaz: gerekirse mevcut Password config'in `authorize` delegasyonunu güvenli genel hata + başarısız giriş minimum yanıt süresi/jitter ile sar; bilinmeyen hesap için eşdeğer dummy parola doğrulaması ekle. Tam sabit ağ zamanı iddia edilmez, limit + maliyet eşitlemesi esastır.
- Enroll öncesi parola yeniden doğrulaması `retrieveAccount` ile, ardından aynı mail'e OTP; şifre kaydedilmez. Disable/adminReset için son 5 dakikada amaç-bağlı yeniden parola+OTP kanıtı; yalnız eski bir açık sekme yeterli değil.
- Güvenlik e-postası global doğrulanmış gönderenle gönderilir: mevcut Resend yolu `convex/actions/sendEmail.ts:16`, escaping kuralı `:62`. `mailSettings` proje bazlı (`convex/schema.ts:945`); girişte proje seçilemediği için MFA'yı proje SMTP/aktiflik ayarına bağımlı yapma.
- Audit: `securityAudit` typed olaylar (`otpRequested/Rejected/Verified`, `mfaEnabled/Disabled/Reset`, `frozen/unfrozen/expiryChanged`, `sessionsRevoked`), zaman, sonuç/reason enum, HMAC aktör/hedef referansı ve correlation nonce. Ad, e-posta, IP, UA, kod, hash, salt, token veya ham payload yok.
- HMAC referanslar takma kimliklidir, tam anonimlik değildir; doğrudan kişi verisi yazılmaz. Mevcut `writeAudit` ad/e-posta türetiyor (`convex/lib/audit.ts:22`), MFA için aynen kullanılmamalı. Audit saklama 90 gün; yalnız yetkili paginated okuma, mevcut bakım akışında sınırlı silme; yeni cron yok.

## §3 — Kapsam, geçiş ve kurtarma

Seçenekler: rol zorunluluğu (tutarlı), proje ayarı (çok projede herhangi bir zorunluluk kazanır), kullanıcı tercihi (kolay pilot, daha zayıf kapsama).
Öneri: deployment flag varsayılan kapalı; önce super_admin/project_admin gönüllü kayıt, sonra iki rol için zorunlu. `project_user` kişisel opt-in kullanabilir; zorunluluk kapsamı web yöneticileridir.
Proje ayarı ilk sürümde yok: giriş öncesi proje seçimi ve proje değiştirerek kaçış riskini önler, her guard'a üyelik sorgusu eklemez. Rol zorunluluğu opt-out ile aşılamaz.
`securitySettings.webMfaEnabled=false` veya kayıt yoksa eski davranış; kullanıcı alanlarının yokluğu false/0 kabul edilir. Mail ve kurtarma denenmeden flag açılmaz.
Gönüllü enrollment doğru OTP ile tamamlanmadan `mfaEnabled=true` yazılmaz. Aktifleştirme sırasında mevcut session onaylanır; diğer session'ların mfaVersion'ı eski kalır.
Zorunlu politikaya geçişte eski session'lara örtük onay verilmez; mevcut yöneticiler OTP ekranına yönlenir. Aynı anda herkesi kilitlememek için önce küçük pilot + ikinci super_admin + mail teslim smoke testi.
Rol terfisi/politika/2FA sıfırlama `mfaVersion` artırır veya yeni zorunluluğu anlık değerlendirir. Eski onay, sonradan yükseltilen yetkiyi otomatik açmaz.
Super_admin başka kullanıcının MFA'sını sıfırlayabilir; oturumları iptal eder, yeniden kayıt zorunluluğu bırakır. Zorunlu politikayı kalıcı kapatmak veya herkese bypass vermek değildir.
Mail hesabını kaybetmiş kullanıcı: bağımsız kimlik kontrolü sonrası operasyonel e-posta düzeltme + doğrulama; aynı erişilemeyen adrese tekrar OTP kurtarma sayılmaz.
Tek super_admin kilitlenirse: Convex deployment sahibi tarafından denetlenen **internal-only** hedefli recovery mutation; tek kullanıcı için süreli recovery/enrollment ve session iptali, olay kaydı. Public setup-secret endpoint açılmaz; W3b recovery prosedürünü ayrı yetkili çalıştırma için hazırlar, bu görevde çalıştırılmaz.
İlk sürümde “Bu cihazı 30 gün hatırla” yok. MFA onayı session ömrü boyunca geçerli (üst sınır 12 saat önerisi); yeni session tekrar OTP ister. Paket varsayılanı 30 gündür (`node_modules/@convex-dev/auth/src/server/implementation/sessions.ts:19`), açıkça yapılandırılmalı.
İleride TOTP, aynı session onay kaydındaki `method` enum'una ikinci yöntem olarak eklenir; secret şifreli saklanır.
TOTP kurtarma kodları ayrı, tek kullanımlık ve hashli olur; bu sürümün e-posta challenge'larıyla paylaşılmaz.

## §4 — Dondurma, bitiş tarihi ve oturum iptali

`users` opsiyonel alanları: `disabledAt:number`, `disabledBy:Id<users>`, `accessExpiresAt:number` (UTC epoch ms), `sessionsRevokedBefore:number`, `mfaEnabled:boolean`, `mfaVersion:number`.
Hesap dondurma, personel `employees.isActive`/ziyaretçi bitişinden tamamen ayrıdır (`convex/schema.ts:83`, `:101`). Mobil ayrı `employeeSessions/employeeAuth` kullanır (`convex/lib/employeeAuth.ts:8`, `convex/employeeAuth.ts:12`); bunlar değişmez.
Her tam guard `disabledAt !== undefined` veya `now >= accessExpiresAt` ise reddeder. Tarih geçmişteyse login callback de reddeder; yalnız UI saklamak yetmez.
`auth.callbacks.beforeSessionCreation` içinde etkinlik kontrolü konur; kayıt verified=false akışını burada engelleme. Hook yeni session transaction'ında çalışır (`node_modules/@convex-dev/auth/src/server/implementation/sessions.ts:92`); refresh sırasında çalışmaz.
Freeze transaction'ı hedefi dondurur + revocation cutoff yazar + audit + ilk sınırlı iptal batch'ini yapar. Guard session `_creationTime <= sessionsRevokedBefore` ise reddeder; unfreeze/expiry uzatma eski oturumları diriltemez.
`authSessions` userId index'inden en fazla 50 kayıt sil; her session için refresh tokenları mevcut `sessionIdAndParentRefreshTokenId` index'inden en fazla 100'lük batch'lerle temizle. Artanı `runAfter(0)` internal continuation ile sürdür; bu olay tetiklemeli sınırlı iş, cron/polling değildir.
Session önce silinir, refresh temizliği sonra tamamlanabilir: paket refresh session yoksa reddeder (`node_modules/@convex-dev/auth/src/server/implementation/refreshTokens.ts:136`). Henüz silinmemiş batch'lerde refresh token üretebilir ama uygulama guard'ı erişim vermez; “hepsi anında fiziksel silindi” denmez.
Paketin `invalidateSessions` yardımcısı sınırsız collect kullanır (`node_modules/@convex-dev/auth/src/server/implementation/mutations/invalidateSessions.ts:30`); yeni sınırsız toplama eklememe kuralı için batch helper gerekir, paket içinden özel import yapılmaz.
Yetki matrisi: super_admin → başka web kullanıcısı freeze/unfreeze/expiry/MFA reset; project_admin → yalnız kendi MFA tercihi; project_user → yalnız kendi MFA tercihi. Global hesabı proje yöneticisinin dondurması diğer projeleri etkiler, ilk sürümde yasak.
Kendi freeze ve kendi expiry değişimi reddedilir. Son **etkin, verified!==false ve süresiz** super_admin korunur; diğer adminlerin gelecekte hep birlikte sona ermesi de böyle engellenir.
`users.updateRole/deleteUser` koruması sadece toplam admin sayısını sayıyor (`convex/users.ts:63`, `:186`; `convex/lib/adminGuards.ts:14`); aynı aktif-süresiz korumasını rol düşürme/silme ve expiry değişimine uygula.
Kontrol ve değişiklik aynı transaction'da; `by_role_and_disabledAt_and_accessExpiresAt` ile süresiz etkin adaylara sınırlı bak, hedef dışı uygun birini bul; sınır aşımında bilinmeyeni güvenli reddet. Eşzamanlı iki admin işlemi son admini kaldıramamalı.
UI “Son erişim zamanı” saat ve `Europe/Istanbul` gösterir; bitiş anı dışlayıcıdır (`>=`). Yalnız tarih seçilirse seçilen günün ertesi 00:00 İstanbul anına dönüştür ve kullanıcıya açık göster; sunucu finite/integer/aralık doğrular.

**Zaman ve query cache sınırı — W3b'de atlanamaz:**
Convex query `Date.now()` değişti diye tekrar çalışmaz; aynı argümanlı sonuç cache'ten gelebilir. [Resmî açıklama](https://docs.convex.dev/understanding/best-practices#dont-use-datenow-in-queries). Bu nedenle yalnız guard'a tarih eklemek “bitişten sonraki tüm okumalar kesin reddedilir” garantisi değildir.
Cron'suz düşük maliyetli yol: expiry atamasında **tek** `runAt(accessExpiresAt)` internal mutation; beklenen expiry/revision hâlâ eşitse cutoff yazıp session iptalini başlatır. Güncellemede eski job iptal edilir veya revision ile no-op olur; user/session yazısı query aboneliklerini invalid eder.
İstek anı kontrolleri her durumda kalır; action giriş/çıkışındaki mutation kontrolü cache kullanmaz. UI'da tek yerel timer veriyi kaldırır, ağ polling yapmaz; istemci saati güvenlik kaynağı değildir.
Scheduler'ın tam milisaniyede çalışma garantisi varsayılmaz; mutlak sınır isteniyorsa bu düşük maliyetli yol **tek başına yeterli değildir**. Önceden indirilmiş verinin kullanıcıdan geri alınması zaten mümkün değildir.
**Katı yorum için uygulanabilir alternatif:** bitişli hesaplar public korumalı query'lerden daima `EXPIRING_ACCOUNT_USE_ACTION` alır; okuma iş mantıkları internalQuery'ye çıkarılır, typed action facade taze internal mutation kontrolü → internalQuery → taze son kontrol ile cevap verir. Client bu hesaplarda query yerine kullanıcı etkileşiminde action kullanır; polling yok.
Facade keyfi function adı kabul etmez; her domain için typed allowlist/args ve tam proje scope'u gerekir. Public query blokajını yalnız client'a bırakma. Bu alternatif tam çağrı reddi sağlar ama okuma başına 3 ek server çağrısı ve geniş UI değişikliği getirir; §7 kararına bağlıdır.
Refresh, hesap expiry alanını okumaz (`node_modules/@convex-dev/auth/src/server/implementation/refreshTokens.ts:112`). İptal tamamlanana kadar token basabilmesi erişim izni değildir; ham refresh'in de deadline'da kesin reddi talep edilirse auth katmanına ayrıca sürümle doğrulanmış interception gerekir **[teyit]**, provider hook yeterli denmemeli.

## §5 — Dosyalar, şema ve fonksiyon sözleşmeleri

Yeni tablolar (alanlar aksi belirtilmedikçe zorunlu; mevcut belgelere zorunlu alan/migration yok):
- `securitySettings`: `key:"webAuth"`, `webMfaEnabled:boolean`, `requireAdminMfa:boolean`, `revision:number`; `by_key`.
- `webMfaSessions`: `sessionId:Id<authSessions>`, `userId:Id<users>`, `verifiedAt?:number`, `mfaVersion:number`, `method:"email"`; `by_sessionId`, `by_userId`.
- `webMfaChallenges`: `sessionId`, `userId`, `purpose` enum, `nonce`, `salt`, `digest`, `keyVersion`, `mfaVersion`, `expiresAt`, `attempts`, `consumedAt?`, `deliveryStatus`, `operationDigest?`, `operationTargetId?:Id<users>`, `grantedAt?:number`, `operationUsedAt?:number`; `by_sessionId_and_purpose`, `by_userId`.
- `webSecurityLimits`: `userId`, `windowStart`, `attemptCount`, `sendHourStart`, `sendHourCount`, `sendDayStart`, `sendDayCount`, `nextSendAt`; `by_userId`. Upsert aynı transaction'da, session churn ile büyümez.
- `securityAudit`: `event` enum, `at:number`, `actorRef?:string`, `targetRef?:string`, `outcome` enum, `reason?` enum, `correlationId:string`; `by_at`, `by_targetRef_and_at`.
- `users` yukarıdaki opsiyonel alanlara ek `accessRevision?:number` (yönetim optimistic concurrency), `accessExpiryRevision?:number`, `accessExpiryJobId?:Id<_scheduled_functions>`, `mfaEnrollmentRequired?:boolean`, `mfaRecoveryUntil?:number`; yeni index yukarıda. Challenge aynı session/purpose satırını overwrite ederek büyümeyi sınırla; orphan session/challenge temizliği aynı revoke batch ve mevcut bakımla yapılır.
- Recovery hiçbir iş verisi kapısını açmaz; yalnız yeniden kayıt akışına süreli izin verir, `mfaEnrollmentRequired` gerçek OTP tamamlanana kadar tam guard'ı kapalı tutar. Gerekli mail düzeltmesi ayrı operatör kimlik kontrolüyle yapılır. AdminReset OTP tüketimi `grantedAt` üretir; `resetMfa` hedef/purpose/version/5 dakika kontrolüyle `operationUsedAt` yazar ve işlemi aynı transaction'da tamamlar.

| Dosya / fonksiyon | Args → sonuç | Kayıt tipi / yetki |
| --- | --- | --- |
| `convex/lib/auth.ts`: `getSessionPrincipal`, `assertAccountActive`, `requireWebAccess` | ctx, server now → typed user/session | Paylaşılan helper; tam guard ve dar MFA guard ayrılır. |
| `convex/webSecurity.ts`: `sessionStatus` | `{}` → signedOut/unverified/blocked/mfaRequired/ready union; yalnız ready'de publicUser | Ham query; yalnız kendi session'ı, minimal veri. |
| `webSecurity.requireCurrentAccess` | `{}` → user/session/revision | internalMutation; action çağrısında auth propagate, tam guard. |
| `convex/actions/webMfa.ts`: `requestCode` | `{purpose, password?:string, targetUserId?:Id<users>}` → retryAt/status | action; login'de pre-MFA guard, diğer amaçlarda tam guard + yeniden parola; target yalnız adminReset. |
| `actions/webMfa.verifyCode` | `{purpose, code:string, nonce:string}` → ok/rejected/retryAt | action; kendi session, uzunluk/format/limit doğrulama. |
| `convex/webMfa.ts`: `reserveChallenge`, `readChallenge`, `consumeChallenge`, `markDelivery` | internal typed salt/digest/nonce/purpose → bounded status | internalMutation / readChallenge internalQuery; kimlik sunucudan, tekrar tüm durum kontrolü. |
| `webMfa.consumeChallenge` enrollment/disable | amaç bağlı kayıt → MFA ayarı + version + audit | Ayrı public `setMfaEnabled(true)` yok; istek/OTP aynı işlem kaydına bağlı. |
| `convex/users.ts`: `setAccessState` | `{userId, disabled:boolean, expectedRevision:number}` → revision | superAdminMutation; hedef parametre aktör kimliği değildir. |
| `users.setAccessExpiry` | `{userId, accessExpiresAt:number|null, expectedRevision:number}` → revision | superAdminMutation; null kaldırır, session cutoff ve son admin kontrolü. |
| `users.resetMfa` | `{userId, operationNonce:string}` → null | superAdminMutation; tüketilmemiş hedefe bağlı taze adminReset onayı; sürüm artır/oturum iptal. |
| `webSecurity.expireAccess`, `revokeSessionsBatch` | `{userId, expectedRevision/cutoff, cursor?}` → bounded progress | internalMutation; tek-sefer deadline ve batch continuation. |
| `webSecurity.recoverMfa` | `{userId, recoveryUntil:number, reasonCode}` → null | internalMutation, yalnız deployment operatörü; süreli ve hedefli, audit. |

`convex/lib/customFunctions.ts`, `convex/users.ts/currentUser`, `convex/userProjects.ts`, `convex/invites.ts`, `convex/auth.ts` birlikte güncellenir; bütün public action/query/mutation/httpAction export'ları explicit allowlist ile taranır.
`convex/lib/publicUser.ts:6` allowlist korunur; yeni MFA hash/salt/version/recovery alanları yayılmaz. Yönetim listesine yalnız etkinlik/expiry/MFA durum özeti ekle (`convex/lib/adminLists.ts`, admin user validator/type).
`src/components/auth/AuthProvider.tsx:40` status union kullanır; `:106` onboarding ve `:120` redirect yalnız ready durumunda. `isAuthenticated` true iken pending session'ı orphan sayıp signOut etme (`:124`).
`src/pages/Login.tsx`: şifre sonrası “E-postanıza gönderilen kod”, tek 8 haneli input (`inputMode=numeric`, `autoComplete=one-time-code`), resend kalan süre, hata/odak, iptal/signOut, `next` korunması; parola OTP ekranında tutulmaz.
`src/pages/SystemAdmin.tsx:57` içindeki `AdminUsersPanel`, `components/UserTable`, `UserFormDialog` ve yönetim hook'u: Dondur/Çöz, son erişim zamanı, 2FA sıfırla, işlem özeti/onay; hata halinde state geri alınır.
`src/pages/Profile.tsx:46` → `src/components/profile/SecurityCard.tsx:29` mevcut “Yakında” yerini policy/enable/disable adımlarına bırakır; zorunlu kullanıcıya “Yönetici hesapları için zorunlu” gösterilir.

**Test kabul listesi (mock guard ile yetinme):**
- Gerçek wrapper'larla pending session: tüm public web query/mutation/action, dosya URL'si, userProjects, currentUser, HTTP ve doğrudan RPC bypass; yalnız dar allowlist geçer.
- OTP: yanlış 5 deneme kalıcı; paralel verify/resend; süre sınırında `>=`; reuse; başka session/hesap/purpose/nonce; farklı sekmeler; login yaparak rate limit sıfırlama; provider timeout/yanıt kaybı.
- Freeze/expiry: mevcut JWT, yeni login, eski refresh, unfreeze sonrası eski JWT, deadline uzatma/kaldırma, eski scheduler işi, silinmiş kullanıcı/session, tam deadline ve clock skew.
- Refresh testi MFA grant'i taşımayan yeni session'ı, aynı session refresh'ini, cleanup öncesi basılmış tokenın guard'da reddini ve cleanup sonrası refresh reddini ayrı ölçer.
- İki admin eşzamanlı freeze/demotion/delete; son etkin-süresiz admin; kendi işlemleri; project_admin'in başka projedeki/global hesabı yönetmesi; MFA sıfırlama işleminin hedef değişimi/replay.
- Cache testi: deadline öncesi aynı query'ye abone ol, saati ilerlet, DB değişmeden stale sonucu gözle; tek job invalidation ve katı alternatifin direkt public query blokajını doğrula. UI timer tek başına başarı ölçütü değildir.
- Signup, doğrulama, ilk admin, davet, onboarding; `verified=undefined`; politika kapalı; rol yükseltme; parola-reset eklenirse onun session'ı da MFA'ya tabi. Mobil employee login/session ve cihaz relay regresyonları.
- Kod/şifre/PII audit'e sızmaz; URL'de OTP yok; 360px/klavye/ekran okuyucu ve Türkçe mesajlar. Sahte istemci alanları yetki kaynağı olamaz.

## §6 — W3b uygulama sırası, süre ve geri dönüş

1. **0,5–1 gün:** bütün web export/guard envanteri ve gerçek wrapper negatif testleri; action + userProjects açık yollarını kapat. Başarı: verified=false/pending hiçbir iş verisi göremez, kayıt/davet çalışır.
2. **0,5–1 gün:** opsiyonel schema + erişim helper + beforeSessionCreation + session cutoff/batch; freeze/expiry yönetimi ve son etkin-admin yarış testleri. Flag kapalıyken eski hesap uyumu kanıtlanır.
3. **1–1,5 gün:** OTP crypto/reserve/consume/mail/limit/audit; eşzamanlılık ve delivery hata testleri. Mail sender/pepper eksikse fail closed, yetki verilmez.
4. **1 gün:** AuthProvider status ve Login OTP; Profile enrollment/disable; SystemAdmin işlemleri. Refresh, sayfa yenileme, iki sekme, onboarding ve güvenlik ayarı testleri.
5. **0,5–1 gün:** recovery + tek expiry job + cache kanıtı, quota ölçümü, envanterdeki her istisnanın incelemesi; `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/eslint src convex`, hedefli Vitest ve E2E.
6. **0,5 gün:** test ortamında mail/OTP/refresh/recovery smoke, ardından ayrı yetkili yayın süreci; canlı `notable-tern-4` üzerinde bu tasarım görevi hiçbir işlem yapmaz. Gönüllü pilot → teslimat ve recovery kanıtı → rol zorunluluğu.
Toplam temel yol **4–6 iş günü**; katı expiry read facade alternatifi envantere göre **+2–4 gün [teyit]**. Kısa otomatik testler bu rapor için çalıştırılmadı; kod değişmedi.
Kota: ordinary query guard ek DB okumaları yapar, ayrı function çağrısı yaratmaz; OTP yalnız giriş/resend/verify sırasında çalışır. Tam action guard ve katı read facade ek çağrı maliyeti pilotta ölçülmeli; yeni polling/sık cron yok.
En büyük üç risk: (1) unutulmuş ham/optional/action yolu, (2) refresh + query cache nedeniyle expiry'nin olduğundan güçlü sunulması, (3) Resend/mail kaybıyla yönetici kilitlenmesi.
Geri dönüş: önce zorunlu politika kapatılır; kullanıcı opt-in'ı ayrı tutulur. Tüm MFA enforcement'ını kapatma yalnız kontrollü acil müdahaledir, audit gerekir; otomatik mail hatası bypass'ı yok.
Freeze/expiry/revocation kontrolleri MFA flag'inden bağımsız kalır. Eski insecure guard sürümüne dönülmez; schema ve audit kayıtları silinmez, iptal edilmiş session'lar geri getirilmez. UI geri alınacaksa önce pending kullanıcılar için uyumlu giriş ekranı korunur.

## §7 — Emre'ye açık kararlar (en fazla dört)

1. **Kimler zorunlu?** Öneri: pilotta kullanıcı tercihi; sonra super_admin + project_admin zorunlu, project_user isteğe bağlı. İlk sürümde proje politikası yok.
2. **Hesap yönetimi kimde?** Öneri: global freeze/expiry/MFA reset yalnız super_admin; kendine işlem ve son etkin-süresiz admini kaldırma yasak.
3. **Kurtarma ve oturum süresi?** Öneri: ikinci super_admin + hedefli internal operatör recovery; 12 saat session, 30 günlük cihaz hatırlama yok. Mail erişimi kaybı için bağımsız kimlik doğrulama sorumlusu belirlenmeli.
4. **Expiry'nin kesinlik sözleşmesi?** Gereksinim kelimesi kelimesine “bitişten sonraki tüm yetkili çağrılar” ise öneri katı action okuma yolu; ek maliyet kabul edilmeden expiry tamamlandı sayılmamalı. Daha düşük maliyet seçilirse tek-sefer job + request guard kullanılabilir fakat cache/scheduler gecikmesi açıkça kabul edilmeli; yalnız `Date.now()` yeterli diye yayınlanmamalı.
