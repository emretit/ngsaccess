# 4. Message Types Reference

The transaction.type field routes the message to the appropriate handler. The full list of supported types is:

| Type | Category | Min Level |
| :---- | :---- | :---- |
| login | Auth | None |
| parameter_read | Config | 1 |
| parameter_write | Config | Module-dependent |
| update_actuator | Control | 0–1 (channel-dependent) |
| get_data | CRUD | 1 |
| create_data | CRUD | 1 |
| update_data | CRUD | 1 |
| delete_data | CRUD | 1 |
| delete_all_data | CRUD | 1 |
| reboot | System | 1 |
| ota_update | OTA | 1 |
| ota_check | OTA | 1 |
| get_app_logs | Diagnostic | 1 |
| get_crash_logs | Diagnostic | 4 |
| get_error_logs | Diagnostic | 4 |
| sync | Repository | 1 |
| sync_reset | Repository | 1 |
| factory_reset | System | 5 |
| boot_state | System | None (internal) |
| clear_boot_fail | System | 5 (internal) |
| clear_degraded | System | 5 (internal) |
| reboot_clean | System | 1 |
| restart_wifi | Network | 1 |
| counter_reset | Access Control | 1 |
| coord_reset | Access Control | 1 |

## 4.1 login

Authenticates a user and returns a session token. This is the only message type that does not require a token. Token in the transaction field may be omitted.

{ "transaction": { "msx-id": 1, "src-id": 1001, "dst-id": 9001, "type": "login" },  
  "payload": { "user": "admin", "password": "admin" } }

## 4.2 parameter_read

Reads one or more device configuration parameters. Parameters the caller is not authorized to read are silently omitted from the response — no error is raised for missing-level fields.

### Read a specific list

{ "transaction": { "msx-id": 10, "src-id": 1001, "dst-id": 9001,  
    "type": "parameter_read", "token": "<token>" },  
  "payload": { "parameters": ["SYSTEM.DEVICE_NAME", "MQTT.BROKER", "NTP.TIME"] } }

### Read by module

// All readable params in a module (filtered by caller level)  
{ "payload": { "module": "MQTT" } }

// Specific param names within a module (short-form)  
{ "payload": { "module": "MQTT" } }

### Response

{ "payload": { "result": "success", "message": "Parameters fetched",  
    "data": { "MQTT.PORT": 8883, "MQTT.BROKER": "api.example.com" } } }

## 4.3 parameter_write

Writes one or more configuration parameters. Each parameter is validated and authorized independently. The response reports the outcome per key.

{ "transaction": { "msx-id": 11, "src-id": 1001, "dst-id": 9001,  
    "type": "parameter_write", "token": "<token>" },  
  "payload": { "MQTT.BROKER": "mqtt.example.com", "MQTT.PORT": 1883,  
               "LOGGER.HB_ENABLED": 1 } }

// Response (mixed result)  
{ "payload": { "result": "fail", "message": {  
    "MQTT.BROKER":      "success",  
    "MQTT.PORT":        "invalid value",  
    "LOGGER.HB_ENABLED":"success" } } }

**ℹ  Note:** result is "fail" if any single key failed. The message object details per-key outcomes. Parameters are written atomically per key; a failed key does not roll back previously written ones.

## 4.4 update_actuator

Triggers an access control evaluation for a given user against the door actuator. The device applies all configured rules (user validity, time schedule, anti-passback, zone) and either grants or denies access.

{ "transaction": { "msx-id": 20, "src-id": 1001, "dst-id": 9001,  
    "type": "update_actuator", "token": "<token>" },  
  "payload": {  
    "user_id": 1234567890123456,  
    "io_id":   0,  
    "value":   1  
  } }

// Granted  
{ "payload": { "result": "success", "message": "Access granted", "data": null } }

// Denied (example)  
{ "payload": { "result": "fail", "message": "User 1234567890123456 not within allowed time interval", "data": null } }

| Field | Type | Description |
| :---- | :---- | :---- |
| user_id | int (64-bit) | User identifier (e.g., card number, QR code value). Must match a stored user record. |
| io_id | int | Target actuator index. Currently 0 = door relay. |
| value | int | Desired state. 1 = open/activate, 0 = close/deactivate. |

**4.4.1 keep parameter** 

In v0.1.0 the update_actuator request gains an optional keep field that selects between three operation modes on the same endpoint:

| keep | Mode | Description |
| :---- | :---- | :---- |
| (absent) / null | Pulse | Standard pulse mode (existing behaviour). Request goes through the access-control gate. Requires user_id. |
| 1 | Latch on | Administrative latch. Bypasses the access-control gate (SF token pre-authorized). user_id ignored. Updates LAST_STATE when DEFAULT_STATE=2. Writes access log entry type 4 (LATCH_ON). |
| 0 | Release latch | Administrative release. Bypasses the access-control gate. user_id ignored. Updates LAST_STATE when DEFAULT_STATE=2. Writes access log entry type 5 (LATCH_OFF). |

Example — administrative latch on actuator 0:

{ "transaction": { "type": "update_actuator", ... },  
  "payload":     { "io_id": 0, "keep": 1 } }

**ℹ  Note:** Latch and release operate without consulting the access-control module; they are admin-only. If an actuator is already in an active cycle, a latch request is rejected with "Actuator already in action; keep request ignored".

