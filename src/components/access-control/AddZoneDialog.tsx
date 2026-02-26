import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Id } from "../../../convex/_generated/dataModel";

interface AddZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddZoneDialog({ open, onOpenChange, onSuccess }: AddZoneDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { projectIds } = useProjectAccess();
  const createZone = useMutation(api.zones.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Hata", description: "Bölge adı gereklidir." });
      return;
    }
    setIsSubmitting(true);
    try {
      await createZone({
        name: name.trim(),
        description: description.trim() || undefined,
        projectId: projectIds[0] as Id<"projects"> | undefined,
      });
      toast({ title: "Başarılı", description: "Bölge başarıyla eklendi." });
      setName("");
      setDescription("");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Hata", description: (error as Error)?.message ?? "Bölge eklenirken hata oluştu." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Yeni Bölge Ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Ad *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="Bölge adı" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Açıklama</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" placeholder="Bölge açıklaması (opsiyonel)" rows={3} />
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
