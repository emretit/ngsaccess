**Mümkün mü?** Evet; mevcut Convex fonksiyonları, Auth, HTTP/Node actions ve components korunarak self-host'a taşınabilir; sürüm uyumu prova ister.
**Kaç gün?** 3–5 geliştirici/operasyon günü + en az 24 saat izleme; erişim, alan adı ve mobil dağıtım hazırsa.
**Aylık maliyet?** Mevcut köprü faturası hariç en düşük güvenli başlangıç yaklaşık €17–19; önerilen büyüme seçeneği €26–28, KDV hariç ve CX bulunabilirliğine bağlı.
**En büyük 3 risk:** kesim/geri dönüşte olay kaybı veya çift komut; Auth/dosya URL uyumsuzluğu; tek sunucu ve Emre'ye bağlı gece işletimi.
**4 Aralık'a yetişir mi?** Koşullu evet: 30 Kasım'da prova, 1 Aralık'ta kesim, 2–3 Aralık'ta izleme; prova/geri yükleme veya mobil dağıtım gecikirse tarih garanti edilemez.

# NGS Access self-host geçiş planı — 28 Kasım 2026

**Emre kararı (2026-11-28): Convex korunacak, kendi sunucumuzda çalışacak; müşteri açılışı ertelenebilir. Önceki takvim bir hedef örneğidir, kesim taahhüdü değildir.**

Bu belge uygulama emri değildir. Yalnız yerel kaynak kodu, proje belgeleri ve aşağıdaki resmî web kaynakları incelendi. SSH, sunucu bağlantısı, Convex CLI, deploy, migration, canlı veri/cihaz isteği çalıştırılmadı. Yalnız bu rapor yazıldı. Mevcut `AddShiftDialog.tsx` değişikliği ve `FREE_PLAN_2026-11-28.md` dosyası bu çalışmadan önce vardı.

Canlı kabul edilen kaynak, Emre'nin bildirdiği **dev:notable-tern-4 / Free**. Adında dev olması test verisi olduğu anlamına gelmiyor; yanlışlıkla `--prod` kullanılmamalı. Canlı deployment'ın gerçekten hangi commit ve env ile çalıştığı bu incelemede doğrulanmadı. Ana makinenin `.env.local` içinden yalnız değişken isimleri okundu, değerler rapora alınmadı.

## 1. Mimari kararı ve kapasite

Öneri: **mevcut Hetzner gateway/olay köprüsü yerinde kalsın; Convex ayrı Hetzner VM üzerinde çalışsın.** Aynı bölge/private network tercih edilir. Gateway'in internetten ISUP kabul eden servisiyle kişisel verilerin tamamını tutan backend'in ayrılması, gateway restart'ının DB'yi etkilemesini ve rapor/backfill sırasında gateway'in RAM/CPU yarışına girmesini önler. Ayrı VM yüksek erişilebilirlik sağlamaz; gateway ve Convex hâlâ ayrı tek hata noktalarıdır.

```text
Hik cihazlar → mevcut Hetzner Hik Gateway → event bridge + kalıcı spool
                                               ↓ HTTPS /card-reader
Web / mobil → api.<alan>:443 → reverse proxy → Convex :3210
Köprü / Auth / ek dosya → site.<alan>:443 → proxy → Convex :3211
Emre → VPN / erişim kısıtlı dashboard → :6791
Convex Node actions → private ağ / izinli gateway API → Hik cihaz
Convex kalıcı volume → SQLite + dosyalar → şifreli haricî yedek
```

`api.<alan>` istemci query/mutation/WebSocket API'si; `site.<alan>` HTTP actions ve Auth issuer alanıdır. `SITE_URL` ise web uygulamasının adresidir; bu üç isim birbirine karıştırılmamalı. Web statik hosting'i şimdilik aynı kalabilir; backend container'ı React uygulamasını sunmaz. Alan adları örnektir, kullanılacak alan Emre tarafından seçilmeli.

| Seçim | Başlangıç / büyüme kararı | Gerekçe ve sınır |
|---|---|---|
| En küçük güvenli başlangıç | Ayrı **4 vCPU / 8 GB RAM / 80 GB NVMe**, x86_64, CX33 sınıfı | 500 kişi / 10 Hik için aday; donanım üzerinde test edilmedi. 2 GB/4 GB ile üretime başlamayı önermiyorum; V8/Node, import ve backup pikleri var. |
| Önerilen hedef | Ayrı **8 vCPU / 16 GB / 160 GB**, CX43 sınıfı | 20 firma büyümesine alan bırakır; kapasite garantisi değildir. Eski yük raporunda 20 firma = firma başına 200 kişi, toplam 4.000 kişi / 200 cihaz; 20×500 kişi daha büyük ve ayrıca test edilmeli. |
| Gateway ile paylaşma | Yalnız en az 16 GB, yeterli boş disk ve ölçülmüş düşük yük varsa geçici seçenek | Birlikte OOM/disk dolması olay alma + kayıt yazmayı aynı anda durdurur. Gateway eski dokümanda tek başına 4 GB minimum, 8 GB öneri taşıyor. Gerçek makine özellikleri bilinmiyor. |
| Veritabanı | İlk canlıda **SQLite**, kalıcı yerel volume | Resmî varsayılan, az servis ve düşük RAM/işletim maliyeti. Tek backend ile başla; SQLite dosyasını ağ diski/NFS üzerinde paylaşma, ikinci aktif backend açma. |
| Postgres | İlk kesime ekleme; ölçülmüş ihtiyaç veya yönetilen DB/HA kararı sonrası | Convex Postgres destekler; fakat aynı VM'de Postgres HA sağlamaz ve işletim/RAM maliyeti ekler. Backend'e yakın olmalı; belgede v17 test edilmiş. Geçiş snapshot export/import gerektirir. |
| Dosyalar | İlk gün kalıcı volume; haricî şifreli yedek | 500×150 KiB tek fotoğraf ~77 MB; yüz görselleri/ekler zamanla büyür. S3'ü ilk gün zorunlu tutmamak kesim riskini düşürür. |
| Nesne deposu | Başlangıçta yalnız yedek hedefi; ileride canlı dosyalar için S3 uyumlu depo | Convex'te exports, snapshot imports, modules, files, search için ayrı bucket ayarları var. Yerel→S3 değişimi yalnız env değişikliği değildir, snapshot aktarımı ister. |

Convex resmî README'sinde bu uygulama için sayısal minimum CPU/RAM verilmemiş; yukarıdaki boyutlar mühendislik tahminidir. Cloud'un belge I/O kotası veya fiyatlanan indeks çarpanı **fiziksel disk, IOPS veya CPU ölçümü değildir**. FREE_PLAN'daki ~80 GB/ay belge I/O'sunu 80 GB disk büyümesi saymıyoruz. Kart ham belge büyümesi ~35,5 MB/ay, kısa belgeyle ~24,1 MB/ay; indeksler, geçmiş sürümler, dosyalar ve loglar ayrıca ölçülecek.

Reverse proxy Caddy/nginx: TLS otomatik yenilensin, WebSocket upgrade ve uzun bağlantı zaman aşımı ayarlansın; :3210/:3211/:6791 dışarı doğrudan açılmasın. Resmî compose portları tüm arayüzlere bind edebiliyor; kurulum kopyasında loopback bind + firewall yapılmalı. Dashboard yalnız VPN/IP kısıtıyla erişilsin; `NEXT_PUBLIC_ADMIN_KEY` ile anahtar tarayıcı paketine gömülmesin. Gateway'in mevcut 80/443/8088/8090 portlarıyla çakışma kontrolü paylaşımda zorunlu. Eski ISUP belgesindeki 7660 ile yeni gateway belgesindeki 7661/7663 farklılıkları nedeniyle cihaz portları bu geçişte değiştirilmemeli.

