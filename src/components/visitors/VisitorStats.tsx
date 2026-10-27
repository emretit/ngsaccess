import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { StatInline } from "@/components/shared/StatInline";
import { useStableQuery } from "./hooks/useStableQuery";

export function VisitorStats({ now, onNextExpiry }: { now: number; onNextExpiry?: (value: number | null) => void }) {
  const { projectId } = useActiveProjectScope();
  const summary = useStableQuery(useQuery(api.visitors.summary, projectId ? { projectId, now } : "skip"), projectId);
  useEffect(() => { if (summary) onNextExpiry?.(summary.nextExpiry); }, [summary, onNextExpiry]);
  const count = (value: number | undefined) => value === undefined ? undefined : summary?.overflow ? `${value.toLocaleString("tr-TR")}+` : value;
  return <div className="space-y-2"><StatInline loading={summary === undefined} items={[
    { label: "Aktif", value: count(summary?.counts.active) },
    { label: "Süresi doldu", value: count(summary?.counts.expired) },
    { label: "Sonlandırıldı / pasif", value: count(summary?.counts.checkedOut) },
    { label: "Ön kayıt", value: count(summary?.counts.preRegistered) },
  ]} />
    {summary?.overflow && <p className="text-xs text-muted-foreground">İlk {summary.scanned.toLocaleString("tr-TR")} kayda göre gösteriliyor; toplamlar daha yüksek olabilir.</p>}
    {summary?.nextExpiryScanLimited && <p className="text-xs text-muted-foreground">Yaklaşan bitişlerin bir bölümü özete dahil edilemedi.</p>}
  </div>;
}
