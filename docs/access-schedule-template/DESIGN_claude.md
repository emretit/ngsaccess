# Erişim zaman şablonu — tasarım (Claude, K3, 2026-11-25)

> **Özet (5 satır)**
> 1. Model: kural kendi haftalık saatini taşır (`accessRules.weekSchedule`, gün başına ≤8 aralık); **şablon = adlandırılmış kaynak**, kaydedilince bağlı kurallara kopyalanır (`scheduleTemplateId` bağı değişikliği yaymaya yarar). Tüketicilerin hepsi zaten `effectiveSchedule(rule)`'dan okuyor; ek okuma ve "şablon bulunamadı" durumu olmaz.
> 2. Migration yok: alanların hepsi opsiyonel, eski `days/startTime/endTime` silinmez. Geri dönmek için `weekSchedule` alanını kaldırmak yeterli.
> 3. Cihaz yolu yeni numara üretmez: Hik/K2804 plan numarası bugünkü gibi **kural başına** (`hikWeekPlanNo`), IDE'de K kayıt altyapısı zaten var. Şablon değişince 20 sn bekleyip **tek** yeniden gönderim yapılır, kişi yeniden yazılmaz.
> 4. Uyarı: bu özellik 2026-10-22'de yapıldı (`4e11b2a5`) ve 2026-10-27'de Emre kararıyla tamamen silindi (`cbfbeccf`; canlıda 0 şablon vardı). Yeniden açmadan önce 1. ürün sorusu cevaplanmalı.
> 5. 5 faz, toplam ~5 iş günü (eski koddan uyarlamayla). En büyük risk: K2804 köprüsünde aynı kişide 2 farklı plan olunca kişi cihazdan **siliniyor** (`convex/lib/hikSyncEmployee.ts:249-257`).

## 0. Bugünkü durum (kanıt)
- Kuralda gün başına tek aralık var: `days/startTime/endTime` (`convex/schema.ts:599-601`). Form tek saat çifti gönderiyor (`src/components/access-control/unified/hooks/useRuleForm.ts:155-177`). Gece yarısını aşan saat reddediliyor (`convex/lib/accessRuleUx.ts:10`).
- Çok aralıklı saf çekirdek **duruyor**: `WeekSchedule`, `normalizeWeek` (≤8/gün, birleştirme), `splitOvernight`, `isAllowedAt` (Europe/Istanbul), `toHikWeekSchedule`, `toIdePermissionSegments` (K≤8) → `convex/lib/accessSchedule.ts:2-82`. Kural ise yalnız `effectiveSchedule(rule)` ile tek aralığa açılıyor (`:46-53`).
- Bu çekirdeği kullananlar: Hik `defaultRuleSchedule` (`convex/lib/hikSync.ts:55-57`), IDE `ideRuleSegments` (`convex/ideSync.ts:776-778`), yetki durumu (`convex/lib/grantStatus.ts:39`). Bulut kararı ve mobil ise **ayrı** tek-aralık fonksiyonunu kullanıyor: `isRuleOpenAt` (`convex/lib/ruleSchedule.ts:13-27`) → `convex/lib/cardReadingProcess.ts:169`, `convex/lib/mobileAccess.ts:34-37`.
- IDE'de çoklu kayıt hazır: `allocateIdePermissionNos` + `ideExtraPermissionNos` (`convex/ideSync.ts:779-815`, `convex/schema.ts:594`), kapı hedef senkronu bunu kullanıyor (`convex/lib/doorTargetSync.ts:116-117`).
- Hik cihaz yolu: `UserRightWeekPlanCfg/{n}` gün başına 8 segment (`convex/lib/gateway/scheduling.ts:30-85`) + `UserRightPlanTemplate/{n}` (aynı n) (`:97-118`). Numara global sayaç, kural başına (`convex/hikvisionSync.ts:284-296`).
- K2804 Windows köprüsü çok segmentli haftayı zaten yazıyor (`bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:157-217`), ama kişi başına **tek** plan numarası taşıyor (`:284`, `convex/lib/hikSyncEmployee.ts:249`).
- Kapı planları ayrı: `doors.hikDoorStatusPlan` / `hikVerifyPlan` / `hikDoorHolidayPlan` (`convex/schema.ts:369-375`), cihaza `DoorStatusWeekPlanCfg → DoorStatusPlanTemplate → DoorStatusPlan` (`convex/lib/gateway/plans.ts:28-122`). Tatil yalnız kapı durum planında var (`convex/lib/gatewayCommand.ts:784-800`, `convex/doors.ts:727-733`).
- Kural değişince bugün kural başına 2 action hemen zamanlanıyor (`convex/accessRules.ts:845-857`).

