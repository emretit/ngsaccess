import { beforeEach, expect, it, vi } from "vitest";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEmployeeFormData, type EmployeeFormDraft } from "./useEmployeeFormData";

// Small hook runner: retain state between reactive query snapshots and flush effects.
const runner = vi.hoisted(() => ({ cursor: 0, states: [] as unknown[], effects: [] as (() => void)[] }));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = runner.cursor++;
    if (!(index in runner.states)) runner.states[index] = typeof initial === "function" ? initial() : initial;
    return [runner.states[index], (next: unknown) => {
      runner.states[index] = typeof next === "function" ? next(runner.states[index]) : next;
    }];
  },
  useEffect: (effect: () => void) => { runner.effects.push(effect); },
}));
vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p" }) }));
const employee: Employee = {
  _id: "e" as Id<"employees">, projectId: "p" as Id<"projects">,
  firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "001",
};
function Render(current: Employee, options: Parameters<typeof useEmployeeFormData>[1] = {}) {
  runner.cursor = 0;
  const result = useEmployeeFormData(current, options);
  const effects = runner.effects.splice(0);
  effects.forEach(effect => effect());
  return result;
}
beforeEach(() => { runner.cursor = 0; runner.states = []; runner.effects = []; });
it("temiz form paylaşılan alanın yeni içeriğini alır, aynı içerikli yeni nesne formu sıfırlamaz", () => {
  Render(employee);
  const changed = { ...employee, firstName: "Güncel" };
  Render(changed);
  const refreshed = Render(changed);
  expect(refreshed.formData.firstName).toBe("Güncel");
  expect(refreshed.remoteChanged).toBe(false);
  refreshed.setFormData({ ...refreshed.formData, firstName: "Taslak" });
  expect(Render({ ...changed }).formData.firstName).toBe("Taslak");
});
it("kirli taslağı korur; kullanıcı onayının çağırdığı reloadLatest güncel kaydı alır", () => {
  const initial = Render(employee);
  initial.setFormData({ ...initial.formData, firstName: "Taslak", accessRuleId: "rule" as Id<"accessRules"> });
  const changed = { ...employee, firstName: "Başka yönetici" };
  const dirty = Render(changed);
  expect(dirty.formData.firstName).toBe("Taslak");
  expect(dirty.remoteChanged).toBe(true);
  dirty.reloadLatest();
  const reloaded = Render(changed);
  expect(reloaded.formData.firstName).toBe("Başka yönetici");
  expect(reloaded.formData.accessRuleId).toBeNull();
  expect(reloaded.remoteChanged).toBe(false);
});
it("kendi kaydının reaktif güncellemesinde uyarı göstermez", () => {
  const initial = Render(employee);
  initial.setFormData({ ...initial.formData, firstName: "Kaydedilen" });
  const changed = { ...employee, firstName: "Kaydedilen" };
  expect(Render(changed, { saving: true }).remoteChanged).toBe(false);
  expect(Render(changed, { saved: true }).remoteChanged).toBe(false);
  const saved = Render(changed, { saved: true });
  expect(saved.formData.firstName).toBe("Kaydedilen");
  expect(JSON.stringify(saved.formData)).toBe(saved.initialData);
});
it("yerel form hatası sonrası yeniden kurulum drawer'daki taslağı korur", () => {
  const draft: { current: EmployeeFormDraft | undefined } = { current: undefined };
  const initial = Render(employee, { draft });
  initial.setFormData({ ...initial.formData, firstName: "Korunan taslak" });
  Render(employee, { draft });
  runner.states = [];
  const retried = Render(employee, { draft });
  expect(retried.formData.firstName).toBe("Korunan taslak");
  expect(retried.initialData).not.toBe(JSON.stringify(retried.formData));
});
