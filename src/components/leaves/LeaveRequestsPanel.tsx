import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { dateLabel, leaveTypes } from "./lib/leaveState";

export function requestsCursor(cursor: string | null, pageLength?: number) {
  return pageLength === 0 ? null : cursor;
}

export function LeaveRequestsPanel({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const result = useQuery(api.leaveRequests.listPending, {
    projectId,
    paginationOpts: { cursor, numItems: 25 },
  });
  useEffect(() => {
    setCursor(requestsCursor(cursor, result?.page.length));
  }, [cursor, result?.page.length]);
  const approve = useMutation(api.leaveRequests.approve);
  const reject = useMutation(api.leaveRequests.reject);
  const [decision, setDecision] = useState<{
    id: Id<"leaves">;
    approve: boolean;
  } | null>(null);
  const [note, setNote] = useState("");
  const { run, pending: busy } = useAsyncAction(async (current: NonNullable<typeof decision>, decisionNote: string) => {
    if (current.approve)
      await approve({ leaveId: current.id, note: decisionNote.trim() || undefined });
    else await reject({ leaveId: current.id, note: decisionNote.trim() });
    notify.success(current.approve ? "Talep onaylandı" : "Talep reddedildi");
  }, { error: "Talep sonuçlandırılamadı" });
  const validNote = note.trim().length >= 3 && note.trim().length <= 500;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!decision || busy || (!decision.approve && !validNote)) return;
    if (await run(decision, note)) {
      setDecision(null);
    }
  }
  function open(id: Id<"leaves">, approve: boolean) {
    setNote("");
    setDecision({ id, approve });
  }
  return (
    <section className="space-y-4" aria-label="İzin talepleri">
        <div className="overflow-x-auto">
          <Table resizeKey="leave-requests">
            <TableHeader>
              <TableRow>
                <TableHead columnId="employee">Çalışan</TableHead>
                <TableHead columnId="type">Tür</TableHead>
                <TableHead columnId="dates">Tarih aralığı</TableHead>
                <TableHead columnId="days">Gün</TableHead>
                <TableHead columnId="notes">Çalışan notu</TableHead>
                <TableHead columnId="requested-at">Talep zamanı</TableHead>
                <TableHead columnId="actions" resizable={false}>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result === undefined ? (
                <TableStateRow colSpan={7} state="loading" label="Talepler yükleniyor." />
              ) : result.page.length === 0 ? (
                <TableStateRow colSpan={7} state="empty" title="Bekleyen izin talebi yok." />
              ) : result.page.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="truncate" title={row.employeeName}>
                    {row.employeeName}
                    <span className="block truncate text-xs text-muted-foreground" title={row.departmentName ?? undefined}>
                      {row.departmentName}
                    </span>
                  </TableCell>
                  <TableCell className="truncate" title={leaveTypes[row.leaveType]}>{leaveTypes[row.leaveType]}</TableCell>
                  <TableCell className="truncate" title={`${dateLabel(row.startDate)} – ${dateLabel(row.endDate)}`}>
                    {dateLabel(row.startDate)} – {dateLabel(row.endDate)}
                  </TableCell>
                  <TableCell>{row.calendarDays ?? "—"}</TableCell>
                  <TableCell className="max-w-full truncate" title={row.notes || "—"}>
                    {row.notes || "—"}
                  </TableCell>
                  <TableCell className="truncate" title={new Date(row.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}>
                    {new Date(row.createdAt).toLocaleString("tr-TR", {
                      timeZone: "Europe/Istanbul",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => open(row._id, true)}
                      >
                        Onayla
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => open(row._id, false)}
                      >
                        Reddet
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      {result && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={cursor === null || busy}
            onClick={() => setCursor(null)}
          >
            İlk sayfa
          </Button>
          <Button
            variant="outline"
            disabled={result.isDone || result.page.length === 0 || busy}
            onClick={() => setCursor(result.continueCursor)}
          >
            Sonraki sayfa
          </Button>
        </div>
      )}
      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDecision(null);
        }}
      >
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {decision?.approve ? "Talebi onayla" : "Talebi reddet"}
              </DialogTitle>
              <DialogDescription>
                {decision?.approve
                  ? "İsterseniz kararınıza bir not ekleyin."
                  : "Red gerekçesini 3–500 karakterle belirtin."}
              </DialogDescription>
            </DialogHeader>
            <label className="block space-y-2 text-sm">
              <span>
                {decision?.approve
                  ? "Karar notu (isteğe bağlı)"
                  : "Red gerekçesi"}
              </span>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required={!decision?.approve}
                minLength={decision?.approve ? undefined : 3}
                maxLength={500}
                disabled={busy}
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDecision(null)}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={busy || (!decision?.approve && !validNote)}
              >
                {busy
                  ? "Kaydediliyor…"
                  : decision?.approve
                    ? "Onayla"
                    : "Reddet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
