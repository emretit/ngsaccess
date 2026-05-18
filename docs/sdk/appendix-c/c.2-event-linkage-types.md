# Event Linkage Tipleri (Event Linkage Types)

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Appendix C.2, s.381–393

## Özet

[2.6 Alarm and Event Receiving](../02-typical-applications/2.6-alarm-event-receiving.md) bölümünde anlatılan **event card linkage** konfigürasyonunda, `NET_DVR_EVENT_CARD_LINKAGE_CFG_V50` struct'ının `uLinkageInfo.struEventLinkage.wMainEventType` ve `wSubEventType` alanlarına yazılan değerleri tanımlar.

### 4 Major Event Linkage Type
| Major | Adı | Açıklama |
|---|---|---|
| **0** | Device Event Linkage | Cihaz seviyesinde (tampering, network broken, low battery vb.) |
| **1** | Alarm Input Event Linkage | Alarm input zone (kısa devre, açık devre, exception) |
| **2** | Access Control Point Event Linkage | Kapı seviyesinde (open, close, force, tailgating vb.) |
| **3** | Authentication Unit Event Linkage | Kart okuyucu seviyesinde (kart auth, parmak izi, yüz) |

> **c.1 ile karşılaştırma:** C.1 (Access Control Event Types) cihazdan **çıkan** event'lerin sınıflandırılması; C.2 (Event Linkage Types) ise **linkage kurulurken** event'in tipini set etmek için. İki tablo benzer ama farklı amaç.

---

## Major 0: Device Event Linkage

