# Modüller arası ilişkiler audit'i — 25 Ekim 2026

## 1. Sonuç

Kişi, cihaz ve mobil erişim arasında birçok iptal denetimi mevcut; ancak hesap durumu → otomatik rapor, kişi silme → bekleyen talepler ve kişi e-postası → mobil giriş bağlantıları eksik. Projeyi pasifleştirmek bütün kanalları durduran ortak bir işlem değil; fiziksel cihaz teslimi, bulut kararı ve geçmiş raporu ayrı değerlendirilmelidir. **Yeni bulgular: P0: 1 / P1: 3 / P2: 0 / P3: 1; toplam 5**; M1–M5 bulguları ve eski audit açıkları tekrar sayılmadı.

**İnceleme sınırı:** M1–M5'in ilişki ve eski audit bölümleri okundu; ilgili backend/web/mobil/köprü kaynaklarında bağlantılar izlendi. Başlangıç spec'i `520ba5fc` dese de okunan HEAD `77bce329`: arada `5de547a8` mobil talepleri commit etmiş; bu rapor anında talep dosyaları HEAD ile aynı, artık “commit'siz WIP” değil. Çalışma ağacındaki başka oturuma ait `docs/hikconnect-audit/KIYAS.md` değişikliğine dokunulmadı. Yalnız bu rapor yazıldı; test/build, DB/cihaz/ağ çağrısı, Convex CLI ve git değiştirme komutu çalıştırılmadı. “KESİN” kaynak kodu kanıtıdır, canlı dağıtım veya fiziksel kabul değildir.

## 2. Modül ilişki haritası

| Ortak veri / arayüz | Yazan | Okuyan / bağımlı | Ortak sözleşme |
|---|---|---|---|
| `employees` | M1 kişi/ziyaretçi; M5 ziyaretçi ön kaydı | M2 roster ve olay eşleme; M3 vardiya/PDKS; M5 oturum/talep | Güncel `projectId`, kart, aktiflik ve bitiş tarihi bütün tüketicileri etkiler; tarihsel üyelik yok. |
| `groupMembers/groupDevices/groupDoors`, `accessRules` | M1 kurallar ve kişi formu | M2 Hik/IDE; M5 kapı/QR | Cihaz hedefi silinmeden snapshot gerekir; kart metni IDE'de sayıya dönüşür. |
| `employeeAuth/employeeSessions/checkInTokens` | M4 kurulum; M5 giriş/QR | M5 her istek; M2 QR tüketimi | Kimlik `employeeId`, parola sürümü ve token; `users` web hesabından bağımsız. |
| `hikPendingOperations/idePendingOperations` | M1 yaşam döngüsü, M2 komut/senkron, M5 kapı | Köprüler, retry, grant sonuçları | Mobil komutta ek TTL/oturum denetimi var; genel kuyruk buna otomatik tabi değil. |
| `accessGrantStatus/deviceSyncRuns/deviceSyncRunTargets` | M2 teslim sonuçları | M1 Yetki Durumu, M2 yeniden dağıtım | İstenen izin ile cihazın onayladığı izin farklı; eski kimlik silmesini yeni kimlik başarısı kapatmaz. |
| `cardReadings/deviceEvents` | M2 canlı olay/backfill, M5 QR | M3 PDKS/rapor, M4 alarm/asistan/saklama | UTC olay zamanı + İstanbul iş günü; biyometrinin PDKS dışı olması kasıtlı. |
| `shiftAssignments/departmentShiftAssignments/shiftPlanRefs` | M3 planlar; M1 kişi silme | M3 ortak çözümleyici; M2 gece yönü | Kişi silmede kişi ataması/referansı silinir; departman planı ortak kaldığı için korunur. |
| `leaves/attendanceCorrections/pdksRecords` | M5 başvuru; M3 yönetici kararı | M3 bordro/rapor; M5 sonuç | Başvuru güncel kişiye bağlı; kişi silme karar yolunu koparıyor (R-03). |
| `users/userProjects/projectRolePermissions/projects` | M4 yönetim | Tüm web uçları, otomatik rapor kapsamı | Oturumlu yetki kontrolü ile cron adına yapılan kontrol eşdeğer değil (R-01). |
| `employeeConsents`, biyometri, `pendingUploads` | M1/M4 | M2 cihaz imhası, M4 tutanak | Merkez dosyası, cihaz şablonu, ham olay ve QR isim kopyası ayrı saklama alanları. |

### Kimlik tutarlılığı

