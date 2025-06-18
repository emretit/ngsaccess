
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Device } from '@/types/device';
import { DeviceList } from '@/components/devices/DeviceList';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import { useDeviceFilters } from '@/hooks/useDeviceFilters';
import { useZonesAndDoors } from '@/hooks/useZonesAndDoors';
import { useLocationUtils } from '@/hooks/useLocationUtils';

export function AdminDevicesPanel() {
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<number | null>(null);
  
  const { zones, doors } = useZonesAndDoors();
  const { getDeviceLocationDisplay } = useLocationUtils();

  // Fetch devices from database
  const { data: rawDevices = [], isLoading } = useQuery({
    queryKey: ['admin-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform the data to match Device interface
      return (data || []).map((device: any): Device => ({
        id: device.id?.toString() || '',
        name: device.name || '',
        device_name: device.name,
        serial_number: device.serial_number,
        device_serial: device.device_serial,
        device_model: device.device_model,
        device_type: device.device_type,
        type: device.type,
        status: device.status === 'active' ? 'online' : 'offline',
        zone_id: device.zone_id,
        door_id: device.door_id,
        access_direction: device.access_direction,
        device_mac: device.device_mac,
        device_ip: device.device_ip,
        device_firmware: device.device_firmware,
        created_at: device.created_at,
        last_used_at: device.last_used_at,
        device_location: device.device_location
      }));
    }
  });

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    deviceTypes,
    filteredDevices
  } = useDeviceFilters(rawDevices, selectedZoneId, selectedDoorId);

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', parseInt(deviceId));
      
      if (error) throw error;
      
      // Refresh devices list
      // The query will automatically refetch due to React Query's cache invalidation
    } catch (error) {
      console.error('Error deleting device:', error);
    }
  };

  const handleAssignLocation = (device: Device) => {
    // TODO: Implement location assignment dialog
    console.log('Assign location for device:', device);
  };

  const handleEditDevice = (device: Device) => {
    // TODO: Implement edit device dialog
    console.log('Edit device:', device);
  };

  return (
    <div className="space-y-6">
      <DeviceFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        deviceTypes={deviceTypes}
      />
      
      <DeviceList
        devices={rawDevices}
        filteredDevices={filteredDevices}
        isLoading={isLoading}
        zones={zones}
        doors={doors}
        onDeleteDevice={handleDeleteDevice}
        onAssignLocation={handleAssignLocation}
        onEditDevice={handleEditDevice}
      />
    </div>
  );
}
