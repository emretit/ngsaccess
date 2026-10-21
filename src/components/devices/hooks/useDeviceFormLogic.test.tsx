import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ServerDevice } from "@/types/device";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FormValues } from "./useDeviceFormSchema";
import { useDeviceFormLogic } from "./useDeviceFormLogic";
const mocks = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0,
  inputValues: undefined as FormValues | undefined,
  draft: undefined as FormValues | undefined,
  dirty: false,
  saved: undefined as (() => void) | undefined,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = typeof initial === "function" ? initial() : initial;
    return [mocks.states[index], (value: unknown) => { mocks.states[index] = value; }];
  },
}));
vi.mock("react-hook-form", () => ({
  useForm: ({ values }: { values: FormValues }) => {
    // RHF's reactive values contract: changed values replace dirty inputs.
    if (mocks.inputValues !== values) {
      mocks.inputValues = values;
      mocks.draft = { ...values };
      mocks.dirty = false;
    }
    return {
      watch: () => mocks.draft?.zone_id,
      getValues: () => mocks.draft,
      reset: (next: FormValues) => { mocks.draft = next; mocks.dirty = false; },
      formState: { isDirty: mocks.dirty },
    };
  },
}));
vi.mock("@/hooks/useAuthState", () => ({ useAuthState: () => ({ user: null }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("@/hooks/useZonesAndDoors", () => ({ useZonesAndDoors: () => ({ zones: [], doors: [], loading: false }) }));
vi.mock("./useDeviceFormSubmission", () => ({
  useDeviceFormSubmission: ({ onSuccess }: { onSuccess: () => void }) => {
    mocks.saved = onSuccess;
    return { onSubmit: vi.fn(), isLoading: false, connectionError: null };
  },
}));
function render(device: ServerDevice, open = true) {
  // React immediately retries a component when its render updates local state.
  for (let pass = 0; pass < 2; pass++) {
    mocks.cursor = 0;
    function Harness() { useDeviceFormLogic({ device, open, onSuccess: vi.fn() }); return null; }
    renderToStaticMarkup(<Harness />);
  }
}
const device: ServerDevice = { _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision", deviceIp: "192.168.1.1" };
beforeEach(() => { mocks.states = []; mocks.inputValues = undefined; mocks.draft = undefined; mocks.dirty = false; });
it("kirli formda heartbeat ile cihaz prop'u değişince IP ve diğer girdileri korur", () => {
  render(device);
  if (!mocks.draft) throw new Error("Form yüklenmedi");
  mocks.draft.device_ip = "192.168.1.99";
  mocks.draft.name = "Kaydedilmemiş ad";
  mocks.dirty = true;
  render({ ...device, deviceIp: "192.168.1.2", hikModel: "DS-K1T807" });
  expect(mocks.draft.device_ip).toBe("192.168.1.99");
  expect(mocks.draft.name).toBe("Kaydedilmemiş ad");
  expect(mocks.dirty).toBe(true);
});
it("cihaz değişince ve yeniden açılınca sunucu değerlerini yükler", () => {
  render(device);
  render({ ...device, _id: "other" as Id<"devices">, name: "Diğer" });
  expect(mocks.draft?.name).toBe("Diğer");
  render(device, false);
  render({ ...device, name: "Yenilenen" });
  expect(mocks.draft?.name).toBe("Yenilenen");
});
it("kayıt sonrası dirty durumunu temizler ve canlı güncelleme kayıtlı girdiyi ezmez", () => {
  render(device);
  if (!mocks.draft) throw new Error("Form yüklenmedi");
  mocks.draft.name = "Kaydedilen";
  mocks.dirty = true;
  mocks.saved?.();
  expect(mocks.dirty).toBe(false);
  render({ ...device, hikModel: "DS-K1T807" });
  expect(mocks.draft.name).toBe("Kaydedilen");
});
