import { TableStateRow } from "@/components/shared/TableStateRow";
import { pastAttemptText } from "@/lib/pastAttempt";
import { CopyDoorPlansDialog } from "./CopyDoorPlansDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { EmptyState } from "@/components/shared/EmptyState";
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
  fp: "Parmak İzi",
  cardOrFace: "Kart veya Yüz",
  cardAndPw: "Kart + Şifre",
  cardAndFace: "Kart + Yüz",
  faceAndCard: "Kart + Yüz",
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
  const checked =
    selection.projectId === projectId
      ? selection.ids.filter((id) =>
          targets?.some((door) => door.doorId === id),
        )
      : [];
  const heading = (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold">Kapı Planları</h1>
      <p className="text-sm text-muted-foreground">
        Kapının herkes için ne zaman sürekli açık ya da kilitli kalacağını
        belirleyin.
      </p>
    </div>
  );
  if (loading)
    return (
      <div className="space-y-4 min-w-0">
        {heading}
        <p role="status">Kapı planları yükleniyor…</p>
      </div>
    );
  if (!projectId)
    return (
      <div className="space-y-4 min-w-0">
        {heading}
        <EmptyState title="Plan kurulabilecek Hikvision kapısı yok" />
      </div>
    );
  const doors = targets ?? [];
  return (
    <div className="space-y-4 min-w-0">
      {heading}
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
      <Table className="block w-full md:table">
        <TableHeader className="block md:table-header-group">
          <TableRow className="block md:table-row">
            <TableHead className="block h-auto px-0 md:table-cell md:h-9 md:px-4">
              <label className="flex items-center gap-2 min-h-11 md:min-h-0">
                <input
                  className="size-5"
                  type="checkbox"
                  aria-label="Tüm kapıları seç"
                  disabled={targets === undefined || doors.length === 0}
                  checked={
                    checked.length > 0 &&
                    checked.length === Math.min(doors.length, MAX_BULK_DOORS)
                  }
                  onChange={(event) =>
                    setSelection({
                      projectId,
                      ids: event.target.checked
                        ? doors
                            .slice(0, MAX_BULK_DOORS)
                            .map((door) => door.doorId)
                        : [],
                    })
                  }
                />
                <span className="md:hidden">Tüm kapıları seç</span>
              </label>
            </TableHead>
            {["Kapı", "Plan", "Gönderim"].map((label) => (
              <TableHead className="hidden md:table-cell" key={label}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="block space-y-3 md:table-row-group md:space-y-0">
          {targets === undefined ? <TableStateRow colSpan={4} state="loading" label="Kapı planları yükleniyor…" /> : doors.length === 0 ? <TableStateRow colSpan={4} state="empty" title="Plan kurulabilecek Hikvision kapısı yok" /> : null}
          {doors.map((door) => (
            <TableRow
              key={door.doorId}
              className={`${ROW_CLICK_CLASS} flex flex-col rounded-lg border p-3 min-w-0 md:table-row md:rounded-none md:border-x-0 md:border-t-0 md:p-0 [&>td]:block [&>td]:p-1 [&>td]:h-auto [&>td]:min-w-0 [&>td]:break-words md:[&>td]:table-cell md:[&>td]:px-4 md:[&>td]:py-2 md:[&>td]:h-[42px]`}
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
                  className="min-h-11 md:min-h-0 text-left font-medium rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelected({ projectId, door })}
                  aria-label={`${door.doorName} kapı planlarını düzenle`}
                >
                  {door.doorName}
                </button>
                <p className="text-xs text-muted-foreground">
                  {door.deviceName}{" "}
                  {!door.deviceOnline && (
                    <StatusBadge tone="warning">Çevrimdışı</StatusBadge>
                  )}
                </p>
              </TableCell>
              <TableCell
                className="order-3 text-sm"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="line-clamp-1">
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
                <details>
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
                  "Kaydedildi, gönderilmedi"
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
      {copyProject === projectId && checked.length > 0 && (
        <CopyDoorPlansDialog
          key={projectId}
          targets={doors}
          selectedIds={checked}
          onClose={() => setCopyProject(undefined)}
        />
      )}
      {selected?.projectId === projectId && (
        <DoorPlanDialog
          key={`${projectId}:${selected.door.doorId}`}
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          onSuccess={() => setSelected(null)}
          door={selected.door}
        />
      )}
    </div>
  );
}
