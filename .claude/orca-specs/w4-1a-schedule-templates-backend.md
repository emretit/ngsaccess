# W4.1a — Erişim zaman şablonları: BACKEND (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex handler'ları schema alan adlarını olduğu gibi (camelCase) döner. `db.get` null filtreleme: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Convex kuralları: önce `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok (`.take(N+1)` + sınır hatası); yeni cron/polling YOK (Convex Free kota).
- YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen/run — codegen canlıya index kurar), DB yazma, `mobile/**`, `bridge/**` ve `src/**` (bu iş yalnız backend; UI W4.1b).
- `convex/_generated/**` YASAK, tek istisna: yeni modül için `convex/_generated/api.d.ts`'e codegen'in üreteceği iki satırı elle ekle (import + `fullApi` anahtarı, alfabetik yerine). Başka hiçbir şey.

## Hedef (test edilebilir)
Bir projede adlandırılmış haftalık zaman şablonu (gün başına ≤8 aralık) oluşturulup kurala bağlanabilir; bağlı kuralın saati Hik (gateway + localBridge), IDE Smart, mobil ve bulut kart/QR kararında TEK saf çözücüden gelir; şablon/bağ bulunamazsa erişim KAPALI (asla 7/24); şablon değişince 20 sn debounce'lu TEK `template_sync` çalıştırması yalnız planları yeniden gönderir.

## Bağlam (kodda doğrula)
- Tasarım: `.claude/designs/w4-template-claude.md` §1-3 (otoriter) · sentez `.claude/designs/w4-w5-sentez.md`. Tatil YOK, yetki durumu tablosu/ekranı YOK (W4.2).
- W4.0 üstüne kuruluyorsun (bu dal): `convex/lib/ruleSchedule.ts` `isRuleOpenAt` (bulut kararı; bitiş dakikası DAHİL çünkü Hik `HH:MM:59` alır `convex/lib/hikSync.ts` ~70), `convex/lib/accessDecision.ts` `openRuleIds`, `convex/actions/hikvisionSync.ts` kapı başına virgüllü `planTemplateNo`, kural başına `hikWeekPlanNo`.
- Saat tüketicileri (hepsi çözücüye geçmeli): `lib/hikSync.ts defaultRuleSchedule`, `actions/hikvisionSync.ts`, `actions/hikQueueWorker.ts` (~190), `ideSync.ts buildIdePermissionRecord` (~55-66, tek aralık, `MAX_PERMS_PER_USER=16`), `actions/ideGatewayDevice.ts capPermissionNos`, `lib/mobileAccess.ts mobileRuleAllows`, `lib/cardReadingProcess.ts`, `lib/accessRuleUx.ts accessScheduleError`. `actions/hikDebug.ts` debug — dokunma.
- Hik segment gönderimi: `lib/gateway/scheduling.ts setWeekPlanOnDevice` (gün başına 8, `normalizeEndTime`). Bugün 9. segment sessizce atılıyor.
- Kural mutation'ları: `convex/accessRules.ts` `create/update/createWithGroups/updateWithGroups(Tracked)` (`authedMutation`; yetki kontrolünü aynen kopyala). Çalıştırma altyapısı: `convex/deviceSyncRuns.ts`, `convex/lib/deviceSyncRun.ts`, şemada `deviceSyncRuns.kind` (~754).

