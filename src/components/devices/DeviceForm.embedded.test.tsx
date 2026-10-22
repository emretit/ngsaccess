import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { buildDeviceFormValues } from "./hooks/buildDeviceFormValues";
import { DeviceForm } from "./DeviceForm";
const mocks = vi.hoisted(() => ({ dirty: false, pending: false, reset: vi.fn(), focus: vi.fn(), undo: undefined as undefined | (() => void), error: null as string | null }));
const baseline = buildDeviceFormValues({ name: "İlk ad", deviceSerial: "serial" });
vi.mock("./hooks/useDeviceFormLogic", () => ({
  useDeviceFormLogic: () => {
    const form = useForm({ defaultValues: baseline });
    return {
      form: { ...form, formState: { ...form.formState, errors: {}, defaultValues: baseline, isDirty: mocks.dirty }, reset: mocks.reset, setFocus: mocks.focus },
      zones: [], doors: [], locationLoading: false, selectedZoneId: undefined,
      currentProjectId: "p", onSubmit: vi.fn(), isLoading: mocks.pending, connectionError: mocks.error,
    };
  },
}));
vi.mock("@/components/employees/FormActions", async original => {
  const Actual = (await original<typeof import("@/components/employees/FormActions")>()).default;
  return { default: (props: Parameters<typeof Actual>[0]) => { mocks.undo = props.onClose; return <Actual {...props} />; } };
});
vi.mock("./form-sections/DeviceBasicSection", () => ({ DeviceBasicSection: () => null, DeviceTypeField: () => null }));
vi.mock("./form-sections/DeviceLocationSection", () => ({ DeviceLocationSection: () => null }));
vi.mock("./form-sections/DeviceNetworkSection", () => ({ DeviceNetworkSection: () => null }));
vi.mock("./form-sections/DeviceStatusSection", () => ({ DeviceStatusSection: () => null }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: vi.fn(), dialog: null }) }));
const close = vi.fn();
function render(embedded = true, disabled = false) {
  return renderToStaticMarkup(<DeviceForm open embedded={embedded} disabled={disabled} projects={[]} device={embedded ? { _id: "d" as Id<"devices">, name: "Panel" } : null} onBack={vi.fn()} onSuccess={vi.fn()} onClose={close} />);
}
beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback()); vi.clearAllMocks(); mocks.dirty = false; mocks.pending = false; mocks.error = null; });
it("temiz gömülü form çubuksuzdur; kirli form Kişiler çubuğunu gösterir", () => {
  expect(render()).not.toContain("sticky bottom-0");
  mocks.dirty = true;
  const html = render();
  expect(html).toContain("Değişiklikleri geri al");
  expect(html).toContain("Kaydet");
  expect(html).not.toContain("Proje:");
});
it("geri al baseline'ı yükler ve drawer'ı kapatmadan ada odaklanır", () => {
  mocks.dirty = true;
  render();
  mocks.undo?.();
  expect(mocks.reset).toHaveBeenCalledExactlyOnceWith(baseline);
  expect(mocks.focus).toHaveBeenCalledExactlyOnceWith("name");
  expect(close).not.toHaveBeenCalled();
});
it("pending çubuğu görünür ve eylemleri kilitlidir; salt okunurda çubuk yoktur", () => {
  mocks.pending = true;
  expect(render()).toContain("Kaydediliyor");
  expect(render()).toContain('type="submit" disabled=""');
  expect(render(true, true)).not.toContain("sticky bottom-0");
});
it("yeni form temizken marka seç/Vazgeç/Kaydet çubuğunu ve bağlantı retry'sini korur", () => {
  const html = render(false);
  expect(html).toContain("Marka seç");
  expect(html).toContain("Vazgeç");
  expect(html).toContain("Kaydet");
  expect(html).toContain("Proje:");
  mocks.error = "Kısmi başarı";
  expect(render(false)).toContain("Bağlantıyı tekrar dene");
});
