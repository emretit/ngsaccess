import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { syncEmployeeDevices, syncEmployeeDoorRights } from "./hikSyncEmployee";
const wire = vi.hoisted(() => ({ person: vi.fn(), card: vi.fn(), remove: vi.fn(), plan: vi.fn() }));
vi.mock("./hikGateway", () => ({ upsertPersonToDevice: wire.person, addCardToDevice: wire.card, deletePersonFromDevice: wire.remove, setWeekPlanOnDevice: wire.plan, setPlanTemplate: wire.plan }));
const device = { _id: "device" as Id<"devices">, name: "ANKA", brand: "hikvision" as const, projectId: "project" as Id<"projects">, hikDevIndex: "ANKA001", hikTransport: "gateway" as const };
const rule = { _id: "rule", name: "Rule", hikWeekPlanNo: 2, isActive: true };
function fixture(cardNumber: string | undefined, hikCardless = false, identityless = false) {
  const employee = { _id: "employee", firstName: "Ada", lastName: "Test", projectId: device.projectId, hikEmployeeNo: identityless ? undefined : "123", cardNumber, hikCardless, isActive: true };
  const runQuery = vi.fn(async () => ({ employee, deviceRules: [{ device, rule }], previousDevices: [], ...employee }));
  const runMutation = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "hikvisionSync:beginGatewayGrants" ? [] : null);
  return { ctx: { runQuery, runMutation, scheduler: { runAfter: vi.fn() } } as unknown as ActionCtx, runMutation };
}
beforeEach(() => { vi.clearAllMocks(); wire.person.mockResolvedValue({ ok: true }); wire.card.mockResolvedValue({ ok: true }); wire.plan.mockResolvedValue({ ok: true }); });
it("writes an assigned physical card on the preserved imported employeeNo", async () => {
  const f = fixture("456");
  expect(await syncEmployeeDevices(f.ctx, { employeeId: "employee" as Id<"employees"> })).toMatchObject({ synced: 1, failed: 0 });
  expect(wire.person).toHaveBeenCalledWith("ANKA001", expect.objectContaining({ employeeNo: "123" }));
  expect(wire.card).toHaveBeenCalledWith("ANKA001", expect.objectContaining({ employeeNo: "123", cardNo: "456" }));
  expect(wire.remove).not.toHaveBeenCalled();
});
it("syncs a cardless imported identity without inventing a physical card", async () => {
  const f = fixture("", true);
  await syncEmployeeDevices(f.ctx, { employeeId: "employee" as Id<"employees"> });
  expect(wire.person).toHaveBeenCalledWith("ANKA001", expect.objectContaining({ employeeNo: "123" }));
  expect(wire.card).not.toHaveBeenCalled();
  expect(wire.remove).not.toHaveBeenCalled();
});
it("rights-only retries use the imported identity when delivering the assigned card", async () => {
  const f = fixture("456");
  expect(await syncEmployeeDoorRights(f.ctx, { employeeId: "employee" as Id<"employees">, cardNumber: "456", device })).toMatchObject({ ok: true });
  expect(wire.card).toHaveBeenCalledWith("ANKA001", { employeeNo: "123", cardNo: "456" });
});

it("skips a cardless person with no Hik identity before reserving or sending device work", async () => {
  const f = fixture(undefined, false, true);
  expect(await syncEmployeeDevices(f.ctx, { employeeId: "employee" as Id<"employees"> })).toEqual({ synced: 0, failed: 0, errors: [] });
  expect(f.runMutation).not.toHaveBeenCalled();
  expect(wire.person).not.toHaveBeenCalled();
  expect(wire.card).not.toHaveBeenCalled();
  expect(wire.remove).not.toHaveBeenCalled();
});
