import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../_generated/server";
import { purgeFingerprintsOnDevices, removeFingerprintFromDevice } from "../../actions/hikFingerprint";
import { addFingerprintToDevice, captureFingerprintLive, deleteFingerprintFromDevice, evaluateFingerprintProgress } from "./biometrics";
const checked = vi.hoisted(() => vi.fn());
const xml = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => vi.fn());
const poll = vi.hoisted(() => vi.fn());
vi.mock("./core", async original => ({ ...await original<typeof import("./core")>(), gatewayApiCallChecked: checked, gatewayXmlCall: xml, gatewayApiCall: api, pollApplyProgress: poll }));
beforeEach(() => vi.resetAllMocks());
describe("cihaz parmak izi silme idempotansı", () => {
  it.each(["employeeNoNotExist", "employeeNotExist", "userNotExist", "deviceUserNotExist", "fingerPrintNotExist", "fingerprintNotExist", "fingerPrintNotFound"])("%s yok durumu başarıdır", async error => {
    checked.mockResolvedValue({ ok: false, error });
    expect(await deleteFingerprintFromDevice("dev", "OLD", 2)).toEqual({ ok: true });
    expect(checked).toHaveBeenCalledWith("/ISAPI/AccessControl/FingerPrint/Delete", "PUT", {
      FingerPrintDelete: { mode: "byEmployeeNo", EmployeeNoDetail: { employeeNo: "OLD", fingerPrintID: [2] } },
    }, "dev");
  });
  it.each(["notSupport", "HTTP 404", "deviceOffline", "notFound"])("%s belirsiz yanıtı başarı sayılmaz", async error => {
    checked.mockResolvedValue({ ok: false, error });
    expect((await deleteFingerprintFromDevice("dev", "OLD", 2)).ok).toBe(false);
  });
  it("kabul edilen silmede DeleteProcess sonucunu bekler", async () => {
    vi.useFakeTimers();
    try {
      checked.mockResolvedValue({ ok: true, alreadyExists: false });
      poll.mockResolvedValue({ ok: false, error: "Apply başarısız (cihaz: failed)" });
      const pending = deleteFingerprintFromDevice("dev", "123");
      await vi.advanceTimersByTimeAsync(1_000);
      expect(await pending).toEqual({ ok: false, error: "Apply başarısız (cihaz: failed)" });
      expect(checked.mock.calls[0][2]).toEqual({ FingerPrintDelete: { mode: "byEmployeeNo", EmployeeNoDetail: { employeeNo: "123" } } });
      expect(poll).toHaveBeenCalledWith("dev", "/ISAPI/AccessControl/FingerPrint/DeleteProcess", expect.objectContaining({ wrapKey: "FingerPrintDeleteProcess", statusField: "status" }));
    } finally { vi.useRealTimers(); }
  });
});

describe("parmak izi yazma ilerlemesi (FingerPrintStatus)", () => {
  const progress = (totalStatus: number, ...codes: number[]) => ({ FingerPrintStatus: { StatusList: codes.map((cardReaderRecvStatus, i) => ({ id: i + 1, cardReaderRecvStatus })), totalStatus } });
  it("canlı DS-K1T807 yanıtı başarıdır", () => {
    expect(evaluateFingerprintProgress(progress(1, 1))).toEqual({ done: true, ok: true });
  });
  it("totalStatus 0 sürüyor sayılır", () => {
    expect(evaluateFingerprintProgress(progress(0, 0))).toEqual({ done: false, ok: false });
    expect(evaluateFingerprintProgress({ FingerPrintProgress: { status: "success" } }).done).toBe(false);
  });
  it("modülsüz okuyucu (8) hata değildir ama tek başına başarı da değildir", () => {
    expect(evaluateFingerprintProgress(progress(1, 1, 8)).ok).toBe(true);
    expect(evaluateFingerprintProgress(progress(1, 8)).ok).toBe(false);
    expect(evaluateFingerprintProgress(progress(1)).ok).toBe(false);
  });
  it.each([[3, "fpRecvStatus3"], [6, "fpRecvStatus6"], [9, "fpRecvStatus9"]])("okuyucu kodu %i hata döner", (code, prefix) => {
    const result = evaluateFingerprintProgress(progress(1, 1, code));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(new RegExp(`^${prefix}`));
  });
  it("addFingerprintToDevice totalStatus 1 olana kadar bekler", async () => {
    vi.useFakeTimers();
    try {
      checked.mockResolvedValue({ ok: true, alreadyExists: false });
      api.mockResolvedValueOnce({ status: 200, data: progress(0, 0), raw: "" }).mockResolvedValueOnce({ status: 200, data: progress(1, 1), raw: "" });
      const pending = addFingerprintToDevice("dev", { employeeNo: "123", fingerPrintID: 1, fingerData: "QUJD" });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(await pending).toEqual({ ok: true, error: undefined });
      expect(api).toHaveBeenCalledTimes(2);
      expect(api).toHaveBeenCalledWith("/ISAPI/AccessControl/FingerPrintProgress", "GET", null, "dev");
    } finally { vi.useRealTimers(); }
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

describe("ANKA fingerprint read fixtures", () => {
  it("returns numeric slot 6 metadata without exposing fingerData", async () => {
    const { searchFingerprintsOnDevice } = await import("./biometrics");
    api.mockResolvedValue({ status: 200, data: { FingerPrintInfo: { FingerPrintList: [{ cardReaderNo: 1, fingerData: "private-base64", fingerPrintID: 6, fingerType: "normalFP" }], searchID: "search", status: "OK" } } });
    const result = await searchFingerprintsOnDevice("ANKA001", { searchID: "search", position: 0, employeeNo: "1" });
    expect(result.fingerprints).toEqual([{ employeeNo: "1", fingerPrintID: "6" }]);
    expect(JSON.stringify(result)).not.toContain("private-base64");
  });
  it("reads cursor-based templates until NoFP, retaining one searchID", async () => {
    const { readFingerprintTemplates } = await import("./biometrics");
    api.mockResolvedValueOnce({ status: 200, data: { FingerPrintInfo: { status: "OK", FingerPrintList: [{ fingerPrintID: 6, fingerData: "a" }] } } })
      .mockResolvedValueOnce({ status: 200, data: { FingerPrintInfo: { status: "OK", FingerPrintList: [{ fingerPrintID: 7, fingerData: "b" }] } } })
      .mockResolvedValueOnce({ status: 200, data: { FingerPrintInfo: { status: "NoFP" } } });
    expect(await readFingerprintTemplates("ANKA001", "1")).toEqual([{ fingerPrintID: 6, fingerData: "a" }, { fingerPrintID: 7, fingerData: "b" }]);
    expect(api).toHaveBeenCalledTimes(3);
    const conditions = api.mock.calls.map(call => call[2].FingerPrintCond);
    expect(new Set(conditions.map(condition => condition.searchID)).size).toBe(1);
    expect(conditions[0]).toMatchObject({ employeeNo: "1", cardReaderNo: 1 });
  });
  it("stops repeated firmware pages and never returns raw failure bodies", async () => {
    const { readFingerprintTemplates } = await import("./biometrics");
    api.mockResolvedValue({ status: 200, data: { FingerPrintInfo: { status: "OK", FingerPrintList: [{ fingerPrintID: 6, fingerData: "a" }] } } });
    expect(await readFingerprintTemplates("ANKA001", "1")).toHaveLength(1);
    expect(api).toHaveBeenCalledTimes(2);
    api.mockResolvedValue({ status: 500, raw: "private-template" });
    await expect(readFingerprintTemplates("ANKA001", "1")).rejects.toThrow("HTTP 500");
  });
});
