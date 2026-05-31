# ngsaccess → IDE Smart: Kişi & Yetki Senkronizasyon Mimarisi

> **Kapsam:** ngsaccess'in (Convex backend) IDE Smart erişim panellerine **kişi (employee)**
> ve **yetki (access rule)** bilgisini MQTT üzerinden nasıl otomatik senkronize ettiğinin
> otoriter dökümanı. `docs/ide-smart/01–15` IDE Smart **firmware/protokol** referansıdır
> (vendor); bu dosya ise **ngsaccess tarafındaki uygulamayı** anlatır.
>
> Son güncelleme: 2026-05-29 (UTC+3). Durum: kişi/yetki sync kodu **canlı** (`notable-tern-4`),
> Katman-1 (kuyruk) testi **kanıtlandı**, Katman-2 (canlı panel) cihaz tekrar bağlanınca yapılacak.

---

## 1. Genel Akış

```
Web UI (admin)                Convex (notable-tern-4)                 Hetzner bridge            IDE Smart panel
─────────────                 ──────────────────────                 ──────────────            ───────────────
employees.create/update  ──►  scheduler.runAfter(0, internal.        (systemd, 7/24)
accessRules.* (10 nokta)       actions.ideGatewayDevice.*)            poll 2sn
                               │                                      ──► /ide-bridge/poll ──┐
                               ▼ internalAction                                              │
                          syncEmployeeToIdePanels /                                          │
                          syncPermissionToIdePanels /                ◄── pending op'lar ─────┘
                          deleteIdeUserFromPanels                     MQTT publish
                               │                                      device/subscribe/<uuid> ──► create_data /
                               ▼ enqueueIdeOp (idempotent)                                        update_data /
                          idePendingOperations tablosu               ◄── device/publish/<uuid>    delete_data /
                          (pending→sent→acked/failed)                 ack ──► /ide-bridge/ack      update_actuator
```

İki ayrı yön:
- **Aşağı (komut):** Convex kuyruğa op yazar → bridge çeker → panele MQTT publish → panel ack'ler.
- **Yukarı (event):** Panel kart okutma event'ini broker'a publish eder → bridge `/ide-bridge/event`
  → `processCardReading` → `cardReadings`. (Bkz. `06-device-upstream-events.md`, `cardReaderParse.ts`.)

Hikvision'ın HTTP gateway eşdeğeri; fark: IDE teslimi Convex worker'ı değil, **dış Hetzner bridge**
tarafından yapılır (Convex serverless kalıcı MQTT tutamaz).

---

## 2. Mapping — Employee → IDE user

`convex/actions/ideGatewayDevice.ts` → `syncEmployeeToIdePanels` (internalAction).

| ngsaccess kaynağı | IDE user alanı | Dönüşüm |
| :-- | :-- | :-- |
| `employee.cardNumber` (string) | `user.id` (64-bit int) | `Number(cardNumber)`; **`Number.isSafeInteger` ve `>= 1`** doğrulanır. Geçersizse panele bağlı IDE varsa hata, yoksa sessiz no-op. |
| `employee.isActive` | `user.status` (0/1) | `isActive === false ? 0 : 1` (undefined → 1). |
| Bağlı kuralların `idePermissionNo`'ları | `user.permissions[]` (int[], **max 16**) | `capPermissionNos`: geçersizleri (n<1) ele, **tekilleştir**, sırala, 16'ya kırp. |

**Çok-kural desteği:** Bir çalışan aynı panele **birden çok kuralla** bağlıysa (örn. iki kapı
grubu), `permissions[]` o panele bağlı **tüm** kuralların permNo'larını içerir. (Eski kod
device-dedupe yüzünden yalnızca İLK kuralı yazıyordu — düzeltildi.)

**Canlı kanıt (Katman-1, İrem Peker):**
```json
upsertUser → { "mode":"create", "userRecord": { "id":4240722371, "permissions":[1], "status":1 } }
```

---

## 3. Mapping — AccessRule → IDE permission

`convex/ideSync.ts` → `buildIdePermissionRecord`; `ideGatewayDevice.ts` → `syncPermissionToIdePanels`.