| Kimlik | Kodda uygulanan kural | Modüller arası karar |
|---|---|---|
| Kart metni | `convex/employees.ts:46`, `employeeImport.ts:55,113`: global tam metin çakışması; `cardReadings.ts:453`: cihaz projesinde metin eşlemesi | `actions/ideGatewayDevice.ts:131,208` sayıya dönüştürür; `00123` ve `123` aynı IDE id'si. **M1 K-04**, yeni sayılmadı. |
| IDE UUID | Özel panel yolunda kontrol: `convex/lib/deviceProvision.ts:153`; genel create/update aynı kontrolü taşımıyor: `:108`, `convex/devices.ts:182,233` | **M2 C-01** geçerli; MQTT hedefi kayıttaki UUID. Index tek başına tekillik zorlaması değildir. |
| Hik ehomeID | `convex/lib/deviceProvision.ts:16,82,269`, `convex/devices.ts:240`: trim + başka kayıt araması | Güncel uygulama yazma yollarında global tekillik korunmuş; önceden var olan çakışmaların canlı envanteri bilinmiyor. |
| Cihaz seri / hikDevIndex | `convex/lib/deviceProvision.ts:109,278`: seri doğrudan yazılır; `convex/devices.ts:343,346` seri araması ilk eşleşmeyi kullanır | ehomeID ile aynı genel tekillik güvencesi yok; token'a sabitlenen HTTP yolu `convex/http.ts:263` daha güçlüdür. Legacy token'sız/relay kullanımına bağlı etki canlı teyidi ister; ayrı kesin sızıntı iddiası yapılmadı. |
| Çalışan e-postası | Kişi create/update ve import tam değeri saklar (`convex/employees.ts:220,322`, `employeeImport.ts:68`); mobil giriş trim+lowercase arar (`employeeAuth.ts:203,211`) | **R-02**: sunucuda tek kanonik biçim yok. Web formunun `useEmployeeFormSubmit.ts:80` düzeltmesi public backend sözleşmesini tamamlamıyor. |
| employee ↔ employeeAuth | Giriş e-postayı `employees` üzerinde bulur, parolayı `employeeId` ile çözer (`convex/employeeAuth.ts:209,222`); auth oluşturma ayrı insert (`:75,86`) | `employeeAuth.email/projectId` kopyası kişi update'inde eşitlenmez; auth e-postası giriş anahtarı değildir. `by_employee` unique constraint değil; create içinde upsert/tekillik denetimi yok, eşzamanlı iki kurulum action'ı için OLASI mükerrer auth riski. |
| employees ↔ users | Web `convex/auth.ts:8,45`, mobil `convex/employeeAuth.ts:174` ayrı hesap modelleri | Ortak e-posta iki hesabı bağlamaz; web hesabını dondurma fiziksel kartı veya mobil hesabı kendiliğinden iptal etmez. Bu ayrım bilinçli; aynı kişi sanılıp operasyonel iptal atlanmamalı. |

### Zaman sözleşmesi

| Yol | Kod / gün sınırı | Karar |
|---|---|---|
| Canlı Hik kart | `convex/lib/processCardReadingCore.ts:63,212,220` sunucu alış anı; cihaz tarihi metadata | Gece 23:59 olayı ertesi gün ulaşırsa PDKS günü kayabilir; **M2 eski A teyit 10 AÇIK**. Backfill aynı seri varsa zamanı düzeltmiyor (`convex/cardReadings.ts:808`). |
| IDE kart | `convex/lib/cardReadingProcess.ts:23` offsetsiz panel saatini +03 kabul eder; `processCardReadingCore.ts:247` geçersizse alış anı | Panel TZ/saat doğruluğu fiziksel teyit; kanonik UTC saklama var. |
| Hik geçmiş / cihaz olayı | `convex/cardReadings.ts:22,782,827`, `convex/lib/trDate.ts:30` UTC normalizasyonu | Offsetsiz olay Türkiye zamanı; canlı kart yoluyla aynı zaman kaynağı değil. |
| PDKS ve rapor | `convex/lib/trDate.ts:13`, `reportScope.ts:40`, `pdksTableQuery.ts:55`: İstanbul gününün UTC sınırları; vardiya ayrıca iş günü çözer | UTC ISO saklamak yanlış gün hesabı demek değil; dönem sınırı +03'tür. Gece sabit pencere sorunu M3 P-06, tekrar sayılmadı. |
| Mobil geçmiş / özet | `convex/lib/mobileAttendance.ts:34,133`; `mobile/lib/core/attendance_date.dart:1` | İstanbul takvim günü ortak; ham hareket günü ve vardiya günü aynı kavram değil. Dart özet sayısı uyuşmazlığı M5 B-03. |
| Başlangıç / ayrılma | `convex/employees.ts:30`, `convex/lib/employment.ts:8`, `convex/lib/mobileAccess.ts:50` | Başlangıç İstanbul gece yarısı UTC anına çevrilir; son çalışma günü dahil. Bulut bitişi cron beklemez; fiziksel roster için TR 00:05 işi ve teslim gerekir. |
| Cron / rapor ayı | `convex/crons.ts:7,98`; `actions/sendScheduledReports.ts:35` | Aylık mail UTC 09:00 = TR 12:00; önceki ay Türkiye takviminden. Ayrılma cron'u UTC 21:05 = ertesi TR 00:05. Diğer saatler kota tablosunda. |

## 3. Kişi ve proje yaşam döngüsü

**Hücreler:** VAR ilgili yazma/iptal/karar var; KISMEN bazı hedeflerde veya sadece okuma anında denetleniyor; YOK olaydan bu alana yayılım yok. VAR fiziksel cihaza ulaştığı anlamına gelmez. Yol kısaltmaları aşağıdaki tabloda yalnız okunabilirlik içindir; hepsi `convex/` köküne göredir.

