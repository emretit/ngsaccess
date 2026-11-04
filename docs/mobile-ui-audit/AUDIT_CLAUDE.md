# Mobil UI audit — Claude (bağımsız, koordinatör)

2026-11-04. Kaynak: `current/*.png` (74 görüntü, 390×844) + kod okuması. Codex auditinden bağımsız yazıldı.

## Özet
Uygulama işlevsel ama görsel dil dağınık: iki farklı bordo, her yerde pembe tonlu zemin, her öğe ayrı gölgeli kart,
üç ayrı tarih biçimi ve ekranlar arası farklı durum rozetleri. Web A2 diliyle (sakin nötr + bordo yalnız eylemde)
aynı ürün ailesinden görünmüyor. En büyük 3 sorun: (1) soluk birincil buton rengi, (2) içeriği örten ve büyük yazıda
kırılan yüzen alt gezinme, (3) Ana Sayfa hiyerarşisi (selamlama bandı önde, durum kartı ikinci, dolgu "Günün Sözü").

## Bulgular
| ID | Ö | Ekran | Gözlem | Kanıt | Öneri |
|---|---|---|---|---|---|
| CL-01 | Y | Tümü | `ColorScheme.fromSeed` birincili soluk #8F4A4E türetiyor; "QR kod tara", "Gönder", "Ekle" pasif görünüyor, alt gezinme FAB'ı ise #800020 — iki bordo | home_filled_light, request_leave_form_filled_light, visitor_filled_light; `lib/theme/app_theme.dart:88` | Şemayı elle kur: primary = marka bordosu, container tonları nötr |
| CL-02 | Y | Kabuk | Yüzen hap alt gezinme + yükseltilmiş QR FAB ~110dp yer kaplıyor; içerik altına giriyor (QR "Yenile" yarım, Ana Sayfa 3. kart kesik); yazı 1.3'te "Ana Sayfa"/"QR İşlemleri" iki satıra kırılıyor | qr_filled_light, home_filled_light, home_textscale130_light; `lib/widgets/app_bottom_navigation.dart` | Standart 64dp NavigationBar, QR ortada eşit öğe (hafif vurgulu), içerik alt boşluğu nav yüksekliğinden |
| CL-03 | Y | Ana Sayfa | İlk ekranın %20'si pembe selamlama bandı; asıl iş (bugünkü durum) ikinci sırada; "Son Giriş 13:00 / Son Çıkış 12:00" sırası kafa karıştırıcı, "+1 hareket" anlamsız | home_filled_light; `lib/screens/home/home_screen.dart:140-170`, `widgets/cards/attendance_status_card.dart` | Kompakt başlık (ad + tarih + proje) → tek "Bugün" kahraman kartı (durum, giriş saati, geçen süre, zaman çizgisi) |
| CL-04 | Y | Ana Sayfa | Hızlı işlemler: 2 sütun ızgarada yetim 3. kart, eşit olmayan kart yükseklikleri, Ziyaretçi ikonu mavi çerçeveli (`AppTheme.info`) — paletten kopuk | home_long_light; `home_screen.dart:236-244` | Tek satır 3 eşit eylem ya da ikonlu liste; tek renk ailesi |
| CL-05 | Y | Ana Sayfa | "💫 Günün Sözü" şablon dolgusu; emoji fontta yok, kutu (tofu) olarak çiziliyor | home_long_light; `lib/l10n/app_tr.arb:94`, `home_screen.dart:385-415` | Kaldır (yerine "Bu hafta: 4 gün · 31 sa" gibi gerçek veri) |
| CL-06 | Y | Formlar | İzin/düzeltme/ziyaretçi formlarında 3 farklı kontrol: alt çizgili dropdown, hap şeklinde tarih butonu (ISO "2026-11-04"), alt çizgili metin alanı; Gönder içerik ortasında | request_leave_form_filled_light, visitor_form_filled_light; `lib/screens/requests/requests_screen.dart` | Tek input stili (dolgulu/çerçeveli, 52dp), tarih aralığı alanı yerel biçimle, yapışkan alt eylem çubuğu |
| CL-07 | Y | Talepler/Ziyaretçi/Ana | Durum rozetleri tutarsız: Talepler "Bekliyor/Onaylandı" renksiz çerçeveli (buton gibi), Ziyaretçi renkli dolgu, Ana "İçeride" ikonlu hap | requests_filled_light, visitor_filled_light, home_filled_light | Tek `StatusBadge(tone)` bileşeni |
| CL-08 | O | Tümü | Üç tarih biçimi: "2026-11-09 – 2026-11-11", "04.11.2026 10:30", "4 Kas 2026 Çar" | requests_filled_light, history_overview_light, history_filled_light | Tek biçimleyici: "9–11 Kas", "Bugün 10:30", "4 Kas Çar" |
| CL-09 | O | Tümü | Pembe container tonu (primaryContainer) aşırı: selamlama, istatistik kutuları, segment zemini, FAB, avatar | home/history_overview/requests/profile | Nötr `subtle` zemin; bordo yalnız eylem/seçim/odak |
| CL-10 | O | Geçmiş | Her kayıt ayrı çerçeveli kart + ok; ekranda 6 kayıt; kayıtlar saat sırasında değil | history_filled_light; `widgets/history/history_record_tile.dart` | Gün başlıklı gruplu liste, 1px ayırıcı, 60dp satır, saat solda tabular |
| CL-11 | O | Geçmiş/QR | Geliştirici dili: "Süre sunucunun bitiş zamanına göre gösterilir. İşlem kaydı… doğrulamaz", "Çerçeve: bugün · Dolgu: seçili gün · Nokta: kayıt var", "Türkiye saati · UTC+3" | qr_filled_light, history_calendar_light | Kullanıcı dili ya da kaldır |
| CL-12 | O | Kabuk | Başlık alanı beyaz, gövde #FAFAFA — iki tonlu; başlık boyutları ekranlar arası farklı ("Bu Ay Özeti" ince 28, "Geçmiş" kalın 24) | history_overview_light, requests_filled_light | Tek zemin, tek başlık ölçeği |
| CL-13 | O | Giriş | Tam ekran gradyan + beyaz kart şablon görünümü; iki tekrar alt başlık; "Hoş geldiniz!"; onay kutusu ile etiketi arası boşluk | login_filled_light; `lib/screens/auth/login_screen.dart:116` | Düz zemin, logo + tek başlık, formu üst-orta, gradyansız |
| CL-14 | O | Özet | "Bu ay / Bu Hafta" büyük-küçük harf tutarsız; pembe metrik kutuları; "Reddedilen: 1 Belirsiz: 0" düz metin | history_overview_light | Çizgiyle ayrılmış metrik satırı (A2 kalıbı) |
| CL-15 | D | Tümü | Gölge + çerçeve + düz kart karışık (kart elevation 2, geçmiş çerçeveli, hızlı işlem düz) | çok sayıda | Gölgesiz; 1px çizgi; yalnız sheet/diyalogda gölge |
| CL-16 | D | Profil | Büyük avatar kartı yarım ekran; "Firma / proje" ham etiket | profile_long_light | Kompakt kimlik satırı + gruplu ayar listesi |

## Önerilen yön (ön görüş)
"A2 Mobil": web ile aynı token'lar (canvas #fcfcfc, surface #fff, line #e2e2e0, text #252523/#646461,
primary #7a1f1f, durum tonları), sistem fontu, gölgesiz, tipografiyle hiyerarşi. Mobil-yerel: Ana Sayfa'da tek
vurgulu "Bugün" kartı, yapışkan alt eylemler, filtre/form için bottom sheet, standart NavigationBar.
Alternatifler (F3'te mockup): B "Marka bandı" (Ana Sayfa üstü bordo bant + üstüne binen durum kartı),
C "Koyu öncelikli" (vardiya/saha için).
