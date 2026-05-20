import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { roleLabel as formatRole } from "@/lib/roleLabels";

export default function UserProjectsCard() {
  const { profile } = useAuth();
  const { projects, isSuperAdmin, loading } = useActiveProject();
  const roleLabel = formatRole(profile?.role);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="h-4 w-4 text-primary" />
          Erişim Yetkim
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Rol:</span>
          <Badge variant="secondary">{roleLabel}</Badge>
        </div>

        {isSuperAdmin ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Tüm projelere erişim (süper admin).
          </div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Yükleniyor…</div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Henüz hiçbir projeye atanmadınız.
          </div>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p._id}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{p.name}</span>
                <Badge variant="outline" className="text-xs">
                  {roleLabel}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
