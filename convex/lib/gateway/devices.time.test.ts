import { beforeEach, expect, it, vi } from "vitest";
import { gatewayApiCall, gatewayXmlCall } from "./core";
import { setDeviceTime, TURKEY_DEVICE_TIME_ZONE } from "./devices";

vi.mock("./core", async importOriginal => ({ ...(await importOriginal<typeof import("./core")>()), gatewayApiCall: vi.fn(), gatewayXmlCall: vi.fn() }));
const badParameters = { status: 400, data: { statusCode: 6, subStatusCode: "badParameters" }, raw: '{"statusCode":6,"subStatusCode":"badParameters"}' };
beforeEach(() => vi.mocked(gatewayXmlCall).mockReset());

it("defaults devices to Turkey time and stops after an accepted JSON update", async () => {
  vi.mocked(gatewayApiCall).mockResolvedValueOnce({ status: 200, data: { statusCode: 1, subStatusCode: "ok" }, raw: "{}" });
  expect(await setDeviceTime("dev")).toEqual({ ok: true });
  expect(vi.mocked(gatewayApiCall).mock.lastCall?.[2]).toMatchObject({ Time: { timeMode: "manual", timeZone: TURKEY_DEVICE_TIME_ZONE } });
  expect(gatewayXmlCall).not.toHaveBeenCalled();
});

it("retries the same time zone as XML when the firmware rejects JSON", async () => {
  vi.mocked(gatewayApiCall).mockResolvedValueOnce(badParameters);
  vi.mocked(gatewayXmlCall).mockResolvedValueOnce({ status: 200, raw: "<ResponseStatus><statusCode>1</statusCode><subStatusCode>ok</subStatusCode></ResponseStatus>" });
  expect(await setDeviceTime("dev")).toEqual({ ok: true });
  const [path, method, xml, devIndex] = vi.mocked(gatewayXmlCall).mock.calls[0];
  expect([path, method, devIndex]).toEqual(["/ISAPI/System/time", "PUT", "dev"]);
  expect(xml).toContain("<timeZone>CST-3:00:00</timeZone>");
  expect(xml).toMatch(/<localTime>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}<\/localTime>/);
});

it("reports failure when both JSON and XML are rejected", async () => {
  vi.mocked(gatewayApiCall).mockResolvedValueOnce(badParameters);
  vi.mocked(gatewayXmlCall).mockResolvedValueOnce({ status: 400, raw: "<ResponseStatus><statusCode>6</statusCode></ResponseStatus>" });
  expect(await setDeviceTime("dev")).toMatchObject({ ok: false });
});
