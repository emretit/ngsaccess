# P5-düşük / W-auth — silinmiş oturumda otomatik çıkış (B1-2) + giriş e-postası normalize (B4)

HEDEF (test edilebilir): (1) Web'de `isAuthenticated === true` iken `api.users.currentUser` `null` dönerse (oturum başka cihazdan silinmiş / kullanıcı silinmiş) AuthProvider bir kez `signOut` eder ve korumalı rotadaysa `/login?next=<güvenli yol>`'a yönlendirir. (2) Convex Auth Password provider e-postayı `trim().toLowerCase()` ile normalize eder; büyük/küçük harf farkı ayrı hesap açtırmaz ve giriş eşleşir.

## Bağlam
- B-1 sonrası (`convex/lib/auth.ts` getValidAuthUserId) silinmiş oturumun JWT'si ≤1 saat geçerli kalıyor; bu sürede `useConvexAuth().isAuthenticated` true, `currentUser` null → uygulama "girişli ama profilsiz" kalıyor.
- `src/components/auth/AuthProvider.tsx`: effect'te `isAuthenticated && profile` dalı var; `profile === null` dalı yok. `verified === false` için zaten tek-seferlik signOut kalıbı var (`blockedRef`) — aynı kalıbı izle. `deferAuthGuard` (src/components/auth/registrationFlow.ts) signUp/setup penceresinde effect'i durdurur; yeni mantık da bu pencerede ÇALIŞMAMALI (signUp anında geçici oturum açılıyor).
- `useQuery` yüklenirken `undefined`, kullanıcı yoksa `null` döner — yalnız `null`'da tetikle.
- B4: canlıda salt-okuma sayım (koordinatör yaptı): users 4 / authAccounts(password) 4 kaydın HEPSİ zaten küçük harf, çakışma 0 → normalize mevcut hesapları kilitlemez. Veri migrasyonu YOK.
- `@convex-dev/auth` Password provider `profile(params)`'ı TÜM akışlarda (signUp, signIn, reset...) çağırıp hesap id'si olarak `profile.email`'i kullanır (node_modules/@convex-dev/auth/dist/providers/Password.js:56) → normalize yeri `convex/auth.ts` profile().
- `convex/invites.ts` daveti zaten `toLowerCase()` ile saklıyor (dokunma).

## Yapılacak
1. Saf karar fonksiyonu (ör. `src/components/auth/registrationFlow.ts`'e veya yeni `src/components/auth/sessionGuard.ts`'e): girdiler isLoading, isAuthenticated, user (undefined|null|obj), deferred → "signOut" mu değil mi. AuthProvider bunu kullansın; tek seferlik ref (orphan), başarısızsa tekrar denenebilir; signOut sonrası yalnız korumalı rotadaysa `navigate('/login?next=' + encodeURIComponent(safeReturnPath(...)), { replace: true })` (verified=false dalındaki next hesaplamasını yeniden kullan). Bildirim: kısa `notify.info`/`notify.error` "Oturumunuz sona erdi" — mevcut notify API'sine uy. Public rotada (landing, /login, /register, /verify-email, /setup, check-in vb.) yalnız sessiz signOut.
2. `convex/auth.ts` profile(): `params.email` string değilse veya trim sonrası boşsa `ConvexError`/Error ("Geçerli bir e-posta girin"); değilse `email = params.email.trim().toLowerCase()`. Mevcut güvenlik yorumu ve `verified: false` aynen kalsın.
3. RAPOR-ONLY: `convex/` altında e-postayla yapılan users/authAccounts/employees aramalarını grep'le (`by_email`, `providerAccountId`, `retrieveAccount`, `modifyAccountCredentials`, `createAccount`) ve normalize ETMEYENLERİ file:line ile rapora yaz; ownership dışındakileri DEĞİŞTİRME.

## Ownership
convex/auth.ts, src/components/auth/AuthProvider.tsx, src/components/auth/registrationFlow.ts(+test) veya yeni src/components/auth/sessionGuard.ts(+test), convex/auth.test.ts (yeni, profile normalize testi; profile fonksiyonunu test edilebilir yapmak için küçük saf helper export edebilirsin, ör. `normalizeAuthEmail`).

## Kapsam dışı / DOKUNMA
convex/invites.ts, convex/users.ts, convex/lib/auth.ts, convex/employeeAuth.ts, convex/actions/**, convex/projects.ts, convex/ideSync.ts, convex/hikvisionSync.ts, src/pages/** (Login/Register formları), convex/schema.ts, convex/cardReadings.ts, convex/lib/pdks*, convex/dashboard.ts, src/components/dashboard/**, mobile/**. RTL/jsdom EKLENMEZ (package.json paylaşımlı): React davranışı saf fonksiyonla test edilir. Ağaçta başka oturumların commit'siz işi var; dokunma/revert etme.

## Testler (zorunlu)
- Saf karar: loading → hayır; auth+user undefined → hayır; auth+user null → evet; auth+user null+deferred → hayır; !auth → hayır.
- normalize: "  Foo@Bar.COM " → "foo@bar.com"; boş / string olmayan → hata.

## Kapılar (kendin koş, çıktıyı rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (başka oturumun dosyasından gelen hata varsa ayrı listele)
- `node_modules/.bin/eslint <ownership dosyaları>` → 0 error
- `node_modules/.bin/vitest run src/components/auth convex/auth.test.ts` → yeşil

## Yasak
commit / push / deploy / `convex dev` / `convex run` / migration / canlı DB yazma YOK. `any` / `!` non-null yasak.

## Rapor
`/tmp/pub-p5/fix-low-auth.md` (≤30 satır, file:line; madde 3'ün grep sonucu dahil) + worker_done'da ≤10 satır, `--files-modified` gerçek liste.
