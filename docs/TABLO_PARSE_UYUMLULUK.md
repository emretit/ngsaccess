# Tablo ve Parse Uyumluluk – Kart Okuyucu / Event

Bu dokümanda **Convex tabloları**, **Hikvision event parse çıktısı** ve **processCardReading** girişi tek yerde toplanıp karşılıklı uyumluluk kontrol edilir.

---

## 1. İlgili Convex Tabloları

### 1.1 `employees`

| Alan | Tip | Parse / event ile ilişki |
|------|-----|---------------------------|
| `_id` | Id | — |
| `projectId` | Id? | — |
| `firstName`, `lastName` | string | `employeeName` = firstName + " " + lastName |
| `cardNumber` | string | **Event’ten gelen kart no ile eşleşir** (parse → `user_id` / `cardNo`) |
| `isActive` | boolean? | false ise erişim reddedilir |
| … | | |

**Eşleme:** Event’ten çıkan **kart numarası** → `employees.cardNumber` (index: `by_card`).

---

### 1.2 `devices`

| Alan | Tip | Parse / event ile ilişki |
|------|-----|---------------------------|
| `_id` | Id | cardReadings’e `deviceId` olarak yazılır |
| `projectId` | Id? | — |
| `deviceSerial` | string? | **Event’ten gelen cihaz seri no ile eşleşir** (parse → `serial`) |
| `name`, `deviceIp`, `deviceType`, … | | — |

**Eşleme:** Event’ten çıkan **cihaz seri no** → `devices.deviceSerial` (index: `by_device_serial`).

---

### 1.3 `cardReadings`

| Alan | Tip | Kaynak |
|------|-----|--------|
| `projectId` | Id? | employee veya device’tan |
| `deviceId` | Id? | device._id (serial ile bulunan cihaz) |
| `employeeId` | Id? | employee._id (cardNo ile bulunan çalışan) |
| `cardNo` | string | **Parse çıktısı: kart no** (event’ten) |
| `employeeName` | string? | employee.firstName + " " + employee.lastName |
| `accessTime` | string | ISO 8601 (işlem anı) |
| `accessStatus` | "izin_verildi" \| "reddedildi" | İş kuralına göre |
| `rawData` | string? | Ham event body (rawBody) |
| `createdAt`, `updatedAt` | string? | accessTime ile aynı |

**Zorunlu alan:** Sadece `cardNo` ve `accessTime` schema’da zorunlu; diğerleri optional.

---

## 2. Parse Çıktısı → processCardReading → Tablo

```
[Hikvision POST body]
        │
        ▼  parseCardReaderBody(raw, contentType)
        │  Çıktı: { user_id, serial }
        │
        ▼  processCardReading({ cardNo, deviceSerial, rawBody })
        │  cardNo = user_id, deviceSerial = serial, rawBody = raw
        │
        ▼  DB: employees.by_card(cardNumber = cardNo)
        │  DB: devices.by_device_serial(deviceSerial = deviceSerial)
        │  DB: insert cardReadings { cardNo, deviceId, employeeId, accessTime, accessStatus, ... }
```

| Parse çıktı alanı | processCardReading arg | Tablo / işlem |
|-------------------|-------------------------|----------------|
| `user_id` | `cardNo` | cardReadings.cardNo, employees.cardNumber ile arama |
| `serial` | `deviceSerial` | devices.deviceSerial ile arama → deviceId |
| — | `rawBody` | cardReadings.rawData |

---

## 3. Hikvision → Parse Girişi (Alan Eşlemesi)

Parser’ın okuduğu Hikvision alanları (wrapper’lar: EventNotificationAlert, AcsEvent, AccessControllerEvent veya düz body):

| Hikvision alanı (kart no) | Parse çıktısı |
|---------------------------|----------------|
| `cardNo`, `cardNumber`, `credentialNo`, `credentialsNo`, `employeeNo`, `employeeNoString` | → `user_id` |

| Hikvision alanı (cihaz seri) | Parse çıktısı |
|-------------------------------|----------------|
| `serialNumber`, `deviceSerialNo`, `deviceSerial`, `deviceID`, `serialNo`, `macAddress` | → `serial` |

**Uyumluluk:**  
- `user_id` → `cardNo` (processCardReading) → `cardReadings.cardNo` ve `employees.cardNumber` ile arama.  
- `serial` → `deviceSerial` (processCardReading) → `devices.deviceSerial` ile arama, bulunan cihazın `_id` → `cardReadings.deviceId`.  
- Tablolarda ek bir alan gerekmez; mevcut şema parse ve iş akışı ile uyumlu.

---

## 4. Kontrol Listesi

- [ ] **employees:** En az bir çalışanın `cardNumber` değeri, Hikvision’ın gönderdiği kart no ile **aynı** (trim, büyük/küçük harf dahil).
- [ ] **devices:** Cihaz kaydında `deviceSerial`, Hikvision’ın gönderdiği seri no ile **aynı** (örn. `DS-K1T343MFWX20240702V032100ENFT9649880`).
- [ ] **cardReadings:** Zorunlu alanlar `cardNo`, `accessTime`; processCardReading tüm insert’lerde bunları ve optional alanları dolduruyor.
- [ ] **Parse:** Yeni bir endpoint (Convex HTTP, Supabase Edge, vb.) kullanacaksanız, aynı alan listeleriyle (cardFields, serialFields) parse yapıp `cardNo` + `deviceSerial` + `rawBody` ile processCardReading’i çağırın.

---

## 5. İlgili Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `convex/schema.ts` | employees, devices, cardReadings şeması |
| `convex/cardReadings.ts` | processCardReading (internal mutation) |
| `convex/lib/cardReaderParse.ts` | Parse alan listeleri ve parseCardReaderBody (paylaşımlı) |
| `docs/HIKVISION_HOST1_ALAN_ESLEMESI.md` | Hikvision alan adları detayı |

Parse mantığı artık `convex/lib/cardReaderParse.ts` içinde; HTTP endpoint kaldırıldığı için yeni bir endpoint (Convex action veya dış servis) bu modülü kullanarak aynı eşlemeyle veriyi işleyebilir.
