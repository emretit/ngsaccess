"use node";

import { digestFetch } from "./digestAuth";

/**
 * Hik Device Gateway client.
 * Convex (cloud) → Hetzner Gateway (HTTP Digest) → ISUP 5.0 → Cihaz (LAN)
 *
 * Tüm cihaz komutları gateway'in ISAPI passthrough URL'leri üzerinden gider:
 *   /ISAPI/<path>?format=json&devIndex=<uuid>
 *
 * Env vars (Convex Dashboard'da set edilir):
 *   HIK_GATEWAY_HOST  = http://157.90.114.86:8088
 *   HIK_GATEWAY_USER  = admin
 *   HIK_GATEWAY_PASS  = <gateway admin şifresi>
 */

function getGatewayConfig(): { host: string; user: string; pass: string } {
  const host = process.env.HIK_GATEWAY_HOST;
  const user = process.env.HIK_GATEWAY_USER;
  const pass = process.env.HIK_GATEWAY_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "HIK_GATEWAY_HOST / HIK_GATEWAY_USER / HIK_GATEWAY_PASS env vars eksik (Convex Dashboard → Settings → Environment Variables)",
    );
  }
  return { host: host.replace(/\/+$/, ""), user, pass };
}

export interface GatewayResponse {
  status: number;
  data: unknown;
  raw: string;
}

// Module-level konfigürasyon sabitleri
export const MAX_FACE_JPEG_BYTES = 200 * 1024;
export const DEFAULT_DELETE_TIMEOUT_MS = 30_000;
export const DEFAULT_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_POLL_MAX_INTERVAL_MS = 8_000;
export const DEFAULT_SEARCH_PAGE_SIZE = 30;
export const FINGERPRINT_CAPTURE_TIMEOUT_MS = 35_000;
export const MAX_FINGERPRINTS_PER_PERSON = 10;

/**
 * Gateway ISAPI çağrısı yapar. devIndex verilirse passthrough cihaza iletilir.
 */
