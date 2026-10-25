# A — Kişi yaşam döngüsü ve erişim akışları

## 1. Sonuç

Kişi ekleme, zaman şablonu, seçili Hik kapıları, işten ayrılma ve cihaz başına yetki ekranı kodda mevcut; ancak erişimi geri alma zinciri **KOPUK**. Önce kayıp kartın Hik cihazından kaldırılması, silinen kuralın eski cihazlardan sökülmesi ve başarısız kişi silmenin yeniden denenmesi düzeltilmeli; ardından rol sınırları, ziyaretçi süresi ve projeler arası kart eşleştirmesi kapatılmalı. Yeni ekranların bulunması, cihazda eski erişimin kalmadığını tek başına göstermiyor.

**İnceleme tabanı:** 22.10.2026, son kontrol `c53a7684`. Audit `65511782` ile başladı; çalışma sırasında başka oturumun `1f213ede` (merkezi parmak izi) ve `c53a7684` (cihaz komut görünürlüğü) commitleri geldi, rapor bunlara göre güncellendi. Aşağıdaki kod satırları **`c53a7684` sürümüne aittir**; sabit kanıt için `git show c53a7684:<dosya>` kullanın. `git log --oneline -60` incelendi; W2/W3b/W4.0/W4.1/W4.2 artık mevcut kabul edildi.

İlk okumada **commit'siz (WIP)** olan merkezi parmak izi saklama/dağıtma ve tekrar silme yolu artık `1f213ede` içinde commit'li. Eski “yalnız seçilen cihazda tutuluyor” ve “periyodik silme tekrarı yok” tespitleri son rapordan çıkarıldı; canlıya dağıtıldığı iddia edilmedi.

**Yöntem:** Yalnız yerel kaynak/doküman okuması; canlı sistem, cihaz, DB, ağ, tarayıcı, deploy veya test çalıştırılmadı. **TAMAM**, belirtilen adımın kod bağlantısının tamam olduğunu ifade eder; fiziksel cihazda çalıştığı iddiası değildir. Emek: **S ≤2 saat**, **M ≤1 gün**, **L >1 gün**. **P0** erişim güvenliği önceliği, **P1** sonraki önceliktir.

**Hik-Connect kıyas anahtarı:** Aşağıdaki H kodları eski RE çalışmasında görülen ekranlara referanstır; Hik'in cihazdaki uygulama/iptal garantisi incelenmiş değildir.

- **H1 — Kişi:** `docs/hikconnect-audit/HIKCONNECT_SAYFALAR.md:105` kişi/import/toplu kart; `:106` kimlik bilgileri ve erişim seviyesi.
- **H2 — Yetki:** aynı dosya `:36` kişi/cihaz durumu ve yeniden dağıtım; `:37` kapı+takvim; `:38` departman; `:39` kişi; `:45` haftalık şablon.
- **H3 — Geçiş:** aynı dosya `:35` uzaktan açma; `:41` geçiş kayıtları; `docs/hikconnect-reports/README.md:236` olay arama alanları.
- **H4 — Ayrılma/hesap:** `docs/hikconnect-audit/HIKCONNECT_SAYFALAR.md:111` ayrılma/geri alma; `:119` kullanıcı dondurma/son kullanma.
- **H5 — Ziyaretçi:** aynı dosya `:40` başlangıç/bitiş, PIN/QR ve geçiş sayısı.
- Kıyas sınırları: `docs/HIKCONNECT_BIRLESIK.md:313`, `:411`, `:422`, `:500`; eski NGS envanteri `docs/hikconnect-audit/NGSACCESS_ENVANTER.md:52`, `:65`, `:68`; eski fark listesi `docs/hikconnect-audit/KIYAS.md:13`. Hukuki değerlendirme yapılmadı; biyometri için projenin uyguladığı kod politikası incelendi.

## 2. Akış tabloları

### A1 — Yönetici çalışan ekler, kimlik bilgisini tanımlar, cihaza ulaştırır

Giriş: `src/App.tsx:70` → Kişiler; menü `src/lib/routeMeta.ts:7`.

| # | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek) |
|---|---|---|---|---|---|---|
| 1 | Projeyi seçip tek kişi kaydeder | `src/components/employees/hooks/useEmployeeFormSubmit.ts:74` → `convex/employees.ts:157`; proje/ilişki kontrolü `:180`, `:196` | H1: kişi ve departman | TAMAM | Yönetici form hatasını alanında görür; kişi seçili projeye kaydolur. | Koru; S doğrulama. |
| 2 | Excel'i önizler, uygun satırları aktarır | `src/components/employees/import/EmployeeImportDialog.tsx:45`, `:70` → `convex/employeeImport.ts:24`, `:65` | H1: Import | TAMAM | 100 satırlık parçalar, satır bazlı hata/yinelenen sonuçları var. Yalnız kişi kaydı oluşur. | Sonuçları koru; S. |
| 3 | Aktarım sonunda “Cihazlara gönder” der | `src/components/employees/import/EmployeeImportDialog.tsx:103`; importta üyelik yok `convex/employeeImport.ts:65`; gönderim üyelerden okunur `convex/deviceSyncRuns.ts:150` | H1/H2: kişi → erişim seviyesi | KOPUK | İçe aktarılan yeni kişiler hiçbir kurala üye değildir; proje senkronu bunları hedeflemez. “Gönderim başlatıldı” mesajı kapı yetkisi sağlamaz. | Önce yeni kişileri kurala ekleme adımı; sonra hedefli gönderim ve kişi sayısı göster; M. |
| 4 | Kart numarasını girer veya topluca değiştirir | `convex/employees.ts:187`; toplu atama `convex/employeeImport.ts:90`, `:109`; IDE sayıya çevirir `convex/actions/ideGatewayDevice.ts:131` | H1: Batch Issue Cards | YARIM | Tekli giriş global tekillik ararken toplu atama yalnız aynı projeyi kontrol eder. IDE'ye uygun olmayan kart metni kaydolup gönderimde takılabilir. | Tek kart doğrulama/tekillik politikası; IDE sayısal kimliğini de doğrula; M. |
| 5 | Kişiyi erişim kuralına ekler | `src/components/employees/EmployeeFormFields.tsx:209` → `convex/employees.ts:52`, `:206`, `:208` | H1/H2: Access Granting | TAMAM | Kişi→grup üyeliği→Hik ve IDE gönderim işleri bağlanır. Kuralsız kayıt erişim sağlamaz. | Kuralsız kişide açık “Henüz erişimi yok” sonucu göster; S. |
| 6 | Parmak izi için cihazda parmağını okutur | `src/components/employees/EmployeeFingerprintCard.tsx:24`, `:47` → `convex/fingerprintEnrollment.ts:59` → `convex/actions/hikFingerprint.ts:36` | H1: parmak kimliği; dağıtım detayı bilinmiyor | YARIM | Açık rıza, aktif kişi, biyometri ayarı ve yetkili Hik gateway şart. Yeni commit şifreli şablonu merkezde tutup yetkili diğer Hik gateway cihazlarına gönderir; IDE/Windows bu kayda dahil değildir. | Merkezi kaydı ve her hedef cihazdaki sonucu ayrı göster; farklı modelde fiziksel teyit; M. |
| 7 | Fotoğraf yükleyip yüzle geçiş bekler | `src/components/employees/EmployeeFormFields.tsx:225`; `convex/employees.ts:194`; `convex/employeeFaces.ts:13` | H1: profil ve yüz kimliği ayrı | EKSİK | Profil fotoğrafı `employees.photoStorageId` olur; yüz tablosuna kayıt ve kullanıcıdan erişilebilir yüz ekleme zinciri yok. Fotoğraf yüklemek yüz tanıma yetkisi vermez. | “Profil fotoğrafı” diye etiketle; yüz erişimi isteniyorsa ayrı izinli kayıt akışı tasarla; S etiket/L akış. |
| 8 | Kaydın hangi cihazlara gittiğini kontrol eder | `src/components/employees/hooks/useEmployeeFormSubmit.ts:155`; `convex/hikvisionSync.ts:103`; `convex/actions/hikvisionSync.ts:275`, `:299`, `:359` | H2: Overview | YARIM | Formun doğrudan sonucu Hik içindir; IDE arka plandadır. Hik kart gönderimi hatasında form başarılı sayısı artabilir, Yetki Durumu ise Hata gösterebilir. | Aynı kişi×cihaz çalışma sonucu üzerinden tek mesaj üret; M. |

**Biyometri/PDKS ayrımı:** Parmak izi erişim içindir; güncel arayüz puantajda kullanılmadığını açıklar (`src/components/employees/EmployeeFingerprintCard.tsx:70`). `convex/lib/pdksSource.ts:74` biyometrik ve kaynağı belirsiz olayları PDKS girdisinden çıkarır. Profil fotoğrafının kendisi yüz doğrulama kaydı sayılmaz.

### A2 — Yönetici kişi, kapı ve zamanı birleştirip erişimi dağıtır

Giriş: `src/App.tsx:73` → `src/components/access-control/unified/UnifiedAccessControl.tsx:61` (Kurallar/Zaman Şablonları/Yetki Durumu).

| # | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek) |
|---|---|---|---|---|---|---|
| 1 | Yetkili kullanıcı kural oluşturur | `convex/accessRules.ts:674`, `:871`, `:889`; `convex/lib/customFunctions.ts:25`; UI `src/components/access-control/unified/AccessRulesList.tsx:413` | H2/H4: rol ve yetki yönetimi | KOPUK | UI yöneticiye göre işlem gösterirken backend yalnız oturum+proje üyeliği arar. `project_user` aynı proje için doğrudan kural yazabilir/silebilir. | Yazma uçlarını adminMutation/requireAdmin ile eşitle; M. |
| 2 | Departmandan veya tek tek kişilerden seçim yapar | `src/components/access-control/unified/hooks/useRuleForm.ts:209` → `convex/accessRules.ts:905`; departman taşıma `convex/employees.ts:394` | H2: departmana/kişiye yetki | YARIM | Kalıcı bağ departman kuralı değil kişi listesidir. Sonradan departmana gelen/ayrılan kişinin erişim üyeliği kendiliğinden değişmez. | “Seçilen kişiler” anlatımı veya dinamik departman üyeliği; S açıklama/L dinamik. |
| 3 | Haftalık zaman şablonu seçer | `convex/accessRules.ts:893`; `convex/accessScheduleTemplates.ts`; `convex/lib/accessSchedule.ts:72`; mobil `convex/lib/mobileAccess.ts:31` | H2: 7×24 şablon | TAMAM | W4.1 var; kural şablonu Hik/IDE ve bulut saat kararına bağlanmış. | Cihazdaki saat ve gece sınırlarını teyit et; M. |
| 4 | Çok kapılı Hik cihazında yalnız istenen kapıları seçer | `convex/hikvisionSync.ts:119`, `:138`; `convex/lib/gateway/persons.ts:38`; `convex/actions/hikvisionSync.ts:275` | H2: kapı kümesi | TAMAM | W4.0 gateway yolunda kapı başına plan taşır; geçersiz açık kapı seçimi cihazın tüm kapılarına geri genişlemez. | Çok kapı/çok kural fiziksel deneyi; M. |
| 5 | Aynı seçimi IDE paneline gönderir | `convex/actions/ideGatewayDevice.ts:171`; `convex/ideSync.ts:622`, `:636` | H2; IDE eşdeğeri RE'de yok | YARIM | Geçerli `ioId` olan seçim korunur; seçili kapıların hiçbirinde sayısal `ioId` yoksa tüm panel kapılarına düşer. Bozuk seçimin yetkiyi genişletme riski var. | Açık seçim var fakat çözülemiyorsa erişimi kapat ve hata göster; M. |
| 6 | Gönderimin cihaz tarafından uygulanmasını bekler | Hik `convex/actions/hikvisionSync.ts:262`, `:275`; IDE `convex/actions/ideGatewayDevice.ts:183`, `:201`; ESP32 `convex/cardReadings.ts:1223` | H2: Apply Access Granting | YARIM | Hik gateway ISAPI çağrısı, IDE MQTT kuyruğu, Windows köprü kuyruğu farklıdır; ESP32 kararı bulutta alır, kişi listesi gönderilmez. Windows payload'u tüm kapılara ilk plan numarasını taşır (`:268`), kapı başına farklı plan eşitliği kanıtlanmıyor. | Taşıma yollarının destek matrisi ve Windows çok plan testi; L. |
| 7 | Etkin/Bekliyor/Hata durumunu inceler | `convex/accessGrantStatus.ts:146`; `convex/hikvisionSync.ts:637`; `convex/lib/grantStatus.ts:92`; `src/components/access-control/unified/status/StatusPage.tsx:102` | H2: kişi/cihaz Overview | YARIM | W4.2 mevcut, yalnız yöneticiler görür. Etkin cihaz yanıtını temsil eder; fiziksel geçiş garantisi değildir. ESP32 bu tablonun Hik/IDE kapsamına girmez (`convex/lib/grantStatus.ts:37`). | Ekranda cihaz türü ve kanıt türünü açık göster; S. |
| 8 | Hatalıları yeniden dağıtır | `src/components/access-control/unified/status/StatusPage.tsx:110` → `convex/accessGrantStatus.ts:180` → `convex/deviceSyncRuns.ts:731` | H2: yeniden uygulama | YARIM | Mevcut kişi için seçili kişi×cihaz yeniden dağıtımı eski yetkiyi de kaldırabilir. Silinmiş kişi için başlatılamaz (`convex/deviceSyncRuns.ts:714`); genel proje gönderimi kuralsız/eski kayıtları topluca temizlemez. | Silme işlemlerini kişi kaydı silinse de tekrar uygulanabilir tut; M/L. |

### A3 — Çalışan geçer, olay kayda ve PDKS girişine ulaşır; uzaktan kapı açılır

| # | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek) |
|---|---|---|---|---|---|---|
| 1 | Kartını/parmağını Hik veya IDE cihazına okutur | `convex/cardReadings.ts:987`, `:1053` | H3: cihaz olay sonucu | TAMAM | Kararı cihaz verir; Convex olayı kaydeder. Sunucuda kişinin pasif olması cihazda kalan izni anında engellemez. | İptal işleminin cihaz onayını zorunlu takip et; M. |
| 2 | ESP32/genel okuyucuda kartını okutur | `convex/http.ts:55`, `:224` → `convex/cardReadings.ts:1150`, `:1191`, `:1223` | H3; bulut okuyucu eşdeğeri bilinmiyor | YARIM | Bilinmeyen/pasif kişi, kuralsız cihaz ve kapalı saat reddedilir. Fiziksel kart dalında ziyaretçi başlangıç/bitiş tarihi okunmaz; mobil QR dalı bu kontrolü yapar (`:1115`). | Tek ortak kişi/cihaz/tarih kararını kullan; M. |
| 3 | Olay doğru proje ve doğru kişiye bağlanır | `convex/cardReadings.ts:910`, `:1001`, `:1067`; `convex/http.ts:327`; toplu kart `convex/employeeImport.ts:112` | H3: kişi ve cihaz eşleştirme | KOPUK | Kart araması global ilk kaydı alır, olayın projesinde kişi projesini öne koyar. Projeler arası aynı kart toplu atamayla üretilebildiği için B cihazındaki olay A kişisine/projesine bağlanabilir. | Cihaz projesinde kişi ara; eşleşme yoksa o cihaz projesinde bilinmeyen kart olarak kaydet; M. |
| 4 | Canlı ekranda izin/ret ve kapıyı görür | `convex/cardReadings.ts:1033`, `:1079`; `:146`, `:162`; `src/pages/LiveMonitoring.tsx` | H3: Access Record Retrieval | YARIM | Olaylar görünür; kapı filtresi yalnız IDE `ioId` eşleşmesini kabul eder. Çok kapılı Hik yetkisi verilse de geçiş aramasındaki kapı seçimi aynı kapsamda değildir. | Hik kapı numarasını olaydan sakla ve filtreye bağla; M. |
| 5 | Geçiş PDKS değerlendirmesine girdi olur | `convex/lib/pdksSource.ts:31`, `:74`, `:80`; `convex/cardReadings.ts:7` | H3; Hik raporlarında biyometri alanları var | TAMAM | Ortak `cardReadings` kaynağından biyometrik/belirsiz olaylar çıkarılır; proje ve check point (mesai okuyucusu) filtresi uygulanır. | **Grup B devir noktası:** `filterPdksReadings`; hesaplama bu raporda incelenmedi. S teyit. |
| 6 | Yönetici webden kapıyı açar | `src/components/devices/useDeviceCommands.ts:167`; `convex/actions/hikGatewayDevice.ts:418`; `convex/actions/ideGatewayDevice.ts:377`, `:64` | H3: Remote Open | KOPUK | Her iki backend yolu proje üyeliğini kontrol eder; yönetici rolü kontrolü yok. Kural yazma açığına ek olarak `project_user` doğrudan açma çağrısı yapabilir. | Web komutlarında yönetici kontrolü ve kapı numarası doğrulaması; M. |
| 7 | Çalışan mobilde izinli kapıyı açar | `mobile/lib/repositories/door_operation_repository.dart:28` → `convex/mobileAccess.ts:56`; `convex/lib/mobileAccess.ts:136`, `:183` | H3; mobil ayrıntı RE'de yok | YARIM | Kişi, proje, kapı, saat ve oturum komut tesliminden önce tekrar kontrol edilir. Hik gateway destekli; IDE ortam doğrulamasına bağlı; Windows köprü açıkça destek dışı (`:59`). ESP32 için QR kullanılabilir, uzaktan açma yok. | Destek dışı gerekçesini koru; Windows tüketicisini uyarlamadan açma; L. |
| 8 | Mobilde zaman aşımından sonra sonucu tekrar bulur | `mobile/lib/providers/door_operation_provider.dart:332`; `convex/mobileAccess.ts:110`, `:161`; `convex/lib/mobileAccess.ts:175` | H3; toparlanma detayı bilinmiyor | TAMAM | İşlem kimliğiyle sonuç sorgulanır, komut 30 saniye sonra sona erer; gecikmiş açmayı engelleyen kontrol var. | Fiziksel kapı açıldı/komut iletildi ayrımını cihazda teyit et; M. |

### A4 — Kart, grup veya kural değişince eski erişim kaldırılır

| # | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek) |
|---|---|---|---|---|---|---|
| 1 | Kayıp kart yerine yeni kart kaydeder | `convex/employees.ts:289`, `:302`; `convex/employeeImport.ts:118` | H1: kart yönetimi | TAMAM | Tekli ve toplu değişim ortak kart değişim yardımcısına gider. | Eski/yeni kart ve cihaz hedeflerini aynı işlemde sabitle; M. |
| 2 | Eski kartın Hik cihazından silindiğini varsayar | `convex/lib/employeeCardChange.ts:13`, `:16`, `:22`; `convex/actions/hikvisionSync.ts:275`, `:288` | H1/H2: kart ve erişim iptali; cihaz detayı bilinmiyor | KOPUK | Eski parmak kaydı ve IDE kartı temizlenir; eski Hik kişi/kartı için silme işi yok. Hik kişi kimliği kart numarası olduğundan yeni kart yeni kimlikle eklenir, eski kimlik cihazda kalabilir. | Eski kart numarası+eski Hik hedefleriyle kişi/kart silme ekle; M. |
| 3 | Eski kartın IDE panelinden kalkmasını bekler | `convex/lib/employeeCardChange.ts:14`; `convex/actions/ideGatewayDevice.ts:261` | H2; IDE RE kapsamı dışında | YARIM | Eski kart açıkça silme kuyruğuna gider; yeni kart ayrıca eklenir. Kart değişimi temizliği bilerek `employeeId` taşımadığı için kişi×cihaz durumuna yansımaz (`convex/lib/grantStatus.ts:97`). | Eski kart kaldırma sonucunu ayrı göster; teslim sırasını cihazda teyit et; M. |
| 4 | Kişi ekranından farklı kural seçer | `src/components/employees/EmployeeFormFields.tsx:209`, `:213`; `convex/employees.ts:50` | H2: Grant/Revoke | TAMAM | İşlem “Ek erişim kuralı”dır; eski üyelik silinmez ve UI bunu açıkça söyler. Değiştirmek için Geçiş Kontrol'e yönlendirilir. | Açıklamayı koru; S. |
| 5 | Geçiş Kontrol'de üyeyi veya cihazı kuraldan çıkarır | `convex/accessRules.ts:1133` → `convex/deviceSyncRuns.ts:503`, `:530` | H2: Revoke | TAMAM | Güncel farkla kaydetme yolu eski hedefi korur; Hik'e silme, IDE'ye kalan izinleri yeniden hesaplama gider. Kalan başka kural varsa kişi korunur. | Bu güvenli yolu kural silme işleminde de kullan; M. |
| 6 | Kuralın tamamını siler | `convex/accessRules.ts:844`, `:846`, `:858`; `convex/hikvisionSync.ts:109`; `convex/actions/hikvisionSync.ts:128` | H2: Delete access level | KOPUK | IDE eski panel listesini korur; Hik yalnız yeni grafı okur. Son kural silindiyse hedef yok diye başarılı boş sonuç döner; eski cihazda kişi kalır. | Kural silinmeden Hik hedeflerini sabitle, kaldırılan hedefleri sil; M. |
| 7 | Departmanını değiştirince eski departman erişiminin kalkmasını bekler | `convex/employees.ts:394`, `:407`; `convex/accessRules.ts:905` | H2: departman bazlı atama | YARIM | Departman alanı güncellenir; grup üyelikleri ve cihaz senkronu değişmez. Eski erişim ayrı kaldırılmalıdır. | Taşıma önizlemesinde kalacak/kalkacak erişimi göster; dinamik model istenirse L. |
| 8 | Yetki Durumu'ndan eski erişimi düzeltir | `convex/accessGrantStatus.ts:158`, `:180`; `convex/deviceSyncRuns.ts:758` | H2: yeniden dağıtım | YARIM | Kayıtlı kişi için seçili eski cihaz yeniden dağıtımla temizlenebilir. Yeni kartın durumunun Etkin olması eski kartın silindiğini kanıtlamaz. | “Eski kart/izin kaldırma bekliyor” bilgisini ayrı takip et; M. |

