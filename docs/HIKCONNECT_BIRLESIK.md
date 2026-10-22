# Hik-Connect Tersine Mühendislik — Birleşik Doküman

> **Tarih:** 2026-10-21 · **Amaç:** Hik-Connect RE çıktılarını, ngsaccess envanterini, kıyası ve uygulama durumunu tek yerde toplamak; sonraki planlama bu dosyadan yapılır.
>
> **Birleştirilen kaynaklar** (ayrıca duruyor, silinmedi): [hikconnect-reports/README.md](hikconnect-reports/README.md) (19 rapor) · [hikconnect-audit/HIKCONNECT_SAYFALAR.md](hikconnect-audit/HIKCONNECT_SAYFALAR.md) (~110 sayfa) · [NGSACCESS_ENVANTER.md](hikconnect-audit/NGSACCESS_ENVANTER.md) · [KIYAS.md](hikconnect-audit/KIYAS.md) · [UYGULAMA_PLANI.md](hikconnect-audit/UYGULAMA_PLANI.md) · [WEB_PLAN.md](hikconnect-audit/WEB_PLAN.md) · [review-wave1.md](hikconnect-audit/review-wave1.md)
>
> **Kaynak sistem:** canlı Hik-Connect 7 Team portalı (`www.hik-connect.com`, API `isgp-team.hikcentralconnect.com/hcc`), Orca gömülü tarayıcısında oturum açık hesap. Araçlar: [REA](https://github.com/morluto/rea) 6.7.0 (bundle keşfi), sayfa içi XHR kaydı, modül router'ına `push` ile gezinme, "Add" formlarını açıp iptal etme. **Salt-okuma**: export, Recalculate veya ayar kaydı tetiklenmedi (tek istisna §2.3'te).
>
> **Etiketler:** **[görüldü]** canlı ekranda/istekte gözlendi · **[çıkarım]** JS bundle'dan ya da davranıştan çıkarıldı · **[bilinmiyor]** / **[doğrulanamadı]** belirlenemedi · **[teyit]** ngsaccess kodunda kontrol edilmeli.
> Kıyas durumu: ✅ var · 🟡 kısmi · ❌ yok · ➕ bizde daha iyi.

---

## 0. Güncel durum (2026-10-21)

### Bitti
- [x] Hik-Connect RE: 19 Attendance raporu kataloğu + API akışı (2026-10-19)
- [x] Hik-Connect sayfa audit (~110 sayfa) + ngsaccess kod envanteri + kıyas (2026-10-19)
- [x] **Dalga 1 canlı:** Alarm merkezi v1 · Kişiler Excel şablon/içe/dışa aktarma + toplu kart · İzin/PDKS düzeltme talep backend'i
- [x] Dalga 1 denetimi: 3 Engel + 9 Düzeltilmeli bulgunun hepsi kodda kapalı (2026-10-21 kod taramasıyla teyit, §9)
- [x] **W1 Talepler ekranı** — commit `c23926d` (2026-10-20 15:18). Push ve yayın YOK

### Açık
- [ ] W1 yayını (Convex + web) — Emre "yayın onay" bekliyor
- [ ] W2 İşten ayrılma akışı · ~4 sa · tasarım hazır, worker başlatılmadı
- [ ] W3 Yönetici 2FA + kullanıcı dondurma/son kullanma · ~6 sa
- [ ] W4 Erişim zaman şablonları + kişi×kapı yetki durumu · ~8 sa
- [ ] W5 PDKS kuralları (esnek vardiya, giriş/çıkış zorunluluğu, check point, özel export) · ~8 sa
- [ ] W6 Küçükler paketi · ~4 sa
- [ ] P8 Mobil (Flutter) talep ekranları — mobil ekip; mobil henüz `leaveRequests`/`attendanceCorrections` çağırmıyor

Detay: §8 yol haritası.

---

## 1. Özet

- **Çekirdek bizde var ve çoğu yerde Hik'ten ileride:** kişi, kapı, erişim kuralı, vardiya, PDKS, rapor. Artılarımız: Türk mevzuatı (SGK APHB, fazla mesai çarpanı, yıllık limit, 10 TR izin türü), KVKK modülü, çoklu proje/kiracı, çoklu marka (Hik + IDE Smart).
- **Hik'te olup bizde olmayan 5 ana alan (2026-10-19 tespiti):** (1) alarm merkezi → **v1 yapıldı**, (2) izin/düzeltme başvuru-onay akışı → **yapıldı, yayın bekliyor**, (3) kişi toplu işlemleri → **Excel + toplu kart yapıldı**, ayrılma akışı açık (W2), (4) yeniden kullanılabilir erişim zaman şablonu + kişi bazlı yetki dağıtım durumu → açık (W4), (5) hesap güvenliği (2FA, dondurma, son kullanma) → açık (W3).
- **Hik raporları tamamen sunucu tanımlı:** tek generic tablo bileşeni (`tableCommon`) + rapor tanımı (`columnList` + `filterList`) ile 16 tablo raporu çıkıyor; 3 aylık matris raporu yalnız Excel export.
- **Alakasız/yapılmayacak:** harita, captive portal, video kayıt şablonu, konut, AD eşitleme, lisans/servis pazarı, firmware yükseltme.

---

## 2. Hik-Connect portalı — genel

### 2.1 Hesap durumu (inceleme anında)
1 cihaz (DS-K1T343MFX), 10 kişi, 1 kapı, 1 erişim seviyesi, 1 zaman şablonu (24 saat), 1 timetable (esnek vardiya 05:00-22:00). Lisans: Access Control & Attendance ücretsiz ömür boyu (1/10 kapı). Health Monitoring servisi **2025/05/17'de dolmuş**. Lisanssız modüller (BI, ANPR, Video Intercom) incelenmedi; bundle'da route'ları var: `/hccbi/biReport`, `/hccbi/biSchedultReportConfiguration`, `HCBANPR/carPassReport` **[çıkarım]**.

### 2.2 Modül haritası

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

### 2.3 Yöntem notu ve olay kaydı
- İlk tur modül değiştirmeden `push` yapıldığı için Maintenance/Alarm/Map ekranları yanlış modülün sayfasını (My Services) çekti; modül değiştirilip yeniden çekildi.
- **Olay:** Attendance Check Point sayfasında "Enable Custom" butonu dialog açmak yerine ayarı doğrudan değiştirdi (`checkPoint/v1/enable`, mod "tüm cihazlar" → "özel"). Aynı oturumda "Set All Devices as Attendance Check points" → Confirm ile geri alındı (`checkPoint/v1/disable` 200). Diğer iptal edilen Add pencerelerinde kayıt oluşmadı.
- Remain Unlocked & Remain Locked sayfası router ile açılınca boş kaldı **[doğrulanamadı]**.
- Ekran görüntüleri `hikconnect-audit/shots/` ve `hikconnect-reports/shots/` altında, **gitignore'lu** (gerçek personel adları var).

---

## 3. Hik-Connect sayfaları (rapor dışı)

### 3.1 Access Control

| Sayfa | Route | Ne var | API |
|---|---|---|---|
| Access Control (ana) | `/HCBAccessControl/doorAndElevatorMonitoring` | Kapı kartı (durum, kilit, uzaktan aç, "Batch Control"), kapı adı arama, Add Device, Access Granting kısayolları, Passing Records özeti **[görüldü]** | `hccacs/v1/param/element/relatedelement` |
| Overview | `/accessOverview` | Person/Device sekmeleri; All/Invalid/Effective/Not Granted sayaçları; departman ağacı + alt departman; kolonlar: kişi, erişim seviyesi, kapı, zaman şablonu, **yetki dağıtım durumu**, işlem; "Apply Access Granting" **[görüldü]** | `hccacspm/v1/maintain/overview`, `.../overview/person/detail`, `acspm/accessdownload/status` |
| Manage Access Level | `/accessLevel/list` | Liste: seviye adı, zaman şablonu, kapı; Add/Delete; filtre. Seviye = kapı kümesi + zaman şablonu **[görüldü]** | `acspm/accesslevel/list`, `template/list` |
| Grant by Department | `/assignPGroup` | Departman ağacı → seviye listesi; Batch Grant Access, Grant Access / Revoke **[görüldü]** | `acspm/personGroup/{id}/accesslevel` |
| Grant by Person | `/assignPerson` | Kişi listesi (checkbox) → seviye; Grant Access / Revoke **[görüldü]** | `acspm/person/accesslevel` |
| Temporary Pass | `/tempAuthorization` | Kolonlar: ad, PIN, QR, izin verilen geçiş sayısı, oluşturan, durum, izin durumu, başlangıç/bitiş; Add/Delete; yetkili adına göre arama **[görüldü]** | `hccvims/v1/tempAuth/list` |
| Access Record Retrieval | `/personnelEntryAndExitSearch` | Cihaz/grup seçimi; kişi tipi (Tümü/Kişi/Geçici); doğrulama sonucu; Search, **Import Events**, Export; 15 kolon: profil, ad, soyad, ID, sıcaklık, maske, kart no, departman, zaman, kapı, okuyucu, doğrulama sonucu/tipi, attendance tipi **[görüldü]** ([ekran](hikconnect-reports/shots/ac-personnel-entry-exit.png)) | `hccacs/v1/event/certificateRecords/search` (`pageIndex, pageSize, searchCriteria{beginTime, endTime, type, eventTypes, elementIDs, searchType, cardNumber, personCondition, swipeAuthResult, alcoholStatus}`) → `totalNum, recordList[]`; `event/alltype` |
| Device Recorded Data | `/deviceRecordSearch` | Kaynak tipi/kaynak/kayıt tipi seçimi; Search, Export; kolonlar: kaynak, grup, kaynak tipi, cihaz, kayıt tipi, zaman **[görüldü]** ([ekran](hikconnect-reports/shots/ac-device-record-search.png)) | `hccacs/v1/event/deviceRecords/search` (`sourceInfoList[{sourceType 1-4, eventTypes, sourceIds}]`) |
| Remain Unlocked & Locked | `/openingAndClosing` | **[doğrulanamadı]** boş geldi | — |
| Holiday Settings | `/holiday` | Tatil adı, zaman, her yıl tekrar; Add/Delete All. Ekle formu: ad, tip (düzenli/düzensiz), başlangıç, gün sayısı, yıllık tekrar **[görüldü]**. AC ve Attendance ortak tatil kaynağı | `hccvims/holiday/v1/list` |
| Access Schedule Template | `/accessSchedule` | Şablon listesi + haftalık 7×24 çizelge (Authorize bloğu); Add/Delete; arama **[görüldü]** | `hccacspm/v1/template/list` |
| Event Notification | `/equipmentSubscription` | 3 sekme: Device Event (237), Normal Access Event (28), Abnormal Access Event (74); sol grup: Device 172, Door 61, Alarm Input 4; olay başına aç/kapa toggle, Enable All, Save/Restore **[görüldü]** | — |

### 3.2 Attendance (rapor dışı)

| Sayfa | Route | Ne var |
|---|---|---|
| Schedule | `/HCBAttendance/schedule` | Hafta/ay görünümü, kişi arama, departman filtresi; kişi × gün ızgarası, hücrede renkli vardiya + değiştirme ikonu; Timetable, **Export Schedule**, **Clear Schedules** **[görüldü]** |
| Timetable | `/PeriodManage` | Liste: ad, tip (Normal/Flexible), çalışma aralığı, mola var mı, renk. Ekle formu: ad, **cross-day shift**, çalışma süresi (saat/dk), geçerli check-in/out aralığı, en geç giriş, **mola süresi** **[görüldü]** |
| Leave (başvuru) | `/approvalLeave` | Kolonlar: başvuru no, kişi, izin türü, başlangıç/bitiş, gerekçe, ek, başvuru zamanı, durum; Add / **Approve / Reject / Withdraw**. Ekle formu: kişi, izin türü, dönem, gerekçe, ek (≤5 JPG/PNG, 40 MB), **Auto Approve**, onay akışı **[görüldü]** |
| Attendance Correction | `/approvalRetroactive` | Aynı akış; kolonlar: düzeltme tipi, giriş/çıkış zamanı, gerekçe, ek, durum. Ekle formu: kişi, tip, zaman, gerekçe, ek, Auto Approve **[görüldü]** |
| General | `/attendanceRule` | "Current Shift Type" (Normal / Flexible). 4 sekme: **Weekend** (gün seçimi) · **Overtime** (fazla çalışmayı mesai say; hafta sonu için hesapla) · **Attendance Rule** (giriş zorunlu / çıkış zorunlu; esnek vardiyada varsayılan geçerli giriş/çıkış 00:00-23:59) · **Notifications** (giriş hatırlatması "5 dk kala", giriş yapıldı bildirimi) **[görüldü]** |
| Attendance Check Point | `/attCheckPoint` | Mod: "tüm cihazlar" (varsayılan) ↔ "özel liste" (cihaz ekle/sil); hesaplamalar listeye göre yapılır **[görüldü]** |
| Check In/Out via Mobile | `/MobileAttendanceList` | Mobil istemciyle giriş yapabilecek kişi listesi: ad, ID, departman, fotoğraf zorunluluğu, giriş/çıkış alanı; Add/Delete, **Manage Check-In/Out Area** **[görüldü]** |
| Holiday | `/holidaySetting` | AC ile aynı tatil listesi **[görüldü]** |
| Leave Type | `/LeaveManage` | Kullanıcı tanımlı izin türleri (yalnız ad); Add/Delete; arama **[görüldü]** |
| Report | `/ReportSetting` | Rapor görünüm ayarı: işletme adı, logo, tarih/saat/süre formatı (detay §4.6) **[görüldü]** |
| Custom Export | `/customReportExport` | Ad, format (TXT), içerik şablonu `${ID}${Last Name}...`, alan seçici (ad, soyad, ID, departman, tarih, saat, haftanın günü, veri kaynağı, cihaz adı/seri no, punch state, konum, açıklama), ayraç (tab/;/,), dil, formatlar, kişi/departman kapsamı **[görüldü]** |
| Scheduled Report | `/timingReport` | Ad, rapor tipi, format (Excel/PDF/CSV/TXT), dil, formatlar, departman (tümü/seçili), sıklık (günlük/haftalık/aylık), gönderim saati, alıcılar (≤8, kullanıcı + e-posta) **[görüldü]** |

### 3.3 Alarm

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

### 3.4 Maintenance, Map, Service

| Sayfa | Route | Ne var | API |
|---|---|---|---|
| Health Status | `/maintenance/actualTime/*` | Grup ağacı; Overview/Device/Door/Alarm Input sekmeleri; cihaz kolonları: ad, grup, model, **firmware**, ağ performansı, **kurcalama durumu**, güvenli kapı kontrol ünitesi, bileşen durumu, son denetim, işlem; "Tüm istisnalar" filtresi, Export. Çevrimdışı süre/sayı için gün-hafta-ay-yıl-özel aralık. **Servis süresi dolduğu için liste boş** **[görüldü]** | — |
| Firmware Upgrade | `/maintenance/firmware/*` | Liste + zamanlanmış yükseltme; "Upgrade All Failed Tasks"; kolonlar: ad, model, seri no, sürüm, mevcut sürüm, ağ, durum **[görüldü]** | — |
| Device Report (planlı) | `/maintenance/deviceReport` | Planlı cihaz raporu, yalnız "Add" (hesapta tanımlı yok) **[görüldü]** | `hccmaintain/v1/schedule/report/search` |
| Device Log | `/maintenance/deviceLog` | Log tipi, zaman, kullanıcı, olay adı, kanal, IP, açıklama; Search **[görüldü]** | `hccmaintain/inspection/v1/common/search`, `device/v1/logtype/list` |
| Operation Log | `/maintenance/dailyRecord` | İşlem tipi, zaman, kaynak, tip, kaynak adı, grup, açıklama, istemci tipi; Search, Export **[görüldü]** | `operation/v1/hc/dictionary/list`, `auth/account/v1/user/search/page` |
| User Login Report | `/maintenance/ITReport` | Kullanıcı, giriş sayısı, toplam/günlük ort./giriş başı ort. çevrimiçi süre; Export **[görüldü]** | `auth/account/v1/user/search/page` |
| Map | `/map/monitor`, `/map/configure` | Grup ekle; harita/kroki yok (boş hesap) **[görüldü]** | — |
| My Services | `/system/serviceDetail` | Lisans kartları (kapı sayacı 1/10), Activate License, Set Email Notification, Service Management, Password Usage Records **[görüldü]** | — |

### 3.5 Device (alt panel)

| Sayfa | Ne var |
|---|---|
| Resource Management (liste) | Grup ağacı + cihaz tablosu: ad, seri no, sürüm, durum, kaynak bilgisi (kapı sayısı), grup, işlem (ayar, yenile). Araç çubuğu: ekle, dışa/içe aktar, toplu işlemler, alt grup dahil, arama, kolon ayarı **[görüldü]** |
| Add Device | 3 yöntem: **SADP (LAN tarama)** (seri no, IP, port, HTTP port, maske, ağ geçidi, aktivasyon durumu, Hik-Connect durumu; Activate/Add) · **Manuel (seri no)** · **Toplu içe aktarma** (şablon indir, saat dilimi) **[görüldü]** |
| Captive Portal | Kullanıcı grubu, hesap, voucher, politika, portal şablonu (kablosuz erişim; AC ile ilgisiz) **[görüldü]** |
| Record Template | Video kayıt zaman şablonu (ilgisiz) **[görüldü]** |

### 3.6 Person (alt panel)

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

### 3.7 Team (alt panel)

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

---

## 4. Hik-Connect raporları (Attendance, 19 rapor)

### 4.1 Özet
- **19 rapor**, 3 grup: Kayıtlar 3 · Günlük 9 · Aylık 7. Menü sunucudan geliyor: `POST /hccattendance/ability/v1/menu/list` **[görüldü]**.
- **Tamamen sunucu tanımlı:** tek bileşen (`tableCommon`), `ability/v1/report/{id}/get` cevabındaki `columnList` + `filterList` ile tabloyu ve filtre formunu kuruyor. Veri tek uçtan: `report/v1/list` (`reportTypeId` parametresiyle) **[görüldü]**.
- 3 rapor (Attendance Overview / Status / Summary) **yalnız export**. Ekranda "sanal veri" önizlemesi, gerçek veri yalnız dışa aktarılan dosyada **[görüldü]**.
- Liste cevabında `total` yok; sayfalama `nextPageExists` ile **[görüldü]**.

### 4.2 Rapor menüsü

| Grup | Rapor | `reportTypeId` | Route | Bileşen | Filtreler | Kolon | Yeniden hesap. | Export ¹ | Ekran |
|---|---|---|---|---|---|---|---|---|---|
| Kayıtlar | Transaction | 1 | `/HCCAttendance/transaction` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay), Device | 14 | hayır | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/transaction.png) |
| Kayıtlar | Mobile Transaction | 9 | `/HCCAttendance/mobileClockingReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 11 | hayır | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/mobile-transaction.png) |
| Kayıtlar | Time Card | 18 | `/HCCAttendance/TimeCard` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 8 | hayır | Excel, PDF, TXT, Yazdır | [png](hikconnect-reports/shots/time-card.png) |
| Günlük | Total Time Card | 2 | `/HCCAttendance/totalTimeCard` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 33 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/total-time-card.png) |
| Günlük | Worked Hrs | 3 | `/HCCAttendance/workedHrs` | `tableCommon` | aynı | 16 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/worked-hrs.png) |
| Günlük | First In Last Out | 19 | `/HCCAttendance/FirstInLastOut` | `tableCommon` | aynı | 15 | hayır | Excel, PDF, TXT, Yazdır | [png](hikconnect-reports/shots/first-in-last-out.png) |
| Günlük | Exception Report | 7 | `/HCCAttendance/exceptionReport` | `tableCommon` | aynı | 17 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/exception-report.png) |
| Günlük | Late Report | 4 | `/HCCAttendance/lateReport` | `tableCommon` | aynı | 18 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/late-report.png) |
| Günlük | Early Leave Report | 5 | `/HCCAttendance/earlyLeaveReport` | `tableCommon` | aynı | 18 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/early-leave-report.png) |
| Günlük | Absent Report | 6 | `/HCCAttendance/absentReport` | `tableCommon` | aynı | 18 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/absent-report.png) |
| Günlük | Overtime Report | 8 | `/HCCAttendance/overtimeReport` | `tableCommon` | aynı | 9 | evet | Excel, PDF, CSV, TXT, Yazdır | [png](hikconnect-reports/shots/overtime-report.png) |
| Günlük | Break Report | 17 | `/HCCAttendance/BreakReport` | `tableCommon` | aynı | 14 | evet | Excel, PDF, TXT, Yazdır | [png](hikconnect-reports/shots/break-report.png) |
| Aylık | Monthly Status | 12 | `/HCCAttendance/MonthlyStatus` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 12 | evet | Excel, PDF, Yazdır | [png](hikconnect-reports/shots/monthly-status.png) |
| Aylık | Monthly Worked Hrs | 11 | `/HCCAttendance/MonthlyWorkedHrs` | `tableCommon` | aynı | 15 | evet | Excel, PDF, Yazdır | [png](hikconnect-reports/shots/monthly-worked-hrs.png) |
| Aylık | Person Attendance | 13 | `/HCCAttendance/PersonAttendance` | `tableCommon` | aynı | 18 | evet | Excel, PDF, Yazdır | [png](hikconnect-reports/shots/person-attendance.png) |
| Aylık | Department Attendance | 14 | `/HCCAttendance/DepartmentAttendance` | `tableCommon` | Department, Time Period (vars.: Bu ay) | 14 | evet | Excel, PDF, Yazdır | [png](hikconnect-reports/shots/department-attendance.png) |
| Aylık | Attendance Overview | 15 | `/HCCAttendance/AttendanceOverview` | `personDetailReport` | Department, Time Period (vars.: Bu ay), Person | 0 | evet | Excel | [png](hikconnect-reports/shots/attendance-overview.png) |
| Aylık | Attendance Status | 16 | `/HCCAttendance/AttendanceStatus` | `monthlyAttStatusReport` | aynı | 0 | evet | Excel | [png](hikconnect-reports/shots/attendance-status.png) |
| Aylık | Attendance Summary | 10 | `/HCCAttendance/monthlyAttendanceSummary` | `monthlyReport` | aynı | 0 | evet | Excel, Yazdır | [png](hikconnect-reports/shots/attendance-summary.png) |

¹ Export format kodlarının (0-4) adları **[çıkarım]**: Zamanlanmış Rapor formunda Excel/PDF/CSV/TXT görüldü; `4` için bundle `filePageSize` + `fileOrientationType` (yazdırma sayfa boyutu/yönü) ekliyor.

Kolon listelerinin tamamı: **Ek A**.

### 4.3 Ortak API akışı (tablo tipi raporlar)

Tüm uçlar `POST https://isgp-team.hikcentralconnect.com/hcc` altında. Kimlik doğrulama cookie ile (`withCredentials`). Ek header'lar: `Accept`, `Content-Type`, `clientSource` **[görüldü]**.

