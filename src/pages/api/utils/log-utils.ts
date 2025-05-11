
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import { CardReadingLogParams } from '../types/card-reader-types';

/**
 * Kart okuma olayını veritabanına kaydeder
 */
export async function logCardReading({
    supabase,
    cardNumber,
    deviceSerial,
    status,
    errorMessage,
    employeeId,
    employeeName,
    employeePhotoUrl,
    timestamp = new Date().toISOString(),
    deviceName,
    deviceId
}: CardReadingLogParams & { deviceName: string; deviceId: string }): Promise<string | undefined> {
    try {
        // Kart geçiş kaydını oluştur
        const currentTimestamp = timestamp;
        
        // Create a properly typed object for the insert operation
        const cardReadingData = {
            employee_id: employeeId ? Number(employeeId) : null, // Convert to number properly
            card_no: cardNumber,
            device_serial: deviceSerial,
            status: status,
            access_granted: status === 'granted',
            employee_name: employeeName,
            employee_photo_url: employeePhotoUrl,
            device_name: deviceName,
            device_id: deviceId ? Number(deviceId) : null, // Convert deviceId to number 
            error_message: errorMessage, // This should match the column name in DB
            timestamp: currentTimestamp,
            // Geri uyumluluk için read_time ve access_time alanlarını da ayarla
            read_time: currentTimestamp,
            access_time: currentTimestamp
        };
        
        const { data: readingData, error: logError } = await supabase
            .from('card_readings')
            .insert(cardReadingData)
            .select('id')
            .single();

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError);
            return undefined;
        }

        console.log('Kart okuma kaydı başarıyla oluşturuldu:', readingData?.id);
        return readingData?.id.toString(); // Convert the id to string before returning

    } catch (error) {
        console.error('Kart okuma log hatası:', error);
        return undefined;
    }
}