## 2. Uyum: resmî kaynakların söylediği ve provada doğrulanacaklar

| Başlık | Sonuç |
|---|---|
| Query, mutation, subscriptions, HTTP actions | Self-host backend aynı temel çalışma modelini sunuyor. API 3210, HTTP actions 3211. Cloud'un sabit alan adlarına bağımlı istemci ayarları değişecek. |
| Node actions | Resmî Docker imajında Node/npm var. Projedeki gateway, e-posta ve OpenAI actions çalışabilir; native modül/Node sürümü, SMTP/HTTPS çıkışı ve timeout provası gerekir. Gateway bağlantısı ayrıca izinli olmalı. |
| Cron ve scheduler | Mevcut `convex/crons.ts` korunabilir. Kesimde iki deployment aynı anda cihaz komutu, mail veya retention çalıştırmamalı. Bekleyen scheduled job'ların ZIP ile aynen taşındığı varsayılmayacak; sayım ve güvenli yeniden kurma provası gerekir. |
| Convex Auth | Destekleniyor; **Auth kurulum CLI'si self-host desteklemiyor**, elle kurulum gerekir. Bu, bütün Convex CLI'nin desteklenmediği anlamına gelmez. Şifre hash'leri/auth tabloları taşınır; yeni issuer nedeniyle mevcut tarayıcı token'ları için yeniden giriş planlanır. |
| `convex-helpers` | İstemci/sunucu yardımcı kod kütüphanesi; projede trigger/custom function wrapper'ları kullanılıyor. Ayrı Cloud servisi değil. Yeni backend+SDK sürümünde typecheck ve trigger davranışı provada test edilmeli. |
| migrations / rate-limiter | `convex/convex.config.ts` iki component'i kaydediyor. Components temel backend özelliği olduğundan self-host ile uyumlu olması beklenir; bu paket sürümleri için özel self-host sertifikası bulunmadı. Tablolar/checkpoint'ler export/import sonrası dashboard'da kontrol edilmeli; migration geçmişi kayboldu diye tüm migration'ları yeniden çalıştırmak yasaklanmalı. |
| Cloud-only servis | Kodda Convex AI Gateway kullanılmıyor; `OPENAI_API_KEY` ile doğrudan sağlayıcı çağrısı var. Cloud takım/proje yönetimi ve otomatik Cloud işletimi self-host'a taşınmaz. Free aylık kotaları da self-host faturalaması olarak uygulanmaz; işlem başı kaynak limitlerinin kaybolduğu varsayılmamalı. |

Paket beyanları `package.json`: Convex `^1.39.1`, Auth `^0.0.96`, migrations `^0.3.8`, rate-limiter `^0.3.2`, convex-helpers `^0.1.114`; gerçek kurulumda lockfile sabitlenmeli. Resmî README en yeni CLI der; canlıdan hemen önce körlemesine `npm install ...@latest` yapılmaz. Kopyada lockfile sürümüyle başla, gerekirse backend/SDK uyum yükseltmesini ayrı test ederek sabitle.

## 3. Taşıma checklist'i

**Aşağıdaki komutlar çalıştırılmadı.** Sonraki uygulama görevinde, Emre yetkisiyle, izole geçiş checkout'unda uygulanacak örneklerdir. Ana çalışma dizininde Convex CLI kullanılmayacak. `cloud.env` yalnız Cloud hedefini (`CONVEX_DEPLOYMENT`) ve yetkisini; `self.env` yalnız `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY` içersin; iki hedef aynı dosyaya konmasın. Shell'de miras kalmış deploy/self-host değişkenleri de temizlenip hedef elle kontrol edilmeli. Secret dosyalar repo dışında, 0600 ve şifreli depoda tutulmalı.

| Adım | Kim / yapılacak işlem ve komut | Geri dönüş | Emre onayı |
|---|---|---|---|
| 1. Envanter ve takvim | Emre erişim, VM özellikleri, DNS, gateway çalışma şeklini verir; operatör sonradan `lscpu`, `free -h`, `df -h`, `docker stats --no-stream` ile ölçer. 30–60 dk kesim penceresi belirlenir. | İşlem yok, mevcut kurulum sürer. | **Evet:** erişim, bütçe, alan adı. |
| 2. Ayrı VM hazırlama | Operatör desteklenen x86_64 Linux, Docker Engine + Compose plugin, NTP, firewall, kalıcı disk, sınırlı yönetim erişimi hazırlar. Kontrol: `docker version`, `docker compose version`, `timedatectl`. | Yeni VM kapatılır; mevcut gateway etkilenmez. | **Evet:** ücretli kaynak açma. |
| 3. Convex ve proxy | Operatör resmî compose'u inceler, backend/dashboard image digest'ini sabitler; `docker compose config`, `docker compose up -d`, `docker compose exec backend ./generate_admin_key.sh`. Anahtar terminal kaydına alınmadan kasaya aktarılır. TLS/DNS eklenir. | Yeni servisi durdur; volume'u silme. | Onaylanmış kurulum kapsamında; paylaşım/port değişimi ayrıca **evet**. |
| 4. Env/secret kurma | Emre güvenli kaynak sağlar; operatör `npx convex env set --env-file /secure/self.env --from-file /secure/backend-secrets.env` kullanır; sürümün `--help` söz dizimi kopyada kontrol edilir. Alttaki isim envanteri uygulanır. | Yeni env düzeltilir; Cloud env'e dokunulmaz. | **Evet:** secret erişimi/aktarımı; değerler rapora veya chate yazılmaz. |
| 5. Şema/fonksiyon/component deploy | Geliştirici aynı commit ve lockfile'la `npm ci`, `npx convex deploy --env-file /secure/self.env` çalıştırır. Dış trafik kapalı, deployment pause, gateway/mail çıkışları kapalıdır. | Boş hedef yeniden hazırlanır; Cloud kodu değişmez. | İzole hedef deploy'u için **evet**, bu rapor yetki vermiyor. |
| 6. Prova export/import | Yetkili operatör `npx convex export --env-file /secure/cloud.env --deployment-name notable-tern-4 --include-file-storage --path /secure/rehearsal.zip`; sonra yalnız boş/izole hedefte `npx convex import --env-file /secure/self.env /secure/rehearsal.zip`. | Hedef volume saklanır/yeniden hazırlanır; Cloud'a import yapılmaz. | **Evet:** canlı kişisel verinin kopyalanması. |
| 7. Prova kapısı | Geliştirici snapshot tablo/component sayımları, `_id` ilişkileri, Auth giriş/yenileme, ek/fotoğraf, PDKS ve rate-limit testlerini çalıştırır. Yeni backend kesinlikle gerçek cihazlara/mail alıcısına çıkmaz. Snapshot, env ve kodla **ikinci boş hedefte restore** denenir. | Kesim iptal edilir, raporlanan sorunlar düzeltilir. | Prova yetkisi kapsamında; başarısızsa canlı geçiş **yok**. |
| 8. Olay güvenliği | Operatör bridge spool dizininin kalıcı/yazılabilir olduğunu ve restart sonrası replay'i doğrular; cihaz başına buffer/AcsEvent erişimini test eder. Yalnız test cihazıyla kontrollü 5–10 dk backend kesintisi ve seri/timestamp mutabakatı yapılır. | Bridge eski URL'yle devam eder, spool korunur. | **Evet:** cihaz testi ve kontrollü kesinti. |
| 9. Yazıları dondurma | Emre bakım penceresini açar; web/mobil yazı işlemleri durur. Operatör Cloud Dashboard → Settings → Pause deployment ile fonksiyon/cron'ları durdurur; önceden başlamış actions'ın bittiğini doğrular. Bridge çalışır, başarısız POST'lar diskte birikir. | Export öncesinde Cloud resume + bakım iptali; kuyruk eski hedefe boşalır. | **Evet:** canlı kesim başlangıcı. |
| 10. Son snapshot | Adım 6 export komutu bu kez `/secure/final.zip` ile, tüm yazılar durduktan sonra çalışır; süre, snapshot zamanı ve `sha256sum /secure/final.zip` kaydedilir. Pause durumunda export/CLI erişimi prova edilmiş olmalı; çalışmıyorsa kesime girilmez, doğrulanmış farklı dondurma yöntemi hazırlanır. | Cloud resume, bridge URL değiştirilmez. | Kesim onayı kapsamında. |
| 11. Son import ve dosyalar | Operatör hedef paused iken `npx convex import --env-file /secure/self.env --replace-all /secure/final.zip` çalıştırır; **yalnız yeni hedef**. Tablo/component sayımları ve tüm dosya manifesti kontrol edilir; eski absolute storage URL'leri storage ID'den yeniden üretilir. | Hedefi servis dışı bırak; son snapshot ve Cloud korunur. | **Evet:** hedef overwrite ve gerekiyorsa onaylı URL düzeltme mutation'ı. |
| 12. URL kesimi | Geliştirici Vite env ile web'i yeniden build eder: `VITE_CONVEX_URL=https://api.<alan> npm run build`; HTTP site env de yeni adrese ayarlanır. Mobil `CONVEX_URL` ve `CONVEX_ALLOWED_HOST` ile yeni binary üretir; bridge `CONVEX_SITE_URL`, Windows config, nginx upstream ve gerekliyse forwarding URL değiştirilir. Operatör hedefi resume eder, yalnız yeni backend'in gateway çıkışını açar. | İlk yeni yazıdan önce eski build/config'e dönülebilir; sonrasında aşağıdaki veri uzlaştırması zorunlu. | **Evet:** yayın, mobil dağıtım ve trafik yönü. |
| 13. Kuyruk + backfill | Operatör spool'un boşaldığını, `post_pending/drop/queue_error` olmadığını izler. Onaylı Hik backfill UI/işleviyle kesim öncesi 5 dk'dan sonraya kadar örtüşen aralık taranır; 10 cihazın olay/serial listesi karşılaştırılır. | Sorunda yeni yazıları dondur, kuyrukları sakla, kör URL geri dönüşü yapma. | Onaylı kesim kapsamında; cihaz okuma/backfill ayrıca uygulama yetkisi ister. |
| 14. Kabul ve izleme | Emre/geliştirici aşağıdaki smoke listesini bitirir; Cloud paused ve silinmeden tutulur. 24–48 saat takip sonrası geçiş kabul edilir. | Başarısızsa geri dönüş prosedürü. | **Evet:** canlı kabul; Cloud silme daha sonra ayrı karar. |

