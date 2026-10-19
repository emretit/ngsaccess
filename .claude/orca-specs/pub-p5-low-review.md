# P5-düşük — Claude denetimi (READ-ONLY)

HEDEF: Aşağıdaki 13 dosyadaki commit'siz değişikliği (`git diff -- <dosya>`; yeni dosyalar için tam içerik) güvenlik + doğruluk açısından denetle; ENGEL / ÖNERİ ayrımıyla rapor yaz. Kod DEĞİŞTİRME.

Dosyalar: /tmp/pub-p5/low-files.txt (proje kökü /Users/emreaydin/ngsaccess). Yazan Codex; worker raporları /tmp/pub-p5/fix-low-{emp,opt,auth}.md; spec'ler .claude/orca-specs/pub-p5-low-{emp,opt,auth}.md.

## Odak
1. X1-F3 `convex/employeeAuth.ts` consumeSetupToken + `convex/actions/setPassword.ts`: token oku/tüket gerçekten tek mutation'da mı; eşzamanlı iki çağrıda ikincisi "invalid" mi (Convex OCC); süresi dolmuşta hash yazılmıyor mu; dönüş sözleşmesi (`{success,error?}`) web/mobil çağıranlarla uyumlu mu (grep: setEmployeePassword çağıranlar).
2. X1-F5 signIn: tüm başarısız yollar aynı mesaj + dummy bcrypt (süre eşitleme); pasif çalışan; mobil `mobile/lib/core/error_localizer.dart` eşlemesi hâlâ çalışıyor mu (yalnız oku).
3. optionalAuth (`projects.listActive`, `ideSync/hikvisionSync.listSyncIssues`): oturumsuz → boş; verified=false → önceki gibi throw; boş shape = normal dönüş shape'i (frontend `src/components/sync/SyncIssuesBanner.tsx`, `src/contexts/ActiveProjectContext.tsx`); `authedQuery` → `query` geçişinde kaybolan guard var mı.
4. B1-2 `src/components/auth/AuthProvider.tsx`: girişte (signIn sonrası) ya da sayfa yenilemede yanlışlıkla signOut riski (isAuthenticated true + currentUser henüz null anı olabilir mi? convex client: node_modules/convex/dist/esm/browser/sync/client.js Transition işleme sırası, authentication_manager.js onTransition); signUp/setup penceresi (deferAuthGuard); `routeMeta` ile korumalı rota tespiti doğru mu (public rotalar: /, /login, /register, /verify-email, /user-setup, /admin-setup, check-in vb.); effect döngüsü/sonsuz signOut.
5. B4 `convex/auth.ts` + `convex/lib/authEmail.ts`: profile() tüm akışlarda (signIn/signUp/reset) normalize; mevcut hesap kilitlenmesi (canlı sayım: tüm hesaplar zaten küçük harf); hata mesajı.
6. Diff dışı: bu değişikliklerin dokunduğu akışlarda yeni bir açık görürsen ayrı başlıkta yaz.

## Kapılar (kendin koş)
`node_modules/.bin/vitest run convex/employeeAuth.test.ts convex/syncIssuesAuth.test.ts convex/lib/authEmail.test.ts src/components/auth` ve gerekirse `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`.

## Yasak
Dosya düzenleme, commit, push, deploy, `convex dev/run`, DB yazma YOK.

## Rapor
`/tmp/pub-p5/REVIEW-low.md`: ilk satır "ENGEL YOK" veya "ENGEL: N"; her bulgu file:line + senaryo + öneri; ≤40 satır. worker_done'da ≤8 satır özet.
