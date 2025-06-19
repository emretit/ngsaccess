
import { useQuery } from "@tanstack/react-query";
import { useProjectAccess } from "./useProjectAccess";
import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/types/device";

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { data: devices = [], isLoading, hasProjectAccess } = useQuery({
    queryKey: ['devices', projectIds],
    queryFn: async () => {
      console.log('Fetching devices for projects:', projectIds);
      
      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from('devices')
          .select(`
            id,
            name,
            device_serial,
            device_model,
            device_location,
            type,
            status,
            created_at,
            last_used_at,
            zone_id,
            door_id,
            access_direction,
            device_mac,
            device_ip,
            device_firmware,
            device_model_enum
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching devices (super admin):', error);
          throw error;
        }

        return data?.map((device): Device => ({
          id: device.id.toString(),
          device_name: device.name,
          name: device.name,
          device_serial: device.device_serial,
          serial_number: device.device_serial,
          device_model: device.device_model,
          device_location: device.device_location,
          device_type: device.type,
          type: device.type,
          status: device.status === 'active' ? 'online' : 'offline',
          created_at: device.created_at,
          last_used_at: device.last_used_at,
          zone_id: device.zone_id,
          door_id: device.door_id,
          access_direction: device.access_direction,
          device_mac: device.device_mac,
          device_ip: device.device_ip,
          device_firmware: device.device_firmware,
        })) || [];
      }

      if (!projectIds || projectIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('devices')
        .select(`
          id,
          name,
          device_serial,
          device_model,
          device_location,
          type,
          status,
          created_at,
          last_used_at,
          project_id,
          zone_id,
          door_id,
          access_direction,
          device_mac,
          device_ip,
          device_firmware,
          device_model_enum
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching filtered devices:', error);
        throw error;
      }

      return data?.map((device): Device => ({
        id: device.id.toString(),
        device_name: device.name,
        name: device.name,
        device_serial: device.device_serial,
        serial_number: device.device_serial,
        device_model: device.device_model,
        device_location: device.device_location,
        device_type: device.type,
        type: device.type,
        status: device.status === 'active' ? 'online' : 'offline',
        created_at: device.created_at,
        last_used_at: device.last_used_at,
        zone_id: device.zone_id,
        door_id: device.door_id,
        access_direction: device.access_direction,
        device_mac: device.device_mac,
        device_ip: device.device_ip,
        device_firmware: device.device_firmware,
      })) || [];
    },
    enabled: !projectLoading && (isSuperAdmin || (projectIds && projectIds.length > 0)),
  });

  return {
    devices,
    isLoading: projectLoading || isLoading,
    hasProjectAccess: isSuperAdmin || hasProjectAccess
  };
};
