# Görev: Dalga 0a — Dashboard gerçek veri + kabuk düzeltmeleri

## Hedef (test edilebilir)
/home dashboard'u seçili projenin gerçek verisini gösteriyor (sabit/uydurma rakam yok), "Aktivite Özeti" kartı bugünün gerçek PDKS verisinden hesaplanıyor, Sonner toast'ları ekranda görünüyor, tokensız /employee-setup sonsuz yüklemede kalmıyor.

## Değişiklik (rapor: docs/ux-audit/05_KABUK_DASHBOARD_GIRIS.md)
1. **SHL-35:** src/App.tsx'e `@/components/ui/sonner`'dan `Toaster` mount et (mevcut `ui/toaster` kalsın, iki sistem geçiş süresince birlikte çalışır; isim çakışmasını alias ile çöz).
2. **SHL-01:** dashboard sorguları (`getStats`, `getRecentReadings` ve yeni özet) opsiyonel `projectId` alsın; verilirse sunucuda kullanıcının o projeye erişimi doğrulanıp yalnız o proje sayılsın, verilmezse bugünkü davranış. `useDashboard` aktif projeyi (`useProjectAccess`/proje context'inde ne varsa) iletsin.
3. **SHL-02 (kullanıcı kararı: gerçek veriye bağla):** `ActivitySummaryCard` sabit değerleri kaldır. convex/dashboard.ts'e yeni `getActivitySummary` authedQuery (args: `projectId?`): mevcut `loadPdksDataset` + `computePdksCoreInMemory` / TR gün yardımcılarını yeniden kullanarak BUGÜN (TR) için döndür: çalışma saatleri (efektif work settings'ten başlangıç–bitiş; yoksa null), ortalama ilk giriş saati, ortalama son çıkış saati (yalnız çıkışı olanlar), geç kalan sayısı, içeride/mevcut sayısı. Veri yoksa alanlar null → kartta "Bugün henüz okuma yok" boş durumu. Ortalama saat hesabını saf fonksiyon olarak `convex/lib/` altında yaz + vitest testi (TR saat dilimi, boş liste, tek kayıt). `loadPdksDataset`'e proje filtresi gerekiyorsa opsiyonel parametre ekle; `getPdksStats` (PDKS sayfası kullanıyor) davranışı DEĞİŞMEMELİ.
4. **SHL-03:** "Bekleyen İstekler" → "Pasif erişim kuralları" (ne saydığını doğru adlandır).
5. **SHL-04:** proje dalında son okumalar `by_project_access_time` index'i ile desc/take.
6. **SHL-05:** işlevsiz "Verileri Yenile" butonunu ve boş `refetch*` fonksiyonlarını kaldır.
7. **SHL-06:** KPI'lar yüklenirken 0 değil Skeleton; her bölüm kendi yükleme durumuna baksın.
8. **SHL-07:** son okumalar tablosunda bugün değilse tarih de görünsün ("Bugün 09:12" / "15 Eki 09:12", İstanbul saati); boş durumda `src/components/shared/EmptyState`.
9. **SHL-10:** AppHeader'daki işlevsiz bildirim zilini (sabit kırmızı nokta) kaldır.
10. **SHL-22:** /employee-setup token yoksa loading'den ÖNCE "Geçersiz veya eksik bağlantı" ekranı; geçersiz/süresi dolmuş token ayrı mesaj.

## Ownership (YALNIZ bunlar)
src/App.tsx · src/hooks/useDashboard.ts · src/pages/Index.tsx · src/components/dashboard/** · src/components/layout/AppHeader.tsx · src/pages/EmployeeSetup.tsx · convex/dashboard.ts · convex/lib/<yeni saf yardımcı>.ts + .test.ts

## Kapsam dışı
PDKS sayfası ve `getPdksStats` davranışı · diğer modüller · auth/kayıt akışları (SHL-17/21/27 sonraki dalga) · toast API toplu geçişi.

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