| Sıra | Uç | İstek | Amaç |
|---|---|---|---|
| 1 | `/hccattendance/ability/v1/menu/list` | `{"language":"en"}` | Menü ağacı (grup → rapor, `reportTypeId`, `url`, `componentName`) |
| 2 | `/hccattendance/report/v1/display/get` | `{}` | Şirket adı + `dateFormat`/`timeFormat`/`durationFormat` |
| 3 | `/hccattendance/ability/v1/report/{id}/get` | `{"language":"en"}` | Rapor tanımı: `columnList`, `filterList`, `supportedFormat`, `canRecalculate` (hepsi tek seferde: `/ability/v1/report/list`) |
| 4 | `/hccattendance/report/v1/list` | aşağıda | Sayfalı veri |
| 5 | `/hccattendance/calculation/v1/progress` | `{}` | Arka planda hesaplama sürüyor mu (Recalculate olan raporlar) |
| 6 | `/hccattendance/report/v1/status/export/get` | `{}` | Süren export var mı |
| — | `/hccattendance/calculation/v1/manual` | `{startDate,endDate,isAllPerson,personIdList}` | Recalculate düğmesi (en fazla 1 yıl aralık) **[çıkarım]** |
| — | `/hccattendance/report/v2/export` | `{format, exportTime, reportTypeId, filterList, columnList:[], (format=4 → filePageSize, fileOrientationType)}` | Asenkron export; sonra `status/export/get` sorgulanır, iptal `export/stop` **[çıkarım]** |

