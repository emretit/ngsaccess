# Ortak bileşen Dalga 3 — ortak kurallar

Repo: /Users/emreaydin/ngsaccess (ana dizin, main). Worktree AÇMA. React + Vite + Tailwind + shadcn/ui, Convex backend.
Arka plan: .claude/design/ortak-bilesen-A.md ve ortak-bilesen-B.md — kendi aday bölümlerini önce oku (dosya:satır kanıtları orada;
Dalga 1-2 sonrası satır numaraları kaymış olabilir, içerikle bul).
Paralelde 2 başka worker çalışıyor; dosya sahipliği ayrık. Çalışma ağacında Dalga 1-2'nin commit'siz değişiklikleri var — onları geri alma,
üzerine çalış.

## Amaç
Birden çok modülde elle kurulmuş aynı kalıbı YENİ bir ortak bileşene (src/components/shared/) taşımak; modüller arası görünüm/davranış aynı olsun.
Davranış korunur: aynı metinler, aynı URL/state güncellemeleri, aynı disabled/pending koşulları, aynı aria bağları. Spec'te "bilinçli birleştirme"
yazan görsel farklar dışında görünüm değişmez.

## Kod kuralları
- `any` / `as any` / `!` non-null yasak; `unknown` + narrowing. Yorum yoğunluğu çevredeki kod kadar. Named export.
- Yeni ortak bileşen domain bilgisi taşımaz (sorgu, yetki, URL yönetimi çağıranda kalır).
- `src/components/shifts/**` BAŞKA OTURUMDA aktif değişiyor — okuma serbest, YAZMA YOK (raporda adı geçen shifts yerleri bu dalganın dışı).
- Convex'e dokunma, `npx convex` çalıştırma. Bağımlılık ekleme.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore`, `git rm`, `git mv` ÇALIŞTIRMA. commit/push/deploy/migration/DB YOK.
- Testler: vitest + `renderToStaticMarkup` kalıbı (@testing-library yok). Her yeni ortak bileşen için `<Ad>.test.tsx`.
  - Sahip olduğun bileşenin adını taşıyan test dosyasını güncelleyebilirsin.
  - Toplu/denetim test dosyalarını (auditFixes.test.tsx, auditPage.test.tsx, *Audit*.test.tsx, *audit*.test.tsx, shellAudit.test.tsx vb.)
    düzenlemeden ÖNCE ask ile sor.
- Ownership dışında hata görürsen DÜZELTME; dosya:satır ile raporla.
- Bir yer ortak bileşene temiz oturmuyorsa zorlama; dokunma ve nedenini raporla.

## Rapor
worker_done özeti ≤10 satır: yeni bileşen(ler)in imzası, dosya başına ne değişti (file:line), görsel olarak değişen şey,
kapı sonuçları, bilinçli olarak dokunulmayanlar ve nedeni.
