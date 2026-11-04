Güncelleme 2026-11-03: genel audit sonrası 21 satır düzeltildi (docs/genel-audit-2026-11-03/)

# PDKS Kıyas — Hikvision ↔ ngsaccess

> **Tarih:** 2026-10-23 · **Hik kaynağı:** canlı Hik-Connect Team taraması (`HIKCONNECT_SAYFALAR.md` §3, 2026-10-19) + HikCentral resmi belgeleri (aşağıda) · **Bizim kaynak:** `main` 6c56b090 + çalışma dizini, kod okuması.
> **Etiketler:** ✅ var · 🟡 kısmi · ❌ yok · ➕ bizde fazlası · **[teyit]** kodda tek tek doğrulanmadı.
> Önceki genel kıyas (`KIYAS.md` §3, 2026-10-19) sonrası esnek vardiya, giriş/çıkış zorunluluğu, PDKS noktaları, izin/düzeltme talep akışı eklendi; bu belge onu PDKS için günceller.
> **Güncelleme 2026-10-25:** P1 + P2 tamamı ve P3'ün vardiya kısmı yapıldı (`6e69b6fb`, `8f142ea8`, `8f57a2d9`, `26e5570b`). Satırlar kanıt commit'iyle güncellendi; kalanlar §3 sonunda.

## 1. Özet

> 2026-11-03 kod audit’i: özellik varlığı ile hesap güvenilirliği ayrı değerlendirildi; PDK-001–014 ve saha teyitleri genel audit raporunda.

- **Sayım/yön:** nokta başına Giriş+Çıkış / Yalnız giriş / Yalnız çıkış tipi ve okuyucu bazında seçim var; Hik `cardReaderNo` canlı + backfill okumada saklanıyor (`6e69b6fb`).
- **Hesap modu:** "İlk giriş–son çıkış" ve "Her giriş/çıkışı topla (tekrar okutma aralığı 0–60 dk)" (`6e69b6fb`).
- **Vardiya:** geçerli pencere, geç > X → devamsız, min. çalışma, tatilde çalışma zorunlu (`8f57a2d9`); departmana atama, gün/hafta döngüsü, günde ≤8 vardiya (`26e5570b`).
- **Hafta tatili:** tarihli vardiya planında seçilmeyen günler; Çalışma günleri ayarı kaldırıldı (audit anında commit’siz). `convex/lib/shiftPlan.ts:35`; `src/components/pdks/settings/PdksSettingsPanel.tsx:17`.
- **Kalan:** departman/grup düzeyinde kural, erken çıkış > X → devamsız, Flexible Period, çoklu mola, ay döngüsü, gruba atama, izin eki + otomatik onay, çalışana giriş hatırlatması, cihaz ekranı durum modu.
- **Bizde fazlası:** kural sürümleme (okuyucu adresi nedeniyle geçmiş için PDK-003 sınırı var), SGK eksik gün/XML, 270 saat uyarısı, haftalık 45 saat bazı, gece çarpanı + gün modu. `convex/pdksRules.ts:177`; `convex/lib/pdksRules.ts:61`; `convex/lib/overtimeCalc.ts:118`.

## 2. Kıyas tablosu

### 2.1 PDKS noktası ve yön

| Hik | ngsaccess | Durum | Not / kanıt |
|---|---|---|---|
| Varsayılan: tüm cihazlar PDKS noktası; "Specify" ile liste | "PDKS'e sayılan noktalar": Tüm / Seçilenler (cihaz veya kapı) | ✅ | `convex/lib/pdksRules.ts:21`, `pdksRulesCheckpointFields.tsx` |
| Nokta tipi: Check-In & Out / Check-In Only / Check-Out Only | Kural sürümünde nokta başına Giriş+Çıkış / Yalnız giriş / Yalnız çıkış | ✅ | `6e69b6fb`; yön hesap anında noktanın tipinden (okuyucu > kapı > cihaz) |
| Kapı seçilince **okuyucu bazında** tip (dış=giriş, iç=çıkış) | Okuyucu düzeyinde nokta/yön; canlı ve geçmiş alımda `cardReaderNo` saklama/eşleme | ✅ | Gerçek cihazın doğru numara göndermesi saha teyidi ister. `convex/pdksRules.ts:17`; `convex/pdksRules.ts:156`; `convex/cardReadings.ts:863`. |
| Nokta silinince kayıtları da silinir (hesaplanmamış günler) | Kural sürümü korunur; fiziksel okuyucu adresi güncel kayıttan çözülür | 🟡 | Geçmişin değişmezliği koşulsuz değil (PDK-003). `convex/pdksRules.ts:177`; `convex/lib/pdksRules.ts:61`. |
| "Get Historical Data Stored in Devices" | Hik günlük backfill | ✅ | Yön okumaya yazılmaz, hesapta nokta tipinden okunur; `cardReaderNo` backfill'de de saklanır (`6e69b6fb`) |
| Cihaz ekranında durum (Check In/Out/Break/Overtime; Manual/Auto/Manual+Auto) | Hesap yönü `attendanceStatus` alanından çözülmez | ❌ | Yerel kod, canlıda hep undefined iddiasını doğrulayamaz; yön nokta tipinden gelir. `convex/cardReadings.ts:763`; `convex/lib/processCardReadingCore.ts:213`; `convex/lib/pdksRules.ts:46`. |

