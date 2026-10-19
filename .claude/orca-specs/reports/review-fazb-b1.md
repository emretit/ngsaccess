# R-B1 — Ücret gizleme denetimi (denetleyen: Claude, salt-okuma)

**Özet:** 7 uçta project_user'a giden tüm parasal alanlar `null`; haritada olmayan başka public ücret okuma yolu bulunmadı.
Yöneticilerde (super_admin, project_admin) matematik, sıralama ve null/0 ayrımı birebir aynı. Testler gerçek handler'ı koşuyor ve yeşil, tsc temiz.
Kalan bulgular yalnız DÜŞÜK (UX/test kalitesi); hiçbiri veri sızdırmıyor.
**Yayına engel: YOK** — sızıntı ya da yönetici regresyonu yok; bulgular kozmetik.

## Kapılar (kendi koşumum)
- `vitest run convex/lib/payVisibility.test.ts convex/payVisibility.handlers.test.ts src/components/settings/sections/reports convex/lib/reportScope.test.ts` → **4 dosya, 41/41 geçti**, EXIT 0.
- `tsc --noEmit -p convex/tsconfig.json` → EXIT 0. Ek: `tsc --noEmit -p tsconfig.app.json` → EXIT 0 (frontend null tipleri uyumlu).

## 1. Sızıntı taraması
- 7 uç maskeli: `employees.ts:96-97,155-156`, `visitors.ts:126-127`, `cardReadings.ts:511-515` (PDKS'e ücretsiz employee verilir → `pdksHelpers.ts:303-319` null → `overtimePayTRY` null `pdksHelpers.ts:330`), `cardReadings.ts:772,835,840` (bordro: hücre/satır/toplam null), `reports.ts:226,258` (mesai özeti), `reports.ts:353-360,388-392` (departman: fallback, cost, sıralama).
- grep sonucu (`hourlyRate|monthlySalary|overtimePay|cost`): ek eşleşmeler yalnız saf hesaplayıcılar (`lib/pdksTable.ts`, `pdksHelpers.ts`, `pdksPayroll.ts`) ve bcrypt "cost" yanlış pozitifi (`actions/setPassword.ts:8`, `lib/employeeAuth.ts:5`).
- Ham employee belgesi dönebilecek diğer yollar elle kontrol edildi, hepsi alan seçerek dönüyor: `employees.listLightForImport` (`employees.ts:127-133`), `visitors.listPage/getDetail` (`visitors.ts:161-176`), `accessRules.ts:73-79,596-597`, `lib/cardReadingAudit.ts:94-99`, `hikvisionSync.ts:796-801`, `lib/reportAttendance.ts:30-40` (computePdksTableRow'dan yalnız devam alanları).
- E-posta/zamanlanmış rapor: `reports.ts:443-464` tutar içermiyor. SGK XML: `sgkExport.ts:94-101` ücret yok. AI: `privacyRetention.getAssistantContext` ücret yok. Mobil (`mobile/lib`) ücret alanı okumuyor.
- Türev yan kanal: proje düzeyinde toplam yok; PDKS/bordro ada göre (`cardReadings.ts:540,849`), mesai özeti saate göre, departman project_user'da ada göre (`reports.ts:391`). `employeeCount` ücretten bağımsız (`reports.ts:371`). Fallback `args.hourlyRate` project_user'da hiç kullanılmıyor + maskeli. "Ücreti olan personel" sinyali yok: project_user'da herkes için `null`. Değişen ücretin çıktıyı değiştirmediği ayrıca test edilmiş (`payVisibility.handlers.test.ts` son test).

## 2. Yönetici davranışı + rol kontrolü
- Yöneticide değerler aynı ifadeden geçiyor: departman `?? fallbackRate ?? null` ve `b.cost - a.cost` korunmuş (`reports.ts:353-360,391`); mesai/bordro `resolveHourlyRate` girdileri değişmedi.
- `employees.list/getById`'de yöneticiye `maskPay(undefined,true)` → `undefined` anahtar; Convex serileştirmede undefined alanı atar, tel çıktısı önceki ile aynı.
- `canSeePay = isManager` (`lib/auth.ts:86-87`): rol `undefined` → false (fail-closed). `verified===false` zaten `getCurrentUser`'da reddediliyor (`lib/auth.ts:42-44`). super_admin projesiz → true (rol bazlı, doğru). Orphan getById davranışı korunmuş (`employees.ts:150`, test ediliyor).
- Okuma kapısı = yazma kapısı: `adminMutation` aynı iki rol (`lib/customFunctions.ts:65`) → "boş=temizle" silme riski yok.

## 3. Validator / tipler / UI
- 7 ucun hiçbirinde `returns:` validator yok → runtime uyumsuzluk yok. Frontend tipleri `FunctionReturnType` ile türüyor; app tsc 0.
- UI null'u `0 ₺` göstermiyor: `ReportsSettings.tsx:185` toplamı null'da gizliyor; dışa aktarım `?? "—"` (`exportReport.ts:25,35`, `utils/reportsExport.ts:73`); gerçek 0 sayı olarak kalıyor (test `exportReport.test.ts`).

## 4. Testler
- `customFunctions` passThrough mock'u yalnız sarmalayıcıyı atlıyor; gerçek handler + gerçek hesaplayıcılar + fixture ctx koşuyor. 3 rol × 7 uç, 0/eksik ücret, yabancı proje reddi, orphan ve ücret-değişmezliği kapsanıyor.

## Bulgular
| Önem | Dosya:satır | Senaryo | Öneri |
|---|---|---|---|
| DÜŞÜK | `src/components/settings/sections/ReportsSettings.tsx:148` | Rapor indirme bölümü isAdmin kapılı değil (yalnız hatırlatma kapılı, `:226`); project_user "saatlik ücret" girdisini görür, girdi sunucuda yok sayılır | `!isAdmin` iken girdiyi gizle |
| DÜŞÜK | `src/components/settings/sections/reports/exportReport.ts:24,34` | project_user dışa aktarımında "Mesai Ücreti (₺)"/"Tahmini Maliyet (₺)" sütunları tamamen "—" | Rol yoksa sütunu başlıkla birlikte çıkar |
| DÜŞÜK | `exportReport.ts:25` | Yöneticide ücreti olmayan personel hücresi eskiden boştu, şimdi "—" (sayılar aynı) | Kabul edilebilir; bilgi |
| DÜŞÜK | `convex/payVisibility.handlers.test.ts` (fixture `filter/gte/lte` no-op) | Tarih/filtre zinciri sahte; maskeleme doğru sınanıyor ama tarih aralığı mantığı sınanmıyor | Kapsam için yeterli; ileride convex-test |
| DÜŞÜK | `src/utils/reportsExport.ts:66` | `exportReportsToExcel.department` çağıran yok (ölü kod) | Ayrı temizlikte sil |

Ayrıca (kapsam dışı, önceden var): `sgkExport.buildAphbForMonth` project_user'a TC kimlik no içeren XML döndürüyor (`sgkExport.ts:95`) — ücret değil, ayrı karar konusu.
