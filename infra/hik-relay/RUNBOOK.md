# Hik relay kurulum ve işletim

Bu checklist operatör içindir; bu değişiklik sunucuya kurulum yapmaz. Relay yalnız
uyandırma olayı taşır, personel/kart/şifre taşımaz. Sözleşme v1 geçerlidir:
`HIK_RELAY_SECRET`, `HIK_RELAY_URL`, HMAC-SHA256 ve 15 dakika emniyet poll'u.

> Sunucu paylaşımlıdır: mevcut nginx sitelerine, `ngs-card-reader` :8090'a ve
> MQTT yapılandırmasına dokunmayın. nginx'i yeniden başlatmak yerine doğrulayıp
> reload edin. Bu servis için 8791 portunu internete açmayın.

## 0. Dağıtım sırası ve kabul edilen riskler

- [ ] Sıra: **önce Convex deploy + relay**, sonra Windows köprüsü 1.1.0. Yeni köprü eski Convex'le
  (`nextPollSeconds`/`wake` yok) yalnız 900 sn poll eder → Kapıyı Aç gibi komutlar 15 dk gecikir.
- [ ] `HIK_RELAY_URL`/`HIK_RELAY_SECRET` yoksa (`wake:null`) köprü tasarım gereği yalnız 900 sn poll eder;
  backoff'taki retry'lar `nextDueInSeconds` ipucuyla yine 5-60 sn'de denenir.
- [ ] Bilet `HMAC(secret, "stream."+bridgeId)` deterministik ve ömürsüzdür: silinen köprünün bileti secret
  rotasyonuna kadar geçerli kalır; yalnız "uyan" sinyalini dinletir, veri sızdırmaz (kabul edildi).