**Liste isteği** **[görüldü]**:

```json
{
 "page": 1,
 "pageSize": 20,
 "language": "en",
 "reportTypeId": 1,
 "columnIdList": [],
 "filterList": [
  { "columnName": "fullName", "operation": "LIKE", "value": "" },
  { "columnName": "personCode", "operation": "LIKE", "value": "" },
  { "columnName": "groupId", "operation": "IN", "value": "" },
  { "columnName": "clockStamp", "operation": "BETWEEN", "value": "2026-10-01T00:00:00+03:00,2026-10-31T23:59:59+03:00" },
  { "columnName": "deviceId", "operation": "IN", "value": "" }
 ]
}
```

**Liste cevabı** **[görüldü]**: `{"data":{"page","pageSize","columnList":[...string],"reportDataList":[{...}],"nextPageExists":bool},"errorCode":"0"}`

### 4.4 Filtre sözlüğü ve değer formatları

| inputType | Hedef kolon | Operasyon | UI |
|---|---|---|---|
| 0 | `fullName`, `personCode` | `LIKE` | metin kutusu |
| 1 | `groupId` | `IN` (virgüllü id) | departman ağacı |
| 3 | `clockStamp` | `BETWEEN` (`ISO+03:00,ISO+03:00`) | zaman aralığı (ham kayıt raporları) |
| 5 | `date` | `BETWEEN` | tarih aralığı (hesaplanmış raporlar). Varsayılan: günlükte `1` = Dün, aylıkta `4` = Bu ay |
| 6 | `deviceId` | `IN` | cihaz seçimi (yalnız Transaction) |
| 7 | `personId` | `IN` | kişi seçimi (yalnız export-only raporlar) |

