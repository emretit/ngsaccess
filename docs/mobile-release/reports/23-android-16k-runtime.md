# Android 16 KB ARM64 runtime kabulü — başarısız / dış doğrulama engeli açık

20 Ekim 2026. Task `task_01b3d73d1c16`, dispatch `ctx_85296ab7d57a`.

**Sonuç:** Gerçek 16 KB Android konukta çalışma zamanı testi yapılamadı. Resmi sistem imajının süre sınırlı kurtarma indirmesi `curl exit 28` ile sonlandı; 1.875.087.037 baytlık arşivin yalnız 756.547.575 baytı mevcut. Koordinatör tekrar denemelerin durdurulmasını istedi. APK'nın statik kontrolleri geçti, fakat bunlar konukta kurulum/açılış kanıtı değildir. Mağaza/yayın onayı verilmedi.

## Yapılan iş ve kanıt

- `docs/mobile-audit/development-package.md` ve `modules/12-platform-quality.md` incelendi. Çalışma MOB-21 / PLAT-WP03, WP04, WP09 native doğrulama kapsamındadır; bu alt kabul kapısı kapanmadı. MOB-20 dağıtım imzası ve fiziksel cihaz/mağaza onayı bu testle kapatılmaz.
- SDK kökü `/Users/emreaydin/Library/Android/sdk` altında yalnız izinli `system-images;android-36;google_apis_ps16k;arm64-v8a` revizyon 7 kurulumu denendi. Başka SDK paketleri güncellenmedi ve yeni lisans sorusu kabul edilmedi.
- İlk `sdkmanager` süreci, resmi arşivi 510.832.848 baytta soket okumasında beklerken saptandı. Yalnız bu çalışmaya ait PID 63293 kimliği doğrulanıp sonlandırıldı. Kısmi arşiv `/tmp/ngs-android16k-image-r07.zip` altında korundu.
- Aynı resmi Google HTTPS adresine `curl --continue-at - --connect-timeout 15 --speed-time 45 --speed-limit 1024 --max-time 900` ile tek kurtarma denemesi yapıldı. Aktarım ilerledi, fakat çıktı `Operation timed out after 951344 milliseconds with 245714727 out of 1364254189 bytes received` dedi ve süreç **28** koduyla çıktı. Yapılandırılan 900 saniye ile gözlenen süre ayrı kaydedildi; kesintinin kesin ağ/host nedeni kanıtlanamadı.
- Resmi repository metadata'sı beklenen arşiv boyutunu 1.875.087.037, SHA-1 değerini `dda632745023567113d9954101709c6526a3c250` olarak bildiriyor. Eksik arşive tam checksum doğrulaması veya başarılı kurulum sonucu atanmıyor.
- Son kanonik APK'nın hash'i koordinatörün `android-final-artifact.json` kaydıyla bağımsız eşleştirildi. `zipalign -c -P 16 4` yeniden çalıştırıldı: exit 0. APK içindeki 14 ARM64/x86_64 ELF kitaplığının bütün LOAD segmentleri bağımsız okunarak en az 16.384 hizalaması doğrulandı. Bazı kitaplıklarda, ARM64 Flutter engine dahil, RELRO bitiş modulo 16 KB sıfır değil; bu aritmetik gözlemden tek başına çalışma zamanı çökmesi veya başarı sonucu çıkarılmadı.

## Test edilen artefakt kimliği

| Alan | Değer |
|---|---|
| Kanonik yol | `mobile/build/app/outputs/flutter-apk/app-release.apk` |
| SHA-256 | `9c78b56f9caeed73b3334fdb9aee53505c25a5b980788ae716cc62cf56c528e1` |
| Boyut | 77.769.939 bayt |
| Paket | `com.ngsplus.app.ngsplusapp` |
| Sürüm | `1.0.4` / versionCode `1` |
| Hedef SDK | 36 |
| Ortam | Koordinatörün sabitlediği compile-only `.invalid` hedefi; çalışan hesabı kullanılmadı |
| İmza | Kanonik paket unsigned; `apksigner verify` exit 1, `Missing META-INF/MANIFEST.MF` beklenen sonucu |
| Test imzası | Oluşturulmadı; test anahtarı üretilmedi/kullanılmadı, mağaza anahtarına dokunulmadı |

## Gerçek çalışma zamanı kabul durumu

| Kabul | Durum |
|---|---|
| Yeni izole `ngs_release_16k_20261019` AVD | Oluşturulmadı; imaj kurulamadı |
| `adb shell getconf PAGESIZE` = 16384 | **Çalıştırılamadı / kanıt yok** |
| Geçici test imzalı kopyanın kurulması | Çalıştırılamadı |
| Soğuk açılış ve login UI ekran görüntüsü | Çalıştırılamadı; ekran görüntüsü yok |
| Plugin registration, native crash / ANR logcat kontrolü | Çalıştırılamadı; başarılı veya başarısız uygulama sonucu yok |
| Gerçek backend / çalışan / kapı işlemleri | Yapılmadı |

Login/kamera/izin/oturum davranışlarının bu cihazda başarılı olduğu iddia edilmiyor. Native çökme gözlenmedi ifadesi de kullanılmıyor: uygulama hiç başlatılmadı. Tam sistem imajı edinildikten sonra gerçek 16 KB guest, aynı/final hash'e bağlı geçici test imzalı kopya, kurulum, soğuk açılış, login screenshot, plugin/native/ANR logları gereklidir. Test imzası mağaza dağıtım kimliği veya yayın onayı sayılmamalıdır.

## Değişen dosyalar ve kontroller

Uygulama, dependency, pubspec, generated kaynaklar, yapılandırma veya build scriptleri değiştirilmedi. Flutter/Dart/Gradle/pod komutu çalıştırılmadı; kod regresyon testi eklenmedi çünkü görev yalnız native kabul ve kanıt kapsamındaydı.

- Bu rapor: `docs/mobile-release/reports/23-android-16k-runtime.md`.
- [Makine okunur sonuç ve temizlik](../evidence/android16k-runtime-result.json).
- [Süre sınırlı indirme hatası](../evidence/android16k-download-failure.txt).
- [Bağımsız ELF statik kontrolü](../evidence/android16k-elf-static.json).
- Koordinatörün mevcut [final artefakt kaydı](../evidence/android-final-artifact.json) ve [statik APK sonucu](../evidence/android-apk-verification.txt) salt okunur kullanıldı.

Son kontrolde yalnız kullanıcının önceden var olan `fq_ttt_api35` AVD'si listelendi ve `adb devices` boştu. Bu worker'ın indirme/emulator süreçleri çalışmıyor; yeni AVD veya konuk verisi oluşturulmadı. Kullanıcının AVD'si yeniden kullanılmadı, silinmedi veya wipe edilmedi. Kısmi resmi arşiv `/tmp` altında bırakıldı; tamamlanmış sistem imajı diye sunulmadı. Engelin kapanması için resmi imajın tamamlanması ve gerçek cihaz kabulünün yeniden yürütülmesi gerekiyor.

Teknik yöntem için [resmi Android 16 KB rehberi](https://developer.android.com/guide/practices/page-sizes) ve [emulator CLI rehberi](https://developer.android.com/studio/run/emulator-commandline) kontrol edildi; bu kaynaklar yerel runtime sonucunun yerine kullanılmadı.
