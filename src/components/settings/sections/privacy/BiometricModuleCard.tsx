import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { useSettingsFormState } from "../../SettingsFormState";

export const BIOMETRIC_WARNING = "Yüz ve parmak izi yalnız fiziksel erişim kontrolü içindir. Mesai/puantaj takibinde kullanılamaz; bu verilerden puantaj kaydı üretilmez (KVKK Kurulu 2026/921). Yasal danışmanınıza doğrulatın.";

export function validBiometricReason(enabled: boolean, reason: string): boolean {
  return (!enabled || reason.trim().length >= 3) && reason.trim().length <= 500;
}

export function BiometricModuleCard({ projectId }: { projectId: Id<"projects"> }) {
  return <BiometricModuleForm key={projectId} projectId={projectId} />;
}

function BiometricModuleForm({ projectId }: { projectId: Id<"projects"> }) {
  const data = useQuery(api.privacyBiometric.getBiometricModule, { projectId });
  const save = useMutation(api.privacyBiometric.setBiometricModule);
  const [target, setTarget] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const { run, pending } = useAsyncAction(save, { success: "Biyometri ayarı kaydedildi", error: "Biyometri ayarı kaydedilemedi" });
  const busy = pending || disabling;
  const dirty = target !== null;
  useSettingsFormState(`biometric-${projectId}`, dirty, busy);
  const guard = useUnsavedChangesGuard(dirty);
  const reasonId = useId();
  const close = () => { setTarget(null); setReason(""); setConfirmDisable(false); };
  const requestClose = () => { if (!busy) guard.requestClose(close); };
  if (!data) return <SectionSkeleton label="Biyometri ayarı yükleniyor" />;
  const valid = target !== null && validBiometricReason(target, reason);
  return <section className="space-y-4 min-w-0" aria-label="Biyometri modülü">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-medium">Biyometri modülü</h3>
      <StatusBadge tone={data.enabled ? "warning" : "neutral"}>{data.enabled ? "Açık" : "Kapalı"}</StatusBadge>
    </div>
    <p className="text-sm text-muted-foreground">{BIOMETRIC_WARNING}</p>
    {data.legacy && data.enabled && <p className="text-sm text-muted-foreground">Bu proje eski ayarla açık; gerekmiyorsa kapatın.</p>}
    <p className="text-sm text-muted-foreground">Modülü kapatmak mevcut yüz ve parmak izi şablonlarını silmez. Silmek için biyometrik veri imha aracını kullanın.</p>
    {data.reason && <p className="text-sm break-words">Gerekçe: {data.reason}</p>}
    <p className="text-xs text-muted-foreground">Son değişiklik: {data.changedAt ? new Date(data.changedAt).toLocaleString("tr-TR") : "Kayıt yok"}</p>
    <Button variant="outline" disabled={busy} onClick={() => { setTarget(!data.enabled); setReason(""); }}>{data.enabled ? "Modülü kapat" : "Modülü aç"}</Button>
    <Dialog open={target !== null && !confirmDisable} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Biyometri modülü {target ? "açılsın mı?" : "kapatılsın mı?"}</DialogTitle>
          <DialogDescription>{BIOMETRIC_WARNING}</DialogDescription>
        </DialogHeader>
        <FormFieldWrapper htmlFor={reasonId} label={target ? "Kritik alan erişimi gerekçesi" : "Kapatma gerekçesi (isteğe bağlı)"}
          hint={target ? "3–500 karakter girin." : "En fazla 500 karakter girin."} error={reason && !valid ? "Gerekçenin uzunluğunu kontrol edin." : undefined}>
          <Textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} required={target === true} maxLength={500} rows={4} />
        </FormFieldWrapper>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={requestClose}>Vazgeç</Button>
          <Button disabled={!valid || busy} onClick={async () => {
            if (target === null) return;
            if (!target) { setConfirmDisable(true); return; }
            if (await run({ projectId, enabled: true, reason: reason.trim() })) close();
          }}>{busy ? "Kaydediliyor…" : target ? "Modülü aç" : "Devam et"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDestructive open={confirmDisable} onOpenChange={open => { if (!open && !busy) setConfirmDisable(false); }}
      title="Biyometri modülü kapatılsın mı?" objectName="Seçili projenin biyometri modülü"
      effects={["Yeni yüz ve parmak izi eklenemez veya cihazlara gönderilemez.", "Mevcut şablonlar silinmez; imha aracı ayrıca kullanılmalıdır.", ...(reason.trim() ? [`Gerekçe: ${reason.trim()}`] : [])]}
      confirmLabel="Modülü kapat" onConfirm={async () => {
        setDisabling(true);
        try { await save({ projectId, enabled: false, reason: reason.trim() }); notify.success("Biyometri modülü kapatıldı"); close(); }
        finally { setDisabling(false); }
      }} />
    {guard.dialog}
  </section>;
}
