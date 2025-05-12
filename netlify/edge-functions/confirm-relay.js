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
        console.log('Relay onay isteği alındı');

        // İstek verisini al
        let body;
        try {
            body = await request.json();
            console.log('Gelen onay verisi:', body);
        } catch (error) {
            console.error('JSON ayrıştırma hatası:', error);
            return new Response(JSON.stringify({ error: 'Geçersiz JSON formatı' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Burada ekstra işlemler yapılabilir (log kaydetme vb.)

        return new Response(JSON.stringify({ confirmation: 'relay_opened' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('Relay onay hatası:', error);
        return new Response(JSON.stringify({ error: 'system error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}; 