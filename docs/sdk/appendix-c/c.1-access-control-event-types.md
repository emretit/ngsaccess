# Erişim Kontrol Event Tipleri (Access Control Event Types)

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Ek C.1, s.364–381

## Özet

Hikvision erişim kontrol cihazlarının yayınladığı tüm event'ler **major type + minor type** kombinasyonu ile sınıflandırılır. ngsaccess `/card-reader` endpoint'ine gelen her event'in `majorEventType` (veya `major`) ve `subEventType` (veya `minor`) alanları bu tablolardan biriyle eşleşir.

### 4 Major Type

| Major | Adı | Hex | Anlamı |
|---|---|---|---|
| 1 | `MAJOR_ALARM` | 0x1 | Donanım/yazılım alarmları (zone, fire, tamper, panic) |
| 2 | `MAJOR_EXCEPTION` | 0x2 | Sistem istisnaları (network broken, device offline, low battery) |
| 3 | `MAJOR_OPERATION` | 0x3 | Kullanıcı/sistem operasyonları (login, manual door open, config change) |
| 5 | `MAJOR_EVENT` | 0x5 | Normal erişim event'leri (kart okutuldu, parmak izi eşleşti, kapı açıldı) ⭐ |

> **ngsaccess için en kritik major = 0x5 (MAJOR_EVENT).** Kart okutma, kapı açma, kimlik doğrulama event'leri buradan gelir.

---

## MAJOR_ALARM (0x1) — Alarm Event'leri

| Minor Type | Value | Açıklama |
|---|---|---|
| `MINOR_ALARMIN_SHORT_CIRCUIT` | 0x400 | Zone Short Circuit Attempts Alarm |
| `MINOR_ALARMIN_BROKEN_CIRCUIT` | 0x401 | Zone Disconnected Alarm |
| `MINOR_ALARMIN_EXCEPTION` | 0x402 | Zone Exception Alarm |
| `MINOR_ALARMIN_RESUME` | 0x403 | Zone Restored |
| `MINOR_HOST_DESMANTLE_ALARM` | 0x404 | Zone Tampering Alarm |
| `MINOR_HOST_DESMANTLE_RESUME` | 0x405 | Zone Tampering Restored |
| `MINOR_CARD_READER_DESMANTLE_ALARM` | 0x406 | Card Reader Tampering Alarm |
| `MINOR_CARD_READER_DESMANTLE_RESUME` | 0x407 | Card Reader Tampering Restored |
| `MINOR_CASE_SENSOR_ALARM` | 0x408 | Alarm Input Alarm Triggered |
| `MINOR_CASE_SENSOR_RESUME` | 0x409 | Alarm Input Restored |
| `MINOR_STRESS_ALARM` | 0x40a | Duress Alarm |
| `MINOR_OFFLINE_ECENT_NEARLY_FULL` | 0x40b | No Memory Alarm for Offline Events |
| `MINOR_CARD_MAX_AUTHENTICATE_FAIL` | 0x40c | Maximum Failed Card Authentications Alarm |
| `MINOR_SD_CARD_FULL` | 0x40d | SD Card Full Alarm |
| `MINOR_LINKAGE_CAPTURE_PIC` | 0x40e | Capture Linkage Alarm |
| `MINOR_SECURITY_MODULE_DESMANTLE_ALARM` | 0x40f | Secure Door Control Unit Tampering Alarm |
| `MINOR_SECURITY_MODULE_DESMANTLE_RESUME` | 0x410 | Secure Door Control Unit Tampering Restored |
| `MINOR_FIRE_IMPORT_SHORT_CIRCUIT` | 0x415 | Fire Input Short Circuit Attempts Alarm |
| `MINOR_FIRE_IMPORT_BROKEN_CIRCUIT` | 0x416 | Fire Input Open Circuit Attempts Alarm |
| `MINOR_FIRE_IMPORT_RESUME` | 0x417 | Fire Input Restored |
| `MINOR_FIRE_BUTTON_TRIGGER` | 0x418 | Fire Button Triggered |
| `MINOR_FIRE_BUTTON_RESUME` | 0x419 | Fire Button Resumed |
| `MINOR_MAINTENANCE_BUTTON_TRIGGER` | 0x41a | Maintenance Button Triggered |
| `MINOR_MAINTENANCE_BUTTON_RESUME` | 0x41b | Maintenance Button Resumed |
| `MINOR_EMERGENCY_BUTTON_TRIGGER` | 0x41c | Panic Button Triggered |
| `MINOR_EMERGENCY_BUTTON_RESUME` | 0x41d | Panic Button Resumed |
| `MINOR_DISTRACT_CONTROLLER_ALARM` | 0x41e | Distributed Elevator Controller Tampering Alarm |
| `MINOR_DISTRACT_CONTROLLER_RESUME` | 0x41f | Distributed Elevator Controller Tampering Restored |
| `MINOR_CHANNEL_CONTROLLER_DESMANTLE_ALARM` | 0x422 | Lane Controller Tampering Alarm |
| `MINOR_CHANNEL_CONTROLLER_DESMANTLE_RESUME` | 0x423 | Lane Controller Tampering Alarm Restored |
| `MINOR_CHANNEL_CONTROLLER_FIRE_IMPORT_ALARM` | 0x424 | Lane Controller Fire Input Alarm |
| `MINOR_CHANNEL_CONTROLLER_FIRE_IMPORT_RESUME` | 0x425 | Lane Controller Fire Input Alarm Restored |
| `MINOR_PRINTER_OUT_OF_PAPER` | 0x440 | No Paper in Printer Alarm |
| `MINOR_LEGAL_EVENT_NEARLY_FULL` | 0x442 | No Memory Alarm for Valid Offline Events |
| `MINOR_ALARM_CUSTOM1` – `MINOR_ALARM_CUSTOM64` | 0x900–0x93f | Access Control: Custom Alarm Event 1–64 |

