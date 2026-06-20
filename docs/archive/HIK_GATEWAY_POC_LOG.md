# Hik Device Gateway PoC — Tam Implementation Notları

> **Tarih**: 2026-05-17
> **Sonuç**: Hetzner gateway kuruldu + cihaz online + ngsplus.app'ten otomatik kayıt + auth hardening + UI birleştirildi.
> **İlgili docs**: [HIK_DEVICE_GATEWAY.md](./HIK_DEVICE_GATEWAY.md), [HCT_OPENAPI.md](./HCT_OPENAPI.md), [HIKVISION_ENTEGRASYON.md](./HIKVISION_ENTEGRASYON.md)

---

## 1. Context — Neden Bu Mimari?

**Sorun**: Convex (serverless cloud) backend müşteri LAN'ındaki Hikvision cihaza doğrudan ulaşamaz. Önceki implementasyon `convex/actions/hikvisionSync.ts`'te `http://${device.deviceIp}/ISAPI/...` ile direkt LAN'a fetch atıyordu — Convex bulutundan LAN'a erişim olmadığı için **hiçbir zaman çalışmamıştı**. Push (cihaz→Convex event) zaten çalışıyordu, ama sync (Convex→cihaz) yoktu.

**Çözüm**: **Hik Device Gateway** Hetzner sunucusuna kuruldu. Cihazlar ISUP 5.0 ile **outbound** (port 7661) gateway'e bağlanır. Convex action'ları gateway'in **ISAPI passthrough** API'sini kullanır (`/ISAPI/...?devIndex=<uuid>`). NAT/CGNAT sorunu sıfırlanır.

```
[Müşteri LAN]              [Hetzner]                    [Convex Bulut]
DS-K1T807 ──ISUP outbound──> Gateway:7661
                            Gateway:8088 ──ISAPI──┐
                                                  ├──HTTPS Digest──> ngsplus.app
DS-K1T807 ──HTTP POST event───────────────────────────────────────> /card-reader
```

---

## 2. Hetzner Gateway Kurulumu (Faz 1)

### Sunucu
- IP: `157.90.114.86`
- OS: Ubuntu 24.04 x86_64
- SSH: `ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86`

### Kurulum
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 'mkdir -p /opt/hik/DeviceGateway'

scp -i ~/.ssh/id_ed25519_hetzner \
  "Downloads/Hik DeviceGateway(V1.8.0.4Build20250227)_Linux64_EN/HikDeviceGateway_V1.8.0.4Build20250227_Linux64.tar.gz" \
  root@157.90.114.86:/opt/hik/DeviceGateway/

ssh ... '
  cd /opt/hik/DeviceGateway
  tar -zxvf HikDeviceGateway_V1.8.0.4Build20250227_Linux64.tar.gz -C ./
  ./install.sh --port=8088   # 8081 conflict olduğu için 8088
'

# UFW portları
ssh ... '
  ufw allow 7660-7667/tcp comment "Hik ISUP"
  ufw allow 7660-7667/udp comment "Hik ISUP UDP"
  ufw allow 7091/tcp comment "Hik PSS storage"
  ufw allow 8088/tcp comment "Hik Gateway Web UI"
'
```

### Açılan portlar
| Port | Amaç |
|---|---|
| 7660-7667 TCP/UDP | ISUP cihaz registration + alarm |
| 7091 TCP | PSS storage |
| 8088 TCP | Gateway Web UI + ISAPI |

### Service yönetimi
```bash
systemctl status DeviceGatewayService
systemctl restart DeviceGatewayService
```

### Loglar
```
/opt/hik/DeviceGateway/logs/app/gateway_0.1.debug.log
/opt/hik/DeviceGateway/drivers/drv_isup_dev_x64/bin/vag/log/drv_isup_dev.0.1.*.log
/opt/hik/DeviceGateway/nginx/logs/error.log
```

### DB (encrypted SQLite, sqlcipher — direkt query edilemez)
```
/opt/hik/DeviceGateway/Device.db3
/opt/hik/DeviceGateway/Config.db3
/opt/hik/DeviceGateway/Syslog.db3
```

---

## 3. Test Cihazı: DS-K1T807EBFWX-E1

### Cihaz ISUP ayarı (web UI: `https://192.168.1.37`)
- Configuration → Network → Advanced → Platform Access
- Enable: ON
- Protokol: **ISUP 5.0**
- Sunucu IP: `157.90.114.86`
- Port: `7661`
- Cihaz Kimliği: `NGScikis2026` (Ehome ID)
- Şifreleme Anahtarı: `NGSplus2026Test!` (16 char)
- Save → cihaz reboot

