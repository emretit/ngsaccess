# Mobil UI — W3: 3 tasarım yönü mockup'ı (karar için)

## Hedef (test edilebilir)
`docs/mobile-ui-audit/directions/index.html` tek sayfada 3 tasarım yönünü (A, B, C) yan yana telefon çerçeveleriyle
gösterir; her yön için aynı 4 ekran: Ana Sayfa (açık), Geçmiş-Kayıtlar (açık), QR Kodum (açık), Ana Sayfa (koyu).
Kullanıcı (Emre) bu sayfaya bakıp bir yön seçecek. Kod (mobile/**) DEĞİŞMEZ.

## Bağlam
- Kendi auditin: `docs/mobile-ui-audit/AUDIT_CODEX.md` (token tablosu §5, ekran düzenleri §6) ve
  `docs/mobile-ui-audit/mockups/codex-home.html` — bu, Yön A'nın Ana Sayfası olarak temel alınır.
- İkinci audit (artık okuyabilirsin): `docs/mobile-ui-audit/AUDIT_CLAUDE.md`. İki auditin ortak kararları HER yönde geçerli:
  tek bordo birincil eylem (#7a1f1f), pembe container zeminleri yok, standart 5 eşit alt gezinme (yüzen hap + büyük
  QR dairesi yok, içerik nav'ın altına girmez), "Günün Sözü" yok, tek durum rozeti, tek tarih biçimi ("9–11 Kas",
  "Bugün 10:30"), geliştirici dili yok, sistem fontu, "QR kod tara" doğrudan tarama moduna gider.
- Mevcut görünüm: `docs/mobile-ui-audit/current/*.png`. Web A2: `docs/ui-scan/DESIGN_DIRECTION.md`.
- Veri (hepsinde aynı, gerçekçi Türkçe): Ayşe Yılmaz · NGS Teknoloji — Merkez · 4 Kasım Çarşamba · İçeride ·
  bugün giriş 08:52 (Ana Giriş), öğle çıkış 12:31 / giriş 13:14 (Otopark Turnike) · son güncelleme 13:20 ·
  kapı "Ana Giriş" · 1 bekleyen talep · geçmişte 3 gün (Bugün, Dün, 2 Kas Pzt) her gün 2-4 hareket, biri "Erişim reddedildi" ·
  QR kalan süre 44 sn.

## Yönler (her biri ayırt edici olmalı; üçü de "modern" ve üretilebilir Flutter Material 3 ile)
- **A — Sakin (A2 Mobil):** web A2'nin mobil karşılığı. Nötr canvas, gölgesiz, 1px çizgiler, tipografiyle hiyerarşi,
  bordo yalnız birincil eylem/seçim. `codex-home.html` temel alınır (gerekirse iyileştir).
- **B — Marka bandı:** Ana Sayfa üstünde bordo (#7a1f1f→#551919 düz ya da çok hafif ton) bant; içinde selam + tarih;
  bandın üstüne binen beyaz "Bugün" durum kartı (radius 16, çok hafif gölge ya da 1px çizgi). Diğer ekranlarda başlık
  nötr; bordo bant yalnız Ana Sayfa'da kimlik verir. Banka uygulaması netliği.
- **C — Canlı pano (bento):** Ana Sayfa'da büyük "Bugün" karosu: canlı "içeride geçen süre" (ör. 4 sa 28 dk) +
  günün zaman çizgisi (giriş–çıkış blokları yatay bar); altında 2×2 eşit küçük karo (Kapıyı aç, QR, Taleplerim 1,
  Ziyaretçi). Yumuşak nötr zemin (#f4f4f2), beyaz karolar radius 20, gölge yok, ince kontur. iOS Widget hissi.
- Koyu tema her yönde: canvas #181817, surface #20201e, text #f3f3f0, accent #e7b3ad (AUDIT_CODEX §5).

## Ekran içeriği (her yönde aynı bilgi, farklı sunum)
1. Ana Sayfa: başlık/selam · Bugün durumu (rozet + giriş/çıkış saatleri + güncelleme) · "QR kod tara" birincil ·
   Kapıyı aç (Ana Giriş) · Taleplerim (1 bekleyen) · Ziyaretçi davet et · alt gezinme (Ana Sayfa seçili).
2. Geçmiş-Kayıtlar: başlık · segment (Kayıtlar / Takvim / Özet) · filtre girişi · gün başlıklı gruplu liste (saat solda
   tabular, yön ikonu, kapı adı, reddedilen satır danger tonunda metin+ikonla) · alt gezinme (Geçmiş seçili).
3. QR Kodum: başlık · segment (QR Kodum / Tara) · QR (statik desen yeterli, SVG/CSS ile çiz, harici kaynak yok) ·
   kalan süre halkası/çubuğu "44 sn" · tek satır talimat "Kodu okuyucuya gösterin" · Yenile butonu görünür alanda,
   nav'ın altında kalmaz · alt gezinme (QR seçili).
4. Ana Sayfa koyu.

## Dosyalar
- `docs/mobile-ui-audit/directions/A/{home,history,qr,home-dark}.html`, aynısı `B/`, `C/` — her biri 390×844,
  tek dosya, harici kaynak (font/CDN/resim) YOK, sistem fontu, iOS durum çubuğu + home indicator taklidi.
- `docs/mobile-ui-audit/directions/index.html`: 3 satır (A/B/C) × 4 iframe (390×844, %50 ölçekli olabilir) +
  her yönün altında 3 maddelik "artı / eksi / Flutter maliyeti (S/M/L)".
- `docs/mobile-ui-audit/directions/NOTES.md`: her yön için token farkları (renk, radius, elevation, tipografi) ve
  hangi ortak bileşenlerin değiştiği; önerdiğin yön + 1 cümle gerekçe.
- Görsel kontrol: Playwright/Chromium ile her HTML'nin 390×844 ekran görüntüsünü al
  `docs/mobile-ui-audit/directions/_shots/<yön>-<ekran>.png` ve en az 6'sını view_image ile kendin aç; yatay taşma 0.

## Ownership (yalnız bunlara yaz)
- `docs/mobile-ui-audit/directions/**`; `docs/mobile-ui-audit/mockups/codex-home.html` (gerekirse güncelle).

## Kapsam dışı
- `mobile/**`, `src/**`, `convex/**` değişmez. Yeni npm paketi kurma (Playwright: `/Users/emreaydin/pafta/node_modules/playwright` mevcut).

## Kapılar
- 12 HTML + index + NOTES + 12 PNG mevcut; her PNG 780×1688 (DPR2) ve yatay kaydırma yok.
- `git diff --stat -- mobile` boş.

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Çalışma ağacında başka oturumların `convex/**`, `src/**` değişiklikleri ve untracked `mobile/screenshot_test/` var; DOKUNMA.

## Rapor (worker_done, ≤10 satır)
Dosya listesi · önerdiğin yön + gerekçe · her yön için Flutter maliyeti · görsel kontrol sonucu.
