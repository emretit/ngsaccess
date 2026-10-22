import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LeaveRequestsPanel } from "@/components/leaves/LeaveRequestsPanel";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { LeaveFilters } from "@/components/leaves/LeaveFilters";
import {
  LeaveResults,
  type LeaveQueryFilters,
} from "@/components/leaves/LeaveResults";
import { LeaveDetails } from "@/components/leaves/LeaveDetails";
import { LeaveForm } from "@/components/leaves/LeaveForm";
import { LeaveQueryBoundary } from "@/components/leaves/LeaveQueryBoundary";
import {
  currentMonth,
  dateLabel,
  projectScopedLeaveParams,
  readFilters,
  type LeaveRow,
} from "@/components/leaves/lib/leaveState";

export default function Leaves() {
  const { projectId, activeProject, loading } = useActiveProjectScope();
  const { can } = usePermissions();
  const canManage = can("attendance.approve");
  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title="İzinler" />
        <SectionSkeleton rows={5} label="İzin kayıtları yükleniyor." />
      </div>
    );
  if (!projectId)
    return (
      <div className="space-y-6">
        <PageHeader title="İzinler" />
        <EmptyState
          title="Bir proje seçin."
          description="İzin kayıtlarını görmek için üst çubuktan proje seçin."
        />
      </div>
    );
  return (
    <LeavesProject
      key={projectId}
      projectId={projectId}
      projectName={activeProject?.name ?? "Seçili proje"}
      canManage={canManage}
    />
  );
}
function LeavesProject({
  projectId,
  projectName,
  canManage,
}: {
  projectId: Id<"projects">;
  projectName: string;
  canManage: boolean;
}) {
  const [urlParams, setParams] = useSearchParams();
  const params = useMemo(
    () => projectScopedLeaveParams(urlParams, projectId),
    [urlParams, projectId],
  );
  const filters = readFilters(params);
  useEffect(() => {
    if (params !== urlParams || params.has("scope")) {
      const next = new URLSearchParams(params);
      next.delete("scope");
      setParams(next, { replace: true });
    }
  }, [params, urlParams, projectId, setParams]);
  const [requests, setRequests] = useState(false);
  const count = useQuery(
    api.leaveRequests.pendingCount,
    canManage ? { projectId, kind: "leaves" } : "skip",
  );
  const [detail, setDetail] = useState<LeaveRow | null>(null);
  const [editor, setEditor] = useState<LeaveRow | "new" | null>(null);
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const onRows = setRows;
  const onDetails = setDetail;
  const onEdit = (row: LeaveRow) => {
    if (canManage && row.status === "approved" && !row.employeeMissing) {
      setDetail(null);
      setEditor(row);
    }
  };
  const updateFilters = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("scope");
    next.delete("leave");
    next.delete("cursor");
    setParams(next, { replace: true });
  };
  const clear = () =>
    updateFilters({
      employee: undefined,
      type: undefined,
      period: currentMonth(),
      from: undefined,
      to: undefined,
    });
  const queryFilters: LeaveQueryFilters = {
    projectId,
    rangeStart: filters.rangeStart,
    rangeEnd: filters.rangeEnd,
    leaveType: filters.leaveType,
    employeeId: filters.employeeId as Id<"employees"> | undefined,
  };
  const scope = JSON.stringify({ ...queryFilters, pageSize: filters.pageSize });
  const displayedDetail = detail
    ? (rows.find((row) => row._id === detail._id) ?? detail)
    : null;
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="İzinler"
        scope={`${projectName} · ${dateLabel(filters.rangeStart)} – ${dateLabel(filters.rangeEnd)}`}
        primaryAction={
          canManage
            ? { label: "İzin ekle", onClick: () => setEditor("new") }
            : undefined
        }
      />
      {canManage && (
        <div role="group" aria-label="İzin görünümü" className="flex gap-2">
          <Button
            variant={!requests ? "secondary" : "ghost"}
            aria-pressed={!requests}
            onClick={() => setRequests(false)}
          >
            Kayıtlar
          </Button>
          <Button
            variant={requests ? "secondary" : "ghost"}
            aria-pressed={requests}
            onClick={() => setRequests(true)}
          >
            Talepler (
            {count
              ? `${Math.min(count.count, 100)}${count.count > 100 ? "+" : ""}`
              : "…"}
            )
          </Button>
        </div>
      )}
      {canManage && requests ? (
        <LeaveQueryBoundary scope={`requests:${projectId}`}>
          <LeaveRequestsPanel key={projectId} projectId={projectId} />
        </LeaveQueryBoundary>
      ) : (
        <>
          <LeaveFilters
            projectId={projectId}
            filters={filters}
            onChange={updateFilters}
            onClear={clear}
          />
          <p className="text-xs text-muted-foreground">
            İzinler yöneticiler tarafından doğrudan onaylı kaydedilir. Dönem
            filtresi izin süresini kısaltmaz.
          </p>
          <LeaveQueryBoundary scope={scope}>
            <LeaveResults
              key={scope}
              filters={queryFilters}
              pageSize={filters.pageSize}
              canManage={canManage}
              onCreate={() => setEditor("new")}
              onClear={clear}
              onDetails={onDetails}
              onEdit={onEdit}
              requestedId={params.get("leave") ?? undefined}
              onRows={onRows}
              onPageSizeChange={(size) => updateFilters({ size: String(size) })}
            />
          </LeaveQueryBoundary>
        </>
      )}
      <LeaveDetails
        row={displayedDetail}
        canManage={canManage}
        onClose={() => setDetail(null)}
        onEdit={onEdit}
      />
      {canManage && editor && (
        <LeaveForm
          key={editor === "new" ? "new" : editor._id}
          row={editor === "new" ? undefined : editor}
          latestRow={
            editor === "new"
              ? undefined
              : rows.find((row) => row._id === editor._id)
          }
          projectId={projectId}
          projectName={projectName}
          onClose={() => setEditor(null)}
          onConflict={(conflict, employeeId) => {
            const next = new URLSearchParams(params);
            next.set("employee", employeeId);
            next.set("period", "custom");
            next.set("from", conflict.start);
            next.set("to", conflict.end);
            next.set("leave", conflict.id);
            next.delete("type");
            next.delete("cursor");
            setEditor(null);
            setParams(next);
          }}
        />
      )}
    </div>
  );
}
