import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Id } from "../../../convex/_generated/dataModel";

interface AddDoorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  zoneId: Id<"zones">;
  zoneName: string;
}

export function AddDoorDialog({ open, onOpenChange, onSuccess, zoneId, zoneName }: AddDoorDialogProps) {
  const [name, setName] = useState("");
  const [doorCode, setDoorCode] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { projectId } = useActiveProject();
  const createDoor = useMutation(api.doors.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Hata", description: "Kapı adı gereklidir." });
      return;
    }
    setIsSubmitting(true);
    try {
      await createDoor({
        name: name.trim(),
        doorCode: doorCode.trim() || undefined,
        location: location.trim() || undefined,
        zoneId,
        projectId,
        status: "active",
      });
      toast({ title: "Başarılı", description: `${zoneName} bölgesine kapı başarıyla eklendi.` });
      setName("");
      setDoorCode("");
      setLocation("");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Hata", description: (error as Error)?.message ?? "Kapı eklenirken hata oluştu." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{zoneName} - Yeni Kapı Ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Ad *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="Kapı adı" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="doorCode" className="text-right">Kapı Kodu</Label>
              <Input id="doorCode" value={doorCode} onChange={(e) => setDoorCode(e.target.value)} className="col-span-3" placeholder="Kapı kodu (opsiyonel)" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">Konum</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="col-span-3" placeholder="Kapı konumu (opsiyonel)" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ekleniyor..." : "Ekle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
