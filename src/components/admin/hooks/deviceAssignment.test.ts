import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimDevice, reassignDevice } from "../../../../convex/devices";
import { claimAdminDeviceCore } from "../../../../convex/lib/devicePool";
import type { MutationCtx } from "../../../../convex/_generated/server";

vi.mock("../../../../convex/lib/auth", async importOriginal => ({
  ...await importOriginal<typeof import("../../../../convex/lib/auth")>(),
  getCurrentUser: vi.fn(async () => ({ _id: "user", role: "super_admin" })),
  getProjectIdsForUser: vi.fn(async () => ["project-a", "project-b"]),
}));
vi.mock("../../../../convex/lib/devicePool", () => ({
  claimAdminDeviceCore: vi.fn(async () => ({ deviceId: "device", zoneId: "zone", doorIds: [] })),
}));
function fixture(projectId: string | undefined) {
  const db = {
    get: vi.fn(async () => ({ _id: "admin-device", name: "Old name", assignedProjectId: projectId })),
    patch: vi.fn(), insert: vi.fn(), delete: vi.fn(),
  };
  return { db };
}
function invoke(fn: unknown, ctx: unknown, args: object) {
  return (fn as { _handler: (ctx: MutationCtx, args: object) => Promise<unknown> })._handler(ctx as MutationCtx, args);
}
beforeEach(() => vi.clearAllMocks());
describe("device assignment snapshot", () => {
  it.each([claimDevice, reassignDevice])("rejects a stale assigned project before writing", async fn => {
    const ctx = fixture("project-b");
    await expect(invoke(fn, ctx, { adminDeviceId: "admin-device", projectId: "project-a", name: "New name", expectedAssignedProjectId: "project-a" }))
      .rejects.toMatchObject({ data: { code: "DEVICE_ASSIGNMENT_CHANGED", message: "Cihazın ataması başka bir oturumda değişti. Listeyi yenileyip tekrar deneyin." } });
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.delete).not.toHaveBeenCalled();
    expect(claimAdminDeviceCore).not.toHaveBeenCalled();
  });
  it.each([claimDevice, reassignDevice])("rejects a stale unassigned snapshot before writing", async fn => {
    const ctx = fixture("project-b");
    await expect(invoke(fn, ctx, { adminDeviceId: "admin-device", projectId: "project-a", expectedAssignedProjectId: null }))
      .rejects.toMatchObject({ data: { code: "DEVICE_ASSIGNMENT_CHANGED" } });
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(claimAdminDeviceCore).not.toHaveBeenCalled();
  });
  it.each([undefined, null])("keeps legacy and matching unassigned claim behavior (expected=%s)", async expectedAssignedProjectId => {
    const ctx = fixture(undefined);
    await invoke(claimDevice, ctx, { adminDeviceId: "admin-device", projectId: "project-a", ...(expectedAssignedProjectId === undefined ? {} : { expectedAssignedProjectId }) });
    expect(claimAdminDeviceCore).toHaveBeenCalledOnce();
  });
  it.each([undefined, "project-a"])("allows matching and legacy name-only updates (expected=%s)", async expectedAssignedProjectId => {
    const ctx = fixture("project-a");
    await invoke(reassignDevice, ctx, { adminDeviceId: "admin-device", projectId: "project-a", name: "New name", ...(expectedAssignedProjectId === undefined ? {} : { expectedAssignedProjectId }) });
    expect(ctx.db.patch).toHaveBeenCalledExactlyOnceWith("admin-device", { name: "New name", updatedAt: expect.any(String) });
    expect(claimAdminDeviceCore).not.toHaveBeenCalled();
  });
});
