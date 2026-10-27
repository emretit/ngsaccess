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
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export function requestsCursor(cursor: string | null, pageLength?: number) {
  return pageLength === 0 ? null : cursor;
}

export function CorrectionRequestsPanel({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const result = useQuery(api.attendanceCorrections.listPending, {
    projectId,
    paginationOpts: { cursor, numItems: 25 },
  });
  useEffect(() => {
    setCursor(requestsCursor(cursor, result?.page.length));
  }, [cursor, result?.page.length]);
  const approve = useMutation(api.attendanceCorrections.approve);
  const reject = useMutation(api.attendanceCorrections.reject);
  const [decision, setDecision] = useState<{
    id: Id<"attendanceCorrections">;
    approve: boolean;
  } | null>(null);
  const [note, setNote] = useState("");
  const { run, pending: busy } = useAsyncAction(async (current: NonNullable<typeof decision>, decisionNote: string) => {
    if (current.approve)
      await approve({ id: current.id, note: decisionNote.trim() || undefined });
    else await reject({ id: current.id, note: decisionNote.trim() });
    notify.success(current.approve ? "Talep onaylandı" : "Talep reddedildi");
  }, { error: "Talep sonuçlandırılamadı" });
  const validNote = note.trim().length >= 3 && note.trim().length <= 500;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!decision || busy || (!decision.approve && !validNote)) return;
    if (await run(decision, note)) {
      setDecision(null);
      setCursor(null);
    }
  }
  function open(id: Id<"attendanceCorrections">, approve: boolean) {
    setNote("");
    setDecision({ id, approve });
  }
  return (
    <section className="space-y-4" aria-label="Düzeltme talepleri">
      {result === undefined ? (
        <SectionSkeleton rows={4} label="Talepler yükleniyor." />
      ) : result.page.length === 0 ? (
        <EmptyState title="Bekleyen düzeltme talebi yok." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Çalışan</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>İstenen giriş / çıkış</TableHead>
                <TableHead>Gerekçe</TableHead>
                <TableHead>Talep zamanı</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.page.map((row) => (
                <TableRow key={row._id}>
                  <TableCell>{row.employeeName}</TableCell>
                  <TableCell>
                    {row.date.split("-").reverse().join(".")}
                  </TableCell>
                  <TableCell>
                    {
                      {
                        checkIn: "Giriş",
                        checkOut: "Çıkış",
                        both: "Giriş ve çıkış",
                      }[row.correctionType]
                    }
                  </TableCell>
                  <TableCell>
                    {row.requestedCheckIn || "—"} /{" "}
                    {row.requestedCheckOut || "—"}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap break-words">
                    {row.reason}
                  </TableCell>
                  <TableCell>
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
      )}
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
      {result?.hasMore && (
        <p className="text-xs text-muted-foreground">
          İlk 200 talep gösteriliyor. Talepleri sonuçlandırdıkça kalan talepler
          görünür.
        </p>
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

export function CorrectionRequestsEntry({ projectId, onSelect }: {
  projectId: Id<"projects">;
  onSelect: () => void;
}) {
  const count = useQuery(api.leaveRequests.pendingCount, { projectId, kind: "corrections" });
  return (
    <DropdownMenuItem onSelect={onSelect}>
      Düzeltme talepleri
      <Badge variant="secondary" className="ml-2" aria-label="Bekleyen düzeltme sayısı">
        {count ? `${Math.min(count.count, 100)}${count.capped ? "+" : ""}` : "…"}
      </Badge>
    </DropdownMenuItem>
  );
}
