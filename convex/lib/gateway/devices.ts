"use node";

import { gatewayApiCall, gatewayApiCallChecked, parseHikJsonStatus } from "./core";

// Device lifecycle (gateway-local registry)
export interface AddDeviceArgs {
  devName: string;
  ehomeID: string;
  ehomeKey?: string;
  devType?: "accessControl" | "encodeDevice";
}

export interface AddDeviceResult {
  ok: boolean;
  devIndex?: string;
  error?: string;
  raw: unknown;
}

/**
 * EHOME (ISUP 5.0) protokolü ile yeni cihaz kaydı.
 * Cihaz daha önce gateway'e bağlanmışsa /ISAPI/ContentMgmt/DeviceMgmt/devices/preRegister'a
 * düşer, oradan da `addDevice` ile aktif listeye alınır. PoC için doğrudan add kullanıyoruz.
 */
/**
 * Hik Device Gateway API v1.8 — JSON_DeviceInList format:
 *   DeviceInList[].Device.{protocolType, EhomeParams, ISAPIParams, devName, devType}
 *
 * protocolType: "ehome" | "ehomeV5" (ISUP 5.0) | "ISAPI"
 * devType: "encodingDev" | "AccessControl"
 * EhomeID + EhomeKey: capital first letter (sensitive — production'da security=1 + AES128 CBC)
 */
export async function addDeviceToGateway(
  args: AddDeviceArgs,
): Promise<AddDeviceResult> {
  const body = {
    DeviceInList: [
      {
        Device: {
          protocolType: "ehomeV5",
          EhomeParams: {
            EhomeID: args.ehomeID,
            EhomeKey: args.ehomeKey ?? "",
          },
          devName: args.devName,
          devType:
            args.devType === "encodeDevice" ? "encodingDev" : "AccessControl",
        },
      },
    ],
  };

  const result = await gatewayApiCall(
    "/ISAPI/ContentMgmt/DeviceMgmt/addDevice",
    "POST",
    body,
  );

  const data = result.data as Record<string, unknown> | undefined;
  const outList = data?.DeviceOutList as
    | Array<{ Device?: { devIndex?: string; status?: string; subStatusCode?: string } }>
    | undefined;
  const firstDevice = outList?.[0]?.Device;

  // Per-device error: subStatusCode "deviceExist" / "badParameters" / "monitorNodeOverLimit" / "noMemory"
  if (firstDevice?.status === "fail") {
    const sub = firstDevice.subStatusCode;
    if (sub === "deviceExist") {
      return {
        ok: false,
        error:
          "Bu Ehome ID gateway'de zaten kayıtlı. Gateway web UI → Access Control Device → ilgili satırı sil, sonra tekrar dene.",
        raw: result.data,
      };
    }
    return {
      ok: false,
      error: `Gateway addDevice ${sub ?? "fail"}`,
      raw: result.data,
    };
  }

  // Toplam batch hatası
  if (data?.subStatusCode === "addDeviceFailed") {
    return {
      ok: false,
      error:
        "Gateway addDevice reddetti — Ehome ID gateway'de zaten kayıtlı olabilir (manuel kayıt varsa sil).",
      raw: result.data,
    };
  }

  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw}`, raw: result.data };
  }

  const devIndex = firstDevice?.devIndex;
  if (!devIndex || typeof devIndex !== "string") {
    return { ok: false, error: "devIndex döndürülmedi", raw: result.data };
  }
  return { ok: true, devIndex, raw: result.data };
}

export async function deleteDeviceFromGateway(
  devIndex: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await gatewayApiCall(
    "/ISAPI/ContentMgmt/DeviceMgmt/delDevice",
    "DELETE",
    null,
    devIndex,
  );
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw}` };
  }
  return { ok: true };
}

export interface GatewayDeviceStatus {
  devIndex: string;
  devName?: string;
  ehomeID?: string;
  online?: boolean;
  ipAddress?: string;
  model?: string;
  raw?: unknown;
}

/**
 * Gateway'in kendi deviceInfo endpoint'ine basit ping atar.
 * Auth + reachability doğrulaması için (cihaz listesi alamadan).
 */