### 2.2 Kurallar ve hesap

| Hik | ngsaccess | Durum | Not / kanıt |
|---|---|---|---|
| Kural kapsamı: Global < Departman < Grup < Vardiya | Proje kuralı + vardiyaya özgü kurallar/toleranslar | 🟡 | Vardiya düzeyi `8f57a2d9`; **departman/grup düzeyinde kural yok** |
| Check-In/Out Required | requireCheckIn / requireCheckOut | ✅ | `convex/schema.ts:258` |
| No Check-In → Absent **veya Late (sabit süre)**; No Check-Out → Absent **veya Early Leave** | missingRequiredPunch: absent / review + vardiyada giriş yoksa sabit süre geç | 🟡 | `missingCheckInLateMinutes` (`8f57a2d9`); çıkış yoksa "erken çıkış say" yok |
| Absent If Late > X / Early > X | Vardiyada geç > X dk → devamsız | 🟡 | `absentAfterLateMinutes` (`8f57a2d9`); **erken çıkış > X yok** |
| Calculated by: First In & Last Out | İlk–son farkından mola düşülerek net süre | ✅ | “Brüt” nihai süreyi anlatmaz; manuel giriş + tek ham çıkışta PDK-004 açık. `convex/lib/pdksDay.ts:144`; `convex/lib/pdksDay.ts:161`; `convex/lib/pdksDay.ts:177`. |
| Calculated by: Each Check-In/Out + Min. Interval (ara çıkışları düş) | "Her giriş-çıkışı topla" + tekrar okutma aralığı 0–60 dk | ✅ | `6e69b6fb` |
| Min. Work Hours → Absent | Sabit ve esnekte `minWorkMinutes` (esnekte `requiredNetMinutes` yalnız eksik/fazla süre hesaplar, devamsız yapmaz) | ✅ | `8f57a2d9` sabit; esnek 2026-10-26 (eksik çıkışta İncelenecek) |
| Day Change Settings (gün dönüm saati) | `nightShiftDayMode`: vardiya başlangıcı / gece yarısı böl | 🟡 | Serbest saat seçilemiyor |
| Manuel / otomatik hesap zamanı + yeniden hesapla | Her sorguda canlı hesap | ➕ | Yeniden hesaplama gerekmiyor |
| Hafta sonu tanımı (Define Weekends) | Hafta tatili tarihli vardiya planından | ✅ | Haftalık planda seçilmeyen gün hafta tatili; eski Çalışma günleri ayarı kaldırıldı (audit anında commit’siz). PDK-001/010 riskleri raporda. `convex/lib/shiftPlan.ts:35`; `src/components/pdks/settings/PdksSettingsPanel.tsx:17`. |

### 2.3 Vardiya (Timetable / Shift / Schedule)

