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
  return <StatInline loading={summary === undefined} items={[
    { label: "Aktif", value: summary?.counts.active },
    { label: "Süresi doldu", value: summary?.counts.expired },
    { label: "Sonlandırıldı / pasif", value: summary?.counts.checkedOut },
    { label: "Ön kayıt", value: summary?.counts.preRegistered },
  ]} />;
}
