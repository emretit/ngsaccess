# Genel Bakış (Overview)

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Bölüm 1, s.1–7

## Özet

**HCNetSDK (Device Network SDK)**, Hikvision erişim kontrol cihazlarını üçüncü taraf yazılımlara entegre etmek için sunulan resmi SDK'dır. SDK'nın bu varyantı (Card-Based Access Control), **kartı temel yönetim birimi** olarak kabul eder:
- Yüz, parmak izi ve diğer kimlik özellikleri **bir karta bağlanır**
- Yetkilendirme, takvim ve gruplar karta atanır
- Cihaz event'leri karta ait okuma olarak yayınlanır

## Kapsam

SDK aşağıdaki cihaz tiplerini destekler:
- Access Controller (DS-K2600 serisi vb.) — bağımsız erişim kontrolcü
- Access Control Terminal (DS-K1T serisi) — terminal cihazı
- Fingerprint Access Control Terminal — parmak izli terminal
- **Face Recognition Terminal** (DS-K1T671M vb.) — yüz tanıma terminal
- Elevator Controller — asansör erişim
- Swing Barrier / Turnstile — turnike

## Sağlanan Fonksiyonlar

| Fonksiyon | Bölüm |
|---|---|
| Schedule configuration (auth mode, access permission, door control) | [2.5](./02-typical-applications/2.5-schedule-settings.md) |
| Card / Fingerprint / Face information management | [2.2](./02-typical-applications/2.2-manage-card-information.md), [2.3](./02-typical-applications/2.3-manage-face-information.md), [2.4](./02-typical-applications/2.4-manage-fingerprint-information.md) |
| Alarm/event configuration ve receiving | [2.6](./02-typical-applications/2.6-alarm-event-receiving.md) |
| Door control (remote open/close/remain open) | [2.7](./02-typical-applications/2.7-remote-door-control.md) |
| Data collection (online/offline) | [2.1](./02-typical-applications/2.1-data-collection.md) |
| Status monitoring, attendance | [2.8](./02-typical-applications/2.8-status-monitoring.md) |
| Turnstile (lane controller) settings | [2.9](./02-typical-applications/2.9-turnstile-settings.md) |

## İki Konuşma Protokolü

SDK iki şekilde cihazlarla iletişim kurar:

### 1. HCNetSDK (Binary / C/C++ DLL)
- `NET_DVR_*` fonksiyonları
- Persistan TCP bağlantısı, callback'ler
- Windows DLL (`HCNetSDK.dll`) veya Linux .so
- C/C++ veya FFI binding gerektirir
- **Use-case:** Düşük seviye entegrasyon, real-time alarm receiving

### 2. ISAPI (HTTP/HTTPS Text Protocol) ⭐
- Standart HTTP istekleri
- JSON veya XML payload
- Digest auth
- Endpoint örnekleri: `GET /ISAPI/System/deviceInfo`, `POST /ISAPI/AccessControl/AcsEvent`
- **Use-case:** Modern entegrasyon (Convex, web backend) — ngsaccess'in tercihi

`NET_DVR_STDXMLConfig` API'si HCNetSDK içinden ISAPI çağrılarını wrap eder — yani aynı işi iki yoldan yapabilirsin.

## Versiyon: V6.1.5.X (20230330)

Manuel V6.1.5.20 (Oct., 2020) baz alınarak hazırlanmıştır. Önemli güncellemeler:

- **2020-10:** Encryption parametreleri eklendi (`security`, `iv` query parametreleri) — `CapturePresetParam`, `CaptureCardInfo`, `CaptureIDInfo` URI'lerinde AES128/AES256 CBC desteği
- **2020-10:** FeliCa ve DESFire kart tipleri eklendi (`cardType` node'una `FelicaCard`, `DesfireCard` değerleri)
- **2020-10:** `/ISAPI/AccessControl/OfflineCapture/uploadFailedDetails?format=json` URI eklendi — başarısız upload kişi listesini almak için

## Sürüm Geçmişi Detayı

Tam sürüm geçmişi için PDF s.1–7. Kritik değişiklikler güncel doc'larda yansıtıldı — buraya tekrar yazmıyoruz çünkü cihaz firmware sürümüne göre değişir; pratikte cihaz `/ISAPI/AccessControl/capabilities` ile sorgulanarak hangi feature'ların var olduğu kontrol edilmelidir.

---

## ngsaccess'te Hangi Yol?

**ISAPI HTTP** önerilir çünkü:
1. Convex backend doğrudan HTTP fetch yapabilir (action içinden)
2. HCNetSDK DLL'i deploy etmek gerekmez
3. Hetzner bridge / proxy zaten HTTP konuşuyor
4. Tüm modern Hikvision cihazları ISAPI destekler

HCNetSDK sadece **real-time event listening** gerektiğinde ve `/card-reader` HTTP Notify Surveillance Center yetersiz kaldığında düşünülmelidir (örneğin LAN-only cihazlar için bridge process).

---

## İlgili Belgeler
- [docs/sdk/README.md](./README.md) — Tüm bölümlerin indeksi
- [docs/sdk/02-typical-applications/2.6-alarm-event-receiving.md](./02-typical-applications/2.6-alarm-event-receiving.md) — En kritik akış
- [docs/sdk/appendix-a-request-uris.md](./appendix-a-request-uris.md) — Tüm ISAPI URI'ları
- [docs/HIKVISION_ENTEGRASYON.md](../HIKVISION_ENTEGRASYON.md) — Genel kurulum rehberi