| ngsaccess kaynağı | IDE permission alanı | Dönüşüm |
| :-- | :-- | :-- |
| `accessRule.idePermissionNo` | `permission.id` (1–65535) | `ensureIdePermissionNo`: yoksa atomik `max+1` atar (`hikWeekPlanNo` analogu). |
| `zones.ideDeviceId → doors.ioId` | `permission.io` (int[] 0–7, **max 8**) | `getIdePanelIoIds`; **0–7 dışı filtrelenir** (`outOfRangeIoIds` ile uyarı), boşsa `[0]`. |
| `accessRule.startTime`/`endTime` ("HH:MM") | `schedule.start`/`end` (dakika 0–1439) | `hhmmToMinutes`; boşsa 0 / 1439. |
| `accessRule.days` (TR/EN ad dizisi) | `schedule.week_days` (0=Pazar … 6=Cmt) | `daysToIdeWeekDays`; boşsa 7 gün açık `[0..6]`. |

**Canlı kanıt (Katman-1):**
```json
upsertPermission → { "mode":"create", "permissionRecord": {
  "id":1, "io":[0,1,2,3], "schedule": { "start":0, "end":1439, "week_days":[0,1,2,3,4,5,6] } } }
```

---

## 4. Sıralama Garantisi — permission ÖNCE, user SONRA

IDE firmware (`09-access-control-logic.md` §9.1): panel, `update_actuator` sırasında user'ın
`permissions[]` listesindeki **her id için permission RECORD'unu okur**; kayıt yoksa o izin grant
edemez → sonuç **"User is not permitted"**.

Bu yüzden `syncEmployeeToIdePanels` her panel için **önce** ilgili `upsertPermission` record'larını,
**sonra** `upsertUser`'ı enqueue eder (aynı action içinde, permNo referansının panelde karşılığı
olsun diye).

**Kalan risk:** Bridge ack beklemeden ardışık publish ettiğinden panele **varış sırası** kesin
garanti değil. `enqueueIdeOp` op'ları `_creationTime` sırasıyla eklenir ve bridge `pending`'leri o
sırayla çeker; pratikte permission önce gider. Kesinlik gerekirse opType-öncelikli sıralama veya
ack-barrier eklenebilir (açık iyileştirme).

---

## 5. internalAction Zorunluluğu (kritik)

3 sync action **`internalAction`**'dır: `syncEmployeeToIdePanels`, `deleteEmployeeFromIdePanels`,
`syncPermissionToIdePanels` (+ yardımcı `deleteIdeUserFromPanels`). Sebep:

- `authedAction` (`convex/lib/customFunctions.ts`) gövdesinde `ctx.runQuery(api.users.currentUser)`
  çağırır; `currentUser` `optionalAuthQuery`'dir ve **scheduler context'inde auth identity olmadığı
  için `null` döner** → `authedAction` `throw` eder ("Giriş yapmanız gerekiyor").
- Yani bu action'lar `ctx.scheduler.runAfter` ile tetiklendiğinde **sessizce patlardı** — UI'dan
  eklenen kişi panele **hiç gönderilmezdi**.
- Kanıt: `npx convex run users:currentUser '{}'` → `null` (CLI ve scheduler aynı auth-yok koşulu).

Yetki, tetikleyen mutation'da (`adminMutation`/`authedMutation`) zaten denetlenir; internalAction'lar
gövdesinde auth-bağımlı sorgu kullanmaz. `openIdeDoor` ve `registerIdePanel` **authedAction kaldı**
(UI'dan doğrudan, tenant+zone kontrollü çağrılır — `loadIdePanel`).

> **⚠️ Hikvision aynı buga sahip:** `convex/actions/hikvisionSync.ts` sync action'ları da
> `authedAction` + scheduler-tetiklidir → onlar da scheduler'dan `throw` ediyor (Hikvision otomatik
> sync de kırık). Henüz düzeltilmedi: bu action'lar gövdesinde `listProjectIdsForCurrentUser` +
> `isProjectAllowed` kullandığından internalAction'a çevirmek proje-filtre mantığını da elden
> geçirmeyi gerektirir. **Ayrı bir iş olarak ele alınmalı.**

