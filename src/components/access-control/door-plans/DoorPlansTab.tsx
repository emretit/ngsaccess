import { TableStateRow } from "@/components/shared/TableStateRow";
import { pastAttemptText } from "@/lib/pastAttempt";
import { CopyDoorPlansDialog } from "./CopyDoorPlansDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
import { DoorPlanDialog, type DoorPlanTarget } from "./DoorPlanDialog";
import { MAX_BULK_DOORS } from "./bulk";
import { formatTrDateTime } from "@/lib/date";
import {
  DOOR_STATUS_DAYS,
  type DoorStatusInterval,
} from "../../../../convex/lib/doorStatusPlan";
import { WEEKDAYS } from "../unified/components/weekdays";

const modes: Record<string, string> = {
  remainOpen: "sürekli açık",
  remainClosed: "sürekli kilitli",
  normal: "normal",
  card: "Kart",
  face: "Yüz",
  fp: "Parmak izi",
  cardOrFace: "Kart veya yüz",
  cardAndPw: "Kart + şifre",
  cardAndFace: "Kart + yüz",
  faceAndCard: "Kart + yüz",
};
const days = WEEKDAYS.map((day) => day.short);
function statusSummary(plan: DoorPlanTarget["hikDoorStatusPlan"]) {
  if (!plan?.enabled) return "Plan etkin değil";
  const interval = (segment: DoorStatusInterval) =>
    `${segment.beginTime.slice(0, 5)}–${segment.endTime.slice(0, 5)} ${modes[segment.mode]}`;
  if (!plan.weekly) return `Her gün ${interval(plan)}`;
  const groups: { first: number; last: number; summary: string }[] = [];
  DOOR_STATUS_DAYS.forEach((day, index) => {
    const summary = plan.weekly
      ?.find((row) => row.day === day)
      ?.segments.map(interval)
      .join(", ");
    if (!summary) return;
    const previous = groups[groups.length - 1];
    if (previous && previous.last === index - 1 && previous.summary === summary)
      previous.last = index;
    else groups.push({ first: index, last: index, summary });
  });
  return (
    groups
      .map(
        (group) =>
          `${days[group.first]}${group.first === group.last ? "" : `–${days[group.last]}`} ${group.summary}`,
      )
      .join("; ") || "Aralık yok"
  );
}
export function DoorPlansTab() {
  const navigate = useNavigate();
  const devicesAction = { label: "Cihazlara git", onClick: () => navigate("/devices") };
  const scopeDescription = "Kapı planları Hikvision gateway kapılarında desteklenir.";
  const { projectId, loading } = useActiveProjectScope();
  const targets = useQuery(
    api.doors.listPlanTargets,
    projectId ? { projectId } : "skip",
  );
  const [selected, setSelected] = useState<{
    projectId: typeof projectId;
    door: DoorPlanTarget;
  } | null>(null);
  const [selection, setSelection] = useState<{
    projectId: typeof projectId;
    ids: Id<"doors">[];
  }>({ projectId, ids: [] });
  const [copyProject, setCopyProject] = useState<typeof projectId>(undefined);
  const [searchState, setSearch] = useState({ projectId, value: "" });
  const search = searchState.projectId === projectId ? searchState.value : "";
  const term = search.trim().toLocaleLowerCase("tr");
  const doors = targets ?? [];
  const filtered = doors.filter(door => !term || [door.doorName, door.deviceName, door.zoneName ?? ""].join(" ").toLocaleLowerCase("tr").includes(term));
  const pageScope = `${projectId ?? ""}:${search}`;
  const [pageState, setPage] = useState({ scope: pageScope, value: 1 });
  const changeSearch = (value: string) => {
    setSearch({ projectId, value });
    setPage({ scope: `${projectId ?? ""}:${value}`, value: 1 });
  };
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const page = Math.min(pageCount, pageState.scope === pageScope ? pageState.value : 1);
  const visible = filtered.slice((page - 1) * 20, page * 20);
  const selectedDoor = selected && selected.projectId === projectId
    ? targets?.find(door => door.doorId === selected.door.doorId)
    : undefined;
  const checked =
    selection.projectId === projectId
      ? selection.ids.filter((id) =>
          visible.some((door) => door.doorId === id),
        )
      : [];
  if (loading)
    return (
      <div className="space-y-4 min-w-0">
        <p role="status">Kapı planları yükleniyor…</p>
      </div>
    );
  if (!projectId)
    return (
      <div className="space-y-4 min-w-0">
        <EmptyState title="Bir proje seçin" description="Kapı planlarını görmek için üst çubuktan proje seçin." />
      </div>
    );
  return (
    <div className="space-y-4 min-w-0">
      <FilterBar search={search} onSearchChange={changeSearch}
        searchLabel="Kapı, cihaz veya bölge ara" placeholder="Kapı, cihaz veya bölge…"
        onClear={() => changeSearch("")} />
      {checked.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-sm">
            {checked.length} kapı seçildi (en fazla {MAX_BULK_DOORS})
          </span>
          <Button
            className="min-h-11"
            disabled={!checked.length || checked.length > MAX_BULK_DOORS}
            onClick={() => setCopyProject(projectId)}
          >
            Planı kopyala
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{scopeDescription}</p>
      <Table resizeKey="door-plans" className="block w-full md:table">
        <TableHeader className="block md:table-header-group">
          <TableRow className="block md:table-row">
            <TableHead columnId="select" resizable={false} resizeLabel="Kapı seçimi" className="block h-auto px-0 md:table-cell md:h-9 md:px-4">
              <label className="flex items-center gap-2 min-h-11 md:min-h-0">
                <input
                  className="size-5"
                  type="checkbox"
                  aria-label={pageCount > 1 ? "Bu sayfadaki kapıları seç" : "Tüm kapıları seç"}
                  disabled={targets === undefined || visible.length === 0}
                  checked={
                    checked.length > 0 &&
                    checked.length === Math.min(visible.length, MAX_BULK_DOORS)
                  }
                  onChange={(event) =>
                    setSelection({
                      projectId,
                      ids: event.target.checked
                        ? visible
                            .slice(0, MAX_BULK_DOORS)
                            .map((door) => door.doorId)
                        : [],
                    })
                  }
                />
                <span className="md:hidden">{pageCount > 1 ? "Bu sayfadaki kapıları seç" : "Tüm kapıları seç"}</span>
              </label>
            </TableHead>
            {[["door", "Kapı"], ["plan", "Plan"], ["delivery", "Gönderim"]].map(([id, label]) => (
              <TableHead columnId={id} className="hidden md:table-cell" key={label}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="block space-y-3 md:table-row-group md:space-y-0">
          {targets === undefined ? <TableStateRow colSpan={4} state="loading" label="Kapı planları yükleniyor…" /> : filtered.length === 0 ? <TableStateRow colSpan={4} state="empty" title={term ? "Aramaya uygun kapı bulunamadı" : "Plan kurulabilecek Hikvision kapısı yok"} description={term ? "Kapı, cihaz veya bölge adını değiştirin." : scopeDescription} action={term ? undefined : devicesAction} /> : null}
          {visible.map((door) => (
            <TableRow
              key={door.doorId}
              className={`${ROW_CLICK_CLASS} flex flex-col rounded-lg border max-md:last:border! p-3 min-w-0 md:table-row md:rounded-none md:border-x-0 md:border-t-0 md:p-0 [&>td]:block [&>td]:p-1 [&>td]:h-auto [&>td]:min-w-0 [&>td]:break-words md:[&>td]:table-cell md:[&>td]:px-4 md:[&>td]:py-2 md:[&>td]:h-[42px]`}
              onClick={onRowActivate(() => setSelected({ projectId, door }))}
            >
              <TableCell
                className="order-1"
                onClick={(event) => event.stopPropagation()}
              >
                <label className="flex items-center gap-2 min-h-11 md:min-h-0">
                  <input
                    className="size-5"
                    type="checkbox"
                    aria-label={`${door.doorName} seç`}
                    checked={checked.includes(door.doorId)}
                    disabled={
                      !checked.includes(door.doorId) &&
                      checked.length >= MAX_BULK_DOORS
                    }
                    onChange={(event) =>
                      setSelection({
                        projectId,
                        ids: event.target.checked
                          ? [...checked, door.doorId]
                          : checked.filter((id) => id !== door.doorId),
                      })
                    }
                  />
                  <span className="text-sm md:hidden">Kopyalamak için seç</span>
                </label>
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  title={door.doorName}
                  className="min-h-11 md:min-h-0 md:block md:max-w-full md:truncate text-left font-medium rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelected({ projectId, door })}
                  aria-label={`${door.doorName} kapı planlarını düzenle`}
                >
                  {door.doorName}
                </button>
                <p className="text-xs text-muted-foreground">
                  <span className="md:inline-block md:max-w-full md:truncate md:align-middle" title={door.deviceName}>{door.deviceName}</span>{" "}
                  {!door.deviceOnline && (
                    <StatusBadge tone="warning">Çevrimdışı</StatusBadge>
                  )}
                </p>
              </TableCell>
              <TableCell
                className="order-3 text-sm"
              >
                <p className="line-clamp-1 md:line-clamp-none md:truncate" title={door.hikDoorStatusPlan?.enabled ? statusSummary(door.hikDoorStatusPlan) : door.hikVerifyPlan?.enabled ? "Doğrulama planı etkin" : door.hikDoorHolidayPlan?.enabled ? `${door.hikDoorHolidayPlan.year} tatil planı etkin` : "Plan etkin değil"}>
                  {door.hikDoorStatusPlan?.enabled
                    ? door.hikDoorStatusPlan.weekly
                      ? `Haftalık · ${door.hikDoorStatusPlan.weekly.reduce((n, day) => n + day.segments.length, 0)} aralık`
                      : statusSummary(door.hikDoorStatusPlan)
                    : door.hikVerifyPlan?.enabled
                      ? "Doğrulama planı etkin"
                      : door.hikDoorHolidayPlan?.enabled
                        ? `${door.hikDoorHolidayPlan.year} tatil planı etkin`
                        : "Plan etkin değil"}
                </p>
                <details onClick={(event) => event.stopPropagation()}>
                  <summary className="min-h-11 cursor-pointer py-3">
                    Plan ayrıntıları
                  </summary>
                  <p>Bölge: {door.zoneName ?? "—"}</p>
                  <p>Durum planı: {statusSummary(door.hikDoorStatusPlan)}</p>
                  <p>
                    Doğrulama planı:{" "}
                    {door.hikVerifyPlan?.enabled
                      ? door.hikVerifyPlan.weekly
                        ? door.hikVerifyPlan.weekly
                            .map(
                              (day) =>
                                `${days[DOOR_STATUS_DAYS.indexOf(day.day)]}: ${day.segments.map((segment) => `${segment.beginTime}–${segment.endTime} ${modes[segment.verifyMode] ?? segment.verifyMode}`).join(", ") || "Aralık yok"}`,
                            )
                            .join("; ")
                        : `${door.hikVerifyPlan.beginTime}–${door.hikVerifyPlan.endTime} ${modes[door.hikVerifyPlan.verifyMode] ?? door.hikVerifyPlan.verifyMode}`
                      : "Plan etkin değil"}
                  </p>
                  {door.hikDoorHolidayPlan?.enabled && (
                    <p>
                      Tatil: {door.hikDoorHolidayPlan.year} ·{" "}
                      {modes[door.hikDoorHolidayPlan.mode]}
                    </p>
                  )}
                </details>
              </TableCell>
              <TableCell
                className="order-2 rounded bg-muted/50 text-sm font-medium md:bg-transparent md:font-normal"
                aria-label={`${door.doorName} gönderim durumu`}
              >
                <span className="md:hidden">Gönderim: </span>
                {door.hikPlanApplyError ? (
                  <>
                    <p>Son gönderim başarısız</p>
                    <p className="text-xs">
                      {pastAttemptText(
                        door.hikPlanFailedAt,
                        door.hikPlanApplyError,
                      )}
                    </p>
                    {door.deviceOnline && (
                      <p className="text-xs">Cihaz şu an çevrimiçi</p>
                    )}
                    <details onClick={(event) => event.stopPropagation()}>
                      <summary className="min-h-11 cursor-pointer py-3">
                        Hata ayrıntısı
                      </summary>
                      <p>{door.hikPlanApplyError}</p>
                    </details>
                  </>
                ) : door.plansPending ? (
                  door.pendingReason ?? "Kaydedildi, gönderilmedi"
                ) : door.hikPlanAppliedAt ? (
                  `Gönderildi ${formatTrDateTime(new Date(door.hikPlanAppliedAt))}`
                ) : (
                  "Gönderilmedi"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageCount > 1 && <PaginationBar page={page} pageCount={pageCount}
        summary={`${pageRange(filtered.length, page, 20)} / ${filtered.length} kapı`}
        onPrevious={() => setPage({ scope: pageScope, value: page - 1 })}
        onNext={() => setPage({ scope: pageScope, value: page + 1 })} />}
      {copyProject === projectId && checked.length > 0 && (
        <CopyDoorPlansDialog
          key={projectId}
          targets={doors}
          selectedIds={checked}
          onClose={() => setCopyProject(undefined)}
        />
      )}
      {selectedDoor && (
        <DoorPlanDialog
          key={`${projectId}:${selectedDoor.doorId}`}
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          onSuccess={() => setSelected(null)}
          door={selectedDoor}
        />
      )}
    </div>
  );
}
