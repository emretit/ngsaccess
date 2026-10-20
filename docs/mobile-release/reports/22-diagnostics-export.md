# 22 — Güvenli yerel destek raporu

19 Ekim 2026. Kapsam: MOB-23 / PLAT-F08 / PLAT-WP08 içinde kalan destek erişimi, release stack korunması ve derleme kimliği. Önce development-package.md ve platform audit raporu okundu; bounded bellek kaydının bulunduğu, destek ekranında erişilemediği, native AOT satırlarının atıldığı ve build wrapper'ın yalnız ortam tanımları verdiği kaynakta yeniden doğrulandı. Önceki auth, platform, profile, l10n ve error-hook çalışmalarının üzerine dar ekleme yapıldı; Convex/web/diğer worker dosyaları değiştirilmedi.

## Uygulanan davranış

- Profil → Yardım & Destek ekranında Teknik destek raporu, panoya kopyalama ve yerel kaydı temizleme gerçek eylemleri bulunuyor. Panoya yazma başarılı olmadan başarı bildirimi yok; platform hatası sabit yerel hata mesajıyla gösteriliyor, hata detayı UI'a taşınmıyor. Async işlemden ekran kapatılırsa mounted guard bildirim/setState yapılmasını engelliyor. Son Flutter çalışmasında `%200` metinde kopyalama SnackBar'ının temizleme düğmesini örttüğü saptandı; destek geri bildirimi ekran içindeki yerelleştirilmiş canlı durum alanına taşındı, düğmenin hemen dokunulabilirliği testte doğrulanıyor.
- `SafeDiagnostics.exportJson()` sürüm1 JSON üretir: `schemaVersion`, `build`, `events`. Event alanları açık allowlist'ten alınır; raw error, function/request adı, argüman, response body, çalışan kimliği/e-posta, token/QR/parola/kart verisi için export API yok. Mevcut `record`, `events`, `clear` arayüzleri korunur. Alanlar: yerel referans/zaman, operation enum, güvenli category, platform/mode/environment/runtime/app/build/SDK kimliği, redakte stack, sınırlı attempt/elapsedMs ve geçerli HTTP status.
- Varsayılan50, en fazla200 event; aynı hata için mevcut1 saniye baskılama korunur. Stack taraması32KiB/100satır/256karakterlik satır ve32saklanan satırla sınırlı. Kaynak stack yalnız allowlist dosya konumu veya genel app/flutter/dart etiketi ve satır/sütun tutar. Export edilecek map/stack snapshot'ları dışarıdan değiştirilemez.
- Native AOT için yalnız tam satıra uyan Android/iOS mimari başlığı, hex build ID, isolate/VM base/instruction adresleri, yükleme birimi ve hex PC/snapshot offset biçimleri tutulur. PID/TID/thread adı, keyfi path/symbol/serbest metin veya sonuna hassas metin eklenmiş satır reddedilir. Bu kayıp azaltma doğrudan pinned Flutter tool dependency `native_stack_traces`0.6.1 `lib/src/convert.dart` ve `testcases/convert/regress_262474517_trace_2.txt` ile karşılaştırıldı; ek dependency getirilmedi.
- `build_mobile.sh` toolchain preflight ardından pubspec sürüm/build ve aynı kurulu Flutter SDK'nın cache metadata'sını doğrular. APP_VERSION/BUILD_NUMBER/FLUTTER_VERSION caller override'larından değil gerçek dosyalardan türetilir, shell array içinde ayrı quoted argümanlar ile tüm mevcut modlara aktarılır. Eksik/bozuk/çift version, sıfır build, beklenen pinle uyuşmayan SDK veya bozuk metadata Flutter build/run başlamadan sabit hata ile durur. Mevcut1.0.4+1 ve pin değiştirilmedi.
- Destek metni otomatik ağ gönderimi olmadığını, bounded bellek kaydını, sistem panosuna kopyalamayı ve yerel silmenin önceden kopyalanan raporu silmediğini açıklar. Boş log da sürüm/build raporu kopyalayabilir. Yeni share/telemetry/plugin veya secret gereksinimi yok.
- Önceki357 l10n anahtarı korundu;8diagnostics ve diğer aktif ziyaretçi sahibinin istediği `visitorNotes`/`visitorOptionalHint` ile367anahtar oldu. ARB, mevcut generated accessor'lar ve expected_keys birlikte güncellendi; SDK kilidi nedeniyle gerçek gen-l10n koordinatöre bırakıldı.

## Arayüzler ve dosyalar

Değişen uygulama dosyaları: `mobile/lib/core/safe_diagnostics.dart`, `mobile/lib/screens/profile/profile_screen.dart`; `mobile/lib/l10n/app_{en,tr}.arb`, `app_localizations.dart`, `app_localizations_{en,tr}.dart`; `mobile/test/l10n/expected_keys.json`; `mobile/scripts/build_mobile.sh`.

Test dosyaları: `mobile/test/core/safe_diagnostics_test.dart`, `mobile/test/widgets/profile_screen_test.dart`, koordinatörün açık izniyle yeni `mobile/scripts/tests/test_build_identity.py`. Belge: bu rapor ve `mobile/release/README.md` içindeki dar destek/symbol retention bölümü.