| Kişi olayı | Hik / IDE roster | Mobil oturum | QR / kapı niyeti | PDKS / vardiya referansı | Ziyaretçi ev sahipliği | Grant status | KVKK verisi |
|---|---|---|---|---|---|---|---|
| Pasifleştirme | VAR `employees.ts:340,351`; Hik siler `lib/hikSyncEmployee.ts:130`, IDE status=0 `actions/ideGatewayDevice.ts:141` | KISMEN `lib/employeeAuth.ts:26`: istek reddi; token silinmez/sürüm artmaz | KISMEN `lib/mobileAccess.ts:50,192`: kullanım/teslim reddi; token/niyet kaydı silinmez | KISMEN `lib/employment.ts:8`: bitişsiz pasif eski dönemden de çıkar; atama/ref değişmez | YOK `employees.ts:322,351`: ziyaretçi kendi aktifliğiyle yaşar | KISMEN kuyruk+ACK `lib/grantStatus.ts:91`; fiziksel onay ayrı | KISMEN parmak purge `employees.ts:340`; yüz/fotoğraf/olay silinmez |
| İşten ayrılma tarihi ekleme / günün bitmesi | KISMEN `employeeTermination.ts:73,102`: geçmiş tarihte hemen, gelecekte cron; cihaza bitiş yazılmaz | VAR istek anı tarih reddi `lib/employeeAuth.ts:26`; oturum fiziksel silinmez | VAR kullanım tarihi `lib/mobileAccess.ts:55`; pending komut yeniden doğrulanır `:192` | VAR son gün dahil `lib/employment.ts:10`; atamalar/ref korunur, tarih filtresi uygulanır | YOK `employeeTermination.ts:25`: ev sahibi ziyaretçileri kapanmaz | KISMEN Hik sonuç bağlı; IDE silme employeeId taşımaz `employeeTermination.ts:35`, `lib/grantStatus.ts:97` | KISMEN erişim kapatılırken parmak şablonu silinir `employeeTermination.ts:29`; diğer geçmiş korunur |
| Kişi silme | VAR Hik snapshot `employees.ts:365`, IDE eski kart+hedef `:373,382`; teslim/retry ayrı | VAR auth+session silme `employees.ts:394`, `lib/employeeUx.ts:11` | KISMEN yeni kullanım reddi `processCardReadingCore.ts:303,307`; kayıt/QR isim kopyası kalır (M5 B-01) | KISMEN atamalar + `syncPlanRefs` silinir `employees.ts:397`; PDKS/izin/talepler kalır, karar kilitlenir (R-03) | YOK `employees.ts:394`; kırık host (M1 K-07) | KISMEN silme ACK'si yazabilir `lib/grantStatus.ts:79`; kayıt geçmişi korunur | KISMEN yüz/parmak/rıza/isim-kart maskeleme `lib/employeeCascade.ts:27,42,53,64`; rawData/fotoğraf/QR kapsamı eksik |
| Proje değiştirme | YOK yalnız proje alanı değişince sync koşulu yok `employees.ts:320,351`; eski hedefler korunmuyor (M1 K-02) | KISMEN aynı token güncel employee projesini alır `lib/employeeAuth.ts:23`; auth kopyası/oturum iptali yok | VAR eski token/niyet proje uyuşmazlığı reddi `processCardReadingCore.ts:307`, `lib/mobileAccess.ts:197` | YOK atama/ref/PDKS taşınmaz `employees.ts:322`; bazı okuyucular proje uyuşmazlığını dışlar, geçmiş diğer projede kalır | YOK eski ziyaretçi projesi değişmez; mobil sahiplik reddeder `lib/mobileVisitors.ts:20` | YOK eski proje satırı taşınmaz; yeni sonuç eski proje farkında atlanabilir `lib/grantStatus.ts:79` | YOK biyometri/rıza/ham olay projesi topluca taşınmaz `employees.ts:322` |
| Erişim başlangıcını ileri/geri alma | VAR `employees.ts:351`; Hik beginTime `lib/hikSyncEmployee.ts:270`; IDE start `actions/ideGatewayDevice.ts:142` | YOK giriş başlangıç tarihiyle engellenmez `lib/employeeAuth.ts:26` | VAR kullanımda dönem kontrolü `lib/mobileAccess.ts:50,174,192`; mevcut QR yeniden denetlenir | YOK `lib/employment.ts:2`: bu erişim tarihi işe giriş tarihi değildir; puantaj başlangıcı sayılmaz | YOK `employees.ts:324`: ev sahipliği etkilenmez | KISMEN gönderim/ACK sonucu; tarih geldiği anda ayrı grant işi yok `lib/grantStatus.ts:84` | YOK veri temizliği; yalnız audit `employees.ts:324` |
| Ayrılmayı geri alma / yeniden aktifleştirme | VAR `employeeTermination.ts:85,90` yeniden sync | KISMEN eski süresi dolmamış token yeniden geçerli olabilir; sürüm artırılmaz `lib/employeeAuth.ts:34` | KISMEN TTL içindeki kullanılmamış QR/niyet yeniden uygun olabilir; bir kez tüketilmiş QR yine reddedilir `processCardReadingCore.ts:300` | VAR bitiş kaldırılıp aktif yapılınca yeniden hesap `employeeTermination.ts:85`; tarihsel kapanış yok | YOK ziyaretçi bağlantısı ayrıca düzenlenmez | KISMEN yeni sync sonucu | KISMEN silinmiş parmak şablonu kendiliğinden geri gelmez `lib/employeeCardChange.ts:39` |

**Yorum:** pasifleştirme erişim askısı mı, kalıcı oturum iptali mi ürün kararıdır; mevcut kod geçici askı gibi davranır. Vardiya/PDKS geçmişini korumak ile bekleyen başvuruyu sonsuza dek açık bırakmak aynı karar değildir. R-03 ikinci konuyu ele alır; kişinin geçmiş rapordan kaybolma davranışı bu raporda ayrı yeni bulgu sayılmadı.

### Proje yaşam döngüsü