- Zaman aralığı seçenekleri **[çıkarım, bundle]**: Bugün, Dün, Bu hafta, Geçen hafta, Bu ay, Geçen ay, Özel (en fazla 31 gün).
- **Değer formatları** **[görüldü]**: süreler `"HH:MM"` string, tarih `"yyyy-MM-dd"`, saat `"HH:mm"`, `week` İngilizce gün adı, `attendanceStatus` metin (ör. `"Absent"`).
- `checkIn*`/`checkOut*` = vardiyanın **planlanan** başlangıç/bitişi; `clockIn*`/`clockOut*` = **gerçek** okutma.
- Aylık durum raporunda günler dinamik kolon olarak geliyor (`"2026-10-01": "..."`).

### 4.5 Export-only raporlar (Overview / Status / Summary)
- `componentName`: `personDetailReport` (Overview, id 15), `monthlyAttStatusReport` (Status, id 16), `monthlyReport` (Summary, id 10) **[görüldü]**.
- Ekranda yalnız sabit örnek veri (XXX / 09:00-18:00) ve "The attendance details only provide virtual data for reference. Take the exported data as standard." uyarısı. `report/v1/list` çağrılmıyor **[görüldü]**.
- Filtreler: departman (`groupId`), tarih (`date`, vars. Bu ay), kişi (`personId`). Format: 15/16 yalnız Excel, 10 Excel + yazdır **[görüldü]**.
- Summary/Status düzeni: kişi başına satır blokları (Timetable, Attendance Status, Clock-In/Out 1..n, Worked/Overtime/Late/Early/Break süresi) × ayın günleri + sağda toplamlar (Days of Work, Late, Early Leave, Overtime, Absent, haftanın günleri, Workday/Weekend). İzin türleri `leave/type/v1/list` ile ayrı kolon **[görüldü ekran + çıkarım]**.

### 4.6 Rapor ayarı sayfaları

| Sayfa | Route | API | Alanlar |
|---|---|---|---|
| Report (görüntü ayarı) | `/HCBAttendance/ReportSetting` | `report/v1/display/get` · `display/save` | Şirket adı*, logo (JPG/PNG <10 MB), tarih/saat/süre formatı ([ekran](hikconnect-reports/shots/report-setting.png)) |
| Custom Report | `/HCBAttendance/customReportExport` | `custom/report/v1/view·add·update·delete·export` | Hesapta tanımlı özel rapor yok (`customReportList: []`); form alanları §3.2 Custom Export ([ekran](hikconnect-reports/shots/custom-report-export.png)) |
| Scheduled Report | `/HCBAttendance/timingReport` | `timed/report/v1/view·add·update·delete` | `name, reportId, reportFormat, language, date/time/durationFormat, allGroup, groupIds, cycleType (gün/hafta/ay), sendDate, sendTime, sendMails (≤8), lastStatus` **[görüldü]** ([ekran](hikconnect-reports/shots/timing-report.png)) |

Diğer modüllerdeki rapor/kayıt sayfaları (Access Record, Device Recorded Data, Overview, Device Report, Device Log, Operation Log, User Login Report) API'leriyle birlikte §3.1 ve §3.4'te.

### 4.7 Raporlardan ngsaccess'e çıkarımlar
1. **Sunucu tanımlı rapor deseni:** tek bir `reportDefinitions` (kolon + filtre + format) tablosu ve tek generic tablo bileşeni ile 16 tablo raporu çıkar. Hik bunu `tableCommon` ile yapıyor.
2. **Ham ve hesaplanmış veri ayrımı:** `clockStamp` filtreli raporlar (Transaction, Mobile, Time Card) ham okutma; `date` filtreli raporlar gece/manuel hesaplanan günlük sonuç. Recalculate + progress akışı ayrı.
3. **Planlanan ve gerçekleşen alanlar** her satırda birlikte (`checkIn*` plan, `clockIn*` gerçek). PDKS günlük satır modelimiz bu ikiliği taşımalı.
4. Aylık matris raporları (Status/Summary) **export-first**. Biz de ilk sürümde Excel çıktısını öncelikleyebiliriz.
5. KVKK: Access Record cevabında sıcaklık/maske/yüz görseli alanları var. PDKS raporlarına biyometrik türev alan taşınmamalı (bkz. `PDKS_AUDIT_VE_PLAN_2026-10-16.md`).

---

## 5. ngsaccess envanteri (web)

> Kaynak: 2026-10-19 kod envanteri (`src/App.tsx` + `src/lib/routeMeta.ts`), 2026-10-21'de `/alarms` ve Talepler eklemeleriyle güncellendi. Satır numaraları kaldırıldı (değişiyor).

