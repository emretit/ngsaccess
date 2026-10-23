Kapı Planları Faz 2 — 2026-10-23

Beş alt iş tamamlandı:

1. Şablonla durum planı — `convex/lib/doorStatusPlan.ts:143`, `convex/doors.ts:534`, `DoorPlanDialog.tsx:64`: sunucu şablonun güncel haftasını doğrular ve kopyalar; gece yarısı/Pazar→Pazartesi bölünür, 24:00 cihaz için 23:59:59 olur, gün başına 8 sınırı doğrulanır. Şablon proje kapsamı/arşiv kontrolü var. Elle düzenleme korunur. Şablon adı ve değişiklik uyarısı listelenir; şablon düzenlemek kapıya otomatik gönderim başlatmaz.
2. Haftalık doğrulama — `convex/lib/doorStatusPlan.ts:173`, `door-dialog/DoorVerifyPlanEditor.tsx:79`, `convex/lib/gatewayCommand.ts:825`: eski tek pencere geçerli; günlük 8, çakışma ve saat doğrulaması; saniyeler/modlar korunur. Resmi sözleşmeye göre VerifyWeekPlanCfg → VerifyPlanTemplate → CardReaderPlan kullanılır; fiziksel readerNo plan/template slotudur, kapının bağlı okuyucuları tek tek gönderilir. Eski cardAndFace değeri resmi faceAndCard değerine çevrilir.
3. Toplu uygulama — `DoorPlansTab.tsx:62`, `CopyDoorPlansDialog.tsx:16`, `bulk.ts:13`: 1–50 kapı; kaynak kapının tüm planları veya zaman şablonu; her kapıda yetkili updatePlans ardından apply. Kayıt hatasında o kapıya gönderim yok; diğer kapılar devam eder. Kapı başına sonuçlar ve yalnız başarısız kaydın/planın tekrarı var. Yeni toplu mutation yok.
4. Tatil planı — `convex/doors.ts:647`, `convex/lib/gateway/plans.ts:225`, `convex/lib/gatewayCommand.ts:708`: seçilen yılın proje + Türkiye geneli tatilleri by_project_date ile okunur; ardışık tarihler birleştirilir, en fazla 16 tarih aralığı. Yarım gün kayıtlarının da tam gün uygulanacağı UI'da açıkça yazılıdır. Explicit isSupport* bayrakları ve plan/grup kapasiteleri doğrulanmadan PUT yapılmaz. Tarihli DoorStatusHolidayPlanCfg → CSV holidayPlanNo ile DoorStatusHolidayGroupCfg → DoorStatusPlanTemplate holidayGroupNo zinciri kullanılır; cihaz içi slotlar transaction ile kapılara ayrılır, kapasite aşımında kesilmeden hata verilir.
5. Gönderim durumu — `convex/doors.ts:613`, `DoorPlansTab.tsx:62`: sunucu internal mutation ile plan başına başarı/hata ve ortak uygulanma zamanı tutar. Bir planın başarısı diğerinin hatasını silmez. Kaydetme sürümü yeniler; geç gelen eski gönderim sonucu yeni sürümü başarılı göstermez, yeniden gönderim ister. Listede gönderilmedi/kaydedildi gönderilmedi/gönderildi saati/hata gösterilir.

Şema: yalnız doors alanları; 9 yeni opsiyonel kök alan `hikDoorHolidayPlan`, `hikDoorHolidaySlots`, `hikDoorStatusTemplateId`, `hikDoorStatusTemplateUpdatedAt`, `hikPlanSavedAt`, `hikPlanRevision`, `hikPlanAppliedAt`, `hikPlanApplyError`, `hikPlanResults`; mevcut `hikVerifyPlan` içinde opsiyonel `weekly`. Yeni tablo/index/zorunlu alan yok; çalışma ağacındaki önceden eklenmiş accessLogs indexine dokunulmadı. Yeni kayıtlı Convex fonksiyonları mevcut doors modülünde; codegen çalıştırılmadı.

Koordinatörün kapsam genişletmesi: `convex/actions/hikQueueWorker.ts:214` içindeki yalnız status/verify case'leri ortak yardımcıya yönlendirildi; retry/attempt/backoff ve diğer case'ler korundu. `convex/doorStatusPlan.integration.test.ts` ve `convex/deviceCenter.test.ts` sadece yeni capability mockları/resmi templateName sözleşmesi için güncellendi; mevcut doğrulamalar kaldırılmadı. Durum planında mevcut doorNo+100 template slotu koordinatör isteğiyle korundu; doğrulama planında eski doorNo+100 yerine readerNo kullanılıyor.

