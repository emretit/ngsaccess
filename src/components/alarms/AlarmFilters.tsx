import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-picker";
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

export const DEFAULT_ALARM_FILTERS: AlarmFiltersValue = { status: "open", severity: "", deviceId: "", fromDay: "", toDay: "" };

export function AlarmFilters({ value, devices, onChange, start, actions }: { value: AlarmFiltersValue; devices: Device[]; onChange: (next: AlarmFiltersValue) => void; start?: ReactNode; actions?: ReactNode }) {
  return <FilterBar onClear={() => onChange(DEFAULT_ALARM_FILTERS)} hasFilters={Object.entries(value).some(([key, item]) => item !== DEFAULT_ALARM_FILTERS[key as keyof AlarmFiltersValue])} end={actions}>
    {start}
    <FilterField label="Durum" htmlFor="alarm-status"><Select value={value.status} onValueChange={status => { if (status === "open" || status === "acked" || status === "all") onChange({ ...value, status }); }}><SelectTrigger id="alarm-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Açık</SelectItem><SelectItem value="acked">Onaylı</SelectItem><SelectItem value="all">Tüm durumlar</SelectItem></SelectContent></Select></FilterField>
    <FilterField label="Önem" htmlFor="alarm-severity"><Select value={value.severity || "all"} onValueChange={severity => { if (severity === "all" || severity === "critical" || severity === "warning") onChange({ ...value, severity: severity === "all" ? "" : severity }); }}><SelectTrigger id="alarm-severity"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm önemler</SelectItem><SelectItem value="critical">Kritik</SelectItem><SelectItem value="warning">Uyarı</SelectItem></SelectContent></Select></FilterField>
    <FilterField label="Cihaz" htmlFor="alarm-device"><Select value={value.deviceId || "all"} onValueChange={deviceId => onChange({ ...value, deviceId: deviceId === "all" ? "" : deviceId as Id<"devices"> })}><SelectTrigger id="alarm-device"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm cihazlar</SelectItem>{devices.map(device => <SelectItem key={device._id} value={device._id}>{device.name}</SelectItem>)}</SelectContent></Select></FilterField>
    <FilterField label="Başlangıç" htmlFor="alarm-from-day"><DateInput id="alarm-from-day" className="w-full min-w-0" value={value.fromDay} max={value.toDay || undefined} onChange={fromDay => onChange({ ...value, fromDay })} /></FilterField>
    <FilterField label="Bitiş" htmlFor="alarm-to-day"><DateInput id="alarm-to-day" className="w-full min-w-0" value={value.toDay} min={value.fromDay || undefined} onChange={toDay => onChange({ ...value, toDay })} /></FilterField>
  </FilterBar>;
}

export function AlarmAcknowledgeButton({ label = "Onayla", onAcknowledge }: { label?: string; onAcknowledge: () => void }) {
  return <Button variant="ghost" onClick={onAcknowledge}>{label}</Button>;
}

export function alarmListArgs(projectId: Id<"projects">, category: "alarm" | "exception", value: AlarmFiltersValue) {
  const isoDay = (day: string, end = false) => day ? new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}+03:00`).toISOString() : undefined;
  return { projectId, category, status: value.status, severity: value.severity || undefined, deviceId: value.deviceId || undefined, from: isoDay(value.fromDay), to: isoDay(value.toDay, true) };
}
