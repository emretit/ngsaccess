# Hikvision: Curl ile ISAPI Kontrol Rehberi

Menüde ISAPI / HTTP Listening ayarlarını göremiyorsanız, **tüm yapılandırma ve kontrolü curl ile** yapabilirsiniz. Bu rehberde her endpoint’in **ne işe yaradığı** ve **hangi curl komutunun ne döndürdüğü** tek yerde toplanmıştır.

---

## 1. Ortam Değişkenleri (Tüm komutlarda kullanın)

Terminalde bir kez tanımlayın (IP, kullanıcı ve şifreyi kendi cihazınıza göre değiştirin):

```bash
export HIK_IP="192.168.1.27"
export HIK_USER="admin"
export HIK_PASS="ngs05278"
```

Curl’da digest auth kullanıyoruz (Hikvision genelde bunu ister):

```bash
C="curl -s -k -u $HIK_USER:$HIK_PASS --digest --connect-timeout 5"
```

---

## 2. Neyin Nesi? – Endpoint Özeti

| Endpoint | Ne işe yarar? | Curl ile ne yaparsınız? |
|----------|----------------|--------------------------|
| **/ISAPI/System/deviceInfo** | Cihaz adı, model, seri no, firmware, MAC | GET → Cihaz kimliği, `deviceSerial` için seri no |
| **/ISAPI/Event/notification/httpHosts/capabilities** | Cihaz HTTP Listening destekliyor mu? | GET → `HttpHostNotificationCap` true/false |
| **/ISAPI/Event/notification/httpHosts** | Tüm HTTP Listening host listesi | GET → Mevcut ayarlar; PUT → Tüm host’ları yaz |
| **/ISAPI/Event/notification/httpHosts/1** | Sadece Host 1 (Convex’e gönderim) | GET → Host 1 ayarı; PUT → Convex URL’ini ayarla |
| **/ISAPI/System/network/interfaces/1** | Ağ: IP, mask, gateway, DNS | GET → IP/DNS durumu; PUT → DNS aç/kapa (bazı modellerde kısıtlı) |
| **/ISAPI/Event/notification/httpHosts/1/test** | Host 1’e test eventi gönder | POST → Bazı modellerde desteklenmez |

---

## 3. Curl Komutları (Kopyala-Yapıştır)

### 3.1 Cihaz bilgisi (seri no, model)

```bash
$C "http://$HIK_IP/ISAPI/System/deviceInfo"
```

**Ne görürsünüz:** XML içinde `deviceName`, `model`, `serialNumber`, `firmwareVersion`, `macAddress`.  
**Neden önemli:** ngsaccess’te cihaz eklerken **Seri Numarası** alanına bu `serialNumber` değerini **aynen** yazmalısınız.

### 3.2 HTTP Listening destekleniyor mu?

```bash
$C "http://$HIK_IP/ISAPI/Event/notification/httpHosts/capabilities"
```

**Ne görürsünüz:** `<HttpHostNotificationCap>true</HttpHostNotificationCap>` ise httpHosts (event’i Convex’e gönderme) kullanılabilir.

### 3.3 Mevcut HTTP Host ayarları (event nereye gidiyor?)

```bash
$C "http://$HIK_IP/ISAPI/Event/notification/httpHosts"
```

**Ne görürsünüz:** Tüm host’ların listesi; her biri için `url`, `protocolType`, `parameterFormatType`, `hostName`, `enabled` vb.  
**Host 1’i tek başına:**

```bash
$C "http://$HIK_IP/ISAPI/Event/notification/httpHosts/1"
```

Burada `url` alanı Convex’e gönderim adresiniz olmalı (örn. `https://...convex.site/card-reader`).

### 3.4 Ağ ayarları (IP, DNS)

```bash
$C "http://$HIK_IP/ISAPI/System/network/interfaces/1"
```

**Ne görürsünüz:** `ipAddress`, `subnetMask`, `DefaultGateway`, `PrimaryDNS`, `DNSEnable`.  
**Neden önemli:** Cihaz Convex’e **hostname** ile gidiyorsa (örn. `notable-tern-4.convex.site`) **DNS’in açık** (`DNSEnable: true`) olması gerekir; yoksa event’ler Convex’e ulaşmaz.

---

## 4. Convex’e Gönderim URL’ini Curl ile Ayarlama (httpHosts)

Menüde ISAPI görünmüyorsa, Host 1’i **sadece curl ile** ayarlayabilirsiniz.

### 4.1 Önce mevcut Host 1’i alın (şablon için)

```bash
$C "http://$HIK_IP/ISAPI/Event/notification/httpHosts/1"
```

Dönen XML’i bir dosyaya kaydedip düzenleyebilir veya aşağıdaki örnekleri kullanabilirsiniz.

### 4.2 Host 1’i Convex URL ile güncelleme (XML ile PUT)