### Env/secret envanteri — yalnız isimler

- Container/CLI: `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, `NEXT_PUBLIC_DEPLOYMENT_URL`, `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `INSTANCE_NAME`, `INSTANCE_SECRET`; yedekten aynen korunması gereken instance kimlikleri. `CONVEX_SITE_URL` backend'in HTTP origin'inden doğru üretilmeli; Cloud değeri elle kopyalanmamalı.
- Auth ve uygulama: `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `ADMIN_SETUP_SECRET`. JWT anahtar çiftini güvenle aktar, yeni issuer'ı doğrula; yalnız anahtarı korumak eski token'ın yeni issuer'da geçerli olmasını garanti etmez. Auth tabloları/hesap hash'leri korunmalı.
- Kritik şifreleme: **`FINGERPRINT_TEMPLATE_KEY`, `MAIL_SECRET_KEY`**. Bunlar aynı veriyle aynı kalmazsa import edilmiş biyometrik/SMTP verisi çözülemeyebilir; kasada ayrıca yedeklenmeli.
- Mail/entegrasyon: `RESEND_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `NOTIFICATION_EMAIL`, `OPENAI_API_KEY`; projeye özel şifreli SMTP ayarları DB içindedir, yalnız env taşıma yeterli değildir.
- Cihaz tarafı: `HIK_GATEWAY_HOST`, `HIK_GATEWAY_USER`, `HIK_GATEWAY_PASS`, `HIK_FORWARDING_URL`, `HIK_RELAY_URL`, `HIK_RELAY_SECRET`, `HIK_GATEWAY_DEBUG`, `CARD_READER_RELAY_SECRET`, `CARD_READER_ALLOW_UNAUTHENTICATED`, `IDE_BRIDGE_SECRET`, `MOBILE_IDE_ISOLATION_VERIFIED`; debug bayrakları ayrı değerlendirilir. `HIK_FORWARDING_URL` yeni `/card-reader` adresini kullanmalı.
- Bridge: `HIK_GATEWAY_URL`, `HIK_GATEWAY_USER`, `HIK_GATEWAY_PASS`, `CONVEX_SITE_URL`, `HIK_DEVICE_TOKENS`, `EVENT_QUEUE_DIR`, `MAX_EVENT_AGE_HOURS`, `HEARTBEAT_TIMEOUT_MS`, `EVENT_TIME_OFFSET`, `MAX_QUEUE`; IDE/MQTT kurulumu varsa mevcut broker kimlikleri korunur. Cihaz `apiToken` değerleri import edilen DB ile aynı kalmalı.
- Web/mobil/CI: `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `CONVEX_URL`, `CONVEX_ALLOWED_HOST`, `APP_ENV`, `MOBILE_CONVEX_URL`, `MOBILE_CONVEX_ALLOWED_HOST`. `VITE_*` içine admin key/secret konmaz.
- İleride Postgres: `POSTGRES_URL`, `DO_NOT_REQUIRE_SSL`; ikinci ayar yalnız uygun izole bağlantı için. S3: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT_URL`, `S3_STORAGE_EXPORTS_BUCKET`, `S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET`, `S3_STORAGE_MODULES_BUCKET`, `S3_STORAGE_FILES_BUCKET`, `S3_STORAGE_SEARCH_BUCKET`; sağlayıcı uyumu ayrıca denenir.

### Kesinti, buffer ve geri dönüş ayrıntısı

Hedef **30–60 dk yazma kesintisi**, tahmindir; gerçek export/import ve dosya hacmi bilinmiyor. Prova 30 dk sürerse bakım penceresine en az aynı süre + kontrol/geri dönüş payı konur. Web/mobil ekranlar bakım gösterir. Hik'in önceden cihaza verilmiş erişim haklarıyla çalışması beklenir; online karar isteyen ESP32 veya mobil kapı açmanın bakımda çalışacağı vaat edilmez.

