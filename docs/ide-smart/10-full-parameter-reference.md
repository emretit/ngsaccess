# 10. Full Parameter Reference

All parameters are accessed using dotted notation: MODULE.PARAMETER. Parameters marked Read-Only cannot be written by any user level.

## 10.1 SYSTEM

| Parameter | Default | Validation | R/W | Description |
| :---- | :---- | :---- | :---- | :---- |
| SYSTEM.DEVICE_NAME | "" | max 32 chars | R/W | Human-readable device name. |
| SYSTEM.DEVICE_TYPE | *PID Based | max 32 chars | R/W | Device type label. |
| SYSTEM.UUID | "" | max 15 chars | R/W (L5) | Unique device ID. |
| SYSTEM.PID | *PID Based | exactly 16 chars | R/W (L5) | Product ID string. |
| SYSTEM.AES_KEY | "" | 16 chars | R/W (L4) | AES encryption key for DF messaging. |
| SYSTEM.WORKSPACE_ID | "" | max 32 chars | R/W (L4) | Workspace identifier. |
| SYSTEM.LICENCED | 0 | 0 or 1 | Read (L4) | Device licence status. |
| SYSTEM.METRICS | — | Read only | Read | Live snapshot: flash/CPU/RAM usage, uptime, boot reason. |
| SYSTEM.FS_FULL_FLAG | 0 | 0 or 1 | Read | Filesystem-full flag. 1 = on-board filesystem is full and writes have stopped. Cleared by the boot-recovery sequence when free space is restored. New in v0.1.0. |
| SYSTEM.STORAGE_FILES | — | Read only | Read | Per-file storage diagnostics. Returns an array of {name, kb} entries — one per tracked repository file. New in v0.1.0. |

## 10.2 BOOT

| Parameter | Default | Validation | R/W | Description |
| :---- | :---- | :---- | :---- | :---- |
| BOOT.MODE | 2 | 0–10 | R/W (L4) | Last boot mode (1=UPDATE, 2=NORMAL, 3=SAFE, 8=RESCUE). ⚠ RESCUE değeri `11-boot-modes-recovery.md`'de **4** olarak geçiyor — çelişki, firmware'den teyit bekliyor. |
| BOOT.REASON | "Power-on" | nonempty str | R/W (L5) | Human-readable last boot reason. |
| BOOT.CRASH_COUNT | 0 | int | R/W (L5) | Consecutive crash counter used for safe-mode decisions. |
| BOOT.INIT_INPUT_THRESHOLD | 3 | 1–1000 | R/W | Button press count to trigger special boot action. |
| BOOT.INIT_INPUT_TIMEOUT | 3 | 1–1000 s | R/W | Time window for counting button presses. |
| BOOT.INIT_INPUT_ACTION1 | "update" | "update"|"pairing" | R/W | Action when threshold is reached. |
| BOOT.INIT_INPUT_ACTION2 | "pairing" | "update"|"pairing" | R/W | Alternate action. |
| BOOT.UPDATE_ON_BOOT | 1 | 0 or 1 | R/W | Run OTA check on every boot. |

## 10.3 AUTH

| Parameter | Default | Validation | R/W | Description |
| :---- | :---- | :---- | :---- | :---- |
| AUTH.USER1 | "admin" | max 12 chars | R/W (L1+) | Level 1 password. |
| AUTH.USER2 | "" | max 12 chars | R/W (L2+) | Level 2 password. Empty = level disabled. |
| AUTH.USER3 | "" | max 12 chars | R/W (L3+) | Level 3 password. |
| AUTH.USER4 | "" | max 12 chars | R/W (L4+) | Level 4 password. |
| AUTH.USER5 | "" | max 12 chars | R/W (L5) | Level 5 password. |
| AUTH.TOKEN_TTL | 600 | 30–86400 s | R/W | Token lifetime in seconds. |
| AUTH.LAST_SEEN | 0 | int | R/W | Last valid token expiry (replay guard). |
| AUTH.IGNORE_DST_ID_ON_LOGIN | 1 | 0 or 1 | R/W | Accept login messages even if dst-id is wrong. |

