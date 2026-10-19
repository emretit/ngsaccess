# Görev: P5 denetimi — NEW-01 güvenlik düzeltmesi (ağırlıklı) + QR + tema/arayüz (SALT-OKUR; kodu Codex yazdı, denetçi Claude)

## Hedef (test edilebilir)
`/tmp/pub-p5/REVIEW.md`: her sorun `R5-xx | önem | file:line | sorun | saldırı/senaryo | düzeltme`; en üstte tek satır **"commit'e engel: var/yok"**. KOD DÜZELTME.

## Bağlam
Repo `/Users/emreaydin/ngsaccess` (React 19 + Vite; Convex backend — önce `convex/_generated/ai/guidelines.md`). Plan/triage `docs/ui-scan/public/P5_PLAN.md`; audit `/tmp/pub-p5/AUDIT-{flows,ui}.md`;
worker raporları `/tmp/pub-p5/fix-{sec,qr,ui}.md`. Denetlenecek dosyalar `/tmp/pub2-files.txt` (HEAD ↔ çalışma kopyası: `git diff -- <yol>`; yeni dosyalar tam oku). `convex/schema.ts` diff'inde
YALNIZ `checkInTokens` 2 opsiyonel alan bizim; başka hunk varsa başka oturumundur, denetleme.

## Odak (öncelik sırası)
1. **NEW-01 `convex/invites.ts` `consume`** — karar: mevcut hesabın global rolü davetle ASLA değişmez, yalnız üyelik; yeni kurulum hesabı (`verified===false && role===undefined && üyelik yok`) davetteki rolü alır;
   reset consume edilemez; oturum + e-posta eşleşmesi şart. Saldırgan gözüyle dene: oturumsuz, başka hesap, e-posta büyük/küçük harf, süresi dolmuş/kullanılmış davet, reset, aynı token iki kez (eşzamanlı),
   yeni-hesap kriterini kandırma (ör. self-signup + companyName ile `ensureProjectForNewUser` sonrası rol/üyelik; `convex/auth.ts`), `verifyUser`'ın kötüye kullanımı, `create`'in token'ı oluşturana dönmesi.
   `convex/invites.test.ts` testleri gerçekten bu yolları mı ölçüyor (mock'lar handler'ı mı test ediyor, kopyasını mı).
2. **UserSetup** auth-ready beklemesi: sonsuz bekleme / yarış (signUp → `verified=false` → AuthProvider signOut, `runSetup` sınırı), hata eşlemesi (`ConvexError` code'ları), eski web ↔ yeni backend.
3. **QR** `convex/employeeCheckIn.ts`: `code` alanları, completed replay'in employee lookup'tan önce dönmesi (silinmiş çalışan), yeni opsiyonel alanların yazımı, frontend `code` önceliği + eski metin fallback'i.
4. **Tema** `index.html` inline betik + `src/lib/themeBootstrap.ts` + `src/hooks/useDarkMode.ts`: XSS/enjeksiyon (localStorage içeriği DOM'a yazılıyor mu), bozuk veri, public rotada uygulanmama,
   kullanıcı/proje değişiminde eski önbellek, çıkışta temizlik. `src/pages/Register.tsx` ARIA, `logo.tsx` çağrıları.
5. Kurallar: `CLAUDE.md` (any/`as`/`!`), Convex guideline'ları (validator, index kullanımı, `filter` yerine index).

## Kapılar (KENDİN koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` · `node_modules/.bin/vite build`.
Başka oturumların eşzamanlı işi olabilir: kapsam dışı kırmızıyı ayrı listele, bulgu yapma.

## Ownership
YALNIZ `/tmp/pub-p5/REVIEW.md` (+ `/tmp/pub-p5/review-*`). Repo'ya yazma.

## YASAK
Kod düzeltme · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase · arka planda açık sunucu.

## Rapor
`worker_done` ≤8 satır: önem bazında sayı, en kritik 3 bulgu file:line, 5 kapı sonucu, "commit'e engel: var/yok", `reportPath`.
