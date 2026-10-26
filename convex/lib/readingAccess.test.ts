import { beforeEach, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasReadingPermission, MONITORING_READING_PERMISSIONS, REPORT_READING_PERMISSIONS, resolveReadingScope } from "./readingAccess";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), granted: vi.fn(), projects: vi.fn() }));
vi.mock("./projectScope", () => ({ resolveProjectScope: mocks.scope }));
vi.mock("./permissions", () => ({
  PERMISSION_DENIED: "denied", isSuperAdmin: (user: { role: string }) => user.role === "super_admin",
  getUserPermissions: mocks.granted, getProjectIdsWithPermission: mocks.projects,
}));
const a = "a" as Id<"projects">;
const b = "b" as Id<"projects">;
const outside = "outside" as Id<"projects">;
const ctx = { user: { role: "project_user" } } as QueryCtx & { user: Doc<"users"> };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope.mockResolvedValue([a, b]);
  mocks.granted.mockResolvedValue(new Set());
  mocks.projects.mockImplementation(async (_ctx, _user, permission: string) => permission === "devices.manage" ? [b, outside] : [a]);
});
it("unselected scope unions permissions and intersects project membership", async () => {
  expect(await resolveReadingScope(ctx, undefined, MONITORING_READING_PERMISSIONS)).toEqual([a, b]);
  expect(await resolveReadingScope(ctx, undefined, REPORT_READING_PERMISSIONS)).toEqual([a]);
});
it("a membership failure precedes permission reads", async () => {
  mocks.scope.mockRejectedValue(new Error("foreign"));
  await expect(resolveReadingScope(ctx, outside, MONITORING_READING_PERMISSIONS)).rejects.toThrow("foreign");
  expect(mocks.granted).not.toHaveBeenCalled();
});
it("explicit scope rejects no grants and accepts either monitoring grant", async () => {
  await expect(resolveReadingScope(ctx, a, MONITORING_READING_PERMISSIONS)).rejects.toThrow("denied");
  mocks.scope.mockResolvedValue([a]);
  for (const permission of MONITORING_READING_PERMISSIONS) {
    mocks.granted.mockResolvedValue(new Set([permission]));
    expect(await resolveReadingScope(ctx, a, MONITORING_READING_PERMISSIONS)).toEqual([a]);
  }
});
it("super admin uses the resolved scope without requiring membership grants", async () => {
  expect(await resolveReadingScope({ ...ctx, user: { ...ctx.user, role: "super_admin" } }, undefined, REPORT_READING_PERMISSIONS)).toEqual([a, b]);
  expect(mocks.projects).not.toHaveBeenCalled();
  expect(mocks.granted).not.toHaveBeenCalled();
});
it("embedded reading access fails closed without any grant", async () => {
  expect(await hasReadingPermission(ctx, a, MONITORING_READING_PERMISSIONS)).toBe(false);
  mocks.granted.mockResolvedValue(new Set(["devices.manage"]));
  expect(await hasReadingPermission(ctx, a, MONITORING_READING_PERMISSIONS)).toBe(true);
});
