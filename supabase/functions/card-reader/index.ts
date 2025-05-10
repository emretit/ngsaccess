// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/manual/getting_started/setup_your_environment

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2"

// CORS headers for browser and device clients
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Create a Supabase client with the Admin key
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
        auth: { persistSession: false }
    }
)

// API key validation function
function validateApiKey(apiKey: string | null): boolean {
    const validApiKey = Deno.env.get('DEVICE_API_KEY')
    const isDevelopment = Deno.env.get('DEVELOPMENT_MODE') === 'true'

    if (isDevelopment) {
        console.log('Development mode enabled, skipping API key validation')
        return true
    }

    return apiKey === validApiKey && validApiKey !== undefined && validApiKey !== ''
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request for CORS preflight')
        return new Response(null, { headers: corsHeaders })
    }

    try {
        console.log('Kart okuma isteği alındı')

        // API Key validation (allow bypass in development mode)
        const apiKey = req.headers.get('x-api-key')
        if (!validateApiKey(apiKey)) {
            console.error('Geçersiz API anahtarı:', apiKey)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Geçersiz API anahtarı'
                }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Proceed only for POST requests
        if (req.method !== 'POST') {
            console.error('Desteklenmeyen metod:', req.method)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Sadece POST istekleri desteklenir'
                }),
                { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const body = await req.json()
        console.log('Gelen veri:', JSON.stringify(body))

        // Veri formatını düzelt
        let cardNumber, deviceSerial

        // Eski format: "user_id,serial" şeklinde virgülle ayrılmış string
        if ('user_id,serial' in body) {
            const [card, device] = body['user_id,serial'].split(',')
            cardNumber = card
            deviceSerial = device
            console.log('Eski format tespit edildi, düzeltiliyor:', { cardNumber, deviceSerial })
        }
        // Ayrı alanlar formatı
        else if (body.user_id && body.serial) {
            cardNumber = body.user_id
            deviceSerial = body.serial
            console.log('Ayrı alanlar formatı tespit edildi:', { cardNumber, deviceSerial })
        }
        // Yeni format: card_no ve device_id alanları
        else if (body.card_no && body.device_id) {
            cardNumber = body.card_no
            deviceSerial = body.device_id
            console.log('Yeni format tespit edildi:', { cardNumber, deviceSerial })
        }
        // Eski ve yeni formatın karışımı
        else {
            cardNumber = body.user_id || body.card_no
            deviceSerial = body.serial || body.device_id
            console.log('Karma format tespit edildi:', { cardNumber, deviceSerial })
        }

        // Eksik alan kontrolü
        if (!cardNumber) {
            console.error('Kart numarası eksik')
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Kart numarası eksik'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!deviceSerial) {
            console.error('Cihaz seri numarası eksik')
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Cihaz seri numarası eksik'
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Kartın employees tablosunda kayıtlı olup olmadığını kontrol et
        console.log('Çalışan kontrolü yapılıyor:', cardNumber)
        const { data: employee, error: empErr } = await supabaseAdmin
            .from('employees')
            .select('id, first_name, last_name, access_permission, photo_url')
            .eq('card_number', cardNumber)
            .single()

        if (empErr) {
            console.error('Çalışan sorgusu hatası:', empErr)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Çalışan bulunamadı'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!employee) {
            console.log('Çalışan bulunamadı:', cardNumber)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Çalışan bulunamadı'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!employee.access_permission) {
            console.log('Çalışanın erişim izni yok:', cardNumber)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Erişim izni yok'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('Çalışan bulundu:', employee)

        // Cihaz bilgisini al
        console.log('Cihaz bilgisi alınıyor:', deviceSerial)
        const { data: device, error: deviceErr } = await supabaseAdmin
            .from('server_devices')
            .select('id, name')
            .eq('serial_number', deviceSerial.toString())
            .single()

        let deviceData = device

        // Cihaz yoksa oluştur
        if (deviceErr && deviceErr.code === 'PGRST116') {
            console.log('Cihaz bulunamadı, yeni cihaz oluşturuluyor:', deviceSerial)

            // Cihazın IP adresini al
            const deviceIp = body.ip_address || req.headers.get('x-forwarded-for') || 'unknown'

            const { data: newDevice, error: insertErr } = await supabaseAdmin
                .from('server_devices')
                .insert({
                    name: `Cihaz-${deviceSerial}`,
                    serial_number: deviceSerial.toString(),
                    status: 'active',
                    device_model_enum: 'Access Control Terminal',
                    last_seen: new Date().toISOString(),
                    ip_address: deviceIp
                })
                .select('id, name')
                .single()

            if (insertErr) {
                console.error('Cihaz oluşturma hatası:', insertErr)
                return new Response(
                    JSON.stringify({
                        response: "close_relay",
                        error: 'Cihaz oluşturulamadı'
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            deviceData = newDevice
        } else if (deviceErr) {
            console.error('Cihaz sorgusu hatası:', deviceErr)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Cihaz doğrulanamadı'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('Cihaz bulundu/oluşturuldu:', deviceData)

        // Cihazın son görülme zamanını güncelle
        await supabaseAdmin
            .from('server_devices')
            .update({
                last_seen: new Date().toISOString(),
                ip_address: body.ip_address || req.headers.get('x-forwarded-for') || 'unknown'
            })
            .eq('serial_number', deviceSerial.toString())

        // Kart geçiş kaydını oluştur
        const { data: readingData, error: logError } = await supabaseAdmin
            .from('card_readings')
            .insert({
                employee_id: employee.id,
                card_no: cardNumber,
                device_serial: deviceSerial.toString(),
                status: 'success',
                access_granted: true,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                employee_photo_url: employee.photo_url,
                device_name: deviceData?.name || `Cihaz-${deviceSerial}`,
                device_id: deviceSerial.toString(),
                device_location: body.location || "",
                raw_data: JSON.stringify(body)
            })
            .select()
            .single()

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError)
            return new Response(
                JSON.stringify({
                    response: "close_relay",
                    error: 'Kart okuma kaydı oluşturulamadı'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('Kart okuma kaydı başarıyla oluşturuldu:', readingData?.id)

        // Return successful response
        const responseData = {
            response: "open_relay",
            confirmation: "relay_opened",
            employee_name: `${employee.first_name} ${employee.last_name}`,
            timestamp: new Date().toISOString(),
            reading_id: readingData?.id
        }

        console.log('Başarılı yanıt gönderiliyor:', responseData)

        return new Response(
            JSON.stringify(responseData),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Edge function hatası:', error)
        return new Response(
            JSON.stringify({
                response: "close_relay",
                error: "Sunucu hatası: " + (error.message || 'Bilinmeyen hata')
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}) 