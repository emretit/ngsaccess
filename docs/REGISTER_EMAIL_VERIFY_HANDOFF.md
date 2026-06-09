# Handoff — Kayıt + E-posta Doğrulama + Multitenant İzolasyon

**Tarih:** 2026-06-09
**Durum:** Kayıt/doğrulama akışı ÇALIŞIYOR ve test edildi. Commit EDİLMEDİ. Bir güvenlik açığı bulundu (henüz düzeltilmedi) — aşağıda "AÇIK İŞ".

---

## 1. Ne yapıldı (tamamlandı, çalışıyor)

### A. Register ekranı Login modeline getirildi
- [src/pages/Register.tsx](src/pages/Register.tsx): [src/pages/Login.tsx](src/pages/Login.tsx) ile birebir split-screen (sol form + sağ dekoratif panel, "Ana sayfa" floating buton, `h-24 w-24` logo, icon'lu `h-12` input'lar, şifre show/hide, `ArrowRight`'lı buton). `RegisterForm.tsx` **silinmedi** — [src/pages/Auth.tsx](src/pages/Auth.tsx) tab'lı görünümde hâlâ kullanıyor.

### B. Firma adı alanı eklendi
- Register'da `Building2` icon'lu zorunlu "Firma adı" alanı.
- Akış: firma adı → `users.firstCompanyName` → ilk girişte `ensureProjectForNewUser` bunu **proje adı** yapar + `generalSettings.companyName`'e yazar.

### C. E-posta doğrulama akışı (pafta modeli, token-link)
Self-signup → hesap oluşur **ama `verified: false`** → doğrulanmadan login OLAMAZ → mail gelir ("Hesabı Doğrula" butonu) → linke tıkla → `verified: true` → giriş → ilk girişte proje açılır.

Dosyalar:
- [convex/auth.ts](convex/auth.ts): `profile()` callback **her zaman `verified: false`** yazar (GÜVENLİK: companyName yokluğuna güvenmez — kullanıcı/linter bu güvenlik fix'ini ekledi). `firstCompanyName` companyName varsa yazılır.
- [convex/emailVerification.ts](convex/emailVerification.ts) (YENİ): `requestVerification` (token üret + mail tetikle) + `verifyEmail`/`confirm` (token doğrula → `verified: true`, token temizle). `users` şemasında `by_setup_token` index'i kullanır.
- [convex/actions/sendEmail.ts](convex/actions/sendEmail.ts): `sendVerificationEmail` (internal action, NGS+ markalı, `${SITE_URL}/verify-email?token=...`).
- [convex/onboarding.ts](convex/onboarding.ts): `ensureProjectForNewUser` — proje adı = `firstCompanyName`, `ownerId` set, `generalSettings` insert.
- [src/pages/VerifyEmail.tsx](src/pages/VerifyEmail.tsx) (YENİ): `/verify-email?token=` route, mount'ta `verifyEmail` çağırır.
- [src/components/auth/AuthProvider.tsx](src/components/auth/AuthProvider.tsx): `signUp(email,password,name,companyName)` → signIn + `requestVerification` + signOut. `signingUpRef` ile signUp sırasında effect'in `/home` flash'ı engellenir. Effect: `verified===false` → signOut + `/login`; doğrulanmış + projesiz → `ensureProject`.
- [src/pages/Login.tsx](src/pages/Login.tsx): `?confirmEmail=true` ve doğrulanmamış-giriş için **sarı banner** (pafta `bg-yellow-50` stili).
- [src/App.tsx](src/App.tsx): `/verify-email` route + public path.

### D. KRİTİK ÖĞRENİM — `verified` alan adı
**`emailVerified` adı KULLANILAMAZ.** Convex Auth `profile()`'ın döndürdüğü `emailVerified`'ı ayıklar (`node_modules/@convex-dev/auth/.../users.js:21`: `{ emailVerified, ...profile }`) ve `users`'a **yazmaz**. Bu yüzden alan adı **`verified`** yapıldı. Yeni alan eklerken bu tuzağa dikkat.

### E. Schema — `users` tablosu yeni alanlar
[convex/schema.ts](convex/schema.ts): `verified: v.optional(v.boolean())`, `firstCompanyName: v.optional(v.string())`, `by_setup_token` index. `setupToken`/`tokenExpiresAt`/`projects.ownerId` zaten vardı.

### F. Landing CTA'ları `/register`'a yönlendirildi
Tüm "Ücretsiz Demo / 14 Gün Ücretsiz Dene" CTA'ları artık `/register` ([LandingHeader](src/components/landing/LandingHeader.tsx), [HeroSection](src/components/landing/HeroSection.tsx), [FinalCTASection](src/components/landing/FinalCTASection.tsx), [PricingSection](src/components/landing/PricingSection.tsx) Başlangıç+Profesyonel, [LandingFooter](src/components/landing/LandingFooter.tsx)). **Bilerek bırakıldı:** Kurumsal "Satış Ekibiyle Görüş" → `/demo-request` (satış, demo değil).

---

## 2. AÇIK İŞ — Multitenant izolasyon açığı (DÜZELTİLMEDİ)

**Yer:** `/settings?tab=users` → [src/components/admin/AdminUsersPanel.tsx](src/components/admin/AdminUsersPanel.tsx) → [useUserManagement.ts](src/components/admin/hooks/useUserManagement.ts) `api.users.list`.

**Açık:** [convex/users.ts](convex/users.ts) `list` query `adminQuery` + `ctx.db.query("users").collect()` → **proje filtresi YOK**. `project_admin` **tüm sistemdeki kullanıcıları** görüyor (multitenant ihlali).

**Çözüm deseni** (referans: [convex/companies.ts](convex/companies.ts) `list`, [convex/employees.ts](convex/employees.ts) `list`):
- `super_admin` → tüm users.
- `project_admin` → `getProjectIdsForUser(ctx)` ile kendi projelerinin `userProjects` üzerinden user'ları (dedupe).
- `getProjectIdsForUser` zaten [convex/lib/auth.ts](convex/lib/auth.ts)'te var.

**Not:** Aynı sayfadaki mutation'lar (`users.updateRole`, `userProjects.assign`) `superAdminMutation` — onlar güvenli. `invites.create` proje üyeliği kontrolü yapıyor — güvenli. Sadece `users.list` açık. Ama yeni chat **diğer admin query'lerini de** (cihaz/kart/ayar listeleri) izolasyon için taramalı; bu tek örnek olmayabilir.

---

## 3. Bilinen pürüzler / dikkat

- **Mail linki prod'a gider:** `SITE_URL=https://ngsplus.app` (kullanıcı kararı: dokunma). Lokal testte maildeki butona basma — bunun yerine token'ı backend'den doğrula:
  `npx convex run emailVerification:verifyEmail '{"token":"<DB'deki güncel setupToken>"}'` (ya da fonksiyon adı `confirm` olabilir — [emailVerification.ts](convex/emailVerification.ts)'e bak).
- **Port karmaşası:** Birden fazla vite süreci açılıyor (8080=pafta, 8081 eski, 8082 güncel). Kullanıcı bazen 8081 kullanıyor. Backend ortak (notable-tern-4) olduğu için veri aynı ama frontend fix'leri yanlış portta görünmeyebilir. Doğru port: **çalışan `npm run dev`'in bastığı** (genelde 8082). Tek port bırakmak için fazlalıkları `kill`.
- **Deploy:** `npx convex dev --once` (memory [convex_deployment_topology]: `convex deploy` DEĞİL). notable-tern-4 = dev ama canlı sistem.
- **test kullanıcısı `emretit@gmail.com`:** şu an `verified: true`, projesi açık ("emretit", project_admin, owner). Temiz test için silmek gerekirse: email ile users + authAccounts(`userIdAndProvider`) + authSessions(`userId`)+authRefreshTokens(`sessionId`) + userProjects(`by_user`) + owner olduğu projects + o projenin generalSettings(`by_project`) sil. (Önceki turlarda geçici internal mutation ile yapıldı; kalıcı bir admin "kullanıcı sil" fonksiyonu YOK — istenirse yazılabilir.)

---

## 4. Doğrulama (verify) komutları

```bash
# Tip + lint (proje kuralı: any/as any yasak)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json      # 0 hata olmalı
node_modules/.bin/eslint src convex                       # no-explicit-any 0; warn serbest

# Deploy (generated API güncelle)
npx convex dev --once
```

**E2E:** `/register` → form (firma + 8+ karakter şifre) → toast + `/login?confirmEmail=true` (dashboard flash YOK) + sarı banner → mail gelir → token'ı backend'den doğrula → `/login` → giriş → `/home` + proje açılır.

**Son durum:** tsc 0, eslint 0 error. Akışın tüm parçaları loglarla + DB sorgularıyla kanıtlandı (verified yazılıyor, mail gidiyor, guard çalışıyor, verifyEmail `verified:true` yapıyor, proje açılıyor).

---

## 5. İlk adım (yeni chat)

1. `git status` + bu dosyayı oku.
2. **Multitenant açığını kapat:** `users.list`'i `getProjectIdsForUser` ile filtrele (bkz. §2). Sonra diğer admin list query'lerini de izolasyon için tara.
3. `tsc` + `eslint` + `npx convex dev --once`.
4. Kullanıcı isterse commit (henüz commit edilmedi; conventional commit: `feat: kayıt + e-posta doğrulama akışı + register redesign`).
