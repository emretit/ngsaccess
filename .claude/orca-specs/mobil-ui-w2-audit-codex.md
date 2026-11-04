# Mobil UI audit — W2: Codex bağımsız tasarım/UX auditi (salt okuma + rapor)

## Hedef (test edilebilir)
`docs/mobile-ui-audit/AUDIT_CODEX.md` dosyası, NGS Plus Flutter uygulamasının her ekranı için kanıtlı (PNG adı +
lib/...:satır) UI/UX bulgularını önceliklendirilmiş olarak ve "modern UI" için somut yeniden tasarım önerisiyle verir.
Kod DEĞİŞMEZ.

## Bağlam
- Uygulama `mobile/` (Flutter, Material 3, provider, go_router, TR/EN). Kullanıcı: sahadaki çalışan (PDKS/geçiş);
  günde birkaç kez açar: QR ile giriş/çıkış, kapı açma, geçmiş, izin/düzeltme talebi, ziyaretçi kaydı, profil.
- Mevcut görünüm: `docs/mobile-ui-audit/current/*.png` + `INDEX.md` (390×844, açık/koyu, dolu/boş/hata/yükleniyor).
  HER PNG'yi görüntü aracıyla (view_image) aç ve bak; bulguyu görüntüye dayandır.
- Tema `mobile/lib/theme/app_theme.dart`, ortak bileşenler `mobile/lib/widgets/**`, `lib/core/spacing.dart`, `breakpoints.dart`.
- Web tarafı yeni tasarım dili (A2, canlı): `docs/ui-scan/DESIGN_DIRECTION.md` — sakin nötr zemin + bordo
  (#7a1f1f) yalnız birincil eylem/odak/seçimde, gölgesiz, 1px ayırıcı, tipografiyle hiyerarşi. Mobil bununla aynı
  ürün ailesinde görünmeli ama mobil-yerel olmalı (dokunma hedefi, tek el kullanım, alt gezinme, sheet'ler).
- Önceki işlev/güvenlik auditi (UI dışı): `docs/mobile-audit/` — özellikle `modules/10-design-accessibility.md`.
  Oradaki bulguları tekrar etme; yalnız hâlâ geçerli olan UI bulgularını kısa referansla an.
- Ürün kuralları: kullanıcıya gösterilen tüm saatler Türkiye saati; sunucu hata metni asla gösterilmez (yerel l10n).

## İncele (her ekran için)
1. Hiyerarşi: ekranın 1 numaralı işi ilk bakışta mı? (ör. Ana Sayfa: bugünkü durum + QR/kapı aç)
2. Görsel dil: renk/kontrast (WCAG AA hesapla), tipografi ölçeği, boşluk ritmi, kart/gölge kullanımı, ikon tutarlılığı,
   bordo kullanımının dozu, koyu tema kalitesi.
3. Durumlar: boş / yükleniyor (iskelet mi spinner mı) / hata (sebep + sonraki adım) / çevrimdışı.
4. Etkileşim: dokunma hedefi ≥48dp, başparmak erişimi, birincil eylemin yeri, geri bildirim (haptic/snackbar), onay
   diyalogları, form doğrulama ve klavye davranışı, uzun liste performansı.
5. Erişilebilirlik: Semantics etiketleri, text scale 1.3'te taşma (`*_textscale130_*`), renk dışı durum ipucu.
6. Tutarlılık: aynı kavramın ekranlar arası farklı bileşenle çizilmesi (durum rozeti, kart, başlık, boş durum).
7. "AI yapımı/şablon" izleri: gereksiz gradyan, rastgele gölge, emoji, aşırı kart, anlamsız ikon, tekrarlı metin.

## Çıktı: `docs/mobile-ui-audit/AUDIT_CODEX.md`
1. Özet (≤8 satır): genel durum + en büyük 3 sorun.
2. Bulgular tablosu: ID (`CX-<ekran>-NN`) · öncelik (Y=yüksek: işi zorlaştırır/erişilemez; O=orta; D=düşük/kozmetik) ·
   ekran · gözlem · kanıt (PNG adı + `lib/...:satır`) · öneri (1 cümle).
3. Ortak kök nedenler (tasarım sistemi eksikleri): token, bileşen, kalıp listesi.
4. Önerilen mobil tasarım sistemi: renk token'ları (açık+koyu, hex + kontrast oranı), tipografi ölçeği (sp), spacing,
   radius, elevation politikası, bileşen envanteri (AppScaffold/başlık, durum rozeti, liste satırı, boş durum,
   iskelet, birincil eylem butonu, bottom sheet, segment kontrol, alt gezinme) — her biri için Flutter karşılığı
   (ThemeExtension / widget adı) ve hangi mevcut widget'ın yerini alacağı.
5. Ekran bazlı yeniden tasarım önerisi: her ekran için 4-8 maddelik "yeni düzen" (yukarıdan aşağı bölümler).
6. Uygulama sırası önerisi (dalgalar) + dosya sahipliği (iki worker aynı dosyaya yazmayacak şekilde bölünmüş).

Ayrıca `docs/mobile-ui-audit/mockups/codex-home.html` — Ana Sayfa için önerdiğin yeni düzenin 390px statik HTML
mockup'ı (tek dosya, harici kaynak yok, sistem fontu, gerçekçi Türkçe veri). Sadece bir ekran; diğerleri sonra.

## Ownership (yalnız bunlara yaz)
- `docs/mobile-ui-audit/AUDIT_CODEX.md`, `docs/mobile-ui-audit/mockups/codex-home.html`

## Kapsam dışı
- `mobile/**` kodunda hiçbir değişiklik yok (salt okuma). Backend/convex okuması yalnız veri anlamı için gerekirse.
- `docs/mobile-ui-audit/AUDIT_CLAUDE.md` başka denetçinin dosyasıdır — OKUMA, ona bakma (bağımsız audit).

## Kapılar
- Raporda her Y/O bulgunun PNG + satır kanıtı var; kontrast oranları hesaplanmış (formül ya da araç belirt).
- `git status --short -- mobile` boş (kod değişmedi).

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Çalışma ağacında başka oturumların `convex/**`, `src/**` değişiklikleri var; DOKUNMA.

## Rapor (worker_done, ≤10 satır)
Bulgu sayısı (Y/O/D) · en büyük 3 sorun · önerilen ana yön 1 cümle · mockup yolu · file:line.
