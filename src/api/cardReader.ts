import { createClient } from '@supabase/supabase-js';

// Ortam değişkenlerinden Supabase bağlantı bilgilerini al
const SUPABASE_URL = "https://gjudsghhwmnsnndnswho.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Service role client oluşturma fonksiyonu
const createServiceRoleClient = () => {
    return createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                persistSession: false
            }
        }
    );
};

export type CardReaderResponse = {
    response: 'open_relay' | 'close_relay';
    error?: string;
    employee_name?: string;
    timestamp?: string;
    reading_id?: string;
};

/**
 * Kart okuyucu cihazlardan gelen istekleri işler
 * @param cardNumber Kart numarası
 * @param deviceSerial Cihaz seri numarası
 * @returns CardReaderResponse - Cihaza dönülecek yanıt
 */
export async function processCardReading(cardNumber: string, deviceSerial: string): Promise<CardReaderResponse> {
    try {
        console.log('Kart okuma isteği alındı:', { cardNumber, deviceSerial });
        const serviceClient = createServiceRoleClient();

        // Eksik alan kontrolü
        if (!cardNumber) {
            console.log('Kart numarası eksik');
            return { response: 'close_relay', error: 'Kart numarası eksik' };
        }
        if (!deviceSerial) {
            console.log('Cihaz seri numarası eksik');
            return { response: 'close_relay', error: 'Cihaz seri numarası eksik' };
        }

        // Kartın employees tablosunda kayıtlı olup olmadığını kontrol et
        console.log('Çalışan kontrolü yapılıyor:', cardNumber);
        const { data: employee, error: empErr } = await serviceClient
            .from('employees')
            .select('id, first_name, last_name, access_permission, photo_url')
            .eq('card_number', cardNumber)
            .single();

        if (empErr) {
            console.error('Çalışan sorgusu hatası:', empErr);
            return { response: 'close_relay', error: 'Çalışan bulunamadı' };
        }

        if (!employee) {
            console.log('Çalışan bulunamadı:', cardNumber);
            return { response: 'close_relay', error: 'Çalışan bulunamadı' };
        }

        if (!employee.access_permission) {
            console.log('Çalışanın erişim izni yok:', cardNumber);
            return { response: 'close_relay', error: 'Erişim izni yok' };
        }

        console.log('Çalışan bulundu:', employee);

        // Cihaz bilgisini al
        console.log('Cihaz bilgisi alınıyor:', deviceSerial);
        const { data: device, error: deviceErr } = await serviceClient
            .from('server_devices')
            .select('id, name')
            .eq('serial_number', deviceSerial)
            .single();

        let deviceData = device;

        // Cihaz yoksa oluştur
        if (deviceErr && deviceErr.code === 'PGRST116') {
            console.log('Cihaz bulunamadı, yeni cihaz oluşturuluyor:', deviceSerial);
            const { data: newDevice, error: insertErr } = await serviceClient
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

            if (insertErr) {
                console.error('Cihaz oluşturma hatası:', insertErr);
                return { response: 'close_relay', error: 'Cihaz oluşturulamadı' };
            }

            deviceData = newDevice;
        } else if (deviceErr) {
            console.error('Cihaz sorgusu hatası:', deviceErr);
            return { response: 'close_relay', error: 'Cihaz doğrulanamadı' };
        }

        console.log('Cihaz bulundu/oluşturuldu:', deviceData);

        // Cihazın son görülme zamanını güncelle
        await serviceClient
            .from('server_devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('serial_number', deviceSerial);

        // Kart geçiş kaydını oluştur
        const { data: readingData, error: logError } = await serviceClient
            .from('card_readings')
            .insert({
                employee_id: employee.id,
                card_no: cardNumber,
                device_serial: deviceSerial,
                status: 'success',
                access_granted: true,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                employee_photo_url: employee.photo_url,
                device_name: deviceData?.name || `Cihaz-${deviceSerial}`,
                device_id: deviceSerial
            })
            .select()
            .single();

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError);
            return { response: 'close_relay', error: 'Kart okuma kaydı oluşturulamadı' };
        } else {
            console.log('Kart okuma kaydı başarıyla oluşturuldu:', readingData?.id);
        }

        return {
            response: 'open_relay',
            employee_name: `${employee.first_name} ${employee.last_name}`,
            timestamp: new Date().toISOString(),
            reading_id: readingData?.id
        };

    } catch (error) {
        console.error('Sistem hatası:', error);
        return {
            response: 'close_relay',
            error: 'Sistem hatası: ' + (error.message || 'Bilinmeyen hata')
        };
    }
} 