| Minor Type | Value | Açıklama |
|---|---|---|
| `EVENT_ACS_HOST_ANTI_DISMANTLE` | 0 | Access Controller Tampering Alarm |
| `EVENT_ACS_OFFLINE_ECENT_NEARLY_FULL` | 1 | No Memory Alarm |
| `EVENT_ACS_NET_BROKEN` | 2 | Network Disconnected |
| `EVENT_ACS_NET_RESUME` | 3 | Network Connected |
| `EVENT_ACS_LOW_BATTERY` | 4 | Low Battery Voltage |
| `EVENT_ACS_BATTERY_RESUME` | 5 | Battery Fully Charged |
| `EVENT_ACS_AC_OFF` | 6 | AC Power Off |
| `EVENT_ACS_AC_RESUME` | 7 | AC Power On |
| `EVENT_ACS_SD_CARD_FULL` | 8 | SD Card Full Alarm |
| `EVENT_ACS_LINKAGE_CAPTURE_PIC` | 9 | Capture Linkage Event Alarm |
| `EVENT_ACS_IMAGE_QUALITY_LOW` | 10 | Low Face Picture Quality |
| `EVENT_ACS_FINGER_PRINT_QUALITY_LOW` | 11 | Low Fingerprint Picture Quality |
| `EVENT_ACS_BATTERY_ELECTRIC_LOW` | 12 | Low Battery Voltage |
| `EVENT_ACS_BATTERY_ELECTRIC_RESUME` | 13 | Battery Fully Charged |
| `EVENT_ACS_FIRE_IMPORT_SHORT_CIRCUIT` | 14 | Fire Input Short Circuit Attempts Alarm |
| `EVENT_ACS_FIRE_IMPORT_BROKEN_CIRCUIT` | 15 | Fire Input Open Circuit Attempts Alarm |
| `EVENT_ACS_FIRE_IMPORT_RESUME` | 16 | Fire Input Alarm Restored |
| `EVENT_ACS_MASTER_RS485_LOOPNODE_BROKEN` | 17 | RS485 Loop of Main Controller Disconnected |
| `EVENT_ACS_MASTER_RS485_LOOPNODE_RESUME` | 18 | RS485 Loop of Main Controller Connected |
| `EVENT_ACS_LOCAL_CONTROL_OFFLINE` | 19 | Distributed Access Controller Offline |
| `EVENT_ACS_LOCAL_CONTROL_RESUME` | 20 | Distributed Access Controller Online |
| `EVENT_ACS_LOCAL_DOWNSIDE_RS485_LOOPNODE_BROKEN` | 21 | Downstream RS485 Loop Disconnected |
| `EVENT_ACS_LOCAL_DOWNSIDE_RS485_LOOPNODE_RESUME` | 22 | Downstream RS485 Loop Connected |
| `EVENT_ACS_DISTRACT_CONTROLLER_ONLINE` | 23 | Distributed Elevator Controller Online |
| `EVENT_ACS_DISTRACT_CONTROLLER_OFFLINE` | 24 | Distributed Elevator Controller Offline |
| `EVENT_ACS_FIRE_BUTTON_TRIGGER` | 25 | Fire Button Pressed |
| `EVENT_ACS_FIRE_BUTTON_RESUME` | 26 | Fire Button Released |
| `EVENT_ACS_MAINTENANCE_BUTTON_TRIGGER` | 27 | Maintenance Button Pressed |
| `EVENT_ACS_MAINTENANCE_BUTTON_RESUME` | 28 | Maintenance Button Released |
| `EVENT_ACS_EMERGENCY_BUTTON_TRIGGER` | 29 | Panic Button Pressed |
| `EVENT_ACS_EMERGENCY_BUTTON_RESUME` | 30 | Panic Button Released |
| `EVENT_ACS_SUBMARINEBACK_COMM_BREAK` | 32 | Anti-passing Back Server Failed |
| `EVENT_ACS_SUBMARINEBACK_COMM_RESUME` | 33 | Anti-passing Back Server Restored |
| `EVENT_ACS_REMOTE_ACTUAL_GUARD` | 34 | Remotely Armed |
| `EVENT_ACS_REMOTE_ACTUAL_UNGUARD` | 35 | Remotely Disarmed |
| `EVENT_ACS_MOTOR_SENSOR_EXCEPTION` | 36 | Motor or Sensor Exception |
| `EVENT_ACS_CAN_BUS_EXCEPTION` | 37 | CAN Bus Exception |
| `EVENT_ACS_CAN_BUS_RESUME` | 38 | CAN Bus Restored |
| `EVENT_ACS_GATE_TEMPERATURE_OVERRUN` | 39 | Too High Pedestal Temperature |
| `EVENT_ACS_IR_EMITTER_EXCEPTION` | 40 | Active IR Intrusion Detector Exception |
| `EVENT_ACS_IR_EMITTER_RESUME` | 41 | Active IR Intrusion Detector Restored |
| `EVENT_ACS_LAMP_BOARD_COMM_EXCEPTION` | 42 | Light Board Comm Failed |
| `EVENT_ACS_LAMP_BOARD_COMM_RESUME` | 43 | Light Board Comm Restored |
| `EVENT_ACS_IR_ADAPTOR_BOARD_COMM_EXCEPTION` | 44 | IR Adaptor Comm Failed |
| `EVENT_ACS_IR_ADAPTOR_BOARD_COMM_RESUME` | 45 | IR Adaptor Comm Restored |
| `EVENT_ACS_CHANNEL_CONTROLLER_DESMANTLE_ALARM` | 46 | Lane Controller Tampering Alarm |
| `EVENT_ACS_CHANNEL_CONTROLLER_DESMANTLE_RESUME` | 47 | Lane Controller Tampering Restored |
| `EVENT_ACS_CHANNEL_CONTROLLER_FIRE_IMPORT_ALARM` | 48 | Lane Controller Fire Input Alarm |
| `EVENT_ACS_CHANNEL_CONTROLLER_FIRE_IMPORT_RESUME` | 49 | Lane Controller Fire Input Restored |
| `EVENT_ACS_STAY_EVENT` | / | Staying Event |
| `EVENT_ACS_LEGAL_EVENT_NEARLY_FULL` | / | No Memory Alarm for Valid Offline Event Storage |

---

## Major 1: Alarm Input Event Linkage

| Minor Type | Value | Açıklama |
|---|---|---|
| `EVENT_ACS_ALARMIN_SHORT_CIRCUIT` | 0 | Zone Short Circuit Attempts Alarm |
| `EVENT_ACS_ALARMIN_BROKEN_CIRCUIT` | 1 | Zone Open Circuit Attempts Alarm |
| `EVENT_ACS_ALARMIN_EXCEPTION` | 2 | Zone Exception Alarm |
| `EVENT_ACS_ALARMIN_RESUME` | 3 | Zone Alarm Restored |
| `EVENT_ACS_CASE_SENSOR_ALARM` | 4 | Alarm Input Alarm |
| `EVENT_ACS_CASE_SENSOR_RESUME` | 5 | Alarm Input Alarm Restored |

---

## Major 2: Access Control Point Event Linkage ⭐

