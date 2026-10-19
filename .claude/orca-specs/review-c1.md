# Görev: Faz C1 denetimi (SALT-OKUMA) — A2 token + kabuk + ortak bileşenler + Ana Sayfa + getStats
Repo: /Users/emreaydin/ngsaccess. 2 Codex worker C1'i uyguladı (spec'ler `.claude/orca-specs/c1-common.md`, `c1-shell.md`, `c1-dash-api.md`).
Tasarım dili `docs/ui-scan/DESIGN_DIRECTION.md`; Ana Sayfa/kabuk spec'i `docs/ui-scan/pages/01-ana-sayfa/REPORT.md` + `mockup.html`.
Bağımsız denetçisin; raporu değil DİFF'i oku: `git diff` + `git status --short` (yeni dosyalar). HARİÇ: `convex/lib/cardReadingAudit.ts`,
`mobile/**`, `docs/ui-scan/**`, `.claude/**`. Koordinatör ekledi: `convex/schema.ts` devices.by_project_active/by_active + accessRules.by_active.
Koordinatörün gerçek oturumla aldığı ekranlar: `/tmp/c1-shots/NN-slug{,-2,-mobil,-mobil-2}.png` (13 sayfa, 1440+390) ve özet
`/tmp/uxaudit/sheet-desktop.png`, `/tmp/uxaudit/sheet-mobile.png` — aç ve bak.

## KRİTİK BAĞLAM
C1 TEK BAŞINA CANLIYA ÇIKACAK (kademeli). Diğer 12 sayfa eski bileşenleriyle yeni token + kabuk altında çalışacak. Bu yüzden en önemli
soru: ortak `src/components/ui/**` / `shared/**` değişiklikleri eski sayfaları kırıyor mu (props API, varsayılan boyut/yükseklik,
renk değişkeni adları, dark tema, kaldırılan sınıflar)?

## Özellikle bak
1. Geriye uyumluluk: ui/** ve shared/** props API değişmiş mi; ui/table density varsayılanı eski tabloları bozuyor mu; button/input
   yükseklik değişimi formları kaydırıyor mu; kaldırılan CSS değişkeni/utility başka dosyada kullanılıyor mu (grep).
2. Kabuk: Layout guard (`?next=`, oturumsuz içerik), ErrorBoundary key (`pathname|activeProjectId`), mobil Sheet odak tuzağı/Esc/odak
   dönüşü, skip link, routeMeta/capabilities rol görünürlüğü (üye Denetim/Admin/Ayarlar görmemeli; super_admin Admin görür), ⌘K paleti
   aynı filtreyi kullanıyor mu, Türkçe arama.
3. Tema: `.dark` hâlâ çalışıyor mu, kontrast testi gerçek token'ları ölçüyor mu (≥4,5:1), Poppins tamamen kalktı mı (index.html, tailwind, css).
4. Ana Sayfa: getStats şekli korunmuş mu, bölüm hata izolasyonu, 0/null/yükleniyor ayrımı, rol farkları, son okumalar linki doğru hedef.
5. `convex/dashboard.ts`: index aralıkları doğru mu (sınır dahil/haric, TR gün), sayım semantiği eskiyle aynı mı, okuma limiti riski.
6. CLAUDE.md: any/as any yok, `!` yok, FunctionReturnType; YASAKLAR (emoji, gradyan, kart içinde kart, BÜYÜK HARF etiket).
## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run
## YASAK
Dosya düzenleme yok. commit/push/deploy/DB YOK. Uygulamaya giriş yapma.
## worker_done (≤12 satır)
Bulgular önem sırasıyla (kritik/yüksek/orta), file:line + 1 cümle + düzeltme önerisi. Kapı sonuçları. "Canlıya hazır mı: evet/hayır".