## 1. Veri modeli
### 1.1 Seçilen model: "kural kopyayı taşır, şablon kaynaktır"
```ts
// convex/schema.ts
const interval = v.object({ start: v.string(), end: v.string() });          // "HH:MM", bitiş ≤ "24:00"
const weekValidator = v.object({ Monday: v.array(interval), /* … */ Sunday: v.array(interval) });
accessScheduleTemplates: defineTable({
  projectId: v.id("projects"), name: v.string(), description: v.optional(v.string()),
  week: weekValidator, version: v.number(),
  pendingSyncJobId: v.optional(v.id("_scheduled_functions")),            // debounce
  isArchived: v.optional(v.boolean()), createdAt: v.string(), updatedAt: v.string(),
}).index("by_project", ["projectId"]).index("by_project_name", ["projectId", "name"]),
// accessRules'a ek (hepsi opsiyonel):
weekSchedule: v.optional(weekValidator),                                     // normalize edilmiş kopya
scheduleTemplateId: v.optional(v.id("accessScheduleTemplates")),            // + index by_template
scheduleTemplateVersion: v.optional(v.number()),                             // kopyalanan sürüm
```
- `effectiveSchedule(rule)` (`convex/lib/accessSchedule.ts:46`): `rule.weekSchedule` varsa onu döner, yoksa bugünkü davranış aynen kalır. **Tüketici imzası değişmez**: Hik, IDE, köprü ve yetki durumu ek okuma yapmadan şablon saatini alır.
- `isRuleOpenAt` (`convex/lib/ruleSchedule.ts:13`) `isAllowedAt(effectiveSchedule(rule), now)` olur. Yalnız eski (şablonsuz) kuralda bugünkü sonuçla birebir aynı olduğu testle sabitlenir (sınırlar: `23:59` dahil, Hik `HH:MM:59`).
- Şablon kaydında (`create`/`update`) tek mutation `by_template` üzerinden bağlı kuralları `.take(101)` ile okur (101 olursa hata verir). Her kurala `weekSchedule`, `scheduleTemplateVersion` ve `updatedAt` yazılır. `updatedAt` değişince yetki durumu kendiliğinden "güncel değil" olur (`convex/lib/grantStatus.ts:16`).
- Neden eski W4 modeli değil: eski modelde (`.claude/designs/w4-template-claude.md` §1.3) şablon her tüketicide ayrıca okunuyordu ve şablon silinirse erişimi kapatmak için ayrı dal gerekiyordu (`effectiveSchedule(rule, tpl|null)`). Kopya modelinde kural her zaman kendi kendine yeter, yani dağılmış okuma ve "şablon yok" durumu ortadan kalkar. Bedeli: şablon kaydı ≤100 satır yazıyor; bu tek transaction'da biter.
- Şablon kullanmadan da "günlere göre farklı saat" yazılabilir: kural formu doğrudan `weekSchedule` yazar, `scheduleTemplateId` boş kalır.
- Şablon silme: bağlı kural varsa reddedilir ("N kural kullanıyor"). Arşivlenen şablon seçicide görünmez, bağlı kurallar kopyalarıyla çalışmaya devam eder. Kurala "bağı kopar" işlemi de verilir: kopya kalır, bağ silinir.
- Sınırlar `normalizeWeek` içinde uygulanır: gün başına ≤8 aralık (`accessSchedule.ts:31`), IDE için farklı (başlangıç,bitiş) çifti K≤8 (`:80`). Aşan kayıt **reddedilir**, kırpılmaz.

### 1.2 Geçiş ve geri dönüş
- Migration **gerekmiyor**: yeni alanlar opsiyonel, eski kurallar `weekSchedule` olmadan aynen çalışır. Eski `days/startTime/endTime` alanları silinmez. Kural `weekSchedule` ile kaydedildiğinde bu alanlar özet olarak dolu bırakılır (en erken başlangıç ve en geç bitiş); liste ve rapor kodu kırılmaz.
- İsteğe bağlı backfill yok. Kural düzenlenip kaydedilince yeni biçime geçer.
- Geri dönüş: (1) UI kapatılır. (2) `weekSchedule`/`scheduleTemplateId` alanlarını boşaltan tek seferlik internal mutation çalıştırılır; kurallar eski alanlarına döner ama günlere göre farklı saatler kaybolur. (3) Şema daraltılır. Bu sıra `cbfbeccf` yayınında izlenen sırayla aynı (önce canlı sayım 0 teyidi, sonra şema).

