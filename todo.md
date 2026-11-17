# Açık işler — kapanış planı

Son kontrol: 2026-11-11 · Kaynak: çalışma ağacı, yerel testler, commit geçmişi ve 4–5 Kasım devir notları.
Netlify canlı yayın kimliği salt okunur doğrulandı: ngsplus.app · 6aeb0a3b7c330b6d2c8ec4ec (ready). Bu oturum yeni yayın veya canlı veri migration'ı yapmadı; eski yayın bilgileri devir notlarından gelir.

## 1. Mevcut değişiklikleri tamamla ve doğrula — ilk paket

- [x] Geçiş Kontrol + ziyaretçi kapı seçimi başlangıç kontrolü: 39 dosya / 273 test geçti; uygulama TypeScript temiz.
- [x] Yetki Durumu D1: üst sayaçları sabit proje özeti yap; liste hatasını boş sonuçtan ayır ve tekrar dene sun; onay kapanınca açan düğmeye odak dönsün (seçili düğme kalkarsa menüye); kişi ayrıntısı yüklenmesini ekran okuyucuya bildir.
- [x] D1 regresyonları: ilk sayfa/devam sayfası hata görünümü, yeniden deneme aksiyonu, onay odağı ve yüklenme bildirimi; hedefli paket 39 dosya / 278 test geçti.
- [x] Tam doğrulama: uygulama + Convex TypeScript 0 hata; src/convex ESLint 0 hata (önceden var olan 2 unused-vars uyarısı); tam Vitest 487 dosya / 5486 test geçti; Node runtime sızıntısı yok. Son Yetki Durumu koşusu 4 dosya / 48 test geçti.
- [x] Yerel tarayıcı: Yetki Durumu proje özeti departman filtresinde sabit (4 kayıt / 2 kişi); menü ve seçili kayıt onayları iptal edilince odak açan düğmeye döndü. 390 px Yetki Durumu + ziyaretçi formu ekran görüntüleri incelendi, yatay taşma yok. Boş ziyaretçi formu kaydı reddetti, alan hatalarını gösterdi ve kapı seçimine odaklandı. Cihaza gönderim ve gerçek ziyaretçi oluşturma yapılmadı.
- [x] Yayın adayını 131 açık path ile ayır; bağımsız PDKS rota/vardiya ekranı değişikliklerini hariç tut. İzole kaynak /tmp/ngs-closure-review.2hcu4yup, pathspec .claude/pathspec-open-closure.txt. Commit/yayın henüz yok.
- [x] Son doğrulama: çalışma ağacı 491 dosya / 5539 test; izole aday 491 dosya / 5537 test; app/Convex TS temiz, ESLint 0 hata + 2 mevcut uyarı, web build ve runtime sızıntı kontrolü temiz. Köprü 18 test. Kapı araması/boş sonuç/temizleme 390 ve 1440 px tarayıcıda doğrulandı.

Kapanış: tam kontroller yeşil; hata/başarı/yeniden deneme akışları doğrulanmış; görsel kontrol ve yayın durumu açıkça kayıtlı.
Bağlam: `.claude/plan-gecis-kontrol-2.md`, `.claude/pathspec-gk2.txt`, `.claude/pathspec-ziyaretci-kapi.txt`.

## 2. Geçiş Kontrol doğruluğu

Sıra: önce yanlış/güncel olmayan yetkiyi gösterme veya gönderme riski; sonra arama ve ölçek.

- [x] Tatil takvimi değişince yıl/proje kapsamındaki kapı planları yeni revizyonla yeniden gönderim bekler. Açık pencere canlı hedefi izler, yalnız bekleyen plan yeniden gönderilir; son tatil silindiyse cihazdaki eski tatil bağlantısı kaldırılır. Eski ACK yeni revizyonu başarılı gösteremez.
- [x] Kuralın son proje gönderimi indeksle bulunur; güncel cihaz kapsamına daralır. Yeni cihaz, gönderimden sonra değişen kural ve kural oluşturulmadan önceki proje gönderimi ayrı değerlendirilir.
- [x] Üyelik çıkarma/yeniden ekleme ve güncel cihaz kapsamı “yeniden gönderilmeli” hesabına dahil.
- [x] Kişi ayrıntısında cihaz bağlantısı, kontrol zamanı, güncel kural saat aralığı ve kişi geçerliliği gösterilir. Gönderim durumu fiziksel geçiş kanıtı sayılmaz.
- [x] Dinamik departman üyeliği: kullanıcı önerilen davranışı onayladı. Yeni/düzenlenen kurallar departman seçimini saklar; eski elle seçimlerden ilişki çıkarılmaz. Departmanla gelen yetki ayrılınca kalkar; elle/başka kuralla gelen erişim korunur. Oluşturma, düzenleme, toplu taşıma, içe aktarma, hiyerarşi, işe dönüş ve transfer noktaları bağlı; regresyonları geçti.
- [x] Kapı Planları: kapı/cihaz/bölge araması tüm yüklenen hedeflerde çalışır; 20 satırlık sayfalama, filtre değişiminde ilk sayfaya dönüş ve yalnız görünen sayfanın toplu seçimi. 1000 kapı aşımı sessiz eksik liste üretmez; sınır hatası verir. Büyük projeler için sunucuda hedef sayfalama ayrıca açık.
- [ ] Tüm kişilerde arama, çevrimdışı dönüşte otomatik gönderim, geceyi aşan kural saat aralığı ve hafif sorgular.

