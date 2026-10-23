import { expect, it, vi } from "vitest";
import { searchAcsEventsOnDevice } from "./events";
vi.mock("./core", () => ({ DEFAULT_SEARCH_PAGE_SIZE: 30, gatewayApiCall: vi.fn(async () => ({ status: 200, data: { AcsEvent: { totalMatches: 2, numOfMatches: 2, InfoList: [{ time: "2026-10-23T17:00:00+03:00", cardNo: "TEST", major: 5, minor: 1, serialNo: 10, cardReaderNo: 2 }, { time: "2026-10-23T17:01:00+03:00", cardNo: "TEST", major: 5, minor: 1, serialNo: 11, cardReaderNo: "1" }] } } })) }));
it("daily gateway event page retains reader number for backfill mutation", async () => {
  const result = await searchAcsEventsOnDevice("test", { searchID: "test", position: 0 });
  expect(result.events[0]).toMatchObject({ serialNo: 10, cardReaderNo: 2 });
  expect(result.events[1]).toMatchObject({ serialNo: 11, cardReaderNo: 1 });
});
