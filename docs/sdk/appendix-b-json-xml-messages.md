# Appendix B — JSON ve XML Mesaj Tanımları

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Appendix B, s.267–363

## Özet

ISAPI HTTP endpoint'lerinin request/response payload'larının tanımları. `Appendix A` URI listesinden gelen `JSON_*` ve `XML_*` referansları burada açılır.

Bu dosya bir **navigasyon haritası** — her mesajın **detaylı field listesi** PDF'in ilgili sayfasında. Bazı kritik payload örnekleri inline olarak verilmiştir.

---

## JSON Mesajları (B.1–B.53)

### Access Event Toplam Sayı
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_AcsEventTotalNum` | s.267 | Toplam event sayısı response |
| `JSON_AcsEventTotalNumCond` | s.267 | Request: `searchID`, `major`, `minor`, `beginTime`, `endTime`, `cardNo`, `name` |
| `JSON_Cap_AcsEventTotalNum` | s.269 | Capability |

### Attendance
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_AttendanceStatusModeCfg` | s.268 | Attendance mode set |
| `JSON_AttendanceStatusRuleCfg` | s.268 | Attendance rule set |
| `JSON_Cap_AttendanceStatusModeCfg` | s.270 | Mode capability |
| `JSON_Cap_AttendanceStatusRuleCfg` | s.271 | Rule capability |

### Capture / Card Info
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_CapturePreset` | s.272 | Preset get/set |
| `JSON_CapturePresetCap` | s.272 | Preset capability |
| `JSON_CaptureProgress` | s.272 | Capture progress |
| `JSON_CaptureRule` | s.273 | Rule |
| `JSON_CaptureRuleCap` | s.273 | Rule capability |
| `JSON_CardInfoCap` | s.274 | Card info capability |
| `JSON_CardInfo_Collection` | s.274 | ⭐ Cihazdan okutulan kart bilgisi response |
| `JSON_IdentityInfo` | s.288 | TC kimlik response |
| `JSON_IdentityInfoCap` | s.289 | TC kimlik capability |
| `JSON_IdentityInfoCond` | s.291 | TC kimlik koşulu |

#### Örnek: `JSON_CardInfo_Collection`
Cihazdan **kart okutulduğunda** dönen payload:
```json
{
  "CardInfo": {
    "cardNo": "1234567890",
    "cardType": "normalCard",
    "name": "",
    "userType": "normal",
    "doorRight": "1",
    "rightPlan": [{ "doorNo": 1, "planTemplateNo": 1 }],
    "maxOpenDoorTime": 0,
    "openDoorTime": 0,
    "roomNumber": 0,
    "floorNumber": 0,
    "employeeNo": "1001",
    "checkCardNo": "1234567890",
    "Valid": {
      "enable": true,
      "beginTime": "2025-01-01T00:00:00",
      "endTime": "2030-12-31T23:59:59"
    }
  }
}
```

### CardOperations
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_CardEncryption` | s.274 | CPU kart encryption |
| `JSON_CardOperationsCap` | s.275 | Capability |
| `JSON_CardParam` | s.282 | CPU kart param |
| `JSON_CardProto` | s.283 | Operation protocol |
| `JSON_CardResetResponse` | s.283 | CPU kart reset response |
| `JSON_ClearData` | s.284 | Karttan veri sil |
| `JSON_ClearDataRes` | s.284 | Clear response |
| `JSON_ControlBlock` | s.284 | M1 section control block |
| `JSON_CustomData` | s.285 | Custom data set |
| `JSON_CustomDataRes` | s.285 | Custom data response |
| `JSON_CustomDataResult` | s.285 | Custom data sonuç |
| `JSON_CustomDataSearchCond` | s.286 | Custom data arama koşulu |
| `JSON_DataBlock` | s.286 | M1 block data |
| `JSON_DataBlockCtrl` | s.286 | Block kontrolü |
| `JSON_DataTrans` | s.287 | CPU data pass-through |
| `JSON_SectionEncryption` | s.306 | M1 section encrypt |
| `JSON_Verification` | s.306 | M1 password verify |

