# D2a — Ana Sayfa, QR ve kapı ekranları

## Değişiklikler

- Üretim: `lib/screens/home/home_screen.dart`, `lib/screens/qr_scan/qr_scan_screen.dart`, `lib/screens/settings/select_device_screen.dart`, `lib/router/app_router.dart`, yeni `lib/router/qr_open_intent.dart`, `lib/widgets/door_operation_recovery_dialog.dart` ve sahiplikteki altı `lib/widgets/cards/*.dart` dosyası.
- Test: sahiplikteki altı mevcut widget testi; yeni `test/ui_redesign/d2a/qr_open_intent_test.dart` ve `layout_states_test.dart`; bu rapor. Provider, repository, model, l10n, tema, kit, screenshot harness ve diğer worker dosyalarına yazılmadı.
- Ana Sayfa marka bandı ve banda binen Bugün yüzeyini kullanır; ilk giriş/son çıkış/son giriş ayrı gerçek provider alanlarıdır. Hareket saati ve yönü doğrulanabilen kapı adları gösterilir; veri yoksa kapı etiketi/bekleyen talep rozeti üretilmez. Günün Sözü ve hızlı işlem başlığı kaldırıldı; ilk yüklemede tek attendance iskeleti, hatada AppDataNotice, boşta üç `—` ve Bugün kayıt yok durumu vardır.
- QR paneli, yenileme ve kalan süre birlikte kayar; Yenile secondary, mevcut geçerli token yenilenirken korunur. Tara çerçevesi/kamera kontrolleri kaydırılabilir; yeniden sorulabilir izin `qrGrantCameraPermission` ile sistem isteğini, kalıcı ret mevcut Ayarları aç eylemini kullanır. Kamera başlatma/durdurma ve modal/session guard'ları korunur.
- Kapı seçimi AppPageHeader/AppTextField/AppListGroup/AppListRow/AppEmptyState kullanır; arama hatada korunur, seçim nötr zemin+tik, kullanılamayan hedefin nedeni görünürdür. Kurtarma AppDialog/AppDataNotice ve explicit status kontrolü kullanır; kapı adı yalnız mevcut işlem snapshot'ından alınır.

## QR intent sözleşmesi

`/qr` pathname ve URL allowlist'i değişmedi; `/qr?mode=scan` dış URL parametresi kanonik `/qr` olur ve tarama yetkisi/niyeti sayılmaz. Home, `context.go(AppRoute.qr, extra: QrOpenIntent.requestScan(sessionEpoch: auth.sessionEpoch))` çağırır; monoton revision cold ve retained branch'te Tara'yı açar. Normal QR gezinmesi seçili sekmeyi korur, cold QR Kodum'dur; eski oturum intent'i router'da filtrelenir ve ekran sessionEpoch değişiminde QR Kodum'a döner. `qr-refresh`, `qr-refresh-error`, `qr-status-error`, `qr-token-scroll` key'leri korunur; yeni `home-open-door` yalnız görsel widget türünden bağımsız finder içindir.

## Kapılar

- İlk odaklı tur: 76/76 geçti; ardından gerçek ilk/son giriş ayrımı, izin isteğinin tekrar tetiklenmesi, gerçek router üzerinden cold/retained QR intent ve oturum temizleme kontrolleri eklendi.
- Yeni yerleşim testleri: 8/8; açık/koyu, 390dp/%100 ve 320dp/%200. Kontrol edilebilir gerçek kapı snapshot'ı, query sayısı ve resend yokluğu; izinli mock kamerada kontrollerin kaydırılıp çalıştırılması doğrulandı.
- İlk tam test turu `/tmp/d2a-full.log`: 713 geçti, 11 hata; hepsi eşzamanlı kit `AppSheet` scopesRoute/explicitChildNodes ve onu kullanan D1/D2b profil testleriydi. Kit sahibinin düzeltmesinden sonra yeniden koşuldu; son kabul sonuçları aşağıdadır.
- Kabul öncesi temiz analyze: `/tmp/d2a-analyze5.log` — No issues found. Sonraki eşzamanlı D1 test eklemeleri `date_range_field_test.dart:2` ve `metric_row_layout_test.dart:2` unnecessary_import info üretti; D2a kaynaklı analiz bulgusu yok, bu sahiplik dışı dosyalara yazılmadı.
- Son tam suite `/tmp/d2a-full-acceptance.log`: **773/773 geçti**; önceki `/tmp/d2a-full-delivery.log` da 766/766 geçti. Sayı artışı paralel D1 test eklemeleridir; D2a'nın davranış/regresyon kapıları yeşildir.
- Son global analyze `/tmp/d2a-analyze-last.log`: **yalnız iki D1 unnecessary_import info** (`test/ui_redesign/d1/date_range_field_test.dart:2`, `metric_row_layout_test.dart:2`); D2a dosyalarında sıfır bulgu. Global analyze0 kabulü bu sahiplik dışı iki import temizlenene kadar açık kalır.
- Son kamera çerçevesi/kapı snapshot yerleşim turu `/tmp/d2a-layout-final.log`: **8/8 geçti**, dört köşeli tarama çerçevesi ve gerçek snapshot görünümü yeniden capture edildi.
- Son odaklı tur `/tmp/d2a-focused-final.log`: **87/87 geçti**; router/deep link/guard, kapı kurtarma/idempotency/sessionEpoch, kamera lifecycle ve D2a yerleşim testlerini içerir.
- İlk tüm screenshot turu `/tmp/d2a-shots.log`: **76/76**; güncel D2a hedefli `/tmp/d2a-shots-acceptance.log`: **19/19 geçti**. Çıktı `/tmp/mui-d2a`; `current/` değiştirilmedi.

