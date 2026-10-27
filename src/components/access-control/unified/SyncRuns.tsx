import { errorMessage } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ConfirmAction } from "@/components/shared/ConfirmAction";
import { deviceBrandLabel } from "@/lib/deviceBrand";
import { formatTrDateTime } from "@/lib/date";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import {
  runCountParts,
  runKindLabels,
  runDisplay,
  runSummary,
  targetLabels,
  targetTone,
} from "./lib/presentation";

function RunResult({ runId }: { runId: Id<"deviceSyncRuns"> }) {
  const run = useQuery(api.deviceSyncRuns.get, { runId });
  if (!run) return <SectionSkeleton label="Gönderim yükleniyor" />;
  const display = runDisplay(run.status, run.counts);
  return (
    <div className="space-y-4">
      <div role="status">
        <StatusBadge tone={display.tone}>{display.label}</StatusBadge>
      </div>
      <p className="text-muted-foreground text-xs break-words">
        {runSummary(run.counts)}
      </p>
      {run.targets.length === 0 && <p>Hedef cihaz bulunamadı.</p>}
      <ul className="divide-y">
        {run.targets.map((target) => (
          <li key={target._id} className="py-3 space-y-1">
            <p className="break-words font-medium">
              {target.deviceName}{" "}
              <span className="text-muted-foreground">({deviceBrandLabel(target.brand)})</span>
            </p>
            <StatusBadge tone={targetTone(target.status)}>
              {targetLabels[target.status]}
            </StatusBadge>
            {target.reason && (
              <p className="break-words text-xs text-muted-foreground">
                {errorMessage(target.reason)}
              </p>
            )}
            {target.status === "skipped" && target.reason === "Cihaz çevrimdışı" && (
              <p className="text-xs text-muted-foreground">Cihaz bağlanınca yeniden gönderin.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
export function SyncRunSheet({
  runId,
  onClose,
}: {
  runId: Id<"deviceSyncRuns"> | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={runId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gönderim sonucu</SheetTitle>
          <SheetDescription>
            Cihaz aldığını bildirene kadar “Gönderildi” görünür.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5">
          {runId && (
            <QuerySectionBoundary resetKey={runId}>
              <RunResult runId={runId} />
            </QuerySectionBoundary>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
type RunHeaderData = Pick<Doc<"deviceSyncRuns">, "kind" | "startedAt" | "status" | "counts">;
function RunHeader({ run }: { run: RunHeaderData }) {
  const display = runDisplay(run.status, run.counts);
  return (
    <>
      <StatusBadge tone={display.tone}>{display.label}</StatusBadge>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">{runKindLabels[run.kind]}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatTrDateTime(run.startedAt)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground break-words">
        {runCountParts(run.counts).join(" · ") || "Hedef cihaz yok"}
      </p>
    </>
  );
}
export function RecentRuns({ projectId }: { projectId: Id<"projects"> }) {
  const runs = useQuery(api.deviceSyncRuns.listRecent, { projectId, limit: 1 });
  const [selected, setSelected] = useState<Id<"deviceSyncRuns"> | null>(null);
  if (!runs) return <SectionSkeleton rows={1} label="Son gönderim yükleniyor" />;
  const run = runs[0];
  return (
    <section className="space-y-2 min-w-0">
      <h2 className="text-base font-semibold">Son gönderim</h2>
      {!run ? (
        <p className="text-muted-foreground text-xs">Henüz gönderim yok.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-4 py-3">
          <RunHeader run={run} />
          <Button variant="outline" onClick={() => setSelected(run._id)} aria-label={`${formatTrDateTime(run.startedAt)} gönderiminin ayrıntısı`}>
            Ayrıntı
          </Button>
        </div>
      )}
      <SyncRunSheet runId={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
/** Rule details already sit in a sheet: no second sheet, only the devices that need attention. */
export function RuleLastRun({ ruleId }: { ruleId: Id<"accessRules"> }) {
  const run = useQuery(api.deviceSyncRuns.latestForRule, { ruleId });
  if (run === undefined) return <SectionSkeleton rows={1} label="Son gönderim yükleniyor" />;
  const problems = run?.targets.filter((target) => target.status === "failed" || target.status === "skipped" || target.status === "unknown") ?? [];
  return (
    <section className="space-y-2 min-w-0">
      <h2 className="text-base font-semibold">Kuralın son gönderimi</h2>
      {!run ? (
        <p className="text-muted-foreground text-xs">Bu kural için henüz gönderim yok.</p>
      ) : (
        <div className="rounded-md border px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <RunHeader run={run} />
          </div>
          {problems.length > 0 && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {problems.map((target) => (
                <li key={target._id} className="break-words">
                  {target.deviceName}: {targetLabels[target.status]}
                  {target.reason ? ` · ${errorMessage(target.reason)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
export function ProjectSyncButton({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const [confirm, setConfirm] = useState(false);
  const [runId, setRunId] = useState<Id<"deviceSyncRuns"> | null>(null);
  const counts = useQuery(api.accessRules.projectDeviceCounts, { projectId });
  const start = useAction(api.deviceSyncRuns.startProjectResync);
  const send = useAsyncAction(async () => {
    const result = await start({ projectId });
    setRunId(result.runId);
  }, { error: "Cihaz gönderimi başlatılamadı" });
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11 md:min-h-9 whitespace-normal"
        disabled={!counts || counts.total === 0 || send.pending}
        onClick={() => setConfirm(true)}
      >
        Tüm proje cihazlarına gönder
      </Button>
      <ConfirmAction
        open={confirm}
        onOpenChange={(open) => {
          if (!send.pending) setConfirm(open);
        }}
        title="Tüm proje cihazlarına gönderilsin mi?"
        description={
          <>
            {counts?.total ?? 0} cihaz. Marka dağılımı:{" "}
            {brandDistribution(counts?.brands ?? {})}. Projedeki tüm cihazlar
            değerlendirilir; liste filtreleri kapsamı daraltmaz. Aktif kurallar
            gönderilir, uygun olmayan cihazlar gerekçesiyle atlanır. Cihaz aldığını bildirene kadar “Gönderildi” görünür.
          </>
        }
        confirmLabel="Tüm proje cihazlarına gönder"
        pendingLabel="Başlatılıyor…"
        onConfirm={send.run}
      />
      <SyncRunSheet runId={runId} onClose={() => setRunId(null)} />
    </>
  );
}


/** Persistent save feedback links to this exact run, including a full-send retry for no-op saves. */
export function RuleSaveNotice({ result, onDismiss }: { result: RuleSaveResult; onDismiss: () => void }) {
  const [selected, setSelected] = useState<Id<"deviceSyncRuns"> | null>(null);
  const start = useAction(api.deviceSyncRuns.startRuleSync);
  const retry = useAsyncAction(async () => {
    const run = await start({ ruleId: result.ruleId });
    setSelected(run.runId);
  }, { error: "Cihaz gönderimi başlatılamadı" });
  return (
    <section aria-label="Kural kayıt sonucu" className="flex flex-wrap items-center gap-3 border-b pb-3">
      <p role="status" className="flex-1 min-w-0">
        {result.runId ? "Kural kaydedildi. Cihaz gönderiminin sonucu ayrıca izlenir."
          : "Değişiklik yok; cihazlara yeni işlem gönderilmedi. Yeniden gönderebilirsiniz."}
      </p>
      {result.runId ? (
        <Button variant="outline" onClick={() => setSelected(result.runId)}>Gönderim sonucunu aç</Button>
      ) : (
        <Button variant="outline" disabled={retry.pending} onClick={() => { void retry.run(); }}>
          {retry.pending ? "Başlatılıyor…" : "Cihazlara gönder"}
        </Button>
      )}
      <Button variant="ghost" disabled={retry.pending} onClick={onDismiss}>Kapat</Button>
      <SyncRunSheet runId={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

export function brandDistribution(brands: Record<string, number>) {
  const labels = new Map<string, number>();
  for (const [brand, count] of Object.entries(brands)) {
    const label = deviceBrandLabel(brand);
    labels.set(label, (labels.get(label) ?? 0) + count);
  }
  return [...labels].map(([label, count]) => `${label}: ${count}`).join(", ") || "Cihaz yok";
}
