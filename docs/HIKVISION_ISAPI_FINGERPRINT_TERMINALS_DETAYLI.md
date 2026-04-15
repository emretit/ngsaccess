# Hikvision ISAPI — Parmak İzi Terminalleri (Pro Series)

**NGS Access Entegrasyon Rehberi**

Kaynak: `ISAPI_FingerPrint Terminals_Pro Series.pdf` (267 sayfa, Hikvision resmi dokümantasyonu)
Hedef: Bu dokümanda yer alan API'lerin NGS Access sisteminde hangi dosyalarda, nasıl ve ne ölçüde uygulandığını, hangilerinin eksik olduğunu, her sürecin tam adım-adım akışını tek yerde takip edebilmek.

---

## İçindekiler

1. [Amaç ve Kapsam](#1-amaç-ve-kapsam)
2. [Desteklenen Cihaz Modelleri](#2-desteklenen-cihaz-modelleri)
3. [Mimari — NGS Access Veri Akışı](#3-mimari--ngs-access-veri-akışı)
4. [NGS Access Kod Haritası](#4-ngs-access-kod-haritası)
5. [Terimler ve Temel Kavramlar](#5-terimler-ve-temel-kavramlar)
6. [Authentication (Digest)](#6-authentication-digest)
7. [Cihaz Aktivasyonu](#7-cihaz-aktivasyonu)
8. [Yetenek (Capability) Keşfi](#8-yetenek-capability-keşfi)
9. [Listening Host / HTTP Hosts Yapılandırması](#9-listening-host--http-hosts-yapılandırması)
10. [Event Subscription (SubscribeEvent)](#10-event-subscription-subscribeevent)
11. [AccessControllerEvent Push Payload](#11-accesscontrollerevent-push-payload)
12. [Event Arama (AcsEvent Pull)](#12-event-arama-acsevent-pull)
13. [Kişi (Person) Yönetimi](#13-kişi-person-yönetimi)
14. [Kart (Card) Yönetimi](#14-kart-card-yönetimi)
15. [Parmak İzi (Fingerprint) Yönetimi](#15-parmak-izi-fingerprint-yönetimi)
16. [Yüz Resmi (Face) Yönetimi](#16-yüz-resmi-face-yönetimi)
17. [Hafta Planı / Holiday / Plan Template](#17-hafta-planı--holiday--plan-template)
18. [Grup ve Çok Faktörlü Doğrulama](#18-grup-ve-çok-faktörlü-doğrulama)
19. [Kapı Kontrolü](#19-kapı-kontrolü)
20. [Kart Okuyucu Konfigürasyonu](#20-kart-okuyucu-konfigürasyonu)
21. [Cihaz Genel Ayarları (System)](#21-cihaz-genel-ayarları-system)
22. [Hata Kodları](#22-hata-kodları)
23. [NGS Access — Uyum Matrisi](#23-ngs-access--uyum-matrisi)
24. [Yapılacaklar (Backlog)](#24-yapılacaklar-backlog)

---

## 1. Amaç ve Kapsam

Bu doküman, Hikvision Pro Series parmak izi terminallerinin **ISAPI** (Intelligent Security API, HTTP+REST tabanlı) arayüzünü NGS Access platformuna entegre etmek için kullanılır. ISAPI; kart, parmak izi, yüz tanıma, erişim eventi, kullanıcı yönetimi ve zaman planları dahil **tüm erişim kontrolü** süreçlerini kapsar.

NGS Access tarafında iki ana yön vardır:

- **Cihaz → NGS Access (inbound / push):** Cihaz, kart/parmak izi/yüz okuma eventini NGS Access'e HTTP POST olarak bildirir. NGS Access bu olayı parse edip `cardReadings` tablosuna yazar ve erişim kuralını değerlendirir.
- **NGS Access → Cihaz (outbound / sync):** NGS Access, çalışan kaydı, kart numarası, parmak izi ve zaman planlarını cihaza ISAPI üzerinden yazar (hikvisionSync).

---

## 2. Desteklenen Cihaz Modelleri

PDF Bölüm 2.2 — Pro Series FingerPrint Terminals:

```
DS-K1A802AEF / AEF-B / AF / AF-B / AMF / AMF-B / EF / EF-B / F / F-B / MF / MF-B
DS-K1T501SF
DS-K1T502DBFWX / -C / -CE1 / -E1
DS-K1T6Q-F08EFW / F08MFW
DS-K1T8005EFWX / -B / EFX / MFWX / -B / MFX
DS-K1T804 / 804A / 804ADF / 804AEF / 804AF / 804AMF / 804BEF / 804BF / 804BMF / 804EF / 804F / 804MF
DS-K1T807EBFWX-E1 / -QRE1 / DS-K1T807MBFWX-E1 / -QRE1
DS-K1T808EFWX / -B / EFX / MFWX / -B / MFX
```

NGS Access'te şu an LAN'da test edilen varsayılan cihaz: **DS-K1T807EBFWX-E1** (seed dosyası: [convex/seedHikvisionLanDevice.ts](../convex/seedHikvisionLanDevice.ts)).

---

## 3. Mimari — NGS Access Veri Akışı

```
                  ┌──────────────────────────┐
                  │  Hikvision Pro Series    │
                  │  Parmak İzi Terminali    │
                  │  (DS-K1T807EBFWX-E1)     │
                  └───────────┬──────────────┘
                              │ HTTP POST (JSON/XML/multipart)
                              │ path: /card-reader
                              │ auth: Digest (MD5, qop=auth)
                              ▼
      ┌───────────────────────────────────────────┐
      │  forward-card-reader-to-convex.mjs        │  ← opsiyonel LAN proxy
      │  (cihaz domain çözemediğinde zorunlu)     │
      └───────────┬───────────────────────────────┘
                  │ HTTPS POST
                  ▼
      ┌───────────────────────────────────────────┐
      │  Convex httpAction: /card-reader          │  convex/http.ts
      │   1. body parse (JSON/XML/multipart)      │  convex/lib/cardReaderParse.ts
      │   2. cardNo, serial, deviceIp çıkar       │
      │   3. processCardReading mutation          │  convex/cardReadings.ts
      │   4. device + employee lookup             │
      │   5. accessRules değerlendir              │
      │   6. cardReadings insert                  │
      │   7. geç kalma bildirimi (opsiyonel)      │
      └───────────┬───────────────────────────────┘
                  │ Convex query
                  ▼
      ┌───────────────────────────────────────────┐
      │  Frontend                                 │
      │   src/pages/AccessControl.tsx             │
      │   src/pages/Devices.tsx                   │
      │   src/pages/Employees.tsx                 │
      └───────────────────────────────────────────┘

Ters yönde — sync:

      NGS Access ──► convex/actions/hikvisionSync.ts ──► Hikvision ISAPI
        · UserInfo/Record (kişi)
        · CardInfo (kart)
        · UserRightWeekPlanCfg (hafta planı)
        · FingerPrint/SetUp (parmak izi)  [❌ henüz yok]
```

---

## 4. NGS Access Kod Haritası

Entegrasyona dahil olan dosyalar, ne işe yaradıkları ve hangi ISAPI bölümüne karşılık geldikleri:

| NGS Access dosyası | Rol | Karşılık gelen ISAPI |
|---|---|---|
| [convex/http.ts](../convex/http.ts) | `GET/POST /card-reader` httpAction router | Listening host (PDF 10.2.1) |
| [convex/lib/cardReaderParse.ts](../convex/lib/cardReaderParse.ts) | Cihazdan gelen JSON/XML/multipart gövdeyi `cardNo`, `serialNumber`, `ipAddress`, `dateTime`, `eventType` alanlarına ayrıştırır | AccessControllerEvent parse (PDF 10.3.1.17) |
| [convex/cardReadings.ts](../convex/cardReadings.ts) | `processCardReading` mutation — cihaz ve çalışan lookup, erişim kuralı, kayıt, bildirim | PDF 10.3 Access Control General |
| [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) | `"use node"` action — Digest auth + `POST /UserInfo/Record` (varsa `PUT /UserInfo/Modify` fallback) + `PUT /UserRightWeekPlanCfg/<no>` outbound çağrıları | PDF 7.14 Person Management, 7.17 Hafta Planı |
| [convex/hikvisionSync.ts](../convex/hikvisionSync.ts) | Sync zincirini (employee → groupMembers → accessRules → groupDevices → devices) besleyen internal query/mutation'lar; HTTP çağrısı **içermez** | - |
| [convex/seedHikvisionLanDevice.ts](../convex/seedHikvisionLanDevice.ts) | LAN cihaz kaydı seed | - |
| [convex/schema.ts](../convex/schema.ts) | `devices`, `cardReadings`, `employees`, `accessRules`, `groupMembers`, `groupDevices` tabloları ve indexler | - |
| [scripts/forward-card-reader-to-convex.mjs](../scripts/forward-card-reader-to-convex.mjs) | LAN içinde `/card-reader` alan basit Node HTTP proxy (cihaz → Convex) | - |
| [scripts/setup-hikvision-forward-full.sh](../scripts/setup-hikvision-forward-full.sh) | `PUT /ISAPI/Event/notification/httpHosts/1` ve `SubscribeEvent` çağrılarını otomatize eder | PDF 10.2.1.3 + SubscribeEvent |
| [scripts/verify-hikvision-convex.sh](../scripts/verify-hikvision-convex.sh) | LAN tarafında cihaz-Convex hattını doğrular | - |
| [src/pages/Devices.tsx](../src/pages/Devices.tsx) | Cihaz CRUD UI | - |
| [src/pages/Employees.tsx](../src/pages/Employees.tsx) | Çalışan + `card_number` CRUD UI | - |
| [src/pages/AccessControl.tsx](../src/pages/AccessControl.tsx) | `CardReadings` sekmesi, real-time event tablosu | - |

---

## 5. Terimler ve Temel Kavramlar

| Terim | Açıklama | NGS Access karşılığı |
|---|---|---|
| **ISAPI** | Intelligent Security API — HTTP tabanlı REST protokolü | `hikvisionSync.ts` içindeki fetch çağrıları |
| **Arming** | Client ile cihaz arasında kalıcı bağlantı açıp event almak | Kullanılmıyor — push modelindeyiz |
| **Listening Host** | Cihazın eventleri POST edeceği HTTP sunucusu | Convex `/card-reader` httpAction |
| **Event** | Cihazın ürettiği real-time bildirim | `cardReadings` insert |
| **EmployeeNo / Person ID** | Kişinin ISAPI'deki benzersiz kimliği (max 32 byte) | `employees._id` veya `employeeNo` alanı |
| **Credential** | Kart, parmak izi, yüz, iris gibi tanıma verisi | `employees.cardNumber` (şimdilik yalnızca kart) |
| **Normal / Visitor / Blocklist / Administrator** | `userType` değerleri | `employees` tablosunda ayrı kolon yok, normal varsayılıyor |
| **Card Reader Kind** | 1=IC, 2=ID, 3=QR, 4=Fingerprint module | Event parse edilirken `cardReaderKind` log'da görünür |
| **Major / Minor type** | Olayın ana ve alt tipi (int) | Push body'de `majorEventType`, `subEventType` |
| **Heartbeat** | 10 saniyede bir `eventType:heartBeat` push (cihaz canlılığı) | Parser bu tipi kaydetmiyor, sağlık verisi olarak kullanılabilir |
| **ACS** | Access Control System | - |
| **ARC** | Alarm Receiving Center | Kullanılmıyor |

PDF referansı: Bölüm 2.3.

---

## 6. Authentication (Digest)

Tüm ISAPI çağrıları, cihazın `admin` (veya eşdeğer) hesabıyla **HTTP Digest Authentication** (RFC 7616) kullanır. Desteklenen kullanıcı rolleri:

- **Administrator** — tam yetki.
- **Operator** — canlı görüntüleme, parametre sorgulama, PTZ vb.
- **Viewer** — yalnızca canlı görüntüleme.

NGS Access'teki uygulama: [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) içinde MD5, `qop=auth`, `nonce/cnonce/nc` hesaplamasını kendi elle yapıyor (Convex'te hazır HTTP digest kütüphanesi yok). `"use node"` runtime'ı gerekir çünkü `node:crypto` kullanılır.

Akış:

1. İstemci `GET /ISAPI/...` ister → cihaz `401 Unauthorized` + `WWW-Authenticate: Digest realm=..., nonce=..., qop=auth` döner.
2. İstemci `HA1 = MD5(user:realm:password)`, `HA2 = MD5(method:uri)`, `response = MD5(HA1:nonce:nc:cnonce:qop:HA2)` hesaplar.
3. İstemci aynı isteği `Authorization: Digest username=..., realm=..., nonce=..., uri=..., qop=auth, nc=00000001, cnonce=..., response=...` header'ı ile tekrarlar.

**Şifre kuralı:** 8–16 karakter, en az iki kategori (küçük, büyük, rakam, özel karakter). Aktivasyonda zayıf parola reddedilir.

---

## 7. Cihaz Aktivasyonu

Fabrika ayarındaki cihazın ilk kullanım için parolasının RSA+AES ile şifrelenip gönderilmesi gerekir. PDF Bölüm 3.2.

Akış (özet):

1. İstemci 1024-bit RSA key pair üretir, 128-byte public key modulus'u Base64 ile `POST /ISAPI/Security/challenge` gövdesine koyar.
2. Cihaz, kendi private key ile imzalanmış 32-byte random string döner.
3. İstemci bunu decrypt edip AES-128-ECB (zero padding) key olarak kullanır.
4. Şifreyi `random[0..15] + gercekSifre` formatında AES ile şifreler ve `PUT /ISAPI/System/activate` gönderir.
5. Cihaz decode edip parola kurallarına göre doğrular.

Ek:
- `GET /SDK/activateStatus` aktivasyon durumunu auth istemeden döner.
- **SADP** (multicast discovery) alternatifi: HCSadpSDK.

**NGS Access durumu:** ❌ Uygulanmadı. Şu an cihazlar web arayüzünden manuel aktive ediliyor (DS-K1T807EBFWX-E1 için Hikvision web UI kullanılıyor). İhtiyaç olursa `convex/hikvisionActivate.ts` eklenmeli.

---

## 8. Yetenek (Capability) Keşfi

ISAPI'de hemen her endpoint'in `.../capabilities?format=json` eşleniği vardır. Çağrıdan önce `isSupportXxx` bayraklarına bakılır. Örnekler:

```
GET /ISAPI/AccessControl/capabilities
  → isSupportCardInfo, isSupportFingerPrintCfg, isSupportUserInfo,
    isSupportFaceRecognizeMode, isSupportMultiCardCfg, isSupportGroupCfg,
    isSupportVerifyWeekPlanCfg, isSupportDoorStatusPlan,
    isSupportAntiPassback, isSupportAntiPassbackTimeRange,
    isSupportCaptureCardInfo, isSupportCaptureFingerPrint, ...

GET /ISAPI/AccessControl/CardInfo/capabilities?format=json
  → supportFunction: "get,setUp,post,put,delete"
    maxRecordNum, numberPerPerson, cardLength, ...

GET /ISAPI/AccessControl/FingerPrintCfg/capabilities?format=json
  → isSupportSetUp, maxFingerPrintNum (kişi başı 10), ...

GET /ISAPI/AccessControl/UserInfo/capabilities?format=json
  → supportFunction, EmployeeNoInfo (employeeNo.max, characterType),
    maxRecordNum
```

**NGS Access durumu:** ❌ Şu an capability keşfi yapılmıyor — cihaz yetenekleri varsayılıyor. Çoklu model desteği istendiğinde (`DS-K1A802F` gibi minimal modellerde bazı endpoint'ler yok) bu kontroller eklenmeli.

---

## 9. Listening Host / HTTP Hosts Yapılandırması

Cihazın NGS Access'e event push edebilmesi için, cihaz üzerinde bir listening host tanımlanmalıdır. PDF Bölüm 10.2.1.

### 9.1 Endpoint'ler

| Metod | URI | Açıklama |
|---|---|---|
| `POST` | `/ISAPI/Event/notification/httpHosts?security=&iv=` | Yeni host ekle, ID döner |
| `PUT` | `/ISAPI/Event/notification/httpHosts/<hostID>` | Mevcut host parametrelerini güncelle |
| `GET` | `/ISAPI/Event/notification/httpHosts/<hostID>` | Belirli host'u sorgula |
| `GET` | `/ISAPI/Event/notification/httpHosts` | Tüm host'ları listele |
| `PUT` | `/ISAPI/Event/notification/httpHosts` | Toplu güncelle |
| `DELETE` | `/ISAPI/Event/notification/httpHosts/<hostID>` | Tek host sil |
| `DELETE` | `/ISAPI/Event/notification/httpHosts` | Tüm host'ları sil |
| `GET` | `/ISAPI/Event/notification/httpHosts/capabilities?type=<type>` | Yetenek |

### 9.2 PUT Request Body (host 1, JSON format)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <id>1</id>
  <url>/card-reader</url>
  <protocolType>HTTPS</protocolType>          <!-- HTTP | HTTPS | EHome(ISUP) -->
  <parameterFormatType>JSON</parameterFormatType>  <!-- JSON | XML -->
  <addressingFormatType>hostname</addressingFormatType>  <!-- hostname | ipaddress -->
  <hostName>trusty-dingo-123.convex.site</hostName>
  <portNo>443</portNo>
  <httpAuthenticationMethod>none</httpAuthenticationMethod>
  <!-- httpAuthenticationMethod: MD5digest | none | base64 -->
  <uploadImagesDataType>URL</uploadImagesDataType>
  <httpBroken>true</httpBroken>  <!-- ANR: bağlantı koparsa event'leri tut ve sonra gönder -->
  <SubscribeEvent>
    <heartbeat>30</heartbeat>
    <eventMode>all</eventMode>  <!-- all | list -->
  </SubscribeEvent>
</HttpHostNotification>
```

> **Kritik:** `hostName` kullanıldığında cihaz DNS çözebiliyor olmalı. Hikvision Pro Series cihazlarının birçoğunda DNS servisi devre dışıdır. Pratikte iki çözüm vardır:
> - Cihazda **Network → Advanced → DNS** etkinleştirip geçerli sunucu gir (örn. 1.1.1.1).
> - **DNS çözemiyorsa** `addressingFormatType=ipaddress` ve aynı LAN'da `forward-card-reader-to-convex.mjs` gibi bir köprü çalıştır, `ipAddress` olarak köprü PC'nin IP'sini ver.

NGS Access'te ikinci yaklaşım [scripts/setup-hikvision-forward-full.sh](../scripts/setup-hikvision-forward-full.sh) tarafından otomatize edilmiştir.

### 9.3 Örnek cURL — NGS Access host'unu kur

```bash
HIK_IP=192.168.1.64
HIK_USER=admin
HIK_PASS='P@ssw0rd'

curl --digest -u "$HIK_USER:$HIK_PASS" \
  -X PUT "http://$HIK_IP/ISAPI/Event/notification/httpHosts/1" \
  -H "Content-Type: application/xml" \
  --data-binary @host1.xml
```

Başarı yanıtı: `<ResponseStatus>...<statusCode>0</statusCode><statusString>OK</statusString>...</ResponseStatus>`.

---

## 10. Event Subscription (SubscribeEvent)

Cihazın hangi olayları göndereceğini `SubscribeEvent` node'u ile kısıtlayabilirsiniz. PDF Bölüm 9.x (subscribeEvent).

İki mod:

- `eventMode=all` — tüm eventler. NGS Access bu modu kullanır (kolay, filtreleme NGS tarafında).
- `eventMode=list` — yalnızca `<EventList>` altındaki tipler.

İlgili tipler (kısa liste — tam listesi PDF'te geçer):

```
AccessControllerEvent     ← NGS Access'in ilgilendiği ana tip
heartBeat                 ← cihaz canlılığı
faceCapture
fingerprintMatch          ← bazı modellerde
cardMatch
illaccess                 ← geçersiz erişim
facedetection
attendance                ← yoklama özel kayıt
```

`POST /ISAPI/Event/notification/subscribeEvent` ile doğrudan subscription listesi güncellenebilir. NGS Access şu an `httpHosts/1` içindeki inline `<SubscribeEvent>` node'unu kullanıyor, ayrı `subscribeEvent` çağrısı yapmıyor.

---

## 11. AccessControllerEvent Push Payload

Cihaz, her kart/parmak izi/yüz okuma anında NGS Access'e şu şemada POST gönderir (PDF Bölüm 10.3.1.17).

### 11.1 Üst seviye zarf

```jsonc
{
  "ipAddress": "192.168.1.64",
  "ipv6Address": "1080:0:0:0:8:800:200C:417A",
  "portNo": 80,
  "protocol": "HTTP",
  "macAddress": "01:17:24:45:D9:F4",
  "channelID": 1,
  "dateTime": "2026-04-15T09:17:32+03:00",
  "activePostCount": 1,
  "eventType": "AccessControllerEvent",
  "eventState": "active",               // "active" | "inactive"
  "eventDescription": "AccessControllerEvent",
  "deviceID": "DS-K1T807EBFWX-E1...",  // PUID — ISUP iletiminde zorunlu
  "AccessControllerEvent": { /* aşağıda */ },
  "URLCertificationType": "digest"
}
```

### 11.2 `AccessControllerEvent` nesnesi (kritik alanlar)

| Alan | Tip | NGS Access parse durumu | Açıklama |
|---|---|---|---|
| `deviceName` | string | ❌ | cihaz ekran adı |
| `majorEventType` | int | ❌ | ana event tipi (1=alarm, 3=event, 5=operation, ...) |
| `subEventType` | int | ❌ | alt event tipi (örn. 75 = legal card auth, 76 = invalid card) |
| `inductiveEventType` | enum | ❌ | `authenticated` / `authenticationFailed` / `openingDoor` / ... |
| `cardNo` | string | ✅ | `cardReaderParse.ts` bunu alıyor |
| `cardType` | int | ❌ | 1=normal, 2=disability, 3=blacklist, 4=patrol, 5=duress, 6=super, 7=visitor, 8=dismiss |
| `name` | string | ❌ | kart sahibi adı |
| `cardReaderKind` | int | ⚠️ log'da | 1=IC, 2=ID, 3=QR, **4=Fingerprint module** |
| `cardReaderNo` | int | ❌ | okuyucu No |
| `doorNo` | int | ❌ | kapı No |
| `employeeNo` | int | ❌ | kişi ID (int) |
| `employeeNoString` | string | ❌ | kişi ID (string — tercih edilen) |
| `userType` | enum | ❌ | `normal` / `visitor` / `blacklist` / `administrators` |
| `currentVerifyMode` | enum | ❌ | `card`, `fp`, `face`, `fpAndCard`, `faceAndFp`, ... (tam liste aşağıda) |
| `currTemperature` | float | ❌ | °C cilt sıcaklığı (thermal modeller) |
| `isAbnomalTemperature` | bool | ❌ | anomali bayrağı |
| `mask` | enum | ❌ | `unknown` / `yes` / `no` |
| `attendanceStatus` | enum | ❌ | `checkIn` / `checkOut` / `breakOut` / `breakIn` / `overtimeIn` / `overTimeOut` |
| `pictureURL` | string | ❌ | yakalanan foto URL |
| `unlockType` | enum | ❌ | `password` / `card` / `face` / `fingerprint` / `qrcode` / ... |
| `frontSerialNo` / `serialNo` | int | ❌ | event numarası — event kaybı tespitinde kullanılır |
| `FaceRect` | object | ❌ | yüz bounding box (0..1 normalize) |
| `HealthInfo` | object | ❌ | sağlık kodu, PCR, aşı durumu (covid özelliği) |
| `PersonInfoExtends` | array | ❌ | ek kişi alanları |
| `QRCodeInfo` | string | ❌ | QR kod içeriği |
| `helmet` | enum | ❌ | baret tespiti |

### 11.3 `currentVerifyMode` tam listesi

```
card, cardAndPw, cardOrPw,
fp, fpAndPw, fpOrCard, fpAndCard, fpAndCardAndPw,
face, faceAndFp, faceAndPw, faceAndCard,
faceOrFpOrCardOrPw, faceAndFpAndCard, faceAndPwAndFp,
employeeNoAndPw, employeeNoAndFp, employeeNoAndFpAndPw, employeeNoAndFace,
faceOrfaceAndCard, fpOrface, fpOrPw, cardOrfaceOrPw, cardOrFpOrPw,
iris, faceOrFpOrCardOrPwOrIris, faceOrCardOrPwOrIris
```

### 11.4 Multipart gövde

Bazı modeller, yakalanan yüz fotoğrafıyla beraber multipart/form-data gönderir:

```
Content-Type: multipart/form-data; boundary=MIME_boundary

--MIME_boundary
Content-Disposition: form-data; name="AccessControllerEvent"
Content-Type: application/json

{ ...AccessControllerEvent JSON... }
--MIME_boundary
Content-Disposition: form-data; name="Picture"; filename="capture.jpg"
Content-Type: image/jpeg

<binary JPEG>
--MIME_boundary--
```

NGS Access `cardReaderParse.ts` multipart desteğine sahip ama **yalnızca JSON parçasını** okuyor; binary foto atılıyor. Foto arşivi istenirse bu parça Convex File Storage'a yazılabilir.

### 11.5 Heartbeat

```json
{
  "ipAddress": "192.168.1.64",
  "dateTime": "2026-04-15T09:17:32+03:00",
  "eventType": "heartBeat",
  "eventState": "active"
}
```

Varsayılan 30 sn. NGS Access'te ignore ediliyor ama `devices.lastSeenAt` güncellemek için kullanılmalı (önerilir).

---

## 12. Event Arama (AcsEvent Pull)

Push yerine sorgulama: cihazda geçmiş eventleri aramak. PDF Bölüm 10.3.1.1–10.3.1.2.

### 12.1 Yetenek sorgusu

```
GET /ISAPI/AccessControl/AcsEvent/capabilities?format=json
```

Dönen alanlar: arama kriterlerinin limitleri (`searchID`, `maxResults`, `major.@opt`, `minor*.@opt`, `startTime`, `cardNo`, `employeeNoString`, ...).

### 12.2 Arama isteği

```
POST /ISAPI/AccessControl/AcsEvent?format=json
```

```json
{
  "AcsEventCond": {
    "searchID": "ngsaccess-2026-04-15-001",
    "searchResultPosition": 0,
    "maxResults": 30,
    "major": 0,
    "minor": 0,
    "startTime": "2026-04-15T00:00:00+03:00",
    "endTime":   "2026-04-15T23:59:59+03:00",
    "cardNo": "",
    "employeeNoString": "",
    "picEnable": true,
    "timeReverseOrder": true,
    "isAttendanceInfo": false,
    "hasRecordInfo": true
  }
}
```

Yanıt:

```json
{
  "AcsEvent": {
    "searchID": "ngsaccess-2026-04-15-001",
    "responseStatusStrg": "OK",
    "numOfMatches": 1,
    "totalMatches": 127,
    "InfoList": [
      {
        "major": 5, "minor": 75,
        "time": "2026-04-15T09:17:32+03:00",
        "cardNo": "0012345678",
        "cardType": 1,
        "cardReaderKind": 4,
        "cardReaderNo": 1,
        "doorNo": 1,
        "employeeNoString": "EMP-142",
        "userType": "normal",
        "currentVerifyMode": "fpOrCard",
        "attendanceStatus": "checkIn",
        "pictureURL": "https://192.168.1.64/pic/....jpg"
      }
    ]
  }
}
```

> **Sayfalama:** Aynı `searchID` ile `searchResultPosition`'ı arttırarak devam edilir. `totalMatches` aşılana kadar sürdürülebilir.

**NGS Access durumu:** ❌ Şu an pull modeli kullanılmıyor (push yeterli). Ağ kopunca geçmiş olayları geri almak için ileride eklenebilir (ANR zaten `httpBroken=true` ile kısmen halledildi).

---

## 13. Kişi (Person) Yönetimi

PDF Bölüm 7.14. Kişi, ISAPI'de `employeeNo` (Person ID) ile tanımlanır — kart, parmak izi ve yüz bu ID üzerine **credential** olarak bağlanır.

### 13.1 Endpoint seti

| Metod | URI | Amaç |
|---|---|---|
| `GET` | `/ISAPI/AccessControl/UserInfo/capabilities?format=json` | destek keşfi (`supportFunction`) |
| `GET` | `/ISAPI/AccessControl/UserInfo/Count?format=json` | kayıt sayısı |
| `POST` | `/ISAPI/AccessControl/UserInfo/Search?format=json` | sayfalı arama |
| `PUT` | `/ISAPI/AccessControl/UserInfo/SetUp?format=json` | upsert (**NGS kullanımı**) |
| `POST` | `/ISAPI/AccessControl/UserInfo/Record?format=json` | ekle (varsa hata) |
| `PUT` | `/ISAPI/AccessControl/UserInfo/Modify?format=json` | güncelle (yoksa hata) |
| `PUT` | `/ISAPI/AccessControl/UserInfoDetail/Delete?format=json` | silme başlat |
| `GET` | `/ISAPI/AccessControl/UserInfoDetail/DeleteProcess` | silme ilerleme |

### 13.2 `UserInfo/Record` request şeması

```json
{
  "UserInfo": {
    "employeeNo": "EMP-142",
    "name": "Emre Aydın",
    "userType": "normal",
    "gender": "male",
    "localUIRight": false,
    "maxOpenDoorTime": 0,
    "Valid": {
      "enable": true,
      "beginTime": "2025-01-01T00:00:00",
      "endTime":   "2035-01-01T00:00:00",
      "timeType":  "local"
    },
    "doorRight": "1",
    "RightPlan": [
      { "doorNo": 1, "planTemplateNo": "1" }
    ],
    "belongGroup": "",          // grup ID listesi (virgüllü)
    "password": "",
    "numOfCard": 0,
    "numOfFP": 0,
    "numOfFace": 0,
    "PersonInfoExtends": []
  }
}
```

**NGS Access uygulaması:** [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) `syncPersonToDevice` fonksiyonu `POST /UserInfo/Record` çağırır; `employees` tablosundaki `firstName`, `lastName`, `cardNumber` gönderir, `Valid` 2025-01-01 → 2035-12-31. `subStatusCode === "deviceUserAlreadyExist"` dönerse aynı gövdeyle `PUT /UserInfo/Modify` ile fallback yapar.

### 13.3 Silme akışı (asenkron)

Silme uzun sürebilir (binlerce kişi varsa), bu yüzden async:

1. `PUT /UserInfoDetail/Delete` → job başlat.
2. `GET /UserInfoDetail/DeleteProcess` → `status: "processing"|"finished"`, `progress: 0..100`.
3. Bitene kadar (veya timeout) polling.

NGS Access bu akışı henüz implemente etmedi.

---

## 14. Kart (Card) Yönetimi

PDF Bölüm 7.5. Kart, **önce kişinin eklenmiş olması** koşuluyla eklenir (credential kuralı). Kişi başı varsayılan max 5 kart, capability'de `numberPerPerson` alanı belirtir. `255` = sınırsız.

### 14.1 Endpoint seti

| Metod | URI | Amaç |
|---|---|---|
| `GET` | `/ISAPI/AccessControl/CardInfo/capabilities?format=json` | destek |
| `GET` | `/ISAPI/AccessControl/CardInfo/Count?format=json` | toplam / `employeeNo`'ya göre |
| `POST` | `/ISAPI/AccessControl/CardInfo/Search?format=json` | arama (sayfalı) |
| `PUT` | `/ISAPI/AccessControl/CardInfo/SetUp?format=json` | upsert |
| `POST` | `/ISAPI/AccessControl/CardInfo/Record?format=json` | ekle |
| `PUT` | `/ISAPI/AccessControl/CardInfo/Modify?format=json` | güncelle |
| `PUT` | `/ISAPI/AccessControl/CardInfo/Delete?format=json` | sil |
| `GET` | `/ISAPI/AccessControl/CaptureCardInfo?format=json` | okuyucudan anlık kart oku |
| `GET/PUT` | `/ISAPI/AccessControl/CardVerificationRule?format=json` | farklı uzunluktaki kartlar |

### 14.2 `CardInfo/SetUp` şeması (özet)

```json
{
  "CardInfo": {
    "employeeNo": "EMP-142",
    "cardNo": "0012345678",
    "cardType": "normalCard",
    "leaderCard": "",
    "checkCardNo": "",
    "addCardNo": "",
    "cardValid": true,
    "deleteCardNo": ""
  }
}
```

**`cardType` enum:** `normalCard` / `patrolCard` / `duressCard` / `superCard` / `dismissCard` / `blockList` / `visitorCard`.

**NGS Access durumu:** Kart numarası, kişi eklenirken aynı çağrıda (`UserInfo.Valid`, `RightPlan`) gönderiliyor. Ayrı `CardInfo/Record` çağrısı henüz yok — tek kişi-tek kart senaryosunda yeterli. Çoklu kart için eklenmeli.

### 14.3 Kart okuma — `CaptureCardInfo`

Okuyucu önüne tutulan kartın anlık yakalanması (enrollment ekranı için):

```
GET /ISAPI/AccessControl/CaptureCardInfo?format=json
```

Dönüş `{CardInfo: {cardNo, cardType}}`. Kullanıcı cihaz önünde kartı okuttuktan sonra dönüş gelir (ya timeout). **Frontend personel kayıt ekranında** "Kart oku" butonu için ideal.

---

## 15. Parmak İzi (Fingerprint) Yönetimi

PDF Bölüm 7.10. Kişi başı **maksimum 10 parmak izi**. Kart gibi, kişinin önceden eklenmiş olması gerek.

### 15.1 Endpoint seti

| Metod | URI | Amaç |
|---|---|---|
| `GET` | `/ISAPI/AccessControl/FingerPrintCfg/capabilities?format=json` | destek |
| `GET` | `/ISAPI/AccessControl/FingerPrint/Count?format=json` | sayı (opsiyonel `employeeNo`) |
| `POST` | `/ISAPI/AccessControl/FingerPrintUpload?format=json` | **arama** (upload kelimesi kafa karıştırıcı ama bu arama) |
| `POST` | `/ISAPI/AccessControl/FingerPrint/SetUp?format=json` | upsert (template ile) |
| `POST` | `/ISAPI/AccessControl/FingerPrintDownload?format=json` | **ekleme** (async, progress ile takip) |
| `GET` | `/ISAPI/AccessControl/FingerPrintProgress?format=json` | ekleme ilerleme |
| `POST` | `/ISAPI/AccessControl/FingerPrintModify?format=json` | parametre güncelle (data değişmez) |
| `PUT` | `/ISAPI/AccessControl/FingerPrint/Delete?format=json` | silme (async) |
| `GET` | `/ISAPI/AccessControl/FingerPrint/DeleteProcess?format=json` | silme ilerleme |
| `POST` | `/ISAPI/AccessControl/CaptureFingerPrint` | okuyucudan anlık parmak izi al |

### 15.2 `FingerPrint/SetUp` şeması (özet)

```json
{
  "FingerPrintCfg": {
    "employeeNo": "EMP-142",
    "enableCardReader": [1],
    "fingerPrintID": 1,                 // 1..10
    "fingerType": "normalFP",           // normalFP | duressFP | patrolFP | superFP
    "fingerData": "<base64 template>",  // cihaza özel binary template
    "leaderFP": false
  }
}
```

> **Template formatı cihaza özeldir.** Bir cihazdan enroll edilip aynı/eş modele yazılabilir, farklı markaya taşınamaz. Enrollment için `CaptureFingerPrint` + `FingerPrintDownload` flow'u kullanılmalı:
>
> 1. Kullanıcıyı cihaz başına çağır, `POST /CaptureFingerPrint` çağır → cihaz 10–30 sn sensörden örnek alır, response'ta `fingerData` döner.
> 2. `POST /FingerPrintDownload` ile bu `fingerData`'yı `employeeNo` ile eşleştirip cihaza yaz.
> 3. `GET /FingerPrintProgress?format=json` ile `progress=100` olana kadar polling.

### 15.3 `FingerPrintUpload` — arama

İsminden bağımsız, bu **sorgu** endpointidir. İstek body'si `FingerPrintCond` (employeeNo + sayfalama), yanıt `FingerPrintInfo` array'i. `status: "NoFP"` gelirse sayfa boş.

**NGS Access durumu:** ❌ **Parmak izi senkronizasyonu henüz uygulanmadı.** Şu an NGS Access yalnızca **kart** üzerinden çalışıyor; parmak izi okumaları cihazda lokal kalmış olarak NGS tarafında **olay parser'ına** geliyor (`cardReaderKind=4` olarak push'ta) ama kişi-parmak izi eşleşmesi NGS'te değil cihazda yapılıyor. Çözüm:

- `convex/actions/hikvisionSync.ts` içine `enrollFingerprint(employeeId, deviceId)` action'u ekle.
- Frontend: personel detayında "Parmak izi ekle" butonu → kullanıcı cihazın başında → Convex action → `CaptureFingerPrint` → `FingerPrintDownload` → polling.
- `employees.hasFingerprint: boolean` kolonu eklenerek UI'da işaretlenebilir.

Detay için bkz. [Bölüm 24 — Yapılacaklar](#24-yapılacaklar-backlog).

---

## 16. Yüz Resmi (Face) Yönetimi

PDF Bölüm 7.9 (face picture) ve 7.11 (iris). Fingerprint terminallerin büyük çoğunluğunda yüz de desteklenir (DS-K1T807, DS-K1T502, DS-K1T8005 serileri).

### 16.1 Endpoint seti (özet)

| Metod | URI | Amaç |
|---|---|---|
| `GET` | `/ISAPI/Intelligent/FDLib/FDSearch/capabilities?format=json` | destek |
| `POST` | `/ISAPI/Intelligent/FDLib/FDSearch?format=json` | yüz ara |
| `POST` | `/ISAPI/Intelligent/FDLib/pictureUpload` | kişiye yüz fotoğrafı ata (multipart JPEG) |
| `PUT` | `/ISAPI/Intelligent/FDLib/pictureUpload` | değiştir |
| `DELETE` | `/ISAPI/Intelligent/FDLib?format=json` | sil |
| `POST` | `/ISAPI/AccessControl/CaptureFace?format=json` | cihazdan anlık yakala |

`pictureUpload` multipart body'si:

```
------ngsboundary
Content-Disposition: form-data; name="FaceDataRecord"
Content-Type: application/json

{
  "faceLibType": "blackFD",
  "FDID": "1",
  "FPID": "EMP-142"
}
------ngsboundary
Content-Disposition: form-data; name="FaceImage"; filename="emp-142.jpg"
Content-Type: image/jpeg

<binary JPEG>
------ngsboundary--
```

**NGS Access durumu:** ❌ Uygulanmadı. Parmak izi ile aynı backlog'da ele alınacak.

---

## 17. Hafta Planı / Holiday / Plan Template

Kişinin hangi gün-saat aralığında hangi kapıdan geçebileceğini tanımlar. İki paralel şema vardır:

- **UserRight...** (kişi → kapı izin planı)
- **DoorStatus...** (kapı → açık/kapalı statü planı)
- **Verify...** (kart okuyucu → kimlik doğrulama modu planı)

### 17.1 UserRight seti

| Metod | URI | Amaç |
|---|---|---|
| `GET/PUT` | `/ISAPI/AccessControl/UserRightWeekPlanCfg/<weekPlanID>?format=json` | Haftalık plan (1..N) |
| `GET/PUT` | `/ISAPI/AccessControl/UserRightHolidayPlanCfg/<holidayPlanID>?format=json` | Tatil planı |
| `GET/PUT` | `/ISAPI/AccessControl/UserRightHolidayGroupCfg/<holidayGroupID>?format=json` | Tatil grubu |
| `GET/PUT` | `/ISAPI/AccessControl/UserRightPlanTemplate/<planTemplateID>?format=json` | Haftalık + tatil gruplarını birleştiren template |
| `PUT` | `/ISAPI/AccessControl/UserRightWeekPlanCfg/...capabilities` | limitler |

### 17.2 `UserRightWeekPlanCfg` şeması

```json
{
  "UserRightWeekPlanCfg": {
    "enable": true,
    "WeekPlanCfg": [
      { "week": 1, "id": 1, "enable": true, "TimeSegment": { "beginTime": "08:00:00", "endTime": "18:00:00" } },
      { "week": 2, "id": 1, "enable": true, "TimeSegment": { "beginTime": "08:00:00", "endTime": "18:00:00" } },
      { "week": 3, "id": 1, "enable": true, "TimeSegment": { "beginTime": "08:00:00", "endTime": "18:00:00" } },
      { "week": 4, "id": 1, "enable": true, "TimeSegment": { "beginTime": "08:00:00", "endTime": "18:00:00" } },
      { "week": 5, "id": 1, "enable": true, "TimeSegment": { "beginTime": "08:00:00", "endTime": "18:00:00" } },
      { "week": 6, "id": 1, "enable": false, "TimeSegment": { "beginTime": "00:00:00", "endTime": "00:00:00" } },
      { "week": 7, "id": 1, "enable": false, "TimeSegment": { "beginTime": "00:00:00", "endTime": "00:00:00" } }
    ]
  }
}
```

- `week`: 1=Pazartesi … 7=Pazar
- Her gün için **8'e kadar** segment (`id`: 1..8)
- NGS Access şu an tek segmentlik basit plan yazıyor.

### 17.3 NGS Access eşlemesi

[convex/schema.ts](../convex/schema.ts):

```ts
accessRules: {
  name, startTime, endTime, days[],
  hikWeekPlanNo: number     // UserRightWeekPlanCfg weekPlanID
}
```

[convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) içindeki `syncWeekPlanToDevice` bu yapıyı Hikvision'ın şemasına çevirip `PUT /UserRightWeekPlanCfg/<weekPlanNo>` eder; gün seti kuralda yoksa `enable: false`, `00:00:00` — `00:00:00` gönderir.

**Eksik:** holiday plan, plan template, aynı gün içinde birden fazla segment.

### 17.4 DoorStatus ve Verify

- `DoorStatusPlan/<doorID>` — kapının `remainOpen/remainClosed/sleep/normal` statülerinin haftalık planlanması.
- `VerifyWeekPlanCfg/<weekPlanID>` — belirli zaman aralıklarında farklı doğrulama modlarına geçmek için (sabah kart+parmak, akşam yalnız kart gibi).

NGS Access henüz kullanmıyor.

---

## 18. Grup ve Çok Faktörlü Doğrulama

PDF Bölüm 7.12.

- **Grup:** Aynı doğrulama kuralına tabi olan kişiler kümesi. Bir kişi **en fazla 4 grupta** olabilir.
- `GroupCfg/<groupID>` — grup parametreleri.
- `ClearGroupCfg` — tüm grupları sil.
- `MultiCardCfg/<doorID>` — bir kapı için çoklu grup sırası ile doğrulama (örn. önce yönetici grubu, sonra normal grup).

Bir kişi hangi gruba ait olacaksa `UserInfo/Record` / `SetUp` çağrısında `belongGroup` alanı ile yazılır.

**NGS Access eşlemesi:** `groupMembers` (çalışan↔grup) ve `groupDevices` (grup↔cihaz) tabloları zaten var ama Hikvision grup senkronizasyonu henüz yapılmıyor — yerel erişim kuralı değerlendirmesi yapıyoruz (NGS backend içinde).

---

## 19. Kapı Kontrolü

PDF Bölüm 7.7 + `/ISAPI/AccessControl/Door`.

- `GET/PUT /ISAPI/AccessControl/Door/param/<doorID>` — kapı açma süresi, kilidi zorlama, alarm giriş/çıkış, sensör.
- `GET /ISAPI/AccessControl/Door/param/<doorID>/capabilities` — limitler.
- Uzaktan açma komutu: `PUT /ISAPI/AccessControl/RemoteControl/door/<doorID>` (bazı cihazlarda `/ISAPI/System/Device/remoteControl`).

**NGS Access durumu:** ❌ Uzaktan kapı açma UI'ı yok. İleride `AccessControl.tsx` içine "Kapıyı aç" butonu eklenirken bu endpoint kullanılmalı.

---

## 20. Kart Okuyucu Konfigürasyonu

`GET/PUT /ISAPI/AccessControl/CardReaderCfg/<cardReaderID>?format=json` — her okuyucu için:

- `cardReaderFunction`: "in" / "out"
- `okLedPolarity`, `errorLedPolarity`, `buzzerPolarity`
- `swipeInterval`, `pressTimeout`
- `fingerPrintCapacity`, `fingerPrintNum` (mevcut)
- `cardReaderType`, `cardReaderDescription`
- `defaultVerifyMode`, `fingerPrintCheckLevel`

`CardReaderPlan/<cardReaderID>` — okuyucuya zaman tabanlı farklı mod planı.

NGS Access bu endpoint'leri **salt-okunur** olarak cihaz özet sayfasında gösterebilir — PUT kullanmıyor.

---

## 21. Cihaz Genel Ayarları (System)

Fingerprint terminal entegrasyonunda sık kullanılan sistem endpoint'leri:

| Metod | URI | Amaç |
|---|---|---|
| `GET` | `/ISAPI/System/deviceInfo` | model, seri no, firmware versiyonu |
| `GET` | `/ISAPI/System/capabilities?type=all` | genel yetenek |
| `GET/PUT` | `/ISAPI/System/time` | saat |
| `GET/PUT` | `/ISAPI/System/time/localTime` | manuel saat ayarı |
| `GET/PUT` | `/ISAPI/System/time/ntpServers` | NTP |
| `GET/PUT` | `/ISAPI/System/time/timeZone` | zaman dilimi (TZ string) |
| `GET` | `/ISAPI/System/Network/capabilities` | ağ yeteneği |
| `PUT` | `/ISAPI/System/Network/ssh` | SSH aç/kapa (debug) |
| `PUT` | `/ISAPI/System/reboot` | cihaz yeniden başlat |
| `POST` | `/ISAPI/System/updateFirmware` | firmware güncelleme |
| `GET` | `/ISAPI/System/upgradeStatus?format=json` | güncelleme durumu |
| `GET` | `/ISAPI/System/DeviceLanguage` | dil |

**NGS Access'te:** [src/pages/Devices.tsx](../src/pages/Devices.tsx) cihaz detayında `deviceInfo` sonucu (model, firmware) gösterilebilir — şu an gösterilmiyor, TODO.

---

## 22. Hata Kodları

### 22.1 HTTP status

Standart — RFC 2616 (200, 401, 403, 404, 500, ...).

### 22.2 ISAPI XML / JSON ResponseStatus

Her yazma çağrısı `ResponseStatus` içeren XML/JSON döner:

```json
{
  "statusCode": 0,
  "statusString": "OK",
  "subStatusCode": "OK",
  "description": "",
  "MErrCode": "0x00000000"
}
```

**statusCode:**
- `0` / `1` — OK
- `2` — Device Busy
- `3` — Device Error
- `4` — Invalid Operation
- `5` — Invalid XML Format
- `6` — Invalid XML Content
- `7` — Reboot Required

`subStatusCode` tipik değerleri: `riskPassword`, `invalidUser`, `employeeNoAlreadyExist`, `cardAlreadyExist`, `noFP`, `fpQualityLow`, `deviceOffline`, `lowMemory`, `incompleteFP`, ...

NGS Access [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) yalnızca `subStatusCode === "deviceUserAlreadyExist"` durumunda Modify fallback yapıyor, geri kalan `subStatusCode` değerlerini ham olarak error string'e koyuyor. Kullanıcıya daha iyi Türkçe hata mesajı gösterilebilir (TODO).

---

## 23. NGS Access — Uyum Matrisi

Özet tablo. ✅ = tam, ⚠️ = kısmi, ❌ = yok.

| ISAPI Bölümü | NGS Access Durum | Dosya |
|---|---|---|
| **Aktivasyon** (Security/challenge + System/activate) | ❌ | – |
| **Digest Auth** | ✅ | [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) |
| **Capability keşfi** | ❌ | – |
| **HttpHosts PUT** | ✅ script ile | [scripts/setup-hikvision-forward-full.sh](../scripts/setup-hikvision-forward-full.sh) |
| **SubscribeEvent (inline)** | ✅ | yukarıdaki script |
| **AccessControllerEvent push — parse** | ⚠️ (yalnızca `cardNo`, `serialNumber`, `ipAddress`, `dateTime`) | [convex/lib/cardReaderParse.ts](../convex/lib/cardReaderParse.ts) |
| **AccessControllerEvent — tüm alanlar** | ❌ (employee adı, userType, major/minor, cardReaderKind, verifyMode, temperature, mask) | – |
| **Heartbeat → lastSeenAt** | ❌ | – |
| **Multipart — yüz fotoğrafı binary** | ❌ (atılıyor) | – |
| **AcsEvent pull (arama)** | ❌ | – |
| **UserInfo Record/SetUp** (kişi sync) | ✅ | [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) |
| **UserInfo Search / Count** | ❌ | – |
| **UserInfoDetail Delete + polling** | ❌ | – |
| **CardInfo Record/SetUp** (ayrı çağrı) | ⚠️ (UserInfo içinde implicit) | – |
| **CardInfo Delete** | ❌ | – |
| **CaptureCardInfo (anlık)** | ❌ | – |
| **FingerPrint SetUp / Download / Progress** | ❌ | – |
| **FingerPrint Upload (search)** | ❌ | – |
| **CaptureFingerPrint (enrollment)** | ❌ | – |
| **FDLib pictureUpload (yüz)** | ❌ | – |
| **UserRightWeekPlanCfg** | ⚠️ (tek segment) | [convex/actions/hikvisionSync.ts](../convex/actions/hikvisionSync.ts) |
| **UserRightHoliday*** | ❌ | – |
| **UserRightPlanTemplate** | ❌ | – |
| **DoorStatusPlan / Template / Week** | ❌ | – |
| **GroupCfg / MultiCardCfg** | ❌ (grup NGS içinde yerel) | – |
| **Door param + RemoteControl** | ❌ | – |
| **CardReaderCfg** | ❌ (salt-okunur görüntüleme ileride) | – |
| **System/deviceInfo, time, reboot, firmware** | ❌ | – |
| **M1CardEncryptCfg, WiegandCfg, NFCCfg, RFCardCfg** | ❌ | – |
| **AntiPassback + timeRange** | ❌ | – |
| **Iris / Face recognition capabilities** | ❌ | – |
| **Frontend — CardReadings list** | ✅ | [src/pages/AccessControl.tsx](../src/pages/AccessControl.tsx) |
| **Frontend — Device CRUD** | ✅ | [src/pages/Devices.tsx](../src/pages/Devices.tsx) |
| **Frontend — Employee + cardNumber** | ✅ | [src/pages/Employees.tsx](../src/pages/Employees.tsx) |

---

## 24. Yapılacaklar (Backlog)

Eksik parçaların NGS Access'e eklenmesi için **öncelik sırasına** göre backlog. Her madde bir görevdir.

### 24.1 Yüksek öncelik

1. **AccessControllerEvent tam parse.**
   Dosya: [convex/lib/cardReaderParse.ts](../convex/lib/cardReaderParse.ts)
   Eklenecek alanlar: `majorEventType`, `subEventType`, `cardReaderKind`, `cardReaderNo`, `doorNo`, `employeeNoString`, `userType`, `currentVerifyMode`, `name`, `pictureURL`, `attendanceStatus`. `cardReadings` schema'sına bu alanlar eklenmeli.
2. **Heartbeat → `devices.lastSeenAt`.**
   `eventType === "heartBeat"` ise `cardReadings` insert etme, `devices` tablosundaki cihazın `lastSeenAt`'ini şimdiki zamana eşitle. UI'da "online/offline" badge.
3. **Multipart binary picture kaydı.**
   Convex File Storage'a binary JPEG yaz, URL'i `cardReadings.pictureUrl` alanına yaz. Bu, "bu kart şu anda bu yüzle geçti" audit için kritik.
4. **`subStatusCode` → Türkçe hata mesajı.**
   `hikvisionSync.ts` içinde map: `riskPassword → "Parola yeterince güçlü değil"`, `employeeNoAlreadyExist → "Bu personel zaten cihazda kayıtlı"` vs.

### 24.2 Orta öncelik (parmak izi + yüz)

5. **Parmak izi enrollment akışı.**
   Yeni dosya: `convex/hikvisionFingerprint.ts`.
   - `enrollFingerprintStart(employeeId, deviceId)` — `POST /CaptureFingerPrint` (cihaz 10–30 sn örnek alır).
   - `enrollFingerprintFinish(employeeId, fingerData)` — `POST /FingerPrintDownload`.
   - `enrollFingerprintStatus()` — `GET /FingerPrintProgress` polling.
   - `deleteFingerprint(employeeId, fingerPrintID)` — `PUT /FingerPrint/Delete`.
   Schema: `employees.fingerprintCount: number`, `employees.fingerprintLastSyncAt: string`.
   Frontend: `src/pages/Employees.tsx` detay drawer'ına "Parmak izi yönet" butonu.
6. **Yüz fotoğrafı senkronizasyonu.**
   `convex/hikvisionFace.ts` — `POST /Intelligent/FDLib/pictureUpload` multipart ile.
   Frontend: personelin mevcut fotoğrafını (Convex Storage) cihaza push etme aksiyonu.
7. **CaptureCardInfo ile kart okuma butonu.**
   Personel kayıt ekranına "Cihazdan kart oku" butonu — `GET /CaptureCardInfo` çağırır, dönen `cardNo`'yu form'a basar.

### 24.3 Düşük öncelik

8. **UserRightPlanTemplate + HolidayGroup** desteği — tatil günlerinde farklı izin.
9. **AcsEvent pull** (periyodik, geçmiş event ANR yedeği).
10. **GroupCfg** senkronizasyonu — NGS grupları cihaza taşı.
11. **DoorStatusPlan** — kapı "mesai saatleri dışında kilitli" planları.
12. **RemoteControl door open** — NGS UI'dan uzaktan kapı açma.
13. **Capability keşfi** — çoklu model desteği için pre-flight check.
14. **`CardVerificationRule`** — farklı uzunluklu kartlar (26-bit vs 34-bit Wiegand).
15. **Çoklu cihaza paralel sync** — Convex scheduler ile batched `runAction`.
16. **Firmware sürüm takibi** — `GET /System/deviceInfo` → `devices.firmwareVersion`.

### 24.4 Referans dokümanlar

- Bu doküman — **her endpoint için NGS uygulama durumu**.
- [HIKVISION_ENTEGRASYON.md](./HIKVISION_ENTEGRASYON.md) — genel mimari.
- [HIKVISION_CURL_ISAPI_REHBERI.md](./HIKVISION_CURL_ISAPI_REHBERI.md) — cURL ile test örnekleri.
- [HIKVISION_HOST1_ALAN_ESLEMESI.md](./HIKVISION_HOST1_ALAN_ESLEMESI.md) — httpHosts/1 alan bazlı eşleme.
- [HIKVISION_ISAPI_REFERANS.md](./HIKVISION_ISAPI_REFERANS.md) — kısa endpoint referansı.
- [HIKVISION_KISI_SENKRONIZASYONU.md](./HIKVISION_KISI_SENKRONIZASYONU.md) — `hikvisionSync.ts` iş akışı.
- [HIKVISION_CIHAZDAN_GONDERIM_TESTI.md](./HIKVISION_CIHAZDAN_GONDERIM_TESTI.md) — cihaz push testi prosedürü.
- [TABLO_PARSE_UYUMLULUK.md](./TABLO_PARSE_UYUMLULUK.md) — parse uyumluluk tablosu.

---

**Kaynak PDF:** `ISAPI_FingerPrint Terminals_Pro Series.pdf` (267 sayfa). Bu markdown, PDF'in NGS Access bağlamında süzülmüş operasyonel versiyonudur; PDF'te yer alan tüm bölümlere birebir karşılık gelmez — proje kapsamı dışında kalan bölümler (RS-485 karmaşık topolojiler, eski ELE modeller, iris, BMI ölçer vs.) kısa tutuldu.
