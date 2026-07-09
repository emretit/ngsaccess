import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRightLeft } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ReaderDirection = "entry" | "exit" | "both";

interface TargetDoor {
  id: Id<"doors">;
  name: string;
  readerCount: number;
  maxReaders: number;
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

function nextDirection(target: TargetDoor | undefined): ReaderDirection {
  if (!target) return "entry";
  return target.readerCount > 0 ? "exit" : "entry";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const moveReader = useMutation(api.readers.move);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const firstTarget = availableTargets[0];
    setTargetDoorId(firstTarget?.id ?? "");
    setDirection(nextDirection(firstTarget));
  }, [open, availableTargets]);

  const handleTargetChange = (value: string) => {
    const selected = availableTargets.find((door) => door.id === value);
    setTargetDoorId((selected?.id ?? "") as Id<"doors"> | "");
    setDirection(nextDirection(selected));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetDoorId) {
      toast({ title: "Hedef kapı seçin", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await moveReader({ readerId, targetDoorId, direction });
      toast({ title: "Okuyucu taşındı", description: `${readerName} hedef kapıya bağlandı.` });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Okuyucu taşınamadı",
        description: error instanceof Error ? error.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Okuyucu Taşı
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Okuyucu</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{readerName}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDoor">Hedef Kapı</Label>
            <Select value={targetDoorId} onValueChange={handleTargetChange}>
              <SelectTrigger id="targetDoor">
                <SelectValue placeholder="Kapı seçin" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((door) => (
                  <SelectItem key={door.id} value={door.id}>
                    {door.name} ({door.readerCount}/{door.maxReaders})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableTargets.length === 0 && (
              <p className="text-xs text-muted-foreground">Bu panelde taşınabilecek boş kapı yok.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="readerDirection">Yeni Yön</Label>
            <Select value={direction} onValueChange={(value) => setDirection(value as ReaderDirection)}>
              <SelectTrigger id="readerDirection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">Giriş</SelectItem>
                <SelectItem value="exit">Çıkış</SelectItem>
                <SelectItem value="both">Giriş/Çıkış</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting || !targetDoorId}>
              {isSubmitting ? "Taşınıyor..." : "Taşı"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
