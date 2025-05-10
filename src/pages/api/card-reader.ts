
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { CardReaderResponse, ErrorResponse } from './types/card-reader-types';
import { parseCardData, processCardReading } from './utils/card-reader-utils';

// Supabase bağlantı bilgileri
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        
        // Kart verilerini ayrıştır
        const parsedData = parseCardData(userIdSerialValue);
        if (!parsedData) {
            res.status(400).json({
                response: 'deny',
                confirmation: 'relay_closed',
                error: 'Geçersiz istek formatı: user_id_serial değeri doğru formatta değil'
            });
            return;
        }

        const { cardNumber, deviceSerial } = parsedData;

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
        await processCardReading({
            supabase,
            cardNumber,
            deviceSerial,
            status: accessStatus,
            errorMessage: errorReason,
            employeeId: employee?.id ? employee.id.toString() : undefined,
            employeeName: employee ? `${employee.first_name} ${employee.last_name}` : undefined,
            employeePhotoUrl: employee?.photo_url,
            timestamp
        });

        // Çalışan bulunamadıysa veya erişim izni yoksa erişimi reddet
        if (empErr || !employee || !employee.access_permission) {
            const errorResponse: ErrorResponse = {
                response: 'deny',
                confirmation: 'relay_closed',
                error: errorReason
            };
            res.status(200).json(errorResponse);
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
