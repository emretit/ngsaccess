import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { roleLabel } from "@/lib/roleLabels";

export default function DashboardHeader({ projectName }: { projectName?: string }) {
  const { profile } = useAuth();
  return <PageHeader title="Ana Sayfa" scope={<><p>{projectName ? `${projectName} · Proje özeti` : "Proje özeti"}</p>{profile?.role && <p className="mt-1 text-xs">{roleLabel(profile.role)} · Seçili projenin verileri</p>}</>}>
    <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" aria-hidden="true" />{new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())}</p>
  </PageHeader>;
}
