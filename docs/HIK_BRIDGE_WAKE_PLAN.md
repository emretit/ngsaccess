# Hik Windows köprüsü — 3 sn polling yerine "uyandır + 15 dk emniyet poll'u" planı (2026-10-16)

## Checklist
### Faz 0 — Tespit ve acil durdurma
- [x] 0.0 Baz ölçüm (2026-10-16 17:05): hâlâ ~3,2 sn'de bir roster (11 dk'da 205 çağrı)
- [x] 0.1 Poll eden köprü bulundu (2026-10-16 17:50 deploy sonrası log): çıkış IP'si `95.70.206.84` (TurkNet Gayrettepe) = bu Mac'in internet çıkışıyla AYNI → köprü aynı yerel ağdaki bir Windows makinede (Mac'te/VM'de değil). User-Agent yok → eski köprü sürümü. Kalan: hangi PC olduğunu kullanıcı belirler.
- [ ] 0.2 O makinede appsettings 900/900 + servis restart (ya da 1.1.0 installer)
### Faz 1 — Convex (uyandırma tetiği) — CANLIDA (2026-10-16 17:47, commit 4b242c8 + 5cab086)
- [x] 1.1 `actions/hikBridgeWake.ts` internalAction: relay'e HMAC imzalı POST, 3 sn timeout, en-iyi-çaba
- [x] 1.2 `enqueueLocalBridgeOperation` + `retrySyncIssue` → `scheduleBridgeWakeForProject` (≤1 wake / 2 sn / köprü, `hikBridges.nextWakeAt`)
- [x] 1.3 Roster: `lastSeenAt` 60 sn'de bir, yanıta `nextPollSeconds: 900`, `nextDueInSeconds` (retry ipucu), `wake {streamUrl,bridgeId,ticket}`
### Faz 2 — Hetzner relay — KOD commit'li (0a9cabc), sunucuya kurulum YOK
- [x] 2.1 `infra/hik-relay/server.mjs` (bağımlılıksız Node, SSE + imzalı wake, 3 bağlantı/30 wake-dk sınırı) + 12 node testi
- [x] 2.2 nginx (limit_req, query'siz log) + systemd + `RUNBOOK.md` hazır
- [ ] 2.3 DNS A kaydı `relay.ngsplus.app → 157.90.114.86` (ngsplus.app DNS'i şu an Netlify/NS1'de; kullanıcı Cloudflare istiyor → karar bekliyor) → RUNBOOK ile kurulum + `npx convex env set HIK_RELAY_URL/HIK_RELAY_SECRET`
### Faz 3 — Windows köprüsü 1.1.0 — KOD commit'li (674fb6f), installer YOK
- [x] 3.1 `WakeStreamClient` (SSE, 90 sn watchdog, backoff ≥60 sn yaşamadan sıfırlanmaz, ready-poll ≤1/5 dk, 401 bekleme, yalnız https)
- [x] 3.2 Wake → 1 sn debounce → roster; iş varsa ≤20 tur boşaltma; saatte en fazla 240 roster (kota emniyeti); hata backoff 5→300 sn
- [ ] 3.3 Installer build (Docker+NSIS) + sahada kurulum
### Faz 4 — Doğrulama
- [ ] 4.1 Uçtan uca test (kart ekle/sil, Kapıyı Aç ≤ 3 sn)
- [ ] 4.2 Bir hafta çağrı ölçümü (hedef < 20K/ay)

Kanıt (koordinatör koşumu, 2026-10-16): app+convex tsc 0 · eslint 0 · vitest 72/654 · relay node --test 12/12 · dotnet build 0 hata/0 uyarı · SelfTest 60/60. Claude sonnet denetimi: 2 yüksek + 3 orta bulgu → düzeltildi.
Sıra (önemli): önce Convex deploy (+relay), SONRA köprü 1.1.0 — yeni köprü eski Convex'le 15 dk gecikir.

---

## 1. Sorun (ölçüm)
- `npx convex logs --history 3000 --success --jsonl` (26,7 dk, 1050 olay): %96 `POST /hik-bridge/roster` + `hikBridge:claimBridgeRoster`, medyan aralık 3,2 sn, tek köprü kaydı (`hikBridges` r97075th…, proje mn79e5tp…).
- Ayda ≈ 1,6M fonksiyon çağrısı (Free plan ≈ 1M) + her poll'da `lastSeenAt` yazımı.
- Kaynak koddaki backoff (boşta 3→30 sn) sahada çalışmıyor → kurulu EXE eski ya da ayar farklı. Kodda varsayılan artık 900/900 (bridge/windows/NgAccess.HikvisionBridge/{appsettings.json,Options.cs}, commit'siz).

## 2. Polling ne yapıyor (neden vardı)
Her `roster` çağrısında Convex (`convex/hikBridge.ts` `claimBridgeRoster`):
1. `hikBridges.lastSeenAt` günceller ("Son bağlantı").
2. Projedeki `hikTransport=localBridge` Hikvision panellerini (IP/port/kullanıcı/şifre/apiToken) döner → köprü panel worker'larını başlatır/durdurur.
3. Bekleyen `hikPendingOperations`'ı claim edip döner (kişi/kart ekle-sil, yüz/parmak izi, zaman planı, openDoor); köprü SDK ile uygular, `/hik-bridge/ack` ile sonucu bildirir.
Kart okuma olayları bu döngüden bağımsız (köprü SDK callback'iyle `/card-reader`'a anında basar).
Polling'in tek gerekçesi: Convex müşteri ağındaki (NAT arkası) köprüye bağlantı açamaz.

## 3. Hedef mimari
```
Web (kart ekle / sil / Kapıyı Aç)
   └─> Convex mutation → hikPendingOperations (pending)
          └─> scheduler.runAfter(0) hikBridgeWake (action, debounce)
                 └─> POST https://<hetzner>/hik-bridge/wake  {bridgeId}  (HMAC imzalı)
                        └─> Relay: o bridgeId'nin açık SSE bağlantısına "event: wake"
                               └─> Windows köprüsü: hemen roster çek → panele uygula → ack
Emniyet ağı: köprü her 15 dk'da bir roster çeker (mesaj kaçarsa / relay düşerse).
```
- Neden SSE (MQTT değil): köprü yalnız dışarı 443/HTTPS açar → müşteri güvenlik duvarında en az sorun; .NET'te ek kütüphane gerekmez (HttpClient streaming). IDE için Hetzner'de MQTT var ama Windows'a 1883/8883 açtırmak ek risk.
- Neden Convex WebSocket aboneliği değil: resmi .NET istemcisi yok; protokolü elle yazmak kırılgan.

## 4. Faz ayrıntıları

### Faz 0 — Tespit (önce bu)
- 0.1 `/hik-bridge/roster` HTTP action'ına geçici, örneklemeli (1/50) log: `user-agent`, `x-forwarded-for`/`cf-connecting-ip` başlıkları, köprü versiyonu (varsa). Köprü kodunda `User-Agent: NgAccessHikBridge/<versiyon> (<hostname>)` yoksa Faz 3'te ekle. Alternatif: bridge token'ı yenile (UI'dan) → eski kurulum "unauthorized" alır; hangi makinenin bozulduğunu sahadan öğren. Not: token iptali çağrıyı durdurmaz (her ret de çağrı sayılır), yalnız kimliği ortaya çıkarır.
- 0.2 Bulunan makinede: `C:\Program Files\NgAccessHikvisionBridge\appsettings.json` → `PollIntervalSeconds: 900`, `PollMaxIntervalSeconds: 900`; `sc stop NgAccessHikvisionBridge && sc start NgAccessHikvisionBridge`. Köprü kullanılmıyorsa servisi durdur/kaldır.

### Faz 1 — Convex
- 1.1 `convex/actions/hikBridgeWake.ts` (`internalAction`): `{ bridgeId }` → `fetch(HIK_WAKE_URL, { method: "POST", headers: { "x-ngs-signature": HMAC_SHA256(HIK_WAKE_SECRET, body+timestamp), "x-ngs-ts": ts }, body: { bridgeId } })`, 3 sn timeout, hata yutulur + loglanır (uyandırma en-iyi-çaba; emniyet poll'u var). Env: `HIK_WAKE_URL`, `HIK_WAKE_SECRET` (Convex env, `.env.example`'a yalnız isim).
- 1.2 Tetik: `convex/hikvisionSync.ts` `enqueueLocalBridgeOperation` (localBridge op'larının tek giriş noktası — grep ile doğrula) içinde op eklendikten sonra `scheduler.runAfter(0, internal.actions.hikBridgeWake.wake, { bridgeId })`. Debounce: `hikBridges.lastWakeAt` alanı — son 2 sn içinde uyandırıldıysa tekrar planlama (toplu personel eklemede 100 op = 1 uyandırma). Şema: `hikBridges.lastWakeAt?: number` (widen, geriye uyumlu).
- 1.3 `claimBridgeRoster`: `lastSeenAt` yazımını 60 sn'de bire indir (yazma ↓); yanıta `nextPollSeconds: 900` ekle (yeni köprü bunu tavan olarak kullanır; eski köprü yok sayar).
- Maliyet: her işlemde +1 action çağrısı (uyandırma) + 1 roster + 1 ack. Boşta: 15 dk'da 1 roster ≈ 2.9K/ay.

### Faz 2 — Hetzner relay (157.90.114.86)
- 2.1 `/opt/ngs-hik-relay/server.mjs` (Node, bağımlılıksız `http`):
  - `GET /hik-bridge/stream?bridge=<id>` + `Authorization: Bearer <bridgeToken>` → token doğrulaması için Convex'e tek seferlik `POST /hik-bridge/verify` (yeni, hafif HTTP action; sonuç 10 dk cache). Geçerliyse SSE açık tutulur, 25 sn'de bir `: ping` (proxy zaman aşımına karşı).
  - `POST /hik-bridge/wake` → HMAC + zaman damgası (±60 sn) doğrula → bridgeId'nin açık bağlantılarına `event: wake\ndata: {}\n\n`. Bağlantı yoksa 202 + log (emniyet poll'u yakalar).
  - Bellek içi `Map<bridgeId, Set<res>>`; tek süreç yeterli (köprü sayısı düşük).
- 2.2 nginx: yeni `server_name` veya mevcut site altında `/hik-relay/` → `proxy_pass http://127.0.0.1:<port>`, `proxy_buffering off`, `proxy_read_timeout 3600s`; TLS (Let's Encrypt; alan adı gerekir — açık soru). systemd unit `ngs-hik-relay.service` (restart=always), log `journalctl`.
- Runbook: `docs/HETZNER_CARD_READER_BRIDGE.md`'ye "Hik relay" bölümü.

### Faz 3 — Windows köprüsü (bridge/windows/NgAccess.HikvisionBridge)
- 3.1 `Services/WakeStreamClient.cs`: `HttpClient` + `HttpCompletionOption.ResponseHeadersRead`, satır satır SSE okuma; kopunca üstel bekleme (1→60 sn, jitter); token `bridge.json`'dan. Options: `WakeStreamUrl` (boşsa özellik kapalı → yalnız poll).
- 3.2 `BridgeWorker`: bekleme `Task.Delay(interval)` yerine `Task.WhenAny(Delay(interval), wakeSignal)`; wake gelince 1 sn debounce + hemen `PollRosterAsync`. Op varken mevcut "aktifse tabana dön" mantığı korunur (tabana = 900 sn yerine hemen bir kez daha poll, sonra 900).
- 3.3 `User-Agent: NgAccessHikBridge/<versiyon> (<MachineName>)` başlığı (Faz 0 tespiti için kalıcı). Yerel UI'da "Uyandırma kanalı: bağlı/kopuk" durumu.
- 3.4 Installer: mevcut Docker+NSIS akışı (memory: bridge_installer_build) — `npm run build:hikvision-windows-bridge` + `makensis`; appsettings varsayılanları 900/900 + `WakeStreamUrl`.

### Faz 4 — Doğrulama
- 4.1 Sahada: kart ekle → panelde ≤ 3 sn; personel sil → panelden ≤ 3 sn; Kapıyı Aç ≤ 3 sn; relay'i durdur → işlem en geç 15 dk'da gider (emniyet ağı).
- 4.2 `npx convex logs --history 3000 --success --jsonl` ile günlük sayım; hedef: boşta saatte ≤ 4 roster, ayda < 20K toplam.

## 5. Güvenlik
- Relay yalnız "uyan" der, veri taşımaz (personel/kart bilgisi yine Convex'ten token'lı roster ile gelir).
- `/wake` HMAC + timestamp (replay koruması); `/stream` bridge token'ı Convex'te doğrulanır; secret'lar koda yazılmaz (Convex env + Hetzner `/etc/ngs-hik-relay.env`).
- Relay ele geçirilse en kötü durumda köprüyü sık poll ettirir (DoS benzeri maliyet) → relay'de bridge başına dakikada en fazla 30 wake sınırı.

## 6. Açık sorular (kullanıcı)
1. Relay için alan adı (TLS): ör. `relay.ngsplus.app` → Hetzner IP'ye A kaydı açılabilir mi?
2. Şu an poll eden köprü hangi makinede (Faz 0) — müşteri sahası mı, test PC mi?
3. 15 dk emniyet aralığı uygun mu (relay düşerse işlem en geç 15 dk gecikir)?

## 7. Tahmini süre
Faz 0: 30 dk (+ saha erişimi) · Faz 1: ~2 saat · Faz 2: ~2 saat · Faz 3: ~3 saat + installer · Faz 4: saha testi 30 dk + 1 hafta ölçüm. Toplam ≈ 1 iş günü.
