# Görev: Dalga 2b denetimi — backend (SALT-OKUMA)
Repo: /Users/emreaydin/ngsaccess. 6 Codex worker doğruluk paketlerini uyguladı (spec'ler .claude/orca-specs/d2b-*.md + d2b-common.md; bulgu ayrıntıları docs/ux-audit/0[1-4]*.md). Bağımsız denetçisin; raporu değil DİFF'i oku.
## Kapsam
`git diff -- convex ':!convex/lib/cardReadingAudit.ts'` + `git status --short convex` ile yeni (untracked) convex/lib/* dosyaları. schema.ts değişikliği koordinatörün (index + pendingUploads + dismissedAt) — index'lerin gerçekten kullanıldığını ve sorgu sırasının index alan sırasına uyduğunu kontrol et.
## Özellikle bak
1. Proje kapsamı/yetki: resolveProjectScope kullanımı, istemci `isSuperAdmin`'e güvenen dal kaldı mı; ilişki doğrulamaları (lib/peopleRelations.ts, lib/accessScopeRelations.ts) create VE update yollarında, toplu işlemlerde de var mı; yeni mutation'ların rol kontrolü (retry: adminMutation; reports schedule; claimUpload).
2. Yükleme sahipliği (files.ts, lib/peoplePhoto.ts): başkasının storageId'siyle foto bağlama/URL alma mümkün mü; eski photoUrl'li kayıtlar bozuluyor mu; pendingUploads temizliği.
3. Hikvision silme snapshot (employees.ts removeEmployeeWithDependencies, lib/peopleHikSnapshot.ts, actions/hikvisionSync.ts deleteEmployeeFromDevicesInternal): snapshot'ın topladığı cihaz kümesi `convex/hikvisionSync.ts getEmployeeWithDevices`'ın kümesiyle aynı mı (grup kapıları / doğrudan cihaz yolları kaçıyor mu); bulkDelete aynı yolu kullanıyor mu.
4. Senkron (syncStatus.ts, hikvisionSync.ts, ideSync.ts, lib/syncStatus*): dismiss artık status değiştirmiyor mu; bridge pipeline fonksiyonları (enqueue/claim/ack/requeue/listRetryCandidates/markOp*/resolveTargetFailures) DEĞİŞMEDİ mi (`git diff` ile doğrula); retry mutation idempotent ve rol kontrollü mü; dismissedAt'li failed kayıtlar otomatik retry'da tutarlı mı.
5. Sayfalama: cardReadings.list ve auditLog.list paginate — filtre index'te mi, `.filter()` + paginate kombinasyonunda sayfa boşalması/sonsuz döngü riski; cardReadings.ts içindeki PDKS fonksiyonları (getPdksTableData, getPdksChartData, getMonthlyPayrollSheet, processCardReading, listForEmployee, selfCheckIn, getEmployeeAttendanceDetail, backfillHikEventRow) DEĞİŞMEDİ mi.
6. Raporlar (reports.ts, lib/reportAttendance.ts, lib/reportScope.ts, actions/sendScheduledReports.ts): PDKS motoruyla tutarlılık, null "doğrulanamadı" yalnız etkilenen satırda mı, zamanlanmış rapor kapsamı/üyelik kontrolü.
7. API sözleşmesi kırılması: değişen query/mutation arg'larının TÜM çağıranları (src + convex/actions + mobile/ Flutter `grep -rn "<fonksiyonAdı>" mobile/lib`) güncel mi.
CLAUDE.md: any/as any yok, ! yok, yerel tip kopyası yok, filter(Boolean) yerine type guard.
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK.
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
