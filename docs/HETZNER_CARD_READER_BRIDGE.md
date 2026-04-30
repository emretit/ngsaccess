# Hetzner Kart Okuyucu Köprüsü (HTTP → HTTPS → Convex)

ESP32 tabanlı kart okuyucu cihaz **sadece HTTP** konuşuyor; Convex backend **HTTPS** bekliyor ve cihaz Convex'in TLS sertifika zincirini doğrulayamıyor. Bu dokümanda, Hetzner sunucusu üzerinde nginx ile kurulan **TLS terminator köprü** açıklanır.

## Mimari

```
ESP32 Reader (LAN/internet)
        │  HTTP POST /cr/<SECRET>
        ▼
Hetzner 157.90.114.86:8090  (nginx)
        │  HTTPS, cert verify
        ▼
notable-tern-4.convex.site/card-reader  (Convex HTTP action)
        │  body parse → processCardReading mutation
        ▼
{cevap: "ok"|"error", checkResult: "success"|"failed"}
```

## Sunucu Özeti

| | |
|---|---|
| Public IP | `157.90.114.86` |
| Köprü portu | `8090/tcp` (UFW dünyaya açık, secret-gated) |
| nginx site | `/etc/nginx/sites-available/ngs-card-reader` (symlink `sites-enabled/`) |
| Access log | `/var/log/nginx/ngs-card-reader.access.log` (secret `<redacted>` yazılır) |
| Error log | `/var/log/nginx/ngs-card-reader.error.log` |
| SSH | `ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86` |
| Mevcut diğer servisler | OpenClaw bridge/gateway (port 80/8080) — etkilenmez |

## Cihaz Konfigürasyonu (Access Management ekranı)

| Alan | Değer |
|---|---|
| Protocol | `HTTP` |
| SSL | `OFF` |
| Host (önünde `http://` sabit) | `157.90.114.86:8090/cr/<SECRET>` |
| Message Format | `JSON` |
| Request Body | `{"CARD_NO":"%T,%S"}` |
| Good Response | `{"cevap":"ok"}` |
| Relay Open Confirmation | `{"onay":"ok"}` |

> `%T` = okunan kart numarası, `%S` = cihaz seri numarası. Convex tarafı her ikisini de body'den parse eder ([`convex/lib/cardReaderParse.ts`](../convex/lib/cardReaderParse.ts)).

**Gerçek SECRET değeri** sunucuda `/etc/nginx/sites-available/ngs-card-reader` dosyasındaki `set $ngs_secret_expected "..."` satırında saklı. Buraya yazılmaz; gerektiğinde:
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 \
  'grep ngs_secret_expected /etc/nginx/sites-available/ngs-card-reader'
```

## Convex Tarafı

- HTTP endpoint: [`convex/http.ts:32`](../convex/http.ts#L32) — `POST /card-reader`
  - Body parse → `parseCardReading` ([`convex/lib/cardReaderParse.ts`](../convex/lib/cardReaderParse.ts))
  - Cihaz `lastSeen` güncellenir ([`convex/devices.ts:updateLastSeen`](../convex/devices.ts))
  - `internal.cardReadings.processCardReading` çağrılır
- Erişim kararı: [`convex/cardReadings.ts:567`](../convex/cardReadings.ts#L567)
  - `employees.cardNumber` ile çalışan bul
  - `devices.deviceSerial` ile cihaz bul
  - `groupDevices` → cihaz herhangi bir gruba dahil mi?
  - `groupMembers` → çalışan o grupta üye mi?
  - `accessRules.isActive: true` mu?
  - Hepsi sağlanırsa `granted: true` → `{cevap:"ok",checkResult:"success"}`

## Yeni Kart + Cihaz Yetkilendirme

Idempotent setup mutation: [`convex/seedTestCardAccess.ts`](../convex/seedTestCardAccess.ts) — `setupCardAndDevice`. Çalışan & cihaz & accessRule & grup üyeliklerini tek seferde kurar/onarır.

```bash
npx convex run seedTestCardAccess:setupCardAndDevice \
  '{"cardNo":"108530318","deviceSerial":"3506556215854224"}'
