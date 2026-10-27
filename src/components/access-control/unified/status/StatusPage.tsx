import { usePermissions } from "@/hooks/usePermissions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/notify";
import { formatTrDateTime } from "@/lib/date";
import {
  searchFilters,
  queryArgs,
  togglePair,
  type Counts,
  type Filters,
  type GrantRow,
  type Pair,
  type EmployeeDetail,
} from "./model";
import { EmptyStatus } from "./StatusViews";
import { RunNotice } from "./RunNotice";
import { StatusCounters } from "./StatusCounters";
import { StatusFilters } from "./StatusFilters";
import { StatusResults, StatusViewToggle } from "./StatusResults";
import { RedistributeBar, RedistributeDialog } from "./RedistributeControls";
import { EmployeeGrantSheet } from "./EmployeeGrantSheet";
import { useStatusOptions, useDeviceCounts, type StatusScope } from "./useStatusData";
import { useRedistribution } from "./useRedistribution";

export { StatusFilter } from "./StatusFilters";

export default function StatusPage() {
  const { projectId } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("accessRules.manage");
  if (!canManage) return null;
  if (!projectId) return <p>Önce bir proje seçin.</p>;
  return <StatusContent key={projectId} projectId={projectId} />;
}
function StatusContent({ projectId }: { projectId: Id<"projects"> }) {
  const convex = useConvex();
  const [view, setView] = useState<"person" | "device">("person");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  const { filters, search, setSearch, expanded, setExpanded, change } =
    useStatusFilters();
  const options = useStatusOptions({ convex, projectId, setError, revision });
  const { counts, projectCounts } = useStatusCounts({
    convex, projectId, setError, filters, revision,
  });
  const { rows, cursor, busy, refreshedAt, selected, setSelected, more, toggle } =
    useStatusRows({ convex, projectId, setError, filters, revision, view, expanded });
  const deviceCounts = useDeviceCounts({
    convex, projectId, setError, options, filters, revision, view,
  });
  const { employee, setEmployee, detail, detailError } =
    useEmployeeGrantDetail(convex, revision);
  const { action, setAction, sending, success, runId, send } = useRedistribution({
    projectId, selected, setSelected, setError,
  });
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <div>
          <h1 className="text-xl font-semibold">Yetki Durumu</h1>
          <p className="text-sm text-muted-foreground">Kişi yetkilerinin cihazlara ulaşıp ulaşmadığını kontrol edin.</p>
        </div>
        <Button variant="outline" disabled={busy} onClick={refresh}>
          Yenile
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Son yenileme:{" "}
        {refreshedAt ? formatTrDateTime(refreshedAt).split(" ")[1] : "—"} ·
        İstanbul saati
      </p>
      {success && <p role="status">{success}</p>}
      {runId && <RunNotice key={runId} runId={runId} onComplete={refresh} />}
      <StatusCounters filters={filters} counts={counts} change={change} />
      <StatusFilters
        filters={filters}
        options={options}
        search={search}
        setSearch={setSearch}
        change={change}
      />
      <StatusViewToggle view={view} setView={setView} />
      <RedistributeBar
        selected={selected}
        sending={sending}
        projectCounts={projectCounts}
        setError={setError}
        setAction={setAction}
      />
      {error && !action && (
        <p role="alert" className="text-danger break-words">
          {error}
        </p>
      )}
      <EmptyStatus unknownCount={counts?.unknown ?? 0} />
      {busy && <p role="status">Yükleniyor…</p>}
      <StatusResults
        view={view}
        rows={rows}
        selected={selected}
        toggle={toggle}
        setEmployee={setEmployee}
        cursor={cursor}
        busy={busy}
        more={more}
        options={options}
        filters={filters}
        expanded={expanded}
        setExpanded={setExpanded}
        deviceCounts={deviceCounts}
      />
      <RedistributeDialog
        action={action}
        setAction={setAction}
        sending={sending}
        send={send}
        selected={selected}
        projectCounts={projectCounts}
        error={error}
        setError={setError}
      />
      <EmployeeGrantSheet
        employee={employee}
        setEmployee={setEmployee}
        detail={detail}
        detailError={detailError}
      />
    </div>
  );
}

