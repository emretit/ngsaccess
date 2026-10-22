import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SyncRunSheet } from "../SyncRuns";
import { runLabels } from "../lib/presentation";

/** Only the small run record is subscribed; grant rows remain snapshots. */
export function RunNotice({
  runId,
  onComplete,
}: {
  runId: Id<"deviceSyncRuns">;
  onComplete: () => void;
}) {
  const run = useQuery(api.deviceSyncRuns.get, { runId });
  const completed = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (run && run.status !== "running" && !completed.current) {
      completed.current = true;
      onComplete();
    }
  }, [run, onComplete]);
  return (
    <section className="flex flex-wrap gap-3 items-center border rounded-md p-3">
      <p role="status">
        Gönderim başlatıldı · {run ? runLabels[run.status] : "Yükleniyor"}.
        Cihaz gönderiminin sonucu ayrıca izlenir.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Gönderim sonucunu aç
      </Button>
      <SyncRunSheet
        runId={open ? runId : null}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
