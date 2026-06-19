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

## SDK Struct Audit Status

The P/Invoke layer (`Sdk/HikvisionNative.cs`) was audited field-by-field against the
SDK *Card-Based Access Control Developer Guide* (V6.1.5.X) **and** real `HCNetSDK.h`
reference ports (open.hikvision.com + JNA/C# implementations). Confirmed correct:
login (`NET_DVR_USER_LOGIN_INFO`), door-open (`NET_DVR_ControlGateway`, door 1..4 /
cmd 1), alarm-channel setup, `NET_DVR_CARD_CFG_COND`, `NET_DVR_VALID_PERIOD_CFG`,
`NET_DVR_ACS_EVENT_INFO`, all 7 function signatures, and the card-write semantics
(`dwModifyParamType` mask `0x95F`, `byDoorRight`/`wCardRightPlan`/`byBelongGroup`).

**`NET_DVR_IPADDR` — RESOLVED.** Earlier notes (and the PDF §4.1.56 table) claimed
`szIPv6` is 256 bytes. That is **misleading**: the real type is a *sequential struct*
(not a union) `sIpV4[16] + byRes[128]` = **144 bytes**, confirmed by HCNetSDK.h ports
and the cross-check `NET_DVR_MANAGE_UNIT_RELATEDEV = IPADDR + byRes[880] = 1024`. The
struct is now 144 bytes; `byCardNo` offset inside `NET_DVR_ACS_ALARM_INFO` is correct.
**Do not** change it back to 256/272 — that re-introduces the garbage-card-number bug.

**Still open — verify against your shipped `HCNetSDK.h`:**

- **`ENUM_ACS_SEND_DATA == 3`?** Used as `dwDataType` in `NET_DVR_SendRemoteConfig`.
  The ACS guide names the enum but never gives its numeric value (it lives in
  `HCEnumDVR.h`/`HCNetSDK.h`, not this PDF). The accepted value is `3`; confirm it and
  fix `HikvisionNative.EnumAcsSendData` if different (a wrong value makes the panel
  silently reject card writes).
- **`UserRightPlanTemplate` JSON body** (`HikvisionClient.PutWeekPlan`) is an ISAPI
  shape not defined in this PDF. `holidayGroupNo` is now omitted (it is a numeric No.,
  `0-invalid`); if a firmware rejects the template, pull
  `/ISAPI/AccessControl/UserRightPlanTemplate/capabilities?format=json` to confirm the
  expected field shape.

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
