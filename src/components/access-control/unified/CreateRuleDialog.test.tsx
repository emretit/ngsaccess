import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ name: "Kural", employees: ["e"], devices: ["a", "b"], step: 0, error: "", index: 0, submit: vi.fn(), buttons: new Map<string, () => void>() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: () => {
    const index = state.index++;
    return [index === 0 ? state.step : state.error, (value: number | string) => { if (index === 0 && typeof value === "number") state.step = value; else if (typeof value === "string") state.error = value; }];
  },
}));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick, ...props }: ComponentProps<"button">) => {
  if (onClick) state.buttons.set(String(children), () => onClick({} as Parameters<NonNullable<typeof onClick>>[0]));
  return <button {...props}>{children}</button>;
} }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("@/hooks/useZonesAndDoors", () => ({ useZonesAndDoors: () => ({ doors: [{ _id: "d", deviceId: "a" }, { _id: "d2", deviceId: "b" }], loading: false }) }));
vi.mock("./hooks/useRuleForm", () => ({ useRuleForm: () => ({
  formData: { name: state.name, target_type: "individual", selected_employees: state.employees, selected_devices: state.devices, selected_doors: ["d"], days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], start_time: "", end_time: "" },
  setFormData: vi.fn(), handleSubmit: state.submit, isSubmitting: false, errors: {}, isDirty: false, projectId: "p",
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
const render = () => {
  state.index = 0;
  state.buttons.clear();
  return renderToStaticMarkup(<CreateRuleDialog open onOpenChange={() => undefined} onClose={() => undefined} />);
};
beforeEach(() => {
  state.name = "Kural"; state.employees = ["e"]; state.devices = ["a", "b"]; state.step = 0; state.error = ""; state.submit.mockReset();
  vi.stubGlobal("document", { getElementById: () => ({ focus: vi.fn() }) });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
});
it("özel saat özetini kişi, kapı ve gün sırasıyla sade gösterir", () => {
  const html = render();
  expect(html).toContain("1 kişi · 2 kapı · Pzt–Cum tüm gün");
  expect(html).not.toMatch(/panel|açık kapı seçimi/i);
});

it("iki adım ve kısa gönderim açıklaması sunar", () => {
  const html = render();
  expect(html).toContain("1. Kimler");
  expect(html).toContain("2. Nerede / Ne zaman");
  expect(html).toContain("Kaydedince cihazlara gönderilir.");
  expect(html).not.toContain("Temel");
});

it("ad ve kişi doğrulaması ilk adımda kalır, geçerli seçim ikinci adıma ilerler", () => {
  state.name = " ";
  render(); state.buttons.get("İleri")?.();
  expect(state.step).toBe(0);
  expect(state.error).toBe("Lütfen kural adı girin.");
  state.name = "Kural"; state.employees = [];
  render(); state.buttons.get("İleri")?.();
  expect(state.step).toBe(0);
  expect(state.error).toBe("En az bir kişi seçin.");
  state.employees = ["e"];
  render(); state.buttons.get("İleri")?.();
  expect(state.step).toBe(1);
  expect(render()).toContain("Kuralı kaydet");
  expect(state.submit).not.toHaveBeenCalled();
});
it("kapısız cihazın tüm kapsamını sıfır kapı diye göstermez", () => {
  state.devices = ["c"];
  const html = render();
  expect(html).toContain("1 cihazın tümü");
  expect(html).not.toContain("0 kapı");
});