> **En sık kullanılan** linkage tipi. Kapı seviyesinde event'leri başka action'lara bağlamak için.

| Minor Type | Value | Açıklama |
|---|---|---|
| `EVENT_ACS_LEADER_CARD_OPEN_BEGIN` | 0 | Open Door with First Card Started |
| `EVENT_ACS_LEADER_CARD_OPEN_END` | 1 | Open Door with First Card Ended |
| `EVENT_ACS_ALWAYS_OPEN_BEGIN` | 2 | Remain Open Started |
| `EVENT_ACS_ALWAYS_OPEN_END` | 3 | Remain Open Ended |
| `EVENT_ACS_ALWAYS_CLOSE_BEGIN` | 4 | Remain Closed Started |
| `EVENT_ACS_ALWAYS_CLOSE_END` | 5 | Remain Closed Ended |
| `EVENT_ACS_LOCK_OPEN` | 6 | **Door Unlocked** |
| `EVENT_ACS_LOCK_CLOSE` | 7 | **Door Locked** |
| `EVENT_ACS_DOOR_BUTTON_PRESS` | 8 | Exit Button Pressed |
| `EVENT_ACS_DOOR_BUTTON_RELEASE` | 9 | Exit Button Released |
| `EVENT_ACS_DOOR_OPEN_NORMAL` | 10 | Door Open (Contact) |
| `EVENT_ACS_DOOR_CLOSE_NORMAL` | 11 | Door Closed (Contact) |
| `EVENT_ACS_DOOR_OPEN_ABNORMAL` | 12 | Door Abnormally Open (Contact) |
| `EVENT_ACS_DOOR_OPEN_TIMEOUT` | 13 | Door Open Timed Out (Contact) |
| `EVENT_ACS_REMOTE_OPEN_DOOR` | 14 | Door Remotely Open |
| `EVENT_ACS_REMOTE_CLOSE_DOOR` | 15 | Door Remotely Closed |
| `EVENT_ACS_REMOTE_ALWAYS_OPEN` | 16 | Remain Open Remotely |
| `EVENT_ACS_REMOTE_ALWAYS_CLOSE` | 17 | Remain Closed Remotely |
| `EVENT_ACS_NOT_BELONG_MULTI_GROUP` | 18 | Card Not in Multi Auth Group |
| `EVENT_ACS_INVALID_MULTI_VERIFY_PERIOD` | 19 | Card Not in Multi Auth Duration |
| `EVENT_ACS_MULTI_VERIFY_SUPER_RIGHT_FAIL` | 20 | Multi Auth: Super Password Failed |
| `EVENT_ACS_MULTI_VERIFY_REMOTE_RIGHT_FAIL` | 21 | Multi Auth: Remote Failed |
| `EVENT_ACS_MULTI_VERIFY_SUCCESS` | 22 | Multi Auth Completed |
| `EVENT_ACS_MULTI_VERIFY_NEED_REMOTE_OPEN` | 23 | Multi Auth: Remote Open Door |
| `EVENT_ACS_MULTI_VERIFY_SUPERPASSWD_VERIFY_SUCCESS` | 24 | Super Password Auth Completed |
| `EVENT_ACS_MULTI_VERIFY_REPEAT_VERIFY_FAIL` | 25 | Repeated Auth Failed |
| `EVENT_ACS_MULTI_VERIFY_TIMEOUT` | 26 | Multi Auth Timed Out |
| `EVENT_ACS_REMOTE_CAPTURE_PIC` | 27 | Remote Capture |
| `EVENT_ACS_DOORBELL_RINGING` | 28 | Doorbell Ring |
| `EVENT_ACS_SECURITY_MODULE_DESMANTLE_ALARM` | 29 | Secure Door Control Unit Tampering |
| `EVENT_ACS_CALL_CENTER` | 30 | Center Event |
| `EVENT_ACS_FIRSTCARD_AUTHORIZE_BEGIN` | 31 | First Card Authentication Started |
| `EVENT_ACS_FIRSTCARD_AUTHORIZE_END` | 32 | First Card Authentication End |
| `EVENT_ACS_DOORLOCK_INPUT_SHORT_CIRCUIT` | 33 | Lock Input Short Circuit |
| `EVENT_ACS_DOORLOCK_INPUT_BROKEN_CIRCUIT` | 34 | Lock Input Open Circuit |
| `EVENT_ACS_DOORLOCK_INPUT_EXCEPTION` | 35 | Lock Input Exception |
| `EVENT_ACS_DOORCONTACT_INPUT_SHORT_CIRCUIT` | 36 | Contact Input Short Circuit |
| `EVENT_ACS_DOORCONTACT_INPUT_BROKEN_CIRCUIT` | 37 | Contact Input Open Circuit |
| `EVENT_ACS_DOORCONTACT_INPUT_EXCEPTION` | 38 | Contact Input Exception |
| `EVENT_ACS_OPENBUTTON_INPUT_SHORT_CIRCUIT` | 39 | Exit Button Short Circuit |
| `EVENT_ACS_OPENBUTTON_INPUT_BROKEN_CIRCUIT` | 40 | Exit Button Open Circuit |
| `EVENT_ACS_OPENBUTTON_INPUT_EXCEPTION` | 41 | Exit Button Exception |
| `EVENT_ACS_DOORLOCK_OPEN_EXCEPTION` | 42 | Unlocking Exception |
| `EVENT_ACS_DOORLOCK_OPEN_TIMEOUT` | 43 | Unlocking Timed Out |
| `EVENT_ACS_FIRSTCARD_OPEN_WITHOUT_AUTHORIZE` | 44 | Unauthorized First Card Opening |
| `EVENT_ACS_CALL_LADDER_RELAY_BREAK` | 45 | Call Elevator Relay Open |
| `EVENT_ACS_CALL_LADDER_RELAY_CLOSE` | 46 | Call Elevator Relay Closed |
| `EVENT_ACS_AUTO_KEY_RELAY_BREAK` | 47 | Auto Button Relay Open |
| `EVENT_ACS_AUTO_KEY_RELAY_CLOSE` | 48 | Auto Button Relay Closed |
| `EVENT_ACS_KEY_CONTROL_RELAY_BREAK` | 49 | Button Relay Open |
| `EVENT_ACS_KEY_CONTROL_RELAY_CLOSE` | 50 | Button Relay Closed |
| `EVENT_ACS_REMOTE_VISITOR_CALL_LADDER` | 51 | Visitor Calling Elevator |
| `EVENT_ACS_REMOTE_HOUSEHOLD_CALL_LADDER` | 52 | Resident Calling Elevator |
| `EVENT_ACS_LEGAL_MESSAGE` | 52 | Valid Message |
| `EVENT_ACS_ILLEGAL_MESSAGE` | 53 | Invalid Message |
| `EVENT_ACS_TRAILING` | 54 | **Tailgating** ⚠️ |
| `EVENT_ACS_REVERSE_ACCESS` | 55 | **Reverse Passing** ⚠️ |
| `EVENT_ACS_FORCE_ACCESS` | 56 | **Force Collision** ⚠️ |
| `EVENT_ACS_CLIMBING_OVER_GATE` | 57 | **Climbing Over** ⚠️ |
| `EVENT_ACS_PASSING_TIMEOUT` | 58 | Passing Timed Out |
| `EVENT_ACS_INTRUSION_ALARM` | 59 | Intrusion Alarm |
| `EVENT_ACS_FREE_GATE_PASS_NOT_AUTH` | 60 | Auth Failed When Free Passing |
| `EVENT_ACS_DROP_ARM_BLOCK` | 61 | Barrier Obstructed |
| `EVENT_ACS_DROP_ARM_BLOCK_RESUME` | 62 | Barrier Restored |
| `EVENT_ACS_REMOTE_CONTROL_CLOSE_DOOR` | 63 | Keyfob: Close Door |
| `EVENT_ACS_REMOTE_CONTROL_OPEN_DOOR` | 64 | Keyfob: Open Door |
| `EVENT_ACS_REMOTE_CONTROL_ALWAYS_OPEN_DOOR` | 65 | Keyfob: Remain Open |

