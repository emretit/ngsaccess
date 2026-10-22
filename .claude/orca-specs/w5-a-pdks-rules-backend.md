# W5-A — PDKS kuralları: tarihli kural sürümü + giriş/çıkış zorunluluğu + check point: BACKEND (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any`/`as any` YASAK (eslint error); `unknown` + narrowing; `!` yerine erken return; tip korumalı filtre (`filter((x): x is T => ...)`), `filter(Boolean)` değil.
- Convex: önce `convex/_generated/ai/guidelines.md`. Sınırsız `.collect()` yok (`.take(N+1)` + Türkçe sınır hatası ya da `.paginate`); yeni cron/polling YOK (Convex Free kota). Handler'lar şema alan adlarını olduğu gibi (camelCase) döner.
- Şema: yalnız YENİ tablo / opsiyonel alan. Mevcut alan silme/daraltma yok, migration yok; mevcut kayıtlar değişmeden çalışır.
- YASAK: commit, push, deploy, `npx convex *` (codegen canlıya index kurar), DB yazma, `mobile/**`, `bridge/**`, `package.json`/lock, `convex/shifts.ts` + vardiya tanımı (W5.3 esnek vardiya AYRI iş), UI ekranları (W5-C). `convex/_generated/**` yasak; tek istisna yeni modül için `convex/_generated/api.d.ts`'e codegen'in üreteceği 2 satır (import + `fullApi` anahtarı).
- Kullanıcıya görünen metin/hata Türkçe. Kişi verisi loglanmaz.

## Hedef (test edilebilir)
Proje için tarihli (yarından itibaren geçerli) bir PDKS kural sürümü yayınlanabilir; sürümü olmayan tarihler bugünkü hesapla **birebir** aynı sonuç verir (mevcut testlerin beklentileri değişmez). Sürümlü tarihlerde (a) yalnız seçili kapı/cihaz okutmaları PDKS'e sayılır, (b) eksik okutma ayara göre "Devamsız" ya da yeni "İnceleme" (`incomplete`) olur — tablo, detay, bordro, raporlar, dashboard ve SGK aynı kararı verir.

