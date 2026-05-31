# IDE Smart MQTT Entegrasyonu — Session Özeti (2026-05-29)

Bu session'da IDE Smart kapı panelleri için **iki yönlü MQTT komut/event kanalı** kuruldu, canlı panelle uçtan uca doğrulandı ve otomatik sync tetikleyicileri bağlandı. Aşağıda yapılanlar, canlı durum ve **devralma için kalan iş** var.

---

## 1. Neden MQTT (heartbeat-response değil)

Önce HTTP heartbeat-response (`LOGGER.HB_PROCESS_RESPONSE`) yolu denendi ve **çalıştığı kanıtlandı** (reboot şart) AMA o kanal `HTTP_REMOTE` sayılıyor ve `update_actuator` orada **level 99** (kapalı) istiyor:
```
"forbidden: operation on HTTP_REMOTE requires level 99, you are 3"
```
MQTT kanalında `update_actuator` **level 0** (docs §3.4). Bu yüzden komut kanalı MQTT. Detay: `scripts/ide-smart-probe-hb.mjs` (test script, HB_PROCESS_RESPONSE'u sonda 0'a revert eder).

---

## 2. Mimari (CANLI ve ÇALIŞIYOR)

```
IDE Smart Panel (192.168.1.4, UUID 289833329732592, MQTT modu)
  │  publish: event/access/online, event/heartbeat, event/connected
  │  subscribe: device/subscribe/<uuid>   (komut)
  │  response: device/publish/<uuid>      (msx-id correlation)
  ▼
Hetzner 157.90.114.86  Mosquitto (Docker /opt/ngs-mqtt)
  │  port 1883 PLAINTEXT (TLS değil — aşağıda neden) + auth + ACL
  ▲  loopback
  ide-mqtt-bridge daemon (systemd, /opt/ngs-bridge)
  │  event → POST /ide-bridge/event (Bearer IDE_BRIDGE_SECRET)
  │  komut ← POST /ide-bridge/poll → device/subscribe publish
  │  response → msx-id eşle → POST /ide-bridge/ack
  ▼
Convex notable-tern-4 (dev)
```

### TLS neden KAPALI (önemli)
Panel `SSL_ENABLED=1` ile bağlanınca `MQTT.STATUS="CA file missing"` verdi: panel self-signed CA'yı doğrulamak için bir **CA dosyası** bekliyor (parametre değil, dosya). Firmware'de CA dosyası yükleme yolu belgelenmemiş/bulunamadı. **Kullanıcı kararı:** TLS'i kapat → panele `MQTT.SSL_ENABLED=0` + `MQTT.PORT=1883`, broker'da 1883 plaintext listener (UFW açık). Parola auth + topic ACL korunuyor, trafik şifresiz. Broker'da 8883 TLS listener hâlâ hazır — ileride panele CA yükleme yolu bulunursa tek satırla dönülür.

---

## 3. Eklenen/değişen dosyalar

### Broker (Hetzner, repoda infra/mqtt/)
- `infra/mqtt/docker-compose.yml` — eclipse-mosquitto:2, 1883 (plaintext, dünyaya açık) + 8883 (TLS, hazır ama kullanılmıyor)
- `infra/mqtt/config/mosquitto.conf`, `config/acl` (device + bridge rolleri), `gen-certs.sh`, `RUNBOOK.md`, `.gitignore`
- KRİTİK kurulum notları RUNBOOK'ta: cert/passwd/acl dosyaları container uid 1883'e chown + acl/passwd 0700; docker daemon `systemctl enable --now docker`.

