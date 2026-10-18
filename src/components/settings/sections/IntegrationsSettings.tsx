import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { PaftaIntegrationCard } from "./integrations/PaftaIntegrationCard";
import { BridgeIntegrationCard } from "./integrations/BridgeIntegrationCard";
export function IntegrationsSettings() {
  return <div className="min-w-0 space-y-6">
    <QuerySectionBoundary title="Köprü anahtarları yüklenemedi"><BridgeIntegrationCard /></QuerySectionBoundary>
    <PaftaIntegrationCard />
  </div>;
}
