
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
app.post('/card-reader', async (req, res) => {
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
        } else if (body.CARD_NO) {
            // Yeni format: CARD_NO içinde hem kart hem serial var
            const [cardNumber, deviceSerial] = body.CARD_NO.split(',');
            user_id = cardNumber;
            serial = deviceSerial;
        } else {
            user_id = body.user_id;
            serial = body.serial;
        }
        
        console.log('Parsing sonucu:', { user_id, serial, original_body: body });

        // Eksik alan kontrolü
        if (!user_id) {
            console.log('user_id eksik');
            return res.status(400).json({ cevap: 'error', error: 'user_id missing' });
        }
        if (!serial) {
            console.log('serial eksik');
            return res.status(400).json({ cevap: 'error', error: 'serial missing' });
        }

        console.log('İşlenmiş veri:', { user_id, serial });

        // Eğer serial yoksa devam etme
        if (!serial) {
            console.log('Serial numarası bulunamadı, erişim reddediliyor');
            return res.json({ cevap: 'error' });
        }

        // Kartın employees tablosunda kayıtlı olup olmadığını kontrol et
        console.log('Çalışan kontrolü yapılıyor:', user_id);
        const { data: employee, error: empErr } = await serviceClient
            .from('employees')
            .select('id, first_name, last_name, is_active')
            .eq('card_number', user_id)
            .single();

        if (empErr) {
            console.error('Çalışan sorgusu hatası:', empErr);
            return res.json({ cevap: 'error' });
        }

        if (!employee) {
            console.log('Çalışan bulunamadı:', user_id);
            return res.json({ cevap: 'error' });
        }

        if (!employee.is_active) {
            console.log('Çalışan aktif değil:', user_id);
            return res.json({ cevap: 'error' });
        }

        console.log('Çalışan bulundu:', employee);

        // Cihaz bilgisini al
        console.log('Cihaz bilgisi alınıyor:', serial);
        const { data: device, error: deviceErr } = await serviceClient
            .from('devices')
            .select('id, name, device_serial')
            .eq('device_serial', serial)
            .single();

        console.log('Cihaz sorgusu sonucu:', { device, deviceErr });

        if (deviceErr) {
            console.error('Cihaz sorgusu hatası:', deviceErr);
            return res.json({ cevap: 'error' });
        }

        if (!device) {
            console.log('Cihaz bulunamadı:', serial);
            return res.json({ cevap: 'error' });
        }

        console.log('Cihaz bulundu:', device);

        // Önce cihazın hiçbir grupta olup olmadığını kontrol et
        console.log('Cihaz grup kontrolü yapılıyor...');
        const { data: deviceGroups, error: deviceGroupErr } = await serviceClient
            .from('group_devices')
            .select('id')
            .eq('device_id', device.id);

        if (deviceGroupErr) {
            console.error('Cihaz grup kontrolü hatası:', deviceGroupErr);
            return res.json({ cevap: 'error' });
        }

        if (!deviceGroups || deviceGroups.length === 0) {
            console.log('Cihaz hiçbir grupta değil, erişim reddediliyor:', device.name);
            // Kart geçiş kaydını oluştur
            await serviceClient
                .from('card_readings')
                .insert({
                    employee_id: employee.id,
                    card_no: user_id,
                    device_serial: serial,
                    access_time: new Date().toISOString(),
                    employee_name: `${employee.first_name} ${employee.last_name}`,
                    raw_data: JSON.stringify(body),
                    access_status: 'reddedildi'
                });
            return res.json({ cevap: 'error' });
        }

        console.log('Cihaz grupları bulundu:', deviceGroups.length);

        // Basit erişim kontrolü - çalışan herhangi bir erişim kuralında bu cihaza erişimi var mı?
        console.log('Erişim kontrolü yapılıyor...');
        const { data: accessCheck, error: accessErr } = await serviceClient
            .from('group_members')
            .select(`
                id,
                group_devices!inner(device_id),
                access_rules!inner(is_active)
            `)
            .eq('employee_id', employee.id)
            .eq('group_devices.device_id', device.id)
            .eq('access_rules.is_active', true);

        if (accessErr) {
            console.error('Erişim kontrolü hatası:', accessErr);
            return res.json({ cevap: 'error' });
        }

        const hasAccess = accessCheck && accessCheck.length > 0;
        console.log('Erişim kontrolü sonucu:', { accessCheck, hasAccess });
        console.log('Erişim izni durumu:', hasAccess);

        // Kart geçiş kaydını oluştur - device_serial kullan
        const { error: logError } = await serviceClient
            .from('card_readings')
            .insert({
                employee_id: employee.id,
                card_no: user_id,
                device_serial: serial,
                access_time: new Date().toISOString(),
                employee_name: `${employee.first_name} ${employee.last_name}`,
                raw_data: JSON.stringify(body),
                access_status: hasAccess ? 'izin_verildi' : 'reddedildi'
            });

        if (logError) {
            console.error('Kart okuma kaydı hatası:', logError);
        } else {
            console.log('Kart okuma kaydı başarıyla oluşturuldu');
        }

        // Erişim sonucuna göre relay kontrol
        if (hasAccess) {
            console.log('Erişim izni verildi');
            return res.json({ cevap: 'ok' });
        } else {
            console.log('Erişim reddedildi');
            return res.json({ cevap: 'error' });
        }

    } catch (error) {
        console.error('Sistem hatası:', error);
        return res.json({
            cevap: 'error',
            error: 'system error'
        });
    }
});

// Relay açıldığını onaylama
app.post('/confirm-relay', (req, res) => {
    try {
        console.log('Relay onay isteği alındı:', req.body);
        // Burada ekstra işlemler yapılabilir (log kaydetme vb.)
        return res.json({ onay: 'ok' });
    } catch (error) {
        console.error('Relay onay hatası:', error);
        return res.status(500).json({ onay: 'error' });
    }
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
