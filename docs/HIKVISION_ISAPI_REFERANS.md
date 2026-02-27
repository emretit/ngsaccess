# Hikvision ISAPI - Parmak İzi Terminalleri (Pro Series) Referans Dokümanı

Bu doküman, `ISAPI_FingerPrint Terminals_Pro Series` indirilebilir paketindeki tüm dosyaların özetini içerir. Kaynak: Hikvision resmi dokümantasyonu.

---

## 1. İçindekiler (Paket Dosyaları)

| Dosya | Açıklama |
|-------|----------|
| ISAPI_FingerPrint Terminals_Pro Series.pdf | Ana ISAPI geliştirici rehberi (~9MB) |
| Access Control Event Types and Event Linkage Types.pdf | Erişim kontrol olay ve ilişkilendirme tipleri |
| ErrorCode.xlsx | ISAPI hata kodları |
| Field Dictionary.xlsx | Alan sözlüğü |
| Log.pdf | Log tipleri |
| Region Code.pdf | Plaka tanıma bölge kodları |
| Country and Region Code.pdf | Ülke/bölge kodları |

---

## 2. HTTP Listening (httpHosts) - ngsaccess Entegrasyonu İçin Kritik

Hikvision cihazları event'leri **HTTP Listening** modu ile harici sunucuya gönderir. Bu mod tam olarak ngsaccess `/card-reader` endpoint'i ile kullanılmak içindir.

### 2.1 Yapılandırma Adımları

1. **Destek kontrolü:**
   ```
   GET /ISAPI/Event/notification/httpHosts/capabilities
   ```
   Dönüşte `<HttpHostNotificationCap>true</HttpHostNotificationCap>` olmalı.

2. **Listening host parametreleri:**
   - Tüm host'lar: `PUT /ISAPI/Event/notification/httpHosts`
   - Tek host: `PUT /ISAPI/Event/notification/httpHosts/<hostID>`

3. **Listening servisini etkinleştir** (cihaz arayüzünden veya API ile).

4. **Test (opsiyonel):**
   ```
   POST /ISAPI/Event/notification/httpHosts/<hostID>/test
   ```

### 2.2 Event Gönderim Formatı

Olay oluştuğunda cihaz, yapılandırılan **Request URI**'ye (sunucu URL'i) HTTP POST yapar.

**application/xml veya application/json:**
```
POST <Request_URI> HTTP/1.1
Host: <sunucu_domain_veya_ip>:<port>
Content-Type: application/xml  (veya application/json)
Connection: keep-alive

<EventNotificationAlert>...</EventNotificationAlert>
```

**multipart/form-data (resimli event'ler):**
```
Content-Disposition: form-data; name="Event_Type"
Content-Type: text/xml  (veya application/json)
<EventNotificationAlert>...</EventNotificationAlert>

Content-Disposition: form-data; name="Picture_Name"
Content-Type: image/jpeg
[Picture Data]
```

### 2.3 EventNotificationAlert Örnek Yapısı

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

**Erişim kontrol event'lerinde** ek alanlar: `cardNo`, `credentialNo`, `serialNumber`, `deviceSerialNo` vb. (model/firmware'e göre değişir).

### 2.4 ngsaccess Card-Reader URL

Hikvision cihazında Listening host'un **Request URI** alanına:

```
https://notable-tern-4.convex.site/card-reader
```

---

## 3. Access Control Event Types

### 3.1 Ana Kategoriler

| Kod | Kategori | Örnek Alt Tipler |
|-----|----------|------------------|
| 0x1 | Alarm Events | Zone alarm, Card reader tampering, Duress |
| 0x2 | Exception Events | Power on/off, Network disconnected, Card reader offline |
| 0x3 | Operation Events | Door remotely open, Card authentication |
| 0x4 | Additional Information | - |
| 0x5 | Other Events | - |

### 3.2 Önemli Erişim Kontrol Event'leri

**Alarm (0x1):**
- 0x406 Card Reader Tampering Alarm
- 0x40a Duress Alarm
- 0x40c Maximum Failed Card Authentications Alarm

**Exception (0x2):**
- 0x409 Card Reader Offline
- 0x40a Card Reader Online
- 0x425 Device Unauthorized

