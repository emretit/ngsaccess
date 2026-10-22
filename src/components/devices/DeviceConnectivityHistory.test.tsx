import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceConnectivityHistory, connectivityDuration, connectivityTime } from "./DeviceConnectivityHistory";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: mocks.query }));
type History = FunctionReturnType<typeof api.deviceEvents.getConnectivityHistory>;
const empty: History = { asOf: Date.parse("2026-10-22T12:00:00Z"), count: 0, totalMs: 0, longestMs: 0, periods: [], truncated: false, periodicHeartbeat: true };
const render = (history: History | undefined) => {
  mocks.query.mockReturnValue(history);
  return renderToStaticMarkup(<DeviceConnectivityHistory deviceId={"device" as Id<"devices">} />);
};
describe("connection history section", () => {
  it("does not show a client-side ongoing outage for card-event-only devices", () => {
    mocks.query.mockReturnValue({ ...empty, periodicHeartbeat: false });
    const html = renderToStaticMarkup(<DeviceConnectivityHistory deviceId={"device" as Id<"devices">} current={{ now: empty.asOf, since: empty.asOf - 3600000 }} />);
    expect(html).not.toContain("devam ediyor");
    expect(html).toContain("yalnız kart okutulunca sinyal gönderir");
  });
  it("shows the loading and empty states", () => {
    expect(render(undefined)).toContain("Bağlantı geçmişi yükleniyor");
    expect(render(empty)).toContain("Son 30 günde çevrimdışı dönem yok");
    expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), { deviceId: "device" });
  });
  it("shows completed periods, ongoing status, limits and Istanbul times", () => {
    const start = Date.parse("2026-10-22T09:00:00Z");
    const html = render({ asOf: start + 8100000, count: 2, totalMs: 8100000, longestMs: 8100000, periods: [{ offlineFrom: start, offlineTo: start + 8100000, durationMs: 8100000 }], ongoing: { since: start }, truncated: true, periodicHeartbeat: true });
    for (const text of ["Bağlantı geçmişi", "2 sa 15 dk", "22.10.2026 12:00:00", "22.10.2026 14:15:00", "devam ediyor", "son 500 dönem", "UTC+3"]) expect(html).toContain(text);
  });
  it("shows a newly expired signal using the existing device clock without another query", () => {
    const now = empty.asOf;
    mocks.query.mockReturnValue(empty);
    const html = renderToStaticMarkup(<DeviceConnectivityHistory deviceId={"device" as Id<"devices">} current={{ now, since: now - 360000 }} />);
    expect(html).toContain("devam ediyor");
    expect(html).toContain("6 dk");
    expect(html).not.toContain("Son 30 günde çevrimdışı dönem yok");
  });
  it("formats duration boundaries and UTC+3 across date rollover", () => {
    expect(connectivityDuration(0)).toBe("1 dk'dan az");
    expect(connectivityDuration(59999)).toBe("1 dk'dan az");
    expect(connectivityDuration(60000)).toBe("1 dk");
    expect(connectivityDuration(3600000)).toBe("1 sa");
    expect(connectivityDuration(8100000)).toBe("2 sa 15 dk");
    expect(connectivityTime(Date.parse("2026-10-21T22:00:00Z"))).toBe("22.10.2026 01:00:00");
  });
});
