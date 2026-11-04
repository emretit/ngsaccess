Güncelleme 2026-11-03: genel audit sonrası 40 satır düzeltildi (docs/genel-audit-2026-11-03/)

# Hik-Connect ↔ ngsaccess Karşılaştırma

> **Tarih:** 2026-10-19 · **Girdi:** [HIKCONNECT_SAYFALAR.md](HIKCONNECT_SAYFALAR.md) (canlı portal) + [NGSACCESS_ENVANTER.md](NGSACCESS_ENVANTER.md) (kod envanteri, 29 route) + schema/kod taraması.
>
> **Güncelleme 2026-10-25:** §9 önceliklerinin 1-5 ve 7'si yapıldı; satırlar kanıt commit'iyle güncellendi. **2FA yapılmayacak** (Emre kararı 2026-10-26, §7).
>
> **Güncelleme 2026-10-26:** biyometrik okutmalar (parmak izi/yüz) artık PDKS'ye giriyor (`6a7950bb`, Emre kararı); KVKK modülünde imha/saklama/rıza araçları duruyor. PDKS ayrıntısı: [PDKS_KIYAS.md](PDKS_KIYAS.md).
>
> **Durum etiketleri:** ✅ var · 🟡 kısmi · ❌ yok · ➕ bizde daha iyi. **[teyit]** = envanterde net görünmedi, koda bakılmalı.

## 1. Özet

- **Çekirdek (kişi, kapı, erişim kuralı, vardiya, PDKS, rapor) bizde var ve çoğu yerde Hik'ten ileride**: Türk mevzuatı (SGK APHB, fazla mesai çarpanı, yıllık limit, 10 izin türü), KVKK modülü (biyometrik imha/saklama, rıza), proje bazlı çoklu kiracı, ziyaretçi KVKK aydınlatması.
- **2026-11-03 audit:** alarm, kişi toplu işlemleri/ayrılma ve yetki dağıtımı kısmi; bağımsız erişim şablonu kaldırılmış. Başvuru-onay mevcut, ek/bildirim eksikleri var; dondurma/bitiş backend’de var. Ayrıntı ve kanıtlar aşağıdaki tablolarda.
- **İlk tespit — Hik'te olup bizde olmayan 5 ana alan:** (1) alarm merkezi + alarm kuralları, (2) izin/düzeltme *başvuru-onay akışı*, (3) kişi toplu işlemleri (Excel içe/dışa aktarma, toplu kart, ID kuralı, ayrılma akışı), (4) yeniden kullanılabilir erişim zaman şablonu + kişi bazlı yetki dağıtım durumu, (5) hesap güvenliği (2FA, kullanıcı dondurma/son kullanma, özel rol).
- **Gereksiz/alakasız bulunanlar:** harita, captive portal, video kayıt şablonu, konut yönetimi, AD eşitleme, lisans/servis pazarı.

