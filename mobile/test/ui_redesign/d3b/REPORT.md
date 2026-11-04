# D3b — Ziyaretçi ekranları / Yön B

## Değişen dosyalar

- `lib/screens/visitor/visitor_screen.dart`
- `lib/screens/visitor/visitor_form_screen.dart`
- `lib/widgets/visitor/visitor_cards.dart`
- `lib/widgets/visitor/visitor_detail.dart`
- `lib/widgets/visitor/visitor_labels.dart`
- Mevcut testler: `test/visitor_widgets_test.dart`, `test/visitor_form_time_test.dart`, `test/visitor_recovery_widgets_test.dart`, `test/visitor_lifecycle_test.dart`.
- Yeni: `test/ui_redesign/d3b/{visitor_layout_test,turkey_time_test}.dart`, bu rapor.

Provider/repository/service/model/core/theme/kit/l10n/router/screenshot harness dosyalarına yazılmadı; gereken kit/l10n eklerini koordinatör sağladı. Commit/stage yapılmadı.

## Sonuç

Liste nötr `AppPageHeader`, tek `visitor-add` primary, bağımsız özet/liste skeleton'ları, üç metrik, arama/durum seçimi ve lazy gruplanmış `AppListRow` kullanır. Satırlar 1dp ortak ayraçla birleşir; tarih altında erişim rozeti ve ayrı fiziksel bulunma metni vardır. Filtreli/filtresiz boşluk, cache'li/cache'siz hata, özet lower-bound açıklaması ve sayfalama korunur.

Form kişi/ziyaret `AppListGroup`, ayrı `AppDateField`/`AppTimeField`, notice/review ve aktivasyon açıklaması kullanır. `AppFormActionBar` klavye üstündedir, ikinci inset eklenmez; 480dp form/720dp liste sınırları vardır. Bütün form alanları scroll boyunca bağlı kalır: görünmeyen zorunlu alanlar da doğrulanır. Hata görünür başlangıca taşınır.

Ayrıntı `AppSheet`, erişim rozeti, ayrı presence, tarih/kişi/amaç/not ve `Cihaz durumu` içerir. Secondary edit/cancel, destructive `AppDialog`, çift confirm callback kilidi ve mutasyon sırasında disabled eylem korunur. Applied cihaz sonucu fiziksel inside'a çevrilmez; aktif erişimin iptali operatör gerektirmeye devam eder.

Pending draft/requestId/notice sürümü/review/reconcile receipt, uncertain input kilidi, sessionEpoch, foreground/visible branch ve detail lease davranışları korunur. `VisitorFormScreen.now`, public constructor'lar, `visitor-add` ve dış nav key'i korunur; başarı mesajı listeye döndükten sonra gösterilir.

## Türkiye saati adapter'ı

- `lib/widgets/visitor/visitor_labels.dart:24`: tek `VisitorTime` boundary; `day:25`, `time:27`, `instant:29`. `AppDateFormat` ve `AttendanceDate` kullanır.
- Form initialize/recovery/edit instant'ları UTC tutar (`visitor_form_screen.dart:60`); varsayılan dakika yuvarlaması `:94`; picker callback'leri `:146` üzerinden aynı boundary'ye gider.
- Label/period `visitor_labels.dart:43` ve `:46` üzerinden Türkiye saatinde biçimlenir. Üretim form/label kodunda cihaz `toLocal()` yoktur; wire `VisitorDraft.toJson()` sözleşmesi değişmez.
- UTC ve America/New_York ayrı süreçlerinde test, gerçek cihaz-local offset/saat farkını da doğrular: UTC 06:00 / New York 01:00 aynı TR 09:00'ı gösterir. Picker 09:00 TR → `06:00Z`, bitiş 10:00 → `07:00Z`; etiket 09:00, gece yarısı gün dönüşümü ve payload da doğrulanır.

## Kapılar

- `flutter analyze --no-pub`: **No issues found!** (`/tmp/d3b-final-analyze.log`, 16.0 sn).
- `flutter test --no-pub`: **831/831 geçti** (`/tmp/d3b-final-full.log`); ilk tam tur da 820/820 yeşildi.
- D3b: **10 kabul testi** (8 layout/behavior + 2 Türkiye saati). Açık/koyu, 390dp/%100 ve 320dp/%200; liste/form/sheet/iptal; min48dp hedefler; klavye footer sınırı; loading/cache ayrılığı; çift confirm kilidi; görünmeyen required alan doğrulaması.
- `TZ=UTC flutter test --no-pub test/ui_redesign/d3b/turkey_time_test.dart`: **2/2 geçti** (`/tmp/d3b-final-tz-utc.log`).
- `TZ=America/New_York ...`: **2/2 geçti** (`/tmp/d3b-final-tz-ny.log`).
- Son ziyaretçi harness: **14/14 geçti** (`/tmp/d3b-final-harness.log`); bağımsız form/klavye/sheet/iptal capture turu: **8/8 geçti** (`/tmp/d3b-final-captures.log`), `/tmp/mui-d3b` güncel.
- `git diff --check`: temiz.

