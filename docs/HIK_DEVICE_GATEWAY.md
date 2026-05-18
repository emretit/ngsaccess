# Hik Device Gateway — ngsaccess Entegrasyon Notları

> **Kaynak**: Hik Device Gateway V1.8.0.4 Build 20250227 — Datasheet, User Manual, API Developer Guide (298 sayfa), FAQ (Hikvision Hangzhou, Jan 2025).
> **Bu doküman**: 350+ sayfa Hikvision dokümantasyonundan ngsaccess senaryosu için kritik bilgilerin damıtımı. Tam referans için `Downloads/Hik DeviceGateway(V1.8.0.4Build20250227)_Linux64_EN/` PDF'lerine bak.

---

## 1. Neden Bu Ürün

Hik Device Gateway, Hikvision'ın **resmi, ücretsiz, hazır gateway** ürünü. ISUP 5.0 / ISAPI protokollerini HTTP/RTSP'ye çevirir. ngsaccess için anlamı:

- **NAT problemi çözülür**: Cihaz outbound ISUP ile gateway'e bağlanır. Müşteri router'ında port-forward gerekmez.
- **Custom gateway yazılmaz**: Aylar sürecek C++/ISUP geliştirme yerine 1 günlük kurulum.
- **2 yönlü iletişim**: Cihaz → Convex (event upload) **+** Convex → Cihaz (komut push). İkincisi `addCard`, `addPerson`, `deletePerson`, `remoteControlDoor` gibi pratik işlemler.
- **Web UI yönetimi**: Cihaz ekle/sil/izle UI'dan veya programatic API ile.

### Mimari

```
[Müşteri sahası]                      [Hetzner sunucusu]
┌──────────────────┐                  ┌─────────────────────────┐
│ Hikvision cihaz  │ ISUP 5.0 (7660) │  Hik Device Gateway     │
│ (LAN, NAT arkası)├─────outbound────►│  (admin web UI: 80)     │
└──────────────────┘                  │                         │
                                      │  HTTP POST event ───────┼──► [Convex /card-reader]
                                      │                         │
                                      │  ◄── HTTP ISAPI komut ──┼─── [Convex action]
                                      └─────────────────────────┘
```

---

## 2. Limitler ve Kısıtlar

| Özellik | Limit | ngsaccess için |
|---|---|---|
| Toplam cihaz | 10,000 | Çok rahat |
| ISUP event/s (resimsiz) | 1,000/s | Çok rahat |
| ISUP event/s (resimli ≤200KB) | 20/s | Yüz tanıma için yeterli |
| **ISAPI passthrough cihaz limiti** | **200 cihaz** | ⚠️ Push gereken cihaz sayısı > 200 ise multi-gateway |
| OS | Win 10/Server 2012-2019, Ubuntu 20.04, CentOS 7, RHEL 9 (hepsi **x86_64**) | Hetzner CX (Intel/AMD) — **CAX (ARM) çalışmaz** |
| Min HW | i3, 4GB, 10GB | CX21 (€5/ay) |
| Önerilen HW | i5, 8GB, 50GB | CX31 / CCX13 (€15/ay) |
| Person/Card kapasite (cihaz başına) | 6000 person / 10000 card / 6000 face | Cihaz model bazlı, datasheet kontrol et |

### Desteklenen Cihaz Modelleri (Datasheet — kritik)

**ISUP 5.0 Access Control Terminal** (kart okuyucu):
- DS-K1T8003EF, DS-K1A8503EF-B, DS-K1T804EF

**ISUP 5.0 Facial Recognition Terminal**:
- DS-K1T642MFW, DS-K1T671TMFW, DS-K5604A-ZV, DS-K5671-3XF/ZU

> Sahadaki cihaz bu listede **değilse** çalışabilir ama Hikvision desteklemez. Mutlaka model + firmware doğrula.

### Açık Portlar (firewall)

| Port Adı | Default | Yön | Açıklama |
|---|---|---|---|
| HTTP (gateway web UI) | 80 (TCP) | inbound | Admin paneli, ISAPI API |
| HTTPS | 443 (TCP) | inbound | TLS varsa |
| ISUP Registration | 7661 (TCP+UDP) | inbound | Cihazların bağlandığı ana port |
| ISUP 5.0 Alarm | 7663 (TCP) | inbound | Alarm forwarding aktifse |
| ISUP 5.0 Stream/Playback/Audio | 7664/7665/7666 (TCP) | inbound | Video/audio için |
| Storage Service | 7091 (TCP) | inbound | |
| ISUP 2.0 Stream | 15000-17000 (TCP+UDP) | inbound | Eski cihazlar için |
| RTSP | 554 (TCP) | inbound | Live view stream |

