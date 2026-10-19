# Görev: Dalga 1 — Ortak UX altyapısı (kök sebepler K1/K2/K3/K6 + tasarım sistemi)

## Bağlam
docs/ux-audit/00_OZET_VE_YOL_HARITASI.md §3 (K1–K6) ve §4 (tasarım sistemi taraması). Dalga 2'de 4–5 modül worker'ı bu parçaları TÜKETECEK; API'ler küçük, net, belgeli olmalı. Bu dalgada modül ekranlarını yeniden tasarlama — yalnız altyapı + aşağıdaki kanıt tüketicileri.

## Hedef (test edilebilir)
Aşağıdaki 7 ortak parça var, her birinin saf mantığı vitest ile test edilmiş, en az bir gerçek tüketiciye bağlanmış ve docs/ux-audit/DESIGN_SYSTEM.md'de 1 paragraf + kod örneğiyle belgelenmiş; uygulamada native `confirm()` kalmamış.

## Parçalar
1. **K1 Proje kapsamı — backend:** `convex/lib/projectScope.ts` → `resolveProjectScope(ctx, projectId?)`: projectId verilirse kullanıcının erişimi doğrulanır (yoksa Türkçe hata), `[projectId]` döner; verilmezse `getProjectIdsForUser` sonucu. `convex/dashboard.ts` içindeki yerel `dashboardProjectIds` bunu kullanacak şekilde taşınır (davranış aynı). Saf karar kısmı test edilir.
2. **K1 — frontend:** `src/hooks/useActiveProjectScope.ts` — `src/contexts/ActiveProjectContext.tsx` üstünde ince sarmalayıcı: `{ projectId, projectIds, loading, isSuperAdmin, isAdmin }`; `useDashboard` buna geçirilir.
3. **K2 Tek bildirim API'si:** `src/lib/notify.ts` — sonner üzerinde `notify.success/error/info`; `error(title, unknownError?)` ConvexError/Error/string'den Türkçe açıklama çıkarır (saf `errorMessage(unknown)` + test). Eski `useToast` çağrılarını bu dalgada TOPLU TAŞIMA (Dalga 3 işi).
4. **K2 İşlem durumu:** `src/hooks/useAsyncAction.ts` — `const { run, pending } = useAsyncAction(fn, { success?, error? })`: uçuşta ikinci çağrıyı yok sayar, başarıda/hatada notify, hatada `run` false döner (form açık kalabilsin). Guard mantığını saf yardımcıya çıkarıp test et (testing-library YOK, yeni bağımlılık ekleme).
5. **K3 Nullable patch:** `convex/lib/nullablePatch.ts` — sözleşme: argümanda `undefined` = dokunma, `null` = alanı temizle (Convex patch'te alanı `undefined` yapar). `toPatch(args)` + test (iç içe değil, düz alanlar). Validator kalıbını DESIGN_SYSTEM.md'ye yaz (`v.optional(v.union(v.null(), v.string()))`). Tüketiciler Dalga 2'de (ACC-01, PPL-21) — burada bağlama.
6. **K6 Yıkıcı işlem onayı:** `src/components/shared/ConfirmDestructive.tsx` — shadcn AlertDialog; props: başlık, nesne adı, etki listesi (`string[]`), onay etiketi, `onConfirm: () => Promise<unknown>`; beklerken butonlar kilitli, hata olursa diyalog açık kalır. Native `confirm()` kullanan 3 yeri buna geçir: src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:59 · src/components/admin/AdminDeviceDialog.tsx:108 · src/components/admin/AdminDevicesPanel.tsx:50.
7. **Durum rozeti + iskelet:** `src/lib/statusTone.ts` (`success|warning|danger|info|neutral` → src/index.css'teki `status-*-badge` sınıfları; neutral için muted token) + `src/components/shared/StatusBadge.tsx` + `src/components/shared/SectionSkeleton.tsx` (satır sayısı prop'lu). Kanıt tüketicisi: dashboard bileşenlerinden biri (sabit renk varsa) — yoksa yalnız belge.

## Belge
`docs/ux-audit/DESIGN_SYSTEM.md`: her parça için "ne zaman kullanılır / örnek"; ayrıca kurallar: durum rengi yalnız StatusBadge/token, emoji yok (lucide), boş/hata durumu `EmptyState`/`ErrorState`, form alanı `FormFieldWrapper`, ikon butonda `aria-label`, yükleme `SectionSkeleton` (tam ekran spinner yok).

## Ownership (YALNIZ bunlar)
Yeni: convex/lib/projectScope.ts(+.test.ts) · convex/lib/nullablePatch.ts(+.test.ts) · src/hooks/useActiveProjectScope.ts · src/lib/notify.ts(+.test.ts) · src/hooks/useAsyncAction.ts · src/lib/asyncGuard.ts(+.test.ts) (veya benzeri saf yardımcı) · src/lib/statusTone.ts(+.test.ts) · src/components/shared/{ConfirmDestructive,StatusBadge,SectionSkeleton}.tsx · docs/ux-audit/DESIGN_SYSTEM.md
Değişen: convex/dashboard.ts (yalnız dashboardProjectIds → resolveProjectScope) · src/hooks/useDashboard.ts · src/components/settings/sections/integrations/BridgeIntegrationCard.tsx · src/components/admin/AdminDeviceDialog.tsx · src/components/admin/AdminDevicesPanel.tsx · src/components/dashboard/** (yalnız StatusBadge/SectionSkeleton kanıtı için)

## Kapsam dışı
Modül ekranlarının yeniden tasarımı, toplu toast/renk göçü, schema değişikliği, yeni npm bağımlılığı.

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
