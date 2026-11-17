# Açık işler — 11 Kasım 2026 yayın adayı

Kod ve yerel doğrulama hazır. Commit, push, Convex/web yayını, canlı migration, fiziksel kapı işlemi veya mağaza gönderimi yapılmadı. Bu paket bütün backlog'un kapandığı anlamına gelmez; kalan işlerin güncel kaydı [todo.md](../../todo.md).

## Kullanıcının onayladığı davranışlar

- Departman seçilen yeni/düzenlenen kurallar üyeliği takip eder. Ayrılan kişinin yalnız departmandan gelen yetkisi kaldırılır; elle/başka kuralla gelen erişimi korunur. Eski manuel kişi listelerinden departman ilişkisi tahmin edilmez. Aynı işlemde departmandan ayrılıp elle atanmak da korunur.
- Kapı planı dışındaki saatlerde mevcut normal davranış korunur. “Mesai dışı kilitli” seçeneği eklenmeyecek; ürün maddesi kapalı.
- `eachPunch` hesabında ara çıkış–giriş kaydı olmayan tamamlanmış günlerde tanımlı sabit mola düşülür. **Geçmiş tüm dönemlere uygulanır.** Ara okutma varsa ikinci kesinti yapılmaz; eksik günlere varsayımsal mola eklenmez. Sabit vardiyada gerçek katılım ile mola penceresinin kesişimi, esnekte tanımlı sabit süre kullanılır. Tanımsız molaya yeni varsayılan süre eklenmez. Geçmiş rapor yeniden hesaplandığında yeni sonuç görünür; ham okutmalar değiştirilmez.

## Paketin kapsamı

- Geçiş Kontrol: proje sayaçları, hata/yeniden deneme, onay odağı, yüklenme bildirimi; son gönderimin güncel cihaz ve kural kapsamı; üyelik kaynaklı eski durum teşhisi; kişi ayrıntısında bağlantı/saat/geçerlilik kontrolü.
- Kapı Planları: takvim değişikliğinde yıl/proje kapsamlı revizyon ve yeniden gönderim; açık pencerede canlı değişim; eski ACK koruması; son tatil kaldırılınca cihazdaki bağlantıyı kaldırma. Kapı/cihaz/bölge araması ve 20 satırlık sayfalama; toplu seçim görünen sayfa içindedir. Liste 1000 proje kapısını aşarsa eksik sonuç göstermeden hata verir; büyük projeler için sunucu sayfalaması henüz eklenmedi.
- Dinamik departman: şema, kural formu/ayrıntısı, oluşturma, kişi/departman düzenleme, toplu taşıma, içe aktarma, işe dönüş ve transfer bağlantıları. Hiyerarşi uzlaştırması beş kişilik işlemlerle sürer.
- Tarihli departman/şirket: sürümlü geçmiş ve resolver. Başlangıç kaydı mevcut davranışı korur; bilinmeyen geçmiş hareketleri yeniden kurmaz. Departmanların eski üst ağaç yapısı sürümlenmedi.
- Cihaz güvenilirliği: yeniden başlatmaya dayanıklı özel izinli disk kuyruğu, 429 Retry-After, kısmi/ilerlemeyen taramada doğru başarısızlık; köprü kurulum belgesi.
- Alarmlar: kritik/iyileşme önem eşlemesi, indeksli tekrar engeli, kararlı e-posta anahtarı/gövdesi, IDE/localBridge kesintisi sürerken alarm. Mevcut cihazlara başlangıç kontrolü kuran migration da hazır.
- Denetim: kapı komutunda kullanıcı/kapı/kanal/işlem ve queued/sent/failed aşaması; kural/rol/sır alan değişiklikleri; çalışan-gün bazında toplu PDKS eski/yeni ve batch kimliği. Kişi verisinde operasyonel izin listesi, eski API yanıtlarını maskeleme, kişi silme zincirinde geçmiş kopya temizliği.
- PDK-013: yalnız tarihe bağlı vardiya parçasının ilk geçerli girişinde bildirim. Normal çıkış, öğle dönüşü, tekrar ve pencere dışı giriş mail üretmez; bildirim saati Europe/Istanbul.
- Ziyaretçi kapı seçimi ve mevcut Geçiş Kontrol arayüz değişiklikleri bu adayda birlikte doğrulandı. Bağımsız PDKS rota/vardiya ekranı değişiklikleri hariç tutuldu.
- Migration bileşeni eklendi; Vite/Zod güncellendi. Kilit dosyası değişikliği paketin parçasıdır.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Tam çalışma ağacı Vitest | 491 dosya / 5539 test geçti |
| İzole yayın adayı Vitest | 491 dosya / 5537 test geçti |
| İzole app + Convex TypeScript | 0 hata |
| İzole src/convex ESLint | 0 hata; önceden var olan 2 unused-vars uyarısı |
| İzole web build + runtime sızıntı kontrolü | Geçti; mevcut ExcelJS büyük chunk uyarısı |
| Köprü Node testleri | 18 geçti |
| Mobil analiz + test | Sorun yok / 820 test geçti |
| Mobil izin/privacy manifest kaynak önkontrolü | Geçti |
| npm audit | 0 kritik/yüksek; 10 orta bulgu devam ediyor |
| Tarayıcı | Yetki Durumu filtre/sayaç/odak ve ziyaretçi doğrulama önceki turda; yeni kapı araması/boş sonuç/temizleme 390 ve 1440 px, yatay taşma yok |

