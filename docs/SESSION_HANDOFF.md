# Session Devir Notu — KALAN İŞ (Faz 2 refactor sonrası)

> Son güncelleme: 2026-06-22 (UTC+3). **Bu dosya tek giriş noktasıdır.** God-file
> refactor roadmap'i (Faz 1+2+3) + R9 + R10 + R7/R6 güvenli cleanup bitti.
> Bu not **kalan işe** odaklıdır.

## Ortam / Bağlam

- **Convex deployment:** `notable-tern-4` — DEV ama **canlı sistem orada**. Deploy: `npx convex dev --once` (`npx convex deploy` DEĞİL). Veri oku: `npx convex data <table>`.
- **Git:** branch `main`; **12 commit lokalde, henüz push EDİLMEDİ** (`origin/main` 12 gerisinde): R9 + cardReadings sub-fazları + R10 + `8b66621` R7 a11y + `d2003df` R6 reconcile cleanup + son handoff güncellemesi. Kullanıcı isteyince push.
- **Working tree:** R10 commit'leri temiz; repo genelinde R10 dışı kirli dosyalar var (`bridge/windows/NgAccess.HikvisionBridge/*` + `src/components/devices/*`). Bunlara dokunulmadı.
- **Lint/test/build gate'leri (her değişiklikte):**
  ```
  npm test                                                # 174 yeşil
  node_modules/.bin/tsc --noEmit -p tsconfig.app.json     # 0
  node_modules/.bin/tsc --noEmit -p convex/tsconfig.json  # 0
  node_modules/.bin/eslint src convex                     # no-explicit-any 0
  npm run build
  npx convex dev --once                                   # fonksiyon register (CANLI)
  ```
- **Free-plan limiti yaklaşıyor** (Convex dashboard uyarısı) — kota-yiyen işlemlere dikkat.

## Tamamlanan (özet — detay git log + memory `refactor_roadmap_status`)

God-file refactor: 5 god-file → `convex/lib/*` modülleri + saf birim test ağı.
- **Faz 1** test ağı (`4bd64e1`), **Faz 3** cleanup (`04fc40b`).
- **Faz 2a** hikGateway→`lib/gateway/*` (`4b7711b`).
- **Faz 2b** cardReadings→`lib/pdksCalc`+`lib/cardReadingAudit` (`1d021fd`+`217c8a5`+`1e775d5`+`8519d8a`); −217 sat, +34 test.
- **Faz 2c** devices→`lib/deviceHelpers`+`lib/devicePool`+`lib/deviceSync` (`9a794f6`+`8708edd`+`47c9301`); 1736→1318 sat.
- **Faz 2d** schema 13 bölüm başlığı + `docs/SCHEMA.md` (`8b256ae`).
- **R9** iki-bacak kural çözümü tek kaynağa indi (`4b99cb6`): `accessGraph.resolvePanelRuleMembers` kanonik primitif; Hik biyometri + IDE kart roster'ı artık onu paylaşıyor. Davranış byte-eşdeğer, `api.d.ts` diff boş.
- **cardReadings sub-faz 1-3** (`288f128`+`13e3599`+`053c825`): god-file 2289→**2065** sat, +27 golden test (136→163). Yeni lib:
  - `lib/cardReadingProcess.ts` — `ideTimeToISO`/`startOfTurkeyDayISO` (saf) + `resolveDirection`/`resolveActiveMatchingRuleIds` (ctx); processCardReading/selfCheckIn delege.
  - `lib/pdksDetail.ts` — `computeAttendanceDetailDay`+`summarizeAttendanceDays` (getEmployeeAttendanceDetail çekirdeği, **sabit-8h** R8 varyantı).
  - `lib/pdksPayroll.ts` — `computePayrollCell` (getMonthlyPayrollSheet hücresi, **shift-duyarlı** R8 varyantı).
- **R10 cardReadings kalan PDKS handler'ları** (`1271122`+`b248ccc`): `getPdksTableData` + `getPdksChartData` saf çekirdekleri lib'e indi; god-file **2065→1611** sat, +11 golden test (163→174). Yeni lib:
  - `lib/pdksTable.ts` — tablo single-day summary + matrix day cell hesabı; **ham dakika + dailyOvertimeForShift** R8 tablo varyantı pinli.
  - `lib/pdksChart.ts` — daily attendance, departman devamsızlık, late bucket, hourly trend; mevcut N+1 dept lookup wrapper'da korundu, saat format farkı testle pinli.
- **R7 a11y** (`8b66621`): `SheetContent` açıklama gerektirmeyen sheet'ler için `aria-describedby={undefined}` geçiriyor; çağıran kendi açıklama id'sini hâlâ override edebilir.
- **R6 güvenli cleanup** (`d2003df`): Hik reconcile kart/yüz/parmak pagination drain loop'ları `collectAllPages` helper'ına indi ve 3 roster drain `Promise.all` ile paralelleşti. Hata davranışı korundu.

2b/2c/R9 + cardReadings sub-faz 1-3 + R10 + R7/R6: security + eşdeğerlik review **sıfır sapma**; `api.*` yüzeyleri + güvenlik-hassas sır-gate/cross-tenant pin korundu; her sub-faz `api.d.ts` salt-additive.