| Route | Menü | Var olanlar | Eksik / not | Ana Convex modülleri |
|---|---|---|---|---|
| `/home` | Ana Sayfa | Proje özeti, bugünkü geçişler, canlı akış, cihaz sağlığı, hızlı bağlantılar | — | `dashboard` |
| `/system-admin` | Admin (yalnız super admin) | Kullanıcılar (rol güncelle/sil, davet), Projeler (CRUD + silme etkisi), Cihazlar (kayıt/atama/silme, claim) | İçe/dışa aktarma yok; dondurma/son kullanma yok (W3) | `users`, `invites`, `projects`, `adminDevices`, `devices` |
| `/employees` | Kişiler | Departman ağacı + tablo, arama, ekle/düzenle/sil, toplu sil/departman, cihaza senkron. **Excel şablon/içe/dışa aktarma + toplu kart (Dalga 1)**. Form: ad, soyad, e-posta, kart, T.C., bordro kodu, firma, departman, pozisyon, erişim kuralı, aktiflik, foto, ücret/bordro, not | Ayrılış akışı yok, yalnız `isActive` (W2) | `employees`, `departments`, `employeeImport`, `actions.hikvisionSync` |
| `/devices` | Cihazlar | Bölge→kapı→cihaz hiyerarşisi; ekle/düzenle/sil, claim/serbest bırak, QR, konum, kapı/okuyucu işlemleri; Hik + IDE Smart marka alanları | Toplu içe aktarma, LAN keşfi yok; çevrimdışı süre/sayı geçmişi yok (W6) | `devices`, `zones`, `doors`, `readers` |
| `/virtual-readers` | Sanal Okuyucular (Yakında) | Placeholder | — | — |
| `/access-control` | Geçiş Kontrol | Kural listesi (kural, tür, kim, kapsam/kapılar, zamanlama, durum), arama/filtre, CRUD, senkron/yeniden eşitleme | Ayrı zaman şablonu yok, kişi×kapı yetki durumu yok (W4) | `accessRules`, `deviceSyncRuns` |
| `/visitors` | Ziyaretçiler | Liste + özet, okuyucu durumu, CRUD, check-out/kartı bırak. Form: bölge/kural, geçerlilik, kart, ad, soyad, şirket, ziyaret edilen, amaç, telefon, not, KVKK rızası | Dışa aktarma yok; PIN/QR geçiş yok | `visitors`, `cardReadings` |
| `/live-monitoring` | Canlı İzleme | Son geçiş akışı; kişi/cihaz/kapı filtresi; olay sonucu | Dışa aktarma yok | `cardReadings`, `devices`, `doors` |
| `/pdks-records` | PDKS Kayıtları | Tablo/çizelge/grafik/ısı haritası; tarih, kişi, departman/şirket/pozisyon/vardiya/durum filtreleri; toplu menü, çalışan detayı, kayıtlı görünüm; CSV içe aktarma; bordro/SGK/PDF/Excel; manuel düzeltme. **Düzeltme talepleri kuyruğu (W1, yayın bekliyor)** | Özel kolon seçici yok (W5) | `cardReadings`, `pdksRecords`, `attendanceCorrections`, `sgkExport`, `actions.pdksImport` |
| `/shifts` | Vardiyalar | Takvim atama, toplu atama önizleme, atama düzenle/sil, tanım CRUD, izin/tatil örtüşmesi | Toplu temizle + dışa aktar yok (W6); esnek vardiya yok (W5) | `shifts`, `leaves`, `holidays` |
| `/leaves` | İzinler | Liste/özet, kişi/departman/tür/dönem filtreleri, ekle/düzenle. **Talepler sekmesi: onay/red + gerekçe, menü rozeti (W1, yayın bekliyor)** | Ek dosya yok; özel izin türü yok (sabit 10 TR türü) | `leaves`, `leaveRequests` |
| `/alarms` | Alarmlar (yeni, Dalga 1) | Alarm/Arıza sekmeleri, filtre, toplu onay, bildirim ayarı (e-posta, min önem, ≤8 alıcı) | Alarm kural tanımı, öncelik yönetimi, export yok **[teyit]** | `alarms`, `deviceEvents`, `actions.sendAlarmEmail` |
| `/settings` | Ayarlar (admin) | Genel, çalışma/bordro, raporlar (zamanlanmış rapor), bildirim, e-posta, entegrasyon (Hik köprü), gizlilik (biyometrik modül, saklama süresi, imha) | — | `settings`, `holidays`, `reports`, `hikBridge`, `privacy*`, `biometricDestruction` |
| `/audit-log` | Denetim Kaydı (admin) | Aktör/proje/zaman filtresi, sistem kayıtları anahtarı, sayfalama | Excel dışa aktarma yok (W6) | `auditLog` |
| `/reports`, `/reports/:group`, `/reports/:group/:slug` | Raporlar | 16 rapor (katalog → grup → detay); kişi/dönem/departman/sonuç filtreleri; CSV/Excel/PDF | — | `cardReadings`, `reports` |
| `/profile`, `/engineering-department` | gizli menü | Profil/foto/güvenlik; departman inceleme | — | `users`, `files` |
| Public | — | `/`, `/login`, `/register`, `/verify-email`, `/check-in` (token ile check-in + konum), `/user-setup`, `/admin-setup`, `/employee-setup`, yönlendirmeler, 404 | Giriş 2FA yok (W3) | `emailVerification`, `invites`, `employeeAuth`, `employeeCheckIn` |

---

## 6. Kıyas: Hik-Connect ↔ ngsaccess

> 2026-10-19 kıyası; durumlar 2026-10-21 itibarıyla güncellendi ("↻" = o tarihten beri değişti).

### 6.1 Access Control

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Canlı kapı + uzaktan aç + Batch Control | `/live-monitoring`, `/devices` kapı işlemleri, web kapı açma canlı | ✅ | Toplu kapı kontrolü **[teyit]** |
| Manage Access Level (kapı + zaman şablonu) | `/access-control` erişim kuralları (kişi/departman kapsamı, kapı/bölge, gün-saat) | ➕ | Kural tek yerde kişi+kapı+zaman; `deviceSyncRuns` izlenir |
| Grant by Department / by Person | Kuralın kapsamı olarak departman/kişi | ✅ | |
| Overview: kişi başına efektif yetki durumu (Invalid/Effective/Not Granted) | Senkron çalıştırma listesi var; kişi×kapı tablosu yok | 🟡 | `debugIde:panelRosterDiff` iç araç, UI değil → **W4** |
| Access Schedule Template (haftalık 7×24, yeniden kullanılabilir) | Kural içinde gün-saat; şablon tablosu yok | 🟡 | → **W4** |
| Holiday Settings (AC) | `holidays` (Türkiye tatilleri otomatik) | ✅ | Erişim kuralı tatil takvimine bağlı mı: 2026-10-21 grep'te `accessRules.ts`'de tatil referansı yok **[teyit]** |
| Temporary Pass (PIN/QR, geçiş sayısı) | `/visitors` (fiziksel kart, geçerlilik, KVKK rızası) | 🟡 | PIN/QR tek kullanımlık geçiş yok; ertelendi |
| Access Record Retrieval (filtre, Export, Import Events) | `/live-monitoring` + `/reports` işlem raporu | 🟡 | Rapor export var; olay içe aktarma yok |
| Device Recorded Data (kurcalama, çevrimdışı) | `/alarms` Alarm/Arıza sekmesi | 🟡 ↻ | Ayrı operasyon günlüğü yok |
| Remain Unlocked / Locked (kapı modu zamanlaması) | Hik kapısında tek günlük pencere (`EditDoorDialog`, `hikDoorStatusPlan`) | 🟡 | Haftalık plana çevirme → **W6** |
| Event Notification (237+28+74 olay türü aç/kapa) | — | ❌ | |
| Super Access, Extended Access, Device Administrator bayrakları | Kapı açık süresi cihaz parametresi var; kişi bayrağı yok | ❌ | Küçük iş: kişi bayrağı + cihaza yazma |

### 6.2 Attendance (PDKS)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Schedule (kişi×gün ızgara, Export, Clear) | `/shifts` takvim, toplu atama önizleme | ✅ | Toplu temizle + dışa aktar yok → **W6** |
| Timetable: Normal / Flexible, cross-day, mola, geçerli pencere | Vardiya tanımı + mola ihlali raporu | 🟡 | Esnek vardiya şemada yok → **W5** |
| Leave başvuru + Approve/Reject/Withdraw + ek + Auto Approve | `leaveRequests` backend + `/leaves` Talepler sekmesi | ✅ ↻ | W1 `c23926d`, **yayın bekliyor**. Geri çekme = bekleyen talebi silme. Ek dosya + Auto Approve yok |
| Attendance Correction başvurusu + onay | `attendanceCorrections` + `/pdks-records` düzeltme kuyruğu | ✅ ↻ | W1, yayın bekliyor |
| Supervisor rolü (departman başvurularını onaylar) | Roller: super_admin / project_admin / project_user | ❌ | Departman bazlı onaycı yok |
| General: Weekend | `workSettings` hafta sonu | ✅ | |
| General: Overtime | `overtimeRates` (çarpan, hafta sonu çarpanı), yıllık limit, tolerans, SGK | ➕ | |
| General: Attendance Rule (giriş/çıkış zorunlu) | Şemada yok; `pdksCalc` içinde sabit | ❌ | → **W5** |
| General: Notifications (giriş hatırlatma/bildirim) | `notificationSettings` | 🟡 | İçerik **[teyit]** |
| Attendance Check Point (hangi cihazlar sayılır) | Şemada yok; tüm okuyucular sayılıyor | ❌ | → **W5** (turnike sayılır, iç kapı sayılmaz) |
| Mobil check-in + alan (geofence) | `/check-in` token + konum (`employeeCheckIn`) | ✅ | Çok noktalı alan yönetimi + kişi bazlı mobil yetki listesi **[teyit]** |
| Holiday | `holidays` + TR tatilleri seed | ➕ | |
| Leave Type (kullanıcı tanımlı) | Sabit 10 tür | 🟡 | TR mevzuatı için bilinçli seçim olabilir |
| Report (işletme adı/logo/format) | `companies`, genel ayarlar | 🟡 | Raporlarda firma adı/logo **[teyit]** |
| Custom Export (alan seçici, TXT şablon) | Sabit kolonlar; SGK/bordro çıktısı | ❌ | → **W5** |
| Scheduled Report (e-posta) | `reportScheduleSettings` + cron | ✅ | |
| 19 rapor | `/reports` 16 rapor (canlı) | ✅ | §4 |

