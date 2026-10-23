import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface AddReaderDialogProps { open: boolean; onOpenChange: (open: boolean) => void; doorId: Id<"doors">; doorName: string; defaultDirection?: "entry" | "exit" | "both"; }

export function AddReaderDialog({ open, onOpenChange, doorId, doorName, defaultDirection = "exit" }: AddReaderDialogProps) {
  // Yön etiketi ada eklenmez; kullanıcı isterse adına kendisi yazar.
  const initialName = doorName;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  const guard = useUnsavedChangesGuard(open && name !== initialName);
  const create = useMutation(api.readers.create);
  const { run, pending } = useAsyncAction(async () => {
    // Yön sorulmaz: kapıdaki boş okuyucu yuvası (LocationTree hesaplar) sessizce kullanılır.
    await create({ name: name.trim(), doorId, direction: defaultDirection });
    notify.success("Okuyucu eklendi");
    setName("");
    onOpenChange(false);
  }, { error: "Okuyucu eklenemedi" });
  const close = () => { if (!pending) guard.requestClose(() => { setName(initialName); setError(undefined); onOpenChange(false); }); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError("Okuyucu adı gereklidir."); nameInput.current?.focus(); return; }
    setError(undefined);
    void run();
  };
  return <>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Okuyucu ekle</DialogTitle></DialogHeader>
        <p className="break-words text-sm text-muted-foreground">{doorName}</p>
        <form onSubmit={submit} noValidate className="space-y-4" aria-busy={pending}>
          {error && <p role="alert" className="text-sm text-destructive">Kaydedilemedi. {error}</p>}
          <fieldset disabled={pending} className="space-y-4">
            <FormFieldWrapper htmlFor="add-reader-name" label="Okuyucu adı" error={error}><Input ref={nameInput} id="add-reader-name" value={name} onChange={e => { setName(e.target.value); setError(undefined); }} /></FormFieldWrapper>
          </fieldset>
          <DialogFooter className="border-t border-line pt-4"><Button type="button" variant="outline" disabled={pending} onClick={close}>İptal</Button><Button type="submit" disabled={pending}>{pending ? "Ekleniyor…" : "Ekle"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {guard.dialog}
  </>;
}
