import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useDevices } from "@/hooks/useDevices";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import {
  effectiveDoorIds,
  scopeSelectionState,
  toggleDoors,
  toggleSelection,
  type DoorSelection,
} from "./selectionHelpers";

interface ZoneDeviceTreeProps<T extends DoorSelection> {
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const ZoneDeviceTree = <T extends DoorSelection>({
  formData,
  setFormData,
}: ZoneDeviceTreeProps<T>) => {
  const prefix = useId();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const { devices, isLoading } = useDevices();
  const { zones, doors, loading } = useZonesAndDoors();
  const availableDoors = doors.filter(
    (door) =>
      door.deviceId && devices.some((device) => device._id === door.deviceId),
  );
  const effective = effectiveDoorIds(availableDoors, formData);
  const searchText = search.trim().toLocaleLowerCase("tr");
  const matches = (text: string) =>
    text.toLocaleLowerCase("tr").includes(searchText);
  const deviceDoors = (id: string) =>
    availableDoors.filter((door) => door.deviceId === id);
  const doorless = devices.filter(
    (device) => deviceDoors(device._id).length === 0,
  );
  const changeScope = (
    doorIds: string[],
    deviceIds: string[],
    checked: boolean,
  ) =>
    setFormData((prev) => {
      const next = toggleDoors(availableDoors, prev, doorIds, checked);
      return {
        ...prev,
        ...next,
        selected_devices: toggleSelection(
          next.selected_devices,
          deviceIds,
          checked,
        ),
      };
    });
  const state = (doorIds: string[], deviceIds: string[]) =>
    scopeSelectionState(
      doorIds,
      deviceIds,
      effective,
      formData.selected_devices,
    );
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allDoorIds = availableDoors.map((door) => door._id);
  const allDoorlessIds = doorless.map((device) => device._id);
  const renderZone = (
    zoneId?: string,
    name = "Bölgesi olmayan kapılar / cihazlar",
  ) => {
    const zoneDoors = availableDoors.filter(
      (door) => (door.zoneId ?? undefined) === zoneId,
    );
    const zoneDoorless = doorless.filter(
      (device) => (device.zoneId ?? undefined) === zoneId,
    );
    const zoneDeviceIds = new Set([
      ...zoneDoors.map((door) => door.deviceId),
      ...zoneDoorless.map((device) => device._id),
    ]);
    const zoneDevices = devices.filter((device) =>
      zoneDeviceIds.has(device._id),
    );
    const zoneMatches = matches(name);
    const visibleDevices = zoneDevices.filter(
      (device) =>
        zoneMatches ||
        matches(deviceDisplayName(device)) ||
        zoneDoors.some(
          (door) => door.deviceId === device._id && matches(door.name),
        ),
    );
    if (zoneDevices.length === 0 || visibleDevices.length === 0) return null;
    const key = zoneId ?? "unassigned";
    const id = `${prefix}-zone-${key}`;
    const open = Boolean(searchText) || expanded.has(key);
    return (
      <div key={key} className="space-y-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={`${name} bölgesini ${open ? "daralt" : "genişlet"}`}
            aria-expanded={open}
            aria-controls={`${id}-content`}
            onClick={() => toggle(key)}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <Checkbox
            id={id}
            checked={state(
              zoneDoors.map((door) => door._id),
              zoneDoorless.map((device) => device._id),
            )}
            onCheckedChange={(checked) =>
              changeScope(
                zoneDoors.map((door) => door._id),
                zoneDoorless.map((device) => device._id),
                checked === true,
              )
            }
          />
          <Label htmlFor={id} className="min-w-0 break-words">
            {name} ({zoneDoors.length} kapı)
          </Label>
        </div>
        <div
          id={`${id}-content`}
          hidden={!open}
          className="ml-3 space-y-2 border-l pl-2"
        >
          {visibleDevices.map((device) => {
            const scopedDoors = zoneDoors.filter(
              (door) => door.deviceId === device._id,
            );
            const deviceName = deviceDisplayName(device);
            const deviceId = `${id}-device-${device._id}`;
            const deviceKey = `${key}-${device._id}`;
            const deviceOpen = Boolean(searchText) || expanded.has(deviceKey);
            const doorIds = scopedDoors.map((door) => door._id);
            const noDoors = scopedDoors.length === 0 ? [device._id] : [];
            return (
              <div key={device._id}>
                <div className="flex items-center gap-2">
                  {scopedDoors.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label={`${deviceName} kapılarını ${deviceOpen ? "daralt" : "genişlet"}`}
                      aria-expanded={deviceOpen}
                      aria-controls={`${deviceId}-content`}
                      onClick={() => toggle(deviceKey)}
                    >
                      {deviceOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Checkbox
                    id={deviceId}
                    checked={state(doorIds, noDoors)}
                    onCheckedChange={(checked) =>
                      changeScope(doorIds, noDoors, checked === true)
                    }
                  />
                  <Label
                    htmlFor={deviceId}
                    className="min-w-0 break-words font-normal"
                  >
                    {deviceName}
                    {scopedDoors.length > 0
                      ? ` — bu bölgede ${scopedDoors.length} kapı`
                      : " — tüm cihaz"}
                  </Label>
                </div>
                <div
                  id={`${deviceId}-content`}
                  hidden={!deviceOpen}
                  className="ml-3 space-y-2 border-l pl-2"
                >
                  {scopedDoors
                    .filter(
                      (door) =>
                        zoneMatches ||
                        matches(deviceName) ||
                        matches(door.name),
                    )
                    .map((door) => (
                      <div
                        key={door._id}
                        className="flex items-center gap-2 py-1"
                      >
                        <Checkbox
                          id={`${deviceId}-${door._id}`}
                          checked={effective.includes(door._id)}
                          onCheckedChange={(checked) =>
                            changeScope([door._id], [], checked === true)
                          }
                        />
                        <Label
                          htmlFor={`${deviceId}-${door._id}`}
                          className="min-w-0 break-words font-normal"
                        >
                          {door.name}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderedZones = [
    ...zones.map((zone) => renderZone(zone._id, zone.name)),
    renderZone(),
  ];
  const hasResults = renderedZones.some((zone) => zone !== null);
  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Hangi kapılarda?</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto min-h-9 max-w-full whitespace-normal"
          disabled={isLoading || loading}
          onClick={() =>
            changeScope(
              allDoorIds,
              allDoorlessIds,
              state(allDoorIds, allDoorlessIds) !== true,
            )
          }
        >
          {state(allDoorIds, allDoorlessIds) === true
            ? "Projedeki tüm seçimleri kaldır"
            : "Projedeki tüm kapıları ve cihazları seç"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {effective.length} kapı, {formData.selected_devices.length} cihaz
        seçili. Bölge seçimi yalnız o bölgenin kapılarını kapsar.
      </p>
      <Label htmlFor={`${prefix}-search`} className="sr-only">
        Kapı, panel veya bölge ara
      </Label>
      <Input
        id={`${prefix}-search`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Kapı, panel veya bölge ara"
      />
      {isLoading || loading ? (
        <SectionSkeleton rows={3} label="Kapılar yükleniyor" />
      ) : (
        <div className="rounded-md border p-2">
          {renderedZones}
          {!hasResults && (
            <EmptyState
              title={
                searchText
                  ? "Aramayla eşleşen kapı veya panel yok"
                  : "Cihaz bulunamadı"
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
