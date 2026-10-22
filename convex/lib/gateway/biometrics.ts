"use node";

import {
  gatewayApiCall,
  gatewayApiCallChecked,
  gatewayXmlCall,
  gatewayMultipartCall,
  parseHikJsonStatus,
  getCountFromEndpoint,
  pollApplyProgress,
  DEFAULT_DELETE_TIMEOUT_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_MAX_INTERVAL_MS,
  MAX_FACE_JPEG_BYTES,
  FINGERPRINT_CAPTURE_TIMEOUT_MS,
  MAX_FINGERPRINTS_PER_PERSON,
  DEFAULT_SEARCH_PAGE_SIZE,
} from "./core";

export function getFaceCount(devIndex: string) {
  return getCountFromEndpoint(devIndex, "/ISAPI/Intelligent/FDLib/Count", "FDLibCount");
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
    // CaptureFingerPrint XML-only (cihaz `format=json`'u yok sayıp XML döner).
    gatewayXmlCall(
      "/ISAPI/AccessControl/CaptureFingerPrint",
      "POST",
      `<?xml version="1.0" encoding="UTF-8"?><CaptureFingerPrintCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><fingerNo>${opts?.fingerPrintID ?? 1}</fingerNo></CaptureFingerPrintCond>`,
      devIndex,
    ),
    new Promise<{ status: number; raw: string }>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("captureFingerprintLive timeout")),
        FINGERPRINT_CAPTURE_TIMEOUT_MS,
      );
    }),
  ]);
  let result: { status: number; raw: string };
  try {
    result = await racePromise;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
  // Only status codes leave this function; the raw body may hold a template.
  const subStatus = /<subStatusCode>([^<]*)<\/subStatusCode>/.exec(result.raw)?.[1];
  if (result.status !== 200) {
    return { ok: false, error: `HTTP ${result.status}${subStatus ? `: ${subStatus}` : ""}` };
  }
  const fingerData = /<fingerData>([^<]+)<\/fingerData>/.exec(result.raw)?.[1]?.trim();
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
  // 1. FingerPrint verisi cihaza gönderilir (async yazma başlar).
  const downloadResult = await gatewayApiCallChecked(
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
  if (!downloadResult.ok) return downloadResult;

  // 2. Cihaz async apply eder; FingerPrintProgress polling ile tamamlanmasını bekle.
  return pollFingerprintProgress(devIndex);
}

/** cardReaderRecvStatus (DS-K1T807 V4.24 capabilities: 0-8); 1 = okuyucuya yazıldı. */
const FP_RECV_STATUS_ERRORS: Readonly<Record<number, string>> = {
  0: "fpRecvStatus0: okuyucuya bağlanılamadı",
  2: "fpRecvStatus2: parmak izi modülü çevrimdışı",
  3: "fpRecvStatus3: parmak izi kalitesi düşük",
  4: "fpRecvStatus4: parmak izi belleği dolu",
  5: "fpRecvStatus5: parmak izi zaten kayıtlı",
  6: "fpRecvStatus6: parmak numarası zaten kayıtlı",
  7: "fpRecvStatus7: geçersiz parmak numarası",
};
/** Okuyucuda parmak izi modülü yok — o okuyucu için hata değil. */
const FP_RECV_NOT_APPLICABLE = 8;

/**
 * Canlı yanıt (LAN probe 2026-10-22):
 * `{"FingerPrintStatus":{"StatusList":[{"id":1,"cardReaderRecvStatus":1}],"totalStatus":1}}`
 * totalStatus 0 = sürüyor, 1 = bitti; başarı = en az bir okuyucu 1, kalanlar 1 ya da 8.
 */
export function evaluateFingerprintProgress(data: unknown): { done: boolean; ok: boolean; error?: string } {
  const status = (data as { FingerPrintStatus?: { StatusList?: unknown; totalStatus?: unknown } } | undefined)?.FingerPrintStatus;
  if (!status || status.totalStatus !== 1) return { done: false, ok: false };
  const codes = (Array.isArray(status.StatusList) ? status.StatusList : [])
    .map(item => (item as { cardReaderRecvStatus?: unknown }).cardReaderRecvStatus)
    .filter((code): code is number => typeof code === "number");
  const failed = codes.find(code => code !== 1 && code !== FP_RECV_NOT_APPLICABLE);
  if (failed !== undefined) return { done: true, ok: false, error: FP_RECV_STATUS_ERRORS[failed] ?? `fpRecvStatus${failed}` };
  if (!codes.includes(1)) return { done: true, ok: false, error: "fpRecvStatus: hiçbir okuyucu kaydı onaylamadı" };
  return { done: true, ok: true };
}

async function pollFingerprintProgress(devIndex: string): Promise<{ ok: boolean; error?: string }> {
  const deadline = Date.now() + DEFAULT_DELETE_TIMEOUT_MS;
  let intervalMs = DEFAULT_POLL_INTERVAL_MS;
  while (Date.now() < deadline) {
    // Progress yanıtında şablon yok; yine de gövde log'lanmaz (core.ts fingerprint maskesi).
    const result = await gatewayApiCall("/ISAPI/AccessControl/FingerPrintProgress", "GET", null, devIndex);
    if (result.status !== 200) return { ok: false, error: `HTTP ${result.status}` };
    const progress = evaluateFingerprintProgress(result.data);
    if (progress.done) return { ok: progress.ok, error: progress.error };
    await new Promise(r => setTimeout(r, intervalMs));
    intervalMs = Math.min(intervalMs * 2, DEFAULT_POLL_MAX_INTERVAL_MS);
  }
  return { ok: false, error: `FingerPrintProgress timeout (${DEFAULT_DELETE_TIMEOUT_MS}ms)` };
}

export async function deleteFingerprintFromDevice(
  devIndex: string,
  employeeNo: string,
  fingerPrintID?: number,
): Promise<{ ok: boolean; error?: string }> {
  // EmployeeNoDetail cihazda NESNE (dizi → 400 MessageParametersLack, LAN probe 2026-10-22).
  const result = await gatewayApiCallChecked(
    "/ISAPI/AccessControl/FingerPrint/Delete",
    "PUT",
    {
      FingerPrintDelete: {
        mode: "byEmployeeNo",
        EmployeeNoDetail: {
          employeeNo,
          ...(fingerPrintID !== undefined ? { fingerPrintID: [fingerPrintID] } : {}),
        },
      },
    },
    devIndex,
  );
  // Only explicit absent-person/fingerprint status codes are idempotent success.
  const absent = new Set(["employeeNoNotExist", "employeeNotExist", "userNotExist", "deviceUserNotExist", "fingerPrintNotExist", "fingerprintNotExist", "fingerPrintNotFound"]);
  if (!result.ok) return result.error && absent.has(result.error) ? { ok: true } : result;
  // Silme async; cihaz bitene kadar DeleteProcess "processing" döner. Önceki işlemin
  // bayat durumunu okumamak için ilk sorgudan önce kısa bekle.
  await new Promise(r => setTimeout(r, DEFAULT_POLL_INTERVAL_MS));
  return pollApplyProgress(devIndex, "/ISAPI/AccessControl/FingerPrint/DeleteProcess", {
    wrapKey: "FingerPrintDeleteProcess",
    statusField: "status",
    successValue: "success",
    failValue: "failed",
  });
}

export function getFingerprintCount(devIndex: string) {
  return getCountFromEndpoint(
    devIndex,
    "/ISAPI/AccessControl/FingerPrint/Count",
    "FingerPrintCount",
  );
}

export interface FaceRecord {
  employeeNo?: string;
  FPID?: string;
  faceURL?: string;
}

export interface SearchFacesResult {
  ok: boolean;
  faces: FaceRecord[];
  total: number;
  numMatches: number;
  nextPosition: number;
  /** Devam eden sayfa var mı? responseStatusStrg==="MORE" veya tam-dolu sayfa. */
  hasMore: boolean;
  error?: string;
}

/**
 * Cihazdaki yüz kaydı listesini sayfalı olarak sorgular.
 * POST /ISAPI/Intelligent/FDLib/FDSearch
 *
 * VERIFY: FDSearchDescription body shape ve MatchList response shape canlı cihazda doğrula.
 */
export async function searchFacesOnDevice(
  devIndex: string,
  opts: {
    searchID: string;
    position: number;
    maxResults?: number;
    FDID?: string;
  },
): Promise<SearchFacesResult> {
  const body = {
    FDSearchDescription: {
      searchID: opts.searchID,
      FDID: opts.FDID ?? "1",
      maxResults: opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE,
      searchResultPosition: opts.position,
    },
  };
  const result = await gatewayApiCall(
    "/ISAPI/Intelligent/FDLib/FDSearch",
    "POST",
    body,
    devIndex,
  );
  if (result.status !== 200) {
    return {
      ok: false,
      faces: [],
      total: 0,
      numMatches: 0,
      nextPosition: opts.position,
      hasMore: false,
      error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}`,
    };
  }

  const data = result.data as Record<string, unknown> | undefined;

  // VERIFY: totalMatches/numOfMatches üst seviyede mi yoksa wrap içinde mi?
  const totalMatches = (data?.totalMatches as number | undefined) ?? 0;
  const numOfMatches = (data?.numOfMatches as number | undefined) ?? 0;
  const maxResults = opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE;
  const responseStatusStrg = data?.responseStatusStrg as string | undefined;
  const hasMore = responseStatusStrg === "MORE" || numOfMatches >= maxResults;

  // MatchList array'i
  const rawList = data?.MatchList;
  const faces: FaceRecord[] = [];

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      faces.push({
        FPID: row.FPID as string | undefined,
        employeeNo: row.employeeNo as string | undefined,
        faceURL: row.faceURL as string | undefined,
      });
    }
  }

  return {
    ok: true,
    faces,
    total: totalMatches,
    numMatches: numOfMatches,
    nextPosition: opts.position + numOfMatches,
    hasMore,
  };
}

export interface FingerprintRecord {
  employeeNo: string;
  fingerPrintID?: string;
}

export interface SearchFingerprintsResult {
  ok: boolean;
  fingerprints: FingerprintRecord[];
  total: number;
  numMatches: number;
  nextPosition: number;
  /** Devam eden sayfa var mı? responseStatusStrg==="MORE" veya tam-dolu sayfa. */
  hasMore: boolean;
  error?: string;
}

/**
 * Cihazdaki parmak izi kayıtlarını sayfalı olarak sorgular.
 * POST /ISAPI/AccessControl/FingerPrintUpload (isim yanıltıcı — bu ARAMA endpoint'idir)
 *
 * VERIFY: body shape ve response wrap key canlı cihazda doğrula.
 */
export async function searchFingerprintsOnDevice(
  devIndex: string,
  opts: {
    searchID: string;
    position: number;
    maxResults?: number;
    employeeNo?: string;
  },
): Promise<SearchFingerprintsResult> {
  const body = {
    FingerPrintCond: {
      searchID: opts.searchID,
      searchResultPosition: opts.position,
      maxResults: opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE,
      ...(opts.employeeNo ? { EmployeeNoList: [{ employeeNo: opts.employeeNo }] } : {}),
    },
  };
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/FingerPrintUpload",
    "POST",
    body,
    devIndex,
  );
  if (result.status !== 200) {
    return {
      ok: false,
      fingerprints: [],
      total: 0,
      numMatches: 0,
      nextPosition: opts.position,
      hasMore: false,
      error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}`,
    };
  }

  const data = result.data as Record<string, unknown> | undefined;
  // VERIFY: wrap key (FingerPrintList? FingerPrint?)
  const wrap = (data?.FingerPrintList ?? data?.FingerPrint ?? data) as
    | Record<string, unknown>
    | undefined;

  const totalMatches = (wrap?.totalMatches as number | undefined) ?? 0;
  const numOfMatches = (wrap?.numOfMatches as number | undefined) ?? 0;
  const maxResults = opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE;
  const responseStatusStrg = wrap?.responseStatusStrg as string | undefined;
  const hasMore = responseStatusStrg === "MORE" || numOfMatches >= maxResults;

  const rawList = wrap?.FingerPrintInfo ?? wrap?.InfoList;
  const fingerprints: FingerprintRecord[] = [];

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      const employeeNo = row.employeeNo as string | undefined;
      if (!employeeNo) continue;
      fingerprints.push({
        employeeNo,
        fingerPrintID: row.fingerPrintID as string | undefined,
      });
    }
  }

  return {
    ok: true,
    fingerprints,
    total: totalMatches,
    numMatches: numOfMatches,
    nextPosition: opts.position + numOfMatches,
    hasMore,
  };
}

