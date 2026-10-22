import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ADMIN_ONLY_PERMISSIONS, LOCKED_ROLE, PERMISSIONS, PERMISSION_LABELS, PROJECT_ROLES, ROLE_DEFAULTS, ROLE_LABELS, type Permission, type ProjectRole } from "../../../../convex/lib/roleCatalog";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { usePermissions } from "@/hooks/usePermissions";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useSettingsFormState } from "../SettingsFormState";

const STICKY_CELL = "sticky left-0 z-10 bg-background";

export function RolesSettings() {
  const { projectId } = useActiveProjectScope();
  const { can } = usePermissions();
  const allowed = can("admin.manage");
  const roles = useQuery(api.roles.listProjectRoles, projectId && allowed ? { projectId } : "skip");
  const save = useMutation(api.roles.setRolePermissions).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.roles.listProjectRoles, { projectId: args.projectId });
    if (current) store.setQuery(api.roles.listProjectRoles, { projectId: args.projectId }, current.map(item => item.role === args.role ? { ...item, permissions: args.permissions } : item));
  });
  const [pending, setPending] = useState(false);
  useSettingsFormState("roles", false, pending);
  if (!projectId || !allowed) return null;
  if (!roles) return <SectionSkeleton label="Roller yükleniyor" />;
  const update = async (role: ProjectRole, permissions: readonly Permission[]) => {
    if (pending) return;
    setPending(true);
    try { await save({ projectId, role, permissions: [...permissions] }); }
    catch (error) { notify.error("Rol yetkileri kaydedilemedi", error); }
    finally { setPending(false); }
  };
  return <section className="space-y-4" aria-busy={pending}>
    <p className="text-sm text-muted-foreground">Varsayılan yetkiler önerilir; ihtiyaca göre değiştirebilirsiniz.</p>
    <p id="roles-locked" className="text-xs text-muted-foreground">🔒 Yönetici yetkileri değiştirilemez. Kullanıcı ve rol yönetimi yalnız Yönetici rolüne aittir.</p>
    {/* Dar ekranda tablo yatay kayar; yetki adı sütunu sabit kalır ki satır bağlamı kaybolmasın. */}
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm"><caption className="sr-only">Proje rolleri ve yetkileri</caption>
        <thead><tr className="border-b"><th scope="col" className={`${STICKY_CELL} p-3 text-left`}>Yetki</th>{PROJECT_ROLES.map(role => <th key={role} scope="col" className="p-3 text-center">{ROLE_LABELS[role]}{role === LOCKED_ROLE && <span aria-hidden="true"> 🔒</span>}</th>)}</tr></thead>
        <tbody>{PERMISSIONS.map(permission => <tr key={permission} className="border-b"><th scope="row" className={`${STICKY_CELL} p-3 text-left font-normal`}>{PERMISSION_LABELS[permission]}</th>{PROJECT_ROLES.map(role => {
          const permissions = roles.find(item => item.role === role)?.permissions ?? ROLE_DEFAULTS[role];
          const locked = role === LOCKED_ROLE || ADMIN_ONLY_PERMISSIONS.includes(permission);
          return <td key={role} className="p-3 text-center"><label className="inline-flex min-h-9 min-w-9 items-center justify-center"><span className="sr-only">{ROLE_LABELS[role]}: {PERMISSION_LABELS[permission]}</span><input type="checkbox" checked={permissions.includes(permission)} disabled={locked || pending} aria-describedby={locked ? "roles-locked" : undefined} onChange={event => void update(role, event.target.checked ? PERMISSIONS.filter(p => p === permission || permissions.includes(p)) : permissions.filter(p => p !== permission))} /></label></td>;
        })}</tr>)}</tbody>
        <tfoot><tr><th scope="row" className={`${STICKY_CELL} p-3 text-left font-normal`}>Varsayılan yetkiler</th>{PROJECT_ROLES.map(role => <td key={role} className="p-2 text-center"><Button size="sm" variant="outline" className="h-auto min-h-9 whitespace-normal py-1" disabled={pending || role === LOCKED_ROLE} aria-label={`${ROLE_LABELS[role]}: Varsayılana dön`} onClick={() => void update(role, ROLE_DEFAULTS[role])}>Varsayılana dön</Button></td>)}</tr></tfoot>
      </table>
    </div>
  </section>;
}