### 6.3 Kişi (Person)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Departman ağacı + liste + filtre | `/employees` | ✅ | |
| Import / Export (Excel) | `employeeImport` (şablon, önizleme, satır hata raporu, export + audit, T.C. varsayılan kapalı) | ✅ ↻ | Dalga 1, canlı |
| Adjust Department (toplu) | `bulkUpdateDepartment` | ✅ | |
| Batch Issue Cards | `employeeImport.assignCards` + `BatchCardAssignDialog` | ✅ ↻ | Dalga 1, canlı; kart değişince panel temizleme + sync |
| Person ID Rule | — | ❌ | Düşük/orta |
| Kimlik: yüz, kart, parmak izi, Bluetooth, PIN | Kart + yüz + parmak izi (KVKK ile kısıtlı) | 🟡 | PIN/Bluetooth yok (ertelendi); biyometri PDKS'te KVKK gereği kapalı |
| Custom Attributes | — | ❌ | Ertelendi |
| Self-Registration (QR) + Registration Audit | Davet ile hesap kurulumu (`invites`) | 🟡 | Ertelendi (ziyaretçi modülü büyürse) |
| Resign (tarih, tip, neden, Reinstate, Disable Attendance) | `isActive` + zamanlı erişim iptali | 🟡 | → **W2** (tasarım hazır) |
| Vehicle (plaka) | — | ❌ | Ertelendi |
| Kişi başına Temporary Pass yetkisi | — | ❌ | Düşük |
| Attendance rolü + vardiya önizleme | Vardiya ayrı sayfada | 🟡 | |

### 6.4 Alarm ve Bakım

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Alarm Center (son alarmlar, Acknowledge) | `/alarms` v1: liste, Alarm/Arıza sekmeleri, filtre, toplu onay | ✅ ↻ | Ses/pop-up yok |
| Alarm kuralları + öncelik + bildirim (App, e-posta) | Kritik olayda e-posta (min önem, 10 dk debounce, ≤8 alıcı, varsayılan kapalı) | 🟡 ↻ | Kural tanımı, öncelik yönetimi, App bildirimi yok |
| Alarm Search / Export, kategori (yanlış alarm) | `/alarms` filtre | 🟡 ↻ | Export ve kategori **[teyit]** |
| Receiving Schedule, Email Linkage Template | — | ❌ | |
| Health Status (firmware, kurcalama, çevrimdışı süre/sayı) | Dashboard cihaz sağlığı + son görülme | 🟡 | Çevrimdışı geçmişi → **W6** |
| Firmware Upgrade | — | ❌ | Yapılmayacak |
| Operation Log | `/audit-log` | ✅ | Excel dışa aktarma → **W6** |
| Device Log | `/alarms` Arıza sekmesi | 🟡 ↻ | |
| User Login Report | — | ❌ | Yapılmayacak |
| Map | — | ❌ | Yapılmayacak |

### 6.5 Cihaz

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Cihaz listesi | `/devices` hiyerarşi, claim/serbest bırak, QR, çoklu marka | ➕ | |
| Add: SADP LAN tarama | Windows köprüsü + gateway kaydı | 🟡 | Tek tıkla LAN keşfi yok |
| Add: seri no / toplu içe aktarma | Seri no/UUID ile kayıt | 🟡 | Toplu içe aktarma yok |
| Captive Portal, Record Template, House | — | ❌ | Alakasız |

### 6.6 Ekip ve güvenlik

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Users (son kullanma, Freeze/Unfreeze, Import/Export) | `/system-admin` kullanıcı listesi, rol, davet | 🟡 | → **W3** |
| Roles (özel rol, geçerlilik aralığı) | 3 sabit rol + `capabilities(role)` | 🟡 | Özel rol ertelendi |
| Account Security: 2FA (e-posta) | Kayıtta e-posta doğrulama; giriş 2FA yok | ❌ | → **W3** (yüksek değer) |
| Email Setting (SMTP) | `mailSettings` | ✅ | |
| Team Configuration: saat dilimi, GDPR saklama | Saat dilimi, `privacyRetention`, biyometrik imha, rıza | ➕ | |
| Account Sync (AD), API Integration | — | ❌ | Ertelendi |
| Service / Lisans | — | ❌ | Alakasız |

---

## 7. Bizde olup Hik-Connect'te olmayanlar

- SGK APHB çıktısı, bordro sayfası, fazla mesai çarpanları ve yıllık limit, 10 TR izin türü ve bakiye (`leaveBalances`).
- KVKK: PDKS'te biyometri yasağı (2026/921), imha akışı, çalışan rızası, ziyaretçi aydınlatma metni, kart okuma saklama süresi.
- Çoklu proje/kiracı (`projects`, `userProjects`), proje bazlı yetki.
- Ana sayfa özet panosu: tekrarlayan geç kalanlar, yıllık fazla mesai bakiyesi, mola ihlalleri.
- Çoklu marka (Hik + IDE Smart panel), cihaz senkron çalıştırması izleme.
- Kayıtlı görünümler, PDKS ısı haritası/grafik görünümleri, çalışan detay çekmecesi.

---

## 8. Yol haritası (web)

Eşleme: eski paket adları (UYGULAMA_PLANI) → yeni (WEB_PLAN): P1-P2-P3a = Dalga 1 · P3b = W1 · P4 = W2 · P6 = W3 · P5 = W4 · P7 = W5 · P8 = mobil · W6 yeni.

### Dalga 1 — BİTTİ, canlı
- [x] Alarm merkezi v1: liste, Alarm/Arıza sekmeleri, toplu onay, kritik olayda e-posta, kart okuma tetiği
- [x] Kişiler: Excel şablon, içe aktarma, dışa aktarma, toplu kart atama
- [x] İzin + PDKS düzeltme talebi backend'i (`leaveRequests`, `attendanceCorrections`: talep, geri çek, onay, red)
- Kapılar (2026-10-19 21:33): vitest 212 dosya / 2178 test yeşil, tsc 0, eslint 0

