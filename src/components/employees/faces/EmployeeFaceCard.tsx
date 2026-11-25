import { useId, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { usePermissions } from "@/hooks/usePermissions";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { capturedFaceBytes, faceDeliveryLabel, MAX_FACE_BYTES } from "./facePhoto";

type FaceCardProps = { employeeId: Id<"employees">; cardNumber?: string };

export function EmployeeFaceCard({ employeeId, cardNumber }: FaceCardProps) {
  const { can } = usePermissions();
  const permitted = can("biometrics.manage");
  const module = useQuery(api.privacyBiometric.getEmployeeBiometricModule, permitted ? { employeeId } : "skip");
  if (!permitted || module?.enabled !== true) return null;
  return <FaceControls key={employeeId} employeeId={employeeId} cardNumber={cardNumber} />;
}

function FaceControls({ employeeId, cardNumber }: FaceCardProps) {
  const hasCard = Boolean(cardNumber?.trim());
  const data = useQuery(api.employeeFaces.listForEmployee, { employeeId });
  const save = useAction(api.employeeFaces.savePhoto);
  const capture = useAction(api.actions.hikGatewayDevice.captureFaceFromDevice);
  const resend = useMutation(api.employeeFaces.resend);
  const remove = useMutation(api.employeeFaces.remove);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [confirm, setConfirm] = useState<"upload" | "capture" | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fileId = useId();
  const selectId = useId();
  const reasonId = useId();
  const targets = data?.devices.filter(device => device.target) ?? [];
  const device = targets.find(item => item._id === deviceId) ?? targets[0];
  const saveAction = useAsyncAction(async () => {
    if (!confirm || !hasCard || !data?.active || data.busy) return;
    let bytes: ArrayBuffer;
    try {
      if (confirm === "capture") {
        if (!device) return;
        setStatus("Cihazın kamerasına bakın; yüz fotoğrafı alınıyor…");
        bytes = capturedFaceBytes(await capture({ employeeId, deviceId: device._id }));
      } else {
        if (!file) return;
        bytes = await file.arrayBuffer();
      }
      await save({ employeeId, bytes });
      setFile(null);
      setConfirm(null);
      setStatus("Yüz kaydı saklandı; erişim kapsamındaki cihazlara gönderiliyor.");
    } catch (error) {
      setStatus("Yüz kaydı tamamlanamadı; hata bildirimini kontrol edin.");
      throw error;
    }
  }, { error: "Yüz kaydı tamamlanamadı" });
  const redistribution = useAsyncAction(async () => {
    if (!hasCard || !data?.active || data.busy) return;
    await resend({ employeeId });
    setStatus("Yüz cihazlara yeniden gönderiliyor.");
  }, { error: "Yüz gönderilemedi" });
  const deleteFace = async () => {
    setDeleting(true);
    try {
      await remove({ employeeId });
      setRemoveOpen(false);
      setStatus("Merkezi yüz kaydı silindi; cihazlardan silme durumu aşağıda izlenebilir.");
    } finally { setDeleting(false); }
  };
  const pending = saveAction.pending || redistribution.pending || deleting || data?.busy === true;
  const reason = !hasCard ? "Yüz eklemek için önce kart atayın" : !data ? "Yüz bilgileri yükleniyor…" : data.busy ? "Devam eden yüz işleminin bitmesini bekleyin." : !data.active ? "Yüz kaydı için kişi aktif ve kart numarası kayıtlı olmalıdır." : targets.length === 0 ? "Kişinin erişim kapsamında uygun Hik gateway cihazı bulunamadı. Fotoğraf merkezi olarak saklanabilir." : "";
  const blocked = !hasCard || !data || !data.active || pending;
  const failedDeletion = data?.devices.some(item => item.target && item.operation === "deleteFace" && item.status === "failed");
  return <section className="space-y-3 border-t pt-4" aria-label="Yüz">
    <h3 className="text-base font-semibold">Yüz</h3>
    <p className="text-xs text-muted-foreground">Biyometrik yüz kaydıdır; profil fotoğrafından ayrıdır. Kişinin erişimi olan Hikvision cihazlarına gönderilir.</p>
    {!data ? <SectionSkeleton label="Yüz bilgileri yükleniyor" /> : <>
      <p className="text-sm">{data.registered ? "Merkezi yüz kaydı var." : "Kayıtlı yüz yok."}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={fileId} className="block text-sm">Yüz fotoğrafı (JPEG, en fazla 200 KB)</label>
          <Input id={fileId} type="file" accept="image/jpeg" disabled={blocked || failedDeletion} aria-describedby={reasonId} onChange={event => {
            const selected = event.target.files?.[0] ?? null;
            const invalid = selected && (selected.type !== "image/jpeg" || selected.size > MAX_FACE_BYTES || selected.size === 0);
            setFile(invalid ? null : selected);
            setFileError(invalid ? "JPEG biçiminde, en fazla 200 KB bir fotoğraf seçin." : "");
            if (invalid) event.target.value = "";
          }} />
          {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
          <Button type="button" variant="outline" disabled={blocked || !file || failedDeletion} aria-describedby={reasonId} onClick={() => setConfirm("upload")}>{data.registered ? "Fotoğrafla değiştir" : "Fotoğrafı kaydet"}</Button>
        </div>
        <div className="space-y-2">
          <label htmlFor={selectId} className="block text-sm">Yüz alınacak cihaz</label>
          <NativeSelect id={selectId} value={device?._id ?? ""} disabled={blocked || failedDeletion} onChange={event => setDeviceId(event.target.value)}>
            {!device && <option value="">Uygun cihaz yok</option>}
            {targets.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
          </NativeSelect>
          <Button type="button" variant="outline" disabled={blocked || !device || failedDeletion} aria-describedby={reasonId} onClick={() => setConfirm("capture")}>Cihazdan yüz al</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.registered && <Button type="button" variant="outline" disabled={blocked || !targets.length || failedDeletion} onClick={() => void redistribution.run()}>Cihazlara yeniden gönder</Button>}
        {(data.registered || failedDeletion) && <Button type="button" variant="outline" disabled={pending} onClick={() => setRemoveOpen(true)}>{failedDeletion ? "Cihazlardan silmeyi yeniden dene" : "Yüzü sil"}</Button>}
      </div>
      {failedDeletion && <p className="text-sm text-destructive">Yeni kayıttan önce başarısız cihaz silme işlemini yeniden deneyin.</p>}
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Cihaz dağıtımı</h4>
        <p className="text-xs text-muted-foreground">Teslim durumu son gönderimin cihaz yanıtıdır; cihazdaki güncel kayıt ayrıca doğrulanmamıştır.</p>
        {data.devices.length === 0 ? <p className="text-sm text-muted-foreground">Yüz gönderilecek cihaz yok.</p> : <ul className="divide-y">{data.devices.map(item => <li key={item._id} className="py-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span>{item.name}{!item.target && " · Önceki hedef"}</span><span>{faceDeliveryLabel(item)}</span></div>
          {item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
        </li>)}</ul>}
      </div>
    </>}
    <p id={reasonId} className="text-xs text-muted-foreground empty:hidden">{reason}</p>
    <p role="status" aria-live="polite" className="text-sm empty:hidden">{status}</p>
    <Dialog open={confirm !== null} onOpenChange={open => { if (!open && !saveAction.pending) setConfirm(null); }}><DialogContent>
      <DialogHeader><DialogTitle>{data?.registered ? "Yüz kaydını değiştir" : "Yüz kaydını ekle"}</DialogTitle><DialogDescription>
        {confirm === "capture" ? `${device?.name ?? "Cihaz"} kamerasına bakın. Cihazdan alınan JPEG yüz kaydı olarak saklanır.` : `${file?.name ?? "Seçili fotoğraf"} biyometrik yüz kaydı olarak saklanır.`}
        {data?.registered && " Mevcut merkezi yüz kaydı değiştirilir."} Kişinin erişim kapsamındaki Hikvision cihazlarına gönderilir.
      </DialogDescription></DialogHeader>
      <DialogFooter><Button type="button" variant="outline" disabled={saveAction.pending} onClick={() => setConfirm(null)}>Vazgeç</Button><Button type="button" disabled={blocked} onClick={() => void saveAction.run()}>{confirm === "capture" ? "Kaydı başlat" : "Kaydet"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDestructive open={removeOpen} onOpenChange={setRemoveOpen} title="Yüz kaydını sil" objectName="Biyometrik yüz kaydı" effects={["Merkezi yüz fotoğrafı kalıcı silinir; yeniden kayıt gerekir.", "Mevcut ve önceki hedef Hikvision cihazlarına yüz silme isteği gönderilir; cihaz sonuçları ayrıca gösterilir."]} confirmLabel="Yüzü sil" errorTitle="Yüz silinemedi" onConfirm={deleteFace} />
  </section>;
}