| Alan | Pasife alma (`projects.update`) | Silme (`projects.remove`) |
|---|---|---|
| Ana işlem | `convex/projects.ts:104` yalnız proje patch'i; bağlı olay yayımlamaz | `convex/projects.ts:117,121` ortak bloklayıcı/temizleyici listeyi kullanır |
| Cihaz / fiziksel izin | Cihaz isActive ve roster değişmez; cihaz listeleri proje aktifliğine bakmaz (`convex/devices.ts:678,705`) | Cihaz/personel/topoloji varsa silme engeli (`lib/adminGuards.ts:36`); otomatik cihaz silme/roster iptali değildir |
| Kuyruk / cron | Mevcut normal IDE işlerini pasif proje engellemez (`convex/ideSync.ts:311`); Hik retry/zaman/backfill sürer | Pending ops, grant, sync run listede yok; önceden cihaz/kişi silindiyse kalıntılar olabilir. M2 C-04 ve M4 Y-09 ile birlikte ele alınmalı |
| Mobil giriş / geçmiş | `lib/employeeAuth.ts:23` proje aktifliği kontrol etmez; kişi aktif kaldıkça oturum/geçmiş sürer | Normal kişi bulunduğu sürece proje silme engeli var; bozuk legacy referans varsa oturum helper'ı proje varlığını da aramaz |
| Mobil kapı / QR üretimi | VAR ret `lib/mobileAccess.ts:84`, `employeeCheckIn.ts:17`; pending mobil kapıda teslim kontrolü var | Aynı kontrol proje yokluğunu da reddeder |
| QR tüketimi | Genel okuyucu proje kontrolüne gider; sanal okuyucu kısa devresi atlar (`lib/mobileAccess.ts:177`), **M5 B-02** | Normal silme bağımlılıklar nedeniyle engellenir; legacy orphan için aynı kısa devre var |
| Generic kart / web | Genel kart kararı cihaz/kişi/kuralı okur, proje aktifliğini okumaz (`lib/processCardReadingCore.ts:355,376`); web kapsamı üyelikten gelir (`lib/auth.ts:62`) | Üyelikler silinir; normal web erişimi kesilir. Geçmiş olaylar varsa proje silme zaten engellenir |
| Rapor / e-posta | Rapor kapsamı yetkilerden, aktiflik filtresi yok (`lib/reportScope.ts:30,81`); plan enabled kalır | Projeye bağlı `reportScheduleSettings` temizlenir (`lib/adminGuards.ts:70`); tüm-proje planı diğer erişilebilir projelerle sürer |
| Ayarlar / geçmiş | Bütün geçmiş/ayarlar kalır; arşivleme niyetiyle uyumlu fakat kanallar aynı politika değil | Alarm/PDKS kuralı/şablon eksikleri **M4 Y-09**; audit açıkça korunur (`projects.ts:127`) |

Pasif proje davranışı **eski C5-7 AÇIK** olarak kalmalı; burada yeniden R bulgusu üretilmedi. Ortak “arşiv / erişimi durdur / sözleşmeyi bitir” anlamı belirlenmeden yalnız proje isActive'e rastgele filtre eklemek tarihsel raporu da yanlışlıkla saklayabilir.

## 4. Yeni bulgular

| ID | Önem | Tür | Yer (file:line) | Ne oluyor (kullanıcı gözünden) | Kanıt (kısa) | Öneri | Emek | Güven |
|---|---|---|---|---|---|---|---|---|
| R-01 | P0 | YETKİ | `convex/lib/reportScope.ts:81`; `convex/lib/permissions.ts:103`; `convex/accountAccess.ts:16`; `convex/actions/sendScheduledReports.ts:61` | Web erişimi dondurulmuş veya süresi bitmiş hesap, önceden açtığı aylık rapor e-postasını almaya devam edebilir. | Cron kullanıcıyı doğrudan DB'den alır; yalnız varlık/verified/rol-üyelik kontrolü yapar. `accessBlockReason` ve oturum cutoff'u bu yolda yok; freeze sadece kullanıcı+oturum değiştirir, rapor planı açık kalır. Mail mevcut proje adlarını ve attendance türünde personel/inceleme sayılarını içerir; tam bordro eki olduğu iddia edilmiyor. | Schedule scope'ta `accessBlockReason(user, now)` denetle; seçme, özet ve gönderime en yakın aşamada aynı karar; freeze/expiry senaryolarını test et. | S | KESİN |
| R-02 | P1 | TUTARSIZ | `convex/employees.ts:207,220,304,322`; `convex/employeeImport.ts:55,68`; `convex/employeeAuth.ts:203,211` | API'den büyük harfli/boşluklu e-posta ile oluşturulan kişi mobilde doğru bilgileriyle giremez; aynı adresin farklı yazımları iki kişi olabilir. | Yazma/tekillik ham metin, giriş trim+lowercase. Örnek `ADA@example.com` saklanır, giriş her zaman `ada@example.com` arar; genel mutation sarmalayıcısı argümanı normalize etmez (`lib/customFunctions.ts:25`). Formun düzeltmesi sadece o istemciyi korur. | Bütün sunucu kişi/import/update yollarında tek e-posta normalizasyonu ve tekillik uygula; önce legacy çakışmaları raporla, kimlikleri otomatik birleştirme. | M | KESİN |
| R-03 | P1 | EKSİK | `convex/lib/employeeUx.ts:11`; `convex/employees.ts:394`; `convex/leaveRequests.ts:108,163`; `convex/attendanceCorrections.ts:89` | Bekleyen izin/düzeltmesi olan kişi silinince başvurular kuyrukta kalır; yönetici bunları onaylayamaz veya reddedemez. | Cascade yalnız auth/session/shiftAssignment siler; pending kayıtlar ve sayaç kalır. İzin kararının hem onay hem red dalı mevcut çalışan ve eşleşen proje ister; düzeltme de aynı kontrolü yapar. Kişinin mobil hesabı silindiği için çalışan da geri çekemez. | Silmeden önce pending başvuruları görünür bir “kişi silindi” terminal durumuna geçir veya silmeyi engelle; karar/audit geçmişini koru. | M | KESİN |
| R-04 | P1 | PERF/KOTA | `convex/crons.ts:14,95`; `convex/hikvisionSync.ts:1028`; `convex/schema.ts:639,855,883,1360`; `convex/maintenance.ts:15,26` | Mobil dışındaki operasyon ve olay geçmişi de süresiz büyüyor; “stale cleanup” çalışması kayıtların gerçekten silindiği izlenimi verebilir. | Hik cleanup yalnız done/dismissed patch'i; terminal Hik/IDE işler, sync run/targets, deviceEvents ve auditLog için süreli purge yok. Bakım clearDeviceSyncQueue pending/failed işleri siler, terminal geçmiş saklama işi değildir. Cihaz silme sadece Hik kuyruğunu temizler. Eksik politika kesindir; kota/işlem sınırına ne zaman ulaşılacağı canlı hacme bağlıdır. | Tablolara ayrı saklama/sayfalı arşiv-purge politikası; başarısız erişim geri alma işlerini çözülmeden silme; büyüme metrikleri ve kapasite eşiği. | M | KESİN |
| R-05 | P3 | ÖLÜ KOD | `convex/schema.ts:1263,1264,1267,205`; `convex/employeeAuth.ts:250` | Şema molayı yönetiyor veya son oturum kullanımını izliyormuş gibi görünüyor; bu alanlar aktif hesap/oturum davranışına bağlı değil. | `workSettings.lunchBreakStart/lunchBreakEnd/allowLateEntry` için schema dışı üretim referansı yok; `employeeSessions.lastUsedAt` sadece signIn'de yazılır, sonraki isteklerde okunmaz/güncellenmez. Bölüm 6 kullanılmayan index adaylarını ayrıca listeler. | Gerçek mola modeliyle karıştırılmaması için legacy alanları belgeleyip daralt; lastUsedAt gerekiyorsa anlamını “giriş anı” olarak düzelt veya tüketici ekle. | S | KESİN |

