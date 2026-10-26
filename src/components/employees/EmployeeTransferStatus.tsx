import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { formatTrDateTime } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { isTransferActive, type EmployeeTransfer, type EmploymentEmployee } from "./lib/employment";

const targetLabels: Record<EmployeeTransfer["targets"][number]["state"], { label: string; variant: BadgeProps["variant"] }> = {
  pending: { label: "Bekliyor", variant: "outline" },
  confirmed: { label: "Silindi", variant: "successSubtle" },
  failed: { label: "Başarısız", variant: "dangerSubtle" },
  superseded: { label: "Korundu", variant: "warningSubtle" },
  deviceRemoved: { label: "Cihaz kaldırıldı", variant: "secondary" },
};

export function EmployeeTransferStatus({ employee }: { employee: EmploymentEmployee }) {
  const transfer = useQuery(api.employeeTermination.getEmployeeTransfer, { employeeId: employee._id });
  if (!transfer) return null;
  return <TransferStatus key={transfer.transferId} employee={employee} transfer={transfer} />;
}

function TransferStatus({ employee, transfer }: { employee: EmploymentEmployee; transfer: EmployeeTransfer }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const retry = useMutation(api.employeeTermination.retryTransfer);
  const cancel = useMutation(api.employeeTermination.cancelTransfer);
  const { run, pending } = useAsyncAction(() => retry({ transferId: transfer.transferId }), { success: "Taşıma yeniden deneniyor" });
  const isSource = employee.terminationType === "transfer";
  const active = isTransferActive(transfer);
  const superseded = transfer.targets.some(target => target.state === "superseded");
  const completeCount = transfer.targets.filter(target => target.state === "confirmed" || target.state === "deviceRemoved").length;
  return <section className="space-y-3 rounded-md border p-4" aria-label="Proje taşıma durumu">
    <h3 className="text-sm font-semibold">{transfer.status === "cancelled" ? "Proje taşıması iptal edildi" : isSource
      ? `${active ? "Başka projeye taşınıyor" : "Başka projeye taşındı"} → ${transfer.counterpartProjectName}`
      : `${transfer.counterpartProjectName} projesinden ${active ? "taşınıyor — kart eski cihazlardan silinince verilecek" : "taşındı"}`}</h3>
    <p className="text-xs text-muted-foreground">{transfer.completedAt ? "Tamamlandı" : "Başlatıldı"}: {formatTrDateTime(transfer.completedAt ?? transfer.requestedAt)} (TR saati)</p>
    {active && <>
      {transfer.targets.length > 0 && <p className="text-sm" aria-live="polite">{completeCount} / {transfer.targets.length} cihazda silme tamamlandı.</p>}
      {transfer.targets.length > 0 && <ul className="divide-y">
        {transfer.targets.map(target => <li key={target.deviceId} className="space-y-1 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-words">{target.deviceName}</span><Badge variant={targetLabels[target.state].variant}>{targetLabels[target.state].label}</Badge></div>
          <p className="text-xs text-muted-foreground">Son görülme: {target.lastSeen === null ? "Bilinmiyor" : `${formatTrDateTime(target.lastSeen)} (TR saati)`}</p>
          {target.lastError && <p className="break-words text-xs text-destructive">{target.lastError}</p>}
        </li>)}
      </ul>}
      {transfer.status === "revoked" && <p className="text-sm">Eski cihazlardan silindi. Yeni projedeki kart kaydı tamamlanıyor.</p>}
      {transfer.status === "stuck" && <div role="alert" className="space-y-2 text-sm">
        <p className="font-medium">Taşıma takıldı</p>
        <p>{transfer.stuckReason ?? "Cihazlardan silme onayı alınamadı. Cihazları kontrol edip yeniden deneyin veya taşımayı iptal edin."}</p>
        {transfer.lastError && <p className="break-words">{transfer.lastError}</p>}
        {superseded && <p>Bu kart eski projede başka aktif kayıtta; o kaydı düzeltin ya da taşımayı iptal edin.</p>}
      </div>}
      <div className="flex flex-wrap gap-2">
        {transfer.status === "stuck" && transfer.canRetry && !superseded && <Button className="max-sm:min-h-11" variant="outline" disabled={pending} onClick={() => { void run(); }}>{pending ? "Yeniden deneniyor…" : "Yeniden dene"}</Button>}
        {transfer.canCancel && <Button className="max-sm:min-h-11" variant="outline" disabled={pending} onClick={() => setCancelOpen(true)}>Taşımayı iptal et</Button>}
      </div>
      <ConfirmDestructive open={cancelOpen} onOpenChange={setCancelOpen} title="Taşıma iptal edilsin mi?" objectName={`${employee.firstName} ${employee.lastName}`} effects={["Kişi eski projede yeniden aktif olur; yeni projedeki kartsız kayıt silinir.", "Parmak izi şablonları silindi; yeniden kaydedilmeli.", "Mobil uygulama şifresi yeniden kurulmalı."]} confirmLabel="Taşımayı iptal et" onConfirm={() => cancel({ transferId: transfer.transferId })} />
    </>}
  </section>;
}
