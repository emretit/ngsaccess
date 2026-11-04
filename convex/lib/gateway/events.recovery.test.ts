import { expect, it, vi } from "vitest";
import { searchAcsEventsOnDevice } from "./events";
import { gatewayApiCall } from "./core";
vi.mock("./core", () => ({ DEFAULT_SEARCH_PAGE_SIZE: 30, gatewayApiCall: vi.fn() }));

it("Y-01 converts textual serials, counts malformed rows and advances by the raw page count", async () => {
  const row = { serialNo: "12", time: "2026-11-03T12:00:00Z", major: "5", minor: "75" };
  const InfoList = [row, null, {}, { ...row, serialNo: "x" }, { ...row, time: "bad" }, { ...row, major: "bad" }, { ...row, serialNo: 13 }];
  vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { AcsEvent: { numOfMatches: InfoList.length, InfoList, responseStatusStrg: "MORE" } }, raw: "" });
  const result = await searchAcsEventsOnDevice("index", { searchID: "s", position: 30 });
  expect(result).toMatchObject({ ok: true, skipped: 5, numMatches: 7, nextPosition: 37, hasMore: true });
  expect(result.events.map(event => event.serialNo)).toEqual([12, 13]);
});

it("Y-01 still rejects a mismatched raw page count", async () => {
  vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { AcsEvent: { numOfMatches: 2, InfoList: [{}] } }, raw: "" });
  expect(await searchAcsEventsOnDevice("index", { searchID: "s", position: 30 })).toMatchObject({ ok: false, nextPosition: 30 });
});