---

## 5.1 Panel Komut Kimlik Doğrulama (level-1 token — MQTT login)

İki ayrı auth katmanı var; karıştırma:
- **Convex tarafı (§5):** sync action'ları internalAction (scheduler auth).
- **Panel tarafı (bu bölüm):** panel komutlarının firmware **yetki seviyesi**.

Panel komutları seviye ister (canlı kanıt, 2026-05-31):
- `update_actuator keep=1` (kapı açma) → **level 0** (token'sız çalışır).
- `create_data` / `update_data` / `delete_data` (kişi/yetki) ve `sync` → **level 1** → **login token'ı şart.**
  Token'sız panel `forbidden: create_data ... requires level 1, you are 0` döner.

Cihaz LAN-only olduğu için Convex/bridge HTTP login yapamaz. Çözüm: **bridge MQTT üzerinden
login olur** (`scripts/ide-mqtt-bridge.mjs`):
1. Bridge, level-1 bir op publish etmeden önce panel için geçerli token var mı bakar
   (`tokenCache`, uuid bazlı, 30s marj).
2. Yoksa `login` envelope'unu `device/subscribe/<uuid>`'e publish eder; panel
   `device/publish/<uuid>`'den `type:"login_response"` + `data.token` döner (msx-id korelasyon).
   **Canlı kanıt:** token = `1.<iat>.<exp>.<uuid>.<sig>` → **level 1**, TTL 600s.
3. Token zarfın `transaction.token`'ına eklenir; create_data **"permission created" / "user created"**
   ile kabul edilir (canlı kanıtlandı).
4. Token TTL'i dolunca / `forbidden`/`token` hatasında cache temizlenir → sonraki retry yeniden login.

Panel login kimliği (`ideUser`/`idePassword`, ör. admin/admin) `listPendingForBridge` poll yanıtında
yalnızca level-1 op'lar için iletilir (openDoor'a gönderilmez). `openDoor` token gerektirmez.

## 6. Tetikleyici Matrisi

Her employee/accessRule mutation'ı **hem Hikvision hem IDE** sync'ini schedule eder; her action
kendi brand'ini filtreler (alakasız brand → no-op). IDE referansları `internal.actions.*`,
Hikvision'lar `api.actions.*` (henüz authedAction).

| Mutation | IDE tetiklemesi |
| :-- | :-- |
| `employees.create` | `syncEmployeeToIdePanels` |
| `employees.update` (cardChanged) | **eski kart:** `deleteIdeUserFromPanels` → **yeni:** `syncEmployeeToIdePanels` |
| `employees.update` (activeChanged / yeni grup) | `syncEmployeeToIdePanels` |
| `employees.remove` | commit-öncesi panel çözümü → `deleteIdeUserFromPanels` |
| `employees.bulkUpdateStatus` | aktifliği değişen her çalışan için `syncEmployeeToIdePanels` |
| `accessRules.update` (saat/gün/aktiflik) | `syncPermissionToIdePanels` |
| `accessRules.createWithGroups` / `updateWithGroups` | `syncPermissionToIdePanels` + üyeler için `syncEmployeeToIdePanels` |
| `accessRules.addGroupMember` | `syncEmployeeToIdePanels` |
| `accessRules.removeGroupMember` | orphan panel(ler)den `deleteIdeUserFromPanels` + `syncEmployeeToIdePanels` (re-sync) |
| `accessRules.addGroupDevice` | `syncPermissionToIdePanels` + **gruptaki üyeler** için `syncEmployeeToIdePanels` |
| `accessRules.removeGroupDevice` | üyeler için `syncEmployeeToIdePanels` (re-sync) |

> `bulkDelete` ve `accessRules.remove` IDE'de tam orphan temizliği yapmaz (aşağıdaki §8 limitleri).

---

## 7. Kuyruk Yaşam Döngüsü & Idempotency

`convex/ideSync.ts` + `idePendingOperations` tablosu.

