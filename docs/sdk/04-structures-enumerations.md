# Yapılar ve Enumerasyonlar (Structures and Enumerations)

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Chapter 4, s.118–225

## Özet

HCNetSDK'deki **92 struct + 2 enum**. Aşağıda kategorize edilmiş referans listesi var. Her struct'ın **detaylı field listesi** PDF'in ilgili sayfasında — bu dosya **navigasyon haritası** niteliğinde.

ngsaccess ISAPI HTTP üzerinden çalıştığı için struct'ları doğrudan kullanmıyor — ama gelen JSON'ların field isimleri (genelde) struct field isimleriyle eşleşir. Örneğin `NET_DVR_ACS_EVENT_INFO.byCardNo` ISAPI JSON'da `cardNo` olarak gelir.

---

## 4.1 Data Structures

### Alarm & Event Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_ALARM_ISAPI_INFO` | s.129 | ⭐ ISAPI text protocol üzerinden gelen alarm payload (`COMM_ISAPI_ALARM`) |
| `NET_DVR_ALARM_ISAPI_PICDATA` | s.130 | ISAPI alarm ile gelen ek resim datası |
| `NET_DVR_ACS_ALARM_INFO` | s.130 | ⭐ Erişim kontrolcü alarm payload (`COMM_ALARM_ACS`) — `struAcsEventInfo` field'ı içerir |
| `NET_DVR_ACS_EVENT_INFO` | (içeride) | Event detayı: `byCardNo`, `dwCardReaderNo`, `dwDoorNo`, `byCardType` |
| `NET_DVR_ACS_EVENT_INFO_EXTEND` | s.143 | Genişletilmiş event info |
| `NET_DVR_ACS_EVENT_INFO_EXTEND_V20` | s.145 | V2.0 — daha fazla alan (face URL, vb.) |
| `NET_DVR_ALRAM_FIXED_HEADER` | s.125 | Tüm alarm'lar için ortak header (`dwMajor`, `dwMinor`, `byCardNo`) |
| `NET_DVR_ALARMINFO_V40` | s.124 | Generic alarm info |
| `NET_DVR_ALARMINFO_V30` | s.123 | (Eski) |
| `NET_DVR_ALARMINFO_DEV` | s.121 | Device alarm |
| `NET_DVR_ALARMINFO_DEV_V40` | s.122 | Device alarm V4.0 |
| `NET_DVR_ALARMER` | s.120 | Alarm yayınlayan cihazın bilgisi (`sDeviceIP`, `sSerialNumber`) |
| `NET_ALARM_CVR_SUBINFO_UNION` | s.118 | CVR sub info union |
| `NET_ALARM_RECORD_EXCEPTION` | s.118 | Kayıt istisnası alarm |
| `NET_ALARM_RECORDFILE_LOSS` | s.119 | Kayıt dosyası kaybı |
| `NET_ALARM_RESOURCE_USAGE` | s.119 | Kaynak kullanım uyarısı |
| `NET_ALARM_STREAM_EXCEPTION` | s.120 | Stream istisnası |

#### `NET_DVR_ACS_EVENT_INFO` Önemli Alanlar
```c
struct NET_DVR_ACS_EVENT_INFO {
    DWORD dwSize;
    BYTE  byCardNo[ACS_CARD_NO_LEN];   // kart numarası (32 byte)
    BYTE  byCardType;                  // 1=normal, ...
    BYTE  byAllowListNo;
    BYTE  byReportChannel;
    BYTE  byCardReaderKind;            // 1=IC, 2=ID, 3=QR, 4=fingerprint
    DWORD dwCardReaderNo;              // hangi okuyucu (1+)
    DWORD dwDoorNo;                    // hangi kapı (1+)
    DWORD dwEmployeeNo;                // çalışan no (eski)
    WORD  wInductiveEventType;
    BYTE  byPicture;                   // 1: resim eklendi
    BYTE  byPicTransType;
    DWORD dwSerialNo;                  // event sıra no
    BYTE  byChannelControllerID;
    BYTE  byChannelControllerLampID;
    BYTE  byChannelControllerIRAdaptorID;
    BYTE  byChannelControllerIREmitterID;
    char  szEmployeeNo[ACS_EMPLOYEE_NO_LEN];  // çalışan ID (yeni, string)
    // ... (genişletilmiş alanlar)
};
```

