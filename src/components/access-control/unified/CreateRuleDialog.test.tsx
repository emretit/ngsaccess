import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("./hooks/useRuleForm", () => ({ useRuleForm: () => ({
  formData: { name: "Kural", target_type: "individual", selected_employees: ["e"], selected_devices: ["a", "b"], selected_doors: ["d"], days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], start_time: "", end_time: "" },
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
it("özel saat özetini kişi, kapı ve gün sırasıyla sade gösterir", () => {
  const html = render();
  expect(html).toContain("1 kişi · 1 kapı · Pzt–Cum tüm gün");
  expect(html).not.toMatch(/panel|açık kapı seçimi/i);
});