---

## MAJOR_EXCEPTION (0x2) — İstisnalar

| Minor Type | Value | Açıklama |
|---|---|---|
| `MINOR_NET_BROKEN` | 0x27 | Network Disconnected |
| `MINOR_RS485_DEVICE_ABNORMAL` | 0x3a | RS485 Connection Exception |
| `MINOR_RS485_DEVICE_REVERT` | 0x3b | RS485 Connection Restored |
| `MINOR_DEV_POWER_ON` | 0x400 | Power on |
| `MINOR_DEV_POWER_OFF` | 0x401 | Power off |
| `MINOR_WATCH_DOG_RESET` | 0x402 | Watchdog Reset |
| `MINOR_LOW_BATTERY` | 0x403 | Low Battery Voltage |
| `MINOR_BATTERY_RESUME` | 0x404 | Battery Voltage Restored |
| `MINOR_AC_OFF` | 0x405 | AC Power Disconnected |
| `MINOR_AC_RESUME` | 0x406 | AC Power Restored |
| `MINOR_NET_RESUME` | 0x407 | Network Restored |
| `MINOR_FLASH_ABNORMAL` | 0x408 | Flash Reading and Writing Exception |
| `MINOR_CARD_READER_OFFLINE` | 0x409 | Card Reader Offline |
| `MINOR_CAED_READER_RESUME` | 0x40a | Card Reader Online |
| `MINOR_INDICATOR_LIGHT_OFF` | 0x40b | Indicator Turns off |
| `MINOR_INDICATOR_LIGHT_RESUME` | 0x40c | Indicator Resumed |
| `MINOR_CHANNEL_CONTROLLER_OFF` | 0x40d | Lane Controller Offline |
| `MINOR_CHANNEL_CONTROLLER_RESUME` | 0x40e | Lane Controller Online |
| `MINOR_SECURITY_MODULE_OFF` | 0x40f | Secure Door Control Unit Offline |
| `MINOR_SECURITY_MODULE_RESUME` | 0x410 | Secure Door Control Unit Online |
| `MINOR_BATTERY_ELECTRIC_LOW` | 0x411 | Low Battery Voltage (Face Recognition Terminal) |
| `MINOR_BATTERY_ELECTRIC_RESUME` | 0x412 | Battery Voltage Recovered (Face Recognition Terminal) |
| `MINOR_LOCAL_CONTROL_NET_BROKEN` | 0x413 | Network of Distributed Access Controller Disconnected |
| `MINOR_LOCAL_CONTROL_NET_RSUME` | 0x414 | Network of Distributed Access Controller Restored |
| `MINOR_MASTER_RS485_LOOPNODE_BROKEN` | 0x415 | RS485 Loop of Main Access Controller Disconnected |
| `MINOR_MASTER_RS485_LOOPNODE_RESUME` | 0x416 | RS485 Loop of Main Access Controller Connected |
| `MINOR_LOCAL_CONTROL_OFFLINE` | 0x417 | Distributed Access Controller Offline |
| `MINOR_LOCAL_CONTROL_RESUME` | 0x418 | Distributed Access Controller Online |
| `MINOR_LOCAL_DOWNSIDE_RS485_LOOPNODE_BROKEN` | 0x419 | Downstream RS485 Loop Disconnected |
| `MINOR_LOCAL_DOWNSIDE_RS485_LOOPNODE_RESUME` | 0x41a | Downstream RS485 Loop Connected |
| `MINOR_DISTRACT_CONTROLLER_ONLINE` | 0x41b | Distributed Elevator Controller Online |
| `MINOR_DISTRACT_CONTROLLER_OFFLINE` | 0x41c | Distributed Elevator Controller Offline |
| `MINOR_ID_CARD_READER_NOT_CONNECT` | 0x41d | ID Card Reader Disconnected |
| `MINOR_ID_CARD_READER_RESUME` | 0x41e | ID Card Reader Connected |
| `MINOR_FINGER_PRINT_MODULE_NOT_CONNECT` | 0x41f | Fingerprint Module Disconnected |
| `MINOR_FINGER_PRINT_MODULE_RESUME` | 0x420 | Fingerprint Module Connected |
| `MINOR_CAMERA_NOT_CONNECT` | 0x421 | Camera Disconnected |
| `MINOR_CAMERA_RESUME` | 0x422 | Camera Connected |
| `MINOR_COM_NOT_CONNECT` | 0x423 | COM Port Disconnected |
| `MINOR_COM_RESUME` | 0x424 | COM Port Connected |
| `MINOR_DEVICE_NOT_AUTHORIZE` | 0x425 | Device Unauthorized |
| `MINOR_PEOPLE_AND_ID_CARD_DEVICE_ONLINE` | 0x426 | Face Recognition Terminal Online |
| `MINOR_PEOPLE_AND_ID_CARD_DEVICE_OFFLINE` | 0x427 | Face Recognition Terminal Offline |
| `MINOR_LOCAL_LOGIN_LOCK` | 0x428 | Local Login Lock |
| `MINOR_LOCAL_LOGIN_UNLOCK` | 0x429 | Local Login Unlock |
| `MINOR_SUBMARINEBACK_COMM_BREAK` | 0x42a | Communication with Anti-passing Back Server Failed |
| `MINOR_SUBMARINEBACK_COMM_RESUME` | 0x42b | Communication with Anti-passing Back Server Restored |
| `MINOR_MOTOR_SENSOR_EXCEPTION` | 0x42c | Motor or Sensor Exception |
| `MINOR_CAN_BUS_EXCEPTION` | 0x42d | CAN Bus Exception |
| `MINOR_CAN_BUS_RESUME` | 0x42e | CAN Bus Exception Restored |
| `MINOR_GATE_TEMPERATURE_OVERRUN` | 0x42f | Too High Pedestal Temperature |
| `MINOR_IR_EMITTER_EXCEPTION` | 0x430 | Active Infrared Intrusion Detector Exception |
| `MINOR_IR_EMITTER_RESUME` | 0x431 | Active Infrared Intrusion Detector Restored |
| `MINOR_LAMP_BOARD_COMM_EXCEPTION` | 0x432 | Communication with Light Board Failed |
| `MINOR_LAMP_BOARD_COMM_RESUME` | 0x433 | Communication with Light Board Restored |
| `MINOR_IR_ADAPTOR_COMM_EXCEPTION` | 0x434 | Communication with IR Adaptor Failed |
| `MINOR_IR_ADAPTOR_COMM_RESUME` | 0x435 | Communication with IR Adaptor Restored |
| `MINOR_PRINTER_ONLINE` | 0x436 | Printer Online |
| `MINOR_PRINTER_OFFLINE` | 0x437 | Printer Offline |
| `MINOR_4G_MOUDLE_ONLINE` | 0x438 | 4G Module Online |
| `MINOR_4G_MOUDLE_OFFLINE` | 0x439 | 4G Module Offline |
| `MINOR_AUXILIARY_BOARD_OFFLINE` | 0x43c | Auxiliary Board Disconnected |
| `MINOR_AUXILIARY_BOARD_RESUME` | 0x43d | Auxiliary Board Connected |
| `MINOR_IDCARD_SECURITY_MOUDLE_EXCEPTION` | 0x43e | Secure ID Card Unit Exception |
| `MINOR_IDCARD_SECURITY_MOUDLE_RESUME` | 0x43f | Secure ID Card Unit Restored |
| `MINOR_FP_PERIPHERAL_EXCEPTION` | 0x440 | Fingerprint Collection Peripheral Exception |
| `MINOR_FP_PERIPHERAL_RESUME` | 0x441 | Fingerprint Collection Peripheral Restored |
| `MINOR_EXTEND_MODULE_ONLINE` | 0x44d | Extension Module Online |
| `MINOR_EXTEND_MODULE_OFFLINE` | 0x44e | Extension Module Offline |
| `MINOR_EXCEPTION_CUSTOM1` – `MINOR_EXCEPTION_CUSTOM64` | 0x900–0x93f | Access Control: Custom Exception Event 1–64 |

