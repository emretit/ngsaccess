# Görev: Hik köprü uyandırma — Hetzner relay servisi (Faz 2, yalnız repo'da; sunucuya kurulum YOK)

## Hedef
`infra/hik-relay/server.mjs` sözleşme v1'i (hik-wake-common.md) birebir uygular: geçerli biletli SSE bağlantısına imzalı
`/hik-bridge/wake` geldiğinde `event: wake` yazar; geçersiz bilet/imza/eski ts 401, aşırı wake 429 — `node --test` ile kanıtlanır;
kurulum runbook'u + systemd + nginx örneği hazırdır.

## Ownership (yalnız bunlar)
- `infra/hik-relay/**` (YENİ klasör): `server.mjs`, `server.nodetest.mjs`, `ngs-hik-relay.service`, `nginx-hik-relay.conf`,
  `relay.env.example`, `RUNBOOK.md`
- `docs/HETZNER_CARD_READER_BRIDGE.md` — YALNIZ sona "Hik relay" başlıklı kısa bölüm (RUNBOOK'a yönlendirme)

## Yapılacaklar
1. `server.mjs` — Node ≥18, SIFIR bağımlılık (`node:http`, `node:crypto`, `node:url`). Env: `HIK_RELAY_SECRET` (zorunlu; yoksa
   veya <32 karakterse stderr + `process.exit(1)`), `PORT` (vars. 8791), `HOST` (vars. `127.0.0.1` — yalnız nginx arkasında).
   - Bellek içi `Map<bridgeId, Set<conn>>`; bridge başına en fazla 3 bağlantı (4.'de en eskiyi kapat).
   - `GET /hik-bridge/stream`: `bridge` + `ticket` query; `bridge` yalnız `[A-Za-z0-9_-]{1,64}`; ticket timing-safe (`timingSafeEqual`,
     uzunluk farkında güvenli). 200 SSE başlıkları + `X-Accel-Buffering: no`; `retry`, `ready`, 25 sn `: ping`. İstemci kapanınca temizle.
   - `POST /hik-bridge/wake`: gövde ≤ 1 KB (aşarsa 413), ham gövde üzerinden imza; `X-Ngs-Ts` sayısal ve ±60 sn; `bridgeId` JSON'dan;
     bridge başına 60 sn kayan pencerede 30 wake (aşarsa 429); 200 `{ok:true,delivered:n}`.
   - `GET /hik-bridge/health`; diğer her şey 404; yanlış method 405.
   - Log: stdout'a tek satır (zaman, olay, bridgeId, sonuç) — secret/ticket/imza ASLA. `SIGTERM`/`SIGINT`'te bağlantıları kapat, çık.
   - Test edilebilirlik: `export function createRelayServer({ secret, now?, pingMs? })` + `if (import.meta.url === pathToFileURL(process.argv[1]).href)` ile başlatma.
2. `server.nodetest.mjs` (`node --test infra/hik-relay/server.nodetest.mjs`): rastgele portta sunucu; 401 (yanlış bilet), 200 + `ready`,
   imzalı wake → bağlı istemci `event: wake` alır, `delivered` doğru; ts kayması 401; bozuk imza 401; 31. wake 429; 4. bağlantıda en eski
   kapanır; health sayıları; 413. Bilet/imza testte `createHmac` ile üretilir.
3. `ngs-hik-relay.service`: `ExecStart=/usr/bin/node /opt/ngs-hik-relay/server.mjs`, `EnvironmentFile=/etc/ngs-hik-relay.env`,
   `Restart=always`, `DynamicUser=yes`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`.
4. `nginx-hik-relay.conf`: `server_name relay.ngsplus.app` (yer tutucu, RUNBOOK'ta değiştirilebilir), 80 → ACME + 443'e yönlendirme,
   443 bloğu certbot'un yöneteceği şekilde; `location /hik-bridge/ { proxy_pass http://127.0.0.1:8791; proxy_http_version 1.1;
   proxy_set_header Connection ""; proxy_buffering off; proxy_cache off; proxy_read_timeout 3600s; proxy_send_timeout 3600s; }`;
   access log'da query string (bilet) YAZILMASIN (`log_format` ile `$uri` kullan).
5. `relay.env.example`: yalnız anahtar adları (`HIK_RELAY_SECRET=`, `PORT=8791`, `HOST=127.0.0.1`).
6. `RUNBOOK.md` (Türkçe, adım adım checklist): DNS A kaydı (relay.<alan> → 157.90.114.86), `node --version` kontrolü/kurulumu,
   dosyaları `/opt/ngs-hik-relay/`'a kopyalama, secret üretimi (`openssl rand -hex 32`) → `/etc/ngs-hik-relay.env` (0600) + Convex
   `npx convex env set HIK_RELAY_URL/HIK_RELAY_SECRET` (aynı secret), UFW 80/443, nginx site + `certbot --nginx -d relay.<alan>`,
   systemd enable, uçtan uca curl testleri (health, imzalı wake örneği — imza üretimi için tek satır `node -e`), log izleme
   (`journalctl -u ngs-hik-relay`), secret rotasyonu, geri alma (servisi durdur → köprüler 15 dk poll'a düşer). Sunucu paylaşımlı:
   mevcut nginx siteleri (`ngs-card-reader` :8090) ve MQTT'ye dokunulmaz uyarısı.

## Kapsam dışı
Convex kodu ve Windows köprüsü başka worker'larda. Hetzner'e SSH/kopyalama/kurulum, DNS değişikliği YOK (koordinatör, kullanıcı onayıyla).

## Kapılar
- `node --test infra/hik-relay/server.nodetest.mjs` → hepsi yeşil
- `node --check infra/hik-relay/server.mjs` → 0
- `node_modules/.bin/eslint src convex` etkilenmemeli (infra/ lint kapsamı dışında; dokunma)
