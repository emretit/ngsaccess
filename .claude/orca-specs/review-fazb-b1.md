# R-B1 — Ücret gizleme denetimi (yazan Codex → denetleyen Claude; salt-okuma)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/review-fazb-b1.md`
Girdi: diff `/tmp/ceo-audit/b1.diff` (11 dosya; ana ağaçta commit'siz) · spec `.claude/orca-specs/fazb-b1-pay.md` · worker raporu `.claude/orca-specs/reports/fazb-b1-pay.md` · harita `.claude/orca-specs/reports/audit-1019-risk.md` §1.
Emre kararı: project_user hiçbir ücret/maliyet bilgisini GÖRMESİN; yöneticilerde (super_admin, project_admin) davranış birebir aynı.
Diff'i ve çağrıldığı kodu kendin oku; rapora güvenme. Sorular:
1. Sızıntı kaldı mı? 7 uç (employees.list/getById, visitors.list, cardReadings.getPdksTableData/getMonthlyPayrollSheet, reports.getOvertimeSummaryReport/getDepartmentCostReport) + `grep -rniE "hourlyRate|monthlySalary|overtimePay|cost" convex --include=*.ts` ile haritada OLMAYAN başka public okuma yolu (iç içe nesne, export, e-posta raporu, zamanlanmış rapor, PDF, AI) var mı?
   Türev yan kanal: sıralama, toplam, "ücreti olan personel sayısı", fallback değeri (ör. proje varsayılan saatlik ücret args/ayar), cost'a göre sıralama kaldı mı?
2. Yönetici davranışı değişti mi (matematik, sıralama, null/0 ayrımı)? `canSeePay` rol kontrolü doğru mu (verified, orphan, super_admin projesiz)?
3. Convex `returns` validator'ları ve frontend tipleri null ile uyumlu mu; UI null'u `0 ₺` gösteriyor mu?
4. Testler gerçekten rol ayrımını sınıyor mu (mock'lar handler'ı atlıyor mu)?
5. Koş (salt-okuma): `node_modules/.bin/vitest run convex/lib/payVisibility.test.ts convex/payVisibility.handlers.test.ts src/components/settings/sections/reports convex/lib/reportScope.test.ts` + `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`.
   (Ağaçta paralel B3 orphan işi commit'siz: shiftAssign/leaveValidation/orphanGuards testleri kırmızı olabilir — kapsam dışı.)
Rapor ≤60 satır: bulgular tablosu (Önem KRİTİK/YÜKSEK/ORTA/DÜŞÜK · dosya:satır · senaryo · öneri) + "Yayına engel: VAR/YOK".
