import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../_generated/server";
import { purgeFingerprintsOnDevices, removeFingerprintFromDevice } from "../../actions/hikFingerprint";
import { captureFingerprintLive, deleteFingerprintFromDevice } from "./biometrics";
const checked = vi.hoisted(() => vi.fn());
const xml = vi.hoisted(() => vi.fn());
vi.mock("./core", async original => ({ ...await original<typeof import("./core")>(), gatewayApiCallChecked: checked, gatewayXmlCall: xml }));
beforeEach(() => vi.resetAllMocks());
describe("cihaz parmak izi silme idempotansı", () => {
  it.each(["employeeNoNotExist", "employeeNotExist", "userNotExist", "deviceUserNotExist", "fingerPrintNotExist", "fingerprintNotExist", "fingerPrintNotFound"])("%s yok durumu başarıdır", async error => {
    checked.mockResolvedValue({ ok: false, error });
    expect(await deleteFingerprintFromDevice("dev", "OLD", 2)).toEqual({ ok: true });
    expect(checked).toHaveBeenCalledWith("/ISAPI/AccessControl/FingerPrint/Delete", "PUT", {
      FingerPrintDelete: { mode: "byEmployeeNo", EmployeeNoDetail: [{ employeeNo: "OLD", fingerPrintID: [2] }] },
    }, "dev");
  });
  it.each(["notSupport", "HTTP 404", "deviceOffline", "notFound"])("%s belirsiz yanıtı başarı sayılmaz", async error => {
    checked.mockResolvedValue({ ok: false, error });
    expect((await deleteFingerprintFromDevice("dev", "OLD", 2)).ok).toBe(false);
  });
});


it.each(["purge", "manual"])("%s yok yanıtından sonra metadata siler", async mode => {
  checked.mockResolvedValue({ ok: false, error: "employeeNoNotExist" });
  const runMutation = vi.fn(async () => null);
  const ctx = { runMutation, runQuery: vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === "users:requireCurrentUser") return { _id: "user-a", role: "project_admin" };
    if (name.endsWith(":getInternal")) return { employeeId: "employee-a", deviceId: "device-a", fingerNo: 2, deletionEmployeeNo: "OLD" };
    if (name.endsWith(":getPurgeDevice")) return "dev";
    return { employee: { cardNumber: "NEW" }, device: { hikDevIndex: "dev" } };
  }) } as unknown as ActionCtx;
  const fn = mode === "purge" ? purgeFingerprintsOnDevices : removeFingerprintFromDevice;
  const handler = (fn as unknown as { _handler: (ctx: ActionCtx, args: object) => Promise<null> })._handler;
  await expect(handler(ctx, mode === "purge" ? { snapshots: [{ enrollmentId: "row-a", deviceId: "device-a", fingerNo: 2, employeeNo: "OLD" }] } : { enrollmentId: "row-a" })).resolves.toBeNull();
  const calls = runMutation.mock.calls as unknown as [Parameters<typeof getFunctionName>[0], object][];
  expect(calls.some(([ref]) => getFunctionName(ref) === "fingerprintEnrollment:remove")).toBe(true);
});

describe("canlı parmak izi yakalama (XML)", () => {
  it("XML gövde gönderir ve fingerData'yı XML yanıttan okur", async () => {
    xml.mockResolvedValue({ status: 200, raw: "<CaptureFingerPrint><fingerData>QUJD</fingerData><fingerNo>3</fingerNo><fingerPrintQuality>70</fingerPrintQuality></CaptureFingerPrint>" });
    expect(await captureFingerprintLive("dev", { fingerPrintID: 3 })).toEqual({ ok: true, fingerData: "QUJD" });
    expect(xml).toHaveBeenCalledWith("/ISAPI/AccessControl/CaptureFingerPrint", "POST", expect.stringContaining("<fingerNo>3</fingerNo>"), "dev");
  });
  it("hata yanıtında gövdeyi değil yalnız durum kodunu döner", async () => {
    xml.mockResolvedValue({ status: 400, raw: "<ResponseStatus><subStatusCode>badParameters</subStatusCode><fingerData>SECRET</fingerData></ResponseStatus>" });
    const result = await captureFingerprintLive("dev");
    expect(result).toEqual({ ok: false, error: "HTTP 400: badParameters" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  it("fingerData yoksa başarısız sayılır", async () => {
    xml.mockResolvedValue({ status: 200, raw: "<CaptureFingerPrint><fingerNo>1</fingerNo></CaptureFingerPrint>" });
    expect((await captureFingerprintLive("dev")).ok).toBe(false);
  });
});
