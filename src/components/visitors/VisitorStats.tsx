import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { StatInline } from "@/components/shared/StatInline";
import { useStableQuery } from "./hooks/useStableQuery";

export function VisitorStats({ refreshKey }: { refreshKey: number }) {
  const { projectId } = useActiveProjectScope();
  const summary = useStableQuery(useQuery(api.visitors.summary, projectId ? { projectId, refreshKey } : "skip"), projectId);
  return <div className="space-y-2">
    <StatInline loading={summary === undefined} items={[
      { label: "Toplam", value: summary?.total },
      { label: "Erişimi aktif", value: summary?.accessActive },
      { label: "Son okumaya göre içeride", value: summary?.inside },
      { label: "Erişimi kapalı", value: summary?.accessClosed },
    ]} />
    {summary && <p className="text-xs text-muted-foreground">{summary.truncated ? `Özet yalnız son ${summary.scanLimit} ziyaretçi kaydını kapsar.` : "Özet seçili projenin tüm ziyaretçi kayıtlarını kapsar."} İçeride sayısı erişim durumlarıyla kesişebilir; sayılar toplanmaz.</p>}
  </div>;
}
