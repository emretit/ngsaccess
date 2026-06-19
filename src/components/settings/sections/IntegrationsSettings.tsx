import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";
import { PaftaIntegrationCard } from "./integrations/PaftaIntegrationCard";
import { BridgeIntegrationCard } from "./integrations/BridgeIntegrationCard";

const COMING_SOON = ["e-Fatura", "Logo", "Mikro", "Netsis"];

export function IntegrationsSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Entegrasyonlar</h2>
          <p className="text-sm text-muted-foreground">
            Harici sistemlerle veri senkronizasyonunu yönetin
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <BridgeIntegrationCard />
        <PaftaIntegrationCard />
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Yakında
        </p>
        <div className="flex flex-wrap gap-2">
          {COMING_SOON.map((name) => (
            <Badge key={name} variant="secondary" className="opacity-60">
              {name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
