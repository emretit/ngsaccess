# 1. Communication Overview

## 1.1 Supported Transport Protocols

The device simultaneously supports multiple transports. All transports carry the same JSON message envelope described in Section 1.2, so business logic is transport-agnostic.

| Protocol | Port (default) | Direction | Notes |
| :---- | :---- | :---- | :---- |
| HTTP Server | 80 (HTTPSERVER.PORT) | Bidirectional | Listens at root path. Accepts POST with JSON body. One request = one message, one response. |
| MQTT | 8883 (MQTT.PORT) | Bidirectional | Device subscribes to MQTT.TOPIC_SUBSCRIBE; publishes responses to MQTT.TOPIC_PUBLISH. TLS enabled by default. |
| UDP | 6040 (UDP.LOCAL_PORT) | Bidirectional | Device listens on UDP.LOCAL_PORT; replies to sending address. Multicast supported. |
| TCP | 6090 (TCP.PORT) | Bidirectional | Raw TCP socket. Same JSON framing. SSL configurable. |
| RS-485 | — | Bidirectional | Serial bus. Baud and timeout set via RS485.* parameters. |
| BLE | — | Bidirectional | Peripheral or Central role. Chunked transport for large messages. |

**ℹ  Note:** Channel identity (mqtt, http, udp, rs485, ble, tcp) is detected automatically by the transport layer and is not part of the JSON payload. It affects minimum authorization levels for certain operations.

## 1.2 Message Envelope

Every message, regardless of transport, is a JSON object with two top-level keys:

{  
  "transaction": {  
    "msx-id": 123,  
    "src-id": 1001,  
    "dst-id": 9001,  
    "token":  "<jwt-like token>",  
    "type":   "parameter_read"  
  },  
  "payload": {  
    "...": "<content depends on type>"  
  }  
}

### 1.2.1 transaction Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| msx-id | int | str | Client-assigned transaction ID. Echoed back in the response, allowing correlation of async messages. |
| src-id | int | str | Sender's identifier. Typically your server or application UUID. |
| dst-id | int | Target device UUID (or broadcast ID). Requests with a mismatched dst-id may be silently ignored. Login messages are exempt when AUTH.IGNORE_DST_ID_ON_LOGIN = 1 (default). |
| token | string | Authorization token obtained from a login response. May be omitted only for login messages. |
| type | string | Message type. Determines which handler processes the message. See Section 4 for all types. |

### 1.2.2 Response Envelope

Device responses mirror the transaction fields (src/dst swapped) and include a standard payload:

{  
  "transaction": {  
    "msx-id": 123,  
    "src-id": 9001,  
    "dst-id": 1001,  
    "type":   "parameter_read_response"  
  },  
  "payload": {  
    "result":  "success",  
    "message": "Parameters fetched",  
    "data":    { "...": "..." }  
  }  
}

| Payload Field | Values | Description |
| :---- | :---- | :---- |
| result | "success" | "fail" | Top-level outcome of the operation. |
| message | string | Human-readable description or error detail. |
| data | object | null | Operation-specific payload. null when no data is returned. |
