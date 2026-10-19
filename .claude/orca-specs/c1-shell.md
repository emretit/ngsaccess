# C1 W-shell — A2 token + kabuk + ortak bileşenler + Ana Sayfa
Önce `.claude/orca-specs/c1-common.md` oku ve uygula. Sonra: `docs/ui-scan/DESIGN_DIRECTION.md`, `docs/ui-scan/pages/01-ana-sayfa/REPORT.md`
(TAMAMI — "Kabuk", "Rol matrisi", "Katmanların davranışı", "Bileşen eşlemesi ve Faz C değişiklik sınırı" bölümleri bu işin spec'idir),
`docs/ui-scan/pages/01-ana-sayfa/mockup.html`, `docs/ui-scan/00_OZET.md` §3 (ortak bileşen listesi).

## Hedef (test edilebilir)
Uygulama A2 token'ları ve bordo kabukla açılır; 13 sidebar öğesi rolüne göre görünür; 390px'te menü Sheet olarak açılır ve içerik tam
genişlik; ⌘K/Ctrl+K palet rol-filtreli rotalara gider; Ana Sayfa 01 mockup'ıyla eşleşir; diğer 12 sayfa kırılmadan render olur.

## İş sırası
1. **Token'lar:** `src/index.css` `:root` shadcn değişkenlerini A2 değerlerine eşle (background=canvas #fcfcfc, card/popover=surface,
   muted=subtle, border=line, input=control, foreground=text, muted-foreground=muted, primary=#7a1f1f(+hover), ring=primary,
   destructive=danger, sidebar-*=side-*; success/warning/info + bg'leri) ve A2 adlarıyla (`--canvas`, `--surface`, `--subtle`, `--line`,
   `--control`, `--selected`, `--side-*`) Tailwind v4 `@theme` üzerinden de kullanılabilir yap. `--radius` 6px; gölgeler kalkar
   (yalnız popover/dialog/menu tek hafif gölge). `.dark`: yeni koyu tasarım YAPMA; mevcut koyu temayı çalışır tut, sidebar koyu bordo
   varyantı, tüm ön/arka plan çiftleri ≥4,5:1 (bilinen: dark `--sidebar-primary` + beyaz = 3,18:1 → düzelt).
   `src/styles/contrast.test.ts`'i sidebar-*, muted-foreground/muted, destructive/success/warning/info badge çiftlerini de ölçecek şekilde genişlet.
2. **Font:** Poppins kalkar — `index.html` Google Fonts link'leri, `tailwind.config.ts` fontFamily, `src/index.css` font-family → sistem fontu.
   Ölçek: 11/12/13/16/26/30 (DESIGN_DIRECTION). Gövde 13px.
3. **Kabuk** (`src/components/Layout.tsx`, `src/components/layout/**`, `src/components/ui/sidebar.tsx`, `src/lib/routeMeta.ts`):
   sidebar 216px bordo, 13 öğe 3 grup (Ana Sayfa…Canlı İzleme | PDKS Kayıtları·Vardiyalar·İzinler | Denetim Kaydı·Admin·Ayarlar),
   aktif öğe sol 3px gösterge; üst çubuk 64px: proje seçici (her genişlikte görünür; arama + "sonuç yok"), sayfa adı, ⌘K arama
   düğmesi, hesap menüsü (Profil, Çıkış). 390px: sidebar modal Sheet (odak tuzağı, Esc, açan düğmeye odak dönüşü), içerik tam genişlik.
   Skip link ("İçeriğe geç"). Grupları ve görünürlüğü `routeMeta` + `capabilities` tek kaynaktan üret (yeni yetki TANIMLAMA).
   Mevcut davranışları koru: Layout'taki tek korumalı rota guard'ı, `?next=`, sayfa ErrorBoundary key'i (`pathname|activeProjectId`),
   SyncIssuesBanner, ActiveProjectContext soğuk açılış korunması.