export async function pingGateway(): Promise<{
  ok: boolean;
  model?: string;
  version?: string;
  error?: string;
}> {
  const result = await gatewayApiCall("/ISAPI/System/deviceInfo", "GET", null);
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw}` };
  }
  const data = result.data as { DeviceInfo?: { model?: string; softwareVersion?: string } } | undefined;
  return {
    ok: true,
    model: data?.DeviceInfo?.model,
    version: data?.DeviceInfo?.softwareVersion,
  };
}

export async function listGatewayDevices(): Promise<GatewayDeviceStatus[]> {
  const result = await gatewayApiCall(
    "/ISAPI/ContentMgmt/DeviceMgmt/deviceList",
    "POST",
    { searchID: "1", searchResultPosition: 0, maxResults: 200 },
  );
  if (result.status !== 200) return [];
  const data = result.data as Record<string, unknown> | undefined;
  const list = (data?.DeviceList as Array<Record<string, unknown>>) ?? [];
  return list.map((item) => {
    const info = (item.DeviceInfo as Record<string, unknown>) ?? item;
    return {
      devIndex: String(info.devIndex ?? ""),
      devName: info.devName as string | undefined,
      ehomeID: info.ehomeID as string | undefined,
      online: info.devStatus === "online" || info.online === true,
      ipAddress: info.ipAddress as string | undefined,
      model: info.devType as string | undefined,
      raw: info,
    };
  });
}

/**
 * Cihazın saat dilimi + NTP ayarı — saat drift cihaz lokal karar verirken
 * `Valid` window ve week plan time evaluation'ı bozar. Default Asia/Istanbul (UTC+3).
 * NOT: ISAPI `/System/time` body shape firmware'a göre değişebilir; manuel time
 * push'u "Type:manual" + localTime ile yapıyoruz (NTP optional).
 */
export async function setDeviceTime(
  devIndex: string,
  opts: { timezone?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  const tz = opts.timezone ?? "CST-3:00:00";
  // Cihaza local TR saatini gönder — Convex'in çalıştığı sunucu UTC olduğu için
  // 3 saat ekliyoruz. Cihaz local time ile interpret eder.
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const iso = now.toISOString().replace(/\.\d+Z$/, "");
  const result = await gatewayApiCall(
    "/ISAPI/System/time",
    "PUT",
    {
      Time: {
        timeMode: "manual",
        localTime: iso,
        timeZone: tz,
      },
    },
    devIndex,
  );
  if (result.status === 200) return { ok: true };
  return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
}

/**
 * Cihazda kaç kapı var? — `RightPlan` üretirken her kapı için entry açmak
 * için kullanılır. DS-K1T807 tek kapı, DS-K2604 dört kapı.
 */
export async function getDoorCapabilities(
  devIndex: string,
): Promise<{ ok: boolean; doorNum?: number; error?: string }> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/Door/capabilities?format=json",
    "GET",
    null,
    devIndex,
  );
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
  }
  const data = result.data as Record<string, unknown> | undefined;
  const caps = data?.DoorCap as Record<string, unknown> | undefined;
  // doorNum alanı opt'lar farklı firmware'larda farklı yerde olabilir — defensive.
  const raw =
    (caps?.doorNum as number | undefined) ??
    (caps?.DoorNum as number | undefined) ??
    (data?.doorNum as number | undefined);
  const num = typeof raw === "number" && raw > 0 ? raw : undefined;
  return { ok: true, doorNum: num };
}

/**
 * Kapı parametreleri (açık kalma süresi, manyetik alarm).
 * /Door/param/{doorID} PUT.
 */
export interface DoorParam {
  openDuration?: number; // saniye
  magneticAlarmEnable?: boolean;
  doorTimeoutAlarm?: number; // kapı çok uzun açık kalırsa alarm (saniye)
}

export async function setDoorParam(
  devIndex: string,
  doorNo: number,
  param: DoorParam,
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/Door/param/${doorNo}`,
    "PUT",
    {
      DoorParam: {
        doorNo,
        ...(param.openDuration !== undefined ? { openDuration: param.openDuration } : {}),
        ...(param.magneticAlarmEnable !== undefined
          ? { magneticAlarmEnable: param.magneticAlarmEnable }
          : {}),
        ...(param.doorTimeoutAlarm !== undefined
          ? { doorTimeoutAlarm: param.doorTimeoutAlarm }
          : {}),
      },
    },
    devIndex,
  );
}

/**
 * Uzaktan kapı kontrol — open/close/alwaysOpen/alwaysClose.
 * openDoor() shorthand'i `cmd: "open"` ile bunu çağırır.
 */
export type DoorCmd = "open" | "close" | "alwaysOpen" | "alwaysClose";

export async function remoteDoorControl(
  devIndex: string,
  doorNo: number,
  cmd: DoorCmd,
): Promise<{ ok: boolean; error?: string }> {
  const result = await gatewayApiCall(
    `/ISAPI/AccessControl/RemoteControl/door/${doorNo}`,
    "PUT",
    { RemoteControlDoor: { cmd } },
    devIndex,
  );
  if (result.status === 200) return { ok: true };
  return { ok: false, error: `HTTP ${result.status}: ${result.raw}` };
}

export async function openDoor(
  devIndex: string,
  doorNo: number = 1,
): Promise<{ ok: boolean; error?: string }> {
  return remoteDoorControl(devIndex, doorNo, "open");
}

