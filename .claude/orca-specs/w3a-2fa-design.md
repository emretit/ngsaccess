# W3a — Yönetici 2FA + kullanıcı dondurma / son kullanma: TASARIM (SALT-OKUMA)

Sen tasarımcısın. Kod YAZMA. Tek yazacağın dosya: `{{OUT}}`.
YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen/run), DB yazma, git stash/checkout/reset, başka dosya düzenleme.
Aynı soruyu başka bir model ayrıca cevaplıyor; birbirinizi görmüyorsunuz. Kendi bağımsız değerlendirmeni yap.

## Ortak kurallar (repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict; `any` yasak; Convex handler'ları camelCase alan döner.
- Convex kuralları: önce `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok.
- Convex Free plan: function-call kotası dar → YENİ polling / sık cron önermek yasak. İstek anında kontrol tercih edilir.
- Canlı sistem `notable-tern-4` (dev deployment); veri canlı. Şema değişikliği yalnız opsiyonel alan + yeni tablo (migration yok).
- Kullanıcıya görünen metinler Türkçe.

## Hedef
Uygulayıcının (Codex, W3b) doğrudan koda dökebileceği, güvenlik açısından savunulabilir bir tasarım:
1. **Web yöneticileri için giriş 2FA'sı** (şifreden sonra e-postaya tek kullanımlık kod).
2. **Kullanıcı dondurma / çözme** ve **hesap bitiş tarihi** (bitince giriş ve tüm yetkili çağrılar reddedilir).

## Bağlam (kodda doğrula)
- Kimlik: `@convex-dev/auth` Password provider — `convex/auth.ts`, `convex/auth.config.ts`, `convex/lib/auth.ts`, `convex/lib/authEmail.ts`, `convex/lib/passwordPolicy.ts`. `users` tablosu `authTables`'tan genişletilmiş (`convex/schema.ts`: role super_admin/project_admin/project_user, `verified`, `setupToken`...).
- Yetki sarmalayıcıları (authedQuery/authedMutation/adminQuery/adminMutation vb.) ve `getCurrentUser` guard'ı: `convex/lib/` altında bul; `verified===false` login guard'ı var.
- E-posta: Resend (`convex/actions/sendEmail.ts`, `convex/lib/escapers.ts`), `mailSettings`.
- Web giriş: `src/pages/Login.tsx` + `AuthProvider`; yönetim: `src/pages/SystemAdmin.tsx` (kullanıcı sekmesi), `src/pages/Profile.tsx` (güvenlik bölümü).
- Mobil çalışan girişi AYRI (`convex/employeeAuth.ts`) — kapsam dışı, ama tasarımın onu bozmadığını teyit et.
- Hik-Connect referansı: Account Security = e-posta ile 2FA (aç/kapa); Users = Freeze/Unfreeze + son kullanma tarihi; Roles = geçerlilik aralığı.

## Cevaplaman gerekenler
1. **2FA mimarisi** — en az şu 3 seçeneği karşılaştır, birini öner:
   (a) Şifre girişi normal oturum açar; oturum "MFA bekliyor" durumunda kalır, tüm yetkili fonksiyonlar kod doğrulanana kadar reddeder (oturum kimliği: `getAuthSessionId`; durum ayrı tabloda).
   (b) Özel `ConvexCredentials` provider / iki adımlı signIn: 1. adım şifreyi doğrular + kod yollar (oturum AÇMAZ), 2. adım kod doğrulanınca oturum açar.
   (c) Convex Auth'un yerleşik mekanizmaları (Password `verify`/`reset`, Email provider) ile kurulabilecek başka yol.
   Her biri için: yarım-doğrulanmış oturumla bypass riski, refresh token yolu, HTTP action/action'lar, mevcut guard'lara dokunma miktarı, Convex Auth sürüm uyumu (`package.json`'daki sürüme bak).
2. **Kod (OTP) kuralları:** uzunluk, saklama (hash + tuz), geçerlilik süresi, deneme sınırı, yeniden gönderme sınırı, tek kullanımlık olma, e-posta numaralandırma (enumeration) ve zamanlama sızıntısı önlemleri, audit kaydı (kişi verisi olmadan).
3. **Kapsam ve geçiş:** kimler için zorunlu olabilir (rol bazlı / proje ayarı / kullanıcı tercihi) — seçenekleri ve önerini yaz; mevcut kullanıcıları kilitlemeden açılış (feature flag, varsayılan kapalı), kurtarma (super_admin başka kullanıcının 2FA'sını sıfırlar; tek super_admin kilitlenirse ne olur), "bu cihazı 30 gün hatırla" gerekli mi.
4. **Dondurma / bitiş tarihi:** alanlar (ör. `disabledAt`, `disabledBy`, `accessExpiresAt`), nerede uygulanır (aynı guard), dondurulunca mevcut oturumların sonlandırılması (authSessions / refresh token), kendini ve son super_admin'i dondurma engeli, kimler dondurabilir (rol matrisi), audit. Cron OLMADAN çalışmalı.
5. **Değişecek dosyalar ve imzalar:** şema farkı (alan/tablo/index), yeni/değişen Convex fonksiyonları (ad, args, sarmalayıcı türü), frontend ekranları (Login OTP adımı, SystemAdmin kullanıcı aksiyonları, Profile güvenlik), test listesi (bypass, brute force, süresi dolmuş kod, dondurulmuş kullanıcı, refresh token).
6. **W3b uygulama adımları:** sıralı, her adım test edilebilir; tahmini süre; risk ve geri dönüş planı.
7. **Emre'ye açık kararlar:** en fazla 4 madde, her biri için önerin.

## Kapsam dışı
Mobil çalışan girişi 2FA'sı · TOTP/authenticator uygulaması (yalnız gelecekte nasıl eklenebileceğine 2 satır) · SMS · özel rol tanımı · AD eşitleme.

## Çıktı
`{{OUT}}` (Türkçe, ≤250 satır): §1-7 başlıklarıyla. İddiaları `dosya:satır` ile kanıtla; doğrulayamadığını **[teyit]** diye işaretle.
`worker_done` mesajı ≤10 satır: önerilen seçenek, en büyük 3 risk, açık kararlar, çıktı yolu.