export async function gatewayApiCall(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: unknown,
  devIndex?: string,
): Promise<GatewayResponse> {
  const { host, user, pass } = getGatewayConfig();
  const url = new URL(`${host}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("format", "json");
  if (devIndex) url.searchParams.set("devIndex", devIndex);

  const reqBody = body !== undefined && body !== null ? JSON.stringify(body) : null;
  const result = await digestFetch(url.toString(), method, reqBody, user, pass);

  let data: unknown;
  try {
    data = JSON.parse(result.body);
  } catch {
    data = result.body;
  }

  // Hata case'inde otomatik trace; HIK_GATEWAY_DEBUG=1 set edilirse başarılı çağrılar da log'lanır.
  // `alreadyExist` benzeri idempotent ret kodları gürültü olarak filtrelenir.
  const responseStr = result.body;
  const isBenignAlreadyExists = /[Aa]lreadyExist/.test(responseStr);
  const failed =
    !isBenignAlreadyExists &&
    (result.status !== 200 ||
      (typeof data === "object" &&
        data !== null &&
        "statusCode" in data &&
        (data as { statusCode?: number }).statusCode !== 1));
  if (failed || process.env.HIK_GATEWAY_DEBUG === "1") {
    console.log(
      `[hikGateway] ${method} ${path} devIndex=${devIndex ?? "-"} status=${result.status}\n` +
        `  REQ: ${reqBody ?? "(none)"}\n` +
        `  RES: ${responseStr.slice(0, 2000)}`,
    );
  }
  return { status: result.status, data, raw: result.body };
}

/**
 * gatewayApiCall + parseHikJsonStatus ortak shape — write helper'lar için convenience.
 * `alreadyExists=true` durumlarını çağıran taraf görmek isterse `ok` yerine bu field'a baksın.
 */
export async function gatewayApiCallChecked(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  devIndex?: string,
): Promise<{ ok: boolean; alreadyExists: boolean; error?: string }> {
  const result = await gatewayApiCall(path, method, body, devIndex);
  return parseHikJsonStatus(result);
}

/**
 * Multipart/form-data POST — face/fingerprint binary upload için.
 * `parts` her biri JSON metadata veya binary olabilir.
 */
export async function gatewayMultipartCall(
  path: string,
  parts: Array<
    | { name: string; filename: string; contentType: string; jsonBody: unknown }
    | { name: string; filename: string; contentType: string; bytes: Uint8Array }
  >,
  devIndex?: string,
): Promise<GatewayResponse> {
  const { host, user, pass } = getGatewayConfig();
  const url = new URL(`${host}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("format", "json");
  if (devIndex) url.searchParams.set("devIndex", devIndex);

  const boundary = `----HikGatewayBoundary${Date.now().toString(36)}`;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const p of parts) {
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n` +
      `Content-Type: ${p.contentType}\r\n\r\n`;
    chunks.push(enc.encode(header));
    if ("jsonBody" in p) {
      chunks.push(enc.encode(JSON.stringify(p.jsonBody)));
    } else {
      chunks.push(p.bytes);
    }
    chunks.push(enc.encode("\r\n"));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));

  const totalLen = chunks.reduce((a, c) => a + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const result = await digestFetch(
    url.toString(),
    "POST",
    merged,
    user,
    pass,
    `multipart/form-data; boundary=${boundary}`,
  );

  let data: unknown;
  try {
    data = JSON.parse(result.body);
  } catch {
    data = result.body;
  }
  return { status: result.status, data, raw: result.body };
}

/**
 * Hikvision JSON yanıtının status'unu ortak şekilde değerlendirir.
 * statusCode=1 veya statusString="OK" → ok. subStatusCode="deviceUserAlreadyExist" → alreadyExists.
 */
/** Hik response'larında "already exists" anlamına gelen tüm subStatusCode varyantları. */
const ALREADY_EXISTS_CODES: ReadonlySet<string> = new Set([
  "deviceUserAlreadyExist",
  "employeeNoAlreadyExist",
  "cardNoAlreadyExist",
  "personIDAlreadyExist",
]);

function findNestedSubStatusCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === "object") {
          const code = (item as Record<string, unknown>).subStatusCode;
          if (typeof code === "string") return code;
          const nested = findNestedSubStatusCode(item);
          if (nested) return nested;
        }
      }
    } else if (v && typeof v === "object") {
      const nested = findNestedSubStatusCode(v);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function parseHikJsonStatus(result: GatewayResponse): {
  ok: boolean;
  alreadyExists: boolean;
  error?: string;
} {
  const data = typeof result.data === "object" && result.data !== null
    ? (result.data as Record<string, unknown>)
    : undefined;

  const topSub = data?.subStatusCode as string | undefined;
  const nestedSub = topSub ?? findNestedSubStatusCode(data);
  const alreadyExists = nestedSub !== undefined && ALREADY_EXISTS_CODES.has(nestedSub);

  // HTTP 200 + statusCode=1 → tam başarı. Nested subStatusCode alreadyExists ise idempotent kabul et.
  if (result.status === 200 && (data?.statusCode === 1 || data?.statusString === "OK")) {
    if (alreadyExists) return { ok: false, alreadyExists: true, error: nestedSub };
    return { ok: true, alreadyExists: false };
  }

  // Non-200 ama JSON body parse edilmiş ve subStatusCode alreadyExists ise:
  // gateway "kayıt zaten var" diyor — Convex tarafında bunu hata sayma.
  if (alreadyExists) return { ok: false, alreadyExists: true, error: nestedSub };

  // Status 200 ama statusCode=1 değil → gateway-level hata
  if (result.status === 200) {
    return {
      ok: false,
      alreadyExists: false,
      error:
        nestedSub ??
        (data?.statusString as string | undefined) ??
        result.raw,
    };
  }

  // Non-200 + JSON parse OK ama tanınmayan code → mesajı çıkar
  const errMsg = nestedSub
    ?? (data?.statusString as string | undefined)
    ?? `HTTP ${result.status}: ${result.raw.slice(0, 200)}`;
  return { ok: false, alreadyExists: false, error: errMsg };
}

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

// Person sync (UserInfo passthrough)
export interface PersonRecord {
  employeeNo: string;
  name: string;
  userType?: "normal" | "visitor" | "blackList" | "administrators";
  /** Cihazdaki kapı sayısı — `RightPlan` her kapı için bir entry üretir (1..doorCount). */
  doorCount?: number;
  /**
   * Hangi planTemplate'e bağlı. Zorunlu — undefined gelirse caller'da sync engellenir;
   * çünkü cihazda Template/1 default 24/7 plan olduğu için sessiz fallback kişiyi
   * istenmeyen şekilde 24 saat geçerli yapardı.
   */
  planTemplateNo: number;
  /** Çalışan inaktifse `false`. Default true. */
  validEnable?: boolean;
  beginTime?: string;
  endTime?: string;
}

/** Bugünden başlayan geniş validity window — accessRule'da explicit tarih alanı yok. */
function defaultValidBegin(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00:00`;
}

// 32-bit time_t firmware'larda 2038 sonrası overflow → `timeFormatError`.
// 2037-12-31 universal güvenli.
const DEFAULT_VALID_END = "2037-12-31T23:59:59";

function buildPersonFields(p: PersonRecord) {
  if (!p.planTemplateNo) {
    throw new Error(
      `[hikGateway] planTemplateNo zorunlu — ${p.employeeNo} için kuralın hikWeekPlanNo'su atanmamış`,
    );
  }
  if (p.doorCount === undefined) {
    console.warn(
      `[hikGateway] doorCount belirsiz, 1 varsayılıyor — ${p.employeeNo}; cihazda hikDoorCount set edilmemiş olabilir`,
    );
  }
  const doorCount = Math.max(1, p.doorCount ?? 1);
  const doorNos = Array.from({ length: doorCount }, (_, i) => i + 1);
  return {
    employeeNo: p.employeeNo,
    name: p.name,
    userType: p.userType ?? "normal",
    Valid: {
      enable: p.validEnable ?? true,
      beginTime: p.beginTime ?? defaultValidBegin(),
      endTime: p.endTime ?? DEFAULT_VALID_END,
      timeType: "local",
    },
    doorRight: doorNos.join(","),
    RightPlan: doorNos.map((doorNo) => ({
      doorNo,
      planTemplateNo: String(p.planTemplateNo),
    })),
  };
}

export async function addPersonToDevice(
  devIndex: string,
  person: PersonRecord,
): Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/UserInfo/Record",
    "POST",
    { UserInfo: [buildPersonFields(person)] },
    devIndex,
  );
  return parseHikJsonStatus(result);
}

