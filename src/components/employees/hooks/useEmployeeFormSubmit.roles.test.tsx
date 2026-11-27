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
it("submits inclusive TR employee expiry and keeps visitor epochs outside the employee payload", async () => {
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness({ visitor = false }: { visitor?: boolean }) { current = useEmployeeFormSubmit(visitor ? { _id: "employee" as Id<"employees">, isVisitor: true } : null, () => {}, () => {}); return null; }
  const form = { ...employeeFormValues(), firstName: "Ada", lastName: "Test", accessExpiresAt: "2026-12-01" };
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook");
  await current.handleSubmit(form);
  expect(state.calls[0].args.accessExpiresAt).toBe("2026-12-01T20:59:59.999Z");
  renderToStaticMarkup(<Harness visitor />);
  await current.handleSubmit(form);
  expect(state.calls[1].args).not.toHaveProperty("accessExpiresAt");
  expect(state.calls[1].args).not.toHaveProperty("accessStartsAt");
});
it("rejects clearing an existing card before any mutation is sent", async () => {
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness() { current = useEmployeeFormSubmit({ _id: "employee" as Id<"employees">, cardNumber: "00123" }, () => {}, () => {}); return null; }
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook");
  await current.handleSubmit({ ...employeeFormValues(), firstName: "Ada", lastName: "Test", email: "", cardNumber: "  " });
  expect(state.calls).toHaveLength(0);
  expect(state.syncCalls).not.toHaveBeenCalled();
});
it("saves a cardless person without invoking a device action, leaves device sync to the server after a card is supplied", async () => {
  state.sync = true;
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness() { current = useEmployeeFormSubmit(null, () => {}, () => {}); return null; }
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook");
  const form = { ...employeeFormValues(), firstName: "Ada", lastName: "Test", email: "", cardNumber: "  " };
  await current.handleSubmit(form);
  expect(state.calls[0]).toMatchObject({ name: "employees:create", args: { cardNumber: "" } });
  expect(state.syncCalls).not.toHaveBeenCalled();
  await current.handleSubmit({ ...form, cardNumber: "00123" });
  expect(state.calls[1].args.cardNumber).toBe("00123");
  expect(state.syncCalls).not.toHaveBeenCalled();
});
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

it.each([false, true])("F05: accessRules.manage=%s does not create a duplicate client sync", async allowed => {
  state.sync = allowed;
  let current: ReturnType<typeof useEmployeeFormSubmit> | undefined;
  function Harness() { current = useEmployeeFormSubmit(null, () => {}, () => {}); return null; }
  renderToStaticMarkup(<Harness />);
  if (!current) throw new Error("Missing hook");
  await current.handleSubmit({ ...employeeFormValues(), firstName: "Ada", lastName: "Test", email: "ada@example.com", cardNumber: "1234" });
  expect(state.calls).toHaveLength(1);
  expect(state.syncCalls).not.toHaveBeenCalled();
});
