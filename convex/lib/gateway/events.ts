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
  cardReaderNo?: number;
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

// Firmware'ler alan tiplerinde tutarsız (DS-K1T804AMF `cardType: 1` sayı döner);
// backfill mutation validator'ı katı olduğu için tipler burada normalize edilir.
function eventText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}
function eventNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : undefined;
}

/**
 * AcsEvent zaman sınırı: milisaniyesiz TR duvar saati (+03:00). DS-K1T804AMF `.987Z` gibi
 * milisaniyeli bitiş zamanını yakın tarihli başlangıçla `badParameters` ile reddediyor.
 */
export function hikSearchTime(value: string): string {
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return value;
  return `${new Date(Math.floor(at / 1000) * 1000 + 3 * 60 * 60 * 1000).toISOString().slice(0, 19)}+03:00`;
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
      ...(opts.startTime ? { startTime: hikSearchTime(opts.startTime) } : {}),
      ...(opts.endTime ? { endTime: hikSearchTime(opts.endTime) } : {}),
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
        time: eventText(row.time) ?? "",
        cardNo: eventText(row.cardNo) ?? "",
        cardType: eventText(row.cardType),
        name: eventText(row.name),
        employeeNoString: eventText(row.employeeNoString),
        major: eventNumber(row.major) ?? 0,
        minor: eventNumber(row.minor) ?? 0,
        doorNo: eventNumber(row.doorNo),
        cardReaderNo: eventNumber(row.cardReaderNo),
        currentVerifyMode: eventText(row.currentVerifyMode),
        serialNo,
        pictureURL: eventText(row.pictureURL),
        attendanceStatus: eventText(row.attendanceStatus),
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
