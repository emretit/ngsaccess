import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getFunctionName, type FunctionReference } from "convex/server";
import { useDeviceFormSubmission } from "./useDeviceFormSubmission";
import { buildDeviceFormValues } from "./buildDeviceFormValues";
import { makeFormSchema } from "./useDeviceFormSchema";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), register: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (reference: FunctionReference<"mutation">) => getFunctionName(reference) === "devices:update" ? mocks.update : mocks.create,
  useAction: () => mocks.register,
}));
vi.mock("@/hooks/useAsyncAction", () => ({
  useAsyncAction: (action: (...args: unknown[]) => Promise<unknown>) => ({ run: action, pending: false }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), info: vi.fn() } }));
import { notify } from "@/lib/notify";
let submission: ReturnType<typeof useDeviceFormSubmission>;
function render(edit = false) {
  function Harness() {
    submission = useDeviceFormSubmission({ device: edit ? { _id: "d" as Id<"devices"> } : null, currentProjectId: "p" as Id<"projects">, onSuccess: vi.fn() });
    return null;
  }
  renderToStaticMarkup(<Harness />);
}
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ deviceId: "new" }); mocks.register.mockResolvedValue({ ok: true }); });
it.each([
  ["DS-K1T807", "Erişim Terminali"],
  ["DS-K2804", "Kapı Kontrolörü"],
  ["__manual__", undefined],
] as const)("yeni Hikvision %s tipini modelden türetir, belirsiz tip göndermez", async (hik_model, expected) => {
  render();
  await submission.onSubmit({ ...buildDeviceFormValues(null, "hikvision"), name: "Panel", hik_model, hik_transport: "localBridge" });
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ deviceType: expected }));
});
it("eski özel Hikvision tipini gizli alanda doğrulama hatası olmadan korur", async () => {
  const values = buildDeviceFormValues({ brand: "hikvision", deviceType: "Eski özel terminal", name: "Panel", deviceSerial: "serial", hikTransport: "gateway", ehomeID: "id", ehomeKey: "key" });
  expect(makeFormSchema(false, true).safeParse(values).success).toBe(true);
  render(true);
  await submission.onSubmit(values);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ deviceType: "Eski özel terminal" }));
});
it("tipi olmayan eski Hikvision kaydı gizli alan nedeniyle reddedilmez", () => {
  const values = buildDeviceFormValues({ brand: "hikvision", name: "Panel", deviceSerial: "serial", hikTransport: "gateway", ehomeID: "id", ehomeKey: "key" });
  expect(makeFormSchema(false, true).safeParse(values).success).toBe(true);
});
it("değişiklik yoksa mutation ve gateway action çağrılmaz", async () => {
  render(true);
  await submission.onSubmit(buildDeviceFormValues({ _id: "d" as Id<"devices"> }));
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.register).not.toHaveBeenCalled();
  expect(notify.info).toHaveBeenCalledWith("Kaydedilecek değişiklik yok");
  expect(notify.success).not.toHaveBeenCalled();
});
it("değişiklik yokken gateway'e kaydedilmemiş cihaz için yalnız bağlantıyı yeniden dener", async () => {
  const device = { _id: "d" as Id<"devices">, brand: "hikvision" as const, hikTransport: "gateway" as const, name: "Panel", ehomeID: "id", ehomeKey: "key" };
  function Harness() {
    submission = useDeviceFormSubmission({ device, currentProjectId: "p" as Id<"projects">, onSuccess: vi.fn() });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  await submission.onSubmit(buildDeviceFormValues(device));
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.register).toHaveBeenCalledExactlyOnceWith({ deviceId: "d" });
  expect(notify.success).toHaveBeenCalledWith("Cihazın gateway bağlantısı hazırlandı");
});
it("açılış baseline'ına göre yalnız değişen ad gönderilir", async () => {
  function Harness() {
    const baseline = buildDeviceFormValues({ name: "Panel", devicePassword: "secret", deviceSerial: "serial" });
    submission = useDeviceFormSubmission({ device: { _id: "d" as Id<"devices"> }, currentProjectId: "p" as Id<"projects">, onSuccess: vi.fn(), getBaseline: () => baseline });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  await submission.onSubmit({ ...buildDeviceFormValues({ name: "Panel", devicePassword: "secret", deviceSerial: "serial" }), name: "Yeni ad" });
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ deviceId: "d", name: "Yeni ad" });
});
it("transport geçişinde payload filtresi gizli ehome alanlarını yazmaz", async () => {
  function Harness() {
    submission = useDeviceFormSubmission({ device: { _id: "d" as Id<"devices">, brand: "hikvision", hikTransport: "gateway", name: "Panel", ehomeID: "id", ehomeKey: "key", deviceUsername: "user", devicePassword: "secret" }, currentProjectId: "p" as Id<"projects">, onSuccess: vi.fn() });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  await submission.onSubmit({ ...buildDeviceFormValues({ brand: "hikvision", hikTransport: "gateway", name: "Panel", ehomeID: "id", ehomeKey: "key", deviceUsername: "user", devicePassword: "secret" }), hik_transport: "localBridge" });
  expect(mocks.update).toHaveBeenCalledWith({ deviceId: "d", hikTransport: "localBridge", hikPort: 8000, deviceUsername: "user", devicePassword: "secret" });
  expect(mocks.register).not.toHaveBeenCalled();
});
it("Hikvision kısmi kaydında tekrar deneme aynı kimliği kullanır", async () => {
  mocks.register.mockResolvedValueOnce({ ok: false, error: "Gateway kapalı" }).mockResolvedValueOnce({ ok: true });
  render();
  const values = { ...buildDeviceFormValues(null, "hikvision"), name: "Panel", hik_model: "DS-K1T807", hik_transport: "gateway" as const, ehome_id: "id", ehome_key: "key" };
  await expect(submission.onSubmit(values)).rejects.toThrow("Gateway kapalı");
  await submission.onSubmit(values);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.register).toHaveBeenNthCalledWith(1, { deviceId: "new" });
  expect(mocks.register).toHaveBeenNthCalledWith(2, { deviceId: "new" });
});
