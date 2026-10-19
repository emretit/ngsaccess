# Hik-Connect ↔ ngsaccess Karşılaştırma

> **Tarih:** 2026-10-19 · **Girdi:** [HIKCONNECT_SAYFALAR.md](HIKCONNECT_SAYFALAR.md) (canlı portal) + [NGSACCESS_ENVANTER.md](NGSACCESS_ENVANTER.md) (kod envanteri, 29 route) + schema/kod taraması.
>
> **Durum etiketleri:** ✅ var · 🟡 kısmi · ❌ yok · ➕ bizde daha iyi. **[teyit]** = envanterde net görünmedi, koda bakılmalı.

## 1. Özet

- **Çekirdek (kişi, kapı, erişim kuralı, vardiya, PDKS, rapor) bizde var ve çoğu yerde Hik'ten ileride**: Türk mevzuatı (SGK APHB, fazla mesai çarpanı, yıllık limit, 10 izin türü), KVKK modülü (biyometrik yasak/imha, rıza), proje bazlı çoklu kiracı, ziyaretçi KVKK aydınlatması.
- **Hik'te olup bizde olmayan 5 ana alan:** (1) alarm merkezi + alarm kuralları, (2) izin/düzeltme *başvuru-onay akışı*, (3) kişi toplu işlemleri (Excel içe/dışa aktarma, toplu kart, ID kuralı, ayrılma akışı), (4) yeniden kullanılabilir erişim zaman şablonu + kişi bazlı yetki dağıtım durumu, (5) hesap güvenliği (2FA, kullanıcı dondurma/son kullanma, özel rol).
- **Gereksiz/alakasız bulunanlar:** harita, captive portal, video kayıt şablonu, konut yönetimi, AD eşitleme, lisans/servis pazarı.

