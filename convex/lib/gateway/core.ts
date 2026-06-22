"use node";

import { digestFetch } from "../digestAuth";

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

export async function getCountFromEndpoint(
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
 * Async apply operation'ın tamamlanmasını polling ile bekler.
 * pollDeleteProgress'in genelleştirilmiş hâli — endpoint + status field parametrik.
 *
 * Örnek: FingerPrintProgress için
 *   { statusField: "status", successValue: "success", failValue: "failed", wrapKey: "FingerPrintProgress" }
 */
export async function pollApplyProgress(
  devIndex: string,
  endpoint: string,
  opts: {
    wrapKey: string;
    statusField: string;
    successValue: string;
    failValue: string;
    timeoutMs?: number;
    initialIntervalMs?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_DELETE_TIMEOUT_MS;
  let intervalMs = opts.initialIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await gatewayApiCall(endpoint, "GET", null, devIndex);
    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}` };
    }
    const data = result.data as Record<string, unknown> | undefined;
    const wrap = data?.[opts.wrapKey] as Record<string, unknown> | undefined;
    const fieldValue = wrap?.[opts.statusField] as string | undefined;
    if (fieldValue === opts.successValue) return { ok: true };
    if (fieldValue === opts.failValue) {
      return { ok: false, error: `Apply başarısız (cihaz: ${opts.failValue})` };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    intervalMs = Math.min(intervalMs * 2, DEFAULT_POLL_MAX_INTERVAL_MS);
  }
  return { ok: false, error: `Apply polling timeout (${timeoutMs}ms)` };
}

