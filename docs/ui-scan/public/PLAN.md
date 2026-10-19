# Oturumsuz sayfalar — yeni arayüz planı (2026-10-19)

Bulgular: `AUDIT.md` (P-01…P-34) · ekranlar: `current/` · uygulama içi dil: `../DESIGN_DIRECTION.md` (A2).
Koordinatör = Claude oturumu; uygulama = Orca worker'ları (`~/.claude/rules/agents.md`). Commit/push koordinatörde, onayla.

## Checklist

### P0 — Ön koşul (~30 dk; kullanıcı + koordinatör)
- [x] Audit: 10 rota kod + 1440/390 ekran turu → `AUDIT.md`
- [x] **P-01 teşhis + karar:** Netlify repoya hiç bağlı değil (canlı ~20 Haziran sürümü). Emre 2026-10-19: bağlanmayacak, web deploy push'tan ayrı ve elle; deploy sonrası canlı CSS'te `side-bg` kontrolü
- [x] `index.html`: `gptengineer.js` kaldırıldı (P-02), description/og/twitter metinleri `marketingFacts` ile aynı, "KVKK uyumlu" anahtar kelimesi çıktı (P-03) — 2026-10-19
- [x] Kararlar K1–K5: kullanıcı "önerilerle devam" dedi (2026-10-19) + yön V2 doğrudan seçildi (3 yön mockup'ı atlandı)
- [x] `src/hooks/usePageTitle.ts` (koordinatör; iki worker'ın ortak bağımlılığı)
- [x] Orca run `run_66617f5ea387`; spec'ler `.claude/orca-specs/pub-p{1-design,2-auth,3-landing}.md`

### P1 — Tasarım yönü (~3 sa worker + kullanıcı seçimi)
- [x] W-design (Codex astra high, task_45d99546d3a7) BİTTİ 2026-10-19 10:55 TR: `DESIGN_PUBLIC.md` + `directions/V2/{landing,landing-font,login,register,status}.html` (+1440/390 PNG) + `public/marketing/*.webp` (6 ekran, en büyük 56 KB); display font önerisi Plus Jakarta Sans (49 KB) — uygulanmıyor, sistem fontu
- [x] Koordinatör kapısı: yasak desen 0 · yasak iddia 0 · sahiplik dışı dosya 0
- [x] Koordinatör ortak zemin: `.dark` yalnız uygulama kabuğunda (`Layout.tsx` → `useDarkMode`, kabuktan çıkınca kalkar) = public hep açık tema; `--public-*` token'ları `src/index.css`'te; tsc 0

### P2 — Ortak bileşenler + giriş/durum ekranları (~10-13 sa worker) — BİTTİ 2026-10-19 11:08 TR task_4b9414ed2c1d: tsc 0 · eslint 0 · vitest 20/20 · 18 ekran tek h1/taşma 0 (koordinatör doğruladı)
- [x] `src/components/public/`: `PublicHeader`, `PublicFooter`, `AuthShell`, `StatusScreen`, `ProductShot`, `Section`
- [x] Hareket: içerik varsayılan görünür, giriş efekti yalnız CSS + `prefers-reduced-motion`; landing'den framer-motion kalkar (P-13)
- [x] Tek logo bileşeni + tek marka adı "NGS Plus"; "Plus" kontrastı ≥4,5:1 (P-12); her rota kendi `document.title`'ı (P-33)
- [x] Ürün görselleri (K3) → `public/marketing/*.webp` (srcset, ≤150 KB LCP)
- [x] 8 rota yeni kabukta: `/login` (çift uyarı P-30, doğrulama düğmesi yalnız gerektiğinde, K4) · `/register` (K5 aydınlatma bağlantısı) · `/verify-email` · `/user-setup` · `/admin-setup` · `/employee-setup` · `/check-in` (mobil öncelikli) · 404 — hepsinde h1

### P3 — Landing + demo + yasal (~10-14 sa worker) — BİTTİ 2026-10-19 11:06 TR task_19b0d4348168: tsc 0 · eslint 0 · vitest 6/6 · ekran mockup'la birebir; P3b okunurluk task_f6ac42d531db BİTTİ 11:09 (piksel farkı 0, koordinatör kapısı yeşil)
- [x] Landing bölüm sırası (aşağıda §Landing) — sekme yok, ikon kutusu yok, sahte kart yok, gerçek ürün ekranı var
- [x] İçerik temizliği: P-20/21/22 iddiaları çıkar; tek kaynak `marketingFacts.ts`; mobil bölüm K2'ye göre
- [x] `/demo-request` K1'e göre; ölü kod sil: `StatsSection`, `DemoStats`, `DemoFeatures`, `HeroMockup`, giriş/kayıt kopya paneli (P-17)
- [x] ~~Yasal rotalar `/kvkk`, `/gizlilik`, `/cerez`~~ — K5: yayımlanmış metin yok → rota açılmadı; kayıt formunda kısa not + `info@ngsplus.app` (P-23)

### P4 — Kalite kapısı + yayın (detay 2026-10-19 11:20 TR; duvar saati ~2,5-3 sa)
Akış: W0 (bitti) → W1 paralel salt-okur ~60 dk → W2 triage ~10 dk → W3 düzeltme ~45-90 dk → W4 tam kapı ~20 dk → W5 commit/push (Emre).
Kural: okuyan/denetleyen worker, yazan worker'dan ÖNCE; yazan Codex → denetçi Claude. Kapılar worker'ın "yeşil"ine değil koordinatör koşumuna dayanır.

#### W0 — Hazırlık (koordinatör) — BİTTİ
- [x] P3b kapıları koordinatörde: tsc 0 · eslint 0 · vitest 18/18; worker release + ack
- [x] P4a: auth dosyalarına prettier (`--single-quote --print-width 110`; 13 dosya, 966 → 1681 satır) → tsc 0 · eslint 0 · vitest 18/18

#### W1 — Paralel, salt-okur (~60 dk) — spec'ler `.claude/orca-specs/pub-p4-{qa,review}.md`
- [x] **W-qa** BİTTİ (task_302bcb9ddb58; 168 ekran, 10 bulgu, Lighthouse mobil 66/64) Codex `gpt-6.1-sol medium` → `/tmp/pub-p4/QA.md` (Q-01…):
  10 rota + durum varyantları (mock fixture `/tmp/pub-p2/capture.cjs` genişletilir) × 1440/768/390 · h1=1 / title tablosu / taşma / konsol / kırık görsel ·
  mockup'la yan yana · tema izolasyonu (P-34: dark tercihi + `prefers-color-scheme: dark` → public açık kalır) · reduced-motion · klavye turu ·
  Lighthouse (prod build + `vite preview`) landing perf ≥90 / a11y ≥95, login a11y ≥95 · `dist/` yasak iddia + `gptengineer` taraması
- [x] **W-review** BİTTİ (task_04013f53365b; 11 bulgu, kapılar yeşil) Claude `sonnet medium` → `/tmp/pub-p4/REVIEW.md` (R-01…):
  HEAD ↔ çalışma kopyası davranış korunumu (Login cooldown/verificationEmail/confirmEmail · Register · VerifyEmail token · UserSetup existingAccount ·
  AdminSetup runSetup · EmployeeSetup token · CheckIn success/locationRecorded/belirsiz ağ) · `Layout`+`useDarkMode` (GeneralSettings toggle, PDKS export) ·
  proje kuralları (any, `!`, HEX, `dark:`) · güvenlik (token URL'de, rel=noopener) · test boşlukları · kendi tam kapı koşumu

#### W2 — Triage (koordinatör, ~10 dk)
- [x] QA + REVIEW → `docs/ui-scan/public/P4_FIXES.md` (17 kabul / 4 ret; koordinatör Q-01 `usePublicTheme` + R-07 kaydırma uyguladı): her bulgu kabul / ret (gerekçe) / ürün kararı (→ Emre'ye tek soru)
- [x] Kabul edilenler üç pakete (perf ayrı): spec `.claude/orca-specs/pub-p4-fix-{perf,landing,auth}.md` — eskiden iki pakete: **landing** (`src/components/{landing,public/{PublicHeader,PublicFooter,Section,ProductShot,public.css}}`, `LandingPage`, `logo.tsx`) ve **auth** (`AuthShell`, `StatusScreen`, 8 sayfa)

#### W3 — Düzeltme (Codex `gpt-6.1-sol medium`; ~45-90 dk)
- [x] BİTTİ: perf (manualChunks kaldırıldı + Layout lazy; Lighthouse mobil landing 66→92, login 64→89, ilk JS 2,3 MB→0,48 MB) · landing (5 bulgu) · auth (11 dosya, +17 test; RTL eklenmedi, tarayıcı kanıtı /tmp/pub-p4-fix/auth-browser.cjs). Koordinatör kapısı: tsc 0 · eslint 0 · vitest 1272/1273 (tek kırmızı kapsam dışı `convex/lib/auditLogQuery.test.ts`, KVKK oturumu) · build OK
- [ ] Her worker: bulgu başına file:line düzeltme + eksik test · kapılar (tsc · eslint · vitest · build) · etkilenen rotaları 3 genişlikte yeniden çek

#### W4 — Denetim + tam kapı (~20 dk)
- [x] Claude `sonnet medium` yeniden denetim (task_f8bb969182eb): commit'e engel YOK; koordinatör RR-03 (geri tuşunda kaydırma), RR-06 (skip-link URL'ye #main yazmaz), RR-07 (`<title>` + mutlak og/twitter görseli) düzeltti; RR-01: `Layout` statik import'a döndü (lazy → oturumlu soğuk yüklemede 3 aşamalı yanıp sönme; statik ile Lighthouse mobil landing 90/91 ölçüldü). Ertelenen: RR-02 koyu tema FOUC, RR-04 CheckIn backend metin eşlemesi (backend `code` alanı), RR-05/08/09
- [x] Koordinatör (12:40): tsc 0 · eslint 0 · vitest 1273/1273 · build OK · smoke 4 rota × 1440/390 (dark zorlanmış: h1 1, dark false, taşma 0, skip → MAIN, hata 0) · **commit tek başına**: HEAD worktree + yalnız kapsam → tsc 0 · eslint 0 · vitest 1163/1163 · build OK

#### W5 — Yayın (koordinatör + Emre)
- [x] Commit kapsamı: `.claude/handoff-public-pages.md` §Commit kapsamı; `App.tsx`/`index.css`/`Layout.tsx` diff'i yalnız bizim hunk'lar (11:20'de doğrulandı)
- [x] **Karar:** DAHİL DEĞİL (sahibi ngsaccess-56 sayfa düzenleme oturumu, önce onun commit'i girer — 2026-10-19) — başka oturumun 1'er satırlık `FormFieldWrapper` (`space-y-1.5`) + `input`/`textarea` (`ring-offset-0`) değişiklikleri auth ekranlarını etkiliyor — commit'e dahil mi?
- [x] Commit (Emre onayı) → push (Emre isteyince) → `curl -s https://ngsplus.app/ | grep -o 'assets/index-[^"]*\.css'` → CSS'te `side-bg` var mı
- [x] Commit `77b25ea` + Netlify CLI deploy 13:10 TR (CEO oturumu; `stop_builds: true`, push deploy tetiklemez). Koordinatör doğruladı: canlı CSS `side-bg` 4, Poppins 0, `<title>` yeni, `gptengineer` 0
### P5 — Kalan işler (2026-10-19 13:30 TR başladı)
Akış: A1 audit (2 salt-okur worker, ~45-60 dk) → A2 triage → A3 fix + denetim + kapı → commit (Emre) → Convex deploy / web deploy (ayrı, Emre onayı).
- [x] **A1 audit** BİTTİ: flows Codex astra high task_9f52b601a094/ctx_02bee7f68b76 (SHL-18/21/23/24/26/33/34, RR-04, QA ulaşılamayan dallar) ∥ ui Codex sol medium task_37c9f4ee8a50/ctx_7fb176d05848 (RR-02 koyu tema yanıp sönmesi, login mobil LH 89, canlı LH, RR-05/08/09) → `/tmp/pub-p5/AUDIT-{flows,ui}.md`
- [x] A2 triage → `docs/ui-scan/public/P5_PLAN.md` (NEW-01 güvenlik açığı bulundu; W-qr + W-ui çalışıyor, W-sec Emre kararı bekliyor)
- [ ] A3 fix ∥ → Claude denetim → kapı → commit kapsamı

Devam: `.claude/handoff-public-pages.md`

## Kararlar (kullanıcı)
| # | Soru | Öneri | Alternatif |
|---|---|---|---|
| K1 | `/demo-request` ne olsun? | `/register`'a yönlendir; satış için mailto/tel bandı | Gerçek talep formu: `leads` tablosu + Resend bildirimi (+4-6 sa backend) |
| K2 | Mobil uygulama bölümü | Tek satır "Mobil uygulama yakında" notu; büyük bölüm ve sahte mağaza rozetleri kalkar | Tamamen kaldır / olduğu gibi kalsın |
| K3 | Ürün görselleri nereden? | Faz B mockup HTML'lerinden (`../pages/*/mockup.html`) Playwright ile — DB'ye dokunmaz | Canlıda kurgusal "Demo" projesi (DB yazma, gerçek ekran) |
| K4 | Şifremi unuttum | Şimdi görünür yardım ("Yöneticinize ya da info@ngsplus.app'e yazın") | Gerçek e-posta sıfırlama (Convex Auth reset + Resend, +4-6 sa backend) |
| K5 | Yasal metin + başlık fontu | KVKK aydınlatma metni varsa yayınla; başlıklar sistem fontuyla kalsın, P1'de ayrı font varyantı da gösterilsin | Başlıklar için tek woff2 display font (~40 KB, yeni asset) |

## Tasarım yönleri (P1'de mockup'lanacak)
Ortak zemin: A2 token'ları (`--canvas`, `--text`, `--primary #7a1f1f`, `--side-bg #551919`), gölge/gradyan/glow yok, bordo
yalnız CTA + vurgu + marka yüzeyi. Fark sahnede:
1. **V1 Sakin vitrin** — açık zemin, 56-64px sıkı başlık, gerçek ekran 1px çerçeveli pencere içinde, bölümler 1px çizgiyle
   ayrılır, tek koyu bant son CTA. En düşük risk, uygulamayla birebir.
2. **V2 Bordo sahne (öneri)** — hero ve giriş sağ paneli düz `--side-bg` bordo, açık metin; ürün ekranı hero'dan beyaz zemine
   taşar. Giriş → uygulama geçişinde bordo süreklilik (sidebar ile aynı renk). Gerisi V1.
3. **V3 Kontrol odası** — koyu nötr hero, Canlı İzleme akışından statik satırlar, bordo + amber vurgu. Güvenlik ürünü hissi
   güçlü; açık temalı uygulamaya geçişte kopukluk riski.

## Landing bölüm sırası (P3)
1. Header (logo · 4 bağlantı · Giriş · Hesap oluştur) — 768-1023 arası menü kontrolü
2. Hero: h1 + 1 cümle + 1 birincil CTA + ikincil "Özellikleri incele"; sağda/altta gerçek Ana Sayfa ekranı (mobilde de)
3. Uyumlu donanım şeridi: Hikvision · IDE Smart (metin, logo izni yoksa)
4. Özellik satırları (sekme yerine 4 sıra, ekran + 3 madde, sırayla sol/sağ): Canlı İzleme · PDKS Kayıtları · Geçiş Kontrol · Vardiya ve İzin
5. Nasıl çalışır: 3 numaralı adım, ikon kutusu yok, gerçek adımlar (proje aç → cihaz bağla → kişileri ekle)
6. KVKK ve güvenlik: proje bazlı yetki, denetim kaydı, biyometrik PDKS yok — yalnız kodda karşılığı olan maddeler
7. Plan/iletişim · SSS · son CTA (düz bordo bant) · Footer (yasal bağlantılar K5'e göre)

## Worker dağılımı
| Faz | Worker | Neden |
|---|---|---|
| P1 mockup | Claude `opus high` + `frontend-design` skill | Claude'a özgü skill; tasarım kararı |
| P2, P3 uygulama | Codex `gpt-6.1-sol medium`, 2 paralel (P2 auth ekranları ∥ P3 landing; ortak bileşenler önce, tek worker) | Plan + mockup hazır |
| K1/K4 backend (seçilirse) | Codex `gpt-6-astra high` | Auth/e-posta güvenliği |
| P4 denetim | Claude `sonnet medium` | Yazan denetlemez |

Dosya sahipliği: ortak bileşen worker'ı `src/components/public/**` + `src/components/ui/logo.tsx` + `index.html`;
auth worker `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}.tsx`;
landing worker `src/pages/{LandingPage,DemoRequest}.tsx` + `src/components/{landing,demo}/**`. `AuthProvider` ve `convex/**` kapsam dışı (K1/K4 hariç).

## Süre
Worker toplamı ~25-30 sa; duvar saati P1 ~3 sa + seçim, P2+P3 paralel ~1-1,5 gün, P4 ~2 sa.