## 2. Access Control

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Canlı kapı + uzaktan aç + Batch Control | `/live-monitoring`, `/devices` (kapı işlemleri), web kapı açma canlı | ✅ | Toplu kapı kontrolü **[teyit]** |
| Manage Access Level (kapı + zaman şablonu) | `/access-control` erişim kuralları (kişi/departman kapsamı, kapı/bölge, gün-saat) | ➕ | Bizde kural tek yerde kişi+kapı+zaman; cihaz senkron çalıştırmaları (`deviceSyncRuns`) izlenir |
| Grant by Department / by Person | Kuralın kapsamı olarak departman/kişi seçimi | ✅ | |
| Overview: kişi başına **efektif yetki dağıtım durumu** (Invalid/Effective/Not Granted) | Senkron çalıştırma listesi var; kişi×kapı efektif yetki tablosu yok | 🟡 | `debugIde:panelRosterDiff` iç araç, UI değil |
| Access Schedule Template (haftalık 7×24, yeniden kullanılabilir) | Kural içinde gün-saat; ayrı şablon tablosu yok | 🟡 | Aynı çizelgeyi birden çok kurala bağlamak için şablon gerekir |
| Holiday Settings (AC) | `holidays` (Ayarlar, Türkiye tatilleri otomatik) | ✅ | Erişim kurallarının tatil takvimine bağlı olup olmadığı **[teyit]** |
| Temporary Pass (PIN/QR, izin verilen geçiş sayısı) | `/visitors` (kart, geçerlilik, KVKK rızası, kartı bırak) | 🟡 | PIN/QR ile tek kullanımlık geçiş yok; ziyaretçi fiziksel kartla çalışıyor |
| Access Record Retrieval (cihaz/grup/kişi/geçici filtre, Export, Import Events) | `/live-monitoring` + `/reports` işlem raporu (kişi/cihaz/kapı/sonuç filtresi) | 🟡 | Rapor dışa aktarma var; olay içe aktarma yok |
| Device Recorded Data (cihaz olayları: kurcalama, çevrimdışı) | `deviceEvents` tablosu veriyi saklıyor (alarm/exception/operation) | 🟡 | **Veri var, UI yok** |
| Remain Unlocked / Remain Locked (kapı modu zamanlaması) | Gateway adaptöründe kapı modu referansı var; UI/zamanlama yok | ❌ **[teyit]** | Sayfa Hik'te açılamadı, işlev beklentisi belirsiz |
| Event Notification (237+28+74 olay türü aç/kapa) | — | ❌ | Bkz. Alarm |
| Super Access (Remain Locked'u aşma), Extended Access, Device Administrator bayrakları | Kapı açık süresi cihaz parametresi var, kişi bayrakları yok | ❌ | Küçük iş: kişi başına bayrak + cihaza yazma |

## 3. Attendance (PDKS)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Schedule (kişi×gün ızgara, Export, Clear) | `/shifts` takvim, toplu atama önizleme, atama düzenle/sil | ✅ | "Clear Schedules" toplu temizleme ve dışa aktarma yok **[teyit]** |
| Timetable: Normal / **Flexible** vardiya, cross-day, mola, geçerli giriş/çıkış penceresi | Vardiya tanımı (saatler) + mola ihlali raporu | 🟡 | **Esnek vardiya tipi (saat serbest, süre sabit) kodda yok**; gece vardiyası/mola desteği **[teyit]** |
| Leave başvuru + **Approve/Reject/Withdraw** + ek dosya + Auto Approve + onay akışı | `/leaves`: izin ekle/düzenle, durum + `approvedBy` alanı var | 🟡 | Talep→onay kuyruğu, geri çekme, ek dosya yok; yönetici doğrudan işliyor |
| Attendance Correction başvurusu + onay | `pdksRecords.upsertManual` (yönetici doğrudan düzeltir, denetim kaydı) | 🟡 | Çalışan talebi + onay yok |
| Supervisor rolü (departman başvurularını onaylar) | Roller: super_admin / project_admin / project_user | ❌ | Departman bazlı onaycı kavramı yok |
| General: Weekend | `workSettings` hafta sonu | ✅ | |
| General: Overtime | `overtimeRates` (çarpan, hafta sonu çarpanı), yıllık limit, tolerans, SGK çıktısı | ➕ | |
| General: Attendance Rule (giriş/çıkış zorunlu, varsayılan geçerli pencere) | — | ❌ **[teyit]** | Okutma eksikliği kuralları `pdksCalc` içinde sabit olabilir |
| General: Notifications (giriş hatırlatma, giriş bildirimi) | `notificationSettings` tablosu | 🟡 | Çalışana push/e-posta hatırlatması içeriği **[teyit]** |
| Attendance Check Point (hangi cihazlar sayılsın) | — | ❌ **[teyit]** | Tüm okuyucuların sayıldığı varsayılıyor |
| Mobil check-in + alan (geofence) yönetimi | `/check-in` token + konum (`employeeCheckIn`) | ✅ | Alan (çok noktalı) yönetim ekranı ve kişi bazlı mobil yetki listesi yok **[teyit]** |
| Holiday | `holidays` + Türkiye tatilleri seed | ➕ | |
| Leave Type (kullanıcı tanımlı) | Sabit 10 tür (yıllık, hastalık, mazeret, ücretsiz, doğum, evlilik, ölüm, babalık, süt, telafi) | 🟡 | Özel tür eklenemez; TR mevzuatı için bilinçli seçim olabilir |
| Report (işletme adı/logo/format) | `companies`, genel ayarlar | 🟡 **[teyit]** | |
| Custom Export (alan seçici, TXT şablon) | Rapor dışa aktarma sabit kolonlar; SGK/bordro çıktısı | ❌ | Özel kolon seçimi yok |
| Scheduled Report (günlük/haftalık/aylık e-posta) | `reportScheduleSettings` + cron | ✅ | |
| 19 rapor | `/reports` 16 rapor | ✅ | Bkz. [../hikconnect-reports/README.md](../hikconnect-reports/README.md) |

## 4. Kişi (Person)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Departman ağacı + liste + filtre | `/employees` ağaç + tablo + arama | ✅ | |
| Import / Export (Excel) | Kişiler sayfasında yok (PDKS CSV içe aktarma ayrı) | ❌ | **Yüksek değer**: ilk kurulumda toplu kişi yükleme |
| Adjust Department (toplu) | `bulkUpdateDepartment` | ✅ | |
| **Batch Issue Cards to Persons** | — | ❌ | Toplu kart atama/okutarak kart tanımlama |
| Person ID Rule (otomatik ID üretimi) | — | ❌ | Düşük/orta |
| Kimlik bilgisi: yüz, kart, parmak izi, Bluetooth, PIN | kart no + yüz + parmak izi (KVKK ile kısıtlı) | 🟡 | PIN/Bluetooth yok; **biyometri PDKS'te KVKK gereği kapalı** |
| Custom Attributes (özel alan) | — | ❌ | Düşük |
| Self-Registration (QR) + Registration Audit (onay kuyruğu) | Davet ile hesap kurulumu (`invites`) | 🟡 | QR ile kendi kaydı + onay kuyruğu yok |
| **Resign** (ayrılış tarihi, tipi, nedeni, Reinstate, Disable Attendance) | `isActive` bayrağı + zamanlı erişim iptali (cron) | 🟡 | Ayrılış tarihi/tipi/nedeni ve geri alma kaydı yok; SGK çıkış bildirimiyle ilişkilendirilebilir |
| Vehicle (plaka + geçerlilik) | — | ❌ | Düşük |
| Kişi başına Temporary Pass yetkisi | — | ❌ | Düşük |
| Attendance rolü + vardiya önizleme (kişi formunda) | Vardiya ayrı sayfada | 🟡 | |

## 5. Alarm ve Bakım

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Alarm Center (son alarmlar, ses/pop-up, Acknowledge) | — | ❌ | `deviceEvents` verisi var, görüntüleme/onaylama yok |
| Alarm kuralları (kapı zorlandı, okuyucu/cihaz kurcalandı, çevrimdışı) + öncelik + bildirim (App, e-posta) | — | ❌ | **Yüksek değer**, düşük maliyet: veri zaten geliyor |
| Alarm Search / Export, alarm kategorisi (yanlış alarm) | — | ❌ | Alarm merkezinin devamı |
| Receiving Schedule, Email Linkage Template | — | ❌ | |
| Health Status (firmware, kurcalama, çevrimdışı süre/sayı, istisna filtresi) | Dashboard "cihaz sağlığı" + cihaz çevrimiçi/son görülme | 🟡 | Çevrimdışı süre/sayı geçmişi ve rapor yok |
| Firmware Upgrade (liste/zamanlı) | — | ❌ | Yalnız kapabilite snapshot'ı; Hik'te de bu hesapta servis dolmuş |
| Operation Log | `/audit-log` (aktör/proje/zaman filtresi) | ✅ | Dışa aktarma yok |
| Device Log | `deviceEvents` verisi | 🟡 | UI yok |
| User Login Report | — | ❌ | Düşük |
| Map | — | ❌ | Alakasız (tek kapılı kurulum) |

## 6. Cihaz

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Cihaz listesi (durum, sürüm, kapı sayısı, grup) | `/devices` bölge→kapı→cihaz hiyerarşisi, claim/serbest bırak, QR, çoklu marka (Hik, IDE Smart) | ➕ | |
| Add: **SADP LAN tarama** | Windows köprüsü + gateway kaydı | 🟡 | Köprü tabanlı; tek tıkla LAN keşfi yok |
| Add: seri no / toplu içe aktarma | Seri no/UUID ile kayıt; toplu içe aktarma yok | 🟡 | |
| Captive Portal, Record Template, House | — | ❌ | Alakasız |

## 7. Ekip ve güvenlik

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Users (rol, durum, **son kullanma**, Freeze/Unfreeze, Import/Export) | `/system-admin` kullanıcı listesi, rol güncelle/sil, davet | 🟡 | Dondurma, son kullanma tarihi, toplu içe/dışa aktarma yok |
| Roles (özel rol, geçerlilik aralığı) | 3 sabit rol + `capabilities(role)` | 🟡 | Özel rol tanımı yok; küçük ekipte yeterli olabilir |
| Account Security: **2FA (e-posta)** | E-posta doğrulama (kayıt) var, giriş 2FA yok | ❌ | **Yüksek değer**: yönetici hesapları için |
| Email Setting (SMTP) | `mailSettings` | ✅ | |
| Team Configuration: saat dilimi, GDPR saklama süresi | Ayarlar: saat dilimi, `privacyRetention`, biyometrik imha, rıza | ➕ | KVKK modülü Hik'in GDPR toggle'ından kapsamlı |
| Account Sync (AD), API Integration | — | ❌ | Düşük |
| Service / Lisans | — | ❌ | Alakasız |

## 8. Bizde olup Hik-Connect'te olmayanlar

- SGK APHB çıktısı, bordro sayfası, fazla mesai çarpanları ve yıllık limit, 10 TR izin türü ve bakiye (`leaveBalances`).
- KVKK: PDKS'te biyometri yasağı, imha akışı, çalışan rızası, ziyaretçi aydınlatma metni, kart okuma saklama süresi.
- Çoklu proje/kiracı (`projects`, `userProjects`), proje bazlı yetki.
- Ana sayfa özet panosu: tekrarlayan geç kalanlar, yıllık fazla mesai bakiyesi, mola ihlalleri.
- Çoklu marka (Hik + IDE Smart panel), cihaz senkron çalıştırması izleme.
- Kayıtlı görünümler, PDKS ısı haritası/grafik görünümleri, çalışan detay çekmecesi.

## 9. Öncelik önerisi

**Önce (en yüksek değer / en düşük maliyet):**
1. **Alarm merkezi (v1):** `deviceEvents` içindeki alarm/kurcalama/çevrimdışı olaylarını listele + öncelik + "onaylandı" durumu + yönetici e-postası. Veri ve e-posta altyapısı hazır.
2. **Kişi Excel içe/dışa aktarma + toplu kart:** ilk kurulum ve toplu güncelleme için en sık istenen iş.
3. **İzin ve düzeltme başvuru-onay akışı:** çalışan talebi → yönetici onayı/red, geri çekme, ek dosya. Çalışan self-servis (check-in sayfası/mobil) ile birlikte anlam kazanır.

**Sonra:**
4. Yeniden kullanılabilir erişim zaman şablonları + kişi bazlı yetki dağıtım durumu (Overview).
5. Ayrılma akışı (tarih/tip/neden/geri alma) + SGK çıkış ile ilişki.
6. Yönetici 2FA, kullanıcı dondurma/son kullanma.
7. Esnek vardiya tipi, Attendance Rule (giriş/çıkış zorunlu), Custom Export.

**Yapılmaz / ertelenir:** harita, captive portal, video kayıt şablonu, konut, AD eşitleme, firmware yükseltme, araç plakası, özel kişi alanları.

## 10. Doğrulanması gerekenler

- **[teyit]** etiketli satırlar kodda tek tek kontrol edilmeli (özellikle kapı modu, Attendance Rule, check point, mobil alan yönetimi, bildirim içeriği).
- Remain Unlocked & Locked sayfası Hik'te açılamadı; işlev varsayımı doğrulanmadı.
- Hik'te Health Monitoring servisi dolduğu için sağlık sayfası boş; alan düzeni görüldü, gerçek veri görülmedi.
- Kıyas, ngsaccess tarafında kod envanterine dayanıyor; canlı ngsaccess arayüzünde gezilmedi.
