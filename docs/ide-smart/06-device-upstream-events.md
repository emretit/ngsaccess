# 6. Device Upstream Events

The device autonomously pushes several types of events to the configured upstream endpoint. The active protocol (MQTT, HTTP, UDP, RS485, TCP) is set by LOGGER.PROTOCOL. All topic/path settings below have both a MQTT topic variant and an HTTP path variant.

## 6.1 MQTT Connection Events

When MQTT is the active protocol, the device sends connection lifecycle messages automatically:

| Event | Parameter | Default Topic | Description |
| :---- | :---- | :---- | :---- |
| Connected | LOGGER.CONNECTED_TOPIC | event/connected | Sent when MQTT connection is established. Configurable QoS and retain via LOGGER.CONNECTED_QOS / LOGGER.CONNECTED_RETAIN. |
| Disconnected (LWT) | LOGGER.DISCONNECTED_TOPIC | event/disconnected | Registered as MQTT Last Will message. Sent by broker if connection drops unexpectedly. Configurable via LOGGER.DISCONNECTED_QOS / LOGGER.DISCONNECTED_RETAIN. |

## 6.2 Heartbeat

When LOGGER.HB_ENABLED = 1, the device sends a periodic heartbeat message to confirm it is alive.

| Parameter | Default | Description |
| :---- | :---- | :---- |
| LOGGER.HB_ENABLED | 0 | Enable heartbeat (0/1). |
| LOGGER.HB_INTERVAL | 30 | Seconds between heartbeat messages. |
| LOGGER.HB_TOPIC | event/heartbeat | MQTT topic for heartbeat. |
| LOGGER.HB_PATH | event/heartbeat | HTTP path for heartbeat. |
| LOGGER.HB_METHOD | POST | HTTP method (POST or GET). |
| LOGGER.HB_QOS | 0 | MQTT QoS (0 or 1). |
| LOGGER.HB_RETAIN | 0 | MQTT retain flag. |
| LOGGER.HB_PROCESS_RESPONSE | 0 | If 1, device reads the heartbeat HTTP response body and executes any embedded command (see 5.2.1). |
| LOGGER.HB_RESPONSE_PATH | response/heartbeat | HTTP path to POST command results back after executing a remote command from the heartbeat response. |

### 6.2.1 Remote Command Injection via Heartbeat Response (HTTP)

When HB_PROCESS_RESPONSE = 1, the device reads the HTTP response body from the heartbeat request. If it contains a valid device message, the device executes it and posts the result back to HB_RESPONSE_PATH. This enables server-initiated commands without requiring a persistent inbound connection.

The response body can take any of these three shapes:

// Shape 1 – raw SF message  
{ "transaction": { "type": "parameter_write", ... }, "payload": { ... } }

// Shape 2 – wrapped single command  
{ "command": { "transaction": { ... }, "payload": { ... } } }

// Shape 3 – wrapped list (first command is executed)  
{ "commands": [{ "transaction": { ... }, "payload": { ... } }, ...] }

**ℹ  Note:** For Shape 3, only the first command in the list is executed per heartbeat cycle. The server can rotate commands across heartbeat cycles to issue multiple operations over time.

## 6.3 Access Event Logging

Every update_actuator call produces an access log event. Events are sent upstream via the configured protocol. Online (real-time) and offline (queued from connectivity loss) events use separate topics/paths for filtering.

| Parameter | Default | Description |
| :---- | :---- | :---- |
| LOGGER.AC_LOG_TOPIC | event/access/online | MQTT topic for real-time access events. |
| LOGGER.AC_LOG_QOS | 1 | MQTT QoS. |
| LOGGER.AC_LOG_RETAIN | 0 | MQTT retain. |
| LOGGER.AC_LOG_PATH | event/access/online | HTTP path for real-time access events. |
| LOGGER.AC_LOG_METHOD | POST | HTTP method. |
| LOGGER.AC_OFFLINE_LOG_TOPIC | event/access/offline | MQTT topic for offline-queued events (pushed after reconnection). |
| LOGGER.AC_OFFLINE_LOG_QOS | 1 | MQTT QoS for offline events. |
| LOGGER.AC_OFFLINE_LOG_RETAIN | 0 | MQTT retain for offline events. |
| LOGGER.AC_OFFLINE_LOG_PATH | event/access/offline | HTTP path for offline events. |
| LOGGER.AC_OFFLINE_LOG_METHOD | POST | HTTP method for offline events. |

### 6.3.0 Access Event Payload Format (canlı doğrulandı — 2026-05-29)

Yukarıdaki topic/path tablosu iletim kanalını tanımlar; **payload alan isimleri** firmware
dokümanında ayrıca verilmemişti. Aşağıdaki şema gerçek panelden (UUID `289833329732592`)
yakalandı (`convex/lib/cardReaderParse.ts`):

```json
{
  "transaction": { "type": "access_event", "src-id": 289833329732592, "dst-id": 0 },
  "payload": {
    "result":   1,                       // int: 0 = reddedildi (denied), 1 = izin verildi (granted)
    "time":     "2026-05-29 15:18:19",   // string "YYYY-MM-DD HH:MM:SS", panel saati (UTC+3)
    "user_id":  4240722371,              // int: kart numarası
    "actuator": 2                        // int 0–7: io_id (hangi kapı/aktüatör)
  }
}
```

> **Dikkat — alan adları:** payload'da `actuator` (≠ `io_id`) ve `result` (≠ `type`) kullanılır.
> `online` (`event/access/online`) ve `offline` (`event/access/offline`) aynı şemayı kullanır;
> offline, bağlantı dönünce flush edilir. ngsaccess eşlemesi: `actuator → ideIoId`,
> `result → ideResult`, `src-id → ideUuid`, `time → ideTime` (UTC+3). Bkz.
> [NGSACCESS_SYNC_ARCHITECTURE.md](NGSACCESS_SYNC_ARCHITECTURE.md) §1.

### 6.3.1 Offline Log Push

When connectivity is unavailable, access events are stored locally. Upon reconnection, the LogPushManager flushes the queue in configurable batches.

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| LOGGER.PUSH_ENABLED | 1 | 0 or 1 | Enable automatic offline log push on reconnect. |
| LOGGER.PUSH_BATCH_SIZE | 50 | 1–1000 | Number of records sent per upstream message. |
| LOGGER.PUSH_MAX_RETRY | 1 | 1–5 | Maximum consecutive send failures before giving up. |
| LOGGER.PUSH_RETRY_INTERVAL | 5 | 1–60 s | Seconds to wait between retry attempts. |

## 6.4 Telemetry Events

The device can push periodic telemetry (system metrics, sensor data) to a configured endpoint.

| Parameter | Default | Description |
| :---- | :---- | :---- |
| LOGGER.TELEMETRY_TOPIC | event/telemetry | MQTT topic. |
| LOGGER.TELEMETRY_QOS | 1 | MQTT QoS. |
| LOGGER.TELEMETRY_RETAIN | 0 | MQTT retain. |
| LOGGER.TELEMETRY_PATH | event/telemetry | HTTP path. |
| LOGGER.TELEMETRY_METHOD | POST | HTTP method. |
