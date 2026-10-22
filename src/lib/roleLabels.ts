import { ROLE_LABELS as PROJECT_ROLE_LABELS } from "../../convex/lib/roleCatalog";
export const ROLE_LABELS: Record<string, string> = {
  ...PROJECT_ROLE_LABELS,
  super_admin: "Süper Admin",
  // Legacy platform account metadata; project authorization never reads these labels.
  project_admin: PROJECT_ROLE_LABELS.admin,
  project_user: PROJECT_ROLE_LABELS.viewer,
};
export function roleLabel(role: string | null | undefined): string {
  return role ? ROLE_LABELS[role] ?? role : "—";
}
