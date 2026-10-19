# C2a W-ppl-ui — 02 Kişiler sayfası A2 (frontend) + PPL-1A
Önce `.claude/orca-specs/c2-common.md` oku. Hedef: `docs/ui-scan/pages/02-kisiler/REPORT.md` (tüm "Yeni tasarım" bölümü — kolonlar,
filtre/seçim sözleşmesi, form, ayrıntı, durum metinleri, 390px) + `docs/ui-scan/pages/02-kisiler/mockup.html`. Ek bulgular:
`docs/ux-audit/03_KISILER_VARDIYA_IZIN.md` §5 UX-1A (PPL-03/05/10/11/13/15/18/19/20/30/36/37/39/40/43 — Kişiler kısmı).

## Hedef (test edilebilir)
`/employees` mockup'taki A2 düzende: PageHeader (tek birincil "Personel ekle") → StatInline (proje toplamı, filtreden bağımsız) →
proje cihaz kuyruğu şeridi (mevcut DeviceSyncStatusBanner, dokunmadan tüket) → sol departman filtresi + FilterBar + 42px DataTable +
BulkBar + sayfalama; ad tıklanınca **kişi ayrıntısı Sheet'i açılır** (bugün açılmıyor — PPL-05) ve oradan Düzenle; form Sheet'i
dirty korumalı. 1440 ve 390'da yatay taşma yok; mevcut vitest'ler + yeni saf testler yeşil.

## İş
1. Sayfa: `src/pages/Employees.tsx` URL state `q, department, status, sort, page, size` (TC URL'ye yazılmaz); filtre değişimi sayfa=1 +
   seçim sıfır; currentPage clamp; sıralama tüm filtreli kümeye (sıralamayı `useEmployeeTable.ts`'ten sayfa/üst seviyeye taşı).
   Arama: ad, soyad, e-posta, kart, bordro kodu; `toLocaleLowerCase('tr')`. Departman = yalnız doğrudan bağlı kişiler + "Tüm personel"
   + "Atanmamış". "Seçim yalnız bu sayfayı kapsar" notu.
2. Tablo (`EmployeeTable.tsx`): rapordaki 8 kolon ve kırılım (1100px altı e-posta/pozisyon gizli; 760px altı departman/kart gizli,
   ad altında departman + bordro). Ad = düğme (ayrıntı). Satır menüsü `RowActions`: Ayrıntı, Düzenle, Cihazlara gönder, Mobil giriş
   bağlantısı gönder, Sil (yazma eylemleri mevcut admin yetkisine göre gizli/disabled — yetkiyi genişletme/daraltma). Mobil kart
   gerekiyorsa yeni `EmployeeMobileCard.tsx`.
3. **Kişi ayrıntısı** (`EmployeeDetails.tsx` → Sheet): başlık ad + bordro + aktif/pasif + Düzenle; bölümler Genel bilgiler, Erişim
   yetkileri (mevcut `accessRules.list({projectId})` + groupMembers — form zaten kullanıyor), **Cihaz senkron durumu** ve **Son geçişler**
   (paralel W-ppl-api yazıyor: `api.peopleActivity.employeeSyncStatus({employeeId})` ve `api.peopleActivity.employeeRecentReadings({employeeId, limit})`).
   Bu iki bölümü ayrı bileşen yap (`EmployeeSyncSection.tsx`, `EmployeeRecentReadings.tsx`); `convex/peopleActivity.ts` ve
   api.d.ts satırları oluşunca bağla. İşin sonunda hâlâ yoksa bölümleri "Bu bilgi yakında" EmptyState ile bırak ve raporda yaz —
   koordinatör aynı thread'den bağlama işini sana geri verecek. Durum dili: verified=“Cihazda doğrulandı”, unknown=“Bilinmiyor”
   (asla "senkron" çıkarımı yok), failed=danger, queued/processing=info. Rıza/biyometri eylemi detayda AÇILMAZ (ürün varsayılanı).
   Silinmiş kayıt: "Personel kaydı artık bulunamıyor." + Listeye dön.
4. Form (`EmployeeForm.tsx`, `EmployeeFormFields.tsx`, `FormActions.tsx`, `PhotoUpload.tsx`, `SlideOverPanel.tsx`): rapordaki bölüm
   sırası; label↔id, alan altı hata + `aria-invalid/aria-describedby`, sunucu duplicate hatası ilgili alana, ilk hataya odak;
   `useUnsavedChangesGuard` + `UnsavedChangesDialog` (dirty kapanış ve proje değişimi); pending'de tüm kapatma yolları kilitli;
   kayıt sonrası aşamalı gerçek sonuç (kayıt / e-posta / cihaz kuyruğu). react-hook-form `name=` ve zod şeması YENİDEN ADLANDIRILMAZ.
   `shift` serbest metni "Eski vardiya notu" etiketi; `shiftId`'ye bağlanmaz.
5. Departman ağacı (`DepartmentTree.tsx`, `DepartmentTreeItem.tsx`, `DepartmentProjectHeader.tsx`, `AddDepartmentDialog.tsx`): A2 görünüm,
   `aria-expanded/aria-controls/aria-pressed`, dokunma hedefi 44px; 390'da kapalı başlayan açılır bölüm. Departman yazma yetkisi mevcut backend gibi.
   DİKKAT: `src/components/departments/DepartmentTree.tsx` başka bir dosyadan da import ediliyor olabilir — `unified/components/DepartmentTree.tsx` ayrı dosya (05'in), DOKUNMA.
6. Stat/filtre/bulk/sayfalama (`EmployeeStats.tsx` → StatInline, `EmployeeFilters.tsx` → FilterBar, `EmployeeBulkActions.tsx` → BulkBar:
   onayda ad + bordro listesi; `EmployeePagination.tsx`). Durumlar: rapordaki Türkçe tablo (proje seçilmemiş, ilk kayıt, filtre boş,
   yükleniyor iskelet — geçici 0 yok, hata + gerçek yeniden dene, erişim yok).
7. Saf mantık (filtre/sıra/clamp/arama) için `src/components/employees/lib/*.ts` + vitest.

## Ownership
src/pages/Employees.tsx · src/components/employees/** (yeni dosyalar dahil) · src/components/departments/** · src/hooks/useEmployeeTable.ts ·
src/hooks/useEmployees.ts ve src/hooks/useDepartments.ts (DİKKAT: VisitorForm ve GroupMembersManager de kullanıyor — dışa açık
imza/dönüş geriye uyumlu kalmalı; yeni şey gerekiyorsa yeni export ekle)

## Kapsam dışı
Backend (W-ppl-api) · src/components/sync/** (05'in; yalnız tüket) · EngineeringDepartment sayfası (sidebar'da değil; dokunma) ·
personel import · src/components/ui|shared|layout · convex/**.