---

## MAJOR_OPERATION (0x3) — Operasyon Event'leri

| Minor Type | Value | Açıklama |
|---|---|---|
| `MINOR_LOCAL_LOGIN` | 0x50 | Local Login |
| `MINOR_LOCAL_LOGOUT` | 0x51 | Local Logout |
| `MINOR_LOCAL_UPGRADE` | 0x5a | Local Upgrade |
| `MINOR_REMOTE_LOGIN` | 0x70 | Remote Login |
| `MINOR_REMOTE_LOGOUT` | 0x71 | Remote Logout |
| `MINOR_REMOTE_ARM` | 0x79 | Remote Arming |
| `MINOR_REMOTE_DISARM` | 0x7a | Remote Disarming |
| `MINOR_REMOTE_REBOOT` | 0x7b | Remote Reboot |
| `MINOR_REMOTE_UPGRADE` | 0x7e | Remote Upgrade |
| `MINOR_REMOTE_CFGFILE_OUTPUT` | 0x86 | Export Configuration File |
| `MINOR_REMOTE_CFGFILE_INTPUT` | 0x87 | Import Configuration File |
| `MINOR_REMOTE_ALARMOUT_OPEN_MAN` | 0xd6 | Enable Alarm Output Manually |
| `MINOR_REMOTE_ALARMOUT_CLOSE_MAN` | 0xd7 | Disable Alarm Output Manually |
| `MINOR_REMOTE_OPEN_DOOR` | 0x400 | **Door Remotely Open** ⭐ |
| `MINOR_REMOTE_CLOSE_DOOR` | 0x401 | **Door Remotely Closed** ⭐ |
| `MINOR_REMOTE_ALWAYS_OPEN` | 0x402 | Remain Open Remotely |
| `MINOR_REMOTE_ALWAYS_CLOSE` | 0x403 | Remain Closed Remotely |
| `MINOR_REMOTE_CHECK_TIME` | 0x404 | Manual Time Sync |
| `MINOR_NTP_CHECK_TIME` | 0x405 | Network Time Protocol Synchronization |
| `MINOR_REMOTE_CLEAR_CARD` | 0x406 | Clear All Card No. |
| `MINOR_REMOTE_RESTORE_CFG` | 0x407 | Restore Defaults |
| `MINOR_ALARMIN_ARM` | 0x408 | Zone Arming |
| `MINOR_ALARMIN_DISARM` | 0x409 | Zone Disarming |
| `MINOR_LOCAL_RESTORE_CFG` | 0x40a | Local Restore Defaults |
| `MINOR_REMOTE_CAPTURE_PIC` | 0x40b | Remote Capture |
| `MINOR_MOD_NET_REPORT_CFG` | 0x40c | Edit Network Parameters |
| `MINOR_MOD_GPRS_REPORT_PARAM` | 0x40d | Edit GPRS Parameters |
| `MINOR_MOD_REPORT_GROUP_PARAM` | 0x40e | Edit Control Center Parameters |
| `MINOR_UNLOCK_PASSWORD_OPEN_DOOR` | 0x40f | Enter Dismiss Code |
| `MINOR_AUTO_RENUMBER` | 0x410 | Auto Renumber |
| `MINOR_AUTO_COMPLEMENT_NUMBER` | 0x411 | Auto Supplement Number |
| `MINOR_NORMAL_CFGFILE_INPUT` | 0x412 | Import Configuration File |
| `MINOR_NORMAL_CFGFILE_OUTTPUT` | 0x413 | Export Configuration File |
| `MINOR_CARD_RIGHT_INPUT` | 0x414 | Import Card Permission |
| `MINOR_CARD_RIGHT_OUTTPUT` | 0x415 | Export Card Permission |
| `MINOR_LOCAL_USB_UPGRADE` | 0x416 | Upgrade via USB flash Drive |
| `MINOR_REMOTE_VISITOR_CALL_LADDER` | 0x417 | Visitor Calling Elevator |
| `MINOR_REMOTE_HOUSEHOLD_CALL_LADDER` | 0x418 | Resident Calling Elevator |
| `MINOR_REMOTE_ACTUAL_GUARD` | 0x419 | Remotely Arming |
| `MINOR_REMOTE_ACTUAL_UNGUARD` | 0x41a | Remotely Disarming |
| `MINOR_REMOTE_CONTROL_NOT_CODE_OPER_FAILED` | 0x41b | Keyfob Not Pairing |
| `MINOR_REMOTE_CONTROL_CLOSE_DOOR` | 0x41c | Keyfob Operation: Close Door |
| `MINOR_REMOTE_CONTROL_OPEN_DOOR` | 0x41d | Keyfob Operation: Open Door |
| `MINOR_REMOTE_CONTROL_ALWAYS_OPEN_DOOR` | 0x41e | Keyfob Operation: Remain Door Open |
| `MINOR_M1_CARD_ENCRYPT_VERIFY_OPEN` | 0x41f | M1 Card Encryption Verification Enabled |
| `MINOR_M1_CARD_ENCRYPT_VERIFY_CLOSE` | 0x420 | M1 Card Encryption Verification Disabled |
| `MINOR_NFC_FUNCTION_OPEN` | 0X421 | Opening Door with NFC Card Enabled |
| `MINOR_NFC_FUNCTION_CLOSE` | 0X422 | Opening Door with NFC Card Disabled |
| `MINOR_OFFLINE_DATA_OUTPUT` | 0x423 | Export Offline Collected Data |
| `MINOR_CREATE_SSH_LINK` | 0x42d | Establish SSH Connection |
| `MINOR_CLOSE_SSH_LINK` | 0x42e | Disconnect SSH Connection |
| `MINOR_BLUETOOTH_KEY_MODIFY` | / | Bluetooth Key Modified |
| `MINOR_OPERATION_CUSTOM1` – `MINOR_OPERATION_CUSTOM64` | 0x900–0x93f | Custom Operation 1–64 |