## Mevcut assertion/finder uyarlamaları

Busy/auth/retry/focus/tap-count, requestId/draft identity ve foreground/session assertion'ları azaltılmadı. Dispatch öncesinde koordinatörün güncellediği copy/FilledButton beklentileri korunur.

- `visitor_form_time_test.dart:45`: kit teması; `:105`: birleşik tarih metni yerine iki picker'ın gün/saat değerleri; `:141/:168`: aynı instant'ın UTC karşılaştırması; `:182`: tarih picker key'i; `:202`: ayrı time modalı artık otomatik açılmadığından ikinci OK tap'i çıkarıldı. Görünen değer kontrolleri `:160/:206/:207/:211/:228/:232/:259/:279`; stale/touched/duration ve exact pending draft assertion'ları aynıdır.
- `visitor_widgets_test.dart:63/:71`: yeni empty metni; `:100`: detail kapsamlı presence; `:112/:138`: destructive/cancel secondary finder'ları; `:246`: scroll edilen aramaya reveal; `:309/:347/:373/:474/:478`: kit select finder'ı; `:355`: filtreli empty; `:443`: aktivasyon açıklamasına reveal; `:482`: sheet kapsamlı seçenek assertion'ı. Debounce ve çağrı sayıları aynıdır.
- `visitor_recovery_widgets_test.dart:24`: kit teması; `:214`: amaç alanını adıyla bulup reveal; `:267`: kayıt bulunduğunda form route'u kapandı assertion'ı (liste araması artık TextFormField olduğundan eski global TextFormField-yok uygulanamaz); `:300`: secondary retry finder'ı. Receipt/create/store kilit ve çağrı sayıları aynıdır.
- `visitor_lifecycle_test.dart:43`: bağımsız detail fixture'ına kit teması; lifecycle/poll/call-count assertion'ları aynıdır. Router fixture'ındaki `:89` teması dispatch öncesinde mevcuttu.

## Kit bağlaması ve görsel inceleme

Koordinatörün eklediği `AppTextField(showCounter:false)` (`visitor_screen.dart:129`, `visitor_form_screen.dart:500`) maxLength'i koruyup sayacı gizler. `AppListRow.supporting` (`visitor_cards.dart:32`) badge/presence'ı tarih altına yerleştirir. `visitorMetricPending` (`visitor_cards.dart:78`) “Onay bekliyor” / “Pending”; badge'de `visitorPendingShort` kalır. Metrik wrap eklenmedi: koordinatör kararıyla kısa etiketler normal genişlikte üç sütun, büyük yazıda ölçülerek dikey olur.

`/tmp/mui-d3b` harness ve `d3b_*` çekimleri `view_image` ile B referanslarıyla karşılaştırıldı: filled light/dark, empty, error, filled form, keyboard, detail light/dark, cancel; 320dp/%200 örnekleri de incelendi. Sonuçlarda taşma yoktur. HTML yerine DESIGN_B üretim kiti esas alınır: floating input etiketleri, form grupları, min64dp satırlar ve doğal scroll. OS status/home indicator çizilmez. Flutter render'ı gerçek OS klavyesini içermez; boş görünen 280dp viewInsets alanının üstündeki footer sınırı testte `844−280` ile doğrulanır.

Bilinen görsel farklar ve nedenleri:

- Boş/hata listelerinde arama/durum denetimleri mevcut davranış ve filtreleme testleri gereği erişilebilir kalır; HTML boş/hata örneği bunları göstermez.
- Özet, tüm davet kapsamını açıklayan başlığı korur; adetler/isimler/saatler mockup yerine gerçek fixture verisidir. Listede presence yoksa “bilinmiyor” gösterilir, mockup'taki inside uydurulmaz.
- Harness'in filled form fixture'ı mevcut ziyaretçiyi düzenler, başlık “Daveti düzenle” olur; ayrı D3b capture yeni davet formunu doldurur.
- AppDialog/M3 normal ölçekte eylemleri yatay, dar/büyük yazıda dikey yerleştirir; HTML örneği her ölçekte dikeydir.
- Opsiyonel bulunmayan değer `—`; AppDateField yıl bilgisi kit sözleşmesine göre gösterilir. Fiziksel cihaz/VoiceOver/TalkBack insan kabulü D4 kapsamıdır.

Ziyaretçi harness finder'ı kırılmadı. İlk tüm-harness turunda 72 başarılı / 4 kapsam dışı request finder hatası vardı: correction `Giriş: HH:mm` (filled light/dark/error), leave error `Talebi gönder`; koordinatör bunları D3a/DS sahipliğiyle takip ediyor. İlk paralel son-çekim denemesindeki native-assets install_name_tool dosya yarışı, tek süreçle tekrar çalıştırılarak giderildi; bu worker screenshot_test dosyalarına yazmadı.

## fix1 — Claude RV3B denetimi

Önceki teslim bölümündeki hata/yerleşim açıklamalarını bu bölüm günceller; kit, l10n, core, provider, router, screenshot harness ve D3a dosyalarına yazılmadı.