**Operation (0x3):**
- 0x400 Door Remotely Open
- 0x401 Door Remotely Closed
- 0x406 Remote Operation: Clear All Card No.
- 0x423 Export Offline Collected Data

---

## 4. Event Linkage Types (İlişkilendirme)

Event linkage, cihazda hangi event tetiklendiğinde ne yapılacağını tanımlar. **Authentication Unit Event Linkage** erişim kontrolü için kritiktir.

### 4.1 Authentication Unit Event Linkage

| Value | Açıklama | ngsaccess İçin |
|-------|----------|----------------|
| 2 | Valid Card Authentication Completed | ✅ Kart okuma – izin verildi |
| 3 | Card and Password Authentication Completed | ✅ |
| 4 | Card and Password Authentication Failed | Kayıt |
| 10 | Card No. Not Exist | Kayıt |
| 13 | Fingerprint Matched | ✅ |
| 14 | Fingerprint Mismatched | Kayıt |
| 15 | Card and Fingerprint Authentication Completed | ✅ |
| 52 | Employee ID and Password Authentication Completed | ✅ |
| 70 | QR Code Authenticated | ✅ |
| 89 | QR Code Recognized | ✅ |
| 100 | Blocklist Event | Kayıt |

### 4.2 Access Control Point Event Linkage

- 0: Open Door with First Card Started
- 1: Open Door with First Card Ended
- 8: Exit Button Pressed
- 14: Door Remotely Open
- 31: First Card Authentication Started
- 55: Tailgating
- 56: Reverse Passing

---

## 5. Error Codes (ErrorCode.xlsx)

| Status Code | Status String | Örnek Error Code | Açıklama |
|-------------|---------------|------------------|----------|
| 1 | OK | 0x1 | Succeeded |
| 2 | Device Busy | 0x20000001 | Not enough memory |
| 2 | Device Busy | 0x20000004 | Device is busy or no response |
| 2 | Device Busy | 0x20000009 | Network error |
| 3 | Device Error | 0x30000001 | Device hardware error |
| 3 | Device Error | 0x30000005 | Connecting to socket failed |
| 3 | Device Error | 0x30000006 | Sending request failed |
| 3 | Device Error | 0x30000007 | Receiving response message failed |
| 3 | Device Error | 0x30000014 | System error |
| 4 | Invalid Operation | - | Geçersiz işlem |
| 5 | Invalid XML Format | - | Geçersiz XML formatı |
| 6 | Invalid XML Content | - | Geçersiz XML içeriği |
| 7 | Reboot Required | - | Cihaz yeniden başlatılmalı |

Detaylı liste için orijinal `ErrorCode.xlsx` dosyasına bakınız.

---

## 6. Log Types (Log.pdf)

**Ana log tipleri:** Alarm, Exception, Operation, Event, Information

**Örnek alarm log tipleri:**
- shortCircuit, brokenCircuit, passwordError
- idCardIllegally (Invalid Card ID)
- devRemove (Device Tampered)
- UrgencyBtnON (Panic Button)

---

## 7. Region / Country Codes

Plaka tanıma için bölge ve ülke kodları. Erişim kontrolü entegrasyonunda doğrudan kullanılmaz.

**Örnek bölge kodları:** ER, EU, ME, APAC, India, All  
**Örnek ülke kodları:** 46 Turkey, 59 China, 80 Japan, 86 India

---

## 8. ngsaccess Uyumluluk Notları

1. **HTTP Listening** cihazda `httpHosts` veya eşdeğer menü ile yapılandırılır (Event > Normal Event > Linkage > HTTP/Notify Surveillance Center).
2. **Request URI** = `https://notable-tern-4.convex.site/card-reader`
3. ngsaccess `convex/http.ts` şu formatları destekler:
   - `EventNotificationAlert` (cardNo, serialNumber, deviceSerialNo…)
   - `AcsEvent`
   - Düz JSON alanları (cardNo, serialNumber)
4. `deviceSerial` ngsaccess'te Hikvision cihaz seri numarası ile eşleşmeli.

---

## 9. Kaynaklar

- Hikvision TPP: https://tpp.hikvision.com
- Orijinal paket: `ISAPI_FingerPrint Terminals_Pro Series` (Downloads)
- ngsaccess entegrasyon rehberi: `docs/HIKVISION_ENTEGRASYON.md`
