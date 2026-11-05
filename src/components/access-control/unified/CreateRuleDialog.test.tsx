import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ employees: ["e"], devices: ["a", "b"] }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: ComponentProps<"button">) => <button {...props}>{children}</button> }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("@/hooks/useZonesAndDoors", () => ({ useZonesAndDoors: () => ({ doors: [{ _id: "d", deviceId: "a" }, { _id: "d2", deviceId: "b" }], loading: false }) }));
vi.mock("./hooks/useRuleForm", () => ({ useRuleForm: () => ({
  formData: { name: "Kural", target_type: "individual", selected_employees: state.employees, selected_devices: state.devices, selected_doors: ["d"], days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], start_time: "", end_time: "" },
  setFormData: vi.fn(), handleSubmit: vi.fn(), isSubmitting: false, errors: {}, isDirty: false, projectId: "p",
}) }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: vi.fn(), dialog: null }) }));
vi.mock("./components/RuleBasicInfo", () => ({ RuleBasicInfo: () => null }));
vi.mock("./components/DepartmentTree", () => ({ DepartmentTree: () => null }));
vi.mock("./components/ZoneDeviceTree", () => ({ ZoneDeviceTree: () => null }));
vi.mock("./components/TimeSchedule", () => ({ TimeSchedule: () => null }));
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Wrapper, DialogContent: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper, DialogFooter: Wrapper };
});
import CreateRuleDialog from "./CreateRuleDialog";
const render = () => renderToStaticMarkup(<CreateRuleDialog open onOpenChange={() => undefined} onClose={() => undefined} />);
beforeEach(() => {
  state.employees = ["e"]; state.devices = ["a", "b"];
});
it("özel saat özetini kişi, kapı ve gün sırasıyla sade gösterir", () => {
  const html = render();
  expect(html).toContain("1 kişi · 2 kapı · Pzt–Cum tüm gün");
  expect(html).not.toMatch(/panel|açık kapı seçimi/i);
});

it("kimler, nerede ve ne zaman tek dialogda; doğrudan kaydedilir", () => {
  const html = render();
  expect(html).toContain("Kimler erişebilir?");
  expect(html).toContain("Nerede ve ne zaman?");
  expect(html).toContain("Kuralı kaydet");
  expect(html).toContain("Kaydedince cihazlara gönderilir.");
  expect(html).not.toMatch(/İleri|Geri|1\. Kimler|Kural adımları/);
});
it("kapısız cihazın tüm kapsamını sıfır kapı diye göstermez", () => {
  state.devices = ["c"];
  const html = render();
  expect(html).toContain("1 cihazın tümü");
  expect(html).not.toContain("0 kapı");
});
