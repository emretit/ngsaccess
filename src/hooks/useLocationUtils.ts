import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import type { Device } from "@/types/device";

export function useLocationUtils() {
  const { zones, doors } = useZonesAndDoors();

  const getZoneName = (zoneId?: string) => {
    if (!zoneId) return '';
    const zone = zones.find(z => z._id === zoneId);
    return zone?.name || '';
  };

  const getDoorName = (doorId?: string) => {
    if (!doorId) return '';
    const door = doors.find(d => d._id === doorId);
    return door?.name || '';
  };

  const getDeviceLocationDisplay = (device: Pick<Device, "zoneId" | "doorId">) => {
    const zoneName = getZoneName(device.zoneId);
    const doorName = getDoorName(device.doorId);

    if (zoneName && doorName) {
      return `${zoneName} - ${doorName}`;
    } else if (zoneName) {
      return zoneName;
    } else if (doorName) {
      return doorName;
    }
    return 'Konum Belirtilmemiş';
  };

  return {
    getZoneName,
    getDoorName,
    getDeviceLocationDisplay,
    zones,
    doors
  };
}
