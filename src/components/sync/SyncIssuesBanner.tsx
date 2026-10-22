import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { errorMessage, notify } from "@/lib/notify";
import { friendlySyncError } from "@/lib/syncErrorMessages";

type HikIssue = FunctionReturnType<typeof api.hikvisionSync.listSyncIssues>["items"][number];
type IdeIssue = FunctionReturnType<typeof api.ideSync.listSyncIssues>["items"][number];
type HikOperation = HikIssue["operation"];
type IdeOpType = IdeIssue["opType"];
type UnifiedItem = { source: "hikvision"; issue: HikIssue } | { source: "ide"; issue: IdeIssue };

const HIK_OPERATION_LABELS: Record<HikOperation, string> = {
  addPerson: "Kişi ekleme",
  updatePerson: "Kişi güncelleme",
  deletePerson: "Kişi silme",
  addCard: "Kart ekleme",
  deleteCard: "Kart silme",
  addFace: "Yüz ekleme",
  deleteFace: "Yüz silme",
  addFingerprint: "Parmak izi ekleme",
  deleteFingerprint: "Parmak izi silme",
  syncWeekPlan: "Haftalık plan",
  syncHoliday: "Tatil planı",
  syncDoorParam: "Kapı parametresi",
  openDoor: "Kapı açma",
  rebootDevice: "Cihaz yeniden başlatma",
  syncDoorStatusPlan: "Kapı durum planı",
  syncVerifyPlan: "Doğrulama planı",
};

const IDE_OP_LABELS: Record<IdeOpType, string> = {
  openDoor: "Kapı açma",
  upsertUser: "Kişi yazma",
  deleteUser: "Kişi silme",
  upsertPermission: "Yetki yazma",
  deletePermission: "Yetki silme",
  triggerSync: "Tam senkron",
  parameterWrite: "Cihaz parametresi",
};


