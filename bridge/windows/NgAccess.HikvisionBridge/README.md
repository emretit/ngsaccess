# NGS Access Hikvision Windows Bridge

Windows service/console bridge for DS-K2804 panels that expose Hikvision SDK port `8000` without HTTP/ISAPI port.

## Build

Run on a Windows x64 machine with .NET 8 SDK:

```powershell
dotnet publish .\NgAccess.HikvisionBridge.csproj -c Release -r win-x64 --self-contained true
```

Output is under:

```text
bin\Release\net8.0-windows\win-x64\publish\
```

Copy Hikvision Windows x64 SDK runtime DLLs into:

```text
publish\hikvision-sdk\win-x64\
```

## Verify Against HCNetSDK.h Before Trusting Card/Event Paths

The P/Invoke layer (`Sdk/HikvisionNative.cs`) was validated against the SDK
*Card-Based Access Control Developer Guide*. Door-open (`NET_DVR_ControlGateway`,
door 1..4 / cmd 1) and login are confirmed correct. Two items cannot be confirmed
from the PDF and MUST be checked against the real `HCNetSDK.h` shipped with your DLLs;
both only affect the card-event and remote-config-send paths:

1. **`NET_DVR_IPADDR_UNION` size/shape.** `HikvisionNative.cs` models `NET_DVR_IPADDR`
   as `sIpV4[16] + byIPv6[128]` (sequential, 144 bytes). The guide describes a *union*
   with `szIPv6` up to 256 bytes. If the header is a union or `byIPv6` is 256, fix the
   struct (size, or `[StructLayout(LayoutKind.Explicit)]`). This sets the `byCardNo`
   offset inside `NET_DVR_ACS_ALARM_INFO` — if card numbers in swipe events come back
   as garbage, this is the cause.
2. **`ENUM_ACS_SEND_DATA == 3`?** Used as `dwDataType` in `NET_DVR_SendRemoteConfig`.
   The guide names the enum but never gives its numeric value. Confirm it in the header
   and fix `HikvisionNative.EnumAcsSendData` if different (a wrong value makes the panel
   silently reject card writes).

Card deletion uses `NET_DVR_SET_CARD_CFG_V50` (2179) with `byCardValid=0` — the guide's
canonical method — so no separate (header-only) delete command is required.

## Configure

`appsettings.json` holds only install-level settings — panels are NOT configured here.
Panels (IP / password / device token) live in `panels.json`, managed from the local UI.

```json
{
  "Bridge": {
    "SdkDllDirectory": "hikvision-sdk/win-x64",
    "ConvexSiteUrl": "https://notable-tern-4.convex.site",
    "PollIntervalSeconds": 3,
    "PollMaxOperations": 10,
    "ConfigFile": "panels.json"
  },
  "LocalApi": { "Enabled": true, "Url": "http://127.0.0.1:8787" }
}
```

## Run & Add Panels (local UI)

One bridge service manages all of a site's panels. Start in console:

```powershell
.\Scripts\run-console.ps1
```

In console mode the bridge auto-opens the browser. The local server at
`http://127.0.0.1:8787` serves two surfaces:

```text
http://127.0.0.1:8787/          → ngsplus UI (embedded SPA, talks to cloud Convex)
http://127.0.0.1:8787/__bridge  → bridge panel config (add/remove/test panels)
```

The embedded ngsplus is served from `wwwroot/` next to the exe (the packaged
`npm run build` output). It needs internet — it connects to the cloud Convex
deployment, not a local backend.

Open `/__bridge` to manage panels. For each panel add a row with: name, host/IP,
port (8000), username, **password**
(panel admin password — kept locally in `panels.json`, never sent to the cloud), the
**device token** (copied from that device's token card in ngsplus), and door count.
Use **Test** to verify login and **Kapı** to pulse door 1; the status column shows
connected / last poll / last event. The bridge polls Convex per panel and applies
operations automatically.

`panels.json` is created next to the exe and holds panel IPs / passwords / tokens
locally — do not commit it.

## Install As Service

Run PowerShell as Administrator:

```powershell
.\Scripts\install-service.ps1
```

Uninstall:

```powershell
.\Scripts\uninstall-service.ps1
```
