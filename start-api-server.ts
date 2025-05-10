// API sunucusunu başlatmak için kullanılan betik
// Komut: bun run start-api-server.ts
import { startAPIServer } from './src/api';

// Ortam değişkenlerinden port al veya varsayılan 3001'i kullan
const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

// API sunucusunu başlat
const server = startAPIServer(port);

console.log(`HTTP API sunucusu başlatıldı: http://localhost:${port}`);
console.log('Kart okuyucu API endpoint: http://localhost:${port}/api/card-reader');
console.log('Çıkmak için Ctrl+C tuşlarına basın...');

// Çıkış sinyallerini işle
process.on('SIGINT', () => {
    console.log('\nAPI sunucusu durduruluyor...');
    server.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nAPI sunucusu durduruluyor...');
    server.stop();
    process.exit(0);
}); 