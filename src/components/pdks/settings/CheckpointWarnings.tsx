import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** PDKS kuralında seçili okuyucu artık okumalarla eşleşmiyorsa (silinmiş, numarası değişmiş) uyarır. */
export function CheckpointWarnings({ projectId }: { projectId: Id<"projects"> }) {
  const warnings = useQuery(api.pdksRules.getCheckpointWarnings, { projectId });
  if (!warnings?.length) return null;
  return <div role="alert" className="space-y-2 rounded-md border border-warning bg-warning-bg p-3 text-sm">
    <p className="font-medium">PDKS kuralındaki okuyucularda sorun var</p>
    <ul className="list-disc space-y-1 pl-5">{warnings.map(warning => <li key={warning.key}>{warning.message}</li>)}</ul>
  </div>;
}