## Mevcut assertion/finder uyarlamaları

Aşağıdaki yollar mobile/ altındadır; davranış/idempotency/session/deep link assert'leri gevşetilmedi.

| Dosya:satır | Değişiklik |
|---|---|
| `test/widgets/home_cards_test.dart:97,99` | Loading metni/progress görünümü yerine tek AppSkeleton; loading semantics ve boş durumun duyurulmaması assert'leri korunur. |
| `test/widgets/home_screen_test.dart:215,233,361,377` | QuickActionCard finder → `home-open-door` AppListRow; eski farklı accent kart testi → tek primary ve üç nötr liste eylemi. Komut sayıları/hedefleri ve bütün yarış koşulu assert'leri aynen korunur. |
| `test/widgets/door_operation_recovery_test.dart:120,136` | Unlock finder/widget tipi AppListRow; mevcut bütün query/requestId/session/idempotency assert'leri korunur. |
| `test/widgets/select_device_screen_test.dart:273,279` | ListTile.onTap:null → AppListRow.enabled:false; erişilemeyen hedefe dokunmanın kaydetmediğini doğrulayan mevcut akış korunur. |
| `test/widgets/qr_scan_screen_test.dart:189` | Kamera kontrolü aşağı kaydığı için tıklamadan önce ensureVisible; pending switch testi gerçek tıklamayı sürdürür. |
| Altı sahiplikteki widget test fixture'ları | Kit token'larının bulunması için gerçek AppTheme; legacy kart testlerinde deprecated kullanım için dosya düzeyinde ignore. |

## Görsel kanıt ve sapmalar

`/tmp/mui-d2a/` altında ilk 76 harness çekimi ve dört ek `d2a_camera_*` / `d2a_door_snapshot_*` çekimi vardır. Ek test çekimleri harness'in font yükleme/çözümleme fonksiyonlarını yalnız okur; screenshot_test dosyaları değiştirilmedi. Home açık/koyu/loading, QR Kodum, izin, izinli mock kamera, kapı listesi ve gerçek kapı snapshot'ı view_image ile B mockup'larına karşı incelendi.

- B mockup örnek saatleri, hareket kapısı isimleri ve bekleyen talep sayısı üretim verisi sayılmadı. Harness'in 09:00/12:00/13:00 özeti aynen gösterilir; özetin sağlayamadığı kapı adları gizlidir. Greeting ve tam tarih gerçek cihaz saatinden gelir.
- İlk görsel turda raporlanan `app_metric_row.dart:58` sorunu DS sahibinin gerçek metin ölçümüne geçmesiyle çözüldü; son view_image kontrolünde açık/koyu Home üç yatay saati gösterir. D2a kit dosyasına yazmadı. Metriklerin değer/etiket sırası ortak kitin sözleşmesini izler; mockup'ta etiket önce gelir.
- Seçili grup köşesindeki düzleşme kit sahibinin AppSurface clip düzeltmesiyle giderildi; son çekimde radius ve nötr seçim zemini doğrulandı.
- Genel harness kapı fixture'ı `operation:null` ve `hasUnresolvedOperation:false` sağlar; yeni `doorOperationNothingToCheck` (koordinatörün eklediği TR/EN anahtar) gösterilir, eski işlemi kontrol etme uyarısı ve ipucu gösterilmez; sahte işlem adı/yeniden gönder yetkisi eklenmedi. Ek d2a_door_snapshot çekimleri gerçek unknown snapshot'ında kapı adı ve Durumu kontrol et eylemini gösterir; domain operation varlığında resend'e izin vermediği için mockup'taki resend butonu görünmez.
- AppDialog'ın mevcut API'si confirm eylemini primary yapar; resend bulunmayan durumda yalnız Kapat bu slotu kullanır (kit API sınırı). `quickActionUnlock` mevcut TR ARB'de “Kapıyı Aç” olduğundan ikinci kelimenin harfi mockup'tan farklıdır; ARB sahipliği nedeniyle literal/yerel case dönüşümü eklenmedi. Kamera görüntüsü widget testinde mock/boştur; fiziksel kamera, OS status bar ve VoiceOver/TalkBack kontrolleri cihaz kabulüne aittir.

## Deprecated bırakılan kullanılmayan kartlar

`QuickActionCard`, `ProgressHeroCard`, `StatCard`, `SectionHeader`, `DoorCommandStatusCard`. Dosyalar silinmedi; D4 temizliği için tutuldu. Kullanılan AttendanceStatusCard ortak kite dönüştürüldü; eski onScan constructor argümanı çağıran testlerin kaynak uyumluluğu için tutulur, sayfa tek tarama CTA'sının sahibidir.