### Channel Controller (Lane Controller)
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_ChannelControllerTypeCfg` | s.283 | Type cfg |
| `JSON_ChannelControllerTypeCfgCap` | s.283 | Capability |

### Configuration (IR / NFC / RFCard)
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_IRCfg` | s.292 | IR config |
| `JSON_IRCfgCap` | s.292 | IR capability |
| `JSON_NFCCfg` | s.292 | NFC config |
| `JSON_NFCCfgCap` | s.292 | NFC capability |
| `JSON_RFCardCfg` | s.301 | RFCard config |
| `JSON_RFCardCfgCap` | s.301 | RFCard capability |

### Data Output / Offline Capture
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_DataOutputCfg` | s.287 | Data output config |
| `JSON_DataOutputProgress` | s.287 | Data output progress |
| `JSON_OfflineCaptureCap` | s.293 | Offline capture capability |
| `JSON_RuleInfo` | s.301 | Rule info |
| `JSON_UploadFailedDetails` | s.306 | Başarısız upload detayları |

### Search & Response
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_SearchTaskCond` | s.302 | Genel arama koşulu |
| `JSON_SearchTaskResponse` | s.303 | Arama sonuç |
| `JSON_ResponseStatus` | s.300 | ⭐ Genel response status — her PUT/POST'tan döner |
| `JSON_EventNotificationAlert_Alarm/EventInfo` | s.288 | ⭐ HTTP Notify Surveillance Center body |

#### Örnek: `JSON_ResponseStatus`
Hikvision'ın tüm config çağrılarına dönen standart yanıt:
```json
{
  "statusCode": 1,
  "statusString": "OK",
  "subStatusCode": "ok"
}
```
Hata durumunda:
```json
{
  "statusCode": 4,
  "statusString": "Invalid Operation",
  "subStatusCode": "deviceError",
  "errorCode": 0x40000010,
  "errorMsg": "Card number conflict"
}
```
Hata kodları için [appendix-c c.5-text-protocol-response-codes.md](./appendix-c/c.5-text-protocol-response-codes.md) bakın.

#### Örnek: `JSON_EventNotificationAlert_Alarm/EventInfo` ⭐
Hikvision cihazları HTTP Notify Surveillance Center hedefine **bu formatta** POST atar:
```json
{
  "ipAddress": "192.168.1.64",
  "ipv6Address": "::",
  "portNo": 80,
  "protocolType": "HTTP",
  "macAddress": "xx:xx:xx:xx:xx:xx",
  "channelID": 1,
  "dateTime": "2026-05-16T10:30:00+03:00",
  "activePostCount": 1,
  "eventType": "AccessControllerEvent",
  "eventState": "active",
  "eventDescription": "Access Controller Event",
  "AccessControllerEvent": {
    "deviceName": "Access Controller",
    "majorEventType": 5,        // c.1: MAJOR_EVENT
    "subEventType": 75,         // c.1: MINOR_DOOR_OPEN_OR_DORMANT_FAIL
    "cardNo": "12345678",
    "cardType": 1,
    "name": "Ahmet",
    "employeeNoString": "1001",
    "serialNo": 12345,
    "userType": "normal",
    "currentVerifyMode": "cardOrFace",
    "currentEvent": true,
    "frontSerialNo": 12344,
    "attendanceStatus": "undefined",
    "label": "",
    "statusValue": 0,
    "mask": "no",
    "purePwdVerifyEnable": false
  }
}
```
> ngsaccess'in [convex/http.ts](../../convex/http.ts) `/card-reader` endpoint'i bu payload'u kabul eder.

### Remote Controller
| Mesaj | PDF | Kullanım |
|---|---|---|
| `JSON_RemoteCtrllerModeCfg` | s.300 | Remote ctrller mode config |
| `JSON_RemoteCtrllerModeCfgCap` | s.300 | Capability |

---

## XML Mesajları (B.54–B.81)

### Access Control Yetenek
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_Cap_AccessControl` | s.339 | ⭐ Erişim kontrol komple yetenek (`<isSupportRemoteControl>`, `<isSupportGateStatus>` vb.) |
| `XML_AcsAbility` | s.307 | ACS yetenek detayı |
| `XML_Desc_AcsAbility` | s.358 | Acs ability description |

### Channel Controller XML
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_ChannelControllerCfg` | s.357 | Lane controller cfg |
| `XML_Cap_ChannelControllerCfg` | s.349 | Capability |
| `XML_ChannelControllerAlarmLinkage` | s.356 | Alarm linkage |
| `XML_Cap_ChannelControllerAlarmLinkage` | s.348 | Capability |
| `XML_ChannelControllerAlarmOut` | s.357 | Alarm output |
| `XML_Cap_ChannelControllerAlarmOut` | s.349 | Capability |
| `XML_ChannelControllerAlarmOutControl` | s.357 | Alarm output control |
| `XML_Cap_ChannelControllerAlarmOutControl` | s.349 | Capability |

