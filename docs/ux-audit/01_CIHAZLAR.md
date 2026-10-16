# Cihazlar — UX/UI Audit (2026-10-16)

> Kapsam: `/devices`, `/virtual-readers`; `src/components/devices/**` (çalışma ağacında 41 dosya), `src/components/sync/**` (2 dosya), `deviceDisplay`, `deviceStatus`, `syncErrorMessages`; bağlı hook'lar, kapı/okuyucu ağacı ve bu ekranları besleyen Convex fonksiyonları. Sayım: 🔴 8 · 🟠 21 · 🟡 10 · ⚪ 0
> Yöntem: salt okunur kaynak incelemesi; kanıtlar repo köküne göre `path:satır`. Canlı DB, cihaz, tarayıcı oturumu veya dev server kullanılmadı. Ekran görüntüsü, gerçek gecikme, kontrast ölçümü ve donanım sonucu **(doğrulanmadı)**. Adım sayıları kaynakta görünen kullanıcı karar/eylemleridir; alan başına tuş vuruşları değildir.

## 1. Özet

Modülün ana işi cihazı projeye almak, bağlantısını izlemek, fiziksel kapı ile mantıksal okuyucuyu eşlemek ve senkron sorununu gidermektir. En ciddi üç sorun, bağlantı durumunun kayıtlı aktiflik alanını ezmesi, konum atamasının yanlış bağlantı veya sahte başarı üretebilmesi ve senkron uyarısını kapatmanın gerçek sorunu çözülmüş gibi göstermesidir. Çok kapılı model backend'de mevcut olmasına rağmen liste filtresi ve eski konum diyaloğu hâlâ tek `device.doorId` varsayımı kullanıyor. Cihaz Merkezi olumlu bir başlangıçtır; fakat aynı komutlar Bilgiler formunda da bulunuyor, başarılı tanılama paneli kapatıyor ve bazı komutlarda kuyruk kabulü fiziksel başarı diye sunuluyor. Öncelik görsel yenilemeden önce bu davranışların düzeltilmesi; ardından tek cihaz ayrıntısı, anlaşılır Türkçe durumlar ve erişilebilir mobil yerleşimdir.

### İnceleme kapsamı ve korunan davranışlar

| Ekran / akış | Rubrik kapsamı ve sonuç |
|---|---|
| Liste, arama, filtre, istatistik, seçim ve silme | 1–10 incelendi: DEV-01–11, DEV-35. StatCard zaten ortak bileşen; toplamlar filtrelenmiş listeyi izliyor. Tablo yatay kaydırma ve sticky başlık içeriyor; sorun sayfanın dış yerleşiminde. |
| Yeni cihaz: marka → Hikvision gateway / yerel bridge, IDE Smart, diğer | 1–10 incelendi: DEV-12–18, DEV-26, DEV-38. Zod + FormMessage ve kaydetme pending hali mevcut; model seçiminin adın hemen ardından gelmesi korunmalı. |
| Havuzdan ekleme, düzenleme, konum atama | 1–10 incelendi: DEV-01, DEV-12–20, DEV-38. Proje değişiminde havuz formunun bölgeyi sıfırlaması doğru; varsayılan yeni bölge adı hatalı. |
| Bölge → cihaz → kapı → okuyucu; okuyucu ekle/taşı/sil | 1–10 incelendi: DEV-03, DEV-05, DEV-09–10, DEV-20, DEV-35–37. Kapı/bölge seçimleri gerçek button; taşıma hedef kapasitesini açıklıyor. |
| Cihaz Merkezi, Hikvision tanılama, kapı açma, token yenileme | 1–10 incelendi: DEV-21–26, DEV-35, DEV-39. Merkezde kapı açma ve yeniden başlatma onayı var; aynı güvence eski form aksiyonlarında yok. |
| QR görüntüle/indir, sanal okuyucu simülasyonu | 1–10 incelendi: DEV-27–29. Sanal sayfa responsive grid kullanıyor, fakat verisi örnek veri. |
| Global senkron sorunları ve sayfa içi durum şeridi | 1–10 incelendi: DEV-30–34, DEV-26. Ortak benign hata sınıflandırması ve sayfa içi `role=status` iyi; tamamlanma semantiği sorunlu. |

`form-fields/*` altındaki beş eski bileşen ve `DevicesHeader` da okundu; `src` import taramasında aktif tüketici bulunmadı. Bunlardaki tek başına stil farkları kullanıcıya ulaşan ekran bulgusu sayılmadı. Güncel kaynak, handoff'tan ileride: `convex/readers.ts:169` taşıma işlemini içeriyor; `convex/readers.ts:280` son okuyucuyu da silebiliyor; dolayısıyla handoff'taki “son okuyucu silinemez” bilgisi mevcut davranış kabul edilmedi.

## 2. Ana görevler

| Görev | Bugünkü akış (adım sayısı) | Takıldığı yer |
|---|---|---|
| Yeni Hikvision eklemek | Cihaz Ekle → Yeni → marka → ad/model/konum/bağlantı → Kaydet; yeni bölge için ayrıca diyalog (5–7) | Modelin oluşturacağı topoloji özetlenmiyor; bağlantı kaydı başarısız olsa da form kapanabiliyor. |
| Yeni IDE paneli eklemek | Cihaz Ekle → Yeni → IDE → kimlik/bölge/kapı → Kaydet (5) | Boş kapı sayısı 4'e düşüyor; Pasif seçimi create payload'ına gitmiyor; hazır şifre gerçek bağlantı doğrulaması değil. |
| Havuz cihazını projeye almak | Cihaz Ekle → Buluttan Ekle → cihaz → bölge/kimlik → Projeye Ekle (5; super_admin için proje seçimiyle 6) | Varsayılan bölge adı cihaz adıyla aynı; backend reddediyor. |
| Çevrimdışı cihazı bulup incelemek | Durum filtresi → satır → Cihaz Merkezi → tanılama (4) | Aktif/Pasif ile Çevrimiçi/Çevrimdışı karışıyor; bazı sonuçlar görünmeden panel kapanıyor. |
| Kapı/okuyucu eşlemek | Bölge aç → cihaz aç → kapı/okuyucu aksiyonu → hedef/yön → kaydet (5) | Kapı seçimi cihaz listesini boşaltabiliyor; ayrı Konum Ata akışı sahiplik modeline uymuyor. |
| Cihazları silmek veya havuza döndürmek | Seç → Sil → onay (3); havuza dönüşte satır aksiyonu → onay (2) | Filtre dışında kalan seçimler silinebilir; silme diyaloğu okuma geçmişi kaybını açıklamıyor. Havuza dönüş diyaloğu bunu açıklıyor. |
| Senkron hatasını çözmek | Banner aç → hata oku → cihazı elle bul → düzenle/tanıla (4+); kapat (2) | Doğrudan çözüm bağlantısı yok; kapatma çözüm olmadığı halde başarı hesabını etkiliyor. |
| QR kullanmak | Satır QR → indir (2); sanal okuyucu → karta tıkla (2) | SVG indirme kırık; sanal ekran gerçek okuyucu/proje yerine sabit örnekler kullanıyor. |

## 3. Bulgular

Önem: 🔴 Kritik = yanlış veri/kırık kontrol/veri kaybı riski; 🟠 Yüksek = ana görevi ciddi zorlaştırır; 🟡 Orta = tutarlılık/erişilebilirlik/cila. Efor: S <2 saat; M yaklaşık yarım gün; L 1+ gün. Kategori numaraları görevdeki 1–10 rubriğine karşılık gelir; eforlar örtüşen işler nedeniyle doğrudan toplanmamalıdır.

