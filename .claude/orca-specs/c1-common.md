# Faz C1 — ortak kurallar (A2 yeni arayüz: temel)
Repo: /Users/emreaydin/ngsaccess (main, temiz; son commit 424556c). Plan: `docs/ui-scan/PLAN.md` (Faz C1), sentez `docs/ui-scan/00_OZET.md`.
- Tasarım dili kesin: `docs/ui-scan/DESIGN_DIRECTION.md` (token, ölçek, kabuk, sayfa kalıbı, YASAKLAR). Referans HTML:
  `docs/ui-scan/directions/A2-sade-bordo-sidebar/{home,people}.html`, sayfa mockup'ları `docs/ui-scan/pages/NN-slug/mockup.html`.
- **Kademeli canlıya çıkış:** C1 tek başına canlıya çıkacak; diğer 12 sayfa o sırada ESKİ bileşenleriyle yeni token + kabuk altında
  çalışacak. Bu yüzden ortak bileşenlerin (src/components/ui/**, src/components/shared/**) props API'si GERİYE UYUMLU kalır; eski
  sayfalarda okunmaz/kırık görünüm yaratma. Sayfa içlerini (Index hariç) değiştirme — o iş C2.
- Proje kuralları CLAUDE.md: `any`/`as any` yok, `!` yok, Convex sonuç tipi `FunctionReturnType`, backend camelCase.
  Convex koduna dokunacaksan önce `convex/_generated/ai/guidelines.md` oku.
- Aynı çalışma ağacında paralel başka worker var; YALNIZ kendi Ownership listene yaz. Liste dışı dosya gerekiyorsa DUR, `ask`.
  Ara tsc'de başkasının dosyasından gelen hata seninki değil; raporda "kendi/diğerleri" ayır.
- `convex/schema.ts` koordinatörde; index gerekiyorsa `ask`.
- commit/push/deploy/migration/DB yazma YOK. Ağdan paket kurma YOK (mevcut bağımlılıklar yeterli: cmdk, radix, vaul, lucide).
- Kapılar (kendin koş): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
  `node_modules/.bin/eslint src convex` · `npx vitest run` · `npx vite build`.
- Rapor: `worker_done` ≤10 satır: ne yapıldı (file:line), kapı sonuçları, görsel doğrulama gereken ekranlar, açık riskler.
