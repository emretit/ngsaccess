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
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn() } }));
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
