import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useProjectFilteredDevices } from "@/hooks/useProjectFilteredDevices";
import { useNow } from "@/hooks/useNow";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { timeAgoTr } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import { DashboardPanel } from "./DashboardPanel";

const VISIBLE_DEVICES = 6;
// Sorunlu cihazlar önce: bağlantısı kopan, hiç bağlanmayan, sonra çevrimiçi.
const STATUS_ORDER = { offline: 0, never: 1, online: 2 } as const;

/** Cihazların bağlantı durumu; sorunlu olanlar üstte. */
export default function DeviceHealth() {
  const { devices, isLoading } = useProjectFilteredDevices();
  const now = useNow(30_000);
  const online = devices.filter((device) => device.connectionStatus === "online").length;
  const sorted = [...devices].sort((a, b) =>
    STATUS_ORDER[a.connectionStatus ?? "never"] - STATUS_ORDER[b.connectionStatus ?? "never"] ||
    deviceDisplayName(a).localeCompare(deviceDisplayName(b), "tr"));
  return (
    <DashboardPanel
      title="Cihaz durumu"
      aside={devices.length > 0 && (
        <span className="text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{online}/{devices.length}</span> çevrimiçi
        </span>
      )}
      link={{ to: "/devices", label: "Cihazlar" }}
    >
      {isLoading ? (
        <SectionSkeleton rows={3} label="Cihaz durumu yükleniyor" className="p-4" />
      ) : devices.length === 0 ? (
        <div className="pb-6">
          <EmptyState compact title="Bu projede cihaz yok" description="Kart okuması almak için projeye bir cihaz ekleyin." />
          <div className="flex justify-center"><Button asChild variant="outline"><Link to="/devices">Cihazlara git</Link></Button></div>
        </div>
      ) : (
        <ul aria-label="Cihaz bağlantıları" className="-mb-px grid min-[761px]:grid-cols-2">
          {sorted.slice(0, VISIBLE_DEVICES).map((device) => {
            const status = device.connectionStatus ?? "never";
            const detail = status === "online" ? "Çevrimiçi" : status === "never" ? "Hiç bağlanmadı" : (timeAgoTr(device.lastSeen, now) ?? "Çevrimdışı");
            return (
              <li key={device._id} className="border-b min-[761px]:odd:border-r">
                <Link to={`/devices?deviceId=${device._id}`} className="flex min-h-11 items-center gap-2.5 px-4 hover:bg-subtle min-[761px]:px-5">
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 shrink-0 rounded-full", status === "online" ? "status-success-bg" : status === "offline" ? "status-danger-bg" : "bg-muted-foreground/40")}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{deviceDisplayName(device)}</span>
                  <span className={cn("shrink-0 text-xs", status === "offline" ? "text-danger" : "text-muted-foreground")}>{detail}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {devices.length > VISIBLE_DEVICES && (
        <p className="px-4 py-2.5 text-[11px] text-muted-foreground min-[761px]:px-5">
          {devices.length - VISIBLE_DEVICES} cihaz daha · Tümü Cihazlar sayfasında
        </p>
      )}
    </DashboardPanel>
  );
}
