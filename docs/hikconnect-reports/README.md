# Hik-Connect (Team) Rapor Sayfaları — Tersine Mühendislik Kataloğu

> **Tarih:** 2026-10-19 · **Kaynak:** canlı Hik-Connect 7 Team portalı (`www.hik-connect.com`, API `isgp-team.hikcentralconnect.com/hcc`), Orca gömülü tarayıcısında oturum açık hesap · **Araçlar:** [REA](https://github.com/morluto/rea) 6.7.0 (bundle keşfi) + sayfa içi XHR kaydı + modül router'ı üzerinden gezinme.
>
> **Kapsam:** salt-okuma. Hiçbir export, yeniden hesaplama (Recalculate) veya ayar kaydı tetiklenmedi.
>
> **Kanıt etiketleri:** **[görüldü]** = canlı istek/cevapta ya da ekranda gözlendi · **[çıkarım]** = JS bundle'dan ya da davranıştan çıkarıldı, canlı doğrulanmadı · **[bilinmiyor]** = belirlenemedi.

## 1. Özet

- Attendance modülünde **19 rapor** var: 3 grup (Kayıtlar 3 · Günlük 9 · Aylık 7). Menü sunucudan geliyor: `POST /hccattendance/ability/v1/menu/list` **[görüldü]**.
- Raporlar **tamamen sunucu tanımlı**. Tek bir bileşen (`tableCommon`), `ability/v1/report/{id}/get` cevabındaki `columnList` + `filterList` ile tabloyu ve filtre formunu kendisi kuruyor. Veri tek bir uçtan geliyor: `report/v1/list` (`reportTypeId` parametresiyle) **[görüldü]**.
- 3 rapor (Attendance Overview / Status / Summary) **yalnız export** destekliyor. Ekranda "sanal veri" önizlemesi gösteriliyor, gerçek veri yalnız dışa aktarılan dosyada var **[görüldü]**.
- Liste cevabında `total` alanı yok, sayfalama `nextPageExists` ile yapılıyor **[görüldü]**.
- Rapor ayarı sayfaları: görüntü formatı (Report), Özel Rapor (Custom Report), Zamanlanmış Rapor (e-posta ile periyodik gönderim) **[görüldü]**.
- Diğer modüllerdeki rapor/kayıt sayfaları: Access Control (geçiş kaydı ve cihaz kaydı arama) ve Maintenance (cihaz raporu, cihaz logu, işlem logu, kullanıcı giriş raporu) — bkz. §7.

## 2. Rapor menüsü (Attendance)

| Grup | Rapor | `reportTypeId` | Route | Bileşen | Filtreler | Kolon | Yeniden hesap. | Export formatları ¹ | Ekran |
|---|---|---|---|---|---|---|---|---|---|
| Kayıtlar | Transaction | 1 | `/HCCAttendance/transaction` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay), Device | 14 | hayır | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/transaction.png) |
| Kayıtlar | Mobile Transaction | 9 | `/HCCAttendance/mobileClockingReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 11 | hayır | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/mobile-transaction.png) |
| Kayıtlar | Time Card | 18 | `/HCCAttendance/TimeCard` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 8 | hayır | Excel, PDF, TXT, Yazdır/PDF sayfa | [png](shots/time-card.png) |
| Günlük | Total Time Card | 2 | `/HCCAttendance/totalTimeCard` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 33 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/total-time-card.png) |
| Günlük | Worked Hrs | 3 | `/HCCAttendance/workedHrs` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 16 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/worked-hrs.png) |
| Günlük | First In Last Out | 19 | `/HCCAttendance/FirstInLastOut` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 15 | hayır | Excel, PDF, TXT, Yazdır/PDF sayfa | [png](shots/first-in-last-out.png) |
| Günlük | Exception Report | 7 | `/HCCAttendance/exceptionReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 17 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/exception-report.png) |
| Günlük | Late Report | 4 | `/HCCAttendance/lateReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 18 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/late-report.png) |
| Günlük | Early Leave Report | 5 | `/HCCAttendance/earlyLeaveReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 18 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/early-leave-report.png) |
| Günlük | Absent Report | 6 | `/HCCAttendance/absentReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 18 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/absent-report.png) |
| Günlük | Overtime Report | 8 | `/HCCAttendance/overtimeReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 9 | evet | Excel, PDF, CSV, TXT, Yazdır/PDF sayfa | [png](shots/overtime-report.png) |
| Günlük | Break Report | 17 | `/HCCAttendance/BreakReport` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Dün) | 14 | evet | Excel, PDF, TXT, Yazdır/PDF sayfa | [png](shots/break-report.png) |
| Aylık | Monthly Status | 12 | `/HCCAttendance/MonthlyStatus` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 12 | evet | Excel, PDF, Yazdır/PDF sayfa | [png](shots/monthly-status.png) |
| Aylık | Monthly Worked Hrs | 11 | `/HCCAttendance/MonthlyWorkedHrs` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 15 | evet | Excel, PDF, Yazdır/PDF sayfa | [png](shots/monthly-worked-hrs.png) |
| Aylık | Person Attendance | 13 | `/HCCAttendance/PersonAttendance` | `tableCommon` | Full Name, ID, Department, Time Period (vars.: Bu ay) | 18 | evet | Excel, PDF, Yazdır/PDF sayfa | [png](shots/person-attendance.png) |
| Aylık | Department Attendance | 14 | `/HCCAttendance/DepartmentAttendance` | `tableCommon` | Department, Time Period (vars.: Bu ay) | 14 | evet | Excel, PDF, Yazdır/PDF sayfa | [png](shots/department-attendance.png) |
| Aylık | Attendance Overview | 15 | `/HCCAttendance/AttendanceOverview` | `personDetailReport` | Department, Time Period (vars.: Bu ay), Person | 0 | evet | Excel | [png](shots/attendance-overview.png) |
| Aylık | Attendance Status | 16 | `/HCCAttendance/AttendanceStatus` | `monthlyAttStatusReport` | Department, Time Period (vars.: Bu ay), Person | 0 | evet | Excel | [png](shots/attendance-status.png) |
| Aylık | Attendance Summary | 10 | `/HCCAttendance/monthlyAttendanceSummary` | `monthlyReport` | Department, Time Period (vars.: Bu ay), Person | 0 | evet | Excel, Yazdır/PDF sayfa | [png](shots/attendance-summary.png) |