### Cihaz ISAPI ile programatik konfigürasyon
```bash
# Get current ISUP config (XML)
curl -sk --digest -u "admin:<pass>" \
  "https://192.168.1.37/ISAPI/System/Network/Ehome"

# Set ISUP config (field name <key> NOT <encryptionKey>!)
curl -sk --digest -u "admin:<pass>" -X PUT \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<Ehome version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<enabled>true</enabled>
<addressingFormatType>ipaddress</addressingFormatType>
<ipAddress>157.90.114.86</ipAddress>
<portNo>7661</portNo>
<deviceID>NGScikis2026</deviceID>
<protocolVersion>v5.0</protocolVersion>
<key>NGSplus2026Test!</key>
</Ehome>' \
  "https://192.168.1.37/ISAPI/System/Network/Ehome"
```

---

## 4. ⚠️ KRİTİK BUG — addDevice Schema (sonradan keşfedildi)

`docs/HIK_DEVICE_GATEWAY.md` ve eski kodumuzda **yanlış** addDevice schema vardı. SDK doc'a (`Hik Device Gateway API_Developer Guide_V1.8.0.PDF`, sayfa 33 + A.25) göre **doğru format**:

### YANLIŞ (eski)
```json
POST /ISAPI/ContentMgmt/DeviceMgmt/addDevice?format=json
{
  "DeviceList": [{
    "DeviceInfo": {
      "devName": "...",
      "protocolType": "EHOME",
      "ehomeID": "...",
      "ehomeKey": "...",
      "devType": "accessControl"
    }
  }]
}
```
Bu format **her zaman `addDeviceFailed`** dönüyor.

### DOĞRU (SDK A.25 JSON_DeviceInList)
```json
{
  "DeviceInList": [{
    "Device": {
      "protocolType": "ehomeV5",
      "EhomeParams": {
        "EhomeID": "NGScikis2026",
        "EhomeKey": "NGSplus2026Test!"
      },
      "devName": "NGScikis",
      "devType": "AccessControl"
    }
  }]
}
```

**Farklar**:
| Alan | Yanlış | Doğru |
|---|---|---|
| Wrapper | `DeviceList` | `DeviceInList` |
| Item key | `DeviceInfo` | `Device` |
| protocolType | `"EHOME"` | `"ehomeV5"` |
| ehomeID location | flat | `EhomeParams.EhomeID` (büyük E!) |
| ehomeKey location | flat | `EhomeParams.EhomeKey` |
| devType | `"accessControl"` | `"AccessControl"` |

### Response (A.26 JSON_DeviceOutList)
```json
{
  "DeviceOutList": [{
    "Device": {
      "devIndex": "7650848F-4EAB-9A4D-A61B-45B01782D7D7",
      "devName": "NGScikis",
      "protocolType": "ehomeV5",
      "EhomeParams": { "EhomeID": "..." },
      "status": "success",   // veya "fail"
      "subStatusCode": "..."  // fail durumunda: "deviceExist" / "badParameters" / "monitorNodeOverLimit" / "noMemory"
    }
  }]
}
```

### Production hardening (HENÜZ YAPILMADI)
SDK 5.1.1: "The sensitive information such as **userName**, **password**, and **EhomeKey** should be **encrypted**."