Kodda dayanıklı spool **var**: `infra/hik-event-bridge/queue.mjs:4` fsync + atomik rename; `bridge.mjs:186` başarıdan sonra siler. `bridge.mjs:425` CLI başlatıldığında kalıcı dizin varsayılanını verir; programatik `createBridge` kullanımında `queueDir` yoksa spool yoktur. Çalışan sunucunun bu güncel sürümü kullandığı bilinmiyor. `maxQueue=1000` (`:149`) ve dolunca yeni olay düşürme (`:217`) var; `MAX_QUEUE` env ile ayarlanabilir (varsayılan 1000). 500 kişinin giriş/çıkış piki bu sınırı aşabilir. Kuyrukta status olayları da yer tüketir. 1.000 yeterlidir varsayımıyla kesim yapılmaz; doluluk alarmı, kısa pencere ve cihaz geri okuma zorunlu, kapasite disk/spool ölçümüne göre `MAX_QUEUE` ile ayarlanır.

Canlı bridge'in yaş filtresi varsayılan 24 saat; geçmişi yalnız streaming replay'e bırakmak hatalı. `gatewayBackfill.ts:356` ilk çalışmada 48 saat, sonraki çalışmada önceki ilerlemeden 5 dk overlap kullanıyor; cihaz seri numaraları sırasız gelebilir. Mevcut device+serial dedup korunmalı. Device buffer büyüklüğü/geriye dönük AcsEvent süresi model+firmware bazında teyit edilmeli. ESP32 nginx köprüsünde kalıcı spool yok; HTTP yeniden deneme/buffer cihazda ayrıca kanıtlanmadan onun için kayıpsız geçiş iddia edilemez.

**Geri dönüş iki farklı durumdur:**

1. Yeni backend henüz yazı kabul etmediyse eski web/mobil/bridge config'e dön, Cloud'u resume et ve spool'u Cloud'a akıt; son snapshot kaybı yoktur.
2. Yeni backend yazı kabul ettiyse önce bütün yazıları ve iki taraftaki cron/action'ları durdur. Yeni hedefin güncel tam export'unu al. Yeni kullanıcı, manuel PDKS, izin, dosya, kuyruk/komut sonucu ve cihaz olaylarının tamamını kapsayan snapshot'ı prova edilmiş biçimde Cloud'a geri import etmek gerekir; **Cloud overwrite Emre'nin açık onayını ister** ve Free kota/ZIP uyumu önceden doğrulanmalıdır. Yalnız kart backfill'i diğer iş yazılarını geri getirmez. Cloud geri import'u mümkün değilse veriyi koruyup self-host onarılır; eski Cloud'a kör yönlendirme yapılmaz. Device komutları ve gönderilmiş e-postalar DB restore ile geri alınmaz; tamamlanan komutlar yeniden çalıştırılmadan uzlaştırılır.

Cloud sabit `.convex.cloud/.site` alan adlarının DNS'i bize ait değil; onları yeni VM'e çeviremeyiz. Güncellenmemiş mobil binary Cloud'a gitmeye devam eder, bu nedenle Cloud paused tutulmalı ve zorunlu mobil sürüm/dağıtım süresi kabul kapısıdır. Rollback mobilde yeni binary gerektirebilir; web deploy geri alma süresiyle eşit sayılmaz.

### Smoke / kabul kapısı

- TLS, API `/version`, web WebSocket yeniden bağlantısı; `site.<alan>/.well-known/openid-configuration` ve `/.well-known/jwks.json`, issuer/audience, parola girişi, token yenileme ve çıkış.
- En az iki firma ve rollerle tenant izolasyonu; mevcut çalışan mobil oturumu için yeniden giriş, yeni cihazda temiz kurulum.
- 500 satırlık aylık PDKS/bordro ve geçmiş/gece vardiyası karşılaştırması; sayım, ID ilişkileri, migration component checkpoint'leri, rate-limiter'ın gerçekten limit uygulaması.
- Fotoğraf yükle/oku, eski fotoğraf, mobil ek dosya upload/download; yeni host kontrolü ve eski absolute URL taraması. `_storage` ID'sinin korunması URL string'inin otomatik güncellendiği anlamına gelmez.
- 10 cihazda tekil ve tekrarlanan kart, online/offline snapshot, kapı komutu, kişi senkronu; aynı kartın canlı+spool+backfill tekrarında tek kayıt. Bu testler yalnız uygulama aşamasında yetkiyle yapılır.
- Cron/scheduled job, Node action mail testi test alıcısıyla; hedef gateway'in localhost değil doğru private host olması.
- Ölçülecek kabul hedefi: vardiya pikinde 10–20 olay/sn kısa burst + eşzamanlı 5 yönetici + aylık rapor; hata/OOM yok, kuyruk boşalıyor, işlem gecikmesi kabul edilen eşik içinde. 24 saatlik RAM/disk ve p95 ölçülmeden sunucu küçültülmez. 20 firma için ayrıca 200 cihaz/çoklu firma ve rapor yükü koşulur.

## 4. Operasyon ve gece arızası

**Sorumlu Emre.** Cloud işletimi yerine yedek, restore, güvenlik güncellemesi ve nöbet yükü bize geçiyor; geliştirici emeği aşağıdaki € hesabına dahil değil.

- İlk canlıdan önce timer/cron ile **saatlik mantıksal ZIP export**, her gece dosyalar dahil tam export ve ayrıca sürüm/env kasası yedeği. Her saat tam dosya kopyalamak yerine dosya değişim hızı ölçülerek politika ayarlanır. Başlangıç hedefi RPO ≤1 saat (kartlarda spool/backfill ile daha iyi olabilir), RTO ≤2 saat; ikisi de restore provasıyla doğrulanacak hedeflerdir. Sıfır veri kaybı garantisi değildir.
- Off-machine, tercihen farklı lokasyondaki S3 uyumlu depoya **şifreli** yükleme; yalnız aynı VM'in başka klasörü yedek değildir. Günlük 7, haftalık 4, aylık 3 nesil; ilk ay gerçek boyut ve işletme saklama politikasıyla ayarla. Spool, compose/image digest, `INSTANCE_*`, TLS/proxy konfigürasyonu ve kritik şifreleme anahtarları da ayrı güvenli yedekte olsun.
- Her yedekte exit code + checksum + dosya/nesne varlığı; son başarılı saatlik yedek >2 saat veya gece tam yedeği >26 saat ise alarm. Haftada bir izole boş VM/container'a restore + giriş + dosya + PDKS kontrolü; **ilk restore canlı kesimden önce**. Restore hedefinin cihaz/mail çıkışı kapalı kalır.
- Ek Hetzner VM Backup, hızlı makine kurtarma için yararlı; uygulama-tutarlı ZIP ve haricî dosya/env yedeğinin yerine geçmez. Çalışan SQLite dosyası doğrudan `cp` ile yedeklenmez; volume snapshot gerekirse servis kontrollü durdurulur veya tutarlı SQLite yöntemi kullanılır.
- Dışarıdan 1 dk API/HTTP kontrolü, container health ve restart sayısı; disk %70 uyarı/%85 kritik, RAM sürekli %80–85 veya OOM, CPU sürekli %80, disk gecikmesi, sertifika <14 gün, `post_pending`, spool en eski olay >5 dk/doluluk >%70 alarmı. Alarm Emre'ye ulaşmalı; e-posta tek başına gece uyandırma yöntemi kabul edilmemeli. Loglarda secret/kart/kişisel veri maskelenip logrotate sınırı konmalı.
- Resmî compose Prometheus `/metrics` sunabiliyor (`DISABLE_METRICS_ENDPOINT`); yalnız private erişimle aç. Backend DB/dosya fiziksel disk, export boyutu ve büyüme haftalık kaydedilsin. Bellek baskısı/p95 artarsa önce gereksiz abonelikleri azalt, sonra VM büyüt; transaction limitlerini gelişigüzel yükseltme.
- Ayda bir kontrollü bakım: sabit yeni image+SDK kombinasyonunu kopyada dene, export+env+volume yedeğini al, staging restore ve smoke yap, sonra Emre onayıyla güncelle. `latest` otomatik çekilmez. DB iç sürüm migration'ı nedeniyle yalnız eski image'a dönmek güvenli kabul edilmez; eski image + yükseltme öncesi tutarlı volume/export ile restore gerekir.
- Gece arızası: alarm → Emre API/proxy/container/disk/spool durumunu kontrol eder → yazıları dondurup spool'u korur → disk dolduysa önce sınırlı log/export artığını güvenle temizler, DB dosyası silmez → servis restart ile düzelmiyorsa boş hedefe son doğrulanmış yedeği yükler → hostname aynı hedefe taşınır → olay aralığı backfill/mutabakatı yapılır. Son yedekten sonraki manuel yazılar için kayıp incelemesi gerekir. Emre'nin erişemediği geceler için ikinci kişi belirlenmemişse bu açık işletim riskidir.