¹ Export format kodlarının (0-4) adları **[çıkarım]**: Zamanlanmış Rapor formunda Excel/PDF/CSV/TXT görüldü; `4` için bundle `filePageSize` + `fileOrientationType` (yazdırma sayfa boyutu/yönü) ekliyor.

## 3. Ortak API akışı (tablo tipi raporlar)

Tüm uçlar `POST https://isgp-team.hikcentralconnect.com/hcc` altında. Kimlik doğrulaması cookie ile yapılıyor (`withCredentials`). Ek header'lar: `Accept`, `Content-Type`, `clientSource` **[görüldü]**.

| Sıra | Uç | İstek | Amaç |
|---|---|---|---|
| 1 | `/hccattendance/ability/v1/menu/list` | `{"language":"en"}` | Menü ağacı (grup → rapor, `reportTypeId`, `url`, `componentName`) |
| 2 | `/hccattendance/report/v1/display/get` | `{}` | Şirket adı + `dateFormat`/`timeFormat`/`durationFormat` |
| 3 | `/hccattendance/ability/v1/report/{id}/get` | `{"language":"en"}` | Rapor tanımı: `columnList`, `filterList`, `supportedFormat`, `canRecalculate` (hepsi tek seferde: `/ability/v1/report/list`) |
| 4 | `/hccattendance/report/v1/list` | aşağıda | Sayfalı veri |
| 5 | `/hccattendance/calculation/v1/progress` | `{}` | Arka planda hesaplama sürüyor mu (Recalculate olan raporlar) |
| 6 | `/hccattendance/report/v1/status/export/get` | `{}` | Süren export var mı |
| — | `/hccattendance/calculation/v1/manual` | `{startDate,endDate,isAllPerson,personIdList}` | Recalculate düğmesi (en fazla 1 yıl aralık) **[çıkarım]** |
| — | `/hccattendance/report/v2/export` | `{format, exportTime, reportTypeId, filterList, columnList:[], (format=4 → filePageSize, fileOrientationType)}` | Asenkron export. Sonra `status/export/get` sorgulanıyor, iptal için `export/stop` **[çıkarım]** |

**Liste isteği** **[görüldü]**:

