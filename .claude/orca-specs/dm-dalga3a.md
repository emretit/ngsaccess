# Dalga 3a · C-05 saklama zinciri adil bütçe + B-04/B-05 rapor teslim kaydı ve retry

Hedef (test edilebilir): (1) Ziyaretçi/kişisel veri saklama zinciri 20'den fazla retention'ı açık projede de her projeyi birkaç gün içinde işler (proje başına kaldığı yerden devam eden adil sıra). (2) Zamanlanmış rapor/hatırlatma e-postası gönderimi başarısız olursa kaybolmaz: denemeler kaydedilir, sınırlı sayıda (ör. 3) backoff ile yeniden denenir, aynı dönem için iki kez gönderilmez.

## Bulgular
- **C-05** (medium): günlük 20 çağrılık bütçe her gün ilk projeden başlıyor (`convex/privacyRetention.ts:144, 192, 202, 362-395`, batch 25). Çözüm yönü: proje sırasını cursor/son işlenen projeyle döndür (round-robin) veya en uzun süredir işlenmemiş projeden başla. Cursor'ı mevcut bir tabloda/alanda tut; yeni alan gerekiyorsa schema'ya YAZMA, raporda öner ve bellek-içi/var olan alanla çözülemiyorsa koordinatöre `ask` ile sor.
- **B-04** (medium) aylık rapor hatırlatması: e-posta başarısızsa retry yok, kayboluyor. `convex/actions/sendScheduledReports.ts:21, 44-45`, `convex/reports.ts:341`, `convex/crons.ts:8`.
- **B-05**: rapor teslim durumu kaydı / idempotency (aynı dönem iki kez gitmesin). Ayrıntı `people-pdks.md` içinde B-05 başlığı.
- Dalga 1'de `privacyRetention.ts` içinde `purgeMobileOperations` değişti (commit e67adf51), onu bozma.

## Ownership (yalnız bunlara yaz)
- `convex/privacyRetention.ts`, `convex/actions/sendScheduledReports.ts`, `convex/reports.ts` (yalnız teslim kaydı/retry ile ilgili internal fonksiyonlar), `convex/crons.ts` (yalnız gerekirse)
- Testler: `convex/retention.test.ts`, `convex/privacyRetention.settings.test.ts`, yeni `convex/privacyRetention.fairness.test.ts`, yeni `convex/actions/sendScheduledReports.test.ts` vb.
- `convex/schema.ts`'e YAZMA (Dalga 2 worker'ı sahibi). Yeni alan/tablo zorunluysa: `ask` ile koordinatöre tam alan tanımını öner, cevabı bekle.

## Kapsam dışı
- `convex/lib/reportAttendance.ts`, `convex/lib/reportScope.ts`, `src/components/reports/**` (başka oturum düzenliyor), `convex/actions/sendEmail.ts` ve `projectMail.ts` (Dalga 3b), Dalga 2 dosyaları.

## Kabul testleri
1. 25 retention'ı açık proje, günlük bütçe 20 → 2. gün koşusunda 21-25. projeler işlenir.
2. Rapor e-postası 1. denemede hata → retry planlanır; 2. denemede başarı → teslim kaydı `sent`, tekrar çağrı yeni e-posta göndermez.
3. Maksimum deneme sonrası `failed` olarak kalır, sonsuz retry yok.
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
