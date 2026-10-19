# C2c UI denetim düzeltmeleri

## Kapanan bulgular

| Bulgu | Dosya:satır | Değişiklik |
| --- | --- | --- |
| #2, #6 | `src/lib/navigationGuard.ts:6`, `src/lib/navigationGuard.test.ts:1` | Router başına modül düzeyinde tek kayıt defteri ve tek push/replace sarmalayıcısı + capture popstate dinleyicisi. Son guard kalkınca orijinal metodlar ve dinleyici geri yüklenir; kayıtların kaldırılma sırası önemsizdir. Tüm aktif formlar onaylanır; herhangi bir pending guard varsa talep no-op olur. Tekrarlanan/eski onay aynı gezinmeyi tekrarlayamaz. Onaylı geri/ileri sonrası yeni gezinmeler de korunur. |
| #2, #6 | `src/components/admin/hooks/useAdminFormGuard.tsx:22`, `src/components/leaves/LeaveForm.tsx:141` | Ortak modüle taşındı. Eski admin/leaves guard ve test dosyaları silindi; dört ortak eski senaryo yeni testte korundu. |
| #1 | `src/pages/Settings.tsx:43` | `dirty || pending` rota korumasına bağlandı; pending talepleri durdurur. Sekmeler aynı rota guard'ından bir kez onay alır; proje değişim koruması korundu. |
| #3 | `convex/devices.ts:871`, `convex/devices.ts:930` | claimDevice/reassignDevice yeni opsiyonel `expectedAssignedProjectId: Id<"projects"> | null` kabul eder. Verilmişse canlı `(assignedProjectId ?? null)` ile karşılaştırılır; uyuşmazlıkta herhangi bir yazma/claim/söküm öncesi `ConvexError({code: "DEVICE_ASSIGNMENT_CHANGED", message: "Cihazın ataması başka bir oturumda değişti. Listeyi yenileyip tekrar deneyin."})` döner. Arg verilmezse eski davranış aynen korunur; dönüş sözleşmeleri değişmedi. |
| #3 | `src/components/admin/AdminDeviceDialog.tsx:89`, `src/components/admin/AdminDeviceDialog.tsx:169`, `src/components/admin/hooks/deviceAssignment.test.ts:1` | Diyalog açılışındaki cihaz kopyası sabitlendi; claim/reassign kararı ve expected arg aynı kopyadan gelir. Yeni kayıt sonrası claim null bekler. Hata formda gösterilir ve diyalog açık kalır. Sekiz handler testi eski/matching davranışı ve atama çakışmasında sıfır yazmayı doğrular. |
| #4 | `src/components/settings/sections/components/HolidayCalendarManager.tsx:35`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:74` | Yıl metni input'ta anında güncellenir; yalnız 4 haneli 1900–2100 değeri sorgu yılına geçer. Blur geçersiz ara metni son geçerli yıla döndürür. |
| #5 | `src/components/admin/AdminUsersPanel.tsx:119`, `src/components/admin/AdminProjectsPanel.tsx:349`, `src/components/admin/AdminDevicesPanel.tsx:62` | Input anlık; sorgu araması 300 ms debounce. Pagination anahtarları debounced aramaya bağlı; her tuşta cursor sıfırlanmaz. |
| #5 | `src/components/leaves/LeaveFilters.tsx:87`, `src/components/settings/sections/ReportsSettings.tsx:53` | Kişi seçenekleri araması ve maliyet raporu saatlik ücret argümanı 300 ms debounce; hata gösterimi/input anlık kalır. Ortak useDebouncedValue dosyası değiştirilmedi. |
| #7 | `src/components/admin/components/UserTableHeader.tsx`, `src/components/admin/components/UserPasswordResetDialog.tsx` (silindi) | Aramada yalnız kendi tanımları bulundu; tüketicisi olmayan iki dosya silindi. |
| #8 | `src/components/admin/components/UserFormDialog.tsx:84`, `src/components/admin/components/UserFormDialog.tsx:337` | super_admin yükseltmesi de ConfirmDestructive açar; tüm projeler ve Admin sayfası erişimi etkilerde açıkça belirtilir. |
| #12 | `src/components/admin/components/UserFormDialog.tsx:62` | Dirty kıyasında iki projectIds kopyası sıralanır; aynı üyeliklerin seçilme sırası dirty üretmez. |
| #11 | `src/components/admin/AdminDeviceDialog.tsx:198`, `src/components/admin/AdminDeviceDialog.tsx:232` | SheetDescription eklendi. registeredId varsa pending bitince onaysız kapanır; kayıtlı cihaz havuzda kalır, yanlış taslak silme uyarısı çıkmaz. |
| #14 | `src/components/audit/AuditFilters.tsx:17`, `src/components/audit/AuditFilters.tsx:20` | Seçili aktörün değeri yüklenirken korunur; özel “Seçili aktör yükleniyor…” öğesi gösterilir. Sonradan URL ile seçilen aktör için de seçenek sorgusu başlar. |

## Kapılar

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: exit 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: exit 0.
- `node_modules/.bin/eslint src convex`: exit 0, hata/uyarı yok.
- `npx vitest run`: 102 dosya / 1053 test geçti; ortak navigation guard 11 test, cihaz atama handler'ları 8 test.
- `npx vite build`: exit 0; yalnız mevcut büyük chunk uyarısı.
- `git diff --check`: exit 0.

## Koordinatörün gerçek oturumda kontrolü (1440 ve 390)

1. Ayarlar Genel/Mesai/Bildirim taslağı → yan menü/Link/geri/ileri: Vazgeç taslağı korusun, Çık yalnız bir kez gezinsin; tekrar dönüşte koruma çalışsın. Sekme ve proje seçimi bir kez onay istesin, kayıt sırasında hiçbir gezinme olmasın.
2. Admin envanter senkronizasyonu başlat → cihaz Sheet açıp değiştir → sync tamamlanınca Sheet'ten çık → sonraki Link/navigate normal çalışsın; ters kapatma sırası da denensin.
3. İki oturumda cihaz A→B taşınırken eski Sheet'ten yalnız ad kaydı: atama değişti hatası, Sheet açık, B'deki kapılar korunmuş olsun. Havuzda açılan cihaz başka oturumda atanmışsa eski claim de reddedilsin.
4. Kayıt başarılı/atama başarısız → Havuzda bırak: taslak silme uyarısı olmadan kapanış; Sheet erişilebilir açıklaması mevcut olsun.
5. super_admin yükseltme onayı; üyelikleri çıkarıp aynılarını farklı sırayla ekleme; yıl alanını silip elle yazma; aktör filtresinde seçili kullanıcı yüklenirken etiket; mobil yatay taşma kontrolü.

Canlı oturuma giriş yapılmadı; tarayıcı akışlarının gerçek oturum kontrolü koordinatörde. #9, #10, #13 ve kapsam dışı sayfalar/ActiveProjectContext C3'e bırakıldı. Commit/push/deploy/migration/DB yazma, paket kurulumu veya npx convex çalıştırılmadı.