```json
{
 "page": 1,
 "pageSize": 20,
 "language": "en",
 "reportTypeId": 1,
 "columnIdList": [],
 "filterList": [
  {
   "columnName": "fullName",
   "operation": "LIKE",
   "value": ""
  },
  {
   "columnName": "personCode",
   "operation": "LIKE",
   "value": ""
  },
  {
   "columnName": "groupId",
   "operation": "IN",
   "value": ""
  },
  {
   "columnName": "clockStamp",
   "operation": "BETWEEN",
   "value": "2026-10-01T00:00:00+03:00,2026-10-31T23:59:59+03:00"
  },
  {
   "columnName": "deviceId",
   "operation": "IN",
   "value": ""
  }
 ]
}
```

**Liste cevabı** **[görüldü]**: `{"data":{"page","pageSize","columnList":[...string],"reportDataList":[{...}],"nextPageExists":bool},"errorCode":"0"}`

**Filtre sözlüğü** **[görüldü]** (`filterList[].inputType`):

| inputType | Hedef kolon | Operasyon | UI |
|---|---|---|---|
| 0 | `fullName`, `personCode` | `LIKE` | metin kutusu |
| 1 | `groupId` | `IN` (virgüllü id) | departman ağacı |
| 3 | `clockStamp` | `BETWEEN` (`ISO+03:00,ISO+03:00`) | zaman aralığı (ham kayıt raporları) |
| 5 | `date` | `BETWEEN` | tarih aralığı (hesaplanmış raporlar). Varsayılan: günlük raporlarda `1` = Dün, aylık raporlarda `4` = Bu ay |
| 6 | `deviceId` | `IN` | cihaz seçimi (yalnız Transaction) |
| 7 | `personId` | `IN` | kişi seçimi (yalnız export-only raporlar) |

Zaman aralığı seçenekleri **[çıkarım, bundle]**: Bugün, Dün, Bu hafta, Geçen hafta, Bu ay, Geçen ay, Özel (en fazla 31 gün).

**Değer formatları** **[görüldü]**: süreler `"HH:MM"` string, tarih `"yyyy-MM-dd"`, saat `"HH:mm"`, `week` İngilizce gün adı, `attendanceStatus` metin (ör. `"Absent"`). `checkIn*`/`checkOut*` = vardiyanın planlanan başlangıç/bitişi, `clockIn*`/`clockOut*` = gerçek okutma. Aylık durum raporunda günler dinamik kolon olarak geliyor (`"2026-10-01": "..."`).

## 4. Rapor detayları (kolonlar)

Biçim: `Görünen ad` (`apiAdı`). ↕ = sıralanabilir, ° = varsayılan gizli (kolon seçicide açılıyor).

### Kayıtlar — Attendance Records

**Transaction** · id 1 · [ekran](shots/transaction.png)