4. **Komut paleti:** yeni `src/components/layout/CommandPalette.tsx` (`ui/command.tsx` + cmdk); ⌘K/Ctrl+K, rol-filtreli rotalar,
   Türkçe arama (İ/ı), sonuç yok durumu. Saf filtre mantığı ayrı dosyada + vitest.
5. **Ortak bileşenler** (`src/components/shared/**`, yeni dosyalar burada): `PageHeader` (tek h1 + kapsam satırı + en fazla 1 birincil
   eylem + opsiyonel ikincil menü), `StatInline` (kartsız sayaç dizisi; değer yokken "—", yükleniyor iskeleti), `FilterBar` (arama +
   slot'lar + "Filtreleri temizle"; temizle kapsamı/projeyi DEĞİŞTİRMEZ), `BulkBar` (seçim sayısı bordo, eylemler, seçimi kaldır),
   `SaveBar` (dirty iken görünen kaydet/vazgeç çubuğu; `useUnsavedChangesGuard` ile birlikte kullanım örneği DESIGN_SYSTEM'e),
   DataTable yoğunluğu (`ui/table.tsx`'e geriye uyumlu `density`/sınıf: satır 42px, başlık 36px, zebra yok, tabular-nums yardımcı sınıfı;
   satır "⋯" menüsü için küçük `RowActions` bileşeni). Mevcut `StatusBadge`, `EmptyState`, `ErrorState`, `SectionSkeleton`, `StatCard`,
   `AccessDenied` ve `ui/{badge,button,input,select,dialog,sheet,popover,dropdown-menu,tabs,date-picker,card}.tsx` A2 görünümüne geçer —
   props API değişmez. `docs/ux-audit/DESIGN_SYSTEM.md` sonuna "A2 bileşenleri" kullanım bölümü ekle (kısa, örnekli).
6. **01 Ana Sayfa** (`src/pages/Index.tsx`, `src/components/dashboard/**`, `src/hooks/useDashboard.ts`): 01 REPORT "Yeni tasarım — Ana Sayfa"
   + mockup. `getStats` dönüş şekli DEĞİŞMEZ (paralel W-dash-api yalnız iç sorguyu değiştiriyor). Bölüm düzeyi QuerySectionBoundary,
   rol farkları (üye Ayarlar hızlı bağlantısını görmez), son okumalardan doğru hedefe link, yükleniyor/0/null ayrımı.
7. Yasaklar: renkli ikon kutusu kartlar, kart içinde kart, gradyan/glow, emoji, BÜYÜK HARF etiket, bounce/stagger (hareket varsa
   prefers-reduced-motion ile kapanır).

## Ownership (yalnız bunlara yaz)
index.html · tailwind.config.ts · src/index.css · src/App.css · src/styles/** · src/components/Layout.tsx · src/components/layout/** ·
src/components/ui/** (yalnız görünüm; API değişmez) · src/components/shared/** · src/lib/routeMeta.ts · src/lib/capabilities.ts (yalnız
okuma yardımcısı ekleme) · src/contexts/ActiveProjectContext.tsx (yalnız ProjectSwitcher'ın ihtiyacı, davranış korunur) ·
src/pages/Index.tsx · src/components/dashboard/** · src/hooks/useDashboard.ts · docs/ux-audit/DESIGN_SYSTEM.md

## Kapsam dışı
convex/** (W-dash-api) · Index dışındaki sayfalar ve modül bileşenleri (C2) · sabit renk/useToast süpürmesi (C3) · tema kişisel tercihi (13) ·
aggregate/sayaç backend'i (C3).

## Görsel doğrulama
Giriş gerektiren ekranlara erişemezsin. `npx vite` ile /login ve / (landing) 1440+390 ve `docs/ui-scan/pages/01-ana-sayfa/mockup.html`
ile karşılaştırmayı Playwright (`/Users/emreaydin/pafta/node_modules/playwright`) ile yapabilirsin; kimlik doğrulamalı 13 sayfa ekranını
koordinatör alacak — worker_done'da kontrol edilmesi gereken ekran/durum listesini ver.
