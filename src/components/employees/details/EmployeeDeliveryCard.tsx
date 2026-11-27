import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { usePermissions } from "@/hooks/usePermissions";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";

type Device = FunctionReturnType<typeof api.employeeDelivery.getForEmployee>["devices"][number];
const labels = { delivered: "Gönderildi", pending: "Bekliyor", failed: "Hata", missing: "Gönderim doğrulanmadı" };
const trDate = (time: number) => new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }).format(time);

export function EmployeeDeliveryCard({ employeeId }: { employeeId: Id<"employees"> }) {
  const { projectId } = useActiveProjectScope();
  const { can } = usePermissions();
  const data = useQuery(api.employeeDelivery.getForEmployee, projectId && can("employees.view") ? { projectId, employeeId } : "skip");
  const retryHik = useMutation(api.hikvisionSync.retrySyncIssue);
  const retryIde = useMutation(api.ideSync.retrySyncIssue);
  const [selected, setSelected] = useState<Device | null>(null);
  const resend = async () => {
    const retry = selected?.retry;
    if (!retry || !can("devices.manage")) return;
    const result = retry.source === "hikvision" ? await retryHik({ issueId: retry.id }) : await retryIde({ opId: retry.id });
    notify.info(result.queued ? "Yeniden gönderim sıraya alındı; cihaz onayı bekleniyor." : "İşlem sıraya alınmadı; güncel cihaz durumunu kontrol edin.");
  };
  if (!can("employees.view")) return null;
  return <section className="space-y-3 border-t pt-4">
    <h3 className="text-base font-semibold">Cihaz teslim durumu</h3>
    <p className="text-xs text-muted-foreground">Kişi ve kart gönderimi; sıraya alınan işlemler cihaz onayı bekler.</p>
    {!data ? <SectionSkeleton label="Cihaz teslim durumu yükleniyor" /> : <>
      {!data.hasCard && <p className="text-sm text-muted-foreground">Fiziksel kart atanmamış; kart gönderimi beklenmez.</p>}
      {data.incomplete && <p role="status" className="text-sm">Okuma sınırına ulaşıldı; cihaz ve işlem listesi eksik olabilir.</p>}
      {data.devices.length === 0 && <p className="text-sm text-muted-foreground">Erişim kapsamında cihaz veya gönderim kaydı bulunamadı.</p>}
      <ul className="divide-y">{data.devices.map(device => <li key={device.deviceId} className="space-y-1 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Link className="underline" to={`/devices?deviceId=${device.deviceId}`}>{device.name}</Link>
          <StatusBadge tone={device.state === "delivered" ? "success" : device.state === "failed" ? "danger" : "neutral"}>{labels[device.state]}</StatusBadge>
          {!device.target && <span className="text-xs text-muted-foreground">Önceki hedef</span>}
        </div>
        {device.state === "missing" && <p className="text-xs text-muted-foreground">Güncel kişi/kart için tamamlanmış gönderim kanıtı yok.</p>}
        {device.state === "failed" && <p className="text-xs">Cihaz gönderimi tamamlanamadı. Ayrıntıları cihaz sayfasından inceleyin.</p>}
        <p className="text-xs text-muted-foreground">Son deneme: {device.lastAttemptAt === null ? "Kaydedilmemiş" : `${trDate(device.lastAttemptAt)} (TR saati)`}</p>
        {device.lastResultAt !== null && <p className="text-xs text-muted-foreground">Son durum kaydı: {trDate(device.lastResultAt)} (TR saati)</p>}
        {can("devices.manage") && device.retry && <Button size="sm" variant="outline" onClick={() => setSelected(device)}>Tekrar gönder</Button>}
      </li>)}</ul>
    </>}
    <ConfirmDestructive open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }} title="Gönderim yeniden denensin mi?" objectName={selected?.name ?? ""} confirmLabel="Tekrar gönder" effects={["Seçili kişi/kart işlemi cihaza yeniden gönderilir.", "Sıraya alınması cihazın işlemi tamamladığı anlamına gelmez."]} onConfirm={resend} />
  </section>;
}
