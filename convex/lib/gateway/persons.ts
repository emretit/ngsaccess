"use node";

import { toUtcISO } from "../trDate";

import {
  gatewayApiCall,
  gatewayApiCallChecked,
  parseHikJsonStatus,
  getCountFromEndpoint,
  DEFAULT_SEARCH_PAGE_SIZE,
} from "./core";

// Person sync (UserInfo passthrough)
export interface PersonRecord {
  employeeNo: string;
  name: string;
  userType?: "normal" | "visitor" | "blackList" | "administrators";
  /** Legacy all-door fallback only; explicit doorPlans takes precedence. */
  doorCount?: number;
  /**
   * Legacy single plan (required when doorPlans is omitted);
   * çünkü cihazda Template/1 default 24/7 plan olduğu için sessiz fallback kişiyi
   * istenmeyen şekilde 24 saat geçerli yapardı.
   */
  planTemplateNo?: number;
  /** Explicit per-door plans; an empty list is unauthorized and never falls back. */
  doorPlans?: DoorPlan[];
  /** Çalışan inaktifse `false`. Default true. */
  validEnable?: boolean;
  beginTime?: string;
  endTime?: string;
}

export interface DoorPlan {
  doorNo: number;
  planTemplateNos: number[];
}

/** Merge device-leg (all doors) and door-leg (explicit numbers) rules. */
export function buildDoorPlans(
  doorCount: number,
  rules: readonly { planTemplateNo: number; doorNos?: readonly (number | undefined)[] }[],
): { doorPlans: DoorPlan[]; warnings: string[] } {
  const plans = new Map<number, Set<number>>();
  const warnings: string[] = [];
  for (const rule of rules) {
    if (!Number.isInteger(rule.planTemplateNo) || rule.planTemplateNo < 1) throw new Error("Invalid planTemplateNo");
    const doors = rule.doorNos ?? Array.from({ length: doorCount }, (_, i) => i + 1);
    for (const doorNo of doors) {
      if (doorNo === undefined || !Number.isInteger(doorNo) || doorNo < 1 || doorNo > doorCount) {
        warnings.push(`hikDoorNo missing/invalid: ${String(doorNo)} (plan ${rule.planTemplateNo})`);
        continue;
      }
      const numbers = plans.get(doorNo) ?? new Set<number>();
      numbers.add(rule.planTemplateNo);
      plans.set(doorNo, numbers);
    }
  }
  return {
    doorPlans: [...plans].sort(([a], [b]) => a - b).map(([doorNo, numbers]) => ({ doorNo, planTemplateNos: [...numbers].sort((a, b) => a - b) })),
    warnings,
  };
}

/**
 * Hik local timeType expects Turkey wall-clock time, without an offset. Only a start that is
 * still in the future at sync time is written; past/now (e.g. visitor registration time) keeps
 * the default begin so a device clock running behind cannot reject a just-registered person.
 */
export function hikValidBeginFromAccessStart(accessStartsAt: string | undefined, now: number): string | undefined {
  if (!accessStartsAt) return undefined;
  const iso = toUtcISO(accessStartsAt);
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (!(ms > now)) return undefined;
  return new Date(ms + 3 * 60 * 60 * 1000).toISOString().slice(0, 19);
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

export function buildPersonPayload(p: PersonRecord) {
  let doorPlans = p.doorPlans;
  if (doorPlans === undefined) {
    if (!p.planTemplateNo) throw new Error(`[hikGateway] planTemplateNo zorunlu — ${p.employeeNo}`);
    if (p.doorCount === undefined) console.warn(`[hikGateway] doorCount belirsiz, 1 varsayılıyor — ${p.employeeNo}`);
    doorPlans = buildDoorPlans(Math.max(1, p.doorCount ?? 1), [{ planTemplateNo: p.planTemplateNo }]).doorPlans;
  }
  if (doorPlans.length === 0) throw new Error(`[hikGateway] unauthorized: no covered doors — ${p.employeeNo}`);
  for (const plan of doorPlans) {
    if (!Number.isInteger(plan.doorNo) || plan.doorNo < 1 || !plan.planTemplateNos.length ||
        plan.planTemplateNos.some(no => !Number.isInteger(no) || no < 1)) throw new Error("Invalid door plan");
  }
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
    doorRight: doorPlans.map(p => p.doorNo).join(","),
    RightPlan: doorPlans.map(({ doorNo, planTemplateNos }) => ({
      doorNo,
      planTemplateNo: planTemplateNos.join(","),
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
    { UserInfo: [buildPersonPayload(person)] },
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
    { UserInfo: buildPersonPayload(person) },
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

export function getPersonCount(devIndex: string) {
  return getCountFromEndpoint(devIndex, "/ISAPI/AccessControl/UserInfo/Count", "UserInfoCount");
}

