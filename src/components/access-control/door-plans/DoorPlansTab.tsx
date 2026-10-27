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
  if (!plan?.enabled) return "Kapalı";
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
  if (loading || (projectId && targets === undefined))
    return <p role="status">Kapı planları yükleniyor…</p>;
  if (!projectId || !targets?.length)
    return <EmptyState title="Plan kurulabilecek Hikvision kapısı yok" />;
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm">
          {checked.length} kapı seçildi (en fazla {MAX_BULK_DOORS})
        </span>
        <Button
          disabled={!checked.length || checked.length > MAX_BULK_DOORS}
          onClick={() => setCopyProject(projectId)}
        >
          Planı kopyala
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <input
                type="checkbox"
                aria-label="Tüm kapıları seç"
                checked={
                  checked.length > 0 &&
                  checked.length === Math.min(targets.length, MAX_BULK_DOORS)
                }
                onChange={(event) =>
                  setSelection({
                    projectId,
                    ids: event.target.checked
                      ? targets.slice(0, MAX_BULK_DOORS).map((door) => door.doorId)
                      : [],
                  })
                }
              />
            </TableHead>
            {[
              "Kapı",
              "Cihaz",
              "Bölge",
              "Durum planı",
              "Doğrulama planı",
              "Gönderim",
            ].map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((door) => (
            <TableRow
              key={door.doorId}
              className={ROW_CLICK_CLASS}
              onClick={onRowActivate(() => setSelected({ projectId, door }))}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`${door.doorName} seç`}
                  checked={checked.includes(door.doorId)}
                  disabled={
                    !checked.includes(door.doorId) && checked.length >= MAX_BULK_DOORS
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
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  className="text-left font-medium rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelected({ projectId, door })}
                  aria-label={`${door.doorName} kapı planlarını düzenle`}
                >
                  {door.doorName}
                </button>
              </TableCell>
              <TableCell>
                {door.deviceName}{" "}
                {!door.deviceOnline && (
                  <StatusBadge tone="warning">Çevrimdışı</StatusBadge>
                )}
              </TableCell>
              <TableCell>{door.zoneName ?? "—"}</TableCell>
              <TableCell>
                {door.templateName && <p>Şablon: {door.templateName}</p>}
                {statusSummary(door.hikDoorStatusPlan)}
                {door.templateChanged && (
                  <p className="text-amber-700 dark:text-amber-400">
                    Şablon değişti — yeniden gönder
                  </p>
                )}
                {door.hikDoorHolidayPlan?.enabled && (
                  <p>
                    Tatil: {door.hikDoorHolidayPlan.year} ·{" "}
                    {modes[door.hikDoorHolidayPlan.mode]}
                  </p>
                )}
              </TableCell>
              <TableCell>
                {door.hikVerifyPlan?.enabled
                  ? door.hikVerifyPlan.weekly
                    ? `Haftalık · ${door.hikVerifyPlan.weekly.reduce((n, day) => n + day.segments.length, 0)} aralık`
                    : `${door.hikVerifyPlan.beginTime.slice(0, 5)}–${door.hikVerifyPlan.endTime.slice(0, 5)} ${modes[door.hikVerifyPlan.verifyMode] ?? door.hikVerifyPlan.verifyMode}`
                  : "Kapalı"}
              </TableCell>
              <TableCell>
                {door.hikPlanApplyError
                  ? `Hata: ${door.hikPlanApplyError}`
                  : door.plansPending
                    ? "Kaydedildi, gönderilmedi"
                    : door.hikPlanAppliedAt
                      ? `Gönderildi ${formatTrDateTime(new Date(door.hikPlanAppliedAt))}`
                      : "Gönderilmedi"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {copyProject === projectId && checked.length > 0 && (
        <CopyDoorPlansDialog
          key={projectId}
          targets={targets}
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
    </>
  );
}
