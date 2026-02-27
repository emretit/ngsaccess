# Hikvision Cihaz Entegrasyonu

Bu doküman, ngsaccess projesinin Hikvision erişim kontrol cihazları ile nasıl entegre edileceğini açıklar.

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

- Her Hikvision cihazını ngsaccess `devices` tablosuna ekle
- `deviceSerial` alanı Hikvision cihaz seri numarası ile birebir eşleşmeli

### 3. Kişi Senkronizasyonu (Opsiyonel)

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
- Hik-Connect Team OpenAPI
- HikCentral Professional OpenAPI
