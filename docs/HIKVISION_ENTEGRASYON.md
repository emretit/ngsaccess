# Hikvision Cihaz Entegrasyonu (ISAPI)

Bu doküman, ngsaccess projesinin Hikvision erişim kontrol cihazları ile ISAPI üzerinden nasıl entegre edileceğini adım adım açıklar.

---

## Hızlı Başlangıç: Hikvision Cihazı ISAPI ile Bağlama

### Adım 1: ngsaccess'e Cihaz Ekle

1. **Devices** sayfasına gidin
2. **Yeni Cihaz Ekle** butonuna tıklayın
3. Formu doldurun:
   - **Cihaz Adı:** Örn. "Ana Giriş Hikvision"
   - **Seri Numarası:** Hikvision cihazının seri numarası (Configuration > System > Basic Information'dan alın)
   - **Cihaz Tipi:** Erişim Terminali / Kart Okuyucu / Yüz Tanıma (kullandığınız modele uygun)
   - **IP Adresi:** Cihazın ağdaki IP adresi (örn. 192.168.1.100)
   - Bölge ve kapı bilgilerini seçin
4. **Kaydet**'e tıklayın

> **Önemli:** Seri numarası, Hikvision cihazının gerçek seri numarası ile **birebir aynı** olmalı. Aksi halde event eşleşmez.

### Adım 2: Hikvision Cihazında HTTP Event Forwarding Ayarla

1. Hikvision cihazının web arayüzüne girin: `http://<cihaz-ip>`
2. **Configuration** > **Event** > **Normal Event** (veya **Alarm** > **Event** — model farkına göre değişebilir)
3. **Linkage Method** / **Notify Surveillance Center** / **HTTP** bölümünü bulun
4. **Notify Surveillance Center** veya **HTTP Upload** seçeneğini etkinleştirin
5. **Server URL** alanına şu adresi girin:
   ```
   https://<sizin-convex-deployment>.convex.site/card-reader
   ```
   Örnek: `https://notable-tern-4.convex.site/card-reader`

6. **Event Type** olarak **Access Control** veya **Card Swiped** benzeri erişim event'ini seçin
7. Değişiklikleri kaydedin

> **Not:** Convex deployment URL'inizi Convex Dashboard > Settings > URL bölümünden öğrenebilirsiniz.

### Adım 3: Erişim Kurallarını Tanımla

1. ngsaccess'te **Access Control** sayfasına gidin
2. Cihazı bir erişim grubuna ekleyin
3. Çalışanları ilgili gruba atayın

Bu adımlardan sonra Hikvision cihazından gelen kart okuma eventleri otomatik olarak işlenecektir.

---

## Hikvision Entegrasyon Seçenekleri

Hikvision eğitim portalı (tpp.hikvision.com) ve dokümantasyonuna göre mevcut entegrasyon yöntemleri:

| API/SDK | Kullanım Alanı |
|---------|----------------|
| **ISAPI** | HTTP dinleme, uzaktan doğrulama, toplu kişi verisi, erişim kontrolü olayları |
| **PUSH SDK** | Yüz tanıma terminalleri |
| **DeviceGateway** | Erişim kontrol cihazları (merkezi yönetim) |
| **HCT-OpenAPI** (Hik-Connect Team) | Kişi yönetimi, token/alan bilgisi, erişim kontrol modülü |
| **Hik-Partner Pro OpenAPI** | Genel entegrasyon |
| **HikCentral Professional OpenAPI** | Kurumsal entegrasyon |

**ISUP 5.0:** Cihazlar TCP 7660 ile merkezi bir sunucuya bağlanır. Convex doğrudan TCP dinlemediği için arada bir **ISUP Gateway** gerekir; gateway olayları Convex `/card-reader` endpoint'ine HTTP ile iletir. Ayrıntılar için bkz. [HIKVISION_ISUP5_ENTEGRASYON.md](./HIKVISION_ISUP5_ENTEGRASYON.md).

### Eğitim Modülleri (Access Control)

- **ISAPI:** How to Receive Access Control Event Info. in ISAPI
- **ISAPI:** How to Achieve Remote Verification by HTTP Listening
- **ISAPI:** How to Send Person Data in Batch
- **PUSH SDK:** How to Integrate Face Recognition Terminals by PUSH SDK
- **DeviceGateway:** How to Integrate Access Control Devices via DeviceGateway
- **HCT-OpenAPI:** How to Manage Persons via HCT-OpenAPI
- **HCT-OpenAPI:** How to Get Token and Area Information via HCT
- **HCT-OpenAPI:** How to Manage the Access Control Module via HCT-OpenAPI
- **HikCentral Professional OpenAPI:** Integration Introduction

---

## ngsaccess Mevcut Yapı

### HTTP Endpoint

- **URL:** `POST /card-reader`
- **Kaynak:** `convex/http.ts`

### Kabul Edilen Body Formatları

```json
// Format 1
{ "user_id,serial": "CARD_NO,DEVICE_SERIAL" }

// Format 2
{ "CARD_NO": "CARD_NO,DEVICE_SERIAL" }

// Format 3
{ "user_id": "CARD_NO", "serial": "DEVICE_SERIAL" }
```

### Hikvision ISAPI Formatları (Otomatik Desteklenir)

ngsaccess, Hikvision'ın HTTP callback ile gönderdiği aşağıdaki formatları otomatik olarak işler:

```json
// JSON - EventNotificationAlert
{ "EventNotificationAlert": { "cardNo": "12345678", "serialNumber": "DS-K1T671M...", ... } }

// JSON - AcsEvent
{ "AcsEvent": { "cardNo": "12345678", "deviceSerialNo": "DS-K1T671M...", ... } }

// JSON - Düz alanlar
{ "cardNo": "12345678", "serialNumber": "DS-K1T671M...", ... }
```

### İş Akışı (processCardReading)

1. Çalışanı `cardNumber` ile bul
2. Cihazı `deviceSerial` ile bul
3. Cihazın erişim grubunda olup olmadığını kontrol et
4. Çalışanın erişim kuralına göre yetkisini kontrol et
5. `cardReadings` tablosuna kayıt oluştur
6. Yanıt: `{ "cevap": "ok" }` veya `{ "cevap": "error" }`

### Cihaz Şeması (devices tablosu)

- `deviceSerial` – Cihaz seri numarası (Hikvision cihazı ile eşleşmeli)
- `deviceIp` – Cihaz IP adresi
- `deviceType` – Cihaz tipi
- `name`, `zoneId`, `doorId`, `accessDirection`, vb.

---

## Önerilen Entegrasyon Yolu

### 1. ISAPI – HTTP Event Forwarding (Öncelikli)

**Neden:** ngsaccess zaten HTTP POST ile kart okuma alıyor. Hikvision cihazları ISAPI üzerinden erişim olaylarını HTTP callback ile gönderebilir.

**Adımlar:**

1. Hikvision cihazında HTTP callback / event forwarding ayarlarını yapılandır
2. Hedef URL: `https://<convex-deployment>.convex.site/card-reader`
3. Hikvision’ın gönderdiği event formatını ngsaccess formatına map et (gerekirse `convex/http.ts` içinde ek parser)

### 2. Cihaz Kaydı

- Her Hikvision cihazını ngsaccess `devices` tablosuna ekle (Yeni Cihaz Ekle formu ile)
- `deviceSerial` alanı Hikvision cihaz seri numarası ile birebir eşleşmeli

### 3. Hikvision Cihaz Menüsü Yolları (Model Bazlı)

HTTP event forwarding ayarları model ve firmware sürümüne göre farklı yerlerde olabilir:

| Menü Yolu | Not |
|-----------|-----|
| Configuration > Event > Normal Event > Linkage Method > Notify Surveillance Center | Yaygın erişim terminalleri |
| Configuration > Alarm > Event > HTTP | Bazı modeller |
| Event > Access Control > Linkage | DS-K1T671M benzeri |
| Event > Smart Event > Card Swiped > HTTP Notification | Kart okuyucu modelleri |

### 4. Kişi Senkronizasyonu (Opsiyonel)

- HCT-OpenAPI veya ISAPI batch person API ile çalışanları Hikvision cihazlarına senkronize et
- ngsaccess’teki `employees.cardNumber` Hikvision’daki person/card bilgisi ile uyumlu olmalı

---

## Netleştirilmesi Gerekenler

1. **Cihaz modeli:** Hangi Hikvision modeli kullanılacak? (örn. DS-K1A802, DS-K1T671M)
2. **Event formatı:** Hikvision’ın HTTP callback ile gönderdiği JSON formatı nedir?
3. **Yüz tanıma:** Sadece kart mı, yoksa yüz tanıma terminalleri de var mı? (PUSH SDK gerekebilir)

---

## Kaynaklar

- Hikvision Eğitim Portalı: https://tpp.hikvision.com
- ISAPI dokümantasyonu (cihaz web arayüzünden veya Hikvision destekten)
- [HIKVISION_ISAPI_FACE_RECOGNITION_VALUE_SERIES.md](./HIKVISION_ISAPI_FACE_RECOGNITION_VALUE_SERIES.md) – Yüz tanıma terminalleri Value Series ISAPI rehberi
- [HIKVISION_ISAPI_FINGERPRINT_TERMINALS_DETAYLI.md](./HIKVISION_ISAPI_FINGERPRINT_TERMINALS_DETAYLI.md) – Parmak izi terminalleri Pro Series ISAPI rehberi
- Hik-Connect Team OpenAPI
- HikCentral Professional OpenAPI