> Install script firewall kurallarını otomatik ekler. Hetzner Cloud Firewall'da manuel açman gerekebilir.

---

## 3. Kurulum (Linux / Ubuntu 20.04)

User Manual Chapter 2.3'e göre:

```bash
# 1) Kurulum klasörü oluştur ve tar.gz'i koy
sudo mkdir -p /opt/hik/DeviceGateway
sudo cp HikDeviceGateway_V1.8.0.4Build20250227_Linux64.tar.gz /opt/hik/DeviceGateway/
cd /opt/hik/DeviceGateway

# 2) Aç
sudo tar -zxvf HikDeviceGateway_V1.8.0.4Build20250227_Linux64.tar.gz -C ./

# 3) install.sh'a permission ver
sudo chmod 777 ./install.sh

# 4) Kur (default port 80, alternatif: --port=8080)
sudo ./install.sh
# veya: sudo ./install.sh --port=8080
```

**Notlar (User Manual + FAQ'dan):**
- root olarak çalıştır.
- `/etc/systemd/system.conf` içinde `DefaultLimitNOFILE=1000000` yapar.
- **SELinux'u devre dışı bırakır** — RHEL/CentOS'ta önemli güvenlik kararı.
- Kurulum yolunda **sadece harf, rakam, `_`, `-`, `.`** olabilir. Aksi takdirde "Installation failed".
- Servis adı: `DeviceGatewayService` (systemd). Status: `systemctl status DeviceGatewayService`.
- Start/stop scriptleri: `/opt/hik/DeviceGateway/start.sh`, `stop.sh`, `status.sh`, `uninstall.sh`.

### İlk Activation

1. Browser → `http://<hetzner-ip>` veya `http://<hetzner-ip>:8080`
2. Admin user için şifre belirle (zayıf şifre uyarısı verebilir — `riskPassword` error code 0x10000002).
3. Configuration → Network Settings → Port → portları doğrula.
4. Configuration → System Settings → **Alarm Forwarding** → enable et (ISUP 5.0 event'leri Convex'e gitmesi için zorunlu).
5. Configuration → Network Settings → Heartbeat Timeout → default 30s × 3 retry (uygun).

### HTTPS (önerilen)

Configuration → Network Settings → HTTPS → self-signed certificate üret veya Let's Encrypt cert import et. Sonra cihazlar gateway'e ulaşırken trust sorunu yaşamasın diye CA root cihaza yüklenebilir (model destekliyorsa).

---

## 4. Cihaz Tarafı Yapılandırması

Cihazın web arayüzünde **Configuration → Network → Advanced Settings → Platform Access** (veya ISUP):

| Alan | Değer |
|---|---|
| Enable | ✅ |
| Platform Access Mode | ISUP / Ehome Platform |
| Server Address Type | IP Address (veya domain) |
| **Server Address** | Hetzner sunucu IP'si |
| **Server Port** | 7661 |
| **Device ID** | Eşsiz string (ngsaccess'te `deviceSerial` ile eşle) |
| Encryption Key | Opsiyonel (varsa gateway'de aynısı tanımlanmalı) |
| Protocol Version | ISUP 5.0 |
| Register Status | "Online" görmelisin |

Register Status "Offline" ise: firewall, IP/port, encryption key, ISUP version doğrulanmalı (FAQ p.2).

---

## 5. Authentication (Tüm API Çağrıları)

**HTTP Digest Authentication** (Chapter 2). Her API request'inde:

```
Authorization: Digest username="admin", realm="DS-GWAS0101(<id>)", nonce="...",
               uri="/ISAPI/...", response="...", qop="auth", nc=00000001, cnonce="..."
```

- `username`: admin (gateway'in activation'ında belirlediğin)
- realm + nonce: gateway 401 response'unda verir, ondan hesaplanır
- Node.js'de `digest-fetch` veya manuel hash hesaplama
- Convex action'dan: `fetch` ile manuel digest, veya bir auth utility yaz

**Sensitive alan şifreleme**: AES128 CBC. Query'de `?security=1&iv=<hex>` → password/key encrypted. Default kapalı; production'da açılması önerilir.

---

## 6. API Endpoint URL Formatı

Genel pattern (Chapter 3.2):

```
{http|https}://{gateway-host}:{port}/ISAPI/{ServiceName}/{ResourceType}/{resource}?format=json&devIndex={uuid}
```

- `ServiceName`: hep `ISAPI`
- `ResourceType`: `System`, `AccessControl`, `ContentMgmt`, `Event`, `Intelligent`, `PTZCtrl` …
- `devIndex`: 32-byte UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) — cihaz eklenirken gateway tarafından üretilir, sonra her cihaza özel request için query'de geçilir

### HTTP Method ve JSON Body

- Method semantiği RESTful: `POST` = add, `PUT` = modify, `DELETE` = delete, `GET` = read
- **Tüm body JSON** (`Content-Type: application/json`) — bazı dosya upload'lar `application/octet-stream`
- Leaf node camelCase, parent node PascalCase
- Time format: **ISO 8601** (`2026-05-16T10:30:00+03:00` veya `Z`)
- Response error: `JSON_ResponseStatus` (Status code + sub status code + error description)

---

## 7. Cihazları Yönetme (Convex'ten Programatic)

> Cihaz ekleme/silme web UI'da elle yapılabilir. **Tercih edilen yöntem ise API**: yeni cihaz onboard'unda Convex action gateway'e POST atar.

### Cihaz Ekle (5.1.1)

```http
POST /ISAPI/ContentMgmt/DeviceMgmt/addDevice?format=json
Authorization: Digest ...
Content-Type: application/json

{
  "DeviceList": [
    {
      "DeviceInfo": {
        "devName": "Merkez Girişi - K1T8003EF",
        "protocolType": "EHOME",            // ISUP 5.0
        "ehomeID": "<deviceID-girilen>",    // cihazdaki Device ID ile aynı
        "ehomeKey": "<encryption-key>",     // opsiyonel
        "devType": "encodeDevice"           // veya "accessControl"
      }
    }
  ]
}
```

**Response**: `JSON_DeviceOutList` içinde `devIndex` (uuid) döner. Bu UUID'yi Convex'te `devices` tablosuna kaydet — sonraki tüm API çağrıları bu `devIndex`'i kullanır.

### Cihaz Listesi (5.1.4)

```http
POST /ISAPI/ContentMgmt/DeviceMgmt/deviceList?format=json
{
  "SearchDescription": {
    "searchID": "0",
    "searchResultPosition": 0,
    "maxResults": 100,
    "EhomeParams": { "ehomeID": "..." }    // veya devIndex
  }
}
```

Response'ta her cihaz için: `devIndex`, `devName`, `devSerial`, `devVersion`, `devStatus` (online/offline), `offlineHint` (sebep).

### Cihaz Sil (5.1.3)

```http
DELETE /ISAPI/ContentMgmt/DeviceMgmt/delDevice?format=json&devIndex=<uuid>
```

### Cihaz Bilgisi / Reboot (5.2.1, 5.2.2)

```http
GET /ISAPI/System/deviceInfo?format=json&devIndex=<uuid>     # cihaz tarafı bilgi
PUT /ISAPI/System/reboot?format=json&devIndex=<uuid>          # cihazı yeniden başlat
```

---

## 8. ⭐ Erişim Kontrol Event Akışı (En Kritik)

ngsaccess'in core değeri burada. Akış:

```
1. Kullanıcı kartı okutur
2. Cihaz event'i ISUP üzerinden gateway'e push eder
3. Gateway "Alarm Forwarding" aktifse Convex'e HTTP POST atar
4. Convex /card-reader endpoint'i body'i parse eder
5. cardReadings tablosuna yazılır, erişim kararı verilir
```

### 8.1 Alarm Forwarding (Direct Mode — Önerilen)

Gateway web UI'dan **Configuration → System Settings → Alarm Forwarding → Enable**. Bunu yaptığında ISUP 5.0 cihazlardan gelen alarm/event Convex URL'ine forward edilir.

Per-device alarm listening setup (5.4.10) API ile:

```http
POST /ISAPI/Event/notification/httpHosts?format=json&devIndex=<uuid>
{
  "HttpHostNotificationList": {
    "HttpHostNotification": [{
      "id": 1,
      "url": "https://<convex-deployment>.convex.site/card-reader",
      "protocolType": "HTTP",
      "parameterFormatType": "JSON",
      "addressingFormatType": "ipaddress",
      "ipAddress": "<convex-ip-or-host>",
      "portNo": 443,
      "httpAuthenticationMethod": "none"
    }]
  }
}
```

### 8.2 Alarm Subscription (Alternative — long-poll mode)

Subscription mode'da gateway tek bir long-poll connection açar, multipart/mixed boundary ile event akıtır (5.5.1). FAQ'ya göre **Direct/Forwarding tercih edilen yöntem**, subscription daha az stabil.

```http
POST /ISAPI/Event/notification/subscribeDeviceMgmt?format=json
{ "SubscribeDeviceMgmt": { "eventMode": "all", "defenceMode": "all" } }
```

Response: `multipart/mixed` stream, her event ayrı JSON. ngsaccess için kullanma — HTTP POST forwarding daha temiz.

### 8.3 Card Swipe Event JSON Şeması (Appendix A.33)

Cihazdan gateway'e, gateway'den Convex'e şu shape gelir:

```json
{
  "EventNotificationAlert": {
    "channelID": "1",
    "dateTime": "2026-05-16T10:30:08+03:00",
    "activePostCount": 1,
    "eventType": "AccessControllerEvent",
    "eventState": "active",
    "eventDescription": "Access Controller Event",
    "devIndex": "2cd6716d-767f-4756-ac55-50276a5e3b4a",
    "channelName": "Merkez Giriş",

    "AccessControllerEvent": {
      "deviceName": "642",
      "majorEventType": 5,              // bkz §8.4 — 5 = Device Event
      "subEventType": 75,               // bkz §8.4 — 75 = Face Authentication Completed
      "netUser": "",
      "remoteHostAddr": "172.6.64.7",
      "cardNo": "12345678",             // kart no
      "cardType": 1,                    // 1=normal, 2=disabled, 3=blocklist, 4=patrol, 5=duress, 6=super, 7=visitor, 8=dismiss
      "name": "Ahmet Yılmaz",
      "employeeNoString": "1001",       // person ID
      "doorNo": 1,
      "verifyNo": 1,
      "cardReaderKind": 1,              // 1=IC, 2=ID, 3=QR, 4=fingerprint
      "cardReaderNo": 0,
      "userType": "normal",             // "normal", "visitor", "blackList", "administrators"
      "currentVerifyMode": "cardOrFace", // bkz §8.5 — uzun enum
      "currentEvent": true,             // real-time ise true
      "frontSerialNo": 122,             // önceki event'in serialNo'su (kayıp tespit için)
      "serialNo": 123,                  // bu event'in serialNo'su
      "attendanceStatus": "checkIn",    // "undefined", "checkIn", "checkOut", "breakOut", "breakIn", "overtimeIn", "overTimeOut"
      "statusValue": 0,
      "mask": "no",                     // maske takılı mı
      "helmet": "no",
      "thermometryUnit": "celsius",
      "currTemperature": 36.5,
      "isAbnomalTemperature": false,
      "pictureURL": "",                 // capture pic varsa URL
      "picturesNumber": 0
    }
  }
}
```

**Picture upload varsa** body multipart/form-data olur:

```
--MIME_boundary
Content-Type: application/json
{ "EventNotificationAlert": { ... } }
--MIME_boundary
Content-Type: image/jpeg
Content-Disposition: form-data; name="Picture"; filename="Picture.jpg"
[binary]
--MIME_boundary--
```

### 8.4 Major / Minor Event Type Kodları (Appendix C — kritik!)

`majorEventType` 4 değer alır:

| majorEventType | Anlam | Önemli minor'lar |
|---|---|---|
| **1** | Device Alarm | 1030=Card Reader Tampering, 1032=Alarm Input, 1034=**Duress Alarm**, 1036=Max Failed Auth |
| **2** | Device Exception | 1024=Power On, 1025=Power Off, 1031=Network Restored, 1033=Card Reader Offline |
| **3** | Device Operation | 1024=Door Remotely Open, 1025=Door Remotely Closed, 1030=Clear All Cards, 1031=Restore Defaults |
| **5** | Device Event | **kart okuma — burası asıl** ↓ |

**majorEventType=5 (Device Event) minor kodları — en sık karşılaşacaklar**:

| Kod | Anlam |
|---|---|
| 1 | Valid Card Authentication Completed (✅ izin verildi) |
| 2 | Card + Password Auth Completed |
| 3 | Card + Password Auth Failed |
| 5 | Card Auth Timed Out |
| 6 | **No Permission** (❌ kart var ama izinsiz) |
| 7 | Invalid Card Swiping Time Period |
| 8 | **Expired Card** |
| 9 | **Card No. Not Exist** (kayıtsız kart) |
| 10 | Anti-passing Back Auth Failed |
| 21 | Door Unlocked |
| 22 | Door Locked |
| 23 | Exit Button Pressed |
| 25 | Door Open (Contact) |
| 26 | Door Closed (Contact) |
| 27 | **Door Abnormally Open** (zorla açıldı) |
| 28 | **Door Open Timed Out** (uzun açık kaldı) |
| 38 | Fingerprint Matched ✅ |
| 39 | Fingerprint Mismatched ❌ |
| 75 | Face Authentication Completed ✅ |
| 76 | Face Authentication Failed ❌ |
| 80 | Face Recognition Failed |
| 104 | Face Anti-Spoofing Detection Failed |
| 113 | Blocklist Event |
| 148 | Password Auth Failed Times Exceeded |

> Tam liste için Appendix C — Major & Minor Types of Access Control Event (pages 273-281). Bu kodları `convex/lib/cardReaderParse.ts` içinde bir mapping table'a koymak gerek.

### 8.5 currentVerifyMode Enum (önemli)

`cardAndPw`, `card`, `cardOrPw`, `fp`, `fpAndPw`, `fpOrCard`, `fpAndCard`, `fpAndCardAndPw`, `faceOrFpOrCardOrPw`, `faceAndFp`, `faceAndPw`, `faceAndCard`, `face`, `employeeNoAndPw`, `fpOrPw`, `employeeNoAndFp`, `employeeNoAndFpAndPw`, `faceAndFpAndCard`, `faceAndPwAndFp`, `employeeNoAndFace`, `faceOrfaceAndCard`, `fpOrface`, `cardOrfaceOrPw`, `cardOrFace`, `cardOrFaceOrFp`, `cardOrFpOrPw`.

### 8.6 Event Loss Detection

Cihaz her event'e artan `serialNo` ve önceki event'in `frontSerialNo`'sunu koyar. ngsaccess tarafı:

```
expectedFront = lastSeenSerialNo
if event.frontSerialNo != expectedFront → event(s) kayıp
```

Eski event'leri 5.4.9 ile sorgula (history).

---

## 9. Person / Card / Face / Fingerprint Yönetimi (Convex → Cihaz Push)

ngsaccess'ten kullanıcı eklendiğinde gateway üzerinden cihaza push edeceğin endpoint'ler. Tümü `&devIndex=<uuid>` ile cihaza yönlendirilir.

### Person (5.4.2)

```http
POST   /ISAPI/AccessControl/UserInfo/Record?format=json&devIndex=<uuid>    # add (max 30 per call)
PUT    /ISAPI/AccessControl/UserInfo/Modify?format=json&devIndex=<uuid>    # update
GET    /ISAPI/AccessControl/UserInfo/Count?format=json&devIndex=<uuid>     # toplam sayı
POST   /ISAPI/AccessControl/UserInfo/Search?format=json&devIndex=<uuid>    # search
GET    /ISAPI/AccessControl/UserInfoDetail/Delete?format=json&devIndex=<uuid>  # async delete başlat
GET    /ISAPI/AccessControl/UserInfoDetail/DeleteProcess?format=json&devIndex=<uuid>  # progress
```

**Add person body** (`JSON_UserInfo`):
```json
{
  "UserInfo": [
    {
      "employeeNo": "1001",
      "name": "Ahmet Yılmaz",
      "userType": "normal",          // "normal", "visitor", "blackList", "administrators"
      "Valid": {
        "enable": true,
        "beginTime": "2026-01-01T00:00:00",
        "endTime": "2027-12-31T23:59:59",
        "timeType": "local"
      },
      "doorRight": "1,2",              // hangi kapılara erişim
      "RightPlan": [{"doorNo": 1, "planTemplateNo": "1"}],
      "maxOpenDoorTime": 0,            // 0 = sınırsız
      "openDoorTime": 0,
      "roomNumber": 0,
      "floorNumber": 0
    }
  ]
}
```

FAQ p.5'ten: Hik Device Gateway API'sinde **olmayan** parametreler için (örn. `localUIRight`, `password`), aynı request body'sine ekle — gateway pass-through eder.

### Card (5.4.3)

```http
POST   /ISAPI/AccessControl/CardInfo/Record?format=json&devIndex=<uuid>    # add
PUT    /ISAPI/AccessControl/CardInfo/Modify?format=json&devIndex=<uuid>    # update
PUT    /ISAPI/AccessControl/CardInfo/Delete?format=json&devIndex=<uuid>    # delete
GET    /ISAPI/AccessControl/CardInfo/Count?format=json&devIndex=<uuid>
POST   /ISAPI/AccessControl/CardInfo/Search?format=json&devIndex=<uuid>
```

**Add card body**:
```json
{
  "CardInfo": [
    {
      "employeeNo": "1001",           // person ID ile bağ
      "cardNo": "12345678",
      "cardType": "normalCard"        // "normalCard", "patrolCard", "hijackCard", "superCard"
    }
  ]
}
```

> **Önemli**: `employeeNo` ve `cardNo` edit edilemez. Değiştirmek için sil + yeniden ekle.

### Face (5.4.4)

```http
POST   /ISAPI/Intelligent/FDLib/FaceDataRecord?format=json&devIndex=<uuid> # JSON + binary jpg
PUT    /ISAPI/Intelligent/FDLib/FDSetUp?format=json&devIndex=<uuid>        # face picture set
PUT    /ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&devIndex=<uuid>
GET    /ISAPI/Intelligent/FDLib/Count?format=json&devIndex=<uuid>
POST   /ISAPI/Intelligent/FDLib/FDSearch?format=json&devIndex=<uuid>
POST   /ISAPI/Intelligent/FDLib/pictureUpload?format=json&devIndex=<uuid>  # bulk import (v1.7+)
```

Face upload binary multipart: JSON body sonrası `--boundary` + image/jpeg.

### Fingerprint (5.4.5)

```http
GET    /ISAPI/AccessControl/CaptureFingerPrint/capabilities?...    # cihaz kapasitesi
POST   /ISAPI/AccessControl/CaptureFingerPrint?...                 # parmak izi topla
POST   /ISAPI/AccessControl/FingerPrintDownload?...                # cihaza apply
GET    /ISAPI/AccessControl/FingerPrintProgress?...                # apply progress (async!)
PUT    /ISAPI/AccessControl/FingerPrint/Delete?...
```

> Person/Face/Fingerprint delete async — `Delete` çağrısı 200 dönse bile silinmiş anlamına gelmez. `DeleteProcess` çağrılarak `status: "success"` veya `"failed"` görülmeli.

---

## 10. Kapı Kontrolü (5.4.6)

### Remote Door Control

```http
PUT /ISAPI/AccessControl/RemoteControl/door/<doorID>?format=json&devIndex=<uuid>
{ "RemoteControlDoor": { "cmd": "open" } }
```

`cmd` enum: `open`, `close`, `alwaysOpen`, `alwaysClose`, `visitorCallLadder`, `householdCallLadder`.

`doorID`: 1-65535 arası, **65535 = tüm kapılar**.

### Door Parametreleri

```http
GET /ISAPI/AccessControl/Door/param/<doorID>?format=json&devIndex=<uuid>
PUT /ISAPI/AccessControl/Door/param/<doorID>?format=json&devIndex=<uuid>
```

### Working Status

```http
GET /ISAPI/AccessControl/AcsWorkStatus?format=json&devIndex=<uuid>
```

Cihaz çalışma durumu — door state, alarm input/output state vs.

---

## 11. Geçmiş Event Arama (5.4.9)

Cihazda saklanan eski erişim event'leri:

```http
POST /ISAPI/AccessControl/AcsEvent?format=json&devIndex=<uuid>
{
  "AcsEventCond": {
    "searchID": "<uuid>",
    "searchResultPosition": 0,
    "maxResults": 30,
    "major": 5,                       // 5 = Device Event
    "minor": 1,                       // 1 = Valid Card Auth
    "startTime": "2026-05-15T00:00:00+03:00",
    "endTime": "2026-05-16T23:59:59+03:00",
    "cardNo": "12345678",             // opsiyonel filter
    "name": "",                       // opsiyonel
    "employeeNoString": "",           // opsiyonel
    "thermometryUnit": "celsius"
  }
}
```

Response `JSON_AcsEvent` paginated — `searchID` aynısıyla tekrar çağırarak ilerlersin.

> Bu, **report/audit** için altın değer. ngsaccess'in PDKS raporları için cihazdan gerçek event'leri çekme yolu.

---

## 12. Convex Tarafında Yapılacaklar

### 12.1 Mevcut `/card-reader` Endpoint

Mevcut [convex/http.ts](convex/http.ts) zaten HTTP POST kabul ediyor. Şu uyumluluklar gerek:

- Body parser **`EventNotificationAlert.AccessControllerEvent`** path'inden okuma
- Field mapping:
  - `cardNo` → `cardReadings.cardNo`
  - `employeeNoString` → `personId`
  - `dateTime` (ISO 8601 with TZ) → `readAt` (Date.now() yerine — saat dilimi farkı için kritik)
  - `devIndex` → `deviceUuid` (devices tablosunda key olarak tut)
  - `majorEventType` + `subEventType` → `eventCode` (rapor için sakla)
  - `currentVerifyMode` → `authMethod`
- Multipart parse (picture varsa) — `picture` ayrı bir file storage'a kaydet

### 12.2 Yeni Convex Action: Gateway'e Komut Push

```ts
// convex/lib/hikGateway.ts
import { createDigestFetch } from "./digestAuth";

const HIK_GATEWAY_URL = process.env.HIK_GATEWAY_URL!;     // https://gateway.hetzner.example
const HIK_USER = process.env.HIK_USER!;                     // admin
const HIK_PASS = process.env.HIK_PASS!;

const digestFetch = createDigestFetch(HIK_USER, HIK_PASS);

export async function addPersonToDevice(
  devIndex: string,
  person: { employeeNo: string; name: string; doorRight: string }
) {
  const res = await digestFetch(
    `${HIK_GATEWAY_URL}/ISAPI/AccessControl/UserInfo/Record?format=json&devIndex=${devIndex}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        UserInfo: [{
          employeeNo: person.employeeNo,
          name: person.name,
          userType: "normal",
          Valid: { enable: true, beginTime: "...", endTime: "...", timeType: "local" },
          doorRight: person.doorRight,
        }]
      })
    }
  );
  return res.json();
}
```

### 12.3 Schema Değişiklikleri

`convex/schema.ts` içine eklenmesi gereken alanlar:

```ts
devices: defineTable({
  // ... mevcut alanlar
  hikDevIndex: v.optional(v.string()),       // gateway UUID
  ehomeID: v.optional(v.string()),           // cihazdaki Device ID
  hikModel: v.optional(v.string()),          // DS-K1T8003EF vb.
  hikLastSeenAt: v.optional(v.number()),     // online check için
  hikOfflineHint: v.optional(v.string()),    // gateway'in verdiği sebep
})

