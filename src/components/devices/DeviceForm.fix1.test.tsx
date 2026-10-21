import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { buildDeviceFormValues } from "./hooks/buildDeviceFormValues";
import { DeviceForm } from "./DeviceForm";
vi.mock("./hooks/useDeviceFormLogic", () => ({
  useDeviceFormLogic: () => ({
    form: useForm({ defaultValues: buildDeviceFormValues(null, "other") }),
    zones: [], doors: [], locationLoading: false, selectedZoneId: undefined,
    currentProjectId: "p", onSubmit: vi.fn(), isLoading: false, connectionError: null,
  }),
}));
vi.mock("./form-sections/DeviceBasicSection", () => ({ DeviceBasicSection: () => null, DeviceTypeField: () => null }));
vi.mock("./form-sections/DeviceLocationSection", () => ({ DeviceLocationSection: () => null }));
vi.mock("./form-sections/DeviceNetworkSection", () => ({ DeviceNetworkSection: () => null }));
vi.mock("./form-sections/DeviceStatusSection", () => ({ DeviceStatusSection: () => null }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: vi.fn(), dialog: null }) }));
it("kaydetme çubuğunu görünür kaydırma alanının alt kenarında tutar", () => {
  const html = renderToStaticMarkup(<DeviceForm open projects={[]} device={{ _id: "d" as Id<"devices">, name: "Panel" }} onSuccess={vi.fn()} onClose={vi.fn()} />);
  expect(html).toContain("sticky bottom-0");
  expect(html).not.toContain("-bottom-5");
  expect(html).toContain("Güncelle");
  expect(html).toContain("İptal");
});
