import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readDeviceFilters, writeDeviceFilters, deviceMatchesFilters } from '@/lib/deviceDisplay';
import { Device } from '@/types/device';

export function useDeviceFilters(
  devices: Device[],
  selectedZoneId: string | null,
  selectedDoorId: string | null
) {
  const [params, setParams] = useSearchParams();
  const { search, status: statusFilter, type: typeFilter } = readDeviceFilters(params);
  const setSearch = (search: string) => setParams(current => writeDeviceFilters(current, { search }));
  const setStatusFilter = (status: string) => setParams(current => writeDeviceFilters(current, { status }));
  const setTypeFilter = (type: string) => setParams(current => writeDeviceFilters(current, { type }));
  const clearFilters = () => setParams(current => writeDeviceFilters(current, { search: '', status: 'all', type: 'all', zoneId: null, doorId: null }));

  // Extract unique device types for filtering
  const deviceTypes = useMemo(() => {
    return Array.from(new Set(
      devices.map(device => device.deviceType ?? '')
        .filter(type => type !== '')
    ));
  }, [devices]);

  const filteredDevices = useMemo(() => devices.filter(device => deviceMatchesFilters(device, {
    search, status: statusFilter, type: typeFilter, zoneId: selectedZoneId, doorId: selectedDoorId,
  })), [devices, selectedZoneId, selectedDoorId, search, statusFilter, typeFilter]);

  return {
    search,
    clearFilters,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    deviceTypes,
    filteredDevices
  };
}
