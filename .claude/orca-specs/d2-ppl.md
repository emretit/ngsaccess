# Görev: Dalga 2a — Kişiler + Vardiya UX-0C/0D + departman silme (rapor: docs/ux-audit/03_KISILER_VARDIYA_IZIN.md)

## Hedef (test edilebilir)
Raporun §5 UX-0 kabul senaryolarındaki personel ve vardiya maddeleri sağlanıyor: toplu departman değişimi gerçekten Convex'e yazıyor (REST yok), erişim kuralı A→B değişince A kaldırılıyor ya da UI bunu açıkça 'ekle' olarak anlatıyor, tekli ve toplu silme aynı temizliği yapıyor, fotoğraf yüklenirken Kaydet kapalı, çalışanı olan departman silinemiyor, mola kapatma/tolerans temizleme kalıcı, vardiya hatasında form korunuyor.

## Bulgular ve teslim
- UX-0C: PPL-01, PPL-04, PPL-06, PPL-07, PPL-08 (bulkDelete tekli silmeyle aynı cascade'i kullanır), PPL-09, PPL-12, PPL-41, PPL-42
- PPL-16: çalışanı veya alt departmanı olan departman backend'de silinemez (Türkçe mesaj + sayı), UI ConfirmDestructive
- UX-0D: PPL-21 (nullablePatch), PPL-22, PPL-23, PPL-24, PPL-25, PPL-29, PPL-28 (tüm seri açık onay)

## Ownership (YALNIZ bunlar)
src/hooks/useEmployeeTable.ts · src/components/employees/** · src/pages/Employees.tsx · src/pages/EngineeringDepartment.tsx · src/components/departments/** · src/hooks/useDepartments.ts · src/pages/Shifts.tsx · src/components/shifts/** · src/components/settings/sections/components/AddShiftDialog.tsx · src/components/settings/sections/components/shiftFormSchema.ts · convex/employees.ts · convex/files.ts · convex/departments.ts · convex/shifts.ts · yeni convex/lib/employeeUx.ts / convex/lib/shiftUx.ts (+test)

## Kapsam dışı (Dalga 2b veya başka worker)
PPL-02/17 proje kapsamı (useEmployees, aktif proje ∩ izinli; employees.list projectId) → 2b · convex/leaves.ts ve src/pages/Leaves.tsx (izin, 0d'de yapıldı) · cihaz action'ları (convex/hik*, convex/ide*) — değişiklik gerekirse ask · schema.

## Ortak kurallar (Dalga 2a)
- Bağlam: ilgili modül raporu (bulgu satırları §3, kabul senaryoları §5) + docs/ux-audit/00_OZET_VE_YOL_HARITASI.md §6 kullanıcı kararları.
- **Dalga 1 altyapısını KULLAN** (docs/ux-audit/DESIGN_SYSTEM.md): `resolveProjectScope` / `useActiveProjectScope`, `notify` (yeni kodda useToast yerine), `useAsyncAction` (her mutation butonu: pending + çift tıklama koruması + hata halinde form açık), `toPatch` + `v.optional(v.union(v.null(), T))` (boşaltılan alan = temizle), `ConfirmDestructive` (her yıkıcı işlem: nesne adı + etki listesi), `StatusBadge`, `SectionSkeleton`, `EmptyState`/`ErrorState`. Bu ortak dosyaları DEĞİŞTİRME; eksik bir şey gerekiyorsa `ask` ile sor.
- **Önceki dalgalarda yapıldı, tekrar yapma:** DEV-07/19/22 · ACC-03/10 · PPL-31/32/34 · ADM-01(listExpired)/03/09/11/20 · SHL-01..07/10/22/35. Kullanıcı kararları: cihaz silinince okuma geçmişi korunur; bağlı iş verisi olan proje silinemez; izni yalnız admin açar.
- `convex/schema.ts` DEĞİŞMEZ (bu dalgada kimsenin sahipliğinde değil). Index/alan gerekiyorsa uygulama, worker_done'da "2b'ye öneri" olarak yaz.
- convex-test kurulu DEĞİL, yeni bağımlılık ekleme: backend kurallarını saf fonksiyona (`convex/lib/<modül>*.ts`) çıkarıp vitest ile test et.
- Paralel 4 worker daha var; YALNIZ Ownership listendeki dosyalara yaz. Listede olmayan dosya gerekiyorsa DUR, `ask` ile sor.
- Bir bulgu ürün kararı gerektiriyorsa (rapor "ürün kararı" diyor) en dürüst minimal düzeltmeyi yap (yanlış iddiayı kaldır / açık "henüz yok" durumu) ve raporla; yeni ürün akışı icat etme.

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
