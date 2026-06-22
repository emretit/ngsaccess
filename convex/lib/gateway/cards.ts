"use node";

import {
  gatewayApiCall,
  gatewayApiCallChecked,
  parseHikJsonStatus,
  getCountFromEndpoint,
  DEFAULT_SEARCH_PAGE_SIZE,
} from "./core";

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

export function getCardCount(devIndex: string) {
  return getCountFromEndpoint(devIndex, "/ISAPI/AccessControl/CardInfo/Count", "CardInfoCount");
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

// ---------------------------------------------------------------------------
// PR3: Reconcile + canlı okuma lib fonksiyonları
// ---------------------------------------------------------------------------

export interface SearchCardInfo {
  cardNo: string;
  employeeNo?: string;
  cardType?: string;
}

export interface SearchCardsResult {
  ok: boolean;
  cards: SearchCardInfo[];
  total: number;
  numMatches: number;
  nextPosition: number;
  /** Devam eden sayfa var mı? responseStatusStrg==="MORE" veya tam-dolu sayfa. */
  hasMore: boolean;
  error?: string;
}

/**
 * Cihazdaki kart listesini sayfalı olarak sorgular.
 * POST /ISAPI/AccessControl/CardInfo/Search
 *
 * VERIFY: yanıt wrap-key CardInfo (üst) + CardInfo/InfoList (liste); ikisi de toleranslı okunur.
 */
export async function searchCardsOnDevice(
  devIndex: string,
  opts: {
    searchID: string;
    position: number;
    maxResults?: number;
    employeeNo?: string;
  },
): Promise<SearchCardsResult> {
  const body = {
    CardInfoSearchCond: {
      searchID: opts.searchID,
      searchResultPosition: opts.position,
      maxResults: opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE,
      ...(opts.employeeNo
        ? { EmployeeNoList: [{ employeeNo: opts.employeeNo }] }
        : {}),
    },
  };
  const result = await gatewayApiCall(
    "/ISAPI/AccessControl/CardInfo/Search",
    "POST",
    body,
    devIndex,
  );
  if (result.status !== 200) {
    return {
      ok: false,
      cards: [],
      total: 0,
      numMatches: 0,
      nextPosition: opts.position,
      hasMore: false,
      error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}`,
    };
  }

  const data = result.data as Record<string, unknown> | undefined;
  // Wrap key: "CardInfo" (üst obje)
  const wrap = data?.CardInfo as Record<string, unknown> | undefined;

  const totalMatches = (wrap?.totalMatches as number | undefined) ?? 0;
  const numOfMatches = (wrap?.numOfMatches as number | undefined) ?? 0;
  const maxResults = opts.maxResults ?? DEFAULT_SEARCH_PAGE_SIZE;
  const responseStatusStrg = wrap?.responseStatusStrg as string | undefined;
  const hasMore = responseStatusStrg === "MORE" || numOfMatches >= maxResults;

  // Liste ya "CardInfo" ya da "InfoList" key'inde olabilir
  const rawList = wrap?.CardInfo ?? wrap?.InfoList;
  const cards: SearchCardInfo[] = [];

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      const cardNo = row.cardNo as string | undefined;
      if (!cardNo) continue;
      cards.push({
        cardNo,
        employeeNo: row.employeeNo as string | undefined,
        cardType: row.cardType as string | undefined,
      });
    }
  }

  return {
    ok: true,
    cards,
    total: totalMatches,
    numMatches: numOfMatches,
    nextPosition: opts.position + numOfMatches,
    hasMore,
  };
}