### A. Cihaz listesi, filtreler ve toplu işlemler

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| DEV-01 | 🔴 Kritik | 1,4,8,10 | **Bağlantı durumu kayıtlı aktifliği eziyor.** Hook `status` üzerine online/offline yazar; aynı nesne edit'e gider; form bu iki değeri active'e çevirir. Pasif cihazda yalnız ad değiştirip kaydetmek `status=active` yazabilir. Ayrıca IDE create formundaki Pasif alanı payload'a alınmaz; backend hep active yazar. `isActive` ayrı kaldığı için aktiflik anlamı da parçalıdır. | `src/hooks/useProjectFilteredDevices.ts:23`, `src/pages/Devices.tsx:91`, `src/components/devices/hooks/buildDeviceFormValues.ts:92`, `src/components/devices/hooks/useDeviceFormSubmission.ts:209`, `src/components/devices/hooks/useDeviceFormSubmission.ts:63`, `convex/devices.ts:646` | Ham kayıt ile `connectionStatus` ayrılmalı; form ham aktifliği okumalı. Aktif/Pasif için tek kalıcı sözleşme belirle; create/update bunu eşit uygulamalı. Filtre ve kartlar “Çevrimiçi/Çevrimdışı” demeli; hiç üretilmeyen expired kartını kaldır veya gerçek veriyle besle. | L |
| DEV-02 | 🟠 Yüksek | 1,3 | **Online bilgisi saat geçtikçe kendiliğinden güncellenmiyor ve ekranlar farklı kaynak kullanıyor.** Listede Date.now yalnız render'da okunuyor; veri değişmeden beş dakika geçmesi render tetiklemez. Merkez gateway için hikLastSeenAt, liste lastSeen, eski form ayrıca hikOfflineHint kullanır. | `src/hooks/useProjectFilteredDevices.ts:20`, `src/lib/deviceStatus.ts:14`, `convex/deviceCenter.ts:191`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:221` | Tek bağlantı durumu hesaplayıcısı; marka/transport ve offline hint aynı sözleşmede. Görünür ekranda zamanlayıcıyla tazelik yeniden hesaplanmalı; “Son sinyal” ve “Henüz bağlanmadı” ayrı gösterilmeli. | M |
| DEV-03 | 🟠 Yüksek | 1,2 | **Otomatik oluşturulan kapıya tıklamak bağlı cihazı listeden çıkarabilir.** Filtre yalnız `device.doorId` karşılaştırır; Hik/IDE provizyonu kapılara `deviceId` yazar ve cihaza yalnız zoneId patch eder. Bu yeni cihazlarda seçilen kapı cihazla eşleşmez. | `src/hooks/useDeviceFilters.tsx:26`, `convex/devices.ts:664`, `convex/devices.ts:772`, `convex/lib/deviceHelpers.ts:247` | Kapı filtresini `doors.deviceId` üzerinden çöz; legacy doorId için açık fallback tut. Filtreyi görünür chip ve temizle aksiyonuyla göster; proje değişiminde temizle, URL'ye taşı. | M |
| DEV-04 | 🟡 Orta | 1,8 | **“Cihaz Modeli” kolonunda model yerine tip var.** DS-K2804 yerine Kart Okuyucu/Kontrol Paneli görünür; gerçek model seçimle kaydedildiği halde envanterde bulunamaz. | `src/components/devices/DeviceList.tsx:93`, `src/components/devices/DeviceTableRow.tsx:95`, `src/components/devices/hooks/useDeviceFormSubmission.ts:105` | Modeli hikModel'den göster; tip ayrı yardımcı metin olsun. IDE'de UUID model değildir; marka ve bilinen model/yetenek ayrı gösterilmeli. | S |
| DEV-05 | 🟡 Orta | 2,8 | **IDE kimliğini bulmak ve adını eşleştirmek zor.** Tabloda UUID gösterilir ancak arama ideUuid'yi aramaz. Ağaçtaki deviceDisplayName her IDE cihazında kullanıcı adını bırakıp “IDE Smart · son4” döndürür; tablo ise adı gösterir. | `src/components/devices/DeviceTableRow.tsx:91`, `src/hooks/useDeviceFilters.tsx:39`, `src/lib/deviceDisplay.ts:12`, `src/components/access-control/ZoneDoorTree.tsx:582` | UUID aramasını ekle; özel adı koru, yalnız ad UUID/boş olduğunda fallback kullan. Seri/UUID ikincil, kopyalanabilir bilgi olsun. | S |
| DEV-06 | 🔴 Kritik | 1,3 | **Filtre dışında kalan eski seçimler silinebiliyor.** selectedDevices filtre/proje değişiminde uzlaştırılmaz. Seçili A gizlenip filtrede B kaldığında yalnız uzunluk eşitliği “tümü seçili” gösterebilir; toplu silme hâlâ A'yı siler. | `src/hooks/useDeviceTable.tsx:9`, `src/hooks/useDeviceTable.tsx:32`, `src/components/devices/DeviceList.tsx:57`, `src/components/devices/DeviceList.tsx:85` | Proje değişiminde seçim sıfırlansın; filtre değişiminde görünür seçimle kesişim veya açık “filtre dışında N seçim” modeli kullanılsın. Onayda gerçek adlar gösterilsin; tümünü seç durumu ID kümesiyle hesaplansın. | M |
| DEV-07 | 🔴 Kritik | 1,3,8 | **Silme onayı gerçek veri kaybını açıklamıyor.** Diyalog yalnız cihazın silineceğini söyler; backend kart okuma geçmişini, erişim grubu bağlantılarını, kapı ve okuyucuları da siler. İK kullanıcısı geçmiş kayıt etkisini bilmeden onaylayabilir. | `src/components/devices/DeviceTableRow.tsx:180`, `src/components/devices/DeviceDeleteDialog.tsx:32`, `convex/devices.ts:392`, `convex/lib/deviceHelpers.ts:24`, `convex/lib/deviceHelpers.ts:38` | Cihaz adı + bağlı kayıt kapsamı açık önizleme; arşivleme/bağlantıyı kesme öncelikli seçenek. Kalıcı silme ayrı ve açık adlandırılmış olmalı. Geçmişi koruyan ürün davranışı backend kararı gerektirir; yalnız metin düzeltmesi geçmişi korumaz. | M |
| DEV-08 | 🟠 Yüksek | 1,3 | **Toplu silmede kısmi başarı belirsiz; işlem sürerken tekrar çağrı engeli yok.** Promise.all bir hata gördüğünde diğer silmeler devam eder; catch yalnız genel hata verir, başarıyla silinen ID'ler seçimde kalır. Tekli silme/havuza dönüş onayları da pending state taşımıyor. | `src/hooks/useDeviceTable.tsx:30`, `src/components/devices/DeviceDeleteDialog.tsx:37`, `src/components/devices/DeviceTableRow.tsx:159`, `src/components/devices/useDeviceActions.tsx:10` | İşlem boyunca onay düğmesini kilitle; satır bazlı sonuçları topla, sadece başarısızları seçili bırak; “3 silindi, 1 silinemedi” ve yeniden deneme sun. | M |
| DEV-09 | 🟠 Yüksek | 6 | **Mobilde ağaç tüm genişliği alırken tablo aynı yatay flex satırında kalıyor.** Ağaç küçük ekranda w-full + shrink-0, parent flex yönü her zaman row. Tablo içindeki overflow-x-auto bunu çözmez; ana içerik sıkışır/ekran dışına taşar (gerçek viewport sonucu doğrulanmadı). | `src/pages/Devices.tsx:117`, `src/components/access-control/ZoneDoorTreePanel.tsx:40`, `src/components/devices/DeviceFilters.tsx:67` | Mobilde ağaç bir “Bölge/Kapı” sheet'i olsun; ana liste tam genişlikte. Filtre grubu sarılsın; mobil satır kartı veya öncelikli kolonlar kullanılsın. 320/375 px ve %200 zoom kontrolü. | M |
| DEV-10 | 🟡 Orta | 6,7 | **Seçim kontrolleri adsız; ağaçta bazı kontroller klavye/dokunmada bulunamıyor.** Tablo checkbox'larında erişilebilir ad yok; proje başlığı yalnız onClick div. Okuyucu aksiyonları 20 px ve opacity-0; focus-within görünürlük kuralı yok. Satırın kendisi klavyeye açık değil; ayrı Düzenle düğmesi alternatif olduğundan “edit tamamen erişilemez” denmiyor. | `src/components/devices/DeviceList.tsx:84`, `src/components/devices/DeviceTableRow.tsx:78`, `src/components/access-control/ZoneDoorTreePanel.tsx:42`, `src/components/access-control/ZoneDoorTree.tsx:314` | Checkbox'a cihaz adıyla aria-label, başlığa button; hover/focus/touch görünürlüğü; en az 24 px hedef, mobilde rahat 44 px alan. İkon düğmelerine açık aria-label; satır içinde ad bağlantısı. | M |
| DEV-11 | 🟡 Orta | 2,3,9 | **Başlangıç yüklemesi tüm içeriği blokluyor; boş/hata durumu göreve yönlendirmiyor.** Sayfa tam spinner döndürür; hook error:null/refetch no-op taşır. Yerel boş durum metni ekle veya filtre temizle düğmesi içermez; sayfada yerel ErrorState yok (üst hata sınırı davranışı doğrulanmadı). | `src/pages/Devices.tsx:107`, `src/hooks/useProjectFilteredDevices.ts:33`, `src/components/devices/DeviceList.tsx:134` | Başlık/ağaç/listede bölüm iskeletleri; EmptyState ile yetkiye uygun ekle/filtre temizle; gerçek query hata sınırı + ErrorState geri dönüşü. No-op refetch'i yenile düğmesine bağlama. | M |

