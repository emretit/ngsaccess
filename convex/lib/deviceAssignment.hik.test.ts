import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { claimDeviceCore, reassignDeviceCore } from "./deviceAssignment";

const calls = vi.hoisted(() => ({ claim: vi.fn(), purge: vi.fn() }));
vi.mock("./auth", () => ({ getProjectIdsForUser: async () => ["old", "new"], isProjectAllowed: () => true }));
vi.mock("./permissions", () => ({ requirePermission: async () => undefined }));
vi.mock("./devicePool", () => ({ claimAdminDeviceCore: calls.claim }));
vi.mock("./deviceHelpers", () => ({ purgeDeviceCascade: calls.purge, deleteGroupDoorsForDoor: vi.fn() }));

describe("Hik move rejects before the first write (not merely transaction rollback)", () => {
  it.each([claimDeviceCore, reassignDeviceCore])("guards %s", async core => {
    const patch = vi.fn();
    const insert = vi.fn();
    const remove = vi.fn();
    const runAfter = vi.fn();
    const ctx = { user: {}, db: { get: async () => ({ brand: "hikvision", assignedProjectId: "old", assignedDeviceId: "device" }), patch, insert, delete: remove }, scheduler: { runAfter } } as unknown as MutationCtx & { user: Doc<"users"> };
    await expect(core(ctx, { adminDeviceId: "admin" as Id<"adminDevices">, projectId: "new" as Id<"projects">, name: "Changed" })).rejects.toThrow(/HIK_DEVICE_MOVE_UNSUPPORTED/);
    for (const write of [patch, insert, remove, runAfter, calls.claim, calls.purge]) expect(write).not.toHaveBeenCalled();
  });
});