## 5. Koddan etkilenen yerler

Satırlar inceleme anındaki çalışma ağacına aittir; bu raporda kod değiştirilmedi.

| Dosya:satır | Bulgu / gerekli iş |
|---|---|
| `src/convexClient.ts:3` | `VITE_CONVEX_URL` yoksa canlı Cloud'a dönen fallback; self-host release'te eksik env'in hata vermesi planlanmalı. |
| `.env.local:2,4,6` | Cloud deployment/API/site değişkenleri var; self-host operatör dosyasıyla karıştırılmamalı. Değerler okunup raporlanmadı. |
| `mobile/lib/config/convex_config.dart:15,64,71` | Build-time URL + allowed host; özel HTTPS host destekleniyor, yeni build gerekir. |
| `mobile/lib/repositories/request_repository.dart:48` | Cloud hostunu site hostuna çevirir; özel API hostunda API hostunu bekler. Önerilen ayrı `api`/`site` ile **mobil upload reddedilir**. Açık, doğrulanan site host konfigürasyonu eklenmeli; güvenlik kontrolü kaldırılmamalı. Alternatif aynı hostta path routing daha karmaşık, ilk tercih değil. |
| `mobile/scripts/build_mobile.sh:53`, `.github/workflows/mobile.yml:130`, `mobile/env.example:4` | Yeni URL/allowed-host build ve release değişkenleri; store/test dağıtımı süreye dahil. |
| `bridge/windows/NgAccess.HikvisionBridge/appsettings.json:4`, `scripts/copy-bridge-web.mjs:5` | Windows bridge site URL + gömülü web build'i Cloud'a sabitlenmiş olabilir; ikisi birlikte güncellenmeli. |
| `infra/hik-event-bridge/bridge.mjs:149,186,217,403,425`, `queue.mjs:4` | Spool/retry var; 1.000 sınırı/env bağlantısı ve çalışan sürüm doğrulanmalı; `bridge.env.example:4` site URL. |
| `scripts/hikvision-bridge.mjs:29`, `scripts/forward-card-reader-to-convex.mjs:18`, `scripts/ide-smart-relay.mjs:26` | Cloud varsayılanları; kullanılan servisler tek tek env ile yeni hedefe alınmalı. |
| `scripts/ide-mqtt-bridge.mjs:41,138`, `scripts/setup-hikvision-forward-full.sh:11`, `scripts/verify-hikvision-convex.sh:15` | Site env ve eski Cloud fallback'leri. Son iki script cihaz konfigürasyonuna dokunabilir; bu raporda çalıştırılmadı. |
| `docs/HETZNER_CARD_READER_BRIDGE.md:14,154` | Sunucudaki nginx upstream Cloud'u gösteriyor; cihaz IP/URL'sini koruyup yalnız upstream'i değiştirmek mümkün. Gerçek sunucu config'i ayrıca incelenmeli. |
| `convex/auth.config.ts:4`, `convex/auth.ts:8`, `convex/http.ts:16` | Auth domain `CONVEX_SITE_URL`; parola ve HTTP well-known route'ları korunacak. API adresi değiştiğinde tüm web kullanıcıları yeniden giriş yapar (Auth storageNamespace = client.address); issuer da değişir. |
| `convex/requestAttachments.ts:23,216` | Site origin'den ek URL üretimi, HTTP action byte serving; yeni TLS/site origin ve mobil doğrulaması birlikte çalışmalı. |
| `convex/files.ts:81,84`, `convex/schema.ts:99,178,179` | Kalıcı `photoUrl` string'leri var. Eski storage URL'leri ZIP import'la yeniden yazılmaz; storageId olanlar yeniden türetilir, yalnız URL tutan users kayıtları için export storage manifest eşlemesi/özel düzeltme planlanır. |
| `convex/lib/gateway/core.ts:1,20`, `convex/lib/gatewayCommand.ts:131` | Node action env `HIK_GATEWAY_HOST/USER/PASS`, `HIK_FORWARDING_URL`. Ayrı VM'de localhost gateway değildir; private ağ/TLS yetkisi gerekir. |
| `convex/lib/fingerprintCrypto.ts:14`, `convex/lib/mailSecret.ts:16` | Şifreleme anahtarları korunmazsa veri taşınmış görünür ama kullanılamaz. |
| `convex/actions/sendEmail.ts:12,75`, `convex/actions/openaiChat.ts:62` | Resend/SITE_URL ve doğrudan OpenAI key; dış ağ çıkışları ve mail teslimi test edilmeli. |
| `convex/convex.config.ts:2`, `convex/dataMigrations.ts:17` | Component kaydı ve migration geçmişi taşınmalı; deploy tüm veri migration'larını otomatik tamamlamaz. |
| `convex/crons.ts:5–130`, `convex/lib/gatewayBackfill.ts:356` | Kuyruk, cihaz saati, günlük backfill, mail, erişim sona ermesi, retention işleri. Çift çalışmayı durdur, bekleyen işleri uzlaştır. |
| `convex/schema.ts:765,792` | `rawData` ve `by_status_time` maliyet adayları; azaltım ayrı kod işi. |
| `src/hooks/useDashboard.ts:14,21`, `src/hooks/usePdksLiveTable.ts:13` | Canlı abonelikler; görünürlük kapısı halen yok. Free raporundaki değişiklikler yalnız prototip, üretimde var sayılmamalı. |

## 6. Maliyet düşürme ve sunucu seçenekleri

Ölçüm tabanı: [FREE_PLAN_2026-11-28.md](FREE_PLAN_2026-11-28.md) yeni dashboard/PDKS koduyla 500 gerçek kişi ve 44.000 kart fixture'ını esas alıyor; [YUK_500_2026-11-27.md](YUK_500_2026-11-27.md) önceki sorgu sürümüyle ve 20 firma varsayımlarıyla karşılaştırma. Eski rapordaki aylık PDKS hatası güncel Free raporunda batch sürümüyle çözülmüş; yeniden çözülmemiş hata olarak sunulmamalı. `DASHBOARD_*` düzeltme raporları ve `E1_OZET_TABLO_TASARIM.md` de incelendi; E1 aylık mesai özeti yalnız tasarım, yayımlanmış çözüm değil.