---

## Major 3: Authentication Unit Event Linkage ⭐

> **Kart okuyucu seviyesinde** event'ler — kart okutma, parmak izi, yüz tanıma sonuçları.

| Minor Type | Value | Açıklama |
|---|---|---|
| `EVENT_ACS_STRESS_ALARM` | 0 | Duress Alarm |
| `EVENT_ACS_CARD_READER_DESMANTLE_ALARM` | 1 | Card Reader Tampering Alarm |
| `EVENT_ACS_LEGAL_CARD_PASS` | 2 | **Valid Card Authentication Completed** ✅ |
| `EVENT_ACS_CARD_AND_PSW_PASS` | 3 | Card + Password Auth Completed |
| `EVENT_ACS_CARD_AND_PSW_FAIL` | 4 | Card + Password Auth Failed |
| `EVENT_ACS_CARD_AND_PSW_TIMEOUT` | 5 | Card + Password Auth Timed Out |
| `EVENT_ACS_CARD_MAX_AUTHENTICATE_FAIL` | 6 | Card Auth Attempts Reach Limit |
| `EVENT_ACS_CARD_NO_RIGHT` | 7 | **No Permission for Card** ❌ |
| `EVENT_ACS_CARD_INVALID_PERIOD` | 8 | Invalid Card Swiping Period |
| `EVENT_ACS_CARD_OUT_OF_DATE` | 9 | Expired Card |
| `EVENT_ACS_INVALID_CARD` | 10 | Card No. Not Exist |
| `EVENT_ACS_ANTI_SNEAK_FAIL` | 11 | Anti-passing Back Auth Failed |
| `EVENT_ACS_INTERLOCK_DOOR_NOT_CLOSE` | 12 | Interlocking Door Not Closed |
| `EVENT_ACS_FINGERPRINT_COMPARE_PASS` | 13 | Fingerprint Matched |
| `EVENT_ACS_FINGERPRINT_COMPARE_FAIL` | 14 | Fingerprint Mismatched |
| `EVENT_ACS_CARD_FINGERPRINT_VERIFY_PASS` | 15 | Card + Fingerprint Completed |
| `EVENT_ACS_CARD_FINGERPRINT_VERIFY_FAIL` | 16 | Card + Fingerprint Failed |
| `EVENT_ACS_CARD_FINGERPRINT_VERIFY_TIMEOUT` | 17 | Card + Fingerprint Timed Out |
| `EVENT_ACS_CARD_FINGERPRINT_PASSWD_VERIFY_PASS` | 18 | Card + FP + PW Completed |
| `EVENT_ACS_CARD_FINGERPRINT_PASSWD_VERIFY_FAIL` | 19 | Card + FP + PW Failed |
| `EVENT_ACS_CARD_FINGERPRINT_PASSWD_VERIFY_TIMEOUT` | 20 | Card + FP + PW Timed Out |
| `EVENT_ACS_FINGERPRINT_PASSWD_VERIFY_PASS` | 21 | Fingerprint + Password Completed |
| `EVENT_ACS_FINGERPRINT_PASSWD_VERIFY_FAIL` | 22 | Fingerprint + Password Failed |
| `EVENT_ACS_FINGERPRINT_PASSWD_VERIFY_TIMEOUT` | 23 | Fingerprint + Password Timed Out |
| `EVENT_ACS_FINGERPRINT_INEXISTENCE` | 24 | Fingerprint Not Exist |
| `EVENT_ACS_EMPLOYEENO_AND_FP_VERIFY_PASS` | 42 | Employee ID + FP Completed |
| `EVENT_ACS_EMPLOYEENO_AND_FP_VERIFY_FAIL` | 43 | Employee ID + FP Failed |
| `EVENT_ACS_EMPLOYEENO_AND_FP_VERIFY_TIMEOUT` | 44 | Employee ID + FP Timed Out |
| `EVENT_ACS_EMPLOYEENO_AND_FP_AND_PW_VERIFY_PASS` | 45 | Employee ID + FP + PW Completed |
| `EVENT_ACS_EMPLOYEENO_AND_FP_AND_PW_VERIFY_FAIL` | 46 | Employee ID + FP + PW Failed |
| `EVENT_ACS_EMPLOYEENO_AND_FP_AND_PW_VERIFY_TIMEOUT` | 47 | Employee ID + FP + PW Timed Out |
| `EVENT_ACS_EMPLOYEENO_AND_PW_PASS` | 52 | Employee ID + Password Completed |
| `EVENT_ACS_EMPLOYEENO_AND_PW_FAIL` | 52 | Employee ID + Password Failed |
| `EVENT_ACS_EMPLOYEENO_AND_PW_TIMEOUT` | 53 | Employee ID + Password Timed Out |
| `EVENT_ACS_DOOR_OPEN_OR_DORMANT_FAIL` | 57 | Auth Failed: Door Closed/Sleeping |
| `EVENT_ACS_AUTH_PLAN_DORMANT_FAIL` | 58 | Auth Failed: Auth Schedule Sleeping |
| `EVENT_ACS_CARD_ENCRYPT_VERIFY_FAIL` | 59 | Card Encryption Verification Failed |
| `EVENT_ACS_SUBMARINEBACK_REPLY_FAIL` | 60 | Anti-passing Back Server Response Failed |
| `EVENT_ACS_PASSWORD_MISMATCH` | 61 | Password Mismatched |
| `EVENT_ACS_EMPLOYEE_NO_NOT_EXIST` | 62 | Employee ID Not Exist |
| `EVENT_ACS_COMBINED_VERIFY_PASS` | 63 | Combined Auth Completed |
| `EVENT_ACS_COMBINED_VERIFY_TIMEOUT` | 64 | Combined Auth Timed Out |
| `EVENT_ACS_VERIFY_MODE_MISMATCH` | 65 | Auth Type Mismatched |
| `EVENT_ACS_PSW_ERROR_OVER_TIMES` | 67 | Max Password Auth Failures |
| `EVENT_ACS_PSW_VERIFY_PASS` | 68 | Password Authenticated |
| `EVENT_ACS_PSW_VERIFY_FAIL` | 69 | Password Auth Failed |
| `EVENT_ACS_ORCODE_VERIFY_PASS` | 70 | **QR Code Authenticated** ✅ |
| `EVENT_ACS_ORCODE_VERIFY_FAIL` | 71 | QR Code Auth Failed |
| `EVENT_ACS_HOUSEHOLDER_AUTHORIZE_PASS` | 72 | Resident Authorization Auth |
| `EVENT_ACS_BLUETOOTH_VERIFY_PASS` | 73 | **Bluetooth Authenticated** ✅ |
| `EVENT_ACS_BLUETOOTH_VERIFY_FAIL` | 74 | Bluetooth Auth Failed |
| `EVENT_ACS_INFORMAL_M1_CARD_VERIFY_FAIL` | / | Auth Failed: Invalid M1 Card |
| `EVENT_ACS_CPU_CARD_ENCRYPT_VERIFY_FAIL` | / | CPU Card Encryption Failed |
| `EVENT_ACS_NFC_DISABLE_VERIFY_FAIL` | / | Disabling NFC Verification Failed |
| `EVENT_ACS_EM_CARD_RECOGNIZE_NOT_ENABLED` | / | EM Card Recognition Disabled |
| `EVENT_ACS_M1_CARD_RECOGNIZE_NOT_ENABLED` | / | M1 Card Recognition Disabled |
| `EVENT_ACS_CPU_CARD_RECOGNIZE_NOT_ENABLED` | / | CPU Card Recognition Disabled |
| `EVENT_ACS_ID_CARD_RECOGNIZE_NOT_ENABLED` | / | ID Card Recognition Disabled |
| `EVENT_ACS_CARD_SET_SECRET_KEY_FAIL` | / | Importing Key to Card Failed |

