# W5-A DÜZELTME 1 — denetim bulguları (UYGULAMA)

Çalışma dizini: `/tmp/hik-headbuild` — İLK İŞ `cd /tmp/hik-headbuild`. Orada W5-A diff'i STAGED (taban `2b67349`). Düzeltmelerini UNSTAGED bırak (`git add` YAPMA; koordinatör `git diff` ile patch alacak). Denetim raporu (otoriter): `/tmp/w5a-denetim.md`. Orijinal spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-a-pdks-rules-backend.md`. API: `/tmp/w5a-api.md`. Denetçinin probu: `/tmp/w5a-scratch/probe.ts` (repo dışı; senaryoları teste çevir).

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK. Convex: sınırsız `.collect()` yok; yeni cron/polling yok. Türkçe kullanıcı metni.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset`, `src/**` (UI W5-C paralel çalışıyor — API sözleşmesi değişikliğini aşağıdaki gibi yap, UI'ya dokunma), `mobile/**`, `convex/shifts.ts`.
- Mevcut test beklentileri değişmez (değişmesi gerekirse dur, `ask` ile sor).

## Düzeltilecekler (hepsi)
**ENGEL-1** `convex/lib/pdksTable.ts:60-68`: requirements dalında hafta sonu/tatil/onaylı izin, legacy'deki gibi `noData`/kanıt kararından ÖNCE döner; `noData` yalnız beklenen iş günü (`absent` adayı) için. SGK `reviewDays` yalnız `incomplete` + beklenen iş günündeki kesinleşmemiş `noData`'yı içerir; izin günleri eksik gün nedenini korur.
**ENGEL-2** `pdksTable.ts:61-64`, `dashboard.ts:258-263,628-634`: requirements'ta eksik-çıkış/eksik-giriş kararı vardiya bitişi + erken çıkış toleransı (gece vardiyasında ertesi gün; vardiyası olmayan çalışanda çalışma ayarı bitişi) geçmeden verilmez → bu sürede gün "devam ediyor" (mevcut `future`/bekleme semantiği). Dashboard "bugün" metrikleri (`presentToday`, `insideBuilding`, `averageFirstEntry`) requirements projelerinde de ham izinli + check point'ten geçen girişlerle hesaplanır.
**ENGEL-3** `convex/lib/pdksEvidence.ts:30-33`: yönsüz okuma günü YALNIZ yönlü kanıt (manuel giriş/çıkış dahil) zorunlu yönleri karşılamıyorsa `incomplete/undirected` yapar; geçerli çift ya da manuel düzeltme varsa gün kanıta göre çözülür, `punchQuality` uyarı olarak `undirected` kalabilir ama durum `incomplete` olmaz.
**D1 (legacy maliyet — kritik)**: politikaları ÖNCE yükle; hiçbir projede yürürlükte/dönemde requirements ya da selected sürüm yoksa `loadRuleReportDays` ve benzeri ek okuma yapılmaz, eski yükleyici + eski okuma aralığı + eski sınır davranışı aynen kullanılır (yeni 20.000/10.000 sınırı legacy yolunda YOK; `getAnnualOvertimeBalance` dahil). Karma kapsamda ek okuma yalnız sürümlü projeler için. Kanıt testi: convex-test ile "sürüm yok → aynı okuma kümesi ve aynı sonuç" (tablo, rapor ×3, dashboard, SGK) — mock değil gerçek convex-test; okuma sayısını ya da çağrılan index'leri karşılaştır.
**D2 SGK** `convex/sgkExport.ts:93-107`: herhangi bir çalışanda `reviewDays` varsa XML ÜRETİLMEZ: `xml: ""`, `filename` aynı biçim, `warnings`'e Türkçe neden, `employees[].reviewDays` dolu, yeni `blockedByReview: true`. Yoksa `blockedByReview: false` ve XML eskisiyle aynı (prim günü/eksik gün hesabına reviewDays karışmaz). `/tmp/w5a-api.md`'yi bu sözleşmeyle güncelle.
**D3** `convex/reports.ts:41,93,178,213,313,344`, `convex/sgkExport.ts:67`: legacy/requirements ayrımı takvim günüyle değil iş günüyle (`workDate`) yapılır; sürüm sınırındaki gece oturumu tabloyla aynı sonucu verir (test: D-1 22:00 → D 06:00, D yeni sürümün ilk günü).
**D4** `pdksTable.ts:302`, `pdksPayroll.ts:46`, `pdksDetail.ts:49`: `|| !!manual` yalnız requirements politikasında; legacy birebir.
**D5** `convex/lib/mobileAttendance.ts:140,160-164`: requirements günlerinde mobil `presentDays` tabloyla aynı gün kararını verir (iş günü gruplaması + manuel kayıt + ortak kanıt). Sınırlı okumayla yapılamıyorsa DUR ve `ask` ile seçenek sun; legacy mobil sonuç birebir.
**D6** `convex/dashboard.ts:634`: `lateArrivals` çalışan başına (Set) sayılır.
**N-yetki** `convex/pdksRules.ts`: `getRules` ve `listCheckpointTargets` yalnız proje admin'i / super_admin (project_user reddi); testler: project_user okuma reddi, project_user silme reddi, yabancı `ruleVersionId` silme reddi.
**N-ilk kayıt** `convex/lib/pdksRules.ts:30-34` + `pdksAvailability`: `pdksFirstRecordDate` adaylarının tarihleri dönem öncesindeyse o tarihlerin sürümü de (sınırlı ek okuma) çözülür; ya da açık gerekçeyle bırak ve raporla.
**N-perf** `listCheckpointTargets` find/filter döngüsü Map ile.

## Testler
Denetçi probundaki 3 ENGEL senaryosu + her D için en az 1 test; D1 için convex-test eşdeğerlik testi. Mevcut testlerin tamamı yeşil.

## Kapılar (kendin koş; node_modules var)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı).

## Rapor
`/tmp/w5a-fix1.md`: her bulgu için ne yapıldı (file:line) + test adı; uygulanmayan varsa gerekçe. `worker_done` ≤10 satır.
