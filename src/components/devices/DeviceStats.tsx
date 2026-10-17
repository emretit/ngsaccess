import { Device } from "@/types/device";
import { StatInline } from "@/components/shared/StatInline";

export function DeviceStats({ devices, loading = false }: { devices: Device[]; loading?: boolean }) {
  return <StatInline loading={loading} items={[
    { label: "Toplam", value: devices.length },
    { label: "Çevrimiçi", value: devices.filter(d => d.connectionStatus === "online").length },
    { label: "Çevrimdışı", value: devices.filter(d => d.connectionStatus === "offline").length },
    { label: "Henüz bağlanmadı", value: devices.filter(d => d.connectionStatus === "never").length },
  ]} />;
}