Son doğrulama:

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: 0 hata, exit 0.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: 0 hata, exit 0.
- `node_modules/.bin/eslint src convex`: 0 error, 1 mevcut unused-vars warning (convex/attendanceCorrections.test.ts:8).
- `node_modules/.bin/vitest run`: 353 dosya, 3891 test geçti; 0 başarısız (21.18 s).
- `node scripts/find-node-leak.mjs`: exit 0.
- `git diff --check`: temiz.

İlk koşudaki kapsam dışı PdksRecordsResults.tsx analysis tip hatası son koşuda yok; bu dosyaya dokunulmadı. İlk tam suite koşusundaki iki yük altında timeout sonraki tam suite koşularında tekrarlanmadı.

Cihazda doğrulanmadı. Gateway çağrıları mock'lu testler direct/queue, tatil desteği yok/bilinmiyor, kapasite eksikliği, ağ hatası, haftalık boş günlerin temizlenmesi, readerNo bağlantısı ve tatil bağlantısının kaldırılmasını kapsar. ISAPI kaynağı: repo kökündeki `ISAPI_FingerPrint Terminals_Pro Series.pdf`, 7.4.2.1, 7.7.2.2–5, 10.3.2.3/7 ve 10.3.6.1; koordinatörün sağladığı `/tmp/isapi-pdf/fp.txt` metni okundu. Gerçek firmware'de isSupport* cevapları, tatil kapasitesi, korunan doorNo+100 durum template slotunun kapasiteye uygunluğu, readerNo plan bağlaması, 23:59:59 ve tatilin haftalık plana üstünlüğü onay gerektiren cihaz testiyle doğrulanmalı. Canlı cihaz/Convex çağrısı, DB yazımı, migration, codegen veya git yazma komutu çalıştırılmadı.

---

Denetim düzeltmeleri — 2026-10-23 (task_f74485c17e22)

Aşağıdaki kayıt önceki Faz 2 raporundaki ilgili davranışları günceller. Önce regresyonlar yazılıp çalıştırıldı: `/tmp/door-audit-red.log` koşusunda 16 başarısız / 27 başarılı test, dört dosya kırmızı; Y1 ve O1–O4'ün her biri beklenen davranış farkında başarısız oldu. Düzeltmeler ve ek sınır senaryolarıyla toplam 35 test eklendi.

| Bulgu | Sonuç ve yer | Yeni regresyon testi |
|---|---|---|
| Y1 | Düzeltildi: `DoorPlanDialog.tsx:97`, `CopyDoorPlansDialog.tsx:59`, `bulk.ts:31`, `convex/doors.ts:572`, `convex/lib/gatewayCommand.ts:868`. Dialog dokunulmayan doğrulama alanını payload'a koymaz; kayıt normalize edilmiş değişiklik anahtarlarını döndürür; toplu işlem yalnız bunları gönderir. Aynı kaydın kopyası revizyon artırmaz; kaynakta olmayan veya hedefte aynı doğrulama planı korunur. Eski kayıtlar açıkça kaydedilmeden doğrudan/kuyruk yolunda gönderilemez; bekleyen gönderim hesabına girmez. Uygulamanın başarılı CardReaderPlan bağlantısı okuyucu başına kaydedilir; disabled/kurulmamış/fabrika bağlantısı olan okuyucuya templateNo=0 gönderilmez. Kısmi başarı izi korunur, yalnız bağlanmış okuyucu sökülür. | `Y1 status-only edit omits untouched verify payload and send`; `Y1 template copy saves and sends status only`; `Y1 legacy verify is never sent before an explicit save (%s)`; `Y1 a partial install only authorizes unlinking successfully bound readers` |
| O1 | Düzeltildi: `convex/lib/gateway/plans.ts:225`. Resmî PDF 7.4.2.1–3 ve 7.7.2.1–2 okundu: üst bayrak alt desteği kapsar, açık false engeller, VerifyWeekPlanCfg için CardRightWeekPlanCfg olumlu alias kabul edilir. Eski durum planı firmware'inde bayrakların tamamen eksik olması HEAD yolunu bozmaz; 200 dışı yanıt okunamama hatasıdır. doorNo+100 ve HEAD haftalık PUT sırası/gövdesi korunur. | `O1 HEAD status chain keeps working with only the parent capability`; `O1 HEAD status accepts absent legacy child flags %j`; `O1 explicit verify false takes precedence over the weekly alias`; `O1 distinguishes unreadable capabilities from unsupported features` |
| O2 | Düzeltildi: `convex/doors.ts:301`. hikDoorNo veya deviceId gerçekten değişince revizyon artırılır; sonuçlar, ortak başarı/hata/kayıt zamanı, tatil slotları ve okuyucu bağlantı izi temizlenir; listede Gönderilmedi görünür. | `O2 changing door %s clears revision results and device slots` (numara ve cihaz) |
| O3 | Düzeltildi: `convex/doors.ts:623`. Uyarı, kaydedilen şablon sürümü ile gerçek güncel şablon sürümü farkına dayanır; boş appliedAt yanlış pozitif üretmez. | `O3 unchanged template never warns when %s` (unsent, failed, resaved); mevcut şablon sonradan değişti testi de yeşil |
| O4 | Düzeltildi: `convex/lib/gateway/plans.ts:312`, `convex/lib/gatewayCommand.ts:784`, `convex/doors.ts:586`, `DoorPlanDialog.tsx:203`, `CopyDoorPlansDialog.tsx:43`. Tatil sonu da normalizeEndTime ile 24:00:00 olur. Boş yıl kayıt sırasında atomik olarak reddedilir; saklanmış eski boş plan da hiçbir PUT/slot rezervasyonu yapmadan hata verir. Tekli ve toplu UI boş yılı engeller. Kullanıcı tatili kapattığında mevcut şablon bağlantısı normal şekilde kaldırılır. | `O4 holiday end has the same midnight resolution as weekly plans`; `O4 rejects empty holiday years before any write or reservation`; `O4 UI blocks enabling holidays for a year without dates`; `O4 UI blocks bulk copies of an empty holiday year` |