/**
 * Mevcut kişinin RightPlan/Valid alanlarını günceller. SetUp endpoint'i DS-K1T8'de
 * single-object body bekler (Record'un array body'sinden farklı). Modify'ın aksine
 * minimal body ile `badParameters` üretmiyor.
 */
async function setupPersonOnDevice(
  devIndex: string,
  person: PersonRecord,
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    "/ISAPI/AccessControl/UserInfo/SetUp",
    "PUT",
    { UserInfo: buildPersonFields(person) },
    devIndex,
  );
}

/**
 * Person upsert — kayıt yoksa Add, varsa SetUp ile RightPlan/Valid'i güncelle.
 * Bu eski sürümden kalan kişilerin default Template/1'e bağlı kalıp 24/7 erişim
 * elde etmesini engeller.
 */
export async function upsertPersonToDevice(
  devIndex: string,
  person: PersonRecord,
): Promise<{ ok: boolean; error?: string }> {
  const addRes = await addPersonToDevice(devIndex, person);
  if (addRes.ok) return { ok: true };
  if (addRes.alreadyExists) {
    return await setupPersonOnDevice(devIndex, person);
  }
  return { ok: false, error: addRes.error };
}

export async function deletePersonFromDevice(
  devIndex: string,
  employeeNo: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/UserInfoDetail/Delete",
    "PUT",
    {
      UserInfoDetail: {
        mode: "byEmployeeNo",
        EmployeeNoList: [{ employeeNo }],
      },
    },
    devIndex,
  );
  const parsed = parseHikJsonStatus(result);
  return { ok: parsed.ok, error: parsed.error };
}

// Card sync (CardInfo passthrough)
export interface CardRecord {
  employeeNo: string;
  cardNo: string;
  cardType?: "normalCard" | "patrolCard" | "hijackCard" | "superCard";
}

