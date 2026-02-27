# Hikvision ISAPI - Yüz Tanıma Terminalleri Value Series

## Detaylı Geliştirici Rehberi

Bu doküman, **ISAPI_Face Recognition Terminals_Value Series.pdf** dosyasından derlenmiştir. Kaynak: Hikvision resmi ISAPI dokümantasyonu.

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
9. [ngsaccess Entegrasyonu](#9-ngsaccess-entegrasyonu)
10. [Web Arayüzü – Network Service](#10-web-arayüzü--network-service)

---

## 1. Belge Hakkında

### 1.1 Doküman Yapısı

| Bölüm | Açıklama |
|-------|----------|
| **Overview** | ISAPI genel bakış, ürün kapsamı, terimler |
| **ISAPI Framework** | ISAPI çerçevesi ve temel işlevler |
| **Quick Start Guide** | Authentication, mesaj ayrıştırma, event yükleme |
| **API Reference** | API tanımları |
| **How-To Video Guidance** | Entegrasyon adımlarının videoları |

### 1.2 Face Recognition Value Series vs Pro Series

| Özellik | Value Series | Pro Series (Parmak İzi) |
|---------|--------------|-------------------------|
| Ürün ailesi | Yüz tanıma terminalleri | Parmak izi terminalleri |
| ISAPI / httpHosts | Desteklenir | Desteklenir |
| PUSH SDK | Bazı modellerde alternatif | Genelde yok |
| Event formatı | EventNotificationAlert, AcsEvent, AccessControllerEvent | Aynı yapılar |

**Önemli:** ngsaccess için HTTP Listening (httpHosts) akışı **aynıdır**. Convex `/card-reader` endpoint’i her iki seriyle de uyumludur.

---

## 2. Genel Bakış

### 2.1 ISAPI Nedir?

**Intelligent Security API (ISAPI)**, Hikvision güvenlik cihazları (kameralar, erişim kontrol terminalleri, yüz tanıma cihazları) ile platform veya istemci yazılımı arasında iletişim için HTTP tabanlı, REST mimarili bir uygulama katmanı protokolüdür.

- **Temel:** HTTP (Hypertext Transfer Protocol)
- **Mimari:** REST (Representational State Transfer)
- **Kapsam:** Cihaz yönetimi, yüz tanıma, erişim kontrolü, kayıt yönetimi

### 2.2 Entegrasyon Modeli

- **Cihaz:** Sunucu olarak sabit portta dinler
- **İstemci:** Cihaza aktif olarak bağlanır
- **HTTP Listening:** Cihaz event oluşunca yapılandırılmış URL’e POST ile event gönderir

---

## 3. Ürün Kapsamı

### 3.1 Desteklenen Modeller (Face Recognition Terminals Value Series)

PDF içeriğine göre Value Series modelleri Hikvision dokümantasyonunda listelenir. Seri numarası genelde `DS-K1T`, `DS-K1A` veya benzeri öneklerle başlar.

**Yaygın örnekler:** DS-K1T807EBFWX, DS-K1A802EF, DS-K1T804, vb.

---

## 4. Terimler ve Tanımlar

| Terim | Açıklama |
|-------|----------|
| **Event** | Cihazın yüklediği bilgi. Gerçek zamanlı veya önbelleğe alınmış yüklenir. |
| **Listening Host** | Cihazlardan event alan dinleme servisi (örn. ngsaccess Convex HTTP endpoint). |
| **httpHosts** | HTTP Listening yapılandırması. Event Alarm IP/Domain, URL, Port ile tanımlanır. |
| **EventNotificationAlert** | ISAPI event mesaj formatı (XML/JSON). |

---

## 5. ISAPI Framework

### 5.1 Kimlik Doğrulama

- **Digest Authentication** (RFC 7616) zorunludur.
- Örnek URI: `GET http://192.168.1.10:80/ISAPI/System/deviceInfo`

### 5.2 Mesaj Formatları

- **XML:** `Content-Type: application/xml; charset="UTF-8"`
- **JSON:** `Content-Type: application/json`, sorgu parametresi: `format=json`

---

## 6. Hızlı Başlangıç Rehberi

### 6.1 Cihaz Bilgisi

```bash
curl -u admin:şifre --digest "http://192.168.1.10/ISAPI/System/deviceInfo"
```

### 6.2 httpHosts Destek Kontrolü

```bash
curl -u admin:şifre --digest "http://192.168.1.10/ISAPI/Event/notification/httpHosts/capabilities"
```

`<HttpHostNotificationCap>true</HttpHostNotificationCap>` dönerse httpHosts destekleniyordur.

---

## 7. HTTP Listening (httpHosts)

ngsaccess ve benzeri harici sunuculara event göndermek için kullanılan yöntemdir.

### 7.1 Genel Akış

1. Cihaz dinleme servisini etkinleştirir.
2. Event oluşunca (kart okuma, yüz tanıma, parmak izi vb.) yapılandırılmış adrese event bilgisini gönderir.
3. Event adresi geçerli ve cihazda tanımlı olmalıdır.

### 7.2 API Çağrı Akışı

| Adım | API |
|------|-----|
| 1. Destek kontrolü | `GET /ISAPI/Event/notification/httpHosts/capabilities` |
| 2. Host listesi | `GET /ISAPI/Event/notification/httpHosts` |
| 3. Tek host ayarlama | `PUT /ISAPI/Event/notification/httpHosts/1` |
| 4. Test (opsiyonel) | `POST /ISAPI/Event/notification/httpHosts/1/test` |

### 7.3 HttpHostNotification Yapısı (PUT Body)

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string | Host kimliği (örn. `1`) |
| `url` | string | **Tam URL** – ngsaccess için: `https://<deployment>.convex.site/card-reader` |
| `protocolType` | enum | HTTP, HTTPS |
| `parameterFormatType` | enum | JSON, XML |
| `addressingFormatType` | enum | hostname, ipaddress |
| `hostName` | string | addressingFormatType=hostname ise (örn. `notable-tern-4.convex.site`) |
| `ipAddress` | string | addressingFormatType=ipaddress ise |
| `portNo` | int | Port (HTTPS için 443) |
| `httpAuthenticationMethod` | enum | MD5digest, none, base64 |
| `enabled` | bool | Etkin olmalı (`true`) |
| `method` | enum | POST (varsayılan) |

### 7.4 ngsaccess İçin Örnek Yapılandırma

```json
{
  "id": "1",
  "url": "https://notable-tern-4.convex.site/card-reader",
  "protocolType": "HTTPS",
  "parameterFormatType": "JSON",
  "addressingFormatType": "hostname",
  "hostName": "notable-tern-4.convex.site",
  "portNo": 443,
  "httpAuthenticationMethod": "none",
  "enabled": true,
  "method": "POST"
}
```

### 7.5 Listening Host Yanıt Gereksinimi

Cihaz event gönderdiğinde Listening Host **HTTP 200 OK** dönmelidir. Aksi halde cihaz tekrar deneyebilir veya event’i bırakabilir.

---

## 8. Event Yükleme ve Formatları

### 8.1 Event Gönderim Formatı

Cihaz event oluşunca yapılandırılmış URL’e POST ile gönderir:

```
POST /card-reader HTTP/1.1
Host: notable-tern-4.convex.site
Content-Type: application/json

{ "EventNotificationAlert": { ... } }
```

veya

```json
{
  "AcsEvent": {
    "cardNo": "12345678",
    "deviceSerialNo": "DS-K1T807EBFWX-E120250619V042400ENGB8172365",
    ...
  }
}
```

### 8.2 ngsaccess Alan Eşlemesi

| Hikvision alanı | ngsaccess kullanımı |
|-----------------|---------------------|
| `cardNo`, `credentialNo`, `employeeNo` | `user_id` |
| `serialNumber`, `deviceSerialNo` | `serial` |

Ayrıntılar için: [HIKVISION_HOST1_ALAN_ESLEMESI.md](./HIKVISION_HOST1_ALAN_ESLEMESI.md)

---

## 9. ngsaccess Entegrasyonu

### 9.1 Genel Adımlar

1. **Cihazı ngsaccess’e ekleyin** – Seri numarası Hikvision’dan gelenle birebir aynı olmalı.
2. **HTTP Listening ayarlayın** – Web arayüzü veya ISAPI ile `url: https://<deployment>.convex.site/card-reader`.
3. **Event tipini seçin** – Access Control, Card Swiped, Face Recognition vb.
4. **Test edin** – Kart/yüz okutup Convex Dashboard > Logs üzerinden isteği kontrol edin.

### 9.2 İlgili Dokümanlar

- [HIKVISION_ENTEGRASYON.md](./HIKVISION_ENTEGRASYON.md) – Genel entegrasyon adımları
- [HIKVISION_HOST1_ALAN_ESLEMESI.md](./HIKVISION_HOST1_ALAN_ESLEMESI.md) – Alan eşlemesi
- [HIKVISION_CURL_ISAPI_REHBERI.md](./HIKVISION_CURL_ISAPI_REHBERI.md) – curl ile yapılandırma
- [HIKVISION_WEB_ARAYUZU_ISAPI_SAYFALARI.md](./HIKVISION_WEB_ARAYUZU_ISAPI_SAYFALARI.md) – Web arayüzü ve ISAPI sayfaları

---

## 10. Web Arayüzü – Network Service

Face Recognition Value Series cihazlarında HTTP Listening bazen şu menüde bulunur:

- **Configuration** > **Network** > **Network Service** > **HTTP(S)**
- Veya: **Event** > **Normal Event** > **Linkage** > **HTTP** / **Notify Surveillance Center**

Ekran görüntüsünde görünen alanlar:

| Arayüz alanı | Anlamı | ngsaccess için |
|--------------|--------|----------------|
| Event Alarm IP/Domain Name | Sunucu IP veya hostname | `notable-tern-4.convex.site` (Convex deployment hostname) |
| URL | Event endpoint path | `/card-reader` |
| Port | Hedef sunucu portu | `443` (HTTPS) |

**Not:** Web arayüzünde bu bölüm bazı modellerde farklı isimle veya farklı yerde olabilir. Menüde görünmüyorsa ISAPI ile yapılandırın: `PUT /ISAPI/Event/notification/httpHosts/1`.

---

## Kaynak

- **ISAPI_Face Recognition Terminals_Value Series.pdf** – Hikvision resmi dokümantasyonu
- **HIKVISION_ISAPI_FINGERPRINT_TERMINALS_DETAYLI.md** – Parmak izi terminalleri referansı (yapı aynı)
