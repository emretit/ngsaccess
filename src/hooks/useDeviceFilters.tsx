import { useState, useMemo } from 'react';
import { Device } from '@/types/device';

export function useDeviceFilters(
  devices: Device[],
  selectedZoneId: string | null,
  selectedDoorId: string | null
) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Extract unique device types for filtering
  const deviceTypes = useMemo(() => {
    return Array.from(new Set(
      devices.map(device => device.deviceType ?? '')
        .filter(type => type !== '')
    ));
  }, [devices]);

  // Apply all filters to devices
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Filter by zone/door
      const locationMatch = () => {
        if (selectedDoorId != null) {
          return device.doorId === selectedDoorId;
        }
        if (selectedZoneId != null) {
          return device.zoneId === selectedZoneId;
        }
        return true;
      };

      // Filter by search text
      const searchMatch = () => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
          (device.name ?? '').toLowerCase().includes(searchLower) ||
          (device.deviceSerial ?? '').toLowerCase().includes(searchLower) ||
          (device.description ?? '').toLowerCase().includes(searchLower)
        );
      };

      // Filter by status
      const statusMatch = () => {
        if (statusFilter === 'all') return true;
        return device.status === statusFilter;
      };

      // Filter by type
      const typeMatch = () => {
        if (typeFilter === 'all') return true;
        const deviceType = device.deviceType ?? '';
        return deviceType.toLowerCase() === typeFilter.toLowerCase();
      };

      return locationMatch() && searchMatch() && statusMatch() && typeMatch();
    });
  }, [devices, selectedZoneId, selectedDoorId, search, statusFilter, typeFilter]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    deviceTypes,
    filteredDevices
  };
}
