import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Supabase bağlantı bilgileri
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Yanıt tipleri
type SuccessResponse = {
    response: 'open_relay';
    confirmation: 'relay_opened';
}

type ErrorResponse = {
    response: 'deny';
    confirmation: 'relay_closed';
    error?: string;
}

type CardReaderResponse = SuccessResponse | ErrorResponse;

/**
 * Kart okuyucu cihazlardan gelen istekleri işleyen API endpoint'i
 * 
 * @param req NextApiRequest - Gelen HTTP isteği
 * @param res NextApiResponse - HTTP yanıtı
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<CardReaderResponse>) {
    // CORS desteği
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    // OPTIONS isteğine yanıt ver (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Sadece POST isteklerini kabul et
    if (req.method !== 'POST') {
        res.status(405).json({
            response: 'deny',
            confirmation: 'relay_closed',
            error: 'Sadece POST istekleri desteklenmektedir'
        });
        return;
    }

    try {
        // İstek gövdesini oku
        const body = req.body;
        console.log('Gelen veri:', body);

        // user_id_serial formatını doğrula
        if (!body.user_id_serial) {
            res.status(400).json({
                response: 'deny',
                confirmation: 'relay_closed',
                error: 'Geçersiz istek formatı: user_id_serial alanı eksik'
            });
            return;
        }

        const userIdSerialValue = body.user_id_serial;

        // %T formatını kontrol et ve veriyi ayrıştır
        if (!userIdSerialValue.includes('%T,')) {
            res.status(400).json({
                response: 'deny',
                confirmation: 'relay_closed',
                error: 'Geçersiz istek formatı: user_id_serial değeri %T, formatını içermelidir'
            });
            return;
        }

        // %T,<serial_number> formatını ayrıştır
        const parts = userIdSerialValue.split(',');
        if (parts.length < 2) {
            res.status(400).json({
                response: 'deny',
                confirmation: 'relay_closed',
                error: 'Geçersiz istek formatı: user_id_serial değeri virgülle ayrılmış olmalıdır'
            });
            return;
        }

        // Kart numarası (%T bölümünden sonra gelen değer)
        const cardPart = parts[0];
        const cardNumber = cardPart.replace('%T', '');

        // Cihaz seri numarası (virgülden sonraki kısım)
        const deviceSerial = parts[1];

        if (!cardNumber || !deviceSerial) {
            res.status(400).json({
                response: 'deny',
                confirmation: 'relay_closed',
                error: 'Geçersiz kart numarası veya cihaz seri numarası'
            });
            return;
        }

        // Supabase istemcisini oluştur
        const supabase = createClient<Database>(
            SUPABASE_URL!,
            SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    persistSession: false
                }
            }
        );

        // Çalışanı kontrol et - kart numarasına göre çalışanı bul
        const { data: employee, error: empErr } = await supabase
            .from('employees')
            .select('id, first_name, last_name, access_permission, photo_url')
            .eq('card_number', cardNumber)
            .single();

        // İşlem sonucunu belirle
        const accessStatus = (employee && employee.access_permission) ? 'granted' : 'denied';
        const errorReason = empErr ? 'Çalışan bulunamadı' :
            (!employee) ? 'Kart numarası kayıtlı değil' :
                (!employee.access_permission) ? 'Erişim izni yok' : undefined;

        // Şu anki zaman damgası
        const timestamp = new Date().toISOString();

        // Kart okuma olayını veritabanına kaydet
        await logCardReading(
            supabase,
            cardNumber,
            deviceSerial,
            accessStatus,
            errorReason,
            employee?.id,
            employee ? `${employee.first_name} ${employee.last_name}` : undefined,
            employee?.photo_url,
            timestamp
        );

        // Çalışan bulunamadıysa veya erişim izni yoksa erişimi reddet
        if (empErr || !employee || !employee.access_permission) {
            res.status(200).json({
                response: 'deny',
                confirmation: 'relay_closed',
                error: errorReason
            });
            return;
        }

        // Kart geçerli ve erişim izni var, kapıyı aç
        res.status(200).json({
            response: 'open_relay',
            confirmation: 'relay_opened'
        });

    } catch (error) {
        console.error('Kart okuyucu API hatası:', error);
        res.status(500).json({
            response: 'deny',
            confirmation: 'relay_closed',
            error: 'Sistem hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata')
        });
    }
}

/**
 * Kart okuma olayını veritabanına kaydeder
 */
async function logCardReading(
    supabase: any,
    cardNumber: string,
    deviceSerial: string,
    status: 'granted' | 'denied',
    errorMessage?: string,
    employeeId?: string,
    employeeName?: string,
    employeePhotoUrl?: string,
    timestamp?: string
): Promise<string | undefined> {
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
        const currentTimestamp = timestamp || new Date().toISOString();
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