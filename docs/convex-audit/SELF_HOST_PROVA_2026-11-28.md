**Çalışıyor mu?** Evet. Hetzner'de (157.90.114.86) self-host Convex + Postgres 17 ayakta. Fonksiyonlar deploy edildi, yeni issuer ile giriş, Ana sayfa ve Kişiler gerçek veriyle açılıyor. PDKS sayfası açılmıyor, ama sebep self-host değil: HEAD frontend'indeki bir render döngüsü (bkz. Sorun 2).
**Veri birebir mi?** Evet. Cloud'daki 77 uygulama tablosunun 77'si, satır sayısı ve sıralı içerik hash'iyle birebir aynı (12.144 belge). `_storage` 1/1 dosya, 451.042 bayt, aynı. Reconcile dryRun: 10.708 satır tarandı, etkilenen 0.
**Kaynak etkisi:** Boştayken +1,3 GB RAM (backend 1,07 GB, Postgres 176 MB, dashboard 76 MB). Smoke sırasında backend tek çekirdeğin %61'i, makine yükü en fazla 0,67. Disk +~0,9 GB (imajlar ~510 MB, veri 333 MB). Mevcut 8 servisin hiçbiri yeniden başlamadı, tüm portlar dinlemeye devam ediyor.
**Sorunlar:** (1) HEAD şeması self-host'a deploy olmuyor: 65 karakterlik index adı, sınır 64. Prova kopyasında adı kısaltılarak geçildi. (2) HEAD PDKS sayfasında "Too many re-renders" hatası var. (3) Cloud, HEAD'in gerisinde: HEAD'deki 9 tablo Cloud'da yok.
**Geçiş için kalanlar:** Index adı düzeltmesi (main), PDKS hatası, nginx vhost + TLS + DNS (ayrı onay), gerçek env/secret aktarımı, backend'e kontrollü dış erişim (gateway/SMTP), mobil build, cihaz forwarding URL'leri, sunucu dışı yedek, izleme.

# Self-host Convex PROVA — 28 Kasım 2026

Kapsam: Emre kararıyla (2026-11-28) mevcut Hetzner sunucusunda **prova**. Geçiş (cutover) yapılmadı. Canlı kullanıcılar, cihazlar, web ve mobil Cloud'da (`dev:notable-tern-4`) kalmaya devam ediyor. Cloud'a yapılan tek işlem **salt okuma export** oldu. Bu belgede hiçbir secret değeri yok.

Saatler TR (UTC+3). Kurulum 13:16'da başladı, ölçümler 13:28'de bitti.

## 1. Kurulum

