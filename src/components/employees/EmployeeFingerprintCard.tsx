import { usePermissions } from "@/hooks/usePermissions";
import { useId, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTrDateTime } from "@/lib/date";
import { FINGERPRINT_LIMIT_MESSAGE, fingerprintLabel, MAX_FINGERPRINTS_PER_EMPLOYEE, nextFreeFingerNo } from "../../../convex/lib/fingerprintSlots";


export function EmployeeFingerprintCard({ employeeId }: { employeeId: Id<"employees"> }) {
  const { can } = usePermissions();
  const canManage = can("biometrics.manage");
  const module = useQuery(api.privacyBiometric.getEmployeeBiometricModule, canManage ? { employeeId } : "skip");
  if (!canManage || module?.enabled !== true) return null;
  return <FingerprintControls key={employeeId} employeeId={employeeId} />;
}

function FingerprintControls({ employeeId }: { employeeId: Id<"employees"> }) {
  const data = useQuery(api.fingerprintEnrollment.listForEmployee, { employeeId });
  const consents = useQuery(api.employeeConsents.listForEmployee, { employeeId });
  const enroll = useAction(api.actions.hikFingerprint.enrollFingerprintOnDevice);
  const remove = useAction(api.actions.hikFingerprint.removeFingerprint);
  const resend = useAction(api.actions.hikFingerprint.resendFingerprint);
  const begin = useMutation(api.fingerprintEnrollment.beginEnrollment);
  const cancel = useMutation(api.fingerprintEnrollment.cancelEnrollment);
  const [deviceId, setDeviceId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  const [attempt, setAttempt] = useState<{ deviceId: Id<"devices">; fingerNo: number; attemptId: string } | null>(null);
  const [status, setStatus] = useState("");
  const reasonId = useId();
  const deviceInputId = useId();
  const device = data?.devices.find(item => item._id === deviceId) ?? data?.devices[0];
  const hasConsent = consents?.some(consent => consent.consentType === "biometric_fingerprint" && !consent.revokedAt) === true;
  const fingerNo = nextFreeFingerNo(data?.templates.map(row => row.fingerNo) ?? []);
  const reason = !data || !consents ? "Parmak izi bilgileri yükleniyor…" : !hasConsent ? "Parmak izi için açık rıza gerekli. KVKK rızaları bölümünden ekleyin." : !data.active ? "Pasif kişiye parmak izi kaydedilemez." : !device ? "Kişinin erişim kapsamında uygun Hik gateway cihazı bulunamadı." : fingerNo === null ? FINGERPRINT_LIMIT_MESSAGE : "";
  const { run, pending } = useAsyncAction(async () => {
    if (!device || reason || fingerNo === null) return;
    setConfirmOpen(false);
    const target = { employeeId, deviceId: device._id, fingerNo };
    setStatus("Parmak izi işlemi başlatılıyor…");
    try {
      const attemptId = await begin(target);
      setStatus("Cihazda parmağınızı okutun; yaklaşık 30 saniye beklenir.");
      setAttempt({ deviceId: target.deviceId, fingerNo, attemptId });
      await enroll({ ...target, attemptId });
      setStatus("Parmak izi şifreli kaydedildi; diğer cihazlara gönderiliyor.");
    } catch (error) {
      setStatus("Parmak izi işlemi tamamlanamadı. Hata bildirimini kontrol edin.");
      throw error;
    } finally { setAttempt(null); }
  }, { error: "Parmak izi kaydı tamamlanamadı" });
  const cancellation = useAsyncAction(async () => {
    if (!attempt) return;
    await cancel({ employeeId, ...attempt });
    setStatus("İptal istendi. Cihazın yanıtı ve gerekiyorsa kaydın temizlenmesi bekleniyor.");
  }, { error: "İptal isteği iletilemedi" });

  const redistribution = useAsyncAction(async (finger: number) => {
    await resend({ employeeId, fingerNo: finger });
    setStatus("Parmak izi cihazlara yeniden gönderiliyor.");
  }, { error: "Parmak izi gönderilemedi" });

  const templates = data?.templates ?? [];
  return <section className="space-y-2 border-t pt-4" aria-label="Parmak izi">
    <h3 className="text-base font-semibold">Parmak izi</h3>
    <p className="text-xs text-muted-foreground">Şifreli saklanır, kişinin erişimi olan Hikvision cihazlarına otomatik gönderilir; puantajda kullanılmaz. Herhangi bir parmak okutulabilir.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor={deviceInputId} className="block text-sm">Cihaz</label>
        <div className="flex gap-2">
          <select id={deviceInputId} className="max-sm:min-h-11 h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2" value={device?._id ?? ""} disabled={pending} onChange={event => setDeviceId(event.target.value)}>
            {!device && <option value="">Uygun cihaz yok</option>}
            {data?.devices.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          {pending
            ? <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={!attempt || cancellation.pending} onClick={() => void cancellation.run()}>İptal</Button>
            : <Button className="max-sm:min-h-11" type="button" aria-describedby={reasonId} disabled={!!reason} onClick={() => setConfirmOpen(true)}>Kaydı başlat</Button>}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm">Kayıtlı <span className="text-muted-foreground">· {templates.length}/{MAX_FINGERPRINTS_PER_EMPLOYEE}</span></p>
        {data && templates.length === 0
          ? <p className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">Kayıtlı parmak izi yok.</p>
          : templates.length > 0 && <ul className="space-y-1.5">{templates.map(row => {
            const name = fingerprintLabel(row.fingerNo);
            const missingOnDevice = data?.devices.some(item => !row.deviceIds.includes(item._id)) === true;
            return <li key={row.fingerNo} className="flex min-h-9 items-center justify-between gap-2 rounded-md border pl-3 pr-1 text-sm">
              <span>{name} <span className="text-xs text-muted-foreground">· {formatTrDateTime(new Date(row.enrolledAt))}</span></span>
              <div className="flex items-center">
                {missingOnDevice && <Button className="max-sm:min-h-11 h-7 w-7" size="icon" type="button" variant="ghost" title="Cihazlara yeniden gönder" aria-label={`${name} cihazlara yeniden gönder`} disabled={pending || !!reason || redistribution.pending} onClick={() => void redistribution.run(row.fingerNo)}><RefreshCw className="h-4 w-4" aria-hidden="true" /></Button>}
                <Button className="max-sm:min-h-11 h-7 px-2" size="sm" type="button" variant="ghost" disabled={pending} aria-label={`${name} sistemden ve tüm cihazlardan sil`} onClick={() => setRemoveTarget(row.fingerNo)}>Sil</Button>
              </div>
            </li>;
          })}</ul>}
      </div>
    </div>
    {device && !device.capabilitiesScanned && <p className="text-xs text-muted-foreground">Cihaz özellikleri taranmadı; Cihazlar &gt; cihaz &gt; Özellikleri tara</p>}
    <p id={reasonId} className="text-xs text-muted-foreground empty:hidden">{reason}</p>
    <p role="status" aria-live="polite" className="text-xs">{status}</p>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent>
      <DialogHeader><DialogTitle>Parmak izi kaydını başlat</DialogTitle><DialogDescription>Cihazda parmağınızı okutun; yaklaşık 30 saniye beklenir. {device?.name}{fingerNo !== null && ` · ${fingerprintLabel(fingerNo)}`}</DialogDescription></DialogHeader>
      <DialogFooter><Button className="max-sm:min-h-11" type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Vazgeç</Button><Button className="max-sm:min-h-11" type="button" disabled={pending || !!reason} onClick={() => void run()}>Kaydı başlat</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDestructive open={removeTarget !== null} onOpenChange={open => { if (!open) setRemoveTarget(null); }} title="Sistemden ve tüm cihazlardan sil" objectName="Seçili parmak izi" effects={["Parmak izi sistemden ve tüm cihazlardan silinir; yeniden kayıt gerekir."]} confirmLabel="Sil" onConfirm={async () => { if (removeTarget !== null) await remove({ employeeId, fingerNo: removeTarget }); }} />
  </section>;
}
