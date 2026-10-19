# P2b — Kişiler: Excel içe/dışa aktarma ARAYÜZÜ (P2'nin kalan frontend işi)

Önceki worker (P2) yalnız backend'i yazdı: `convex/employeeImport.ts` (`importChunk`, `assignCards`) + `convex/lib/employeeImportValidation.ts` (saf doğrulama + 3 test). Arayüz, Excel yardımcıları ve entegrasyon YAPILMADI. Bu senin işin. Gereksinim ayrıntısı: `.claude/orca-specs/kiyas-p2-kisi-import.md` — "İçe aktarma" ve "Dışa aktarma" bölümlerini oku (toplu kart UI'ı bu pakette YOK).

## Mevcut backend sözleşmesi (DEĞİŞTİRME; başka worker test/uyum için dokunabilir)
`api.employeeImport.importChunk({ projectId, rows, dryRun })` → `{ rowNumber, status: "created" | "skippedDuplicate" | "error", message }[]`. `rows[i]`: `rowNumber, firstName, lastName, email, tcNo?, payrollCode?, cardNumber, department?, position?, company?, isActive?` (email ve cardNumber string zorunlu: boş hücrede boş string gönder; geçerliliği sunucu söyler). En çok 100 satır/çağrı.

## Ownership (yalnız bunlara yaz)
`src/lib/employees/**` (yeni: `importTemplate.ts`, `parseEmployeesXlsx.ts`, `exportEmployeesXlsx.ts` vb.), `src/components/employees/import/**` (yeni: `EmployeeImportDialog.tsx` vb.), `src/components/employees/EmployeeBulkActions.tsx` ve `src/pages/Employees.tsx` (YALNIZ giriş noktası ekleme), testler: `src/lib/employees/*.test.ts`, `src/components/employees/import/*.test.tsx`.
**YAZMA:** `convex/**` (backend başka worker'da), schema, App.tsx, routeMeta, `src/components/employees/**` içindeki diğer dosyalar.

## UYARI — paylaşımlı dosyalar
`src/pages/Employees.tsx` ve `src/components/employees/**` içinde UI audit koordinatörünün COMMIT'LENMEMİŞ değişiklikleri var. Mevcut satırları yeniden düzenleme/biçimlendirme/taşıma; YALNIZ ekleme yap (yeni import satırı, yeni düğme/diyalog). Başka biçimlendirme değişikliği yapma (hunk'lar commit'te ayrılacak).

## İş
1. `exceljs` DİNAMİK `import()` ile (yeni bağımlılık YOK; `src/lib/reports/export.ts` kullanımına bak).
2. Şablon indir: Türkçe başlıklar — Ad*, Soyad*, E-posta, T.C. Kimlik No, Sicil/Bordro Kodu, Kart No, Departman, Pozisyon, Firma, Aktif (Evet/Hayır); ücret sütunu YOK; ilk satır örnek açıklama.
3. Parse: başlıkları normalize et (büyük/küçük harf, Türkçe karakter, boşluk); dosya ≤ 5 MB, ≤ 1000 satır; tamamen boş satırları atla; hücre değerlerini string'e çevir (sayı olan T.C./kart no baştaki sıfırı kaybetmesin: hücreyi metin olarak oku); `rowNumber` = Excel satır no.
4. "İçe aktar" diyaloğu: dosya seç → önizleme (`dryRun: true` ile chunk'lar; geçerli/hatalı/çift sayıları, ilk 20 hata satırı) → onayla (`dryRun: false`, sırayla ≤100'lük chunk'lar, ilerleme çubuğu, iptal) → sonuç özeti + hatalı satırları Excel olarak indir (hata mesajı sütunlu). Bittiğinde "Cihazlara gönder" için Kişiler sayfasının mevcut senkron yöntemini nasıl çağırdığına bak ve aynısını kullan (yönetici tıklar; otomatik değil).
5. Dışa aktar: sayfadaki aktif filtreyle eşleşen kişiler (mevcut `employees.list` / sayfalama kalıbını izle; üst sınır 5000). Ücret/bordro alanları görünürlüğü `payVisibility` kuralı: görmeyen rol için sütun yazılmaz. Dosya adı `kisiler-YYYY-MM-DD.xlsx` (TR tarihi).
6. Giriş noktaları: Kişiler araç çubuğuna "İçe aktar", "Dışa aktar", "Şablon indir" (yalnız admin rolü; `useActiveProjectScope().isAdmin` kalıbı). Aktif proje yoksa devre dışı + açıklama.
7. KVKK: dosya içeriğini `console.log`'lama, saklama, URL'ye koyma.

## Testler
Parse (Türkçe başlık, baştaki sıfır, boş satır, limit aşımı), şablon başlıkları, export'ta ücret sütununun gizlenmesi, diyalog akışı (önizleme → onay → sonuç; hatalı satır indirme).

## Kapsam dışı
Toplu kart UI'ı (sonraki paket), backend değişikliği, CSV, ücret içe aktarma, fotoğraf/biyometri.
