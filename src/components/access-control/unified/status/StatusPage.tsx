import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/notify";
import { formatTrDateTime } from "@/lib/date";
import {
  confirmationText,
  failedConfirmationText,
  redistributionSuccessText,
  searchFilters,
  countText,
  labels,
  queryArgs,
  togglePair,
  type Counts,
  type Filters,
  type GrantRow,
  type Pair,
  type EmployeeDetail,
} from "./model";
import {
  DeviceCounters,
  EmployeeStatus,
  EmptyStatus,
  GrantRows,
} from "./StatusViews";
import { RunNotice } from "./RunNotice";

type Options = {
  departments: FunctionReturnType<typeof api.departments.list>;
  devices: FunctionReturnType<typeof api.devices.list>;
  rules: { _id: Id<"accessRules">; name: string }[];
  templates: FunctionReturnType<typeof api.accessScheduleTemplates.list>;
};
const emptyOptions: Options = {
  departments: [],
  devices: [],
  rules: [],
  templates: [],
};
export function StatusFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { _id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Select
        value={value || "all"}
        onValueChange={(v) => onChange(v === "all" ? "" : v)}
      >
        <SelectTrigger
          aria-label={label}
          className="w-full min-w-0 [&>span]:truncate"
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{label}: Tümü</SelectItem>
          {options.map((o) => (
            <SelectItem key={o._id} value={o._id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export default function StatusPage() {
  const { projectId, isAdmin } = useActiveProject();
  if (!isAdmin) return null;
  if (!projectId) return <p>Önce bir proje seçin.</p>;
  return <StatusContent key={projectId} projectId={projectId} />;
}
function StatusContent({ projectId }: { projectId: Id<"projects"> }) {
  const convex = useConvex();
  const redistribute = useMutation(api.accessGrantStatus.redistribute);
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"person" | "device">("person");
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [rows, setRows] = useState<GrantRow[]>([]);
  const [projectCounts, setProjectCounts] = useState<Counts | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, Counts>>({});
  const [expanded, setExpanded] = useState<Id<"devices">>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<number>();
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Pair[]>([]);
  const [action, setAction] = useState<"selected" | "failed" | "all" | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [runId, setRunId] = useState<Id<"deviceSyncRuns"> | null>(null);
  const [employee, setEmployee] = useState<GrantRow | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const generation = useRef(0);
  const actionLock = useRef(false);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
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
  useEffect(() => {
    let alive = true;
    async function loadOptions() {
      const [departments, devices, templates] = await Promise.all([
        convex.query(api.departments.list, { projectId }),
        convex.query(api.devices.list, { projectId }),
        convex.query(api.accessScheduleTemplates.list, {
          projectId,
          includeArchived: true,
        }),
      ]);
      const rules: Options["rules"] = [];
      let next: string | null = null;
      do {
        const page: FunctionReturnType<typeof api.accessRules.listSummaries> =
          await convex.query(api.accessRules.listSummaries, {
            projectId,
            paginationOpts: { numItems: 50, cursor: next },
          });
        rules.push(...page.page.map((r) => ({ _id: r._id, name: r.name })));
        next = page.isDone ? null : page.continueCursor;
      } while (next && alive);
      if (alive) setOptions({ departments, devices, templates, rules });
    }
    void loadOptions().catch((e) => {
      if (alive) setError(errorMessage(e));
    });
    return () => {
      alive = false;
    };
  }, [convex, projectId]);
  const listFilters = useMemo(
    () => ({
      ...filters,
      deviceId: view === "device" ? expanded : filters.deviceId,
    }),
    [filters, view, expanded],
  );
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
  }, [convex, projectId, filters.departmentId, revision]);
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
  ]);
  useEffect(() => {
    if (view !== "device") return;
    let alive = true;
    setDeviceCounts({});
    void Promise.all(
      options.devices
        .filter((d) => !filters.deviceId || d._id === filters.deviceId)
        .map(
          async (device) =>
            [
              device._id,
              await convex.query(api.accessGrantStatus.counts, {
                projectId,
                deviceId: device._id,
                departmentId: filters.departmentId,
              }),
            ] as const,
        ),
    )
      .then((entries) => {
        if (alive) setDeviceCounts(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [
    convex,
    projectId,
    options.devices,
    filters.departmentId,
    filters.deviceId,
    revision,
    view,
  ]);
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
  async function send() {
    if (!action || actionLock.current) return;
    actionLock.current = true;
    setSending(true);
    setError("");
    try {
      const result = await redistribute({
        projectId,
        ...(action === "selected"
          ? { pairs: selected }
          : action === "failed"
            ? { onlyFailed: true }
            : {}),
      });
      setRunId(result.runId);
      setSuccess(action === "failed" ? redistributionSuccessText(result) : "");
      setAction(null);
      setSelected([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      actionLock.current = false;
      setSending(false);
    }
  }
  const change = (patch: Partial<Filters>) => {
    setExpanded(undefined);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const toggle = (pair: Pair) => {
    const next = togglePair(selected, pair);
    setSelected(next.pairs);
    if (next.error) setError(next.error);
  };
  const rowView = (
    <>
      <GrantRows
        rows={rows}
        selected={selected}
        onToggle={toggle}
        onEmployee={setEmployee}
        isAdmin
      />
      {cursor && (
        <Button variant="outline" disabled={busy} onClick={() => void more()}>
          Daha fazla yükle
        </Button>
      )}
    </>
  );
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h1 className="text-xl font-semibold">Yetki Durumu</h1>
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
      <div className="flex flex-wrap gap-2" aria-label="Durum sayaçları">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((state) => (
          <Button
            key={state}
            variant={
              (state === "all" ? !filters.state : filters.state === state)
                ? "default"
                : "outline"
            }
            disabled={state === "unknown"}
            title={
              state === "unknown"
                ? "Kayıt yok: bu özellik açılmadan önceki dağıtımlar. Kişi detayında görünür; Hatalıları/Tümünü yeniden dağıt ile dolar."
                : undefined
            }
            onClick={() => {
              if (state !== "unknown")
                change({ state: state === "all" ? undefined : state });
            }}
          >
            {labels[state]}:{" "}
            {counts ? countText(counts[state], counts.capped) : "—"}
          </Button>
        ))}
      </div>
      {counts?.capped && (
        <p className="text-xs">
          Sayaçlar sınırlı taramanın alt sınırını gösterir.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        <StatusFilter
          label="Departman"
          value={filters.departmentId}
          options={options.departments}
          onChange={(v) =>
            change({
              departmentId: options.departments.find((d) => d._id === v)?._id,
            })
          }
        />
        <StatusFilter
          label="Cihaz"
          value={filters.deviceId}
          options={options.devices}
          onChange={(v) =>
            change({ deviceId: options.devices.find((d) => d._id === v)?._id })
          }
        />
        <StatusFilter
          label="Kural"
          value={filters.ruleId}
          options={options.rules}
          onChange={(v) =>
            change({ ruleId: options.rules.find((d) => d._id === v)?._id })
          }
        />
        <StatusFilter
          label="Şablon"
          value={filters.templateId}
          options={options.templates}
          onChange={(v) =>
            change({
              templateId: options.templates.find((d) => d._id === v)?._id,
            })
          }
        />
        <StatusFilter
          label="Durum"
          value={filters.state}
          options={["effective", "pending", "failed", "removed"].map((s) => ({
            _id: s,
            name: labels[s as keyof typeof labels],
          }))}
          onChange={(v) =>
            change({
              state:
                v === "effective" ||
                v === "pending" ||
                v === "failed" ||
                v === "removed"
                  ? v
                  : undefined,
            })
          }
        />
        <Input
          aria-label="Ad ara"
          placeholder="Ad ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Görünüm">
        <Button
          variant={view === "person" ? "default" : "outline"}
          onClick={() => setView("person")}
        >
          Kişi
        </Button>
        <Button
          variant={view === "device" ? "default" : "outline"}
          onClick={() => setView("device")}
        >
          Cihaz
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="whitespace-normal h-auto min-h-10"
          disabled={!selected.length || sending}
          onClick={() => {
            setError("");
            setAction("selected");
          }}
        >
          Seçilileri yeniden dağıt ({selected.length}/100)
        </Button>
        <Button
          className="whitespace-normal h-auto min-h-10"
          variant="outline"
          disabled={sending || !projectCounts?.failed}
          onClick={() => {
            setError("");
            setAction("failed");
          }}
        >
          Hatalıları yeniden dağıt ({countText(projectCounts?.failed ?? 0, projectCounts?.capped ?? false)})
        </Button>
        <Button
          className="whitespace-normal h-auto min-h-10"
          variant="outline"
          disabled={sending || !projectCounts}
          onClick={() => {
            setError("");
            setAction("all");
          }}
        >
          Tümünü yeniden dağıt
        </Button>
      </div>
      {error && !action && (
        <p role="alert" className="text-danger break-words">
          {error}
        </p>
      )}
      <EmptyStatus />
      <p className="text-xs text-muted-foreground">
        Hik kapı bilgisi kural kapsamından türetilir; dağıtım cihaz
        düzeyindedir. Sayaçlar proje/departman kapsamındadır; diğer filtreler
        kişi listesini daraltır.
      </p>
      {busy && <p role="status">Yükleniyor…</p>}
      {view === "person" ? (
        <>
          {!busy && rows.length === 0 && (
            <p>Bu filtrelerde kayıt bulunamadı.</p>
          )}
          {rowView}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs">
            Cihaz sayaçları kayıtlı çiftleri gösterir (departman filtresi
            uygulanır).
          </p>
          {options.devices
            .filter((d) => !filters.deviceId || d._id === filters.deviceId)
            .map((device) => (
              <article
                key={device._id}
                className="border rounded-md p-3 min-w-0 space-y-3"
              >
                <Button
                  variant="ghost"
                  className="whitespace-normal h-auto text-left break-words max-w-full"
                  aria-expanded={expanded === device._id}
                  onClick={() =>
                    setExpanded(
                      expanded === device._id ? undefined : device._id,
                    )
                  }
                >
                  {device.name}
                </Button>
                {deviceCounts[device._id] ? (
                  <DeviceCounters
                    effective={countText(
                      deviceCounts[device._id].effective,
                      deviceCounts[device._id].capped,
                    )}
                    pending={countText(
                      deviceCounts[device._id].pending,
                      deviceCounts[device._id].capped,
                    )}
                    failed={countText(
                      deviceCounts[device._id].failed,
                      deviceCounts[device._id].capped,
                    )}
                  />
                ) : (
                  <p>Sayaçlar yükleniyor…</p>
                )}
                {expanded === device._id && (
                  <>
                    {!busy && !rows.length && (
                      <p>Bu filtrelerde kayıt bulunamadı.</p>
                    )}
                    {rowView}
                  </>
                )}
              </article>
            ))}
        </div>
      )}
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !sending) {
            setAction(null);
            setError("");
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeniden dağıtım onayı</DialogTitle>
            <DialogDescription>
              {action === "failed"
                ? failedConfirmationText(projectCounts?.failed ?? 0, projectCounts?.capped ?? false)
                : confirmationText(
                    action === "selected"
                      ? selected.length
                      : countText(projectCounts?.all ?? 0, projectCounts?.capped ?? false),
                  )}
            </DialogDescription>
          </DialogHeader>
          {action !== "selected" && (
            <p className="text-sm">
              {action === "failed"
                ? "Projedeki hatalı kayıtlar indeks sırasıyla değerlendirilir (tur başına en çok 100)."
                : "Projenin tüm yetkili kişi ve cihazları değerlendirilir. Görünen sayı kayıt ve bilinmeyen çiftlerin toplamıdır; gerçek kapsam güncel yetkilere göre belirlenir."}{" "}
              Liste filtreleri gönderim kapsamını daraltmaz.
            </p>
          )}
          {error && (
            <p role="alert" className="text-danger break-words">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={sending}
              onClick={() => {
                setAction(null);
                setError("");
              }}
            >
              Vazgeç
            </Button>
            <Button disabled={sending} onClick={() => void send()}>
              {sending ? "Başlatılıyor…" : "Onayla ve gönder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!employee}
        onOpenChange={(open) => {
          if (!open) setEmployee(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{employee?.employeeName ?? "Kişi detayı"}</SheetTitle>
            <SheetDescription>
              Cihaz dağıtımları ve güncel kural yetkileri
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {detailError ? (
              <p role="alert">{detailError}</p>
            ) : detail ? (
              <EmployeeStatus detail={detail} />
            ) : (
              <p>Yükleniyor…</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
