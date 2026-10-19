# Görev: Dalga 2a — Ayarlar + Admin + Profil UX-0A/0B/0D (rapor: docs/ux-audit/04_AYARLAR_ADMIN.md)

## Hedef (test edilebilir)
Raporun §5 0A, 0B, 0D kabul senaryoları sağlanıyor: 3 rol için sayfa/URL matrisi (üye yetkisiz query çalıştırmıyor, proje yöneticisi davet edebiliyor), kullanıcı düzenleme aktif projeye sessiz atama yapmıyor ve rol+üyelik tek işlem, başarısız davet tekrarı başarı göstermiyor; kaydedilmiş false ayarlar korunuyor, geç gelen sorguda form kaydedilemiyor, mesai iki tabloya ya tümü ya hiç yazıyor, geçersiz sayılar reddediliyor; profil adı ilk açılışta dolu, boş ad yazılamıyor, fotoğraf başlıkta görünüyor.

## Bulgular ve teslim
- 0A: ADM-01 (tam: yetenek haritası — src/lib/roleLabels.ts yanında rol→izinli sekme/eylem; AccessDenied), ADM-02 (rol+üyelik atomik; mevcut üyelikleri göster/değiştir), ADM-04, ADM-05 (kullanıcı), ADM-08
- 0B: ADM-05 (ayar), ADM-10 (SMTP'nin gerçek etkisini dürüst anlat), ADM-14, ADM-15, ADM-16
- 0D: ADM-06 (işlevsiz parola düğmesi dürüst 'henüz yok'), ADM-33, ADM-34, ADM-35; SHL-09 (AppHeader photoUrl)

## Ownership (YALNIZ bunlar)
src/components/admin/** (AdminDevicesPanel.tsx ve AdminDeviceDialog.tsx HARİÇ) · src/components/auth/ProjectFilter.tsx · src/components/settings/** (components/AddShiftDialog.tsx ve shiftFormSchema.ts HARİÇ) · src/pages/Settings.tsx · src/pages/SystemAdmin.tsx · src/pages/AuditLog.tsx (yalnız yetki kapısı) · src/pages/Profile.tsx · src/hooks/useProfileUtils.ts · src/components/profile/** · src/components/layout/AppHeader.tsx · src/components/layout/AppSidebarNav.tsx (yalnız yetenek haritası tüketimi) · src/hooks/useMailSettings.ts · src/hooks/useNotificationSettings.ts · src/lib/roleLabels.ts · yeni src/lib/capabilities.ts(+test) · convex/users.ts · convex/userProjects.ts · convex/invites.ts · convex/settings.ts · convex/holidays.ts · yeni convex/lib/settingsUx.ts (+test)

## Kapsam dışı (Dalga 2b veya başka worker)
0C cihaz/proje (adminDevices, claimDevice) · 0E denetim kaydı (auditLog.ts sorgusu) · 0F raporlar (reports.ts) → 2b · gerçek Pafta entegrasyonu · gerçek parola değiştirme akışı · schema.

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
