# NGS Plus mobil yayın hazırlığı

Sonraki kontrol turu: [kütüphane güncellemeleri ve bağlı iPhone kurulumu](device-review.md). Önceki audit/native kayıtları tarihsel checkpointtir; güncel paket sonuçları bu ek rapordadır.

Bu paket 12 modülün auditini uygulamaya dönüştürür. 92 özgün iş paketi (74 yerel doğrulamalı, 18 dış kabul koşuluna bağlı) ve 24 MOB kartı [kapanış matrisinde](audit-closure.md), kaynak/test/kanıt bağlantılarıyla izlenir. 23 uygulama, entegrasyon ve inceleme worker’ı görevlendirildi; görev kimlikleri [workers.json](workers.json), son yaşam döngüsü sonuçları [worker kayıtlarında](evidence/worker-outcomes-final.json) saklanır.

**Yayın kararı: mağazaya gönderim bekliyor.** Yerel kod, test ve derleme sonuçları aşağıdaki kanıtlarla değerlendirilir. Gerçek ortam, onaylı dağıtım imzaları, mağaza içerikleri ve donanım kabulü olmadan tam yayın kabulü verilmez. Backend deployment, broker cutover veya mağaza gönderimi yapılmadı.

## Uygulanan davranış

- Oturum güvenli depoda tutulur; eski parola/token tercihleri temizlenir. Parola hatırlama kaldırıldı; çıkış yerelde anında etkili, uzak iptal sınırlı süreli. Gerçek parola değiştirme, parola sürümüyle eski oturum iptali ve sunucu giriş kotası eklendi.
- HTTP560/Convex iş hataları türlenir; bilinmeyen hata içeriği kullanıcıya açılmaz. Oturum değişiminden sonra geç gelen yanıtlar reddedilir. Sorgu tekrarları sınırlı, değişiklik çağrıları varsayılan tek denemedir.
- Kapı komutu, panel onayı ve gerçek geçiş ayrı kavramlardır. Kalıcı istek kimliği, sunucu idempotency, yeniden uzlaştırma, hedef/IO/yetki kontrolü ve zaman aşımı eklendi. Belirsiz sonuç yeni komut gönderimini engeller; sahte yoklama üretilmez.
- QR; oturum, proje, amaç ve süreyle bağlı tek kullanımlık okuyucu akışına dönüştürüldü. Kamera görünürlük ve uygulama yaşam döngüsüyle yönetilir; telefonla statik QR okutmak geçiş kanıtı sayılmaz.
- Geçmiş cursor ile yüklenir; canlı başlık, arşiv ve bağımsız dönem özeti ayrıldı. İstanbul takvim sınırları, eski yanıt yarışları, denied/unknown durumları ve eksik özet sınırları açıkça ele alındı. Bordro/vardiya hesap motoru eklenmedi.
- Ziyaretçi ön kayıtları yalnız kendi ev sahibi adına oluşturulur ve başlangıçta pasiftir. Gerçek kart ve erişim profili web operatörü tarafından atanır; atomik aktivasyon, iptal, süre dolumu, arama/filtre, nullable alan temizleme ve gerçek senkronizasyon durumları uygulandı.
- Profilde yöneticiye ait alanlar salt okunur; çalışan parola değiştirebilir. Sistem/TR/EN dili, kalıcı tema, gerçek paket sürümü, yerel destek raporu kopyalama/temizleme ve erişilebilir durum bildirimi eklendi. TR/EN 367 anahtar eşleşir.
- Açılış/rota/DI kaynak sahipliği birleştirildi. Hesap/ortam değişimi, geciken preference yazımı, dispose ve kaynak yaşam döngüsü yarışları testlerle korundu. Büyük yazı ve Semantics kontrolleri genişletildi; sistem fontlarıyla ağdan font indirme kaldırıldı.
- Android minimum API 24/hedef API 36, iOS 15+, sabit SDK/native araç zinciri, privacy manifest, minimum izinler, session backup engeli, imza doğrulama, 64-bit ELF/ZIP16KB kontrolleri ve CI/yayın betikleri eklendi. Normal Android release eksik imzada durur.
- MQTT kaynak kodunda cihaza özel kimlik/ACL/TLS ve kaynak UUID doğrulaması eklendi. Mevcut ortak broker hesabı otomatik dönüştürülmedi. Mobil IDE açma, gerçek izolasyon doğrulaması ve operatör beyanı gelene kadar kapalıdır; uyumsuz Hik localBridge mobil açma desteklenmez.

