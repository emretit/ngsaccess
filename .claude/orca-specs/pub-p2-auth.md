# Görev: Oturumsuz sayfalar P2 — `AuthShell` + `StatusScreen` + 8 giriş/durum ekranı (V2)

## Hedef (test edilebilir)
`/login`, `/register`, `/verify-email`, `/user-setup`, `/admin-setup`, `/employee-setup`, `/check-in` ve 404 ekranı
`docs/ui-scan/public/directions/V2/{login,register,status}.html` mockup'larıyla yan yana bakıldığında aynı düzende olsun;
mevcut akış davranışı (giriş, kayıt, doğrulama, davet, kurulum, QR check-in) değişmeden çalışsın; kapılar yeşil.

## Spec kaynakları (önce oku)
1. `docs/ui-scan/public/DESIGN_PUBLIC.md` — token, tipografi, `AuthShell`/`StatusScreen` prop'ları, logo kullanımı, TÜM metinler (kelimesi kelimesine kullan).
2. `docs/ui-scan/public/directions/V2/{login,register,status}.html` + PNG'leri — görsel hedef.
3. `docs/ui-scan/public/AUDIT.md` — bu işin kapattığı bulgular: P-11 (giriş/kayıt sahte panel), P-12 (marka adı), P-14 (mobil giriş),
   P-16 (durum ekranları), P-17 (kopya panel), P-23 (kayıt notu), P-30 (çift uyarı), P-31 (doğrulama düğmesi + şifremi unuttum), P-33 (h1 + başlık).
4. Uygulama içi dil: `docs/ui-scan/DESIGN_DIRECTION.md` (A2 token'ları `src/index.css`'te zaten var).

## Koordinatörün hazırladığı ortak zemin (değiştirme, kullan)
- Public sayfalar HER ZAMAN açık tema: `.dark` sınıfı artık yalnız uygulama kabuğunda uygulanıyor (`src/components/Layout.tsx` → `useDarkMode()`, kabuktan çıkınca kaldırılır).
  Public bileşenlerde `dark:` varyantı YAZMA; DESIGN_PUBLIC §Token'lar "açık tema" kuralı böyle karşılandı.
- `src/index.css`'te `--public-max/--public-gutter/--public-section/--public-hero-overlap/--public-form-max/--public-status-max/--public-shot-shadow` var
  (≤600px mobil değerleriyle). Kullanım: `max-w-[var(--public-max)]`, `px-[var(--public-gutter)]`, `shadow-[var(--public-shot-shadow)]`.
- Renk yardımcıları (Tailwind): `bg-canvas`, `bg-surface`, `bg-subtle`, `border-line`, `border-control`, `text-text`, `bg-side-bg`, `text-side-text`, `text-side-muted`,
  `outline-side-indicator`, `bg-primary`, `hover:bg-primary-hover`, `text-muted-foreground`, `text-danger`, `bg-danger-bg`, `text-success`. HEX yazma.
- `src/hooks/usePageTitle.ts` hazır; başlıklar DESIGN_PUBLIC §Akış kuralları tablosundaki metinler ("Giriş yap" → "Giriş yap · NGS Plus" hook ekler).
- Display font EKLENMEZ; sistem fontu (DESIGN_PUBLIC `--public-display`).

