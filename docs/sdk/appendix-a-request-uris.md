# Appendix A — Request URIs (ISAPI Endpoint Katalog)

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Appendix A, s.226–266

## Özet

Bu bölüm Hikvision cihazlarının desteklediği **tüm ISAPI HTTP endpoint'lerini** listeler. Endpoint'ler `NET_DVR_STDXMLConfig` API'si ile çağrılabildiği gibi, **doğrudan HTTP fetch ile de** kullanılabilir (Convex action içinden). Genel format:

```
{METHOD} https://<device-ip>/ISAPI/AccessControl/<resource>?format=json
Authorization: Digest user:admin pass:****
Content-Type: application/json   (PUT/POST için)
```

Auth modeli: **Hikvision Digest Auth (RFC 2617)** kullanır. Basic auth genelde devre dışıdır.

Her endpoint'in **request/response payload tipi** Appendix B'de tanımlıdır (`JSON_*`, `XML_*` isimleri ile).

---

## Hızlı Kategori Görünümü

| Kategori | URI Prefix | Kullanım |
|---|---|---|
| Sistem | `/ISAPI/System/...` | Cihaz bilgisi, zaman, I/O |
| PTZ | `/ISAPI/PTZCtrl/...` | Kamera kontrol (PTZ destekli modellerde) |
| Güvenlik CP | `/ISAPI/SecurityCP/...` | Alarm zone arm/disarm |
| Erişim Kontrol | `/ISAPI/AccessControl/...` | ⭐ ngsaccess'in ana kullanım alanı |
| İçerik Yönetimi | `/ISAPI/ContentMgmt/...` | Kayıt/playback |

---

## Genel Endpoint'ler (Generic ISAPI)

| Açıklama | URI | Method | Request | Response |
|---|---|---|---|---|
| Cihaz bilgisi al | `/ISAPI/System/deviceInfo` | GET | – | `XML_DeviceInfo` |
| Cihaz bilgisi düzenle | `/ISAPI/System/deviceInfo` | PUT | – | – |
| Zaman bilgisi | `/ISAPI/System/time` | GET / PUT | – | `XML_TimeData` |
| I/O output listesi | `/ISAPI/System/IO/outputs` | GET | – | `XML_IOOutputPortList` |
| I/O output status | `/ISAPI/System/IO/outputs/<ID>/status` | GET | – | `XML_IOPortStatus` |
| Manuel alarm output tetikle | `/ISAPI/System/IO/outputs/<ID>/trigger` | PUT | – | `XML_ResponseStatus` |
| Erişim event ara | `/ISAPI/AccessControl/AcsEvent?format=json` | POST | `JSON_AcsEvent` | `XML_ResponseStatus` |
| Kişi bilgisi ara | `/ISAPI/AccessControl/UserInfo/Search?format=json` | POST | `JSON_UserInfoSearch` | `XML_ResponseStatus` |

---

## A.1–A.6 — Erişim Event Sayısı + Attendance Mode/Rule

| # | URI | Method | Açıklama | Request | Response |
|---|---|---|---|---|---|
| A.1 | `/ISAPI/AccessControl/AcsEventTotalNum/capabilities?format=json` | GET | Event total num yeteneği | – | `JSON_Cap_AcsEventTotalNum` |
| A.2 | `/ISAPI/AccessControl/AcsEventTotalNum?format=json` | POST | Belirli koşullarda toplam event sayısı | `JSON_AcsEventTotalNumCond` | `JSON_AcsEventTotalNum` |
| A.3 | `/ISAPI/AccessControl/attendanceStatusModeCfg/capabilities?format=json` | GET | Attendance mode yeteneği | – | `JSON_Cap_AttendanceStatusModeCfg` |
| A.4 | `/ISAPI/AccessControl/attendanceStatusModeCfg?format=json` | GET/PUT | Attendance mode get/set | `JSON_AttendanceStatusModeCfg` | `JSON_ResponseStatus` |
| A.5 | `/ISAPI/AccessControl/attendanceStatusRuleCfg/capabilities?format=json` | GET | Attendance rule yeteneği | – | `JSON_Cap_AttendanceStatusRuleCfg` |
| A.6 | `/ISAPI/AccessControl/attendanceStatusRuleCfg?attendanceStatus=&format=json` | GET/PUT | Attendance rule (`checkIn`, `checkOut`, `breakIn`, `breakOut`, `overtimeIn`, `overtimeOut`) | `JSON_AttendanceStatusRuleCfg` | `JSON_ResponseStatus` |

