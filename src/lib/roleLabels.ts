export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Süper Admin",
  project_admin: "Proje Yöneticisi",
  project_user: "Üye",
};

export function roleLabel(role: string | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}
