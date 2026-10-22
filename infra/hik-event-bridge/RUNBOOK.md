# Hik gateway event köprüsü (ngs-hik-event-bridge)

Hik Device Gateway'in event aboneliğini (`subscribeDeviceMgmt`, multipart uzun-poll) dinler, erişim
kontrol event'lerini Convex `/card-reader`'a cihaz token'ıyla POST eder. httpHosts push desteklemeyen
ISUP cihazları (DS-K1T804AEF FW V1.4.0 gibi) için tek event yolu budur.

`devStatusChanged` olaylarını ayrıca `/hik-gateway/device-status` yoluna aynı cihazın Bearer
token'ıyla `{devIndex, status: "online" | "offline", at}` olarak gönderir. `at` köprünün
alma anının milisaniye zamanıdır; gateway `dateTime` değeri kullanılmaz. Kart olaylarına uygulanan
`EVENT_TIME_OFFSET`, gateway'in kendi durum olaylarına uygulanmaz. `addressChange` ve
`heartBeat` durum bildirimi sayılmaz. Route yalnız token sahibinin `hikDevIndex` değeriyle eşleşen,
`localBridge` olmayan Hikvision cihazını kabul eder; relay/legacy/token query parametresi kabul etmez.

Başarılı abonelikte son başarılı snapshot en az 5 dakika eskiyse (veya henüz yoksa) ve açık
abonelik boyunca 60 dakikada bir,
gateway `POST /ISAPI/ContentMgmt/DeviceMgmt/deviceList?format=json` çağrısıyla durum görüntüsü alınır.
200 cihazlık sayfalar okunur; yalnız token'ı olan, durumu açıkça online/offline olan cihazlar
`source: "snapshot"` ile gönderilir. Eksik cihaz veya başarısız/bozuk liste offline diye yorumlanmaz.
Snapshot zamanı istek başında alınır; daha yeni canlı olayın üzerine yazamaz. Durum ve kart
bildirimleri aynı kuyruk, üç deneme ve `maxQueue=1000` sınırını kullanır. Snapshot sayacı yalnız
kuyruğa kabul edilen cihazları sayar. Sunucu 10 dakikadan eski durum zamanlarını reddeder.

Son ISUP bildirimi en fazla 2,5 saat eskiyse UI bu durumu kullanır; kart okutulmasa da online kalır.
Bildirimler daha uzun süre kesilirse eski beş dakikalık kart sinyali hesabına dönülür. Offline anında
görünür; aynı kopma beş dakika sürerse tek açık arıza ve mevcut alarm e-posta zinciri tetiklenir.
Geri bağlantıda arıza çözülür ve kesinti dönemi kaydedilir. Beş dakikadan kısa kopmada alarm ve
kesinti kaydı oluşmaz. Tek seferlik Convex scheduler doğrulaması kullanılır; yeni cron yoktur.

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
| `device_status` | gateway'in canlı durum olayı; devIndex + online/offline |
| `forward type=devStatusChanged` | durum POST sonucu; `deviceStatus` cihaz durumu, `status` HTTP kodu, `source=snapshot` varsa durum görüntüsü |
| `snapshot` | deviceList tamamlandı; `devices` kuyruğa kabul edilen token sahibi cihaz sayısı (düşenler sayılmaz) |
| `snapshot_failed` | liste alınamadı/çözülemedi; mevcut durumlar değiştirilmedi |
| `skip reason=no_token` | cihaz token eşlemesi yok; durum/kart POST edilmedi |
| `drop reason=queue_full` | ortak kuyruk dolu; sonraki snapshot durumu yeniden eşitler |
| `post_retry` | ağ/5xx hatası; en fazla üç deneme |

Loglar kart numarası, kişi bilgisi, token veya HTTP yanıt gövdesi içermez.

## Sürüm güncelleme / yeniden kurulum (koordinatör)

Önce Convex route ve durum mutation'larını içeren onaylanmış backend sürümünü yayınlayın.
Bu geliştirme görevi deployment veya SSH yapmaz. Koordinatör mevcut env dosyasını koruyarak:

```bash
cp bridge.mjs /opt/ngs-hik-event-bridge/bridge.mjs
systemctl restart ngs-hik-event-bridge
journalctl -u ngs-hik-event-bridge --since '5 minutes ago'
```

`subscribed` → `snapshot` → `forward type=devStatusChanged source=snapshot status=200` zincirini,
bir saat sonra ikinci snapshot'ı ve okutmasız cihazın çevrimiçi kaldığını doğrulayın. Kısa bağlantı
kesintisinde alarm oluşmamalı; beş dakikayı geçen kesintide tek alarm/e-posta, geri bağlantıda
çözülen aynı alarm + tek kesinti dönemi görülmeli. `401` token/env eşlemesini, `403` cihazın
devIndex/brand/transport eşlemesini, `400` gövdeyi ve köprü/sunucu saatini kontrol ettirir
(10 dakikadan eski veya iki dakikadan fazla ileri zaman reddedilir).

## Test

```bash
node --test infra/hik-event-bridge/bridge.nodetest.mjs
```
