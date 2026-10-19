# Görev: Oturumsuz sayfalar — V2 "Bordo sahne" tasarım dili + mockup'lar + ürün görselleri

## Hedef (test edilebilir)
`docs/ui-scan/public/DESIGN_PUBLIC.md` + `docs/ui-scan/public/directions/V2/*.html` (+ 1440/390 PNG'leri) +
`public/marketing/*.webp` üretilmiş olsun; iki implementasyon worker'ı (giriş/durum ekranları ve landing) bu çıktıları
tek spec olarak kullanıp kodu yazabilsin. Metinler son hal (Türkçe), implementasyon kelimesi kelimesine kopyalayacak.

## Bağlam (önce oku)
Repo: /Users/emreaydin/ngsaccess — React 19 + Vite + Tailwind 4 + shadcn/ui; backend Convex. Erişim kontrol + PDKS SaaS'ı
"NGS Plus"; kullanıcı Türk şirket yöneticileri/İK.
1. `docs/ui-scan/public/AUDIT.md` — public sayfaların bulguları (P-01…P-34). Hepsini tasarımda çöz.
2. `docs/ui-scan/public/PLAN.md` — §Tasarım yönleri (V2 seçildi), §Landing bölüm sırası, §Kararlar (aşağıda sabitlendi).
3. `docs/ui-scan/DESIGN_DIRECTION.md` — uygulama içi A2 dili: token'lar, yasaklar. Public sayfalar AYNI token ailesini kullanır.
4. Mevcut ekranlar: `docs/ui-scan/public/current/*.png`; mevcut kod: `src/pages/{LandingPage,Login,Register,VerifyEmail,CheckIn,DemoRequest,UserSetup,AdminSetup,EmployeeSetup,NotFound}.tsx`, `src/components/{landing,demo}/**`, `src/components/shared/{FormFieldWrapper,PasswordField,ErrorState,SectionSkeleton}.tsx`, `src/components/ui/logo.tsx`, `public/logo.svg`, `src/index.css`.
5. Uygulama içi A2 mockup'ları (ürün görseli kaynağı): `docs/ui-scan/pages/{01-ana-sayfa,05-gecis-kontrol,07-canli-izleme,08-pdks-kayitlari,09-vardiyalar,10-izinler}/mockup.html`.

## Sabit kararlar (kullanıcı onayladı)
- **Yön V2 "Bordo sahne":** hero bandı ve giriş/kayıt sağ paneli DÜZ `--side-bg #551919` (gradyan yok), açık metin
  `--side-text #f6ecea` / `--side-muted #d8bfbb`; gerçek ürün ekranı hero'dan beyaz/`--canvas` zemine taşar. Geri kalan
  bölümler sakin açık zemin (V1): büyük sıkı tipografi, 1px `--line` ayırıcı, bordo yalnız CTA + vurgu. Son CTA düz bordo bant.
- A2 yasakları geçerli: renkli ikon kutusu + kart tekrarı, kart içinde kart, her yüzeyde gölge, rounded-2xl her yerde,
  gradyan/glow/glass/bulanık daire/nokta deseni, renkli kenarlık, emoji, BÜYÜK HARF etiket, ✨ rozet, bounce/stagger,
  hover'da zıplayan kart. İzin: ürün görseli çerçevesinde TEK hafif gölge; büyük tipografi; ince 1px çerçeve.
- Hareket: içerik varsayılan GÖRÜNÜR (opacity 0 başlangıç yok); en fazla hero'da tek CSS fade, `prefers-reduced-motion`'da kapalı.
- **K1** `/demo-request` → `/register`'a yönlendirilecek (mockup gerekmez). Satış iletişimi landing'de mailto/tel bandı.
- **K2** Mobil uygulama: büyük bölüm ve sahte mağaza rozetleri KALKAR; yalnız tek satır not ("Mobil uygulama yakında…" — `marketingFacts.mobileDescription`).
- **K3** Ürün görselleri: yukarıdaki A2 mockup.html'lerinden Playwright ile çekilir (DB'ye dokunma).
- **K4** Giriş ekranında "Şifremi unuttum" bağlantısı → satır içi yardım metni açar: şifreyi yöneticinin sıfırlayabileceği + `info@ngsplus.app`. Gerçek sıfırlama akışı YOK.
- **K5** Yasal sayfa YOK. Kayıt formunun altında kısa not: kişisel verilerin hesap oluşturmak için işlendiği + aydınlatma
  metni talebi için `info@ngsplus.app`. Başlıklar sistem fontu (A2). Ayrıca `landing-font.html` varyantında başlıklar için
  tek bir display font göster (Google Fonts'tan yalnız mockup'ta; önerdiğin fontu ve woff2 boyutunu DESIGN_PUBLIC.md'ye yaz).
- Marka adı her yerde "NGS Plus". "NGS ACCESS", "P" harfli sahte logo, "PDKS Sistemine Giriş" gibi jenerik başlık kalkar.
  Logo: `public/logo.svg` dosyasını DEĞİŞTİRME; bordo zemin ve açık zemin için logo kullanımını (renk/boyut, "Plus" kontrastı ≥4,5:1) DESIGN_PUBLIC.md'de tanımla.

## İçerik dürüstlüğü (zorunlu)
Yalnız kodda karşılığı olan özellik yazılır: QR ile giriş (web check-in), kart okuyucu (Hikvision + IDE Smart), geçiş
kuralları/kapı yetkileri, canlı izleme, PDKS kayıtları + Excel/PDF dışa aktarma, vardiya, izin, ziyaretçi, denetim kaydı,
çoklu proje + roller, PDKS'de yapay zekâ sohbet asistanı (`src/components/pdks/PDKSAiChat.tsx`). Emin olmadığını kodda grep'le doğrula.
YASAK iddialar: Excel'den personel içe aktarma, push bildirim, çevrimdışı çalışma, biyometrik PDKS (KVKK 2026/921), deneme
süresi/fiyat/müşteri sayısı/referans, "Türkiye'nin …", "IT ekibine gerek yok", "tek satır kod", "KVKK uyumlu" garantisi.
Metin kaynağı `src/components/landing/marketingFacts.ts`; yeni metinleri DESIGN_PUBLIC.md'de "Metin" bölümüne yaz.

## Teslimatlar (Ownership — YALNIZ bunlara yaz)
1. `docs/ui-scan/public/DESIGN_PUBLIC.md`: token ekleri (A2'ye eklenen, CSS değişkeni adıyla), pazarlama tipografi ölçeği
   (masaüstü/mobil px), boşluk ritmi, bölüm kalıpları, bileşen envanteri + prop'lar (`PublicHeader`, `PublicFooter`,
   `Section`, `ProductShot`, `AuthShell`, `StatusScreen`), logo kullanımı, hareket kuralı, yasaklar, tüm Türkçe metinler.
2. `docs/ui-scan/public/directions/V2/`: tek dosyalı (inline CSS, harici JS yok) HTML'ler:
   `landing.html` (tam sayfa, PLAN.md §Landing sırası) · `landing-font.html` · `login.html` (normal + hata + "doğrulama
   bekliyor" durumu + şifremi unuttum açık) · `register.html` · `status.html` (tek sayfada ızgara: verify-email yükleniyor/
   başarı/hata+yeniden gönder; user-setup geçersiz/form/tamam; admin-setup zaten kurulu/form; employee-setup geçersiz/form/
   başarı; check-in yükleniyor/başarı/hata — mobil öncelikli; 404). Her HTML için `*-1440.png` ve `*-390.png` (tam sayfa).
3. `public/marketing/`: 4-6 ürün görseli `.webp` (1600 ve 800 px genişlik çifti; hero ≤150 KB): Ana Sayfa, Canlı İzleme,
   PDKS Kayıtları, Geçiş Kontrol, Vardiya/İzin. Kaynak mockup'ları 1440 genişlikte çek, gerekiyorsa kırp. Araçlar:
   `require('/Users/emreaydin/pafta/node_modules/playwright')`, `require('/Users/emreaydin/pafta/node_modules/sharp')`.
   Görsel üretim betiğini `/tmp/pub-p1/` altına koy (repoya değil).

## Kapsam dışı
`src/**`, `convex/**`, `mobile/**`, `index.html`, `public/logo.svg` ve diğer mevcut dosyalar. Kod yazma — yalnız tasarım çıktısı.
Çalışma ağacında başka oturumların commit'siz dosyaları var (mobile/**, src/components/leaves/**, PaginationBar vb.): DOKUNMA.

## YASAK
commit / push / deploy · `npx convex …` · canlı DB okuma/yazma (Convex/Supabase MCP dahil) · arka planda açık bırakılan sunucu.

## Kapılar (kendin koş, sonuçlarını rapora yaz)
1. 5 HTML + her biri için 1440 ve 390 PNG mevcut; 390'da yatay taşma yok (`scrollWidth <= innerWidth` Playwright ile).
2. HTML'lerde grep: `gradient|blur\(|backdrop|✨|text-transform:\s*uppercase` → 0 (ürün görseli gölgesi hariç `box-shadow` en fazla 1 tanım).
3. `public/marketing/*.webp` boyutları listesi; hero görseli ≤150 KB.
4. Metin taraması: yasak iddiaların hiçbiri HTML'lerde yok (`Excel ile içe|push|çevrimdışı|biyometr|14 gün|ücretsiz deneme`).
5. `git status --porcelain` → yalnız Ownership yolları senden.

## Rapor
`worker_done` özetinde ≤10 satır: üretilen dosyalar, seçtiğin display font + boyut, ürün görseli boyutları, kapı sonuçları, açık sorular.