---

## MAJOR_EVENT (0x5) — Normal Erişim Event'leri ⭐

> **Bu tablo en sık kullanılan.** ngsaccess `cardReaderParse.ts` parser'ı bu kodlara göre kart okuma sonucunu (başarılı/başarısız/yetkisiz) ayırt etmeli.

| Minor Type | Value | Açıklama |
|---|---|---|
| `MINOR_LEGAL_CARD_PASS` | 0x01 | **Valid Card Authentication Completed** ✅ |
| `MINOR_CARD_AND_PSW_PASS` | 0x02 | Card and Password Authentication Completed |
| `MINOR_CARD_AND_PSW_FAIL` | 0x03 | Card and Password Authentication Failed |
| `MINOR_CARD_AND_PSW_TIMEOUT` | 0x04 | Card and Password Authentication Timed Out |
| `MINOR_CARD_AND_PSW_OVER_TIME` | 0x05 | Card and Password Authentication Timed Out |
| `MINOR_CARD_NO_RIGHT` | 0x06 | **No Permission** ❌ |
| `MINOR_CARD_INVALID_PERIOD` | 0x07 | **Invalid Card Swiping Time Period** ❌ |
| `MINOR_CARD_OUT_OF_DATE` | 0x08 | **Expired Card** ❌ |
| `MINOR_INVALID_CARD` | 0x09 | **Card No. Not Exist** ❌ |
| `MINOR_ANTI_SNEAK_FAIL` | 0x0a | Anti-passing Back Authentication Failed |
| `MINOR_INTERLOCK_DOOR_NOT_CLOSE` | 0x0b | Interlocking Door Not Closed |
| `MINOR_NOT_BELONG_MULTI_GROUP` | 0x0c | Card Not in Multiple Authentication Group |
| `MINOR_INVALID_MULTI_VERIFY_PERIOD` | 0x0d | Card Not in Multiple Authentication Duration |
| `MINOR_MULTI_VERIFY_SUPER_RIGHT_FAIL` | 0x0e | Super Password Authentication Failed |
| `MINOR_MULTI_VERIFY_REMOTE_RIGHT_FAIL` | 0x0f | Multiple Authentication Completed |
| `MINOR_MULTI_VERIFY_SUCCESS` | 0x10 | Multiple Authenticated |
| `MINOR_LEADER_CARD_OPEN_BEGIN` | 0x11 | Open Door with First Card Started |
| `MINOR_LEADER_CARD_OPEN_END` | 0x12 | Open Door with First Card Stopped |
| `MINOR_ALWAYS_OPEN_BEGIN` | 0x13 | Remain Open Started |
| `MINOR_ALWAYS_OPEN_END` | 0x14 | Remain Open Stopped |
| `MINOR_LOCK_OPEN` | 0x15 | **Door Unlocked** ⭐ |
| `MINOR_LOCK_CLOSE` | 0x16 | **Door Locked** ⭐ |
| `MINOR_DOOR_BUTTON_PRESS` | 0x17 | Exit Button Pressed |
| `MINOR_DOOR_BUTTON_RELEASE` | 0x18 | Exit Button Released |
| `MINOR_DOOR_OPEN_NORMAL` | 0x19 | Door Open (Contact) |
| `MINOR_DOOR_CLOSE_NORMAL` | 0x1a | Door Closed (Contact) |
| `MINOR_DOOR_OPEN_ABNORMAL` | 0x1b | Door Abnormally Open (Contact) |
| `MINOR_DOOR_OPEN_TIMEOUT` | 0x1c | Door Open Timed Out (Contact) |
| `MINOR_ALARMOUT_ON` | 0x1d | Alarm Output Enabled |
| `MINOR_ALARMOUT_OFF` | 0x1e | Alarm Output Disabled |
| `MINOR_ALWAYS_CLOSE_BEGIN` | 0x1f | Remain Closed Started |
| `MINOR_ALWAYS_CLOSE_END` | 0x20 | Remain Closed Stopped |
| `MINOR_MULTI_VERIFY_NEED_REMOTE_OPEN` | 0x21 | Multiple Authentications: Remotely Open Door |
| `MINOR_MULTI_VERIFY_SUPERPASSWD_VERIFY_SUCCESS` | 0x22 | Super Password Authentication Completed |
| `MINOR_MULTI_VERIFY_REPEAT_VERIFY` | 0x23 | Repeated Authentication |
| `MINOR_MULTI_VERIFY_TIMEOUT` | 0x24 | Multiple Authentications Timed Out |
| `MINOR_DOORBELL_RINGING` | 0x25 | Doorbell Ring |
| `MINOR_FINGERPRINT_COMPARE_PASS` | 0x26 | **Fingerprint Matched** ✅ |
| `MINOR_FINGERPRINT_COMPARE_FAIL` | 0x27 | **Fingerprint Mismatched** ❌ |
| `MINOR_CARD_FINGERPRINT_VERIFY_PASS` | 0x28 | Card and Fingerprint Authentication Completed |
| `MINOR_CARD_FINGERPRINT_VERIFY_FAIL` | 0x29 | Card and Fingerprint Authentication Failed |
| `MINOR_CARD_FINGERPRINT_VERIFY_TIMEOUT` | 0x2a | Card and Fingerprint Authentication Timed Out |
| `MINOR_CARD_FINGERPRINT_PASSWD_VERIFY_PASS` | 0x2b | Card + Fingerprint + Password Completed |
| `MINOR_CARD_FINGERPRINT_PASSWD_VERIFY_FAIL` | 0x2c | Card + Fingerprint + Password Failed |
| `MINOR_CARD_FINGERPRINT_PASSWD_VERIFY_TIMEOUT` | 0x2d | Card + Fingerprint + Password Timed Out |
| `MINOR_FINGERPRINT_PASSWD_VERIFY_PASS` | 0x2e | Fingerprint + Password Completed |
| `MINOR_FINGERPRINT_PASSWD_VERIFY_FAIL` | 0x2f | Fingerprint + Password Failed |
| `MINOR_FINGERPRINT_PASSWD_VERIFY_TIMEOUT` | 0x30 | Fingerprint + Password Timed Out |
| `MINOR_FINGERPRINT_INEXISTENCE` | 0x31 | Fingerprint Not Exists |
| `MINOR_CARD_PLATFORM_VERIFY` | 0x32 | Card Platform Authentication |
| `MINOR_CALL_CENTER` | 0x33 | Call Center |
| `MINOR_FIRE_RELAY_TURN_ON_DOOR_ALWAYS_OPEN` | 0x34 | Fire Relay Closed: Door Remains Open |
| `MINOR_FIRE_RELAY_RECOVER_DOOR_RECOVER_NORMAL` | 0x35 | Fire Relay Opened: Door Remains Closed |
| `MINOR_EMPLOYEENO_AND_FP_VERIFY_PASS` | 0x45 | Employee ID + Fingerprint Completed |
| `MINOR_EMPLOYEENO_AND_FP_VERIFY_FAIL` | 0x46 | Employee ID + Fingerprint Failed |
| `MINOR_EMPLOYEENO_AND_FP_VERIFY_TIMEOUT` | 0x47 | Employee ID + Fingerprint Timed Out |
| `MINOR_EMPLOYEENO_AND_FP_AND_PW_VERIFY_PASS` | 0x48 | Employee ID + Fingerprint + Password Completed |
| `MINOR_EMPLOYEENO_AND_FP_AND_PW_VERIFY_FAIL` | 0x49 | Employee ID + Fingerprint + Password Failed |
| `MINOR_EMPLOYEENO_AND_FP_AND_PW_VERIFY_TIMEOUT` | 0x4a | Employee ID + Fingerprint + Password Timed Out |
| `MINOR_FACE_VERIFY_PASS` | 0x4b | **Face Authentication Completed** ✅ |
| `MINOR_FACE_VERIFY_FAIL` | 0x4c | **Face Authentication Failed** ❌ |
| `MINOR_EMPLOYEENO_AND_FACE_VERIFY_PASS` | 0x4d | Employee ID + Face Completed |
| `MINOR_EMPLOYEENO_AND_FACE_VERIFY_FAIL` | 0x4e | Employee ID + Face Failed |
| `MINOR_EMPLOYEENO_AND_FACE_VERIFY_TIMEOUT` | 0x4f | Employee ID + Face Timed Out |
| `MINOR_FACE_RECOGNIZE_FAIL` | 0x50 | Face Recognition Failed |
| `MINOR_FIRSTCARD_AUTHORIZE_BEGIN` | 0x51 | First Card Authorization Started |
| `MINOR_FIRSTCARD_AUTHORIZE_END` | 0x52 | First Card Authorization Ended |
| `MINOR_DOORLOCK_INPUT_SHORT_CIRCUIT` | 0x53 | Lock Input Short Circuit |
| `MINOR_DOORLOCK_INPUT_BROKEN_CIRCUIT` | 0x54 | Lock Input Open Circuit |
| `MINOR_DOORLOCK_INPUT_EXCEPTION` | 0x55 | Lock Input Exception |
| `MINOR_DOORCONTACT_INPUT_SHORT_CIRCUIT` | 0x56 | Contact Input Short Circuit |
| `MINOR_DOORCONTACT_INPUT_BROKEN_CIRCUIT` | 0x57 | Contact Input Open Circuit |
| `MINOR_DOORCONTACT_INPUT_EXCEPTION` | 0x58 | Contact Input Exception |
| `MINOR_OPENBUTTON_INPUT_SHORT_CIRCUIT` | 0x59 | Exit Button Short Circuit |
| `MINOR_OPENBUTTON_INPUT_BROKEN_CIRCUIT` | 0x5a | Exit Button Open Circuit |
| `MINOR_OPENBUTTON_INPUT_EXCEPTION` | 0x5b | Exit Button Exception |
| `MINOR_DOORLOCK_OPEN_EXCEPTION` | 0x5c | Unlocking Exception |
| `MINOR_DOORLOCK_OPEN_TIMEOUT` | 0x5d | Unlocking Timed Out |
| `MINOR_FIRSTCARD_OPEN_WITHOUT_AUTHORIZE` | 0x5e | Unauthorized First Card Opening Failed |
| `MINOR_CALL_LADDER_RELAY_BREAK` | 0x5f | Call Elevator Relay Open |
| `MINOR_CALL_LADDER_RELAY_CLOSE` | 0x60 | Call Elevator Relay Closed |
| `MINOR_AUTO_KEY_RELAY_BREAK` | 0x61 | Auto Button Relay Open |
| `MINOR_AUTO_KEY_RELAY_CLOSE` | 0x62 | Auto Button Relay Closed |
| `MINOR_KEY_CONTROL_RELAY_BREAK` | 0x63 | Button Relay Open |
| `MINOR_KEY_CONTROL_RELAY_CLOSE` | 0x64 | Button Relay Closed |
| `MINOR_EMPLOYEENO_AND_PW_PASS` | 0x65 | Employee ID + Password Completed |
| `MINOR_EMPLOYEENO_AND_PW_FAIL` | 0x66 | Employee ID + Password Failed |
| `MINOR_EMPLOYEENO_AND_PW_TIMEOUT` | 0x67 | Employee ID + Password Timed Out |
| `MINOR_HUMAN_DETECT_FAIL` | 0x68 | Human Detection Failed |
| `MINOR_PEOPLE_AND_ID_CARD_COMPARE_PASS` | 0x69 | Person + ID Card Matched |
| `MINOR_PEOPLE_AND_ID_CARD_COMPARE_FAIL` | 0x70 | Person + ID Card Mismatched |
| `MINOR_CERTIFICATE_BLOCKLIST` | 0x71 | Blocklist Event |
| `MINOR_LEGAL_MESSAGE` | 0x72 | Valid Message |
| `MINOR_ILLEGAL_MESSAGE` | 0x73 | Invalid Message |
| `MINOR_DOOR_OPEN_OR_DORMANT_FAIL` | 0x75 | Auth Failed: Door Closed/Sleeping |
| `MINOR_AUTH_PLAN_DORMANT_FAIL` | 0x76 | Auth Failed: Auth Schedule Sleeping |
| `MINOR_CARD_ENCRYPT_VERIFY_FAIL` | 0x77 | Card Encryption Verification Failed |
| `MINOR_SUBMARINEBACK_REPLY_FAIL` | 0x78 | Anti-passing Back Server Response Failed |
| `MINOR_DOOR_OPEN_OR_DORMANT_OPEN_FAIL` | 0x82 | Exit Button Open Failed When Door Closed/Sleeping |
| `MINOR_DOOR_OPEN_OR_DORMANT_LINKAGE_OPEN_FAIL` | 0x84 | Linkage Open Failed During Door Close/Sleep |
| `MINOR_TRAILING` | 0x85 | **Tailgating** ⚠️ |
| `MINOR_REVERSE_ACCESS` | 0x86 | Reverse Passing |
| `MINOR_FORCE_ACCESS` | 0x87 | Force Accessing |
| `MINOR_CLIMBING_OVER_GATE` | 0x88 | Climb Over |
| `MINOR_PASSING_TIMEOUT` | 0x89 | Passing Timed Out |
| `MINOR_INTRUSION_ALARM` | 0x8a | Intrusion Alarm |
| `MINOR_FREE_GATE_PASS_NOT_AUTH` | 0x8b | Authentication Failed When Free Passing |
| `MINOR_DROP_ARM_BLOCK` | 0x8c | Barrier Obstructed |
| `MINOR_DROP_ARM_BLOCK_RESUME` | 0x8d | Barrier Restored |
| `MINOR_PASSWORD_MISMATCH` | 0x97 | Passwords Mismatched |
| `MINOR_EMPLOYEE_NO_NOT_EXIST` | 0x98 | Employee ID Not Exists |
| `MINOR_COMBINED_VERIFY_PASS` | 0x99 | Combined Authentication Completed |
| `MINOR_COMBINED_VERIFY_TIMEOUT` | 0x9a | Combined Authentication Timed Out |
| `MINOR_VERIFY_MODE_MISMATCH` | 0x9b | Authentication Type Mismatched |
| `MINOR_BLUETOOTH_VERIFY_PASS` | 0x9f | Authenticated via Bluetooth |
| `MINOR_BLUETOOTH_VERIFY_FAIL` | 0xa0 | Authentication via Bluetooth Failed |
| `MINOR_INFORMAL_M1_CARD_VERIFY_FAIL` | 0xa2 | Auth Failed: Invalid M1 Card |
| `MINOR_CPU_CARD_ENCRYPT_VERIFY_FAIL` | 0xa3 | Verifying CPU Card Encryption Failed |
| `MINOR_NFC_DISABLE_VERIFY_FAIL` | 0xa4 | Disabling NFC Verification Failed |
| `MINOR_EM_CARD_RECOGNIZE_NOT_ENABLED` | 0xa8 | EM Card Recognition Disabled |
| `MINOR_M1_CARD_RECOGNIZE_NOT_ENABLED` | 0xa9 | M1 Card Recognition Disabled |
| `MINOR_CPU_CARD_RECOGNIZE_NOT_ENABLED` | 0xaa | CPU Card Recognition Disabled |
| `MINOR_ID_CARD_RECOGNIZE_NOT_ENABLED` | 0xab | ID Card Recognition Disabled |
| `MINOR_CARD_SET_SECRET_KEY_FAIL` | 0xac | Importing Key to Card Failed |
| `MINOR_LOCAL_UPGRADE_FAIL` | 0xad | Local Upgrade Failed |
| `MINOR_REMOTE_UPGRADE_FAIL` | 0xae | Remote Upgrade Failed |
| `MINOR_REMOTE_EXTEND_MODULE_UPGRADE_SUCC` | 0xaf | Extension Module Remotely Upgraded |
| `MINOR_REMOTE_EXTEND_MODULE_UPGRADE_FAIL` | 0xb0 | Extension Module Upgrade Failed |
| `MINOR_REMOTE_FINGER_PRINT_MODULE_UPGRADE_SUCC` | 0xb1 | Fingerprint Module Upgraded |
| `MINOR_REMOTE_FINGER_PRINT_MODULE_UPGRADE_FAIL` | 0xb2 | Fingerprint Module Upgrade Failed |
| `MINOR_DYNAMICCODE_VERIFY_PASS` | 0xb3 | Dynamic Verification Code Authenticated |
| `MINOR_DYNAMICCODE_VERIFY_FAIL` | 0xb4 | Dynamic Code Auth Failed |
| `MINOR_PASSWD_VERIFY_PASS` | 0xb5 | Password Authenticated |
| `MINOR_FULL_STAFF` | 0xc1 | Number of People Exceeds 90% of Capacity |
| `MINOR_BLUETOOTH_KEY_VERIFY_FAIL` | / | Verifying Bluetooth Key Failed |
| `MINOR_EVENT_CUSTOM1` – `MINOR_EVENT_CUSTOM64` | 0x500–0x53f | Custom Event 1–64 |

