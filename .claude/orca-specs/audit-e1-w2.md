# Denetim — E1-W2 şifre politikası (SALT-OKUMA; Codex yazdı, Claude denetler)

Repo: /Users/emreaydin/ngsaccess. Değişiklik commit'lenmemiş, çalışma ağacında. Aynı ağaçta başka ekibin (Flutter) değişiklikleri de var — YALNIZ şu dosyaların farkını incele:
`git diff -- convex/invites.ts convex/invites.test.ts convex/actions/setPassword.ts src/pages/UserSetup.tsx src/pages/EmployeeSetup.tsx src/pages/Register.tsx src/pages/AdminSetup.tsx src/components/auth/AuthProvider.tsx src/components/shared/authFormSchemas.ts src/components/shared/authFormSchemas.test.ts` + yeni dosyalar `convex/lib/passwordPolicy.ts`, `convex/lib/passwordPolicy.test.ts`. Yazarın raporu: /tmp/e1-w2.md (rapora değil koda ve kendi koştuğun teste dayan).

## Hedef
Doğruluk hatası var mı: (a) GİRİŞ yolu (loginSchema, AuthProvider.signIn, UserSetup/AdminSetup existingAccount) karmaşıklık kuralı uygulayıp eski şifreli kullanıcıyı kilitliyor mu; (b) yeni şifre yollarının hepsi ortak kuralı mı kullanıyor, sunucu/istemci mesajları tutarlı mı; (c) davranış regresyonu (hata kodu INVITE_WEAK_PASSWORD, `{success:false,error}` sözleşmesi, DB erişiminden önce red); (d) CLAUDE.md kuralları (any yok, `!` yok). Her bulgu: önem, file:line, somut senaryo, önerilen düzeltme. Yoksa "temiz".

## Kapı (sen koş)
`node_modules/.bin/vitest run convex/lib/passwordPolicy.test.ts convex/invites.test.ts src/pages/UserSetup.test.tsx src/components/shared/authFormSchemas.test.ts src/components/auth/registrationFlow.test.ts`

## Yasak
Repo dosyalarına YAZMA (rapor: /tmp/audit-e1-w2.md tek yazılabilir yol). commit/push/deploy/`npx convex`/DB yazma/git index-checkout-stash YOK.

## Rapor
worker_done'da ≤10 satır: bulgu sayısı + her biri tek satır. Dil Türkçe.