Kapanış: kapsam, eski hakkı kaldırma ve yeni hakkı dağıtma testleri; gerçek cihaz gönderim doğrulaması.
Karar bağlamı: `.claude/plan-gecis-kontrol-2.md` Faz E/G.

## 3. Genel audit — kalan backend işleri

4 Kasım devir notuna göre güvenlik/PDKS paketleri ve hafta tatili değişikliği yayımlanmış; eski checklist bunları hâlâ açık gösteriyor. Yeniden uygulama yapılmayacak; kalanlar:

- [x] PDK-005 kodu: tarihli departman/şirket kaydı, yazma noktaları, tarihe göre resolver, idempotent migration ve kişisel veri döndürmeyen önizleme hazır. Geçmiş değişiklikler bilinmediğinden başlangıç kaydı mevcut departmanı eski tarihler için korur; geçmiş hiyerarşi yeniden kurulmaz.
- [ ] PDK-005 canlı önizleme/backfill ve doğrulama; color temizliği sonrası şema daraltma ayrı yayın adımıdır.
- [x] CIH-08 disk kuyruğu atomik/özel izinli; yeniden başlatma, token rotasyonu ve 429 Retry-After testli. CIH-09 sayfa sınırı/ilerlemeyen tarama başarısız-kısmi döner. Köprü Node testleri 18/18.
- [x] Alarm kritik/iyileşme eşlemesi, indeksli tekrar engeli, kararlı alıcı anahtarı + dondurulmuş e-posta gövdesi ve IDE/localBridge gecikmeli çevrimdışı kontrolü eklendi. Mevcut cihazların son sinyalini değiştirmeden başlangıç izlemesini kuran initializeDeviceHeartbeatChecks migration hazır; canlı koşumu bekliyor.
- [x] Kapı komutunda kullanıcı/kapı/kanal/işlem kimliği ve queued/sent/failed aşaması; kural/rol/sır değişikliğinde alan bazlı kayıt; toplu PDKS için çalışan-gün eski/yeni değer + batchId denetimi.
- [x] Yeni kişi denetimi operasyonel alan izin listesiyle sınırlı; kart/sır/ücret/not kopyalanmaz. Eski kopyalar API yanıtında maskelenir, kişi silme/anonimleştirme zinciri geçmişi partiler halinde temizler.
- [ ] Eski audit verisinin kontrollü önizleme/migration koşumu ve canlı doğrulaması.
- [x] PDK-013: yalnız tarihe bağlı vardiya parçasının ilk geçerli girişinde geç bildirimi; normal çıkış, öğle dönüşü, tekrarlı okutma ve pencere dışı giriş mail üretmez. Bildirim saati Europe/Istanbul; tek işlemde kayıt + planlama.
- [ ] Sonraki paket: onaylı izin iptali, çoklu vardiya ara düzeltme, silinen IDE UUID sahipliği ve bordro sayfalama.

Kapanış: her paket için ilgili regresyonlar + tam doğrulama; köprü/migration yayını ve saha kanıtı ayrı kayıt.
Bağlam: `.claude/handoff-genel-audit-fix.md` (güncel durum), `.claude/plan-genel-audit-fix.md` (ayrıntı; eski kutular güncel durum değildir).

## 4. Saha doğrulaması — cihaz erişimine bağlı

