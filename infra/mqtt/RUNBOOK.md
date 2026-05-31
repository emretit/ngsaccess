# NGS Access — IDE Smart MQTT Broker (Mosquitto) Runbook

IDE Smart kapı panelleri için iki yönlü komut/event kanalı. Panel → Mosquitto (Hetzner) → bridge daemon → Convex.

## Neden MQTT (heartbeat-response değil)

Heartbeat-response (`HB_PROCESS_RESPONSE`) canlı test edildi ve çalışıyor (reboot sonrası), AMA o kanal `HTTP_REMOTE` sayılıyor ve `update_actuator` orada **level 99** (kapalı) istiyor. MQTT kanalında `update_actuator` **level 0** (docs §3.4) → kapı açma + tüm komutlar MQTT'de serbest. Bu yüzden komut kanalı MQTT.

## Mimari

```
IDE Smart Panel (LAN, MQTT/TLS)
        │  publish: event/access/online, event/heartbeat, device/publish/<uuid>
        │  subscribe: device/subscribe/<uuid>   (komut)
        ▼
Hetzner 157.90.114.86:8883  (Mosquitto, TLS self-signed + auth + ACL)
        ▲  bridge loopback 127.0.0.1:1883 (plaintext, aynı host)
        │
   ide-mqtt-bridge daemon (systemd)
        │  event → HTTPS POST /card-reader (Bearer device.apiToken)
        │  komut ← Convex poll (/ide-bridge/poll) → publish device/subscribe/<uuid>
        │  response (device/publish/<uuid>) → msx-id correlate → POST /ide-bridge/ack
        ▼
   Convex notable-tern-4
```

## Sunucu

| | |
|---|---|
| Public IP | `157.90.114.86` (hostname: Pafta, paylaşımlı) |
| MQTT TLS portu | `8883/tcp` (UFW açık, TLS + auth) |
| Bridge loopback | `127.0.0.1:1883` (plaintext, dünyaya KAPALI) |
| Docker | 29.x + compose v5 (kurulu) |
| Mevcut servisler | nginx 80/8080/8090, Hik ISUP 766x — etkilenmez |
| SSH | `ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86` |
| Compose dizini | `/opt/ngs-mqtt/` (deploy hedefi) |

## İlk kurulum

```bash
# 1) infra/mqtt'yi sunucuya kopyala
rsync -az -e "ssh -i ~/.ssh/id_ed25519_hetzner" \
  infra/mqtt/ root@157.90.114.86:/opt/ngs-mqtt/

ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86
cd /opt/ngs-mqtt

# 0) Docker daemon (paylaşımlı sunucuda inactive olabilir) — başlat + boot'ta kalsın
systemctl enable --now docker

# 2) Sertifikalar (self-signed CA + server cert, CN=IP)
BROKER_IP=157.90.114.86 bash gen-certs.sh

# 3) Parola dosyası (device + bridge kullanıcıları)
mkdir -p secrets
docker run --rm -v "$PWD/secrets:/s" eclipse-mosquitto:2 \
  mosquitto_passwd -c -b /s/passwd device 'PANEL_SIFRESI'
docker run --rm -v "$PWD/secrets:/s" eclipse-mosquitto:2 \
  mosquitto_passwd -b /s/passwd bridge 'BRIDGE_SIFRESI'

# 3b) KRİTİK izinler — container içinde mosquitto uid=1883 olarak çalışır.
#     600/root dosyaları okuyamaz → crash (exit 13, "Restarting"). uid 1883'e ver:
chown 1883:1883 certs/ca.crt certs/server.crt certs/server.key secrets/passwd config/acl config/mosquitto.conf
chmod 644 certs/ca.crt certs/server.crt
chmod 640 certs/server.key
chmod 0700 secrets/passwd config/acl   # mosquitto 2.x world-readable acl/passwd'i reddedecek

# 4) Broker'ı başlat
docker compose up -d
docker compose ps
docker compose logs --tail=30 mosquitto

# 5) UFW — 8883 dünyaya aç (1883 zaten loopback)
ufw allow 8883/tcp comment 'NGS IDE Smart MQTT TLS'
ufw status | grep 8883
```

## Doğrulama (broker ayakta mı)

```bash
# Loopback (plaintext) — bridge user ile $SYS oku
docker run --rm --network host eclipse-mosquitto:2 \
  mosquitto_sub -h 127.0.0.1 -p 1883 -u bridge -P 'BRIDGE_SIFRESI' \
  -t '$SYS/broker/version' -C 1

# TLS (8883) — CA ile, dışarıdan panelin yapacağı gibi
docker run --rm -v "$PWD/certs:/c" eclipse-mosquitto:2 \
  mosquitto_sub -h 157.90.114.86 -p 8883 --cafile /c/ca.crt \
  -u device -P 'PANEL_SIFRESI' -t 'event/#' -v
```

## Sırlar (repoya GİRMEZ — .gitignore)

- `certs/` — CA + server key/cert (gen-certs.sh üretir)
- `secrets/passwd` — mosquitto kullanıcı parolaları
- Panel `MQTT.PASSWORD` (= device şifresi) → panele L3 ile yazılır (set-mqtt-target.mjs)
- Bridge `.env` → `/etc/ide-mqtt-bridge.env` (BRIDGE_SIFRESI, Convex device apiToken, IDE_BRIDGE_SECRET)

## Bakım

```bash
docker compose restart mosquitto      # yeniden başlat
docker compose logs -f mosquitto      # canlı log
docker compose down                   # durdur

# Parola değiştir/ekle
docker run --rm -v "$PWD/secrets:/s" eclipse-mosquitto:2 \
  mosquitto_passwd -b /s/passwd device 'YENI_SIFRE'
docker compose restart mosquitto

# Sertifika yenile (10 yıl, gerekirse FORCE=1)
FORCE=1 BROKER_IP=157.90.114.86 bash gen-certs.sh && docker compose restart mosquitto
```

## Geri alma (broker'ı kaldır)

```bash
cd /opt/ngs-mqtt && docker compose down -v
ufw delete allow 8883/tcp
# Panelleri HTTP moduna geri al: scripts/ide-smart-set-http-target.mjs (REVERT veya TARGET_HOST)
```