Self-host'ta tasarruf, faturadaki belge I/O aşımını değil **CPU süresini, yeniden çalışan sorguları, disk/yedek büyümesini ve küçük VM'de gecikmeyi** hedefler. Aşağıdaki süreler test/inceleme dahil tahminlerdir, hepsi bu raporda uygulanmadı.

| Aday | Self-host kazancı / öncelik | İş süresi | Risk |
|---|---|---:|---|
| Görünür sekme + periyodik ana sayfa | **En yüksek CPU kazancı.** Free modelinde activity ~76,5 GB/ay; saatlik snapshot sonrası bütün model ~1,56 GB. CPU oranı aynı değildir. Self-host için 3 saat zorunlu değil; görünürde 1–5 dk/manual refresh, kritik canlı okuma ayrı tutulabilir. | 0,5–1 gün | Bayat bilgi; sekmeye dönüşte yenileme, loading/hata ve firma değişince veri temizliği gerekir. |
| Gizli sekmede PDKS aboneliklerini kapat | Gizli batch/grup invalidation'ları ve istemci yükünü azaltır; açık PDKS yoksa kazanç sıfır. Çok yöneticide anlamlı. | 0,5–1 gün | Geri dönünce tam güncel veri/dirty revision; devam eden export kesilmemeli. |
| Yeni kartlarda `rawData` tutmama | Ham 804→545 B örneği; ~11,4 MB/ay kart gövdesi, rapor okumaları ve backup ham boyutu azalır. **216 MB/ay fiziksel SQLite kazancı iddiası yok:** Free raporundaki bu rakam Cloud indeks fiyatlama modelidir. | 0,5–1 gün | Cihaz hatasını inceleme zorlaşır; parsed serial/zaman/yön ve dedup alanları kalmalı, sorunlu örnekler kısa süre kontrollü loglanmalı. Eski kayıt backfill'i ayrı iş. |
| Kullanılmayan `by_status_time` kaldırma | Bir B-tree'nin yazma/disk/bellek maliyeti azalır; düşük–orta kazanç. Free'deki 35,4 MB/ay fiziksel garanti değildir. | 0,25–0,5 gün | Dinamik/eski istemci kullanımı yeniden taranmalı; rollback indeks rebuild süresi doğurur. Diğer 17 indeks korunur. |
| Backfill dedup'u 30'lu paketleme | 30→1 mutation, küçük fixture'da 11.700→6.190 B; scheduler/transaction maliyeti düşer. İlk büyümede yararlı. | 1–2 gün | Sırasız serial, partial retry, batch limitleri ve summary trigger'ları; dedup kaldırılmaz. Canlı öncesi zorunlu kritik yol yapma. |
| Heartbeat kalıcı yazımını 1→5 dk | Daha az write/cihaz invalidation; mevcut kod zaten 1 dk guard içeriyor, kazanç sınırlı. HTTP çağrısı sayısı otomatik azalmaz. | 0,5–1 gün | Fallback offline eşiği 5 dk olduğundan yalancı offline; eşik/tolerans birlikte değişmeli. Gerçek status olayları geciktirilmemeli. |
| Log/export saklama ve büyük raw/base64 engeli | Diskin dolmasını ve aynı dosyanın yedekte çoğalmasını önler; küçük VM'de doğrudan yarar. | 0,25–0,5 gün | İnceleme kanıtlarını erken silmemek; ayrı yedek manifestini korumak. |

**Self-host'ta Free uğruna gerekmeyen işler:** 15 günlük sıcak pencere + dış arşivden bordro üretimi; raporu haftada bir çifte sınırlama; 3 saatlik dashboard'u kota şartı yapma; 0,5 GB'a sığmak için karmaşık toplu purge/arşiv doğrulama ürünü; yalnız ayda iki küçük backup tutma. Bunlara sırf Cloud kotası için 8–12 gün harcamak yerine geçiş ve restore'a yatırım yap. İşletme/KVKK saklama politikası, mevcut retention ve uzun vadeli büyüme yönetimi devam eder; bu karar süresiz saklama izni değildir.

### Sunucu ve yedek bütçesi

Fiyatlar **AB konumu, KDV hariç, aylık planlama aralığı**. Resmî Hetzner 15 Haziran 2026 fiyat değişikliği arama sonucunda CX23 €5,49, CX33 €8,49, CX43 €15,99, CPX32 €35,49, CCX13 €42,99 gösteriyor; sayfanın doğrudan açılması 404 verdi, güncel sipariş ekranı teyidi gerekli. Eski proje belgesindeki CX21 €5/CX31 €15 veya eski CCX fiyatları bugünkü teklif sayılmadı. Ana cloud sayfası Cost-Optimized için bulunamama uyarısı gösteriyor; CX stoğu garanti değil. Aşağıdaki aralıklar teklif değil, satın almadan önce Emre kontrol edecek.

| Seçenek | Boyut / kullanım | VM €/ay, yaklaşık | Karar |
|---|---|---:|---|
| Mevcut köprü VM'ini paylaş | Kaynaklar yeterliyse, tercihen ≥16 GB | **€0 ek VM**; yükseltme farkı bilinmiyor | En ucuz görünür, ama mevcut ölçüm olmadan güvenli seçenek olarak kabul edilmedi. Gateway faturası zaten var. |
| CX23 | 2 vCPU / 4 GB / 40 GB | €5,5–7 | Prova/test; üretim minimumu olarak seçilmedi. |
| **CX33 ayrı** | 4 vCPU / 8 GB / 80 GB | **€8,5–10** | 500 kişi için en düşük güvenli aday, kabul testine bağlı. |
| **CX43 ayrı** | 8 vCPU / 16 GB / 160 GB | **€16–18** | 20 firma büyümesi için öneri; hedef hacim ayrıca test edilecek. |
| CPX32 ayrı | 4 vCPU / 8 GB / 160 GB sınıfı | €35,5–39 | CX yoksa başlangıç alternatifi; satın alma anında boyut/fiyat teyidi. |
| CCX13 ayrı | 2 dedicated vCPU / 8 GB / 80 GB sınıfı | €43–47 | Sürekli CPU çekişmesi kanıtlanırsa; ilk müşteri için maliyet önceliğiyle seçilmedi. |
| Haricî S3 uyumlu yedek | Hetzner Object Storage, küçük başlangıç hacmi | **€7–8 bütçe** | Asgari aylık ücret, kapasite/transfer/aşım siparişte teyit edilecek; resmî ürün sayfasında tutar araçla okunamadı. Canlı storage ayrı olsa da aynı taban ücret içinde yeterli hacim varsa çift taban ücret varsayılmaz. |
| VM Backup | VM bedeline ek | **%20** | 7 slot; off-machine uygulama yedeğine ek hızlı kurtarma katmanı. |
| IPv4 | Yeni VM başına | **€0,50** | Domain/TLS için IPv4 kullanan istemcilere erişim; IPv6 tek başına varsayılmadı. |

- **En düşük güvenli başlangıç:** CX33 €8,49 + IPv4 €0,50 + VM Backup €1,70 + haricî yedek €6,5–8 ≈ **€17–19/ay ek**. 500 kişi kabul testi geçmezse daha büyük VM'e çıkılır.
- **Önerilen:** CX43 €15,99 + IPv4 €0,50 + VM Backup €3,20 + haricî yedek €6,5–8 ≈ **€26–28/ay ek**.
- **CX stok yoksa başlangıç CPX32:** yaklaşık **€50–55/ay ek**; ucuz planı beklemek 4 Aralık takvimini bozabilir. Dedicated CCX13 ile yaklaşık €59–65/ay ek bütçe gerekir.
- **Mevcut makine paylaşılırsa:** yeterli kaynak doğrulanmış ve ücretli disk/VM yükseltmesi gerekmiyorsa yaklaşık €7–8 haricî yedek + mevcut VM Backup farkı; bunu şu anda en düşük *güvenli* toplam diye sunamıyoruz.