`ProfileScreen` test izolasyonu için optional `SafeDiagnostics? diagnostics` kabul eder; verilmezse mevcut singleton kullanılır. Mevcut packageInfoLoader, profil/parola/tema/dil API'leri korunur. Flutter error hooks veya test binding error handler değiştirilmedi. Root hooks sahibi13 ve platform dosyaları koordinatörde kalır. Entegrasyon API ve367anahtar bilgisi koordinatöre/ziyaretçi sahibine erken iletildi; ledger20 sahibine kod kapanışı bildirildi.

## Regresyonlar ve kontroller

Yeni4 diagnostics unit testi: sürümlü export ve raw marker dışlanması; Android AOT header/offset korunması ve hassas suffix/path reddi; iOS/loading-unit biçimi ve serbest metin reddi; büyük stack sınırı ve immutable snapshot; export sonrası clear/build bilgisinin korunması. Sonuncu clear/build kontrolü sürümlü export testinin içindedir; toplam4 yeni test, önceki4 ile8test.

Yeni4 widget testi: TR/EN gerçek Help üzerinden explicit kopyalama ve silme, `%200` metin/koyu tema; Clipboard platform hatasında güvenli hata ve kaydın korunması; panoya yazma beklerken Help'ten ayrılma. Kopyalamadan önce clipboard yazımı olmadığı, planted marker'ın rapora girmediği ve silmenin panoya tekrar yazmadığı sınanır.

Yeni7 Python testi gerçek wrapper'ı izole geçici sahte SDK/CLI ile çalıştırır: gerçek checkout pubspec sürüm/build aktarımı, ortam override'larının yok sayılması, unsignedrelease dahil metadata aktarımı, eksik SDK dosyası, Flutter/Dart pin uyumsuzluğu, bozuk/hassas metadata ve eksik/çift/enjekte pubspec reddi. Production preflight/native/signing bu fixture'da ayrı stub'dır; bu testler gerçek SDK/native derleme kanıtı olarak sunulmaz.

Bu worker'ın çalıştırdığı kontroller:

- `python3 -m unittest discover -s mobile/scripts/tests -p test_build_identity.py -v`:7/7başarılı.
- `python3 -m unittest discover -s mobile/scripts/tests -v`:25/25başarılı; mevcut release preflight regresyonları korundu.
- `bash -n mobile/scripts/build_mobile.sh`:başarılı.
- `python3 mobile/scripts/check_l10n.py`:TR/EN anahtar ve placeholder eşleşmesi başarılı.
- İzinli dosyalarda `git diff --check`:başarılı.

Flutter/Dart analyze/test/format/gen-l10n/pubget/build/native komutu çalıştırılmadı; SDK kilidi koordinatörde. Koordinatörün `evidence/flutter-test-final2.txt` çalışmasında8diagnostics testi başarılı; genel431başarılı/2başarısız sonuçtaki iki TR/EN support widget hatası yukarıdaki gerçek bildirim örtüşmesini ortaya koydu. UI düzeltildi; son focused widget tekrarını koordinatör yürütüyor, henüz sonucu iddia edilmiyor. Bu rapor önceki worker'ların test sayısını kendisinin koştuğu gibi sunmaz.

## Kapanış sınırı ve gerçek yayın engelleri

MOB-23 / PLAT-WP08 kalan **kod kabiliyeti** uygulandı: kullanıcı erişimli local export, redakte native frame korunması ve gerçek build identity. Release README, mevcut signed Android `build/symbols/android` ve iOS `build/symbols/ios` çıktılarının exact artifact hash, ABI, pubspec version/build ve build ID ile özel kasada saklanmasını; IPA/AAB/receipt ve Apple archive/dSYMs birlikteliğini; matching `flutter symbolize -i stack.txt -d ...symbols` adımını tanımlar. [Resmi Flutter belgesi](https://docs.flutter.dev/deployment/obfuscate) eşleşen symbol dosyası ve symbolize akışını doğrular.

Henüz kanıtlanmayan dış kapılar: gerçek imzalı obfuscated binary'de kontrollü hata → kullanıcı kopyası → sensitive-marker kontrolü → exact symbols ile recover edilen stack; gerçek Apple native crash/dSYM eşleşmesi; mağaza signer/credentials ve fiziksel cihaz kabulü. Var olan CI private symbol vault'a otomatik retention yapmaz; release sahibi erişim kontrollü saklamayı kurmalı ve doğrulamalı. Bellek-only log process kill/fatal termination sonrası kalmaz; persistent fatal-crash collection veya remote telemetry geliştirilmiş sayılmaz. Otomatik dış gönderim, deploy, commit/push veya mağaza gönderimi yapılmadı.

## Koordinatör native entegrasyon eki

Gerçek Flutter CLI, frameworke ayrılmış `FLUTTER_VERSION` anahtarını --dart-define olarak reddetti. Koordinatör anahtarı `NGS_FLUTTER_VERSION` yaptı; wrapper, diagnostics consumer, fake SDK regresyonu ve yayın rehberi birlikte güncellendi. Fake CLI ayrılmış anahtarı da reddeder;25 Python testi yeniden geçti. Son Android APK ve iOS simulator/release-no-sign derlemeleri bu düzeltmeyle başarılıdır. Detaylar `../final-verification.json` kaydındadır.