Düşük bulgular (denetimde L*, görevde D*):

- L1 düzeltildi — `DoorPlansTab.tsx:32`: tek satır `faceAndCard: "Kart + Yüz"` etiketi.
- L2 bırakıldı — `DoorPlansTab.tsx:158`: düğmeyi metne çevirme ve satıra klavye erişimi ekleme çok satırlı etkileşim değişikliği; yalnız risksiz tek satır düşük bulgu kapsamını aşar.
- L3 bırakıldı — `convex/lib/doorStatusPlan.ts:155`: istisna türü/istemci hata sözleşmesi değişir; tek satır risksiz kozmetik düzeltme değil.
- L4 bırakıldı — `convex/doors.ts:266`: devices.manage/accessRules.manage yetki ve eski update API sözleşmesini değiştirir; ayrıca erişim yönetimi kapsam dışında.
- L5 düzeltildi — `convex/doors.ts:658`: string hata dizisinde explicit type predicate kullanıldı.
- L6 bırakıldı — `PHASE2_REPORT.md:1`: raporu .claude/docs altına taşımak izin verilen yazma kapsamı dışında; mevcut rapora bu ek kaydedildi, taşıma koordinatöre bırakıldı.
- L7 bırakıldı — `convex/lib/gateway/plans.ts:258`: unknown daraltmasından sonra güvenli cast; davranış hatası yok, gereksiz değişiklik yapılmadı.

Ek şema: yalnız doors'a iki opsiyonel alan `hikVerifyPlanSavedAt` ve `hikVerifyPlanReaderNos` (`convex/schema.ts:310`). Zorunlu alan/tablo/index değişikliği yok; migration/codegen yok. Yeni query/mutation'lar mevcut doors modülündedir. `convex/deviceCenter.test.ts:137` audit kontratı gerçek bir uygulama bağlantısı fixture'ıyla korundu; kurulmamış plana sahte komut/audit beklenmez. Başka oturum dosyalarına dokunulmadı.

Son kapılar (bu düzeltme sonrası):

- tsc app: 0 hata, exit 0 (`/tmp/door-audit-ts-app-final.log`).
- tsc convex: 0 hata, exit 0 (`/tmp/door-audit-ts-convex-final.log`).
- eslint src convex: 0 error, 1 mevcut warning (`attendanceCorrections.test.ts:8`), exit 0 (`/tmp/door-audit-eslint-final.log`).
- TAM vitest: 353/353 dosya, 3926/3926 test, 0 başarısız, exit 0 (35.74 s; `/tmp/door-audit-full-final.log`).
- find-node-leak: exit 0 (`/tmp/door-audit-leak-final.log`).
- git diff --check: temiz.

Cihazda doğrulanmadı: gerçek firmware capability cevabı, doğrulama penceresi dışındaki mod, tatil önceliği ve 24:00:00 davranışı fiziksel cihazda sonraki onaylı testte incelenmeli. Bu çalışma yalnız mock gateway + convex-test yerel test veritabanıyla yürütüldü; canlı cihaz/Convex çağrısı veya canlı DB yazımı, git add/commit/stash/checkout/reset/restore yapılmadı.