## 10.4 MQTT

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| MQTT.BROKER | "api.sampledomain.com.tr" | hostname or IP | Broker host. |
| MQTT.PORT | 8883 | valid port | Broker port. |
| MQTT.CLIENT_ID | <device_ııid> | max 128 chars | MQTT client identifier. |
| MQTT.USERNAME | "sample_user" | max 128 chars | Broker username. |
| MQTT.PASSWORD | "abc123456" | max 128 chars | Broker password. (Min read level 3) |
| MQTT.KEEPALIVE | 60 | 5–120 s | MQTT keepalive interval. |
| MQTT.PING_INTERVAL | 10 | 10–60 s | Ping interval. |
| MQTT.MAX_RETRY | 5 | 1–10 | Max reconnect attempts. |
| MQTT.SSL_ENABLED | 1 | 0 or 1 | Enable TLS. |
| MQTT.SSL_SELF_SIGNED | 0 | 0 or 1 | Accept self-signed certificates. |
| MQTT.TOPIC_SUBSCRIBE | device/subscribe/<device_uuid> | max 128 chars | Inbound message topic. |
| MQTT.SUBSCRIBE_QOS | 0 | 0 or 1 | Subscribe QoS. |
| MQTT.TOPIC_PUBLISH | device/publish/<device_uuid> | max 128 chars | Outbound response topic. |
| MQTT.PUBLISH_QOS | 0 | 0 or 1 | Publish QoS. |
| MQTT.RETAIN | 0 | 0 or 1 | Publish retain flag. |
| MQTT.TOPIC_AUTO_SET | 1 | 0 or 1 | Auto-configure subscribe topic from SYSTEM.WORKSPACE_ID on startup. |
| MQTT.STATUS | — | Read only | Current connection state. |

## 10.5 HTTP (HTTP Server)

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| HTTPSERVER.ENABLED | 1 | 0 or 1 | Enable/disable the built-in HTTP server. |
| HTTPSERVER.HOST | "0.0.0.0" | hostname or IP | Bind address (0.0.0.0 = all interfaces). |
| HTTPSERVER.PORT | 80 | valid port | Listening port. Default 80\. |
| HTTPSERVER.TIMEOUT | 5 | positive int (s) | Request timeout. |
| HTTPSERVER.SSL_ENABLED | 0 | 0 or 1 | Enable HTTPS. |
| HTTPSERVER.SSL_CERT | "" | path starting with / | TLS certificate file path. |
| HTTPSERVER.SSL_KEY | "" | path starting with / | TLS private key file path. |
| HTTPSERVER.MAX_BODY_SIZE | 4096 | positive int (bytes) | Maximum allowed request body size. |

## 10.6 HTTPC (HTTP Client)

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| HTTPCLIENT.HOST | "192.168.1.147" | hostname or IP | Target server host. |
| HTTPCLIENT.PORT | 8080 | valid port | Target port. |
| HTTPCLIENT.TIMEOUT | 3 | 1–5 s | Request timeout. |
| HTTPCLIENT.VERIFY_HOST | 0 | 0 or 1 | Verify TLS hostname. |
| HTTPCLIENT.SSL | 0 | 0 or 1 | Use HTTPS. |

## 10.7 UDP

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| UDP.ENABLED | 1 | 0 or 1 | Enable UDP transport. |
| UDP.SERVER_ADDR | "192.168.1.100" | hostname or IP | Destination host. |
| UDP.SERVER_PORT | 6040 | valid port | Destination port. |
| UDP.LOCAL_PORT | 6040 | valid port | Device listening port. |
| UDP.TIMEOUT | 5 | positive int (s) | Response wait timeout. |
| UDP.MULTICAST_GROUP | "239.1.2.3" | IP format | Multicast group address. |
| UDP.TTL | 1 | 0–255 | Multicast/broadcast TTL. |
| UDP.CLIENT_ID | "esp32_udp" | nonempty string | UDP client identifier. |

## 10.8 TCP (TCP Server)

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| TCP.ENABLED | 1 | 0 or 1 | Enable TCP server. |
| TCP.PORT | 6090 | valid port | Listening port. Default 6090\. |
| TCP.SSL | 0 | 0 or 1 | Enable TLS on TCP socket. |

## 10.9 RS485

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| RS485.BAUDRATE | 9600 | positive int | Serial baud rate. |
| RS485.TIMEOUT | 0 | positive int (s) | Read timeout (0 = blocking). |

## 10.10 NTP

