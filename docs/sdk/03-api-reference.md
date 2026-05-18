# API Referansı — `NET_DVR_*` Fonksiyonları

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Chapter 3, s.84–116

## Özet

HCNetSDK'nin C/C++ API'leri. Toplam 29 fonksiyon. ngsaccess **ISAPI HTTP** kullandığı için bunların çoğu doğrudan çağrılmaz — fakat **referans niteliğindedir** (örneğin bir Hetzner bridge process bunları kullanabilir veya hangi ISAPI URI'sinin hangi HCNetSDK çağrısına denk geldiğini anlamak için).

Tüm fonksiyonlar:
- Başarı: `TRUE` (BOOL döner) veya pozitif değer (LONG döner)
- Başarısız: `FALSE` / `-1` — sonra `NET_DVR_GetLastError()` ile hata kodu al

---

## Lifecycle (Init / Cleanup / Error)

### 3.1 `NET_DVR_Cleanup` — Tüm SDK kaynaklarını serbest bırak
```c
BOOL NET_DVR_Cleanup();
```
- `NET_DVR_Init` ile **çiftli** çağrılmalı (program kapanırken)
- Çağırma sırasında başka API çağrılamaz

### 3.4 `NET_DVR_Init` — Programlama ortamını başlat
```c
BOOL NET_DVR_Init();
```
- Diğer API'lerden önce **bir kez** çağrılmalı
- Olası hata kodları: 0, 41, 53

### 3.7 `NET_DVR_SetSDKInitCfg` — Init öncesi config (lib path, capabilities)
```c
BOOL NET_DVR_SetSDKInitCfg(NET_SDK_INIT_CFG_TYPE enumType, void* const lpInBuff);
```
| `enumType` | Değer | Açıklama |
|---|---|---|
| `NET_SDK_INIT_CFG_ABILITY` | 1 | SDK yetenek seçimi |
| `NET_SDK_INIT_CFG_SDK_PATH` | 2 | Component lib yükleme yolu (Linux/Windows) |
| `NET_SDK_INIT_CFG_LIBEAY_PATH` | 3 | OpenSSL `libeay32.dll` / `libcrypto.so` yolu |
| `NET_SDK_INIT_CFG_SSLEAY_PATH` | 4 | OpenSSL `ssleay32.dll` / `libssl.so` yolu |

### 3.2 `NET_DVR_GetErrorMsg` — Son hata mesajı string
```c
char* NET_DVR_GetErrorMsg(LONG* pErrorNo);
```

### 3.3 `NET_DVR_GetLastError` — Son hata kodu
```c
DWORD NET_DVR_GetLastError();
```

---

## Authentication

### 3.5 `NET_DVR_Login_V40` — Cihaza giriş ⭐
```c
LONG NET_DVR_Login_V40(
    NET_DVR_USER_LOGIN_INFO  pLoginInfo,
    NET_DVR_DEVICEINFO_V40   lpDeviceInfo
);
```
- Sync / Async mode (`bUseAsynLogin` 0/1)
- Async: `fLoginResultCallBack` callback ile sonuç döner
- Return: `lUserID` (>= 0 başarılı). Tek instance'ta max 2048 user.

### 3.6 `NET_DVR_Logout` — Cihazdan çıkış
```c
BOOL NET_DVR_Logout(LONG lUserID);
```

---

## Device Configuration (Batch)

### 3.8 `NET_DVR_GetDeviceAbility` ⭐ — Yetenek sorgula
```c
BOOL NET_DVR_GetDeviceAbility(
    LONG   lUserID,
    DWORD  dwAbilityType,     // 0x801 = ACS_ABILITY
    char  *pInBuf,
    DWORD  dwInLength,
    char  *pOutBuf,
    DWORD  dwOutLength
);
```
Cihazın hangi feature'ları desteklediğini XML olarak döner. Her major işlem öncesi önce bu çağrılmalı.

### 3.9 `NET_DVR_GetDeviceConfig` — Batch config oku (max 64 kanal)
```c
BOOL NET_DVR_GetDeviceConfig(
    LONG   lUserID,
    DWORD  dwCommand,
    DWORD  dwCount,           // 0/1 = single, 2+ = batch
    LPVOID lpInBuffer,
    DWORD  dwInBufferSize,
    LPVOID lpStatusList,      // [OUT] her kanal için error code
    LPVOID lpOutBuffer,
    DWORD  dwOutBufferSize
);
```

### 3.15 `NET_DVR_SetDeviceConfig` — Batch config yaz (max 256 kanal)
```c
BOOL NET_DVR_SetDeviceConfig(
    LONG   lUserID,
    DWORD  dwCommand,
    DWORD  dwCount,
    LPVOID lpInBuffer,
    DWORD  dwInBufferSize,
    LPVOID lpStatusList,      // [OUT]
    LPVOID lpInParamBuffer,
    DWORD  dwInParamBufferSize
);
```

### 3.24 `NET_DVR_GetDVRConfig` — Standart config oku
```c
BOOL NET_DVR_GetDVRConfig(
    LONG   lUserID,
    DWORD  dwCommand,
    LONG   lChannel,
    LPVOID lpOutBuffer,
    DWORD  dwOutBufferSize,
    LPDWORD lpBytesReturned
);
```

### 3.25 `NET_DVR_SetDVRConfig` — Standart config yaz
```c
BOOL NET_DVR_SetDVRConfig(
    LONG   lUserID,
    DWORD  dwCommand,
    LONG   lChannel,
    LPVOID lpInBuffer,
    DWORD  dwInBufferSize
);
```

---

## Remote Config (Persistent Connection)

> Büyük veri (kart listesi, geçmiş event) için **persistan TCP bağlantı** kullanılır. Callback üzerinden parçalı gelir.

### 3.17 `NET_DVR_StartRemoteConfig` — Bağlantı + callback set
```c
LONG NET_DVR_StartRemoteConfig(
    LONG     lUserID,
    DWORD    dwCommand,           // örn. NET_DVR_GET_CARD_CFG_V50 (2178)
    LPVOID   lpInBuffer,
    DWORD    dwInBufferLen,
    fRemoteConfigCallback cbStateCallback,
    LPVOID   pUserData
);
```
Komut listesi:
| Command | Value | İşlem |
|---|---|---|
| `NET_DVR_GET_CARD_CFG_V50` | 2178 | Kart info al |
| `NET_DVR_SET_CARD_CFG_V50` | 2179 | Kart info uygula |
| `NET_DVR_GET_FACE_PARAM_CFG` | 2507 | Yüz info al |
| `NET_DVR_SET_FACE_PARAM_CFG` | 2508 | Yüz info uygula |
| `NET_DVR_GET_FINGERPRINT_CFG` | 2150 | Parmak izi al |
| `NET_DVR_SET_FINGERPRINT_CFG` | 2151 | Parmak izi uygula |
| `NET_DVR_GET_ACS_EVENT` | 2514 | Geçmiş event ara |
| `NET_DVR_CAPTURE_FINGERPRINT_INFO` | 2504 | Parmak izi okut |
| `NET_DVR_GET_ALL_RECORD_PASSBACK_TASK_MANUAL` | 6235 | Manuel passback task |

### 3.14 `NET_DVR_SendRemoteConfig` — Persistan bağlantıya data yolla
```c
BOOL NET_DVR_SendRemoteConfig(
    LONG   lHandle,
    DWORD  dwDataType,        // örn. ENUM_ACS_SEND_DATA
    char  *pSendBuf,
    DWORD  dwBufSize
);
```

### 3.11 `NET_DVR_GetNextRemoteConfig` — Sıradaki sonucu al
```c
LONG NET_DVR_GetNextRemoteConfig(LONG lHandle, void *lpOutBuff, DWORD dwOutBuffSize);
```
Status değerleri:
- `1000` SUCCESS — devam et
- `1001` NEED_WAIT — bekle
- `1002` FINISH — bitti
- `1003` FAILED — hata

### 3.20 `NET_DVR_StopRemoteConfig` — Bağlantıyı kapat
```c
BOOL NET_DVR_StopRemoteConfig(LONG lHandle);
```

### 3.17.1 `fRemoteConfigCallback` — Callback fonksiyon imzası
```c
void (CALLBACK *fRemoteConfigCallback)(
    DWORD  dwType,            // STATUS=0 / PROGRESS=1 / DATA=2
    void  *lpBuffer,
    DWORD  dwBufLen,
    void  *pUserData
);
```

---

## ISAPI Text Protocol

### 3.18 `NET_DVR_STDXMLConfig` ⭐ — ISAPI HTTP wrap
```c
BOOL NET_DVR_STDXMLConfig(
    LONG  lUserID,
    const NET_DVR_XML_CONFIG_INPUT  *lpInputParam,
    NET_DVR_XML_CONFIG_OUTPUT       *lpOutputParam
);
```
HCNetSDK içinden ISAPI çağrısı yapar. `lpInputParam` içinde:
- `lpRequestUrl` — örn. `"GET /ISAPI/System/capabilities"`
- `lpInBuffer` — request body (XML / JSON)
- `lpOutBuffer` — response body
- `lpStatusBuffer` — response status

> **ngsaccess için:** Bu API yerine doğrudan `fetch()` veya `node-fetch` ile HTTP yapıyoruz — daha esnek.

---

## File Upload / Download

### 3.16 `NET_DVR_StartDownload` — Dosya indir
```c
LONG NET_DVR_StartDownload(
    LONG       lUserID,
    DWORD      dwDownloadType,    // NET_SDK_DOWNLOAD_TYPE enum
    LPVOID     lpInBuffer,
    DWORD      dwInBufferSize,
    const char *sFileName
);
```

### 3.19 `NET_DVR_StopDownload`
```c
BOOL NET_DVR_StopDownload(LONG lHandle);
```

### 3.10 `NET_DVR_GetDownloadState` — Progress sorgula
```c
LONG NET_DVR_GetDownloadState(LONG lDownloadHandle, DWORD *pProgress);
```
Status: 1=Done, 2=Downloading, 3=Failed, 4=Network Disconnected

### 3.22 `NET_DVR_UploadFile_V40` — Dosya yükle
```c
LONG NET_DVR_UploadFile_V40(
    LONG       lUserID,
    DWORD      dwUploadType,      // NET_SDK_UPLOAD_TYPE
    LPVOID     lpInBuffer,
    DWORD      dwInBufferSize,
    char      *sFileName,
    LPVOID     lpOutBuffer,
    DWORD      dwOutBufferSize
);
```

### 3.21 `NET_DVR_UploadClose`
```c
BOOL NET_DVR_UploadClose(LONG lUploadHandle);
```

### 3.12 `NET_DVR_GetUploadState` — Upload progress
```c
LONG NET_DVR_GetUploadState(LONG lUploadHandle, DWORD *pProgress);
```
Status codes (Table 3-2): `1` success, `2` uploading, `3` failed, `21` audio rate not supported, `22` face library full, `28` too many faces in pic, `30` recognition failed, vb.

---

## Door Control

### 3.13 `NET_DVR_ControlGateway` ⭐ — Kapıyı uzaktan kontrol et
```c
BOOL NET_DVR_ControlGateway(LONG lUserID, LONG lGatewayIndex, DWORD dwStaic);
```
| `dwStaic` | Anlam |
|---|---|
| 0 | Close (Under Control) |
| 1 | Open |
| 2 | Remain Open (Free) |
| 3 | Remain Closed (Disabled) |
| 4 | Recovery (sadece elevator) |
| 5 | Visitor Call Elevator |
| 6 | Resident Call Elevator |

Detay: [2.7-remote-door-control.md](./02-typical-applications/2.7-remote-door-control.md)

---

## Alarm / Event (Real-time)

### 3.26 `NET_DVR_SetDVRMessageCallBack_V50` — Callback set ⭐
```c
BOOL NET_DVR_SetDVRMessageCallBack_V50(
    int      iIndex,
    MSGCallBack fMessageCallBack,
    void    *pUser
);
```

#### `MSGCallBack` imzası
```c
typedef BOOL (CALLBACK *MSGCallBack)(
    LONG       lCommand,        // örn. COMM_ALARM_ACS (0x5002), COMM_ISAPI_ALARM (0x6009)
    NET_DVR_ALARMER *pAlarmer,
    char      *pAlarmInfo,      // cast'le: NET_DVR_ACS_ALARM_INFO* veya NET_DVR_ALARM_ISAPI_INFO*
    DWORD      dwBufLen,
    void      *pUser
);
```

### 3.27 `NET_DVR_SetupAlarmChan_V50` — Arming mode başlat
```c
LONG NET_DVR_SetupAlarmChan_V50(
    LONG  lUserID,
    NET_DVR_SETUPALARM_PARAM_V50 *lpSetupParam,
    char *szSubscribeInfo,
    UINT  uiLength
);
```

### 3.23 `NET_DVR_CloseAlarmChan_V30` — Arming mode kapat
```c
BOOL NET_DVR_CloseAlarmChan_V30(LONG lAlarmHandle);
```

### 3.28 `NET_DVR_StartListen_V30` — Listening mode başlat ⭐
```c
LONG NET_DVR_StartListen_V30(
    char   *sLocalIP,
    WORD    wLocalPort,
    MSGCallBack DataCallback,
    void   *pUserData
);
```

### 3.29 `NET_DVR_StopListen_V30`
```c
BOOL NET_DVR_StopListen_V30(LONG lListenHandle);
```

Detay: [2.6-alarm-event-receiving.md](./02-typical-applications/2.6-alarm-event-receiving.md)

---

## Tipik Çağrı Akışları

### 1. Basit Kart Sorgulama
```
NET_DVR_Init
  → NET_DVR_Login_V40
    → NET_DVR_StartRemoteConfig(NET_DVR_GET_CARD_CFG_V50, ...)
      → NET_DVR_SendRemoteConfig(ENUM_ACS_SEND_DATA, ...)
        → (callback'ler ile data gelir)
      → NET_DVR_StopRemoteConfig
    → NET_DVR_Logout
  → NET_DVR_Cleanup
```

### 2. Real-time Event Listening
```
NET_DVR_Init
  → NET_DVR_SetDVRMessageCallBack_V50(callback)
  → NET_DVR_StartListen_V30(IP, port)   // veya per-device: SetupAlarmChan_V50
    → (event'ler callback'e gelir, lCommand = COMM_ALARM_ACS)
  → NET_DVR_StopListen_V30
  → NET_DVR_Cleanup
```

### 3. ISAPI HTTP via SDK
```
NET_DVR_Init
  → NET_DVR_Login_V40
    → NET_DVR_STDXMLConfig(GET /ISAPI/AccessControl/capabilities)
    → NET_DVR_STDXMLConfig(POST /ISAPI/AccessControl/AcsEvent?format=json)
  → NET_DVR_Logout
  → NET_DVR_Cleanup
```

---

## ngsaccess Tarafında Notlar

### Şu an HCNetSDK kullanmıyoruz
ngsaccess Convex backend doğrudan HTTP fetch yapıyor — HCNetSDK DLL gerektirmez. Bu doc **referans amaçlı**.

### Gerekirse Hangi Senaryoda Kullanılır?
- **Hetzner LAN bridge:** Cihazlar internet'e açık değilse, Hetzner üzerinde bir bridge process HCNetSDK ile cihazlara bağlanır, event'leri Convex'e relay eder
- **High-frequency event receiving:** ISAPI HTTP overhead'ı varsa, HCNetSDK direct TCP daha hızlı
- **Custom DLL deploy senaryosu:** On-premise enterprise kurulumlarda gerekirse

### ISAPI ↔ HCNetSDK Eşleme
| ISAPI HTTP | HCNetSDK Karşılığı |
|---|---|
| `GET /ISAPI/System/deviceInfo` | `NET_DVR_STDXMLConfig` |
| `POST /ISAPI/AccessControl/AcsEvent` | `NET_DVR_StartRemoteConfig` + `NET_DVR_GET_ACS_EVENT` |
| HTTP Notify Surveillance Center | `NET_DVR_StartListen_V30` (listening mode) |
| Cihaza HTTP POST (callback URL) | `NET_DVR_SetupAlarmChan_V50` (arming mode) |
| `PUT /ISAPI/.../RemoteControl/door/<n>` | `NET_DVR_ControlGateway` |

---

## İlgili Belgeler
- [docs/sdk/04-structures-enumerations.md](./04-structures-enumerations.md) — Tüm struct + enum tanımları
- [docs/sdk/02-typical-applications/2.6-alarm-event-receiving.md](./02-typical-applications/2.6-alarm-event-receiving.md) — Event callback örneği
- [docs/sdk/02-typical-applications/2.2-manage-card-information.md](./02-typical-applications/2.2-manage-card-information.md) — `StartRemoteConfig` kullanım örneği
- [docs/sdk/appendix-c/c.3-sdk-errors.md](./appendix-c/c.3-sdk-errors.md) — Hata kodları tablosu
