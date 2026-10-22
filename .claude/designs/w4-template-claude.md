# W4a — Erişim zaman şablonları + kişi×kapı yetki durumu (TASARIM, Claude)

Durum: salt-okuma tasarım, 2026-10-21. Kod yazılmadı. `[teyit]` = kodda/cihazda doğrulanamadı.

## Özet karar
- **Şablon içeriği taşır, cihaz numarası kuralda kalır.** Yeni tablo `accessScheduleTemplates`; kural `scheduleTemplateId?` ile bağlanır. Hik'te week plan / plan template numarası bugünkü gibi **kural başına** (`hikWeekPlanNo`) kalır → şablon değişince kişiler yeniden yazılmaz, yalnız week plan(+tatil) yeniden gönderilir.
- **Tek saf çözücü** `effectiveSchedule(rule, template)` → Hik, IDE, mobil karar hepsi bunu kullanır. Bağlı şablon bulunamazsa **kapalı** (fail-closed), asla 7/24.
- **Yetki durumu için yeni tablo** `accessGrantStatus` (kişi×cihaz satırı); yazımlar **zaten çalışan** mutation'lara eklenir → yeni fonksiyon çağrısı ≈ 0. Overview reaktif değil, sayfalı.

---

## 1. Veri modeli

### 1.1 Mevcut durum (kanıt)
- Kural saatleri gömülü: `startTime/endTime/days` — `convex/schema.ts:441-443`; gün başına **tek aralık**.
- `isTemplate/templateName` alanları var ama kullanan akış yok (`convex/schema.ts:450-451`, yalnız `accessRules.update` arg'ı `convex/accessRules.ts:715-716`) → yeniden kullanmıyoruz, ölü alan olarak kalır.
- Doğrulayıcı gece aşan aralığı reddediyor: `convex/lib/accessRuleUx.ts:11` ("Geceyi aşan plan için ayrı kurallar oluşturun").
- Tatiller erişimde **kullanılmıyor**: `"holidays"` okuyan dosyalar yalnız PDKS/vardiya/SGK (`pdksDay.ts`, `shiftAssign.ts`, `sgkExport.ts`…); erişim yollarında (hikvisionSync, ideGatewayDevice, mobileAccess, cardReadings) yok. **Teyit edildi.** `syncHoliday` op'u şemada var (`schema.ts:633`) ama worker desteklemiyor (`actions/hikQueueWorker.ts:289`).

### 1.2 Yeni tablo `accessScheduleTemplates`
```ts
const interval = v.object({ start: v.string(), end: v.string() }); // "HH:MM", end "24:00" olabilir
accessScheduleTemplates: defineTable({
  projectId: v.id("projects"),
  name: v.string(),
  description: v.optional(v.string()),
  week: v.object({ Monday: v.array(interval), Tuesday: ..., Sunday: v.array(interval) }),
  holidayMode: v.optional(v.union(v.literal("ignore"), v.literal("deny"), v.literal("custom"))), // yok = ignore
  holidayIntervals: v.optional(v.array(interval)),       // yalnız custom
  version: v.number(),                                   // her kayıtta +1 (durum bayatlığı için)
  pendingSyncJobId: v.optional(v.id("_scheduled_functions")), // debounce (bkz. §3)
  isArchived: v.optional(v.boolean()),
  createdAt: v.string(), updatedAt: v.string(),
}).index("by_project", ["projectId"]).index("by_project_name", ["projectId", "name"])
```
**Doğrulama (saf, `convex/lib/accessSchedule.ts`):**
- `HH:MM`, dakika çözünürlüğü; `start < end`; `end` en çok `24:00`.
- Gün içinde sırala → **çakışan veya bitişik aralıkları birleştir** (08:00-12:00 + 12:00-13:00 → 08:00-13:00); çakışma hata değil, normalizasyon. UI birleştirmeyi gösterir.
- Gün başına **en çok 8 aralık** (Hik sınırı `MAX_SEGMENTS_PER_DAY = 8`, `lib/gateway/scheduling.ts:23`).
- IDE için: haftadaki **farklı (start,end) çifti sayısı K ≤ 8** (gerekçe §2.2). Aşarsa kayıt reddedilir.
- Gece aşan aralık: editörde "22:00 → 06:00" girilirse iki parçaya bölünür (gün d 22:00-24:00, gün d+1 00:00-06:00). Saklanan veri her zaman gün-içi.
- Hafta tamamen boşsa kayda izin ver ama UI "Bu şablon hiç erişim vermez" uyarısı gösterir.

### 1.3 Kurala bağlama (`accessRules`'a opsiyonel alanlar)
- `scheduleTemplateId: v.optional(v.id("accessScheduleTemplates"))` + index `by_template` (["scheduleTemplateId"]) — etkilenen kuralları bulmak için.
- `ideExtraPermissionNos: v.optional(v.array(v.number()))` — şablonun 2..K'inci IDE izin kaydı (1.'si mevcut `idePermissionNo`, `schema.ts:446`).
- **Öncelik:** `scheduleTemplateId` varsa şablon geçerli, gömülü `startTime/endTime/days` **yok sayılır ama silinmez** (geri dönüş = bağı kaldırmak). Yoksa bugünkü davranış birebir.
- Şablon silme: bağlı kural varsa engellenir ("N kural kullanıyor"); arşivleme serbest, arşivli şablon seçicide görünmez ama bağlı kurallar çalışmaya devam eder.
- Çözücü: `effectiveSchedule(rule, tpl | null)` → `{ week: Record<Weekday, Interval[]>, holiday: {mode, intervals} }`. `rule.scheduleTemplateId` var ama `tpl === null` → **tüm günler boş** + hata nedeni "Şablon bulunamadı". Legacy kural → bugünkü `defaultRuleSchedule` semantiği (`lib/hikSync.ts:53-73`).

