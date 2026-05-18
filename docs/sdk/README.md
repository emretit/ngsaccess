# Hikvision Device Network SDK — Türkçe Referans

> **Kaynak PDF:** [Device Network SDK (Card-Based Access Control)_Developer Guide_V6.1.5.X_20230330.pdf](../../Device%20Network%20SDK%20%28Card-Based%20Access%20Control%29_Developer%20Guide_V6.1.5.X_20230330.pdf) — 526 sayfa

Bu klasör, 526 sayfalık resmi Hikvision PDF'inin **ngsaccess projesi için süzülmüş** Türkçe referansını içerir. Stil: TR özet + EN orijinal kod blokları + ngsaccess kod referansları.

## Hızlı Yön Bul

### 🚀 Yeni başlıyorsan
1. [01-overview.md](./01-overview.md) — SDK nedir, hangi cihazlar, hangi protokol?
2. [02-typical-applications/2.6-alarm-event-receiving.md](./02-typical-applications/2.6-alarm-event-receiving.md) ⭐ — En kritik: cihazdan event nasıl alınır?
3. [appendix-c/c.1-access-control-event-types.md](./appendix-c/c.1-access-control-event-types.md) ⭐ — Event kodlarının anlamı
4. [appendix-a-request-uris.md](./appendix-a-request-uris.md) — Tüm ISAPI endpoint katalogu

### 📚 Konu bazlı arıyorsan
- **Kart okutma event'i** → [2.6-alarm-event-receiving](./02-typical-applications/2.6-alarm-event-receiving.md) + [c.1](./appendix-c/c.1-access-control-event-types.md)
- **Çalışan kartını cihaza işleme** → [2.2-manage-card-information](./02-typical-applications/2.2-manage-card-information.md)
- **Kapıyı uzaktan açma** → [2.7-remote-door-control](./02-typical-applications/2.7-remote-door-control.md)
- **TC kimlik okuma** → [appendix-a A.10-A.11](./appendix-a-request-uris.md)
- **Yüz tanıma** → [2.3-manage-face-information](./02-typical-applications/2.3-manage-face-information.md)
- **Parmak izi** → [2.4-manage-fingerprint-information](./02-typical-applications/2.4-manage-fingerprint-information.md)
- **Erişim takvimi** → [2.5-schedule-settings](./02-typical-applications/2.5-schedule-settings.md)
- **Turnike** → [2.9-turnstile-settings](./02-typical-applications/2.9-turnstile-settings.md)
- **SDK hata kodları** → [appendix-c c.3-sdk-errors](./appendix-c/c.3-sdk-errors.md)
- **HTTP response kodları** → [appendix-c c.5-text-protocol-response-codes](./appendix-c/c.5-text-protocol-response-codes.md)

---

## Tam İçindekiler

### Chapter 1 — Overview
- [01-overview.md](./01-overview.md) — SDK kapsamı, protokol seçimi, sürüm tarihi

### Chapter 2 — Typical Applications (Pratik İş Akışları)
- [2.1-data-collection.md](./02-typical-applications/2.1-data-collection.md) — Online/Offline veri toplama, parmak izi recorder
- [**2.2-manage-card-information.md**](./02-typical-applications/2.2-manage-card-information.md) ⭐ — Kart ekle/sorgula/sil
- [2.3-manage-face-information.md](./02-typical-applications/2.3-manage-face-information.md) — Yüz bilgisi yönetimi
- [2.4-manage-fingerprint-information.md](./02-typical-applications/2.4-manage-fingerprint-information.md) — Parmak izi yönetimi
- [2.5-schedule-settings.md](./02-typical-applications/2.5-schedule-settings.md) — Auth mode + access permission + door control takvimleri
- [**2.6-alarm-event-receiving.md**](./02-typical-applications/2.6-alarm-event-receiving.md) ⭐ — Arming / Listening / Search modları
- [2.7-remote-door-control.md](./02-typical-applications/2.7-remote-door-control.md) — Uzaktan kapı kontrolü
- [2.8-status-monitoring.md](./02-typical-applications/2.8-status-monitoring.md) — Durum izleme + attendance
- [2.9-turnstile-settings.md](./02-typical-applications/2.9-turnstile-settings.md) — Lane controller, main controller
- [2.10-other-applications.md](./02-typical-applications/2.10-other-applications.md) — Diğer

