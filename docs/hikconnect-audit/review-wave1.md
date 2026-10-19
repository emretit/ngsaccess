# Dalga 1 denetimi (Claude, salt-okuma)

**Sonuç:** 3 Engel · 9 Düzeltilmeli · 9 Not. Birleştirmeden önce 3 Engel düzeltilmeli; yetki/IDOR tarafı temiz.

## Kendi koşumum

- `npx vitest run convex/alarms.test.ts convex/employeeImport.test.ts convex/leaveRequests.test.ts convex/attendanceCorrections.test.ts convex/lib src/lib/employees src/components/alarms src/components/employees/import` → **83 dosya / 989 test geçti**. (İlk koşumda 3 dosya/7 test `pdksTable.test.ts` vb. kırmızıydı; başkasının commit'siz işi, ikinci koşumda yeşile döndü.)
- `tsc --noEmit -p tsconfig.app.json` → **1 hata**: `convex/lib/pdksNight.handlers.test.ts(23,155) TS1360` (başkasının işi). İlk koşumda `OvertimeSettingsForm.tsx` `nightCombineMode` hatası vardı, sonra kayboldu. `src/lib/reports/**` hatası yok. Denetlenen dosyalarda tip hatası 0.
- `eslint` (denetlenen tüm dosyalar) → 0 hata, 0 uyarı. `any`/`as any`/`!`/doğrudan `auditLog` insert yok; snake_case yok.

## Odak soruları — kısa yanıt

1. **Yetki/IDOR: temiz.** `alarms.list/getSettings/saveSettings/acknowledge` `getProjectIdsForUser` + `isProjectAllowed` ile proje kapsamlı; `acknowledge` başka projenin id'sinde tümünü geri alıp hata veriyor. `leaveRequests` ve `attendanceCorrections` çalışan fonksiyonları `employeeId/projectId`'yi yalnız `ctx.employee`'den alıyor (arg yok); `withdraw` `employeeId === ctx.employee._id` kontrol ediyor; admin kararı hem `row.projectId` hem `employee.projectId` eşleşmesini kontrol ediyor. `emailPayload` `internalQuery`.
2. **Rol: temiz.** Tüm yazma/ayar fonksiyonları `adminMutation/adminQuery` (project_user `Bu işlem için yetkiniz yok`). `alarms.list/summary` `authedQuery` (salt-okuma, kabul).
3. **KVKK:** audit/log/e-posta içinde kişi verisi yok (import audit yalnız sayaçlar; e-posta yalnız cihaz adı/olay/önem/zaman; `console.error` yalnız HTTP durum kodu). Yüklenen Excel saklanmıyor, sunucuya hiç gitmiyor (tarayıcıda parse). Export'ta ücret alanı hiç yok (kural karşılanıyor). Açık: D8 (export audit'siz), D6 (alıcı değişikliği audit'siz).
4. **Enjeksiyon:** (a) E-posta HTML'inde cihaz/etiket/önem/zaman `escape()` ile kaçışlanıyor — temiz (konu satırı sabit). (b) Excel: ExcelJS string hücreyi `t="s"` yazar; `=cmd|…` değeriyle denedim, hücre tipi String (3) çıktı → formül olarak çalışmaz. Hata raporu yalnız sabit sunucu mesajı + satır no içeriyor. CSV'ye çevrilirse risk doğar (N1).
5. **Kota:** yeni cron/polling yok. `importChunk` 100 satır ≈ 300 index araması + ≤1500 doküman (3×take(500)) → mutasyon sınırlarının çok altında, 1000 satır için dry+real ≈ 20 çağrı: kabul. `alarms.list` 2000 satır/2 MB bütçesi doğru uygulanmış. `summary` reaktif ve tüm projeleri okuyor (D4).
6. **Doğruluk:** bkz. E3, D1, D2, D5, D7 aşağıda. Tarih pencereleri `Intl … Europe/Istanbul` ile hesaplanıyor (doğru). Aynı gün iki pending düzeltme kapalı (index okuması OCC ile serileşiyor); çift onay kapalı (`status !== "pending"`). İzin geri çekme `delete`; bakiye otomatik düşülmediği için (leaveBalances yazan kod yok) tutarsızlık yok; pending izin çakışma rezervi saymadığı için onaylı takvimi bozmaz.
7. **Test kalitesi:** gerçek handler çağrılıyor, ama bkz. D1/N8.
8. **Kural uyumu:** temiz (yukarıda).

---

## ENGEL

### E1 · `assignCards` eski kartı panelden sökmüyor, yeni kartı göndermiyor
`convex/employeeImport.ts:109` · Kaynak: `convex/employees.ts:302-351`
- **Sorun:** `ctx.db.patch(cardNumber)` doğrudan yazıyor. `employees.update` kart değişince (a) eski kartı IDE panellerinden `deleteIdeUserFromPanels` ile siliyor ("yoksa eski kart hâlâ kapı açar" yorumu), (b) `syncEmployeeToDevicesInternal` + `syncEmployeeToIdePanels` zamanlıyor. `assignCards` ikisini de yapmıyor.
- **Senaryo:** Ali'nin kartı 111 → toplu atamayla 222. Panelde 111 kayıtlı kalır (kapı açmaya devam eder), 222 panele hiç gitmez. Kayıp kart senaryosunda güvenlik açığı.
- **Düzeltme:** kart değişen her çalışan için `employees.update`'teki bloğu ortak yardımcıya çıkarıp çağır (`resolveEmployeeIdeDeviceIds` + `deleteIdeUserFromPanels` eski değerle + iki sync). Yardımcı test: "kart değişince 3 zamanlama, değişmeyince 0".

### E2 · Excel ayrıştırıcı sayısal hücrede çöküyor
`src/lib/employees/parseEmployeesXlsx.ts:20`
- **Sorun:** `cell.numFmt.split(";")` — ExcelJS'te biçimsiz (General) sayı hücresinde `numFmt === undefined` (tipler `string` diyor, bu yüzden tsc yakalamıyor). Kanıt: ExcelJS ile yazıp yükledim, `Cannot read properties of undefined (reading 'split')` fırladı.
- **Senaryo:** Kart No sütununa `12345` (sayı) yazan herkes için dosya komple "Dosya okunamadı"/TypeError ile reddedilir. Mevcut test yalnız `numFmt` verilmiş hücreleri kapsıyor.
- **Düzeltme:** `cell.numFmt?.split(";")[0]?.trim()`. Test ekle: biçimsiz sayı hücresi (`addRow(["Ali","Veli","a@b.c",...,12345])`) → `cardNumber: "12345"`.

### E3 · Tek yönlü düzeltme onayı mevcut kaydın diğer saatini siliyor
`convex/attendanceCorrections.ts:82`
- **Sorun:** `correctionType: "checkIn"` için `input.exitTime` `undefined`; `ctx.db.patch(..., { exitTime: undefined })` alanı **siler**. Mevcut PDKS kaydı varsa (örn. cihazdan gelen çıkış 17:05) giriş düzeltmesi onaylandığında çıkış kaybolur. `checkOut` için tersi.
- **Senaryo:** Çalışan "giriş 08:10 unutuldu" talebi açar, günün kaydında çıkış 17:05 var → onay sonrası kayıt `entry 08:10, exit yok`; mesai hesabı bozulur.
- **Düzeltme:** `entryTime: input.entryTime ?? existing.entryTime`, `exitTime: input.exitTime ?? existing.exitTime`; birleşik değerle `entry < exit` doğrulaması yap. Test: mevcut kayıt + `checkIn` talebi → çıkış korunur.

---

## DÜZELTİLMELİ

### D1 · Alarm e-posta debounce'u "gönderim"e değil "olay varlığına" bakıyor; testi yok
`convex/alarms.ts:104-105`, `convex/lib/alarmNotify.ts`, `convex/alarms.test.ts:113-121`
- **Sorun:** `sentRecently` = son 10 dk'da aynı cihaz+etiket+kategoride *başka olay var mı*; e-posta gerçekten gitti mi bakılmıyor. Sonuçlar: (1) zincirleme bastırma — aynı arıza 5 dk arayla tekrarlarsa ilk e-postadan sonra bir daha e-posta gelmez (her bastırılan olay bir sonrakini bastırır); (2) iki olay aynı anda eklenirse (action'lar ikisi de eklendikten sonra çalışır) **ikisi de** birbirini görüp bastırılır, hiç e-posta gitmez; (3) `take(100)` cihazın tüm kategorilerini (kart okuma vb.) sayar, yoğun cihazda eşleşme 100'ün dışında kalıp tekrar mail atılır; (4) önceki olay e-posta kapalıyken geldiyse sonraki bastırılır.
- **Test:** `emailPayload` testi mock'u `withIndex` koşulunu yok sayıyor (`take` hep `events.slice`); `sentRecently: true` yolu hiç koşmuyor; `sendAlarmEmail.send` için test yok (kaçışlama, alıcı döngüsü, Resend yok/hata).
- **Düzeltme:** gönderimi kaydet (`deviceEvents.notifiedAt` ya da `alarmSettings`'e son-gönderim map'i) ve debounce'u "son 10 dk'da `notifiedAt` dolu aynı etiket" ile yap; tetiği mutasyonda atomik yap. Testler: bastırma, 11. dk'da yeniden gönderim, eşzamanlı iki olay → tam 1 mail; action testi (fetch mock) ile HTML kaçışlama.

