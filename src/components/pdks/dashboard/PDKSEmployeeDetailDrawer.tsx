import { DetailFieldList } from "@/components/shared/DetailFieldList";
import { PdksDaySegments } from "./PdksDaySegments";
import { PdksPlanSummary } from "./PdksPlanSummary";
import { PdksFlexibleTarget } from "./PdksFlexibleTarget";
import { planDayLabel } from "../lib/presentation";
import { usePermissions } from "@/hooks/usePermissions";
import { restorePdksFocus } from "../lib/focus";
import { Component, useState, type ReactNode } from "react";
import { PdksExcludedReadingsNotice } from "./PdksExcludedReadingsNotice";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ManualPdksEditDialog } from "../ManualPdksEditDialog";
import { statusMetaFor } from "../statusMeta";
import {
  reviewHint,
  leaveLabel,
  displayTime,
  displayDuration,
  readableDate,
} from "../lib/presentation";
import { PDKSAuditTimeline } from "./PDKSAuditTimeline";
import { errorMessage } from "@/lib/notify";
interface Props {
  open: boolean;
  returnFocusTo?: HTMLElement | null;
  onOpenChange: (open: boolean) => void;
  employeeId: Id<"employees"> | null;
  startDate: string;
  endDate: string;
  highlightDate?: string;
}
class DetailBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: errorMessage(error) };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const denied = /yetki|erişim|izin|unauthor|forbidden/i.test(
      this.state.error,
    );
    return (
      <div role="alert" className="p-4 space-y-3">
        <h3>
          {denied
            ? "Bu gün detayına erişim izniniz yok."
            : "Gün detayı yüklenemedi."}
        </h3>
        <Button
          variant="outline"
          onClick={() => this.setState({ error: null })}
        >
          Yeniden dene
        </Button>
      </div>
    );
  }
}
export function PDKSEmployeeDetailDrawer(props: Props) {
  const { projectId } = useActiveProject();
  return (
    <DetailSheet
      open={props.open}
      onRequestClose={() => props.onOpenChange(false)}
      scroll="all"
      bodyClassName="pt-4"
      title="Çalışan · gün detayı"
      description="Günlük devam bilgileri ve hareketler."
      contentProps={{
        className: "sm:max-w-lg",
        onCloseAutoFocus: event => restorePdksFocus(event, props.returnFocusTo),
      }}
    >
      {props.open && props.employeeId && (
        <DetailBoundary
          key={`${projectId}:${props.employeeId}:${props.highlightDate}:${props.startDate}:${props.endDate}`}
        >
          <Detail {...props} employeeId={props.employeeId} />
        </DetailBoundary>
      )}
    </DetailSheet>
  );
}
function Detail({
  employeeId,
  startDate,
  endDate,
  highlightDate,
}: Props & { employeeId: Id<"employees"> }) {
  const { projectId } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("attendance.approve");
  const detail = useQuery(api.cardReadings.getEmployeeAttendanceDetail, can("reports.view") && projectId ? {
    projectId,
    employeeId,
    startDate: highlightDate ?? startDate,
    endDate: highlightDate ?? endDate,
  } : "skip");
  const [manualTrigger, setManualTrigger] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  if (!can("reports.view")) return null;
  if (detail === undefined)
    return <SectionSkeleton rows={6} label="Gün detayı yükleniyor." />;
  if (detail === null)
    return (
      <EmptyState
        title="Çalışan veya gün detayı bulunamadı."
        description="Seçili projeyi ve tarihi kontrol edin."
      />
    );
  const name = `${detail.employee.firstName} ${detail.employee.lastName}`;
  return (
    <div className="mt-5 min-w-0 space-y-4">
      <h2 className="text-lg font-semibold break-words">{name}</h2>
      <PdksExcludedReadingsNotice count={detail.excludedUnknownReadings} />
      {(detail.summary.incompleteDays ?? 0) > 0 && <p className="text-sm">İnceleme: {detail.summary.incompleteDays}</p>}
      {detail.days.map((day) => (
        <section key={day.date} className="space-y-4 border-t pt-4">
          <h3 className="font-medium">{readableDate(day.date)}</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={statusMetaFor(day).tone}>
              {statusMetaFor(day).label}
            </StatusBadge>
            {day.isEarlyExit && (
              <StatusBadge tone="warning">Erken çıkış</StatusBadge>
            )}
            {day.isManual && <StatusBadge tone="neutral">Manuel</StatusBadge>}
            <span className="text-sm text-muted-foreground">
              {detail.employee.department}
            </span>
          </div>
          <PdksPlanSummary day={day} />
          {!day.noShift && <PdksFlexibleTarget day={day} className="block text-sm tabular-nums" />}
          {reviewHint(day) && <p className="text-sm text-muted-foreground">{reviewHint(day)}</p>}
          <DetailFieldList columns={2} fields={[
            { key: "entry", label: "İlk giriş", value: displayTime(day.firstEntry) },
            { key: "exit", label: "Son çıkış", value: `${displayTime(day.lastExit)}${day.exitNextDay ? " (ertesi gün)" : ""}` },
            { key: "raw", label: "Brüt süre", value: displayDuration(day.rawTotalMinutes ?? day.totalMinutes, day.status, day.durationMeasured) },
            { key: "total", label: "Toplam süre (mola sonrası)", value: displayDuration(day.totalMinutes, day.status, day.durationMeasured) },
            { key: "overtime", label: "Fazla mesai", value: displayDuration(day.overtimeMinutes, day.status, day.durationMeasured) },
            { key: "night", label: "Gece süresi", value: displayDuration(day.nightMinutes ?? 0, day.status, day.durationMeasured) },
          ].map(field => ({ ...field, numeric: true, value: day.noShift ? "—" : field.value }))} />
          <PdksDaySegments day={day} />
          <div className="space-y-1 text-xs text-muted-foreground">
            {day.leaveType && <p>İzin türü: {leaveLabel(day.leaveType)}</p>}
            <p>Gün kodu: {day.payrollCode || "—"}</p>
            <p>Kart no: {detail.employee.cardNumber || "—"}</p>
            {detail.employee.payrollCode && (
              <p>Bordro no: {detail.employee.payrollCode}</p>
            )}
            {detail.employee.company && (
              <p>Şirket: {detail.employee.company}</p>
            )}
            {detail.employee.position && (
              <p>Pozisyon: {detail.employee.position}</p>
            )}
            {!planDayLabel(day) && detail.employee.shift && <p>Vardiya: {detail.employee.shift}</p>}
          </div>
          {day.manualNote && (
            <div className="border-y py-3 text-sm">
              <h4 className="font-medium">Manuel düzeltme gerekçesi</h4>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {day.manualNote}
              </p>
            </div>
          )}
          <div>
            <h4 className="mb-2 text-sm font-medium">Hareketler</h4>
            {day.rawReadings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu gün için hareket kaydı yok.
              </p>
            ) : (
              <ul className="divide-y">
                {day.rawReadings.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-3 py-2 text-xs">
                    <span className="tabular-nums">{r.time}</span>
                    <span>
                      {r.direction === "entry"
                        ? "Giriş"
                        : r.direction === "exit"
                          ? "Çıkış"
                          : "Yön belirtilmemiş"}
                    </span>
                    <span className="text-muted-foreground">
                      {r.accessStatus === "izin_verildi"
                        ? "İzin verildi"
                        : "Reddedildi"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <details className="border-y py-3">
            <summary className="cursor-pointer text-sm">
              Değişiklik geçmişi
            </summary>
            <PDKSAuditTimeline
              employeeId={employeeId}
              startDate={day.date}
              endDate={day.date}
            />
          </details>
          {canManage && day.status !== "future" && (
            <Button onClick={event => { setManualTrigger(event.currentTarget); setEditing(day.date); }}>Manuel düzelt</Button>
          )}
          {editing === day.date && day.status !== "future" && (
            <ManualPdksEditDialog
              open
              returnFocusTo={manualTrigger}
              employeeId={employeeId}
              employeeName={name}
              date={day.date}
              isOvernightShift={day.isOvernightShift}
              initialEntry={day.firstEntry ?? ""}
              initialExit={day.lastExit ?? ""}
              onClose={() => setEditing(null)}
            />
          )}
        </section>
      ))}
    </div>
  );
}