## Değişiklik
1. **Saf lib `convex/lib/accessSchedule.ts` (YENİ, +test):** `Weekday`, `Interval {start,end}` ("HH:MM", end ≤ "24:00"), `WeekSchedule = Record<Weekday, Interval[]>`.
   - `normalizeWeek(week)`: doğrula (`start < end`, format), gün içinde sırala + çakışan/BİTİŞİK aralıkları birleştir; birleştirme sonrası gün başına >8 → hata. Hata mesajları Türkçe.
   - `splitOvernight(day, start, end)`: "22:00→06:00" → gün d 22:00-24:00 + d+1 00:00-06:00 (UI yardımcı; saklanan veri hep gün-içi).
   - `effectiveSchedule(rule, template | null)`: `rule.scheduleTemplateId` yok → bugünkü `defaultRuleSchedule` semantiği BİREBİR (boş = 7/24); var ama `template === null` (silinmiş/başka proje) → tüm günler boş (fail-closed). Arşivli şablon = geçerli (bağlı kurallar çalışmaya devam eder).
   - `isAllowedAt(week, nowMs)`: Europe/Istanbul; sınır semantiği Hik'e gidenle AYNI (aralık sonu Hik'e nasıl gidiyorsa — `24:00` dahil — testle sabitle; W4.0 `isRuleOpenAt` ile legacy kuralda aynı sonucu vermeli).
   - `toHikWeekSchedule(week)` → `setWeekPlanOnDevice` girdisi; >8 → hata (gönderme).
   - `toIdePermissionSegments(week)` → (start,end) çiftine göre grupla, her çift `{start,end(dk), week_days}` (IDE gün kodlaması mevcut `daysToIdeWeekDays` ile); K>8 → hata. `24:00` → 1439.
2. **Şema (`convex/schema.ts`):**
   - YENİ `accessScheduleTemplates`: `projectId: v.id("projects")`, `name`, `description?`, `week` (7 gün × `v.array(v.object({start,end}))`), `version: v.number()`, `pendingSyncJobId?: v.id("_scheduled_functions")`, `isArchived?`, `createdAt`, `updatedAt`; index `by_project`, `by_project_name`.
   - `accessRules`: `scheduleTemplateId?: v.id("accessScheduleTemplates")` + index `by_template`; `ideExtraPermissionNos?: v.array(v.number())`. Gömülü `startTime/endTime/days` silinmez; şablon bağlıyken yok sayılır.
   - `deviceSyncRuns.kind` union'a `"template_sync"` + opsiyonel `templateId`. Hepsi opsiyonel/ek → migration yok.
3. **Şablon API — YENİ modül `convex/accessScheduleTemplates.ts` (+test):** `list` (proje kapsamı, arşiv filtresi, her şablon için bağlı kural sayısı `.take(101)`), `get`, `create`, `update` (version+1), `duplicate`, `setArchived`, `remove` (bağlı kural varsa Türkçe hata "N kural kullanıyor"), `previewImpact({templateId, week?})` → `{ruleCount, deviceCount, hikMaxSegmentsPerDay, ideRecordCount (K), ideOverLimit: [{employeeId, deviceId, total}] (sınırlı, ilk 20)}`. Yetki = kural mutation'larıyla aynı (proje admin/super_admin; `project_user` yazamaz). Ad proje içinde benzersiz.
4. **Kurala bağlama:** `accessRules` create/update(+WithGroups/Tracked) `scheduleTemplateId` alır (`null` = bağı kaldır). Kontrol: aynı proje, yeni bağda arşivli değil. `accessScheduleError`: şablonlu kuralda gömülü alan zorunlu değil. Bağ değişince mevcut kural senkronu tetiklenir (IDE kayıt sayısı değişebilir).
5. **IDE 16 sınırı = yayın engeli (Emre kararı, kırpma yok):** şablon `update`/`create`'te ve kurala bağlamada, etkilenen her üye×IDE panel için toplam izin kaydı (tüm kuralları, şablonlu kural K kayıt) > 16 ise mutation Türkçe hatayla reddeder (ilk 5 kişi adı/panel). Okuma sınırlı (`.take`), aşarsa "çok büyük kapsam" hatası. Senkron anında yine aşılırsa (sonradan üyelik eklendi) mevcut `capPermissionNos` güvenli yönde kalsın AMA hedef `failed` + neden yazılsın (sessiz değil).
6. **Çözücüyü bağla:** Hik gateway (`setWeekPlan` çoklu segment), localBridge (`syncWeekPlan` payload'ı çoklu segment taşıyabiliyorsa onu kullan; Windows köprüsünün uygulayıp uygulamadığı **[teyit cihazda]** — raporda yaz), IDE (şablonlu kural K kayıt: 1. `idePermissionNo`, kalanlar `ideExtraPermissionNos`, atomik numara ataması mutation içinde, K azalınca artan numaralar için `deletePermission`, kişinin `permissions[]`'ına tüm K numara), mobil (`mobileRuleAllows`: şablonlu kural → `isAllowedAt(effectiveSchedule)`; legacy davranış DEĞİŞMEZ), bulut kart/QR (`isRuleOpenAt` şablonlu kuralda çözücüyü kullanır; şablonu çağıran sorgu okur).
7. **`template_sync`:** `update` sonrası eski `pendingSyncJobId` varsa `ctx.scheduler.cancel`, yeni `runAfter(20_000, internal…createTemplateRun, {templateId})`, id şablona yazılır (5 kayıt = 1 çalıştırma). `createTemplateRun`: bağlı kurallar `by_template` `.take(101)` (101 → hata, `deviceSyncRuns.ts` 100 sınırı deseni); etkilenen cihazlar = kuralların cihaz ∪ kapı bacağı; cihaz başına 1 hedef. `executeTemplateTarget` (scheduleOnly): Hik direct kural başına week plan + plan template, KİŞİ UPSERT YOK; localBridge R `syncWeekPlan` op tek mutation'da; IDE R×K `upsertPermission` (+silme), üye `upsertUser` YALNIZ K değiştiyse. Sonda mevcut `finishTarget`.

