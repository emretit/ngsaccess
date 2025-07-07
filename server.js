
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Çevre değişkenlerini yükle
dotenv.config();

// Express uygulaması oluştur
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Service role client oluşturma fonksiyonu
const createServiceRoleClient = () => {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                persistSession: false
            }
        }
    )
}

// Ana sayfa
app.get('/', (req, res) => {
    res.json({ message: 'API çalışıyor' });
});

// POST: Cihazdan gelen kart okuma isteklerini işler
app.post('/api/card-reader', async (req, res) => {
    try {
        console.log('API isteği alındı');
        const serviceClient = createServiceRoleClient();
        const body = req.body;
        console.log('Gelen veri:', body);

        // Veri formatını düzelt
        let user_id, serial;
        if ('user_id,serial' in body) {
            const [cardNumber, deviceSerial] = body['user_id,serial'].split(',');
            user_id = cardNumber;
            serial = deviceSerial;
        } else {
            user_id = body.user_id;
            serial = body.serial;
        }

        // Eksik alan kontrolü
        if (!user_id) {
            console.log('user_id eksik');
            return res.status(400).json({ response: 'close_relay', error: 'user_id missing' });
        }
        if (!serial) {
            console.log('serial eksik');
            return res.status(400).json({ response: 'close_relay', error: 'serial missing' });
        }

        console.log('İşlenmiş veri:', { user_id, serial });

        // Kartın employees tablosunda kayıtlı olup olmadığını kontrol et
        console.log('Çalışan kontrolü yapılıyor:', user_id);
        const { data: employee, error: empErr } = await serviceClient
            .from('employees')
            .select('id, first_name, last_name, is_active')
            .eq('card_number', user_id)
            .single();

        if (empErr) {
            console.error('Çalışan sorgusu hatası:', empErr);
            return res.json({ response: 'close_relay' });
        }

        if (!employee) {
            console.log('Çalışan bulunamadı:', user_id);
            return res.json({ response: 'close_relay' });
        }

        if (!employee.is_active) {
            console.log('Çalışan aktif değil:', user_id);
            return res.json({ response: 'close_relay' });
        }

        console.log('Çalışan bulundu:', employee);

        // Cihaz bilgisini al
        console.log('Cihaz bilgisi alınıyor:', serial);
        const { data: device, error: deviceErr } = await serviceClient
            .from('devices')
            .select('id, name, device_serial')
            .eq('device_serial', serial)
            .single();

        if (deviceErr) {
            console.error('Cihaz sorgusu hatası:', deviceErr);
            return res.json({ response: 'close_relay' });
        }

        if (!device) {
            console.log('Cihaz bulunamadı:', serial);
            return res.json({ response: 'close_relay' });
        }

        console.log('Cihaz bulundu:', device);

        // Erişim kontrolü fonksiyonunu çağır
        console.log('Erişim kontrolü yapılıyor...');
        const { data: accessResult, error: accessErr } = await serviceClient
            .rpc('check_employee_device_access', {
                p_employee_id: employee.id,
                p_device_id: device.id,
                p_access_time: new Date().toISOString()
            });

        if (accessErr) {
            console.error('Erişim kontrolü hatası:', accessErr);
            return res.json({ response: 'close_relay' });
        }

        const hasAccess = accessResult === true;
        console.log('Erişim kontrolü sonucu:', hasAccess);

        // Kart geçiş kaydını oluştur - access_status alanını da ekle
        const { error: logError } = await serviceClient
            .from('card_readings')
            .insert({
                employee_id: employee.id,
                card_no: user_id,
                device_id: device.id,
                access_time: new Date().toISOString(),
                employee_name: `${employee.first_name} ${employee.last_name}`,
                raw_data: JSON.stringify(body),
                access_status: hasAccess ? 'kabul_edildi' : 'reddedildi'
            });

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError);
        } else {
            console.log('Kart okuma kaydı başarıyla oluşturuldu');
        }

        // Erişim sonucuna göre relay kontrol
        if (hasAccess) {
            console.log('Erişim izni verildi');
            return res.json({ response: 'open_relay' });
        } else {
            console.log('Erişim reddedildi');
            return res.json({ response: 'close_relay' });
        }

    } catch (error) {
        console.error('Sistem hatası:', error);
        return res.json({
            response: 'close_relay',
            error: 'system error'
        });
    }
});

// Relay açıldığını onaylama
app.post('/api/confirm-relay', (req, res) => {
    try {
        console.log('Relay onay isteği alındı:', req.body);
        // Burada ekstra işlemler yapılabilir (log kaydetme vb.)
        return res.json({ confirmation: 'relay_opened' });
    } catch (error) {
        console.error('Relay onay hatası:', error);
        return res.status(500).json({ error: 'system error' });
    }
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
