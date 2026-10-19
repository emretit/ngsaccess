## Ortak kurallar (Dalga 0 implementasyon worker'ları)

Repo: /Users/emreaydin/ngsaccess — React 19 + Vite + Tailwind 4 + shadcn/ui, backend Convex. Kullanıcıya görünen metin Türkçe.
Bağlam: docs/ux-audit/00_OZET_VE_YOL_HARITASI.md + ilgili modül raporu (bulgu ID'leri orada; her bulgunun "Öneri" sütununu oku). Convex kodu yazmadan önce convex/_generated/ai/guidelines.md oku.
Aynı anda başka worker'lar farklı dosyalarda çalışıyor: YALNIZ Ownership listesindeki dosyalara yaz. Listede olmayan bir dosyaya dokunman gerekiyorsa DUR ve `ask` ile koordinatöre sor.

### Proje kuralları
- TypeScript strict; `any` / `as any` YASAK (eslint error) → `unknown` + narrowing. `!` yerine optional chaining + erken return.
- Convex sonuç tipleri için `FunctionReturnType<typeof api.X.Y>`; yerel tip kopyası yazma. Handler'lar camelCase alan döner.
- `db.get` null filtrelemesi: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Tarih: TR gün anahtarı için `convex/lib/trDate.ts` (backend) ve `src/lib/date.ts` (frontend `toLocalDateString` vb.); `toISOString().split('T')[0]` ile gün anahtarı üretme.
- Toast: yeni kodda `sonner` (`import { toast } from "sonner"`); mevcut `useToast` çağrılarını bu görevde topluca taşıma.
- Mevcut stil, isimlendirme, Türkçe yorum yoğunluğunu takip et; gereksiz yorum ekleme. Kapsam dışı refactor yapma.

### YASAK
commit / push / deploy (`npx convex dev`, `npx convex deploy`) / migration / canlı DB'ye okuma-yazma (Convex/Supabase MCP dahil). `convex/_generated/` elle düzenlenmez. Kirli dosyalara dokunma: convex/lib/cardReadingAudit.ts, mobile/**, .claude/**.

### Kapılar (hepsi yeşil olmalı, kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run   (mevcut testlerin hepsi yeşil; yeni saf mantık eklediysen test yaz)

### worker_done raporu (≤10 satır)
Her bulgu ID'si için 1 satır: ne yapıldı + file:line · kapı sonuçları (test sayısı) · backend değişikliği varsa "deploy gerekir" notu · bilinçli yapılmayan/şüpheli noktalar. `--files-modified` ile değişen dosyaları bildir.
