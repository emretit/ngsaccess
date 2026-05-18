# Device Network SDK Hata Kodları

> **Kaynak:** Device Network SDK (Card-Based Access Control) Developer Guide V6.1.5.X — Appendix C.3, s.393–436

## Özet

`NET_DVR_GetLastError()` veya `NET_DVR_GetErrorMsg()` çağrıldığında dönen hata kodları. ngsaccess HCNetSDK kullanmasa da, ISAPI response'ları içinde bazı kodlar geçer (özellikle `JSON_ResponseStatus.errorCode`).

> **HTTP/ISAPI hata kodları** için ayrıca [c.5-text-protocol-response-codes.md](./c.5-text-protocol-response-codes.md)'ye bakın.

---

## En Sık Karşılaşılan Hatalar (Pratik)

| Kod | Ad | Açıklama | Çözüm |
|---|---|---|---|
| **0** | `NET_DVR_NOERROR` | Hata yok | – |
| **1** | `NET_DVR_PASSWORD_ERROR` | Yanlış kullanıcı adı/şifre | Cihaz şifresini kontrol et |
| **2** | `NET_DVR_NOENOUGHPRI` | İzin yok | Admin kullanıcı kullan |
| **3** | `NET_DVR_NOINIT` | SDK başlatılmadı | Önce `NET_DVR_Init()` çağır |
| **7** | `NET_DVR_NETWORK_FAIL_CONNECT` | Cihaza bağlanılamadı (offline/timeout) | IP/port ve ağ kontrolü |
| **8** | `NET_DVR_NETWORK_SEND_ERROR` | Cihaza data gönderilemedi | Ağ bağlantısı kontrolü |
| **9** | `NET_DVR_NETWORK_RECV_ERROR` | Cihazdan data alınamadı | Ağ + cihaz durumu kontrolü |
| **10** | `NET_DVR_NETWORK_RECV_TIMEOUT` | Veri alma timeout | Network connection check |
| **17** | `NET_DVR_PARAMETER_ERROR` | Yanlış parametre | API çağrı doğrula |
| **23** | `NET_DVR_NOSUPPORT` | Cihaz bu fonksiyonu desteklemiyor | Önce capability sorgula |
| **24** | `NET_DVR_BUSY` | Cihaz meşgul | Sonra tekrar dene |
| **47** | `NET_DVR_USERNOTEXIST` | User ID logout olmuş | Yeniden login |
| **52** | `NET_DVR_MAX_USERNUM` | Max user sınırı (2048) | Eski session'lar logout et |
| **73** | `NET_DVR_SOCKETCLOSE_ERROR` | Socket disconnect | Reconnect mantığı |
| **102** | `NET_DVR_USER_NOT_SUCC_LOGIN` | Login başarısız | Credentials kontrol |
| **153** | `NET_ERR_USERNAME_LOCKED` | Kullanıcı kilitli | Cihazdan unlock |
| **250** | `NET_DVR_ERROR_DEVICE_NOT_ACTIVATED` | Cihaz aktive edilmemiş | Yeni cihaz — aktivasyon yap |
| **251** | `NET_DVR_ERROR_RISK_PASSWORD` | Şifre çok zayıf | Daha güçlü şifre |
| **252** | `NET_DVR_ERROR_DEVICE_HAS_ACTIVATED` | Cihaz zaten aktif | Login dene |

---

## Genel Hata Kodları (0–99)