### D2 · Bildirim yalnız bir olay yolunda tetikleniyor
`convex/deviceEvents.ts:160-166` ve `convex/cardReadings.ts:1648`
- **Sorun:** `deviceEvents` tablosuna Hik olayı yazan ikinci yol (`cardReadings.ts` gateway/worker, `classifyHikEvent` ile aynı kategori/önem) tetik içermiyor. Alarm yalnız HTTP köprüsünden gelirse e-posta gider.
- **Senaryo:** Gateway cihazı kapı zorlama alarmı verir → listede görünür, e-posta gitmez.
- **Düzeltme:** tetiği küçük bir `notifyAlarmIfNeeded(ctx, eventId, …)` yardımcısına al, iki insert'te de çağır (veya tek insert fonksiyonuna birleştir).

### D3 · `saveSettings` audit'siz
`convex/alarms.ts:82-93`
- **Sorun:** Alarm alıcısı ekleme/çıkarma/e-posta açma yazılırken `writeAudit` yok. Alıcı listesi cihaz adı + olay bilgisinin dışarı aktığı kanal.
- **Senaryo:** Yönetici dış adres ekler, kim ne zaman yaptı izlenemez.
- **Düzeltme:** `writeAudit(... targetTable: "alarmSettings", oldValue/newValue: { emailEnabled, minSeverity, recipientCount })`. Adresleri değil sayıyı yaz (KVKK).

