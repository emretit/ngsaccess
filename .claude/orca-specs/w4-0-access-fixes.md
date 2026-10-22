# W4.0 — İki erişim açığının düzeltmesi (Hik kapı kapsamı + bulut kararında saat) (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex handler'ları schema alan adlarını olduğu gibi (camelCase) döner.
- Convex kuralları: `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok; yeni cron/polling YOK (Convex Free kota).
- Şema değişikliği YOK (bu iş yalnız mantık düzeltmesi).
- YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen/run), DB yazma, `convex/_generated/**` düzenleme, `mobile/**`, `bridge/**` (yalnız oku).

## Hedef (test edilebilir)
1. **Hik kapı kapsamı:** Hik cihaza (gateway/direct yolu) gönderilen kişi kaydı, kişinin o cihazdaki TÜM aktif kurallarını hesaba katar; `doorRight` yalnız kuralların kapsadığı kapıları içerir; her kapının `RightPlan.planTemplateNo` değeri o kapıyı kapsayan kuralların plan numaralarıdır.
2. **Bulut kararında saat:** kart okuyucu (ESP32 `/card-reader`) ve QR yolunun bulutta verdiği karar (`canEmployeeAccessDevice`), aktif kuralın gün/saat penceresini de kontrol eder (Europe/Istanbul). Pencere dışı okutma reddedilir.

## Bağlam (kodda doğrula; tasarım kaynakları `.claude/designs/w4-template-claude.md` §2.1/§6, `.claude/designs/w4-template-codex.md` §2, `.claude/designs/w4-w5-sentez.md`)
- Açık 1: `convex/actions/hikvisionSync.ts` ~130-150 — cihaz başına `seen` dedupe ilk kuralı alıp aynı cihazdaki diğer kuralları atlıyor. `convex/lib/gateway/persons.ts` ~50-71 — `doorRight` = 1..doorCount (tüm kapılar), tüm kapılara tek `planTemplateNo`. Kural kapsamı: cihaz bacağı (`groupDevices` → cihazın tüm kapıları) + kapı bacağı (`groupDoors` → seçili kapılar; kapının Hik kapı numarası alanını şemada bul). Grafik mantığı: `convex/lib/accessGraph.ts`, `accessGraphPure.ts`, `accessScopeRelations.ts`. Hafta planı gönderimi: `syncWeekPlanToDevicesInternal`, `lib/gateway/scheduling.ts`.
- Açık 2: `convex/lib/accessDecision.ts` `canEmployeeAccessDevice` yalnız üyelik + `isActive`; çağıran `convex/cardReadings.ts` ~1178 ve `convex/lib/cardReadingProcess.ts`. Mobil yol saate bakıyor: `convex/lib/mobileAccess.ts` `mobileRuleAllows`. Cihaza giden saat semantiği: `convex/lib/hikSync.ts` `defaultRuleSchedule` (boş gün/saat = 7/24).

## Değişiklik
1. **Ortak saf yardımcı (`convex/lib/ruleSchedule.ts`, YENİ):** `isRuleOpenAt(rule: {days?, startTime?, endTime?}, nowMs: number): boolean` — Europe/Istanbul gün + dakika; semantik CİHAZLA AYNI olsun (`defaultRuleSchedule`: boş alan = 7/24; bitiş dakikası Hik'e nasıl gidiyorsa öyle — `hikSync.ts`'de `:59` eki var, ona göre dahil/dışlayıcı kararını ver ve testle sabitle). `mobileRuleAllows`'u bu yardımcıya taşıma; yalnız davranış farkı varsa raporda yaz (mobil boş alanı reddediyor — DOKUNMA, kapsam dışı).
2. **Karar motoru:** `canEmployeeAccessDevice`'a kural saat bilgisi + `nowMs` ver (ör. `openRuleIds` kümesini çağıran `isRuleOpenAt` ile hesaplar ya da fonksiyon kural nesnelerini alır — saf kalsın). Kesişimde en az bir kural hem aktif hem açık ise izin. Ret nedeni ayrıştırılabiliyorsa (`outside_schedule`) mevcut ret/audit akışına uygun şekilde kaydet; yeni alan gerekiyorsa şemaya DOKUNMA, mevcut alanlara sığmazsa raporda öner.
3. **Hik kişi senkronu:** cihaz başına dedupe kişi×cihaz için TÜM kuralları toplasın. Her kural için hafta planı/plan şablonu numarası mevcut akışla sağlanmaya devam etsin (eksik numara ataması dahil). `buildPersonPayload` (persons.ts) kapı→plan listesini alsın: `doorRight` = kapsanan kapı numaraları; `RightPlan` = kapı başına `{ doorNo, planTemplateNo: "<n1>,<n2>" }` (virgüllü çoklu şablon ISAPI'de destekleniyor — **[teyit cihazda]**; tek kural varsa tek numara). Kapı bacağı olmayan kural = cihazın tüm kapıları (bugünkü davranış). Hiçbir kapı kalmazsa kişi bu cihaza "yetkisiz" muamelesi görsün (mevcut silme/atlama akışına uy, yeni kişi silme fırtınası açma).
   - Kapı numarası eşlemesi belirsizse (kapı kaydında Hik kapı no yok) o kural için **tüm kapılar**a geri düşme YAPMA; o kapıyı atla ve uyarı/sync hatası üret (fail-closed).
   - localBridge (Windows SDK) yolu: Convex tarafında aynı hatayı taşıyorsa düzelt; köprü C# kodu (`bridge/windows/...`) gerektiriyorsa DEĞİŞTİRME, raporda yaz.
4. **Testler:**
   - `ruleSchedule`: gün dışı, saat dışı, sınır dakikaları (başlangıç dahil, bitiş kararlaştırdığın gibi), boş alan = açık, gece yarısı/İstanbul saat dilimi.
   - `accessDecision`: aktif+açık → izin; aktif+kapalı → ret; iki kuraldan biri açık → izin; mevcut testler yeşil.
   - Hik payload: tek kural tüm kapılar (bugünkü çıktıyla birebir) · kapı bacaklı kural yalnız seçili kapılar · aynı cihazda iki kural → kapı başına virgüllü şablon · kapı no'su olmayan kapı → atlanır + uyarı · hiçbir kapı yok → yetkisiz.
   - Mevcut `hikvisionSync`/`cardReadings` testleri yeşil.

## Ownership (yalnız bunlara yaz)
YENİ convex/lib/ruleSchedule.ts (+test) · convex/lib/accessDecision.ts (+test) · convex/lib/cardReadingProcess.ts · convex/cardReadings.ts (yalnız karar bloğu ~1150-1220) · convex/actions/hikvisionSync.ts · convex/hikvisionSync.ts (yalnız kişi/kural verisi toplayan query gerekiyorsa) · convex/lib/gateway/persons.ts (+test) · ilgili mevcut test dosyaları.

## Kapsam dışı
Zaman şablonu (W4.1) · yetki durumu ekranı · tatil · IDE panel mantığı (panel kendi karar veriyor) · mobil `mobileRuleAllows` davranışı · Windows köprü C# kodu · şema.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `npm ci` (worktree yeniyse) sonra:
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar, bitiş dakikası kararı (dahil/dışlayıcı + gerekçe file:line), localBridge durumu, cihazda doğrulanması gerekenler, kapı sonuçları (sayılarla).
