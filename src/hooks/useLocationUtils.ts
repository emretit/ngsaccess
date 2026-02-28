
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";

export function useLocationUtils() {
  const { zones, doors } = useZonesAndDoors();

  const getZoneName = (zoneId?: string | number) => {
    if (!zoneId) return '';
    const zone = zones.find(z => String(z._id) === String(zoneId));
    return zone?.name || '';
  };

  const getDoorName = (doorId?: string | number) => {
    if (!doorId) return '';
    const door = doors.find(d => String(d._id) === String(doorId));
    return door?.name || '';
  };

  const getDeviceLocationDisplay = (device: any) => {
    const zoneName = getZoneName(device.zoneId || device.zone_id);
    const doorName = getDoorName(device.doorId || device.door_id);

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
