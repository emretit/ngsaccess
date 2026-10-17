import CardReadings from "@/components/access-control/CardReadings";
import { PageHeader } from "@/components/shared/PageHeader";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
export default function LiveMonitoring() {
  const { activeProject } = useActiveProjectScope();
  return <div className="min-w-0 space-y-6"><PageHeader title="Canlı İzleme" scope={<span className="[overflow-wrap:anywhere]">{activeProject?.name || "Proje seçilmedi"} · Erişim okumaları · İstanbul saati (UTC+3)</span>} /><CardReadings /></div>;
}
