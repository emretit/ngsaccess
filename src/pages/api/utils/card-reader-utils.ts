
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
    timestamp = new Date().toISOString()
}: CardReadingLogParams): Promise<string | undefined> {
    try {
        // Cihaz bilgisini kontrol et
        let deviceName = `Cihaz-${deviceSerial}`;

        const { data: device, error: deviceErr } = await supabase
            .from('server_devices')
            .select('id, name')
            .eq('serial_number', deviceSerial)
            .single();

        if (deviceErr) {
            // Cihaz yoksa oluştur
            console.log('Cihaz bulunamadı, yeni cihaz oluşturuluyor:', deviceSerial);
            const { data: newDevice, error: insertErr } = await supabase
                .from('server_devices')
                .insert({
                    name: `Cihaz-${deviceSerial}`,
                    serial_number: deviceSerial,
                    status: 'active',
                    device_model_enum: 'Access Control Terminal',
                    last_seen: new Date().toISOString()
                })
                .select('id, name')
                .single();

            if (!insertErr && newDevice) {
                deviceName = newDevice.name;
            }
        } else {
            deviceName = device.name;

            // Cihazın son görülme zamanını güncelle
            await supabase
                .from('server_devices')
                .update({ last_seen: new Date().toISOString() })
                .eq('serial_number', deviceSerial);
        }

        // Kart geçiş kaydını oluştur
        const currentTimestamp = timestamp;
        const { data: readingData, error: logError } = await supabase
            .from('card_readings')
            .insert({
                employee_id: employeeId,
                card_no: cardNumber,
                device_serial: deviceSerial,
                status: status,
                access_granted: status === 'granted',
                employee_name: employeeName,
                employee_photo_url: employeePhotoUrl,
                device_name: deviceName,
                device_id: deviceSerial,
                error_message: errorMessage,
                timestamp: currentTimestamp,
                // Geri uyumluluk için read_time ve access_time alanlarını da ayarla
                read_time: currentTimestamp,
                access_time: currentTimestamp
            })
            .select('id')
            .single();

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError);
            return undefined;
        }

        console.log('Kart okuma kaydı başarıyla oluşturuldu:', readingData?.id);
        return readingData?.id;

    } catch (error) {
        console.error('Kart okuma log hatası:', error);
        return undefined;
    }
}

/**
 * Kart numarası ve seri numarasını ayrıştırır
 */
export function parseCardData(userIdSerialValue: string): { cardNumber: string; deviceSerial: string } | null {
    // %T formatını kontrol et
    if (!userIdSerialValue.includes('%T,')) {
        return null;
    }

    // %T,<serial_number> formatını ayrıştır
    const parts = userIdSerialValue.split(',');
    if (parts.length < 2) {
        return null;
    }

    // Kart numarası (%T bölümünden sonra gelen değer)
    const cardPart = parts[0];
    const cardNumber = cardPart.replace('%T', '');

    // Cihaz seri numarası (virgülden sonraki kısım)
    const deviceSerial = parts[1];

    if (!cardNumber || !deviceSerial) {
        return null;
    }

    return { cardNumber, deviceSerial };
}
