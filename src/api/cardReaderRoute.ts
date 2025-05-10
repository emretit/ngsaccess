import { processCardReading } from './cardReader';

/**
 * Kart okuyucu cihazlardan gelen HTTP isteklerini işleyen fonksiyon
 * Bu fonksiyonu API sunucusuna bağlamak için kullanabilirsiniz
 * @param request HTTP isteği
 * @returns HTTP yanıtı
 */
export async function handleCardReaderRequest(request: Request): Promise<Response> {
    try {
        // CORS header'ları
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
            'Content-Type': 'application/json'
        };

        // OPTIONS isteğine yanıt ver (CORS preflight)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // Sadece POST isteklerini kabul et
        if (request.method !== 'POST') {
            return new Response(
                JSON.stringify({
                    response: 'close_relay',
                    error: 'Sadece POST istekleri desteklenmektedir'
                }),
                {
                    status: 405,
                    headers: corsHeaders
                }
            );
        }

        // API anahtarı kontrolü
        const apiKey = request.headers.get('x-api-key');
        const validApiKey = import.meta.env.VITE_DEVICE_API_KEY;

        // Geliştirme modunda API anahtarı kontrolü atlanabilir
        const isDevelopment = import.meta.env.DEV;

        if (!isDevelopment && (!apiKey || apiKey !== validApiKey)) {
            return new Response(
                JSON.stringify({
                    response: 'close_relay',
                    error: 'Geçersiz API anahtarı'
                }),
                {
                    status: 401,
                    headers: corsHeaders
                }
            );
        }

        // İstek gövdesini oku
        const body = await request.json();
        console.log('Gelen veri:', body);

        // Veri formatını düzelt
        let cardNumber, deviceSerial;

        // Eski format: "user_id,serial" şeklinde virgülle ayrılmış string
        if ('user_id,serial' in body) {
            const [card, device] = body['user_id,serial'].split(',');
            cardNumber = card;
            deviceSerial = device;
        }
        // Ayrı alanlar formatı
        else if (body.user_id && body.serial) {
            cardNumber = body.user_id;
            deviceSerial = body.serial;
        }
        // Yeni format: card_no ve device_id alanları
        else if (body.card_no && body.device_id) {
            cardNumber = body.card_no;
            deviceSerial = body.device_id;
        }
        // Eski ve yeni formatın karışımı
        else {
            cardNumber = body.user_id || body.card_no;
            deviceSerial = body.serial || body.device_id;
        }

        // Kart okuma işlemini gerçekleştir
        const result = await processCardReading(cardNumber, deviceSerial);

        // Sonucu dön
        return new Response(
            JSON.stringify(result),
            {
                status: 200,
                headers: corsHeaders
            }
        );

    } catch (error) {
        console.error('Kart okuyucu route hatası:', error);

        return new Response(
            JSON.stringify({
                response: 'close_relay',
                error: 'Sistem hatası: ' + (error.message || 'Bilinmeyen hata')
            }),
            {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                }
            }
        );
    }
} 