---

## ngsaccess Tarafında Notlar

### Linkage Senaryosu
"Kapı zorla açıldığında alarm output'u tetikle":
```c
NET_DVR_EVENT_CARD_LINKAGE_CFG_V50 cfg = {0};
cfg.uLinkageInfo.struEventLinkage.wMainEventType = 2;   // Access Control Point
cfg.uLinkageInfo.struEventLinkage.wSubEventType  = 56;  // Force Collision
// → action: alarm output, siren, capture
```

### ngsaccess'te Linkage Yönetimi
Çoğu durumda **linkage tanımlamaya gerek yok** — cihazlar default olarak event'leri sunucuya yollar. Linkage daha çok **hardware action** (siren, output) için kullanılır. ngsaccess sadece **soft action** (DB kayıt, notification) yaptığı için bu menü minimum kullanılır.

---

## İlgili Belgeler
- [docs/sdk/02-typical-applications/2.6-alarm-event-receiving.md](../02-typical-applications/2.6-alarm-event-receiving.md) — Linkage configure akışı
- [docs/sdk/appendix-c/c.1-access-control-event-types.md](./c.1-access-control-event-types.md) — Cihazdan dönen event tipleri (linkage'la karıştırma)
- [docs/sdk/04-structures-enumerations.md](../04-structures-enumerations.md) — `NET_DVR_EVENT_CARD_LINKAGE_CFG_V50` struct