## 2. Cihaz eşlemesi
| Hedef | Ne gider | Bilinen | Bilinmeyen `[teyit]` |
|---|---|---|---|
| Hik gateway (ISAPI) | kural başına `UserRightWeekPlanCfg/{hikWeekPlanNo}` + `UserRightPlanTemplate/{n}`; kişi `RightPlan.planTemplateNo=n` değişmez | 8 segment/gün, `24:00:00` biçimi (`scheduling.ts:44-47,88-90`); kapı başına plan (`convex/lib/gateway/persons.ts:36-71`) | Cihazdaki week plan/template slot sayısı. Sayaç global ve büyüyor (`hikvisionSync.ts:292-293`); `/UserRightWeekPlanCfg/capabilities` okunmuyor |
| K2804 köprüsü (HCNetSDK) | `syncWeekPlan` op'u (`schedule` dizisi) | Köprü çok segmenti uyguluyor (`HikvisionClient.cs:194-217`) | SDK tarafında 8 segment/gün sınırı (kod 8 varsayıyor); kişi başına 2. plan yok (`hikSyncEmployee.ts:249`) |
| IDE Smart (MQTT) | kural başına K `upsertPermission` kaydı (`idePermissionNo` + `ideExtraPermissionNos`); K değişirse üyelerin `permissions[]` dizisi yeniden gönderilir | Kayıt tek aralık + `week_days` taşır (`ideSync.ts:76,85-99`); kullanıcı başına ≤16 izin (`:82`); fazlası kırpılır (`:108-117`) | `week_days` kodlaması (0=Pazar) gün kısıtlı şablonla canlıda test edilmedi; `end=1439` son dakikayı kapsıyor mu |
| Bulut (ESP32/QR, mobil) | — (Convex karar verir) | `isAllowedAt` İstanbul saati | — |

- **IDE desteklemezse**: IDE'de tatil kavramı yok; K>8 olan şablon kayıtta reddedilir. Bir kişinin bir paneldeki toplam kaydı 16'yı aşarsa şablon/kural kaydı reddedilir ("Ali: Panel-1'de 18 izin; sınır 16"). Kaydedildikten sonra aşılırsa (yeni üyelik eklenirse) bugünkü kırpma devam eder ama hedef **failed** ve nedeni görünür olur; kırpılan kayıt güvenli yönde kalır (erişim vermez).
- **Şablon değişince ne gider**: bağlı kuralların her cihazına kural başına 1 week plan + 1 template (Hik) veya 1 op (köprü); IDE'de kural×K permission kaydı gider. Kişi yazımı **yok**, IDE'de yalnız K değiştiyse yapılır. Kapı kapsamı değişmediği için `RightPlan` aynı kalır.
- **Kota planı** (function-call kotası iki kez yandı: `ide_poll_quota_incident`, `hik_bridge_roster_poll_quota`):
  - Poll veya cron yok.
  - Şablon `update`'i önceki `pendingSyncJobId` işini `scheduler.cancel` ile iptal eder ve `runAfter(20_000)` ile tek iş kurar. 10 ardışık kayıt = 1 gönderim.
  - O iş tek `deviceSyncRun` (kind `template_sync`) açar. Kural döngüsü tek action içinde döner; kural başına `syncWeekPlanDevices` (`hikSyncEmployee.ts:446`) ve IDE permission yeniden gönderimi çalışır, yani kural başına 2 ayrı action zamanlanmaz.
  - IDE op'ları tek mutation'da kuyruğa girer.
  - Tahmini maliyet: 1 kayıt ≈ 1 mutation + 1 action + (kural×cihaz) gateway çağrısı + ~2 iç sorgu/kural. Kişi sayısıyla ölçeklenmez.
  - Kabul testinde çağrı sayımı ölçülür.