## 2. Access Control

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Canlı kapı + uzaktan aç + Batch Control | `/live-monitoring` geçiş akışı, `/devices` tek kapı kumandası | 🟡 | Tek kapı açma var; toplu aç/kilitle yok, toplu araç yalnız siler. `src/components/devices/DeviceActionsSection.tsx:114`; `src/components/devices/DeviceBulkActions.tsx:3`. |
| Manage Access Level (kapı + zaman şablonu) | `/access-control` erişim kuralları (kişi/departman kapsamı, kapı/bölge, gün-saat) | ➕ | Bizde kural tek yerde kişi+kapı+zaman; cihaz senkron çalıştırmaları (`deviceSyncRuns`) izlenir |
| Grant by Department / by Person | Kuralda mevcut kişi/departman ağacından toplu seçim | ✅ | Yeni departman üyesi kendiliğinden kurala eklenmez. `src/components/access-control/unified/hooks/useRuleForm.ts:175`. |
| Overview: kişi başına **efektif yetki dağıtım durumu** (Invalid/Effective/Not Granted) | Kişi/cihaz bazında Etkin/Bekliyor/Hata/Kaldırıldı/Bilinmiyor ve yeniden gönderim | 🟡 | Cihaz kapsamı GK-09 nedeniyle eksik; Etkin cihaz yanıtıdır, fiziksel geçiş garantisi değildir. `convex/accessGrantStatus.ts:121`; `src/components/access-control/unified/status/StatusPage.tsx:83`. |
| Access Schedule Template (haftalık 7×24, yeniden kullanılabilir) | Kuralda gün/saat; ayrı Kapı Planları sekmesi | ❌ | Bağımsız erişim zaman şablonu `cbfbeccf` ile kaldırıldı; kapı durum planı farklıdır. `src/components/access-control/unified/UnifiedAccessControl.tsx:63`; `src/components/access-control/unified/hooks/useRuleForm.ts:25`. |
| Holiday Settings (AC) | Türkiye tatilleri; desteklenen Hik gateway kapısında tatil planı | 🟡 | Kişi erişim kuralı tatil tablosuna bağlı değil; kapı planı tam gün uygular, yarım gün taşımaz. IDE/mobil eşdeğeri yok; GK-03 güncellik riski. `convex/lib/ruleSchedule.ts:13`; `convex/doors.ts:727`; `convex/lib/gatewayCommand.ts:780`. |
| Temporary Pass (PIN/QR, izin verilen geçiş sayısı) | `/visitors` (kart, geçerlilik, KVKK rızası, kartı bırak) | 🟡 | PIN/QR ile tek kullanımlık geçiş yok; ziyaretçi fiziksel kartla çalışıyor |
| Access Record Retrieval (cihaz/grup/kişi/geçici filtre, Export, Import Events) | Geçiş arama/rapor + gateway cihazından geçmiş olay aktarımı | 🟡 | Tarih/kişi/cihaz/sonuç/kaynak araması var; kapı ve arama kapsamı GK-05/08 ile sınırlı. Son 24 saat/tarih aralığı/tüm geçmiş aktarımı var, CIH-04/05 nedeniyle eksiksizlik garantisi yok. `convex/cardReadings.ts:173`; `src/components/devices/DeviceHistoryImportCard.tsx:60`; `convex/lib/gatewayBackfill.ts:250`. |
| Device Recorded Data (cihaz olayları: kurcalama, çevrimdışı) | Alarm merkezi (`deviceEvents` listesi, filtre, onay) | ✅ | `ce7e7889` |
| Remain Unlocked / Remain Locked (kapı modu zamanlaması) | Desteklenen Hik gateway kapısında haftalık durum ve tatil planı | ✅ | Günde ≤8 aralık, normal/sürekli açık/sürekli kilitli ve toplu plan kopyalama var; IDE/localBridge kapsam dışı. Hik ekranı belirsizliği korunur. `src/components/access-control/door-plans/DoorPlansTab.tsx:69`; `convex/lib/doorStatusPlan.ts:18`; `convex/lib/gatewayCommand.ts:708`. |
| Event Notification (237+28+74 olay türü aç/kapa) | — | ❌ | Bkz. Alarm |
| Super Access (Remain Locked'u aşma), Extended Access, Device Administrator bayrakları | Kapı açık süresi cihaz parametresi var, kişi bayrakları yok | ❌ | Küçük iş: kişi başına bayrak + cihaza yazma |

## 3. Attendance (PDKS)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Schedule (kişi×gün ızgara, Export, Clear) | PDKS › Vardiya planı (takvim, toplu atama önizleme, düzenle/sil) + toplu temizle/dışa aktar | ✅ | `48419e7f`, `e0205881` |
| Timetable: Normal / **Flexible** vardiya, cross-day, mola, geçerli giriş/çıkış penceresi | Sabit/esnek, gece ve geçerli pencere; renk artık kullanılmıyor | 🟡 | Eski renk girdisi yok sayılıyor; çoklu mola yok. `convex/shifts.ts:499`; `convex/shifts.ts:522`; `convex/lib/pdksFixedRules.ts:26`. |
| Leave başvuru + **Approve/Reject/Withdraw** + ek dosya + Auto Approve + onay akışı | Talep → yönetici onay kuyruğu (web + mobil) | 🟡 | `c23926dc`; **ek dosya ve otomatik onay yok** |
| Attendance Correction başvurusu + onay | Çalışan talebi + yönetici kuyruğu | ✅ | `c23926dc` |
| Supervisor rolü (departman başvurularını onaylar) | 5 sabit proje rolü; proje genelinde `attendance.approve` | ❌ | Departman kapsamlı onaycı yok; sabit rol tasarımı ürün kararıdır. `convex/lib/roleCatalog.ts:8`; `convex/leaveRequests.ts:86`; `convex/attendanceCorrections.ts:87`. |
| General: Weekend | Hafta tatili tarihli vardiya planından | ✅ | Haftalık planda seçilmeyen gün hafta tatili; eski Çalışma günleri ayarı kaldırıldı (audit anında commit’siz paket). `convex/lib/shiftPlan.ts:35`; `src/components/pdks/settings/PdksSettingsPanel.tsx:17`. |
| General: Overtime | `overtimeRates` (çarpan, hafta sonu çarpanı), yıllık limit, tolerans, SGK çıktısı | ➕ | |
| General: Attendance Rule (giriş/çıkış zorunlu, varsayılan geçerli pencere) | requireCheckIn/Out + vardiyada geçerli pencere | ✅ | `8f57a2d9` |
| General: Notifications (giriş hatırlatma, giriş bildirimi) | Yöneticiye geç kalma e-postası | 🟡 | Çalışana giriş hatırlatması ve talep onay/red bildirimi yok; PDK-013 geç bildirim riski. `convex/lib/processCardReadingCore.ts:508`; `convex/leaveRequests.ts:192`; `convex/attendanceCorrections.ts:99`. |
| Attendance Check Point (hangi cihazlar sayılsın) | PDKS noktaları + nokta tipi (okuyucu bazında) | ✅ | `6e69b6fb` |
| Mobil check-in + alan (geofence) yönetimi | Fiziksel okuyucuda tüketilen kişisel QR | 🟡 | Eski doğrudan token+konum kaydı `READER_REQUIRED` döner; geofence, fotoğraf zorunluluğu ve kişi izin listesi yok. `convex/employeeCheckIn.ts:9`; `convex/employeeCheckIn.ts:55`; `convex/cardReadings.ts:562`. |
| Holiday | `holidays` + Türkiye tatilleri seed | ➕ | |
| Leave Type (kullanıcı tanımlı) | Sabit 10 tür (yıllık, hastalık, mazeret, ücretsiz, doğum, evlilik, ölüm, babalık, süt, telafi) | 🟡 | Özel tür eklenemez; TR mevzuatı için bilinçli seçim olabilir |
| Report (işletme adı/logo/format) | Genel raporda proje adı; APHB’de ayarlardaki işveren adı | 🟡 | Genel logo ve seçilebilir tarih/saat/süre formatı bağlı değil. `src/lib/reports/export.ts:73`; `src/lib/reports/excel/common.ts:44`; `convex/sgkExport.ts:145`. |
| Custom Export (alan seçici, TXT şablon) | PDKS dışa aktarmada sütun seçici | 🟡 | `965d0fa7`; TXT şablonu yok |
| Scheduled Report (günlük/haftalık/aylık e-posta) | Kullanıcı+proje başına tek adrese aylık hatırlatma | 🟡 | Ayın 1’i 12:00 TR; dosya eki, günlük/haftalık seçim, saat, çoklu alıcı ve 19 rapor seçimi yok. `convex/reports.ts:369`; `convex/actions/sendScheduledReports.ts:33`; `convex/crons.ts:7`. |
| 19 rapor | 19 Hik başlığına karşılık 18 tanım; iki başlık aynı `aylik-durum` | 🟡 | Kolon/filtre eşliği kısmi; Excel/PDF/CSV var, TXT/ayrı yazdır yok. Üç export-only karşılığı ekranda da var (➕). `src/lib/reports/registry.ts:94`; `src/lib/reports/export.ts:112`; [eşleme](../hikconnect-reports/README.md). |

## 4. Kişi (Person)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Departman ağacı + liste + filtre | `/employees` ağaç, arama, durum/pozisyon/şirket filtresi | 🟡 | Departman seçimi yalnız doğrudan bağlı kişileri getirir; alt departmanları dahil et yok. `src/pages/Employees.tsx:170`; `src/components/employees/lib/employeeList.ts:43`. |
| Import / Export (Excel) | Kişiler Excel şablon / içe / dışa aktarma | ✅ | `ce7e7889` |
| Adjust Department (toplu) | Toplu departman atama | 🟡 | İşlem var; audit anında ziyaretçi ayrımı KIS-001 (P2) ve kapsam KIS-004 açık. `convex/employees.ts:507`; `src/components/employees/EmployeeBulkActions.tsx:80`. |
| **Batch Issue Cards to Persons** | Elle/yapıştırma/okuyucudan toplu kart atama | 🟡 | Yeni kişi/Excel akışı kartı baştan zorunlu tutuyor (KIS-007). `src/components/employees/import/BatchCardAssignDialog.tsx:18`; `convex/employeeImport.ts:120`. |
| Person ID Rule (otomatik ID üretimi) | — | ❌ | Düşük/orta |
| Kimlik bilgisi: yüz, kart, parmak izi, Bluetooth, PIN | Kart + merkezi şifreli parmak izi; profil fotoğrafı ayrı | 🟡 | Kullanıcıya açık yeni yüz kayıt yolu bulunmadı; eski yüz okuma/dağıtma/imha var. PIN/Bluetooth yok; biyometrik okutma PDKS’ye girer. `src/components/employees/EmployeeDetails.tsx:108`; `convex/employeeFaces.ts:13`; `src/components/employees/hooks/usePhotoUpload.ts:10`. |
| Custom Attributes (özel alan) | — | ❌ | Düşük |
| Self-Registration (QR) + Registration Audit (onay kuyruğu) | Davet ile hesap kurulumu (`invites`) | 🟡 | QR ile kendi kaydı + onay kuyruğu yok |
| **Resign** (ayrılış tarihi, tipi, nedeni, Reinstate, Disable Attendance) | Temel ayrılma/geri alma ve bitişe bağlı erişim kapanışı | 🟡 | Ayrılış türleri sabit; ayrı devam kapatma/tür yönetimi yok. Excel’de ayrılış tarih/tip/neden kolonları yok. `convex/employeeTermination.ts:50`; `convex/employeeTermination.ts:95`; `src/lib/employees/exportEmployeesXlsx.ts:11`. |
| Vehicle (plaka + geçerlilik) | — | ❌ | Düşük |
| Kişi başına Temporary Pass yetkisi | — | ❌ | Düşük |
| Attendance rolü + vardiya önizleme (kişi formunda) | Vardiya ayrı sayfada | 🟡 | |

## 5. Alarm ve Bakım

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Alarm Center (son alarmlar, ses/pop-up, Acknowledge) | `/alarms`: liste, filtre, toplu onay (`alarms.ack`) | 🟡 | Ses/pop-up yok. `src/pages/Alarms.tsx:105`; `src/pages/Alarms.tsx:117`; `convex/alarms.ts:67`. |
| Alarm kuralları (kapı zorlandı, okuyucu/cihaz kurcalandı, çevrimdışı) + öncelik + bildirim (App, e-posta) | Proje alıcıları/önem eşiği, e-posta test/sonuç/tekrar | 🟡 | Kaynak/olay bazlı kural düzenleyici ve App push yok; sabit önem ALM-002 riski. `convex/alarms.ts:103`; `convex/lib/hikEventCatalog.ts:169`; `convex/actions/sendAlarmEmail.ts:8`. |
| Alarm Search / Export, alarm kategorisi (yanlış alarm) | Alarm merkezinde tarih/cihaz/önem/durum arama | 🟡 | Kural/grup/bildirim filtresi, arşiv, Excel ve yanlış alarm kategorisi yok. `src/components/alarms/AlarmFilters.tsx:20`; `src/pages/Alarms.tsx:117`. |
| Receiving Schedule, Email Linkage Template | — | ❌ | |
| Health Status (firmware, kurcalama, çevrimdışı süre/sayı, istisna filtresi) | Anlık cihaz sağlığı + backend bağlantı geçmişi | 🟡 | 1–30 gün/en çok 500 dönem için süre/sayı var; `getConnectivityHistory` web tüketicisi ve kapsamlı sağlık raporu/export yok. `convex/deviceEvents.ts:180`; `convex/lib/deviceConnection.ts:55`; `src/components/dashboard/DeviceHealth.tsx:17`. |
| Planlı cihaz sağlık raporu (Device Report) | Anlık dashboard ve bağlantı geçmişi | ❌ | Cihaz sağlığına özel zamanlı rapor yok. `convex/deviceEvents.ts:180`; `src/components/dashboard/DeviceHealth.tsx:17`. |
| Firmware Upgrade (liste/zamanlı) | — | ❌ | Yalnız kapabilite snapshot'ı; Hik'te de bu hesapta servis dolmuş |
| Operation Log | `/audit-log`: filtreli ve maskelenmiş Excel | 🟡 | 10.000 sonuç sınırı uyarılı; kritik işlem kapsamı ALM-003/004/005 nedeniyle eksik. `convex/auditLog.ts:77`; `src/pages/AuditLog.tsx:31`; `src/components/audit/AuditExportButton.tsx:20`. |
| Device Log | `deviceEvents`; alarm/istisna alt kümesi webde | 🟡 | Tam log türü/kullanıcı/kanal/IP araması için ayrı cihaz günlüğü ekranı yok. `convex/deviceEvents.ts:26`; `convex/deviceEvents.ts:63`; `src/pages/Alarms.tsx:105`. |
| User Login Report | — | ❌ | Düşük |
| Map | — | ❌ | Alakasız (tek kapılı kurulum) |

## 6. Cihaz

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Cihaz listesi (durum, sürüm, kapı sayısı, grup) | `/devices` bölge→kapı→cihaz hiyerarşisi, claim/serbest bırak, QR, çoklu marka (Hik, IDE Smart) | ➕ | |
| Add: **SADP LAN tarama** | Hik gateway’e elle kayıt; eski localBridge kaydı salt okunur | ❌ | Hik SADP keşfi/aktivasyonu yok; IDE subnet taraması eşdeğer değil, Windows roster sözleşmesi kopuk. `src/components/devices/form-sections/DeviceHikvisionSection.tsx:49`; `bridge/windows/NgAccess.HikvisionBridge/Services/ConvexBridgeClient.cs:51`; `convex/http.ts:473`. |
| Add: seri no / toplu içe aktarma | Seri no/UUID ile kayıt; toplu içe aktarma yok | 🟡 | |
| Captive Portal, Record Template, House | — | ❌ | Alakasız |

## 7. Ekip ve güvenlik

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Users (rol, durum, **son kullanma**, Freeze/Unfreeze, Import/Export) | Backend dondurma/bitiş; global admin arama/sayfalama | 🟡 | Proje admin UI’sında dondurma/bitiş yok (HSP-06); kullanıcı Import/Export ve giriş/bağlantı durumu sütunları yok. `convex/accountAccess.ts:9`; `convex/roles.ts:159`; `src/components/admin/ProjectMembersContent.tsx:30`. |
| Roles (özel rol, geçerlilik aralığı) | Proje bazlı 5 sabit rol × 13 düzenlenebilir yetki | ✅ | Karar kapsamı tamam; özel rol eksik sayılmaz. Hik rol geçerlilik aralığı ayrı özellik; bizde hesap bitişi var. `convex/lib/roleCatalog.ts:8`; `convex/lib/roleCatalog.ts:11`; `convex/roles.ts:101`. |
| Account Security: **2FA (e-posta)** | E-posta doğrulama (kayıt) var, giriş 2FA yok | ❌ | Yapılmayacak (Emre kararı 2026-10-26) |
| Email Setting (SMTP) | `mailSettings` | ✅ | |
| Team Configuration: saat dilimi, GDPR saklama süresi | Sabit Türkçe/Europe/Istanbul; kart/ziyaretçi saklama, biyometrik imha/rıza | ➕ | Seçilebilir saat dilimi yok (ürün kararı); Hik yüz fotoğrafını 24 saatte silme seçeneğiyle birebir eşdeğer değil. `src/components/settings/sections/general/SystemSettingsForm.tsx:9`; `convex/privacyRetention.ts:30`; `convex/privacyBiometric.ts:32`. |
| Ekip adı/telefon, Disband Team | Firma adı/telefon, ayrı proje adı; silmede etki önizlemesi/bağlı veri engeli | 🟡 | Müşteri projesini silme UI’sı global admin alanında. `convex/settings.ts:45`; `convex/projects.ts:109`; `src/components/admin/projects/ProjectDeletion.tsx:28`. |
| Arşiv genel bakış/arama/ayar | Saklama süresi sonunda silme | ❌ | Ayrı salt okunur arşiv/geri arama ekranı yok; Hik ayrıntılı davranışı belirsiz. `src/App.tsx:70`; `convex/privacyRetention.ts:94`. |
| Account Sync (AD), API Integration | — | ❌ | Düşük |
| Service / Lisans | — | ❌ | Alakasız |

## 8. Bizde olup Hik-Connect'te olmayanlar

- SGK APHB çıktısı, bordro sayfası, fazla mesai çarpanları ve yıllık limit, 10 TR izin türü ve bakiye (`leaveBalances`).
- KVKK: biyometrik imha akışı, çalışan rızası, ziyaretçi aydınlatma metni, kart okuma saklama süresi.
- Çoklu proje/kiracı (`projects`, `userProjects`), proje bazlı yetki.
- PDKS önayar/uyarıları: tekrarlayan geç kalanlar, yıllık mesai ve mola; ana sayfada bugün özeti/son okumalar/cihaz sağlığı var. `src/pages/Index.tsx:24`; `src/components/pdks/dashboard/PDKSSmartPresets.tsx:43`; `src/components/pdks/dashboard/PDKSOvertimeAlert.tsx:16`.
- Çoklu marka (Hik + IDE Smart panel), cihaz senkron çalıştırması izleme.
- Kayıtlı görünümler, PDKS ısı haritası/grafik görünümleri, çalışan detay çekmecesi.

## 9. Öncelik önerisi

**Önce (en yüksek değer / en düşük maliyet):**
1. ✅ **Alarm merkezi (v1)** (`ce7e7889`): `deviceEvents` içindeki alarm/kurcalama/çevrimdışı olaylarını listele + öncelik + "onaylandı" durumu + yönetici e-postası. Veri ve e-posta altyapısı hazır.
2. 🟡 **Kişi Excel içe/dışa aktarma mevcut; toplu kart kısmi:** yeni kişi akışı kartı baştan zorunlu tutuyor (KIS-007). `src/components/employees/import/BatchCardAssignDialog.tsx:18`; `convex/employeeImport.ts:120`.
3. ✅ **İzin ve düzeltme başvuru-onay akışı** (`c23926dc`; ek dosya/otomatik onay kalan): çalışan talebi → yönetici onayı/red, geri çekme, ek dosya. Çalışan self-servis (check-in sayfası/mobil) ile birlikte anlam kazanır.

**Sonra:**
4. ❌ Bağımsız zaman şablonu kaldırıldı (`cbfbeccf`); 🟡 Overview kapsamı eksik. `src/components/access-control/unified/UnifiedAccessControl.tsx:63`; `convex/accessGrantStatus.ts:121`.
5. 🟡 Temel ayrılma/geri alma var; tür yönetimi ve ayrılış tarih/tip/neden Excel kolonları yok. `convex/employeeTermination.ts:50`; `src/lib/employees/exportEmployeesXlsx.ts:11`.
6. 🟡 Kullanıcı dondurma/son kullanma backend’de var, proje admin UI’sında yok (HSP-06); 2FA yapılmayacak. `convex/accountAccess.ts:9`; `src/components/admin/ProjectMembersContent.tsx:30`.
7. ✅ Esnek vardiya, Attendance Rule, Custom Export (sütun seçici `965d0fa7`) + vardiya Faz 1-4 (`8f57a2d9`, `26e5570b`).

**Yapılmaz / ertelenir:** harita, captive portal, video kayıt şablonu, konut, AD eşitleme, firmware yükseltme, araç plakası, özel kişi alanları.

## 10. Doğrulanması gerekenler

- 2026-11-03 kod audit’i kapı modu, Attendance Rule, nokta eşleme, mobil QR ve bildirim kapsamını yukarıda netleştirdi; gerçek cihaz okuyucu numarası ve fiziksel dağıtım/silme davranışı için saha teyidi hâlâ gerekli.
- Remain Unlocked & Locked sayfası Hik'te açılamadı; işlev varsayımı doğrulanmadı.
- Hik'te Health Monitoring servisi dolduğu için sağlık sayfası boş; alan düzeni görüldü, gerçek veri görülmedi.
- Kıyas, ngsaccess tarafında kod envanterine dayanıyor; canlı ngsaccess arayüzünde gezilmedi.