// DS-K1T8 cihaz cardNo'yu 10 haneli decimal (leading-zero pad'li) bekliyor.
function normalizeCardNo(cardNo: string): string {
  const digits = cardNo.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

// CardInfo TEK object (array değil); cardValid + leaderCard/checkCardNo/addCardNo/deleteCardNo
// boş string zorunlu (DS-K1T8 §14.2). Add ve Modify aynı body'yi kullanır.
function buildCardInfoBody(card: CardRecord) {
  return {
    CardInfo: {
      employeeNo: card.employeeNo,
      cardNo: normalizeCardNo(card.cardNo),
      cardType: card.cardType ?? "normalCard",
      cardValid: true,
      leaderCard: "",
      checkCardNo: "",
      addCardNo: "",
      deleteCardNo: "",
    },
  };
}

export async function addCardToDevice(
  devIndex: string,
  card: CardRecord,
): Promise<{ ok: boolean; alreadyExists?: boolean; error?: string }> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/CardInfo/Record",
    "POST",
    buildCardInfoBody(card),
    devIndex,
  );
  return parseHikJsonStatus(result);
}

export async function deleteCardFromDevice(
  devIndex: string,
  cardNo: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/CardInfo/Delete",
    "PUT",
    { CardInfoDelCond: { CardNoList: [{ cardNo: normalizeCardNo(cardNo) }] } },
    devIndex,
  );
  const parsed = parseHikJsonStatus(result);
  return { ok: parsed.ok, error: parsed.error };
}

// Access schedule (week plan passthrough)
export const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Weekday = (typeof ALL_DAYS)[number];

export interface WeekScheduleEntry {
  week: Weekday;
  beginTime: string; // "HH:MM:SS"
  endTime: string;
}

const MAX_SEGMENTS_PER_DAY = 8;

/**
 * Haftalık plan — her gün için 8'e kadar zaman aralığı destekler.
 * `schedule` array'i aynı `week` değerine sahip birden fazla entry içerebilir
 * (örn. çift vardiya: 08:00-12:00 + 13:00-17:00).
 */
