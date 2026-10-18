import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRightLeft } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";

import { initialReaderMoveSelection, readerMoveConflict, type ReaderDirection } from "./readerMove";

interface TargetDoor {
  id: Id<"doors">;
  name: string;
  readerCount: number;
  maxReaders: number;
  directions: ReaderDirection[];
}

interface MoveReaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readerId: Id<"readers">;
  readerName: string;
  currentDoorId: Id<"doors">;
  currentDirection: ReaderDirection;
  targetDoors: TargetDoor[];
}

export function MoveReaderDialog({
  open,
  onOpenChange,
  readerId,
  readerName,
  currentDoorId,
  currentDirection,
  targetDoors,
}: MoveReaderDialogProps) {
  const availableTargets = useMemo(
    () => targetDoors.filter(
      (door) => door.id !== currentDoorId && door.readerCount < door.maxReaders,
    ),
    [currentDoorId, targetDoors],
  );
  const [targetDoorId, setTargetDoorId] = useState<Id<"doors"> | "">("");
  const [direction, setDirection] = useState<ReaderDirection>(currentDirection);

  const selectedTarget = availableTargets.find(door => door.id === targetDoorId);
  const conflict = readerMoveConflict(direction, selectedTarget?.directions ?? []);

  const moveReader = useMutation(api.readers.move);
  const { run: move, pending: isSubmitting } = useAsyncAction(async () => {
    if (conflict) throw new Error("Hedefte bu yön dolu. Başka yön veya kapı seçin.");
    if (!targetDoorId || !selectedTarget) throw new Error("Hedef kapı seçin");
    await moveReader({ readerId, targetDoorId, direction });
    notify.success("Okuyucu taşındı");
  });

  useEffect(() => {
    if (!open) return;
    const initial = initialReaderMoveSelection(currentDirection);
    setTargetDoorId(initial.targetDoorId);
    setDirection(initial.direction);
  }, [open, readerId, currentDirection]);

  const handleTargetChange = (value: string) => {
    const selected = availableTargets.find((door) => door.id === value);
    setTargetDoorId(selected?.id ?? "");
  };

  const guard = useUnsavedChangesGuard(open && (targetDoorId !== "" || direction !== currentDirection));
  const close = () => { if (!isSubmitting) guard.requestClose(() => onOpenChange(false)); };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await move()) onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Okuyucu Taşı
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{readerName}, {targetDoors.find((door) => door.id === currentDoorId)?.name ?? "kaynak kapı"} üzerinden seçilen hedefe mantıksal olarak taşınacak. Kaynaktaki son okuyucuysa kapı okuyucusuz kalır. Fiziksel kablolama değişmez.</p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Okuyucu</p>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{readerName}</div>
          </div>

          {conflict && <p role="alert" className="text-sm text-destructive">Taşıma yapılamaz. Hedef kapıda bu yön dolu.</p>}
          <FormFieldWrapper htmlFor="targetDoor" label="Hedef kapı">
            {control => <Select disabled={isSubmitting} value={targetDoorId} onValueChange={handleTargetChange}>
              <SelectTrigger {...control}>
                <SelectValue placeholder="Kapı seçin" />
              </SelectTrigger>
              <SelectContent>
                {targetDoors.filter((door) => door.id !== currentDoorId).map((door) => (
                  <SelectItem key={door.id} value={door.id} disabled={door.readerCount >= door.maxReaders}>
                    {door.name} ({door.readerCount}/{door.maxReaders}){door.readerCount >= door.maxReaders ? " · Dolu" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>}
          </FormFieldWrapper>
          {availableTargets.length === 0 && (
            <p className="text-xs text-muted-foreground">Bu panelde taşınabilecek boş kapı yok.</p>
          )}

          <FormFieldWrapper htmlFor="readerDirection" label="Yeni yön" error={conflict ? "Hedef kapıda bu yön dolu. Yönü veya hedef kapıyı kendiniz değiştirin." : undefined}>
            {control => <Select disabled={isSubmitting} value={direction} onValueChange={(value) => setDirection(value as ReaderDirection)}>
              <SelectTrigger {...control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Giriş</SelectItem>
                <SelectItem value="exit">Çıkış</SelectItem>
                <SelectItem value="both">Giriş/Çıkış</SelectItem>
              </SelectContent>
            </Select>}
          </FormFieldWrapper>
          <p className="text-sm text-muted-foreground">Yön: {currentDirection === "entry" ? "Giriş" : currentDirection === "exit" ? "Çıkış" : "Giriş/Çıkış"} → {direction === "entry" ? "Giriş" : direction === "exit" ? "Çıkış" : "Giriş/Çıkış"}</p>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedTarget || conflict}>
              {isSubmitting ? "Taşınıyor..." : "Taşı"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {guard.dialog}
    </>
  );
}