## fix1 — RV2-01 / RV2-02 / RV2-06 / RV2-13 / RV2-14

- `lib/screens/home/home_screen.dart:215,233,250,284`: mevcut operation veya unresolved durumunda DoorCommandStatusCard kapı satırının üstünde görünür; unknown notice ve satır alt metni belirsiz sonucu açıklar, confirmed/failed mesajları korunur. Durumu kontrol et eylemi aynı kurtarma diyaloğunu açar; başlangıç/yeniden açılış yalnız mevcut status sorgusunu yapar, Home'da resend butonu yoktur ve yeni requestId üretilmez. `_showRecovery` eski satır akışının çıkarılmış ortak yordamıdır; `_handleQuickUnlock` doğrulama/epoch/idempotency kapıları aynıdır.
- `lib/widgets/cards/door_command_status_card.dart:9`: deprecated kaldırıldı; mevcut AppDataNotice tone/message modeli Home tarafından tüketilir. Kullanılmayan deprecated kart listesi artık yalnız QuickActionCard, ProgressHeroCard, StatCard ve SectionHeader'dır; iki artık gereksiz deprecated ignore satırı testlerden kaldırıldı.
- `lib/screens/settings/select_device_screen.dart:151,240`: üstteki tekrarlı tercih özeti kaldırıldı; Seçimi kaldır tam genişliktedir ve listeye 16dp ara verir. Sınırsız liste lazy kalır: tek DecoratedSliver çerçevesi, satırlar arasında 1dp ayraç, yalnız ilk/son köşelerde radius; satırların seçme/kaydetme ve disabled davranışı değişmez.
- `lib/screens/qr_scan/qr_scan_screen.dart:670`: tarama sonucu DialogRoute builder'ı AppDialog(commonOk) kullanır; `_dialog`, `_dismissDialog`, `_operationEpoch`, kamera ve modal sahipliği değiştirilmedi.
- `lib/router/qr_open_intent.dart:5,10` + `app_router.dart:41`: ctor private, epoch non-null/required; router yalnız mevcut epoch'u kabul eder. `test/ui_redesign/d2a/qr_open_intent_test.dart:109,135` eski intent'i signIn sonrasında tekrar router'a gönderir ve ekranın initialTab=code, revision=0 ve görünür QR Kodum sonucunu doğrular.
- `test/ui_redesign/d2a/layout_states_test.dart:99`: HomeScreen bütünü 320dp/%200, uzun ad/soyad/proje ve avatar ile açık/koyu temada sınandı; en alttaki Ziyaretçi davet et eylemi kaydırılarak erişilir, takeException null'dır. `test/widgets/home_screen_test.dart:383,421` unknown notice + query-only recovery ve confirmed/failed sonucunu sınar.
- Mevcut görsel assertion uyarlaması: `test/widgets/door_operation_recovery_test.dart:123,157,181,194,200,214,231` — status/action/error finder'ları dialog'a scope edildi çünkü aynı durum artık Home'da da görünür; kapatma sonrası confirmed snapshot'ın Home'da kalması beklenir. requestId, hedef, query/send sayısı, logout ve retry guard assert'leri değiştirilmedi. `test/widgets/select_device_screen_test.dart:114` seçili adın tek görünmesini, tam genişlikli temizleme eylemini ve 16dp arayı doğrular.
- RV2-08 bu turda uygulanmadı; `door_operation_recovery_dialog.dart` değiştirilmedi ve DS kit yönergesi beklenir. RV2-07 yönlü ek hareket metinleri bu dispatch kapsamına alınmadı.

### fix1 kapıları

- Odaklı ilk tur `/tmp/d2a-fix1-focused.log`: 78/78 geçti; ek tek-grup/seçimi kaldır testi son tam suite ve `/tmp/d2a-fix1-select.log` turuna dahildir.
- Son analiz `/tmp/d2a-fix1-analyze-final.log`: **No issues found**, exit 0; ilk turdaki paralel D3a lint'i giderilmiştir. Ek seçici tur `/tmp/d2a-fix1-select.log`: **9/9 geçti**.
- Tam suite `/tmp/d2a-fix1-full.log`: **816 geçti, 4 başarısız**, exit 1 (6dk41sn). Dört hata yalnız paralel `test/ui_redesign/d3b/visitor_layout_test.dart:148` içindeki AppDialog/Vazgeç/OutlinedButton finder'ıdır: light/dark ×390/%100 ve320/%200. D2a kaynaklı hata yoktur; bu sahiplik dışı dosyaya yazılmadı, global suite'in yeşile dönmesi D3b sahibine aittir.
- Görsel kanıt `/tmp/d2a-fix1-shots.log`: **2/2 geçti**, `/tmp/mui-d2a-fix1/select_device_filled_light.png` ve dark varyantı. Açık çekim B-device-filled.png ile view_image üzerinden karşılaştırıldı; tek grup, köşeler, ayraç ve tam genişlikli temizleme eylemi doğrulandı. screenshot_test dosyalarına yazılmadı.
