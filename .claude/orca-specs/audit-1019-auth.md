# W2 — Yayın 4 auth denetimi: commit 1a0c112 (yazan Codex; bir Claude sonnet denetimi "engel yok" dedi → sen ikinci, derin bakışsın)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/audit-1019-auth.md`
Önceki denetim (oku ama ona güvenme): `/tmp/pub-p5/REVIEW-low.md`. Commit mesajı: `git show 1a0c112 --stat` + `git show 1a0c112`.

Soru: 1a0c112 canlıya çıkarsa gerçek kullanıcıyı kıran ya da güvenlik açığı bırakan bir şey var mı? Diff'i ve çağrıldığı kodu kendin oku; testleri kendin koş.

1. **B1-2 otomatik çıkış (EN ÖNEMLİ):** `src/components/auth/AuthProvider.tsx` + `registrationFlow.ts` `shouldSignOutOrphanedSession`. Meşru bir kullanıcı yanlışlıkla çıkış yaptırılabilir mi?
   `convex/users.ts` `currentUser`'ın `null` döndüğü TÜM koşulları çıkar (users satırı yok, verified, setup akışı vb.) ve her biri için web akışını izle:
   giriş hemen sonrası (token var, users satırı/sorgu henüz gelmedi: `undefined` vs `null` ayrımı), self-signup, davet kurulum (`/user-setup`, `/admin-setup`), çalışan kurulum (`/employee-setup`),
   e-posta doğrulama (`/verify-email`), `deferAuthGuard` penceresi, sekmeler arası, token yenileme. `routeMeta` korumalı rota tespiti eksik rota bırakıyor mu?
2. **Karışık sürüm penceresi:** Sıra Convex → web. (a) Yeni Convex + eski canlı web (61cd264) + eski önbellekli web paketleri: eski web'in çağırdığı bir fonksiyon/arg/dönüş şekli değişti mi?
   (b) Flutter mobil uygulama (`mobile/lib/**`, salt-okuma): çalışan giriş/şifre kurulum çağrıları (`employeeAuth:*`, `actions/setPassword:*`, signIn) imza veya hata metni değişiminden etkileniyor mu? Mobil hata mesajı eşlemesi kırılıyor mu?
3. **X1-F3 `consumeSetupToken`:** gerçekten tek mutation'da oku+tüket mi, `internalMutation` mı, süresi dolmuş/yanlış token dalları, yarış (iki eşzamanlı istek).
4. **X1-F5:** çalışan signIn tüm başarısız yollarda aynı mesaj + sahte bcrypt — süre farkı ya da farklı hata türü kalıyor mu?
5. **optionalAuth:** `projects.listActive`, `ideSync.listSyncIssues`, `hikvisionSync.listSyncIssues` oturumsuz → boş. Oturumsuz çağrıda veri sızıyor mu; verified=false hâlâ throw mu?
6. **B4:** `convex/auth.ts` Password `profile()` trim+lowercase. E-posta karşılaştıran diğer yerler (invites, employeeAuth, users) tutarlı mı; mevcut hesap kilitlenme riski?
7. Testleri koş (salt-okuma): `node_modules/.bin/vitest run convex/employeeAuth.test.ts convex/syncIssuesAuth.test.ts convex/lib/authEmail.test.ts src/components/auth` + `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`.
   (Ağaçta başka oturumun commit'siz `mobile/**` dosyaları var; convex/src etkilenmez.)

Rapor: bulgular tablosu (Önem KRİTİK/YÜKSEK/ORTA/DÜŞÜK · dosya:satır · senaryo · öneri) + "Yayın 4'e engel" kararı + yayın sonrası 5 maddelik canlı kontrol listesi (somut adım + beklenen sonuç).
