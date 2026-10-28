# DENETİM — Faz 2-C (K-04 kart sayısal tekilliği, A6-6 ziyaretçi kart iadesi snapshot, A6-7 ziyaretçi IDE silme employeeId)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f2-c-kart.md`. Worker raporu: `/tmp/fix-f2-c-kart-rapor.md`.
Rapor: `/tmp/fix-f2-c-denetim.md`. Dosyalar: convex/employees.ts convex/employeeImport.ts convex/visitors.ts convex/lib/cardIdentity.ts convex/lib/cardIdentity.test.ts convex/fixF2Cards.test.ts
NOT: employees.ts/visitors.ts'te 428382a4 (Faz 0) değişiklikleri zaten commit'li; yalnız `git diff HEAD` farkını denetle. Ağaçta başka worker'ların (ideSync, crons, hikvisionSync) ve başka oturumun PDKS WIP'i var — onların tsc hataları kapsam dışı.
Kart tekillik kontrolüne giden TÜM yollar (create/update/import/toplu atama/ziyaretçi create-update-aktivasyon/mobil ziyaretçi) yeni kontrolü kullanıyor mu; sorgu sayısı makul mü (≤ ~20 index okuması);
checkOut→releaseCard snapshot'ı gerçekten eski kartı ve eski hedef cihazları taşıyor mu; Kabul: 2^53 üstü sınır bilinçli karar (NOT).