export async function setWeekPlanOnDevice(
  devIndex: string,
  weekPlanNo: number,
  schedule: WeekScheduleEntry[],
): Promise<{ ok: boolean; error?: string }> {
  const byDay = new Map<Weekday, WeekScheduleEntry[]>();
  for (const s of schedule) {
    const arr = byDay.get(s.week);
    if (arr) arr.push(s);
    else byDay.set(s.week, [s]);
  }

  // Cihazdan GET ile alınan gerçek format (DS-K1T8):
  //   - week: STRING ("Monday".."Sunday") — integer reddediliyor (badParameters).
  //   - Her gün için tam 8 segment gönderilmeli (boşlar enable:false, 00:00:00).
  //   - 24h erişim endTime "24:00:00" (23:59:59 reddediliyor).
  //   - Her segment authenticationTimesEnabled+authenticationTimes alanlarını da içerir.
  const EMPTY_SEGMENT = {
    beginTime: "00:00:00",
    endTime: "00:00:00",
  };
  const WeekPlanCfg: Array<{
    week: Weekday;
    id: number;
    enable: boolean;
    TimeSegment: { beginTime: string; endTime: string };
    authenticationTimesEnabled: boolean;
    authenticationTimes: number;
  }> = [];

  for (const day of ALL_DAYS) {
    const segments = byDay.get(day) ?? [];
    for (let idx = 0; idx < MAX_SEGMENTS_PER_DAY; idx++) {
      const s = segments[idx];
      WeekPlanCfg.push({
        week: day,
        id: idx + 1,
        enable: !!s,
        TimeSegment: s
          ? { beginTime: s.beginTime, endTime: normalizeEndTime(s.endTime) }
          : EMPTY_SEGMENT,
        authenticationTimesEnabled: false,
        authenticationTimes: 0,
      });
    }
  }

  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightWeekPlanCfg/${weekPlanNo}`,
    "PUT",
    { UserRightWeekPlanCfg: { enable: true, WeekPlanCfg } },
    devIndex,
  );
}

// DS-K1T8 24h erişimi `24:00:00` ile gösteriyor; `23:59:59` formatı reddediliyor.
function normalizeEndTime(endTime: string): string {
  return endTime === "23:59:59" ? "24:00:00" : endTime;
}

/**
 * Cihazda kayıtlı kişiyi/kişileri ister (paginated).
 * @returns kişiler ve toplam sayı; sonraki sayfa için bir sonraki searchResultPosition.
 */
export interface SearchPersonResult {
  ok: boolean;
  total?: number;
  persons?: Array<{
    employeeNo: string;
    name?: string;
    userType?: string;
    Valid?: { beginTime?: string; endTime?: string };
    doorRight?: string;
  }>;
  nextPosition?: number;
  error?: string;
}

export async function searchPersonOnDevice(
  devIndex: string,
  opts: {
    searchID: string;
    searchResultPosition?: number;
    maxResults?: number;
    employeeNo?: string;
  },
): Promise<SearchPersonResult> {
  const body = {
    UserInfoSearchCond: {
      searchID: opts.searchID,
      searchResultPosition: opts.searchResultPosition ?? 0,
      maxResults: opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE,
      ...(opts.employeeNo ? { EmployeeNoList: [{ employeeNo: opts.employeeNo }] } : {}),
    },
  };
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/UserInfo/Search",
    "POST",
    body,
    devIndex,
  );
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
  }
  const data = (result.data as Record<string, unknown>)?.UserInfoSearch as
    | { totalMatches?: number; numOfMatches?: number; UserInfo?: SearchPersonResult["persons"]; responseStatusStrg?: string }
    | undefined;
  return {
    ok: true,
    total: data?.totalMatches ?? data?.numOfMatches,
    persons: data?.UserInfo ?? [],
    nextPosition:
      (opts.searchResultPosition ?? 0) + (data?.UserInfo?.length ?? 0),
  };
}

async function getCountFromEndpoint(
  devIndex: string,
  endpoint: string,
  countField: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const result = await gatewayApiCall(endpoint, "GET", null, devIndex);
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
  }
  const data = result.data as Record<string, unknown> | undefined;
  const nested = data ? (data[countField] as Record<string, unknown> | undefined) : undefined;
  const count =
    (nested?.userNumber as number | undefined) ??
    (nested?.cardNumber as number | undefined) ??
    (nested?.faceNumber as number | undefined) ??
    (nested?.totalNumber as number | undefined);
  if (typeof count !== "number") {
    return { ok: false, error: "Sayım yanıtı parse edilemedi" };
  }
  return { ok: true, count };
}

export function getPersonCount(devIndex: string) {
  return getCountFromEndpoint(devIndex, "/ISAPI/AccessControl/UserInfo/Count", "UserInfoCount");
}

export function getCardCount(devIndex: string) {
  return getCountFromEndpoint(devIndex, "/ISAPI/AccessControl/CardInfo/Count", "CardInfoCount");
}

export function getFaceCount(devIndex: string) {
  return getCountFromEndpoint(devIndex, "/ISAPI/Intelligent/FDLib/Count", "FDLibCount");
}

export async function updateCardOnDevice(
  devIndex: string,
  card: CardRecord,
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    "/ISAPI/AccessControl/CardInfo/Modify",
    "PUT",
    buildCardInfoBody(card),
    devIndex,
  );
}

const DELETE_PROGRESS_ENDPOINTS = {
  user: {
    endpoint: "/ISAPI/AccessControl/UserInfoDetail/DeleteProcess",
    wrapKey: "UserInfoDetailDeleteProcess",
  },
  fingerprint: {
    endpoint: "/ISAPI/AccessControl/FingerPrint/DeleteProcess",
    wrapKey: "FingerPrintDeleteProcess",
  },
} as const;

/**
 * Async delete operation'ın tamamlanmasını polling ile bekler.
 * Exponential backoff: 1s → 2s → 4s → 8s (DEFAULT_POLL_MAX_INTERVAL_MS'de cap).
 */
export async function pollDeleteProgress(
  devIndex: string,
  type: keyof typeof DELETE_PROGRESS_ENDPOINTS,
  opts?: { timeoutMs?: number; initialIntervalMs?: number },
): Promise<{ ok: boolean; progress?: number; error?: string }> {
  const cfg = DELETE_PROGRESS_ENDPOINTS[type];
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_DELETE_TIMEOUT_MS;
  let intervalMs = opts?.initialIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await gatewayApiCall(cfg.endpoint, "GET", null, devIndex);
    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
    }
    const data = result.data as Record<string, unknown> | undefined;
    const wrap = data?.[cfg.wrapKey] as Record<string, unknown> | undefined;
    const progress = wrap?.processStatus as string | undefined;
    if (progress === "success") return { ok: true, progress: 100 };
    if (progress === "fail") return { ok: false, error: "Delete failed (device-side)" };
    await new Promise((r) => setTimeout(r, intervalMs));
    intervalMs = Math.min(intervalMs * 2, DEFAULT_POLL_MAX_INTERVAL_MS);
  }
  return { ok: false, error: `Delete polling timeout (${timeoutMs}ms)` };
}

/**
 * Plan template — kişiye atanan ünite. planTemplateNo person'un RightPlan'inde refere edilir.
 * Bir week plan + opsiyonel holiday group bağlar.
 */
export async function setPlanTemplate(
  devIndex: string,
  templateNo: number,
  opts: {
    templateName?: string;
    weekPlanNo: number;
    holidayGroupNo?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  // Cihazdan GET ile alınan format (DS-K1T8): holidayGroupNo CSV string ("" veya "1,2"),
  // array reddediliyor; `planTemplateID` field'ı yok (URL'den okunur); `enable` zorunlu.
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightPlanTemplate/${templateNo}`,
    "PUT",
    {
      UserRightPlanTemplate: {
        enable: true,
        templateName: opts.templateName ?? `Template ${templateNo}`,
        weekPlanNo: opts.weekPlanNo,
        holidayGroupNo: opts.holidayGroupNo ? String(opts.holidayGroupNo) : "",
      },
    },
    devIndex,
  );
}

