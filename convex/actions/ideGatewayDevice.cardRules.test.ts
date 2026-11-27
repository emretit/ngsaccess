import { getFunctionName } from "convex/server";
import { expect, it, vi } from "vitest";
import { syncEmployeeToIdePanels } from "./ideGatewayDevice";

it.each(["", " \t "])("silently skips cardless people without persisting an IDE operation or failure: %j", async cardNumber => {
  const runQuery = vi.fn(async () => ({ employee: { cardNumber }, deviceRules: [
    { device: { _id: "panel", projectId: "project", brand: "ide_smart" } },
  ] }));
  const runMutation = vi.fn();
  const callable = syncEmployeeToIdePanels as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> };
  expect(await callable._handler({ runQuery, runMutation }, { employeeId: "employee" })).toEqual({ ok: true, queued: 0, skipped: [], opIds: [] });
  expect(runMutation).not.toHaveBeenCalled();
});

it.each(["AYSE-001", "1e3", "9007199254740992"])("persists IDE card rejection for the banner without queuing a device command: %s", async cardNumber => {
  const runQuery = vi.fn(async () => ({ employee: { cardNumber }, deviceRules: [
    { device: { _id: "panel", projectId: "project", brand: "ide_smart" } },
    { device: { _id: "panel", projectId: "project", brand: "ide_smart" } },
  ] }));
  const runMutation = vi.fn();
  const callable = syncEmployeeToIdePanels as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<{ ok: boolean; error?: string }> };
  const result = await callable._handler({ runQuery, runMutation }, { employeeId: "employee" });
  expect(result.ok).toBe(false);
  expect(runMutation).toHaveBeenCalledTimes(1);
  expect(getFunctionName(runMutation.mock.calls[0][0])).toBe("ideSync:recordEmployeeCardFailures");
  expect(runMutation.mock.calls[0][1]).toMatchObject({ deviceIds: ["panel"], employeeId: "employee", lastError: result.error });
  expect(result.error).not.toContain(cardNumber);
});

it.each([{ isActive: false }, { isActive: true, accessExpiresAt: "2020-01-01T00:00:00Z" }])("D5b: revokes legacy IDE placeholders on lifecycle sync: %j", async lifecycle => {
  const runQuery = vi.fn(async () => ({ employee: { cardNumber: "123", hikCardless: true, projectId: "project", ...lifecycle }, deviceRules: [
    { device: { _id: "panel", brand: "ide_smart" } }, { device: { _id: "panel", brand: "ide_smart" } }, { device: { _id: "outside", brand: "ide_smart" } },
  ] }));
  const runMutation = vi.fn(async (_ref: Parameters<typeof getFunctionName>[0], _args: unknown) => true);
  const callable = syncEmployeeToIdePanels as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> };
  expect(await callable._handler({ runQuery, runMutation }, { employeeId: "employee", targetDeviceIds: ["panel"] })).toMatchObject({ ok: true, queued: 1 });
  expect(runMutation).toHaveBeenCalledTimes(1);
  expect(getFunctionName(runMutation.mock.calls[0][0])).toBe("accessRules:enqueueIdeUserRemoval");
  expect(runMutation.mock.calls[0][1]).toMatchObject({ employeeId: "employee", cardNumber: "123", deviceId: "panel", projectId: "project" });
});
