import { expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { deleteEmployeeCardOnlyInternal } from "./hikvisionSync";
const wire = vi.hoisted(() => ({ removeCard: vi.fn(), removePerson: vi.fn() }));
vi.mock("../lib/hikGateway", async original => ({ ...await original<typeof import("../lib/hikGateway")>(), deleteCardFromDevice: wire.removeCard, deletePersonFromDevice: wire.removePerson }));
it("never removes a physical card since reassigned to another person", async () => {
  const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "hikvisionSync:physicalCardReassigned" ? true : { cardNumber: "789", hikEmployeeNo: "7" });
  const handler = deleteEmployeeCardOnlyInternal as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<void> };
  await handler._handler({ runQuery }, { employeeId: "employee", cardNumber: "456", snapshot: { cardNumber: "789", employeeNo: "7", devices: [{ _id: "device", hikTransport: "gateway", hikDevIndex: "index" }] } });
  expect(wire.removeCard).not.toHaveBeenCalled();
  expect(wire.removePerson).not.toHaveBeenCalled();
});
