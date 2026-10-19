# Görev: C2c frontend denetim bulgularını düzelt (10 İzinler · 12 Admin · 13 Ayarlar)
Repo: /Users/emreaydin/ngsaccess. ÖNCE `.claude/orca-specs/c2c-common.md` (+ içindeki `c2-common.md`) oku; kurallar geçerli.
Denetim raporu: `.claude/orca-specs/reports/review-c2c-frontend.md` — bulgu numaraları oradaki numaralardır, file:line ve gerekçe orada.

## Hedef (test edilebilir)
Ayarlar'da kirli taslak varken rota/Link/geri-ileri gezinmesi onay ister; navigation guard'ı herhangi bir kurulum/kaldırma sırasında
`navigator.push/replace`'i orijinale döndürür; eski anlık görüntüyle cihaz düzenleme başkasının yaptığı proje atamasını geri alamaz.

## Yapılacaklar (öncelik sırası)
1. **#2 + #6 ortak navigation guard:** `src/lib/navigationGuard.ts` (+ `navigationGuard.test.ts`) — `adminNavigationGuard.ts` ile
   `leaves/lib/navigationGuard.ts`'yi TEK modüle birleştir ve sızıntıyı düzelt: modül düzeyinde tek kayıt defteri (stack/Set) + TEK sarmalayıcı;
   son guard kalkınca orijinal `push/replace` ve popstate dinleyicisi geri yüklenir. Test: A kur → B kur → A kaldır → B kaldır ⇒ `navigator.push === orijinal`
   ve gezinme çalışır; ters sıra da; pending iken istek no-op; onaydan sonra tek navigation; mevcut iki dosyanın tüm test senaryoları korunur.
   Eski iki dosyayı sil, tüketicileri (`useAdminFormGuard.tsx`, `LeaveForm.tsx` ve grep'le bulduğun diğerleri) yeni modüle taşı.
2. **#1 YÜKSEK Ayarlar rota koruması:** `src/pages/Settings.tsx` — yeni ortak guard'ı `dirty || pending` ile bağla (pending'de no-op); sekme ve
   proje guard'ı zaten var, bozma. İzinler/Admin ile aynı onay diyalog davranışı.
3. **#3 cihaz yarışı:** `convex/devices.ts` `reassignDevice` + `claimDevice`'a OPSİYONEL `expectedAssignedProjectId: v.optional(v.union(v.id("projects"), v.null()))`
   ekle; verilmişse ve canlı `assignedProjectId ?? null` farklıysa hiçbir şey yazmadan `ConvexError({ code: "DEVICE_ASSIGNMENT_CHANGED", message: "Cihazın ataması başka bir oturumda değişti. Listeyi yenileyip tekrar deneyin." })`.
   Arg verilmezse davranış AYNEN kalır (canlıdaki eski frontend + diğer tüketiciler). `AdminDeviceDialog.tsx` diyalog açılışındaki atamayı gönderir;
   hata formda gösterilir, form kapanmaz. claim/reassign seçimi de aynı anlık görüntüye dayanır, sunucu tutarlılığı garanti eder. Saf mantık varsa testle.
4. **#4** `HolidayCalendarManager.tsx` yıl alanı: yerel metin state; geçerli 4 haneli yıl (1900–2100) olunca `setYear`, blur'da geçersizse eskiye dön.
5. **#5 debounce (kota):** `AdminUsersPanel`, `AdminProjectsPanel`, `AdminDevicesPanel` arama, `LeaveFilters` kişi araması, `ReportsSettings` saatlik ücret →
   `src/hooks/useDebouncedValue.ts` (300 ms) ile sorgu argümanı debounce; input anında güncellenir, sayfa/cursor sıfırlaması debounced değere bağlı.
6. **Küçükler:** #7 `admin/components/UserTableHeader.tsx` + `UserPasswordResetDialog.tsx` sil (önce `grep -rn` ile tüketici olmadığını doğrula) ·
   #8 `UserFormDialog` super_admin'e YÜKSELTMEDE de ConfirmDestructive (etki metni: tüm projeler + Admin erişimi) ·
   #12 dirty karşılaştırmasında `projectIds` sıralı · #11 `AdminDeviceDialog` Sheet'e `SheetDescription`; `registeredId` set iken kapatma "değişiklikler silinecek"
   yerine "Cihaz kaydedildi, atama tamamlanmadı" der ya da onaysız kapanır · #14 `ActorFilter` seçili aktörün etiketi yüklenirken "all" görünmesin.

## Kapsam dışı (dokunma, C3'e)
#9 updateRole üyelik sürüm kontrolü · #10 Genel ayarlar kısmi patch · #13 useAuditUrlState modül scope'u · diğer sayfalar · `ActiveProjectContext.tsx`.

## Ownership
`src/lib/navigationGuard.ts` (+test, yeni) · `src/components/leaves/**` · `src/components/admin/**` · `src/pages/Settings.tsx` ·
`src/components/settings/**` · `src/components/audit/AuditFilters.tsx` · `convex/devices.ts` (yalnız reassignDevice/claimDevice) ·
`src/hooks/useDebouncedValue.ts` yalnız OKUNUR. Başka dosya gerekiyorsa `ask` ile sor.

## Kapılar (hepsi yeşil olmadan worker_done YOK)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex ·
npx vitest run · npx vite build · git diff --check

## YASAK
commit/push/deploy/migration/DB yazma YOK. `npx convex` koşma. Paket kurma yok. Uygulamaya giriş yok.

## Rapor
`.claude/orca-specs/reports/c2c-ui-fix.md` (bulgu no → file:line → ne değişti) + `worker_done` ≤10 satır: kapanan bulgular, kapı sonuçları,
koordinatörün gerçek oturumda bakması gerekenler (Ayarlar kirli → yan menü/geri; Admin sync + cihaz Sheet sırası).