cardReadings: defineTable({
  // ... mevcut alanlar
  hikMajorEventType: v.optional(v.number()),
  hikSubEventType: v.optional(v.number()),
  hikCurrentVerifyMode: v.optional(v.string()),
  hikSerialNo: v.optional(v.number()),       // event loss detection için
  hikFrontSerialNo: v.optional(v.number()),
  hikPictureURL: v.optional(v.string()),
})

// Sync kuyruğu — cihaz offline iken biriken işler
hikPendingOperations: defineTable({
  devIndex: v.string(),
  operation: v.union(v.literal("addPerson"), v.literal("deletePerson"), v.literal("addCard"), v.literal("deleteCard")),
  payload: v.any(),
  createdAt: v.number(),
  attemptCount: v.number(),
  lastError: v.optional(v.string()),
  status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
})
  .index("by_device_status", ["devIndex", "status"])
```

### 12.4 Onboarding Flow

Yeni cihaz eklenirken (UI'dan):
1. Müşteri: cihaz seri no, lokasyon, atanacak kapı yetkileri seçer
2. Convex action: random `ehomeID` + opsiyonel `ehomeKey` üret, gateway'e `addDevice` çağır
3. Response'tan `devIndex` al, `devices` tablosuna yaz
4. Müşteriye `ehomeID` + `ehomeKey`'i göster — cihaz web UI'sına manuel girilecek
5. Cihaz online olunca gateway `deviceList` çağrısında `devStatus: "online"` döner

---

## 13. Eksiklikler / Riskler

- **Closed source**: Kodu yok, custom feature ekleyemezsin. Bug için Hikvision destek.
- **Lisans belirsiz**: Hikvision portalından ücretsiz indirilir ama ticari kullanım lisans şartlarını oku.
- **Bölgesel destek**: Datasheet "service support in country of purchase" diyor. Türkiye'de partner gerekebilir.
- **200 cihaz ISAPI passthrough**: Büyürken multi-gateway gerek.
- **Tek SPOF**: Gateway down = tüm cihazlar offline. HA için 2x gateway + bir front load balancer mı kurarsın yoksa zone bazlı mı bölersin — ileriye saklanacak karar.
- **ARM yok**: Sadece x86_64. Mac (M-series) lokal test imkanı yok — Docker veya remote Linux VM gerek.
- **SELinux disable**: Install script SELinux'u kapatır. Compliance gerekirse manuel policy yazılmalı.
- **Default port 80**: Production'da reverse proxy (nginx/Caddy) arkasına alıp HTTPS + auth proxy önerilir.
- **Encryption key rotation**: Onlarca cihazda zor. Otomasyon (Convex action) gerek.

## 14. PoC Test Planı

1. **Hetzner CX31 (8GB Ubuntu 20.04 x86_64)** kur — €15/ay
2. Gateway tar.gz'i kur (§3), activation tamamla
3. Test ISUP 5.0 cihazı (DS-K1T8003EF mevcut mu?) ISUP ayarını yap, gateway IP'sine işaret et
4. Web UI'dan Device List'te "Online" gör
5. Test API çağrısı (gateway'in API Testing sekmesi):
   - `GET /ISAPI/System/deviceInfo?devIndex=<uuid>` → cihaz bilgisi gelmeli
6. Bir kart okut → web UI'dan event görüldü mü?
7. Alarm Forwarding'i `https://<convex>.convex.site/card-reader`'a yönlendir
8. Tekrar okut → Convex `/card-reader` log'unda event geldi mi?
9. JSON shape'i [convex/lib/cardReaderParse.ts](convex/lib/cardReaderParse.ts) ile uyumlu hale getir
10. Convex action ile cihaza yeni person push et → cihaz web UI'sında user göründü mü?

