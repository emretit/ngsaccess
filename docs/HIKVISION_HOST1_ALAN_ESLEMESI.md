# Hikvision Host 1 – Alan Eşlemesi ve Veri Akışı

## Özet

**Host 1 (httpHosts)** yapılandırmasında cihaz, erişim olaylarını (kart okuma, parmak izi, yüz) HTTP POST ile ngsaccess Convex HTTP endpoint’ine gönderir. Bu dokümanda **Hikvision’ın ne gönderdiği**, **bizim ne aldığımız** ve **kolon/alan isimlerinin eşleşmesi** açıklanır.

---

## 1. Hikvision → ngsaccess Veri Akışı

```
[Hikvision DS-K1T807EBFWX-E1]
         │
         │  HTTP POST
         │  Content-Type: application/json
         │  URL: https://notable-tern-4.convex.site/card-reader
         ▼
[convex/http.ts - card-reader handler]
         │
         │  Parse body → user_id (kart no), serial (cihaz seri no)
         ▼
[cardReadings.processCardReading]
         │
         │  Cihazı serial ile bul, çalışanı user_id ile eşle
         ▼
[ngsaccess - Access Control kaydı]
```

---

## 2. Hikvision’ın Gönderebileceği JSON Yapıları

Model ve firmware’e göre Hikvision farklı sarmalayıcılar ve alan isimleri kullanabilir. ngsaccess parser’ı şu formatları destekler:

### 2.1 EventNotificationAlert (XML’den türetilmiş)

```json
{
  "EventNotificationAlert": {
    "cardNo": "12345678",
    "serialNumber": "DS-K1T807EBFWX-E120250619V042400ENGB8172365",
    "eventType": "accessDenied",
    ...
  }
}
```

### 2.2 AcsEvent (erişim kontrol event’i)

```json
{
  "AcsEvent": {
    "cardNo": "12345678",
    "deviceSerialNo": "DS-K1T807EBFWX-E120250619V042400ENGB8172365",
    ...
  }
}
```

### 2.3 AccessControllerEvent (parmak izi / pro serisi)

```json
{
  "AccessControllerEvent": {
    "cardNo": "12345678",
    "serialNumber": "DS-K1T807EBFWX-E120250619V042400ENGB8172365",
    ...
  }
}
```

### 2.4 Düz (wrapper yok)

```json
{
  "cardNo": "12345678",
  "serialNumber": "DS-K1T807EBFWX-E120250619V042400ENGB8172365"
}
```

---

## 3. Alan Eşleme Tablosu

| Hikvision alanı | ngsaccess kullanımı | Açıklama |
|-----------------|---------------------|----------|
| **Kart / kimlik (user_id)** | | |
| `cardNo` | ✓ `user_id` | Kart numarası |
| `cardNumber` | ✓ `user_id` | Alternatif alan adı |
| `credentialNo` | ✓ `user_id` | Credential ID |
| `credentialsNo` | ✓ `user_id` | Alternatif yazım |
| `employeeNo` | ✓ `user_id` | Person/çalışan numarası |
| `employeeNoString` | ✓ `user_id` | String person ID |
| **Cihaz seri no (serial)** | | |
| `serialNumber` | ✓ `serial` | Cihaz seri numarası |
| `deviceSerialNo` | ✓ `serial` | Alternatif |
| `deviceSerial` | ✓ `serial` | Alternatif |
| `deviceID` | ✓ `serial` | Fallback |
| `serialNo` | ✓ `serial` | Fallback |
| `macAddress` | ✓ `serial` | Son çare – cihaz eşlemesinde MAC kullanılıyorsa |

---

## 4. ngsaccess Tarafında Eşleşme

| ngsaccess tablo/alan | Değer kaynağı | Eşleşme koşulu |
|----------------------|---------------|-----------------|
| `devices.deviceSerial` | Hikvision `serialNumber` / `deviceSerialNo` / vb. | Tam eşleşme ile cihaz bulunur |
| `employees.cardNo` veya ilgili credential | Hikvision `cardNo` / `credentialNo` / vb. | `user_id` ile çalışan bulunur |

**Önemli:** Cihazın `deviceSerial` değeri, Hikvision’ın gönderdiği serial ile **tam olarak aynı** olmalıdır. Örn. `DS-K1T807EBFWX-E120250619V042400ENGB8172365`.

---

## 5. Gerçek Formatı Tespit Etme

Hikvision’ın **AccessControllerEvent** ile tam olarak hangi alan adlarını kullandığı model/firmware’e göre değişebilir. Kesin bilgi için:

1. **Kart veya parmak izi okutun** – Cihaz event gönderecektir.
2. **Convex Dashboard** → Functions → `http/card-reader` → Logs üzerinden gelen isteği inceleyin.
3. İsterseniz geçici olarak `http.ts` içinde `console.log(JSON.stringify(body))` ekleyip gelen JSON’u log’larda görün.

Bu sayede gerçek alan adlarını görüp, gerekiyorsa `cardFields` ve `serialFields` listelerine yeni alan ekleyebilirsiniz.

---

## 6. Hata Durumları

| Hata | Olası sebep | Çözüm |
|------|-------------|-------|
| `user_id missing` | Gönderilen JSON’da kart/kimlik alanı yok veya farklı isimde | Gerçek event’i inceleyin; gerekirse yeni alan adını parser’a ekleyin |
| `serial missing` | Cihaz seri no gönderilmiyor | Aynı şekilde gerçek event’e bakın; `serialFields` listesini güncelleyin |
| `device not found` | `devices` tablosunda bu `serial` ile kayıt yok | Cihazı Devices’a ekleyin; `deviceSerial` değerini Hikvision’dan gelenle birebir eşleştirin |
| `employee not found` | `user_id` ile eşleşen çalışan yok | Çalışanı ekleyin veya kart numarasını kontrol edin |

---

## 7. İlgili Dosyalar

- `convex/http.ts` – card-reader handler, parser mantığı
- `convex/cardReadings.ts` – `processCardReading` iş mantığı
- `docs/HIKVISION_ENTEGRASYON.md` – Genel entegrasyon adımları
- `docs/HIKVISION_ISAPI_FINGERPRINT_TERMINALS_DETAYLI.md` – ISAPI referansı
