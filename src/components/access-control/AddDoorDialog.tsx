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
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../../convex/_generated/dataModel";

interface AddDoorDialogProps { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void; zoneId: Id<"zones">; zoneName: string; }

export function AddDoorDialog({ open, onOpenChange, onSuccess, zoneId, zoneName }: AddDoorDialogProps) {
  const { projectId } = useActiveProject();
  const [doorCode, setDoorCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  const guard = useUnsavedChangesGuard(open && (name !== "" || doorCode !== ""));
  const create = useMutation(api.doors.create);
  const { run, pending } = useAsyncAction(async () => {
    await create({ name: name.trim(), projectId, zoneId, doorCode: doorCode.trim() || undefined, status: "active" });
    notify.success("Kapı eklendi");
    setName(""); onSuccess(); setDoorCode("");
    onOpenChange(false);
  }, { error: "Kapı eklenemedi" });
  const close = () => { if (!pending) guard.requestClose(() => { setName(""); setError(undefined); setDoorCode(""); onOpenChange(false); }); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError("Kapı adı gereklidir."); nameInput.current?.focus(); return; }
    setError(undefined);
    void run();
  };
  return <>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-[440px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Kapı ekle</DialogTitle></DialogHeader>
        <p className="break-words text-sm text-muted-foreground">{zoneName}</p>
        <form onSubmit={submit} noValidate className="space-y-4" aria-busy={pending}>
          <fieldset disabled={pending} className="space-y-4">
            <FormFieldWrapper htmlFor="add-door-name" label="Kapı adı" error={error}><Input ref={nameInput} id="add-door-name" value={name} onChange={e => { setName(e.target.value); setError(undefined); }} /></FormFieldWrapper>
            <FormFieldWrapper htmlFor="add-door-code" label="Kapı kodu"><Input id="add-door-code" value={doorCode} onChange={e => setDoorCode(e.target.value)} /></FormFieldWrapper>
          </fieldset>
          <DialogFooter className="pt-2"><Button type="button" variant="outline" disabled={pending} onClick={close}>İptal</Button><Button type="submit" disabled={pending}>{pending ? "Ekleniyor…" : "Ekle"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {guard.dialog}
  </>;
}
