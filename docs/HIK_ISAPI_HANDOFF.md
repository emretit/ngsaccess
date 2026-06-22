# Hik ISAPI Gateway Genişletmesi — Handoff

> **Tarih:** 2026-06-20 · **Deployment:** notable-tern-4 (DEV ama canlı sistem) · **Branch:** main

## TL;DR

Hik Device Gateway ISAPI entegrasyonuna **~25 yeni operasyon** eklendi: cihazda saklı geçmiş event backfill, kart/yüz/parmak reconcile, cihaz yönetimi (reboot/çalışma-durumu), saat-tabanlı kapı/doğrulama planları + cihaz paneli UI. Kod **canlıya deploy edildi**; tsc/eslint/güvenlik/code-review **temiz**. **Tek kalan:** bir **gateway-transport Hik cihazı online olunca** canlı shape VERIFY + görsel UI testi. Şu an canlıda öyle bir cihaz yok (IDE Smart panel + DS-K2804 *localBridge* var, gateway Hik yok), o yüzden bu adım ertelendi.

---

## 1. Ne yapıldı (PR1–4 + Faz 7)

| Operasyon | ISAPI | lib (`convex/lib/hikGateway.ts`) | action (`convex/actions/hikGatewayDevice.ts`) | UI |
|---|---|---|---|---|
| Geçmiş event backfill | `POST AcsEvent` | `searchAcsEventsOnDevice` | `backfillDeviceEvents`, `backfillAllDevicesEvents` (cron) | "Geçmişi çek" |
| Kart reconcile | `POST CardInfo/Search` | `searchCardsOnDevice` | `reconcileDevice` | "Reconcile" |
| Yüz reconcile | `POST FDLib/FDSearch` | `searchFacesOnDevice` | (reconcileDevice) | reconcile paneli |
| Parmak reconcile | `POST FingerPrintUpload` | `searchFingerprintsOnDevice` | (reconcileDevice) | reconcile paneli |
| Canlı kart oku | `GET CaptureCardInfo` | `captureCardOnDevice` | `captureCardFromDevice` | "Kart oku" |
| Canlı yüz al | `POST CaptureFaceData(+Progress)` | `captureFaceOnDevice` | `captureFaceFromDevice` | — |
| Reboot | `PUT System/reboot` | `rebootDeviceOnGateway` | `rebootDevice` | "Reboot" |
| Çalışma durumu | `GET AcsWorkStatus` | `getAcsWorkStatus` | `fetchDeviceWorkStatus` | "Durum" |
| Parmak apply fix | `GET FingerPrintProgress` | `pollApplyProgress` + `addFingerprintToDevice` | (otomatik) | — |
| Kapı durum planı | `PUT DoorStatus{WeekPlan,Template,Plan}` | `setDoorStatusWeekPlan`/`...Template`/`linkDoorStatusPlan` | `applyDoorStatusPlan` | kapı düzenle formu |
| Doğrulama modu planı | `PUT Verify{WeekPlan,Template}` | `setVerifyWeekPlan`/`...Template`/`linkVerifyPlan` | `applyVerifyPlan` | kapı düzenle formu |

