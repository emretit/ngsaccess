import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { PROJECT_ROLES, ROLE_LABELS, isProjectRole } from "../../../convex/lib/roleCatalog";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useUserManagement } from "./hooks/useUserManagement";
import { UserFormDialog } from "./components/UserFormDialog";

type Member = FunctionReturnType<typeof api.roles.listProjectMembers>[number];
export function MemberRoleSelect({ member, projectId }: { member: Member; projectId: Id<"projects"> }) {
  const save = useMutation(api.roles.setMemberRole).withOptimisticUpdate((store, args) => {
    const members = store.getQuery(api.roles.listProjectMembers, { projectId: args.projectId });
    if (members) store.setQuery(api.roles.listProjectMembers, { projectId: args.projectId }, members.map(item => item.userId === args.userId ? { ...item, role: args.role } : item));
  });
  const [pending, setPending] = useState(false);
  return <label className="space-y-1"><span className="sr-only">{member.name ?? member.email ?? "Kullanıcı"} proje rolü</span><select className="h-9 rounded-md border bg-background px-3 text-sm" value={member.role} disabled={pending || member.isSuperAdmin} onChange={async event => {
    const role = event.target.value;
    if (!isProjectRole(role)) return;
    setPending(true);
    try { await save({ projectId, userId: member.userId, role }); notify.success("Proje rolü güncellendi"); }
    catch (error) { notify.error("Proje rolü değiştirilemedi", error); }
    finally { setPending(false); }
  }}>{PROJECT_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>{member.isSuperAdmin && <span className="ml-2 text-xs text-muted-foreground">Süper Admin · değiştirilemez</span>}</label>;
}

export function ProjectMembersContent() {
  const { projectId } = useActiveProjectScope();
  const members = useQuery(api.roles.listProjectMembers, projectId ? { projectId } : "skip");
  const management = useUserManagement();
  const [open, setOpen] = useState(false);
  if (!projectId) return null;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Aktif projedeki kullanıcılar ve proje rolleri.</p><Button onClick={() => { management.resetForm(); setOpen(true); }}>Kullanıcı davet et</Button></div>
    {members === undefined ? <SectionSkeleton label="Kullanıcılar yükleniyor" /> : <ul className="divide-y rounded-md border">{members.map(member => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 p-3"><div><p className="text-sm font-medium">{member.name ?? member.email ?? "Kullanıcı"}</p><p className="text-xs text-muted-foreground">{member.email}</p></div><MemberRoleSelect member={member} projectId={projectId} /></li>)}</ul>}
    {open && <UserFormDialog isOpen onClose={() => setOpen(false)} currentUser={null} formData={management.formData} baseline={management.baseline} onFormDataChange={management.setFormData} onSave={async () => { const ok = await management.handleSaveUser(); if (ok) setOpen(false); return ok; }} isSaving={management.saving} editReady={management.editReady} projects={management.projects} error={management.error} />}
  </div>;
}
