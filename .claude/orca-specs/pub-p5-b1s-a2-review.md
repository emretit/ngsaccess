# Görev: B-1 oturum sertleştirmesi + A2 denetimi (SALT OKUMA) — iki AYRI hüküm

## Paket A — B-1 (yüksek etki alanı: TÜM web kimlik çözümlemesi)
Diff: `git diff -- convex/lib/auth.ts convex/userProjects.ts convex/users.ts convex/invites.ts` + yeni `convex/lib/auth.test.ts` + fixture değişiklikleri `convex/invites.test.ts`, `convex/users.test.ts`, `convex/lib/reportScope.test.ts`
(Codex luna yazdı). Spec `.claude/orca-specs/pub-p5-b1-session.md`, rapor `/tmp/pub-p5/fix-b1-session.md`.
Amaç: `getAuthUserId` JWT'den userId'yi oturum kontrolü yapmadan alıyordu → silinmiş oturumun (signOut / invalidateSessions / R5-03 devralma) JWT'si ≤1 saat geçerliydi. Yeni `getValidAuthUserId`: getAuthUserId + getAuthSessionId + `db.get(session)` + userId eşleşmesi.
Kontrol: (1) Kilitlenme riski — normal oturumlu kullanıcı reddedilebilir mi? `@convex-dev/auth` v0.0.91'de (`node_modules/@convex-dev/auth/dist/server/implementation/**`) JWT `sub` biçimi, oturum belgesinin yaşam döngüsü
(signIn, refresh/rotation, signOut, oturum süresi dolumu); refresh sırasında oturum belgesi değişiyor/yeniden mi yaratılıyor — eski JWT ile yeni oturum ID'si uyumsuzluğu olur mu? `getAuthSessionId`'nin döndürdüğü ID tipi doğru mu.
(2) Kapsam: `getAuthUserId(` başka yerde kaldı mı (http.ts, actions — actions `ctx.db` yok; `authedAction` `api.users.currentUser` üzerinden geçiyor mu); `ctx.auth.getUserIdentity()` doğrudan kullanan yer var mı (aynı açık).
(3) Reaktivite/performans: her sorguya +1 `db.get(authSessions)` → oturum belgesi patch'lendikçe (ör. refresh'te expirationTime güncellemesi) tüm abonelikler yeniden mi çalışır; Convex Free kotası etkisi (bkz. memory: function-call kotası hassas). Gerçekçi değerlendir.
(4) Mobil `employeeSessions` akışı etkilenmiyor mu. (5) Testler gerçek handler/yardımcıyı mı koşuyor; fixture değişiklikleri assert'leri zayıflatmamış mı.

## Paket B — A2
Diff: `git diff -- convex/lib/publicUser.ts convex/lib/publicUser.test.ts`. `toPublicUser` artık `publicUserValidator.fields` anahtarlarından türüyor; `PublicUser = Infer<typeof publicUserValidator>`.
Kontrol: davranış B1 commit'iyle (3ad9529) aynı mı; tek `as PublicUser` cast'i güvenli mi; undefined alan kopyalanıyor mu; testler anlamlı mı.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `-p convex/tsconfig.json` · `node_modules/.bin/eslint convex/lib/auth.ts convex/lib/auth.test.ts convex/userProjects.ts convex/users.ts convex/users.test.ts convex/invites.ts convex/invites.test.ts convex/lib/publicUser.ts convex/lib/publicUser.test.ts convex/lib/reportScope.test.ts` ·
`node_modules/.bin/vitest run convex`. Ağaçta başka oturumların işi var (dashboard, pdks, reports) — kapsam dışı.

## YASAK
Dosya düzenleme (rapor hariç) · `npx convex …` · commit/push · canlı DB/Convex yazma · arka planda sunucu.

## Rapor
`/tmp/pub-p5/REVIEW-b1s-a2.md`: ilk iki satır `**A (B-1) commit'e engel: var|yok**`, `**B (A2) commit'e engel: var|yok**`, kapılar, bulgular `ID | Ciddiyet | file:line | sorun | senaryo | öneri`. `worker_done` ≤10 satır.
