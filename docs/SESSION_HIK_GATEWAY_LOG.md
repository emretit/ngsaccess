# Hik Gateway Session Özeti

**Tarih**: 2026-05-17 / 2026-05-18
**Durum**: Test akışında "Cihazlara Push Et" 3 hata veriyor — son fix'ler uygulandı, Convex deploy + push tekrar test edilmeli.

---

## 🔴 Açık sorun — Convex dev compile hatası

Son turn'de `npx convex dev` başlatıldı, **digestAuth crypto chain** bundle hatası verdi:
```
✘ Could not resolve "crypto" — convex/lib/digestAuth.ts:3
It looks like you are using Node APIs from a file without the "use node" directive.
```

**Sebep**: `convex/lib/hikSync.ts` → `hikGateway.ts` (node) → `digestAuth.ts` (crypto/node) zinciri. `hikSync.ts`'te `"use node"` yoktu.

**Uygulanan fix** (henüz deploy edilmedi):
- `convex/lib/hikSync.ts` ilk satırına `"use node";` eklendi.

**Sonraki adım (yeni session'da)**:
1. `npx convex dev` tekrar başlat (bundle hatasız geçmeli)
2. Geçmiyorsa `digestAuth.ts` ve `hikGateway.ts` zaten "use node" — sadece hikSync.ts eksikti, şimdi düzeltildi
3. Deploy başarılı olunca user `/access-control` → "Cihazlara Push Et" testini yapsın

---

## ✅ Bu session'da tamamlananlar

### Plan A (Erişim Pipeline)
- **A1** [hikGatewayDevice.ts:266](../convex/actions/hikGatewayDevice.ts) — `remoteOpenDoor` action + DeviceDetailsPanel'de "Kapıyı Aç" buton ([HikDeviceActions.tsx](../src/components/devices/HikDeviceActions.tsx))
- **A2** [hikGateway.ts:868](../convex/lib/hikGateway.ts) — `getDoorCapabilities` helper + `devices.hikDoorCount` schema; `buildPersonBody.RightPlan` artık her kapı için entry üretir + `doorRight` CSV
- **A3** [hikGateway.ts:417](../convex/lib/hikGateway.ts) — `Valid.beginTime` bugün, `endTime` 2037-12-31 (2099 → 2037 32-bit time_t overflow fix)
- **A3.5** [hikSync.ts:48](../convex/lib/hikSync.ts) — `defaultRuleSchedule` helper: boş `startTime/endTime` → `00:00/23:59`, days boş → 7 gün
- **A3.5** [hikvisionSync.ts:482](../convex/actions/hikvisionSync.ts) — `backfillAllRulesToDevices` authedAction + AccessRulesList'te "Cihazlara Push Et" butonu
- **A4** [hikGateway.ts:864](../convex/lib/hikGateway.ts) — `setDeviceTime` (TR local) + register sırasında çağrılır + günlük 04:00 TR cron (`syncHikDeviceTimes`)
- **A5** — Plan template auto-assign idempotent (`newlyAssigned` Map ile)
- **A6** [hikEventCodes.ts:18](../convex/lib/hikEventCodes.ts) — `inferDenialReason` + 13 ret kodu mapping; `cardReadings.hikDenialReason` schema

### SDK audit fix'leri
- `buildPersonBody.planTemplateNo` string → number
- `setWeekPlanOnDevice`: `week` integer (1=Pzt..7=Paz), `TimeSegment` nested obje, root'tan duplicate `weekPlanNo` kaldırıldı
- `setHolidayGroup` endpoint: `/HolidayGroup/{n}` → `/UserRightHolidayGroupCfg/{n}` + wrapper `UserRightHolidayGroup`
- `setHolidayPlan` TimeSegment nest
- `defaultRuleSchedule` endTime saniye `:00` → `:59` (Hikvision standart)
- `setWeekPlanOnDevice` boş gün entry'sinde `endTime: "00:00:00"` → `"23:59:59"` (beginTime===endTime `messageParametersLack` riski)

### Auto-sync trigger matrisi (18 scheduler call)
Tüm CRUD mutation'ları cihaza otomatik sync tetikler:
- `employees.create/update/remove` ✓
- `accessRules.create/update/remove/createWithGroups/updateWithGroups` ✓
- `accessRules.addGroupMember/removeGroupMember/addGroupDevice/removeGroupDevice` ✓
- `employeeFaces.addFace/removeFace` ✓
- `employeeFingerprints.addFingerprint/removeFingerprint` ✓

### Worker fix
- [hikQueueWorker.ts:158](../convex/actions/hikQueueWorker.ts) — `syncWeekPlan` op artık `defaultRuleSchedule` kullanıyor (boş saat reject etmiyor)
- Önceden hata: "Week plan parametreleri eksik" — bu session'da düzeltildi

### Tip güvenliği & lint
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 error
- `eslint convex src` → 0 error, 28 pre-existing warning

### Review fix'leri
- Security: 0 HIGH/MEDIUM bulgu (orphan dismiss bypass, payload leak gibi eski bulgular kapatıldı)
- Simplify: ALL_DAYS dedup (hikGateway → hikSync import), toast `sonner` → `@/hooks/use-toast`, HikDeviceActions prop sprawl, `try/catch {}` boilerplate temizliği

### Master plan
- `/Users/emreaydin/.claude/plans/plan-yapal-m-detayl-fuzzy-frost.md` — açık işler + öncelik sırasıyla yeniden organize edildi
- Kapsam: Plan A (✅) + Phase 4 UI (pending) + Phase 5 reliability (pending) + SDK kalanlar (opportunistic)

---

## 🎯 Açık test akışı

User'ın bu testleri yapması bekleniyor:

### T1. "Cihazlara Push Et" yeniden test
- Convex deploy bekle → `/access-control` → "Cihazlara Push Et"
- **Beklenen**: `SyncIssuesBanner`'da `messageParametersLack` / `timeFormatError` / "Week plan parametreleri eksik" görünmemeli
- Son test sonucu (bu fix'lerden ÖNCE): 3 hata vardı

### T2. Kart okutma + kapı açılma
- T1 OK ise NGS cikis cihazına kart okut
- Beklenen: "İzin Verildi" + kapı açılır
- "Reddedildi" gelirse `hikDenialReason` görünür (Saat dışı / Yetki yok / vs.)

---

## 🔜 Sıradaki işler (master plan'a göre)

### P1 — Phase 4 UI (~10-12 saat)
- **F4.5**: `/admin/sync-health` dashboard — failed op listesi + retry/cancel + 24h grafik (operatör için kritik)
- **F4.1**: EmployeeForm yüz + parmak izi sections (`hikFingerprintCapture` action yeni)
- **F4.2**: `EmployeeDeviceSyncPanel` (per-employee cihaz × op matrisi)
- **F4.3**: AccessRule "Cihazlarda Etki" 5. tab
- **F4.4**: DeviceDetailsPanel sekmeli (Persons / DoorParams / PendingOps) + DeviceList kapasite barı

### P3 — Phase 5 (~4 saat)
- **F5.1**: Capacity counter alanları + cron refresh
- **F5.2**: AcsEvent history backfill (gap detection sonrası catch-up)
- **F5.3**: Nightly reconcile cron (03:00 TR)
- **F5.4**: Worker face/FP payload refactor

### P2 — SDK kalanlar (opportunistic, ~1-2 saat)
- `deleteFaceFromDevice` body wrapper
- `addFingerprintToDevice` body wrapper + progress polling
- `setDeviceTime` XML fallback (notSupport durumu)
- `setDoorParam` capabilities-driven field list

---

## 📁 Kritik dosyalar (referans)

### Modifiye edilen
- `convex/lib/hikGateway.ts` — tüm SDK helper'lar
- `convex/lib/hikSync.ts` — defaultRuleSchedule + use node directive
- `convex/lib/hikEventCodes.ts` — denial reason mapping
- `convex/lib/cardReaderParse.ts` — hikEhomeID parse
- `convex/schema.ts` — hikDoorCount + hikDenialReason
- `convex/devices.ts` — setHikDoorCount + listRegisteredHikDevIndexes
- `convex/cardReadings.ts` — brand-dispatch + denial reason
- `convex/http.ts` — hikEhomeID parametre passthrough
- `convex/hikvisionSync.ts` — internal queries + sync failure mgmt + cleanup cron
- `convex/employees.ts`, `convex/accessRules.ts`, `convex/employeeFaces.ts`, `convex/employeeFingerprints.ts` — auto-sync triggers
- `convex/actions/hikvisionSync.ts` — 8 sync action + backfillAllRulesToDevices
- `convex/actions/hikGatewayDevice.ts` — register/remove/openDoor/syncHikDeviceTimes
- `convex/actions/hikQueueWorker.ts` — retry worker (13 op type)
- `convex/crons.ts` — 3 Hik cron (queue, cleanup, time sync)
- `src/components/devices/HikDeviceActions.tsx` — "Kapıyı Aç" buton
- `src/components/devices/DeviceDetailsPanel.tsx` — buton mount
- `src/components/access-control/unified/AccessRulesList.tsx` — "Cihazlara Push Et" buton
- `src/components/sync/SyncIssuesBanner.tsx` — header altı sync hatası banner
- `src/components/Layout.tsx` — banner mount

### Plan dosyası
- `/Users/emreaydin/.claude/plans/plan-yapal-m-detayl-fuzzy-frost.md` — master plan

### Dokunulmayacak (QR regresyon koruması)
- `processCardReading`'in non-Hikvision path'i (QR cihazlar)
- `/card-reader` response payload shape (`{cevap, checkResult}`)
- Auth / customFunctions

---

## 🔬 Test akışı (yeni session'da)

1. `npx convex dev` — bundle hatası kontrol et (hikSync.ts use node fix sonrası geçmeli)
2. Deploy OK → user `/access-control` → "Cihazlara Push Et"
3. Banner temiz mi?
4. NGS cikis cihazına kart okut → "İzin Verildi"?
5. Kapı açılıyor mu?
6. Sonuca göre:
   - Hâlâ `messageParametersLack` → tam request body'sini console.log'la ve raw response'u capture et (debug logging eklemek gerek)
   - "İzin Verildi" + kapı açıldı → Phase 4 UI'ya geç (F4.5 SyncHealth dashboard önce)

---

## 📊 Mevcut env durumu

- **Convex deployment**: dev
- **Hik Gateway**: 157.90.114.86:8088 (Hetzner)
- **Test cihazları**:
  - NGS cikis (Hikvision DS-K1T807) — sync hedefi
  - NGS QR (mobil dinamik QR) — DOKUNULMAZ
- **Test kuralları**: "ngs1" (saat boş, 7 gün) + "Test Erişim Kuralı (24/7)" (00:00-23:59, 7 gün)

---

## ⚠️ Yeni session başlangıç notları

1. **Önce convex dev'i başlat** ve digestAuth bundle hatasının düzeldiğini doğrula
2. Hâlâ hata varsa: `hikGateway.ts`, `digestAuth.ts`, `hikSync.ts` üçünde de "use node" var mı kontrol et
3. Test akışı T1+T2'yi user'a tekrar yaptır
4. Hatalar persists ise: tam body+response logging ekle (`gatewayApiCall` çıktısını console.log) — convex dashboard log'larından gör
5. T1+T2 başarılıysa **Phase 4 F4.5 SyncHealth dashboard**'a geç (master plan'da öncelik bu)