**Gerçek toplam = mevcut köprü/gateway faturası + yukarıdaki ek maliyet + gerekiyorsa alan adı (~€1–2/ay planlama payı) + KDV.** Mevcut fatura bilinmediğinden tüm sistemin kesin toplamı çıkarılamıyor. Web hosting, mail, domain zaten ödeniyorsa tekrar eklenmez; ücretli mail/API kullanımı, trafik aşımı, ikinci bölge kopyası, mobil mağaza hesabı ve Emre'nin zamanı dahil değil. İlk geçiş haftasında geçici prova VM'i birkaç günlük ek ücret doğurur. Yedek hacmi 20 firmada artarsa gerçek nesne saklama ve export trafiğiyle bütçe yeniden hesaplanır.

## 7. Emre'ye açık sorular ve go/no-go

1. Mevcut Hetzner VM tipi, x86_64 mimarisi, RAM/disk/boş alan, aylık fatura ve CPU/RAM geçmişi nedir? Gateway hangi portlarda, hangi servis yöneticisiyle çalışıyor?
2. Ayrı VM bütçesi ve CX bulunmazsa CPX alternatif bütçesi onaylı mı? Sunucu/DNS yetkisi kimde, uygulama görevine erişim nasıl verilecek?
3. API/site için hangi alan adı kullanılacak; web host ve TLS/DNS yönetimi nerede? Proxy'yi kim işletiyor?
4. Çalışan event bridge sürümü bu repoyla aynı mı; kalıcı spool nerede, kaç kayıt bekliyor? Direct forwarding kullanan cihaz veya ESP32 de var mı?
5. 10 Hik'in model/firmware'i, device buffer kapasitesi, gerçek AcsEvent saklama süresi ve erişim yetkisi nedir? Kontrollü kesinti/backfill testi için hangi cihaz kullanılabilir?
6. Mobil uygulama sahada dağıtılmış mı, yeni binary 1–2 Aralık'ta herkese ulaştırılabilir mi? Ek dosya upload özelliği canlı kapsamda mı? Mağaza inceleme süresi takvimden bağımsız risk.
7. Secret kasası ve `JWT_PRIVATE_KEY/JWKS`, `MAIL_SECRET_KEY`, `FINGERPRINT_TEMPLATE_KEY`, gateway/token erişim sorumlusu kim? Secret değerleri chate gönderilmemeli.
8. 20 firma hedefi firma başına 200 kişi/10 cihaz mı, yoksa 20×500 kişi mi? Aylık fotoğraf/ek dosya, rapor eşzamanlılığı ve saklama süreleri ne?
9. Bakım penceresi, RPO 1 saat/RTO 2 saat hedefi kabul ediliyor mu; Emre gece ulaşılamazsa ikinci kişi kim? Yedek bölgesi ve harcama sınırı ne?

**Go:** restore provası başarılı, Auth/fotoğraf/mobil host problemi çözülmüş, cihaz spool+backfill kanıtlanmış, çift scheduler engellenmiş, yeni mobil dağıtımı hazır, Emre kesimi onaylamış. **No-go:** bunlardan biri eksik; 4 Aralık müşteri açılışını doğrulanmamış bir backend kesimiyle birleştirme. Bu durumda Cloud Free'nin mevcut yükü kaldıramama bulgusu da devam eder; Emre geçici kapasite/billing çözümüne ayrıca karar vermeli.

## 8. Resmî web kaynakları — URL ve kısa alıntı

28 Kasım 2026'da web erişimi sağlandı. GitHub `get-convex` bağlantılarının bazıları resmî `convex` organizasyonuna yönleniyor. Donanım ve fiyat kesinliği olmayan noktalar yukarıda ayrıca işaretlendi.

