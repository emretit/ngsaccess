# Dalga 3b · C-01 davet şifre yarışı + C-04 SMTP kaydında dondurma (commit) kapısı

Hedef (test edilebilir): (1) Davet kabulünde hesap sıfırlama + kimlik bilgisi değiştirme + davet tüketimi tek atomik mutation adımında olur; arada eski şifreyle giriş penceresi kalmaz ve davet ikinci kez tüketilemez. (2) SMTP ayarı kaydedilirken şifreleme sonrası DB'ye yazan mutation, proje/hesap dondurma (freeze) ve yetki kontrolünü yazma anında yeniden yapar.

## Bulgular
- **C-01** (medium): `convex/invites.ts:179, 249-254` — `resetClaimedAccount` ile `modifyAccountCredentials` arasında ayrı adımlar; milisaniyelik pencerede hem giriş hem davet tüketimi olabilir. İlgili: `convex/lib/auth.ts:24`, `src/pages/UserSetup.tsx` (yalnız okuma; frontend akışını değiştirmen gerekirse dur ve `ask` ile sor). Convex Auth API sınırını (action vs mutation) dikkate al: `modifyAccountCredentials` action'da çalışıyorsa, davet tüketimini "claim → credentials → finalize" şeklinde token-sürümlü yap; finalize, claim token'ı eşleşmezse reddeder.
- **C-04** (low): `convex/mailSettings.ts:26`, `convex/actions/projectMail.ts:27`, `convex/actions/sendEmail.ts:40` — `authedAction` girişte kontrol ediyor ama şifreleme sonrası yazan internal mutation tekrar kontrol etmiyor. Çözüm: yazan internal mutation içinde aynı yetki + dondurma kontrolü (mevcut guard helper'larını `convex/lib/adminGuards.ts`'ten OKU ve kullan, o dosyaya YAZMA).

## Ownership (yalnız bunlara yaz)
- `convex/invites.ts`, `convex/mailSettings.ts`, `convex/actions/projectMail.ts`, `convex/actions/sendEmail.ts` (yalnız C-04 için gerekiyorsa)
- Testler: `convex/invites.test.ts`, `convex/invites.security.test.ts`, `convex/mailSettings.test.ts`, yeni test dosyaları.

## Kapsam dışı
- `convex/schema.ts` (yazma; alan gerekiyorsa `ask`), `convex/lib/adminGuards.ts`, `convex/lib/auth.ts` (yazma), `src/**`, Dalga 2/3a dosyaları (`privacyRetention.ts`, `sendScheduledReports.ts`, `hikvisionSync.ts`, `ideSync.ts`).

## Kabul testleri
1. Aynı davet token'ı ile eşzamanlı/ardışık iki kabul → yalnız biri başarılı.
2. Claim sonrası credentials adımı tamamlanmadan finalize/giriş → eski hesap durumu kullanılamaz.
3. SMTP kaydı: action başladıktan sonra proje dondurulursa veya yetki düşerse internal mutation yazmaz.
## Ortak kurallar (HER worker için bağlayıcı)
- Repo: /Users/emreaydin/ngsaccess, ana çalışma dizini (main). Yeni worktree/dal AÇMA.
- **git add / git commit / git stash / git checkout / git reset / git restore / git switch YASAK.** Commit, push, deploy, `npx convex dev/deploy`, migration, `npx convex run` ile DB yazımı YASAK. Koordinatör reflog'a bakacak.
- Çalışma ağacında başka oturumların commit'lenmemiş değişiklikleri var (PDKS, reports, schema vb.). Ownership listen DIŞINDAKİ hiçbir dosyaya yazma; ownership dosyasında senden önce gelen değişiklik varsa koru.
- Convex kodu yazmadan önce `convex/_generated/ai/guidelines.md` oku. Proje kuralları: `CLAUDE.md` (any yasak, camelCase alan, `filter(Boolean)` değil type guard).
- Node modülü içe aktaran convex dosyası `"use node"` ister.
- Kaynak bulgu metni: `docs/audits/2026-11-14-implicit-state-machines/README.md` + alan raporları (`device-sync.md`, `access-visitor-account.md`, `people-pdks.md`). Önce bulguyu kodda yeniden doğrula; bulgu artık geçerli değilse düzeltme yapma, raporla.
- Kapılar (hepsini kendin koş, çıktıyı rapora yaz):
  - `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata
  - `node_modules/.bin/eslint <değiştirdiğin dosyalar>` → `no-explicit-any` 0
  - `npx vitest run <ilgili test dosyaları>` → yeşil (tam vitest'i koordinatör koşacak; başka worker'lar da paralel çalışıyor, tam koşu açma)
- Rapor: `worker_done` içinde ≤10 satır: her bulgu için ne değişti (file:line), eklenen testler, kapı sonuçları, açık kalan/karar gereken nokta.
