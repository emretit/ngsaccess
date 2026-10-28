import { expect, it, vi } from "vitest";
import { hikSearchTime, searchAcsEventsOnDevice } from "./events";
import { gatewayApiCall } from "./core";
vi.mock("./core", () => ({ DEFAULT_SEARCH_PAGE_SIZE: 30, gatewayApiCall: vi.fn(async () => ({ status: 200, data: { AcsEvent: { totalMatches: 2, numOfMatches: 2, InfoList: [{ time: "2026-10-23T17:00:00+03:00", cardNo: "TEST", major: 5, minor: 1, serialNo: 10, cardReaderNo: 2 }, { time: "2026-10-23T17:01:00+03:00", cardNo: "TEST", major: 5, minor: 1, serialNo: 11, cardReaderNo: "1", cardType: 1, doorNo: "1", employeeNoString: 4, name: null }] } } })) }));
it("daily gateway event page retains reader number for backfill mutation", async () => {
  const result = await searchAcsEventsOnDevice("test", { searchID: "test", position: 0 });
  expect(result.events[0]).toMatchObject({ serialNo: 10, cardReaderNo: 2 });
  expect(result.events[1]).toMatchObject({ serialNo: 11, cardReaderNo: 1, cardType: "1", doorNo: 1, employeeNoString: "4" });
  expect(result.events[1].name).toBeUndefined();
});

it("sends AcsEvent time bounds as second-precision Turkey wall clock", async () => {
  expect(hikSearchTime("2026-10-28T19:23:11.987Z")).toBe("2026-10-28T22:23:11+03:00");
  expect(hikSearchTime("2026-10-27T00:00:00+03:00")).toBe("2026-10-27T00:00:00+03:00");
  await searchAcsEventsOnDevice("test", { searchID: "test", position: 0, startTime: "2000-01-01T00:00:00+03:00", endTime: "2026-10-28T19:23:11.987Z" });
  expect(vi.mocked(gatewayApiCall).mock.lastCall?.[2]).toMatchObject({ AcsEventCond: { startTime: "2000-01-01T00:00:00+03:00", endTime: "2026-10-28T22:23:11+03:00" } });
});