Convex deployment URL’inizi alın (Convex Dashboard → Settings → URL). Örnek: `https://notable-tern-4.convex.site/card-reader`.

**XML örnek (tek host):** Cihazın döndüğü XML yapısına benzer olacak şekilde; tipik alanlar:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification version="2.0">
  <id>1</id>
  <url>https://NOTABLE-TERN-4.convex.site/card-reader</url>
  <protocolType>HTTPS</protocolType>
  <parameterFormatType>JSON</parameterFormatType>
  <addressingFormatType>hostname</addressingFormatType>
  <hostName>notable-tern-4.convex.site</hostName>
  <httpAuthenticationMethod>none</httpAuthenticationMethod>
  <enabled>true</enabled>
  <method>POST</method>
</HttpHostNotification>
```

`NOTABLE-TERN-4` ve `hostName` kısımlarını kendi Convex URL’inize göre değiştirin. Dosyaya kaydedin (örn. `host1.xml`) ve:

```bash
curl -s -k -u "$HIK_USER:$HIK_PASS" --digest -X PUT \
  -H "Content-Type: application/xml" \
  --data-binary @host1.xml \
  "http://$HIK_IP/ISAPI/Event/notification/httpHosts/1"
```

**Not:** Bazı modellerde tam XML yapısı farklı olabilir (örn. `HttpHostNotificationList` içinde tek eleman). Bu durumda önce `GET .../httpHosts/1` çıktısını inceleyip aynı tag isimlerini kullanın.

### 4.3 JSON ile denemek (cihaz destekliyorsa)

```bash
curl -s -k -u "$HIK_USER:$HIK_PASS" --digest -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://notable-tern-4.convex.site/card-reader",
    "protocolType": "HTTPS",
    "parameterFormatType": "JSON",
    "addressingFormatType": "hostname",
    "hostName": "notable-tern-4.convex.site",
    "httpAuthenticationMethod": "none",
    "enabled": true,
    "method": "POST"
  }' \
  "http://$HIK_IP/ISAPI/Event/notification/httpHosts/1"
```

Cihaz hata verirse (bad request, unsupported) PUT body’yi **XML** ile yapın (4.2).

---

## 5. Tek Komutla “Neyin Nesi?” Çıktısı

Projedeki script’i kullanarak tüm özeti tek seferde alabilirsiniz:

```bash
./scripts/hikvision-isapi-ayarlar.sh
```

Veya IP’yi vererek:

```bash
HIKVISION_IP=192.168.1.27 ./scripts/hikvision-isapi-ayarlar.sh
```

Bu script: deviceInfo, httpHosts, ağ (interface 1), httpHosts capabilities çıktılarını kısaltılmış şekilde listeler.

Daha ayrıntılı “neyin ne olduğu” için:

```bash
./scripts/hikvision-curl-discovery.sh
```

(bu script aşağıda eklenmiştir)

---

## 6. Sık Karşılaşılan Durumlar

| Durum | Anlamı | Ne yapmalı? |
|-------|--------|-------------|
| `401 Unauthorized` | Kullanıcı/şifre veya auth tipi yanlış | `-u user:pass` ve `--digest` kullandığınızdan emin olun |
| `404 Not Found` | Bu modelde bu API yok | Farklı path deneyin veya firmware güncelleyin |
| `methodNotAllowed` (POST .../test) | Bu modelde test endpoint’i yok | Normal; event’i gerçek kart okutarak test edin |
| httpHosts URL dolu ama event gelmiyor | DNS kapalı veya ağ engeli | `GET .../network/interfaces/1` ile DNS’i kontrol edin; hostname kullanıyorsanız DNS’i açın |
| PUT httpHosts 400/403 | Body formatı veya yetki | GET ile dönen XML yapısını birebir kullanıp sadece `url`/`hostName` değiştirin |

---

## 7. Özet

- **ISAPI menüde yoksa** → Tüm okuma/yazma işlemini **curl** ile yapın.
- **Neyin ne olduğunu** görmek için: `GET /ISAPI/System/deviceInfo`, `GET .../httpHosts`, `GET .../httpHosts/1`, `GET .../network/interfaces/1`, `GET .../httpHosts/capabilities`.
- **Convex’e event gönderimi** → Host 1’in `url` alanını Convex `https://...convex.site/card-reader` olacak şekilde **PUT** ile ayarlayın (XML veya cihaz destekliyorsa JSON).
- **Cihaz seri numarası** → `deviceInfo` içindeki `serialNumber`; ngsaccess’teki cihaz kaydında **aynı değer** kullanılmalı.

İlgili diğer dosyalar: `scripts/hikvision-isapi-ayarlar.sh`, `scripts/check-hikvision-httpHosts.sh`, `docs/HIKVISION_WEB_ARAYUZU_ISAPI_SAYFALARI.md`, `docs/HIKVISION_ENTEGRASYON.md`.
