import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ templateId: "", rows: [] as { _id: string; name: string }[], query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => { state.query(...args); return state.rows; } }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("./hooks/useRuleForm", () => ({ useRuleForm: () => ({
  formData: { name: "Kural", target_type: "individual", selected_employees: ["e"], selected_devices: ["a", "b"], selected_doors: ["d"], days: ["Monday"], start_time: "", end_time: "", scheduleMode: "template", scheduleTemplateId: state.templateId },
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
beforeEach(() => { state.templateId = ""; state.rows = []; state.query.mockClear(); });
const render = () => renderToStaticMarkup(<CreateRuleDialog open onOpenChange={() => undefined} onClose={() => undefined} />);
it("seçilmemiş şablonu uyarı tonuyla ve cihaz/kapı terimleriyle özetler", () => {
  const html = render();
  expect(html).toContain('<span class="text-warning">Zaman şablonu seçilmedi</span>');
  expect(html).toContain("1 kişi · 2 cihaz / 1 kapı ·");
  expect(html).not.toContain("Şablon kullanılıyor");
  expect(state.query).toHaveBeenCalledWith(expect.anything(), { projectId: "p", includeArchived: true });
});
it("seçili şablonun sorgudan gelen adını gösterir", () => {
  state.templateId = "t";
  state.rows = [{ _id: "t", name: "Hafta içi mesai" }];
  const html = render();
  expect(html).toContain("Hafta içi mesai");
  expect(html).not.toContain("Zaman şablonu seçilmedi");
});
