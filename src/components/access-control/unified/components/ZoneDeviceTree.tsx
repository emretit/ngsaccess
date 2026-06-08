import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronDown, Building2, MapPin, DoorOpen } from "lucide-react";
import { useDevices } from "@/hooks/useDevices";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { areAllSelected } from "./selectionHelpers";

interface ZoneDeviceTreeFormData {
  selected_devices: string[];
  // IDE permission.io kaynağı: kuralın etki ettiği kapılar. Boşsa cihazın tüm kapıları varsayılır.
  selected_doors: string[];
}

interface ZoneDeviceTreeProps<T extends ZoneDeviceTreeFormData = ZoneDeviceTreeFormData> {
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const ZoneDeviceTree = <T extends ZoneDeviceTreeFormData,>({ formData, setFormData }: ZoneDeviceTreeProps<T>) => {
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const { devices } = useDevices();
  const { zones, doors } = useZonesAndDoors();

  // Bir cihaza bağlı kapılar (ioId sıralı). IDE Smart panellerde 4 aktüatör/kapı.
  const getDoorsForDevice = (deviceId: string) =>
    doors
      .filter((d) => String(d.deviceId ?? '') === deviceId)
      .sort((a, b) => (a.ioId ?? 0) - (b.ioId ?? 0));

  const getDevicesForZone = (zoneId: string) =>
    devices.filter((device) => String(device.zoneId ?? '') === zoneId);

  // Cihaz seç/kaldır → cihazın kendisi + tüm kapıları birlikte hareket eder.
  const handleDeviceChange = (deviceId: string, checked: boolean) => {
    const doorIds = getDoorsForDevice(deviceId).map((d) => String(d._id));
    setFormData((prev) => {
      if (checked) {
        return {
          ...prev,
          selected_devices: [...new Set([...prev.selected_devices, deviceId])],
          selected_doors: [...new Set([...prev.selected_doors, ...doorIds])],
        };
      }
      const doorSet = new Set(doorIds);
      return {
        ...prev,
        selected_devices: prev.selected_devices.filter((id) => id !== deviceId),
        selected_doors: prev.selected_doors.filter((id) => !doorSet.has(id)),
      };
    });
  };

  // Kapı seç/kaldır → kapı seçilince cihaz da erişime girer. Son kapı da kalkınca cihazı
  // selected_devices'tan çıkar: aksi halde cihaz seçili + selected_doors boş kalır ve backend
  // "kapı seçimi yok → tüm kapılar" fallback'ine düşer (kullanıcı niyetinin tersi).
  const handleDoorChange = (deviceId: string, doorId: string, checked: boolean) => {
    const deviceDoorIds = getDoorsForDevice(deviceId).map((d) => String(d._id));
    setFormData((prev) => {
      if (checked) {
        return {
          ...prev,
          selected_devices: [...new Set([...prev.selected_devices, deviceId])],
          selected_doors: [...new Set([...prev.selected_doors, doorId])],
        };
      }
      const nextDoors = prev.selected_doors.filter((id) => id !== doorId);
      const stillHasDoor = deviceDoorIds.some((id) => nextDoors.includes(id));
      return {
        ...prev,
        selected_devices: stillHasDoor
          ? prev.selected_devices
          : prev.selected_devices.filter((id) => id !== deviceId),
        selected_doors: nextDoors,
      };
    });
  };

  const handleZoneChange = (zoneId: string, checked: boolean) => {
    const zoneDevices = getDevicesForZone(zoneId);
    zoneDevices.forEach((device) => handleDeviceChange(String(device._id), checked));
  };

  const handleSelectAllDevices = () => {
    const allSelected = areAllSelected(devices, formData.selected_devices);
    devices.forEach((device) => handleDeviceChange(String(device._id), !allSelected));
  };

  const toggleExpansion = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const allDevicesSelected = areAllSelected(devices, formData.selected_devices);

  // Cihazın kapı-seçim durumu: tüm / bazı / hiç → checkbox checked/indeterminate.
  const deviceCheckState = (deviceId: string): boolean | "indeterminate" => {
    const doorIds = getDoorsForDevice(deviceId).map((d) => String(d._id));
    if (doorIds.length === 0) return formData.selected_devices.includes(deviceId);
    const selectedCount = doorIds.filter((id) => formData.selected_doors.includes(id)).length;
    if (selectedCount === 0 && !formData.selected_devices.includes(deviceId)) return false;
    if (selectedCount === doorIds.length) return true;
    if (selectedCount === 0) return formData.selected_devices.includes(deviceId);
    return "indeterminate";
  };

  const renderDevice = (device: (typeof devices)[number]) => {
    const deviceId = String(device._id);
    const deviceDoors = getDoorsForDevice(deviceId);
    const isExpanded = expandedDevices.has(deviceId);
    return (
      <div key={`device-${deviceId}`} className="space-y-1">
        <div className="flex items-center space-x-2" style={{ paddingLeft: '36px' }}>
          {deviceDoors.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpansion(expandedDevices, setExpandedDevices, deviceId)}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          ) : (
            <span className="inline-block h-5 w-5" />
          )}
          <Checkbox
            id={`device-${deviceId}`}
            checked={deviceCheckState(deviceId)}
            onCheckedChange={(checked) => handleDeviceChange(deviceId, checked === true)}
          />
          <MapPin className="h-3 w-3 text-green-500" />
          <Label htmlFor={`device-${deviceId}`} className="text-sm font-normal cursor-pointer">
            {deviceDisplayName(device)}
            {deviceDoors.length > 0 ? ` (${deviceDoors.length} kapı)` : ''}
          </Label>
        </div>

        {isExpanded && deviceDoors.length > 0 && (
          <div className="space-y-1">
            {deviceDoors.map((door) => {
              const doorId = String(door._id);
              return (
                <div key={`door-${doorId}`} className="flex items-center space-x-2" style={{ paddingLeft: '72px' }}>
                  <Checkbox
                    id={`door-${doorId}`}
                    checked={formData.selected_doors.includes(doorId)}
                    onCheckedChange={(checked) => handleDoorChange(deviceId, doorId, checked === true)}
                  />
                  <DoorOpen className="h-3 w-3 text-blue-500" />
                  <Label htmlFor={`door-${doorId}`} className="text-sm font-normal cursor-pointer">
                    {door.name}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderZoneTree = () => {
    return zones.map((zone) => {
      const zoneId = String(zone._id);
      const zoneDevices = getDevicesForZone(zoneId);
      const isExpanded = expandedZones.has(zoneId);
      const isSelected = areAllSelected(zoneDevices, formData.selected_devices);

      return (
        <div key={`zone-${zoneId}`} className="space-y-1">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpansion(expandedZones, setExpandedZones, zoneId)}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
            <Checkbox
              id={`zone-${zoneId}`}
              checked={isSelected}
              onCheckedChange={(checked) => handleZoneChange(zoneId, Boolean(checked))}
            />
            <Building2 className="h-4 w-4 text-purple-500" />
            <Label htmlFor={`zone-${zoneId}`} className="text-sm font-medium cursor-pointer flex-1">
              {zone.name} ({zoneDevices.length} cihaz)
            </Label>
          </div>
          {isExpanded && <div className="space-y-1">{zoneDevices.map(renderDevice)}</div>}
        </div>
      );
    });
  };

  const orphanDevices = devices.filter((device) => !device.zoneId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Hangi Bölge ve Cihazlarda?</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleSelectAllDevices} className="text-xs">
          {allDevicesSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
        </Button>
      </div>
      <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
        {renderZoneTree()}

        {orphanDevices.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <Label className="text-sm font-medium text-gray-700">
                Bölgesi Olmayan Cihazlar ({orphanDevices.length})
              </Label>
            </div>
            {orphanDevices.map(renderDevice)}
          </div>
        )}
      </div>
    </div>
  );
};