1. [Convex self-hosting](https://docs.convex.dev/self-hosting): “same fully up-to-date code the cloud service uses.” Temel özellik eşliği; uygulamaya özel performans garantisi değil.
2. [Resmî self-host README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md): “By default ... local SQLite database”; Auth bölümünde “The CLI does not support self-hosted deployments yet.” Backend/dashboard kurulumu ve elle Auth kurulumu ayrımı.
3. [Kendi altyapısında hosting](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md): “http actions exposed at port 3211”. API/site/dashboard yönlendirmesi ve origin env isimleri.
4. [Resmî Docker Compose](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml): “data:/convex/data”, “curl -f http://localhost:3210/version”. Kalıcı volume, healthcheck, concurrency/metrics ayarları; production override gereksinimi.
5. [Postgres/MySQL](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md): “designed to work well with SQLite, Postgres, or MySQL.” SQL seçeneği ve aynı bölge uyarısı.
6. [S3 storage](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/s3_storage.md): “you'll need to run a snapshot export and import”. Bucket/env ve storage sağlayıcısı değiştirme yöntemi.
7. [Upgrade](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/upgrading.md): “final export is done after load is stopped”. Güncelleme öncesi export/env yedeği ve veri dondurma.
8. [Export](https://docs.convex.dev/database/import-export/export): “To also download ... provide `--path`”. [Import](https://docs.convex.dev/database/import-export/import): “Documents will retain their `_id` and `_creationTime`”. ZIP, tablolar arası referans ve `_storage` koruma; CLI'nin dosya dahil etme bayrağı yerel `node_modules/convex/src/cli/convexExport.ts:18` ile de doğrulandı.
9. [Manual Auth](https://labs.convex.dev/auth/setup/manual): “Configure private and public key”. JWT_PRIVATE_KEY/JWKS, SITE_URL ve issuer/http routes kurulumu.
10. [Node action Dockerfile](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker-build/Dockerfile.backend): “Install Node.js and npm, required for running Node.js actions”. Resmî container runtime'ında Node desteği.
11. [Components](https://docs.convex.dev/components): “their own database tables and isolated function execution environment.” [migrations](https://github.com/get-convex/migrations): “tracking and running stateful migrations”; [rate-limiter](https://github.com/get-convex/rate-limiter): “application-layer rate limits”. Bunlar uyum beklentisini destekler; paket/sürüm provasının yerine geçmez.
12. [Deployment pause](https://docs.convex.dev/production/pause-deployment): “Cron jobs will be skipped.” Scheduled işler resume'da çalışabilir; çift cihaz/mail işlemini önlemek için kesim kapısı.
13. [Hetzner fiyat değişikliği](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/): resmî arama indeksinde “All prices are excluding VAT.” ve yukarıdaki fiyat tablosu görüldü; doğrudan erişim **404**, dolayısıyla tutarlar satın alma teyidi bekler. [Cloud](https://www.hetzner.com/cloud/): “Currently not available” Cost-Optimized bulunabilirlik uyarısı.
14. [IPv4](https://docs.hetzner.com/cloud/servers/primary-ips/overview/): “€ 0.50 ... per month (excl. VAT)”. [VM Backup](https://docs.hetzner.com/cloud/billing/faq/): “20% of the price of the server”; 7 slot. [Object Storage](https://www.hetzner.com/storage/object-storage/): S3 ürünü doğrulandı; araç çıktısında fiyat yok, €7–8 tahmini kesin resmî fiyat değildir.


## 8. Kod hazırlıkları ve kesim öncesi işletim kapıları (uygulanmadı)

Bu bölüm yalnız kaynak kod hazırlığıdır; sunucu, cihaz, deploy, reconciliation ve migration çalıştırılmadı. `.claude/orca-specs/self-host-review.md` D1–D8 bulguları esas alındı.

- **D1:** `internal.selfHostReconcile.reconcile` açık `dryRun` ve `table` ister. Sıra: users, deviceSyncRunTargets, deviceSyncRuns, auditLog, reportDeliveries, deviceEvents. Her tabloyu cursor olmadan başlat, `continueCursor` ile `isDone` olana dek sayfala; scanned/affected sayılarını topla ve kuru/gerçek sonuçlarını kaydet. Önce dryRun=true, ayrı yetkili uygulamada dryRun=false. İki deployment ve gateway/bridge/mail worker çıkışları durmuş olmalı. Gelecekteki accessExpiresAt işleri yeniden kurulur; kayıp scheduler ID bulunmazsa cancel atlanır. Sync hedefleri unknown, run failed; biyometrik running/waitingDevices failed ve doğrulanmamış cihaz sayısı korunur; rapor ve alarm sending/queued/retryScheduled failed olur. Yeniden gönderim yok; biyometrik silmeyi fiziksel cihazda ayrıca doğrulamadan tamamlandı sayma. Bekleyen deviceOperations ve offline teyitleri ayrıca envanterlenmeli; cron/worker açılışını otomatik yapma. Cloud resume birikmiş scheduler işlerini çalıştırabilir: geri dönüşten önce eski cihaz/mail işlerini ayrıca incele.
- **D2:** `api.actions.selfHostForwarding.forwarding` yalnız super_admin, varsayılan GET/listeleme (write yok veya false). `cursor` ile tüm cihaz sayfalarını dolaş; her httpHosts sonucu okunur, token raporda maskelenir. Hedef HIK_FORWARDING_URL env değeridir; `write:true` yalnız Emre cihaz yazma onayı sonrası ayrı çağrıda verilir. Yazma sonrası GET listesini yeniden al ve her fiziksel cihazı doğrula. Bu hazırlıkta GET dahil hiçbir cihaz çağrısı yapılmadı.
- **D3:** Canlı kart, canlı deviceEvents ve backfill aynı içerik yardımcısını kullanır: cihaz+seri adayı, kart ve ±10 dakika/aynı cihaz zamanı. Seri reset sonrası farklı zamandaki yeni olay kalır; retry çift kayda dönüşmez. Kesimde spool/backfill mutabakatı yine cihaz bazında yapılır.
- **D4:** Mobil `CONVEX_UPLOAD_ALLOWED_HOSTS` virgülle ayrılmış host adlarıdır; release binary için dart-define ile verilir, debug env desteklenir. Ayrı api/site hostları için site hostunu ekle; HTTPS, tam host eşleşmesi, upload path ve ticket doğrulaması sürer. Yeni binary sahaya ulaşmadan kesim yapma.
- **D5:** users.photoStorageId opsiyoneldir, yeni fotoğraflar URL ile birlikte saklar. Legacy photoUrl görüntülemeyi sürdürür; herhangi bir URL-only kullanıcı fotoğrafı varken bağsız pending blob silme muhafazakâr olarak durur (pending satırları temizlenir); manifest eşlemesi bitene kadar fazladan blob kalabilir. Export `_storage` manifestinden eski URL→storageId eşlemesi ve yeni getUrl URLlerinin güncellenmesi cron açılmadan önce ayrı migration görevidir; bu kod hazırlığında migration çalıştırılmaz. Logoya/belgelere/KVKK URLlerine de export taraması uygula.
- **D6:** `HIK_RELAY_URL`, `HIK_RELAY_SECRET`, `HIK_GATEWAY_DEBUG` backend env envanterine dahildir; hiçbir değer bu belgede saklanmaz. `infra/hik-relay` nginx upstream/service (`ngs-hik-relay.service`) ve erişim/secret ilişkisini yeni backend ile prova et, ardından eski hedefe çıkışı durdurup yeni hedefe kes ve roster wake doğrula. `scripts/ide-mqtt-bridge.mjs` için CONVEX_SITE_URL yeni HTTP origin olmalı; MQTT broker ayarlarını koru. IDE köprüsünde spool yok: girişleri durdurulabilen bir pencere seç, son olay zamanını kaydet, köprüyü durdur, hedef env değişimi sonrası yeniden başlat ve eksik olayları cihaz/broker kabiliyetine göre uzlaştır; kayıpsızlık provası yoksa kesme.
- **D7:** Bridge `MAX_QUEUE` pozitif tamsayı olmalı; varsayılan 1000. Kesimden önce dayanıklı EVENT_QUEUE_DIR ve boş disk ölçülür. Yeni URL ile restart spoolu yükler; seri işleme nedeniyle biriken kuyruğun boşalma süresini ve yeni canlı olay gecikmesini provada ölç. Hata/sınır aşımında backfill penceresi ile kayıp mutabakatı yapılır.
- **D8:** Web API adresi değişince kullanıcılar kesin yeniden giriş yapacak; duyuru ve rol bazlı giriş provası şart.

### Cloud domain bağımlılık envanteri (dosya:satır)

Kaynak taraması: src, convex, mobile/lib, scripts, infra, bridge; test fixtureleri ve tarihsel docs/mobile-release kanıtları hedef değildir.

| Yer | Hazırlık |
|---|---|
| `src/convexClient.ts:3` | Cloud fallback kaldırıldı, VITE_CONVEX_URL zorunlu. |
| `mobile/lib/repositories/request_repository.dart:48` | Cloud cloud→site dönüşümü yalnız geriye uyum; self-host izinli hostları configten. |
| `scripts/hikvision-bridge.mjs:29`, `scripts/ide-smart-relay.mjs:24`, `scripts/forward-card-reader-to-convex.mjs:16` | Sabit Cloud fallback kaldırıldı; ilgili CONVEX_URL/CONVEX_CARD_READER_URL zorunlu. Başlık örnekleri çalışma hedefi değildir. |
| `scripts/test-card-reader-curl.sh:5`, `scripts/test-convex-endpoint.sh:8`, `scripts/setup-hikvision-forward-full.sh:11`, `scripts/verify-hikvision-convex.sh:15` | Cloud fallback kaldırıldı; env veya açık CLI argümanı zorunlu. Cihaz scriptlerini onaysız çalıştırma. |
| `bridge/windows/NgAccess.HikvisionBridge/appsettings.json:4`, `bridge/windows/NgAccess.HikvisionBridge/installer/ngsaccess-bridge/appsettings.json:4` | Varsayılan hedef boş; kurulum configi veya Bridge__ConvexSiteUrl env gerekir. |
| `infra/hik-event-bridge/bridge.env.example:4` | Hedef boş örnek; CONVEX_SITE_URL zorunlu. |
| `bridge/windows/NgAccess.HikvisionBridge/Services/LocalConfigServer.cs:280` | Yalnız giriş placeholder; ağ hedefi değil. |
| `scripts/ide-mqtt-bridge.mjs:18` | Yalnız başlık örneği; çalışırken CONVEX_SITE_URL zorunlu. |

Bu dosyalarda kalan `.convex.cloud/.convex.site` metinleri uyumluluk dönüşümü veya yorum/örnek metnidir; canlı hedef seçen sabit fallback kalmamıştır. Tarihsel belge ve export içindeki URL verileri ayrı kesim envanteridir.