### B. Ekleme, provizyon, düzenleme ve konum

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| DEV-12 | 🟠 Yüksek | 1,4 | **Havuz akışı varsayılan değerleriyle başarısız.** Cihaz seçimi hem panel adını hem yeni bölge adını aynı değerle doldurur; canSubmit buna izin verir. claim helper'ı aynı adları resolveOrCreateZone'a gönderir; backend “Bölge adı cihaz adıyla aynı olamaz” der. | `src/components/devices/ClaimDeviceDialog.tsx:90`, `src/components/devices/ClaimDeviceDialog.tsx:94`, `src/components/devices/ClaimDeviceDialog.tsx:104`, `convex/lib/devicePool.ts:60`, `convex/lib/deviceHelpers.ts:105` | Bölgeyi boş bırakıp anlamlı placeholder göster veya farklı öneri üret; aynı ad kuralını alan yanında doğrula. Kaydet öncesi panel/bölge/kapı özeti göster. | S |
| DEV-13 | 🟠 Yüksek | 1,2,4 | **Model/kapı sayısı düzenleme topoloji değiştiriyor izlenimi veriyor ama sadece metadata değişiyor.** Model seçimi transport'u ve sayıyı otomatik değiştirir; edit update kapı/okuyucuları yeniden üretmez. IDE'de de kapı sayısı değiştirilebilir. Yeni Hik modelinde beklenen kapı/okuyucu özeti artık render edilmiyor. | `src/components/devices/form-sections/DeviceHikModelField.tsx:48`, `src/components/devices/form-sections/DeviceIdeSmartSection.tsx:68`, `src/components/devices/hooks/useDeviceFormSubmission.ts:154`, `convex/devices.ts:329` | Yeni cihazda “4 kapı · 4 okuyucu oluşturulacak” özeti; edit'te model/sayı alanını salt okunur yap veya ayrı topoloji değişikliği akışı sun. Mevcut kapılar ile önerilen fark onaysız uygulanmamalı; transport'u sessizce değiştirme. | M |
| DEV-14 | 🟠 Yüksek | 1,3 | **Hikvision kaydı ile bağlantı kaydı tek sonuç gibi sunuluyor.** Cihaz oluşturulduktan sonra gateway registration ok:false olsa da onSuccess formu kapatır ve “kaydedildi” toast'ı hata toast'ını örtebilir. Action throw ederse kayıt oluşturulmuş olmasına rağmen form yeni cihaz modunda kalır; yeniden Kaydet tekrar create yoluna girer. | `src/components/devices/hooks/useDeviceFormSubmission.ts:97`, `src/components/devices/hooks/useDeviceFormSubmission.ts:127`, `src/components/devices/hooks/useDeviceFormSubmission.ts:141`, `src/pages/Devices.tsx:98`, `src/hooks/use-toast.ts:8` | Kaydı oluşturma ile bağlantıyı hazırlamayı iki kalıcı aşama olarak göster; yeni ID'yi koru. Kısmi başarıda “Cihaz kaydedildi, bağlantı kurulamadı” + yalnız kayıtlı cihaz için bağlantıyı tekrar dene. Tek sonuç bildirimi üret. | M |
| DEV-15 | 🟠 Yüksek | 1,4 | **Alan temizleme kaydedilmiyor.** Açıklama/IP silinince undefined gönderilir; update undefined'ı atlar. Katalog modelinden Diğer(manuel)'e geçiş de hikModel'i undefined gönderdiği için eski model kalabilir. Kullanıcı başarı görür, tekrar açınca eski değer döner. | `src/components/devices/hooks/useDeviceFormSubmission.ts:181`, `src/components/devices/hooks/useDeviceFormSubmission.ts:208`, `src/components/devices/hooks/useDeviceFormSubmission.ts:155`, `convex/devices.ts:330` | “Değişmedi” ile “temizle” API sözleşmesini ayır: metinlerde açık boş string veya nullable/clearFields yaklaşımı; model için açık temizleme. Form normalizasyonunda alan bazlı karar kullan. | M |
| DEV-16 | 🟠 Yüksek | 3,4 | **Uzun form kaydetmeden kapanabiliyor.** Sheet dış tıklama/Escape kapanışı doğrudan onClose; marka geri dönüşü formu unmount eder. isDirty koruması yok; pending sadece footer düğmelerini kilitler. | `src/components/devices/DeviceDetailsPanel.tsx:58`, `src/components/devices/DeviceDetailsPanel.tsx:118`, `src/components/devices/DeviceForm.tsx:159`, `src/components/devices/ClaimDeviceDialog.tsx:141` | Kirli formda “Değişiklikleri bırak / Düzenlemeye dön” onayı; kaydetme süresince kapanış kontrolü; marka geri dönüşünde taslağı sakla. Footer görünür/sticky olsun. | M |
| DEV-17 | 🟠 Yüksek | 1,4,8 | **Yerel bridge kurulumu boş bağlantı bilgileriyle tamamlanabilir.** Schema IP/kullanıcı/şifreyi optional bırakır ve localBridge için zorunluluk eklemez; form bunları gerekli mi diye açıklamaz. Sayısal min/max/int hataları Türkçeleştirilmemiş; IDE HTTP portunda 65535 üst sınırı yok. | `src/components/devices/hooks/useDeviceFormSchema.ts:45`, `src/components/devices/hooks/useDeviceFormSchema.ts:98`, `src/components/devices/hooks/useDeviceFormSchema.ts:20`, `src/components/devices/hooks/useDeviceFormSchema.ts:75`, `src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx:67` | Kaydın taslak mı bağlanabilir mi olduğunu ayır; localBridge'de geçerli IP/host, kullanıcı ve şifre gereksinimini doğrula. Türkçe aralık/tam sayı hataları; kaydetmeden bağlantı testi ayrı durum. | M |
| DEV-18 | 🟡 Orta | 1,2,4 | **Yeni bölge yaratma markaya göre farklı commit anına sahip.** Hik/diğer formundaki alt diyalog bölgeyi hemen yazar; sonra cihazı iptal etmek bölgeyi bırakır. IDE yeni bölgeyi cihaz kaydına kadar taslak tutar. | `src/components/devices/form-sections/DeviceLocationSection.tsx:72`, `src/components/devices/form-sections/DeviceZoneSection.tsx:61`, `src/components/devices/hooks/useDeviceFormSubmission.ts:55` | Yeni bölgeyi ortak taslak alanı olarak taşı; cihazla aynı mutation'da oluştur. Ayrı bölge oluşturma korunacaksa kalıcılığı açıkça bildir. | M |
| DEV-19 | 🔴 Kritik | 1,3 | **Konum ataması başarısızken başarı toast'ı atıp kapanıyor.** useLocationForm catch hatayı yutar; AssignLocationForm await sonrası koşulsuz “Location assigned” üretir ve kapanır. Başarılı durumda da iki toast vardır. | `src/components/devices/useLocationForm.tsx:36`, `src/components/devices/AssignLocationForm.tsx:91` | Hata yeniden throw edilsin veya typed result dönsün; sonuç bildirimi tek katmanda olsun. Hata halinde alanlar ve diyalog korunmalı, başarı yalnız mutation tamamlanınca gösterilmeli. | S |
| DEV-20 | 🔴 Kritik | 1,2 | **Konum Ata paneli başka cihazın kapısına bağlayabilir.** Seçenekler aynı bölgedeki tüm kapılar; owner kontrolü yok. devices.update yalnız hedef projeyi denetler; doorId sahipliğini ve zone-door tutarlılığını denetlemez. Bölge değişiminde panelin kendi bütün kapı/okuyucuları taşınırken device.doorId başka panelin kapısını gösterebilir. | `src/components/devices/AssignLocationForm.tsx:60`, `src/components/devices/useLocationForm.tsx:29`, `convex/devices.ts:310`, `convex/devices.ts:338` | Panel için “Bölgeyi değiştir — N kapı/N okuyucu taşınacak”; tek okuyucu için açık kapı eşleme. Backend aynı proje yanında zone/owner/topoloji değişmezlerini doğrulamalı; pointer ile fiziksel sahiplik ayrılaştırılmalı. | L |

