# Görev: P5 — NEW-01 davet yetki açığı (GÜVENLİK, ÖNCELİKLİ) + davet ekranı auth-ready

## Hedef (test edilebilir)
`invites.consume` yalnız oturum açmış ve e-postası davetle eşleşen kullanıcı için çalışsın; **mevcut hesabın global rolü davetle ASLA değişmesin** (ne yükselir ne düşer),
yalnız proje üyeliği eklensin; yeni kurulum hesabına davetteki rol atansın; `type:'reset'` token'ı tüketilemesin. Testler bu dört kuralı ve saldırı senaryosunu kanıtlasın.

## Karar (Emre, CEO oturumu üzerinden, 2026-10-19)
Mevcut hesabın global rolü davetle değişmez; yalnız `userProjects` üyeliği eklenir. Yeni hesap (bu kurulum akışında az önce oluşan, doğrulanmamış hesap) davetteki rolü alır.
Rol değişikliği yalnız korumalı yönetici yolundan (`convex/users.ts`). `reset` türü consume edilemez.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. ÖNCE `convex/_generated/ai/guidelines.md`. Bulgu: `/tmp/pub-p5/AUDIT-flows.md` §9 NEW-01 (satır ~112-122: senaryo, öneri, deploy sırası) ve §3 SHL-23.
Kod: `convex/invites.ts` (`create` :14, `verify` ~:90, `consume` :116), `convex/auth.ts` (signUp profili, `verified=false`), `convex/users.ts:77-81` (korumalı rol yolu),
`convex/lib/customFunctions.ts` (authed/optionalAuth sarmalayıcıları; `verified===false` reddi), `src/pages/UserSetup.tsx` (signIn/signUp sonrası consume çağrısı ~:66),
`src/components/auth/AuthProvider.tsx` (`runSetup`). Convex test deseni: `convex/employeeCheckIn.test.ts`, `convex/adminSettingsGuards.test.ts`.

## Yapılacaklar
1. `consume`: kimliği sunucudan al (`@convex-dev/auth/server` `getAuthUserId(ctx)` ya da repodaki eşdeğer yardımcı; genel `verified` guard'ını GEVŞETME — doğrulanmamış hesaba izin
   yalnız bu dar token-doğrulama yolunda). Kullanıcıyı ID ile yükle; `user.email` (küçük harf) === `invite.email` değilse reddet. `args.email` yalnız karşılaştırma için kalabilir (eski web uyumu).
   `invite.type === 'reset'` → reddet. Kullanılmış/süresi dolmuş davet → reddet (bugünkü gibi).
2. Rol: hesap **yeni kurulum hesabı** ise (kriteri kodla belirle ve rapora yaz; ör. `verified === false` ve hiç `userProjects` üyeliği yok) `role: invite.role`; değilse rol alanına
   DOKUNMA. Her iki durumda proje üyeliğini (duplicate kontrolüyle) ekle; üyelikte rol alanı varsa davetteki proje rolünü oraya yaz (şemada yoksa ekleme). `verifyUser` yalnız
   bu kimliği doğrulanmış kullanıcı için. Daveti `used:true` işaretle (bugünkü gibi).
3. Frontend `src/pages/UserSetup.tsx`: signIn/signUp sonrası Convex auth hazır olana kadar bekle (`useConvexAuth().isAuthenticated` veya mevcut `runSetup` sözleşmesi), sonra consume;
   yeni backend hatalarını Türkçe sabit metne eşle (ham hata gösterme). İsteğe bağlı ve KÜÇÜKSE: `invites.verify` dönüşüne proje adını ekleyip ekranda göster (SHL-23).
4. Test `convex/invites.test.ts`: (a) oturumsuz consume → red; (b) başka kullanıcının oturumuyla → red; (c) mevcut super_admin e-postasına project_user daveti → rol super_admin KALIR;
   (d) mevcut project_user'a project_admin daveti → rol project_user KALIR, üyelik eklenir; (e) yeni kurulum hesabı → davetteki rol; (f) reset türü → red; (g) çift consume → ikincisi red.
   `src/pages/UserSetup.test.tsx`'e hata eşleme testi.
5. Rapor: davet oluşturanın token'ı aldığı için kendi davet ettiği e-postayı doğrulatabilmesi (verifyUser) gibi kalan riskleri ayrıca yaz (düzeltme kapsamı dışı, not).

## Ownership (YALNIZ bunlar)
`convex/invites.ts`, yeni `convex/invites.test.ts`, gerekirse yeni `convex/lib/inviteConsume.ts` (+test), `src/pages/UserSetup.tsx`, `src/pages/UserSetup.test.tsx`.
`convex/schema.ts`, `convex/users.ts`, `convex/auth.ts`, `AuthProvider.tsx`, `convex/employeeCheckIn*`, `src/pages/CheckIn*`, tema dosyaları — DOKUNMA (başka paketler/oturumlar).

## YASAK
`npx convex …` (deploy/codegen dahil) · commit/push · canlı DB/Convex/Supabase okuma-yazma · `package.json` · arka planda açık sunucu.

## Kapılar (kendin koş)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → Ownership'te 0 (kapsam dışını raporla, düzeltme).
2. `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts src/pages/UserSetup.tsx src/pages/UserSetup.test.tsx` → 0.
3. `node_modules/.bin/vitest run convex/invites.test.ts src/pages/UserSetup.test.tsx` → (a)-(g) yeşil.
4. Uyumluluk notu: eski web ↔ yeni backend (signIn sonrası consume; auth henüz yerleşmemişse ne olur), deploy sırası (backend önce).

## Rapor
`worker_done` ≤8 satır: file:line, "yeni hesap" kriteri, test listesi + sonuç, kapılar, kalan riskler. Ayrıntı `/tmp/pub-p5/fix-sec.md`.