### A5 — Hesap erişimi biter, çalışan ayrılır veya verisi silinir

| # | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek) |
|---|---|---|---|---|---|---|
| 1 | Kullanıcı hesabını dondurur veya bitiş tarihi koyar | `src/components/admin/components/AccountAccessActions.tsx:29` → `convex/accountAccess.ts:9`, `:36`, `:55` | H4: Freeze/Expiry | TAMAM | W3b web `users` hesabının oturumlarını kapatır. Çalışan kartı/parmağı ve ayrı `employeeSessions` hesabı bu işlemden etkilenmez; bu bir fiziksel erişim iptali değildir. | Ekranda “Web hesabı” kapsamını açıklaştır; S. |
| 2 | Çalışanın son çalışma gününü ileri tarihli kaydeder | `src/components/employees/EmployeeTerminateDialog.tsx:23` → `convex/employeeTermination.ts:38`, `:71` | H4: Resign | TAMAM | Son çalışma günü dahil aktif kalır; geçmiş tarih girilirse hemen kapatılır. | Son gün dahil bilgisini koru; S. |
| 3 | Tarih geçince kart/uygulama erişimi kapanır | `convex/crons.ts:98`; `convex/employeeTermination.ts:95`, `:23`; `convex/lib/employeeAuth.ts:23` | H4: ayrılma sonrası erişim; cihaz zamanı bilinmiyor | YARIM | TR 00:05 işinde pasif olur; mobil sonraki istekte reddedilir. Hik/IDE için silme ayrıca teslim edilmelidir; çevrimdışı cihaz eski izni tutabilir. Cihaza son çalışma günü gönderilmez. | Tarihi cihaz geçerliliğine yaz; kapatma sonucunu cihaz bazında izlet; L. |
| 4 | Kişiyi tamamen siler | `convex/employees.ts:317`; `convex/lib/peopleHikSnapshot.ts:27`, `:45`; `convex/actions/hikvisionSync.ts:429` | H1/H4: Delete | KOPUK | Silme öncesi hedef saklanır; fakat bu hedef yardımcısı yalnız `groupDevices` okur. W4.0'ın yalnız `groupDoors` üzerinden yetkilendirdiği Hik kişi/kartı silme listesine girmeyebilir. | Ekleme ve silmede aynı iki kaynaklı hedef çözümünü kullan; M. |
| 5 | İlk silme başarısızsa yeniden denenmesini bekler | `convex/actions/hikvisionSync.ts:525`; `convex/actions/hikQueueWorker.ts:127`; `convex/hikvisionSync.ts:762`; `convex/deviceSyncRuns.ts:714` | H2: başarısız dağıtımı uygulama; silme detayı bilinmiyor | KOPUK | Hata payload'unda eski kart saklı olsa da retry silinmiş `employees` kaydını ister. Kişi yoksa silme yapılamaz; Yetki Durumu yeniden dağıtımı da kişiyi bulamaz. | Silme işini eski kart/hedef snapshot'ıyla, kişi kaydından bağımsız tekrar et; M. |
| 6 | Parmak rızasını geri çeker veya kişi pasif olur | `convex/employeeConsents.ts:120`; `convex/lib/employeeCardChange.ts:27`; `convex/actions/hikFingerprint.ts:110` | H1; rıza iptalinin cihaz karşılığı RE'de yok | YARIM | Cihaz kimlikleri sabitlenir, merkezi şablonlar silinir ve cihaz silmeleri kuyruğa alınır. Yeni commit günlük tekrar silme işi ekledi (`convex/fingerprintEnrollment.ts:307`, `convex/crons.ts:100`); fiziksel silme yine cihaz yanıtına bağlıdır. | Offline silme ve 100'den fazla kayıt senaryosunu yeni committe teyit et; M. |
| 7 | KVKK biyometrik imhayı tamamlar | `convex/biometricDestruction.ts:76`, `:150`, `:179`; `convex/lib/employeeCascade.ts:27`, `:58` | RE'de eşdeğer imha kanıtı yok | YARIM | Yeni commit merkezi şablonları ve yalnız cihazda kalmış parmak kayıtlarını silme yoluna alıyor (`convex/biometricDestruction.ts:140`). Kişi silmede kart/ad maskelenirken olayın `rawData` alanı temizlenmez; cihaz silme sonucu ayrıca teyit edilmelidir. | Ham olay kişisel verisini temizle; cihaz silme kanıtını imha sonucuyla birlikte göster; M/L. |
| 8 | İşten ayrılmayı geri alır | `convex/employeeTermination.ts:77`, `:88` | H4: Reinstate | YARIM | Kişi aktifleşip mevcut kurallara yeniden gönderilir. Ayrılmada merkezi parmak şablonu da silindiği için geri alma yeniden parmak kaydı gerektirir. | Geri alma sonucunda kart/parmak durumunu ayrı göster; S. |