### C. Cihaz ayrıntısı ve komutlar

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| DEV-21 | 🟠 Yüksek | 1,2,3 | **Başarılı tanılama sonucu panel kapanıyor.** Merkez runImmediate onUpdated çağırır; bu prop sayfanın paneli kapatan onSuccess'idir. Kart okut/eşitlik sonucu local state'e yazılır yazılmaz görünüm gider. Özellik taraması/yenileme eski formda da aynı callback'i kullanır. | `src/components/devices/DeviceCommandCenter.tsx:268`, `src/components/devices/DeviceCommandCenter.tsx:333`, `src/components/devices/DeviceDetailsPanel.tsx:107`, `src/pages/Devices.tsx:98`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:368` | onSavedAndClose ile onDataUpdated ayrılmalı. Komut ve tanılama sonucu panelde kalmalı; reaktif query zaten günceller. Aynı komutları Bilgiler'den kaldırıp tek merkezde topla. | M |
| DEV-22 | 🔴 Kritik | 1,3 | **Bilgiler'deki “Kapıyı Aç” koşulsuz kapı 1'e komut gönderiyor ve onay yok.** Çok kapılı cihazda kullanıcı hedefi seçemez; localBridge ve gateway aynı handler'ı kullanır. Merkezde hedef kapı seçimi ve onay varken eski yol bunu bypass eder. | `src/components/devices/form-sections/DeviceHikvisionSection.tsx:230`, `src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx:103`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:511`, `src/components/devices/DeviceCommandCenter.tsx:370` | Eski kapı aç yolunu kaldır; hedef kapı adı/numarası + cihazı gösteren ortak onay kullan. Numara tanımsızsa 1'e düşme, eşleme düzeltmeye yönlendir. | M |
| DEV-23 | 🟠 Yüksek | 3,8 | **Bağlantıyı kesebilecek iki eylem onaysız.** Gateway “Kaldır” doğrudan silme action'ına gider; token yenileme eski token'ı hemen geçersiz kılar. Token metni etkiyi anlatıyor fakat son onay/kurulum adımı yok. | `src/components/devices/form-sections/DeviceHikvisionSection.tsx:249`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:539`, `src/components/devices/DeviceApiTokenCard.tsx:36`, `src/components/devices/DeviceApiTokenCard.tsx:72` | “Gateway bağlantısını kaldır” açık adı, etkisi ve onayı; token için “eski bağlantı anahtarı geçersiz olacak” onayı + yeni anahtarı uygulama/kopyalama adımı. Aynı AlertDialog standardı. | M |
| DEV-24 | 🟡 Orta | 1,3 | **Merkez desteklenmeyen komutları etkin bırakıyor.** Olayları Tara/Kart Okut yalnız markaya bakıyor; localBridge veya gateway kaydı olmayan Hik cihazında etkin. Backend her ikisini gateway gereksinimiyle reddediyor. | `src/components/devices/DeviceCommandCenter.tsx:598`, `src/components/devices/DeviceCommandCenter.tsx:601`, `convex/actions/hikGatewayDevice.ts:549`, `convex/actions/hikGatewayDevice.ts:915` | Tüm komutları tek brand/transport/yetenek sözleşmesiyle kapıla; disabled nedeni komut yanında görünsün. Kullanıcıyı başarısız isteğe göndermeden eksik kurulum adımına bağla. | S |
| DEV-25 | 🟠 Yüksek | 1,3 | **Kuyruğa alma “İşlem tamamlandı” diye sunuluyor.** IDE kapı aç/senkron queued:true döner; UI bunu yalnız ok:true'ya indirger. localBridge kapı aç da yalnız enqueue eder. Panel henüz yanıt vermemişken fiziksel işlem tamamlanmış algısı oluşur. | `convex/actions/ideGatewayDevice.ts:461`, `convex/actions/hikGatewayDevice.ts:387`, `src/components/devices/DeviceCommandCenter.tsx:378`, `src/components/devices/DeviceCommandCenter.tsx:120` | “Komut sıraya alındı → Gönderildi → Cihaz onayladı / Başarısız” ayrı durumları; opId ile takip. Gerçek sensör doğrulaması yoksa “Kapı açıldı” iddiası kurma. | L |
| DEV-26 | 🟡 Orta | 2,5,8 | **Operasyon dili ve görsel dil dağınık.** Marka seçici IDE'yi HTTP/JSON ve bölge olarak anlatırken gerçek akış MQTT ve ayrı bölgedir. Merkezde Capability Snapshot/Holiday Plan, formda major/minor/state var; normal yönetim formu teknik rapora dönüşüyor. Sabit green/red/emerald renkleri ve iki toast sistemi birlikte kullanılıyor. | `src/components/devices/BrandPickerStep.tsx:27`, `src/components/devices/DeviceCommandCenter.tsx:463`, `src/components/devices/DeviceCommandCenter.tsx:638`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:796`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:851`, `src/components/sync/DeviceSyncStatusBanner.tsx:23` | Türkçe görev dili: Bağlantı, Cihaz özellikleri, Eşitleme; teknik detaylar açılır ikincil alan. Kullanılamayan gelecek özellik düğmelerini ürün akışından çıkar. Semantik status tokenları, lucide ve tek sonner sonuç bildirimi; dark-mode kontrastını ayrıca ölç. | M |

### D. QR ve sanal okuyucular

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| DEV-27 | 🟠 Yüksek | 1,10 | **QR indirme runtime'da kırık; IDE için QR boş olabilir.** QRCodeSVG render edilir fakat seçilen element HTMLCanvasElement cast edilip toDataURL çağrılır. Ayrıca her satıra QR verilirken içerik yalnız deviceSerial'dir; IDE kimliği ideUuid olduğundan boş string oluşabilir. | `src/components/devices/QRCodeDialog.tsx:4`, `src/components/devices/useQRCodeDialog.tsx:18`, `src/components/devices/useQRCodeDialog.tsx:23`, `src/components/devices/useQRCodeDialog.tsx:10`, `src/components/devices/DeviceTableRow.tsx:104` | QR kullanım amacını ve payload sözleşmesini belirle; geçerli kimliği olmayan cihazda eylemi açıklamayla kapat. Canvas render + typed ref veya gerçek SVG dosyası indirme kullan; çıktı uzantısı içeriğe uysun. | M |
| DEV-28 | 🟠 Yüksek | 1,2,8 | **Sanal okuyucular üretim envanterine bağlı değil.** Route altı sabit İngilizce okuyucu gösterir; hepsi varsayılan VQR-001 ile `/api/check-access` çağırır ve QR sadece VR-001 gibi örnek ID taşır. Repo taramasında bu endpoint'in handler'ı/proxy'si yok; dış deployment yönlendirmesi **(doğrulanmadı)**. Gerçek proje/kapı/personel seçimi ve sonuç kaynağı yok. | `src/pages/VirtualReaders.tsx:5`, `src/pages/VirtualReaders.tsx:19`, `src/components/devices/VirtualReader.tsx:18`, `src/components/devices/VirtualReader.tsx:22`, `src/App.tsx:68`, `vite.config.ts:7` | İlk fazda açık “Demo / simülasyon” sınırı veya üretim navigasyonundan kaldırma; sonraki fazda aktif proje ve gerçek sanal okuyucu listesi, kapı/yön eşleme, amaçlı QR sözleşmesi. Sahte erişim sonucu üretme. | L |
| DEV-29 | 🟡 Orta | 3,7 | **Sanal okuma fareye bağlı ve tekrar tıklanabiliyor.** onClick CardContent div'inde; button/klavye handler'ı ve pending durumu yok. Sonuç sadece toast; tekrar deneme, son sonuç zamanı ve kalıcı hata açıklaması yok. | `src/components/devices/VirtualReader.tsx:20`, `src/components/devices/VirtualReader.tsx:38`, `src/components/devices/VirtualReader.tsx:51` | Açık “Test et” button; pending/disabled, satır içi sonuç ve aria-live. İstek sırasında tek çağrı; tekrar deneme ve Türkçe hata nedeni. | M |

### E. Senkron sorunları ve durum şeritleri

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| DEV-30 | 🔴 Kritik | 1,3 | **Uyarıyı kapatmak gerçek senkron durumunu değiştiriyor.** Hik dismiss status=done yazar; IDE dismiss başarısız op'u siler. Status query yalnız uçuş/failed sayar; bunlar sıfırlanınca “tüm değişiklikler panellere işlendi” der. Bildirimi görmüş olmak cihazın işlemi uyguladığına kanıt değildir. | `convex/hikvisionSync.ts:722`, `convex/ideSync.ts:599`, `convex/syncStatus.ts:90`, `src/components/sync/DeviceSyncStatusBanner.tsx:74` | Bildirim okunma/kapatılma bilgisini operasyon sonucundan ayır. Kapatılan başarısız op başarısız kalmalı; başarı yalnız ack/done gerçek işleyiciden gelsin. Boş kuyruk için “Bekleyen işlem yok”; doğrulanmış senkron için ayrıca tarih/kanıt. | L |
| DEV-31 | 🟠 Yüksek | 1,2,3 | **Global hata kapsamı ile aktif proje kapsamı farklı; “Hepsini kapat” görünenden fazlasını etkiliyor.** Liste her markada en çok 50 kayıt ve cihaz başına son bir hata gösterir; dismissAll erişilebilir bütün projelerde tüm failed kayıtları işler. Banner proje adı göstermez; sayfa içi şerit yalnız aktif projeyi sayar. | `src/components/sync/SyncIssuesBanner.tsx:54`, `src/components/sync/SyncIssuesBanner.tsx:74`, `src/components/sync/SyncIssuesBanner.tsx:104`, `src/components/sync/DeviceSyncStatusBanner.tsx:38`, `convex/hikvisionSync.ts:969`, `convex/ideSync.ts:613` | Aktif proje varsayılanı + açık “Tüm projeler” seçeneği; proje adı, cihaz ve gerçek hata sayısı. Toplu aksiyonda kapsam/adet önizlemesi; sadece gösterilen/filtrelenen bildirimleri ele al. | L |
| DEV-32 | 🔴 Kritik | 1,9 | **Global 200 kayıttan sonra proje filtrelemek yanlış yeşil durum üretebilir.** SCAN_CAP her statüye proje filtresinden önce uygulanır; ilk 200 başka projedeyse aktif projenin pending/failed kayıtları görünmez ve upToDate=true olur. Hata listeleri de max*4 sonra RBAC filtreler; sorunlu proje için boş liste mümkündür. | `convex/syncStatus.ts:17`, `convex/syncStatus.ts:45`, `convex/syncStatus.ts:71`, `convex/syncStatus.ts:90`, `convex/hikvisionSync.ts:674`, `convex/ideSync.ts:551` | Proje+durum index/aggregate üzerinden sayım; kapsam filtresi limitten önce. Eksik sonuçta hasMore/unknown döndür ve kesin başarı iddiası kurma. En az 201 başka-proje kaydı + 1 aktif-proje hatasıyla regression testi. | L |
| DEV-33 | 🟠 Yüksek | 1,8 | **Terminal hata için “yeniden denenecek” vaadi var.** Banner IDE'nin failed durumunu listeler; backend deneme limiti bitince failed'e geçer. friendlySyncError timeout/token hatasında koşulsuz yeniden denenecek der; kullanıcı müdahale gerekirken bekler. | `src/lib/syncErrorMessages.ts:29`, `src/lib/syncErrorMessages.ts:41`, `convex/ideSync.ts:435`, `convex/ideSync.ts:550` | Hata çevirisi operasyon durumu, attempts/max ve nextRetryAt alsın. “Tekrar deneme limiti doldu” / “30 sn sonra denenecek” ayrımı; bilinmeyen ham hata ikincil teknik ayrıntıya alınsın. | M |
| DEV-34 | 🟠 Yüksek | 2,3,7 | **Banner çözüm yerine sadece kapatma sunuyor.** Cihaz adı link değil, +N eski rozeti eski hataları açmıyor; tekli dismiss fire-and-forget, toplu dismiss'te catch/pending yok. X ikonunun erişilebilir adı da yok. | `src/components/sync/SyncIssuesBanner.tsx:95`, `src/components/sync/SyncIssuesBanner.tsx:103`, `src/components/sync/SyncIssuesBanner.tsx:157`, `src/components/sync/SyncIssuesBanner.tsx:166`, `src/components/sync/SyncIssuesBanner.tsx:182` | Cihaz ayrıntısına derin bağlantı, tüm hataları aç, soruna özgü düzeltme/yeniden deneme. Kapatma sonucunu bekle, hatayı göster; aria-label ekle. Yeniden deneme API'si rol kontrollü ve yinelenen çağrıya dayanıklı olmalı. | L |

### F. Ölçek, okuyucu eşleme ve kalan doğruluk sorunları

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| DEV-35 | 🟠 Yüksek | 9 | **Liste ve tanılama maliyeti kayıt sayısıyla sınırsız büyüyor.** devices.list tüm proje cihazlarını collect edip cihaz başına zone/door okur; UI tümünü map eder. readerStatus her non-IO kapı için devices.filter.first taraması ve reader sorgusu yapar. Merkez tamamlanmış kuyruklar dahil sekiz statü setini collect edip sayar/sıralar. | `convex/devices.ts:48`, `convex/devices.ts:72`, `src/components/devices/DeviceList.tsx:114`, `convex/doors.ts:376`, `convex/doors.ts:399`, `convex/deviceCenter.ts:135`, `convex/deviceCenter.ts:146` | Cihaz listesine pagination + sunucu arama; ağaç kademeli yükleme; okuyucu/kapı verisini sahiplik indexleriyle grupla. Merkezde bounded son kayıtlar + sayaç/aggregate; gerçek gecikme ölçümü uygulama aşamasında. | L |
| DEV-36 | 🟠 Yüksek | 1,3,7 | **Okuyucu silme tek tıkla ve onaysız; son okuyucu da silinebilir.** Ağaç doğrudan remove çağırır; backend mevcut sürümde minimum okuyucu kontrolü yapmaz. Taşıma da kaynak kapıyı okuyucusuz bırakabilir. Eski handoff'taki korumaya güvenilemez. | `src/components/access-control/ZoneDoorTree.tsx:357`, `convex/readers.ts:280`, `convex/readers.ts:204`, `docs/HANDOFF_KAPI_OKUYUCU.md:26` | Sil/taşı öncesi kaynak-hedef ve etkiyi göster; boş kapı izinliyse açık “Okuyucu atanmamış” + düzelt aksiyonu. Minimum 1 kuralı ürün gereksinimiyse backend'de geri getir; otomatik olarak eski handoff'u dayatma. | M |
| DEV-37 | 🟠 Yüksek | 1,8 | **Hikvision kapı/okuyucu son okuma verisi eksik veya yanlış kapsamda sunuluyor.** readerStatus non-IO dalında door.deviceId yerine legacy device.doorId arar; yeni Hik kapıları bu alanı taşımaz. Merkez ioId olmayan kapıda doğrudan null döndürür. Ağaç okuyucu başına “Son okuma” der; veri aslında kapı/cihaz düzeyinde ve saat gösterimi eski günü gizler. | `convex/doors.ts:375`, `convex/deviceCenter.ts:117`, `convex/devices.ts:772`, `src/components/access-control/ZoneDoorTree.tsx:257`, `src/components/access-control/ZoneDoorTree.tsx:300` | Kapı numarası olan olayı doğru kapıya bağla; yalnız cihaz düzeyi veri varsa “Cihazın son okuması” diye açıkla. Okuyucu düzeyinde kanıt yoksa ayrı okuyucu etkinliği iddia etme; tarih + saat ve boş/veri yok durumunu göster. | L |
| DEV-38 | 🟡 Orta | 4,6,7 | **Havuz/konum formlarında label bağı ve hata açıklaması zayıf.** Claim'de Label'lar htmlFor'suz, Input'lar id'siz; disabled Projeye Ekle eksik alanı satır içinde açıklamaz. Konum formunun zone/door label'ları eşleşen trigger id'si bulamaz. IDE kimlik alanları dar ekranda da iki sütun. | `src/components/devices/ClaimDeviceDialog.tsx:227`, `src/components/devices/ClaimDeviceDialog.tsx:260`, `src/components/devices/ClaimDeviceDialog.tsx:295`, `src/components/devices/AssignLocationForm.tsx:117`, `src/components/devices/AssignLocationForm.tsx:125`, `src/components/devices/form-sections/DeviceIdeSmartSection.tsx:37` | FormFieldWrapper veya RHF FormControl ile id/label/error bağı; gerekli alan işareti + Türkçe inline hata. Mobil tek sütun; Konum Ata diyaloğunun bütün İngilizce metinlerini Türkçeleştir. | M |
| DEV-39 | 🟡 Orta | 1,3,8 | **Özellik sorgusu başarısızlığı “Yok” diye gösteriliyor.** !probe.ok ve desteklenmiyor aynı badge/metne bağlanmış. Ağ/kimlik hatası olan yetenek, cihazda bulunmayan özellik gibi görünür. İlk 12 dışındaki özellikler için görüntüleme aksiyonu da yok. | `src/components/devices/form-sections/DeviceHikvisionSection.tsx:683`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:702`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:709` | Destekli / Desteklenmiyor / Doğrulanamadı ayrı durumlar; hata nedeni ve yeniden tara aksiyonu. Tüm özellikleri açılabilir listede göster. | S |

## 4. Hedef tasarım

### /devices — ana ekran

```text
+ Cihazlar / Aktif proje ------------------------------- [Cihaz ekle v] +
| [Ad / seri / UUID ara] [Bağlantı v] [Marka/model v] [Bölge/Kapı v]      |
| Filtreler: Ana bina > Kapı 2 [x]                   [Filtreleri temizle] |
| Toplam 18 | Çevrimiçi 15 | Çevrimdışı 2 | Henüz bağlanmadı 1            |
+---------------------+-------------------------------------------------+
| Bölge ağacı         | Ad / Model | Bağlantı + son sinyal | Bölge | ... |
| Ana bina            | Ana panel  | Çevrimiçi · 20 sn önce | Giriş | ... |
|   Panel > Kapı      | 4 kapı / 4 okuyucu              [Ayrıntıyı aç]   |
|     Okuyucu         |                    [Önceki] 1 / N [Sonraki]     |
+---------------------+-------------------------------------------------+
Mobil: ağaç yalnız [Bölge/Kapı] sheet'inde; cihazlar tam genişlik kartlar.
Seçim: 3 cihaz seçildi [Seçimi temizle] [Sil...] -> ad + etki önizlemesi.
```

1. Bağlantı, kullanım aktifliği ve senkron üç ayrı durumdur; aynı `status` alanına sıkıştırılmaz.
2. Ağaç ve liste aynı kapı sahipliği ilişkisini kullanır; URL'deki seçimin görünür chip'i vardır.
3. Ad/model/son sinyal ilk bakışta; UUID ve teknik kimlikler ikincil ve kopyalanabilir.
4. Liste yüklenirken başlık/filtre yerinde kalır; ilk kullanım, sonuçsuz filtre ve hata ayrı durumdur.

### Yeni cihaz / havuzdan ekleme / düzenleme

```text
+ Yeni cihaz --------------------------------------------- [Kapat] +
| 1 Kaynak ve marka -> 2 Kimlik/bağlantı -> 3 Konum ve özet           |
| [Yeni cihaz] [Havuzdaki cihaz]                                    |
| Cihaz adı* [Ana panel       ]   Marka/model* [DS-K2804 v]          |
| Bağlantı [Yerel ağ geçidi v]    [Gerekli bağlantı bilgileri]       |
| Bölge* [Ana bina v] [+ Yeni bölge adı]                            |
| Oluşacak: 4 kapı / 4 okuyucu. Mevcut kayıtlar değişmeyecek.        |
| Bağlantı testi: Henüz yapılmadı [Test et]                         |
+------------------------------------ [Geri] [Cihazı kaydet] ------+
| Kısmi başarı: Kayıt oluşturuldu; bağlantı kurulamadı.              |
| [Bağlantıyı tekrar dene] [Cihaz ayrıntısına git]                   |
+-----------------------------------------------------------------+
Edit: mevcut topoloji özeti; model/sayı değişikliği ayrı etkili işlem.
Konum: [Yeni bölge] + taşınacak kapı/okuyucu özeti; panel için kapı seçme yok.
```

1. İlk kez kurulumda kararlar bölünür; düzenlemede gereksiz sihirbaz zorunlu değildir.
2. Kullanıcı önce marka/model ve ortaya çıkacak kapı/okuyucu yapısını görür.
3. Yeni bölge, cihazla birlikte kaydedilen taslaktır; zorunluluk ve hata Türkçe, alan yanında görünür.
4. Kaydetme, bağlantı hazırlama ve cihazdan ilk sinyal ayrı aşamalar; kısmi başarı taslağı kaybettirmez.
5. Kaydetmeden çıkış ve yıkıcı topoloji değişimi görünür onay ister; form değerleri güncel query sonucu ile sessizce ezilmez.

### Cihaz ayrıntısı / okuyucu eşleme / komutlar

```text
+ Ana panel · DS-K2804 ------------------------------------ [Kapat] +
| Çevrimiçi · son sinyal 20 sn | Kullanım: Aktif | Senkron: 1 hata   |
| [Genel] [Kapılar ve okuyucular] [Tanılama] [Bağlantı ayarları]      |
| Kapı 1 | Giriş okuyucu | Kapı son okuması: 16 Eki 09:12            |
|        [Okuyucuyu taşı...] [Okuyucuyu sil...] [Kapıyı aç...]       |
| Kapı 2 | Okuyucu atanmamış [Okuyucu ata]                           |
| Komut: Kapı 1 açma -> sırada -> gönderildi -> cihaz onayladı       |
| Tanılama sonucu burada kalır: [Kart] [Eksik kayıtlar] [Özellikler] |
| [Teknik ayrıntılar v]        [Bağlantıyı kaldır...] [Anahtar...]   |
+-----------------------------------------------------------------+
Onay: "Ana panel / Kapı 2 açılsın mı?" [Vazgeç] [Kapı 2'ye komut gönder]
```

1. Bilgiler formunda ikinci komut merkezi bulunmaz; kayıt sonrası form kapatma callback'i tanılamaya bağlanmaz.
2. Her fiziksel komut hedef adı/numarası ile onaylanır; kuyruk kabulü ile cihaz yanıtı ayrılır.
3. Okuyucu taşıma mantıksal eşlemeyi açıklar; gerçek kablolama/okuyucu bazlı olay kanıtı yoksa bunu iddia etmez.
4. Yetenek yok, sonuç alınamadı ve henüz taranmadı ayrı durumlar; teknik dil ikincil ayrıntıda.

### /virtual-readers ve QR diyaloğu

```text
+ Sanal okuyucular / Aktif proje ---------------- [Okuyucu ekle] ---+
| [Kapı/bölge ara]                                                 |
| Giriş kapısı | QR okuyucu | Yön: Giriş                             |
| [QR'ı göster] [Test et]    Son test: İzin verildi · 16 Eki 09:12    |
| Boş: Bu projede sanal okuyucu yok. [İlk okuyucuyu ekle]            |
+-----------------------------------------------------------------+
QR: okuyucu/kapı adı + kullanım açıklaması + geçerli QR [SVG/PNG indir]
Demo korunursa: üstte kalıcı "Simülasyon — gerçek geçiş oluşturmaz".
```

1. Gerçek okuyucu ile demo örneği açıkça ayrılır; bütün kayıtlar aktif proje bağlamına sahiptir.
2. QR'nin amacı (kimlik etiketi, erişim veya simülasyon) ve payload sözleşmesi ürün/backend ile belirlenir.
3. Test düğmesi klavyeden çalışır, pending'de kilitlenir; sonuç satır içinde kalır.

### Tüm modüller — senkron durum/çözüm paneli

```text
+ Senkron: Aktif proje · 2 cihaz / 5 sorun -------- [Sorunları aç] --+
| Ana panel > Yetki yazma | Deneme limiti doldu · 4 deneme           |
| Bağlantı kurulamadı. Panelin bağlantı ayarlarını kontrol edin.     |
| [Cihaza git] [Tekrar dene] [Diğer 3 hatayı aç] [Bildirimi kapat]   |
| [Teknik ayrıntılar v]                                            |
+-----------------------------------------------------------------+
Durum: "Bekleyen işlem yok" veya "Son doğrulanan senkron: tarih/saat".
Kapatma: yalnız bildirimi gizler; çözülmemiş operasyon durumunu korur.
```

1. Sayıların birimi ve proje kapsamı açık; “2 cihaz / 5 sorun” tek sayıdan daha anlamlıdır.
2. Tekrar deneme zamanı/limiti backend durumundan gelir; çeviri fonksiyonu gelecek sonuç vaat etmez.
3. Bildirim kapatma, iş başarısı ve fiziksel uygulanma farklı olgulardır.
4. Kullanıcı hatadan doğrudan ilgili cihaz/ayar ve tekrar denemeye gidebilir; pending ve hata geri bildirimi erişilebilirdir.

## 5. Fazlar

Süreler tek uygulayıcı için yaklaşık kişi-gün; toplam **11–14 kişi-gün**, gerçek donanım doğrulama süresi hariç. Paketler uygulanabilir ownership sınırlarıdır; bu audit görevi bu dosyalar üzerinde değişiklik yetkisi vermez. Aynı dosyayı paylaşan paketler sırayla ilerlemeli. `convex/deviceEvents.ts`, `convex/cardReadings.ts`, `convex/lib/cardReadingAudit.ts` ve `mobile/**` mevcut kirli çalışma alanlarıdır; aşağıdaki paketler bunları sahiplenmez. Gereken backend sözleşmesi mevcut alanlarla çözülemiyorsa koordinatöre ayrı kapsam olarak bildirilmelidir.

### UX-0 — Doğruluk ve veri kaybı risklerini kaldırma (5–7 gün)

**UX-0A — Kayıt/bağlantı/form doğruluğu (~1,5 gün).** Bulgular: DEV-01, DEV-02, DEV-12–15, DEV-17–20.

OWNERSHIP frontend: `src/hooks/useProjectFilteredDevices.ts`, `src/lib/deviceStatus.ts`, `src/components/devices/hooks/buildDeviceFormValues.ts`, `src/components/devices/hooks/useDeviceFormSubmission.ts`, `src/components/devices/hooks/useDeviceFormSchema.ts`, `src/components/devices/ClaimDeviceDialog.tsx`, `src/components/devices/AssignLocationForm.tsx`, `src/components/devices/useLocationForm.tsx`, `src/components/devices/form-sections/DeviceHikModelField.tsx`, `src/components/devices/form-sections/DeviceIdeSmartSection.tsx`, `src/components/devices/form-sections/DeviceLocationSection.tsx`, `src/components/devices/form-sections/DeviceZoneSection.tsx`, `src/components/devices/form-sections/DeviceStatusSection.tsx`, `src/components/devices/DeviceStats.tsx`, `src/components/devices/DeviceFilters.tsx`, `src/components/devices/DeviceTableRow.tsx`, `src/types/device.ts`.

**backend:** `convex/devices.ts` (create/update active ve clear/konum sözleşmesi), `convex/deviceCenter.ts` (bağlantı görünümü), gerekirse yeni bağımsız `convex/lib/deviceConnection.ts`; test ownership yeni `convex/deviceUx.test.ts`, `src/lib/deviceStatus.test.ts`, `src/components/devices/hooks/deviceFormUx.test.ts`. Şema değişikliği gerekirse UX-0D'nin `convex/schema.ts` sahibiyle tek sırada uygulanır.

Kabul: Pasif cihazın adını düzenlemek aktifliği değiştirmez; IDE create Pasif seçimini korur; süre aşan bağlantı yeniden açma gerektirmeden çevrimdışı olur. Claim varsayılanları kabul edilir veya alan hatası verir; gateway failure kayıtlı ID'yi korur ve tekrar deneme yeni cihaz oluşturmaz. Açıklama/IP/model temizleme kalıcıdır. Sahte/başka panel kapısına eşleme reddedilir; konum mutation hatasında başarı mesajı ve kapanış yoktur. Model/sayı edit'te topoloji değiştirmiyorsa bu açıkça görünür.

**UX-0B — Liste seçimi, silme, kapı filtresi ve QR (~1 gün).** Bulgular: DEV-03, DEV-06–08, DEV-27, DEV-36.

OWNERSHIP: `src/pages/Devices.tsx`, `src/hooks/useDeviceFilters.tsx`, `src/hooks/useDeviceTable.tsx`, `src/components/devices/DevicesContent.tsx`, `src/components/devices/DeviceList.tsx`, `src/components/devices/DeviceTableRow.tsx`, `src/components/devices/DeviceBulkActions.tsx`, `src/components/devices/DeviceDeleteDialog.tsx`, `src/components/devices/useDeviceActions.tsx`, `src/components/devices/QRCodeDialog.tsx`, `src/components/devices/useQRCodeDialog.tsx`, `src/components/access-control/ZoneDoorTree.tsx`, `src/components/access-control/MoveReaderDialog.tsx`; yeni test `src/hooks/deviceSelection.test.ts`. **backend:** silme etki sayıları için `convex/devices.ts`; minimum okuyucu kuralı korunacaksa `convex/readers.ts` ve yeni `convex/readerUx.test.ts`. Arşivleme UX-2'de; bu pakette cascade silmeyi haber vermeden değiştirme.

Kabul: Otomatik üretilmiş her kapı filtrede bağlı cihazını getirir; filtre/proje değişiminde görünmeyen seçim yanlışlıkla silinmez. İki silmeden biri başarısız olduğunda başarılı kayıt yeniden seçili değildir. Onay gerçek cascade etkisini açıklar; aynı işlem pending'de tekrarlanmaz. QR geçerli dosya olarak indirilebilir; boş kimlikten QR üretilmez. Okuyucu silme/taşıma kaynak kapı etkisini gösterir.

**UX-0C — Komut sonucu ve güvenli hedef (~1 gün).** Bulgular: DEV-21–25, DEV-39.

OWNERSHIP: `src/pages/Devices.tsx`, `src/components/devices/DeviceDetailsPanel.tsx`, `src/components/devices/DeviceForm.tsx`, `src/components/devices/DeviceCommandCenter.tsx`, `src/components/devices/DeviceApiTokenCard.tsx`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx`, `src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx`; yeni `src/components/devices/DeviceCommandCenter.test.tsx`.

Bu paketin hızlı kabulü frontend: eski sabit-kapı komutunu kaldır; onay ekle; sonuç panelini açık tut; kuyruk işlemleri için “Sıraya alındı” göster; desteklenmeyen aksiyonu kapat. **backend:** canlı op takibi UX-2B; bu aşamada ack yokken tamamlandı deme. Kart okut/eşitlik sonucu aynı panelde görülebilmeli; bağlantı kesme/token yenileme iptal edilirse action çağrılmamalı; özellik sorgusu hatası “Yok” olmamalı.

**UX-0D — Senkron doğruluğu (~1,5–3,5 gün).** Bulgular: DEV-30–33; DEV-34'ün pending/error/aria kısmı.

OWNERSHIP frontend: `src/components/sync/DeviceSyncStatusBanner.tsx`, `src/components/sync/SyncIssuesBanner.tsx`, `src/lib/syncErrorMessages.ts`. **backend:** `convex/syncStatus.ts`, `convex/hikvisionSync.ts`, `convex/ideSync.ts`, `convex/schema.ts`; yeni `convex/syncStatusUx.test.ts`, `src/lib/syncErrorMessages.test.ts`.

Kabul: Bildirim kapatma failed operasyonu done yapmaz veya silmez; aktif proje dışındaki hata toplu aksiyondan etkilenmez; listede gösterilmeyen kapsam açıkça belirtilir. 201 başka-proje kaydından sonra gelen aktif-proje pending/failed kaydı sayımdan düşmez. Eksik tarama kesin yeşil üretmez. Terminal timeout “yeniden denenecek” demez. Eski dismissed verinin gerçek uygulanma durumunu geriye dönük kanıtlamak mümkün değil; geçmiş veri uzlaştırması ayrı iş, audit kapsamında migration yok.

### UX-1 — Sadeleştirme, Türkçe ve erişilebilirlik (3 gün)

**UX-1A — Liste/ağaç yerleşimi (~1 gün).** Bulgular: DEV-04, DEV-05, DEV-09–11; DEV-03 URL/filtre görünürlüğü.

OWNERSHIP: `src/pages/Devices.tsx`, `src/hooks/useDeviceFilters.tsx`, `src/components/devices/DevicesContent.tsx`, `src/components/devices/DeviceFilters.tsx`, `src/components/devices/DeviceList.tsx`, `src/components/devices/DeviceTableRow.tsx`, `src/components/access-control/ZoneDoorTreePanel.tsx`, `src/components/access-control/ZoneDoorTree.tsx`, `src/lib/deviceDisplay.ts`; gerekiyorsa yeni `src/components/devices/DeviceListErrorBoundary.tsx`. **backend:** yok. Ortak `EmptyState`, `ErrorState`, `StatCard`, `AccessDenied` tüketilir; ortak API değişikliği bu pakette yapılmaz.

Kabul: 320/375/768/1280 px ve %200 zoom'da ana içerik erişilir; filtre ve boş sonuç temizleme klavyeyle tamamlanır; checkbox'lar cihaz adını söyler. Özel IDE adı ağaç ve tabloda aynı, UUID ile bulunabilir; model kolonunda gerçek model görünür. Browser geri/ileri filtreyi geri getirir.

**UX-1B — Ayrıntı/form/mesaj birliği (~2 gün).** Bulgular: DEV-16, DEV-26, DEV-28 için demo sınırı, DEV-29, DEV-38; DEV-34'ün cihaz bağlantısı ve eski hata listesi tasarımı (backend yeni yetenekleri UX-2B).

OWNERSHIP: `src/components/devices/DeviceDetailsPanel.tsx`, `src/components/devices/DeviceForm.tsx`, `src/components/devices/DeviceCommandCenter.tsx`, `src/components/devices/DeviceApiTokenCard.tsx`, `src/components/devices/BrandPickerStep.tsx`, `src/components/devices/DeviceAddMenu.tsx`, `src/components/devices/ClaimDeviceDialog.tsx`, `src/components/devices/AssignLocationForm.tsx`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx`, `src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx`, `src/components/devices/form-sections/DeviceIdeSmartSection.tsx`, `src/pages/VirtualReaders.tsx`, `src/components/devices/VirtualReader.tsx`, `src/components/sync/SyncIssuesBanner.tsx`, `src/components/sync/DeviceSyncStatusBanner.tsx`, `src/pages/Devices.tsx`. **backend:** yok. Touched dosyalarda toast sonner'a alınır; global toast altyapısı değiştirilmez.

Kabul: Bilgiler formunda komut kopyası yok; kirli form kapanışında veri kaybı önlenir; tüm aktif metinler Türkçe ve teknik ayrıntı ikinci seviyede. Etiketler input'ları odaklar, form hataları okunur; token kopyalama ve banner kapatma düğmeleri adlandırılmıştır. Demo sayfası gerçek geçiş algısı oluşturmaz; test et pending'de tekrar istek göndermez. Açık/koyu tema elle kontrol edilir.

### UX-2 — Yeni yetenek ve ölçek (3–4 gün)

**UX-2A — Gerçek envanter/topoloji ve sorgu ölçeği (~2 gün).** Bulgular: DEV-28 tam çözüm, DEV-35, DEV-37; DEV-07 geçmişi koruma alternatifi.

OWNERSHIP frontend: `src/pages/VirtualReaders.tsx`, `src/components/devices/VirtualReader.tsx`, `src/components/devices/QRCodeDialog.tsx`, `src/components/devices/useQRCodeDialog.tsx`, `src/hooks/useProjectFilteredDevices.ts`, `src/hooks/useDeviceFilters.tsx`, `src/components/devices/DevicesContent.tsx`, `src/components/devices/DeviceList.tsx`, `src/components/devices/DeviceCommandCenter.tsx`, `src/components/access-control/ZoneDoorTree.tsx`. **backend:** `convex/devices.ts`, `convex/doors.ts`, `convex/readers.ts`, `convex/deviceCenter.ts`, `convex/schema.ts`; gerekiyorsa yeni `convex/virtualReaders.ts`, yeni `convex/deviceReadModels.test.ts`.

Ön koşul: sanal okuyucunun ürün amacı ve QR payload sözleşmesi kararlaştırılmış olmalı; mevcut erişim kontrolü atlanmamalı. Kabul: sabit sampleReaders yerine proje kapsamlı gerçek veri; pagination'da arama/filtre tüm veri kümesini kapsar; arşivlenen cihazın okuma geçmişi korunur. Tanılama son kayıt sayısı bounded; cihaz sayısı ve tamamlanmış kuyruk büyürken ölçülen okuma maliyeti raporlanır. Hik kapısına kesin atıf yoksa cihaz düzeyi etiketi gösterilir; geçmiş güne ait saat tarih olmadan sunulmaz. `cardReadings`/`deviceEvents` ingestion değişikliği gerekiyorsa bu paket durumu koordine eder, mevcut kirli dosyalara girmez.

**UX-2B — Komut/onarım takibi (~1–2 gün).** Bulgular: DEV-25 tam ack takibi, DEV-34 tam çözüm; DEV-30 başarı kanıtı.

OWNERSHIP frontend: `src/components/devices/DeviceCommandCenter.tsx`, `src/components/sync/SyncIssuesBanner.tsx`, `src/components/sync/DeviceSyncStatusBanner.tsx`, `src/lib/syncErrorMessages.ts`. **backend:** `convex/actions/ideGatewayDevice.ts`, `convex/actions/hikGatewayDevice.ts`, `convex/ideSync.ts`, `convex/hikvisionSync.ts`, `convex/syncStatus.ts`, `convex/schema.ts`; yeni `convex/commandFeedbackUx.test.ts`.

Kabul: kuyruklu action opId döndürür; rol/proje doğrulanmış sorgu UI'a sent/acked/failed ve retry bilgisi verir. Hata satırından ilgili cihaza gidilir; yeniden deneme çift tıklamada kopya fiziksel komut oluşturmaz. Bir komutu kapatmak durum tarihçesini korur; fiziksel açılma ile yalnız panel kabulü birbirine karıştırılmaz.

### Uygulama sırası ve doğrulama kapısı

Önerilen sıra: UX-0A → UX-0B → UX-0C; UX-0D aynı dosya sahipliği çakışmaları çözülerek ayrı paket olabilir. UX-1, UX-0 davranış sözleşmelerini kullanır; UX-2 backend değişiklikleri UX-0D'nin şema/index kararları üzerine kurulmalıdır. Özellikle `Devices.tsx`, `DeviceTableRow.tsx`, `ZoneDoorTree.tsx`, `devices.ts`, `schema.ts` birden fazla pakette olduğundan eşzamanlı yazı sahipliği verilmemelidir.

Uygulama kapıları: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/eslint src convex`, ilgili frontend/Convex regression testleri; sonra izinli test ortamında klavye/mobil/dark-mode turu ve donanım komut/ack doğrulaması. Audit tesliminde kaynak değişmediği için build/lint çalıştırılmadı; altı rapor başlığı, 39 bulgunun önem sayımı ve 173 `path:satır` referansının dosya/satır varlığı yerel betikle doğrulandı. Bu worker'ın tek yazma işlemi bu rapor dosyasıdır; çalışma ağacındaki diğer değişiklikler başlangıçta mevcuttu veya eşzamanlı başka çalışmalara aittir. Canlı DB okuma/yazma, deploy ve migration bu audit'in parçası değildir.

## 6. Modüller arası adaylar

- Bağlantı / kullanım aktifliği / operasyon senkronu sözleşmesi: cihaz, canlı izleme, erişim kontrolü ve yönetici havuzu aynı modeli tüketmeli.
- Ortak kuyruk eylemi geri bildirimi: sırada/gönderildi/cihaz onayladı/başarısız + opId; personel ve erişim kuralı eşitleme akışlarına da uygulanabilir.
- Proje kapsamlı hata merkezi: bildirim okunması operasyon sonucundan ayrı; cihaz bağlantısı, teknik detay ve tekrar deneme ortak bileşen.
- Seçim + filtre + yıkıcı işlem: görünmeyen seçimler, kısmi sonuç ve cascade önizleme diğer toplu işlem sayfalarında aranmalı.
- Ortak form taslak/kapanış koruması ve sonner sonuç bildirimi; alan etiket/hata bağları için mevcut FormFieldWrapper kullanılmalı.
- Kapı/okuyucu ağacı `/access-control` ile paylaşılır: bu rapor yalnız cihaz görevine etkilerini kapsar; ortak dosya değişikliği diğer modül worker'ıyla tek ownership üzerinden yapılmalı.

**Doğrulama sınırları:** Gerçek cihaz çevrimiçi davranışı, gateway/bridge erişimi, QR'nin dış deployment endpoint'i, gerçek veri hacmi, görsel kontrast ve klavye focus sırası çalıştırılarak doğrulanmadı. Koddan deterministik çıkan hatalar ile bu ortam bağımlı sonuçlar ayrıldı; envanter, erişim ve senkron verisine canlı erişim yapılmadı.