- **RV3B-01** — `visitor_form_screen.dart:170` aynı geçerlilik kurallarını alanlara bağlar; `:187` ilk geçersiz alanı FocusNode ile odaklayıp frame sonrası Scrollable.ensureVisible ile gösterir; `:213` required → bitiş → onay sırasını belirler. Bitiş, aynı gün saat sorunuysa AppTimeField, gün/süre sorunuysa AppDateField errorText'inde gösterilir; onay satırının altında `:461` yerel hata vardır. `jumpTo(0)` yalnız mutation hata notice'i için `:280`'de kalır. Kabul kuralları (`end > start`, `end > now`, süre ≤31 gün, available notice için reviewed) değişmez; uncertain draft/requestId/recovery kilitleri aynı kalır.
- **RV3B-02** — `visitor_detail.dart:98` iptal sırasında seçili daveti yalnız o sessionEpoch için saklar; `:140` içerik, provider selected'ı silip başarı sonucunu henüz döndürmediği frame'de ve route pop animasyonunda korunur. detailError/hesap değişiminde bu snapshot gösterilmez; kapanış boyunca eylemler kilitlidir (`:240`). Gerçek boş durum `:171` visitorNotFound kullanır, filtre metni kaldırıldı.
- **RV3B-03** — `visitor_form_screen.dart:550` / `:551` başlangıç/bitiş saatlerini ayrı yerelleştirilmiş etiketlerle adlandırır.
- **RV3B-04** — `turkey_time_test.dart:21` Türkiye saat diliminde çalışan düz flutter test'te Process.run ile New York ve Tokyo alt süreçlerini sırayla çalıştırır; NGS_VISITOR_TZ_CHILD bayrağı özyinelemeyi önler, toplam timeout 120 sn. `:56` Tokyo +9/saat15 assert'i; `:88/:93` 23:30 TR ve yıl geçişinde day/time/instant; `:177/:181/:185` visitorDate/visitorPeriod tam yıl etiketleri. Dış cihaz TZ zaten Türkiye dışındaysa mevcut sınır testleri o TZ'de doğrudan regresyonu yakalar.
- **RV3B-05** — `visitor_screen.dart:202/:208` loading+empty durumunda yalnız skeleton vardır; cache'li liste ilerlemesi `:249`'da sona taşındı, satırlar refresh başlangıcında yer değiştirmez.
- **RV3B-06/07** — `visitor_detail.dart:173` badge+presence MergeSemantics; `:194/:199` amaç/not tam genişlik subtitle blokları; `:229/:232` büyük yazıda eylemler içerikle birlikte kayar. 1000 karakter not, 320dp/%200 genişlik ve eyleme erişme testi eklendi.
- **RV3B-11/12** — `visitor_screen.dart:97` arama controller yazımı epoch guard'lı post-frame callback'e taşındı; `visitor_cards.dart:36` listede unknown presence satırı gizlenir, ayrıntıda korunur.

Yeni `fix1_test.dart` 10 regresyon testi: yalnız amaç boş → odak+viewport; yalnız onay boş → checkbox odak+görünür inline hata; üç tarih kuralı → ilgili odaklı alan hatası; gerçek provider iptal bildiriminden sonra sonucu kontrollü geciktirerek pop'a kadar AppEmptyState'in hiçbir frame'de çizilmemesi; loading+empty / cache row konumu; uzun not ve MergeSemantics; davete özgü bulunamadı metni; hesap değişiminde post-frame arama reset'i. İlk turdaki uzun not finder'ına scroll sonrası pumpAndSettle/ensureVisible eklendi; assert azaltılmadı.

Mevcut `visitor_layout_test.dart:144` etrafında büyük yazıda artık kaydırılan iptal eylemine ensureVisible+pump eklendi; min48dp, tap, iptal-call-count, klavye ve busy assertion'ları aynı kaldı. Diğer mevcut davranış testleri değiştirilmedi. RV3B-08 kapsam dışı yanlış pozitif; RV3B-09/10 D4 kit işleri olarak bırakıldı.

fix1 doğrulaması:

- Tam `flutter test --no-pub`: **856/856 geçti** (`/tmp/d3b-fix1-full.log`, 4:08); eşzamanlı D3a kaynaklı kalan kırmızı yok.
- Güncel kodla `test/ui_redesign/d3b/fix1_test.dart`: **10/10 geçti** (`/tmp/d3b-fix1-final-targeted.log`); mevcut ziyaretçi/form/recovery/lifecycle + D3b layout paketi **38/38 geçti** (`/tmp/d3b-fix1-existing.log`).
- Düz, TZ override olmadan `flutter test --no-pub test/ui_redesign/d3b/turkey_time_test.dart`: **3/3 geçti**, New York ve Tokyo alt süreçlerinin her biri **2/2 exit 0**; toplam 51 sn (`/tmp/d3b-fix1-tz.log`), 120 sn sınırı içinde. Tam pakette de bu alt süreç testi geçti.
- `git diff --check`: temiz.
- Son `flutter analyze --no-pub`: **No issues found!** (`/tmp/d3b-fix1-final-analyze.log`, 38.0 sn).

