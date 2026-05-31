import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type ReaderDirection = "entry" | "exit" | "both";

interface EditReaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doorId: Id<"doors">;
  readerName: string;
  readerDirection: ReaderDirection;
}

export function EditReaderDialog({
  open,
  onOpenChange,
  doorId,
  readerName,
  readerDirection,
}: EditReaderDialogProps) {
  const [name, setName] = useState(readerName);
  const [direction, setDirection] = useState<ReaderDirection>(readerDirection);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const updateDoor = useMutation(api.doors.update);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Hata", description: "Okuyucu adı gereklidir." });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDoor({
        doorId,
        readerName: name.trim(),
        readerDirection: direction,
      });
      toast({ title: "Başarılı", description: "Okuyucu güncellendi." });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error instanceof Error ? error.message : "Okuyucu güncellenirken hata oluştu.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Okuyucuyu Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="readerName" className="text-right">Ad *</Label>
              <Input
                id="readerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Okuyucu adı"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="readerDirection" className="text-right">Yön</Label>
              <Select value={direction} onValueChange={(val) => setDirection(val as ReaderDirection)}>
                <SelectTrigger id="readerDirection" className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Giriş</SelectItem>
                  <SelectItem value="exit">Çıkış</SelectItem>
                  <SelectItem value="both">Giriş/Çıkış</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