### Face / Identity
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_FaceCompareCond` | s.359 | Yüz karşılaştırma koşulu |
| `XML_Cap_FaceCompareCond` | s.350 | Capability |
| `XML_IdentityTerminal` | s.361 | Identity terminal cfg |
| `XML_Cap_IdentityTerminal` | s.354 | Capability |

### Gate Status
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_GateStatus` | s.361 | Gate genel durum |
| `XML_Cap_GateStatus` | s.353 | Capability |
| `XML_GateIRStatus` | s.360 | IR detector durum |
| `XML_Cap_GateIRStatus` | s.351 | Capability |
| `XML_GateRelatedPartsStatus` | s.360 | Parça durumu |
| `XML_Cap_GateRelatedPartsStatus` | s.352 | Capability |
| `XML_GateDialAndInfo` | s.359 | Gate dial info |
| `XML_Cap_GateDialAndInfo` | s.351 | Capability |

### Event Notification (XML versiyonu)
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_EventNotificationAlert_AlarmEventInfo` | s.358 | (JSON eşdeğeri, XML formatında) |

### Right Controller Audio
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_RightControllerAudio` | s.363 | Audio param |
| `XML_Cap_RightControllerAudio` | s.356 | Capability |

### Get Acs Event Capability
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_Cap_GetAcsEvent` | s.353 | ACS event arama capability |

### Generic
| Mesaj | PDF | Kullanım |
|---|---|---|
| `XML_ResponseStatus` | s.363 | ⭐ XML response status (JSON karşılığı `JSON_ResponseStatus`) |

#### Örnek: `XML_ResponseStatus`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ResponseStatus version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <requestURL>/ISAPI/AccessControl/RemoteControl/door/1</requestURL>
  <statusCode>1</statusCode>
  <statusString>OK</statusString>
  <subStatusCode>ok</subStatusCode>
</ResponseStatus>
```

---

## ngsaccess Tarafında Notlar

### Convex'te Tip Tanımı (Önerilen)
```typescript
// convex/lib/hikvisionTypes.ts (önerilen)
import { z } from "zod";

export const accessControllerEventSchema = z.object({
  ipAddress: z.string(),
  portNo: z.number(),
  macAddress: z.string().optional(),
  channelID: z.number().optional(),
  dateTime: z.string(),
  eventType: z.string(),
  AccessControllerEvent: z.object({
    deviceName: z.string().optional(),
    majorEventType: z.number(),  // c.1 → 0x1, 0x2, 0x3, 0x5
    subEventType: z.number(),     // c.1 minor codes
    cardNo: z.string().optional(),
    cardType: z.number().optional(),
    name: z.string().optional(),
    employeeNoString: z.string().optional(),
    serialNo: z.number().optional(),
    userType: z.string().optional(),
    currentVerifyMode: z.string().optional(),
    attendanceStatus: z.string().optional(),
    // ... çağırın gerektiğinde alanlar
  }).optional(),
});

export type AccessControllerEvent = z.infer<typeof accessControllerEventSchema>;
```

### Hata Yönetimi
- `JSON_ResponseStatus.statusCode` **1** dışında ise hata var
- `subStatusCode` daha spesifik hata tipi
- HTTP statusCode'a güvenme — Hikvision genelde 200 dönüp `statusCode: 4` yazar

---

## İlgili Belgeler
- [docs/sdk/appendix-a-request-uris.md](./appendix-a-request-uris.md) — Hangi URI hangi mesajı kullanır
- [docs/sdk/appendix-c/c.5-text-protocol-response-codes.md](./appendix-c/c.5-text-protocol-response-codes.md) — HTTP/ISAPI hata kodları
- [docs/sdk/04-structures-enumerations.md](./04-structures-enumerations.md) — HCNetSDK struct karşılıkları
- [convex/http.ts](../../convex/http.ts) — `/card-reader` payload kabul
- [convex/lib/cardReaderParse.ts](../../convex/lib/cardReaderParse.ts) — Payload parser
