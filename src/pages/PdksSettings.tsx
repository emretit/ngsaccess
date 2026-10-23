import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { PdksSettingsPanel } from "@/components/pdks/settings/PdksSettingsPanel";
import { cameFromRecords } from "@/components/pdks/settings/route";

export default function PdksSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can, loading: permissionsLoading } = usePermissions();
  const { projectId, activeProject, loading } = useActiveProjectScope();
  const back = () => cameFromRecords(location.state) ? navigate(-1) : navigate("/pdks-records");
  const content = loading || permissionsLoading ? <SectionSkeleton rows={4} label="PDKS ayarları yükleniyor." />
    : !can("schedule.manage") ? <div role="status" className="space-y-3 py-8"><p className="text-base font-semibold">PDKS ayarlarını görüntüleme yetkiniz yok.</p><p className="text-sm text-muted-foreground">Bu sayfa vardiya yönetme yetkisi olanlar içindir.</p><Button variant="outline" asChild><Link to="/pdks-records">PDKS Kayıtları’na dön</Link></Button></div>
    : !projectId ? <EmptyState title="Bir proje seçin." description="PDKS ayarlarını görmek için üst çubuktan proje seçin." />
    : <PdksSettingsPanel key={projectId} projectId={projectId} />;
  return <div className="min-w-0 space-y-6">
    <div className="space-y-2">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={back}><ChevronLeft className="h-4 w-4" aria-hidden="true" />PDKS Kayıtları</Button>
      <PageHeader title="PDKS Ayarları" scope={activeProject?.name ?? "Proje seçin"} />
    </div>
    {content}
  </div>;
}
