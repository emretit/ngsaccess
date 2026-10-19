# UI yeni yön — ortak bağlam (Faz A: 3 görsel yön mockup'ı)

## Ürün
NGS Plus: Türkçe PDKS + geçiş kontrol SaaS'ı (web, React 19 + Tailwind v4 + shadcn/ui, Convex). Kullanıcı: İK ve güvenlik
yöneticisi; günde çok kez açar, tablo/filtre/durum ağırlıklı çalışır. Bugünkü arayüz eski "yapay zeka UI üreticisi" çıktısı;
hedef özgün, modern, yoğun ama ferah bir kurumsal ürün arayüzü.

## Gerçek bilgi mimarisi (mockup'ta birebir kullan)
Sidebar (sırayla): Ana Sayfa · Kişiler · Cihazlar · Sanal Okuyucular · Geçiş Kontrol · Ziyaretçiler · Canlı İzleme ·
PDKS Kayıtları · Vardiyalar · İzinler · Denetim Kaydı · Admin · Ayarlar. Üstte proje seçici (çok projeli), kullanıcı menüsü.
- Ana Sayfa içeriği: `src/pages/Index.tsx` + `src/components/dashboard/*` (DashboardHeader, StatsGrid, ActivitySummaryCard,
  RecentReadingsTable, QuickLinksGrid) ve `src/hooks/useDashboard.ts`. Gerçekte gösterilen veriyi kullan, yenisini uydurma.
- Kişiler içeriği: `src/pages/Employees.tsx` + `src/components/employees/**` (liste, filtreler, toplu işlemler, departman).
- Kabuk: `src/components/Layout.tsx`, sidebar bileşenleri; mevcut tema `src/index.css`, `tailwind.config.ts` (Poppins).
- Mevcut UX kuralları: `docs/ux-audit/DESIGN_SYSTEM.md`, sorun listesi `docs/ux-audit/05_KABUK_DASHBOARD_GIRIS.md`,
  `docs/ux-audit/03_KISILER_VARDIYA_IZIN.md`. Mevcut ekran görüntüleri varsa: `docs/ui-scan/current/` (olmayabilir).

## Teslim (YALNIZ kendi klasörün: `docs/ui-scan/directions/<yön-klasörü>/`)
1. `home.html` — Ana Sayfa, 1440px masaüstü öncelikli; 390px'te de bozulmadan çalışsın (media query).
2. `people.html` — Kişiler listesi (filtre çubuğu, arama, tablo, seçim + toplu işlem çubuğu, boş/yükleniyor durumu örneği).
3. `NOTES.md` — (a) yönün 3 cümlelik fikri, (b) token tablosu: renk (hex + rol: zemin/yüzey/çizgi/metin/ikincil metin/
   birincil/tehlike/uyarı/başarı/bilgi), tipografi ölçeği (font, 5-6 basamak px/line-height/weight), spacing, radius,
   gölge, odak halkası; (c) bileşen kuralları: buton hiyerarşisi, tablo yoğunluğu, rozet, boş durum, sidebar, sayfa başlığı;
   (d) mevcut arayüze göre 5 en büyük fark; (e) WCAG AA kontrast: metin/zemin çiftleri ve oranları (hesapla).
- HTML tek dosya, harici ağ YOK (CDN/Google Fonts yok): CSS `<style>` içinde, token'lar `:root` CSS değişkeni olarak
  (sonra Tailwind v4 `@theme`'e taşınacak). İkonlar inline SVG (lucide benzeri çizgi ikon), emoji YOK.
- Gerçekçi Türkçe veri (ad-soyad, departman, kapı adları, saatler TR formatı 08:59, tarih 16.10.2026). Lorem/İngilizce yok.
- Light tema zorunlu; dark tema yönün parçasıysa `prefers-color-scheme` veya `.dark` ile ekle.

## Kaçınılacak "AI arayüzü" izleri (hiçbiri olmasın)
Mor/indigo/pembe gradyan · gradyan metin · glassmorphism/backdrop-blur süs · parlama/glow gölge · grain/spotlight overlay ·
her kartta renkli sol/üst kenarlık · her şeye rounded-2xl · her yüzeyde aynı 8px gölge · kart içinde kart ·
ikon kutusu + başlık + metin kartının 3-6 kez tekrarı · bağlamsız 3'lü istatistik bandı · her bölümde BÜYÜK HARF etiket ·
düz tipografi hiyerarşisi · shadcn varsayılan slate renkleri · bounce/stagger giriş animasyonları · emoji ikon ·
boş sıfatlar ("güçlü", "yenilikçi", "kusursuz"). Hareket varsa `prefers-reduced-motion` ile kapat.

## Kurallar
- Kaynak kodu, `src/**`, `convex/**` DEĞİŞMEZ; yalnız kendi klasörüne yaz. Paralel 2 worker daha var (diğer yönler).
- commit/push/deploy/migration/DB yazma YOK. Ağdan paket kurma YOK.
- Kapı: üç dosya var; `home.html` ve `people.html` tarayıcıda (file://) hatasız açılır (bozuk etiket yok — mümkünse
  `python3 -c "import html.parser"` ile parse et); NOTES.md kontrast tablosunda tüm metin çiftleri ≥4.5:1 (büyük metin ≥3:1).
- Rapor: `worker_done` özeti ≤10 satır: yönün fikri, ana token'lar, dosya yolları, bilinen eksik.
