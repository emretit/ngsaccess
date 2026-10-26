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
- **(2026-10-25) 5 alandan 4'ü kapandı** (alarm merkezi, başvuru-onay akışı, kişi toplu işlemleri + ayrılma, erişim şablonu + yetki dağıtım durumu); 5. alanda dondurma/son kullanma var; 2FA yapılmayacak (karar 2026-10-26).
- **İlk tespit — Hik'te olup bizde olmayan 5 ana alan:** (1) alarm merkezi + alarm kuralları, (2) izin/düzeltme *başvuru-onay akışı*, (3) kişi toplu işlemleri (Excel içe/dışa aktarma, toplu kart, ID kuralı, ayrılma akışı), (4) yeniden kullanılabilir erişim zaman şablonu + kişi bazlı yetki dağıtım durumu, (5) hesap güvenliği (2FA, kullanıcı dondurma/son kullanma, özel rol).
- **Gereksiz/alakasız bulunanlar:** harita, captive portal, video kayıt şablonu, konut yönetimi, AD eşitleme, lisans/servis pazarı.

## 2. Access Control

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Canlı kapı + uzaktan aç + Batch Control | `/live-monitoring`, `/devices` (kapı işlemleri), web kapı açma canlı | ✅ | Toplu kapı kontrolü **[teyit]** |
| Manage Access Level (kapı + zaman şablonu) | `/access-control` erişim kuralları (kişi/departman kapsamı, kapı/bölge, gün-saat) | ➕ | Bizde kural tek yerde kişi+kapı+zaman; cihaz senkron çalıştırmaları (`deviceSyncRuns`) izlenir |
| Grant by Department / by Person | Kuralın kapsamı olarak departman/kişi seçimi | ✅ | |
| Overview: kişi başına **efektif yetki dağıtım durumu** (Invalid/Effective/Not Granted) | Cihaz başına yetki dağıtım durumu görünümü | ✅ | `e0d4ba29` |
| Access Schedule Template (haftalık 7×24, yeniden kullanılabilir) | Erişim zaman şablonları + kapı planları | ✅ | `4e11b2a5`, `f126d94c` |
| Holiday Settings (AC) | `holidays` (Ayarlar, Türkiye tatilleri otomatik) | ✅ | Erişim kurallarının tatil takvimine bağlı olup olmadığı **[teyit]** |
| Temporary Pass (PIN/QR, izin verilen geçiş sayısı) | `/visitors` (kart, geçerlilik, KVKK rızası, kartı bırak) | 🟡 | PIN/QR ile tek kullanımlık geçiş yok; ziyaretçi fiziksel kartla çalışıyor |
| Access Record Retrieval (cihaz/grup/kişi/geçici filtre, Export, Import Events) | `/live-monitoring` + `/reports` işlem raporu (kişi/cihaz/kapı/sonuç filtresi) | 🟡 | Rapor dışa aktarma var; olay içe aktarma yok |
| Device Recorded Data (cihaz olayları: kurcalama, çevrimdışı) | Alarm merkezi (`deviceEvents` listesi, filtre, onay) | ✅ | `ce7e7889` |
| Remain Unlocked / Remain Locked (kapı modu zamanlaması) | Gateway adaptöründe kapı modu referansı var; UI/zamanlama yok | ❌ **[teyit]** | Sayfa Hik'te açılamadı, işlev beklentisi belirsiz |
| Event Notification (237+28+74 olay türü aç/kapa) | — | ❌ | Bkz. Alarm |
| Super Access (Remain Locked'u aşma), Extended Access, Device Administrator bayrakları | Kapı açık süresi cihaz parametresi var, kişi bayrakları yok | ❌ | Küçük iş: kişi başına bayrak + cihaza yazma |

## 3. Attendance (PDKS)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Schedule (kişi×gün ızgara, Export, Clear) | PDKS › Vardiya planı (takvim, toplu atama önizleme, düzenle/sil) + toplu temizle/dışa aktar | ✅ | `48419e7f`, `e0205881` |
| Timetable: Normal / **Flexible** vardiya, cross-day, mola, geçerli giriş/çıkış penceresi | Sabit + esnek vardiya, gece vardiyası, mola, geçerli pencere | ✅ | `8f57a2d9`; çoklu mola yok (PDKS_KIYAS §2.3) |
| Leave başvuru + **Approve/Reject/Withdraw** + ek dosya + Auto Approve + onay akışı | Talep → yönetici onay kuyruğu (web + mobil) | 🟡 | `c23926dc`; **ek dosya ve otomatik onay yok** |
| Attendance Correction başvurusu + onay | Çalışan talebi + yönetici kuyruğu | ✅ | `c23926dc` |
| Supervisor rolü (departman başvurularını onaylar) | Roller: super_admin / project_admin / project_user | ❌ | Departman bazlı onaycı kavramı yok |
| General: Weekend | `workSettings` hafta sonu | ✅ | |
| General: Overtime | `overtimeRates` (çarpan, hafta sonu çarpanı), yıllık limit, tolerans, SGK çıktısı | ➕ | |
| General: Attendance Rule (giriş/çıkış zorunlu, varsayılan geçerli pencere) | requireCheckIn/Out + vardiyada geçerli pencere | ✅ | `8f57a2d9` |
| General: Notifications (giriş hatırlatma, giriş bildirimi) | `notificationSettings` tablosu | 🟡 | Çalışana push/e-posta hatırlatması içeriği **[teyit]** |
| Attendance Check Point (hangi cihazlar sayılsın) | PDKS noktaları + nokta tipi (okuyucu bazında) | ✅ | `6e69b6fb` |
| Mobil check-in + alan (geofence) yönetimi | `/check-in` token + konum (`employeeCheckIn`) | ✅ | Alan (çok noktalı) yönetim ekranı ve kişi bazlı mobil yetki listesi yok **[teyit]** |
| Holiday | `holidays` + Türkiye tatilleri seed | ➕ | |
| Leave Type (kullanıcı tanımlı) | Sabit 10 tür (yıllık, hastalık, mazeret, ücretsiz, doğum, evlilik, ölüm, babalık, süt, telafi) | 🟡 | Özel tür eklenemez; TR mevzuatı için bilinçli seçim olabilir |
| Report (işletme adı/logo/format) | `companies`, genel ayarlar | 🟡 **[teyit]** | |
| Custom Export (alan seçici, TXT şablon) | PDKS dışa aktarmada sütun seçici | 🟡 | `965d0fa7`; TXT şablonu yok |
| Scheduled Report (günlük/haftalık/aylık e-posta) | `reportScheduleSettings` + cron | ✅ | |
| 19 rapor | `/reports` 16 rapor | ✅ | Bkz. [../hikconnect-reports/README.md](../hikconnect-reports/README.md) |

## 4. Kişi (Person)

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Departman ağacı + liste + filtre | `/employees` ağaç + tablo + arama | ✅ | |
| Import / Export (Excel) | Kişiler Excel şablon / içe / dışa aktarma | ✅ | `ce7e7889` |
| Adjust Department (toplu) | `bulkUpdateDepartment` | ✅ | |
| **Batch Issue Cards to Persons** | Toplu kart atama | ✅ | `ce7e7889` |
| Person ID Rule (otomatik ID üretimi) | — | ❌ | Düşük/orta |
| Kimlik bilgisi: yüz, kart, parmak izi, Bluetooth, PIN | kart no + yüz + parmak izi | 🟡 | PIN/Bluetooth yok; biyometri PDKS'ye giriyor (`6a7950bb`) |
| Custom Attributes (özel alan) | — | ❌ | Düşük |
| Self-Registration (QR) + Registration Audit (onay kuyruğu) | Davet ile hesap kurulumu (`invites`) | 🟡 | QR ile kendi kaydı + onay kuyruğu yok |
| **Resign** (ayrılış tarihi, tipi, nedeni, Reinstate, Disable Attendance) | Ayrılma akışı + bitiş tarihinden sonra kart/QR/mobil erişim reddi | ✅ | `4e2ef074`, `9a28fb69`, `579db3e7` |
| Vehicle (plaka + geçerlilik) | — | ❌ | Düşük |
| Kişi başına Temporary Pass yetkisi | — | ❌ | Düşük |
| Attendance rolü + vardiya önizleme (kişi formunda) | Vardiya ayrı sayfada | 🟡 | |

## 5. Alarm ve Bakım

| Hik-Connect | ngsaccess | Durum | Not |
|---|---|---|---|
| Alarm Center (son alarmlar, ses/pop-up, Acknowledge) | `/alarms`: liste, filtre, toplu onay | ✅ | `ce7e7889` |
| Alarm kuralları (kapı zorlandı, okuyucu/cihaz kurcalandı, çevrimdışı) + öncelik + bildirim (App, e-posta) | Bildirim ayarı + kritik olayda e-posta + çevrimdışı arıza | 🟡 | `ce7e7889`, `d986a948`; App bildirimi **[teyit]** |
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
| Users (rol, durum, **son kullanma**, Freeze/Unfreeze, Import/Export) | Kullanıcı dondurma + erişim son kullanma + 7 günlük oturum | 🟡 | `8c854622`; kullanıcı içe/dışa aktarma yok |
| Roles (özel rol, geçerlilik aralığı) | Proje bazlı 5 sabit rol × 13 düzenlenebilir yetki | 🟡 | `ce09baf0`; tamamen özel rol yok |
| Account Security: **2FA (e-posta)** | E-posta doğrulama (kayıt) var, giriş 2FA yok | ❌ | Yapılmayacak (Emre kararı 2026-10-26) |
| Email Setting (SMTP) | `mailSettings` | ✅ | |
| Team Configuration: saat dilimi, GDPR saklama süresi | Ayarlar: saat dilimi, `privacyRetention`, biyometrik imha, rıza | ➕ | KVKK modülü Hik'in GDPR toggle'ından kapsamlı |
| Account Sync (AD), API Integration | — | ❌ | Düşük |
| Service / Lisans | — | ❌ | Alakasız |

## 8. Bizde olup Hik-Connect'te olmayanlar

- SGK APHB çıktısı, bordro sayfası, fazla mesai çarpanları ve yıllık limit, 10 TR izin türü ve bakiye (`leaveBalances`).
- KVKK: biyometrik imha akışı, çalışan rızası, ziyaretçi aydınlatma metni, kart okuma saklama süresi.
- Çoklu proje/kiracı (`projects`, `userProjects`), proje bazlı yetki.
- Ana sayfa özet panosu: tekrarlayan geç kalanlar, yıllık fazla mesai bakiyesi, mola ihlalleri.
- Çoklu marka (Hik + IDE Smart panel), cihaz senkron çalıştırması izleme.
- Kayıtlı görünümler, PDKS ısı haritası/grafik görünümleri, çalışan detay çekmecesi.

## 9. Öncelik önerisi

**Önce (en yüksek değer / en düşük maliyet):**
1. ✅ **Alarm merkezi (v1)** (`ce7e7889`): `deviceEvents` içindeki alarm/kurcalama/çevrimdışı olaylarını listele + öncelik + "onaylandı" durumu + yönetici e-postası. Veri ve e-posta altyapısı hazır.
2. ✅ **Kişi Excel içe/dışa aktarma + toplu kart** (`ce7e7889`): ilk kurulum ve toplu güncelleme için en sık istenen iş.
3. ✅ **İzin ve düzeltme başvuru-onay akışı** (`c23926dc`; ek dosya/otomatik onay kalan): çalışan talebi → yönetici onayı/red, geri çekme, ek dosya. Çalışan self-servis (check-in sayfası/mobil) ile birlikte anlam kazanır.

**Sonra:**
4. ✅ (`4e11b2a5`, `e0d4ba29`) Yeniden kullanılabilir erişim zaman şablonları + kişi bazlı yetki dağıtım durumu (Overview).
5. ✅ (`4e2ef074`) Ayrılma akışı (tarih/tip/neden/geri alma) + SGK çıkış ile ilişki.
6. 🟡 Kullanıcı dondurma/son kullanma ✅ (`8c854622`); yönetici 2FA yapılmayacak (karar 2026-10-26).
7. ✅ Esnek vardiya, Attendance Rule, Custom Export (sütun seçici `965d0fa7`) + vardiya Faz 1-4 (`8f57a2d9`, `26e5570b`).

**Yapılmaz / ertelenir:** harita, captive portal, video kayıt şablonu, konut, AD eşitleme, firmware yükseltme, araç plakası, özel kişi alanları.

## 10. Doğrulanması gerekenler

- **[teyit]** etiketli satırlar kodda tek tek kontrol edilmeli (özellikle kapı modu, Attendance Rule, check point, mobil alan yönetimi, bildirim içeriği).
- Remain Unlocked & Locked sayfası Hik'te açılamadı; işlev varsayımı doğrulanmadı.
- Hik'te Health Monitoring servisi dolduğu için sağlık sayfası boş; alan düzeni görüldü, gerçek veri görülmedi.
- Kıyas, ngsaccess tarafında kod envanterine dayanıyor; canlı ngsaccess arayüzünde gezilmedi.