- Kolonlar (14): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`clockDate`) ↕, Time (`clockTime`), Weekday (`week`), Data Source (`dataSource`), Device Name (`deviceName`), Device Serial No. (`deviceSerial`), Punch State (`handleType`), Location (`location`), Remarks (`remark`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`, `deviceId`, `briefAddress`, `detailAddress`, `longitude`, `latitude`

**Mobile Transaction** · id 9 · [ekran](shots/mobile-transaction.png)

- Kolonlar (11): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`clockDate`) ↕, Time (`clockTime`), Weekday (`week`), Location (`location`), Attachment (`attachment`), Remarks (`remark`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`, `briefAddress`, `detailAddress`, `longitude`, `latitude`, `id`

**Time Card** · id 18 · [ekran](shots/time-card.png)

- Kolonlar (8): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`clockDate`) ↕, Weekday (`week`), Records (`records`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

### Günlük — Daily Report

**Total Time Card** · id 2 · [ekran](shots/total-time-card.png)

- Kolonlar (33): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`), Work Start Time (`checkInTime`), Work End Date (`checkOutDate`), Work End Time (`checkOutTime`), Clock-In Date (`clockInDate`), Clock-In Time (`clockInTime`), Clock-In Source (`clockInSource`), Clock-In Device (`clockInDevice`) °, Clock-In Area (`clockInArea`) °, Clock-Out Date (`clockOutDate`), Clock-Out Time (`clockOutTime`), Clock-Out Source (`clockOutSource`), Clock-Out Device (`clockOutDevice`) °, Clock-Out Area (`clockOutArea`) °, Attendance Status (`attendanceStatus`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`), Late Duration (`lateDuration`), Early Leave Duration (`earlyDuration`), Break Duration (`breakDuration`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Leave Type (`leaveTypes`) °
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`, `clockInId`, `clockOutId`, `personId`, `timetableId` · satır alanları (örnek tipler `daily-row-samples.json`): 34

**Worked Hrs** · id 3 · [ekran](shots/worked-hrs.png)

- Kolonlar (16): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`), Late Duration (`lateDuration`), Early Leave Duration (`earlyDuration`), Break Duration (`breakDuration`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp` · satır alanları (örnek tipler `daily-row-samples.json`): 16

**First In Last Out** · id 19 · [ekran](shots/first-in-last-out.png)

- Kolonlar (15): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`) °, Timetable (`timetableName`), Work Start Date (`checkInDate`) °, Work Start Time (`checkInTime`), Work End Date (`checkOutDate`) °, Work End Time (`checkOutTime`), First Check In (`firstCheckIn`), Last Check Out (`lastCheckOut`), Worked Hours (`workDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp` · satır alanları (örnek tipler `daily-row-samples.json`): 19

**Exception Report** · id 7 · [ekran](shots/exception-report.png)

- Kolonlar (17): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`), Work Start Time (`checkInTime`), Work End Date (`checkOutDate`), Work End Time (`checkOutTime`), Clock-In Date (`clockInDate`), Clock-In Time (`clockInTime`), Clock-Out Date (`clockOutDate`), Clock-Out Time (`clockOutTime`), Attendance Status (`attendanceStatus`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp` · satır alanları (örnek tipler `daily-row-samples.json`): 17

**Late Report** · id 4 · [ekran](shots/late-report.png)

- Kolonlar (18): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`), Work Start Time (`checkInTime`), Work End Date (`checkOutDate`), Work End Time (`checkOutTime`), Clock-In Date (`clockInDate`), Clock-In Time (`clockInTime`), Clock-Out Date (`clockOutDate`), Clock-Out Time (`clockOutTime`), Worked Hours (`workDuration`), Late Duration (`lateDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Early Leave Report** · id 5 · [ekran](shots/early-leave-report.png)

- Kolonlar (18): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`), Work Start Time (`checkInTime`), Work End Date (`checkOutDate`), Work End Time (`checkOutTime`), Clock-In Date (`clockInDate`), Clock-In Time (`clockInTime`), Clock-Out Date (`clockOutDate`), Clock-Out Time (`clockOutTime`), Worked Hours (`workDuration`), Early Leave Duration (`earlyDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Absent Report** · id 6 · [ekran](shots/absent-report.png)

- Kolonlar (18): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`), Work Start Time (`checkInTime`), Work End Date (`checkOutDate`), Work End Time (`checkOutTime`), Clock-In Date (`clockInDate`), Clock-In Time (`clockInTime`), Clock-Out Date (`clockOutDate`), Clock-Out Time (`clockOutTime`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp` · satır alanları (örnek tipler `daily-row-samples.json`): 18

**Overtime Report** · id 8 · [ekran](shots/overtime-report.png)

- Kolonlar (9): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Workday Overtime Duration (`workdayOvertimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Break Report** · id 17 · [ekran](shots/break-report.png)

- Kolonlar (14): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, Date (`date`) ↕, Weekday (`week`), Timetable (`timetableName`), Work Start Date (`checkInDate`) °, Work Start Time (`checkInTime`) °, Work End Date (`checkOutDate`) °, Work End Time (`checkOutTime`) °, Break-Period Records (`breakRecords`), Break Duration (`breakDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`, `personId`, `timetableId` · satır alanları (örnek tipler `daily-row-samples.json`): 18

### Aylık — Monthly Report

**Monthly Status** · id 12 · [ekran](shots/monthly-status.png)

- Kolonlar (12): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, dateRange (`dateRange`), Normal (`normalTimes`), Absent (`absenceTimes`), Late (`lateTimes`), Early Leave (`earlyTimes`), Late and Early Leave (`lateAndEarlyTimes`), Leave (`leaveTimes`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Monthly Worked Hrs** · id 11 · [ekran](shots/monthly-worked-hrs.png)

- Kolonlar (15): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, dateRange (`dateRange`), Worked Hours (`workDuration`), Absent Duration (`absenceDuration`), Late Duration (`lateDuration`), Early Leave Duration (`earlyDuration`), Break Duration (`breakDuration`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Person Attendance** · id 13 · [ekran](shots/person-attendance.png)

- Kolonlar (18): First Name (`firstName`), Last Name (`lastName`), Full Name (`fullName`) °, ID (`personCode`) ↕, Department (`fullPath`) ↕, dateRange (`dateRange`), Due (`requiredCheckInTimes`), Actual (`actualCheckInTimes`), Normal (`normalTimes`), Absent (`absenceTimes`), Late (`lateTimes`), Early Leave (`earlyTimes`), Late and Early Leave (`lateAndEarlyTimes`), Leave (`leaveTimes`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Department Attendance** · id 14 · [ekran](shots/department-attendance.png)

- Kolonlar (14): Department (`fullPath`) ↕, Number (`personNum`), Due (`requiredCheckInTimes`), Actual (`actualCheckInTimes`), Normal (`normalTimes`), Absent (`absenceTimes`), Late (`lateTimes`), Early Leave (`earlyTimes`), Late and Early Leave (`lateAndEarlyTimes`), Leave (`leaveTimes`), Leave Duration (`leaveDuration`), Overtime Duration (`overtimeDuration`), Weekend Overtime Duration (`weekendOvertimeDuration`), Workday Overtime Duration (`workdayOvertimeDuration`)
- cevapta ek alanlar: `clockStamp`, `checkInStamp`, `checkOutStamp`, `clockInStamp`, `clockOutStamp`

**Attendance Overview** · id 15 · [ekran](shots/attendance-overview.png)

- Kolonlar (0): _(kolon tanımı yok — export-only, bkz. §5)_

**Attendance Status** · id 16 · [ekran](shots/attendance-status.png)

- Kolonlar (0): _(kolon tanımı yok — export-only, bkz. §5)_

**Attendance Summary** · id 10 · [ekran](shots/attendance-summary.png)

- Kolonlar (0): _(kolon tanımı yok — export-only, bkz. §5)_

## 5. Export-only raporlar (Overview / Status / Summary)

- `componentName`: `personDetailReport` (Attendance Overview, id 15), `monthlyAttStatusReport` (Attendance Status, id 16), `monthlyReport` (Attendance Summary, id 10) **[görüldü]**.
- Ekranda yalnız **sabit örnek veri** (XXX / 09:00-18:00) ve "The attendance details only provide virtual data for reference. Take the exported data as standard." uyarısı var. `report/v1/list` çağrılmıyor **[görüldü]**.
- Filtreler: departman (`groupId`), tarih (`date`, vars. Bu ay), kişi (`personId`). Format: id 15/16 yalnız Excel, id 10 Excel + yazdır **[görüldü]**.
- Summary/Status düzeni: kişi başına satır blokları (Timetable, Attendance Status, Clock-In/Out 1..n, Worked/Overtime/Late/Early/Break süresi) × ayın günleri + sağda toplamlar (Days of Work, Late, Early Leave, Overtime, Absent, haftanın günleri, Workday/Weekend). İzin türleri `leave/type/v1/list` ile ayrı kolonlar olarak ekleniyor **[görüldü ekran + çıkarım]**.

## 6. Rapor ayarı sayfaları (Attendance → Settings)

| Sayfa | Route | API | Alanlar |
|---|---|---|---|
| Report (görüntü ayarı) | `/HCBAttendance/ReportSetting` | `report/v1/display/get` · `display/save` | Şirket adı*, logo (JPG/PNG <10 MB), tarih/saat/süre formatı [görüldü](shots/report-setting.png) |
| Custom Report | `/HCBAttendance/customReportExport` | `custom/report/v1/view·add·update·delete·export` | Hesapta tanımlı özel rapor yok (`customReportList: []`) — form alanları **[bilinmiyor]** [ekran](shots/custom-report-export.png) |
| Scheduled Report | `/HCBAttendance/timingReport` | `timed/report/v1/view·add·update·delete` | `name, reportId, reportFormat, language, date/time/durationFormat, allGroup, groupIds, cycleType (gün/hafta/ay), sendDate, sendTime, sendMails (≤8), lastStatus` **[görüldü]** [ekran](shots/timing-report.png) |

## 7. Diğer modüllerdeki rapor ve kayıt sayfaları

| Modül | Sayfa | Route | API | Kolonlar |
|---|---|---|---|---|
| Access Control | Access Record Retrieval | `/HCBAccessControl/personnelEntryAndExitSearch` | `hccacs/v1/event/certificateRecords/search` (`pageIndex,pageSize,searchCriteria{beginTime,endTime,type,eventTypes,elementIDs,searchType,cardNumber,personCondition,swipeAuthResult,alcoholStatus}`) → `totalNum, recordList[]` | Profil, Ad, Soyad, ID, Sıcaklık, Maske, Kart No, Departman, Zaman, Kapı, Okuyucu, Doğrulama sonucu/tipi, Attendance tipi [ekran](shots/ac-personnel-entry-exit.png) |
| Access Control | Device Recorded Data Retrieval | `/HCBAccessControl/deviceRecordSearch` | `hccacs/v1/event/deviceRecords/search` (`sourceInfoList[{sourceType 1-4,eventTypes,sourceIds}]`) | Kaynak, Grup, Kaynak tipi, Cihaz, Kayıt tipi, Zaman [ekran](shots/ac-device-record-search.png) |
| Access Control | Overview (yetki durumu) | `/HCBAccessControl/accessOverview` | `hccacspm/v1/maintain/overview` + `/overview/person/detail` | Kişi, Erişim seviyesi, Kapı, Takvim, Yetki dağıtım durumu |
| Maintenance | Device Report (planlı) | `/maintenance/deviceReport` | `hccmaintain/v1/schedule/report/search` | Hesapta tanımlı yok (yalnız "Add") |
| Maintenance | Device Logs | `/maintenance/deviceLog` | `hccmaintain/inspection/v1/common/search`, `device/v1/logtype/list` | Log tipi, Zaman, Kullanıcı, Olay, Kanal, IP, Açıklama |
| Maintenance | Operation Log | `/maintenance/dailyRecord` | `operation/v1/hc/dictionary/list`, `auth/account/v1/user/search/page` | İşlem tipi, Zaman, Kaynak, Tip, Kaynak adı, Grup, Açıklama, İstemci |
| Maintenance | User Login Report | `/maintenance/ITReport` | `auth/account/v1/user/search/page` (+ arama) | Kullanıcı, Giriş sayısı, Toplam/Günlük ort./Giriş başı ort. süre |

Bu hesapta lisanslı olmayan modüller (BI, ANPR, Video Intercom) incelenmedi. Bundle'da route'ları var: `/hccbi/biReport`, `/hccbi/biSchedultReportConfiguration`, `HCBANPR/carPassReport` **[çıkarım]**.

## 8. ngsaccess için çıkarımlar

1. **Sunucu tanımlı rapor deseni:** tek bir `reportDefinitions` (kolon + filtre + format) tablosu ve tek bir generic tablo bileşeni ile 16 tablo raporu çıkıyor. Hik bunu `tableCommon` ile yapıyor.
2. **Ham ve hesaplanmış veri ayrımı:** `clockStamp` filtreli raporlar (Transaction, Mobile, Time Card) ham okutmayı gösteriyor, `date` filtreli raporlar gece/manuel hesaplanan günlük sonucu. Recalculate + progress akışı ayrı.
3. **Planlanan ve gerçekleşen alanlar** her satırda birlikte geliyor (`checkIn*` plan, `clockIn*` gerçek). PDKS günlük satır modelimiz bu ikiliği taşımalı.
4. Aylık matris raporları (Status/Summary) ekranda değil, **export-first** tasarlanmış. Biz de ilk sürümde Excel çıktısını öncelikleyebiliriz.
5. KVKK: Access Record cevabında sıcaklık/maske/yüz görseli alanları var. PDKS raporlarına biyometrik türev alan taşınmamalı (bkz. `PDKS_AUDIT_VE_PLAN_2026-10-16.md`).

## 9. Bilinmeyenler

- Export format kodları 0-4 ile dosya türü eşlemesi kesin değil **[bilinmiyor]**. Bir export denemesiyle doğrulanır (dosya üretir, salt-okuma kapsamı dışında).
- Custom Report oluşturma formu (hangi kolonlar seçilebiliyor) incelenmedi. Kayıtlı özel rapor yok.
- Export-only 3 raporun gerçek dosya düzeni yalnız önizlemeden biliniyor.
- Late / Early Leave / Overtime raporlarında 1-17 Ekim aralığında satır yoktu. Satır alanları yalnız kolon tanımından biliniyor.

## Dosyalar

- `report-definitions.json` — 19 raporun tam tanımı (`ability/v1/report/list` cevabı, kişisel veri yok)
- `menu.json` — menü ağacı
- `list-samples.json` — rapor başına `report/v1/list` isteği + cevap alan tipleri (değer yok)
- `daily-row-samples.json` — günlük raporların satır alanları + kişisel olmayan örnek değerler (cihaz/vardiya adları maskeli)
- `shots/*.png` — 30 sayfanın ekran görüntüsü (**gitignore'lu**: gerçek personel adları içeriyor)