| Hik | ngsaccess | Durum | Not / kanıt |
|---|---|---|---|
| Normal timetable: iş saati, geçerli giriş/çıkış penceresi, renk | Sabit vardiya: saatler, mola, gece + geçerli pencere | 🟡 | Renk alanı eski istemciden gelse de yok sayılıyor. `convex/shifts.ts:499`; `convex/shifts.ts:522`; `convex/lib/pdksFixedRules.ts:26`. |
| Allow Late/Early Leave | lateTolerance / earlyExitTolerance | ✅ | |
| Flexible Period (geç+erken toplamı) | — | ❌ | Kalan |
| Flexible timetable (süre sabit, saat serbest) | Esnek vardiya | ✅ | `shifts.flexible` |
| Mola timetable'ları (çoklu), "molayı çalışmaya say" | Vardiya başına tek mola / esnekte süre | 🟡 | **Çoklu mola ve "molayı çalışmaya say" yok** (kalan) |
| Shift tekrar deseni: 1–52 hafta / 1–31 gün / 1–12 ay | Haftalık + gün döngüsü 1–31 + hafta döngüsü 1–52 | 🟡 | `26e5570b`; **ay döngüsü yok**; döngüde boş gün = hafta tatili |
| Günde birden çok timetable (≤8) | Günde ≤8 vardiya, aralarında ≥30 dk; okutmalar parçalara bölünür | ✅ | `26e5570b`; kaçırılan parça = İncelenecek |
| Departmana / gruba vardiya atama | Departmana, alt departmanlar dahil önizlemeli atama | 🟡 | Öncelik kişi > en yakın departman; tarihli plan yoksa PDKS yok, varsayılan vardiya yok. Gruba atama yok. `convex/shiftPlans.ts:89`; `convex/lib/shiftResolver.ts:152`; `convex/lib/shiftResolver.ts:170`. |
| Geçici vardiya (Temporary Schedule) | Tarih aralıklı kişi ataması departman planını ezer | ✅ | `26e5570b` |
| Vardiyada "tatilde çalışma gerekli" | Vardiyada Resmi tatilde çalışma zorunlu | ✅ | Zorunluluk devamsızlık kontrolüyle birlikte tatil katsayısını da kaldırır. `convex/lib/pdksDay.ts:206`; `src/components/shifts/definitions/AddShiftDialog.tsx:460`. |

### 2.4 Fazla mesai, tatil, izin, düzeltme

| Hik | ngsaccess | Durum | Not |
|---|---|---|---|
| Fazla mesai: toplam süreye göre / zaman noktalarına göre | Günlük vardiya / haftalık 45 saat bazı | ✅➕ | `overtimeRates.overtimeBasis` |
| Fixed / Actual süre, min. geçerli mesai | Başlangıç toleransı | 🟡 | Sabit süre modu yok |
| Erken girişi mesai say | Günlük sabit vardiya bazında ayrı erken giriş primi yok | ❌ | Haftalık 45 saatte erken çalışılan net süre kotaya girebilir; ayrı erken giriş seçeneği değil. `convex/lib/pdksDay.ts:224`; `convex/lib/pdksDay.ts:269`; `convex/lib/overtimeCalc.ts:148`. |
| Mesai seviyeleri (çarpan) | Hafta içi/hafta sonu/tatil/gece çarpanı | ✅ | |
| Tatil mesaisi + max sınır | Tatil çarpanı + yıllık 270 saat uyarısı | 🟡 | 270 saat kayıt/ücret tavanı değil; yarım gün PDK-006 ve limit hesabı PDK-010 açıkları var. `convex/lib/pdksDay.ts:252`; `convex/dashboard.ts:474`; `src/components/pdks/dashboard/PDKSOvertimeAlert.tsx:28`. |
| Leave Type (kullanıcı tanımlı) | Sabit 10 tür (TR mevzuatı) | 🟡 | Bilinçli seçim |
| İzin başvurusu: Approve/Reject/Withdraw | Var | ✅ | |
| İzin/düzeltme eki (≤5 JPG/PNG), Auto Approve | — | ❌ | |
| Attendance Correction başvurusu | Var + yönetici kuyruğu | ✅ | `src/components/pdks/CorrectionRequestsPanel.tsx` |

### 2.5 Mobil, bildirim, rapor

