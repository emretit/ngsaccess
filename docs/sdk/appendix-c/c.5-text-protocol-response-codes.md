# Text Protocol (ISAPI) Response Kodları

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Appendix C.5, s.472–525

## Özet

ISAPI HTTP istekleri sonrası dönen `JSON_ResponseStatus` veya `XML_ResponseStatus` payload'undaki **`statusCode`** ve **`subStatusCode`** değerlerinin anlamları. ngsaccess Convex action'ları ISAPI çağırdığında dönen response'u bu tabloya göre yorumlamalı.

## HTTP Status Code'lar

Hikvision **HTTP status code** olarak genelde **200** döner (hata olsa bile). Asıl status:
- `JSON_ResponseStatus.statusCode` — int (1 = OK, diğer = hata)
- `JSON_ResponseStatus.subStatusCode` — string (spesifik hata tipi)
- `JSON_ResponseStatus.errorCode` — int (HCNetSDK error code, opsiyonel)

## Genel statusCode Değerleri

| statusCode | Açıklama |
|---|---|
| **1** | OK — başarılı |
| **2** | Device Busy |
| **3** | Device Error |
| **4** | Invalid Operation |
| **5** | Invalid Message Format / Content |
| **6** | Invalid Param |
| **7** | Reboot Required |
| **8** | Insufficient Capability |
| **9** | Unauthorized — auth gerek |

---

## subStatusCode Listesi (Kategorik Özet)

c.5 bölümü ~50 sayfa boyunca **tüm subStatusCode** değerlerini listeler. Pratik kategori özetleri:

### Auth / Permission
- `ok` — başarılı
- `unauthorized` — kimlik doğrulama gerekli
- `forbidden` — yetki yok
- `invalidPassword` — şifre hatalı
- `userLocked` — kullanıcı kilitli
- `tooManyAttempts` — çok fazla yanlış deneme
- `notActivated` — cihaz aktive edilmemiş
- `riskPassword` — şifre çok zayıf
- `hasActivated` — zaten aktif

### Request / Parameter
- `badRequest` — yanlış format
- `invalidContent` — content hatalı
- `invalidOperation` — desteklenmeyen operasyon
- `missingContent` — eksik field
- `paramError` — parametre hatası
- `methodNotAllowed` — HTTP method yanlış (örn. POST yerine PUT)
- `notSupport` — feature desteklenmiyor

### Device State
- `deviceBusy` — cihaz meşgul
- `deviceError` — cihaz hatası
- `notSupported` — özellik yok
- `rebootRequired` — restart gerek
- `notFound` — kaynak bulunamadı
- `offline` — cihaz offline

### Resource
- `noMemory` — yetersiz bellek
- `noSpace` — disk dolu
- `lowQuality` — düşük kalite (yüz/parmak izi)
- `tooLarge` — çok büyük
- `tooMany` — çok fazla

### Card / Face / Fingerprint Spesifik
- `cardNoConflict` — kart numarası çakışması
- `cardNoNotExist` — kart yok
- `cardNoOutOfRange` — kart no range dışı
- `expiredCard` — süresi geçmiş kart
- `noPermission` — yetkisiz kart
- `invalidCardSwipingPeriod` — geçersiz zaman
- `faceLibFull` — yüz kütüphanesi dolu
- `nameError` — isim hatası
- `modelingFailed` — yüz modeli oluşturulamadı
- `qualityTooLow` — yüz/parmak izi kalitesi düşük
- `duplicateID` — ID çakışması

### Network
- `networkError` — ağ hatası
- `connectionFailed` — bağlantı kurulamadı
- `timeout` — timeout

### Encryption / Security
- `encryptionRequired` — şifreleme gerekli
- `invalidEncryption` — şifreleme hatalı
- `keyError` — anahtar hatası

---

## Tipik Response Örnekleri

### Başarı
```json
{
  "statusCode": 1,
  "statusString": "OK",
  "subStatusCode": "ok"
}
```