| Öğe | Değer |
|---|---|
| Dizin | `/opt/ngs-convex` (compose, `proxy/nginx.conf`, `.env` 0600, `secrets/` 0700, `data/`, `import/` 0700, `backup/`) |
| Backend | `ghcr.io/convex/convex-backend:7925f9b2a031…` + digest `sha256:6ceb93e1…` (26 Kasım 2026 sürümü) |
| Dashboard | `ghcr.io/convex/convex-dashboard:7925f9b2a031…` + digest `sha256:05e6c870…` |
| Veritabanı | `postgres:17.7-alpine` + digest `sha256:bb377b72…` |
| Proxy | `nginx:1.28.0-alpine` + digest `sha256:30f1c0d7…` (yalnız TCP aktarımı; sunucudaki nginx'ten **ayrı** bir konteyner) |
| Bellek sınırları | backend 4 GB · postgres 1,5 GB · dashboard 512 MB · proxy 64 MB |
| Yeniden başlatma | 4 konteynerde de `restart: unless-stopped` |
| Portlar | Yalnız `127.0.0.1:3210` (API), `127.0.0.1:3211` (HTTP actions/Auth), `127.0.0.1:6791` (dashboard). Kurulum öncesinde üçü de boştu, çakışma yok. |
| Secret'lar | `INSTANCE_SECRET` ve Postgres şifresi `/opt/ngs-convex/.env` dosyasında (0600). Admin key `secrets/admin_key` dosyasında (0600). Prova env değerleri ve prova test kullanıcısı `secrets/prova-env/` altında (0600). |

**Ağ izolasyonu (ek güvenlik önlemi):** Backend ve Postgres yalnız `internal: true` olan bir Docker ağında çalışıyor. Bu yüzden internete, Hik gateway'e (`:8088`) ve SMTP/Resend'e **fiziksel olarak çıkamıyorlar**. Doğrulama: konteyner içinden `curl https://api.resend.com` ve `curl http://157.90.114.86:8088` denendi, ikisi de bağlantı kuramadı (`000`). Dışarıdan erişim yalnız `proxy` konteyneri üzerinden ve yalnız 127.0.0.1'den mümkün. Bu sayede env yanlış ayarlansa bile prova backend'i gerçek cihaza komut ya da gerçek kişiye mail gönderemez. Ek olarak `DISABLE_BEACON=true` ile telemetri kapalı.

**Neden Postgres (SQLite değil):** `SELF_HOST_KARAR_CLAUDE_2026-11-28.md` §1'de belgelenen en ağır bellek hataları SQLite'a özgü. [#495](https://github.com/get-convex/convex-backend/issues/495)'te indeks sorgusu `LIMIT`'i yok sayıp aralığın tamamını belleğe alıyor ve OOM'a yol açıyor. [#593](https://github.com/get-convex/convex-backend/issues/593)'te açılışta belge geçmişinin tamamı belleğe yükleniyor: 3,4 milyon satırda 17-22 GB. #593'te "Postgres persistence does not have this problem" yazıyor. Düzeltmeler main'e 25 Kasım'da girdi, sahada henüz denenmedi. Resmî belge üretim için ayrı bir SQL veritabanı öneriyor ve Postgres v17'yi test edilmiş sürüm olarak veriyor. Bu sunucu gateway ve Pafta ile paylaşıldığı için backend'in 4 GB sınırına bellek yüzünden takılıp düşmesi en büyük risk; Postgres bu riski azaltıyor. Ayrıca `pg_dump` ile tutarlı, çalışırken alınabilen yedek imkânı veriyor. Bedeli: ek bir konteyner ve ~176 MB RAM.

## 2. Kurulum öncesi / sonrası (mevcut servisler)

| | Önce (13:13) | Sonra (13:27, import + smoke + down/up döngüsü sonrası) |
|---|---|---|
| DeviceGatewayService / Guard | active, 15 Kasım 01:03'ten beri | active, **aynı başlangıç zamanı** |
| ngs-hik-event-bridge / ngs-hik-relay | active | active, aynı başlangıç zamanı |
| nginx / pafta-api / pafta-seo-worker | active | active, aynı başlangıç zamanı |
| pafta-gotenberg (docker) | Up 2 ay | Up; compose down/up onu etkilemedi |
| Dinleyen portlar | 80, 443, 554, 8080, 8088, 8090, 7091, 7661, 7663, 3001, 8790, 8791 | Hepsi hâlâ dinliyor; yeni olarak yalnız 127.0.0.1:3210/3211/6791 |
| RAM kullanılan / kullanılabilir | 6.187 MB / 9.426 MB | 7.506 MB / 8.107 MB |
| Load average | 0,15-0,28 | 0,31-0,41 |
| Disk `/` | 49 GB kullanılan (%34) | 51 GB (%36) |

Nginx, firewall (ufw), DNS ve mevcut servis config'lerine dokunulmadı.

## 3. Fonksiyon deploy

- İzole kopya: `/tmp/ngs-selfhost` = `git archive HEAD` (6e01e0a6) + ana dizindeki commit'siz `convex/` diff'i + commit'siz yeni `convex/` dosyaları (`selfHostReconcile.ts`, `lib/hikEventDedup.ts` vb.). `npm ci` ile convex CLI 1.47.0 kuruldu.
- `.env.local` yalnız `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210` (SSH tüneli) ve `CONVEX_SELF_HOSTED_ADMIN_KEY` içeriyordu. Shell'de `CONVEX_*` değişkeni yoktu.
- Hedef doğrulaması: `convex dashboard` → "Self-hosted deployment configured"; `convex env list` → "No environment variables set" (Cloud'da 16 env var var). Deploy çıktısı: "Deploying code to deployment: http://127.0.0.1:3210".
- **İlk deploy reddedildi:** `dashboardReadingFeed` tablosunun `by_projectId_and_accessTime_and_readingCreationTime_and_readingId` index adı 65 karakter. Kural: "Identifiers must be 64 characters or less". Yalnız prova kopyasında ad `by_projectId_accessTime_readingCreationTime_readingId` olarak kısaltıldı (4 yer: `schema.ts:45`, `dashboard.ts:731`, `lib/adminGuards.ts:72,196`). Ana dizine dokunulmadı.
- İkinci deploy 15 sn'de başarılı oldu; `migrations` ve `rateLimiter` component'leri kuruldu.

## 4. Env (yalnız isimler)

| Durum | İsimler |
|---|---|
| **Yeni üretildi (prova'ya özel, Cloud'dan kopyalanmadı)** | `JWT_PRIVATE_KEY`, `JWKS` (yeni RS256 çifti), `ADMIN_SETUP_SECRET`, `IDE_BRIDGE_SECRET`, `CARD_READER_RELAY_SECRET` (rastgele; gerçek köprüler bu değerlerle kimlik doğrulayamaz), `SITE_URL=http://localhost:8083` |
| **Bilerek BOŞ** (dış etki ve sır çözme kapalı) | `HIK_GATEWAY_HOST/USER/PASS`, `HIK_FORWARDING_URL`, `HIK_RELAY_URL/SECRET`, `HIK_GATEWAY_DEBUG`, `RESEND_API_KEY`, `MAIL_FROM_EMAIL/NAME`, `MAIL_SECRET_KEY`, `FINGERPRINT_TEMPLATE_KEY`, `OPENAI_API_KEY`, `NOTIFICATION_EMAIL`, `CARD_READER_ALLOW_UNAUTHENTICATED`, `MOBILE_IDE_ISOLATION_VERIFIED`, `SELF_HOST_TARGET` |
| Otomatik | `CONVEX_SITE_URL` = `CONVEX_SITE_ORIGIN` = `http://127.0.0.1:3211`. Auth issuer da bu adres (`/.well-known/openid-configuration` ve `jwks.json` yanıt veriyor). |

`MAIL_SECRET_KEY` boş olduğu için `mailSettings` tablosundaki (1 satır) şifreli SMTP parolası çözülemez. Kodda gateway env'i eksikse `gateway/core.ts:23` hata fırlatıyor, `relayConfig` boş env'de `null` dönüyor. Gerçek geçişte `FINGERPRINT_TEMPLATE_KEY` ve `MAIL_SECRET_KEY` **Cloud'daki değerin aynısı** olmalı; aksi halde parmak izi şablonları ve SMTP şifresi çözülemez.

**Cron'lar:** Çalışıyorlar ama dış etkileri yok. Gözlemlenenler: `hikvisionSync:cleanupStaleSyncIssues`, `requeueStaleLocalBridgeOperations`, `actions/hikQueueWorker:processHikQueue` (0,9 sn, hatasız). Kayıt sırasında doğrulama maili denendi; log çıktısı: "RESEND_API_KEY ayarlı değil — email gönderilemedi". Ağ izolasyonu nedeniyle env dolu olsaydı bile dışarı çıkış mümkün değildi. Cron'ların yaptığı yazılar yalnız prova DB'sinde kalır.

## 5. Veri provası

| Adım | Süre | Not |
|---|---|---|
| Cloud export (`--include-file-storage`, yalnız `CONVEX_DEPLOYMENT=dev:notable-tern-4` olan ayrı dizinde) | 5 sn | ZIP 1,58 MB (açılmış hali 14,7 MB), 86 tablo girdisi |
| Self-host import | ilk deneme 2 sn'de reddedildi; `--replace-all` ile 16 sn | İlk ret sebebi: deploy'un oluşturduğu tablo numaraları import'takilerle çakıştı. Boş hedefte `--replace-all` doğru mod. 12.144 belge eklendi. |
| Karşılaştırma | — | Self-host'tan da export alındı. Her tablonun `documents.jsonl` satırları sıralanıp SHA-256 alındı ve karşılaştırıldı. |

Sonuç: Cloud'daki **77 uygulama tablosunun 77'si birebir aynı** (satır sayısı ve içerik hash'i; `_id` ve `_creationTime` korunmuş). Satırı olan 45 tablo var. En büyükleri: deviceEvents 10.663, cardReadings 657, authRefreshTokens 504, authSessions 26, auditLog 21, readers/doors/holidays 17, employees 16, users 6. Component tabloları da birebir: migrations 4, rateLimits 10. `_storage` 1/1 ve blob boyutu aynı (451.042 bayt).

Self-host'ta fazladan **9 boş tablo** var: `dashboardCounts/Days/Evidence/Hours/ReadingFeed`, `requestAttachments`, `requestAttachmentTickets`, `visitorPasses`, `visitorPassAttempts`. Bunlar HEAD şemasında var ama Cloud'da yok. Yani Cloud, HEAD'in gerisinde (son yayın 17 Kasım). HEAD koduyla eski veri birlikte çalışıyor; yeni özet tablolarının backfill'i çalıştırılmadı.

**selfHostReconcile dryRun** (yalnız self-host'ta, yazma modu çalıştırılmadı; her çağrıda `dryRun:true` doğrulandı):

| Tablo | Taranan | Etkilenen |
|---|---|---|
| users | 6 | 0 (geleceğe dönük `accessExpiresAt` yok) |
| deviceSyncRunTargets | 5 | 0 |
| deviceSyncRuns | 3 | 0 |
| auditLog | 21 | 0 (açık biyometrik imha yok) |
| reportDeliveries | 0 | 0 |
| deviceEvents | 10.663 (214 sayfa) | 0 |

Export dosyası sunucuda `/opt/ngs-convex/import/cloud-notable-tern-4-20261128.zip` olarak duruyor (0600, sha256 `48d9e4f0d7354325…`). Yerel kopyalar silindi.

## 6. Smoke

Kurulum: SSH tüneli (`-L 3210 -L 3211 -L 6791`) + `/tmp` kopyasında `vite --port 8083` (`VITE_CONVEX_URL=http://127.0.0.1:3210`) + headless Playwright. Cloud'daki kullanıcıların şifresi bilinmediği için **prova'ya özel** bir test hesabı açıldı: `@example.invalid` adresiyle kayıt yapıldı, `users:setRoleByEmail` ile super_admin yapıldı, kendi doğrulama token'ıyla `verifyEmail` çağrıldı. Bu üç yazı yalnız prova DB'sine gitti. Bilgiler sunucuda: `secrets/prova-env/smoke_cred`.

| Kontrol | Sonuç |
|---|---|
| Yeni issuer ile giriş | ✅ 1,5 sn'de `/home`. Yeni JWT backend tarafından kabul edildi. |
| Doğrulanmamış hesap kuralı | ✅ İlk denemede doğru şekilde engellendi ("E-posta adresinizi doğrulamanız gerekiyor") |
| Ana sayfa | ✅ Gerçek veriyle açıldı: proje "emre", Bugün gelen 0/10, son okumalar listesi (18.08.2026 vb.) |
| Kişiler | ✅ 7 satır |
| PDKS | ❌ "PDKS kayıtları yüklenemedi". Sunucuda hata yok. İstemcide `<PDKSContent>` içinde "Too many re-renders". Commit'siz `src` değişiklikleri geri alınıp **HEAD frontend'iyle de tekrarlandı**, sonuç aynı. Bu yüzden self-host'la ilgisi yok; HEAD'deki 4172297a/37e2725e PDKS değişiklikleri Cloud'a henüz yayınlanmadı. |
| Kart okuma | Yapılmadı (görev gereği, cihaz yok) |

## 7. Ölçümler

| Ölçüm | Değer |
|---|---|
| `compose up` → backend healthy | ~6 sn (ilk açılış); `down` 9 sn, `up` + healthy 12 sn |
| Deploy | 15 sn |
| Export / import | 5 sn / 16 sn (1,58 MB, 12.144 belge) |
| Boşta RAM | backend 1,07 GB · postgres 176 MB · dashboard 76 MB · proxy 2 MB → toplam ~1,3 GB |
| Smoke sırasında | backend en fazla %61 CPU (1 çekirdek, 8 çekirdekli makinenin ~%8'i), 1,10 GB · postgres %20 CPU, 180 MB · makine yükü en fazla 0,67 |
| Disk | Postgres verisi 302 MB (DB 118 MB) · backend volume 31 MB · imajlar ~510 MB · pg_dump 11 MB · export 1,6 MB |
| OOM / yeniden başlama | 0 / 0 (4 konteynerde de) |

## 8. Geri alma ve yedek

- **Tamamen kaldırma:** `cd /opt/ngs-convex && docker compose down` komutu yalnız `ngs-convex` projesinin 4 konteynerini ve 2 ağını kaldırır. Denendi: pafta-gotenberg ve systemd servisleri etkilenmedi. Veri `data/` altında kalır. İz bırakmadan silmek için ek olarak `rm -rf /opt/ngs-convex` ve `docker image rm` (4 imaj) gerekir. Bu adım ayrı onay ister: export ve secret'lar da silinir.
- **Kalıcılık denendi:** `down` → `up` sonrası veri yerinde (users 7 = 6 import + 1 prova).
- **Denenen yedek:** `docker compose exec -T postgres pg_dump -U convex -d convex_self_hosted -Fc > backup/pg-YYYYMMDD.dump` 2,7 sn sürdü, 11 MB, 0600.
- **Yedek önerisi (sunucu dışı depo henüz yok):**
  1. Gece 03:00'te iki yedek alınsın: mantıksal `convex export --include-file-storage` (taşınabilir, sürümden bağımsız) ve `pg_dump -Fc` (hızlı geri dönüş). İkisi de `age`/`restic` ile şifrelensin.
  2. Hedef, **farklı lokasyonda** bir Hetzner Storage Box (BX11, ~€4/ay, SFTP/restic) ya da Object Storage olsun. Aynı sunucudaki klasör yedek sayılmaz.
  3. Saklama: 7 günlük, 4 haftalık, 3 aylık nesil.
  4. Haftada bir boş bir konteynere restore + giriş testi yapılsın. Son başarılı yedek 26 saatten eskiyse alarm versin.
  5. `.env`, `secrets/`, compose dosyası ve imaj digest'leri ayrı bir kasada saklansın. `INSTANCE_SECRET` kaybolursa yedek açılamayabilir.

## 9. Sorunlar ve geçiş için kalanlar

**Bulunan sorunlar**
1. **Index adı 64 karakteri aşıyor** (`convex/schema.ts:45`, 37e2725e). HEAD self-host'a deploy olmuyor. Cloud'a bir sonraki yayında da aynı hatayı vermesi muhtemel (Cloud'da denenmedi). Düzeltme: indeksi daha kısa bir adla yeniden adlandırmak ve 3 kullanım yerini güncellemek.
2. **PDKS sayfası HEAD'de çöküyor** (`src/pages/PDKSRecords.tsx` `<PDKSContent>`, "Too many re-renders"). Bu prova verisiyle tekrarlanabiliyor.
3. **Cloud, HEAD'in gerisinde** (9 tablo eksik). Gerçek geçişte hangi commit'in yayınlanacağı ve yeni özet tablolarının backfill'i ayrıca planlanmalı.
4. Backend logunda "Running without a proxy in release mode — UDF `fetch` requests are unrestricted" uyarısı var. Paylaşılan sunucuda Node action'ları host'taki servislere (gateway `:8088` vb.) erişebilir. Provada ağ izolasyonu bu erişimi kapatıyor. Gerçek kurulumda çıkış yalnız gateway ve SMTP/Resend ile sınırlandırılmalı.

**Geçiş için kalanlar** (her biri ayrı onay ister)
- Önce: 1. ve 2. sorunların main'de düzeltilmesi · nginx vhost + TLS + DNS (`api.` → 3210, `site.` → 3211; WebSocket upgrade) · `CONVEX_CLOUD_ORIGIN/SITE_ORIGIN` için https adresleri · backend'e kontrollü dış erişim.
- Sonra: gerçek env aktarımı (`FINGERPRINT_TEMPLATE_KEY` ve `MAIL_SECRET_KEY` aynı kalmalı; JWT için karar) · mobil `CONVEX_URL` / `CONVEX_UPLOAD_ALLOWED_HOSTS` ile yeni binary · köprülerin `CONVEX_SITE_URL` değeri · cihazlardaki `HIK_FORWARDING_URL` httpHosts değerleri (D2) · dondurma → son export → `--replace-all` import → reconcile (gerçek mod) · sunucu dışı yedek + izleme/alarm.

## 10. Prova ortamına erişim

```sh
ssh -i ~/.ssh/id_ed25519_hetzner -N -L 3210:127.0.0.1:3210 -L 3211:127.0.0.1:3211 -L 6791:127.0.0.1:6791 root@157.90.114.86
# Dashboard: http://127.0.0.1:6791  (admin key: sunucuda /opt/ngs-convex/secrets/admin_key)
# Web: /tmp/ngs-selfhost içinde  VITE_CONVEX_URL=http://127.0.0.1:3210 VITE_CONVEX_SITE_URL=http://127.0.0.1:3211 npx vite --port 8083
```

`/tmp/ngs-selfhost` kopyası duruyor ama `.env.local` (admin key) silindi. CLI'yi tekrar kullanmak için `.env.local`'ı sunucudaki admin key ile yeniden yazmak gerekiyor. Bu kopyada `src` HEAD haline döndürüldü; `convex/` = HEAD + commit'siz diff + index adı kısaltması.
