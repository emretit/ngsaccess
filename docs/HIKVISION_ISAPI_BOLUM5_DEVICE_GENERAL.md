# Hikvision ISAPI – 5. Bölüm: Device (General)

**Kaynak:** ISAPI_Face Recognition Terminals_Value Series.pdf  
**Bölüm:** 5. Device (General)

---

## İçindekiler

1. [5.1 Arming and Subscription](#51-arming-and-subscription)
2. [5.2 Device Packet Capture](#52-device-packet-capture)
3. [ngsaccess için Özet](#ngsaccess-için-özet)

---

## 5.1 Arming and Subscription

### 5.1.1 Özet

Client, cihazla **kalıcı HTTP bağlantısı** kurarak event mesajlarını sürekli alır. İki mod vardır:

| Mod | Yöntem | Açıklama |
|-----|--------|----------|
| **Without Subscription** | `GET /ISAPI/Event/notification/alertStream` | Tüm event’ler gelir |
| **With Subscription** | `POST /ISAPI/Event/notification/subscribeEvent` | Sadece abone olunan event’ler gelir |

### 5.1.2 API Akışı

#### 5.1.2.1 Abonelik Olmadan (Without Subscription)

1. Arming bağlantısı kur: `GET /ISAPI/Event/notification/alertStream`
2. Header: `Connection: keep-alive`
3. Gelen event’leri boundary ile ayırıp parse et (aşağıya bakın)
4. Event almayı bitirince bağlantıyı kapat

#### 5.1.2.2 Abonelik ile (With Subscription)

1. System yetenekleri: `GET /ISAPI/System/capabilities` → `isSupportSubscribeEvent=true` kontrolü
2. Abonelik yetenekleri: `GET /ISAPI/Event/notification/subscribeEventCap`
3. Abonelik bağlantısı: `POST /ISAPI/Event/notification/subscribeEvent`
4. Header: `Connection: keep-alive`
5. (Opsiyonel) Abonelik parametrelerini düzenle: `GET`/`PUT` subscribeEvent
6. Event’leri boundary ile parse et
7. (Opsiyonel) Bağlantıyı kapat: `PUT /ISAPI/Event/notification/unSubscribeEvent?ID=<subscribeEventID>`

**Arming bağlantısında üç tür veri:**
- `<SubscribeEventResponse/>` – İlk form, abonelik yanıtı
- `<EventNotificationAlert/>` – Event içeriği veya heartbeat (`eventType=heartBeat`)
- Resim verisi (varsa)

### 5.1.2.3 Event Mesaj Parsing

Arming bağlantısında veriler **multipart/form-data** formatındadır:

```
Content-Type: multipart/form-data; boundary=AaB03x
Connection: keep-alive

--AaB03x
Content-Disposition: form-data; name="ANPR.xml"; filename="ANPR.xml";
Content-Type: application/xml
Content-Length: 9
<ANPR/>

--AaB03x
Content-Disposition: form-data; name="licensePlatePicture.jpg"; filename="...";
Content-Type: image/jpeg
Content-Length: 14
[Image Data]

--AaB03x--
```

**Terimler:**
- `--boundary` – Bir form biriminin başı
- `--boundary--` – Tüm HTTP form mesajının sonu
- **Not:** Arming bağlantısında cihaz genelde son sınırı (`--boundary--`) göndermez; bağlantı açık kalır.

### 5.1.3 Önemli Notlar

- Arming **HTTP/HTTPS persistent connection** kullanır.
- Simplex iletişim: Cihaz event gönderir, istemci bağlantı üzerinden cihaza mesaj gönderemez.
- Heartbeat zaman aşımında mesaj gelmezse arming bağlantısını kapatıp yeniden kurun.

### 5.1.4 EventNotificationAlert Örnek Yapısı

```xml
<EventNotificationAlert version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <ipAddress>10.17.133.46</ipAddress>
  <portNo>80</portNo>
  <protocol>HTTP</protocol>
  <macAddress>44:19:b6:6d:24:85</macAddress>
  <channelID>1</channelID>
  <dateTime>2017-05-04T11:20:02+08:00</dateTime>
  <activePostCount>0</activePostCount>
  <eventType>heartBeat</eventType>
  <eventState>active</eventState>
  <eventDescription>heartBeat</eventDescription>
</EventNotificationAlert>
```

**Erişim kontrol event’lerinde** ek alanlar: `cardNo`, `serialNumber`, `credentialNo`, `deviceSerialNo` vb.

---

## 5.2 Device Packet Capture

### 5.2.1 Genel

Cihaz üzerinde paket yakalama (packet capture):
1. Yerel depolama – Dosyalar cihazda saklanır, sonra export edilir.
2. Cloud depolama – Yakalama sonrası otomatik yükleme.
3. Gerçek zamanlı – HTTP Chunked ile anlık veri akışı.

### 5.2.2 API Akışı

#### 5.2.2.1 Yerel / Cloud Packet Capture

1. `GET /ISAPI/System/capabilities` → `isSupportNetworkCapture`
2. `GET /ISAPI/System/networkCapture/capabilities?format=json`
3. `GET /ISAPI/System/networkCapture/StoragePathInfo?format=json`
4. `PUT /ISAPI/System/networkCapture/captureParams?format=json`
5. `PUT /ISAPI/System/networkCapture/manualStart?format=json&asyn=<asyn>&realTime=<realTime>`
6. `GET /ISAPI/System/networkCapture/manualStatus?format=json`
7. `PUT /ISAPI/System/networkCapture/manualStop?format=json`
8. `GET /ISAPI/System/networkCapture/exportFile?format=json` (yerel depolama varsa)

#### 5.2.2.2 Gerçek Zamanlı Packet Capture

1. `GET /ISAPI/System/capabilities`
2. `GET /ISAPI/System/NetworkCaptureParams/capabilities?format=json` → `realTimeEnabled`
3. `POST /ISAPI/System/StartNetworkCapture?format=json` (realTimeEnabled=true ile)
4. Cihaz bir URI döner; tarayıcıdan indirilebilir.
5. `GET /ISAPI/System/GetNetworkCaptureStatus?format=json`
6. `POST /ISAPI/System/StopNetworkCapture?format=json`

---

## ngsaccess için Özet

| Özellik | ngsaccess Kullanımı |
|---------|---------------------|
| **Listening (httpHosts)** | Cihaz event oluşunca Convex `/card-reader` URL’ine POST atar – **şu an kullandığımız yöntem** |
| **Arming** | Client cihaza bağlanır, event’leri sürekli alır – ngsaccess **kullanmıyor** |
| **Subscription** | Arming’e benzer, sadece abone olunan event’ler – ngsaccess **kullanmıyor** |
| **EventNotificationAlert** | XML/JSON formatı – `/card-reader` parser’ı bunu destekliyor |
| **multipart/form-data** | Event_Type + Picture_Name – parser XML parçasından `cardNo`, `serialNumber` çıkarıyor |

**Sonuç:** ngsaccess **Listening (4.3.2)** modunu kullanıyor; 5. bölümdeki Arming/Subscription modları cihazdan event almak için alternatif yöntemler. Bizim kullandığımız yöntem doğru ve dokümandaki Event formatlarıyla uyumlu.
