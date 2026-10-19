# ORTAK KURALLAR (Codex CLAUDE.md okumaz — bu blok bağlayıcıdır)

Repo: `/Users/emreaydin/ngsaccess` — Convex backend + React/Vite/TypeScript (strict). Arayüz Türkçe.
Bağlam: Hik-Connect ile kıyas sonucu (`docs/hikconnect-audit/KIYAS.md`) çıkan eksikleri kapatıyoruz. Plan: `docs/hikconnect-audit/UYGULAMA_PLANI.md`.

## Başlamadan oku
1. `convex/_generated/ai/guidelines.md` (Convex kuralları; eğitim verinizdeki bilgiyi ezer).
2. Dokunacağın modüle benzeyen mevcut dosya + testi (örnek: `convex/leaves.ts`, `convex/employeeCheckIn.test.ts`, `convex/orphanGuards.test.ts`).
3. `convex/schema.ts` içindeki ilgili tablo (YALNIZ OKU).

## Kod kuralları
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri: `unknown` + daraltma. `!` non-null assertion yok: optional chaining + erken return.
- Convex handler'lar schema alanlarını olduğu gibi (camelCase) döner; snake_case yeniden eşleme yok.
- `db.get` dizilerinde `filter((p): p is NonNullable<typeof p> => p !== null)` kullan, `filter(Boolean)` değil.
- Frontend'de `useQuery` sonucunu `any[]`'a açma; `FunctionReturnType<typeof api.X.Y>` ile tiple. Form payload'ı için `z.infer<typeof schema>`.
- Yetki: mevcut yardımcıları kullan (`authedQuery/authedMutation/adminMutation/employeeAuthedMutation`, `getProjectIdsForUser`, `isProjectAllowed`, `canAccessEmployeeProject`). Proje kapsamı dışındaki kayda ASLA erişme (IDOR). Her mutation'da kayıt sahibi proje kontrolü yap.
- Yeni Convex fonksiyonları için argüman doğrulama (`v.*`) ve boyut sınırı zorunlu (dizi ≤ makul üst sınır, string uzunluk sınırı).
- Convex Free kota kısıtı var: YENİ CRON YOK, polling YOK, sınırsız `.collect()` YOK (`take`/`paginate` + index).
- KVKK: ham kişi verisini (ad, TC, kart no) `console.log`'lama; yüklenen dosyayı saklama.
- UI: mevcut bileşenleri kullan (`PageHeader`, `EmptyState`, `src/components/ui/*`), mevcut sayfalardaki yükleniyor/boş/hata kalıbını izle; tarih/saat Europe/Istanbul (`src/lib/date.ts`).

## SAHİPLİK (kritik)
- Bu ağaç PAYLAŞIMLI: başka bir koordinatör (UI audit düzeltmeleri) ve başka oturumlar aynı anda başka dosyaları düzenliyor. SADECE spec'teki "Ownership" dosyalarına yaz.
- ASLA DOKUNMA: `convex/schema.ts`, `convex/_generated/*`, `src/App.tsx`, `src/lib/routeMeta.ts`, `convex/leaves.ts`, `src/pages/Leaves.tsx`, `src/components/leaves/**`, `mobile/**`, `docs/ui-audit-2/**`, `.claude/handoff*`. Faz 0'da şema alanları, boş stub modüller ve `/alarms` route'u HAZIRLANDI; yeni tablo/alan/route gerekiyorsa DUR ve koordinatöre `ask` ile sor.
- Tam ağaç `tsc` başkasının yarım işi yüzünden kırmızı olabilir. Kapı: KENDİ dosyalarında hata 0. Başkasının dosyasındaki hatayı raporda listele, düzeltme.

## YASAK KOMUTLAR
commit / push / deploy / `npx convex dev|deploy|run|codegen` / migration / DB yazma / Supabase MCP / tarayıcı. Convex'e hiçbir komut gönderme (canlı sistem bu deployment'ta).

## KAPILAR (kendin koş, çıktısını raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → kendi dosyalarında 0 hata
- `node_modules/.bin/eslint <sahip olduğun dosyalar>` → 0 error
- `npx vitest run <kendi test dosyaların>` → yeşil
Yeni davranış için test yaz. NOT: bu repoda `convex-test` YOK ve kurulmaz; desen: vitest + `vi.mock("./lib/customFunctions")` ile sarmalayıcıları passThrough yapıp handler'ı sahte ctx ile çağırmak (örnek: `convex/payVisibility.handlers.test.ts`, `convex/orphanGuards.test.ts`, `convex/users.test.ts`). node_modules/package.json'a dokunma. "Yeşil" demek yeterli değil: koordinatör kapıları yeniden koşacak.

## RAPOR
`worker_done` içinde ≤10 satır: yapılanlar (file:line), kapı sonuçları (sayı), karar gerektiren açık noktalar, kapsam dışı bıraktıkların.

## Denetim kaydı etiketi (UI audit koordinatörü kuralı)
`convex/lib/auditLogQuery.test.ts` tüm convex'te `targetTable: "<x>"` yazımlarını tarar ve `AUDIT_TARGET_LABELS` (convex/lib/auditLogQuery.ts) içinde etiket arar. Yeni bir `targetTable` değeri yazarsan o dosyalara DOKUNMA; yeni değeri raporda "etiket gerekli: <x>" diye bildir (koordinatör ekler). Zaten etiketli: deviceEvents, attendanceCorrections, leaves.