function SyncIssueRow({ item, canManage, isSuperAdmin }: { item: UnifiedItem; canManage: boolean; isSuperAdmin: boolean }) {
  const dismissHik = useMutation(api.hikvisionSync.dismissSyncIssue);
  const dismissIde = useMutation(api.ideSync.dismissSyncIssue);
  const retryHik = useMutation(api.hikvisionSync.retrySyncIssue);
  const retryIde = useMutation(api.ideSync.retrySyncIssue);
  const { setActiveProjectId } = useActiveProject();
  const [retryConfirm, setRetryConfirm] = useState(false);
  const [closeReasonOpen, setCloseReasonOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);
  const isDeletion = item.source === "hikvision" && ["deletePerson", "deleteCard"].includes(item.issue.operation);
  const canDismissDeletion = isDeletion && isSuperAdmin && item.source === "hikvision" && item.issue.canDismiss;
  const dismiss = useAsyncAction(async () => {
    if (item.source === "ide") await dismissIde({ opId: item.issue._id });
    else await dismissHik({ issueId: item.issue._id, ...(isDeletion ? { reason: closeReason.trim() } : {}) });
  }, { success: "Uyarı kapatıldı; operasyon sonucu değişmedi" });
  const retry = async () => {
    const result = item.source === "ide"
      ? await retryIde({ opId: item.issue._id })
      : await retryHik({ issueId: item.issue._id });
    notify.info(result.queued ? "Yeniden deneme sıraya alındı; cihaz onayı bekleniyor" : "reason" in result && typeof result.reason === "string" ? result.reason : "İşlem zaten sırada veya tamamlanmış");
  };
  const label = item.source === "ide" ? IDE_OP_LABELS[item.issue.opType] : HIK_OPERATION_LABELS[item.issue.operation];
  return <li className="flex items-start gap-3 px-4 py-3 text-sm">
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{item.issue.projectName}</span>
        <Link className="font-medium underline" to={`/devices?deviceId=${item.issue.deviceId}`}
          onClick={() => { if (item.issue.projectId) setActiveProjectId(item.issue.projectId); }}>
          {item.issue.deviceName}
        </Link>
        <Badge variant="outline">{label}</Badge>
        <span className="text-xs text-muted-foreground">{item.issue.attempts}/{item.issue.maxAttempts} deneme</span>
      </div>
      <p>{friendlySyncError(item.issue.lastError, item.issue)}</p>
      <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short",
      }).format(item.issue.createdAt)} (TR saati)</p>
      {item.issue.lastError && <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Teknik ayrıntı</summary>
        <p className="break-all">{errorMessage(item.issue.lastError)}</p>
      </details>}
      {canDismissDeletion && closeReasonOpen && <form className="space-y-2" onSubmit={event => {
        event.preventDefault();
        if (closeReason.trim()) void dismiss.run();
      }}>
        <label className="block space-y-1">
          <span>Kapatma gerekçesi (zorunlu)</span>
          <textarea autoFocus required value={closeReason} onChange={event => setCloseReason(event.target.value)}
            className="block min-h-20 w-full min-w-0 rounded-md border bg-background p-2" />
        </label>
        <p className="text-xs text-muted-foreground">Cihazı silinmiş, proje kapsamından çıkmış, gateway kaydı veya eski kart kimliği eksik işlem kapatılabilir. Gerekçe denetim kaydına yazılır; cihazdan silindiği anlamına gelmez.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!closeReason.trim() || dismiss.pending}>Gerekçeyle kapat</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setCloseReasonOpen(false); closeButton.current?.focus(); }}>Vazgeç</Button>
        </div>
      </form>}
      {canManage && item.issue.canRetry && <Button size="sm" variant="outline" disabled={dismiss.pending}
        onClick={() => setRetryConfirm(true)}>Tekrar dene</Button>}
      {canManage && !item.issue.canRetry && <p className="text-xs text-muted-foreground">Yeniden deneme için cihaz ayrıntılarını açın.</p>}
    </div>
    {(!isDeletion || canDismissDeletion) && <Button ref={closeButton} size="icon" variant="ghost" className="shrink-0" disabled={dismiss.pending} aria-label={`${item.issue.deviceName} uyarısını kapat`}
      onClick={() => { if (isDeletion) setCloseReasonOpen(true); else void dismiss.run(); }}><X className="h-4 w-4" /></Button>}
    <ConfirmDestructive open={retryConfirm} onOpenChange={setRetryConfirm} title="İşlem yeniden denensin mi?"
      objectName={`${item.issue.deviceName} — ${label}`} confirmLabel="Tekrar dene"
      effects={["Bu komut cihaza yeniden gönderilir; fiziksel cihaz işlemleri yeniden uygulanabilir.", "Sıraya alınması cihazın işlemi tamamladığı anlamına gelmez."]}
      onConfirm={retry} />
  </li>;
}

