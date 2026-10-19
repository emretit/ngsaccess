# Görev: Dalga 2a — Geçiş kuralları + Ziyaretçiler UX-0A/0C (rapor: docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md)

## Hedef (test edilebilir)
Raporun §5 0A ve 0C kabul senaryoları sağlanıyor (09–18 → 'tüm gün' kaydedilince saatler gerçekten temizleniyor, boş gün/tek saat açık hata, priority 0 korunuyor, sıfır üyeli ziyaretçi bölgesi güncellenebiliyor; ziyaretçi kartı tek seferlik yakalanıyor, reddedilen okuma 'içeride' durumunu değiştirmiyor, içerideyken süresi dolan kişi içeride kalıyor, boşaltılan telefon/not temizleniyor) ve ziyaretçi çıkış/silme işlemleri isimli onaylı.

## Bulgular ve teslim
- 0A: ACC-01 (nullablePatch ile saat temizleme), ACC-02, ACC-04, ACC-09
- 0C: ACC-18 (yalnız izin verilen okuma konumu değiştirir; accessTime sırası), ACC-19, ACC-20, ACC-21, ACC-29
- 0D (yalnız ziyaretçi kısmı): ACC-24, ACC-25

## Ownership (YALNIZ bunlar)
src/components/access-control/unified/** · src/hooks/access-rules/** · src/components/visitors/** · src/hooks/useVisitors.ts · src/types/visitor.ts · src/pages/AccessControl.tsx · src/pages/Visitors.tsx · convex/accessRules.ts · convex/visitors.ts · yeni convex/lib/accessRuleUx.ts / convex/lib/visitorPresence.ts (+test)

## Kapsam dışı (Dalga 2b veya başka worker)
ACC-0B proje kapsamı (ACC-11/13/17/30: cardReadings.ts, employees.ts, useEmployees) → 2b · ACC-35/38 (ZoneDoorTree/EditDoorDialog, cihaz worker'ında) → 2b · canlı izleme ekranı · schema.

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
