
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { Device } from "@/types/device";

export function useLocationUtils() {
  const { zones, doors } = useZonesAndDoors();

  const getZoneName = (zoneId?: number) => {
    if (!zoneId) return '';
    const zone = zones.find(z => z.id === zoneId);
    return zone?.name || '';
  };

  const getDoorName = (doorId?: number) => {
    if (!doorId) return '';
    const door = doors.find(d => d.id === doorId);
    return door?.name || '';
  };

  const getDeviceLocationDisplay = (device: Device) => {
    const zoneName = getZoneName(device.zone_id);
    const doorName = getDoorName(device.door_id);
    
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