## 2. Cihaza çeviri

### 2.1 Hikvision (gateway ISAPI + localBridge)
- Bugün: kural → `UserRightWeekPlanCfg/{n}` + `UserRightPlanTemplate/{n}` (aynı no), kişi `RightPlan[].planTemplateNo = n` (`actions/hikvisionSync.ts:575-595`, `lib/gateway/persons.ts:67-69`).
- `setWeekPlanOnDevice` zaten gün başına 8 segment gönderiyor (`scheduling.ts:60-75`) → şablonun `week`'i doğrudan `WeekScheduleEntry[]`'e açılır; `24:00` desteği var (`scheduling.ts:86-88`).
- **Sınır aşımı:** bugün 9. segment **sessizce atılıyor** (`scheduling.ts:62` döngüsü 8'de biter; `setHolidayPlan` `slice(0,8)` `scheduling.ts:166`). Yeni kural: çevirici 8'i aşarsa **göndermez, hedefi `failed` yapar** ("Gün başına 8 aralık sınırı"). Kayıt doğrulaması zaten engellediği için normalde oluşmaz.
- **Tatil:** `holidayMode !== "ignore"` ise aynı numarayla:
  1. `UserRightHolidayGroupCfg/{n}` ← projenin `holidays` satırları (bugünden itibaren 12 ay, ardışık günler aralığa birleştirilir). Grup başına ~16 kayıt sınırı (`scheduling.ts:121` yorum) `[teyit: cihaz capabilities]` → aşarsa en yakın 16 aralık + uyarı.
  2. `UserRightHolidayPlanCfg/{n}` ← `deny`: tüm segmentler `enable:false`; `custom`: `holidayIntervals`.
  3. `UserRightPlanTemplate/{n}` `holidayGroupNo: String(n)`.
  Sıra önemli: week plan → holiday plan/group → template (template son; yarım kalırsa eski template eski planı gösterir). Tatil planının hafta planını ezdiği `[teyit: DS-K1T8 canlı]`.
- `isHalfDay` tatiller (`schema.ts:1160`): v1'de tam gün sayılır, UI'da not.
- localBridge: `syncWeekPlan` op payload'ı `schedule` taşıyor (`hikvisionSync.ts:575-582`) → çoklu segment Windows köprüsünde destekleniyor mu `[teyit: ngsaccess-bridge SDK kodu]`. Tatil için yeni payload alanı (`holiday`) — köprü bilmiyorsa yok sayar → hedef "Hata: köprü tatili desteklemiyor" diye işaretlenmeli (köprü sürümü `hikBridges.lastClientInfo` ile).
- Plan numarası kapasitesi: global sayaç 65535'e kadar (`deviceSyncRuns.ts:247-249`); cihazın week plan/template sayısı daha az olabilir `[teyit: /UserRightWeekPlanCfg/capabilities]`. Bu tasarım **yeni numara üretmez** (kural numarası yeniden kullanılır) → risk artmaz.

### 2.2 IDE Smart (MQTT, permission record)
- Permission record **tek aralık** taşır: `schedule:{start,end,week_days}` (`ideSync.ts:64-91`, docs `05-crud…md:29-44`). Kullanıcı en çok **16** permission referansı (`ideSync.ts:73`); panel izinleri OR'lar (`09-access-control-logic.md` adım 7).
- Çeviri: şablonu **(start,end) çiftine göre grupla** → her çift 1 kayıt, `week_days` = o çiftin geçtiği günler. Örn. Pzt-Cum 08-12 + 13-17, Cmt 09-13 → K=3 kayıt. `io` bugünkü gibi `getRuleIoIdsForPanel` (`ideSync.ts:554-579`).
- Numara: 1. kayıt `rule.idePermissionNo`, kalanlar `ideExtraPermissionNos` (atomik atama `ensureIdePermissionNo` deseniyle; o fonksiyon bugün `accessRules`'ı sınırsız `.collect()` ediyor `ideSync.ts:539` → yeni kodda `by_idePermissionNo` index + `.order("desc").first()` önerilir).
- `end`: `24:00` → `1439` (son dakika dahil mi `[teyit]`).
- K azalırsa artık numaralar için `deletePermission` op'u; K değişirse üyelerin `permissions[]` dizisi değişir → yalnız bu durumda üye yeniden gönderimi gerekir.
- **16 sınırı:** kişinin bir paneldeki tüm kurallarının K toplamı >16 ise bugün `capPermissionNos` kırpıyor + uyarı (`ideGatewayDevice.ts:160-165`). Kırpma **erişim kaybı** üretir (güvenli yön). Overview'da bu kişi×cihaz "Hata: izin sınırı (16)" olur. Kayıtta K≤8 sınırı, tek şablonun tek başına sınırı doldurmasını önler.
- **Tatil:** native yok (permission ya weekly ya yearly, ikisi birden değil — docs `05-crud…md:58`). v1: IDE'de tatil **uygulanmaz**, şablon editörü ve sihirbaz IDE cihazlı kurallarda uyarı gösterir. (Alternatif `year_days` ile yıllık liste — yıl dönümünde yeniden gönderim + dizi boyu sınırı `[teyit]` → v2.)
- Gün kodlaması: permission `week_days` 0=Pazar (`ideSync.ts:43-52`) ama `NTP.DAY-WEEK` 0=Pazartesi (`10-full-parameter-reference.md:129`) → gün-kısıtlı şablonda canlı test şart `[teyit]`.

### 2.3 Bulut tarafı karar
- Mobil: `mobileRuleAllows` gömülü alanlara bakar ve `accessScheduleError(rule)` boşsa **reddeder** (`lib/mobileAccess.ts:30-39`) → şablonlu kural mobilde kapanır. Çözücüye taşınmalı: `isAllowedAt(effectiveSchedule, now, holidaysToday)` (Europe/Istanbul). Bulutta tatil desteklenebilir (holidays `by_project_date`, `schema.ts:1172`).
- Kart okuyucu (ESP32/QR) yolu saati hiç kontrol etmiyor (`cardReadings.ts:1178` → `lib/accessDecision.ts`) — bkz. "Ayrıca".

## 3. Değişiklik yayılımı

**Akış (şablon kaydı):**
1. `templates.update` mutation: doğrula → `version+1` → bağlı kuralları `by_template` ile `.take(101)` (101 → "100 kural sınırı" hatası, `deviceSyncRuns.ts:15`).
2. Eski `pendingSyncJobId` varsa `ctx.scheduler.cancel` → yeni `runAfter(20_000, createTemplateRun, {templateId})`; id şablona yazılır. Arka arkaya 5 kayıt = **1** çalıştırma.
3. `createTemplateRun` (internalMutation): `deviceSyncRuns` satırı `kind:"template_sync"` (union'a yeni literal + opsiyonel `templateId`; eski satırlar geçerli kalır), etkilenen cihazlar = kuralların cihaz ∪ kapı bacağı (`lib/accessGraph.ts:117-172` mantığı, ters yönden). Cihaz başına 1 hedef satırı; Hik/IDE başına 1 `executeTemplateTarget`.
4. `executeTemplateTarget` (action, **scheduleOnly**): 1 query (kurallar + şablon + numaralar + tatiller) →
   - Hik direct: kural başına `setWeekPlan` (+tatil) + `setPlanTemplate` HTTP; **kişi upsert YOK** (planTemplateNo değişmedi). Bugünkü `syncWeekPlanToDevicesInternal` her üyeyi yeniden yazıyor (`hikvisionSync.ts:625-665`) — şablon değişikliğinde gereksiz.
   - Hik localBridge: 1 mutation ile R adet `syncWeekPlan` op.
   - IDE: 1 mutation ile R×K `upsertPermission` (+ gereken `deletePermission`); yalnız K değiştiyse üye `upsertUser`'ları.
   - Sonda 1 `finishTarget` mutation (mevcut, `deviceSyncRuns.ts:318`).
5. Tatil tablosu değişince (`holidays.create/remove/seedTurkishHolidays`, `holidays.ts:60-113`): `holidayMode≠ignore` şablonu olan projede **tek** `template_sync` (debounce aynı).

**Kota tahmini** (R kural, D cihaz; Hik direct):
| | Bugün (kural başına mevcut sync, R ayrı tetik) | Öneri (tek template_sync) |
|---|---|---|
| Convex çağrısı | ≈ R×D×5 (prepareRule+ensureWeekPlan+syncWeekPlan action+iç query/mutation'lar) + üye başına gateway HTTP | 1 cancel/schedule + 1 createRun + D×3 + ~12 refreshSummary (5/15/30/60 sn, `lib/deviceSyncRun.ts:63-65`, 10 dk tavan) + 1 expireRun |
| Örnek R=5, D=10 | ~250 + 10×5×üye HTTP | **~45** |
IDE/localBridge'de ek olarak her op için köprü ack çağrısı (≈ R×K op/panel; poll zaten mevcut, yeni polling yok). Yeni cron/polling **yok**.

## 4. Yetki durumu verisi

**Bugün kişi×cihaz dağıtım durumu tutulmuyor:**
- Hik: yalnız hata op'ları (`recordSyncFailure`, payload `{employeeId}`) `hikPendingOperations`'ta; başarıda çözülüyor (`hikvisionSync.ts:266-297`). Gateway-direct başarı kalıcı iz bırakmaz.
- IDE: `idePanelUsers` = panelde var mı (`schema.ts:810-818`), `permissions` içeriği yok; op durumu `idePendingOperations` (idempotencyKey kart üzerinden, `ideSync.ts:186-188`).
- Run seviyesi yalnız **cihaz** başına (`deviceSyncRunTargets`, `schema.ts:776-797`).
Bunlardan kişi×kapı türetmek her sayfa için op tablolarını taramak demek → pahalı ve Hik-direct başarısı görünmez. **Öneri: yeni tablo.**

```ts
accessGrantStatus: defineTable({
  projectId: v.id("projects"), employeeId: v.id("employees"), deviceId: v.id("devices"),
  departmentId: v.optional(v.id("departments")),   // denormalize filtre
  state: v.union(v.literal("pending"), v.literal("effective"), v.literal("failed"), v.literal("removed")),
  ruleIds: v.array(v.id("accessRules")),           // son gönderimde uygulanan kurallar
  appliedAt: v.optional(v.number()), lastError: v.optional(v.string()),
  lastRunId: v.optional(v.id("deviceSyncRuns")), updatedAt: v.number(),
}).index("by_project_state", ["projectId","state"]).index("by_project_employee", ["projectId","employeeId"])
  .index("by_project_device", ["projectId","deviceId"]).index("by_employee_device", ["employeeId","deviceId"])
  .index("by_project_department_state", ["projectId","departmentId","state"])
```
**Yazım noktaları (yeni fonksiyon çağrısı yok, mevcut mutation'lara satır yazımı):**
- IDE: `enqueueIdeOp` (upsertUser → `pending`), `markAck` (`ideSync.ts:378`, success → `effective`, failed → `failed`). Payload'a `employeeId` eklenir (`v.any`, uyumlu).
- Hik localBridge: op enqueue → `pending`; köprü ack mutation'ı → `effective/failed` `[teyit: hikBridge.ts ack fonksiyon adı]`.
- Hik direct: action sonunda **tek** toplu `recordGrantResults` mutation (bugünkü `recordSyncFailure`/`resolveSuccesses` çağrılarının yanına; +1 çağrı/action).
- `deleteUser`/`deletePerson` başarısı → `removed` (satır silinmez; "kaldırıldı" görünür, 30 gün sonra temizlik mevcut retention işine eklenebilir).
- Hiç satırı olmayan çift = "Bilinmiyor" (özellik açılmadan önceki dağıtımlar). Backfill yok; "Tümünü yeniden dağıt" ile dolar.

**Bayatlık (şablon/kural sonradan değişti):** satır `appliedAt` < max(`rule.updatedAt`, şablon `updatedAt`) ise okuma anında "Bekliyor" gösterilir; toplu satır yazımı gerekmez.

**Kapı seviyesi:** satır cihaz düzeyinde; kapılar okuma anında türetilir — IDE: `getRuleIoIdsForPanel` mantığı; **Hik: kişi cihazdaki TÜM kapılara yazılıyor** (`persons.ts:55-69`, `hikvisionSync.ts:74-76`), `groupDoors` uygulanmıyor → Hik satırında kapı kolonu "Tüm kapılar (cihaz)" gösterilir, yalan kapı ayrıntısı üretilmez.

**Okuma maliyeti:** kişi×kapı çarpımı saklanmaz; satır = kişi×cihaz (500 kişi × 10 cihaz = 5.000 satır). Liste `.paginate()` 50 satır; sayaçlar `by_project_state` üzerinde `.take(1001)` ("1000+") — sayaç dokümanı yerine bu, çünkü toplu senkronda tek sayaç satırı OCC çakışması üretir. **Reaktif değil:** Overview `useConvex().query` ile tek seferlik + "Yenile" + ilgili `deviceSyncRuns` satırı `running→done` olunca otomatik bir yenileme (run satırı az değişir). Böylece 5.000 satır yazımı sırasında abonelik yeniden-koşumu (kota) olmaz.
**Yetkisiz:** saklanmaz; Kişi görünümünde tek kişi için proje kapıları − graf sonucu (sınırlı okuma) → "Yetkisiz" satırları.

## 5. UI akışı
Erişim Kontrolü sayfası bugün tek bileşen (`src/pages/AccessControl.tsx` → `UnifiedAccessControl`); üstüne sekme: **Kurallar · Zaman Şablonları · Yetki Durumu**.
1. **Zaman Şablonları listesi:** ad, özet ("Pzt–Cum 08:00–12:00, 13:00–17:00"), tatil davranışı, bağlı kural sayısı, son dağıtım durumu. "Yeni şablon", "Kopyala", "Arşivle".
2. **Editör:** 7 satır × 24 saat ızgara (15 dk adım, sürükle-boya) + gün başına aralık listesi (tam saat girişi). "Pazartesi'yi hafta içine kopyala", "Tümünü temizle". Tatil: Yok say / Kapalı / Özel saatler. Canlı önizleme: "Hik: en fazla 2 aralık/gün ✓ · IDE: 3 izin kaydı ✓ · IDE'de tatil uygulanmaz ⚠". Kaydet → onay: "4 kural, 9 cihaz güncellenecek; 20 sn içinde tek gönderim başlar."
3. **Kural sihirbazı:** `components/TimeSchedule.tsx` içinde seçici: **Şablon kullan | Özel saat**. Şablonda salt-okuma önizleme + "Şablonu düzenle" bağlantısı; Özel = bugünkü alanlar (değişmez). Şablona geçişte gömülü alanlar korunur (geri dönüşte eski saat geri gelir).
4. **Yetki Durumu (Overview):** sayaç çipleri Tümü / Etkin / Bekliyor / Hata / Bilinmiyor; filtre: departman (`DepartmentTree`), cihaz, kural, şablon, durum, ad arama. Görünüm: **Kişi** (kolon: Kişi, Departman, Cihaz, Kapı(lar), Kural, Şablon, Durum+hata ipucu, Son güncelleme) / **Cihaz** (cihaz başına sayaçlar, açılınca kişiler). Aksiyon: "Seçilileri yeniden dağıt" (≤100 kişi×cihaz → **tek** run, mevcut `syncEmployeeToDevicesInternal` `targetDeviceIds` ile) ve "Hatalıları yeniden dağıt".

## 6. Riskler ve geri dönüş
1. **Sessiz 7/24 açılma:** `defaultRuleSchedule` boş alanı 7/24'e çevirir (`hikSync.ts:58-66`; worker da `hikQueueWorker.ts:189`). Şablonlu kuralın gömülü alanları boş olabilir → çözücü atlanırsa kapı 7/24 açılır. Önlem: tüm çağıranlar (`hikvisionSync.ts:200,538`, `hikQueueWorker.ts:190`, IDE `buildIdePermissionRecord`, mobil) çözücüye geçer; şablon yoksa **boş plan**; test: "şablonu silinmiş kural → cihaz payload'ı tüm segmentler enable:false".
2. **Hik tek şablon/kişi/cihaz:** kişi aynı cihazda 2 kuraldaysa ilk/son yazan kazanır (`hikvisionSync.ts:149` dedupe, `persons.ts:67-69` tek `planTemplateNo`). Şablonlar çoklu kuralı yaygınlaştırır. Önlem: `planTemplateNo` CSV ("3,7") desteği `[teyit: cihazda]`; yoksa Overview'da "Çakışan kural: yalnız X uygulanıyor" uyarısı.
3. **Kısmi senkron:** bazı cihazlar yeni planda, bazıları eskide → kapılar farklı saatte açılır. Run `partial` görünür + "Hatalıları yeniden dağıt"; Hik'te template en son yazılır.
4. **IDE farkları:** tatil yok, 16 izin sınırı (kırpma → erişim kaybı), gün numarası belirsizliği. UI'da IDE cihazlı kural için uyarı + canlı test (W4 uygulama adımı 9).
5. **Overview yanıltması:** Hik kapı ayrıntısı yok, eski dağıtımlar "Bilinmiyor". Etiketler bunu açıkça söyler.

**Geri dönüş:** gömülü alanlar hiç silinmediği için kuralı şablondan ayırmak (`scheduleTemplateId` unset) + kural senkronu = eski davranış. Yeni tablolar okunmazsa sistem eskisi gibi çalışır; şema değişikliği yalnız opsiyonel alan + yeni tablo + union'a literal ekleme.

---

## Uygulama adımları
- [ ] 1. Saf lib `convex/lib/accessSchedule.ts`: tip, doğrula/birleştir, `effectiveSchedule`, `toHikSchedule`, `toIdePermissionSegments`, `isAllowedAt` + birim testleri (fail-closed, 8 segment, K≤8, gece bölme). **~2 sa** — `vitest accessSchedule`.
- [ ] 2. Şema: `accessScheduleTemplates`, `accessGrantStatus`, `accessRules` opsiyonel alanları + `by_template`, `deviceSyncRuns.kind` "template_sync" + `templateId?`. **~30 dk** — `tsc` 0.
- [ ] 3. Şablon CRUD (authedMutation, proje kapsamı, silme koruması, liste + bağlı kural sayısı `.take`). **~1.5 sa** — handler testleri.
- [ ] 4. Çözücüyü Hik (iki action + worker), IDE (çoklu kayıt + ekstra numara + silme), mobil karara bağla. **~3 sa** — mevcut `accessRuleUx`/`ideSync`/`mobileAccess` testleri + yeni payload snapshot testleri.
- [ ] 5. `template_sync` run: debounce/cancel, `executeTemplateTarget` scheduleOnly. **~3 sa** — `deviceSyncRun` testleri + çağrı sayımı testi.
- [ ] 6. Hik tatil (group/plan/template) + holidays tetikleyicisi + IDE uyarısı. **~2 sa** — payload testi.
- [ ] 7. `accessGrantStatus` yazımları (IDE enqueue/ack, Hik bridge ack, Hik direct toplu). **~3 sa** — ack testleri.
- [ ] 8. Overview sorguları (sayfalı, sayaç `.take(1001)`, bayatlık) + "yeniden dağıt" action. **~2 sa**.
- [ ] 9. UI: sekmeler, şablon listesi + 7×24 editör, sihirbaz seçici, Overview. **~1.5 gün** — Orca tarayıcıda doğrulama.
- [ ] 10. Canlı doğrulama: K1T804 (gateway) çoklu segment + tatil; IDE panel K=3 + gün numarası. **~1 sa** (cihaz erişimine bağlı).

## Emre'ye açık kararlar
1. **IDE'de tatil:** v1'de uygulanmasın, uyarı gösterilsin. (Öneri: evet; günlük cron'la izin aç/kapa kota + kapı kilitli kalma riski taşıyor.)
2. **Hik'te kişi birden çok kuralda aynı cihazda:** önce cihazda `planTemplateNo` CSV denensin; çalışmazsa yalnız uyarı. (Öneri: CSV denemesi adım 10'a eklensin.)
3. **Şablon kaydı → otomatik dağıtım mı?** Öneri: kayıtta "N kural, M cihaz etkilenecek" onayı + 20 sn debounce'lu tek gönderim.
4. **Overview canlı mı?** Öneri: canlı değil; "Yenile" + gönderim bitince tek otomatik yenileme (kota).

Ayrıca: kart okuyucu/QR karar yolu (`cardReadings.ts:1178`, `lib/accessDecision.ts`) kuralın saatine hiç bakmıyor — bu iş kapsamı dışı, ayrı ele alınmalı.