Test sayısı farkı, bağımsız PDKS ekranı değişikliklerinin izole adaya alınmamasından gelir. Kaynaklar [manifestte](source-manifest.json); 131 dosyalık değişiklik listesi [.claude/pathspec-open-closure.txt](../../.claude/pathspec-open-closure.txt). İzole kopya: `/tmp/ngs-closure-review.2hcu4yup`. [Mobil kapı araması görüntüsü](door-plans-mobile.png). Sayfalama 41 kapılı bileşen testiyle doğrulandı; canlı projede iki hedef vardı.

Kanıt logları: [tam test](vitest-workspace.log), [izole test](vitest-isolated.log), [TypeScript uygulama](app-tsc.log), [TypeScript backend](convex-tsc.log), [ESLint](eslint.log), [köprü](bridge.log), [derleme](build.log).

## Bekleyen canlı geçiş

Hedef: `ngsplus.app`, Netlify `ngsaccess` (`f2124c82-3578-4c31-9c0c-21bf4abd5a0a`). Mevcut yayın salt okunur doğrulandı: `6aeb0a3b7c330b6d2c8ec4ec`, ready. Yerel seçili Convex: `dev:notable-tern-4`; Canlı web giriş dosyası /assets/index-Cvmn7SNT.js içinde de https://notable-tern-4.convex.cloud doğrulandı; yayın bu hedefte kalır. Adında dev geçmesi nedeniyle otomatik olarak başka bir production deployment seçilmez.

1. Onaydan sonra bu izole kaynaklardan genişletilmiş backend/indeks/bileşen yayını.
2. `dataMigrations:previewEmployeeDepartments` ve `dataMigrations:previewEmployeeAuditMinimization` imleç bitene kadar salt okunur sayım. Bunlar eski kişisel veriyi çıktılamaz; kişisel veri içeren migration'larda component dryRun'ın belge değerlerini loglaması nedeniyle canlı önizlemede bu özel sorgular kullanılır.
3. Ayrı migration işleri: `dataMigrations:backfillEmployeeDepartments`, `dataMigrations:initializeDeviceHeartbeatChecks`, `dataMigrations:removeShiftColors`, `dataMigrations:minimizeEmployeeAudit`. Durum, component'in `lib:getStatus` sorgusuyla izlenir. Audit temizliği eski kişi verisi kopyalarını kalıcı kaldırır; heartbeat başlangıcı mevcut kesintiler için ayarlı alarm/e-posta akışını başlatabilir. Bu canlı koşumlar henüz yapılmadı.
4. Önizleme/sonuç sayımlarını doğrula, sonra aynı hedefle web yayını ve tarayıcı kabulü. Temizlenen color alanını ancak canlı doğrulama ardından ayrı daraltma adımında kaldır.
5. Köprü dosyalarını hedef sunucuya kur ve gerçek yeniden başlatma/429/backfill akışını doğrula; cihaz kabulü ve mobil mağaza kabulü ayrıca kapanır.

## Açık kalan geliştirmeler ve dış kabul

Tüm kişilerde arama; çevrimdışı dönüşte otomatik yetki gönderimi; geceyi aşan kural aralıkları; büyük projeler için hafif/sayfalı hedef sorguları; onaylı izin iptali; çoklu vardiya ara düzeltme; silinen IDE UUID sahiplik kaydı; bordro sayfalama. Bunlar tamamlandı olarak işaretlenmedi.

NGS0002/ANKA001/IDE/Hik saha kabulü, gerçek kamera/VoiceOver/telefon kurulumu, mağaza geçmişine uygun artan build ve dağıtım imzası bekliyor. Mobil kaynak sürümü 1.0.4+1 korundu; iOS dağıtım profil/takım ortam bilgileri ve Android beklenen signer SHA256 eksikliği imzalı yayın önkontrolünü durduruyor. Tam mağaza kabulü verilmedi.