/**
 * Cihaza alarm/event forwarding URL'i set eder — kart okuma event'leri bu URL'e POST'lanır.
 * Gateway passthrough ile cihazın httpHosts ayarına yazar.
 *
 * URL https:// içeriyorsa portNo=443 + HTTPS, http:// ise 80 + HTTP varsayılır.
 */
export async function setHttpHostForwarding(
  devIndex: string,
  forwardUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(forwardUrl);
  } catch {
    return { ok: false, error: `Geçersiz forwarding URL: ${forwardUrl}` };
  }
  const isHttps = parsed.protocol === "https:";
  const portNo = parsed.port
    ? Number(parsed.port)
    : isHttps
      ? 443
      : 80;

  const body = {
    HttpHostNotificationList: {
      HttpHostNotification: [
        {
          id: 1,
          url: parsed.toString(),
          protocolType: isHttps ? "HTTPS" : "HTTP",
          parameterFormatType: "JSON",
          addressingFormatType: "hostname",
          hostName: parsed.hostname,
          portNo,
          httpAuthenticationMethod: "none",
        },
      ],
    },
  };

  const result = await gatewayApiCall(
    "/ISAPI/Event/notification/httpHosts",
    "PUT",
    body,
    devIndex,
  );
  const status = parseHikJsonStatus(result);
  if (status.ok || status.alreadyExists) return { ok: true };
  return { ok: false, error: status.error ?? `HTTP ${result.status}: ${result.raw}` };
}

/**
 * Cihazı gateway üzerinden yeniden başlatır.
 * PUT /ISAPI/System/reboot — yanıt XML veya boş olabilir; HTTP 2xx → başarı say.
 */
export async function rebootDeviceOnGateway(
  devIndex: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await gatewayApiCall("/ISAPI/System/reboot", "PUT", {}, devIndex);
  if (result.status >= 200 && result.status < 300) return { ok: true };
  // JSON statusCode kontrolü — XML/boş yanıta tolerans
  const status = parseHikJsonStatus(result);
  if (status.ok) return { ok: true };
  return {
    ok: false,
    error: status.error ?? `HTTP ${result.status}: ${result.raw.slice(0, 200)}`,
  };
}

export interface AcsWorkStatusResult {
  doorStatus?: number[];
  magneticStatus?: number[];
  cardReaderOnlineStatus?: number[];
  batteryVoltage?: number;
  powerSupplyStatus?: string;
  raw: string;
}

/**
 * Cihazın anlık çalışma durumunu okur.
 * GET /ISAPI/AccessControl/AcsWorkStatus
 * // VERIFY: Alan adları cihaz modeline göre değişebilir — canlı yanıtla doğrula.
 */
export async function getAcsWorkStatus(devIndex: string): Promise<{
  ok: boolean;
  status?: AcsWorkStatusResult;
  error?: string;
}> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/AcsWorkStatus",
    "GET",
    undefined,
    devIndex,
  );
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
  }
  const raw = result.raw;
  const data = result.data;
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Yanıt parse edilemedi" };
  }
  // VERIFY: Bazı firmware'lar AcsWorkStatus wrap key kullanır, bazıları düz döner.
  const wrap =
    (data as Record<string, unknown>)["AcsWorkStatus"] ??
    (data as Record<string, unknown>);
  if (typeof wrap !== "object" || wrap === null) {
    return { ok: false, error: "AcsWorkStatus alanı yok" };
  }
  const w = wrap as Record<string, unknown>;

  // doorStatus: sayısal array — VERIFY: alan adı değişebilir (doorStatus / DoorStatus)
  // Fix 6: boş [] geleni [] bırak, "alan yok" ile "alan boş (0 okuyucu)" ayrımı korunsun.
  const parseMaybeNumberArray = (v: unknown): number[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    return v.filter((x): x is number => typeof x === "number");
  };

  const doorStatus = parseMaybeNumberArray(w["doorStatus"] ?? w["DoorStatus"]);
  const magneticStatus = parseMaybeNumberArray(w["magneticStatus"] ?? w["MagneticStatus"]);
  const cardReaderOnlineStatus = parseMaybeNumberArray(
    w["cardReaderOnlineStatus"] ?? w["CardReaderOnlineStatus"],
  );

  const rawBattery = w["batteryVoltage"] ?? w["BatteryVoltage"];
  const batteryVoltage = typeof rawBattery === "number" ? rawBattery : undefined;

  const rawPower = w["powerSupplyStatus"] ?? w["PowerSupplyStatus"];
  const powerSupplyStatus = typeof rawPower === "string" ? rawPower : undefined;

  return {
    ok: true,
    status: {
      doorStatus,
      magneticStatus,
      cardReaderOnlineStatus,
      batteryVoltage,
      powerSupplyStatus,
      raw,
    },
  };
}