**ngsaccess notu:** Attendance modu ngsaccess'te puantaj (PDKS) ile entegre. `attendanceStatus` parametresine göre her status için ayrı kural tanımlanır.

---

## A.7 — Access Control Yetenek (genel)

| # | URI | Method | Açıklama | Response |
|---|---|---|---|---|
| A.7 | `/ISAPI/AccessControl/capabilities` | GET | Access control komple yetenek matrisi | `XML_Cap_AccessControl` |

> Bu URI **cihaz desteklediği tüm AccessControl özelliklerini** liste halinde döner. Önce burayı çağırıp hangi feature'ların var olduğunu anlamak iyi pratik.

---

## A.8–A.11 — Capture Card/ID Info ⭐ (Kart okuma)

| # | URI | Method | Açıklama | Request | Response |
|---|---|---|---|---|---|
| A.8 | `/ISAPI/AccessControl/CaptureCardInfo/capabilities?format=json` | GET | Kart bilgisi toplama yeteneği | – | `JSON_CardInfoCap` |
| A.9 | `/ISAPI/AccessControl/CaptureCardInfo?format=json` | GET | **Karttan bilgi oku** (cihaz okuyucudan toplar) | – | `JSON_CardInfo_Collection` |
| A.10 | `/ISAPI/AccessControl/CaptureIDInfo/capabilities?format=json` | GET | TC kimlik okuma yeteneği | – | `JSON_IdentityInfoCap` |
| A.11 | `/ISAPI/AccessControl/CaptureIDInfo?format=json` | POST | **TC kimlik karttan oku** | `JSON_IdentityInfoCond` | `JSON_IdentityInfo` |

**Encryption desteği (A.9, A.11):**
- `security` query: `1` = AES128 CBC, `2` = AES256 CBC. Yoksa şifresiz.
- `iv` query: AES IV (security=1/2 için zorunlu)
- A.9'da `cardNo`, A.11'de `IDCardNo` alanı şifrelenir.

**ngsaccess kullanımı:** Bu endpoint'ler **cihazda fiziksel kart okutturduğunda** çağrılır — yani admin ekranında "Kart Okut" butonu basınca cihaz kartı okur ve döner.

---

## A.12–A.15 — Capture Preset & Rule

| # | URI | Method | Açıklama | Payload |
|---|---|---|---|---|
| A.12 | `/ISAPI/AccessControl/CapturePresetParam/capabilities?format=json` | GET | Online collection preset yeteneği | → `JSON_CapturePresetCap` |
| A.13 | `/ISAPI/AccessControl/CapturePresetParam?format=json` | GET/PUT | Preset param get/set | `JSON_CapturePreset` |
| A.14 | `/ISAPI/AccessControl/CaptureRule/capabilities?format=json` | GET | Collection rule yeteneği | → `JSON_CaptureRuleCap` |
| A.15 | `/ISAPI/AccessControl/CaptureRule?format=json` | GET/PUT | Rule get/set | `JSON_CaptureRule` |

---

## A.16–A.29 — Card Operations (M1 / CPU Card)

