import { describe, expect, it } from "vitest";
import { permissionCapabilities } from "./capabilities";
describe("permission capabilities", () => {
  it("legacy admin metadata cannot open management without permissions", () => {
    expect(permissionCapabilities(() => false, "project_admin")).toMatchObject({ admin: false, settingsTabs: [], manageUsers: false });
  });
  it("project management and platform management are independent", () => {
    expect(permissionCapabilities(p => p === "admin.manage", "admin")).toMatchObject({ inviteUsers: true, manageUsers: false });
    expect(permissionCapabilities(() => true, "super_admin").settingsTabs).toHaveLength(9);
  });
});