## Son doğrulama ve paketler

Kesin çıkış kodları, kaynak parmak izleri, derleme kimlikleri ve artifact hash’leri [final-verification.json](final-verification.json) içinde; son sonuçlar aynı kayıtta birleştirildi.

| Kontrol | Sonuç / kanıt |
|---|---|
| Flutter statik analiz | Sorun yok — [log](evidence/flutter-analyze-last.txt) |
| Flutter testleri | 433 başarılı — [son tam koşu](evidence/flutter-test-last.txt) |
| Web/backend testleri | 219 dosya, 2349 başarılı — [log](evidence/vitest-final3.txt) |
| TypeScript uygulama + Convex, ESLint | Çıkış0 — [kayıt](evidence/backend-final-exits.json) |
| Release betikleri | 25 Python testi — [log](evidence/platform-preflight-tests-final.txt) |
| MQTT politika/routing/provision | 19 Node testi — [politika](evidence/mqtt-isolation-tests.txt), [provision](evidence/ide-provision-tests.txt) |
| Bağımlılıklar | npm audit0 — [JSON](evidence/npm-audit-final.json); [inceleme](reports/17-dependency-security.md) |
| Android release APK | Derleme ve 64-bit ELF/ZIP16KB kontrolleri başarılı; mağaza imzasız — [log](evidence/android-unsigned-final2.txt) |
| iOS simulator + release/no-sign | Başarılı — [simülatör](evidence/ios-simulator-final.txt), [release](evidence/ios-nosign-final.txt), [login görüntüsü](evidence/ios-simulator-login-final.png) |
| iOS native paket testleri | XCTest başarılı — [log](evidence/ios-xctest-final2.txt); ilk runner timeout kaydı korunur |
| Kilit/generation tekrar kontrolü | pub ve pod restore başarılı, lock/project/generated drift yok — [kayıt](evidence/post-build-final.json) |
| Android16KB runtime | Açık: resmi sistem imajı indirmesi zaman aşımı; statik hizalama geçti, emülatör çalıştırma henüz kanıtlanmadı |
| Web build | Başarılı; mevcut büyük chunk uyarısı — [log](evidence/web-build.txt) |

Derleme için kullanılan `https://mobile-build.invalid` yalnız derleme/emülatör kontrolü içindir. Çalışan staging servisi veya gerçek hesap kabulü değildir. Native artifact ayrıntıları son doğrulama kaydında belirtilir. Geçmişte başarısız olmuş ara loglar korunur; bunlar son başarılı koşunun yerine kullanılmaz.

## Yayından önce gerçek kabul koşulları

1. Mevcut mağaza kimliğiyle Android upload keystore, Apple Distribution/provisioning ve mağaza geçmişine göre artan version/build; final imzalı AAB/IPA doğrulaması. Şu an sürüm1.0.4+1 korundu.
2. Onaylı staging/production hedefinde schema/index/function deployment ve gerçek çalışan/operatör hesabıyla oturum, ziyaretçi, süre dolumu, geçmiş, erişim ve response-loss testleri.
3. Gerçek reader/panel/firmware, kapalı/açık ağ, geç/tekrar ACK, broker ACL/TLS ve eski retained/session temizliği. Komut onayı ile fiziksel geçiş bağımsız gözlenmeli. IDE isolation flag’i kanıt olmadan açılmamalı.
4. Android/iOS fiziksel cihazda izin reddi/ayar dönüşü, kamera, cold start, önceki sürümden upgrade, secure storage, düşük OS ve TalkBack/VoiceOver kabulü. Emülatör login açılışı bu testlerin tamamı değildir.
5. Gerçek yayımlanmış gizlilik ve destek URL’leri, veri güvenliği/mahremiyet beyanları, hesap silme değerlendirmesi, inceleme hesabı ve mağaza materyalleri. Uygulamadaki yerel açıklama hukuki gizlilik politikasının yerini tutmaz.
6. Korumalı CI ortamı, imza sırları, gerçek runner kontrolleri ve dağıtılan obfuscated artifact için özel symbol/dSYM kasası. Kontrollü release hatası → güvenli destek kopyası → eşleşen sembollerle çözümleme kanıtı gerekir.

