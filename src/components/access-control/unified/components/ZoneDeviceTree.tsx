
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronDown, Building2, MapPin } from "lucide-react";
import { useDevices } from "@/hooks/useDevices";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";

interface ZoneDeviceTreeProps {
  formData: {
    selected_devices: string[];
    selected_zones: string[];
  };
  setFormData: (updater: (prev: any) => any) => void;
}

export const ZoneDeviceTree = ({ formData, setFormData }: ZoneDeviceTreeProps) => {
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const { devices } = useDevices();
  const { zones } = useZonesAndDoors();

  const handleDeviceChange = (deviceId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selected_devices: checked
        ? [...prev.selected_devices, deviceId]
        : prev.selected_devices.filter(id => id !== deviceId)
    }));
  };

  const handleZoneChange = (zoneId: string, checked: boolean) => {
    const zoneDevices = devices.filter(device => String(device.zoneId ?? '') === zoneId);
    const zoneDeviceIds = zoneDevices.map(device => String(device._id));

    setFormData(prev => {
      const newZones = checked
        ? [...prev.selected_zones, zoneId]
        : prev.selected_zones.filter(id => id !== zoneId);

      const newDevices = checked
        ? [...new Set([...prev.selected_devices, ...zoneDeviceIds])]
        : prev.selected_devices.filter(id => !zoneDeviceIds.includes(id));

      return {
        ...prev,
        selected_zones: newZones,
        selected_devices: newDevices
      };
    });
  };

  const handleSelectAllDevices = () => {
    const allDeviceIds = devices.map(device => String(device._id));
    const allSelected = allDeviceIds.every(id => formData.selected_devices.includes(id));

    setFormData(prev => ({
      ...prev,
      selected_devices: allSelected ? [] : allDeviceIds,
      selected_zones: allSelected ? [] : zones.map(zone => String(zone._id))
    }));
  };

  const toggleZoneExpansion = (zoneId: string) => {
    setExpandedZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId);
      } else {
        newSet.add(zoneId);
      }
      return newSet;
    });
  };

  const getDevicesForZone = (zoneId: string) => {
    return devices.filter(device => String(device.zoneId ?? '') === zoneId);
  };

  const isZoneSelected = (zoneId: string) => {
    return formData.selected_zones.includes(zoneId);
  };

  const allDevicesSelected = devices.length > 0 && devices.every(device =>
    formData.selected_devices.includes(String(device._id))
  );

  const getDeviceLocationDisplay = (device: any) => {
    const zone = zones.find(z => String(z._id) === String(device.zoneId));
    return zone ? zone.name : 'Konum Belirtilmemiş';
  };

  const renderZoneTree = () => {
    return zones.map(zone => {
      const zoneId = String(zone._id);
      const zoneDevices = getDevicesForZone(zoneId);
      const isExpanded = expandedZones.has(zoneId);
      const isSelected = isZoneSelected(zoneId);

      return (
        <div key={`zone-${zoneId}`} className="space-y-1">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => toggleZoneExpansion(zoneId)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>

            <Checkbox
              id={`zone-${zoneId}`}
              checked={isSelected}
              onCheckedChange={(checked) => {
                handleZoneChange(zoneId, Boolean(checked));
              }}
            />

            <Building2 className="h-4 w-4 text-purple-500" />
            <Label
              htmlFor={`zone-${zoneId}`}
              className="text-sm font-medium cursor-pointer flex-1"
            >
              {zone.name} ({zoneDevices.length} cihaz)
            </Label>
          </div>

          {isExpanded && (
            <div className="space-y-1">
              {zoneDevices.map(device => {
                const deviceId = String(device._id);
                return (
                  <div
                    key={`device-${deviceId}`}
                    className="flex items-center space-x-2"
                    style={{ paddingLeft: '36px' }}
                  >
                    <Checkbox
                      id={`device-${deviceId}`}
                      checked={formData.selected_devices.includes(deviceId)}
                      onCheckedChange={(checked) => {
                        handleDeviceChange(deviceId, Boolean(checked));
                      }}
                    />
                    <MapPin className="h-3 w-3 text-green-500" />
                    <Label
                      htmlFor={`device-${deviceId}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {device.name} ({getDeviceLocationDisplay(device)})
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  const orphanDevices = devices.filter(device => !device.zoneId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Hangi Bölge ve Cihazlarda?</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAllDevices}
          className="text-xs"
        >
          {allDevicesSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
        </Button>
      </div>
      <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-1">
        {renderZoneTree()}

        {orphanDevices.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <Label className="text-sm font-medium text-gray-700">
                Bölgesi Olmayan Cihazlar ({orphanDevices.length})
              </Label>
            </div>
            {orphanDevices.map(device => {
              const deviceId = String(device._id);
              return (
                <div key={deviceId} className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id={`orphan-device-${deviceId}`}
                    checked={formData.selected_devices.includes(deviceId)}
                    onCheckedChange={(checked) => {
                      handleDeviceChange(deviceId, Boolean(checked));
                    }}
                  />
                  <MapPin className="h-3 w-3 text-green-500" />
                  <Label
                    htmlFor={`orphan-device-${deviceId}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {device.name} ({getDeviceLocationDisplay(device)})
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