| Parameter | Default | Validation | R/W | Description |
| :---- | :---- | :---- | :---- | :---- |
| NTP.SERVER | "time.google.com" | hostname or IP | R/W | NTP server address. |
| NTP.SYNC_INTERVAL | 3600 | positive int (s) | R/W | NTP re-sync interval. |
| NTP.TIMEZONE | 3 | -12 to 14 | R/W | UTC offset in hours. |
| NTP.UNIX_UTC | — | Read only | Read | Current UTC Unix timestamp. |
| NTP.UNIX_LOCAL | — | Read only | Read | Local time Unix timestamp (UTC \+ timezone). |
| NTP.TIME | — | Read only | Read | Local time as YYYY-MM-DD HH:MM:SS. |
| NTP.DAY-WEEK | — | Read only | Read | Day of week **0=Monday … 6=Sunday** (canlı doğrulandı 2026-05-31: gerçek gün Pazar → panel `DAY-WEEK=6`). NOT: bu, permission `schedule.week_days` konvansiyonundan (CRUD §5.2'de 0=Pazar) FARKLI olabilir — day-limitli kurallar için doğrula. |
| NTP.DAY-MONTH | — | Read only | Read | Day of month (1–31). |
| NTP.DAY-YEAR | — | Read only | Read | Day of year (1–366). |
| NTP.MONTH | — | Read only | Read | Month number (1–12). |
| NTP.WEEK_NUMBER | — | Read only | Read | ISO week number (0–53). |
| NTP.MINUTE-DAY | — | Read only | Read | Minutes elapsed since midnight (0–1439). |
| NTP.RTC_TIME_UTC | — | Read only | Read | Time read from hardware RTC (UTC). Only available if an RTC module is fitted. |

**ℹ  Note:** If a hardware RTC module is present, the device restores system time from it on boot before attempting NTP sync. This ensures correct time-based access decisions are possible immediately after power-on even without internet connectivity.

## 10.11 OTA

See Section 7 for full OTA parameter table.

## 10.12 AC (Access Control)

See Section 9.3 for full AC and ACTUATOR0 parameter tables.

## 10.13 LOGGER

See Section 6 for the full LOGGER parameter table organized by upstream event type.

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| LOGGER.PROTOCOL | "MQTT" | MQTT|HTTP|UDP|RS485|TCP | Upstream event transport. |
| LOGGER.LED_READY_EVENT | "mqtt" | "mqtt" or "boot" | When to illuminate the ready LED: after MQTT connects, or immediately after boot. |
| LOGGER.SAVE_AFTER_LIVE_SEND | 0 | Integer 0 or 1 | When 1, every record that was successfully live-pushed is also saved to the sent retention ring. Requires KEEP_SENT_RECORDS_N > 0\. |
| LOGGER.KEEP_SENT_RECORDS_N | 0 | Integer 0–10000 | Number of recent sent records to retain on device for query. 0 disables the retention ring. |
| LOGGER.MAX_UNSENT_BYTES | 524288 (512kb) | Integer (bytes) 14336–524288 | Maximum size of the unsent pool. When reached, new records are dropped until cursor advances (push succeeds) or delete_all_data(log) is called. |

## 10.14 WIFI

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| WIFI.WIFI_ENABLED | 1 | 0 or 1 | Enable Wi-Fi. |
| WIFI.SSID | "" | max 32 chars | Network SSID. |
| WIFI.PASSWORD | "" | max 63 chars | Network password. |
| WIFI.USE_DHCP | 1 | 0 or 1 | Use DHCP. Set to 0 for static IP. |
| WIFI.STATIC_IP | "192.168.1.100" | IPv4 | Static IP (when USE_DHCP=0). |
| WIFI.STATIC_GATEWAY | "192.168.1.1" | IPv4 | Default gateway. |
| WIFI.STATIC_SUBNET_MASK | "255.255.255.0" | IPv4 | Subnet mask. |
| WIFI.DNS_SERVERS | "8.8.8.8" | CSV or single IPv4 | DNS server(s). |
| WIFI.RETRY_INTERVAL | 5 | > 0 | Base reconnect delay (s). |
| WIFI.RETRY_INCREMENT | 2 | 1–60 | Reconnect delay increment per failed attempt (s). |
| WIFI.RETRY_MAX_INTERVAL | 20 | 1–600 | Maximum reconnect delay (s). |
| WIFI.MAX_RETRY | 10 | > 0 | Max reconnect attempts before giving up. |
| WIFI.RESET_AFTER_ATTEMPTS | 3 | 2–20 | Attempts before resetting the Wi-Fi driver. |
| WIFI.SECURITY_TYPE | "PSK" | OPEN|PSK|WPA|WPA2|... | Authentication mode. |
| WIFI.PMF_MODE | "OPTIONAL" | DISABLED|OPTIONAL|REQUIRED | Protected Management Frames mode. |
| WIFI.HIDDEN | 0 | 0 or 1 | Connect to hidden SSID. |
| WIFI.EAP_METHOD | "" | PEAP|TTLS|TLS | WPA-Enterprise EAP method. |
| WIFI.EAP_IDENTITY | "" | max 128 chars | WPA-Enterprise outer identity. |
| WIFI.EAP_USERNAME | "" | max 128 chars | WPA-Enterprise username. |
| WIFI.EAP_PASSWORD | "" | max 128 chars | WPA-Enterprise password. |
| WIFI.STATUS | — | Read only | Connection state (STAT_IDLE, STAT_CONNECTING, GOT_IP, …). |
| WIFI.IP | — | Read only | Current IP address. |
| WIFI.RSSI | — | Read only | Signal strength (dBm). |
| WIFI.MAC | — | Read only | Wi-Fi MAC address. |

## 10.15 BLE

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| BLE.ENABLED | 1 | 0 or 1 | Enable BLE. |
| BLE.ROLE | "peripheral" | "peripheral"|"central"|"both" | BLE operating role. |
| BLE.NAME | "Q711N586" | max 64 chars, not writable externally | BLE device name (derived from PID \+ UUID suffix). |
| BLE.APPEARANCE | 0 | 0–65535 | BLE appearance code. |
| BLE.ADV_INT_MS | 160 | 10–10240 ms | Advertising interval. |
| BLE.TX_POWER | "" | -12,-9,-6,-3,0,3,6,9 dBm or empty | Transmit power. |
| BLE.MTU_CFG | 23 | 23–251 | MTU size. |
| BLE.MFG_ID | 52775 | 0–65535 or empty | Manufacturer ID in advertisement. |
| BLE.MFG_DATA | "" | "0x..." or empty | Manufacturer data bytes. |
| BLE.PRIVACY | 0 | 0 or 1 | Use random address for privacy. |
| BLE.ADDR_MODE | "random" | ""|"public"|"random" | Address type. |
| BLE.SCAN_ACTIVE | 0 | 0 or 1 | Enable active scanning. |
| BLE.SCAN_INT_MS | 160 | 10–10240 ms | Scan interval. |
| BLE.SCAN_WIN_MS | 80 | 10–10240 ms | Scan window. |
| BLE.SCAN_MIN_RSSI | -70 | -100 to -20 | Minimum RSSI to consider a scan result. |
| BLE.IBEACON_ENABLED | 0 | 0 or 1 | Enable iBeacon advertisement. |
| BLE.IBEACON_UUID | "3e1c..." | 36 chars or empty | iBeacon proximity UUID. |
| BLE.IBEACON_MAJOR | 0 | 0–65535 | iBeacon major value. |
| BLE.IBEACON_MINOR | 0 | 0–65535 | iBeacon minor value. |
| BLE.IBEACON_TXPOW | -59 | -127–20 | 1m calibration RSSI. |
| BLE.IBEACON_BURST_MS | 400 | 50–5000 ms | iBeacon burst duration. |
| BLE.IBEACON_PERIOD_MS | 2000 | 200–60000 ms | iBeacon burst period. |
| BLE.IBEACON_ADV_INT_MS | 100 | 20–10240 ms | Advertisement interval within burst. |

## 10.16 INPUT

| Parameter | Default | Validation | R/W | Description |
| :---- | :---- | :---- | :---- | :---- |
| INPUT.DEBOUNCE_MS | 500 | 100–2000 ms | R/W | Digital input debounce window. |
| INPUT.STATE | — | Read only | Read | Current state of all digital inputs. |

## 10.17 WIEGAND0

Parameters for the Wiegand card reader interface (channel 0). Multiple channels may be available depending on hardware.

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| WIEGAND0.ENABLED | 1 | 0 or 1 | Enable Wiegand channel 0\. |
| WIEGAND0.BIT_LENGTH | 26 | 1–64 | Expected frame bit count (26 for W26, 34 for W34). |
| WIEGAND0.PARITY_MODE | 1 | 0=NONE, 1=W26, 2=W34 | Parity validation mode. |
| WIEGAND0.FRAME_TIMEOUT_US | 5000 | 1000–150000 µs | Time to wait for end-of-frame after last pulse. |
| WIEGAND0.PULSE_DEBOUNCE_US | 500 | 0–500 µs | Minimum pulse width to recognize. |
| WIEGAND0.ID_START_BIT | 8 | 0–63 (non-neg int) | Bit offset in the frame where the card ID starts. |
| WIEGAND0.ID_BIT_LENGTH | 16 | 1–64 | Number of bits in the card ID field. |
| WIEGAND0.FC_START_BIT | 0 | 0–63 (non-neg int) | Bit offset of the facility code field. |
| WIEGAND0.FC_BIT_LENGTH | 8 | 0–32 | Number of bits in the facility code (0 = not used). |
| WIEGAND0.LOOP_MS | 100 | 5–100 ms | Reader polling interval. |
| WIEGAND0.LED_OUT | 0 | -1 or 0–OUTPUT_MAX | -1 = LED output not connected. |
| WIEGAND0.BUZZER_OUT | 1 | -1 or 0–OUTPUT_MAX | -1 = buzzer not connected. |
| WIEGAND0.GRANTED_LED | "1:100,0:100,1:100" | feedback pattern | LED pattern on access granted. |
| WIEGAND0.GRANTED_BUZZER | "1:100,0:100,1:100" | feedback pattern | Buzzer pattern on access granted. |
| WIEGAND0.DENY_LED | "" | feedback pattern | LED pattern on access denied. Empty = no output. |
| WIEGAND0.DENY_BUZZER | "1:500" | feedback pattern | Buzzer pattern on access denied. |
| WIEGAND0.AUTO_DETECT | “BOOT” | "OFF" | "ONCE" | "BOOT" | Controls when the device runs the learn sequence.  |
| WIEGAND0.LEARN_STATE | 0 | 0 or 1 | Indicates whether a valid profile is stored. Read-only for integrators. |
| WIEGAND0.AUTO_HEAL | 1 | 0 or 1 | Enables or disables self-healing debounce. Default: 1\. |
| WIEGAND0.SAMPLE_CARD_DATA | “” | String | Optional known card number for field layout verification during learn. |
| WIEGAND0.FORMAT_GUESS | “” | String | Detected protocol name (e.g. W34-H10306, W37-H10304). Written after a successful learn. Read-only. |
| WIEGAND0.ACCEPTED_FC | -1 | Int (between -1 and 4294967295) | Specifies the allowed Facility Code for incoming cards. If set to -1, Facility Code validation is disabled. Otherwise, only cards matching this value are accepted. |

### Feedback Pattern Format

LED and buzzer feedback patterns are expressed as a comma-separated sequence of state:duration_ms pairs:

`"1:100,0:100,1:100"   → ON 100ms, OFF 100ms, ON 100ms`  
`"1:500"               → ON 500ms (single beep)`  
`""                    → No output`

### Wiegand Troubleshooting Guide

| Symptom | Likely Cause | Fix |
| :---- | :---- | :---- |
| reject_bits_too_long > 0 | Electrical noise / contact bounce | Increase WIEGAND0.PULSE_DEBOUNCE_US |
| reject_bits_too_short > 0 | Frame timeout too tight | Increase WIEGAND0.FRAME_TIMEOUT_US |
| reject_parity > 0 | Cable/noise signal corruption | Check cable shielding; verify BIT_LENGTH and PARITY_MODE match reader |
| debounce_drops very high | Debounce too aggressive | Decrease WIEGAND0.PULSE_DEBOUNCE_US |

### Auto Detect Feature Guide

See [0.0.19 Release Notes](https://docs.google.com/document/d/1qJsGdaP1cGCP89c5yANBGNSAubXS-7QXyULLVyr2hAc/edit?usp=drive_link)

## 10.18 REPO (Repository Sync)

See Section 8.2 for the full REPO parameter table.