## Bağlam (kodda doğrula; satırlar kayabilir)
- Tasarım (otoriter, salt-okuma, mutlak yol): `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §2 (zorunluluk), §3 (check point), §5 (etki). Esnek vardiya (§1) ve export (§4) BU İŞİN DIŞINDA.
- Emre kararları (sentez `/Users/emreaydin/ngsaccess/.claude/designs/w4-w5-sentez.md` sonu): eski projeler legacy kalır; yeni mod önerisi iki yön zorunlu, tek yön → İnceleme, hiç okutma → Devamsız; otomatik tam süre üretilmez; kurallar yarından geçerli sürümle kaydedilir, geçmişe yeniden hesap yok; check point v1 = kapı + cihaz düzeyi, okuyucu seçimi yok.
- Bu dal: W3b + W4.0 + W4.1 + W4.2 (`2b67349`). W2 (`employedOn`/`employedDuring`, `convex/lib/employment.ts`) tabanda; davranışı korunur.
- Günlük ortak hesap: `convex/lib/pdksDay.ts` `computePdksDay` (~47; ilk/son izinli okuma ~61-80). Durum: `convex/lib/pdksCalc.ts` `resolveDayStatus`. Tüketiciler: `convex/lib/pdksTable.ts`, `pdksPayroll.ts`, `pdksDetail.ts`, `pdksWorkDay.ts`, `overtimeCalc.ts`, `reportAttendance.ts`.
- Tek filtre sınırı: `convex/lib/pdksSource.ts` `filterPdksReadings` (~79) / `isPdksEligibleReading` (~73). Çağıranlar: `convex/cardReadings.ts` (~468 tablo, ~666 bordro, ~1326 detay), `convex/lib/reportScope.ts` `readReportReadings` (~29; `convex/reports.ts` 3 yer), `convex/sgkExport.ts` (~67), `convex/dashboard.ts` (~247), `convex/lib/mobileAttendance.ts` (~138), `convex/lib/pdksAvailability.ts` (~18-19, `readPdksAvailableDateKeys` ~55).
- Okuma belgesi: `cardReadings.deviceId?`, `ideIoId?`, `direction?` (entry|exit); kapı/okuyucu kimliği YOK. Kapı: `doors.deviceId?`, `doors.ioId?` (IDE), `doors.hikDoorNo?` (Hik). IDE okuma→kapı eşlemesi örneği `convex/lib/cardReadingAudit.ts` (~42, ~76).
- Admin guard deseni: `convex/settings.ts` `adminMutation` + proje erişim kontrolü (mevcut ayar mutation'larını örnek al; project_admin yalnız kendi projesi, super_admin hepsi). Denetim kaydı: mevcut audit yardımcısı.

## Değişiklik
1. **Şema (yeni tablolar):**
   - `pdksRuleVersions`: `projectId`, `effectiveFrom` (YYYY-MM-DD, TR günü), `punchMode: "legacy"|"requirements"`, `requireCheckIn?`, `requireCheckOut?` (boolean), `missingRequiredPunch?: "absent"|"review"`, `noPunch?: "absent"|"review"`, `checkpointMode: "all"|"selected"`, `createdAt`, `createdBy: v.id("users")`. Index `by_projectId_and_effectiveFrom`.
   - `pdksCheckpointSelections`: `projectId`, `ruleVersionId`, `targetType: "door"|"device"`, `deviceId`, `doorId?`, `ioId?` (seçim anındaki fiziksel eşleme snapshot'ı). Index `by_ruleVersionId`. Sürüm başına ≤500 hedef.
2. **Saf çözümleyici (YENİ `convex/lib/pdksRules.ts` + test):** `PdksDayPolicy` tipi (legacy+all = varsayılan). `policyFor(dateKey)` (iş günü = vardiya başlangıç günü; gece oturumu giriş gününün sürümünü taşır). Check point predicate: `device` hedefi → `reading.deviceId` eşit; `door` hedefi → IDE: `deviceId`+`ideIoId===ioId`; tek kapılı cihaz: `deviceId`. Cihazı olmayan (mobil/QR) okuma `selected` modda hariç. Manuel `pdksRecords` check point'e tabi DEĞİL.
3. **Yükleyici:** `loadPdksRulePolicy(ctx, projectId, startDate, endDate)` → başlangıçtan önceki son sürüm (desc take 1) + aralıktaki sürümler (take 65; >64 → Türkçe hata) + seçimler (`by_ruleVersionId`, take 501). Çağrı başına bir kez; okuma başına DB çağrısı YOK. Çok projeli sorgularda proje başına bir kez.
4. **Tek filtre sınırı:** `filterPdksReadings`'i (ya da yanına politika-farkında bir varyant) kaynak + proje + check point kararını tek yerde verecek şekilde genişlet; YUKARIDAKİ TÜM çağıranları bu sınıra taşı (`pdksAvailability` dahil: dışlanan okumalar o günü "veri var" yapmaz → mevcut noData semantiği). Legacy+all'da çıktı bugünküyle birebir. `privacyRetention.ts` ve `actions/getChatData.ts` (AI örnek bağlamı) KAPSAM DIŞI — dokunma.
5. **Giriş/çıkış kanıtı (YENİ `convex/lib/pdksEvidence.ts` + test):** `resolveAttendanceEvidence(dayReadings, manual, policy)` saf. `legacy` → bugünkü davranış (dokunma; `computePdksDay` legacy dalı aynen). `requirements` → açık `direction` esas: en erken giriş + onu izleyen en son çıkış; iki giriş çift değildir; yönsüz okumalar "Yön belirsiz" (incomplete, otomatik devamsız DEĞİL); manuel giriş/çıkış kendi yönüyle geçerli kanıt. Tasarım §2 kombinasyon matrisini birebir uygula: eksik zorunlu yön → `missingRequiredPunch` (absent=DV / review=`incomplete`); hiç okutma → `noPunch`. Tek yönlü günde süre ölçülemez: `durationMeasured=false`, dakika 0, sentetik saat yok.
6. **Durum + tüketiciler:** yeni gün durumu `incomplete` ("İnceleme", bordro kodu `—`). Öncelik: istihdam dışı/gelecek/noData → tatil/izin → devam kuralı; tatilde eksik çıkış yalnız kalite uyarısı. `incomplete` devam/devamsız/SGK gününe kesin eklenmez; ayrı sayaç (`incompleteDays`). `computePdksDay` sonucuna `durationMeasured`, `punchQuality` (ör. `ok|missingEntry|missingExit|noPunch|undirected`) ekle; tablo/detay/bordro/rapor/dashboard aynı sonucu kullanır.
7. **SGK (`convex/sgkExport.ts`):** legacy tarihlerde sonuç birebir aynı. Sürümlü tarihlerde check point filtresi + `requirements` modunda gün kararı ortak kanıt çözümleyicisinden; `incomplete` günler çalışan başına `reviewDays: string[]` olarak döner (UI W5-C'de APHB indirmeyi buna göre uyaracak). Belirsiz günü sessizce "çalıştı" ya da "eksik gün yok" saymak YASAK.
8. **API (YENİ `convex/pdksRules.ts` + test):**
   - `getRules({projectId})` query → yürürlükteki sürüm, gelecek sürümler, son 20 geçmiş + her sürümün hedefleri.
   - `listCheckpointTargets({projectId})` query → proje cihazları + kapıları; her kapıda `selectable` + `reason` (çok kapılı Hik kapısı: okumada kapı no kanıtı yok → seçilemez, "cihazın tüm geçişleri" seçilebilir). Sınırlı okuma.
   - `publishRuleVersion({projectId, effectiveFrom, punchMode, requireCheckIn?, requireCheckOut?, missingRequiredPunch?, noPunch?, checkpointMode, targets?})` mutation: yetki (project_admin kendi projesi / super_admin); `effectiveFrom` ≥ yarın (TR); `requirements` modunda 4 alan zorunlu; `selected` + boş hedef → hata; başka projenin cihaz/kapısı → hata; aynı proje+tarihte gelecek sürüm varsa yerine geçer (yürürlüğe girmiş sürüm DEĞİŞTİRİLEMEZ); tek mutation, tek audit kaydı.
   - `deleteFutureRuleVersion({ruleVersionId})` mutation: yalnız henüz yürürlüğe girmemiş sürüm; seçimleriyle birlikte.
   - Bu ayarlar cihaz senkronu TETİKLEMEZ.
9. **Yalnız tip uyumu için `src/**`:** yeni `incomplete` durumu frontend'de exhaustive switch/Record yüzünden tsc kırarsa, YALNIZ o dosyalarda en küçük eşleme ("İnceleme" etiketi, nötr renk). Yeni ekran/form YAZMA; dokunduğun her `src` dosyasını raporda listele.

## Testler (en az)
- **Altın uyumluluk:** sürüm yok = bugünkü sonuç; mevcut test dosyalarındaki beklentiler DEĞİŞMEZ (bir beklentiyi değiştirmek zorunda kalırsan dur, `worker_done`'da gerekçeyle bildir).
- Kanıt: §2 matrisinin 4 kombinasyonu × (çift / yalnız giriş / yalnız çıkış / hiç) + yönsüz okuma + manuel kayıt + tatilde eksik çıkış.
- Check point: IDE kapı (deviceId+ioId), tek kapılı cihaz, cihaz hedefi, çok kapılı Hik kapı seçimi reddi, mobil/QR selected'da hariç, silinmiş kapı (snapshot ile çalışır), yabancı proje reddi, manuel kayıt check point'ten muaf, tamamı dışlanan gün → noData.
- Sürüm: tarih sınırı (gece oturumu giriş gününün sürümü), yarından önce yayın reddi, yürürlükteki sürümü değiştirme reddi, >64 sürüm / >500 hedef hatası, yetki (project_user reddi, başka proje reddi).
- Tutarlılık: aynı çalışan/gün için tablo = detay = bordro = rapor = SGK kararı (requirements + selected senaryosu); `incomplete` devamsız sayılmaz, ayrı sayaçta.
- W2: istihdam dışı gün yeni kuralla "aktif" olmaz.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
`convex/schema.ts` (yalnız 2 yeni tablo) · YENİ `convex/pdksRules.ts` (+test) · YENİ `convex/lib/pdksRules.ts` (+test) · YENİ `convex/lib/pdksEvidence.ts` (+test) · `convex/_generated/api.d.ts` (2 satır) · `convex/lib/pdksSource.ts` · `convex/lib/pdksAvailability.ts` · `convex/lib/pdksDay.ts` · `convex/lib/pdksCalc.ts` · `convex/lib/pdksTable.ts` · `convex/lib/pdksPayroll.ts` · `convex/lib/pdksDetail.ts` · `convex/lib/pdksWorkDay.ts` · `convex/lib/overtimeCalc.ts` · `convex/lib/reportAttendance.ts` · `convex/lib/reportScope.ts` · `convex/reports.ts` · `convex/cardReadings.ts` · `convex/sgkExport.ts` · `convex/dashboard.ts` · `convex/lib/mobileAttendance.ts` · ilgili mevcut test dosyaları · madde 9'daki dar `src` tip uyumu.

## Kapsam dışı
Esnek vardiya (W5.3) · ayar/check point UI ve APHB uyarı UI'ı (W5-C) · export kolon seçici (W5-D, paralel worker; `src/lib/reports/**`, `src/components/reports/**`, `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx`, `src/utils/pdksExport.ts` ONUN — dokunma) · okuyucu düzeyi seçim · Hik olayından kapı no çıkarma · geçmişe yeniden hesap/backfill · ham okutma raporuna "PDKS'e dahil" kolonu · `privacyRetention.ts`, `actions/getChatData.ts`.

## Kapılar (kendin koş; `npm ci` GEREKMEZ, node_modules kurulu)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı).

## Rapor
`/tmp/w5a-report.md` + `worker_done`'da ≤10 satır (file:line): değişen dosyalar · filtre sınırına taşınan çağıranlar · yeni durum/alanlar · değişen mevcut test beklentisi (olmamalı) · kapı sayıları. API özetini `/tmp/w5a-api.md`'ye yaz (UI worker okuyacak: fonksiyon adları, arg/dönüş tipleri, `incomplete`/`punchQuality`/`durationMeasured`/`reviewDays` alanlarının hangi sorgu dönüşünde olduğu).