## 4.12 counter_reset

Resets a user's permission usage counter without waiting for the natural reset window. Propagated cluster-wide so every peer device clears the counter for that (user, zone) pair. Requires level ≥ 1\.

{ "transaction": { ..., "type": "counter_reset", "token": "<token>" },  
  "payload":     { "user_id": 1234567890123456, "zone_id": 2 } }

// Response  
{ "payload": { "result": "success", "message": "ok" } }

zone_id is the destination zone (the NEW_ZONE value of the actuator leading into that zone) whose counter should be cleared. If a user has counters in multiple destination zones, call counter_reset once per zone. A request for a (user, zone) pair with no counter returns success with message "nothing to reset" (idempotent).

## 4.12 coord_reset

See [0.1.2 Release_Notes](https://docs.google.com/document/d/1zYyHH2LBGydu-NWPuJ4GxqDJo5wb4wSOaH9CnbIERQY/edit?tab=t.0)

## 4.5 CRUD Operations

Four data types are managed via a unified CRUD interface: user, permission, scenario, and log (read \+ delete only).

### 4.5.1 get_data

// Get single record by ID  
{ "transaction": { ..., "type": "get_data", "token": "<token>" },  
  "payload": { "data_type": "user", "data_id": 1234567890123456 } }

// Paginated listing  
{ "payload": { "data_type": "permission", "page": 1, "page_len": 20 } }

**ℹ  Note:** data_id is optional for a single record lookup. If not provided, use page \+ page_len for bulk paginated listing. Both are valid for user, permission, and scenario. Log supports page listing only.

### 4.5.2 create_data

See Section 5 for full field specifications and validation rules per data type.

{ "transaction": { ..., "type": "create_data", "token": "<token>" },  
  "payload": {  
    "data_type": "user",  
    "id":    1234567890123456,  
    "start": 1710988800,  
    "end":   1713577200,  
    "current_zone": 1,  
    "permissions": [1, 2]  
  } }

### 4.5.3 update_data

Partial update (patch semantics). Only supply the fields you wish to change. id is required to identify the record.

{ "transaction": { ..., "type": "update_data", "token": "<token>" },  
  "payload": {  
    "data_type": "permission",  
    "id":        1,  
    "schedule":  { "end": 1200 }  
  } }

### 4.5.4 delete_data / delete_all_data

// Delete single  
{ "payload": { "data_type": "user", "id": 1234567890123456 } }

// Delete all (e.g., clear all logs)  
{ "payload": { "data_type": "log" } }

## 4.6 reboot & ota_update

// Graceful reboot (3-second delay)  
{ "transaction": { ..., "type": "reboot", "token": "<token>" }, "payload": {} }  
// Response: { "message": "Rebooting in 3 seconds" }

// Enter OTA update mode  
{ "transaction": { ..., "type": "ota_update", "token": "<token>" }, "payload": {} }

## 4.7 ota_check

Triggers an immediate firmware version check against the provisioning server. The device checks if a newer version is available and initiates download if configured to auto-update.

{ "transaction": { ..., "type": "ota_check", "token": "<token>" }, "payload": {} }  
// Response: { "result": "success", "message": "OTA check triggered" }

## 4.8 Log Retrieval

### 4.8.1 get_app_logs (Level ≥ 1)

{ "transaction": { ..., "type": "get_app_logs", "token": "<token>" }, "payload": {} }  
// Response:  
{ "payload": { "result": "success", "message": "App logs fetched",  
    "data": { "size": 1234,  
              "lines": ["2025-03-01T10:00:01Z Wi-Fi Connected", "..."] } } }

### 4.8.2 get_crash_logs (Level ≥ 4)

{ "transaction": { ..., "type": "get_crash_logs", "token": "<token>" }, "payload": {} }  
// Response:  
{ "payload": { "result": "success", "message": "Crash log fetched",  
    "data": { "size": 456, "content": "Guru Meditation ...\\nTraceback ..." } } }

### 4.8.3 get_error_logs (Level ≥ 4)

Same structure as get_crash_logs but returns application-level error events.

## 4.9 sync & sync_reset

These messages trigger a bulk repository synchronization (see Section 8 for full detail).

// Sync (delta — only downloads if epoch changed)  
{ "transaction": { ..., "type": "sync", "token": "<token>" }, "payload": {} }

// Sync reset (force full download regardless of epoch)  
{ "transaction": { ..., "type": "sync_reset", "token": "<token>" }, "payload": {} }

## 4.10 restart_wifi

Forces a Wi-Fi driver reset and reconnection attempt. Useful for recovering from a stuck Wi-Fi state or applying configuration changes without a full device reboot.

{ "transaction": { ..., "type": "restart_wifi", "token": "<token>" }, "payload": {} }

## 4.11 System Messages (Internal)

The following message types are available but are primarily used by internal tooling and provisioning infrastructure. Integrators should not depend on them for routine operations.

| Type | Description |
| :---- | :---- |
| factory_reset | Resets all NVS parameters to factory defaults and clears user data. Level 5 required. |
| boot_state | Returns internal boot health state (no auth required). |
| clear_boot_fail | Clears persistent boot-fail flag. Level 5\. |
| clear_degraded | Clears degraded mode counter. Level 5\. |
| reboot_clean | Reboots and clears the dirty-boot flag. Level 1\. |