---

## ngsaccess Tarafında Notlar

### Kart Okutma Sonucu Eşleme (cardReaderParse.ts için)

Gelen event JSON'unda `majorEventType` + `subEventType` (HTTP listening / ISAPI format) veya `dwMajor` + `dwMinor` (HCNetSDK callback):

```typescript
// Pseudo TypeScript — cardReaderParse.ts referansı
type CardSwipeResult = "ok" | "error";

function classifyEvent(major: number, minor: number): CardSwipeResult {
  if (major !== 0x5) return "error";  // sadece MAJOR_EVENT bizi ilgilendiriyor

  // ✅ Başarılı kimlik doğrulama
  const okMinors = [
    0x01,  // valid card
    0x02,  // card + password
    0x10,  // multi-auth success
    0x22,  // super password
    0x26,  // fingerprint match
    0x28,  // card + fingerprint
    0x2b,  // card + fp + pw
    0x2e,  // fp + pw
    0x45, 0x48,  // employee + fp / employee + fp + pw
    0x4b,  // face auth
    0x4d,  // employee + face
    0x65,  // employee + pw
    0x69,  // person + ID card
    0x99,  // combined auth
    0x9f,  // bluetooth
    0xb3,  // dynamic code
    0xb5,  // password
  ];
  if (okMinors.includes(minor)) return "ok";

  return "error";  // 0x03–0x09, 0x27, 0x29, 0x4c vb. — fail/timeout/no-permission
}
```

