"use node";

import { gatewayApiCall, DEFAULT_SEARCH_PAGE_SIZE } from "./core";

// ---------------------------------------------------------------------------
// AcsEvent — geçmiş erişim olayları (PR2: backfill)
// ---------------------------------------------------------------------------

/**
 * Cihazdan tek sayfa AcsEvent çeker.
 * searchPersonOnDevice desenini birebir izler.
 *
 * VERIFY: InfoList, serialNo, cardType, currentVerifyMode alanları canlı cihazda
 * doğrulanmalı — ISAPI spec ile uyumlu ama cihaz firmware farkı olabilir.
 */
export interface AcsEventRow {
  time: string;
  cardNo: string;
  cardType?: string;
  name?: string;
  employeeNoString?: string;
  major: number;
  minor: number;
  doorNo?: number;
  currentVerifyMode?: string;
  serialNo: number;
  pictureURL?: string;
  attendanceStatus?: string;
}

export interface SearchAcsEventsResult {
  ok: boolean;
  events: AcsEventRow[];
  /** Cihazdaki toplam kayıt sayısı (totalMatches) */
  total: number;
  /** Bu sayfada dönen kayıt sayısı (numOfMatches) */
  numMatches: number;
  /** Sonraki sayfa için kullanılacak searchResultPosition */
  nextPosition: number;
  /**
   * Devam eden sayfa var mı?
   * responseStatusStrg==="MORE" VEYA tam-dolu sayfa (numMatches >= maxResults).
   * Firmware totalMatches döndürmese bile güvenli döngü sonu için kullan.
   */
  hasMore: boolean;
  error?: string;
}

export async function searchAcsEventsOnDevice(
  devIndex: string,
  opts: {
    searchID: string;
    position: number;
    maxResults?: number;
    startTime?: string;
    endTime?: string;
    major?: number;
    minor?: number;
  },
): Promise<SearchAcsEventsResult> {
  const body = {
    AcsEventCond: {
      searchID: opts.searchID,
      searchResultPosition: opts.position,
      maxResults: opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE,
      ...(opts.startTime ? { startTime: opts.startTime } : {}),
      ...(opts.endTime ? { endTime: opts.endTime } : {}),
      ...(opts.major !== undefined ? { major: opts.major } : {}),
      ...(opts.minor !== undefined ? { minor: opts.minor } : {}),
    },
  };

  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/AcsEvent",
    "POST",
    body,
    devIndex,
  );

  if (result.status !== 200) {
    return {
      ok: false,
      events: [],
      total: 0,
      numMatches: 0,
      nextPosition: opts.position,
      hasMore: false,
      error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}`,
    };
  }

  const data = result.data as Record<string, unknown> | undefined;
  const acsEvent = data?.AcsEvent as Record<string, unknown> | undefined;

  const totalMatches = (acsEvent?.totalMatches as number | undefined) ?? 0;
  const numOfMatches = (acsEvent?.numOfMatches as number | undefined) ?? 0;
  const maxResults = opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE;
  const responseStatusStrg = acsEvent?.responseStatusStrg as string | undefined;
  const hasMore = responseStatusStrg === "MORE" || numOfMatches >= maxResults;

  // InfoList toleranslı oku — alan yoksa ya da boş array varsa boş dön
  const rawList = acsEvent?.InfoList;
  const infoList: AcsEventRow[] = [];

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      // serialNo zorunlu; yoksa bu satırı dedup'lanamayacağından skip et
      const serialNo = row.serialNo as number | undefined;
      if (typeof serialNo !== "number") continue;
      infoList.push({
        time: (row.time as string | undefined) ?? "",
        cardNo: (row.cardNo as string | undefined) ?? "",
        cardType: row.cardType as string | undefined,
        name: row.name as string | undefined,
        employeeNoString: row.employeeNoString as string | undefined,
        major: (row.major as number | undefined) ?? 0,
        minor: (row.minor as number | undefined) ?? 0,
        doorNo: row.doorNo as number | undefined,
        currentVerifyMode: row.currentVerifyMode as string | undefined,
        serialNo,
        pictureURL: row.pictureURL as string | undefined,
        attendanceStatus: row.attendanceStatus as string | undefined,
      });
    }
  }

  return {
    ok: true,
    events: infoList,
    total: totalMatches,
    numMatches: numOfMatches,
    nextPosition: opts.position + numOfMatches,
    hasMore,
  };
}
