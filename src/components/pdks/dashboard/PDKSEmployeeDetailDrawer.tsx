import { restorePdksFocus } from "../lib/focus";
import { Component, useState, type ReactNode } from "react";
import { PdksExcludedReadingsNotice } from "./PdksExcludedReadingsNotice";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ManualPdksEditDialog } from "../ManualPdksEditDialog";
import { STATUS_META } from "../statusMeta";
import {
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
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent onCloseAutoFocus={event => restorePdksFocus(event, props.returnFocusTo)} className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Çalışan · gün detayı</SheetTitle>
          <SheetDescription>
            Günlük devam bilgileri ve hareketler.
          </SheetDescription>
        </SheetHeader>
        {props.open && props.employeeId && (
          <DetailBoundary
            key={`${projectId}:${props.employeeId}:${props.highlightDate}:${props.startDate}:${props.endDate}`}
          >
            <Detail {...props} employeeId={props.employeeId} />
          </DetailBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
}
function Detail({
  employeeId,
  startDate,
  endDate,
  highlightDate,
}: Props & { employeeId: Id<"employees"> }) {
  const { projectId, isAdmin } = useActiveProject();
  const detail = useQuery(api.cardReadings.getEmployeeAttendanceDetail, {
    projectId,
    employeeId,
    startDate: highlightDate ?? startDate,
    endDate: highlightDate ?? endDate,
  });
  const [manualTrigger, setManualTrigger] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
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
      {detail.days.map((day) => (
        <section key={day.date} className="space-y-4 border-t pt-4">
          <h3 className="font-medium">{readableDate(day.date)}</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={STATUS_META[day.status].tone}>
              {STATUS_META[day.status].label}
            </StatusBadge>
            {day.isEarlyExit && (
              <StatusBadge tone="warning">Erken çıkış</StatusBadge>
            )}
            {day.isManual && <StatusBadge tone="neutral">Manuel</StatusBadge>}
            <span className="text-sm text-muted-foreground">
              {detail.employee.department}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
            {[
              ["İlk giriş", displayTime(day.firstEntry)],
              ["Son çıkış", `${displayTime(day.lastExit)}${day.exitNextDay ? " (ertesi gün)" : ""}`],
              ["Brüt süre", displayDuration(day.rawTotalMinutes ?? day.totalMinutes, day.status)],
              ["Toplam süre (mola sonrası)", displayDuration(day.totalMinutes, day.status)],
              ["Fazla mesai", displayDuration(day.overtimeMinutes, day.status)],
              ["Gece süresi", displayDuration(day.nightMinutes ?? 0, day.status)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
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
            {detail.employee.shift && <p>Vardiya: {detail.employee.shift}</p>}
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
          {isAdmin && day.status !== "future" && (
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