```

İsteğe bağlı argümanlar: `employeeFirstName`, `employeeLastName`, `deviceName`, `ruleName`. Mevcut kayıtlar üzerine yazılmaz; yalnızca eksik bağlantılar tamamlanır.

## Güvenlik

- **Secret URL path'in son segmenti** (`/cr/<SECRET>`). Cihaz custom HTTP header destekleyemediği için header tabanlı auth yapılamadı.
- nginx access log custom format ile path'i `/cr/<redacted>` olarak yazar — log'a sızmaz.
- Yanlış/eksik secret → `404` (varlığı bile gizlenir, `403` yerine).
- UFW 8090'ı dünyaya açık tutar (cihaz dinamik IP'de). Tek koruma secret.
- HTTP clear-text — kart numaraları MITM'e açık. Pratik risk düşük (ev/ofis ISP), ama LAN tarafında VPN/Tailscale ile gizleme uzun vadede iyileştirme.

### Secret rotasyonu

```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 'bash -c "
  NEW=\$(openssl rand -hex 24)
  sed -i \"s|set \\\$ngs_secret_expected \\\".*\\\"|set \\\$ngs_secret_expected \\\"\$NEW\\\"|\" /etc/nginx/sites-available/ngs-card-reader
  sed -i \"s|location = /cr/[a-f0-9]\\+|location = /cr/\$NEW|g\" /etc/nginx/sites-available/ngs-card-reader
  nginx -t && systemctl reload nginx && echo \"NEW=\$NEW\"
"'
```

Çıkan yeni secret'ı cihazın Host alanına yaz, **Save → Reboot**.

## Sorun Giderme

| Belirti | Anlamı | Yapılacak |
|---|---|---|
| Cihaz hiç istek atmıyor | Cihazın internet/DNS sorunu, ya da Host alanı yanlış | Cihaz LAN ağ ayarlarını ve Host alanını kontrol et |
| nginx access log boş | İstek sunucuya hiç gelmiyor | Cihaz public IP'sini öğren, traceroute; UFW açık mı `ufw status` |
| 404 (`/cr/<redacted>`) | Secret yanlış veya path bozuk | Cihazdaki Host alanı ile nginx config'deki secret eşleşmiyor |
| 200 + `{cevap:"error",checkResult:"failed"}` | Köprü OK, ama kart/cihaz yetkili değil | `npx convex run seedTestCardAccess:setupCardAndDevice ...` çalıştır |
| 502 | Convex'e bağlanılamadı | `https://notable-tern-4.convex.site` ayakta mı? Convex status sayfası |

### Log izleme

```bash
# nginx (köprü)
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 \
  'tail -f /var/log/nginx/ngs-card-reader.access.log'

# Convex (uygulama mantığı)
npx convex logs --history 50
```

### Hızlı end-to-end test (curl)

```bash
SECRET=$(ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 \
  'grep -oP "set \$ngs_secret_expected \"\K[^\"]+" /etc/nginx/sites-available/ngs-card-reader')

curl -i -X POST -H 'Content-Type: application/json' \
  -d '{"CARD_NO":"108530318,3506556215854224"}' \
  "http://157.90.114.86:8090/cr/$SECRET"
# Beklenen: HTTP 200 + {"cevap":"ok","checkResult":"success"}
```

## Mevcut Test Kayıtları (referans)

- Cihaz seri: `3506556215854224`
- Cihaz public IP (dinamik, log'larda görülen): `95.70.138.153`
- Test kartı: `108530318` → Test Çalışan, "Test Erişim Kuralı (24/7)" grubunda yetkili.
- Convex deployment: `dev:notable-tern-4`
  - HTTP actions: `https://notable-tern-4.convex.site`
  - Client API: `https://notable-tern-4.convex.cloud`

## Köprünün Kapatılması / Geri Alma

```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@157.90.114.86 'bash -c "
  rm /etc/nginx/sites-enabled/ngs-card-reader
  nginx -t && systemctl reload nginx
  ufw delete allow 8090/tcp
"'
```

`sites-available/` dosyası ve loglar disk'te kalır; tamamen silmek istersen ek `rm` komutu.