| Kod | Ad | Açıklama |
|---|---|---|
| 0 | `NET_DVR_NOERROR` | No error |
| 1 | `NET_DVR_PASSWORD_ERROR` | Incorrect user name or password |
| 2 | `NET_DVR_NOENOUGHPRI` | No permission |
| 3 | `NET_DVR_NOINIT` | Uninitialized |
| 4 | `NET_DVR_CHANNEL_ERROR` | Incorrect channel No. |
| 5 | `NET_DVR_OVER_MAXLINK` | No more device can be connected |
| 6 | `NET_DVR_VERSIONNOMATCH` | Version mismatches |
| 7 | `NET_DVR_NETWORK_FAIL_CONNECT` | Connecting to device failed |
| 8 | `NET_DVR_NETWORK_SEND_ERROR` | Sending data to device failed |
| 9 | `NET_DVR_NETWORK_RECV_ERROR` | Receiving data from device failed |
| 10 | `NET_DVR_NETWORK_RECV_TIMEOUT` | Receiving data timed out |
| 11 | `NET_DVR_NETWORK_ERRORDATA` | Illegal data sent or error received |
| 12 | `NET_DVR_ORDER_ERROR` | API calling order error |
| 13 | `NET_DVR_OPERNOPERMIT` | No permission for this operation |
| 14 | `NET_DVR_COMMANDTIMEOUT` | Executing device command timed out |
| 15 | `NET_DVR_ERRORSERIALPORT` | Incorrect serial port No. |
| 16 | `NET_DVR_ERRORALARMPORT` | Alarm port No. error |
| 17 | `NET_DVR_PARAMETER_ERROR` | Incorrect parameter |
| 18 | `NET_DVR_CHAN_EXCEPTION` | Device channel exception |
| 19 | `NET_DVR_NODISK` | No HDD in device |
| 20 | `NET_DVR_ERRORDISKNUM` | Incorrect HDD No. |
| 21 | `NET_DVR_DISK_FULL` | HDD full |
| 22 | `NET_DVR_DISK_ERROR` | HDD error |
| 23 | `NET_DVR_NOSUPPORT` | Device does not support this function |
| 24 | `NET_DVR_BUSY` | Device is busy |
| 25 | `NET_DVR_MODIFY_FAIL` | Failed to edit device parameters |
| 26 | `NET_DVR_PASSWORD_FORMAT_ERROR` | Invalid password format |
| 27 | `NET_DVR_DISK_FORMATING` | HDD is formatting |
| 28 | `NET_DVR_DVRNORESOURCE` | Insufficient device resources |
| 29 | `NET_DVR_DVROPRATEFAILED` | Device operation failed |
| 30 | `NET_DVR_OPENHOSTSOUND_FAIL` | Local audio open failed |
| 31 | `NET_DVR_DVRVOICEOPENED` | Two-way audio channel occupied |
| 32 | `NET_DVR_TIMEINPUTERROR` | Incorrect time input |
| 33 | `NET_DVR_NOSPECFILE` | No video file for playback |
| 34 | `NET_DVR_CREATEFILE_ERROR` | Failed to create file |
| 35 | `NET_DVR_FILEOPENFAIL` | Failed to open file |
| 36 | `NET_DVR_OPERNOTFINISH` | Operation conflicted |
| 37 | `NET_DVR_GETPLAYTIMEFAIL` | Failed to get played time |
| 38 | `NET_DVR_PLAYFAIL` | Failed to play |
| 39 | `NET_DVR_FILEFORMAT_ERROR` | Invalid file format |
| 40 | `NET_DVR_DIR_ERROR` | File directory error |
| 41 | `NET_DVR_ALLOC_RESOURCE_ERROR` | Allocating resources failed |
| 42 | `NET_DVR_AUDIO_MODE_ERROR` | Invalid sound card mode |
| 43 | `NET_DVR_NOENOUGH_BUF` | Insufficient buffer |
| 44 | `NET_DVR_CREATESOCKET_ERROR` | Failed to create socket |
| 45 | `NET_DVR_SETSOCKET_ERROR` | Failed to set socket |
| 46 | `NET_DVR_MAX_NUM` | No more registrations and live views |
| 47 | `NET_DVR_USERNOTEXIST` | User does not exist |
| 48 | `NET_DVR_WRITEFLASHERROR` | Writing FLASH error |
| 49 | `NET_DVR_UPGRADEFAIL` | Failed to upgrade device |
| 50 | `NET_DVR_CARDHAVEINIT` | Decoding card already initialized |
| 51 | `NET_DVR_PLAYERFAILED` | Player SDK function call failed |
| 52 | `NET_DVR_MAX_USERNUM` | No more users |
| 53 | `NET_DVR_GETLOCALIPANDMACFAIL` | Failed to get local IP/MAC |
| 54 | `NET_DVR_NOENCODEING` | Decoding not enabled |
| 55 | `NET_DVR_IPMISMATCH` | IP address mismatches |
| 56 | `NET_DVR_MACMISMATCH` | MAC address mismatches |
| 57 | `NET_DVR_UPGRADELANGMISMATCH` | Upgrade language mismatches |
| 58 | `NET_DVR_MAX_PLAYERPORT` | No more channels can play |
| 59 | `NET_DVR_NOSPACEBACKUP` | Insufficient space to back up |
| 60 | `NET_DVR_NODEVICEBACKUP` | No backup device |
| 61–63 | `PICTURE_*_ERROR` | Picture bit/dimension/size error |
| 64–66 | `LOAD*SDK_FAILED` | PlayerSDK / DSSDK yükleme hatası |
| 67 | `LOADDSSDKPROC_ERROR` | DS SDK fonksiyon bulunamadı |
| 68 | `DSSDK_ERROR` | Decoding library API hatası |
| 69 | `VOICEMONOPOLIZE` | Ses kartı exclusive |
| 70 | `JOINMULTICASTFAILED` | Multicast group join hatası |
| 71 | `CREATEDIR_ERROR` | Log directory oluşturma hatası |
| 72 | `BINDSOCKET_ERROR` | Socket bind hatası |
| 73 | `SOCKETCLOSE_ERROR` | Socket disconnect |
| 74 | `USERID_ISUSING` | User ID kullanımda — logout edilemiyor |
| 75 | `SOCKETLISTEN_ERROR` | Listen hatası |
| 76 | `PROGRAM_EXCEPTION` | Program exception |
| 77 | `WRITEFILE_FAILED` | Dosya yazma hatası |
| 78 | `FORMAT_READONLY` | HDD read-only |
| 79 | `WITHSAMEUSERNAME` | Kullanıcı adı zaten var |
| 80–82 | `*VERSION_ERROR` | Cihaz / language / software mismatch |
| 83 | `IPCHAN_NOTALIVE` | IP channel offline |
| 84 | `RTSP_SDK_ERROR` | StreamTransClient.dll yükleme hatası |
| 85 | `CONVERT_SDK_ERROR` | SystemTransform.dll hatası |
| 86 | `IPC_COUNT_OVERFLOW` | No more IP channels |
| 87 | `MAX_ADD_NUM` | No more video tags |
| 88 | `PARAMMODE_ERROR` | Invalid parameter mode |
| 89 | `CODESPITTER_OFFLINE` | Code distributer offline |
| 90 | `BACKUP_COPYING` | Backup in progress |
| 91 | `CHAN_NOTSUPPORT` | Channel doesn't support operation |
| 92–95 | `CAL*` | Calibration errors |
| 96 | `DDNS_DEVOFFLINE` | DDNS'e kayıt yok |
| 97 | `DDNS_INTER_ERROR` | DDNS internal error |
| 98 | `FUNCTION_NOT_SUPPORT_OS` | OS desteklemiyor |
| 99 | `DEC_CHAN_REBIND` | Decoding channel binding limited |