### A6 — Ziyaretçi kaydı, geçici yetki, süre sonu ve kart iadesi

Giriş: `src/App.tsx:74` → Ziyaretçiler; mobil kayıt `mobile/lib/repositories/visitor_repository.dart:119`.

| # | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek) |
|---|---|---|---|---|---|---|
| 1 | Çalışan mobilde ziyaretçiyi önceden bildirir | `convex/mobileVisitors.ts:80`, `:81`; mobil repository `:119` | H5: geçici kişi | TAMAM | Ön kayıt pasiftir; gerçek kart, grup veya cihaz işi üretilmez. Fiziksel erişim için web yöneticisi gerekir. | Ön kayıt/aktif ziyaretçi ayrımını koru; S. |
| 2 | Yönetici kart, bölge, ev sahibi ve süre atar | `convex/visitors.ts:262`, `:282`; `convex/lib/accessScopeRelations.ts:32`; `convex/visitors.ts:382` | H5: başlangıç/bitiş ve yetki | TAMAM | Proje ve ziyaretçi kuralı kontrol edilir; kişi kaydı ve kural üyeliği bağlanır. KVKK aydınlatma/rıza kaydı ayrı saklanır. | Aktivasyon sonrası cihaz sonucuna yönlendir; S. |
| 3 | Kartın belirlenen zaman aralığında çalışmasını bekler | `convex/visitors.ts:331`, `:346`; `convex/hikvisionSync.ts:182`; `convex/lib/gateway/persons.ts:92`; `convex/actions/ideGatewayDevice.ts:207` | H5: başlangıç/bitiş | KOPUK | Tarihler DB'de var, senkron verisinde yok. Hik varsayılan 2037 bitişi alır; IDE yalnız aktiflik/izin listesi alır. Fiziksel kart başlangıç saatinden önce de çalışabilir. | Başlangıç/bitişi cihaz geçerliliğine yaz; desteklemeyen cihazda güvenli sınır koy; L. |
| 4 | Süre dolunca kartın anında kapanmasını bekler | `convex/cardReadings.ts:1150`, `:1223`; `convex/crons.ts:66`; `convex/visitors.ts:537` | H5: bitiş zamanı | KOPUK | Genel bulut kartı bile tarihi doğrudan kontrol etmez; 5 dakikalık cron pasife çekene kadar izin verebilir. Hik/IDE'de buna teslim/çevrimdışı gecikmesi eklenir. | Bulut kararında kesin tarih kontrolü; cihazda bitişi önceden uygula; M/L. |
| 5 | Cron'un cihazdan erişimi kaldırmasını bekler | `convex/visitors.ts:554`, `:560`, `:566`; `convex/actions/hikvisionSync.ts:128` | H5: süre bitişinin uygulanması bilinmiyor | YARIM | IDE eski panel ve kartı açıkça alır; Hik mevcut aktif kural hedeflerini tekrar çözer. Kural önce silinmişse Hik hedefi kaybolmuştur. | Kişi×cihaz uygulanmış izin geçmişinden kaldır; M. |
| 6 | Erken çıkış yaptırıp kartı iade alır | `convex/visitors.ts:488`, `:502`, `:509`, `:518`; tekrar kullanım `:295` | H5: iptal | KOPUK | İade/reclaim DB kartını `IADE:...` yapabilir; bekleyen Hik silme henüz gerçek kartı okumadıysa artık yanlış kimliği okur. Aynı kart yeni ziyaretçiye verilirken eski silme işi de gecikmeli ulaşabilir. | Silme sırasında gerçek kartı sabitle; iade/reuse için silme onayı veya kart sürüm kontrolü koy; M. |
| 7 | Sorun varsa cihaz durumundan yeniden dener | `convex/accessGrantStatus.ts:180`; `convex/lib/grantStatus.ts:97`; `convex/visitors.ts:567` | H2/H5: izin durumu | YARIM | Ziyaretçi IDE silmeleri `employeeId` taşımadığı için kişi×cihaz durumu güncellenmez. Süresi bitmiş kart için ekranda eski Etkin durumu kalabilir. | Ziyaretçi silme işlerine kişi kimliği ekle; kart iadesini ayrı izle; M. |
| 8 | Kart vermeden PIN/QR veya tek geçiş tanımlar | `convex/visitors.ts:268`; `convex/mobileVisitors.ts:80`; `convex/mobileAccess.ts:22` | H5: PIN/QR/geçiş sayısı | EKSİK | Ziyaretçi akışı fiziksel kart ister. Çalışan mobil QR'ı ziyaretçiye verilen geçici PIN/QR akışı değildir. | Güvenli kart süreleri tamamlandıktan sonra geçici token/geçiş sayacı ekle; L. |