| # | URI | Method | Açıklama | Sadece | Payload |
|---|---|---|---|---|---|
| A.16 | `/ISAPI/AccessControl/CardOperations/capabilities?format=json` | GET | Kart op yeteneği | – | → `JSON_CardOperationsCap` |
| A.17 | `/ISAPI/AccessControl/CardOperations/cardParam?format=json` | PUT | Kart parametre set | CPU | `JSON_CardParam` |
| A.18 | `/ISAPI/AccessControl/CardOperations/clearData?format=json` | PUT | Karttaki veriyi sil | – | `JSON_ClearData` → `JSON_ClearDataRes` |
| A.19 | `/ISAPI/AccessControl/CardOperations/controlBlock?format=json` | PUT | Section control block değiştir | M1 | `JSON_ControlBlock` |
| A.20 | `/ISAPI/AccessControl/CardOperations/customData/searchTask?format=json` | POST | Custom data ara | – | `JSON_CustomDataSearchCond` → `JSON_CustomDataResult` |
| A.21 | `/ISAPI/AccessControl/CardOperations/customData?format=json` | PUT | Custom data set | – | `JSON_CustomData` |
| A.22 | `/ISAPI/AccessControl/CardOperations/dataBlock/control?format=json` | PUT | Data block op (plus/minus/copy/paste) | – | `JSON_DataBlockCtrl` |
| A.23 | `/ISAPI/AccessControl/CardOperations/dataBlock/<address>?format=json` | GET/PUT | Block data oku/yaz | M1 | `JSON_DataBlock` |
| A.24 | `/ISAPI/AccessControl/CardOperations/dataTrans?format=json` | PUT | Data package pass through | CPU | `JSON_DataTrans` |
| A.25 | `/ISAPI/AccessControl/CardOperations/encryption?format=json` | PUT | Kart şifreleme | CPU | `JSON_CardEncryption` |
| A.26 | `/ISAPI/AccessControl/CardOperations/protocol?format=json` | PUT | Operation protocol type | – | `JSON_CardProto` |
| A.27 | `/ISAPI/AccessControl/CardOperations/reset?format=json` | GET | Kart parametrelerini sıfırla | CPU | → `JSON_CardResetResponse` |
| A.28 | `/ISAPI/AccessControl/CardOperations/sectionEncryption?format=json` | PUT | Belirli section şifrele | M1 | `JSON_SectionEncryption` |
| A.29 | `/ISAPI/AccessControl/CardOperations/verification?format=json` | PUT | Section password doğrula | M1 | `JSON_Verification` |

> M1 = Mifare Classic; CPU = CPU card (Mifare DESFire vb.). Hikvision farklı kart tipleri için farklı endpoint sağlar.

---

## A.30–A.39 — Lane Controller (Turnstile)

| # | URI | Method | Açıklama | Payload |
|---|---|---|---|---|
| A.30 | `/ISAPI/AccessControl/ChannelControllerAlarmLinkage` | GET/PUT | Lane alarm linkage | `XML_ChannelControllerAlarmLinkage` |
| A.31 | `/ISAPI/AccessControl/ChannelControllerAlarmLinkage/capabilities` | GET | Linkage yeteneği | → `XML_Cap_ChannelControllerAlarmLinkage` |
| A.32 | `/ISAPI/AccessControl/ChannelControllerAlarmOut/capabilities` | GET | Alarm output yeteneği | → `XML_Cap_ChannelControllerAlarmOut` |
| A.33 | `/ISAPI/AccessControl/ChannelControllerAlarmOut?controllerType=&alarmOutNo=` | GET/PUT | Alarm output param | `XML_ChannelControllerAlarmOut` |
| A.34 | `/ISAPI/AccessControl/ChannelControllerAlarmOutControl` | – | Alarm output kontrol | `XML_ChannelControllerAlarmOutControl` |
| A.35 | `/ISAPI/AccessControl/ChannelControllerAlarmOutControl/capabilities` | GET | Control yeteneği | – |
| A.36 | `/ISAPI/AccessControl/ChannelControllerCfg` | GET/PUT | Lane controller config | `XML_ChannelControllerCfg` |
| A.37 | `/ISAPI/AccessControl/ChannelControllerCfg/capabilities` | GET | Cfg yeteneği | – |
| A.38 | `/ISAPI/AccessControl/channelControllerTypeCfg/capabilities?format=json` | GET | Type cfg yeteneği | → `JSON_ChannelControllerTypeCfgCap` |
| A.39 | `/ISAPI/AccessControl/channelControllerTypeCfg?format=json` | GET/PUT | Type config | `JSON_ChannelControllerTypeCfg` |

---

## A.40–A.45 — IR / NFC / RFCard Configuration

