# Hikvision ISAPI - Parmak İzi Terminalleri Pro Series

## Detaylı Geliştirici Rehberi

Bu doküman, **ISAPI_FingerPrint Terminals_Pro Series.pdf** (267 sayfa) dosyasının detaylı incelemesinden derlenmiştir. Kaynak: Hikvision resmi ISAPI dokümantasyonu.

---

## İçindekiler

1. [Belge Hakkında](#1-belge-hakkında)
2. [Genel Bakış](#2-genel-bakış)
3. [Ürün Kapsamı](#3-ürün-kapsamı)
4. [Terimler ve Tanımlar](#4-terimler-ve-tanımlar)
5. [ISAPI Framework](#5-isapi-framework)
6. [Hızlı Başlangıç Rehberi](#6-hızlı-başlangıç-rehberi)
7. [HTTP Listening (httpHosts)](#7-http-listening-httphosts)
8. [Event Yükleme ve Formatları](#8-event-yükleme-ve-formatları)
9. [Erişim Kontrol API'leri](#9-erişim-kontrol-apileri)
10. [Hata İşleme ve Status Kodları](#10-hata-işleme-ve-status-kodları)

---

## 1. Belge Hakkında

### 1.1 Doküman Yapısı

| Bölüm | Açıklama |
|-------|----------|
| **Overview** | ISAPI genel bakış, ürün kapsamı, terimler, kısaltmalar |
| **ISAPI Framework** | ISAPI çerçevesi ve temel işlevler |
| **Quick Start Guide** | Authentication, mesaj ayrıştırma, event yükleme |
| **API Reference** | API tanımları |
| **How-To Video Guidance** | Entegrasyon adımlarının videoları |

### 1.2 Yasal Uyarı

- Doküman "olduğu gibi" sunulmaktadır
- Ürün kullanımı kullanıcının kendi sorumluluğundadır
- Hukuki çatışmalarda geçerli yasalara göre karar verilir

---

## 2. Genel Bakış

### 2.1 ISAPI Nedir?

**Intelligent Security API (ISAPI)**, güvenlik cihazları (kameralar, DVR, NVR, erişim kontrol terminalleri) ile platform veya istemci yazılımı arasında iletişim için HTTP tabanlı, REST mimarili bir uygulama katmanı protokolüdür.

- **Temel:** HTTP (Hypertext Transfer Protocol)
- **Mimari:** REST (Representational State Transfer)
- **2013'ten beri** 11.000+ API ile farklı işlevler sunuluyor
- **Kapsam:** Cihaz yönetimi, araç tanıma, park yönetimi, yüz tanıma, erişim kontrolü, kayıt yönetimi

### 2.2 Ağ Modeli Katmanları

ISAPI HTTP üzerine kuruludur; bu nedenle HTTP'nin tüm özelliklerini devralır. Sık kullanılan diğer protokoller:

- **SADP:** Cihaz keşfi ve aktivasyon (multicast)
- **RTSP:** Canlı görüntü ve kayıt oynatma (TCP/UDP)

### 2.3 Entegrasyon Modeli

- **Cihaz:** Sunucu olarak sabit portta dinler
- **İstemci:** Cihaza aktif olarak bağlanır
- **Gereksinim:** Cihazda sabit IP, istemci isteklerinin sunucuya ulaşabilmesi

---

## 3. Ürün Kapsamı

### 3.1 Desteklenen Modeller (FingerPrint Terminals Pro Series)

DS-K1A802AEF, DS-K1A802AEF-B, DS-K1A802AF, DS-K1A802AF-B, DS-K1A802AMF, DS-K1A802AMF-B, DS-K1A802EF, DS-K1A802EF-B, DS-K1A802F, DS-K1A802F-B, DS-K1A802MF, DS-K1A802MF-B, DS-K1T501SF, DS-K1T502DBFWX, DS-K1T502DBFWX-C, DS-K1T502DBFWX-CE1, DS-K1T502DBFWX-E1, DS-K1T6Q-F08EFW, DS-K1T6Q-F08MFW, DS-K1T8005EFWX, DS-K1T8005EFWX-B, DS-K1T8005EFX, DS-K1T8005MFWX, DS-K1T8005MFWX-B, DS-K1T8005MFX, DS-K1T804, DS-K1T804A, DS-K1T804ADF, DS-K1T804AEF, DS-K1T804AF, DS-K1T804AMF, DS-K1T804BEF, DS-K1T804BF, DS-K1T804BMF, DS-K1T804EF, DS-K1T804F, DS-K1T804MF, DS-K1T807EBFWX-E1, DS-K1T807EBFWX-QRE1, DS-K1T807MBFWX-E1, DS-K1T807MBFWX-QRE1, DS-K1T808EFWX, DS-K1T808EFWX-B, DS-K1T808EFX, DS-K1T808MFWX, DS-K1T808MFWX-B, DS-K1T808MFX

---

## 4. Terimler ve Tanımlar

### 4.1 Event ve Arming

| Terim | Açıklama |
|-------|----------|
| **Event** | Cihazın yüklediği bilgi. Gerçek zamanlı yüklenir. Cihaz çevrimdışıysa önce önbelleğe alınır, bağlantı gelince tekrar yüklenir. |
| **Arming** | İstemcinin cihaza bağlanıp event'leri alması. Belirli event tipleri abone edilebilir; aksi halde tüm event'ler yüklenir. |
| **Listen** | Platform dinleme servisi başladığında, event oluşunca bilgi IP ve port üzerinden platformun dinleme portuna gönderilir, sonra bağlantı kapatılır. |
| **Listening Host** | Cihazlardan event alan dinleme servisi. |

### 4.2 Erişim Kontrolü Terimleri

| Terim | Açıklama |
|-------|----------|
| **Person-Based Access Control** | Kişi ID'si benzersiz tanımlayıcıdır. Kart, parmak izi, yüz resmi credential olarak kişi ID'sine bağlanır. |
| **Credential Type** | Kişiyi tanımlayan veriler: kart, parmak izi, yüz resmi. |
| **Person Type** | Normal kişi, ziyaretçi, kara listedeki kişi. |
| **Group** | Çok faktörlü doğrulamada kullanılan kişi grupları. Aynı kişi aynı anda farklı gruplarda olabilir (en fazla 4 grup). |
| **Multi-Factor Authentication** | Grup üyeleri yalnızca tanımlı kurala göre (kart, parmak izi, yüz vb.) kapıyı açabilir. |
| **Access Permission** | Hangi kişinin hangi kapıyı hangi zamanda açabileceği. |
| **ARC (Alarm Receiving Center)** | Alarm bilgisini alan ve alarm servisi sağlayan merkez. |
| **CID (Event Code)** | Belirli bir event'i tanımlayan kod. |
| **ACS** | Access Control System - erişim kontrol sistemi. |

---

## 5. ISAPI Framework

### 5.1 Genel

ISAPI, HTTP tabanlı iletişim protokolüdür. RTSP ile birlikte kullanıldığında, RTSP standartları da ISAPI bağlamında dikkate alınır.

### 5.2 Aktivasyon

- Cihazın şifresinin güvenli şekilde ayarlanması için aktivasyon gerekir.
- Web tarayıcı veya ISAPI üzerinden yapılabilir.
- **API:** `POST /ISAPI/Security/challenge`, `PUT /ISAPI/System/activate`
- SADP ile aktivasyon da desteklenir.

### 5.3 Güvenlik Mekanizması

#### 5.3.1 Kimlik Doğrulama

- **Digest Authentication** (RFC 7616) zorunludur.
- Örnek URI: `GET http://192.168.18.84:80/ISAPI/System/deviceInfo`
- Kullanıcı adı ve şifre Digest Auth ile gönderilir.

#### 5.3.2 Kullanıcı İzinleri

| Rol | İzin |
|-----|------|
| **Administrator** | Tüm kaynaklara erişim, sürekli aktif olmalı |
| **Operator** | Genel ve bazı ileri kaynaklara erişim |
| **Normal User** | Sadece genel kaynaklara erişim |

#### 5.3.3 Şifreleme

- HTTPS varsayılan olarak etkindir.
- Bilgi güvenli aktarım için HTTPS kullanılmalıdır.

### 5.4 Video Akışı

- **RTSP:** Canlı görüntü ve kayıt oynatma (RFC 7826).
- **Metadata:** Cihazın ürettiği yapılandırılmış akıllı bilgi; RTSP stream ile birlikte döner.

---

## 6. Hızlı Başlangıç Rehberi

### 6.1 Kimlik Doğrulama Örnekleri

#### C/C++ (libcurl)

```c
curl_easy_setopt(pCurlHandle, CURLOPT_URL, "http://192.168.18.84:80/ISAPI/System/deviceInfo");
curl_easy_setopt(pCurlHandle, CURLOPT_USERPWD, "admin:admin12345");
curl_easy_setopt(pCurlHandle, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST);
```

#### Python (requests)

```python
auth = requests.auth.HTTPDigestAuth('admin', 'admin12345')
response = requests.get('http://192.168.18.84:80/ISAPI/System/deviceInfo', auth=auth)
```

### 6.2 Mesaj Formatları

#### XML

- `Content-Type: application/xml; charset="UTF-8"`
- Namespace: `http://www.isapi.org/ver20/XMLSchema`
- Versiyon: `2.0`

#### JSON

- `Content-Type: application/json`
- Sorgu parametresi: `format=json` (örn. `?format=json`)
- Karakter seti: UTF-8

#### multipart/form-data

- Birden fazla veri biriminde kullanılır.
- `Content-Type: multipart/form-data; boundary=<boundary>`
- `Content-Disposition` içinde `name` (form alanı adı) ve opsiyonel `filename` (dosya adı) kullanılır.
- Detay: RFC 1867

### 6.3 Capability Set

- Neredeyse tüm işlevler için capability set vardır.
- URL genelde `/capabilities` ile biter.
- İki tür bilgi: işlev desteği (`isSupportXxxx`) ve alan değer aralıkları (`@min`, `@max`, `@opt`).

### 6.4 Zaman Formatı

- ISO 8601: `YYYY-MM-DDThh:mm:ss.sTZD`
- Örnek: `2017-08-16T20:17:06.123+08:00`
- TZ: UTC; TD: yerel saat ve UTC farkı. TD formatı önerilir.

### 6.5 Karakter Seti

- Tek byte: a-z, A-Z, 0-9, özel karakterler.
- Çok byte: Unicode, UTF-8.
- Özel alanlarda izin verilen karakterler dokümanda tanımlıdır.

### 6.6 Hata İşleme

- HTTP status 200 değilse ISAPI hata kodu döner.
- HTTP status: RFC 2616.
- ISAPI hata kodları: Error Code Dictionary.

Örnek hata yanıtı:

```json
{
  "requestURL": "/ISAPI/Event/triggers/notifications/channels/whiteLightAlarm",
  "statusCode": 4,
  "statusString": "Invalid Operation",
  "subStatusCode": "notSupport",
  "errorCode": 1073741825,
  "errorMsg": "notSupport"
}
```

---

## 7. HTTP Listening (httpHosts)

ngsaccess ve benzeri harici sunuculara event göndermek için kullanılan yöntemdir.

### 7.1 Genel Akış

1. Cihaz dinleme servisini etkinleştirir.
2. Event oluşunca yapılandırılmış adrese event bilgisini gönderir.
3. Event adresi geçerli ve cihazda tanımlı olmalıdır.

**Notlar:**
- İstemci ve event servisi aynı uygulama olabilir.
- Dinleme modunda cihazda heartbeat üretilmez.

### 7.2 API Çağrı Akışı

#### Adım 1: Destek Kontrolü

```
GET /ISAPI/Event/notification/httpHosts/capabilities
```

Dönüşte `<HttpHostNotificationCap>true</HttpHostNotificationCap>` varsa cihaz httpHosts destekliyordur.

#### Adım 2: Dinleme Host Parametrelerini Yapılandırma

| İşlem | API |
|-------|-----|
| Tüm host'ları yapılandır | `PUT /ISAPI/Event/notification/httpHosts?security=<security>&iv=<iv>` |
| Tüm host parametrelerini al | `GET /ISAPI/Event/notification/httpHosts?security=<security>&iv=<iv>` |
| Tek host yapılandır | `PUT /ISAPI/Event/notification/httpHosts/<hostID>?security=<security>&iv=<iv>` |
| Tek host parametrelerini al | `GET /ISAPI/Event/notification/httpHosts/<hostID>?security=<security>&iv=<iv>` |

#### Adım 3: Dinleme Servisini Etkinleştirme

Host parametrelerinde `enabled: true` yapılmalıdır.

#### Adım 4: Test (Opsiyonel)

```
POST /ISAPI/Event/notification/httpHosts/<hostID>/test
```

#### Adım 5: Event Alma

Event oluşunca cihaz istemciye bağlanır ve alarm/event bilgisini yükler.

### 7.3 HttpHostNotification Yapısı (PUT/POST Body)

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `id` | string | Evet | Host kimliği |
| `url` | string | Evet | Tam URL (host + path) |
| `protocolType` | enum | Evet | HTTP, HTTPS, EHome |
| `parameterFormatType` | enum | Evet | JSON, XML |
| `addressingFormatType` | enum | Evet | hostname, ipaddress |
| `hostName` | string | Koşullu | addressingFormatType=hostname ise |
| `ipAddress` | string | Koşullu | addressingFormatType=ipaddress ise |
| `portNo` | int | Hayır | Port |
| `httpAuthenticationMethod` | enum | Evet | MD5digest, none, base64 |
| `userName` | string | Koşullu | MD5digest ise |
| `enabled` | bool | Hayır | Etkin/devre dışı |
| `method` | enum | Hayır | POST, PUT, GET (varsayılan: POST) |
| `checkResponseEnabled` | bool | Hayır | 200 OK doğrulaması (varsayılan: true) |

### 7.4 ngsaccess İçin Örnek Yapılandırma

```json
{
  "id": "ngsaccess",
  "url": "https://notable-tern-4.convex.site/card-reader",
  "protocolType": "HTTPS",
  "parameterFormatType": "JSON",
  "addressingFormatType": "hostname",
  "hostName": "notable-tern-4.convex.site",
  "httpAuthenticationMethod": "none",
  "enabled": true,
  "method": "POST"
}
```

### 7.5 Event Gönderim Formatı

#### XML/JSON (Binary data yok)

```
POST <Request_URI> HTTP/1.1
Host: <sunucu_ip_veya_domain>:<port>
Content-Type: application/xml (veya application/json)
Connection: keep-alive

<EventNotificationAlert>...</EventNotificationAlert>
```

**Listening Host yanıtı:**
```
HTTP/1.1 200 OK
Connection: close
```

#### multipart/form-data (Resimli event)

```
Content-Disposition: form-data; name="Event_Type"
Content-Type: text/xml (veya application/json)
<EventNotificationAlert>...</EventNotificationAlert>

Content-Disposition: form-data; name="Picture_Name"
Content-Type: image/jpeg
[Picture Data]
```

### 7.6 Timeout Ayarları

```
PUT /ISAPI/Event/notification/httpHosts/<hostID>/uploadCtrl
```

Bu URL ile timeout vb. parametreler yapılandırılabilir.

---

## 8. Event Yükleme ve Formatları

### 8.1 Üç Yöntem

1. **Arming:** İstemci cihaza kalıcı HTTP bağlantısı kurar.
2. **Listening:** Cihaz event oluşunca yapılandırılmış adrese POST gönderir.
3. **Subscription:** Abone olunan event tiplerine göre event alınır.

### 8.2 Arming (Abonelik Olmadan)

1. `GET /ISAPI/Event/notification/alertStream` ile bağlantı kur.
2. `Connection: keep-alive` header'ı kullan.
3. Gelen event'leri boundary ile ayırıp parse et.
4. Gerekmediğinde bağlantıyı kapat.

### 8.3 Arming (Abonelik ile)

1. `POST /ISAPI/Event/notification/subscribeEvent` ile bağlantı kur.
2. Sadece abone olunan event'ler gelir.
3. Event mesajları boundary ile ayrılır.

### 8.4 EventNotificationAlert Örnek Yapısı

```xml
<EventNotificationAlert version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <ipAddress>10.17.133.46</ipAddress>
  <portNo>80</portNo>
  <protocol>HTTP</protocol>
  <macAddress>44:19:b6:6d:24:85</macAddress>
  <channelID>1</channelID>
  <dateTime>2017-05-04T11:20:02+08:00</dateTime>
  <eventType>heartBeat</eventType>
  <eventState>active</eventState>
  <eventDescription>heartBeat</eventDescription>
</EventNotificationAlert>
```

Erişim kontrol event'lerinde ek alanlar: `cardNo`, `credentialNo`, `serialNumber`, `deviceSerialNo` vb.

### 8.5 Event Mesaj Ayrıştırma

- **heartBeat:** `eventType` değeri `heartBeat` olan mesajlar.
- **multipart:** Boundary ile ayrılmış parçalar.
- **Content-Type:** XML veya JSON formatını belirler.

---

## 9. Erişim Kontrol API'leri

### 9.1 Kişi Yönetimi

| İşlev | Kontrol API | Ana API |
|-------|-------------|---------|
| Kişi uygulama | `GET /ISAPI/AccessControl/UserInfo/capabilities?format=json` (supportFunction.setUp) | `PUT /ISAPI/AccessControl/UserInfo/SetUp?format=json` |
| Kişi ekleme | supportFunction.post | `POST /ISAPI/AccessControl/UserInfo/Record?format=json` |
| Kişi düzenleme | supportFunction.put | `PUT /ISAPI/AccessControl/UserInfo/Modify?format=json` |
| Kişi silme | isSupportUserInfoDetailDelete | `PUT /ISAPI/AccessControl/UserInfoDetail/Delete?format=json` |

### 9.2 Anti-Passback Sıfırlama

- `GET /ISAPI/AccessControl/capabilities` → `isSupportAntiPassbackResetRules`
- `GET /ISAPI/AccessControl/AntiPassback/resetRules?format=json`
- `PUT /ISAPI/AccessControl/AntiPassback/resetRules?format=json`

### 9.3 Erişim İzin Zamanlamaları

- Haftalık: `GET/PUT /ISAPI/AccessControl/UserRightWeekPlanCfg/<weekPlanID>?format=json`
- Tatil grupları: `GET/PUT /ISAPI/AccessControl/UserRightHolidayGroupCfg/<holidayGroupID>?format=json`
- Tatil planları: `GET/PUT /ISAPI/AccessControl/UserRightHolidayPlanCfg/<holidayPlanID>?format=json`

### 9.4 Erişim Kontrol Event'leri

| İşlev | API |
|-------|-----|
| Depolama yapılandırması | `GET/PUT /ISAPI/AccessControl/AcsEvent/StorageCfg?format=json` |
| Event arama | `POST /ISAPI/AccessControl/AcsEvent?format=json` |
| Toplam event sayısı | `POST /ISAPI/AccessControl/AcsEventTotalNum?format=json` |

### 9.5 AcsEvent Arama Parametreleri

- `major`, `minor`: Event tipi
- `startTime`, `endTime`: Zaman aralığı
- `cardNo`: Kart numarası
- `name`: Kart sahibi adı
- `employeeNoString`: Person ID
- `beginSerialNo`, `endSerialNo`: Seri numarası aralığı

### 9.6 Event–Kart İlişkilendirmesi

- `PUT /ISAPI/AccessControl/EventCardLinkageCfg/<ACEID>?format=json`
- `proMode`: event, card, mac, employee
- `EventLinkageInfo`: mainEventType, subEventType (Event Linkage Types dokümanından)

---

## 10. Hata İşleme ve Status Kodları

### 10.1 Status Code Özeti

| statusCode | statusString | Açıklama |
|------------|--------------|----------|
| 0, 1 | OK | Başarılı |
| 2 | Device Busy | Cihaz meşgul |
| 3 | Device Error | Cihaz hatası |
| 4 | Invalid Operation | Geçersiz işlem |
| 5 | Invalid XML Format | Geçersiz XML formatı |
| 6 | Invalid XML Content | Geçersiz XML içeriği |
| 7 | Reboot Required | Yeniden başlatma gerekli |

### 10.2 Örnek Alt Status Kodları

- `eventNotSupport` (0x60001024): Event desteklenmiyor
- `notSupport`: İşlev desteklenmiyor
- `badXmlFormat`: Hatalı XML formatı

### 10.3 Listening Host Yanıt Gereksinimleri

- Cihaz event yüklediğinde Listening Host **HTTP 200 OK** dönmelidir.
- `checkResponseEnabled: true` ise 200 OK alınmazsa cihaz event'i başarısız sayar ve günlüğe yazar veya tekrar gönderir.
- Bazı platformlarda 200 OK üretilemiyorsa `checkResponseEnabled: false` kullanılabilir.

---

## Ek A: ngsaccess Entegrasyon Özeti

1. **Cihaz ekleme:** ngsaccess Devices sayfasından cihazı ekleyin (seri no, IP).
2. **httpHosts yapılandırma:** Cihazda veya ISAPI ile `url: https://notable-tern-4.convex.site/card-reader` ayarlayın.
3. **Desteklenen formatlar:** EventNotificationAlert, AcsEvent, düz JSON (cardNo, serialNumber).
4. **deviceSerial:** ngsaccess’teki `deviceSerial` Hikvision cihaz seri numarası ile eşleşmeli.

---

## Ek B: Access Control Event Linkage Types

Event linkage, cihazda hangi event tetiklendiğinde ne yapılacağını belirler. **Authentication Unit Event Linkage** erişim kontrolü için kritiktir.

### Authentication Unit Event Linkage (Önemli Değerler)

| Value | Açıklama |
|-------|----------|
| 2 | Valid Card Authentication Completed |
| 3 | Card and Password Authentication Completed |
| 4 | Card and Password Authentication Failed |
| 10 | Card No. Not Exist |
| 13 | Fingerprint Matched |
| 14 | Fingerprint Mismatched |
| 15 | Card and Fingerprint Authentication Completed |
| 52 | Employee ID and Password Authentication Completed |
| 70 | QR Code Authenticated |
| 89 | QR Code Recognized |
| 100 | Blocklist Event |

### Access Control Point Event Linkage

- 0: Open Door with First Card Started
- 1: Open Door with First Card Ended
- 8: Exit Button Pressed
- 14: Door Remotely Open
- 31: First Card Authentication Started
- 55: Tailgating
- 56: Reverse Passing

---

## Ek C: Annotation ve Alan Tipleri

| Annotation | Açıklama |
|------------|----------|
| ro | Read-Only |
| wo | Write-Only |
| req | Required |
| opt | Optional |
| dep | Dependent (koşullu geçerli) |
| object | Alt alanları olan nesne |
| list | Liste tipi |
| subType | Alt tip (string, int, enum vb.) |
| enum | Sabit değer listesi |

---

## Ek D: Aktivasyon Akışı (Özet)

1. İstemci 1024-bit RSA public/private key üretir.
2. Public key modulus (128 byte) Base64 ile cihaza gönderilir: `POST /ISAPI/Security/challenge`
3. Cihaz rastgele string üretir, RSA ile şifreler, Base64 gönderir.
4. İstemci şifreyi çözer, AES key çıkarır.
5. "ilk 16 karakter + gerçek şifre" AES-128 ECB ile şifrelenir.
6. `PUT /ISAPI/System/activate` ile cihaza gönderilir.
7. Cihaz doğrular ve aktivasyon sonucunu döner.

---

## Ek E: Kaynaklar

- **Orijinal PDF:** `ISAPI_FingerPrint Terminals_Pro Series.pdf`
- **Event tipleri:** `Access Control Event Types and Event Linkage Types.pdf`
- **Hata kodları:** `ErrorCode.xlsx`
- **Alan sözlüğü:** `Field Dictionary.xlsx`
- **ngsaccess entegrasyon:** `docs/HIKVISION_ENTEGRASYON.md`
- **ngsaccess ISAPI referans:** `docs/HIKVISION_ISAPI_REFERANS.md`
- **Hikvision TPP:** https://tpp.hikvision.com
