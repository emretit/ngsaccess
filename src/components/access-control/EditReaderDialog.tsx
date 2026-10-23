import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface EditReaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Okuyucu satırının id'si. null → legacy kapı (henüz readers satırı yok) → doors.update'e düşülür.
  readerId?: Id<"readers"> | null;
  doorId: Id<"doors">;
  readerName: string;
  // IDE Smart kapısı için mevcut sensör ayarı. undefined → panel default (true) varsayılır.
  requireSensor?: boolean;
  // IDE Smart paneline bağlı kapı mı (sensör toggle yalnızca o zaman gösterilir).
  isIdeDoor?: boolean;
}

export function EditReaderDialog({
  open,
  onOpenChange,
  readerId,
  doorId,
  readerName,
  requireSensor: initialRequireSensor,
  isIdeDoor = false,
}: EditReaderDialogProps) {
  const [name, setName] = useState(readerName);
  const [requireSensor, setRequireSensor] = useState(initialRequireSensor ?? true);
  const [nameError, setNameError] = useState<string>();
  const [partialSave, setPartialSave] = useState(false);
  const updateDoor = useMutation(api.doors.update);
  const updateReader = useMutation(api.readers.update);

  const { run, pending: isSubmitting } = useAsyncAction(async () => {
    setPartialSave(false);
    if (!name.trim()) throw new Error("Okuyucu adı gereklidir.");
    if (readerId) {
      await updateReader({ readerId, name: name.trim() });
      if (isIdeDoor) {
        try { await updateDoor({ doorId, requireSensor }); }
        catch (error: unknown) { setPartialSave(true); throw error; }
      }
    } else {
      await updateDoor({ doorId, readerName: name.trim(), ...(isIdeDoor ? { requireSensor } : {}) });
    }
    notify.success("Okuyucu güncellendi");
  }, { error: "Okuyucu ayarları kaydedilemedi" });
  const guard = useUnsavedChangesGuard(open && (name !== readerName || (isIdeDoor && requireSensor !== (initialRequireSensor ?? true))));
  const close = () => { if (!isSubmitting) guard.requestClose(() => onOpenChange(false)); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError("Okuyucu adı gereklidir."); document.getElementById("readerName")?.focus(); return; }
    setNameError(undefined);
    if (await run()) onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Okuyucuyu Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          {nameError && <p role="alert" className="text-sm text-destructive">Kaydedilemedi. {nameError}</p>}
          {partialSave && <p role="alert" className="text-sm text-destructive">Okuyucu adı kaydedildi; kapı sensörü kaydedilemedi. Sensör ayarını yeniden deneyin.</p>}
          <fieldset disabled={isSubmitting} className="grid gap-4 py-4">
            <FormFieldWrapper htmlFor="readerName" label="Okuyucu adı *" error={nameError}>
              <Input id="readerName" value={name} onChange={e => setName(e.target.value)} placeholder="Okuyucu adı" required />
            </FormFieldWrapper>
            {isIdeDoor && <FormFieldWrapper htmlFor="requireSensor" label="Kapı sensörü (bu kapıya ait)"
              hint="Kapıda fiziksel sensör varsa açın. Kapalıysa açılış sensör yanıtı beklenmeden tamamlanır.">
              <Switch id="requireSensor" disabled={isSubmitting} checked={requireSensor} onCheckedChange={setRequireSensor} />
            </FormFieldWrapper>}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {guard.dialog}
    </>
  );
}
