# W4.2a — Yetki durumu (kişi×cihaz): BACKEND (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any`/`as any` YASAK (eslint error); `unknown` + narrowing; `!` yerine erken return; tip korumalı filtre (`filter((x): x is T => ...)`), `filter(Boolean)` değil.
- Convex: önce `convex/_generated/ai/guidelines.md`. Sınırsız `.collect()` yok (`.take(N+1)` + sınır hatası ya da `.paginate`); yeni cron/polling YOK (Convex Free kota). Handler'lar şema alan adlarını olduğu gibi döner.
- YASAK: commit, push, deploy, `npx convex *` (codegen canlıya index kurar), DB yazma, `src/**` (UI W4.2b), `mobile/**`, `bridge/**`, `package.json`/lock. `convex/_generated/**` yasak; tek istisna yeni modül için `convex/_generated/api.d.ts`'e codegen'in üreteceği 2 satır (import + `fullApi` anahtarı).

## Hedef (test edilebilir)
Her kişi×cihaz için son dağıtım durumu (`pending` / `effective` / `failed` / `removed`) kalıcı tutulur ve sayfalı, reaktif olmayan sorgularla filtrelenip sayılabilir; "Etkin" = cihaz kabul etti (IDE ack success / Hik localBridge ack ok / Hik gateway HTTP başarı). Toplu "yeniden dağıt" tek run başlatır.

## Bağlam (kodda doğrula)
- Tasarım (otoriter, salt-okuma, mutlak yol): `/Users/emreaydin/ngsaccess/.claude/designs/w4-template-claude.md` §4 (+ §5 madde 4 UI için). Emre kararı: "Etkin" = cihaz kabul etti; katı geri-okuma kanıtı YOK; Overview canlı değil ("Yenile" + run bitince tek otomatik yenileme).
- Bu dal: W3b (`3b7e57c`) + W4.0 (`92e6995`, Hik artık kural başına KAPI kapsamı uyguluyor → Hik satırında kapı ayrıntısı gerçek) + W4.1 (`6ff9d42`, zaman şablonları, `scheduleTemplateId`, `template_sync`).
- Yazım noktaları: IDE `convex/ideSync.ts` `enqueueIdeOpInTransaction` (~240) + `markAck` (~385); Hik localBridge op kuyruğa yazma (`convex/hikvisionSync.ts`) + `ackLocalBridgeOperation` (~632); Hik gateway direct `convex/actions/hikvisionSync.ts` (`recordSyncFailure` ~388 / başarı temizliği `resolveTargetFailures` ~859 çağrılarının yanında); silme yolları (`deleteUser`/`deletePerson`). Run altyapısı `convex/deviceSyncRuns.ts`, `convex/lib/deviceSyncRun.ts`. Kural/kapı grafiği `convex/lib/accessGraph.ts` (+Pure). Departman `employees.departmentId`.