## 3. En önemli 5 bulgu

### 1 — P0: Hik'te erişimi kaldırmak, erişim eklemekle simetrik değil

**Neden önemli:** Kayıp kart veya kaldırılmış kural cihazda geçerli kalabilir; sunucudaki kayıt görünümü bunun önüne geçmez çünkü geçiş kararını Hik verir.

**Kanıt:** Kart değişimi yalnız eski IDE kartını ve parmak kaydını silip yeni Hik kimliğini gönderiyor (`convex/lib/employeeCardChange.ts:13`, `:16`, `:22`; `convex/actions/hikvisionSync.ts:275`). Kural silme ilişkileri önce siliyor, sonra güncel grafı okutan Hik senkronunu çağırıyor (`convex/accessRules.ts:846`, `:858`); son hedef yoksa sessiz dönüş var (`convex/actions/hikvisionSync.ts:128`). Kişi silme snapshot'ı `groupDoors` okumuyor (`convex/lib/peopleHikSnapshot.ts:27`), oysa ekleme yolu okuyor (`convex/hikvisionSync.ts:119`).

**Öneri:** Kart, kural ve kişi silmelerinde eski kart kimliği+önceden erişilen bütün cihazları tek işlemde dondur; her hedefin silme onayını sakla. Mevcut güvenli fark akışını (`convex/deviceSyncRuns.ts:530`) ortaklaştır. **Emek: L** (tek dallar M; ortaklaştırma ve cihaz matrisiyle L).

### 2 — P0: Proje kullanıcısı backend'den erişim kuralı değiştirebilir ve web kapı komutu gönderebilir

**Neden önemli:** Projeyi görüntüleme yetkisi fiziksel erişim verme yetkisine dönüşüyor. Arayüzde düğme gizlemek API çağrısını engellemiyor.

**Kanıt:** Kural create/update/remove/createWithGroups `authedMutation` kullanıyor (`convex/accessRules.ts:674`, `:709`, `:798`, `:871`); bu sarmalayıcı rol aramıyor (`convex/lib/customFunctions.ts:25`). Proje çözümü `project_user` için de üyelikleri döndürüyor (`convex/lib/auth.ts:76`). Hik uzaktan açma (`convex/actions/hikGatewayDevice.ts:418`) ve IDE açmanın `loadIdePanel` kontrolü (`convex/actions/ideGatewayDevice.ts:64`, `:377`) yalnız proje erişimi arıyor. Buna karşılık kişi yazma ve Yetki Durumu yönetici kontrollü.

**Öneri:** Kural yazma/silme ve web yönetici kapı komutlarına ortak yönetici kontrolü koy; çalışan mobilinin dar kişi/kapı/saat kontrolünü ayrı koru. Üç rol×aynı/farklı proje için reddetme testleri ekle. **Emek: M.**

### 3 — P0: Kişi silindikten sonra başarısız Hik silmesini mevcut tekrar yolu tamamlayamıyor

**Neden önemli:** Çevrimdışı cihazda kalan kartı, kişi DB'den kaldırıldıktan sonra otomatik veya Yetki Durumu ekranından temizlemek mümkün olmayabilir.

**Kanıt:** Silme hatası eski kart numarasını payload'a koyuyor (`convex/actions/hikvisionSync.ts:525`), fakat `deletePerson` retry bu değeri kullanmak yerine mevcut kişi kaydını şart koşuyor (`convex/actions/hikQueueWorker.ts:127`). Yeniden dağıtım da kişinin var olmasını şart koşuyor (`convex/deviceSyncRuns.ts:714`). Beş denemeye ulaşmış 24 saatlik hata “done/dismissed” yapılabiliyor (`convex/hikvisionSync.ts:970`); bu cihaz silme kanıtı değil.

**Öneri:** Silme komutunu kişi yaşam döngüsünden bağımsız sakla; eski kart/hedef bilgisiyle yeniden dene, cihaz onayı olmadan kapandı sayma. Silinmiş kişiler için cihaz bazlı “kaldırma bekliyor” kuyruğu sun. **Emek: M/L.**

### 4 — P1: Ziyaretçi süresi fiziksel kartlarda gerçek bir zaman sınırı değil

**Neden önemli:** “18:00'de biter” denilen yetki cron+teslim gecikmesine bağlı; çevrimdışı panelde süre çok daha uzun olabilir. Kart iadesi de bekleyen silmenin hedefini değiştirebilir.

**Kanıt:** Tarihler `employees` üzerinde tutuluyor (`convex/visitors.ts:331`), senkron verisine dahil değil (`convex/hikvisionSync.ts:182`), Hik varsayılan bitişi 2037 (`convex/lib/gateway/persons.ts:74`, `:95`). Fiziksel bulut kart kararında tarih kontrolü yok (`convex/cardReadings.ts:1150`, `:1223`), cron 5 dakikalık (`convex/crons.ts:66`). `checkOut` Hik'e yalnız employeeId gönderiyor; `releaseCard` kart kimliğini değiştiriyor (`convex/visitors.ts:502`, `:527`).

**Öneri:** Aynı başlangıç/bitiş kuralını bulut, gateway ve IDE'de uygula; desteklenmeyen dalı açıkça kısıtla. Kartı iade/reuse etmeden önce önceki yetkinin silme sonucunu doğrula; gecikmiş eski komutun yeni kart sahibini etkilemesini sürümle önle. **Emek: L.**

