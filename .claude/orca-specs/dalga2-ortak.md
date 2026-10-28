# Ortak bileşen Dalga 2 — ortak kurallar

Repo: /Users/emreaydin/ngsaccess (ana dizin, main). Worktree AÇMA. React + Vite + Tailwind + shadcn/ui, Convex backend.
Arka plan: .claude/design/ortak-bilesen-A.md ve ortak-bilesen-B.md — kendi aday bölümlerini önce oku (dosya:satır kanıtları orada).
Paralelde 2 başka worker çalışıyor; dosya sahipliği ayrık. Çalışma ağacında Dalga 1'in commit'siz değişiklikleri var, onlara DOKUNMA.

## Amaç
Var olan ortak bileşenleri (src/components/shared/*) atlayan yerleri onlara geçirmek; görünüm modüller arasında aynı olsun.
Davranış değişmez: aynı metinler, aynı disabled/pending koşulları, aynı aria bağları, aynı RHF/zod bağları.

## Kod kuralları
- `any` / `as any` / `!` non-null yasak; `unknown` + narrowing. Yorum yoğunluğu çevredeki kod kadar.
- Mevcut shared bileşenin API'sini değiştirme; yalnız spec açıkça izin veriyorsa geriye uyumlu opsiyonel prop ekle.
- Convex'e dokunma, `npx convex` çalıştırma. Bağımlılık ekleme.
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore`, `git rm`, `git mv` ÇALIŞTIRMA. commit/push/deploy/migration/DB YOK.
- Testler: vitest + `renderToStaticMarkup` kalıbı (@testing-library yok).
  - Sahip olduğun bileşenin adını taşıyan test dosyasını (ör. LeaveForm.test.tsx) güncelleyebilirsin.
  - Toplu/denetim test dosyalarını (auditFixes.test.tsx, auditPage.test.tsx, *Audit*.test.tsx, *audit*.test.tsx, shellAudit.test.tsx vb.)
    düzenlemeden ÖNCE ask ile sor — başka worker aynı dosyayı düzenliyor olabilir.
- Ownership dışında hata görürsen DÜZELTME; dosya:satır ile raporla.
- Bir yer ortak bileşene temiz oturmuyorsa (davranış/erişilebilirlik kaybı) zorlama; dokunma ve nedenini raporla.

## Rapor
worker_done özeti ≤10 satır: dosya başına ne değişti (file:line), görsel olarak değişen şey (ör. "Kişiler mobil boşluk 24px→16px"),
kapı sonuçları, bilinçli olarak dokunulmayanlar ve nedeni.