/**
 * Holiday group — tatil tarih aralıkları kümesi. Group başına 16 holiday limiti var (cihaza göre).
 */
export interface HolidayEntry {
  beginDate: string; // "YYYY-MM-DD"
  endDate: string;
}

export async function setHolidayGroup(
  devIndex: string,
  groupNo: number,
  opts: { groupName?: string; holidays: HolidayEntry[] },
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightHolidayGroupCfg/${groupNo}`,
    "PUT",
    {
      UserRightHolidayGroup: {
        enable: true,
        groupName: opts.groupName ?? `Group ${groupNo}`,
        HolidayPlanCfg: opts.holidays.map((h, idx) => ({
          id: idx + 1,
          beginDate: h.beginDate,
          endDate: h.endDate,
        })),
      },
    },
    devIndex,
  );
}

/**
 * Holiday plan — tatil günlerinde geçerli olacak zaman aralıkları.
 * WeekPlan ile aynı `TimeSegment` nested shape — flat field firmware'da reddedilir.
 */
export async function setHolidayPlan(
  devIndex: string,
  planNo: number,
  segments: { beginTime: string; endTime: string }[],
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    `/ISAPI/AccessControl/UserRightHolidayPlanCfg/${planNo}`,
    "PUT",
    {
      UserRightHolidayPlanCfg: {
        enable: true,
        HolidayPlanCfg: segments.slice(0, 8).map((s, idx) => ({
          id: idx + 1,
          enable: true,
          TimeSegment: { beginTime: s.beginTime, endTime: s.endTime },
        })),
      },
    },
    devIndex,
  );
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

// ============================================================================
// FACE — JPEG upload via multipart/form-data
// ============================================================================

/**
 * Cihaza kişi için yüz fotoğrafı yükler. JPEG, <200KB, 480x640 - 1080x1920.
 * Kişi (employeeNo) cihazda zaten kayıtlı olmalı.
 * Yeni eklemede `faceLibType: "blackFD"` standart; FDID=1 cihazda varsayılan.
 */
export async function addFaceToDevice(
  devIndex: string,
  employeeNo: string,
  jpegBytes: Uint8Array,
  opts?: { name?: string; FDID?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (jpegBytes.length > MAX_FACE_JPEG_BYTES) {
    return {
      ok: false,
      error: `JPEG çok büyük: ${jpegBytes.length}B (max ${MAX_FACE_JPEG_BYTES}B)`,
    };
  }
  const result = await gatewayMultipartCall(
    "/ISAPI/Intelligent/FDLib/FaceDataRecord",
    [
      {
        name: "FaceDataRecord",
        filename: "record.json",
        contentType: "application/json",
        jsonBody: {
          faceLibType: "blackFD",
          FDID: opts?.FDID ?? "1",
          FPID: employeeNo,
          ...(opts?.name ? { name: opts.name } : {}),
        },
      },
      {
        name: "img",
        filename: "face.jpg",
        contentType: "image/jpeg",
        bytes: jpegBytes,
      },
    ],
    devIndex,
  );
  const parsed = parseHikJsonStatus(result);
  return { ok: parsed.ok, error: parsed.error };
}

export async function deleteFaceFromDevice(
  devIndex: string,
  employeeNo: string,
  opts?: { FDID?: string },
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    "/ISAPI/Intelligent/FDLib/FDSearch/Delete",
    "PUT",
    {
      FPID: [{ value: employeeNo }],
      faceLibType: "blackFD",
      FDID: opts?.FDID ?? "1",
    },
    devIndex,
  );
}

// ============================================================================
// FINGERPRINT — live enrollment + write
// ============================================================================

/**
 * Cihazda canlı parmak izi kaydı başlatır. Cihaz sensörü kullanıcıyı 10-30 saniye bekler.
 * Dönen `fingerData` base64 şablonu sonradan `addFingerprintToDevice` ile kişiye yazılır.
 * Şablon cihaz-modeline özgüdür; başka modele aktarılamaz.
 */
export async function captureFingerprintLive(
  devIndex: string,
  opts?: { fingerPrintID?: number },
): Promise<{ ok: boolean; fingerData?: string; error?: string }> {
  // Cihaz sensörü 10-30 saniye user'ı bekler; cihaz hang olursa sonraki
  // enrollment'lar serialize olmasın diye 35s sonra abort et.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const racePromise = Promise.race([
    gatewayApiCall(
      "/ISAPI/AccessControl/CaptureFingerPrint",
      "POST",
      { CaptureFingerPrintCond: { fingerNo: opts?.fingerPrintID ?? 1 } },
      devIndex,
    ),
    new Promise<GatewayResponse>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("captureFingerprintLive timeout")),
        FINGERPRINT_CAPTURE_TIMEOUT_MS,
      );
    }),
  ]);
  let result: GatewayResponse;
  try {
    result = await racePromise;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
  }
  const data = result.data as Record<string, unknown> | undefined;
  const inner = data?.CaptureFingerPrint as Record<string, unknown> | undefined;
  const fingerData = inner?.fingerData as string | undefined;
  if (!fingerData) {
    return { ok: false, error: "fingerData yanıtta yok (kullanıcı tarama yapmadı?)" };
  }
  return { ok: true, fingerData };
}

/**
 * Toplanan fingerprint şablonunu kişiye yazar.
 * fingerPrintID: 1-10 (her kişi başına en fazla 10 parmak).
 */
export async function addFingerprintToDevice(
  devIndex: string,
  args: {
    employeeNo: string;
    fingerPrintID: number;
    fingerData: string;
    fingerType?: "normalFP" | "duressFP" | "patrolFP" | "superFP";
    enableCardReader?: number[];
  },
): Promise<{ ok: boolean; error?: string }> {
  if (args.fingerPrintID < 1 || args.fingerPrintID > MAX_FINGERPRINTS_PER_PERSON) {
    return {
      ok: false,
      error: `fingerPrintID 1-${MAX_FINGERPRINTS_PER_PERSON} arasında olmalı`,
    };
  }
  return gatewayApiCallChecked(
    "/ISAPI/AccessControl/FingerPrintDownload",
    "POST",
    {
      FingerPrintCfg: {
        employeeNo: args.employeeNo,
        enableCardReader: args.enableCardReader ?? [1],
        fingerPrintID: args.fingerPrintID,
        fingerType: args.fingerType ?? "normalFP",
        fingerData: args.fingerData,
      },
    },
    devIndex,
  );
}

export async function deleteFingerprintFromDevice(
  devIndex: string,
  employeeNo: string,
  fingerPrintID?: number,
): Promise<{ ok: boolean; error?: string }> {
  return gatewayApiCallChecked(
    "/ISAPI/AccessControl/FingerPrint/Delete",
    "PUT",
    {
      FingerPrintDelete: {
        mode: "byEmployeeNo",
        EmployeeNoDetail: [
          {
            employeeNo,
            ...(fingerPrintID !== undefined ? { fingerPrintID: [fingerPrintID] } : {}),
          },
        ],
      },
    },
    devIndex,
  );
}

export function getFingerprintCount(devIndex: string) {
  return getCountFromEndpoint(
    devIndex,
    "/ISAPI/AccessControl/FingerPrint/Count",
    "FingerPrintCount",
  );
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
