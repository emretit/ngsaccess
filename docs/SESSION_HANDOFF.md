# Session Devir Notu — KALAN İŞ (Faz 2 refactor sonrası)

> Son güncelleme: 2026-06-22 (UTC+3). **Bu dosya tek giriş noktasıdır.** God-file
> refactor roadmap'i (Faz 1+2+3) + R9 bitti; ardından `cardReadings.ts` ekstraksiyonu
> sub-faz 1-3 yapıldı. Bu not **kalan işe** odaklıdır.

## Ortam / Bağlam

- **Convex deployment:** `notable-tern-4` — DEV ama **canlı sistem orada**. Deploy: `npx convex dev --once` (`npx convex deploy` DEĞİL). Veri oku: `npx convex data <table>`.
- **Git:** branch `main`; **5 commit lokalde, henüz push EDİLMEDİ** (`origin/main` 5 gerisinde): `4b99cb6` R9 + `5b1f340` R9-doc + `288f128` sub-faz1 + `13e3599` sub-faz2 + `053c825` sub-faz3. Working tree temiz. Kullanıcı isteyince push.
- **Lint/test/build gate'leri (her değişiklikte):**
  ```
  npm test                                                # 163 yeşil
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

2b/2c/R9 + cardReadings sub-faz 1-3: security + eşdeğerlik review **sıfır sapma**; `api.*` yüzeyleri + güvenlik-hassas sır-gate/cross-tenant pin korundu; her sub-faz `api.d.ts` salt-additive.

---

## KALAN İŞ — öncelik sırası

> ✅ **R9 + cardReadings sub-faz 1-3 BİTTİ** (5 commit, push bekliyor). Tek **yapılabilir kod borcu** = aşağıdaki R10 (cardReadings'in kalan 2 PDKS handler'ı). R8 ürün kararı, R2/R3 hardware, R6/R7 trivial.

### 🔵 R10 · cardReadings kalan 2 PDKS handler ekstraksiyonu (kod borcu, yapılabilir)
**Ne:** cardReadings.ts (şu an 2065 sat) içinde 2 büyük query handler hâlâ inline:
- **`getPdksTableData`** (~517 sat, en büyük) — data-load + per-employee summary + matrix per-day. En çok kazanç, en karmaşık.
- **`getPdksChartData`** (~224 sat) — daily attendance + late bucketing (saf) + ⚠️ **N+1 dept lookup** (`await ctx.db.get(r.employeeId)` döngüde).

**Yaklaşım:** Sub-faz 1-3'teki **kanıtlanmış reçete** (aşağıdaki çalışma deseni). Her handler'ın saf per-gün/per-employee compute'unu **birebir** `lib/pdksTable.ts` / `lib/pdksChart.ts`'e çıkar + golden test; data-load + auth guard handler'da kalır. **R8 farkı (tablo = ham dakika + dailyOvertimeForShift) KORUNMALI** — byte-eşdeğer. Her handler kendi commit'i.
**Önemli:** Mapper'ın önerdiği "iyileştirmeler" (N+1→batch, 3 handler'ı tek loader'da birleştir) **davranış değiştirir → YAPMA**; sadece çıkar.
**Uyarı:** Bu 4 PDKS handler'ının **çıktı-seviyesi testi yok** (yalnız primitifler test edildi) → saf compute çıkarırken golden test ekleyerek ağı ör.
**Bloke:** yok.

### 🟡 R8 · PDKS 3-ekran saat/mesai sapması (latent bug, ürün kararı)
**Ne:** Aynı kişi-gün için 3 ekran **farklı saat/mesai** hesaplıyor:
- **Tablo** (`getPdksTableData`) = ham dakika (mola yok) + `dailyOvertimeForShift`.
- **Bordro** (`getMonthlyPayrollSheet`) = `netWorkMinutes`(mola+entry/exit) + haftalık `bucketWeeklyOvertime`.
- **Detay** (`getEmployeeAttendanceDetail`) = `netWorkMinutes`(yalnız mola) + **sabit `max(0, net−8h)`**.
- Manuel kayıt ISO eki de tutarsız (`+03:00` vs yok).

**Durum:** Davranış **bilerek korundu** + golden testlerle donduruldu (kazara değişmesin): `pdksCalc.test.ts` (primitifler) + `pdksDetail.test.ts` (detay sabit-8h) + `pdksPayroll.test.ts` (bordro shift-duyarlı). Detay+bordro çekirdeği artık `lib/pdksDetail` + `lib/pdksPayroll`'de izole.
**Karar gerekli (ürün):** Hangisi "doğru"? Üçü tek kanonik hesaba birleştirilecekse bu bir **davranış değişikliği** (refactor değil) — ayrı analiz + kullanıcı onayı + büyük olasılıkla migration/yeniden-hesap.
**Bloke:** ürün kararı.

### 🟢 R7 · A11y — SheetContent `aria-describedby` (trivial)
Radix Sheet uyarısı; `aria-describedby` eklenmeli. Küçük frontend dokunuşu.

### 🟢 R6 · Opsiyonel cleanup (düşük öncelik)
`collectAllPages` helper, reconcile `Promise.all`, `_runBackfill` batch. Detay: `docs/HIK_ISAPI_HANDOFF.md §3.4`.

### ⏸️ R2 · Model/okuyucu provizyon — manuel UI verify (BLOKE: user login)
7 adımlık doğrulama senaryosu: `docs/HANDOFF_KAPI_OKUYUCU.md §6`. Kullanıcının panele login olup model seçimi→kapı/okuyucu provizyonunu UI'da doğrulaması gerekiyor.

### ⏸️ R3/R4 · ISAPI canlı shape verify + görsel test (BLOKE: gateway Hik cihazı)
~25 yeni ISAPI op'unun canlı cihazla shape doğrulaması. Runbook: `docs/HIK_ISAPI_HANDOFF.md §4`. Şu an canlıda **gateway-transport Hik yok** (yalnız DS-K2804 localBridge var). Gateway cihazı dönünce yapılır.

---

## Çalışma deseni (2b/2c + cardReadings sub-faz 1-3'te kanıtlandı — R10 için aynısı)

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
- **Kod giriş:** `convex/lib/{gateway/*,pdksCalc,pdksDetail,pdksPayroll,cardReadingProcess,cardReadingAudit,deviceHelpers,devicePool,deviceSync}`. R10 hedefi: `convex/cardReadings.ts` → `getPdksTableData` / `getPdksChartData`.
