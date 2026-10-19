# P2 — Kişi Excel içe/dışa aktarma + toplu kart ataması

## Hedef
`/employees` sayfasında yönetici: (1) Excel şablonu indirir, (2) dolu dosyayı önizleyip toplu içe aktarır (satır bazlı hata raporu), (3) listeyi Excel'e aktarır, (4) seçili kişilere toplu kart atar (kartı okutarak veya elle). (Hik-Connect: Person Import/Export + Batch Issue Cards.)

## Ownership (yalnız bunlara yaz)
`convex/employeeImport.ts` (Faz 0 stub), `convex/lib/employeeImportValidation.ts` (yeni, saf mantık), `src/lib/employees/**` (yeni: excel şablon/parse/export yardımcıları), `src/components/employees/import/**` (yeni diyaloglar), `src/components/employees/EmployeeBulkActions.tsx`, `src/pages/Employees.tsx` (yalnız araç çubuğuna giriş noktaları), testler: `convex/employeeImport.test.ts`, `convex/lib/employeeImportValidation.test.ts`, `src/lib/employees/*.test.ts`, `src/components/employees/import/*.test.tsx`.
**YAZMA:** `convex/employees.ts` (yardımcıları kopyala/yeniden yaz; ihtiyaç doğarsa DUR ve `ask`), schema, `src/App.tsx`.

## Önce oku
`src/pages/Employees.tsx`, `src/components/employees/EmployeeBulkActions.tsx`, `convex/employees.ts` (özellikle `create`, `checkDuplicate`, `DUPLICATE_MESSAGES`, `bulkUpdateStatus`), `convex/schema.ts` `employees` tablosu, `src/lib/reports/export.ts` (exceljs kullanımı), ücret gizleme: `convex/payVisibility.handlers.test.ts`, Ziyaretçiler'de okunmamış kart kullanımı: `cardReadings.getLastUnknownByDevice`.

## İçe aktarma
- Kütüphane: mevcut bağımlılık `exceljs` (DİNAMİK `import()` ile yükle; ana bundle büyümesin). Yeni bağımlılık EKLEME.
- Şablon sütunları (Türkçe başlık), `employees` şemasındaki gerçek alanlara eşle: Ad*, Soyad*, E-posta, T.C. Kimlik No, Sicil/Bordro Kodu, Kart No, Departman (tam yol veya ad), Pozisyon, Firma, Aktif (Evet/Hayır). ÜCRET/BORDRO TUTARI sütunu YOK (ücret gizleme/KVKK).
- İstemci: dosya ≤ 5 MB, ≤ 1000 satır; başlıkları normalize et (büyük/küçük harf, Türkçe karakter); boş satırları atla; dosya içi çift kayıt (aynı T.C./e-posta/kart no) işaretle.
- Sunucu: `employeeImport.importChunk` adminMutation — `rows` (≤100/çağrı), `dryRun: boolean`. Satır bazlı sonuç döner: `created | skippedDuplicate | error` + Türkçe mesaj. Doğrulama + yinelenme kontrolü `convex/lib/employeeImportValidation.ts` içinde SAF fonksiyonlar (employees.ts'teki kuralları aynen uygula: aynı proje içinde T.C./e-posta/kart no çakışması vb.). Departman/pozisyon/firma ADIYLA eşle (büyük/küçük harf duyarsız, aynı proje kapsamında); bulunamazsa satır hatası (otomatik oluşturma YOK).
- Proje kapsamı: kayıtlar çağıran yöneticinin erişebildiği projeye yazılır (employees.create'teki proje belirleme mantığını izle). Başka projeye yazılamaz.
- Cihaz senkronu: mutation İÇİNDE satır başı cihaz senkronu TETİKLEME. İçe aktarma bitince arayüzde ayrı "Cihazlara gönder" düğmesi: mevcut Kişiler sayfasının senkron çağrısını (örn. `deviceSyncRuns.startProjectResync`) nasıl kullandığına bak ve aynısını kullan; yönetici açıkça tıklar.
- UI: "İçe aktar" diyaloğu 3 adım — dosya seç → önizleme (kaç satır geçerli/hatalı/çift, ilk 20 hata) → onayla (chunk'lar sırayla, ilerleme çubuğu, iptal edilebilir) → sonuç özeti + hatalı satırları Excel olarak indir.

## Dışa aktarma
- Sayfadaki mevcut filtreyle eşleşen TÜM kişiler (sayfalıysa sunucu sorgusuyla ardışık sayfa çek, üst sınır 5000). Kullanıcının görebildiği alanlar: ücret/bordro alanı görünürlüğü `payVisibility` kuralına uysun (görmeyen rol için sütun hiç yazılmasın).
- Dosya adı `kisiler-YYYY-MM-DD.xlsx` (TR tarihi).

## Toplu kart ataması
- Seçili kişiler (araç çubuğu "Toplu kart ata"): kartı olmayanları listele. İki mod: (a) elle kart no gir/yapıştır, (b) okuyucu seç + "Okut": `cardReadings.getLastUnknownByDevice` ile tanınmayan kartı sıradaki boş kişiye ata (Ziyaretçiler'deki akışı örnek al; aynı kart iki kez atanamaz).
- `employeeImport.assignCards` adminMutation: `assignments: [{employeeId, cardNumber}]` (≤200). Proje kapsamı kontrolü, kart no çakışması (aynı projede başka kişide varsa satır hatası), format doğrulaması mevcut kuralla. Cihaz senkronu otomatik tetiklenmez; sonuç ekranında "Cihazlara gönder".

## Testler
- Saf doğrulama: boş/eksik zorunlu alan, kötü T.C., dosya içi çift, ad eşleme (Türkçe i/İ), limit aşımı.
- `importChunk`: dryRun yazmaz; başka proje departmanı reddedilir; project_user reddedilir; yinelenen kişi atlanır; 100+ satır reddedilir.
- `assignCards`: çakışma, başka proje, limit.
- Excel yardımcıları: şablon başlıkları, parse (tırnaklı/boş hücre), export'ta ücret sütununun gizlenmesi.

## Kapsam dışı
Ücret/bordro içe aktarma, otomatik departman oluşturma, fotoğraf/yüz/parmak izi içe aktarma (KVKK), CSV içe aktarma, kimlik kuralı (Person ID Rule), ayrılma akışı, schema değişikliği.
