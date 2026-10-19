# Hik gateway event köprüsü (ngs-hik-event-bridge)

Hik Device Gateway'in event aboneliğini (`subscribeDeviceMgmt`, multipart uzun-poll) dinler, erişim
kontrol event'lerini Convex `/card-reader`'a cihaz token'ıyla POST eder. httpHosts push desteklemeyen
ISUP cihazları (DS-K1T804AEF FW V1.4.0 gibi) için tek event yolu budur.

```
cihaz --ISUP 7661/7663--> Device Gateway (8088) --subscribe--> ngs-hik-event-bridge --HTTPS--> Convex /card-reader
```

## Gateway önkoşulları (bir kez)

İkisi de kapalıyken abonelik `403 notSupport` döner (gateway log: `ACCESS_GATEWAY / MULTI_GATEWAY not support
event transmit by default`). Web UI: Configuration → System Settings → Alarm Subscribe + Alarm Forwarding. API ile:

```bash
G=http://127.0.0.1:8088/ISAPI/ContentMgmt/DeviceMgmt
curl --digest -u admin:$PASS -X PUT -d '{"EventSubscription":{"enable":true}}' "$G/eventSubCfg?format=json"
curl --digest -u admin:$PASS -X PUT -d '{"ISUPListenCfg":{"enable":true}}' "$G/isupListenCfg?format=json"
```

`isupListenCfg` açılınca gateway 7663'ü (ISUP 5.0 alarm) dinler; UFW'de 7660:7667 açık olmalı. Cihaz bu
kanal ilk açıldığında hafızasındaki eski event'leri (`currentEvent:false`, 1970/2024 tarihli) geri basar;
köprü `MAX_EVENT_AGE_HOURS`'tan eski olanları atlar.

## Kurulum (Hetzner, root)

```bash
mkdir -p /opt/ngs-hik-event-bridge
cp bridge.mjs /opt/ngs-hik-event-bridge/
cp bridge.env.example /etc/ngs-hik-event-bridge.env && chmod 600 /etc/ngs-hik-event-bridge.env
# HIK_GATEWAY_PASS = `npx convex env get HIK_GATEWAY_PASS`; HIK_DEVICE_TOKENS = devIndex → devices.apiToken
cp ngs-hik-event-bridge.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now ngs-hik-event-bridge
journalctl -u ngs-hik-event-bridge -f
```

Yeni cihaz eklemek: `HIK_DEVICE_TOKENS` JSON'una `"<devIndex>":"<apiToken>"` ekle → `systemctl restart ngs-hik-event-bridge`.
Token'ı olmayan cihazın event'i `skip reason=no_token` olarak loglanır.

## Log satırları

| event | anlamı |
|---|---|
| `subscribed` | abonelik kuruldu (gateway subscription id) |
| `forward` | event Convex'e gitti; `status` 200 = işlendi, 401 = token geçersiz, 403 = cihaz eşleşmedi |
| `skip reason=too_old` | geri basılan eski kayıt, iletilmedi |
| `stream_closed` | heartbeat (30 sn) kesildi veya bağlantı koptu → 1→30 sn backoff ile yeniden abone olur |

## Test

```bash
node --test infra/hik-event-bridge/bridge.nodetest.mjs
```