---

## Component / Module Load Hataları (100–142)

| Kod | Ad | Açıklama |
|---|---|---|
| 100 | `INTERCOM_SDK_ERROR` | Two-way audio SDK yüklenemedi |
| 101 | `NO_CURRENT_UPDATEFILE` | Yanlış upgrade paketi |
| 102 | `USER_NOT_SUCC_LOGIN` | Login failed |
| 103 | `USE_LOG_SWITCH_FILE` | Log switch file in use |
| 104 | `POOL_PORT_EXHAUST` | Port pool exhausted |
| 105 | `PACKET_TYPE_NOT_SUPPORT` | Stream packaging format error |
| 106 | `IPPARA_IPID_ERROR` | Incorrect IPID |
| 107–113 | `LOAD_HC*_SDK_ERROR` | Component load failure (preview/voicetalk/alarm/playback/display/industry/general cfg) |
| 121–128 | `CORE_VER_MISMATCH_*` | Component core version mismatch |
| 136–142 | `COM_VER_MISMATCH_*` | Component COM version mismatch |

---

## Activation / Auth Hataları (150–187)

| Kod | Ad | Açıklama |
|---|---|---|
| 150 | `ALIAS_DUPLICATE` | Duplicated HiDDNS alias |
| 152 | `USERNAME_NOT_EXIST` | User name doesn't exist |
| 153 | `USERNAME_LOCKED` | User name locked |
| 154 | `INVALID_USERID` | Invalid user ID |
| 155 | `LOW_LOGIN_VERSION` | Login version too low |
| 156 | `LOAD_LIBEAY32_DLL_ERROR` | libeay32.dll yüklenemedi |
| 157 | `LOAD_SSLEAY32_DLL_ERROR` | ssleay32.dll yüklenemedi |
| 158 | `LOAD_LIBICONV` | libiconv.dll yüklenemedi |
| 159 | `SSL_CONNECT_FAILED` | SSL bağlantı hatası |
| 165 | `TEST_SERVER_FAIL_CONNECT` | Test server bağlantı hatası |
| 166–173 | NAS/FTP/SMTP errors | Network storage / mail errors |
| 174 | `IP_CONFLICT` | IP çakışması |
| 175–176 | `STORAGEPOOL_*` | Cloud storage hatası |
| 177 | `EFFECTIVENESS_REBOOT` | Restart gerek |
| 178–179 | `ANR_*_EXIST` | ANR arming/upload zaten var |
| 180–181 | `INCORRECT_FILE_*` | Import file format/content hatalı |
| 182 | `MAX_HRUDP_LINK` | Max HRUDP bağlantı |
| 183–184 | `*_PORT_MULTIPLEX` | Multiplexed port limit |
| 185 | `NONBLOCKING_CAPTURE_NOTSUPPORT` | Non-blocking capture desteklenmiyor |
| 186 | `FUNCTION_INVALID` | Async mode'da invalid |
| 187 | `MAX_PORT_MULTIPLEX` | Max multiplex port |