export function SyncIssuesBanner() {
  const scope = useActiveProjectScope();
  const [allProjects, setAllProjects] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [openDevices, setOpenDevices] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<{ items: UnifiedItem[]; projectId: typeof scope.projectId; name: string } | null>(null);
  const showAll = allProjects && scope.projectIds.length > 1;
  const projectId = showAll ? undefined : scope.projectId;
  const args = !scope.loading && scope.projectId ? { projectId, limit: 50 } : "skip";
  const hik = useQuery(api.hikvisionSync.listSyncIssues, args);
  const ide = useQuery(api.ideSync.listSyncIssues, args);
  const dismissAllHik = useMutation(api.hikvisionSync.dismissAllSyncIssues);
  const dismissAllIde = useMutation(api.ideSync.dismissAllSyncIssues);
  const items = useMemo<UnifiedItem[]>(() => [
    ...(hik?.items ?? []).map((issue) => ({ source: "hikvision" as const, issue })),
    ...(ide?.items ?? []).map((issue) => ({ source: "ide" as const, issue })),
  ].sort((a, b) => b.issue.createdAt - a.issue.createdAt), [hik, ide]);
  const groups = new Map<string, UnifiedItem[]>();
  for (const item of items) groups.set(item.issue.deviceId, [...(groups.get(item.issue.deviceId) ?? []), item]);
  const incomplete = hik?.hasMore || ide?.hasMore || hik?.unknown || ide?.unknown;
  const scopeName = showAll ? "Tüm projeler" : scope.activeProject?.name ?? "Aktif proje";
  if (scope.loading || !scope.projectId) return null;
  if (!hik || !ide) return <SectionSkeleton rows={1} label="Senkron uyarıları yükleniyor" />;
  if (!items.length && !expanded) return null;
  return <div className="border-b bg-muted/30 text-foreground">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        Senkron uyarıları · {scopeName} · {groups.size} cihaz / {items.length} {incomplete ? "yüklenen hata" : "hata"}
      </Button>
      {scope.projectIds.length > 1 && <label className="ml-auto flex items-center gap-2 text-xs">
        Proje kapsamı
        <select className="rounded border bg-background p-1" value={showAll ? "all" : "active"}
          onChange={(event) => { setAllProjects(event.target.value === "all"); setOpenDevices(new Set()); }}>
          <option value="active">Aktif proje</option><option value="all">Tüm projeler</option>
        </select>
      </label>}
      {items.length > 0 && <Button variant="ghost" size="sm" disabled={!hik || !ide}
        onClick={() => setConfirmation({ items, projectId, name: scopeName })}>Hepsini kapat ({items.length})</Button>}
    </div>
    {incomplete && <p className="px-4 pb-2 text-xs text-muted-foreground">Yalnız yüklenen uyarılar gösteriliyor; devamı veya kapsamı çözülemeyen eski kayıtlar var. Kesin toplam bilinmiyor.</p>}
    {expanded && <ul className="max-h-80 overflow-y-auto divide-y bg-background">
      {[...groups].map(([deviceId, group]) => <li key={deviceId}>
        <ul>{(openDevices.has(deviceId) ? group : group.slice(0, 1)).map((item) => <SyncIssueRow key={item.issue._id} item={item} canManage={scope.isAdmin} isSuperAdmin={scope.isSuperAdmin} />)}</ul>
        {group.length > 1 && <Button variant="ghost" size="sm" className="mb-2 ml-4" aria-expanded={openDevices.has(deviceId)}
          onClick={() => setOpenDevices((previous) => { const next = new Set(previous); if (next.has(deviceId)) next.delete(deviceId); else next.add(deviceId); return next; })}>
          {openDevices.has(deviceId) ? "Eski hataları gizle" : `+${group.length - 1} eski hatayı aç`}
        </Button>}
      </li>)}
    </ul>}
    <ConfirmDestructive open={confirmation !== null} onOpenChange={(open) => { if (!open) setConfirmation(null); }}
      title="Görünen uyarılar kapatılsın mı?" objectName={`${confirmation?.name ?? scopeName} — ${confirmation?.items.length ?? 0} uyarı`}
      confirmLabel="Uyarıları kapat" effects={["Yalnız bu onayda listelenen kapsamdaki yüklenmiş uyarılar gizlenir.", "Başarısız operasyonlar korunur; kapatma başarı veya yeniden deneme değildir."]}
      onConfirm={async () => {
        if (!confirmation) return;
        const hikIds = confirmation.items.flatMap((item) => item.source === "hikvision" ? [item.issue._id] : []);
        const ideIds = confirmation.items.flatMap((item) => item.source === "ide" ? [item.issue._id] : []);
        const results = await Promise.allSettled([
          dismissAllHik({ projectId: confirmation.projectId, issueIds: hikIds }),
          dismissAllIde({ projectId: confirmation.projectId, issueIds: ideIds }),
        ]);
        const count = results.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value.count : 0), 0);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw new Error(`${count} uyarı kapatıldı; kalan uyarılar kapatılamadı. ${errorMessage(failure.reason)}`);
        notify.success(`${count} uyarı kapatıldı`, results.some((result) => result.status === "fulfilled" && result.value.hasMore) ? "Kapsamda başka uyarılar var." : undefined);
      }} />
  </div>;
}
