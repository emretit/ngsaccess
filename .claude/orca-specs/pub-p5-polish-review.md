# Görev: P5 polish diff denetimi (SALT OKUMA)

## Hedef
Aşağıdaki diff davranışı doğru ve güvenli mi, regresyon var mı — kanıtla raporla. Kod DEĞİŞTİRME.
`git diff -- convex/invites.ts convex/invites.test.ts src/components/auth/AuthProvider.tsx src/components/auth/registrationFlow.ts src/components/auth/registrationFlow.test.ts src/pages/UserSetup.tsx`
(Codex luna yazdı; koordinatör `list`'te süzmeyi take'ten önceye aldı, test tipini ve UserSetup'ta artık `return`'ü düzeltti.) Specler: `.claude/orca-specs/pub-p5-polish-be.md`, `pub-p5-polish-fe.md`.

## Kontrol et
1. `invites.list` (superAdminMutation → superAdminQuery): token/type/createdBy dönmüyor; returns validator ile birebir; projectId süzmesi take(500)'den önce; mutation→query değişikliği çağıranı kırıyor mu (`grep -rn "invites.list" src convex mobile`).
2. `runSetup(action, { signOutOnError })`: varsayılan true → `AdminSetup.tsx` davranışı aynı mı. UserSetup'ta `existingAccount=true` hatasında oturum açık kalınca AuthProvider guard'ı (`AuthProvider.tsx:62-119`) ne yapar:
   (a) doğrulanmış hesap → /user-setup'ta kalır, hata mesajı görünür mü; (b) `verified=false` hesap → guard signOut + /login yönlendirmesi (güvenlik korunuyor mu, UX kabul edilebilir mi);
   (c) yanlış parola (signIn hatası) → oturum yok, sorun var mı; (d) önceden BAŞKA hesapla oturum açıkken davet e-postasıyla signIn başarısız olursa eski hesap oturumu açık kalır mı — risk mi?
3. R5-06: timer yalnız `[authWaiter]`'a bağlı; resolve sonrası reject no-op mu; unmount reject korunuyor mu; timer temizleniyor mu.
4. Test fixture refactor'ı (`makeQuery`): mevcut consume/create testlerinin anlamı korunmuş mu (assert zayıflatılmamış mı).

## Kapılar (kendin koş, sonuçları yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts src/components/auth src/pages/UserSetup.tsx` ·
`node_modules/.bin/vitest run convex/invites.test.ts src/components/auth src/pages/UserSetup.test.tsx`. Ağaçta başka oturumların değişiklikleri var (cardReadings, lib/pdks*, reports) — kapsam dışı.

## YASAK
Dosya düzenleme (rapor hariç) · `npx convex …` · commit/push · canlı DB/Convex · arka planda sunucu.

## Rapor
`/tmp/pub-p5/REVIEW-polish.md`: ilk satır `**commit'e engel: var|yok**`, kapılar, bulgular `ID | Ciddiyet | file:line | sorun | senaryo | öneri`. `worker_done` ≤10 satır.