## 3. Kapı planları ve tatillerle ilişki
- **Şablon kapı planının yerini almaz, yanında durur.** Anlamları farklı: şablon *kişinin ne zaman geçebileceğini* belirler (UserRight). Kapı planı *kapının herkes için açık/kilitli/normal kalacağı saatleri* belirler (DoorStatus, `plans.ts:13-21`) ve doğrulama modu planı da ondan ayrıdır (`plans.ts:128-136`). Ayrı tutulması, sade sekme kararının (`cbfbeccf`, "Kapı Planları" kendi sekmesi) da devamı.
- **Çakışma kuralı (cihaz davranışı, UI'da açıkça yazılır)**: kapı `remainOpen` iken herkes geçer (kişi şablonu yok sayılır). `remainClosed` iken kimse geçemez. `normal` iken kişi şablonu geçerlidir. Bulut kararı da aynı sırayla değerlendirir: kapı planı, sonra kişi şablonu, sonra geçerlilik tarihi. `[teyit]` remainClosed'da yetkili kişinin de geçemediği DS-K1T8'de doğrulanmalı.
- Kapı planına "şablondan kopyala" kolaylığı v2'ye kalır. Eski "Zaman şablonu kullan" bağı (`hikDoorStatusTemplateId`) geri **gelmez**.
- **Tatil**: v1'de kişi şablonu tatilden etkilenmez (bugünkü davranış). Tatilde kapıyı kilitlemek için mevcut kapı tatil planı kullanılır (`gatewayCommand.ts:784`). İleride kişi erişimine tatil eklemek Hik'te `UserRightHolidayGroupCfg/HolidayPlanCfg` (`scheduling.ts:120-170`) ile mümkün, ama IDE ve köprüde eşdeğeri yok, bu yüzden 2. ürün sorusuna bağlı. Yarım gün tatil (`convex/schema.ts:1433`) taşınmaz.

## 4. UI
- **Yer**: Geçiş Kontrol'e 4. sekme "Saat Şablonları" (`UnifiedAccessControl.tsx:22-35` sekme deseni, `?tab=schedules`) veya yalnız kural formu içi seçici + "Şablonları yönet" Sheet'i (1. ürün sorusu).
- **Liste**: `FilterBar` (`src/components/shared/FilterBar.tsx`) arama + "Arşiv" filtresi. Tablo kolonları: ad, haftalık mini önizleme (7 sütunlu bant), "N kural", son değişiklik. Boşken ve yüklenirken `TableStateRow` başlığı korur (`src/components/shared/TableStateRow.tsx`). Satırın tamamı editörü açar: `onRowActivate` + `ROW_CLICK_CLASS` (`src/lib/tableRowClick.ts`). Boş durumda "Hafta içi 08-18" gibi hazır taslakla oluşturma yolu gösterilir (eski audit bulgusu 02-O1/02-O2, `docs/ui-audit-gk/00_OZET.md:23`).
- **Editör**: mevcut haftalık plan parçaları yeniden kullanılır (`src/components/access-control/door-dialog/weeklyPlan.tsx:29,64,179`: `TimeFields`, `useWeeklyPlanLayout` "Her gün / Hafta içi / Günlere göre", `renderWeeklyPlan`). Gün başına "+ aralık" (≤8). "22:00 → 06:00" girilirse `splitOvernight` iki güne böler ve bunu satırda gösterir. Altta salt okunur 7×24 ızgara önizlemesi bulunur. Kaydetmeden önce **etki onayı** gösterilir: "Bu değişiklik 3 kuralı, 5 cihazı etkiler; 20 sn içinde gönderilir" + etkilenen kuralların listesi (eski audit 02-H1).
- **Kurala atama**: kural formundaki zaman bölümü (`unified/components/TimeSchedule.tsx`) segment kontrolü olur: "Her zaman · Özel saat · Şablon". Seçili olan görsel olarak belirgindir (eski 01-H1 hatası: `docs/ui-audit-gk/01-kurallar.md:21`). Özel saat yine `weeklyPlan` editörüdür. Kural listesinde ve ayrıntısında şablon adı veya kısa saat özeti görünür, dar ekranda da (01-O2).
- **"Şu an erişebilir mi" (kişi bazlı)**: Yetki Durumu'ndaki kişi çekmecesine (`unified/status/EmployeeGrantSheet.tsx`) kapı başına satır eklenir: "Şu an: Geçebilir / Geçemez — neden (saat dışı 18:00'de bitti · kapı kilitli planda · erişim 01.12'de başlar · cihaza gitmedi)". Hesap **istemcide** saf `isAllowedAt` ile yapılır. Sorgu kişinin kurallarını (`weekSchedule`), kapı plan modlarını ve son gönderim durumunu bir kez döner; dakikalık sorgu veya yeni subscription açılmaz (kota). Kart okuma kararıyla aynı fonksiyon kullanıldığı için sonuç tutarlıdır.

## 5. Riskler
1. **Cihaz kişisi silinmesi**: köprüde kişinin 2 farklı plan numarası olursa bugün kişi siliniyor (`hikSyncEmployee.ts:249-257` → `removeScopedPerson` `:98-113`). Şablonlar aynı kişiye birden çok kural vermeyi kolaylaştırdığı için bu yol daha sık tetiklenir. **F0'da düzeltilir**: çoklu plan durumunda kişiye dokunulmaz, hedef `failed` olur ("köprü tek plan destekler"). Silme yalnız açık yetki kaldırmada kalır (`!doorPlans.length`). Şablon kaydı ve template_sync hiçbir yolda kişi silmez; bu testle sabitlenir.
2. **Yanlış saatte kilitli/açık kalma**:
   - Plan yarım kalırsa (week plan yazıldı, template yazılamadı) cihaz eski template'i gösterir, sıra week plan → template.
   - Hata hedefte `failed` olarak görünür, sessiz kırpma yok (8 segment, 16 izin).
   - Boş hafta kaydedilebilir ama UI "Bu şablon hiç erişim vermez" uyarısı gösterir.
   - Hik plan numarası cihaz kapasitesini aşarsa (`[teyit]`) cihaz reddeder ve hedef failed olur. F0'da capabilities okunur, aşım kayıtta engellenir.
3. **Saat dilimi**: bütün karar `Europe/Istanbul` (`accessSchedule.ts:54-56`), cihazların NTP saat dilimi TR olmalı (ANKA001 saat dilimi düzeltmesi `2b31bdf5`). Saklanan saatler yerel "HH:MM", UTC dönüşümü yok. TR'de yaz saati olmadığı için kayma riski düşük.
4. **Gece yarısını aşan aralıklar**: saklama her zaman gün içinde yapılır. Bölme sonrası Pazar 22-24 + Pazartesi 00-06 olur. IDE'de K bir artar. Bitiş sınırı: Hik `HH:MM:59`, `24:00:00` (`accessSchedule.ts:63-68`). Bulut `time <= end`, IDE 1439. Hepsi tek test tablosunda karşılaştırılır.
5. **Eski kopya**: şablon kaydı ile bağlı kural kopyası aynı transaction'da yazılır, yani tutarsız ara durum yok. Kural yerelde düzenlenirse bağ kopar (UI sorar).

## 6. Fazlar (dosya ownership: iki worker aynı dosyaya yazmaz)
- [ ] **F0 — Ön güvenlik (~0,5 gün, K2b)**: köprü çoklu plan = failed, silme yok; Hik week-plan capabilities okuması + kayıtta kapasite engeli.
  Ownership: `convex/lib/hikSyncEmployee.ts`, `convex/lib/gateway/scheduling.ts`, ilgili testler.
  Kabul: köprü 2-plan senaryosunda `deletePerson` çağrısı 0; capability >max'ta Türkçe hata.
- [ ] **F1 — Model + çözücü (~1,5 gün, K2b)**: şema (§1.1), `effectiveSchedule` (`weekSchedule` dalı), `isRuleOpenAt` → `isAllowedAt`, `accessScheduleError` çok aralığı kabul eder ve gece bölmeye izin verir, yeni `convex/accessScheduleTemplates.ts` (list/get/create/update/duplicate/setArchived/remove/previewImpact; yetki `accessRules.manage`). Kural create/update `weekSchedule` + `scheduleTemplateId` alır, 16-izin ön kontrolü yapılır. Eski kod referans olarak alınır: `git show cbfbeccf^:convex/accessScheduleTemplates.ts`.
  Ownership: `convex/schema.ts`, `convex/_generated/api.d.ts` (2 satır), `convex/lib/accessSchedule.ts`, `convex/lib/ruleSchedule.ts`, `convex/lib/accessRuleUx.ts`, `convex/lib/accessRuleWrite.ts`, `convex/accessRules.ts`, `convex/accessScheduleTemplates.ts`, `convex/lib/mobileAccess.ts` + testler.
  Kabul: eski kural için Hik payload / IDE segment / bulut kararı değişmez (snapshot); şablon kaydı kural kopyalarını tek transaction'da günceller; K>8, gün>8 ve 16 aşımı reddedilir; `project_user` yazamaz.
- [ ] **F2 — Yayılım (~1 gün, K2b)**: debounce'lu `template_sync`; kural başına 2 action yerine tek action döngüsü; IDE K değişiminde üye yeniden gönderimi + artan numaralar için `deletePermission`.
  Ownership: `convex/deviceSyncRuns.ts`, `convex/lib/deviceSyncRun.ts`, `convex/actions/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`, `convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts`, `convex/lib/doorTargetSync.ts` + testler. (F1'den sonra; F3 ile paralel koşabilir.)
  Kabul: 5 ardışık update → 1 zamanlanmış iş; Hik'te kişi çağrısı 0; IDE'de K aynıysa `upsertUser` 0; çağrı sayımı testi; yayın öncesi `scripts/find-node-leak.mjs` temiz.
- [ ] **F3 — UI (~1,5 gün, K2b)**: şablon listesi + editör + etki onayı; kural formunda segment seçici; liste/ayrıntı özeti.
  Ownership: `src/components/access-control/unified/schedules/**` (yeni), `unified/components/TimeSchedule.tsx`, `unified/hooks/useRuleForm.ts`, `unified/UnifiedAccessControl.tsx`, `unified/rules-list/RuleRow.tsx`, `unified/AccessRuleDetails.tsx`, `src/types/access-control.ts` + testler. `door-dialog/weeklyPlan.tsx` yalnız okunur; değişiklik gerekirse ayrı küçük adım.
  Kabul: tsc/eslint 0; Orca tarayıcı turu (390 ve 1280 px), gece bölme görünür, seçili zaman kaynağı belirgin.
- [ ] **F4 — "Şu an erişebilir mi" (~0,5 gün, K2b)**: `accessGrantStatus` kişi sorgusuna kural haftası + kapı plan modu eklenir, çekmecede istemci hesabı yapılır.
  Ownership: `convex/accessGrantStatus.ts`, `convex/lib/grantStatus.ts`, `unified/status/EmployeeGrantSheet.tsx`, `unified/status/model.ts` + testler.
  Kabul: saat dışı, kapı kilitli ve gelecekte başlayan erişim durumlarının üçü de doğru nedenle gösterilir; yeni subscription yok.
- [ ] **Canlı doğrulama (~0,5 gün, cihaz, koordinatör)**: K1T807/ANKA001 çok aralık + gece; IDE gün kısıtlı `week_days`; K2804 çok segment; kapı `remainClosed` × kişi şablonu.
- Kapılar her fazda: `tsc` app+convex 0, `eslint src convex` 0 hata, **tam** `vitest run` (`feedback_full_vitest_gate`). Commit/deploy koordinatörde.

## 7. Emre'ye 3 ürün sorusu
1. **Şablonlar Ekim'de "kullanılmıyor/karmaşık" diye silindi. Bu kez nerede dursun?** (a) Hik gibi ayrı "Saat Şablonları" sekmesi; (b) yalnız kural formunda "Özel saat (günlere göre farklı) · Şablondan seç / şablon olarak kaydet", yönetim küçük bir panelde. **Öneri: (b)**: çoğu kullanıcı yalnız "günlere göre farklı saat" istiyor, şablon ikinci adımda kendiliğinden çıkar ve sekme kalabalığı geri gelmez.
2. **Resmî tatilde kişi erişimi ne olsun?** (a) Normal gün gibi (bugünkü); (b) şablon başına "tatilde kapalı" seçeneği (yalnız Hik gateway'de çalışır; IDE ve K2804'te çalışmaz, ekranda uyarı olur). **Öneri: (a)**: tatilde kapıyı kilitlemek zaten kapı planının tatil ayarıyla yapılıyor; kişi tarafında yalnız bazı cihazlarda çalışan bir seçenek kafa karıştırır.
3. **Ortak bir şablon değiştirildiğinde bağlı tüm kurallar otomatik güncellensin mi?** (a) Evet: "N kural, M cihaz etkilenecek" onayından 20 sn sonra hepsine gider; (b) hayır: her kural elle "güncelle" der. **Öneri: (a)**: şablonun varlık sebebi bu; etki listesi onayda görünür, kural yerelde değiştirilirse bağdan kopar.