- `enqueueIdeOp` (internalMutation): op yazar. **openDoor hariç** op'lar `deviceId + opType + target`
  ile idempotent (`user:<id>`, `perm:<id>`); açık pending/sent op varsa yeni insert atmaz, payload'u
  günceller. → Tekrar tetiklemeler güvenli; aynı kişiyi iki kez sync etmek çift kayıt yaratmaz.
- `listPendingForBridge` → bridge'in çekeceği pending op'lar (panel UUID materialize).
- `markSent` (pending→sent, msxId), `markAck` (success→acked; fail/timeout→retry veya 5 deneme sonra
  failed). `requeueTimedOut` cron'u "sent"te asılı kalanları geri pending'e alır.
- **Not:** `upsertUser` ve `deleteUser` aynı `target`'ı (`user:<id>`) paylaşır — aynı anda ikisi
  pending olursa son yazan kazanır (silme-ekleme yarışı; pratikte ayrı zamanlarda tetiklenir).

---

## 8. Silme / Orphan Akışları ve Limitler

`scheduler.runAfter` commit **sonrası** çalıştığından, silme/kart-değişimi senaryolarında etkilenen
paneller **commit ÖNCESİ** mutation içinde çözülür (`convex/lib/accessGraph.ts`):
- `resolveEmployeeIdeDeviceIds` — çalışanın bağlı olduğu IDE panelleri.
- `resolveRuleIdeDeviceIds` — bir kuralın IDE panelleri.

| Senaryo | Davranış |
| :-- | :-- |
| `employees.remove` | Panel + kart no commit öncesi çözülür → `deleteIdeUserFromPanels`. (Eskiden post-commit `getEmployeeWithDevices` null dönüp **hiç silmiyordu**.) |
| Kart no değişimi | Eski kart `deleteIdeUserFromPanels` ile sökülür, yeni kart `syncEmployeeToIdePanels` ile yazılır. |
| `removeGroupMember` | Kuralın panellerinden, çalışanın **başka kuralla erişmediği** olanlardan kart silinir; hâlâ erişilenler re-sync ile `permissions[]` güncellenir. |

**Bilinen limit (reconcile cron HENÜZ YOK — Phase 5):**
- `accessRules.remove`, `removeGroupDevice`, `bulkDelete` tam orphan temizliği yapmaz; çalışan o
  panele başka kuralla erişmiyorsa panelde **orphan user/permission** kalabilir.
- Deaktif edilen kural (`isActive:false`) panelden çekilmez (permission record kalır).
→ Periyodik bir **reconcile job** (panel `get_data` ile DB karşılaştırıp orphan temizleyen) gelecekte
eklenmeli.

---

## 9. Deployment Topolojisi (dikkat)

- **`notable-tern-4` aslında "dev" deployment'tır** (`CONVEX_DEPLOYMENT=dev:notable-tern-4`) ama
  **canlı sistem orada çalışır**: bridge `https://notable-tern-4.convex.site/ide-bridge/*`'e poll
  eder, panel + İrem + tüm gerçek veri oradadır.
- `npx convex deploy` **AYRI, alakasız** bir prod deployment'a gider (orada panel ID'leri başka
  tablolara düşer) — **kullanılmaz.**
