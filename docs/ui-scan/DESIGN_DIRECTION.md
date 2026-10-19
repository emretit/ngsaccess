# NGS Plus — Yeni arayüz tasarım dili (A2: sade nötr + bordo sidebar)

**Karar (kullanıcı, 2026-10-17):** Yön A seçildi, sidebar bordo kalacak. Referans mockup'lar:
`docs/ui-scan/directions/A2-sade-bordo-sidebar/{home,people}.html` (canlı HTML) ve ekran görüntüleri `docs/ui-scan/directions/_shots/A2-*`.
Ayrıntılı gerekçe + kontrast tablosu: `docs/ui-scan/directions/A-sade-notr/NOTES.md` (sidebar hariç hepsi geçerli).

## Fikir
Gün içinde sık açılan sakin bir çalışma alanı. Hiyerarşi kartlarla değil tipografi, hizalama, 1px ayırıcı ve 42px satır
ritmiyle kurulur. Bordo iki yerde yaşar: **sidebar zemini** (marka kimliği) ve içerik alanında **yalnız** birincil eylem,
odak halkası, seçili satır/öğe. Veri ekranı nötr kalır.

## Token'lar (Tailwind v4 `@theme` / CSS değişkeni olarak taşınacak)
| Token | Değer | Rol |
|---|---|---|
| `--canvas` | `#fcfcfc` | Sayfa zemini |
| `--surface` | `#ffffff` | Tablo, buton, diyalog |
| `--subtle` | `#f3f3f2` | Hover, nötr rozet, tablo başlığı |
| `--line` | `#e2e2e0` | 1px ayırıcı (dekoratif) |
| `--control` | `#858582` | Input/select kenarlığı (3.7:1) |
| `--text` / `--muted` | `#252523` / `#646461` | Ana / ikincil metin |
| `--primary` / `--primary-hover` | `#7a1f1f` / `#611919` | Birincil buton, odak, seçim |
| `--selected` | `#f8eeee` | Seçili satır/öğe zemini |
| `--success` / bg | `#356047` / `#edf4ef` | İzin verildi, aktif |
| `--warning` / bg | `#795619` / `#faf3e5` | Uyarı |
| `--danger` / bg | `#963e36` / `#faefed` | Reddedildi, silme |
| `--info` / bg | `#3b5c76` / `#edf2f7` | Bilgi |
| `--side-bg` | `#551919` | Sidebar zemini |
| `--side-text` / `--side-muted` | `#f6ecea` / `#d8bfbb` | Sidebar metin / ikon-ikincil |
| `--side-hover` / `--side-active` | `#62201f` / `#6d2424` | Sidebar hover / aktif öğe zemini |
| `--side-indicator` | `#f2c4bc` | Aktif öğe sol 3px gösterge, sidebar odak halkası |

- **Font:** sistem arayüz fontu (`-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`); Poppins kalkar.
- **Ölçek:** 11 rozet/etiket · 12 tablo/yardımcı · 13 gövde/menü · 16 bölüm başlığı (600) · 26 sayfa başlığı (600; mobil 24) · 30 metrik (550).
- **Spacing:** 4/8/12/16/24/32; iki ana sütun arası 48. Mobil kenar 16. **Radius:** kontrol/tablo 6, rozet/menü 4, diyalog 8, avatar daire.
- **Gölge yok** (`--shadow: none`); yalnız açılır katmanlar (menü/diyalog) için tek hafif gölge serbest.
- **Odak:** 2px `--primary` outline, 3px offset (sidebar içinde `--side-indicator`).
- **Tablo:** satır 42px, başlık 36px, zebra yok, 1px yatay çizgi, sayı/tarih/kart kolonları `tabular-nums`, satır işlemleri tek "⋯" menüsünde.

## Kabuk
Sidebar 216px bordo, 13 öğe sabit sırada (Ana Sayfa · Kişiler · Cihazlar · Sanal Okuyucular · Geçiş Kontrol · Ziyaretçiler ·
Canlı İzleme | PDKS Kayıtları · Vardiyalar · İzinler | Denetim Kaydı · Admin · Ayarlar), grup arası 16px boşluk.
Üst çubuk 64px: proje seçici (her genişlikte görünür) · sayfa adı · ⌘K komut paleti araması · kullanıcı menüsü.
390px'te sidebar menü düğmesiyle açılan katman olur.

## Sayfa kalıbı
1. Başlık bloğu: tek h1 + altında kapsam (proje adı / dönem) + sağda en fazla 1 birincil eylem.
2. Özet: kartsız, tek satır sayaç dizisi ("Toplam 10 · Aktif 8 · Pasif 2") ya da çizgiyle ayrılmış 3-4 metrik (bağlamlı).
3. Filtre çubuğu: arama + 1-3 select + "Filtreleri temizle"; sayfa boyutu sağda.
4. Seçim olunca bağlamsal toplu işlem çubuğu (seçili zemin, bordo sayı).
5. İçerik: tablo ya da liste; boş durum = sebep + yapılabilir sonraki adım; yükleniyor = bölüm içi iskelet (`role=status`).

## Yasaklar (eski "yapay zeka arayüzü" izleri)
Renkli ikon kutusu + başlık kart tekrarı · bağlamsız 3'lü istatistik kartları · kart içinde kart · her yüzeyde gölge ·
rounded-2xl her yerde · gradyan/glow/glassmorphism · renkli sol/üst kenarlık · emoji · BÜYÜK HARF bölüm etiketleri ·
"Hoş geldin, e-posta" gibi ham veri selamlamaları · başarı taklidi yapan toast'lar · bounce/stagger animasyon
(hareket varsa `prefers-reduced-motion` ile kapanır).

## Uygulama notu (Faz C)
shadcn/ui bileşenleri korunur, token'lar `src/index.css` `@theme`'e taşınır; ortak bileşenler (`PageHeader`, `StatInline`,
`FilterBar`, `BulkBar`, `DataTable` yoğunluğu, `StatusBadge`, `EmptyState`) önce kabukla birlikte yapılır, sonra sayfalar.
