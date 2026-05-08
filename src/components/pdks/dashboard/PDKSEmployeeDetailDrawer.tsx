import { useState } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronDown, ChevronRight, User, Clock, Calendar as CalendarIcon, Briefcase } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PDKSEmployeeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: Id<"employees"> | null;
  startDate: string;
  endDate: string;
  highlightDate?: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  present: { label: "Mevcut", variant: "default", className: "bg-green-500 hover:bg-green-500" },
  late: { label: "Geç", variant: "default", className: "bg-yellow-500 hover:bg-yellow-500" },
  absent: { label: "Devamsız", variant: "destructive" },
  leave: { label: "İzinli", variant: "default", className: "bg-blue-500 hover:bg-blue-500" },
  weekend: { label: "Hafta sonu", variant: "outline" },
  holiday: { label: "Tatil", variant: "outline" },
};

export function PDKSEmployeeDetailDrawer({
  open,
  onOpenChange,
  employeeId,
  startDate,
  endDate,
  highlightDate,
}: PDKSEmployeeDetailDrawerProps) {
  const [expanded, setExpanded] = useState<string | null>(highlightDate ?? null);

  const detail = useQuery(
    api.cardReadings.getEmployeeAttendanceDetail,
    open && employeeId
      ? { employeeId, startDate, endDate }
      : "skip"
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Çalışan Detayı
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!detail ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Yükleniyor...
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {/* Çalışan başlığı */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold">
                  {detail.employee.firstName} {detail.employee.lastName}
                </h2>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {detail.employee.department && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3 w-3" />
                      {detail.employee.department}
                      {detail.employee.position && ` • ${detail.employee.position}`}
                    </div>
                  )}
                  {detail.employee.shift && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Vardiya: {detail.employee.shift}
                    </div>
                  )}
                  {detail.employee.cardNumber && (
                    <div>Kart: {detail.employee.cardNumber}</div>
                  )}
                </div>
              </div>

              {/* Dönem özeti */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  {format(new Date(`${startDate}T00:00:00.000Z`), "dd MMM", { locale: tr })} -{" "}
                  {format(new Date(`${endDate}T00:00:00.000Z`), "dd MMM yyyy", { locale: tr })}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold">{detail.summary.totalHours}</div>
                    <div className="text-[10px] text-muted-foreground">Toplam saat</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-yellow-600">{detail.summary.lateDays}</div>
                    <div className="text-[10px] text-muted-foreground">Geç gün</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">{detail.summary.absentDays}</div>
                    <div className="text-[10px] text-muted-foreground">Devamsız</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{detail.summary.workedDays}</div>
                    <div className="text-[10px] text-muted-foreground">Çalışılan gün</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">{detail.summary.leaveDays}</div>
                    <div className="text-[10px] text-muted-foreground">İzinli</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-600">{detail.summary.overtimeHours}h</div>
                    <div className="text-[10px] text-muted-foreground">Mesai</div>
                  </div>
                </div>
              </div>

              {/* Gün listesi */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground px-1">
                  Gün Gün Detay
                </div>
                {detail.days.map((day) => {
                  const isOpen = expanded === day.date;
                  const isHighlight = highlightDate === day.date;
                  const badge = STATUS_BADGE[day.status] ?? STATUS_BADGE.absent;
                  const date = new Date(`${day.date}T00:00:00.000Z`);
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "rounded-md border border-border bg-card",
                        isHighlight && "ring-2 ring-primary"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : day.date)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-muted/30"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {format(date, "dd MMM EEEE", { locale: tr })}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            {day.firstEntry && <span>↗ {day.firstEntry}</span>}
                            {day.lastExit && <span>↙ {day.lastExit}</span>}
                            {day.totalMinutes > 0 && <span>· {day.totalHours}</span>}
                          </div>
                        </div>
                        <Badge variant={badge.variant} className={cn("text-[10px]", badge.className)}>
                          {badge.label}
                        </Badge>
                        {day.isManual && (
                          <Badge variant="outline" className="text-[10px]">M</Badge>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border px-3 py-2 text-xs space-y-2 bg-muted/20">
                          {day.payrollCode && (
                            <div>
                              <span className="text-muted-foreground">Bordro kodu:</span>{" "}
                              <span className="font-medium">{day.payrollCode}</span>
                            </div>
                          )}
                          {day.overtimeMinutes > 0 && (
                            <div>
                              <span className="text-muted-foreground">Mesai:</span>{" "}
                              <span className="font-medium text-purple-600">
                                {day.overtimeMinutes}dk
                              </span>
                            </div>
                          )}
                          {day.manualNote && (
                            <div className="text-amber-700 bg-amber-50 rounded px-2 py-1">
                              {day.manualNote}
                            </div>
                          )}
                          {day.rawReadings.length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-muted-foreground font-medium">
                                Kart hareketleri ({day.rawReadings.length})
                              </div>
                              {day.rawReadings.map((r) => (
                                <div
                                  key={r.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded bg-card border border-border"
                                >
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      r.accessStatus === "izin_verildi"
                                        ? "bg-green-500"
                                        : "bg-red-500"
                                    )}
                                  />
                                  <span className="font-mono text-[11px]">{r.time}</span>
                                  <span className="text-muted-foreground">
                                    {r.direction === "exit" ? "Çıkış" : "Giriş"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-muted-foreground italic">
                              Bu gün için kart hareketi yok
                            </div>
                          )}
                          <Button variant="outline" size="sm" className="w-full" disabled>
                            Manuel düzenle (yakında)
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
