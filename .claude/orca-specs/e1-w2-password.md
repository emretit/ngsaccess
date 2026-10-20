# E1-W2 — Şifre kuralı tek kaynak

## Hedef
Yeni şifre belirleme/değiştirme kuralı tek saf modülde: `convex/lib/passwordPolicy.ts` (+ `convex/lib/passwordPolicy.test.ts`): en az 8 karakter + büyük harf + küçük harf + rakam (mevcut güçlü kural, convex/invites.ts:196-197 ile aynı), Türkçe hata mesajı ve hem sunucu (ConvexError) hem istemci (zod refine / mesaj dönen) kullanımına uygun API. `src/` içinden convex/lib import'u mevcut bir kalıp (örn. src/components/visitors/visitorTime.ts).

Kullanacak yerler:
- güçlü kural kopyaları: convex/invites.ts:196-197 · src/pages/UserSetup.tsx:96-101 · src/pages/EmployeeSetup.tsx:37-42
- yalnız uzunluk kontrolü olan yerler: convex/actions/setPassword.ts:17,57 · src/pages/Register.tsx:51 · src/pages/AdminSetup.tsx:42 · src/components/auth/AuthProvider.tsx:172 · src/components/shared/authFormSchemas.ts:12

ÖNEMLİ: GİRİŞ (sign-in) formu/yolu karmaşıklık kuralı UYGULAMAZ (eski şifreli kullanıcı kilitlenmesin). Her satırı aç, yeni-şifre mi giriş mi belirle; giriş ise dokunma ve rapora yaz. Kaynak: `.claude/orca-specs/reports/audit-1019-risk.md` §4 "Şifre kuralı".

## Ownership
convex/lib/passwordPolicy.ts (+test) · convex/invites.ts · convex/actions/setPassword.ts · src/pages/UserSetup.tsx · src/pages/EmployeeSetup.tsx · src/pages/Register.tsx · src/pages/AdminSetup.tsx · src/components/auth/AuthProvider.tsx · src/components/shared/authFormSchemas.ts · bu dosyaların mevcut test dosyaları

## Kapsam dışı
convex/employeeAuth.ts ve convex/lib/employeeAuth.ts (BAŞKA EKİBİN; setEmployeePassword'ün yalnız uzunluk kontrolünü rapora "sonra eklenecek: <satır>" diye yaz). mobile/**.

Ortak kurallar: `.claude/orca-specs/e1-common.md` (oku, uy). Rapor dosyası: /tmp/e1-w2.md
