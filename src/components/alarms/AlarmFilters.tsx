import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui/button";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Device = FunctionReturnType<typeof api.devices.list>[number];
export type AlarmFiltersValue = {
  status: "open" | "acked" | "all";
  severity: "" | "warning" | "critical";
  deviceId: Id<"devices"> | "";
  fromDay: string;
  toDay: string;
};

export function AlarmFilters({ value, devices, onChange }: { value: AlarmFiltersValue; devices: Device[]; onChange: (next: AlarmFiltersValue) => void }) {
  return <>
    <label className="text-sm">Durum <select aria-label="Durum" className="ml-2 rounded border bg-background p-2" value={value.status} onChange={event => onChange({ ...value, status: event.target.value as AlarmFiltersValue["status"] })}><option value="open">Açık</option><option value="acked">Onaylı</option><option value="all">Tümü</option></select></label>
    <label className="text-sm">Önem <select aria-label="Önem" className="ml-2 rounded border bg-background p-2" value={value.severity} onChange={event => onChange({ ...value, severity: event.target.value as AlarmFiltersValue["severity"] })}><option value="">Tümü</option><option value="critical">Kritik</option><option value="warning">Uyarı</option></select></label>
    <label className="text-sm">Cihaz <select aria-label="Cihaz" className="ml-2 rounded border bg-background p-2" value={value.deviceId} onChange={event => onChange({ ...value, deviceId: event.target.value as Id<"devices"> | "" })}><option value="">Tüm cihazlar</option>{devices.map(device => <option key={device._id} value={device._id}>{device.name}</option>)}</select></label>
    <label className="text-sm">Başlangıç <input aria-label="Başlangıç tarihi" type="date" className="ml-2 rounded border bg-background p-2" value={value.fromDay} onChange={event => onChange({ ...value, fromDay: event.target.value })} /></label>
    <label className="text-sm">Bitiş <input aria-label="Bitiş tarihi" type="date" className="ml-2 rounded border bg-background p-2" value={value.toDay} onChange={event => onChange({ ...value, toDay: event.target.value })} /></label>
  </>;
}

export function AlarmAcknowledgeButton({ label = "Onayla", onAcknowledge }: { label?: string; onAcknowledge: () => void }) {
  return <Button variant="ghost" onClick={onAcknowledge}>{label}</Button>;
}

export function alarmListArgs(projectId: Id<"projects">, category: "alarm" | "exception", value: AlarmFiltersValue) {
  const isoDay = (day: string, end = false) => day ? new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}+03:00`).toISOString() : undefined;
  return { projectId, category, status: value.status, severity: value.severity || undefined, deviceId: value.deviceId || undefined, from: isoDay(value.fromDay), to: isoDay(value.toDay, true) };
}