| # | URI | Method | Açıklama | Payload |
|---|---|---|---|---|
| A.40 | `/ISAPI/AccessControl/Configuration/IRCfg/capabilities?format=json` | GET | IR yeteneği | → `JSON_IRCfgCap` |
| A.41 | `/ISAPI/AccessControl/Configuration/IRCfg?format=json` | GET/PUT | IR config | `JSON_IRCfg` |
| A.42 | `/ISAPI/AccessControl/Configuration/NFCCfg/capabilities?format=json` | GET | NFC yeteneği | → `JSON_NFCCfgCap` |
| A.43 | `/ISAPI/AccessControl/Configuration/NFCCfg?format=json` | GET/PUT | NFC config (kart okuyucu NFC desteği) | `JSON_NFCCfg` |
| A.44 | `/ISAPI/AccessControl/Configuration/RFCardCfg/capabilities?format=json` | GET | RFCard yeteneği | → `JSON_RFCardCfgCap` |
| A.45 | `/ISAPI/AccessControl/Configuration/RFCardCfg?format=json` | GET/PUT | RFCard config | `JSON_RFCardCfg` |

---

## A.46–A.47 — Face Compare

| # | URI | Method | Açıklama | Payload |
|---|---|---|---|---|
| A.46 | `/ISAPI/AccessControl/FaceCompareCond` | – | Yüz karşılaştırma koşulları | `XML_FaceCompareCond` |
| A.47 | `/ISAPI/AccessControl/FaceCompareCond/capabilities` | GET | Yetenek | → `XML_Cap_FaceCompareCond` |

---

## A.48–A.55 — Gate Status

| # | URI | Method | Açıklama | Payload |
|---|---|---|---|---|
| A.48 | `/ISAPI/AccessControl/GateDialAndInfo` | GET/PUT | Gate dial bilgisi | `XML_GateDialAndInfo` |
| A.49 | `/ISAPI/AccessControl/GateDialAndInfo/capabilities` | GET | Yetenek | → `XML_Cap_GateDialAndInfo` |
| A.50 | `/ISAPI/AccessControl/GateIRStatus` | GET | Gate IR durumu | → `XML_GateIRStatus` |
| A.51 | `/ISAPI/AccessControl/GateIRStatus/capabilities` | GET | Yetenek | → `XML_Cap_GateIRStatus` |
| A.52 | `/ISAPI/AccessControl/GateRelatedPartsStatus` | GET | Gate parça durumu | → `XML_GateRelatedPartsStatus` |
| A.53 | `/ISAPI/AccessControl/GateRelatedPartsStatus/capabilities` | GET | Yetenek | → `XML_Cap_GateRelatedPartsStatus` |
| A.54 | `/ISAPI/AccessControl/GateStatus` | GET | Gate genel durum | → `XML_GateStatus` |
| A.55 | `/ISAPI/AccessControl/GateStatus/capabilities` | GET | Yetenek | → `XML_Cap_GateStatus` |

---

## A.56–A.58 — Event Search Capabilities + Identity Terminal

| # | URI | Method | Açıklama | Payload |
|---|---|---|---|---|
| A.56 | `/ISAPI/AccessControl/GetAcsEvent/capabilities` | GET | Erişim event sorgulama yeteneği | → `XML_Cap_GetAcsEvent` |
| A.57 | `/ISAPI/AccessControl/IdentityTerminal/capabilities` | GET | TC kimlik terminal yeteneği | → `XML_Cap_IdentityTerminal` |
| A.58 | `/ISAPI/AccessControl/IdentityTerminal` | GET/PUT | Terminal config | `XML_IdentityTerminal` |

---

## A.59–A.67 — Offline Capture (Çevrimdışı veri toplama)

> **ngsaccess için önemli:** USB stick ile cihaza yüklenen toplu kişi/kart datasını izlemek için. Bridge'siz senkronizasyon senaryosunda kullanışlı.

