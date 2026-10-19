# Hik-Connect (Team) Sayfa Sayfa Audit

> **Tarih:** 2026-10-19 · **Kaynak:** canlı Hik-Connect 7 Team portalı (`www.hik-connect.com`, API `isgp-team.hikcentralconnect.com/hcc`), Orca gömülü tarayıcısı · **Yöntem:** modül router'ına `push` ile gezinme, sayfa içi XHR kaydı, DOM/ekran görüntüsü, "Add" formlarını açıp iptal etme.
>
> **Etiketler:** **[görüldü]** canlı ekranda/istekte gözlendi · **[çıkarım]** davranıştan çıkarıldı · **[doğrulanamadı]** sayfa açılmadı/boş geldi.
>
> **Kapsam:** 6 modül + 4 alt panel, ~110 sayfa. 19 Attendance raporu ayrıca [../hikconnect-reports/README.md](../hikconnect-reports/README.md) içinde. Ekran görüntüleri `shots/` altında (gitignore'lu, gerçek personel adları var).
>
> **Hesap durumu:** 1 cihaz (DS-K1T343MFX), 10 kişi, 1 kapı, 1 erişim seviyesi, 1 zaman şablonu (24 saat), 1 timetable (esnek vardiya 05:00-22:00). Lisans: Access Control & Attendance ücretsiz ömür boyu (1/10 kapı). Health Monitoring servisi **2025/05/17'de dolmuş**.

## 0. Yöntem notu ve olay kaydı

- İlk tur modül değiştirmeden `push` yaptığım için Maintenance/Alarm/Map ekranları yanlış modülün sayfasını (My Services) çekti; modül değiştirip yeniden çektim.
- **Olay:** Attendance Check Point sayfasında "Enable Custom" butonu dialog açmak yerine ayarı doğrudan değiştirdi (`checkPoint/v1/enable`, mod "tüm cihazlar" → "özel"). Aynı oturumda "Set All Devices as Attendance Check points" → Confirm ile geri alındı (`checkPoint/v1/disable` 200, sayfa eski haline döndü). Diğer iptal edilen Add pencerelerinde kayıt oluşmadı (tatil 0, izin türü 0, timetable 1, izin/düzeltme başvurusu 0, kişi 10).
- Remain Unlocked & Remain Locked sayfası router ile açılınca boş kaldı **[doğrulanamadı]**.

## 1. Modül haritası

| Modül | Menü |
|---|---|
| **Access Control** | Access Control (canlı kapı) · Access Granting (Overview, Manage Access Level, Grant by Department, Grant by Person) · Temporary Pass Management · Search (Access Record Retrieval, Device Recorded Data Retrieval) · Application (Remain Unlocked & Remain Locked) · Configuration (Holiday Settings, Access Schedule Template, General, Event Notification) |
| **Attendance** | Schedule · Review (Leave, Attendance Correction) · Attendance Records (3) · Daily Report (9) · Monthly Report (7) · Basic Configuration (General, Attendance Check Point, Check In/Out via Mobile Client, Timetable, Holiday, Leave Type, Report, Custom Export, Scheduled Report) |
| **Alarm** | Alarm Center · Alarm Search · General Alarm Configuration (Basic Alarm Settings, Receiving Schedule Template, Alarm Custom Settings, Email Linkage Template) |
| **Maintenance** | Health Monitoring (Health Status, Scheduled Report) · System Log (Device Log, Operation Log, User Login Report) · Firmware Upgrade |
| **Map** | Map Monitoring · Map Settings |
| **Service** | My Services · Service Market · Service Provider |
| **Device** (alt panel) | Resource Management (cihaz listesi/ekleme), Firmware, Captive Portal, Record Template |
| **Person** (alt panel) | Kişi listesi + departman ağacı, ayar sayfaları |
| **Team** (alt panel) | Users, Roles, Email Setting, Team Info, Team Configuration, Account Security, Account Sync, API Integration, Archive |

## 2. Access Control

| Sayfa | Route | Ne var | API |
|---|---|---|---|
| Access Control (ana) | `/HCBAccessControl/doorAndElevatorMonitoring` | Kapı kartı (durum, kilit, uzaktan aç, "Batch Control"), kapı adı arama, Add Device, Access Granting kısayolları, Passing Records özeti **[görüldü]** | `hccacs/v1/param/element/relatedelement` |
| Overview | `/accessOverview` | Person/Device sekmeleri; All/Invalid/Effective/Not Granted sayaçları; departman ağacı + alt departman; kolonlar: kişi, erişim seviyesi, kapı, zaman şablonu, **yetki dağıtım durumu**, işlem; "Apply Access Granting" **[görüldü]** | `hccacspm/v1/maintain/overview`, `.../overview/person/detail`, `acspm/accessdownload/status` |
| Manage Access Level | `/accessLevel/list` | Liste: seviye adı, zaman şablonu, kapı; Add/Delete; filtre. Seviye = kapı kümesi + zaman şablonu **[görüldü]** | `acspm/accesslevel/list`, `template/list` |
| Grant by Department | `/assignPGroup` | Departman ağacı → seviye listesi; Batch Grant Access, Grant Access / Revoke **[görüldü]** | `acspm/personGroup/{id}/accesslevel` |
| Grant by Person | `/assignPerson` | Kişi listesi (checkbox) → seviye; Grant Access / Revoke **[görüldü]** | `acspm/person/accesslevel` |
| Temporary Pass | `/tempAuthorization` | Kolonlar: ad, PIN, QR, izin verilen geçiş sayısı, oluşturan, durum, izin durumu, başlangıç/bitiş; Add/Delete; yetkili adına göre arama **[görüldü]** | `hccvims/v1/tempAuth/list` |
| Access Record Retrieval | `/personnelEntryAndExitSearch` | Cihaz/grup seçimi; kişi tipi (Tümü/Kişi/Geçici); doğrulama sonucu; Search, **Import Events**, Export; 15 kolon (sıcaklık, maske, kart, kapı, okuyucu, doğrulama tipi, attendance tipi) **[görüldü]** | `hccacs/v1/event/certificateRecords/search`, `event/alltype` |
| Device Recorded Data | `/deviceRecordSearch` | Kaynak tipi/kaynak/kayıt tipi seçimi; Search, Export; kolonlar: kaynak, grup, kaynak tipi, cihaz, kayıt tipi, zaman **[görüldü]** | `hccacs/v1/event/deviceRecords/search` |
| Remain Unlocked & Locked | `/openingAndClosing` | **[doğrulanamadı]** boş geldi | — |
| Holiday Settings | `/holiday` | Tatil adı, zaman, her yıl tekrar; Add/Delete All. Ekle formu: ad, tip (düzenli/düzensiz), başlangıç, gün sayısı, yıllık tekrar **[görüldü]**. Not: AC ve Attendance ortak tatil kaynağı | `hccvims/holiday/v1/list` |
| Access Schedule Template | `/accessSchedule` | Şablon listesi + haftalık 7×24 çizelge (Authorize bloğu); Add/Delete; arama **[görüldü]** | `hccacspm/v1/template/list` |
| Event Notification | `/equipmentSubscription` | 3 sekme: Device Event (237), Normal Access Event (28), Abnormal Access Event (74); sol grup: Device 172, Door 61, Alarm Input 4; olay başına aç/kapa toggle, Enable All, Save/Restore **[görüldü]** | — |

## 3. Attendance (rapor dışı)

| Sayfa | Route | Ne var |
|---|---|---|
| Schedule | `/HCBAttendance/schedule` | Hafta/ay görünümü, kişi arama, departman filtresi; kişi × gün ızgarası, hücrede renkli vardiya + değiştirme ikonu; Timetable, **Export Schedule**, **Clear Schedules** **[görüldü]** |
| Timetable | `/PeriodManage` | Liste: ad, tip (Normal/Flexible), çalışma aralığı, mola var mı, renk. Ekle formu: ad, **cross-day shift**, çalışma süresi (saat/dk), geçerli check-in/out aralığı, en geç giriş, **mola süresi** **[görüldü]** |
| Leave (başvuru) | `/approvalLeave` | Kolonlar: başvuru no, kişi, izin türü, başlangıç/bitiş, gerekçe, ek, başvuru zamanı, durum; Add / **Approve / Reject / Withdraw**. Ekle formu: kişi, izin türü, dönem, gerekçe, ek (≤5 JPG/PNG, 40 MB), **Auto Approve**, onay akışı **[görüldü]** |
| Attendance Correction | `/approvalRetroactive` | Aynı akış; kolonlar: düzeltme tipi, giriş/çıkış zamanı, gerekçe, ek, durum. Ekle formu: kişi, tip, zaman, gerekçe, ek, Auto Approve **[görüldü]** |
| General | `/attendanceRule` | "Current Shift Type" (Normal / Flexible, Edit ile seçilir). 4 sekme: **Weekend** (gün seçimi) · **Overtime** (fazla çalışma saatini mesai say; hafta sonu için hesapla) · **Attendance Rule** (giriş zorunlu / çıkış zorunlu; esnek vardiyada varsayılan geçerli giriş/çıkış 00:00-23:59) · **Notifications** (giriş hatırlatması "5 dk kala", giriş yapıldı bildirimi) **[görüldü]** |
| Attendance Check Point | `/attCheckPoint` | Mod: "tüm cihazlar" (varsayılan) ↔ "özel liste" (cihaz ekle/sil); hesaplamalar listeye göre yapılır **[görüldü]** |
| Check In/Out via Mobile | `/MobileAttendanceList` | Mobil istemciyle giriş yapabilecek kişi listesi: ad, ID, departman, fotoğraf zorunluluğu, giriş/çıkış alanı; Add/Delete, **Manage Check-In/Out Area** **[görüldü]** |
| Holiday | `/holidaySetting` | AC ile aynı tatil listesi **[görüldü]** |
| Leave Type | `/LeaveManage` | Kullanıcı tanımlı izin türleri (yalnız ad); Add/Delete; arama **[görüldü]** |
| Report | `/ReportSetting` | Rapor görünüm ayarı: işletme adı, logo, tarih/saat/süre formatı **[görüldü]** |
| Custom Export | `/customReportExport` | Ad, format (TXT), içerik şablonu `${ID}${Last Name}...`, alan seçici (ad, soyad, ID, departman, tarih, saat, haftanın günü, veri kaynağı, cihaz adı/seri no, punch state, konum, açıklama), ayraç (tab/;/,), dil, formatlar, kişi/departman kapsamı **[görüldü]** |
| Scheduled Report | `/timingReport` | Ad, rapor tipi, format (Excel/PDF/CSV/TXT), dil, formatlar, departman (tümü/seçili), sıklık (günlük/haftalık/aylık), gönderim saati, alıcılar (≤8, kullanıcı + e-posta) **[görüldü]** |

## 4. Alarm

| Sayfa | Route | Ne var |
|---|---|---|
| Alarm Center | `/event/alarmCenter` | "Latest Alarm" sekmesi, ses ve pop-up aç/kapa, öncelik/durum filtresi, **Acknowledge Alarm**, History Alarm **[görüldü]** |
| Alarm Search | `/event/alarmSearch` | Zaman, öncelik, bildirim, grup, koşul, kural adı filtreleri; Archive, Export **[görüldü]** |
| Basic Alarm Settings | `/event/eventList` | Kural tablosu: ad, kaynak, tetikleyen olay, öncelik, durum, bağlantı aksiyonları, bildirim; Add/Delete/Enable/Disable/Test, Export. Üstte AC ve Maintenance sayaçları. Hesapta **4 hazır kural** (kapı zorlandı, okuyucu kurcalandı, cihaz kurcalandı, cihaz çevrimdışı), hepsi High + App Notification **[görüldü]** |
| Alarm tanımı (Add) | `/event/triggerToAlarm` | Temel bilgi, koşullar (kaynak + olay), bildirim: pop-up, **App Notification**, **e-posta** **[görüldü]** |
| Receiving Schedule Template | `/event/armSchedule` | Haftalık zaman çizelgesi **[görüldü]** |
| Alarm Custom Settings | `/event/customize` | Öncelik seviyeleri (1-3 + ad), alarm kategorisi (ör. yanlış alarm) **[görüldü]** |
| Receive | `/event/receive` | Alıcılar: kullanıcılar erişebildiği kaynakların alarmını otomatik alır **[görüldü]** |
| Email Linkage Template | `/event/emailReceive` | Şablon ekle **[görüldü]** |
| AI Event | `/event/AIEventList` | "Add Alarm" (AI olayı; bu hesapta cihaz yok) **[görüldü]** |

## 5. Maintenance, Map, Service

| Sayfa | Route | Ne var |
|---|---|---|
| Health Status | `/maintenance/actualTime/*` | Grup ağacı; Overview/Device/Door/Alarm Input sekmeleri; cihaz kolonları: ad, grup, model, **firmware**, ağ performansı, **kurcalama durumu**, güvenli kapı kontrol ünitesi, bileşen durumu, son denetim, işlem; "Tüm istisnalar" filtresi, Export. Çevrimdışı süre/sayı için gün-hafta-ay-yıl-özel aralık. **Servis süresi dolduğu için liste boş** **[görüldü]** |
| Firmware Upgrade | `/maintenance/firmware/*` | Liste + zamanlanmış yükseltme; "Upgrade All Failed Tasks"; kolonlar: ad, model, seri no, sürüm, mevcut sürüm, ağ, durum **[görüldü]** |
| Device Report | `/maintenance/deviceReport` | Planlı cihaz raporu, Add **[görüldü]** |
| Device Log | `/maintenance/deviceLog` | Log tipi, zaman, kullanıcı, olay adı, kanal, IP, açıklama; Search **[görüldü]** |
| Operation Log | `/maintenance/dailyRecord` | İşlem tipi, zaman, kaynak, tip, kaynak adı, grup, açıklama, istemci tipi; Search, Export **[görüldü]** |
| User Login Report | `/maintenance/ITReport` | Kullanıcı, giriş sayısı, toplam/günlük ort./giriş başı ort. çevrimiçi süre; Export **[görüldü]** |
| Map | `/map/monitor`, `/map/configure` | Grup ekle; harita/kroki yok (boş hesap) **[görüldü]** |
| My Services | `/system/serviceDetail` | Lisans kartları (kapı sayacı 1/10), Activate License, Set Email Notification, Service Management, Password Usage Records **[görüldü]** |

## 6. Device (alt panel)

| Sayfa | Ne var |
|---|---|
| Resource Management (liste) | Grup ağacı + cihaz tablosu: ad, seri no, sürüm, durum, kaynak bilgisi (kapı sayısı), grup, işlem (ayar, yenile). Araç çubuğu: ekle, dışa/içe aktar, toplu işlemler, alt grup dahil, arama, kolon ayarı **[görüldü]** |
| Add Device | 3 yöntem: **SADP (LAN tarama)** (seri no, IP, port, HTTP port, maske, ağ geçidi, aktivasyon durumu, Hik-Connect durumu; Activate/Add) · **Manuel (seri no)** · **Toplu içe aktarma** (şablon indir, saat dilimi) **[görüldü]** |
| Captive Portal | Kullanıcı grubu, hesap, voucher, politika, portal şablonu (kablosuz erişim; AC ile ilgisiz) **[görüldü]** |
| Record Template | Video kayıt zaman şablonu (ilgisiz) **[görüldü]** |

## 7. Person (alt panel)

| Sayfa | Route | Ne var |
|---|---|---|
| Kişi listesi | `/person/list` | Departman ağacı + "alt departmanları göster"; kolonlar: profil, ID, ad, soyad, departman, **kimlik bilgisi ikonları** (yüz, kart, Bluetooth, parmak izi, PIN/avuç). Araç çubuğu: Add, Delete, **Import, Export, Adjust Department, Batch Issue Cards to Persons, Person ID Rule**, filtre, kolon ayarı **[görüldü]** |
| Add Person | `/person/addPerson` | Sekmeler: **Basic Information** (ad/soyad, departman, ID otomatik üretilir ve sonradan değişmez; kimlik paneli: foto, yüz, kart, Bluetooth, parmak izi; **Access Granting**: seviye listesi, **Temporary Pass** yetkisi, **Super Access Permission** (Remain Locked'u aşar), **Extended Access** (kapı açık süresi uzar), **Device Administrator**; **App Use**: hesap, e-posta, telefon) · **Vehicle** (plaka + geçerlilik) · **Attendance** (rol: Employee/Supervisor; vardiya önizleme) **[görüldü]** |
| Person ID Rule | `/person/idRuleConfig` | Toplam uzunluk; üretim modu: rastgele / artan / sabit önek + rastgele / sabit önek + artan **[görüldü]** |
| Custom Attributes | `/person/addCustomAttr` | Özel alan: ad, tip, paylaşım özelliği, listede göster **[görüldü]** |
| Self-Registration | `/person/registerConfig` | Kayıt QR kodu, yüz kalitesi doğrulama, onay ayarı, varsayılan departman **[görüldü]** |
| Registration Audit | `/person/registerAudit` | Başvuran kişi listesi: profil, ad, ID, cinsiyet, e-posta, telefon, not, durum; Approve/Reject/Delete **[görüldü]** |
| Resign | `/person/resign`, `/resignType` | Ayrılan kişiler: ID, ad, departman, devam durumu, ayrılış tarihi, **ayrılış tipi**, neden, başvuru tarihi; Add, **Reinstate**, Export, **Disable Attendance**, Delete; ayrılış tipi tanımlama **[görüldü]** |
| PIN Code | `/person/pinCode` | PIN ile geçişi aç/kapa **[görüldü]** |
| House | `/person/house` | Konut/daire yönetimi (görüntülü diyafon; AC ile ilgisiz) **[görüldü]** |

## 8. Team (alt panel)

| Sayfa | Ne var |
|---|---|
| Users | Kolonlar: ad, hesap, tip, rol, bağlantı sayısı, giriş durumu, kullanıcı durumu, **son kullanma tarihi**; Add, Delete, **Freeze/Unfreeze**, Refresh All, Import, Export, Role Management **[görüldü]**. Hesapta 8 kullanıcı (7 "App Access Control/SelfService", 1 Super User) |
| Roles | 6 hazır rol: Super Administrator, Administrator, Operator, Maintainer, SelfService, installer; her rolün durumu ve **geçerlilik aralığı**; Add/Delete; özel rol tanımlanabilir **[görüldü]** |
| Email Setting | SMTP: kimlik doğrulama, şifreleme, gönderen adresi/adı, sunucu, port, kullanıcı, şifre; Email Test **[görüldü]** |
| Team Info | Ekip adı, telefon, **Disband Team** **[görüldü]** |
| Team Configuration | Saat dilimi (varsayılan "istemci saati"), saat farkını göster; **GDPR** toggle (olay kayıtları saklama süresi + yüz fotoğrafı 24 saat); solar kamera pil eşiği **[görüldü]** |
| Account Security | **E-posta ile iki adımlı doğrulama (2FA)**, kapalı **[görüldü]** |
| Account Sync | Active Directory eşitleme, Configure **[görüldü]** |
| API Integration | "Apply Now" (API erişimi başvurusu) **[görüldü]** |
| Archive | Arşiv genel bakış / arama / temel ayar **[görüldü]** |
