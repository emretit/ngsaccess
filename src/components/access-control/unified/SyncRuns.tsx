import { errorMessage } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { RuleSaveResult } from "@/hooks/access-rules/useComplexAccessRuleMutations";
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import {
  runLabels,
  runSummary,
  targetLabels,
  targetTone,
} from "./lib/presentation";

function RunResult({ runId }: { runId: Id<"deviceSyncRuns"> }) {
  const run = useQuery(api.deviceSyncRuns.get, { runId });
  if (!run) return <SectionSkeleton label="Gönderim yükleniyor" />;
  return (
    <div className="space-y-4">
      <p role="status">{runLabels[run.status]}</p>
      <p className="text-muted-foreground text-xs break-words">
        {runSummary(run.counts)}
      </p>
      {run.targets.length === 0 && <p>Hedef cihaz bulunamadı.</p>}
      <ul className="divide-y">
        {run.targets.map((target) => (
          <li key={target._id} className="py-3 space-y-1">
            <p className="break-words font-medium">
              {target.deviceName}{" "}
              <span className="text-muted-foreground">({target.brand})</span>
            </p>
            <StatusBadge tone={targetTone(target.status)}>
              {targetLabels[target.status]}
            </StatusBadge>
            {target.reason && (
              <p className="break-words text-xs text-muted-foreground">
                {errorMessage(target.reason)}
              </p>
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
            Gönderildi durumu teslim kanıtı değildir. Cihaz doğrulaması ayrıca
            gösterilir.
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
export function RecentRuns({
  projectId,
  ruleId,
}: {
  projectId: Id<"projects">;
  ruleId?: Id<"accessRules">;
}) {
  const runs = useQuery(api.deviceSyncRuns.listRecent, {
    projectId,
    ruleId,
    limit: ruleId ? 1 : 10,
  });
  const [selected, setSelected] = useState<Id<"deviceSyncRuns"> | null>(null);
  if (!runs)
    return <SectionSkeleton rows={1} label="Son gönderimler yükleniyor" />;
  const visible = runs;
  return (
    <section className="space-y-2 min-w-0">
      <h2 className="text-base font-semibold">
        {ruleId ? "Kuralın son gönderimi" : "Son gönderimler"}
      </h2>
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {ruleId ? "Bu kural için henüz gönderim yok." : "Henüz gönderim yok."}
        </p>
      ) : (
        <ul className="divide-y">
          {visible.map((run) => (
            <li
              key={run._id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <p>
                  {new Date(run.startedAt).toLocaleString("tr-TR", {
                    timeZone: "Europe/Istanbul",
                  })}{" "}
                  ·{" "}
                  {run.kind === "project_resync"
                    ? "Proje gönderimi"
                    : "Kural gönderimi"}{" "}
                  · {runLabels[run.status]}
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {runSummary(run.counts)}
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelected(run._id)} aria-label={`${new Date(run.startedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} gönderiminin ayrıntısı`}>
                Ayrıntı
              </Button>
            </li>
          ))}
        </ul>
      )}
      <SyncRunSheet runId={selected} onClose={() => setSelected(null)} />
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
  const devices = useQuery(api.devices.list, { projectId });
  const start = useAction(api.deviceSyncRuns.startProjectResync);
  const brands = (devices ?? []).reduce<Record<string, number>>(
    (counts, device) => {
      const brand = device.brand ?? "other";
      counts[brand] = (counts[brand] ?? 0) + 1;
      return counts;
    },
    {},
  );
  return (
    <>
      <Button
        variant="outline"
        disabled={!devices}
        onClick={() => setConfirm(true)}
      >
        Cihazlara gönder
      </Button>
      <ConfirmDestructive
        open={confirm}
        onOpenChange={setConfirm}
        title="Proje cihazlarına gönderilsin mi?"
        objectName={`${devices?.length ?? 0} cihaz`}
        effects={[
          `Marka dağılımı: ${
            Object.entries(brands)
              .map(([brand, count]) => `${brand}: ${count}`)
              .join(", ") || "Cihaz yok"
          }.`,
          "Projedeki tüm cihazlar değerlendirilir; liste filtreleri kapsamı daraltmaz. Aktif kurallar gönderilir, uygun olmayan cihazlar gerekçesiyle atlanır.",
          "Hikvision gönderimi teslim kanıtı değildir; IDE cihaz onayı ayrıca izlenir.",
        ]}
        confirmLabel="Gönderimi başlat"
        onConfirm={async () => {
          const result = await start({ projectId });
          setRunId(result.runId);
        }}
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
