/**
 * NGS Access - Minimal API Server
 *
 * Kart okuyucu istekleri artık Convex HTTP endpoint'ine yönlendiriliyor.
 * Cihazları doğrudan Convex URL'ine yapılandırın:
 *
 *   https://<deployment>.convex.site/card-reader
 *
 * Deployment URL'ini Convex Dashboard > Settings > URL bölümünden alın.
 * Örnek: https://notable-tern-4.convex.site/card-reader
 *
 * Cihaz dışarı POST atamıyorsa (DNS/log yok): LAN'da
 * `npm run forward:card-reader` ile scripts/forward-card-reader-to-convex.mjs
 * çalıştırıp cihazı http://<PC_IP>:8765/card-reader adresine yönlendir.
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'NGS Access API',
    cardReader: 'Kart okuyucu istekleri için Convex HTTP endpoint kullanın: https://<deployment>.convex.site/card-reader',
  });
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