### Kart Çakışması
```json
{
  "statusCode": 4,
  "statusString": "Invalid Operation",
  "subStatusCode": "cardNoConflict",
  "errorCode": 1610612752,
  "errorMsg": "Card No. conflicts with existing card."
}
```

### Auth Hatası
```json
{
  "statusCode": 9,
  "statusString": "Unauthorized",
  "subStatusCode": "unauthorized"
}
```

### Cihaz Aktive Değil
```json
{
  "statusCode": 4,
  "statusString": "Invalid Operation",
  "subStatusCode": "notActivated",
  "errorCode": 250
}
```

### Method Yanlış
```json
{
  "statusCode": 4,
  "statusString": "Invalid Operation",
  "subStatusCode": "methodNotAllowed"
}
```

---

## ngsaccess Tarafında Notlar

### Convex'te Yorumlama
```typescript
// convex/lib/hikvisionResponse.ts (önerilen)
interface HikvisionResponse {
  statusCode: number;
  statusString: string;
  subStatusCode: string;
  errorCode?: number;
  errorMsg?: string;
}

export function isSuccess(res: HikvisionResponse): boolean {
  return res.statusCode === 1 && res.subStatusCode === "ok";
}

export function getUserMessage(res: HikvisionResponse): string {
  if (isSuccess(res)) return "Başarılı";

  const map: Record<string, string> = {
    "unauthorized":         "Kimlik doğrulama gerekli",
    "forbidden":            "Bu işlem için yetkiniz yok",
    "invalidPassword":      "Şifre hatalı",
    "userLocked":           "Kullanıcı hesabı kilitli",
    "notActivated":         "Cihaz aktive edilmemiş",
    "deviceBusy":           "Cihaz meşgul, biraz sonra tekrar deneyin",
    "offline":              "Cihaza ulaşılamıyor",
    "cardNoConflict":       "Bu kart numarası zaten kayıtlı",
    "cardNoNotExist":       "Kart bulunamadı",
    "expiredCard":          "Kartın süresi dolmuş",
    "faceLibFull":          "Yüz kütüphanesi dolu",
    "qualityTooLow":        "Fotoğraf/parmak izi kalitesi yetersiz",
    "duplicateID":          "Bu kimlik zaten kullanımda",
    "noMemory":             "Cihaz belleği yetersiz",
    "rebootRequired":       "Cihazı yeniden başlatın",
    "notSupport":           "Bu cihaz bu özelliği desteklemiyor",
    "timeout":              "İşlem zaman aşımına uğradı",
  };

  return map[res.subStatusCode] ?? `Hata: ${res.statusString} (${res.subStatusCode})`;
}
```

### HTTP Status vs ISAPI Status
- **HTTP 200** geldi diye işlem başarılı sanma — body içindeki `statusCode: 1` kontrol et
- **HTTP 401** auth header eksik — Digest auth düzelt
- **HTTP 404** URI yanlış — Appendix A katalogu kontrol et
- **HTTP 5xx** cihaz crash veya bug — Hikvision destek

### Detaylı Liste
c.5 bölümü PDF'te 50+ sayfa subStatusCode listesi içerir. Yukarıdaki kategoriler **en sık karşılaşılanlar** — daha az kullanılan kodlar için PDF s.472-525'e bakın.

---

## İlgili Belgeler
- [docs/sdk/appendix-b-json-xml-messages.md](../appendix-b-json-xml-messages.md) — `JSON_ResponseStatus` struct tanımı
- [docs/sdk/appendix-c/c.3-sdk-errors.md](./c.3-sdk-errors.md) — `errorCode` (HCNetSDK) karşılıkları
- [docs/sdk/appendix-a-request-uris.md](../appendix-a-request-uris.md) — Hangi URI ne döner
- [convex/actions/hikvisionSync.ts](../../../convex/actions/hikvisionSync.ts) — Mevcut response handling
