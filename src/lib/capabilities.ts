export type AppRole = "super_admin" | "project_admin" | "project_user";
export type SettingsTab = "general" | "users" | "work-payroll" | "reports" | "integrations" | "privacy" | "mail" | "notifications";
const adminTabs: readonly SettingsTab[] = ["general", "users", "work-payroll", "reports", "integrations", "privacy", "notifications"];
export function capabilities(role: string | undefined) {
  const systemAdmin = role === "super_admin";
  const admin = systemAdmin || role === "project_admin";
  return {
    admin, systemAdmin, inviteUsers: admin, manageUsers: systemAdmin, auditLog: admin,
    settingsTabs: systemAdmin ? [...adminTabs, "mail"] : admin ? adminTabs : [],
  };
}
