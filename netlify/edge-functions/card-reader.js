import { createClient } from '@supabase/supabase-js';

// HTTP isteğini işleme
export default async (request, context) => {
    // CORS kontrolü için OPTIONS isteği kontrolü
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Sadece POST isteklerini işle
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Sadece POST metodu destekleniyor' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    try {
        console.log('API isteği alındı');

        // Service role client oluşturma
        const supabase = createClient(
            context.env.NEXT_PUBLIC_SUPABASE_URL,
            context.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    persistSession: false
                }
            }
        );

        // İstek verisini al
        let body;
        try {
            body = await request.json();
            console.log('Gelen veri:', body);
        } catch (error) {
            console.error('JSON ayrıştırma hatası:', error);
            return new Response(JSON.stringify({ response: 'close_relay', error: 'Geçersiz JSON formatı' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Veri formatını düzelt
        let user_id, serial;
        if ('user_id,serial' in body) {
            const [cardNumber, deviceSerial] = body['user_id,serial'].split(',');
            user_id = cardNumber;
            serial = deviceSerial;
        } else if ('user_id_serial' in body) {
            const [cardNumber, deviceSerial] = body['user_id_serial'].split(',');
            user_id = cardNumber;
            serial = deviceSerial;
        } else {
            user_id = body.user_id;
            serial = body.serial;
        }

        // Eksik alan kontrolü
        if (!user_id) {
            console.log('user_id eksik');
            return new Response(JSON.stringify({ response: 'close_relay', error: 'user_id missing' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
        if (!serial) {
            console.log('serial eksik');
            return new Response(JSON.stringify({ response: 'close_relay', error: 'serial missing' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        console.log('İşlenmiş veri:', { user_id, serial });

        // Kartın employees tablosunda kayıtlı olup olmadığını kontrol et
        console.log('Çalışan kontrolü yapılıyor:', user_id);
        const { data: employee, error: empErr } = await supabase
            .from('employees')
            .select('id, first_name, last_name, access_permission')
            .eq('card_number', user_id)
            .single();

        if (empErr) {
            console.error('Çalışan sorgusu hatası:', empErr);
            return new Response(JSON.stringify({ response: 'close_relay' }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        if (!employee) {
            console.log('Çalışan bulunamadı:', user_id);
            return new Response(JSON.stringify({ response: 'close_relay' }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        if (!employee.access_permission) {
            console.log('Çalışanın erişim izni yok:', user_id);
            return new Response(JSON.stringify({ response: 'close_relay' }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        console.log('Çalışan bulundu:', employee);

        // Cihaz bilgisini al
        console.log('Cihaz bilgisi alınıyor:', serial);
        const { data: device, error: deviceErr } = await supabase
            .from('devices')
            .select('name')
            .eq('serial_number', serial)
            .single();

        if (deviceErr) {
            console.error('Cihaz sorgusu hatası:', deviceErr);
            return new Response(JSON.stringify({ response: 'close_relay' }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        if (!device) {
            console.log('Cihaz bulunamadı:', serial);
            return new Response(JSON.stringify({ response: 'close_relay' }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        console.log('Cihaz bulundu:', device);

        // Kart geçiş kaydını oluştur
        const { error: logError } = await supabase
            .from('card_readings')
            .insert({
                employee_id: employee.id,
                card_no: user_id,
                device_serial: serial,
                status: 'success',
                employee_name: `${employee.first_name} ${employee.last_name}`,
                device_name: device.name
            });

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError);
        } else {
            console.log('Kart okuma kaydı başarıyla oluşturuldu');
        }

        return new Response(JSON.stringify({ response: 'open_relay' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('Sistem hatası:', error);
        return new Response(JSON.stringify({
            response: 'close_relay',
            error: 'system error'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}; 