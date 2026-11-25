import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const capture = vi.hoisted(() => vi.fn());
vi.mock("./hikGateway", () => ({ captureFaceOnDevice: capture }));
import { runCaptureFaceFromDevice } from "./gatewayCommand";

describe("face capture always requires biometrics.manage", () => {
  it.each([false, true])("denies a project member before device access (employeeId=%s)", async withEmployee => {
    const runQuery = vi.fn(async (reference: Parameters<ActionCtx["runQuery"]>[0]) => {
      switch (getFunctionName(reference)) {
        case "users:listProjectIdsForCurrentUser": return ["project-a"];
        case "devices:getByIdInternal": return { projectId: "project-a", hikTransport: "gateway", hikDevIndex: "device-index" };
        case "devices:getEmployeeByIdInternal": return { projectId: "project-a", cardNumber: "123" };
        case "roles:checkPermission": return false;
        default: throw new Error("Unexpected query after permission denial");
      }
    });
    const ctx = { user: { _id: "user-a", role: "project_admin" }, runQuery } as unknown as ActionCtx & { user: Doc<"users"> };
    await expect(runCaptureFaceFromDevice(ctx, {
      deviceId: "device-a" as Id<"devices">,
      ...(withEmployee ? { employeeId: "employee-a" as Id<"employees"> } : {}),
    })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(runQuery).toHaveBeenLastCalledWith(expect.anything(), { userId: "user-a", projectId: "project-a", permission: "biometrics.manage" });
    expect(capture).not.toHaveBeenCalled();
  });
});
