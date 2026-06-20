# NGS Access Hikvision Windows Bridge

Windows service/console bridge for DS-K2804 panels that expose the Hikvision SDK port
`8000` without an HTTP/ISAPI port. The bridge polls a **roster** from cloud Convex
(panels + pending operations), applies them over the LAN SDK, acks results, and relays
card events to `POST /card-reader`. Operators manage everything from the ngsplus web UI.

**Tek-yer (roster) modeli:** panel IP / password / device-token are **not** entered in
the bridge. They live in ngsplus (the device form, `hikTransport=localBridge`) and reach
the bridge automatically via the roster, authenticated by a single **Bridge Token**. The
bridge only stores the Convex site URL + bridge token locally (`bridge.json`).

## Build

Two parts: the embedded ngsplus web UI (Vite) and the .NET bridge. The one-shot script
from the **repo root** does all of it:

```bash
npm run build:hikvision-windows-bridge
```

That runs `vite build` → `node scripts/copy-bridge-web.mjs` (dist → `wwwroot/`) →
`dotnet publish`. The Vite build must use the production Convex URL (`VITE_CONVEX_URL`),
since the embedded app talks to cloud Convex, not a local backend.

To run the parts manually:

```bash
# 1) Embedded ngsplus UI → wwwroot/  (from repo root)
npm run build
node scripts/copy-bridge-web.mjs

# 2) .NET bridge (Windows x64, .NET 8 SDK) — from this folder
dotnet publish .\NgAccess.HikvisionBridge.csproj -c Release -r win-x64 --self-contained true
```

Output is under:

```text
bin\Release\net8.0-windows\win-x64\publish\
```

The publish output includes `wwwroot/` (when built in step 1) so `/` serves the full
ngsplus UI. Copy the Hikvision Windows x64 SDK runtime DLLs into:

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

`appsettings.json` holds only install-level defaults — **no panels here**:

```json
{
  "Bridge": {
    "SdkDllDirectory": "hikvision-sdk/win-x64",
    "ConvexSiteUrl": "https://notable-tern-4.convex.site",
    "PollIntervalSeconds": 3,
    "PollMaxOperations": 10,
    "BridgeToken": "",
    "ConfigFile": "bridge.json"
  },
  "LocalApi": { "Enabled": true, "Url": "http://127.0.0.1:8787" }
}
```

At runtime the bridge writes the Convex URL + bridge token to `bridge.json` next to the
exe (set from `/__bridge`). Do **not** commit `bridge.json`.

## Run

The local server at `http://127.0.0.1:8787` serves two surfaces:

```text
http://127.0.0.1:8787/          → ngsplus UI (embedded SPA from wwwroot/, talks to cloud Convex)
http://127.0.0.1:8787/__bridge  → bridge config (Convex URL + Bridge Token + panel status)
```

First-time setup:

1. Open `/__bridge`, paste the **Convex Site URL** and the **Bridge Token**
   (ngsplus → Ayarlar → Bridge), then **Kaydet**.
2. Add panels in **ngsplus** (device form, `hikTransport=localBridge`): name, host/IP,
   port 8000, username, password, door count, device token. The bridge pulls them via the
   roster — nothing is added in `/__bridge`.
3. Open `/` for the full ngsplus UI. The `/__bridge` panel table shows each roster panel's
   connection state, last poll and last event; use **Test** to verify login and **Kapı**
   to pulse door 1.

Console mode (auto-opens the browser at `/`):

```powershell
.\Scripts\run-console.ps1
```

## Install As Service

Run PowerShell as Administrator:

```powershell
.\Scripts\install-service.ps1
```

Uninstall:

```powershell
.\Scripts\uninstall-service.ps1
```
