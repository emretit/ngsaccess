# Personel drawer Dalga B — denetim bulgularının büyük kalemleri (yalnız frontend)

Kaynak denetim: `docs/ui-audit-employee-drawer/RAPOR.md` (her bulgunun yer/kanıt/önerisi orada; ÖNCE onu oku). Emre 2026-10-22: "ne gerekiyorsa yapalım". Dalga A (#1 drawer içi link guard, #2 ilk odak başlık, #5 "Değişiklikleri geri al", #6 e-posta yardım metni, #13 çift başlık, #14 ikinci fotoğraf, #15 TC ipucu + aria, #11 dolu alan sayısı, #18 KVKK yazımı) koordinatör tarafından ÇALIŞMA AĞACINDA yapıldı (commit'siz). O değişiklikleri koru, geri alma.

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex sonucu `any[]`'a açılmaz; `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>`.
- UI metinleri Türkçe, cümle düzeni (yalnız ilk harf büyük), sade. Mevcut bileşenler: `src/components/ui/**`, `EmptyState`, `SectionSkeleton`, `StatusBadge`, `EmployeeActivityBoundary`, `useUnsavedChangesGuard`.
- Emre drawer'ın KOMPAKT kalmasını istedi: masaüstünde yükseklik/boşluk artırma. 44 px yalnız mobilde, projenin mevcut deseniyle: `max-sm:min-h-11`.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**`, `mobile/**`, `src/components/ui/**` (ortak bileşen), git stash/checkout/reset. Localhost canlı veriye bağlı: tarayıcıda Kaydet/Sil/İşten çıkar/rıza/parmak izi gibi yazan hiçbir butona BASMA.

## Hedef (test edilebilir)
Düzenleme drawer'ında mevcut erişim üyelikleri formun Erişim bölümünde görünür; yeni kişi kaydı sonrası "Ayrıntılara devam et" aynı kişinin düzenleme drawer'ını açar; silinmiş kayıtta tek boş durum + gerçekten kapatan "Listeye dön"; başka yerde değişen kayıt temiz formda güncellenir, kirli formda uyarı çıkar; parmak izi ve erişim bölümü hataları drawer'ı/taslağı düşürmez; mobilde drawer kontrolleri ≥44 px; mevcut + yeni testler yeşil.

## Ownership (yalnız bunlara yaz)
`src/components/employees/**` (testler dahil), `src/pages/Employees.tsx`.

## Değişiklik (bulgu → iş)
1. **#7 Erişim birleşik** (`EmployeeForm.tsx:148`, `EmployeeFormFields.tsx` Erişim bölümü, `EmployeeDetails.tsx` "Erişim yetkileri"): düzenlemede (`isEditing`) Erişim fieldset'inin başında mevcut üyelikler listesi (kural adı + Aktif/Pasif `StatusBadge`; yoksa "Bu kişiye erişim kuralı atanmamış."). Select etiketi düzenlemede "Ek erişim kuralı", boş seçenek "Ek kural seçilmedi"; yenide mevcut metinler kalır. Yönetici düzenlemesinde EmployeeDetails'taki ayrı "Erişim yetkileri" bölümü kaldırılır (salt-okunur görünümde kalır). `EmployeeForm`'daki eski `employee && !embedded` "Mevcut erişim üyelikleri" satırı ölü koddur, silinir.
2. **#8 Yeni kayıt sonrası devam** (`useEmployeeFormSubmit.ts:68-130`, `EmployeeForm.tsx:207`, `SlideOverPanel.tsx`, `Employees.tsx:224-231`): başarıda kaydedilen id üst akışa iletilsin (`onSave` payload'ı tipli: `{ employeeId: Id<"employees"> }`). Yeni kayıtta başarı aşamasında iki buton: "Tamam" (bugünkü gibi kapatır) + birincil "Ayrıntılara devam et" → drawer kapanmadan aynı kişinin düzenleme moduna geçer (Employees.tsx `editingEmployee`'yi `employees` listesinden id ile bulup set eder; liste henüz gelmediyse yükleniyor durumu). Altına tek satır bilgi: "Rıza ve parmak izi işlemleri kişinin ayrıntılarında." Düzenlemede Tamam davranışı değişmez.
3. **#4 Silinmiş kayıt** (`EmployeeForm.tsx:121`, `SlideOverPanel.tsx`, `EmployeeDetails.tsx:35`): `EmployeeDetails` liste yüklenmiş ve kayıt listede yoksa (ya da `getById` null) yalnız tek `EmptyState` "Personel kaydı artık bulunamıyor." + "Listeye dön" = gerçek drawer kapatma (`onClose` prop'u zaten var, şu an kullanılmıyor). Embedded formdaki "Listeye dön" artık `resetForm`'u çağırmasın: EmployeeForm'a ayrı `onExit` (kapat) ve `onClose` (sıfırla/vazgeç) ayrımı ya da embedded'da boş durumu üst bileşene bırak — seçimini raporla.
4. **#10 Eşzamanlı güncelleme** (`useEmployeeFormData.ts:96-143`, `SlideOverPanel.tsx`): güncel kayıt (`EmployeeDetails`'in `current`'ı) değişince: form temizse yeni değerlerle yeniden kurulsun (ör. key'e paylaşılan alanların imzası/`_creationTime` değil içerik hash'i; ya da `useEmployeeFormData` içinde temizken resetFormData); form kirliyse formun üstünde `role="status"` uyarı: "Bu kayıt başka yerde değişti." + "Güncel hali yükle" (taslağı atar, onaysız değil — `useUnsavedChangesGuard` deseniyle onay). Kendi Kaydet'imizin tetiklediği güncellemede uyarı çıkmamalı.
5. **#12 Yerel hata sınırı** (`EmployeeDetails.tsx`): `EmployeeFingerprintCard` ve (salt-okunur moddaki) "Erişim yetkileri" bölümü `EmployeeActivityBoundary` içine alınsın (başlık + "… yüklenemedi." metni, diğer kartlarla aynı). Yönetici formu (renderEditForm) için de bir sınır: hata olursa "Form yüklenemedi." + "Yeniden dene"; drawer ve diğer kartlar ayakta kalır.
6. **#3 Dokunma hedefi (mobil)**: drawer kapsamında `max-sm:min-h-11`: `FormActions` butonları, form input/select'leri (`EmployeeFormFields`), "Ücret ve diğer bilgiler" summary'si, `EmployeeEmploymentActions` butonu, `EmployeeConsentsCard` butonları, drawer içi metin bağlantıları (inline-flex + min-h). Kapat (X) butonu `ui/sheet.tsx`'te — ona DOKUNMA, raporda not et. Masaüstü görünüm değişmemeli.
7. **#16 Boş katalog**: şirket/departman/pozisyon listesi boşsa select altında `text-xs` yardım: "Henüz şirket tanımlı değil." / "Henüz departman tanımlı değil." / "Henüz pozisyon tanımlı değil." (yükleniyor durumu zaten skeleton). Erişim kuralı listesi boşsa: "Etkin erişim kuralı yok."
8. **#17 Bekleme metni** (`EmployeeForm.tsx:217`, `FormActions.tsx`): `FormActions`'a ayrı `busyLabel`; seçenekler yüklenirken "Yükleniyor", fotoğraf yüklenirken "Fotoğraf yükleniyor", kaydederken "Kaydediliyor". Kaydetme sürerken form `aria-busy="true"`.
9. **Testler** (mevcut desen: vitest + renderToStaticMarkup / mock'lar; örnek `EmployeeDetails.test.tsx`, `EmployeeFormFields.test.tsx`): düzenlemede üyelik listesi formda + ayrı bölüm yok; "Ayrıntılara devam et" yalnız yeni kayıt başarısında; silinmiş kayıtta tek boş durum ve onClose çağrısı; parmak izi kartı hata sınırında; busyLabel metinleri; boş katalog yardımları. Mevcut testler korunur/güncellenir.

## Kapsam dışı
- #9 fotoğraf anında yükleme (kayıt Kaydet'e kadar değişmiyor; yalnız depolama yetimi — ayrı iş). Rıza ilk kayıtta alınsın mı, Kişiler/Personel adlandırması (ürün kararı, Emre'de). `src/components/ui/**`, `convex/**`.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run src/components/employees src/pages src/lib` → hepsi yeşil
- İsteğe bağlı canlı bakış: Orca tarayıcı `orca tab create --url http://localhost:8081/employees --json` → her komutta `--page <id>`; yazan butona basma; bitince `orca tab close --page <id>`.

## Rapor
`worker_done` ≤10 satır: madde başına yapıldı/yapılmadı + dosya:satır, kapı sonuçları (sayılarla), #3'te X butonu notu, #4/#10'daki tasarım seçimi.