| Hik | ngsaccess | Durum | Not |
|---|---|---|---|
| Mobil giriş/çıkış: kişi listesi, fotoğraf zorunlu, alan (geofence) | Fiziksel okuyucuda tüketilen kişisel QR | 🟡 | Doğrudan token/konum kaydı `READER_REQUIRED` döner; geofence/fotoğraf zorunluluğu/kişi izin listesi yok. `convex/employeeCheckIn.ts:9`; `convex/employeeCheckIn.ts:55`; `convex/cardReadings.ts:562`; `src/pages/CheckIn.tsx:63`. |
| Bildirim: giriş hatırlatma ("5 dk kala"), giriş yapıldı | Yöneticiye geç kalma e-postası | 🟡 | Çalışana giriş hatırlatması ve talep onay/red bildirimi yok; geç bildiriminde PDK-013. `convex/lib/processCardReadingCore.ts:508`; `convex/leaveRequests.ts:192`; `convex/attendanceCorrections.ts:99`. |
| 19 rapor (kayıt/günlük/aylık) | 18 tanım; 19 Hik başlığına kısmi eşleme | 🟡 | İki Hik başlığı aynı aylık-durum; kolon/filtre farkları, TXT/ayrı yazdır eksikleri var. Üç export-only karşılığı ekranda da var (➕). `src/lib/reports/registry.ts:94`; [eşleme](../hikconnect-reports/README.md). |
| Custom Export (alan seçici, TXT şablon) | PDKS dışa aktarmada sütun seçici | 🟡 | `965d0fa7`; TXT şablonu yok |
| Scheduled Report (tip, format, ≤8 alıcı, sıklık) | Tek kullanıcı/proje ayarından tek adrese aylık hatırlatma | 🟡 | Ayın 1’i 12:00 TR; dosya eki/günlük-haftalık/saat/çoklu alıcı/19 rapor seçimi yok. `convex/reports.ts:369`; `convex/actions/sendScheduledReports.ts:33`; `convex/crons.ts:7`. |

## 3. Öncelik

**P1 — özellikler mevcut; doğruluk açıkları genel audit’te (PDK-001–014)**
1. ✅ Nokta tipi + Hik `cardReaderNo` → okuyucu bazında seçim (`6e69b6fb`, uyarı `34d70c2a`).
2. ✅ Backfill okumalarına yön: hesapta nokta tipinden (`6e69b6fb`).
3. ✅ Hafta tatili vardiya planından; ayrı Çalışma günleri arayüzü kaldırıldı. `convex/lib/shiftPlan.ts:35`; `src/components/pdks/settings/PdksSettingsPanel.tsx:17`.
4. ✅ Hesap modu "her giriş/çıkışı topla" (`6e69b6fb`).

**P2 — kural zenginliği: BÜYÜK ÖLÇÜDE BİTTİ**
5. ✅ Giriş yoksa sabit süre geç, geç > X → devamsız, normal vardiyada min. çalışma (`8f57a2d9`). Kalan: erken çıkış > X → devamsız, çıkış yoksa erken çıkış say.
6. ✅ Normal vardiyada geçerli giriş/çıkış penceresi (`8f57a2d9`).
7. 🟡 Departmana vardiya atama ✅ (`26e5570b`); departman bazlı **kural** yok.

**P3 — kalan durum:**
- ✅ Çok haftalık/günlük rotasyon, günde çoklu vardiya (`26e5570b`); özel dışa aktarma (sütun seçici, `965d0fa7`).
- ❌ Ay döngüsü, Flexible Period, çoklu mola + "molayı çalışmaya say", gruba atama.
- ❌ İzin/düzeltme eki + otomatik onay, çalışana giriş hatırlatması, mobil alan yönetimi ve hesapta cihaz durum modu. Mobil akış fiziksel okuyucuda tüketilen QR’dır. `convex/employeeCheckIn.ts:55`; `convex/lib/pdksRules.ts:46`.

## 4. PDKS Ayarları sayfasına önerilen içerik

Hik "Attendance › Basic Configuration" karşılığı: **PDKS Kayıtları › Ayarlar** alt sayfası (`/pdks-records/settings`, 2026-10-23).

1. Mesai politikası, PDKS devam kuralları, tatil takvimi (taşındı)
2. **Nokta tipi** (P1-1); hafta tatili vardiya planından gelir. `convex/lib/shiftPlan.ts:35`.
3. (P3) Mobil giriş/çıkış, bildirim

## Kaynaklar (Hik)

- [Specify Attendance Check Points](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-0871C8FB-9D0B-4D70-94AA-B41639D31645.html)
- [Configure Attendance Rules (Global/Department/Group)](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-E5BC3C52-CF65-454A-90C9-1A9EC3913A77.html)
- [Define Absence](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-808B72B4-D3F9-4F3D-B955-C3D0BE1AB4B4.html)
- [Add Timetable for Normal Shift](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-6E4A3479-16B1-42E8-9924-5B12646AAD79.html)
- [Add Shift](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-DEBDC69C-0CC3-43A1-9A9F-3E500F0CCE58.html)
- [Configure Overtime Parameters](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-D6C8CE8C-A19F-4A03-8BC2-301B105ECF61.html)
- [Customize Attendance Status on Device](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-25FBC7DB-5D0D-458C-8883-A89D12FF1029.html)
- [Manage Schedule](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-232E815B-0870-48B6-972D-B8842679F813.html)