- [ ] NGS0002: kapı hedefi değişimi ve kapı planı gönderimi.
- [ ] ANKA001: aktarım önizlemesi, kapı/tarih kısıtları, eşleşen kişiye parmak izi dağıtımı.
- [ ] IDE: yerel kişileri koruyarak hedefli erişim iptali; Katman-2 canlı panel testi.
- [ ] Hik: yüz silme, AcsEvent backfill, ISAPI yanıt şekilleri ve RemoteControl/DELETE sonuçları.
- [ ] Ziyaretçi: geçersiz tarih aralığının cihazda erişim açmaması.
- [ ] PDKS ayarları tarayıcı turu + cardReaderNo kontrolü; DS-K2804 roster route eksikliği için köprü kararı.
- [ ] Eski “emre projesinde 5 gönderilmemiş yetki” kaydının güncelliğini canlıdan doğrula; devam ediyorsa gönderim yap.

Cihazdan kişi aktarımı geliştirmesi tamamlanıp yayımlanmış; bu başlıkta kalan iş saha kabulüdür (`.claude/handoff-cihaz-aktarim.md`).

## 5. Mobil kabul ve mağaza

- [ ] Gerçek cihaz, kamera ve VoiceOver kabulü; aydınlatma URL/sürüm sunumunu tamamla.
- [ ] Takvim görsel kabulü + telefona kurulum. Kod c6d87385 ile commit edilmiş; eski plandaki commit kutusu artık geçersiz.
- [x] Mobil yerel doğrulama: flutter analyze sorunsuz; 820 test geçti; izin/privacy manifest kaynak önkontrolü geçti. Mevcut iOS bundle kimliği com.ngsplus.app, takım T9QCW8Q2C3; Android kimliği com.ngsplus.app.ngsplusapp.
- [ ] Mağaza geçmişine göre artan version/build, dağıtım imzası/profil ve Android imza SHA256 bilgisiyle imzalı build + gerçek cihaz kabulü. Kaynak sürüm 1.0.4+1 korundu; imza önkontrolleri eksik dış bilgiler nedeniyle duruyor.
- [ ] Mağaza gönderimi/yayını.

Kapanış: cihaz test kanıtı + imzalı build + mağaza sonucu.
Bağlam: `.claude/handoff-mobil-ui.md`, `.claude/plan-takvim.md`, `docs/mobile-release/`.

## 6. Ürün kararları / eski listeden doğrulanacaklar

- [x] Kullanıcı kararı: plan dışı saatlerde mevcut normal çalışma davranışı yeterli; yeni “Mesai dışı kilitli” seçeneği eklenmeyecek. Madde kapatıldı.
- [x] Kullanıcı kararı: ara çıkış–giriş kaydı olmayan tamamlanmış günlerde tanımlı sabit mola düşülür; geçmiş tüm dönemlere uygulanır. Kayıtlı ara çıkış varsa ikinci mola yok; eksik günlerde kesinti yok. Sabit vardiyada katılımın mola penceresiyle kesişimi, esnekte sabit süre kullanılır. Tarih/gece/yarım gün/tutar/kısmi ve eksik okutma regresyonları geçti.
- [x] clearShiftColors karşılığı denetlenebilir removeShiftColors component migration hazır. Eski color alanı canlı temizlik doğrulanana kadar opsiyonel tutuluyor; daraltma henüz yapılmadı.
- [ ] KVKK Faz 1 imha/saklama + B5 aggregate paketinin güncel kapsamını yeniden kontrol et (personel rıza takibi efbeec9c ile kaldırıldı).
- [ ] Eski sistem audit ve Vardiya ↔ Hik karşılaştırma listelerinin güncel kodla mutabakatı.

Bağlam: `.claude/handoff-esnek-sabit.md`, `.claude/plan-pdks-ayarlar.md`, `.claude/handoff-sistem-audit-kalan.md`, `.claude/handoff-vardiya-hik.md`.

Yayın adayı ve doğrulama raporu: [docs/open-work-closure-2026-11-11/README.md](docs/open-work-closure-2026-11-11/README.md). Canlı geçiş dört migration içerir ve proje planındaki faz başına yayın onayını bekler.

## Uygulama sırası

1 → 2'nin yetki doğruluğu maddeleri → 3'ün cihaz güvenilirliği/denetim maddeleri → tarihli departman migration'ı → arama/ölçek iyileştirmeleri.
Saha ve mobil kabul, gerekli cihaz/hesap erişimi sağlandığında ilgili paketin ardından kapanır. Bu oturumdaki üç ürün kararı kapatıldı. Tamamlandı işareti yerel kod/test kapsamını belirtir; canlı migration, köprü kurulumu, cihaz kabulü ve mağaza sonucu ayrıca açık tutulur.
Her geliştirme paketi: kod → regresyonlar → TypeScript/ESLint/tam test → tarayıcı veya cihaz kanıtı → commit/yayın kaydı.