---

## KALAN İŞ — öncelik sırası

> ✅ **R9 + cardReadings sub-faz 1-3 + R10 + R7 + R6 güvenli kısmı BİTTİ** (12 commit, push bekliyor). Kalanlar artık ürün kararı / hardware-login-cihaz blokajları + opsiyonel riskli cleanup.

### 🟡 R8 · PDKS 3-ekran saat/mesai sapması (latent bug, ürün kararı)
**Ne:** Aynı kişi-gün için 3 ekran **farklı saat/mesai** hesaplıyor:
- **Tablo** (`getPdksTableData`) = ham dakika (mola yok) + `dailyOvertimeForShift`.
- **Bordro** (`getMonthlyPayrollSheet`) = `netWorkMinutes`(mola+entry/exit) + haftalık `bucketWeeklyOvertime`.
- **Detay** (`getEmployeeAttendanceDetail`) = `netWorkMinutes`(yalnız mola) + **sabit `max(0, net−8h)`**.
- Manuel kayıt ISO eki de tutarsız (`+03:00` vs yok).

**Durum:** Davranış **bilerek korundu** + golden testlerle donduruldu (kazara değişmesin): `pdksCalc.test.ts` (primitifler) + `pdksTable.test.ts` (tablo ham dakika/shift mesai) + `pdksDetail.test.ts` (detay sabit-8h) + `pdksPayroll.test.ts` (bordro shift-duyarlı). Tablo+detay+bordro çekirdeği artık `lib/pdksTable` + `lib/pdksDetail` + `lib/pdksPayroll`'de izole.
**Karar gerekli (ürün):** Hangisi "doğru"? Üçü tek kanonik hesaba birleştirilecekse bu bir **davranış değişikliği** (refactor değil) — ayrı analiz + kullanıcı onayı + büyük olasılıkla migration/yeniden-hesap.
**Bloke:** ürün kararı.

### 🟢 R6 kalan opsiyonel cleanup (düşük öncelik)
`collectAllPages` helper + reconcile `Promise.all` bitti. Kalan: `doors.update` `hikDoorNo` değişince reader `hikReaderNo` drift'i, 3 roster query için `resolvePanelAuthorizedEmployeeIds` core'u, `_runBackfill` per-event runMutation → batch. Bunlar push'u engellemez; özellikle batch işi mutation sözleşmesi değiştirir.

### ⏸️ R2 · Model/okuyucu provizyon — manuel UI verify (BLOKE: user login)
7 adımlık doğrulama senaryosu: `docs/HANDOFF_KAPI_OKUYUCU.md §6`. Kullanıcının panele login olup model seçimi→kapı/okuyucu provizyonunu UI'da doğrulaması gerekiyor.

### ⏸️ R3/R4 · ISAPI canlı shape verify + görsel test (BLOKE: gateway Hik cihazı)
~25 yeni ISAPI op'unun canlı cihazla shape doğrulaması. Runbook: `docs/HIK_ISAPI_HANDOFF.md §4`. Şu an canlıda **gateway-transport Hik yok** (yalnız DS-K2804 localBridge var). Gateway cihazı dönünce yapılır.

---

## Çalışma deseni (2b/2c + cardReadings sub-faz 1-3 + R10'da kanıtlandı)

Convex **registered-fn dosyaları** (`devices.ts`, `cardReadings.ts` …) file-path = `api.*` yolu → **bölünemez**. Desen:
1. **Saf mantık** (ctx yok, async yok, plain-type in/out) → `convex/lib/*.ts` + **vitest golden test** (`accessDecision.test.ts` stili: `<T extends string>` generic, Readonly koleksiyon, Doc<> import etme).
2. **ctx-bağımlı helper** → `ctx` alan lib fonksiyonu (`buildShiftResolver(ctx,…)` deseni).
3. **Registered query/mutation wrapper'lar dosyada kalır** → `api.*` korunur; içleri helper'lara delege eder.
4. **Güvenlik-hassas kod** (sır-gate, cross-tenant pin, auth) çıkarma kapsamı **dışı** — yerinde bırak.
5. Her sub-faz **kendi commit'i** (bisect); saf taşımada `git diff` mantık satırı içermemeli; her commit'te 6 gate yeşil + `api.d.ts` additive (imza değişmedi kanıtı).

## Referanslar
- **Memory:** `refactor_roadmap_status.md` (tüm faz durumu), `hik_isapi_ops_expansion.md`, `convex_deployment_topology.md`, `door_reader_separation.md`.
- **Şema haritası:** `docs/SCHEMA.md` (13 domain bölümü, 44 tablo).
- **Konu handoff'ları:** `docs/HIK_ISAPI_HANDOFF.md` (ISAPI + R3/R4/R6 runbook), `docs/HANDOFF_KAPI_OKUYUCU.md` (kapı↔okuyucu + R2 senaryosu).
- **Kod giriş:** `convex/lib/{gateway/*,pdksCalc,pdksTable,pdksChart,pdksDetail,pdksPayroll,cardReadingProcess,cardReadingAudit,deviceHelpers,devicePool,deviceSync}`.