### Dalga 2 — önce (yüksek değer)
- [x] **W1 Talepler ekranı** — commit `c23926d` 2026-10-20 15:18 (vitest 2356/2356, tsc 0, eslint 0, build OK; Claude denetimi temiz). **YAYIN BEKLİYOR**
  - Bulgu: izin onaylayan backend de yoktu (eski `leaves.approve/reject` C6'da ölü diye silinmişti) → W1 = backend + UI
  - `/leaves` → "Talepler" sekmesi; `/pdks-records` → "Düzeltme talepleri" kuyruğu (eski/yeni saat yan yana); menüde bekleyen sayısı rozeti
- [ ] **W2 İşten ayrılma (P4)** · ~4 sa · TASARIM HAZIR (2026-10-21), worker başlatılmadı
  - Bulgu: employees'ta yalnız `isActive`. `isActive===true` filtresi ay içinde ayrılanı düşürüyor: `convex/lib/reportAttendance.ts:75,77,84`, `convex/cardReadings.ts:1358,1375` (PDKS detay; Flutter ortak), `convex/sgkExport.ts:75`. Ziyaretçide benzeri var: `visitors.expireVisitorAccess` cron + `by_project_visitor_expiry` index.
  - Şema: employees += `employmentEndDate` (YYYY-MM-DD, son çalışma günü), `terminationType` (istifa/işveren feshi/emeklilik/sözleşme sonu/diğer), `terminationReason` (≤500), `sgkExitCode` (opsiyonel 2 hane), `terminatedAt`, `terminatedBy` + index (isActive, employmentEndDate).
  - Backend YENİ dosya `convex/employeeTermination.ts`: `terminate` (adminMutation; tarih ≤ bugün → hemen `isActive=false` + `syncEmployeeToDevicesInternal` + `syncEmployeeToIdePanels`; ileri tarih → cron kapatır), `reinstate`, audit. Günlük cron 00:05 TR (21:05 UTC).
  - Ortak yardımcı `convex/lib/employment.ts`: `employedDuring(emp, start, end)` / `employedOn(emp, date)` → reportAttendance + sgkExport + cardReadings: dönem içinde ayrılan dahil, bitiş sonrası gün devamsız sayılmaz.
  - UI: EmployeeDetails "İşten çıkar" diyaloğu + ayrılmış rozeti + "Geri al"; Kişiler filtresine "Ayrılanlar".
  - Kapsam dışı: işe giriş tarihi, SGK işten ayrılış bildirgesi çıktısı, bekleyen talepleri otomatik iptal.
- [ ] **W3 Yönetici 2FA + kullanıcı dondurma / son kullanma (P6)** · ~6 sa
  - Girişte e-posta kodu (OTP) — önce K3 tasarım (Convex Auth üstüne), sonra uygulama; güvenlik denetimi şart (yarım 2FA kullanıcıyı kilitler)
  - `/system-admin`: kullanıcıyı dondur/çöz, hesap bitiş tarihi

### Dalga 3 — sonra
- [ ] **W4 Erişim zaman şablonları + yetki durumu (P5)** · ~8 sa
  - Haftalık 7×24 şablon bir kez tanımlanır, birçok kurala bağlanır
  - Kişi × kapı tablosu: Etkin / Bekliyor / Hata (Hik "Overview"); Hik/IDE senkron riski → K3 tasarım + denetim
- [ ] **W5 PDKS kuralları (P7)** · ~8 sa
  - Esnek vardiya (saat serbest, süre sabit)
  - Giriş/çıkış zorunluluğu kuralı (eksik okutma nasıl sayılır)
  - PDKS'e sayılan cihazlar (check point)
  - Özel dışa aktarma: kolon seçici
- [ ] **W6 Küçükler paketi** · ~4 sa
  - Denetim kaydı Excel dışa aktarma
  - Cihaz çevrimdışı süre/sayı geçmişi (Cihazlar detayı)
  - Vardiyalar: toplu temizle + dışa aktar
  - Kapı durum planı: tek günlük pencere → haftalık plan

### Mobil
- [ ] **P8** Flutter başvuru ekranları — önkoşul W1 yayını; `mobile/**`'de başkasının commit'siz işi var, önce sahibiyle eşle

### Yapılmayacak / ertelenen
Harita, captive portal, video kayıt şablonu, konut, AD eşitleme, firmware yükseltme, araç plakası, özel kişi alanları, Bluetooth/PIN kimlik, özel rol tanımı, kullanıcı giriş raporu. Geçici PIN/QR geçiş ve QR ile kendi kaydı → ziyaretçi modülü büyürse tekrar bakılır.

### Henüz plana girmemiş adaylar (kıyastan)
- Supervisor (departman onaycısı) rolü
- Super Access / Extended Access / Device Administrator kişi bayrakları
- Event Notification (olay türü bazında aç/kapa), alarm kuralı tanımı, App bildirimi
- Person ID Rule, kullanıcı tanımlı izin türü, izin talebine ek dosya
- Sunucu tanımlı rapor deseni (§4.7) ve plan/gerçek ikilisi PDKS satır modelinde

---

## 9. Dalga 1 denetim bulguları — durum

Kaynak: [review-wave1.md](hikconnect-audit/review-wave1.md) (Claude sonnet high, 3 Engel / 9 Düzeltilmeli / 9 Not). Durum kolonu 2026-10-21 kod taramasıyla teyit edildi.

| ID | Konu | Durum |
|---|---|---|
| E1 | `assignCards` eski kartı panelden sökmüyor, yenisini göndermiyor | ✅ `scheduleEmployeeCardChange` (`convex/employeeImport.ts:121`) |
| E2 | Excel parser biçimsiz sayı hücresinde çöküyor | ✅ `numFmt?.` (`src/lib/employees/parseEmployeesXlsx.ts:20`) |
| E3 | Tek yönlü düzeltme onayı diğer saati siliyor | ✅ `?? existing` (`convex/attendanceCorrections.ts:83`) |
| D1 | E-posta debounce olaya bakıyor, gönderime değil | ✅ `alarmNotifiedAt` (`convex/lib/alarmNotify.ts:44`); test kapsamı teyit edilmedi |
| D2 | Bildirim yalnız bir olay yolunda | ✅ `cardReadings.ts:1526`, `deviceEvents.ts:61,161` |
| D3 | `saveSettings` audit'siz | ✅ `convex/alarms.ts:99` (adres değil sayı) |
| D4 | `summary` tüm projeleri sayıyor | ✅ `projectId` arg (`convex/alarms.ts:48`) |
| D5 | Import, `create` ile aynı tekillik kuralını uygulamıyor | ✅ global kontrol; e-posta normalizasyonu + otomatik sync **[teyit]** |
| D6 | Sınırsız/çakışan bekleyen izin talebi | ✅ ≤10 + çakışma kontrolü (`convex/leaveRequests.ts:30-32`) |
| D7 | `upsertManual` kopyası, vardiya çözümü yok | ✅ ortak `convex/lib/pdksManualWrite.ts` |
| D8 | Çalışan export audit'siz | ✅ `employeeImport.logExport` + T.C. varsayılan kapalı |
| D9 | Şablon zorunlu alanları sunucuyla uyuşmuyor | ✅ `E-posta*`, `Kart No*` |
| N2 | Yerel `escape` | ✅ ortak `escapeHtml` |
| N1, N3–N9 | CSV formül enjeksiyonu, alıcı başına try, `runAfter` hata koruması, tarih normalizasyonu, `acknowledge` sayımı, `listPending` sayfalama (take 200), test boşlukları, `sick` not uyarısı | **açık / teyit edilmedi** |

---

## 10. Açık kararlar ve doğrulanacaklar

### Emre kararı
1. W1 yayını (Convex + web) ne zaman? Yayın tek temiz worktree'den, "yayın onay" ile.
2. W2'ye başlansın mı? (tasarım hazır)
3. Alarm e-postası varsayılan alıcı/önem — şimdilik kapalı, yönetici açar.
4. İzin geri çekme = bekleyen talebi silme (varsayılan, değiştirilebilir; alternatif `withdrawn` durumu).
5. Mobil P8: talep ekranları mobilden mi açılacak — mobil koordinatöre bildirilecek.

### Kodda doğrulanacak **[teyit]**
- Resmi tatilde erişim kuralının davranışı (cihaz tarafı dahil)
- Çalışana giden hatırlatma bildiriminin içeriği (`notificationSettings`)
- Raporlarda firma adı/logosu
- Toplu kapı kontrolü, mobil çok noktalı alan yönetimi
- `/alarms` export ve kategori desteği

### Hik tarafında bilinmeyen
- Export format kodları 0-4 ↔ dosya türü eşlemesi (bir export denemesi gerekir; salt-okuma kapsamı dışı)
- Custom Report oluşturma formunun seçilebilir kolonları
- Export-only 3 raporun gerçek dosya düzeni (yalnız önizleme görüldü)
- Late / Early Leave / Overtime raporlarında 1-17 Ekim'de satır yoktu; satır alanları yalnız kolon tanımından
- Remain Unlocked & Locked sayfası açılmadı; Health Monitoring servisi dolduğu için gerçek sağlık verisi görülmedi
- Kıyas ngsaccess tarafında kod envanterine dayanıyor; canlı ngsaccess arayüzünde gezilmedi

---

## 11. Çalışma yöntemi ve riskler

- **Akış:** Codex worker yazar (`gpt-6.1-sol medium`; W3/W4 tasarımı `gpt-6-astra high`) → Claude denetler (diff + kendi kapı koşumu) → temiz worktree kapısı → commit (pathspec, Emre onayı, `Co-Authored-By` yok).
- **Kapılar:** `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint <dosyalar>` · `npx vitest run`.
- **Worker yasakları:** schema/App.tsx/routeMeta/_generated yazma yok (koordinatör Faz 0'da hazırlar); commit/push/deploy/`npx convex *` yok; yeni cron/polling yok (Convex Free kota); kişi verisi loglanmaz.
- **Yayın:** dalga sonunda tek seferde; Convex `npx convex dev --once` temiz worktree'den (TÜM ağacı yollar, yarım iş canlıya gidebilir); web Netlify CLI ayrı adım.
- **Şema:** opsiyonel alan + yeni tablo (geri uyumlu, migration yok).

| Risk | Önlem |
|---|---|
| Paylaşımlı ağaçta başka oturumlar aynı anda yazıyor | Sahiplik listesi; kapı yalnız kendi dosyalarında; tam ağaç kapısı dalga sonunda koordinatörde |
| Alarm e-postası fırtınası | Aynı cihaz+olay için 10 dk debounce; alıcı ≤8; yeni cron yok |
| İçe aktarma ile toplu cihaz senkron fırtınası | Mutation içinde senkron yok; yönetici açıkça "Cihazlara gönder" der |
| Kişi dosyası KVKK | Dosya saklanmaz/loglanmaz; ücret sütunu yok; export audit'li |
| Düzeltme onayı PDKS hesabını bozar | Ortak `pdksManualWrite` + vardiya çözümü + test |

---

## Ek A — 19 raporun kolon detayı

Biçim: `Görünen ad` (`apiAdı`). ↕ = sıralanabilir, ° = varsayılan gizli. Her raporda ortak 5 kolon: First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕ — aşağıda "ortak5" olarak yazıldı (Department Attendance hariç). Tüm tablo raporlarının cevabında ek olarak `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp` alanları var.

### Kayıtlar
- **Transaction** (id 1, 14 kolon): ortak5, Date (`clockDate`) ↕, Time (`clockTime`), Weekday (`week`), Data Source (`dataSource`), Device Name (`deviceName`), Device Serial No. (`deviceSerial`), Punch State (`handleType`), Location (`location`), Remarks (`remark`). Ek alanlar: `deviceId`, `briefAddress`, `detailAddress`, `longitude`, `latitude`.
- **Mobile Transaction** (id 9, 11 kolon): ortak5, Date (`clockDate`) ↕, Time (`clockTime`), Weekday (`week`), Location (`location`), Attachment (`attachment`), Remarks (`remark`). Ek alanlar: `briefAddress`, `detailAddress`, `longitude`, `latitude`, `id`.
- **Time Card** (id 18, 8 kolon): ortak5, Date (`clockDate`) ↕, Weekday (`week`), Records (`records`).

### Günlük
- **Total Time Card** (id 2, 33 kolon): ortak5, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`), Work Start Time (`checkInTime`), Work End Date (`checkOutDate`), Work End Time (`checkOutTime`), Clock-In Date (`clockInDate`), Clock-In Time (`clockInTime`), Clock-In Source (`clockInSource`), Clock-In Device (`clockInDevice`) °, Clock-In Area (`clockInArea`) °, Clock-Out Date (`clockOutDate`), Clock-Out Time (`clockOutTime`), Clock-Out Source (`clockOutSource`), Clock-Out Device (`clockOutDevice`) °, Clock-Out Area (`clockOutArea`) °, Attendance Status (`attendanceStatus`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`), Late Duration (`lateDuration`), Early Leave Duration (`earlyDuration`), Break Duration (`breakDuration`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Leave Type (`leaveTypes`) °. Ek alanlar: `clockInId`, `clockOutId`, `personId`, `timetableId`.
- **Worked Hrs** (id 3, 16 kolon): ortak5, Date (`date`) ↕, Weekday (`week`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`), Late Duration (`lateDuration`), Early Leave Duration (`earlyDuration`), Break Duration (`breakDuration`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`).
- **First In Last Out** (id 19, 15 kolon): ortak5, Date (`date`) ↕, Weekday (`week`) °, Timetable (`timetableName`), Work Start Date (`checkInDate`) °, Work Start Time (`checkInTime`), Work End Date (`checkOutDate`) °, Work End Time (`checkOutTime`), First Check In (`firstCheckIn`), Last Check Out (`lastCheckOut`), Worked Hours (`workDuration`).
- **Exception Report** (id 7, 17 kolon): ortak5, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date/Time (`checkInDate`, `checkInTime`), Work End Date/Time (`checkOutDate`, `checkOutTime`), Clock-In Date/Time (`clockInDate`, `clockInTime`), Clock-Out Date/Time (`clockOutDate`, `clockOutTime`), Attendance Status (`attendanceStatus`).
- **Late Report** (id 4, 18 kolon): Exception Report'un ilk 16 kolonu (Attendance Status hariç) + Worked Hours (`workDuration`), Late Duration (`lateDuration`).
- **Early Leave Report** (id 5, 18 kolon): aynı + Worked Hours (`workDuration`), Early Leave Duration (`earlyDuration`).
- **Absent Report** (id 6, 18 kolon): aynı + Worked Hours (`workDuration`), Absent Duration (`absenceDuration`).
- **Overtime Report** (id 8, 9 kolon): ortak5, Date (`date`) ↕, Weekday (`week`), Workday Overtime Duration (`workdayOvertimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`).
- **Break Report** (id 17, 14 kolon): ortak5, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`) °, Work Start Time (`checkInTime`) °, Work End Date (`checkOutDate`) °, Work End Time (`checkOutTime`) °, Break-Period Records (`breakRecords`), Break Duration (`breakDuration`). Ek alanlar: `personId`, `timetableId`.

### Aylık
- **Monthly Status** (id 12, 12 kolon): ortak5, dateRange (`dateRange`), Normal (`normalTimes`), Absent (`absenceTimes`), Late (`lateTimes`), Early Leave (`earlyTimes`), Late and Early Leave (`lateAndEarlyTimes`), Leave (`leaveTimes`).
- **Monthly Worked Hrs** (id 11, 15 kolon): ortak5, dateRange (`dateRange`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`), Late Duration (`lateDuration`), Early Leave Duration (`earlyDuration`), Break Duration (`breakDuration`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`).
- **Person Attendance** (id 13, 18 kolon): ortak5, dateRange (`dateRange`), Due (`requiredCheckInTimes`), Actual (`actualCheckInTimes`), Normal (`normalTimes`), Absent (`absenceTimes`), Late (`lateTimes`), Early Leave (`earlyTimes`), Late and Early Leave (`lateAndEarlyTimes`), Leave (`leaveTimes`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`).
- **Department Attendance** (id 14, 14 kolon): Department (`fullPath`) ↕, Number (`personNum`), Due (`requiredCheckInTimes`), Actual (`actualCheckInTimes`), Normal (`normalTimes`), Absent (`absenceTimes`), Late (`lateTimes`), Early Leave (`earlyTimes`), Late and Early Leave (`lateAndEarlyTimes`), Leave (`leaveTimes`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`).
- **Attendance Overview / Status / Summary** (id 15 / 16 / 10): kolon tanımı yok, export-only (§4.5).

## Ek B — Ham veri dosyaları

| Dosya | İçerik |
|---|---|
| [hikconnect-reports/report-definitions.json](hikconnect-reports/report-definitions.json) | 19 raporun tam tanımı (`ability/v1/report/list` cevabı, kişisel veri yok) |
| [hikconnect-reports/menu.json](hikconnect-reports/menu.json) | Rapor menü ağacı |
| [hikconnect-reports/list-samples.json](hikconnect-reports/list-samples.json) | Rapor başına `report/v1/list` isteği + cevap alan tipleri (değer yok) |
| [hikconnect-reports/daily-row-samples.json](hikconnect-reports/daily-row-samples.json) | Günlük raporların satır alanları + kişisel olmayan örnek değerler (maskeli) |
| `hikconnect-reports/shots/*.png`, `hikconnect-audit/shots/*.png` | Ekran görüntüleri — **gitignore'lu** (gerçek personel adları) |
