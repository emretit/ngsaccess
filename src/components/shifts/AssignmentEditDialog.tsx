import { assignmentFormSchema } from "./assignmentFormSchema";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];

interface AssignmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  shifts: Shift[];
  shiftName: string;
  employeeName: string;
}

export function AssignmentEditDialog({
  open,
  onOpenChange,
  assignment,
  shifts,
  shiftName,
  employeeName,
}: AssignmentEditDialogProps) {
  const { toast } = useToast();
  const updateAssignment = useMutation(api.shifts.updateAssignment);
  const removeAssignment = useMutation(api.shifts.removeAssignment);
  const [shiftId, setShiftId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmSeries, setConfirmSeries] = useState(false);
  const [calendarApproved, setCalendarApproved] = useState(false);
  const [calendarConflict, setCalendarConflict] = useState<string | null>(null);
  const deleteAction = useAsyncAction(async () => {
    if (!assignment) return;
    await removeAssignment({ assignmentId: assignment._id });
    onOpenChange(false);
  }, { success: "Atama silindi" });
  const [overlapDetails, setOverlapDetails] = useState("");
  const [overlapCount, setOverlapCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (assignment && open) {
      setShiftId(assignment.shiftId);
      setStartDate(assignment.startDate);
      setEndDate(assignment.endDate);
      setOverlapCount(null);
      setCalendarConflict(null);
      setConfirmSeries(false);
      setConfirmDelete(false);
    }
  }, [assignment, open]);

  useEffect(() => { setCalendarApproved(false); }, [startDate, endDate, shiftId]);

  const saveAction = useAsyncAction(async (forceConfirm: boolean, confirmCalendar: boolean = false) => {
    if (!assignment) throw new Error("Atama bulunamadı");
    const parsed = assignmentFormSchema.safeParse({ employeeId: assignment.employeeId, shiftId, startDate, endDate });
    if (!parsed.success) {
      toast({ title: "Hatalı form", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    try {
      await updateAssignment({
        assignmentId: assignment._id,
        shiftId: shiftId as Id<"shifts">,
        startDate,
        endDate,
        forceConfirm,
        calendarConfirmed: confirmCalendar || calendarApproved,
      });
      toast({ title: "Atama güncellendi" });
      setOverlapCount(null);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Güncellenemedi";
      const overlapMatch = /OVERLAP:(\d+)/.exec(msg);
      if (overlapMatch) {
        setOverlapCount(Number(overlapMatch[1]));
        setOverlapDetails(msg.replace(/.*OVERLAP:\d+/, ""));
      } else if (msg.includes("CALENDAR:")) {
        setCalendarConflict(msg.replace("CALENDAR:", ""));
      } else {
        throw e;
      }
    }
  }, { error: "Atama güncellenemedi" });
  const saveImpl = saveAction.run;
  const busy = saveAction.pending || deleteAction.pending;
  if (!assignment) return null;

  const handleSave = () => setConfirmSeries(true);

  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Tüm Atama Serisini Düzenle</DialogTitle>
          <p className="text-sm text-muted-foreground">{employeeName} · {assignment.startDate}–{assignment.endDate}. Değişiklikler ve silme tüm tarih aralığına uygulanır.</p>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Çalışan</p>
              <p className="font-medium">{employeeName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mevcut Vardiya</p>
              <p className="font-medium">{shiftName}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Vardiyayı Değiştir</Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shifts
                  .filter((s) => s.isActive !== false)
                  .map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Başlangıç</Label>
              <DatePicker
                date={parseDateString(startDate)}
                onSelect={(d) => setStartDate(formatDateString(d))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Bitiş</Label>
              <DatePicker
                date={parseDateString(endDate)}
                onSelect={(d) => setEndDate(formatDateString(d))}
                minDate={parseDateString(startDate)}
              />
            </div>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Sil
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Kapat
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog
        open={overlapCount !== null}
        onOpenChange={(o) => !o && setOverlapCount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çakışan atama var</AlertDialogTitle>
            <AlertDialogDescription>
              Yeni tarih aralığı çalışanın {overlapCount} mevcut atamasıyla
              çakışıyor. {overlapDetails} Mevcut atamalar korunarak ek çakışmaya izin verilir. Yine de kaydetmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void saveImpl(true);
              }}
              disabled={busy}
            >
              Yine de Kaydet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDestructive open={confirmDelete} onOpenChange={setConfirmDelete} title="Tüm seri silinsin mi?"
        objectName={`${employeeName} · ${shiftName} · ${assignment.startDate}–${assignment.endDate}`}
        effects={["Bu atamanın tüm tarih aralığı kalıcı silinir."]} confirmLabel="Tüm seriyi sil" onConfirm={async () => { if (!await deleteAction.run()) throw new Error("Atama silinemedi"); }} />
      <ConfirmDestructive open={confirmSeries} onOpenChange={setConfirmSeries} title="Tüm seri güncellensin mi?"
        objectName={`${employeeName} · ${assignment.startDate}–${assignment.endDate}`}
        effects={[`Tüm seri ${startDate}–${endDate} tarihleri ve seçili vardiyayla güncellenir.`]} confirmLabel="Tüm seriyi güncelle" onConfirm={async () => { if (!await saveImpl(false)) throw new Error("Atama güncellenemedi; form korundu"); }} />
      <AlertDialog open={calendarConflict !== null} onOpenChange={open => { if (!open) setCalendarConflict(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>İzin veya tatil çakışması</AlertDialogTitle><AlertDialogDescription>{calendarConflict}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); setCalendarApproved(true); setCalendarConflict(null); void saveImpl(false, true); }}>Yine de tüm seriye ata</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