> ngsaccess'in [convex/lib/cardReaderParse.ts](../../convex/lib/cardReaderParse.ts) bu alanları parse eder.

---

### Card / Kullanıcı Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_CARD_CFG_V50` | s.160 | ⭐ Kart konfigürasyonu (tam yapı [2.2-manage-card-information.md](./02-typical-applications/2.2-manage-card-information.md)) |
| `NET_DVR_CARD_CFG_COND` | s.164 | Kart sorgulama koşulu |
| `NET_DVR_CARD_CFG_SEND_DATA` | s.159 | Kart arama / set data |
| `NET_DVR_CARD_READER_CFG_V50` | s.154 | Kart okuyucu konfigürasyonu |
| `NET_DVR_CARD_READER_PLAN` | s.165 | Kart okuyucu → template eşleme |
| `NET_DVR_VALID_PERIOD_CFG` | s.210 | Geçerlilik aralığı (`struBeginTime`, `struEndTime`) |
| `NET_DVR_USER_LOGIN_INFO` | (s.209'da `NET_DVR_USER_LOGIN_INFO`) | Login params |
| `NET_DVR_DEVICEINFO_V30` | s.166 | Cihaz bilgisi (eski) |
| `NET_DVR_DEVICEINFO_V40` | s.170 | Cihaz bilgisi (yeni) — `byMainProto`, `bySubProto` |

---

### Face Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_FACE_PARAM_CFG` | s.179 | Yüz parametreleri |
| `NET_DVR_FACE_PARAM_COND` | s.180 | Yüz sorgulama koşulu |
| `NET_DVR_FACE_FEATURE` | s.178 | Yüz özellik vektörü |
| `NET_DVR_CAPTURE_FACE_CFG` | s.151 | Yüz capture config |
| `NET_DVR_CAPTURE_FACE_COND` | s.152 | Yüz capture koşulu |

---

### Fingerprint Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_FINGER_PRINT_CFG_V50` | s.181 | Parmak izi config |
| `NET_DVR_FINGER_PRINT_INFO_COND_V50` | s.182 | Parmak izi sorgulama |
| `NET_DVR_CAPTURE_FINGERPRINT_CFG` | s.153 | Capture config |
| `NET_DVR_CAPTURE_FINGERPRINT_COND` | s.154 | Capture koşulu |

---

### Schedule / Plan Yapıları (Çok kullanılır)
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_PLAN_TEMPLATE` | s.199 | Template: hafta planı + tatil grupları kombinasyonu |
| `NET_DVR_WEEK_PLAN_CFG` | s.215 | 7 gün × 8 zaman dilimi haftalık plan |
| `NET_DVR_SINGLE_PLAN_SEGMENT` | s.206 | Tek zaman dilimi (`byVerifyMode` / `byDoorStatus`) |
| `NET_DVR_TIME_SEGMENT` | s.208 | Zaman aralığı (`struBeginTime`, `struEndTime`) |
| `NET_DVR_SIMPLE_DAYTIME` | s.205 | Tek günün zaman bilgisi |
| `NET_DVR_HOLIDAY_PLAN_CFG` | s.186 | Tatil planı (tarih aralığı + plan) |
| `NET_DVR_HOLIDAY_GROUP_CFG` | s.185 | Tatil grubu (max 16 plan) |
| `NET_DVR_GROUP_CFG` | s.184 | Erişim grubu |
| `NET_DVR_GROUP_COMBINATION_INFO_V50` | s.185 | Multi-factor group combination |
| `NET_DVR_DOOR_STATUS_PLAN` | s.173 | Kapı durumu planı |
| `NET_DVR_DATE` | s.165 | Tarih (`wYear`, `byMonth`, `byDay`) |
| `NET_DVR_TIME` | s.208 | Saat (`wHour`, `wMinute`, `wSecond`) |
| `NET_DVR_TIME_EX` | s.208 | Saat (extended) |

Detay: [2.5-schedule-settings.md](./02-typical-applications/2.5-schedule-settings.md)

---

### Event Linkage Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_EVENT_CARD_LINKAGE_CFG_V51` | s.174 | ⭐ Event-card linkage konfigürasyonu V5.1 |
| `NET_DVR_EVENT_CARD_LINKAGE_COND` | s.177 | Sorgulama koşulu |
| `NET_DVR_EVETN_CARD_LINKAGE_UNION` | s.177 | Linkage union (event source veya card no) |
| `NET_DVR_EVENT_LINKAGE_INFO` | s.178 | Linkage info |

Detay: [2.6-alarm-event-receiving.md](./02-typical-applications/2.6-alarm-event-receiving.md)

---

### Multi-Card / Group Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_MULTI_CARD_CFG_V50` | s.193 | Multi-kart auth config |
| `NET_DVR_MULTI_CARD_GROUP_CFG_V50` | s.194 | Multi-kart grup config |

---

### Door / Gate Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_GATE_TIME_CFG` | s.183 | Turnike zaman ayarları |
| `NET_DVR_DOOR_FILE_UPLOAD_PARAM` | s.173 | Kapı dosya upload param |

---

### Network / Communication Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_NETCFG_V50` | s.195 | Network config V5.0 (`struAlarmHostIpAddr`, `wAlarmHostIpPort`) |
| `NET_DVR_ETHERNET_V30` | s.174 | Ethernet config |
| `NET_DVR_IPADDR_UNION` | s.190 | IP address union (IPv4 / IPv6) |
| `NET_DVR_PPPOECFG` | s.200 | PPPoE config |
| `NET_DVR_MIME_UNIT` | s.192 | MIME unit |
| `NET_DVR_JSON_DATA_CFG` | s.190 | JSON data config |
| `NET_DVR_XML_CONFIG_INPUT` | s.215 | ISAPI XML input (STDXMLConfig param) |
| `NET_DVR_XML_CONFIG_OUTPUT` | s.216 | ISAPI XML output |

---

### Capture Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_CAPTURE_FACE_CFG` | s.151 | (üstte) |
| `NET_DVR_CAPTURE_FACE_COND` | s.152 | (üstte) |
| `NET_DVR_CAPTURE_FINGERPRINT_CFG` | s.153 | (üstte) |
| `NET_DVR_CAPTURE_FINGERPRINT_COND` | s.154 | (üstte) |

---

### Cihaz Status / Statistics
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_ACS_WORK_STATUS_V50` | s.147 | ⭐ Erişim kontrolcü çalışma durumu |
| `NET_DVR_PERSON_STATISTICS_CFG` | s.198 | Kişi istatistik (people counting) |
| `NET_DVR_ACS_EXTERNAL_DEV_CFG` | s.146 | Harici cihaz config |

Detay: [2.8-status-monitoring.md](./02-typical-applications/2.8-status-monitoring.md)

---

### Init / SDK Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_INIT_CFG_ABILITY` | s.189 | SDK init capability |
| `NET_DVR_LOCAL_SDK_PATH` | s.191 | SDK library path |
| `NET_SDK_CALLBACK_STATUS_NORMAL` | s.217 | Callback normal status |

---

### Video Intercom Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_VIDEO_INTERCOM_DEVICEID_CFG` | s.211 | Video intercom device ID |
| `NET_DVR_VIDEO_INTERCOM_RELATEDEV_CFG` | s.212 | Related device |
| `NET_DVR_VIDEO_INTERCOM_UNIT_DEVICEID_UNION` | s.213 | Device ID union |
| `NET_DVR_VIDEO_INTERCOM_UNIT_RELATEDEV_UNION` | s.214 | Related dev union |
| `NET_DVR_INDOOR_UNIT_DEVICEID` | s.187 | İç ünite device ID |
| `NET_DVR_INDOOR_UNIT_RELATEDEV` | s.188 | İç ünite related dev |
| `NET_DVR_OUTDOOR_UNIT_DEVICEID` | s.197 | Dış ünite device ID |
| `NET_DVR_OUTDOOR_UNIT_RELATEDEV` | s.198 | Dış ünite related dev |
| `NET_DVR_OUTDOOR_FENCE_DEVICEID` | s.196 | Dış çit device ID |
| `NET_DVR_MANAGE_UNIT_DEVICEID` | s.191 | Manage unit device ID |
| `NET_DVR_MANAGE_UNIT_RELATEDEV` | s.192 | Manage unit related dev |

---

### Passback / Recording Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_RECORD_PASSBACK_MANUAL_COND` | s.200 | Manuel passback task koşulu |
| `NET_DVR_RECORD_PASSBACK_MANUAL_TASK_RET` | s.201 | Passback task sonucu |
| `NET_DVR_AGAIN_RELATEDEV` | s.150 | Yeniden ilişkili cihaz |

---

### Alarm Setup Yapıları
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_DVR_SETUPALARM_PARAM_V50` | s.202 | ⭐ SetupAlarmChan_V50 param (`byAlarmInfoType`, `byLevel`) |
| `NET_DVR_STREAM_INFO` | s.207 | Stream info |
| `NET_DVR_RIGHT_CONTROLLER_AUDIO_PARAM` | s.202 | Right controller audio |

---

### VCA (Video Content Analysis)
| Struct | PDF | Açıklama |
|---|---|---|
| `NET_VCA_POINT` | s.217 | VCA nokta |
| `NET_VCA_RECT` | s.218 | VCA dikdörtgen |

---

## 4.2 Enumerations

### `NET_SDK_DOWNLOAD_TYPE` (s.218)
`NET_DVR_StartDownload` için. Önemli değerler:
| Enum | Açıklama |
|---|---|
| `NET_SDK_DOWNLOAD_RIGHT_CONTROLLER_AUDIO` (24) | Ses dosyası indir |
| Diğer kayıt indirme tipleri | Kamera kayıt indirme için |

### `NET_SDK_UPLOAD_TYPE` (s.222)
`NET_DVR_UploadFile_V40` için. Önemli değerler:
| Enum | Açıklama |
|---|---|
| `UPLOAD_RIGHT_CONTROLLER_AUDIO` (42) | Right controller audio dosyası yükle |
| Diğer upload tipleri | Cert / firmware / face vb. |

---

## ngsaccess Tarafında Notlar

### Field Naming Çevirisi (Struct ↔ JSON)
Hikvision ISAPI JSON'larda field isimleri **camelCase** ve struct field'ından **Macar prefix'leri çıkarılmış** halde gelir:

| Struct Field | ISAPI JSON Karşılığı |
|---|---|
| `byCardNo` | `cardNo` |
| `dwDoorNo` | `doorNo` |
| `dwCardReaderNo` | `cardReaderNo` |
| `byCardType` | `cardType` |
| `dwSerialNo` | `serialNo` |
| `szEmployeeNo` | `employeeNoString` veya `employeeNo` |
| `dwMajor` | `majorEventType` |
| `dwMinor` | `subEventType` |
| `struTime` | `dateTime` (ISO 8601 string) |

[convex/lib/cardReaderParse.ts](../../convex/lib/cardReaderParse.ts) bu çeviriyi yapar.

### En Çok Kullanacaklarımız (Convex Tarafında)
1. **`NET_DVR_ACS_EVENT_INFO` ↔ AcsEvent JSON** — kart okuma event parse
2. **`NET_DVR_CARD_CFG_V50` ↔ CardInfo JSON** — kart senkronizasyonu
3. **`NET_DVR_VALID_PERIOD_CFG`** — kart geçerlilik tarihi
4. **`NET_DVR_PLAN_TEMPLATE` + `NET_DVR_WEEK_PLAN_CFG`** — takvim push'u (gerekirse)
5. **`NET_DVR_ACS_WORK_STATUS_V50`** — health check polling

---

## İlgili Belgeler
- [docs/sdk/02-typical-applications/](./02-typical-applications/) — Her struct'ın gerçek kullanım örnekleri
- [docs/sdk/appendix-c/c.1-access-control-event-types.md](./appendix-c/c.1-access-control-event-types.md) — `dwMajor` + `dwMinor` değer eşlemeleri
- [docs/sdk/appendix-b-json-xml-messages.md](./appendix-b-json-xml-messages.md) — ISAPI JSON karşılıkları
- [convex/lib/cardReaderParse.ts](../../convex/lib/cardReaderParse.ts) — Field çevirisi