### 5 — P1: Toplu kart atama ile global olay eşleştirme birlikte projeler arası yanlış kayıt üretebilir

**Neden önemli:** B projesinde yapılan geçiş A projesinin kişisine bağlanabilir; geçiş/PDKS kanıtı ve proje ayrımı bozulur. Bu bulgu tek başına kapının açılacağını göstermez; olay eşleştirmesindeki kesin kod kopukluğudur.

**Kanıt:** `assignCards` başka projedeki aynı kartı çakışma saymaz (`convex/employeeImport.ts:109`, `:112`). Hik/IDE olayları kartı global `first()` ile arar (`convex/cardReadings.ts:1001`, `:1067`); satırın projesinde çalışan projesi cihaz projesinden önce gelir (`:910`). Cihaz token'ının cihazı sabitlemesi (`convex/http.ts:119`) bu kişi aramasını proje kapsamına daraltmıyor.

**Öneri:** Olay projesini doğrulanmış cihazdan türet; kişi aramasını aynı projeye bağla. Kart tekilliğini tekli/toplu/import akışlarında eşitle; var olan çakışmaları ayrıca raporlat. **Emek: M.**

## 4. TEYİT GEREK (canlı/cihaz)

Bu maddeler denenmedi; uygulama/kabul testi listesi olarak koordinatöre devredildi.

1. **Hik gateway:** Eski kart → yeni kart; son kural silme; yalnız kapı bağlı kişiyi silme. Eski kartı/parmağı tekrar okut ve cihaz kişi/kart listesini karşılaştır. Kodun atladığı silme işleri kesindir; sahadaki mevcut sızıntının miktarı bilinmiyor.
2. **Çevrimdışı silme:** Kişiyi silerken Hik offline, sonra online; eski kimlik payload'ıyla retry'nin tamamlanması, ekranda bekleyen kaldırmanın görünmesi.
3. **Çok kapı:** Aynı Hik cihazında farklı kapılara farklı saatler; gateway ISAPI ile Windows köprü sonuçları. Windows köprüye giden ilk-plan payload'unun gerçek tüketicide nasıl uygulandığı doğrulanmalı.
4. **IDE:** Kart upsert'in mevcut izinleri gerçekten değiştirmesi, silme/yeni kart sırası, boş/geçersiz kapı seçiminin tüm kapıları açmaması. `convex/crons.ts:58` timeout geri kuyruğa alma işi yorumda; canlı köprünün timeout/retry sorumluluğu doğrulanmalı.
5. **Ziyaretçi:** Başlangıçtan önce, tam bitişte, bitişten 1–5 dakika sonra; çevrimdışı cihaz ve kartın anında başka ziyaretçiye verilmesi. Cron'un çalışıyor olması cihaz silme onayının yerine geçmez.
6. **İşten ayrılma:** Son gün gece yarısı/TR 00:05; sonrasında çevrimdışı panelde fiziksel kart ve açık mobil oturum. W3b web hesabı dondurmanın çalışan kartına etki etmediği kullanıcıya gösterilmeli.
7. **Yetki durumu:** Hik kişi yazımı başarılı/kart yazımı hatalı; IDE ziyaretçi çıkışı; eski kart temizliği. Form sayacı ile kişi×cihaz tablosu aynı olayı anlatmalı; “Etkin” fiziksel kapı açılışı olarak yorumlanmamalı.
8. **Biyometri:** Yeni `1f213ede` merkezi saklama/dağıtma, farklı Hik modelleri, kaynak cihazda kayıt başarılı/merkezi kayıt hatalı durumu, rıza iptali ve offline silme tekrarları fiziksel olarak doğrulanmalı. Şablonların kaydedildiği kodda var; canlı şifreleme anahtarı veya cihaz uyumu kontrol edilmedi.
9. **Proje/rol:** Aynı kart numarası iki projede; `project_user` kural yazma ve web remote-open çağrıları; hata/ret kayıtlarının doğru projeye düşmesi.
10. **Grup B devir:** Kart/parmak/karışık doğrulama olay örneklerinde `classifyReadingSource` sonucu, cihaz zamanının doğru saklanması ve PDKS'e yalnız izinli kaynakların ulaşması. Hik canlı olayında `accessTime` alış zamanından oluşuyor (`convex/cardReadings.ts:908`, `:1041`); IDE kendi olay zamanını kullanıyor (`:1065`). Gecikmiş Hik olaylarının puantaj etkisini Grup B incelemeli.

## 5. Kapsam dışı bıraktıklarım

- PDKS gün/saat, bordro ve rapor hesapları; yalnız `cardReadings` → kaynak/proje/check point filtresi devir noktası gösterildi.
- Cihaz ekleme, ağ/provizyon, alarm ve bağlantı operasyonları; Windows/IDE dış servislerinin çalıştığı iddia edilmedi.
- Canlı Hik-Connect oturumu veya yeni RE; kıyas yalnız verilen yerel dokümanlardaki gözlemlerle sınırlı.
- Hukuki uygunluk görüşü, gerçek kişisel veri incelemesi, DB sorgusu, cihaz/ağ çağrısı, paket kurulumu, test/lint/build, commit/push/deploy yapılmadı.
- Başka oturumun koduna dokunulmadı; audit sırasında gelen commitler salt okunarak değerlendirmeye katıldı. Bu audit yalnız bu rapor dosyasını oluşturdu.
