# DENETİM — K-02 W1 backend (kişiyi başka projeye kalıcı taşıma / erişim devri)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/tasima-k02-w1-backend.md`.
Tasarım: `docs/sistem-audit-2026-10-25/tasima-tasarim-claude.md` + `TASIMA-SENTEZ.md`. Worker raporu: `/tmp/tasima-k02-w1-rapor.md`.
Rapor: `/tmp/tasima-k02-w1-denetim.md`. Dosyalar (`git diff HEAD -- <dosya>`; yeni dosyalar tam oku): convex/schema.ts convex/employeeTermination.ts convex/lib/accessTransfer.ts(YENİ) convex/lib/grantStatus.ts convex/employees.ts convex/lib/employeeCardChange.ts convex/employeeAuth.ts convex/lib/deviceHelpers.ts convex/hikvisionSync.ts convex/ideSync.ts convex/crons.ts convex/employeeTransfer.test.ts(YENİ) src/components/employees/lib/employment.ts src/components/employees/EmployeeDetails.tsx src/components/audit/auditLabels.ts (auditLabels'taki mailSettings satırı BAŞKA OTURUMUN, denetleme).
DİKKAT: aynı ağaçta W2 UI worker'ı `src/components/employees/**` yazıyor; başka oturumun mail/PDKS/rapor WIP'i var — DENETLEME, dokunma.

Özel dikkat (önem sırasıyla):
1. **Ana değişmez — eski kapı açık kalamaz:** kart B kaydına ve B cihazlarına, A'nın HER hedef cihazı silmeyi GERÇEKTEN onaylamadan geçebiliyor mu?
   Onay sayılmaması gerekenler: Hik supersede (`markOpSuperseded` status'u "done" yapıyor!), kuyruk `dismissed`, terminal `failed`, gateway
   `queued`/`superseded` sonuçları, yanlış cihaz/kişi/eski op için gelen ACK (`lastOperationId` filtresi), grant'ın başka bir yoldan "removed"
   yazılması. Dondurulan her hedef için gerçekten bir silme işi oluşuyor mu (closeAccess kapsamadığı `idePanelUsers`-yalnız panel)?
   Hedefi hiç onaylanamayacak bir durumda (op hiç oluşmadı) devir sonsuza `revoking` mi kalıyor — deadline → stuck çalışıyor mu?
2. **Yetki:** iki projede `employees.manage`, ücretli kişide iki projede `pay.view`, B kuralları için `accessRules.manage`; kurallar/departman
   B'ye ait mi; `getEmployeeTransfer`/`transferPreflight` yetkisiz projeye kişi/cihaz bilgisi sızdırıyor mu; cancel/retry kimin elinde.
3. **Yarışlar/kilitler:** aktif devirde kart değişimi, proje değişimi, silme, terminate, reinstate, ikinci devir — tüm yazma yolları (import,
   toplu kart atama, ziyaretçi, mobil) kilidi atlıyor mu? `reinstate` taşınmış kaydı her zaman reddediyor mu? Cancel sırasında gelen geç ACK.
4. **Veri bütünlüğü:** B'ye A projesinin id'leri (departman/şirket/pozisyon/vardiya) sızıyor mu; e-posta/TC/sicil tekilliği ve mobil giriş
   aynı e-postada doğru kaydı seçiyor mu; A'nın `employeeAuth`/oturumları gerçekten düşüyor mu; biyometri imhası planlanıyor mu; A'nın geçmişi
   (PDKS, okumalar, izin) dokunulmadan kalıyor mu; cancel B'yi temiz siliyor ve A'yı eksiksiz geri açıyor mu.
5. **Kota/performans (Convex Free limiti aşılmış):** cron 15 dk'da bir boşta ne kadar okuyor; onay kancası her grant yazımında ek okuma
   yapıyor mu (index ile tek okuma kabul, tarama değil); preflight/status sorguları sınırlı mı; `.collect()`/`.filter()` tam taraması var mı.
6. Şema: yalnız genişletme mi (mevcut veriyi bozan zorunlu alan yok), index adları guideline'a uygun mu; yeni convex modülü açılmamış mı.
