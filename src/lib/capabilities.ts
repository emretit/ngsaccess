import type { Permission } from "../../convex/lib/roleCatalog";
export type AppRole = "super_admin" | "project_admin" | "project_user";
export type SettingsTab = "general" | "users" | "roles" | "work-payroll" | "reports" | "integrations" | "privacy" | "mail" | "notifications";
export function permissionCapabilities(can: (permission: Permission) => boolean, role: string | null) {
  const systemAdmin = role === "super_admin";
  const admin = can("admin.manage");
  const settingsTabs: SettingsTab[] = [];
  if (admin) settingsTabs.push("general", "users", "roles", "privacy", "notifications");
  if (can("schedule.manage")) settingsTabs.push("work-payroll");
  if (can("reports.view")) settingsTabs.push("reports");
  if (can("devices.manage")) settingsTabs.push("integrations");
  if (systemAdmin) settingsTabs.push("mail");
  return { admin, systemAdmin, inviteUsers: admin, manageUsers: systemAdmin, auditLog: admin, settingsTabs };
}