### Chapter 3 — API Reference
- [03-api-reference.md](./03-api-reference.md) — `NET_DVR_*` fonksiyonları (Login, Init, Cleanup, GetDeviceConfig, SetDeviceConfig, STDXMLConfig, StartRemoteConfig, SetupAlarmChan, StartListen, vb.)

### Chapter 4 — Structures and Enumerations
- [04-structures-enumerations.md](./04-structures-enumerations.md) — 92 struct + enum (`NET_DVR_ACS_EVENT_INFO`, `NET_DVR_CARD_CFG_V50`, `NET_DVR_FACE_PARAM_CFG` vb.)

### Appendix A — Request URIs
- [**appendix-a-request-uris.md**](./appendix-a-request-uris.md) ⭐ — Tüm ISAPI endpoint katalog (71 URI)

### Appendix B — Request/Response Messages
- [appendix-b-json-xml-messages.md](./appendix-b-json-xml-messages.md) — JSON ve XML payload tanımları

### Appendix C — Appendixes
- [**c.1-access-control-event-types.md**](./appendix-c/c.1-access-control-event-types.md) ⭐ — Event major/minor kodları
- [c.2-event-linkage-types.md](./appendix-c/c.2-event-linkage-types.md) — Event linkage tipleri
- [c.3-sdk-errors.md](./appendix-c/c.3-sdk-errors.md) — SDK hata kodları
- [c.4-hcnetsdk-log-types.md](./appendix-c/c.4-hcnetsdk-log-types.md) — Log tipleri
- [c.5-text-protocol-response-codes.md](./appendix-c/c.5-text-protocol-response-codes.md) — HTTP response kodları

---

## Bu Klasörü Nasıl Kullanmalı

1. **PDF açmaktan kaçın** — md'den oku, grep ile ara
2. **⭐ işaretliler** ngsaccess için kritik dosyalar
3. Her md dosyasının altında **"İlgili Belgeler"** var — ngsaccess kod yollarına link verir
4. Kod bloklarındaki C/C++ örnekleri PDF'ten **birebir alındı** — Convex ISAPI çağrılarına çevirirken referans olur
5. Eksik gördüğün bilgi için **PDF sayfa numarasını** her dosyanın başında bulabilirsin (`> Kaynak: ... s.XX-YY`)

## Faz Bazlı Tamamlanma Durumu

- ✅ **Faz 1 (Kritik):** 01-overview, 2.2, 2.6, appendix-a, c.1
- ⏳ **Faz 2 (Tamamlayıcı):** 2.5, 2.7, 2.8, 03-api-reference, 04-structures, appendix-b, c.3
- ⏳ **Faz 3 (Düşük öncelik):** 2.1, 2.3, 2.4, 2.9, 2.10, c.2, c.4, c.5

## ngsaccess Ana Entegrasyon Noktaları

Aşağıdaki kaynak kodları bu SDK ile **doğrudan etkileşime girer**:
- [convex/http.ts](../../convex/http.ts) — `/card-reader` HTTP endpoint (Hikvision'ın Notify Surveillance Center hedefi)
- [convex/lib/cardReaderParse.ts](../../convex/lib/cardReaderParse.ts) — gelen event payload'unu parse eder (`majorEventType`, `subEventType` → kullanışlı düz JSON)
- [convex/actions/hikvisionSync.ts](../../convex/actions/hikvisionSync.ts) — kişi/kart senkronizasyon action
- [convex/seedHikvisionLanDevice.ts](../../convex/seedHikvisionLanDevice.ts) — LAN cihaz seed
- [docs/HETZNER_CARD_READER_BRIDGE.md](../HETZNER_CARD_READER_BRIDGE.md) — Hetzner üzerinde proxy bridge mimarisi
- [docs/HIKVISION_ENTEGRASYON.md](../HIKVISION_ENTEGRASYON.md) — Genel kurulum rehberi
