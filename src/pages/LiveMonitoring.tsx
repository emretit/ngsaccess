import { useSearchParams } from "react-router-dom";
import CardReadings from "@/components/access-control/CardReadings";
import { PageHeader } from "@/components/shared/PageHeader";
import { LiveStatus } from "@/components/live-monitoring/LiveStatus";
import { readFilters } from "@/components/live-monitoring/lib/readings";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
export default function LiveMonitoring() {
  const { activeProject, projectId } = useActiveProjectScope();
  const [params] = useSearchParams();
  const filters = projectId ? readFilters(params, projectId) : null;
  return <div className="min-w-0 space-y-6"><PageHeader title="Canlı İzleme" scope={<span className="[overflow-wrap:anywhere]">{activeProject?.name || "Proje seçilmedi"} · Erişim okumaları · İstanbul saati (UTC+3)</span>}>{projectId && filters && <LiveStatus projectId={projectId} live={!filters.start && !filters.end} />}</PageHeader><CardReadings /></div>;
}