## Yapılacaklar
1. `src/components/public/AuthShell.tsx`: sol form sütunu (logo → `/`, h1, açıklama, children, alt bağlantılar) + sağ düz
   `--side-bg` marka paneli (DESIGN_PUBLIC'teki içerik/ürün görseli `public/marketing/*.webp`, `<img>` + `srcset` + `alt`); `lg` altı tek sütun,
   panel gizli, form ekranın üst üçte birinde başlar. Giriş ve Kayıt'taki ~70 satırlık kopya paneller silinir.
2. `src/components/public/StatusScreen.tsx`: logo + durum ikonu (lucide) + h1 + açıklama + birincil/ikincil eylem + opsiyonel children
   (ör. yeniden gönderme formu). `tone: 'loading' | 'success' | 'error' | 'info'`; yükleniyor `role="status"`. Mevcut
   `src/components/shared/{ErrorState,SectionSkeleton}.tsx` DEĞİŞMEZ (uygulama içinde kullanılıyor); public ekranlar artık StatusScreen kullanır.
3. Sayfalar (mantığı koru, yalnız sunumu ve listelenen hataları değiştir):
   - `Login.tsx`: AuthShell; **P-30** `?confirmEmail=true` geldiğinde TEK uyarı kutusu (kayıt sonrası metin + yeniden gönder düğmesi);
     **P-31** formun üstündeki her zaman görünen "Doğrulama bağlantısı iste" düğmesi kalkar — yeniden gönderme yalnız doğrulama
     uyarısı içinde; "Şifremi unuttum" bağlantısı satır içi yardım açar (K4 metni DESIGN_PUBLIC'te). Cooldown/resend/`verificationEmail` davranışı aynı kalır.
   - `Register.tsx`: AuthShell; ad + soyad masaüstünde yan yana; şifre ipucu; formun altında K5 kişisel veri notu.
   - `VerifyEmail.tsx`, `UserSetup.tsx`, `AdminSetup.tsx`, `EmployeeSetup.tsx`, `CheckIn.tsx`, `NotFound.tsx`: tüm durum dalları
     StatusScreen (form dalları AuthShell ya da StatusScreen+children — mockup'a göre). Her ekranda tek h1. `CheckIn` mobil öncelikli:
     büyük ikon, kişi adı + İstanbul saati, hata dalında "yeni QR kodu açıp tekrar tarayın". `UserSetup`/`AdminSetup` tamamlandı
     ekranları biçimli StatusScreen (bugün çıplak `<h1>`).
   - Her sayfa `usePageTitle('<başlık>')` çağırır (`src/hooks/usePageTitle.ts` hazır, değiştirme).
4. Logo: `src/components/ui/logo.tsx`'i DEĞİŞTİRME (landing worker'ının dosyası). Mevcut prop'larla kullan:
   `<Logo variant="compact" tone="dark" | "light" size="md" />`; bordo zeminde `tone="light"`.
5. Testler: `src/components/public/AuthShell.test.tsx`, `StatusScreen.test.tsx` + `src/pages/Login.test.tsx` en az:
   (a) `?confirmEmail=true` → tek `MailCheck` uyarısı/tek "Doğrulama bağlantısını tekrar iste" düğmesi, (b) "Şifremi unuttum" yardım metnini açar,
   (c) her StatusScreen'de tek h1. Mevcut test kalıpları için `src/components/shared/PaginationBar.test.tsx` ve `src/components/auth/registrationFlow.test.ts`'e bak.

## Ownership (YALNIZ bunlar)
`src/components/public/{AuthShell,StatusScreen}.tsx` (+ `.test.tsx`), `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}.tsx`, `src/pages/Login.test.tsx`.
Paralel çalışan landing worker'ı `src/components/public/{PublicHeader,PublicFooter,Section,ProductShot}.tsx`, `src/components/{landing,demo}/**`,
`src/pages/{LandingPage,DemoRequest}.tsx`, `src/components/ui/logo.tsx`, `src/App.tsx`'in sahibi — onlara yazma. `ProductShot` sana gerekirse kendi `<img>`'ini yaz.

## Kapsam dışı
`src/components/auth/AuthProvider.tsx`, `registrationFlow.ts`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `convex/**`, `mobile/**`.
Çalışma ağacında başka oturumların commit'siz dosyaları var (mobile/**, src/components/leaves/**, employees/**, admin/**, PaginationBar vb.): DOKUNMA.
Bir token eksikse `src/index.css`'e yazma — rapora "token gerekli: …" diye yaz, koordinatör ekler.

## Kurallar
React 19 + Vite + Tailwind 4 + shadcn/ui. `any`/`as any` yasak (eslint error); `!` yerine optional chaining + erken return.
Kullanıcıya görünen metin Türkçe. A2 yasakları: gradyan, glow, blur daire, renkli ikon kutusu, kart içinde kart, rounded-2xl her yerde, gölge (ürün görseli hariç), emoji, BÜYÜK HARF etiket.
Hareket yok ya da `motion-reduce:` ile kapanan tek CSS geçiş; framer-motion KULLANMA.

## YASAK
commit / push / deploy · `npx convex …` · canlı DB okuma/yazma (Convex/Supabase MCP dahil) · arka planda açık bırakılan sunucu.
Gerçek hesap oluşturan/giriş yapan/QR token tüketen istek atma (yerel ekran kontrolünde formları GÖNDERME).

## Kapılar (kendin koş, sonuçları rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata.
2. `node_modules/.bin/eslint src/pages src/components/public` → 0 hata.
3. `node_modules/.bin/vitest run src/components/public src/pages src/components/auth` → yeşil.
4. Yerel sunucu (`http://localhost:8081` açıksa onu kullan; değilse `npx vite --port 5199` başlat, işin sonunda KAPAT): 8 rota × 1440/390
   Playwright ekran görüntüsü → `/tmp/pub-p2/`; her rotada h1 sayısı 1, yatay taşma yok, konsol hatası 0. Kullanılacak yollar: `/login`, `/login?confirmEmail=true`,
   `/register`, `/verify-email`, `/user-setup`, `/admin-setup`, `/employee-setup`, `/check-in`, `/olmayan-sayfa`. Playwright: `require('/Users/emreaydin/pafta/node_modules/playwright')`.
5. `git status --porcelain` → senin değiştirdiğin dosyalar yalnız Ownership listesinde.

## Rapor
`worker_done` özetinde ≤10 satır, file:line ile: değişen dosyalar, kapatılan P-xx'ler, kapı sonuçları, eksik token / açık sorular.