### Tailgating ve Güvenlik Event'leri
Bunlar normal kart okuma değil, **şüpheli geçiş** event'leri:
- `0x85` Tailgating
- `0x86` Reverse Passing
- `0x87` Force Accessing
- `0x88` Climb Over
- `0x8a` Intrusion Alarm

ngsaccess'te bunları ayrı bir kayıt türü olarak işlemek mantıklı (`cardReadings` tablosunda `eventCategory: "security_alert"`).

---

## İlgili Belgeler
- [docs/sdk/02-typical-applications/2.6-alarm-event-receiving.md](../02-typical-applications/2.6-alarm-event-receiving.md) — Event alma akışı
- [docs/sdk/appendix-c/c.2-event-linkage-types.md](./c.2-event-linkage-types.md) — Event linkage tipleri (event card linkage için)
- [docs/sdk/04-structures-enumerations.md](../04-structures-enumerations.md) — `NET_DVR_ACS_EVENT_INFO`, `NET_DVR_ACS_ALARM_INFO`
- [convex/lib/cardReaderParse.ts](../../../convex/lib/cardReaderParse.ts) — Parser kaynak kodu
- [convex/http.ts](../../../convex/http.ts) — `/card-reader` endpoint
- [docs/HIKVISION_ISAPI_REFERANS.md](../../HIKVISION_ISAPI_REFERANS.md) — ISAPI hızlı referans
