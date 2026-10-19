# Görev: Dalga 2a denetimi — frontend (SALT-OKUMA)
Repo: /Users/emreaydin/ngsaccess. 5 Codex worker modül doğruluk paketlerini uyguladı (spec'ler .claude/orca-specs/d2-*.md, bulgu ayrıntıları docs/ux-audit/0[1-5]*.md). Bağımsız denetçisin; raporu değil DİFF'i oku.
## Kapsam
src/**: `git diff -- src` + yeni src dosyaları
## Bak
Doğruluk (rol matrisi src/lib/capabilities.ts ile backend uyumu, AuthProvider/kayıt akışı yarışları, QR check-in sonuçları), Dalga 1 altyapısının doğru kullanımı (useAsyncAction, ConfirmDestructive, notify, StatusBadge — docs/ux-audit/DESIGN_SYSTEM.md), React hook kuralları, erişilebilirlik (ikon butonda aria-label, klavye), kullanıcıya ham ID/İngilizce/teknik hata gösterimi.
CLAUDE.md: any/as any yok, ! yok, yerel tip kopyası yok.
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK.
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Commit'e hazır mı: evet/hayır".