---

## 15. İlgili Dosyalar

- [docs/HIKVISION_ENTEGRASYON.md](HIKVISION_ENTEGRASYON.md) — Genel Hikvision entegrasyon
- [docs/HIKVISION_ISUP5_ENTEGRASYON.md](HIKVISION_ISUP5_ENTEGRASYON.md) — Eski ISUP planı (artık bu doc'ta tanımlı Device Gateway yaklaşımı tercih edilir)
- [docs/HETZNER_CARD_READER_BRIDGE.md](HETZNER_CARD_READER_BRIDGE.md) — Mevcut ESP32 bridge mimarisi
- [docs/HIKVISION_KISI_SENKRONIZASYONU.md](HIKVISION_KISI_SENKRONIZASYONU.md) — Kişi sync mantığı
- [docs/sdk/](sdk/) — HCNetSDK referansları (Device Gateway kullanıldığında çoğu lüzumsuz)
- [convex/http.ts](../convex/http.ts) — `/card-reader` HTTP endpoint
- [convex/lib/cardReaderParse.ts](../convex/lib/cardReaderParse.ts) — Body parser

### Hikvision PDF'leri (kaynak)

`Downloads/Hik DeviceGateway(V1.8.0.4Build20250227)_Linux64_EN/`:
- `Hik Device Gateway_Datasheet_V1.8.0_20250109.pdf` — 5 sayfa, özellik özet
- `Hik Device Gateway_User Manual_V1.8.0_20250109.PDF` — 22 sayfa, kurulum
- `Hik Device Gateway API_Developer Guide_V1.8.0_20250109.PDF` — **298 sayfa, ana API referans**
- `Hik Device Gateway_FAQ.pdf` — 22 sayfa, sık sorulan hatalar
- `Hik Device Gateway_Release Note_V1.8.0_20250109.PDF` — V1.8.0 yenilikleri

### Code Samples

`Downloads/Hik DeviceGateway(V1.8.0.4Build20250227)_Linux64_EN/Protocol Material/C# Sample/`:
- `AccessControl/` — C# ile UserInfo/Card/Face yönetim örnekleri
- `SubscribeAlarm/` — alarm subscription örneği (gerek yok, HTTP forwarding kullan)
- `Authentication/` — Digest auth implementation referansı
