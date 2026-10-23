import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { usePermissions } from "@/hooks/usePermissions";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { ShiftListSidebar } from "@/components/shifts/ShiftListSidebar";

export default function ShiftDefinitions() {
  const navigate = useNavigate();
  const { can, loading: permissionsLoading } = usePermissions();
  const { projectId, loading } = useActiveProjectScope();
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = !permissionsLoading && can("schedule.manage");
  return <div className="min-w-0 space-y-6">
    <div className="space-y-2">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/shifts")}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Vardiyalar</Button>
      <PageHeader title="Vardiya tanımları" primaryAction={canManage && projectId ? { label: "Yeni vardiya tanımla", onClick: () => setCreateOpen(true) } : undefined} />
      <p className="text-sm text-muted-foreground">Çalışma saatleri burada. Mesai politikası ve tatiller {canManage
        ? <Link className="underline underline-offset-4" to="/pdks-records/settings">PDKS Kayıtları › Ayarlar</Link>
        : "PDKS Kayıtları › Ayarlar"}'da.</p>
    </div>
    {loading || permissionsLoading ? <SectionSkeleton rows={4} label="Vardiya tanımları yükleniyor" />
      : !projectId ? <EmptyState title="Bir proje seçin." description="Vardiya tanımlarını görmek için üst çubuktan proje seçin." />
      : <QuerySectionBoundary resetKey={projectId} title="Vardiya tanımları yüklenemedi">
        <Definitions key={projectId} projectId={projectId} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      </QuerySectionBoundary>}
  </div>;
}

function Definitions({ projectId, createOpen, onCreateOpenChange }: {
  projectId: Id<"projects">; createOpen: boolean; onCreateOpenChange: (open: boolean) => void;
}) {
  const shifts = useQuery(api.shifts.list, { projectId });
  if (!shifts) return <SectionSkeleton rows={4} label="Vardiya tanımları yükleniyor" />;
  return <ShiftListSidebar projectId={projectId} shifts={shifts} createOpen={createOpen} onCreateOpenChange={onCreateOpenChange} />;
}
