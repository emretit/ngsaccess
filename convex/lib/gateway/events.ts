"use node";

import { gatewayApiCall, DEFAULT_SEARCH_PAGE_SIZE } from "./core";
import { isapiRecord, validateIsapiResult } from "./isapiResult";

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
  /** Malformed rows skipped; pagination still uses the raw device row count. */
  skipped?: number;
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
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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

  const failure = (error: string): SearchAcsEventsResult => ({
    ok: false, events: [], total: 0, numMatches: 0,
    nextPosition: opts.position, hasMore: false, error,
  });
  const validated = validateIsapiResult(result, "AcsEvent");
  if (!validated.ok) return failure(validated.error);
  const acsEvent = isapiRecord(validated.data.AcsEvent);
  if (!acsEvent) return failure("Cihaz yanıtında olay sonucu bulunamadı");
  const numOfMatches = eventNumber(acsEvent.numOfMatches);
  const totalMatches = acsEvent.totalMatches === undefined ? 0 : eventNumber(acsEvent.totalMatches);
  const rawList = acsEvent.InfoList;
  if (numOfMatches === undefined || !Number.isSafeInteger(numOfMatches) || numOfMatches < 0 ||
      totalMatches === undefined || !Number.isSafeInteger(totalMatches) || totalMatches < 0 ||
      (rawList !== undefined && !Array.isArray(rawList)) ||
      (Array.isArray(rawList) ? rawList.length !== numOfMatches : numOfMatches !== 0)) {
    return failure("Cihazın olay sayfası eksik veya geçersiz");
  }
  const maxResults = opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE;
  const responseStatusStrg = acsEvent.responseStatusStrg;
  if (responseStatusStrg !== undefined && !["OK", "MORE", "NO MATCH"].includes(String(responseStatusStrg))) {
    return failure("Cihazın olay arama durumu geçersiz");
  }
  const hasMore = responseStatusStrg === "MORE" || numOfMatches >= maxResults;
  if (hasMore && numOfMatches === 0) return failure("Cihazın olay imleci ilerlemedi");

  const infoList: AcsEventRow[] = [];
  let skipped = 0;

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      const row = isapiRecord(item);
      if (!row) { skipped++; continue; }
      const serialNo = eventNumber(row.serialNo);
      const major = eventNumber(row.major);
      const minor = eventNumber(row.minor);
      if (typeof serialNo !== "number" || !Number.isSafeInteger(serialNo) || serialNo < 0 ||
          typeof row.time !== "string" || !Number.isFinite(Date.parse(row.time))) {
        skipped++;
        continue;
      }
      if (major === undefined || minor === undefined || !Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) {
        skipped++;
        continue;
      }
      infoList.push({
        time: eventText(row.time) ?? "",
        cardNo: eventText(row.cardNo) ?? "",
        cardType: eventText(row.cardType),
        name: eventText(row.name),
        employeeNoString: eventText(row.employeeNoString),
        major,
        minor,
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
    skipped,
    total: totalMatches,
    numMatches: numOfMatches,
    nextPosition: opts.position + numOfMatches,
    hasMore,
  };
}