R-01, M3 bölüm 7'nin başka modüle devrettiği “dondurulmuş hesap scheduler” sorusunun koddan kesinleştirilmesidir. R-03, M3/M5'in eski B3.3 yönetici ekranı yokluğundan farklıdır: izin ekranı mevcut olsa da kişi silinince backend karar veremez. R-04 yalnız mobil dışı ek tabloları yeni sayar; QR/session/kapı niyeti büyümesi zaten M5 B-07'dir.

## 5. Raporlar arası çelişkiler ve hakem kararı

| Konu / rapor ifadeleri | Koddan hakem kararı |
|---|---|
| M2 QR bağı için “belirgin yeni kopukluk yok”; M5 B-02 pasif projede sanal QR kabulü | **M5 doğru.** `convex/lib/mobileAccess.ts:177` proje fetch'inden önce true; `processCardReadingCore.ts:311` bu yardımcıyı kullanır. Genel okuyucunun korunması sanal okuyucuyu kapsamıyor. |
| A4/2 + OZET 2.1: M2 DÜZELDİ; M1 KISMEN | **Ortak karar KISMEN.** Çalışan `employeeCardChange.ts:27` snapshot alır; ziyaretçi `visitors.ts:447,467` yalnız yeni kartla sync yapar. “DÜZELDİ” yalnız çalışan yoluna daraltılabilir. |
| A5/3: M1 KISMEN; M2 AÇIK | **KISMEN genel akış, fiziksel önceden bitiş AÇIK.** `lib/mobileAccess.ts:55` bulutta anlık ret, `hikvisionSync.ts:159` senkron şekli yalnız başlangıç; `gateway/persons.ts:111` varsayılan bitiş. Fark kapsam farkı, iki ayrı düzeltme kararı gerekir. |
| A6/5: M1 DÜZELDİ; M2 KISMEN | **Hedef keşfi DÜZELDİ, bütün kapanış KISMEN.** `peopleHikSnapshot.ts:37` geçmiş cihazı tutar; `visitors.ts:506,532` checkout→kart iadesi eski kartı action öncesi kaybedebilir. Hedef listesi düzelmesi kimlik yarışını kapatmaz. |
| A5/7: M1 KISMEN; M2 AÇIK | **KISMEN toplam imha; ham veri AÇIK.** `employeeCascade.ts:27,42` biyometri siler, `:64` sadece ad/kartı maskeler. rawData, profil dosyası ve tüketilmiş QR ayrı kalıntılardır; yeni sayılmadı. |
| C1-4 kurulum listesi: M2 DÜZELDİ; M4 KISMEN | **Ekran varlığı DÜZELDİ, uçtan uca kabul KISMEN.** `projects.ts:179` bağımsız beş sorgu aynı kişi-kural-cihaz zincirini ispatlamaz; firstPassage sadece bir granted kayıt (`:195`). |
| M4 C5-4 hesap dondurma DÜZELDİ; M3 scheduler teyidi açık | **Web oturumu DÜZELDİ, otomatik teslim KISMEN.** `lib/auth.ts:23` hesabı denetler; `lib/reportScope.ts:81` denetlemez. R-01 yeni çapraz-modül boşluğudur. |
| M3/M1 mobil talepler sonradan commit edildi; M5 hâlâ “HEAD'de yok / WIP” | **WIP etiketi güncel HEAD için eski.** `git log` 5de547a8 değişikliğini gösteriyor, ilgili dosyalar `git diff HEAD` çıktısında yok. B3.3 web kuyruk kopukluğu yine AÇIK; commit canlı dağıtımı kanıtlamaz. |
| Ortak spec shifts/departments yazma kısıtı “ertelendi”; M1/M3/M4 DÜZELDİ | **Kod esas: DÜZELDİ.** `convex/departments.ts:30,60,94` employees.manage; `convex/shifts.ts:174,516` schedule.manage ister. Eski varsayımı yeni açık diye sayma. |
| Windows “ertelendi” / M2 aktif UI yönlendirmesi | Çelişki değil: ürünün ertelenmesi bulgu değildir; `DeviceHikvisionSection.tsx:52` ve `BridgeIntegrationCard.tsx:65` aktif seçim/anlatım, `convex/http.ts:494` roster yokluğu eski C2b akışını açık bırakır. |

## 6. Saklama, kota ve şema borcu

### Saklama / temizlik

