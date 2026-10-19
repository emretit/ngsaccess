# Görev: Dalga 2a denetimi — backend (SALT-OKUMA)
Repo: /Users/emreaydin/ngsaccess. 5 Codex worker modül doğruluk paketlerini uyguladı (spec'ler .claude/orca-specs/d2-*.md, bulgu ayrıntıları docs/ux-audit/0[1-5]*.md). Bağımsız denetçisin; raporu değil DİFF'i oku.
## Kapsam
convex/** (mobile ve convex/lib/cardReadingAudit.ts HARİÇ): `git diff -- convex ':!convex/lib/cardReadingAudit.ts'` + yeni convex/lib/* dosyaları
## Bak
Yetki/güvenlik (proje erişimi, DEV-20 panel/kapı sahipliği, rol kontrolleri users/userProjects/invites/settings, employeeCheckIn token/idempotency), veri kaybı riski (employees cascade/bulkDelete, departments silme engeli, shifts null patch, visitors null temizleme), Convex index/tam tarama/okuma limiti, nullablePatch doğru kullanımı, mevcut API sözleşmesini kıran değişiklik (mobile app ve diğer tüketiciler: grep ile kontrol et).
CLAUDE.md: any/as any yok, ! yok, yerel tip kopyası yok.
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK.
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