| # | URI | Method | Açıklama |
|---|---|---|---|
| A.59 | `/ISAPI/AccessControl/OfflineCapture/capabilities?format=json` | GET | Yetenek |
| A.60 | `/ISAPI/AccessControl/OfflineCapture/DataCollections/<captureNo>?format=json` | GET/DELETE | Belirli koleksiyon |
| A.61 | `/ISAPI/AccessControl/OfflineCapture/DataCollections/searchTask?format=json` | POST | Koleksiyon ara |
| A.62 | `/ISAPI/AccessControl/OfflineCapture/DataCollections?format=json` | DELETE | Tüm koleksiyonları sil |
| A.63 | `/ISAPI/AccessControl/OfflineCapture/dataOutput/progress?format=json` | GET | Data output ilerleme |
| A.64 | `/ISAPI/AccessControl/OfflineCapture/dataOutput?format=json` | – | Data output config |
| A.65 | `/ISAPI/AccessControl/OfflineCapture/progress?format=json` | GET | Capture ilerleme |
| A.66 | `/ISAPI/AccessControl/OfflineCapture/ruleInfo?format=json` | – | Rule info |
| A.67 | `/ISAPI/AccessControl/OfflineCapture/uploadFailedDetails?format=json` | GET | **Başarısız upload kişi listesi** ⭐ — toplu senk'te hatalı kayıtları görmek için |

---

## A.68–A.71 — Remote Controller & Right Controller Audio

| # | URI | Method | Açıklama |
|---|---|---|---|
| A.68 | `/ISAPI/AccessControl/remoteCtrllerModeCfg/capabilities?format=json` | GET | Remote controller mode yeteneği |
| A.69 | `/ISAPI/AccessControl/remoteCtrllerModeCfg?format=json` | GET/PUT | Mode config |
| A.70 | `/ISAPI/AccessControl/RightControllerAudio/capabilities` | GET | Audio yeteneği |
| A.71 | `/ISAPI/AccessControl/RightControllerAudio/<ID>` | – | Audio konfigürasyonu |

---

## ngsaccess için Pratik Endpoint Listesi

### En sık kullanılacaklar
```bash
# 1. Cihaz canlı mı + bilgi al
GET  /ISAPI/System/deviceInfo

# 2. Cihaz hangi access control feature'larını destekliyor?
GET  /ISAPI/AccessControl/capabilities

# 3. Cihazdan kart okut (admin "kart okut" butonu için)
GET  /ISAPI/AccessControl/CaptureCardInfo?format=json

# 4. Geçmiş erişim event'lerini sorgula (raporlama için)
POST /ISAPI/AccessControl/AcsEvent?format=json
Body: { "AcsEventCond": { "searchID": "...", "searchResultPosition": 0, "maxResults": 30, "major": 5, ... } }

# 5. Kişi bilgisi ara
POST /ISAPI/AccessControl/UserInfo/Search?format=json
Body: { "UserInfoSearchCond": { "searchID": "...", "maxResults": 30, "employeeNoList": [{"employeeNo":"1001"}] } }

# 6. Kapıyı uzaktan aç (anahtar acil senaryolar için)
PUT  /ISAPI/AccessControl/RemoteControl/door/1
Body: { "RemoteControlDoor": { "cmd": "open" } }
```

### TC Kimlik Okuma
```bash
GET  /ISAPI/AccessControl/CaptureIDInfo/capabilities?format=json   # destekli mi?
POST /ISAPI/AccessControl/CaptureIDInfo?format=json                # okut
```

### Toplu Senkronizasyon Health Check
```bash
GET  /ISAPI/AccessControl/OfflineCapture/uploadFailedDetails?format=json
```

---

## İlgili Belgeler
- [docs/sdk/appendix-b-json-xml-messages.md](./appendix-b-json-xml-messages.md) — Tüm `JSON_*` ve `XML_*` payload tanımları
- [docs/sdk/02-typical-applications/2.2-manage-card-information.md](./02-typical-applications/2.2-manage-card-information.md) — Kart yönetimi akışı
- [docs/sdk/02-typical-applications/2.6-alarm-event-receiving.md](./02-typical-applications/2.6-alarm-event-receiving.md) — Event alma
- [docs/sdk/appendix-c/c.5-text-protocol-response-codes.md](./appendix-c/c.5-text-protocol-response-codes.md) — HTTP response kodları
- [docs/HIKVISION_ISAPI_REFERANS.md](../HIKVISION_ISAPI_REFERANS.md) — Hızlı ISAPI referans
- [docs/HIKVISION_CURL_ISAPI_REHBERI.md](../HIKVISION_CURL_ISAPI_REHBERI.md) — cURL ile test rehberi
- [convex/actions/hikvisionSync.ts](../../convex/actions/hikvisionSync.ts) — Convex ISAPI client