| Tablo / veri | Temizleyen yol | Kalan sınır / durum |
|---|---|---|
| cardReadings | Günlük `convex/privacyRetention.ts:75,90`; 50 ayar/sayfa, proje başına 200×20 kayıt | Sadece açıkça 1825–3650 gün seçilen projeler; null süresiz. Geçmiş rapor ham kaynağı silinir; kapanmış rapor snapshot'ı yok. M4 C6-6 kapsamı budur. |
| deviceEvents ve alarm | Alarm aynı deviceEvents satırındaki durum/e-posta alanları (`convex/schema.ts:639`) | Yaşa göre purge cron'u yok; alarm ACK/başarı kaydı silme değildir (R-04). |
| auditLog | `convex/lib/audit.ts`; proje silmede açıkça korunur (`projects.ts:127`) | Otomatik saklama süresi yok (R-04); hukuki saklama süresi bu teknik audit'te belirlenmedi. |
| checkInTokens | Süre/used kontrolü `convex/employeeCheckIn.ts:37,58` | Silme/yaş index'i yok; kişi silmede ad kopyası kalır. M5 B-01/B-07. |
| employeeSessions | Logout `convex/employeeAuth.ts:288`, kişi silme `employees.ts:394` | 90 gün kontrolü satırı silmez; expiry cron'u yok. M5 B-07. |
| Web authSessions / refresh tokens | `convex/lib/sessionRevoke.ts:8,25`, kullanıcı silme `users.ts:237` | İptal temizliği var; Auth paketinin süresi dolmuş oturum saklama davranışı uygulama kodu taramasından kesinleştirilmedi, “yok” denmedi. |
| hikPendingOperations | `hikvisionSync.ts:1028` dismissed/done; cihaz silmede `lib/deviceHelpers.ts:58` | Günlük/haftalık terminal purge yok; başarısız kişi silmeleri bilerek saklanır (R-04). |
| idePendingOperations | Durum/ACK `ideSync.ts`; manuel `maintenance.ts:26` | Terminal purge yok; cihaz cascade temizliği de eksik (M2 C-04). Manuel queue reset saklama işi değildir. |
| deviceSyncRuns / targets / grant | Sonuç alanları güncellenir; `lib/grantStatus.ts:73` açıkça geçmiş silmez | Run/target yaşıyla purge yok; grant employee×device upsert olduğu için her işlemde yeni satır değildir, churn ile büyür. |
| mobileAccessOperations | `convex/mobileAccess.ts` TTL sonunda terminal duruma geçer | Otomatik silme yok; tekrar-sonucu kurtarma süresi korunarak politika gerekir (M5 B-07). |
| Kurulum token'ları | `emailVerification.ts:112`, `employeeAuth.ts:148` günlük alan temizliği | Employee auth 200'lük sayfa; web token temizliği sınırsız okuma (M4 Y-08). |
| pendingUploads | `convex/files.ts:77` günlük eski sahipsiz dosya temizliği | Sahiplenilmiş eski profil fotoğrafına uygulanmaz (M1 K-05). |
| Biyometri / rıza / ziyaretçi | Kişi/rıza işlemleri; `fingerprintEnrollment.ts:328` günlük retry | Cihaz imhası ile tutanak zinciri farklı (M4 Y-04); ziyaretçi iletişimi/host kopyaları kişi cascade'ine dahil değil. |

### 30 günlük fonksiyon çağrısı hesabı

**Varsayım:** 30 gün = 2.592.000 saniye; karşılaştırma bütçesi görevde verilen **1.000.000 çağrı/ay**. Güncel tarife veya canlı kullanım sorgulanmadı. `db.get/query/patch` fonksiyon içindeyse ayrı çağrı sayılmadı; HTTP action, runQuery/runMutation/runAction ve planlanan fonksiyonlar sayıldı. Dış gateway HTTP isteği Convex çağrısı değildir. Aşağıdaki cron tabanı M4 hesabı koddan kontrol edilerek kullanıldı.

