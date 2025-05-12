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
        process.env.NEXT_PUBLIC_SUPABASE_URL,
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
            .select('id, first_name, last_name, access_permission')
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

        if (!employee.access_permission) {
            console.log('Çalışanın erişim izni yok:', user_id);
            return res.json({ response: 'close_relay' });
        }

        console.log('Çalışan bulundu:', employee);

        // Cihaz bilgisini al
        console.log('Cihaz bilgisi alınıyor:', serial);
        const { data: device, error: deviceErr } = await serviceClient
            .from('devices')
            .select('name')
            .eq('serial_number', serial)
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

        // Kart geçiş kaydını oluştur
        const { error: logError } = await serviceClient
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

        return res.json({ response: 'open_relay' });

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