- [ ] Faz 0 teşhis logu (`convex/http.ts` roster route'u, `TODO(Faz 0)`) köprü makinesi bulununca kaldırılır.

## 1. Ön kontrol ve DNS

- [ ] Kullanıcıdan kurulum/DNS onayı alın; mevcut nginx yapılandırmasını yedekleyin.
- [ ] `relay.<alan>` için DNS A kaydını `157.90.114.86` adresine yönlendirin.
  Örnek dosyalardaki `relay.ngsplus.app` değerlerini gerçek alan adıyla değiştirin;
  aşağıdaki `RELAY_DOMAIN` değerini de aynı yapın.
- [ ] Sunucuda `node --version` ile Node >=18 ve `/usr/bin/node` yolunu doğrulayın.
  Node yoksa dağıtımınızın güvenilir paket kaynağından güncel desteklenen LTS
  sürümünü kurun; ör. `sudo apt-get update && sudo apt-get install nodejs` ve
  sürümü tekrar kontrol edin (eski dağıtım paketi yeterli olmayabilir).
- [ ] Gerekirse `sudo apt-get install nginx certbot python3-certbot-nginx openssl`
  çalıştırın; mevcut paketleri/kaynakları değiştirmeden önce inceleyin.
- [ ] Yerel doğrulama: `node --test infra/hik-relay/server.nodetest.mjs` ve
  `node --check infra/hik-relay/server.mjs`.

## 2. Dosyalar ve gizli anahtar

- [ ] Repo'daki `server.mjs` dosyasını onaylı aktarım yöntemiyle sunucuya kopyalayın,
  ardından sunucuda `/opt/ngs-hik-relay/server.mjs` konumuna root sahibi ve 0644
  izinleriyle yerleştirin. Dizin 0755 olmalı; DynamicUser bu dosyayı okuyabilmeli.
  `ngs-hik-relay.service`, `nginx-hik-relay.conf`, `relay.env.example` dosyalarını da
  aktarın. Örnek (aktarılmış dosyaların bulunduğu dizinde):

```bash
sudo install -d -m 0755 /opt/ngs-hik-relay
sudo install -m 0644 server.mjs /opt/ngs-hik-relay/server.mjs
sudo install -m 0644 ngs-hik-relay.service /etc/systemd/system/ngs-hik-relay.service
sudo install -m 0600 relay.env.example /etc/ngs-hik-relay.env
```

- [ ] `openssl rand -hex 32` ile 32 rastgele bayt üretin. Değeri yalnız güvenli
  yönetim oturumunda `/etc/ngs-hik-relay.env` içindeki `HIK_RELAY_SECRET=` alanına
  girin; dosya root:root 0600 kalsın. `PORT=8791`, `HOST=127.0.0.1` kullanın.
  Gerçek değeri repo'ya, bilete, sohbet raporuna veya komut geçmişine yazmayın.
- [ ] Doğru Convex deployment'ını seçtiğinizi doğrulayın. Yerel yetkili proje
  terminalinde Bash kullanarak aynı secret'ı gizli girişle alın ve değişkenleri ayarlayın:

```bash
RELAY_DOMAIN='relay.ngsplus.app'
read -r -s -p 'Relay secret: ' HIK_RELAY_SECRET; echo
npx convex env set HIK_RELAY_URL "https://$RELAY_DOMAIN"
npx convex env set HIK_RELAY_SECRET "$HIK_RELAY_SECRET"
unset HIK_RELAY_SECRET
```

URL sonunda `/` olmaz. Bu komutlar operatör adımıdır; repo doğrulamasında çalıştırılmaz.
Secret CLI argümanı olarak kısa süre süreç listesinde görünebilir; güvenilir yönetim
makinesinde çalıştırın ve terminal kaydını paylaşmayın.

## 3. Ağ, nginx ve TLS

- [ ] UFW etkinse mevcut SSH izinlerini koruyarak `sudo ufw allow 80/tcp` ve
  `sudo ufw allow 443/tcp` çalıştırın. 8090/MQTT kurallarını değiştirmeyin.
- [ ] `sudo install -d -m 0755 /var/www/letsencrypt` çalıştırın.
- [ ] **İlk sertifika için** nginx örneğini `/etc/nginx/sites-available/ngs-hik-relay`
  konumuna alın; henüz olmayan sertifikalara referans vermemek için 443 bloğunu
  geçici olarak dışarıda bırakın. `log_format` ve 80 bloğu kalsın. Sadece bu
  yeni site için `sites-enabled` symlink'i oluşturun:

```bash
sudo ln -s /etc/nginx/sites-available/ngs-hik-relay /etc/nginx/sites-enabled/ngs-hik-relay
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d "$RELAY_DOMAIN"
```

- [ ] Sertifika alındıktan sonra nihai örneğin 443 bloğunu, gerçek alan adı ve
  certbot'un ürettiği sertifika yollarıyla etkinleştirin. Certbot'un eklediği
  aynı alan adına ait yinelenen 443 bloklarını birleştirin; diğer siteleri koruyun.
  `sudo nginx -t && sudo systemctl reload nginx` çalıştırın.
- [ ] `log_format` bir `http` bağlamı direktifidir; örnek dosyayı `server` içine
  include etmeyin. `$uri` query içermez; `$request`, `$request_uri`, referer veya
  User-Agent alanlarını bu log formatına eklemeyin. Üst proxy/CDN kullanılıyorsa
  orada da query loglamasını kapatın. nginx hata logu (`/var/log/nginx/hik-relay.error.log`,
  `warn`) istek satırını/bileti içerebilir; dosya yalnız root okunur, paylaşmayın. Servis
  hatalarını `journalctl -u ngs-hik-relay` ile izleyin. `limit_req_zone`/`limit_conn_zone`
  satırları da `http` bağlamındadır (stream: IP başına 10 istek/dk, 10 eşzamanlı bağlantı).
- [ ] `sudo certbot renew --dry-run` ile yenileme yolunu doğrulayın.

## 4. Servisi açma ve uçtan uca test

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ngs-hik-relay
sudo systemctl status ngs-hik-relay --no-pager
curl --fail "https://$RELAY_DOMAIN/hik-bridge/health"
```

- [ ] Boşta `{"ok":true,"bridges":0,"connections":0}` bekleyin. Servis tek süreç
  çalışır; bellek içi bağlantı/rate-limit haritası restart'ta sıfırlanır. Birden
  fazla instance/load-balancer dağıtımı bu yapılandırmanın dışındadır.
- [ ] Test bridge kimliğini belirleyin (gerçek `hikBridges._id` veya yerel testte
  `test-bridge`). Aşağıdaki komutları güvenilir Bash oturumunda çalıştırın;
  `set -x` kapalı olsun. Secret gizli girişten, bileti ortamdan üretin:

```bash
read -r -s -p 'Relay secret: ' HIK_RELAY_SECRET; echo
export HIK_RELAY_SECRET
export BRIDGE_ID='test-bridge'
TICKET=$(node -e 'process.stdout.write(require("node:crypto").createHmac("sha256",process.env.HIK_RELAY_SECRET).update("stream."+process.env.BRIDGE_ID).digest("hex"))')
printf 'url = "https://%s/hik-bridge/stream?bridge=%s&ticket=%s"\n' "$RELAY_DOMAIN" "$BRIDGE_ID" "$TICKET" | curl --config - --no-buffer -H 'Accept: text/event-stream'
```

`retry: 10000`, `event: ready`, ardından 25 saniyede bir `: ping` bekleyin.
URL'yi config stdin'inden verme, bileti curl süreç argümanlarından uzak tutar.

- [ ] İkinci güvenilir Bash oturumunda aynı `RELAY_DOMAIN`, `BRIDGE_ID` ve secret'ı
  tanımlayın. Ham gövde ile imzalanan gövde birebir aynı olmalı:

```bash
export BODY=$(node -e 'process.stdout.write(JSON.stringify({bridgeId:process.env.BRIDGE_ID}))')
export TS=$(node -e 'process.stdout.write(String(Date.now()))')
SIGNATURE=$(node -e 'process.stdout.write(require("node:crypto").createHmac("sha256",process.env.HIK_RELAY_SECRET).update(process.env.TS+"."+process.env.BODY).digest("hex"))')
printf 'header = "X-Ngs-Signature: %s"\n' "$SIGNATURE" | curl --config - --fail-with-body -H 'Content-Type: application/json' -H "X-Ngs-Ts: $TS" --data-binary "$BODY" "https://$RELAY_DOMAIN/hik-bridge/wake"
unset HIK_RELAY_SECRET SIGNATURE TS BODY
```

Yanıt `{"ok":true,"delivered":1}` ve ilk oturumda `event: wake` beklenir; bağlı
istemci yoksa `delivered:0` da başarıdır. İlk oturumu Ctrl+C ile kapatıp
`unset HIK_RELAY_SECRET TICKET` çalıştırın. `curl -v`/trace çıktısı paylaşmayın.
- [ ] Gerçek köprü yeni roster'dan stream bilgisini aldıktan sonra health sayısı
  artmalı; uygulamadaki kart ekleme/silme ve Kapıyı Aç işlemi köprüyü hemen
  uyandırmalı. Bu son adım Convex ve Windows parçalarının da yayında olmasını gerektirir.

## 5. İzleme, rotasyon ve geri alma

- [ ] `sudo journalctl -u ngs-hik-relay -f` ile tek satır JSON olaylarını izleyin.
  Secret/ticket/imza loglanmaz; nginx erişim logu yalnız query'siz yolu içerir.
  401 için saat senkronizasyonu ve aynı secret'ı, 429 için toplu wake/debounce'u
  kontrol edin. `delivered:0` çevrimdışı köprüde olağandır.
- [ ] Rotasyon: yeni `openssl rand -hex 32` değerini 0600 env dosyasında ve doğru
  Convex deployment'ında aynı anda güncelleyin; `sudo systemctl restart ngs-hik-relay`
  çalıştırın. Önceki biletler geçersizleşir, açık stream'ler restart'ta kapanır;
  köprüler en geç sonraki 15 dakika roster poll'unda yeni bilet alır. Geçişte
  kısa süreli 401 beklenir; secret'ı geçişten sonra eski kayıtlardan temizleyin.
- [ ] Geri alma: `sudo systemctl disable --now ngs-hik-relay` çalıştırın.
  Köprüler 15 dakika emniyet poll'una düşer. İstenirse doğru Convex deployment'ında
  `npx convex env remove HIK_RELAY_URL` ile roster'daki wake özelliğini kapatın.
  Yalnız relay sitesinin symlink'ini kaldırıp `nginx -t` ardından reload edin;
  diğer sitelere/MQTT'ye ve paylaşılan 80/443 firewall kurallarına dokunmayın.