## Değişiklik
1. **Şema:** yeni `accessGrantStatus` — `projectId: v.id("projects")`, `employeeId`, `deviceId`, `departmentId?` (denormalize filtre), `state: pending|effective|failed|removed`, `ruleIds: v.array(v.id("accessRules"))` (son gönderimde uygulanan), `appliedAt?: v.number()`, `lastError?: v.string()`, `lastRunId?: v.id("deviceSyncRuns")`, `updatedAt: v.number()`. Index: `by_employee_device` (tekil satır), `by_project_state`, `by_project_employee`, `by_project_device`, `by_project_department_state`. Satır kişi×CİHAZ; kapı okuma anında türetilir.
2. **Yazım (yeni fonksiyon çağrısı ≈ 0; mevcut mutation'lara satır upsert):** ortak yardımcı `upsertGrantStatus(ctx, {...})` (`by_employee_device` ile bul/yaz; `departmentId` çalışandan). IDE: `upsertUser` enqueue → `pending`; `markAck` success → `effective` (+`appliedAt`), fail/terminal → `failed` + mesaj; `deleteUser` ack success → `removed`. Op payload'ına `employeeId` ekle (payload `v.any`, geriye uyumlu; yoksa satır yazılmaz, hata atılmaz). Hik localBridge: kişi op'u kuyruğa → `pending`; `ackLocalBridgeOperation` ok → `effective`/`removed`, değilse `failed`. Hik gateway direct: action sonunda kişi sonuçlarını TEK toplu internal mutation ile yaz (`recordGrantResults`, mevcut başarı/hata çağrılarının yerine değil yanına; mümkünse onlarla birleştir → +0/+1 çağrı/action). Satır asla silinmez.
3. **Bayatlık:** okuma anında `appliedAt < max(rule.updatedAt, template.updatedAt)` ise "Bekliyor (güncel değil)" bayrağı döndür; toplu satır yazımı YOK.
4. **Sorgular (yeni modül `convex/accessGrantStatus.ts`, +test):** yetki: proje admin/super_admin (`project_user` okuyamaz — kendi projesi dahil; mevcut admin guard desenini kullan).
   - `listByProject({projectId, state?, departmentId?, deviceId?, ruleId?, templateId?, search?, paginationOpts})` → `.paginate()` (sayfa ≤50); satır: kişi adı, departman adı, cihaz adı/markası, kapı adları (W4.0/W4.1 kapsamından türet; IDE `getRuleIoIdsForPanel`, Hik kural kapı numaraları), kural adları, şablon adları, `state`, `stale`, `lastError`, `appliedAt`, `updatedAt`. Filtreler index'le; index'e oturmayan filtre (ruleId/templateId/search) sayfa içi süzme yerine açıkça sınırlı tarama — belgele.
   - `counts({projectId, departmentId?})` → `{all, effective, pending, failed, removed, unknown}`; her biri `.take(1001)` → 1000+ (`capped: true`). `unknown` = kural grafiğine göre yetkili olup satırı olmayan kişi×cihaz (sınırlı; aşarsa `capped`).
   - `byEmployee({employeeId})` → o kişinin tüm cihaz satırları + kural grafiğine göre "yetkili ama satırı yok" (Bilinmiyor) ve "satırı var ama artık yetkisiz" (kaldırılacak) ayrımı; proje kapıları − graf = "Yetkisiz" kapılar (sınırlı okuma).
   - Hepsi query; UI bunları `useConvex().query` ile tek seferlik çağıracak (reaktif değil) — sorgu tasarımı buna uygun olsun.
5. **Yeniden dağıt:** `redistribute({projectId, pairs?: {employeeId, deviceId}[] (≤100), onlyFailed?: boolean})` mutation → mevcut run altyapısıyla TEK run (`project_resync` ya da mevcut kişi senkronu `targetDeviceIds` ile — hangisi mevcutsa; yeni kind gerekirse union'a literal ekle). `onlyFailed`: `by_project_state` `failed` satırlarından ≤100 çift. 100'ü aşan istek Türkçe hata. Aynı projede çalışan run varsa mevcut "zaten çalışıyor" davranışına uy.

## Testler (en az)
- IDE: enqueue → pending; ack success → effective; ack fail → failed+mesaj; deleteUser ack → removed; payload'da `employeeId` yoksa yazım atlanır.
- Hik localBridge: kuyruğa → pending; ack ok/fail. Hik gateway: toplu sonuç yazımı tek mutation; başarı/hata/silme.
- Bayatlık bayrağı (kural/şablon sonradan değişti).
- Sorgular: yetki (project_user reddi, başka proje reddi), filtreler, sayfalama, counts 1000+ sınırı, byEmployee Bilinmiyor/Yetkisiz ayrımı.
- redistribute: ≤100 sınırı, tek run, onlyFailed.
- Çağrı sayımı: Hik gateway action başına ek mutation ≤1; IDE/bridge yolunda ek fonksiyon çağrısı 0.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
`convex/schema.ts` (yalnız yeni tablo + gerekirse union literal) · YENİ `convex/accessGrantStatus.ts` (+test) · YENİ `convex/lib/grantStatus.ts` (+test, ortak yardımcı) · `convex/_generated/api.d.ts` (2 satır) · `convex/ideSync.ts` · `convex/actions/ideGatewayDevice.ts` · `convex/hikvisionSync.ts` · `convex/actions/hikvisionSync.ts` · `convex/actions/hikQueueWorker.ts` · `convex/deviceSyncRuns.ts` · `convex/lib/deviceSyncRun.ts` · ilgili mevcut test dosyaları.

## Kapsam dışı
UI (W4.2b) · backfill (eski dağıtımlar "Bilinmiyor" kalır; "Tümünü yeniden dağıt" ile dolar) · cihazdan geri okuma kanıtı · 30 gün temizlik işi · tatil · mobil.

## Kapılar (kendin koş; `npm ci` GEREKMEZ, node_modules kurulu)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı).

## Rapor
`/tmp/w42a-report.md` + `worker_done`'da ≤10 satır (file:line): değişen dosyalar · yazım noktaları · sorgu/aksiyon imzaları · çağrı sayısı etkisi · kapı sayıları. API özetini `/tmp/w42a-api.md`'ye yaz (UI worker okuyacak: fonksiyon adları, arg/dönüş tipleri, satır alanları).
