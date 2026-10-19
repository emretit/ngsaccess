# Görev: Dalga 2a — Giriş/Kayıt/Kurulum + Public sayfalar + QR check-in (rapor: docs/ux-audit/05_KABUK_DASHBOARD_GIRIS.md)

## Hedef (test edilebilir)
Raporun §5 UX-0B ve UX-0C kabul senaryoları + 0D'nin QR kısmı sağlanıyor: tokensız/geçersiz/süresi dolmuş/kullanılmış token sonlu ekran, mail hatasında mevcut hesapla devam, ham EXPIRED/Convex metni görünmüyor; demo formunda gönderilmeyen alan yok ve 'satış ekibi' iddiası hesap açmayı doğru adlandırıyor, her görünür CTA gerçek hedefe gidiyor, oturumsuz bilinmeyen URL gerçek 404, 320/768/1024px gezinme çalışıyor; QR check-in GPS ret/zaman aşımı/süresi dolmuş token/çift istekte tek net sonuç.

## Bulgular ve teslim
- 0B: SHL-17, SHL-18, SHL-21, SHL-24, SHL-33 (SHL-22 yapıldı)
- 0C: SHL-27 (minimal dürüst düzeltme: toplanıp gönderilmeyen telefon/personel sayısı/not alanlarını kaldır, CTA metnini 'Ücretsiz hesap oluştur' gibi doğru adlandır — gerçek satış talebi ürün kararı, YAPMA), SHL-28, SHL-29, SHL-30, SHL-31 (çelişen kesin metinler: tek değer)
- 0D: SHL-25, SHL-26 (QR mesajı + idempotent sonuç)

## Ownership (YALNIZ bunlar)
src/components/auth/AuthProvider.tsx · src/components/auth/** (ProjectFilter.tsx HARİÇ) · src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,Auth,DemoRequest,NotFound,LandingPage,CheckIn}.tsx · src/components/demo/** · src/components/landing/** · src/App.tsx (yalnız public/404 rota) · convex/employeeCheckIn.ts · yeni convex/lib/checkInUx.ts (+test) · auth için gerekirse convex/auth*.ts — önce ask

## Kapsam dışı (Dalga 2b veya başka worker)
SHL-15 ProjectFilter rol kontrolü ve SHL-09 AppHeader (admin worker'ında) · dashboard (yapıldı) · gerçek satış talebi/plan devamlılığı (UX-2B) · yasal içerik üretimi · schema.

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
