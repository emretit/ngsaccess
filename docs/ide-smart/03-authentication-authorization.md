# 3. Authentication & Authorization

## 3.1 User Levels

The device defines five privilege levels (1 = highest user, 5 = highest admin). Passwords are stored in AUTH.USER1–USER5 parameters. Level 1 uses AUTH.USER1 and so on.

| Level | Default Password | Typical Use |
| :---- | :---- | :---- |
| 1 (admin) | admin | Full administrative access. |
| 2 |  | Read/write access with moderate restrictions. |
| 3 |  | Access to sensitive subsystems (MQTT, LOGGER, BLE admin). |
| 4 |  | Crash log access, AES key management, workspace ID. |
| 5 |  | SYSTEM-level writes, OTA status fields, UUID/PID (effectively internal). |

**ℹ  Note:** Contact IDE Smart for AUTH.USER2–USER5. Passwords are max 12 characters.

## 3.2 Login Flow

Send a login message without a token. On success, the device returns a signed token for all subsequent requests.

// Request  
{  
  "transaction": { "msx-id": 1, "src-id": 1001, "dst-id": 9001, "type": "login" },  
  "payload": { "user": "admin", "password": "admin" }  
}

// Success Response  
{  
  "transaction": { "msx-id": 1, "src-id": 9001, "dst-id": 1001, "type": "login_response" },  
  "payload": {  
    "result":  "success",  
    "message": "Login successful",  
    "data":    { "token": "1.1711031000.1711031600.9001.xxxxx" }  
  }  
}

### 3.2.1 Token Format

Tokens are structured strings carrying: user level, issued-at time (iat), expiry time (exp), and device UUID. Tokens are device-bound and cryptographically signed.

| Check | Error on Failure |
| :---- | :---- |
| Level in range 0–5 | Rejected |
| iat ≤ now ≤ exp | "Token expired" |
| Device UUID matches | "Token is not bound to this device" |
| Signature valid | "Tamper detected..." |

**ℹ  Note:** Token TTL is controlled by AUTH.TOKEN_TTL (default 600 s, range 30–86400 s). Re-login before expiry to maintain a session.

## 3.3 Authorization Matrix

Read access requires level ≥ 1 by default. The following parameters require higher levels to read:

| Parameter / Module | Min Read Level |
| :---- | :---- |
| MQTT.* | 3 |
| LOGGER.* | 3 |
| AUTH.USER2 | 2 |
| AUTH.USER3 | 3 |
| AUTH.USER4 | 4 |
| AUTH.USER5 | 5 |

Write access minimum levels per module:

| Module | Min Write Level | Module | Min Write Level |
| :---- | :---- | :---- | :---- |
| WIFI | 1 | MQTT | 3 |
| NTP | 1 | SYSTEM | 5 |
| UDP | 1 | RS485 | 1 |
| AC | 1 | AUTH | 1 |
| ACTUATOR0 | 1 | LOGGER | 3 |
| OTA | 1 | BOOT | 1 |
| HTTPCLIENT | 1 | HTTPSERVER | 1 |
| BLE | 3 (exceptions below) | WIEGAND0 | 1 |
| REPO | 1 | TCP | 1 |

Notable per-parameter write overrides:

| Parameter | Min Write Level |
| :---- | :---- |
| MQTT.PASSWORD | 3 |
| BOOT.REASON | 5 (internal) |
| BOOT.CRASH_COUNT | 5 (internal) |
| BOOT.MODE | 4 |
| OTA.LATEST_ATTEMPT | 5 (read-only for integrators) |
| OTA.LATEST_STATUS | 5 (read-only for integrators) |
| OTA.LATEST_UPDATE | 5 (read-only for integrators) |
| BLE.TX_POWER | 1 |
| BLE.ENABLED | 1 |
| BLE.NAME | Not writable externally |
| AUTH.USER2–USER5 | Matches the level being set (e.g., USER3 requires level 3) |
| SYSTEM.WORKSPACE_ID | 4 |

> **⚠ Canlı-doğrulanmış sapmalar (2026-05-29, panel `289833329732592`):** Bu matris modül
> bazlıdır; bazı parametrelerin GERÇEK yazma seviyesi farklı çıktı:
> - `HTTPCLIENT.HOST` yazma → **Level 99** (entegratör değiştiremez; doğru/yazılabilir modül `HTTPC.*`).
> - `LOGGER.PROTOCOL` / `LOGGER.AC_LOG_PATH` yazma → **Level 2** (matristeki "LOGGER → 3" değil).
> - `MQTT.*` yazma → Level 3 (matrisle uyumlu).
>
> Ayrıntı ve vendor'a açık sorular: [IDESMART_SORULAR_VE_UYUMSUZLUKLAR.md](IDESMART_SORULAR_VE_UYUMSUZLUKLAR.md).

## 3.4 Channel-Based Authorization

Some operations further restrict access based on the inbound channel. The channel is determined automatically by the transport layer.

| Operation | MQTT | UDP | RS485 | HTTP | BLE | TCP |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| update_actuator | Level 0 | Level 1 | Level 1 | Level 1 | Level 1 | Level 1 |
| reboot / ota_update | Level 1 | Level 1 | Level 1 | Level 1 | Level 1 | Level 1 |
| get_app_logs | Level 1 | Level 1 | Level 1 | Level 1 | Level 1 | Level 1 |
| get_crash_logs | Level 4 | Level 4 | Level 4 | Level 4 | Level 4 | Level 4 |
