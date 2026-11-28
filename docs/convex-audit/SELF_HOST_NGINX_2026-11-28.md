**Çalışıyor mu?** Evet. `https://api.ngsplus.app` (API + WebSocket) ve `https://site.ngsplus.app` (HTTP action + Auth) geçerli Let's Encrypt sertifikasıyla yanıt veriyor. Web, `VITE_CONVEX_URL=https://api.ngsplus.app` ile yerelde açıldı: giriş 1,05 sn, Ana sayfa gerçek veriyle geldi, tüm trafik `wss://api.ngsplus.app` üzerinden.
**Çıkış kısıtı:** Backend konteyneri artık yalnız Hik gateway'e (`:8088`), sunucunun kendi nginx'ine (`:443`: site/api/relay), SMTP'ye (`465/587`) ve `api.resend.com`'a çıkabiliyor. `example.com`, OpenAI, host SSH, diğer konteynerler engelli. Kural yalnız bu konteynerin köprüsüne bağlı, reboot'ta kalıcı ve kendini onarıyor.
**Veri:** Yeniden başlatma öncesi ve sonrası 91 tablo girdisi, 12.260 belge birebir aynı.
**Diğer servisler:** 8 systemd servisi + pafta-gotenberg aynı başlangıç zamanıyla çalışıyor, tüm portlar ve HTTP yoklamaları önceki gibi. Mevcut vhost'ların md5'i değişmedi.
**Dikkat:** Hetzner bu sunucudan giden `465` portunu engelliyor (host'un kendisi de bağlanamıyor). SMTP gerçek geçişte `587` (STARTTLS) ile yapılmalı.

# Self-host Convex — dış adres (nginx + TLS + DNS + çıkış kısıtı) — 28 Kasım 2026

Prova kurulumunun ([SELF_HOST_PROVA_2026-11-28.md](SELF_HOST_PROVA_2026-11-28.md)) devamı. Emre onayı: 2026-11-28 "Evet, başlat". Geçiş (cutover) yapılmadı. Cloud (`notable-tern-4`), web yayını, mobil, cihazlar ve köprüler değişmedi. Gerçek env/secret aktarılmadı; cihaz/SMTP env'leri prova gibi boş. Bu belgede secret değeri yok.

Saatler TR (UTC+3). İş 14:35'te başladı, 14:50'de bitti.

## 1. Ne kuruldu

| Adım | Saat | Ne yapıldı |
|---|---|---|
| DNS | 14:36 | `dig NS ngsplus.app` → NS1 (Netlify DNS). Netlify CLI oturumuyla (`netlify api createDnsRecord`) 2 A kaydı eklendi: `api.ngsplus.app` ve `site.ngsplus.app` → `157.90.114.86`, TTL 3600. Mevcut 7 kayıt (apex/www NETLIFY, `send` MX/TXT, `resend._domainkey`, `_dmarc`, `relay` A) değişmedi; önce/sonra listesi karşılaştırıldı. |
| nginx yedeği | 14:38 | `/root/nginx-backup-20261128T113822Z.tgz` (tüm `/etc/nginx`). Mevcut dosyaların md5 listesi: `/opt/ngs-convex/ops-log/nginx-md5-before.txt`. |
| nginx vhost | 14:38-14:41 | Yeni tek dosya `/etc/nginx/sites-available/ngs-convex` (+ `sites-enabled` linki). Önce yalnız port 80 (ACME) ile reload, sertifika sonrası tam hali. Kopya: [infra/convex-selfhost/nginx-ngs-convex.conf](../../infra/convex-selfhost/nginx-ngs-convex.conf). |
| TLS | 14:40 | `certbot certonly --webroot -w /var/www/letsencrypt` (sunucudaki `relay.ngsplus.app` ile aynı yöntem). İki ayrı ECDSA sertifika, bitiş 26 Şubat 2027. `renew_hook = systemctl reload nginx` eklendi. |
| Çıkış kısıtı | 14:43 | `/usr/local/sbin/ngs-convex-egress.sh` + `ngs-convex-egress.service` (açılışta, docker'dan önce) + `ngs-convex-egress.timer` (2 dk'da bir). Kopyalar: [infra/convex-selfhost/](../../infra/convex-selfhost/). |
| Origin env + ağ | 14:44 | Compose: `CONVEX_CLOUD_ORIGIN=https://api.ngsplus.app`, `CONVEX_SITE_ORIGIN=https://site.ngsplus.app`; backend'e yeni `egress` ağı (köprü `br-ngscvx-egr`, `172.30.210.0/24`, IPv6 kapalı). Yalnız `backend` yeniden oluşturuldu, 7 sn'de healthy. Önceki compose: `/opt/ngs-convex/backup/docker-compose.yml.20261128-before-nginx`. Kopya: [infra/convex-selfhost/docker-compose.yml](../../infra/convex-selfhost/docker-compose.yml) (yalnız `${…}` değişken adları). |
| Fonksiyon yeniden push | 14:48 | Gerekliydi (bkz. Sorun 1). `/tmp/ngs-selfhost` kopyasından, SSH tüneli üzerinden yalnız self-host'a: "Deployed Convex functions to http://127.0.0.1:13210". Shell'de `CONVEX_*` değişkeni yoktu, `.env.local`'da Cloud adı yoktu. |

### nginx ayrıntıları
- `api.ngsplus.app` → `http://127.0.0.1:3210`; `site.ngsplus.app` → `http://127.0.0.1:3211`. Port 80 yalnız ACME + `301 https`.
- WebSocket: `Upgrade $http_upgrade` + `Connection $ngs_convex_conn_upgrade`. Varsayılan vhost'taki `$connection_upgrade` map'iyle çakışmasın diye ayrı ad kullanıldı. `proxy_read_timeout`/`proxy_send_timeout` 3600 sn, `proxy_buffering off`.
- `client_max_body_size`: api 100 MB (deploy/import/storage upload), site 50 MB.
- Log `/var/log/nginx/ngs-convex.access.log`, `$request_uri` değil `$uri` ile; sorgu dizgisindeki olası bilet/token log'a düşmez.
- `http2` **kullanılmadı**. nginx 1.24 `http2 on;` direktifini tanımıyor. `listen … http2` ise aynı 443 soketini paylaşan Pafta/relay vhost'larını da etkilerdi.
- Dashboard (`127.0.0.1:6791`) dışarı açılmadı: `http://157.90.114.86:6791` bağlantı yok, `https://api.ngsplus.app/dashboard` 404.

### Çıkış kuralı (yalnız `br-ngscvx-egr` köprüsü)
| Zincir | Bağlantı noktası | İzin |
|---|---|---|
| `NGS-CVX-FWD` (DOCKER-USER/FORWARD, internete giden) | `-i br-ngscvx-egr -j NGS-CVX-FWD`, ardından `-i br-ngscvx-egr -j DROP` | dönüş trafiği (ESTABLISHED) · DNS 53/udp+tcp yalnız Hetzner resolver'larına (185.12.64.1/2) · tcp 465,587 (SMTP) · tcp 443 yalnız `api.resend.com` IP'lerine (her çalışmada yeniden çözülür; DNS yanıt vermezse eski IP'ler korunur) |
| `NGS-CVX-IN` (INPUT, host'un kendi portları) | `-i br-ngscvx-egr -j NGS-CVX-IN`, ardından `DROP`; ufw zincirlerinden önce | dönüş trafiği · `157.90.114.86:8088` (Hik gateway) · `157.90.114.86:443` (nginx: `site.` JWKS self-fetch, `api.`, `relay.ngsplus.app`) |

- **Fail-closed:** İzin zinciri boş, yarım ya da atlaması silinmiş olsa bile sondaki `DROP` tutar. Denendi: atlama silinince `api.resend.com` → `000` (engelli). `systemctl start ngs-convex-egress` → "repaired jump pair in DOCKER-USER", ardından tekrar `200`.
- **Kalıcılık:** Servis `enabled`, `Before=docker.service` (açılışta konteynerler kalkmadan önce kurulur). Timer `enabled`; docker/ufw reload sonrası sırayı ve mail API IP'lerini 2 dk'da bir düzeltir. İkinci çalıştırma değişiklik yapmıyor (idempotent).
- **Etki alanı:** Kurallar `-i br-ngscvx-egr` ile sınırlı. Diğer konteynerler (pafta-gotenberg, openwa ağları) ve host trafiği etkilenmez. Proxy ve dashboard bu ağda değil.

## 2. Smoke sonuçları

| Kontrol | Sonuç |
|---|---|
| `curl https://api.ngsplus.app/version` | ✅ 200, TLS doğrulaması 0 (geçerli) |
| `http://api.ngsplus.app` | ✅ 301 → https |
| `https://site.ngsplus.app/.well-known/openid-configuration` | ✅ `"issuer":"https://site.ngsplus.app"` (önce `http://127.0.0.1:3211`) |
| HTTP action: `GET https://site.ngsplus.app/card-reader` | ✅ 200 `{"ok":true,…}` (salt-okuma route'u; yazı yok) |
| Web (yerel vite, `VITE_CONVEX_URL=https://api.ngsplus.app`) + headless Chromium | ✅ prova hesabıyla giriş 1,05 sn → `/home`; Ana sayfa "28 Kasım 2026 … Bugün gelen / 10 …"; WebSocket `wss://api.ngsplus.app/api/1.47.0/sync` (16 alınan / 22 gönderilen çerçeve); sayfa hatası 0 |
| Veri (yeniden başlatma öncesi/sonrası self-host export) | ✅ 91 tablo girdisi, 12.260 belge, tablo bazında sayılar birebir aynı; `users` ve `deviceEvents` içerik hash'i aynı. (Provadaki 12.144'ten farkı prova smoke girişleri: authRefreshTokens/authSessions/users.) |
| Konteynerden **izinli** | gateway `:8088` 200 · site JWKS 200 · relay 404 (bağlandı) · api.resend.com 200 · smtp.gmail.com:587 TCP bağlandı · DNS çözümleme ok |
| Konteynerden **engelli** | `https://example.com`, `http://example.com`, `https://api.openai.com`, host `:22`, `:8090`, `:8080`, köprü ağ geçidi `172.30.210.1:8088`, pafta-gotenberg `172.17.0.2:3000`, `1.1.1.1:53` → hepsi bağlantı yok (`000`, zaman aşımı) |
| smtp.gmail.com:465 | ❌ bağlanmıyor; sebep kural değil, **Hetzner'in giden 465 engeli** (host'tan `nc` da zaman aşımı) |
| `certbot renew --dry-run --cert-name api.ngsplus.app` | ✅ success |

## 3. Diğer servislerin sağlığı (önce 14:37 / sonra 14:50)

`/opt/ngs-convex/health-snapshot.sh` (kopya: [infra/convex-selfhost/health-snapshot.sh](../../infra/convex-selfhost/health-snapshot.sh)), çıktılar `/opt/ngs-convex/ops-log/health-{before,after}-20261128.txt`. İki çıktının diff'i (ngs-convex ve yük satırları hariç) **boş**.

| Servis | Önce | Sonra |
|---|---|---|
| nginx | active, 23 Kasım 01:10'dan beri | aynı (yalnız `reload`, restart yok) |
| DeviceGatewayService / Guard, ngs-hik-event-bridge, ngs-hik-relay | active, 15 Kasım'dan beri, restart 0 | aynı |
| pafta-api / pafta-seo-worker | active | aynı başlangıç zamanı |
| pafta-gotenberg | Up 2 ay | Up 2 ay |
| HTTP yoklamaları | openclaw 200 · gotenberg 200 · gateway 200 · card-relay 404 · relay 404 · api.pafta.app 401 · sslip 404 · convex 200 | birebir aynı |
| Dinleyen portlar | — | aynı liste (yeni port yok; 80/443 zaten nginx'te) |
| RAM kullanılan / kullanılabilir | 6.593 / 9.020 MB | 6.817 / 8.796 MB |

## 4. Bulunan sorunlar

1. **Origin değişince fonksiyonlar yeniden push edilmeli.** `convex/auth.config.ts` `domain: process.env.CONVEX_SITE_URL` değerini **push anında** okuyor. Yalnız env değişince backend yeni JWT'leri reddetti ("No auth provider found matching the given token"). Aynı kod yeniden push edilince giriş çalıştı. Gerçek geçiş sırası: önce origin, sonra deploy.
2. **Hetzner giden 465'i engelliyor.** Proje SMTP ayarları 465 (SMTPS) kullanıyorsa gerçek geçişte gönderim çalışmaz. Çözüm: 587 + STARTTLS ya da Resend API. İkinci yol Hetzner'den engel kaldırma talebi.
3. **nginx 1.24 `http2 on;` tanımıyor.** İlk tam vhost `nginx -t`'den geçmedi. Reload yapılmadı, canlı nginx etkilenmedi. Ama hatalı dosya ~2 dk diskte kaldı ve düzeltildi. O sürede başka bir süreç reload etseydi reload başarısız olurdu; çalışan nginx yine de eski config'le devam ederdi.
4. **Resend Cloudflare arkasında** (`104.20.29.242`, `172.66.165.132`). IP izni aynı Cloudflare IP'sini paylaşan başka sitelere de 443 açar. Tam domain kısıtı için ileride bir egress proxy gerekir (Convex'in `fetch` proxy desteği ya da squid allowlist).
5. **Dashboard konteyneri (`edge` ağı) hâlâ sınırsız çıkışlı.** Kapsam yalnız backend'di. Dashboard dışarı açık değil, yalnız loopback.

## 5. Geri alma

Sırayla; her biri bağımsız:

```sh
# Önce compose, sonra çıkış kuralı: tersi sırada backend bir süre internete açık kalır.
# 1) Compose'u eski haline döndür (origin 127.0.0.1, egress ağı yok) ve yalnız backend'i yeniden oluştur
cd /opt/ngs-convex && cp backup/docker-compose.yml.20261128-before-nginx docker-compose.yml \
  && docker compose up -d backend && docker network rm ngs-convex_egress
#    (auth issuer'ı geri almak için fonksiyonlar 127.0.0.1 origin'iyle yeniden push edilmeli)
# 2) Çıkış kuralını kaldır
systemctl disable --now ngs-convex-egress.timer ngs-convex-egress.service
/usr/local/sbin/ngs-convex-egress.sh remove
rm /etc/systemd/system/ngs-convex-egress.{service,timer} /usr/local/sbin/ngs-convex-egress.sh && systemctl daemon-reload
# 3) nginx vhost
rm /etc/nginx/sites-enabled/ngs-convex /etc/nginx/sites-available/ngs-convex && nginx -t && systemctl reload nginx
#    tam geri dönüş: tar -xzf /root/nginx-backup-20261128T113822Z.tgz -C /etc   (sonra nginx -t + reload)
# 4) Sertifikalar
certbot delete --cert-name api.ngsplus.app; certbot delete --cert-name site.ngsplus.app
# 5) DNS: Netlify → ngsplus.app → api ve site A kayıtlarını sil
#    (kayıt id'leri: api 6b0abcf681c4d58b86d290a6, site 6b0abcf9bf07cbc4eb0783dc)
#    npx netlify-cli api deleteDnsRecord --data '{"zone_id":"681a8acff01ff4a59d179d21","dns_record_id":"<id>"}'
```

iptables'ın tam önceki hali: `/opt/ngs-convex/ops-log/iptables-before-20261128.rules` (0600).

## 6. Açık kalanlar (her biri ayrı onay)

- Geçiş öncesi: index adı (64 karakter) + PDKS render hatası main'de düzeltilsin (prova raporu Sorun 1-2).
- SMTP portu kararı (587 ya da Resend), gerekirse Hetzner'den 465 engelinin kaldırılması.
- Gerçek env aktarımı (`HIK_GATEWAY_HOST` → `http://157.90.114.86:8088` bu kuralla çalışır; `HIK_RELAY_URL` relay.ngsplus.app → :443 izinli), ardından fonksiyonların yeniden push'u.
- Web yayını (`VITE_CONVEX_URL=https://api.ngsplus.app`, `VITE_CONVEX_SITE_URL=https://site.ngsplus.app`), mobil binary, köprülerin `CONVEX_SITE_URL`'si, cihaz `httpHosts` değerleri.
- Sunucu dışı yedek + izleme/alarm (sertifika bitişi dahil; certbot.timer aktif, dry-run başarılı).
- Prova smoke hesabının şifresi bu işte bir kez worker oturumunun terminal çıktısına düştü (dosya `sed` ile maskelenemedi). Hesap yalnız prova DB'sinde ve `@example.invalid`. Geçişte bu hesap silinsin ya da şifresi değiştirilsin.
