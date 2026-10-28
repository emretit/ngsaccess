import { beforeEach, expect, it, vi } from "vitest";
import { readImportCardsPage } from "./gateway/cards";
import { searchPersonOnDevice } from "./gateway/persons";
const call = vi.hoisted(() => vi.fn());
vi.mock("./gateway/core", async original => ({ ...await original<typeof import("./gateway/core")>(), gatewayApiCall: call }));
beforeEach(() => vi.resetAllMocks());
it("reads ANKA UserInfoSearch with a 30-person page", async () => {
  call.mockResolvedValue({ status: 200, data: { UserInfoSearch: { responseStatusStrg: "OK", numOfMatches: 4, totalMatches: 4, UserInfo: [{ employeeNo: "1", name: "Okan ISMAN", userType: "normal" }, { employeeNo: "2", name: "Cinar ZONGUR" }, { employeeNo: "3", name: "Bengu AYDIN" }, { employeeNo: "4", name: "Mustafa Bingeloglu" }] } } });
  expect(await searchPersonOnDevice("ANKA001", { searchID: "people", searchResultPosition: 0, maxResults: 30 })).toMatchObject({ total: 4, nextPosition: 4, persons: [{ employeeNo: "1", name: "Okan ISMAN" }, { employeeNo: "2" }, { employeeNo: "3" }, { employeeNo: "4" }] });
  expect(call.mock.calls[0][2]).toEqual({ UserInfoSearchCond: { searchID: "people", searchResultPosition: 0, maxResults: 30 } });
});
it("accepts ANKA's empty CardInfoSearch NO MATCH response", async () => {
  call.mockResolvedValue({ status: 200, data: { CardInfoSearch: { numOfMatches: 0, responseStatusStrg: "NO MATCH", totalMatches: 0 } } });
  expect(await readImportCardsPage("ANKA001", 0, "cards")).toEqual({ ok: true, cards: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false });
});
it("advances card positions from the firmware match count", async () => {
  call.mockResolvedValue({ status: 200, data: { CardInfoSearch: { numOfMatches: 30, totalMatches: 31, responseStatusStrg: "MORE", CardInfo: [{ employeeNo: "1", cardNo: "1" }] } } });
  expect(await readImportCardsPage("ANKA001", 0, "cards")).toMatchObject({ cards: [{ employeeNo: "1", cardNo: "1" }], total: 31, nextPosition: 30, hasMore: true });
});
