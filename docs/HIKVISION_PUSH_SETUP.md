# Hikvision DS-K1T807EBFWX-E1 → Convex Event Push

## Durum (2026-04-15)

Cihaz **httpHosts ile aktif push yapmıyor** (DeployList size=0, reboot sonrası da).  
Firmware V4.24.0 bu modelde subscribeEvent (pull) çalışıyor, httpHosts push çalışmıyor.

---

## Cihaz Bilgileri

| Alan | Değer |
|------|-------|
| IP | 192.168.1.34 |
| Model | DS-K1T807EBFWX-E1 |
| Firmware | V4.24.0 |
| Admin Kullanıcı | admin |
| Auth | HTTP Digest |
| Web UI | http://192.168.1.34 |

> **Şifre**: `.env` dosyasında sakla, buraya yazma.

---

## Convex Endpoint

```
POST https://notable-tern-4.convex.site/card-reader
Content-Type: application/json
```

Beklenen JSON formatı (Hikvision AccessControllerEvent):

```json
{
  "EventNotificationAlert": {
    "ipAddress": "192.168.1.34",
    "macAddress": "xx:xx:xx:xx:xx:xx",
    "AccessControllerEvent": {
      "cardNo": "1234567890",
      "employeeNoString": "1",
      "majorEventType": 5,
      "subEventType": 75,
      "doorNo": 1
    }
  }
}
```

Parse kodu: [convex/lib/cardReaderParse.ts](../convex/lib/cardReaderParse.ts)

---

## httpHosts Mevcut Config (ISAPI)

```
GET/PUT http://192.168.1.34/ISAPI/Event/notification/httpHosts/1
```

Ayarlanmış değerler:
- `protocolType`: HTTPS
- `hostName`: notable-tern-4.convex.site
- `portNo`: 443
- `url`: /card-reader
- `parameterFormatType`: JSON
- `httpAuthenticationMethod`: none
- `eventMode`: list (AccessControllerEvent + tüm minorOperation/minorEvent kodları)

Config yerinde duruyor ama cihaz bu firmware'de **aktif push başlatmıyor**.

---

## Çalışan Yöntem: subscribeEvent (Pull)

Cihaz event stream'i bu endpoint'ten okunabilir:

```bash
curl --digest -u admin:<SIFRE> \
  -X POST "http://192.168.1.34/ISAPI/Event/notification/subscribeEvent" \
  -H "Content-Type: application/xml" \
  -d '<SubscribeEvent version="2.0">
        <eventMode>all</eventMode>
      </SubscribeEvent>'
```

- Response: `multipart/form-data` stream, her part bir AccessControllerEvent JSON'u
- Kart okutunca event anında geliyor (test edildi)
- Bağlantı uzun-yaşayan (long-lived), cihaz kapanana kadar açık kalır

---

## Çözüm Seçenekleri

### Seçenek A: Bridge Servisi (subscribeEvent → Convex)

Bir Node.js/Python servisi:
1. `POST /ISAPI/Event/notification/subscribeEvent` ile stream açar
2. Her multipart part'ı parse eder
3. `POST https://notable-tern-4.convex.site/card-reader` ile Convex'e iletir

Bu makine LAN'da olduğu sürece çalışır, internete gerek yok.

### Seçenek B: Farklı Firmware / Web UI Platform Access

Web UI'da (`http://192.168.1.34`) şu ayarlar olabilir:
- **Platform Access** (EHome/Hik-Connect)
- **Alarm Center** → push destination

Bu ayarlardan httpHosts push aktif edilebilir olabilir.

### Seçenek C: ISAPI alertStream

```
GET http://192.168.1.34/ISAPI/Event/notification/alertStream
```

Bazı modellerde subscribeEvent yerine bu çalışır.

---

## Postman ile Test

Postman MCP başka bir chat oturumunda authenticate edildi.  
Aynı oturumda devam et veya yeni oturumda:

```
claude mcp add --transport http postman https://mcp.postman.com/mcp
```

OAuth ile authenticate et, ardından Postman'dan:
- `GET http://192.168.1.34/ISAPI/System/deviceInfo` (Digest auth)
- `GET http://192.168.1.34/ISAPI/Event/notification/httpHosts/1`
- `POST http://192.168.1.34/ISAPI/Event/notification/subscribeEvent`

---

## ISAPI Referans Endpoint'leri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/ISAPI/System/deviceInfo` | GET | Cihaz bilgisi |
| `/ISAPI/System/reboot` | PUT | Reboot |
| `/ISAPI/Event/notification/httpHosts/1` | GET/PUT | Push config |
| `/ISAPI/AccessControl/DeployInfo` | GET | Aktif push listener listesi |
| `/ISAPI/Event/notification/subscribeEvent` | POST | Event stream (pull) |
| `/ISAPI/Event/notification/alertStream` | GET | Alert stream (alternatif) |
| `/ISAPI/AccessControl/CardInfo/Search` | POST | Kart listesi |
| `/ISAPI/AccessControl/UserInfo/Search` | POST | Kullanıcı listesi |