---

## RAID / Storage Hataları (188–249)

200–249 arası **NVR storage** hataları (RAID, virtual disk, physical disk). ngsaccess için **çok sık karşılaşılmaz** — sadece NVR/depolama özelli cihazlarda gelir.

Önemli olanlar:
| Kod | Ad |
|---|---|
| 200 | `NAME_NOT_ONLY` (zaten var) |
| 201 | `OVER_MAX_ARRAY` (max RAID) |
| 220–222 | Insufficient/missing disk |
| 223 | `NAME_EMPTY` |
| 224 | `INPUT_PARAM` (input param hatası) |
| 225–226 | `*NOT_AVAILABLE` |
| 230 | `NOT_SUPPORT` |
| 240 | `NOT_SUPPORT_16T` |

---

## Aktivasyon (250–252) ⭐

| Kod | Ad | Açıklama | Çözüm |
|---|---|---|---|
| **250** | `ERROR_DEVICE_NOT_ACTIVATED` | Cihaz aktive edilmemiş | SADP tool ile cihazı aktive et veya `PUT /ISAPI/System/activate` |
| **251** | `ERROR_RISK_PASSWORD` | Şifre çok zayıf (kısa / common / pattern) | Daha güçlü şifre |
| **252** | `ERROR_DEVICE_HAS_ACTIVATED` | Cihaz zaten aktif | Login dene |

**ngsaccess için pratik:** Yeni cihaz eklerken **önce aktive edilmesi gerekir**. Aktive değilse `error 250` döner.

---

## VCA / Calibration Hataları (300–340)

Genelde **People Counting, Face Recognition, Behavior Analysis** gibi gelişmiş özelliklerde:
| Kod | Açıklama |
|---|---|
| 300 | Invalid ID |
| 301 | Invalid polygon |
| 302–303 | Rule param / conflict |
| 304–309 | Calibration errors |
| 310–317 | Lane / traffic rule errors |
| 318–324 | Face library / feature errors |
| 326–327 | Detection region size |
| 328 | Trial period ended |
| 329 | Config file conflict |
| 330–338 | Face model errors (FPL, FEM, FD, FA) |
| 339–341 | Dongle / camera version mismatch |

---

## ngsaccess Tarafında Notlar

### Error Code → User-Friendly Mesaj Eşleme
```typescript
// convex/lib/hikvisionErrors.ts (önerilen)
const ERROR_MESSAGES: Record<number, string> = {
  0: "İşlem başarılı",
  1: "Kullanıcı adı veya şifre hatalı",
  2: "Bu işlem için yetkiniz yok",
  7: "Cihaza ulaşılamıyor — IP ve ağ bağlantısını kontrol edin",
  17: "Geçersiz parametre",
  23: "Bu cihaz bu özelliği desteklemiyor",
  47: "Oturum sona ermiş — yeniden bağlanın",
  102: "Giriş başarısız",
  153: "Kullanıcı hesabı kilitli",
  250: "Cihaz aktive edilmemiş — önce SADP tool ile aktive edin",
  251: "Şifre çok zayıf — daha güçlü şifre kullanın",
  252: "Cihaz zaten aktif",
};

export function getErrorMessage(code: number): string {
  return ERROR_MESSAGES[code] ?? `Bilinmeyen hata (kod: ${code})`;
}
```

### Retry Stratejisi
- **7, 8, 9, 10** (network) → exponential backoff retry (max 3)
- **24** (busy) → 2s sonra retry (max 5)
- **47** (user not exist) → relogin + retry
- **17** (parameter) → retry yapma, bug fix
- **23** (not support) → retry yapma, feature flag
- **102** (login failed) → retry yapma, credentials sor
- **153, 250** (locked / not activated) → kullanıcıya manuel müdahale gerek

### Monitoring
ngsaccess audit log'unda her hata için:
- `deviceId`, `apiCall`, `errorCode`, `errorMessage`, `timestamp`
- Dashboard: en çok hangi hatalar geliyor? cihaz bazlı hata oranı?

---

## İlgili Belgeler
- [docs/sdk/appendix-c/c.5-text-protocol-response-codes.md](./c.5-text-protocol-response-codes.md) — HTTP/ISAPI hata kodları (NET_DVR_* yerine)
- [docs/sdk/03-api-reference.md](../03-api-reference.md) — `NET_DVR_GetLastError`, `NET_DVR_GetErrorMsg`
- [convex/actions/hikvisionSync.ts](../../../convex/actions/hikvisionSync.ts) — Mevcut hata yönetimi
