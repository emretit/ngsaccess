
import { Database } from '@/integrations/supabase/types';
import { createClient } from '@supabase/supabase-js';

/**
 * Checks for existing device or creates a new one
 */
export async function getOrCreateDevice(
    supabase: ReturnType<typeof createClient<Database>>,
    deviceSerial: string
): Promise<{ deviceName: string; deviceId: string }> {
    try {
        let deviceName = `Cihaz-${deviceSerial}`;
        let deviceId = deviceSerial;

        const { data: device, error: deviceErr } = await supabase
            .from('server_devices')
            .select('id, name')
            .eq('serial_number', deviceSerial)
            .single();

        if (deviceErr) {
            // Cihaz yoksa oluştur
            console.log('Cihaz bulunamadı, yeni cihaz oluşturuluyor:', deviceSerial);
            
            // Create a properly typed object for the insert operation
            const newDeviceData = {
                name: `Cihaz-${deviceSerial}`,
                serial_number: deviceSerial,
                status: 'active',
                device_model_enum: 'Access Control Terminal' as Database["public"]["Enums"]["device_model_type"],
                last_used_at: new Date().toISOString()
            };
            
            const { data: newDevice, error: insertErr } = await supabase
                .from('server_devices')
                .insert(newDeviceData)
                .select('id, name')
                .single();

            if (!insertErr && newDevice) {
                deviceName = newDevice.name;
                deviceId = newDevice.id;
            }
        } else {
            deviceName = device.name;
            deviceId = device.id;

            // Update device's last_used_at timestamp
            await supabase
                .from('server_devices')
                .update({ last_used_at: new Date().toISOString() })
                .eq('serial_number', deviceSerial);
        }

        return { deviceName, deviceId };
    } catch (error) {
        console.error('Device management error:', error);
        return { deviceName: `Cihaz-${deviceSerial}`, deviceId: deviceSerial };
    }
}
