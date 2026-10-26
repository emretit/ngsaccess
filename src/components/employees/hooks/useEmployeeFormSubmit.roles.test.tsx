import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEmployeeFormSubmit } from "./useEmployeeFormSubmit";
import { employeeFormValues } from "./useEmployeeFormData";
const state = vi.hoisted(() => ({ pay: false, sync: false, syncCalls: vi.fn(), calls: [] as { name: string; args: Record<string, unknown> }[] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (p: string) => p === "accessRules.manage" ? state.sync : p !== "pay.view" || state.pay }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (run: unknown) => ({ run, pending: false }) }));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => async (args: Record<string, unknown>) => { state.calls.push({ name: getFunctionName(ref), args }); return "employee"; },
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => async () => { if (getFunctionName(ref).includes("syncEmployee")) state.syncCalls(); return { success: true, synced: 0, failed: 0, errors: [] }; },
}));
beforeEach(() => { state.pay = false; state.sync = false; state.syncCalls.mockClear(); state.calls = []; });
it.each([false, true])("D-1: salary fields are absent from submitted payload when editing=%s without pay.view", async editing => {
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness() {
    current = useEmployeeFormSubmit(editing ? { _id: "employee" as Id<"employees"> } : null, () => {}, () => {});
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook result");
  const form = { ...employeeFormValues(), firstName: "Ada", lastName: "Test", email: "ada@example.com", cardNumber: "1234", hourlyRate: 123, monthlySalary: 45678 };
  await current.handleSubmit(form);
  expect(state.calls).toHaveLength(1);
  expect(state.calls[0].name).toBe(editing ? "employees:update" : "employees:create");
  expect(state.calls[0].args).not.toHaveProperty("hourlyRate");
  expect(state.calls[0].args).not.toHaveProperty("monthlySalary");
});

it.each([false, true])("submits Turkey midnight and null when clearing, editing=%s", async editing => {
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness() {
    current = useEmployeeFormSubmit(editing ? { _id: "employee" as Id<"employees"> } : null, () => {}, () => {});
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook");
  const form = { ...employeeFormValues(), firstName: "Ada", lastName: "Test", email: "ada@example.com", cardNumber: "1234", accessStartsAt: "2026-11-01" };
  await current.handleSubmit(form);
  expect(state.calls[0].args.accessStartsAt).toBe("2026-10-31T21:00:00.000Z");
  await current.handleSubmit({ ...form, accessStartsAt: "" });
  expect(state.calls[1].args.accessStartsAt).toBeNull();
});

it.each([false, true])("K-10: accessRules.manage=%s controls post-save sync", async allowed => {
  state.sync = allowed;
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness() { current = useEmployeeFormSubmit(null, () => {}, () => {}); return null; }
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook");
  await current.handleSubmit({ ...employeeFormValues(), firstName: "Ada", lastName: "Test", email: "ada@example.com", cardNumber: "1234" });
  expect(state.calls).toHaveLength(1);
  expect(state.syncCalls).toHaveBeenCalledTimes(allowed ? 1 : 0);
});