## Testler (en az)
- `accessSchedule`: birleştirme (çakışan+bitişik), 9. aralık hatası, gece bölme, `24:00`, fail-closed (şablon null → hiç açık değil + Hik payload tüm segment `enable:false`), legacy kural = `defaultRuleSchedule` ile aynı çıktı, `isAllowedAt` İstanbul sınır dakikaları, IDE gruplama K ve K>8 hatası.
- Şablon API: yetki (project_user reddi, başka proje reddi), benzersiz ad, bağlı şablon silme reddi, arşiv, previewImpact sayıları, 16 sınırı reddi.
- Kural bağlama: şablonlu kural mobil + bulut kararında şablon saatine uyar; bağ kaldırılınca eski saat geri gelir.
- `template_sync`: 5 ardışık update → 1 zamanlanmış iş; Hik direct'te kişi çağrısı 0; IDE K değişmezse `upsertUser` 0; çağrı sayımı testi.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
YENİ `convex/lib/accessSchedule.ts`(+test) · YENİ `convex/accessScheduleTemplates.ts`(+test) · `convex/schema.ts` (yalnız yukarıdaki ekler) · `convex/_generated/api.d.ts` (yalnız 2 satır) · `convex/accessRules.ts` · `convex/lib/accessRuleUx.ts` · `convex/lib/ruleSchedule.ts` · `convex/lib/hikSync.ts` · `convex/lib/gateway/scheduling.ts` · `convex/actions/hikvisionSync.ts` · `convex/hikvisionSync.ts` · `convex/actions/hikQueueWorker.ts` · `convex/ideSync.ts` · `convex/actions/ideGatewayDevice.ts` · `convex/lib/mobileAccess.ts` · `convex/lib/cardReadingProcess.ts` · `convex/cardReadings.ts` (yalnız karar bloğu) · `convex/deviceSyncRuns.ts` · `convex/lib/deviceSyncRun.ts` · ilgili mevcut test dosyaları.

## Kapsam dışı
UI (`src/**`, W4.1b) · tatil · `accessGrantStatus` / yetki durumu ekranı (W4.2) · Windows köprü C# · Flutter mobil · `hikDebug.ts` · eski `isTemplate/templateName` alanları (ölü, dokunma).

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `npm ci` (worktree yeniyse) sonra:
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)

## Rapor
`worker_done`'da ≤10 satır (file:line): değişen dosyalar · API imzaları (UI için: fonksiyon adları + arg/dönüş tipi kısaca) · bitiş sınırı kararı · localBridge çoklu segment durumu · cihazda doğrulanacaklar · kapı sonuçları (sayılarla). Ayrıca API özetini `/tmp/w41a-api.md` dosyasına yaz (UI worker'ı okuyacak).