**Faz 7 (code-review düzeltmeleri):** pagination `hasMore` (firmware `totalMatches` döndürmese de sayfa-1'de durmaz), backfill zaman-penceresi (`hikLastBackfillAt-5dk`, kota), plan slot çakışma fix (`hikDoorNo` zorunlu), capture poll döngüleri, `getAcsWorkStatus` boş-array, yüz/parmak reconcile bağlandı, `getAcsEventTotalNum` (dead code) silindi, `captureFaceFromDevice` employee proje-scope, face-roster dedup.

**Kaynak referans:** `~/Downloads/ISAPI_Controllers_Value Series/ISAPI_Controllers_Value Series.pdf` → çıkarılmış metin `tmp/pdfs/isapi_controllers_value_series.txt`. Kesin alan adları: aynı klasördeki `Field Dictionary.xlsx`.

---

## 2. Mevcut durum

| | Durum |
|---|---|
| **Deploy** | ✅ `npx convex dev --once` → `Convex functions ready! (6.49s)`. function-spec ile tüm yeni fn'ler + `hik-backfill-events` cron REGISTERED doğrulandı (349 identifier). |
| **Commit** | ❌ YOK — working tree canlıya deploy edildi ama git'e işlenmedi. |
| **Kalite** | tsc 0, eslint 0 (`no-explicit-any` dahil). Güvenlik review **temiz** (cross-tenant yok, authz simetrik). Code-review'da HIGH correctness bug yok. |
| **Şema** | Additive (yeni optional alanlar + index + op literal'leri) → veri migrasyonu gerekmedi. |

---

## 3. Kalan işler

### 3.1 Canlı shape VERIFY — ⏸️ BLOCKED (gateway Hik cihazı bekliyor)
Deploy anında `npx convex run devices:listOnlineGatewayDevicesForBackfill` → `[]` (online gateway-transport Hik cihazı yok). Cihaz yanıtı alınamadığından `// VERIFY` işaretli alan adları doğrulanamadı. **Bir gateway Hik cihazı online olunca yapılacak** (runbook §4).

### 3.2 Görsel UI testi — ⏸️ BLOCKED (aynı sebep)
Yeni butonlar + kapı plan formu yalnız `brand==="hikvision" && hikTransport==="gateway" && hikDevIndex` cihazda render olur. Cihaz yokken görünmez.

### 3.3 Commit — opsiyonel
Henüz commit yok. Önerilen bölme: `feat: hik ISAPI ops (backfill/reconcile/mgmt/plans)` · `fix: code-review correctness` · reader/refactor işi ayrı (kullanıcının paralel işi).

### 3.4 Follow-up (opsiyonel, code-review bulguları — push'u engellemez)
- `doors.update` `hikDoorNo` değişince reader'ın `hikReaderNo`'sunu re-sync etmiyor (latent drift; `hikReaderNo` bugün panele push edilmiyor).
- Cleanup/refactor: 3 roster query iki-bacak auth walk'unu tekrar ediyor (→ `resolvePanelAuthorizedEmployeeIds` core'u çıkar); 4 pagination drain loop (→ `collectAllPages` helper); reconcile 3 drain sequential (→ `Promise.all`); `_runBackfill` per-event runMutation (→ batch). *Faz 7'de bilinçli ertelendi (kullanıcı "correctness + dead-code" dedi, refactor yok).*

---

## 4. VERIFY runbook (gateway Hik cihazı online olunca)

1. **Cihaz var mı:** `npx convex run devices:listOnlineGatewayDevicesForBackfill` → boş değilse devam.
2. **Çalışma durumu (en basit shape testi):**
   `npx convex run actions/hikGatewayDevice:fetchDeviceWorkStatus '{"deviceId":"<id>"}'`
   → `status` objesinde `doorStatus`/`cardReaderOnlineStatus`/`batteryVoltage` gerçekten dolu mu? Boşsa `getAcsWorkStatus`'taki alan adlarını gerçek yanıta göre düzelt (`hikGateway.ts`).
3. **Geçmiş backfill (pagination + AcsEvent shape):**
   `npx convex run actions/hikGatewayDevice:backfillDeviceEvents '{"deviceId":"<id>"}'`
   → `{ scanned, inserted, skipped }`. **İkinci kez çalıştır → `inserted:0` olmalı** (dedup kanıtı). `scanned` cihazdaki event sayısıyla tutuyor mu (pagination doğru mu)?
4. **Reconcile (CardInfo/Search + FDSearch + FingerPrintUpload shape):**
   `npx convex run actions/hikGatewayDevice:reconcileDevice '{"deviceId":"<id>"}'`
   → `onDeviceCount` 0 ve her kart `expectedNotOnDevice`'da çıkıyorsa → `searchCardsOnDevice` wrap-key yanlış (`CardInfo` vs `CardInfoSearch`); gerçek yanıta göre düzelt.
5. **Kapı planı (DoorStatus/Verify path):** bir test kapısında `applyDoorStatusPlan` → cihaz web UI veya `linkDoorStatusPlan` GET ile doğrula. `linkVerifyPlan` path'i (`/ISAPI/AccessControl/VerifyPlan/<doorNo>`) **tahmin** — gerçekle teyit et.
6. **Görsel:** dev server → cihaz düzenle → yeni butonlar + kapı düzenle → zaman-planı formu.
7. Düzeltme sonrası: `npx convex dev --once` ile tekrar deploy.

> Not: `npx convex run` authedAction'da identity gerektirir (`--identity`). super_admin: `m970yqhg...` (bkz [[ide_reconcile_live_testing]] memory). Parser'lar toleranslı yazıldı → yanlış alan = boş sonuç, crash değil.

---

## 5. `// VERIFY` işaretli shape'ler (çıkarım — canlı teyit gerek)

| Operasyon | Belirsizlik | Dosya |
|---|---|---|
| `CardInfo/Search` | wrap-key `CardInfo` vs `CardInfoSearch`, liste key | `hikGateway.ts` `searchCardsOnDevice` |
| `FDLib/FDSearch` | `MatchList`/`FDSearch` wrap, FPID vs employeeNo | `searchFacesOnDevice` |
| `FingerPrintUpload` | response wrap + liste key | `searchFingerprintsOnDevice` |
| `CaptureCardInfo`/`CaptureFaceData` | `isCurRequestOver`/`captureProgress`/`faceDataBase64` alan adları | `captureCardOnDevice`/`captureFaceOnDevice` |
| `AcsWorkStatus` | dizi alan adları (`doorStatus` vs `DoorStatus`) | `getAcsWorkStatus` |
| `AcsEvent` | `InfoList` alan adları | `searchAcsEventsOnDevice` |
| `linkVerifyPlan` | tam path (DoorStatusPlan simetrisinden tahmin) | `linkVerifyPlan` |

---

## 6. Bilinmesi gerekenler / kararlar / riskler

- **Deploy:** `npx convex dev --once` (canlı tabloları günceller). `npx convex codegen` yalnız `_generated/` üretir, PUSH ETMEZ. `npx convex deploy` KULLANMA. (bkz [[convex_deployment_topology]])
- **Backfill kota:** `backfillAllDevicesEvents` cron yalnız **online gateway** cihazları gezer → şu an `[]` olduğu için **boş dönüyor, kota yemiyor** (free-plan limiti yaklaşıyor uyarısı vardı). Gateway cihaz çoğalınca cron'un sayfa-cap + zaman-penceresi (son backfill'den beri) kotayı sınırlar. (bkz [[ide_poll_quota_incident]] — benzer yangın geçmişi)
- **Reconcile rapor-modu:** YIKICI DEĞİL — cihazda fazla/eksik kart/yüz/parmak'ı sadece raporlar, silmez/eklemez. Otomatik düzeltme istenirse ayrı opt-in faz.
- **localBridge dışarıda:** Tüm yeni action'lar `hikTransport==="gateway"` guard'lı. DS-K2804 / HCNetSDK localBridge cihazları bu işin DIŞINDA (bkz [[hikvision_2804_sdk_bridge]]).
- **Reader modeli scope-creep (bilinçli karar):** Faz 7C UI agent'ı, kapı-plan UI'si yaparken kullanıcının paralel "çoklu okuyucu" işini de ilerletti (`EditReaderDialog`→`readers.update`, `doors.create`→`hikReaderNo`). **Kullanıcı "kalsın" dedi** — geri alınmadı, legacy fallback'li, güvenlik+correctness review'dan geçti.
- **Erişim-karar refactor (kullanıcının paralel işi):** `accessDecision.ts`/`accessGraphPure.ts` saf fonksiyonları cardReadings'ten çıkarıldı; review wiring'in TAM ve davranış-koruyucu olduğunu doğruladı (token + kart akışı her ikisi de yeni fn'i çağırıyor, grant/deny mantığı bozulmadı).

---

## 7. Dosya envanteri (Hik ISAPI işi)

**Backend (Convex):**
- `convex/lib/hikGateway.ts` — ~25 yeni lib fn + pagination/poll fix'leri (en büyük değişim)
- `convex/actions/hikGatewayDevice.ts` — ~10 yeni action
- `convex/cardReadings.ts` — `backfillHikEventRow` (dedup mutation)
- `convex/devices.ts` — roster/work-status/backfill internal query+mutation'ları
- `convex/lib/accessGraph.ts` — `resolvePanelAuthorizedCards` `normalizeCard` parametresi
- `convex/actions/hikQueueWorker.ts` — yeni op case'leri
- `convex/hikvisionSync.ts` — op union genişlemesi
- `convex/schema.ts` — cardReadings index, devices/doors alanları, op literal'leri
- `convex/crons.ts` — `hik-backfill-events`
- `convex/doors.ts` — hik plan alanları + reader insert (reader modeli)

**Frontend:**
- `src/components/devices/form-sections/DeviceHikvisionSection.tsx` — cihaz aksiyon butonları + paneller
- `src/components/access-control/EditDoorDialog.tsx` (yeni) — kapı düzenle + zaman-planı formu
- `src/components/sync/SyncIssuesBanner.tsx` — op label'ları

---

## 8. Referanslar

- **Plan dosyası (detaylı, faz faz):** `~/.claude/plans/plan-yapal-m-curried-perlis.md`
- **Memory:** `hik_isapi_ops_expansion.md` (+ MEMORY.md index)
- **Çatı doc:** `docs/HIK_DEVICE_GATEWAY.md` (gateway mimarisi)
- **ISAPI kaynak:** `tmp/pdfs/isapi_controllers_value_series.txt` + `~/Downloads/ISAPI_Controllers_Value Series/`
- **Kod giriş noktaları:** `convex/lib/hikGateway.ts` (lib), `convex/actions/hikGatewayDevice.ts` (action), `DeviceHikvisionSection.tsx` (UI)