| İş / kaynak | Takvim | Ana tetik/ay | Boş veriyle çağrı tabanı / ek yük |
|---|---|---:|---|
| Rapor (`crons.ts:7`) | Ayın 1'i UTC 09:00 / TR 12:00 | 1 | 3; plan başına +1 özet, başarıya +1 işaretleme |
| Hik retry (`:14`) | 3 dk | 14.400 | 28.800; aday başına türüne göre ek action/query/mutation |
| Hik stale (`:21`) | 10 dk | 4.320 | 4.320 |
| LocalBridge requeue (`:28`) | 3 dk | 14.400 | 14.400; Windows ertelense de kayıtlı cron etkin |
| Hik saat (`:36`) | UTC 01:00 / TR 04:00 | 30 | 60 |
| Hik backfill (`:45`) | UTC 02:00 / TR 05:00 | 30 | 60 + taranan olay başına 1 mutation + cihaz/gün başına 1 ilerleme; alarm işi eklenebilir |
| Ziyaretçi bitişi (`:67`) | 5 dk | 8.640 | 8.640 + 50'lik sayfalar + kapanan kişi cihaz zinciri |
| Web token (`:75`) | UTC 03:00 / TR 06:00 | 30 | 30 |
| Employee setup token (`:81`) | UTC 03:15 / TR 06:15 | 30 | 30 × max(1, ceil(auth/200)) |
| Pending upload (`:88`) | UTC 04:00 / TR 07:00 | 30 | 30 + dolu 200'lük partiler |
| Card retention (`:95`) | 24 saat | 30 | 30 + ayar sayfaları + süreli proje/gün başına 1–20 batch |
| Ayrılma (`:98`) | UTC 21:05 / TR 00:05 | 30 | 30 + kişi sayfaları + cihaz temizleme |
| Parmak retry (`:100`) | UTC 04:30 / TR 07:30 | 30 | 30 × max(1, ceil(enrollment/100)) + snapshot'lı sayfa action'ları |
| **Cron toplamı** | | **42.001** | **56.463 ≈ %5,65**; veri/cihaz yokken alt çağrılar dahil |
| IDE timeout (`crons.ts:59`) | Yorumda | 0 | 0; kapatma bilinçli, bulgu değil |
| IDE poll kapalı | `scripts/ide-mqtt-bridge.mjs:305` POLL_INTERVAL_MS≤0 | 0 | 0; olay/heartbeat köprüsü yine çalışabilir |
| IDE poll açık, boş | Varsayılan en uzun aralık 30 sn (`:47,315`) | ≈86.400/köprü | ≈172.800/köprü: HTTP action + pollForBridge mutation (`convex/http.ts:386`) |
| IDE poll sürekli dolu | Varsayılan taban 2 sn (`:42,315`) | En çok ≈1.296.000/köprü | ≈2.592.000/köprü yalnız poll; tur süresi arttıkça düşer; sent+ack ayrıca |
| IDE heartbeat | Panel periyodu H sn, N panel | 2.592.000N/H | 5.184.000N/H: route+updateLastSeen (`http.ts:357`); H canlı/firmware ayarı bilinmiyor |
| IDE kart olayı | E olay/ay | E | 3E: route + lastSeen + process (`http.ts:357,361`); retry/yan işler hariç |
| IDE sent + ACK | Q teslim denemesi | 2Q HTTP | Yaklaşık 4Q: her route + mutation (`http.ts:402,426`); timeout aynı ACK yolunu kullanır |
| Hik status snapshot | Saatlik, N cihaz (`infra/hik-event-bridge/bridge.mjs:321`) | 720N HTTP | 2.160N: action+token query+status mutation (`http.ts:25,38`); reconnect, status geçişi ve retry eklenir |
| Hik event / generic reader | Olay akışı; sabit Convex poll yok | E | Token'lı normal kart için yaklaşık 4E: HTTP+token query+lastSeen+process; alarm ve retry eklenir (`http.ts:191,256`) |
| Diğer köprüler | `scripts/hikvision-bridge.mjs`, forward-card-reader, `infra/hik-relay/server.mjs` | Veri/isteğe bağlı | SSE ping/sweep yereldir, kendi başına Convex fonksiyon çağrısı üretmez; olaylar üstteki route maliyetine girer |

**Birleşik örnekler (canlı iddiası değil):** IDE poll kapalı, olay ve cihaz yoksa 56.463 taban; bir boş IDE köprüsü açılırsa yaklaşık 229.263. Aynı köprüde 10 panelin 60 saniyede heartbeat gönderdiği varsayımında yaklaşık **1.093.263/ay**, kartlar ve komutlar daha eklenmeden bütçeyi geçer. Poll sürekli 2 saniyede doluysa yalnız poll+cron yaklaşık **2.648.463/ay**; 21 Hik cihazında her gün 1.500 olay taranması senaryosu ise M4'teki gibi yaklaşık **1.002.093/ay**, snapshot ve canlı olaylar hariçtir.

Abonelik yeniden hesapları, web/mobil kullanımı, alarm e-postası, 3 denemeye kadar Hik HTTP retry ve offline geri gelişleri tabana dahil değildir. Tek bir kesin “toplam canlı aylık tüketim” üretmek için cihaz sayısı, H, poll ortam ayarı, olay hacmi ve deployment sayaçları gerekir; bu görevde bunlara erişilmedi.

### Şema borcu

Tarama schema dışındaki üretim kaynaklarında tablo/alan/index adlarını aradı; testler ve generated API kanıt sayılmadı. Dinamik tablo listeleri (`adminGuards`, `employeeDependentTables`) ayrıca okundu; tüm belgeyi dönen sorgular nedeniyle “alan hiçbir yanıtta yok” gibi daha güçlü bir iddia yapılmadı.

| Nesne | Kanıt / durum | Karar |
|---|---|---|
| mailSettings, chatConversations | `convex/schema.ts:1096,1160`; yalnız proje temizleyicisi `lib/adminGuards.ts:65,72` | Aktif iş okuyucu/yazıcısı yok; **M4 Y-11**, yeniden sayılmadı. SMTP alanları kullanılmayan şema. |
| leaveBalances | `schema.ts:1244`; yalnız idari silme listesi `adminGuards.ts:71` | Üreten/tüketen hak ediş akışı yok; **eski B4.6 AÇIK**. totalDays/usedDays/remainingDays sadece schema. |
| workSettings.lunchBreakStart/lunchBreakEnd/allowLateEntry | `schema.ts:1263,1264,1267` | Üretim kodunda isim referansı yok; gerçek molayı başka shift/policy alanları hesaplıyor. R-05. |
| employeeSessions.lastUsedAt | `schema.ts:205`, tek yazım `employeeAuth.ts:250` | Alan girişte yazılıyor; son kullanım tüketicisi/güncellemesi yok. R-05. |
| zones.ideDeviceId | `schema.ts:245,249` deprecated; `convex/migrations.ts:27,60,111` hâlâ okur | Yalnız arama azlığıyla silinecek ilan edilmedi; eski veri temizlendikten sonra şema daraltması adayı. |
| Kullanılmayan index adları (12) | `employees.by_visitor:152`; `zones.by_ide_device:254`; `devices.by_admin_device:462`; `cardReadings.by_status_time:625`; `deviceEvents.by_project_and_event_time:695`; `idePendingOperations.by_msx:848`; `shiftAssignments.by_dates:1049`; `adminDevices.by_assigned_device:1151`; `leaves.by_status:1209`, `by_dates:1211`, `by_project_start:1212`; `leaveBalances.by_employee_year:1257` (satırlar schema.ts) | Üretim sorgu çağıranı bulunmadı; tek başına çalışma hatası değil. Canlı migration/harici kullanım teyidinden sonra index maliyetini azaltma adayı. Aynı isim başka tabloda kullanılıyorsa tarama muhafazakâr biçimde elemedi. |
| Şema yorumları | `schema.ts:124` başlangıcın cihaz erişimini etkilemediğini söylüyor; oysa `hikSyncEmployee.ts:270`, `ideGatewayDevice.ts:142` cihaza taşır | Yorum güncel sözleşmeyle uyuşmuyor; alan ölü değildir, başlangıç gönderimi çalışıyor. Yeni işlevsel bulgu sayılmadı. |

