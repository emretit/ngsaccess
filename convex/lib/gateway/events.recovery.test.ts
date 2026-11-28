import { expect, it, vi } from "vitest";
import { searchAcsEventsOnDevice } from "./events";
import { gatewayApiCall } from "./core";
import { CARD_FIELDS, parseCardReaderBody } from "../cardReaderParse";
vi.mock("./core", () => ({ DEFAULT_SEARCH_PAGE_SIZE: 30, gatewayApiCall: vi.fn() }));

it.each(CARD_FIELDS)("history retains the same %s identity as live parsing before the mutation", async field => {
  const identity = field === "employeeNo"
    ? { employeeNo: 7, employeeNoString: "0007" }
    : { [field]: field === "cardReaderNo" ? 1 : "0007" };
  const row = { time: "2026-11-28T10:00:00+03:00", major: 1, minor: 1030, serialNo: 9, ...identity };
  vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { AcsEvent: { numOfMatches: 1, InfoList: [row] } }, raw: "" });
  const result = await searchAcsEventsOnDevice("index", { searchID: "s", position: 0 });
  const live = parseCardReaderBody(JSON.stringify({ AccessControllerEvent: { ...identity, dateTime: row.time, majorEventType: 1, subEventType: 1030, serialNo: 9 } }), "application/json");
  expect(result.events[0]?.cardNo).toBe(live.user_id);
  expect(result.events[0]?.cardNo).toBe(field === "employeeNo" ? "7" : field === "cardReaderNo" ? "1" : "0007");
});

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