- Canlı güncelleme: **`npx convex dev --once`** (fonksiyonları `notable-tern-4`'e push eder).
  `npx convex codegen` SADECE tip üretir, **deploy etmez**.
- `npx convex run <fn>` ve `npx convex data <table>` varsayılan olarak `notable-tern-4`'e gider.

---

## 10. Test Planı

### Katman 1 — Cihaz offline iken kuyruk doğrulaması ✅ (KANITLANDI)
Fix'ler Convex tarafında olduğundan fiziksel panele gerek yoktur; `idePendingOperations` incelenir.
```bash
# internalAction canlı mı (eski authedAction throw ederdi):
npx convex run actions/ideGatewayDevice:deleteIdeUserFromPanels '{"cardNumber":"1","deviceIds":[]}'
#   → { ok:true, queued:0 }  (throw YOK)
# Kişi sync (İrem):
npx convex run actions/ideGatewayDevice:syncEmployeeToIdePanels \
  '{"employeeId":"k17de29e7c0v5sctevfxv48wbn864kxv"}'
#   → { ok:true, queued:2, skipped:[] }   (1 upsertPermission + 1 upsertUser)
# Kuyruk:
npx convex data idePendingOperations   # upsertPermission creationTime < upsertUser; payload'lar §2/§3
```
**Sonuç (2026-05-29):** permission-before-user sırası, payload'lar ve `permissions:[1]` doğrulandı.
Bridge op'ları aldı + publish etti; panel offline olduğu için "no response" (timeout/retry) — beklenen.

### Katman 2 — Canlı panel
1. **Yetki yazımı ✅ (2026-05-31):** token'lı `upsertPermission` → op `acked`, panel **"permission created"**.
2. **Kişi yazımı ✅ (2026-05-31):** token'lı `upsertUser` (id=4240722371, permissions:[1], status:1) →
   op `acked`, panel **"user created"**. (Bridge login-over-MQTT level-1 token aldı; §5.1.)
3. **Kart (KULLANICI — fiziksel):** İrem kartını panele okut → `cardReadings`'de
   `accessStatus="izin_verildi"` beklenir (panelde user yokken "reddedildi" düşüyordu — tersine
   dönüş sync'i uçtan uca kanıtlar).
4. **UI kapı açma ✅:** Erişim Kontrolü → "Kapıyı Aç" → `openIdeDoor` → röle (~160ms, kanıtlı).
5. **Silme (sonra):** çalışanı sil → `deleteUser` → kart okut → "reddedildi". (deleteUser de level-1;
   token'la gider.)

İzleme:
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 'journalctl -u ide-mqtt-bridge -f'
```

---

## 11. Açık Sorular

1. **Komut auth — ÇÖZÜLDÜ (2026-05-31):** `create_data` reddinin sebebi idempotensi değil,
   **yetki seviyesiydi** (token'sız level 0; create_data level 1 ister). Bridge artık MQTT login ile
   level-1 token alıp ekliyor (§5.1); İrem'in permission+user kaydı canlı **"permission created" /
   "user created"** ile yazıldı. **Kalan alt-soru:** panelde ZATEN VAR OLAN bir id'yi `mode:"create"`
   ile yeniden yazmak güncelleme mi yapıyor yoksa "duplicate" hatası mı (re-sync idempotensi)? Bir
   sonraki re-sync'te gözlemlenecek; hata olursa `mode:"update"` veya get_data-önce-kontrol gerekir.
2. **Kart no formatı:** 26/34-bit kart `Number()` için güvenli (< 9e15). 64-bit veya QR-değer
   planlanırsa taşma riski → string/BigInt stratejisi gerekir.
3. **Hikvision authedAction bug'ı** (§5) — ayrı iş olarak çözülmeli.
4. **Reconcile cron** (§8) — orphan temizliği için.

---

## 12. İlgili Kod & Dosyalar

| Dosya | Sorumluluk |
| :-- | :-- |
| `convex/actions/ideGatewayDevice.ts` | sync action'ları (internalAction) + openIdeDoor/registerIdePanel |
| `convex/ideSync.ts` | kuyruk yaşam döngüsü + mapping helper'ları (`buildIdePermissionRecord`, `capPermissionNos`, `outOfRangeIoIds`, `ensureIdePermissionNo`, `getIdePanelIoIds`) |
| `convex/lib/accessGraph.ts` | commit-öncesi panel çözümleme (`resolveEmployeeIdeDeviceIds`, `resolveRuleIdeDeviceIds`) |
| `convex/employees.ts`, `convex/accessRules.ts` | tetikleyiciler |
| `convex/lib/ideSmart.ts` | HTTP/JSON protokol client (envelope, login, komutlar) |
| `scripts/ide-mqtt-bridge.mjs` | Hetzner bridge (poll/publish/ack, `envelopeForOp`) |
| `convex/ideSync.test.ts` | mapping helper'ları unit testleri (14 test) |