function useStatusFilters() {
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Id<"devices">>();
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((f) =>
          searchFilters(f, search),
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const change = (patch: Partial<Filters>) => {
    setExpanded(undefined);
    setFilters((f) => ({ ...f, ...patch }));
  };
  return { filters, search, setSearch, expanded, setExpanded, change };
}

function useStatusCounts({
  convex, projectId, setError, filters, revision,
}: StatusScope & {
  filters: Filters;
  revision: number;
}) {
  const [projectCounts, setProjectCounts] = useState<Counts | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  // Graph-derived counters are read only when their scope changes or on refresh.
  useEffect(() => {
    let alive = true;
    setCounts(null);
    void Promise.all([
      convex.query(api.accessGrantStatus.counts, {
        projectId,
        departmentId: filters.departmentId,
      }),
      filters.departmentId
        ? convex.query(api.accessGrantStatus.counts, { projectId })
        : Promise.resolve(null),
    ])
      .then(([summary, globalSummary]) => {
        if (alive) {
          setCounts(summary);
          setProjectCounts(globalSummary ?? summary);
        }
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [convex, projectId, filters.departmentId, revision, setError]);
  return { counts, projectCounts };
}

function useStatusRows({
  convex, projectId, setError, filters, revision, view, expanded,
}: StatusScope & {
  filters: Filters;
  revision: number;
  view: "person" | "device";
  expanded: Id<"devices"> | undefined;
}) {
  const [rows, setRows] = useState<GrantRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number>();
  const [selected, setSelected] = useState<Pair[]>([]);
  const generation = useRef(0);
  const listFilters = useMemo(
    () => ({
      ...filters,
      deviceId: view === "device" ? expanded : filters.deviceId,
    }),
    [filters, view, expanded],
  );
  useEffect(() => {
    const request = ++generation.current;
    setRows([]);
    setCursor(null);
    setSelected([]);
    setError("");
    setBusy(true);
    const load = async () => {
      const page =
        view === "person" || expanded
          ? await convex.query(
              api.accessGrantStatus.listByProject,
              queryArgs(projectId, listFilters),
            )
          : null;
      if (request !== generation.current) return;
      setRows(page?.page ?? []);
      setCursor(page && !page.isDone ? page.continueCursor : null);
      setRefreshedAt(Date.now());
    };
    void load()
      .catch((e) => {
        if (request === generation.current) setError(errorMessage(e));
      })
      .finally(() => {
        if (request === generation.current) setBusy(false);
      });
    return () => {
      generation.current = request + 1;
    };
  }, [
    convex,
    projectId,
    listFilters,
    filters.departmentId,
    revision,
    view,
    expanded,
    setError,
  ]);
  async function more() {
    if (busy || !cursor) return;
    const request = generation.current;
    setBusy(true);
    setError("");
    try {
      const page = await convex.query(
        api.accessGrantStatus.listByProject,
        queryArgs(projectId, listFilters, cursor),
      );
      if (request !== generation.current) return;
      setRows((prev) => [...prev, ...page.page]);
      setCursor(page.isDone ? null : page.continueCursor);
    } catch (e) {
      if (request === generation.current) setError(errorMessage(e));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  const toggle = (pair: Pair) => {
    const next = togglePair(selected, pair);
    setSelected(next.pairs);
    if (next.error) setError(next.error);
  };
  return { rows, cursor, busy, refreshedAt, selected, setSelected, more, toggle };
}

function useEmployeeGrantDetail(convex: StatusScope["convex"], revision: number) {
  const [employee, setEmployee] = useState<GrantRow | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    setDetail(null);
    setDetailError("");
    if (!employee) return;
    let alive = true;
    void convex
      .query(api.accessGrantStatus.byEmployee, {
        employeeId: employee.employeeId,
      })
      .then((value) => {
        if (alive) setDetail(value);
      })
      .catch((e) => {
        if (alive) setDetailError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [employee, convex, revision]);
  return { employee, setEmployee, detail, detailError };
}
