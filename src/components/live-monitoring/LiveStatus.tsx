import { useConvexConnectionState, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { trTime } from "./lib/readings";
export function LiveStatus({ projectId, live }: { projectId: Id<"projects">; live: boolean }) {
  const connected = useConvexConnectionState().isWebSocketConnected;
  const last = useQuery(api.cardReadings.lastMonitoringReading, { projectId });
  return <p className="flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground">
    {live && <><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${connected ? "animate-pulse bg-success" : "bg-danger"}`} /><span role="status" className="font-medium text-foreground">{connected ? "Canlı" : "Bağlantı kesildi"}</span></>}
    {last && <span>{live ? "· " : ""}Son okuma {trTime(last.accessTime)}</span>}
  </p>;
}