## 7. Ölü uçlar

**Yöntem:** `convex/**` içindeki query/mutation/action ve web/mobil/superAdmin/optionalAuth sarmalayıcılarıyla kayıtlı **325 named public uç** tarandı. `src/**`, `mobile/lib/**`, `infra/**`, `scripts/**`, `convex/**` üretim kodunda `api.mod.fn`, `api["actions/mod"].fn` ve `"mod:fn"` çağrıları arandı; testler/generated referanslar çağıran sayılmadı. **18 uçta üretim çağıranı yok**; tamamı aşağıda, taşan satır yok. Convex Auth fabrikasının `auth/signIn/signOut/store/isAuthenticated` ihracı framework bağlantısıdır, bu named-registration sayımına ve ölü listeye eklenmedi; HTTP route'lar da ayrı ulaşılabilir yüzeydir.

“Çağıran yok” repository sonucudur; dashboard/CLI/harici müşteri kullanımı bulunmadığını kanıtlamaz. Listedeki bazı uçlar bilinçli bakım API'si, bazıları kopuk kullanıcı akışıdır; hepsini otomatik kaldırma önerisi yapılmıyor.

| Fonksiyon | Dosya:satır | Üretim çağıranı yok | Not |
|---|---|---|---|
| devices.listForEmployee | `convex/devices.ts:88` | Evet | Mobil güncel hedef keşfi mobileAccess.listTargets; eski sınırlı cihaz listesi adayı. |
| devices.getById | `convex/devices.ts:93` | Evet | Internal getByIdInternal ile karıştırılmamalı. |
| accessRules.list | `convex/accessRules.ts:117` | Evet | Yeni liste yolları var; eski public liste adayı. |
| attendanceCorrections.listPending | `convex/attendanceCorrections.ts:65` | Evet | **Eski B3.3 AÇIK**; gereken yönetici tüketicisi kayıp. |
| attendanceCorrections.approve | `convex/attendanceCorrections.ts:103` | Evet | B3.3; backend olması ekranda karar verilebildiğini göstermez. |
| attendanceCorrections.reject | `convex/attendanceCorrections.ts:104` | Evet | B3.3; kaldırılacak artık uç olarak sınıflandırılmamalı. |
| peopleActivity.employeeSyncStatus | `convex/peopleActivity.ts:31` | Evet | **M1 K-11**; ikinci durum hesabı. |
| deviceEvents.getConnectivityHistory | `convex/deviceEvents.ts:180` | Evet | Eski C3-2; UI kaldırılmış, backend korunmuş. |
| accessScheduleTemplates.get | `convex/accessScheduleTemplates.ts:103` | Evet | Liste sonucu kullanımı varken tek kayıt ucu tüketilmiyor. |
| ideDefaults.get | `convex/ideDefaults.ts:16` | Evet | Admin defaults tablosu başka backend tarafından doğrudan okunur; tablo ölü değil, bu uç bağlı değil. |
| ideDefaults.upsert | `convex/ideDefaults.ts:35` | Evet | Yönetici arayüzü/harici bakım kullanımı teyit edilmeli. |
| onboarding.assignProjectsToExistingUsers | `convex/onboarding.ts:89` | Evet | `:80` açıkça tek seferlik migration, CLI örneği var; kasıtlı operasyonel uç, ölü olduğuna karar verilmedi. |
| shifts.definitionImpacts | `convex/shifts.ts:383` | Evet | Tanım etkisi önizleme ucu UI'a bağlı değil; write handler'ın kendi korumasından ayrı. |
| actions/hikGatewayDevice.refreshGatewayDeviceStatus | `convex/actions/hikGatewayDevice.ts:87` | Evet | ISUP push/snapshot zincirinden ayrı manuel tarama. |
| actions/hikGatewayDevice.pingHikGateway | `convex/actions/hikGatewayDevice.ts:102` | Evet | Manuel tanılama adayı. |
| actions/hikGatewayDevice.captureFaceFromDevice | `convex/actions/hikGatewayDevice.ts:296` | Evet | Eski yüz akışı / eski A1.7; harici kullanım bilinmiyor. |
| actions/hikFingerprint.removeFingerprintFromDevice | `convex/actions/hikFingerprint.ts:85` | Evet | Güncel ortak parmak silme/purge zinciriyle karıştırılmamalı. |
| invites.list | `convex/invites.ts:306` | Evet | Yönetici davet listesi ucu; güncel üretim çağıranı bulunmadı. |

**Kabul / test boşluğu:** R-01 freeze ve expiry sonrası enabled schedule+summary reddi; R-02 bütün yazma yollarında e-posta normalize/duplicate; R-03 kişi silme sonrası pending karar/kuyruk; pasif proje → mobil/generic/sanal okuyucu ayrımı; UTC 21:00 sınırında canlı/backfill olay eşitliği; terminal kuyruk temizliği sırasında çözülmemiş geri alma işinin korunması. Bu tur kaynak değiştirmeden denetim yapıldı; bu senaryolar için yeni test yazılmadı ve canlı kabul yapılmadı.