Uygulama komutları ve kontrollü yayın sırası [mobile/release/README.md](../../mobile/release/README.md), doldurulacak mağaza şablonu [store-review-template.md](../../mobile/release/store-review-template.md) içindedir. İlgili dış koşullar kapanış matrisinde tamamlanmış sayılmaz.

## Worker teslimleri

Her görev kendi raporunda değişikliği, test kapsamını ve kalan sınırı açıklar. Son birlikte doğrulama bu README ve final-verification kaydındadır; bir worker’ın eski ara test sayısı son genel sonuç sayılmaz.

| Worker | Sonuç | Teslim |
|---|---|---|
| 01-transport | Başarılı | [01 — Transport, yapılandırma ve güvenli yerel diagnostics](reports/01-transport.md) |
| 02-mobile-auth | Başarılı | [Mobil auth uygulama teslimi](reports/02-mobile-auth.md) |
| 03-attendance-data | Başarılı | [03 — Attendance veri katmanı teslimi](reports/03-attendance-data.md) |
| 04-history-ui | Başarılı | [04 — History UI uygulama teslimi](reports/04-history-ui.md) |
| 05-qr | Başarılı | [05 — QR uygulama teslimi](reports/05-qr.md) |
| 06-home-design | Başarılı | [06 — Home, ortak kartlar ve tema uygulaması](reports/06-home-design.md) |
| 07-platform | Başarılı | [07 — Platform implementation and release preparation](reports/07-platform.md) |
| 08-profile-localization | Başarılı | [08 — Profil, kapsamlı hedef tercihi ve yerelleştirme teslimatı](reports/08-profile-localization.md) |
| 09-backend-auth | Başarılı | [Backend auth teslimi — 19 Ekim 2026](reports/09-backend-auth.md) |
| 10-backend-attendance | Başarılı | [10 — Mobil attendance backend teslimi](reports/10-backend-attendance.md) |
| 11-backend-access | Başarılı | [11 — Mobil erişim backend teslimi](reports/11-backend-access.md) |
| 12-visitors | Başarılı | [12 — Çalışanın kendi ziyaretçi davetleri](reports/12-visitors.md) |
| 13-composition | Başarılı | [13 — Composition, bootstrap ve navigation teslimi](reports/13-composition.md) |
| 14-mobile-operations | Başarılı | [Mobil kapı işlemleri — uygulama teslimi](reports/14-mobile-operations.md) |
| 15-schema-auth-integration | Başarılı | [Schema ve auth son entegrasyonu — 19 Ekim 2026](reports/15-schema-auth-integration.md) |
| 16-visitor-web-activation | Başarılı | [16 — Mobil ön kaydın web operatör tarafından etkinleştirilmesi](reports/16-visitor-web-activation.md) |
| 17-dependency-security | Başarılı | [17 — Kök npm bağımlılık güvenliği teslimi](reports/17-dependency-security.md) |
| 18-client-integration | Başarılı | [Mobil core/auth/history entegrasyon düzeltmeleri](reports/18-client-integration.md) |
| 19-access-security-review | Başarılı | [Mobil erişim güvenlik ve doğruluk incelemesi](reports/19-access-security-review.md) |
| 20-audit-closure-ledger | Başarılı | [20 — 92 alt iş ve 24 MOB kartı kapanış defteri](reports/20-audit-closure-ledger.md) |
| 21-mqtt-isolation | Başarılı | [21 — MQTT per-panel isolation implementation](reports/21-mqtt-isolation.md) |
| 22-diagnostics-export | Başarılı | [22 — Güvenli yerel destek raporu](reports/22-diagnostics-export.md) |
| 23-android-16k-runtime | Tamamlanamadı: imaj indirme | [Android 16 KB ARM64 runtime kabulü — başarısız / dış doğrulama engeli açık](reports/23-android-16k-runtime.md) |

Önceki audit: [modül raporları](../mobile-audit/README.md) ve [geliştirme paketi](../mobile-audit/development-package.md). Bu çalışma commit/push yapmadı; başlangıçtaki bağımsız web/backend değişiklikleri korunmuştur.
