import { useId, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTrDateTime } from "@/lib/date";

const fingerNames = ["Sağ başparmak", "Sağ işaret", "Sağ orta", "Sağ yüzük", "Sağ serçe", "Sol başparmak", "Sol işaret", "Sol orta", "Sol yüzük", "Sol serçe"];

export function EmployeeFingerprintCard({ employeeId }: { employeeId: Id<"employees"> }) {
  const { isAdmin } = useActiveProjectScope();
  const module = useQuery(api.privacyBiometric.getEmployeeBiometricModule, isAdmin ? { employeeId } : "skip");
  if (!isAdmin || module?.enabled !== true) return null;
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
  const [fingerNo, setFingerNo] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  const [attempt, setAttempt] = useState<{ deviceId: Id<"devices">; fingerNo: number; attemptId: string } | null>(null);
  const [status, setStatus] = useState("");
  const reasonId = useId();
  const deviceInputId = useId();
  const fingerInputId = useId();
  const device = data?.devices.find(item => item._id === deviceId) ?? data?.devices[0];
  const hasConsent = consents?.some(consent => consent.consentType === "biometric_fingerprint" && !consent.revokedAt) === true;
  const reason = !data || !consents ? "Parmak izi bilgileri yükleniyor…" : !hasConsent ? "Parmak izi için açık rıza gerekli. KVKK rızaları bölümünden ekleyin." : !data.active ? "Pasif kişiye parmak izi kaydedilemez." : !device ? "Kişinin erişim kapsamında uygun Hik gateway cihazı bulunamadı." : "";
  const { run, pending } = useAsyncAction(async () => {
    if (!device || reason) return;
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

  return <section className="space-y-3 border-t pt-5" aria-label="Parmak izi">
    <h3 className="text-base font-semibold">Parmak izi</h3>
    <p className="text-sm text-muted-foreground">Parmak izi şifreli olarak sistemde saklanır ve kişinin erişimi olan Hikvision cihazlarına otomatik gönderilir. Puantajda kullanılmaz.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><label htmlFor={deviceInputId} className="text-sm">Cihaz</label>
        <select id={deviceInputId} className="max-sm:min-h-11 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2" value={device?._id ?? ""} disabled={pending} onChange={event => setDeviceId(event.target.value)}>
          {!device && <option value="">Uygun cihaz yok</option>}
          {data?.devices.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
      </div>
      <div className="space-y-1"><label htmlFor={fingerInputId} className="text-sm">Parmak</label>
        <select id={fingerInputId} className="max-sm:min-h-11 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2" value={fingerNo} disabled={pending} onChange={event => setFingerNo(Number(event.target.value))}>
          {fingerNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
      </div>
    </div>
    {device && !device.capabilitiesScanned && <p className="text-sm text-muted-foreground">Cihaz özellikleri taranmadı; Cihazlar &gt; cihaz &gt; Özellikleri tara</p>}
    <p id={reasonId} className="text-sm text-muted-foreground">{reason}</p>
    <div className="flex flex-wrap gap-2">
      <Button className="max-sm:min-h-11" type="button" aria-describedby={reasonId} disabled={!!reason || pending} onClick={() => setConfirmOpen(true)}>{pending ? "Cihaz yanıtı bekleniyor…" : "Kaydı başlat"}</Button>
      {pending && <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={!attempt || cancellation.pending} onClick={() => void cancellation.run()}>İptal</Button>}
    </div>
    <p role="status" aria-live="polite" className="text-sm">{status}</p>
    <p className="text-xs text-muted-foreground">Cihaz sayısı: parmak izi destekleyen erişim cihazları.</p>
    <ul className="divide-y">{data?.templates.map(row => {
      const name = fingerNames[row.fingerNo - 1] ?? `Parmak ${row.fingerNo}`;
      const deviceNames = row.deviceIds.map(id => data.devices.find(item => item._id === id)?.name ?? data.enrollments.find(item => item.deviceId === id)?.deviceName ?? "Silinmiş cihaz");
      const covered = data.devices.filter(item => row.deviceIds.includes(item._id)).length;
      return <li key={row.fingerNo} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <div><span>{name} · {covered}/{data.devices.length} cihazda · {formatTrDateTime(new Date(row.enrolledAt))}</span><p className="text-muted-foreground">{deviceNames.join(", ") || "Cihazlara gönderim bekleniyor"}</p></div>
        <div className="flex flex-wrap gap-2">
          {covered < data.devices.length && <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={pending || !!reason || redistribution.pending} onClick={() => void redistribution.run(row.fingerNo)}>Cihazlara yeniden gönder</Button>}
          <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={pending} aria-label={`${name} sistemden ve tüm cihazlardan sil`} onClick={() => setRemoveTarget(row.fingerNo)}>Sil</Button>
        </div>
      </li>;
    })}</ul>
    {data?.templates.length === 0 && <p className="text-sm text-muted-foreground">Bu kişi için kayıtlı parmak izi yok.</p>}
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent>
      <DialogHeader><DialogTitle>Parmak izi kaydını başlat</DialogTitle><DialogDescription>Cihazda parmağınızı okutun; yaklaşık 30 saniye beklenir. {device?.name} · {fingerNames[fingerNo - 1]}</DialogDescription></DialogHeader>
      <DialogFooter><Button className="max-sm:min-h-11" type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Vazgeç</Button><Button className="max-sm:min-h-11" type="button" disabled={pending || !!reason} onClick={() => void run()}>Kaydı başlat</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDestructive open={removeTarget !== null} onOpenChange={open => { if (!open) setRemoveTarget(null); }} title="Sistemden ve tüm cihazlardan sil" objectName="Seçili parmak izi" effects={["Parmak izi sistemden ve tüm cihazlardan silinir; yeniden kayıt gerekir."]} confirmLabel="Sil" onConfirm={async () => { if (removeTarget !== null) await remove({ employeeId, fingerNo: removeTarget }); }} />
  </section>;
}