Query param: `security=1&iv=<hex>` — AES128 CBC ile EhomeKey şifrelenmeli. PoC'ta plain çalışıyor ama production'a alırken eklenmeli.

---

## 5. Gateway API Endpoint'leri (test edilenler)

### Çalışanlar ✅
| Endpoint | Method | Body |
|---|---|---|
| `/ISAPI/System/deviceInfo` | GET | — (gateway own info) |
| `/ISAPI/ContentMgmt/DeviceMgmt/addDevice?format=json` | POST | A.25 JSON_DeviceInList |
| `/ISAPI/ContentMgmt/DeviceMgmt/delDevice?format=json&devIndex=<uuid>` | DELETE | — |
| `/ISAPI/Security/userCheck?format=json` | GET | — |
| `/SDK/activateStatus?format=json` | GET | — |

### Bu firmware'de ÇALIŞMAYANLAR ❌
- `/ISAPI/ContentMgmt/DeviceMgmt/deviceList` — herhangi bir body format'ı `Invalid Content` döner

### Bilinen Hikvision sub-status kodları
| Code | Anlam |
|---|---|
| `deviceExist` | ehomeID zaten kayıtlı |
| `badParameters` | Yanlış alan / değer |
| `monitorNodeOverLimit` | Cihaz limit aşıldı |
| `noMemory` | Yetersiz bellek |
| `addDeviceFailed` | Generic (yanlış schema dahil) |
| `deviceUserAlreadyExist` | UserInfo zaten var |

---

## 6. Convex Schema Değişiklikleri

### `devices` tablosu — yeni alanlar
```ts
brand: v.optional(v.union(v.literal("hikvision"), v.literal("other"))),
hikDevIndex: v.optional(v.string()),    // gateway UUID (ehomeV5 response)
ehomeID: v.optional(v.string()),         // cihaz Device ID
ehomeKey: v.optional(v.string()),        // şifreleme anahtarı
hikModel: v.optional(v.string()),
hikLastSeenAt: v.optional(v.number()),
hikOfflineHint: v.optional(v.string()),
```

