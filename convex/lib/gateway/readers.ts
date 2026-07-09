"use node";

import { gatewayApiCall } from "./core";

type JsonRecord = Record<string, unknown>;

export interface HikCardReaderEndpointResult {
  key: "cfg" | "plan" | "antiSneak";
  endpoint: string;
  ok: boolean;
  data?: unknown;
  rawPreview: string;
  error?: string;
}

export interface HikCardReaderSnapshotSummary {
  readerNo: number;
  cardReaderName?: string;
  enabled?: boolean;
  functions?: string[];
  description?: string;
  swipeInterval?: number;
  pressTimeout?: number;
  tamperCheckEnabled?: boolean;
  templateNo?: number;
  antiSneakEnabled?: boolean;
  followUpCardReaders?: number[];
}

export interface HikCardReaderSnapshot {
  version: 1;
  readerNo: number;
  updatedAt: number;
  summary: HikCardReaderSnapshotSummary;
  results: HikCardReaderEndpointResult[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedRecord(data: unknown, key: string): JsonRecord | undefined {
  if (!isRecord(data)) return undefined;
  const direct = data[key];
  if (isRecord(direct)) return direct;
  for (const value of Object.values(data)) {
    if (!isRecord(value)) continue;
    const nested = value[key];
    if (isRecord(nested)) return nested;
  }
  return undefined;
}

function stringValue(record: JsonRecord | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(record: JsonRecord | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(record: JsonRecord | undefined, key: string): boolean | undefined {
  const value = record?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function stringArrayValue(record: JsonRecord | undefined, key: string): string[] | undefined {
  const value = record?.[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

function numberArrayValue(record: JsonRecord | undefined, key: string): number[] | undefined {
  const value = record?.[key];
  if (!Array.isArray(value)) return undefined;
  const numbers = value.filter((item): item is number =>
    typeof item === "number" && Number.isFinite(item)
  );
  return numbers.length > 0 ? numbers : undefined;
}

function endpointResult(
  key: HikCardReaderEndpointResult["key"],
  endpoint: string,
  status: number,
  data: unknown,
  raw: string,
): HikCardReaderEndpointResult {
  const ok = status >= 200 && status < 300;
  return {
    key,
    endpoint,
    ok,
    data: ok ? data : undefined,
    rawPreview: raw.slice(0, 4000),
    error: ok ? undefined : `HTTP ${status}`,
  };
}

export function summarizeCardReaderSnapshot(
  readerNo: number,
  cfgData: unknown,
  planData: unknown,
  antiSneakData: unknown,
): HikCardReaderSnapshotSummary {
  const cfg = nestedRecord(cfgData, "CardReaderCfg");
  const plan = nestedRecord(planData, "CardReaderPlan");
  const antiSneak = nestedRecord(antiSneakData, "CardReaderAntiSneakCfg");

  return {
    readerNo,
    cardReaderName: stringValue(cfg, "cardReaderName"),
    enabled: booleanValue(cfg, "enable"),
    functions: stringArrayValue(cfg, "cardReaderFunction"),
    description: stringValue(cfg, "cardReaderDescription"),
    swipeInterval: numberValue(cfg, "swipeInterval"),
    pressTimeout: numberValue(cfg, "pressTimeout"),
    tamperCheckEnabled: booleanValue(cfg, "enableTamperCheck"),
    templateNo: numberValue(plan, "templateNo"),
    antiSneakEnabled: booleanValue(antiSneak, "enable"),
    followUpCardReaders: numberArrayValue(antiSneak, "followUpCardReader"),
  };
}

export async function fetchCardReaderSnapshot(
  devIndex: string,
  readerNo: number,
): Promise<HikCardReaderSnapshot> {
  const endpoints = {
    cfg: `/ISAPI/AccessControl/CardReaderCfg/${readerNo}`,
    plan: `/ISAPI/AccessControl/CardReaderPlan/${readerNo}`,
    antiSneak: `/ISAPI/AccessControl/CardReaderAntiSneakCfg/${readerNo}`,
  } as const;

  const [cfg, plan, antiSneak] = await Promise.all([
    gatewayApiCall(endpoints.cfg, "GET", undefined, devIndex),
    gatewayApiCall(endpoints.plan, "GET", undefined, devIndex),
    gatewayApiCall(endpoints.antiSneak, "GET", undefined, devIndex),
  ]);

  const summary = summarizeCardReaderSnapshot(
    readerNo,
    cfg.data,
    plan.data,
    antiSneak.data,
  );

  return {
    version: 1,
    readerNo,
    updatedAt: Date.now(),
    summary,
    results: [
      endpointResult("cfg", endpoints.cfg, cfg.status, cfg.data, cfg.raw),
      endpointResult("plan", endpoints.plan, plan.status, plan.data, plan.raw),
      endpointResult("antiSneak", endpoints.antiSneak, antiSneak.status, antiSneak.data, antiSneak.raw),
    ],
  };
}
