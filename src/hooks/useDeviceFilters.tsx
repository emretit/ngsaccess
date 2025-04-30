
import { useState, useMemo } from 'react';
import { Device } from '@/types/device';

export function useDeviceFilters(
  devices: Device[],
  selectedZoneId: number | null,
  selectedDoorId: number | null
) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Extract unique device types for filtering
  const deviceTypes = useMemo(() => {
    return Array.from(new Set(
      devices.map(device => (device.device_type || device.type || ''))
      .filter(type => type !== '')
    ));
  }, [devices]);

  // Apply all filters to devices
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Filter by zone/door
      const locationMatch = () => {
        if (selectedDoorId) {
          return device.door_id === selectedDoorId;
        }
        if (selectedZoneId) {
          return device.zone_id === selectedZoneId;
        }
        return true;
      };

      // Filter by search text
      const searchMatch = () => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
          (device.device_name || device.name || '').toLowerCase().includes(searchLower) ||
          (device.device_serial || device.serial_number || '').toLowerCase().includes(searchLower) ||
          (device.device_location || device.location || '').toLowerCase().includes(searchLower)
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
        return (device.device_type || device.type || '').toLowerCase() === typeFilter.toLowerCase();
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
