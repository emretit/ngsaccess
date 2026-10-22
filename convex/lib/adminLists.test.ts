import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { adminDeviceRow, adminPaginationOptions, adminSearch, adminUserRow, boundedAdminCount, projectName } from "./adminLists";
import { projectDeletionBlockingTables, projectDeletionCleanupTables, projectDeletionError, projectDeletionBlockers, projectDeletionImpactRows } from "./adminGuards";
import { deviceConnection, DEVICE_ONLINE_WINDOW_MS } from "./deviceConnection";

const userId = "user1" as Id<"users">;

function errorData(run: () => unknown) {
  try { run(); } catch (error) {
    if (error instanceof ConvexError) return error.data;
    throw error;
  }
  throw new Error("Expected ConvexError");
}

describe("admin list contracts", () => {
  it("normalizes Turkish names, emails, spaces and missing fields", () => {
    expect(adminSearch("  ışık ", "IŞIK İNŞAAT")).toBe(true);
    expect(adminSearch("İSİM", undefined, "isim@example.com")).toBe(true);
    expect(adminSearch(" ", undefined)).toBe(true);
    expect(adminSearch("gizli", "Ayşe", undefined)).toBe(false);
  });
  it("limits scanning and rejects invalid page sizes without changing cursor", () => {
    expect(adminPaginationOptions({ numItems: 50, cursor: "opaque" })).toEqual({ numItems: 50, cursor: "opaque", maximumRowsRead: 500 });
    for (const numItems of [0, -1, 51, 1.5, Infinity]) {
      expect(errorData(() => adminPaginationOptions({ numItems, cursor: null }))).toMatchObject({ code: "INVALID_PAGE_SIZE" });
    }
  });
  it("restricts project pages to 25 while other admin lists still accept 50", () => {
    expect(adminPaginationOptions({ numItems: 25, cursor: "project-cursor" }, 25))
      .toEqual({ numItems: 25, cursor: "project-cursor", maximumRowsRead: 500 });
    expect(errorData(() => adminPaginationOptions({ numItems: 26, cursor: null }, 25)))
      .toEqual({ code: "INVALID_PAGE_SIZE", message: "Sayfa boyutu 1 ile 25 arasında olmalıdır." });
    expect(adminPaginationOptions({ numItems: 50, cursor: null }).numItems).toBe(50);
  });
  it("trims names and returns stable field error codes", () => {
    expect(projectName("  Merkez  ")).toBe("Merkez");
    expect(projectName("x".repeat(100))).toHaveLength(100);
    expect(errorData(() => projectName("\t\n "))).toEqual({ code: "PROJECT_NAME_REQUIRED", message: "Proje adını girin." });
    expect(errorData(() => projectName("x".repeat(101)))).toMatchObject({ code: "PROJECT_NAME_TOO_LONG" });
  });
  it("omits user secrets and retains expired verification setup state", () => {
    const user: Doc<"users"> = { _id: userId, _creationTime: 0, fullName: "  Ayşe  ", email: "a@example.com", verified: false,
      tokenExpiresAt: "2020-01-01T00:00:00Z", setupToken: "secret", phone: "555", image: "private", photoUrl: "private", role: "project_user" };
    const row = adminUserRow(user, userId, []);
    expect(row).toEqual({ _id: userId, displayName: "Ayşe", email: "a@example.com", role: "project_user", projects: [], isSelf: true, accessExpired: false, pendingSetup: true, setupExpiresAt: user.tokenExpiresAt });
    expect(Object.keys(row)).not.toContain("setupToken");
    expect(Object.keys(row)).not.toContain("phone");
    expect(Object.keys(row)).not.toContain("image");
    expect(adminUserRow({ _id: userId, _creationTime: 0 }, "other" as Id<"users">, []).pendingSetup).toBe(false);
  });
  it("counts are exact through 100 and lower bounds after 100", () => {
    expect(boundedAdminCount(100)).toEqual({ count: 100, capped: false });
    expect(boundedAdminCount(101)).toEqual({ count: 100, capped: true });
  });
  it("explicit inventory projection does not leak new schema fields", () => {
    const device = { _id: "device1" as Id<"adminDevices">, _creationTime: 0, name: "Panel", createdAt: "now", updatedAt: "now", unexpectedSecret: "hidden" };
    const row = adminDeviceRow(device, "Merkez");
    expect(row.assignedProjectName).toBe("Merkez");
    expect(Object.keys(row)).not.toContain("unexpectedSecret");
  });
  it("uses the shared five-minute connection boundary", () => {
    const now = Date.parse("2026-01-01T00:10:00Z");
    expect(DEVICE_ONLINE_WINDOW_MS).toBe(300000);
    expect(deviceConnection({}, now)).toBe("never");
    expect(deviceConnection({ lastSeen: "invalid" }, now)).toBe("never");
    expect(deviceConnection({ lastSeen: new Date(now - 300000).toISOString() }, now)).toBe("offline");
    expect(deviceConnection({ lastSeen: new Date(now - 299999).toISOString() }, now)).toBe("online");
  });
});

describe("deletion preview shares mutation policy", () => {
  it("all business blockers match remove and capped counts remain lower bounds", () => {
    for (const { table } of projectDeletionBlockingTables) {
      const counts = { [table]: 101 };
      expect(projectDeletionError(projectDeletionBlockers(counts))).not.toBeNull();
      expect(projectDeletionImpactRows(counts)).toMatchObject({ canDelete: false, blockers: [{ table, count: 100, capped: true }], cleanup: [] });
    }
  });
  it("cleanup never blocks, audit history is preserved, and zero rows are omitted", () => {
    const counts = Object.fromEntries(projectDeletionCleanupTables.map(table => [table, 2]));
    const impact = projectDeletionImpactRows({ ...counts, auditLog: 200 });
    expect(impact.canDelete).toBe(true);
    expect(impact.blockers).toEqual([]);
    expect(impact.cleanup).toHaveLength(projectDeletionCleanupTables.length);
    expect(impact.cleanup.every(row => row.label && row.count === 2 && !row.capped)).toBe(true);
    expect(projectDeletionImpactRows({})).toEqual({ canDelete: true, blockers: [], cleanup: [] });
  });
});
