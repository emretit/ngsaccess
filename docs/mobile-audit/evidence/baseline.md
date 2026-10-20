# Yerel doğrulama baz çizgisi

- Tarih: 19 Ekim 2026.
- Repo: `/Users/emreaydin/ngsaccess`; mobil kök: `mobile/`.
- HEAD: `31f58e5da205d696f19a80516d23750f6309e1bc`.
- Audit başında `git status --short -- mobile` boştu. Repo genelinde önceden mevcut web/Convex değişiklikleri vardı; audit mevcut çalışma ağacını inceler, yalnız HEAD'i değil.
- Flutter: 3.47.2 stable; Dart: 3.13.2.
- `flutter analyze --no-pub`: başarılı, `No issues found!`; [ham çıktı](flutter-analyze.txt).
- `flutter test --no-pub --reporter expanded`: başarılı, **44 test geçti**; [ham çıktı](flutter-test.txt).
- Bu komutlar koordinatör tarafından `mobile/` dizininde çalıştırıldı. Worker'lar aynı Flutter araçlarını paralel çalıştırmıyor.
- Bu sonuçlar cihaz, kamera, fiziksel kapı, canlı backend, release build veya uygulama mağazası doğrulaması değildir. Mevcut test kapsamının geçtiğini gösterir.
- Audit sırasında uygulama/backend kodunda düzeltme yapılmıyor; çıktı `docs/mobile-audit/` altında tutuluyor.

## HTTP 560 için ek yerel yeniden üretim

- Worker 09'un protokol bulgusu üzerine, uygulamanın gerçek `HttpConvexClient` sınıfı `http.MockClient` ile çalıştırıldı; dış ağa istek yapılmadı.
- Aynı `status: error` / `Oturum süresi doldu` gövdesi HTTP 200 ile `AuthExpiredError` ve oturum sona erdi callback'i üretirken, HTTP 560 ile `ServerError` üretiyor ve callback çağrılmıyor.
- İki characterization testi geçti: bunlar mevcut yanlış ayrımı kanıtlar, istenen davranışın sağlandığını göstermez.
- [Yeniden üretim kodu](http560_repro_test.dart), [ham çıktı](http560-repro.txt). Komut: `flutter test --no-pub ../docs/mobile-audit/evidence/http560_repro_test.dart --reporter expanded` (`mobile/` içinde).
- Resmi SDK'nın yerel kaynağı `node_modules/convex/src/browser/http_client.ts:32` durum kodunu 560 olarak tanımlar; `:316` ve `:326` bu yanıtı işlev hatası gövdesi olarak işler. Mobilde `mobile/lib/config/convex_config.dart:299` gövde ayrımından önce genel sunucu hatasına çevirir.