**Yeni index**: `by_device_ip` (perf — eski full-table scan'i değiştirir), `by_hik_dev_index`, `by_ehome_id`.

### `cardReadings` tablosu — yeni alanlar
```ts
hikMajorEventType: v.optional(v.number()),       // 1/2/3/5
hikSubEventType: v.optional(v.number()),         // 1=valid, 6=no perm, 75=face, ...
hikCurrentVerifyMode: v.optional(v.string()),
hikSerialNo: v.optional(v.number()),
hikFrontSerialNo: v.optional(v.number()),
hikDevIndex: v.optional(v.string()),
hikPictureURL: v.optional(v.string()),
hikDateTime: v.optional(v.string()),
```

### Yeni tablo: `hikPendingOperations` (offline cihaz queue)
```ts
deviceId: v.id("devices"),
operation: v.union(v.literal("addPerson"), v.literal("deletePerson"), ...),
payload: v.any(),
status: v.union(v.literal("pending"), v.literal("processing"), v.literal("done"), v.literal("failed")),
attemptCount: v.number(),
lastError: v.optional(v.string()),
```
> ⚠️ Schema var ama **retry worker cron HENÜZ YAZILMADI**.

---

## 7. Convex Backend Dosyaları

### Yeni dosyalar
| Dosya | Amaç |
|---|---|
| `convex/lib/digestAuth.ts` | HTTP Digest auth (RFC 2617) helper |
| `convex/lib/hikGateway.ts` | Gateway client: `gatewayApiCall`, `pingGateway`, `addDeviceToGateway`, `deleteDeviceFromGateway`, `listGatewayDevices`, `upsertPersonToDevice`, `addCardToDevice`, `setWeekPlanOnDevice`, `openDoor`, `parseHikJsonStatus` |
| `convex/lib/hikEventCodes.ts` | `HIK_MAJOR_EVENT_TYPES`, `HIK_SUB_EVENT_GRANTED/DENIED` Set'ler, `inferAccessStatus(major, sub)` |
| `convex/actions/hikGatewayDevice.ts` | `registerDeviceOnGateway`, `removeDeviceFromGateway`, `refreshGatewayDeviceStatus`, `remoteOpenDoor`, `pingHikGateway` — **hepsi `authedAction` + project scope** |

### Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `convex/actions/hikvisionSync.ts` | LAN-direct → **gateway passthrough** refactor; `syncEmployeeToDevices`, `deleteEmployeeFromDevices`, `syncWeekPlanToDevices` `authedAction` + project scope + `Promise.all` paralelizasyon |
| `convex/lib/cardReaderParse.ts` | `extractHikEventFields()` — `devIndex`, `majorEventType`, `subEventType`, `currentVerifyMode`, `serialNo`, vb. parse |
| `convex/http.ts` | `/card-reader` yeni Hik alanlarını `processCardReading`'e iletir |
| `convex/cardReadings.ts` | `processCardReading` 8 yeni Hik field arg + her insert'e spread |
| `convex/devices.ts` | `getByIdInternal`, `setHikDevIndex`, `setHikOfflineHint`, `applyGatewayHeartbeat` (allowedProjectIds scope guard); `create`/`update`'e brand/ehomeID/ehomeKey |
| `convex/hikvisionSync.ts` | Internal queries `projectId` döndürür; `debugPatchDeviceCreds` **silindi**; `debugSyncChain` → `adminQuery` |
| `convex/users.ts` | `listProjectIdsForCurrentUser` internalQuery (action'lar için) |
| `convex/lib/auth.ts` | `isProjectAllowed(allowed, projectId)` ortak helper |

---

## 8. Convex Env Vars (Hem dev hem prod set edildi)

```bash
npx convex env set HIK_GATEWAY_HOST http://157.90.114.86:8088
npx convex env set HIK_GATEWAY_USER admin
npx convex env set HIK_GATEWAY_PASS '<gateway-admin-password>'

# Prod için de
npx convex env set --prod HIK_GATEWAY_HOST http://157.90.114.86:8088
# ... (HIK_GATEWAY_USER, HIK_GATEWAY_PASS aynı şekilde)
```

**Deployments**:
- Dev: `notable-tern-4` (https://notable-tern-4.convex.cloud)
- Prod: `dashing-elk-819` (https://dashing-elk-819.convex.cloud)

---

## 9. Frontend (React)

### Yeni dosyalar
- `src/components/devices/BrandPickerStep.tsx` — sheet'in 1. adımı (Hikvision / Diğer kartları)
- `src/components/devices/form-sections/DeviceHikvisionSection.tsx` — Hik form section (ehomeID, ehomeKey, IP, admin creds, Test Bağlantısı, Kapıyı Aç, Durumu Yenile, Kaldır)

### Değişen
- `src/types/device.ts` — `brand`, `hikDevIndex`, `ehomeID`, `ehomeKey`, `hikModel`, `hikLastSeenAt`, `hikOfflineHint`
- `src/components/devices/hooks/useDeviceFormSchema.ts` — `DeviceBrand`, `BRAND_LABELS`, `formSchema` brand + ehome_id/key + `superRefine`
- `src/components/devices/hooks/useDeviceFormSubmission.ts` — **auto-register**: brand=hikvision → `registerDeviceOnGateway` after save
- `src/components/devices/DeviceForm.tsx` — brand'e göre conditional Network vs Hikvision section
- `src/components/devices/DeviceDetailsPanel.tsx` — step state (picker → form), title brand-label

### Silinen
- `src/components/devices/HikGatewayPanel.tsx` (içeriği DeviceHikvisionSection'a taşındı — tek kart)

---

## 10. Security Hardening (5 review + 5 fix)

### Ana açıklar (security-review skill ile bulundu)
| # | Açık | Fix |
|---|---|---|
| 1 | 4 yeni action `action({...})` — anonim caller cihazı kayıt edebilir, kapı açabilir | `authedAction` + `isProjectAllowed` check |
| 2 | 3 mevcut action (hikvisionSync) anonim — çalışanı silebilir, plan değiştirebilir | `authedAction` + project scope |
| 3 | `applyGatewayHeartbeat` `allowedProjectIds: []` short-circuit bypass | Guard inverted: empty array = deny |
| 4 | `pingHikGateway` ehomeID enumeration oracle | Argument-less hale getirildi |
| 5 | `debugPatchDeviceCreds` anonim credential override + `debugSyncChain` anonim dump | `debugPatchDeviceCreds` silindi, `debugSyncChain` → `adminQuery` |

### Auth helper'lar
- `convex/lib/customFunctions.ts:90` — `authedAction` wrapper (`ctx.user: Doc<"users">` enjekte eder)
- `convex/lib/auth.ts:38-54` — `getProjectIdsForUser(ctx)` (super_admin → tümü, diğerleri → userProjects)
- `convex/lib/auth.ts` — `isProjectAllowed(allowed, projectId)` ortak helper

### Canonical pattern (her action'da uygulandı)
```ts
const allowedProjectIds = await ctx.runQuery(
  internal.users.listProjectIdsForCurrentUser, {}
);
const device = await ctx.runQuery(internal.devices.getByIdInternal, { id });
if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
  return { ok: false, error: "Bu cihaza erişim yetkiniz yok" };
}
```

---

## 11. Simplify Cleanup

| Fix | Kazanım |
|---|---|
| `isProjectAllowed` ortak helper | 7 inline check + 7 `as Id<...>` cast silindi |
| Internal query'lerde `projectId: Id<"projects">` | Tüm `as` cast'ler kalktı |
| `parseHikJsonStatus` ortak helper | 3 fonksiyonda copy-paste eliminate |
| `by_device_ip` index | `processCardReading` + `updateLastSeen` full-table scan → indexli lookup |
| `Promise.all` 3 action'da | N RTTs → 1 (refreshGatewayDeviceStatus), N×M paralelizasyon (syncWeekPlanToDevices) |
| `HikGatewayPanel` silindi | Edit modunda 2 ayrı kart yerine tek `DeviceHikvisionSection` |
| `DeviceBrand` type + `BRAND_LABELS` | 6+ yerde literal duplikasyon kalktı |
| `HIK_ONLINE_WINDOW_MS` named const | Magic 5*60*1000 yerine isimli sabit |

---

## 12. Kullanım Akışı (Final UX)

### Yeni cihaz ekleme
1. ngsplus.app → **Devices** → **+ Yeni Cihaz**
2. **Marka Seç** kartı → **Hikvision** veya **Diğer**
3. Form alanları:
   - Temel: Cihaz Adı, Seri No, Tip, Erişim Yönü
   - Konum: Bölge, Kapı
   - Durum: Aktif/Pasif
   - **Hikvision Gateway Ayarları** (sadece Hikvision):
     - Ehome ID *(cihaz Device ID, zorunlu)*
     - Şifreleme Anahtarı *(16 char, zorunlu)*
     - Cihaz IP *(opsiyonel)*
     - Admin User/Pass *(opsiyonel)*
4. **Test Bağlantısı** *(opsiyonel)* — gateway reachable mı?
5. **Kaydet** → arka planda:
   - `devices.create/update` mutation
   - brand=hikvision ise otomatik `registerDeviceOnGateway` action
   - `devIndex` Convex'e yazılır
   - **Online** badge görünür
6. Edit modunda ek aksiyonlar: **Kapıyı Aç**, **Durumu Yenile**, **Gateway'den Kaldır**

### KESINLIKLE YAPMA
- Gateway UI'dan (`http://157.90.114.86:8088`) manuel cihaz **ekleme** — Convex DB bu cihazı tanımaz, sync/door-open çalışmaz
- Gateway UI sadece **debug/inceleme** için kullanılır

---

## 13. Çözülmüş Sorunlar (kronolojik)

1. **Install port conflict** (8081 dolu) → 8088'e taşındı
2. **Cihaz "Çevrim dışı"** → ISUP key uyuşmuyordu, 16 char key ile çözüldü
3. **`field "key" lacks**` → device-side ISAPI alan adı `<encryptionKey>` değil, `<key>`
4. **Gateway "addDeviceFailed"** → SDK schema'sı doğru değildi (bkz §4 KRİTİK BUG)
5. **`deviceList` API "Invalid Content"** → Bu firmware'de çalışmıyor; alternative olarak `/ISAPI/System/deviceInfo` ile ping
6. **`pingHikGateway` cross-tenant enumeration** → argument-less hale getirildi
7. **`applyGatewayHeartbeat` empty array bypass** → guard inverted
8. **Edit modunda 2 ayrı kart** → `HikGatewayPanel` silindi, `DeviceHikvisionSection` ile tek kart
9. **`debugPatchDeviceCreds` anonim** → silindi
10. **Encrypted SQLite (sqlcipher)** → direkt query edilemez, gateway API kullan

---

## 14. Henüz Yapılmamışlar (production task'ları)

| Task | Öncelik | Notlar |
|---|---|---|
| `EhomeKey` AES128 CBC encryption (`security=1&iv=...`) | Yüksek | SDK 5.1.1 zorunlu kılıyor; PoC'ta plain çalışıyor ama production'da şifreli |
| `hikPendingOperations` retry cron worker | Orta | Schema var, cron yazılmadı |
| `/card-reader` endpoint HMAC veya IP allowlist | Orta | Hikvision HMAC desteklemiyor → IP allowlist (sadece gateway IP'sinden POST) |
| `pingHikGateway` rate limit | Düşük | Halen authedAction; ehomeID parametresi de yok ama bool leak hala mümkün değil |
| `extractHikEventFields` XML path dup giderme | Düşük | JSON ve XML branch'leri ayrı |
| Stringly-typed sabit konsolidasyonu (`"normalCard"`, `"AccessControl"`) | Düşük | Çok yerde tekrar |
| `processCardReading` 6-tekrar insert helper | Düşük | Pre-existing pattern |

---

## 15. Faydalı Komutlar (cheat sheet)

```bash
# Gateway sağlık kontrolü
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 \
  'curl -sk --digest -u "admin:<pass>" "http://127.0.0.1:8088/ISAPI/System/deviceInfo?format=json"'

# Gateway'e cihaz ekle (DOĞRU schema)
ssh ... 'curl -sk --digest -u "admin:<pass>" -X POST \
  -H "Content-Type: application/json" \
  "http://127.0.0.1:8088/ISAPI/ContentMgmt/DeviceMgmt/addDevice?format=json" \
  -d "{\"DeviceInList\":[{\"Device\":{\"protocolType\":\"ehomeV5\",
       \"EhomeParams\":{\"EhomeID\":\"FOO\",\"EhomeKey\":\"BAR16CHAR!!!!!\"},
       \"devName\":\"Test\",\"devType\":\"AccessControl\"}}]}"'

# Gateway'den cihaz sil
ssh ... 'curl -sk --digest -u "admin:<pass>" -X DELETE \
  "http://127.0.0.1:8088/ISAPI/ContentMgmt/DeviceMgmt/delDevice?format=json&devIndex=<uuid>"'

# Cihaz ISUP config değiştir (LAN'dan)
curl -sk --digest -u "admin:<pass>" -X PUT \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?><Ehome version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><enabled>true</enabled><addressingFormatType>ipaddress</addressingFormatType><ipAddress>157.90.114.86</ipAddress><portNo>7661</portNo><deviceID>NEWID</deviceID><protocolVersion>v5.0</protocolVersion><key>NEW16CHARKEY!!!</key></Ehome>' \
  "https://192.168.1.37/ISAPI/System/Network/Ehome"

# Gateway active connections (cihaz ISUP bağlandı mı?)
ssh ... 'ss -tn state established sport = :7661'

# Gateway service
ssh ... 'systemctl restart DeviceGatewayService'

# Gateway logları
ssh ... 'tail -100 /opt/hik/DeviceGateway/logs/app/gateway_0.1.debug.log'

# Convex deploy
npx convex dev --until-success    # dev
npx convex deploy -y              # prod (non-interactive)

# Convex env vars
npx convex env list
npx convex env set HIK_GATEWAY_PASS '<pass>'
npx convex env set --prod HIK_GATEWAY_PASS '<pass>'

# TypeScript + ESLint
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/eslint convex src
```

---

## 16. SDK Reference (lokal PDF)

`Downloads/Hik DeviceGateway(V1.8.0.4Build20250227)_Linux64_EN/Hik Device Gateway API_Developer Guide_V1.8.0_20250109.PDF`

**Kritik sayfalar**:
- p.12 — §4.1 Add Devices to Device Gateway (call flow diagram)
- p.33 — §5.1.1 addDevice (Request URI + Query + security param)
- p.34-37 — §5.1.2-5.1.8 delDevice / deviceList / modDevice / etc.
- p.82-110 — §5.4 Access Control Device Operations (Person/Card/Face/Door)
- p.136 — A.25 **JSON_DeviceInList** (DOĞRU request schema!)
- p.137 — A.26 JSON_DeviceOutList (response schema)
- p.273 — Appendix C Major & Minor Types of Access Control Event
- p.282 — Appendix D Status Codes

---

## 17. Production Cihazları (mevcut state — 2026-05-17 16:50)

### Convex prod (`dashing-elk-819`)
- 1 cihaz: `Hikvision DS-K1T807 (192.168.1.34)` — eski, brand/ehome yok

### Convex dev (`notable-tern-4`)
- `NGS QR` (3506556215854224) — brand="other"
- `NGS cikis` (807) — brand="hikvision", ehomeID="NGScikis2026", hikDevIndex=boş (auto-register beklemede)

### Gateway (`157.90.114.86:8088`)
- Boş (NGScikis2026 test kaydı silindi)
- Cihaz hala ISUP ile gateway'e bağlanmaya çalışıyor (95.70.206.194 → 7661)

### Pending
- Kullanıcı ngsplus.app'te NGS cikis'i tekrar Kaydet'e basmalı — fix sonrası auto-register başarılı olmalı

---

## 18. Lessons Learned

1. **Gateway SDK doc'unu okumadan tahmin yürütme** — bizim eski `HIK_DEVICE_GATEWAY.md` SDK'ya uymayan örnek içeriyordu; gerçek SDK PDF'i (A.25) okumak çözdü
2. **PoC'ta plain auth çalışsa bile production'da AES** — SDK "should be encrypted" diyor, regulator anlamında
3. **Encrypted SQLite** ile debug zor — her şey API üzerinden olmalı
4. **`action({...})` ≠ auth** — Convex'te plain action ANONIM çağrılabilir; her zaman `authedAction` + project scope
5. **Hooks doğru çalışıyor** — her code change'den sonra security-review + simplify zorla çalıştı, gerçek açıkları yakaladı
6. **`Promise.all` paralelizasyon** önemli — gateway'e seri istek yerine paralel; N×M problem ciddi olabiliyor
7. **Frontend ngsplus.app deployment dev mi prod mu?** — `VITE_CONVEX_URL` env var hangisini gösteriyorsa o çalışır; dev'de cihaz var prod'da yok demek frontend dev'e bağlanıyor