### Bridge (Hetzner /opt/ngs-bridge, repoda)
- `scripts/ide-mqtt-bridge.mjs` — daemon (mqtt npm). poll→publish→ack, msx-id correlation, topic-uuid doğrulama, random msx-id.
- `infra/mqtt/ide-mqtt-bridge.service` — systemd unit (enable, boot'ta kalkar).
- Env: `/etc/ide-mqtt-bridge.env` (MQTT_URL=mqtt://127.0.0.1:1883 loopback, MQTT_BRIDGE_PW, CONVEX_SITE_URL, IDE_BRIDGE_SECRET).

### Convex
- `convex/schema.ts` — `idePendingOperations` tablosu (status pending/sent/acked/failed, msxId, idempotencyKey, by_status_nextRetry/by_msx/by_idempotency index'leri), `devices.ideTransport` ("http"|"mqtt"), `accessRules.idePermissionNo`.
- `convex/ideSync.ts` (YENİ) — kuyruk yaşam döngüsü: enqueueIdeOp, listPendingForBridge, markSent, markAck (status==sent guard), requeueTimedOut, ensureIdePermissionNo (atomik), getIdePanelIoIds, listSyncIssues + mapping helper'ları (hhmmToMinutes, daysToIdeWeekDays, buildIdePermissionRecord).
- `convex/ideSync.test.ts` (YENİ) — 8 mapping testi.
- `convex/actions/ideGatewayDevice.ts` — openIdeDoor (mqtt→kuyruk / http→doğrudan), syncEmployeeToIdePanels, deleteEmployeeFromIdePanels, syncPermissionToIdePanels.
- `convex/http.ts` — `/ide-bridge/{event,poll,sent,ack}` route'ları (IDE_BRIDGE_SECRET Bearer). /ide-bridge/event ideUuid zorunlu.
- `convex/lib/cardReaderParse.ts` — heartbeat/connected event'inde transaction.src-id → ideUuid çıkarımı (lastSeen için).
- `convex/crons.ts` — `requeue-ide-timeouts` (1 dk).
- `convex/devices.ts` — createIdePanel/create/update'e ideTransport.
- `convex/hikvisionSync.ts` — getEmployeeWithDevices/getAccessRuleWithDevices dönüşüne idePermissionNo eklendi (Hik query'leri, geriye uyumlu).
- Frontend: DeviceIdeSmartSection (transport seçici), useDeviceFormSchema (ide_transport + MQTT'de IP/şifre opsiyonel), useDeviceFormLogic/DataLoader/Submission, ZoneDoorTree (queued toast).
- `src/integrations/supabase/` SİLİNDİ (ölü kod, baseline tsc hatasıydı).

### Env (.env.local — gitignore)
`MQTT_BROKER_HOST/PORT, MQTT_DEVICE_USER/PW, MQTT_BRIDGE_USER/PW, IDE_BRIDGE_SECRET`. Convex env'de de `IDE_BRIDGE_SECRET` set.

---

## 4. Review düzeltmeleri (security + code-review)
- **security:** cross-panel ack sahteciliği → bridge topic-uuid correlation + random msx-id + ACL hardening notu.
- **code:** requeueTimedOut cron'a bağlandı; markAck `status==="sent"` guard; sent-fail→publish atla; publish-err→anında retry; ensureIdePermissionNo atomik (race fix); /ide-bridge/event ideUuid zorunlu.
- tsc 0, eslint 0, vitest 36/36.

---

## 5. CANLI TEST SONUÇLARI

| Test | Sonuç |
|---|---|
| **Kapı açma** (kuyruk→bridge→broker→GERÇEK panel→kapı→ack→acked) | ✅ kanıtlandı, ~160ms |
| **Kart okutma** (panel→MQTT→bridge→Convex→cardReadings) | ✅ İrem Peker kartı 4240722371 düştü; panel `reddedildi` (panelde user yok, beklenen) |
| Panel heartbeat → lastSeen güncelleme | ✅ |
| Kişi sync / yetki sync / kişi silme | ⏳ HENÜZ TEST EDİLMEDİ |

Panel user/permission kayıtları şu an BOŞ (temiz başlangıç).

---

## 6. Otomatik sync tetikleyicileri (BU SESSION'DA EKLENDİ — devam edilecek)

Kullanıcı "sistemimizde otomatik sync var" dedi. Hikvision deseni: mutation'lar `ctx.scheduler.runAfter(0, ...syncEmployeeToDevices)` ile push tetikliyor. IDE eşdeğerleri AYNI noktalara eklendi:
- `convex/employees.ts` — create (220), update (300), remove (322): `syncEmployeeToIdePanels` / `deleteEmployeeFromIdePanels`.
- `convex/accessRules.ts` — update, remove, createWithGroups, updateWithGroups, addGroupMember, removeGroupMember, addGroupDevice, removeGroupDevice (9 nokta): `syncPermissionToIdePanels` / `syncEmployeeToIdePanels` / `deleteEmployeeFromIdePanels`.

Yapı: her mutation HEM Hik HEM IDE sync'i schedule eder; her action içeride kendi brand'ini filtreler (`syncEmployeeToDevices`→hikvision, `syncEmployeeToIdePanels`→ide_smart). Çalışanın o brand cihazı yoksa action no-op döner. **codegen + tsc 0 hata** (bu noktaya kadar doğrulandı).

---

## 6.1 ⚠️ KRİTİK BUG (code-review'da bulundu, DÜZELTİLMEDİ) — auth scheduler'a geçmiyor

Eklenen IDE sync action'ları (`syncEmployeeToIdePanels`, `syncPermissionToIdePanels`, `deleteEmployeeFromIdePanels`) **`authedAction`** (login zorunlu, handler `ctx.runQuery(api.users.currentUser)` → user yoksa "Giriş yapmanız gerekiyor" throw).

**Convex resmi davranışı (doğrulandı, docs scheduling/scheduled-functions):** *"Authentication is not automatically propagated to scheduled functions."* Yani `ctx.scheduler.runAfter(0, ...authedAction)` ile çağrılan action'da auth identity YOKTUR → `currentUser` null → action handler'a girmeden **throw eder**. **Sonuç: bu turn'de eklediğim tüm otomatik IDE sync tetikleyicileri RUNTIME'DA SESSİZCE AUTH HATASI VERİR, IDE'ye hiçbir şey push edilmez.**

**Aynı sorun mevcut Hikvision kodunda da var** (`syncEmployeeToDevices` de authedAction, aynı şekilde scheduler'dan çağrılıyor). Ama o mevcut/kapsam dışı — DOKUNMA, kullanıcıya sor (belki Hik sync de aslında otomatik çalışmıyor ve fark edilmedi, ya da başka bir tetikleme var).

**ÇÖZÜM (sonraki session):** IDE sync action'larını `internalAction`'a çevir + handler'daki kullanıcı-kimliği bağımlılığını kaldır. IDE action'ları zaten `isProjectAllowed` yapmıyor (sadece brand filtreliyor), yani internalAction'a çevirmek kolay. `internal.actions.ideGatewayDevice.*` ile çağrılır. NOT: `openIdeDoor` UI'dan çağrıldığı için authedAction kalmalı; sadece scheduler'dan çağrılan 3 sync action internalAction olmalı (veya hem authed UI versiyonu hem internal scheduler versiyonu).

**Bu yüzden bu turn'ün tetikleyici eklemeleri "beklemede" — kod canlıda ama çalışmıyor; sonraki session'da internalAction'a çevrilince çalışacak.** tsc 0 (derleme sorunu yok, sadece runtime auth).

## 6.2 ⚠️ KRİTİK GÜVENLİK (security-review'da bulundu, DÜZELTİLMEDİ) — cross-tenant authorization bypass

3 IDE sync action'ı (`syncEmployeeToIdePanels:198`, `deleteEmployeeFromIdePanels:258`, `syncPermissionToIdePanels:294`) **`isProjectAllowed`/`listProjectIdsForCurrentUser` kontrolü YAPMIYOR** — sadece `brand==="ide_smart"` filtreliyor. Hikvision karşılıkları (syncEmployeeToDevices:18,40 + syncWeekPlanToDevices:368) bu tenant kontrolünü YAPIYOR. `ensureIdePermissionNo` ayrıca herhangi bir accessRule'a cross-tenant DB patch yazabilir.

**Exploit (eğer action UI'dan çağrılabilirse):** Tenant A admini, B'nin employeeId/accessRuleId'siyle `convex.action(api.actions.ideGatewayDevice.syncEmployeeToIdePanels, {employeeId:<B>})` çağırıp B'nin fiziksel panellerine kişi/yetki yazabilir/silebilir (cross-tenant). `api.*` namespace'i public, useAction ile erişilebilir.

**ŞU AN CANLIDA EXPLOIT EDİLEMEZ çünkü:** (a) §6.1 auth-in-scheduler bug'ı bu action'ları scheduler'dan zaten throw ettiriyor, (b) UI'da bu 3 action'ı çağıran buton/kod YOK (sadece openIdeDoor+registerIdePanel UI'dan çağrılıyor, onlar loadIdePanel→isProjectAllowed ile GÜVENLİ). Yani açık var ama tetikleme yüzeyi yok — yine de düzeltilmeli.

## 6.3 İKİSİNİ BİRDEN ÇÖZEN TASARIM (sonraki session — §7 ile birlikte karar ver)

§6.1 (auth scheduler'a geçmiyor) ve §6.2 (cross-tenant) çakışıyor: tenant kontrolü identity ister, ama scheduler'da identity yok. Doğru mimari:

- **3 sync action'ı `internalAction`'a çevrilir** (scheduler'dan auth'suz çalışsın). `internal.actions.ideGatewayDevice.*` ile çağrılır (employees.ts/accessRules.ts tetikleyicileri `api.*`→`internal.*` güncellenir).
- **Tenant kontrolü TETİKLEYEN mutation'da kalır** — employees.ts/accessRules.ts mutation'ları zaten `authedMutation` + `getProjectIdsForUser` ile employee/rule'un caller'ın projesinde olduğunu doğruluyor. Yani scheduler'a giden employeeId/accessRuleId zaten tenant-doğrulanmış. internalAction ek kontrol gerektirmez (Convex deseni: internal fonksiyon güvenilir caller'dan gelir).
- **Eğer UI'dan da doğrudan push isteniyorsa** (örn "IDE'ye push et" butonu): ayrı bir `authedAction` wrapper (`pushEmployeeToIde`) yazılır, o `isProjectAllowed` yapar + `internal.*` sync'i çağırır. Hikvision'da da bu ayrım var.
- **openIdeDoor authedAction KALIR** (UI'dan, tenant+zone kontrollü, güvenli).

Bu, §7'deki "Hik ile IDE'yi ayıralım" isteğiyle uyumlu — net ayrım: internal sync (scheduler) vs authed push (UI).

## 7. AÇIK SORU — sonraki session'da ÖNCE bunu çöz

Kullanıcı: **"hikvision ile ideyi ayıralım, isimlerini de ayıralım, seçimlere göre ayrı fonksiyonlar çalışsın olur mu?"**

Şu an fonksiyonlar zaten ayrı isimli (syncEmployeeToDevices vs syncEmployeeToIdePanels) ve her biri kendi brand'ini filtreliyor — ama her mutation İKİSİNİ DE schedule ediyor (brand'e göre no-op). Kullanıcının istediği netleşmedi (AskUserQuestion sorulurken kullanıcı kesti). Olası yorumlar:
1. Şu anki yapı yeterli (her ikisi tetiklenir, no-op).
2. **Koşullu tetikleme:** mutation önce çalışanın/kuralın hangi brand cihaza bağlı olduğuna bakıp SADECE ilgili brand'in sync'ini schedule etsin (IDE paneli yoksa IDE sync hiç çağrılmaz).
3. Başka bir şey (UI seçimi / kod organizasyonu / dosya ayrımı).

**Sonraki session ilk adım:** kullanıcıya bu seçimi netleştir, sonra ona göre tetikleyicileri ayarla. Eğer (2) seçilirse: her mutation'a "bu employee/rule IDE paneline bağlı mı?" kontrolü (groupDevices üzerinden brand bakışı) eklenip koşullu schedule yapılacak.

---

## 8. Kalan test adımları (otomatik sync netleşince)
- TEST 2 — Kişi sync: İrem Peker'i panele yaz → panelde user kaydı + sonraki kart okutmada `izin_verildi`. Ön koşul: İrem'in grup→IDE panel bağlantısı (groupDevices'ta IDE paneli var mı?).
- TEST 3 — Yetki sync: erişim kuralı → panelde permission kaydı.
- TEST 4 — Kapı açma UI'dan (Erişim Kontrolü → Kapıyı Aç).
- TEST 5 — Kişi silme → panelden user kaydı silinir.

İzleme komutları:
```bash
# Bridge logları
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 'journalctl -u ide-mqtt-bridge -f'
# Broker'daki ham event
ssh ... 'docker run --rm --network host eclipse-mosquitto:2 mosquitto_sub -h 127.0.0.1 -p 1883 -u bridge -P <pw> -t "event/#" -v'
# Panelde user/permission kayıtları (LAN'dan, .env.local L3)
# get_data data_type:user/permission ile (probe script deseni)
# Test op enqueue: npx convex run ideSync:enqueueIdeOp '{"deviceId":"jn72ysjvw744wnf2mpyvkz819x87mcww","opType":"openDoor","payload":{"ioId":0,"keep":1}}'
```
Panel device _id: `jn72ysjvw744wnf2mpyvkz819x87mcww`, ideUuid `289833329732592`, projectId `mn7cd3v776f5b3hks5qerwzpz581x3r8`.

---

## 9. Durum özeti
- Broker + bridge CANLI (systemd, boot'ta kalkar). Panel MQTT modunda, bağlı.
- Kapı açma + kart okutma uçtan uca KANITLANDI.
- Otomatik sync tetikleyicileri eklendi (tsc temiz) ama kişi/yetki sync CANLI TEST EDİLMEDİ.
- **Sonraki session:** §7 açık sorusunu çöz → §8 testlerini yap.
- İlgili memory: `ide_smart_mqtt_integration`, `ide_smart_hb_remote_channel`.
