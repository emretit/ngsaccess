import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gatewayApiCall } from "./core";
const digest = vi.hoisted(() => vi.fn());
vi.mock("../digestAuth", () => ({ digestFetch: digest }));
beforeEach(() => {
  vi.stubEnv("HIK_GATEWAY_HOST", "https://gateway.test"); vi.stubEnv("HIK_GATEWAY_USER", "user"); vi.stubEnv("HIK_GATEWAY_PASS", "password");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("fingerprint taşıma katmanı log gizliliği", () => {
  it.each(["/ISAPI/AccessControl/CaptureFingerPrint", "/ISAPI/AccessControl/FingerPrintDownload", "/ISAPI/AccessControl/FingerPrintProgress"])("%s hata/debug logunda gövde yazmaz", async path => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const privateValue = crypto.randomUUID();
    for (const debug of ["0", "1"]) {
      vi.stubEnv("HIK_GATEWAY_DEBUG", debug);
      for (const status of [200, 500]) {
        digest.mockResolvedValue({ status, body: JSON.stringify({ statusCode: status === 200 ? 1 : 4, fingerData: privateValue }) });
        await gatewayApiCall(path, "POST", { fingerData: privateValue }, "dev");
      }
    }
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.every(call => !JSON.stringify(call).includes(privateValue))).toBe(true);
    expect(spy.mock.calls.every(call => !JSON.stringify(call).includes("REQ:"))).toBe(true);
  });
  it("fingerprint dışındaki mevcut logları korur", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    digest.mockResolvedValue({ status: 500, body: "failure" });
    await gatewayApiCall("/ISAPI/Other", "POST", { sample: "test" }, "dev");
    expect(spy.mock.calls[0][0]).toContain("REQ:");
    expect(spy.mock.calls[0][0]).toContain("RES: failure");
  });
});