### D4 · `alarms.summary` tüm projeleri sayıyor ama UI aktif proje başlığı altında gösteriyor
`convex/alarms.ts:45-55`, `src/pages/Alarms.tsx` (özet şeridi)
- **Sorun:** `args: {}` → kullanıcının tüm projeleri; sayfa seçili projeyi gösteriyor. super_admin'de proje×2 sorgu×200 satır ve her alarm eklenişinde tüm abone istemcilerde yeniden çalışır.
- **Senaryo:** Proje A'da 0 alarm, B'de 3 kritik → A sayfası "Kritik açık: 3" der.
- **Düzeltme:** `projectId` arg'ı ekle (yetki kontrolüyle), yalnız o projeyi oku.

### D5 · İçe aktarma `employees.create` ile aynı kuralları uygulamıyor
`convex/employeeImport.ts:44-53,56-63` · Kaynak: `convex/employees.ts:20-37,199-204,218-227`
- **Fark 1 (tekillik kapsamı):** `create/update` kart/e-posta/TC'yi **global** tekil tutuyor (`findDuplicateEmployee`); import yalnız **proje içi** (test `allows identifiers already used in another project` bunu kutsuyor). Aynı kart iki projede kalabilir → okuma eşleşmesi belirsiz.
- **Fark 2 (e-posta):** import `toLowerCase()` ile küçültüp arıyor; `create` ham yazıyor → eski karışık harfli kayıtlar `by_email` aramasında kaçar, mükerrer oluşur.
- **Fark 3 (senkron):** `create` her kayıtta Hik + IDE sync zamanlıyor; import hiçbirini yapmıyor, yalnız diyalogdaki "Cihazlara gönder" düğmesi var. Düğmeye basmadan kapatılırsa kartlar cihaza gitmez.
- **Düzeltme:** global kontrole karar ver (tutarlılık için `findDuplicateEmployee` kullan, ya da bilinçli farkı belgele + create'i uyumla); e-postayı iki tarafta aynı normalleştir; import sonunda otomatik `startProjectResync`/yeni kayıt başına sync zamanla veya kapatırken uyarı göster.

### D6 · İzin başvurusunda çift/sınırsız bekleyen talep
`convex/leaveRequests.ts:16-20`
- **Sorun:** Yalnız *onaylı* çakışma engelleniyor; aynı tarih için N pending eklenebilir, sayısı sınırsız (düzeltme tarafında günde 1 pending kuralı var, izinde yok). Yönetici ilkini onaylayınca diğerleri `LEAVE_OVERLAP` hatasına düşer; çalışan kuyruğu şişirebilir.
- **Düzeltme:** aynı çalışanda çakışan `pending` varsa reddet + çalışan başına toplam pending üst sınırı (örn. 10). Test ekle.

### D7 · `attendanceCorrections.decision` içindeki `upsertManual` kopyası birebir değil
`convex/attendanceCorrections.ts:78-88` ↔ `convex/pdksRecords.ts:27-38,78-113`
- **Farklar:** (1) `buildShiftResolver` yok → `validateManualPdksInput(…)` vardiyasız çağrılıyor; gece vardiyalı çalışanın "22:00–06:00" düzeltmesi onayda `Çıkış saati giriş saatinden sonra olmalı` ile **onaylanamaz**. (2) Yetki bloğu farklı (kopya daha sıkı: tüm roller için proje üyeliği — kabul). (3) `note` kaynağı: kopya `note ?? row.reason`; orijinal doğrudan arg. (4) Tek yönlü düzeltmede diğer saati silme (E3). Audit gövdeleri ve `status:"present"`, `manualEntry`, `editedBy/At` aynı.
- **Düzeltme:** `upsertManual` gövdesini `lib/pdksManualWrite.ts`'e çıkarıp iki yerden çağır (kopyalamayı bırak); vardiya çözümünü ekle. Test: gece vardiyalı çalışan düzeltmesi onaylanır.

### D8 · Çalışan dışa aktarma audit'siz (KVKK)
`src/lib/employees/exportEmployeesXlsx.ts`, `src/pages/Employees.tsx` (Dışa aktar düğmesi)
- **Sorun:** En çok 5000 kişinin T.C. kimlik no + e-posta + kart no bilgisi tarayıcıda dosyaya yazılıyor; sunucuda iz yok (mutasyon çağrılmıyor). Düğme yalnız `isAdmin` ile gizli — yetki sunucuda zorlanmıyor (veri zaten listeden istemciye geliyor, bu yüzden bu bir sızıntı değil, ama hesap verebilirlik eksik).
- **Düzeltme:** indirmeden önce küçük bir `adminMutation` (`employeeExports.log`: projectId + satır sayısı) ile `writeAudit`; T.C. sütununu kullanıcı seçimine bağla veya maskele (varsayılan kapalı).

### D9 · Şablon, sunucunun zorunlu alanlarıyla uyuşmuyor
`src/lib/employees/importTemplate.ts:1-9`
- **Sorun:** Şablonda yalnız `Ad*` ve `Soyad*` zorunlu işaretli; sunucu `E-posta` ve `Kart No` da zorunlu istiyor (`employeeImportValidation.ts:25-26`). Örnek satırda kart no boş → silinmezse hata.
- **Düzeltme:** `E-posta*`, `Kart No*` yap, açıklama satırını güncelle, örnek satırı geçerli doldur (parser `*`'ı zaten normalize ediyor).

---

## NOT

- **N1 · Formül enjeksiyonu (hardening):** xlsx'te sorun yok (kanıtlandı). Veri ileride CSV'ye de çıkarılırsa `= + - @` başına `'` ekleyen ortak yardımcı yaz (`exportEmployeesXlsx.ts`).
- **N2 · Yerel `escape`:** `sendAlarmEmail.ts:17` `convex/lib/escapers.ts` (`escapeHtml`, `sendEmail.ts`'te kullanılıyor) varken kendi kaçışını yazmış; ortak olanı kullan.
- **N3 · Alıcı döngüsü:** `sendAlarmEmail.ts:18-21` bir alıcıda `fetch` istisnası kalan alıcıları atlatır (`try` döngü dışında). Her alıcı için ayrı `try`.
- **N4 · Zamanlama hatası riski:** `deviceEvents.ts:163` `runAfter` throw ederse `recordHikDeviceEvent` insert'i geri alınır (olay kaybı). Pratikte yalnız geçersiz arg/fonksiyon yoksa olur (tsc kapsıyor); yine de `try/catch` ile olay kaydını koru.
- **N5 · Tarih biçimi:** `alarms.list` `from/to` ham string olarak indeks/`<=` karşılaştırmasına giriyor (`Date.parse` yalnız doğrulama). İstemci `toISOString()` gönderdiği için bugün sorun yok; `new Date(from).toISOString()`'a normalleştir (milisaniyesiz `...00Z` ile `...00.000Z` sınırında 1 olay kaçar).
- **N6 · `acknowledge` ayrıntıları:** `acknowledged: args.ids.length` mükerrer/zaten onaylıları da sayıyor; `event.category` alarm/exception mı kontrol edilmiyor (yalnız kendi projesi, zararsız).
- **N7 · Sayfalama:** `attendanceCorrections.listPending` ofset-imleçli ve proje başına `take(200)` (sessiz kesme); onay sonrası ofset kayar. 200'ü aşarsa `isDone` yanlış `true` olur.
- **N8 · Test boşlukları:** `EmployeeImportDialog.test.tsx` tek render testi (dry-run → önizleme → import → iptal → hata raporu akışı yok); `alarms.list` testi `convex-helpers/stream`'i tamamen mock'luyor (gerçek `maximumRowsRead/SplitRequired` davranışı doğrulanmıyor; UI `scanLimitReached`'i hiç kullanmıyor, 0 sonuç + "daha fazla yükle" durumunda "Olay bulunamadı" gösterir); `recordHikDeviceEvent` tetiği için test yok.
- **N9 · KVKK ince nokta:** `leaveRequests.listMine` çalışana `approvedBy` (kullanıcı id) ve notları döndürüyor; `sick` izin notu sağlık verisi olabilir — yalnız kendi kaydı olduğu için kabul, UI'da not alanına "sağlık bilgisi yazmayın" uyarısı düşünülebilir. İstemci tarafı yinelenen-kontrolü `tr-TR` küçültüyor, sunucu `toLowerCase()` (yalnız "I/İ" içeren e-postalarda uyuşmaz).

---

## Özet

| Engel | Düzeltilmeli | Not |
|---|---|---|
| 3 (E1, E2, E3) | 9 (D1–D9) | 9 (N1–N9) |

## Önerilen birleştirme sırası

1. **Başvuru backend** (`requestRules`, `leaveRequests`, `attendanceCorrections`): önce E3 + D7 (ortak yazma yardımcısı + vardiya), D6; şema hunk'ları (`attendanceCorrections`, `leaves.source`, yeni indeksler) bununla.
2. **Kişi import**: E2 (tek satır) + D9 hemen; E1 + D5 düzeltmeden `assignCards` canlıya çıkmamalı (BatchCardAssign UI'ı da buna bağlı). `importChunk` D5 kararına kadar bekleyebilir.
3. **Alarm**: şema (`alarmSettings`, `acked*`, indeks) ve `list/acknowledge` + sayfa güvenle birleşir; e-posta tetiğini (D1, D2) ve D3/D4 düzeltilene kadar `emailEnabled` yolunu kapalı tut (ayar varsayılanı zaten `false`).
4. D8 ve Not'lar ayrı küçük PR.

Not: bu rapor sırasında hiçbir kod/komut (`commit/push/deploy/npx convex`) çalıştırılmadı; yalnız bu dosya yazıldı.
