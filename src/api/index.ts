import { handleCardReaderRequest } from './cardReaderRoute';

// API route'larının kök path'leri
const API_ROUTES = {
    CARD_READER: '/api/card-reader',
};

/**
 * API isteklerini yönlendiren ana fonksiyon
 * Bu fonksiyon, gelen istekleri ilgili route handler'lara yönlendirir
 * 
 * @param request Gelen HTTP isteği
 * @returns Handler yanıtı veya 404 hatası
 */
export async function handleAPIRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log(`API isteği alındı: ${request.method} ${path}`);

    // Kart okuyucu API route'u
    if (path === API_ROUTES.CARD_READER) {
        return handleCardReaderRequest(request);
    }

    // Eşleşen route bulunamadı, 404 dön
    return new Response(
        JSON.stringify({ error: 'Route bulunamadı' }),
        {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
    );
}

/**
 * API isteklerini dinleyen bir HTTP sunucusu başlatır
 * 
 * @param port Dinlenecek port numarası
 * @returns Async HTTP sunucusu
 */
export function startAPIServer(port: number = 3001) {
    console.log(`HTTP API sunucusu ${port} portunda başlatılıyor...`);

    return Bun.serve({
        port: port,
        fetch: handleAPIRequest
    });
}

// Bu dosyayı doğrudan çalıştırırsak HTTP sunucusunu başlat
if (import.meta.url === Bun.main) {
    const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;
    startAPIServer(port);
} 