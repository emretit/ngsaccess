## Ortak bağlam — Hik köprüsü "uyandır + 15 dk emniyet poll'u" (plan: docs/HIK_BRIDGE_WAKE_PLAN.md)
Sorun: Windows Hik köprüsü `POST /hik-bridge/roster`'ı ~3 sn'de bir çağırıyor (ayda ~1,6M Convex fonksiyon çağrısı, Free ≈1M).
Çözüm: köprü 15 dk'da bir poll eder; Convex'te Hik localBridge işi kuyruğa girince Hetzner relay üzerinden köprüye
"wake" gönderilir, köprü hemen roster çeker. Üç parça paralel yazılıyor (Convex · Hetzner relay · Windows köprüsü);
aşağıdaki SÖZLEŞME üçünün ortak arayüzüdür. Sözleşmeyi DEĞİŞTİRME; değişiklik gerekiyorsa DUR ve `ask`.

## SÖZLEŞME v1
- Gizli anahtar: `HIK_RELAY_SECRET` (≥32 bayt rastgele; Convex env + relay env, aynı değer). Relay taban URL'i: `HIK_RELAY_URL`
  (Convex env, ör. `https://relay.ngsplus.app`, sonda `/` yok). Koda/repo'ya gerçek değer YAZILMAZ; `.env.example`'a yalnız anahtar adı.
- HMAC = HMAC-SHA256, çıktı küçük harf hex (64 karakter). Karşılaştırmalar timing-safe.
- **Stream bileti:** `ticket = HMAC(secret, "stream." + bridgeId)` — `bridgeId` = `hikBridges` belge `_id` (string).
- **Roster yanıtı** (`POST /hik-bridge/roster`, `ok:true`) mevcut alanlara EK iki alan (eski köprü yok sayar):
  - `nextPollSeconds: number` — sunucu ipucu, şimdilik 900. Köprü boşta bekleme tavanı olarak kullanır (30..3600 clamp).
  - `wake: { streamUrl: string, bridgeId: string, ticket: string } | null` — `streamUrl = HIK_RELAY_URL + "/hik-bridge/stream"`;
    `HIK_RELAY_URL` veya `HIK_RELAY_SECRET` yoksa `null` (özellik kapalı, köprü yalnız poll eder).
  - (v1.1) `nextDueInSeconds: number | null` — bu köprünün panellerinde backoff'ta bekleyen (henüz due olmayan, deneme hakkı
    kalan) en erken işin kaç sn sonra due olacağı (≥1, yukarı yuvarlanır); yoksa `null`. Köprü bekleme süresini
    `min(tavan, max(5, nextDueInSeconds))` yapar → geçici hatadaki retry'lar 15 dk beklemez, relay gerekmez.
- **Köprü → relay (SSE):** `GET {streamUrl}?bridge=<bridgeId>&ticket=<ticket>`, `Accept: text/event-stream`,
  `User-Agent: NgAccessHikBridge/<sürüm> (<MachineName>)`.
  - Bilet geçersiz → `401` (gövde `{"ok":false,"error":"unauthorized"}`), bağlantı kapanır.
  - Geçerli → `200`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, ilk satırlar `retry: 10000\n\n` +
    `event: ready\ndata: {"bridgeId":"<id>"}\n\n`; her 25 sn `: ping\n\n`; uyandırma `event: wake\ndata: {"ts":<unix ms>}\n\n`.
  - Bridge başına en fazla 3 eşzamanlı bağlantı: 4. gelince aynı bridgeId'nin EN ESKİ bağlantısı kapatılır (yarı-açık birikmesin).
- **Convex → relay (uyandır):** `POST {HIK_RELAY_URL}/hik-bridge/wake`, `Content-Type: application/json`,
  ham gövde `{"bridgeId":"<id>"}`, başlıklar `X-Ngs-Ts: <unix ms>` ve `X-Ngs-Signature: HMAC(secret, ts + "." + hamGövde)`.
  - Relay: `|now - ts| > 60000` → 401; imza uyuşmazsa 401; bridge başına 60 sn kayan pencerede 30 wake üstü → 429;
    başarı `200 {"ok":true,"delivered":<o bridgeId'ye yazılan açık bağlantı sayısı>}` (0 olabilir).
  - Convex tarafı en-iyi-çaba: 3 sn timeout, her hata/401/429 yutulur + `console.warn` (15 dk emniyet poll'u var).
- **Sağlık:** `GET /hik-bridge/health` → `200 {"ok":true,"bridges":<n>,"connections":<n>}` (kimlik/gizli bilgi yok).
- Relay veri TAŞIMAZ: personel/kart/şifre yine Convex roster'ından (bridge token ile) gelir; relay yalnız "uyan" der.

## Ortak kurallar
- Paralel başka worker'lar var, AYNI çalışma ağacında. YALNIZ Ownership listendeki dosyalara yaz (kendi klasörün altında yeni
  dosya serbest). Listede olmayan dosya gerekiyorsa DUR, `ask`. Ara kapıda başkasının dosyasından gelen hata seninki değil;
  raporda "kendi dosyalarım temiz / diğerleri: X" ayır. Çalışma ağacında bu işe ait olmayan commit'siz değişiklikler var
  (Dalga 3 UX) — onlara DOKUNMA, geri alma.
- `convex/schema.ts` koordinatöre aittir: `hikBridges.lastClientInfo?: string` ve `hikBridges.nextWakeAt?: number` EKLENDİ. Başka
  şema ihtiyacı → `ask`.
- commit / push / deploy / `npx convex dev|deploy` / migration / canlı DB yazma / SSH / Hetzner'e dosya kopyalama YOK.
  `npx convex run` YOK. Gerçek secret, token, IP-gizli değer yazma.
- Kod yorumları Türkçe ve mevcut dosyanın yoğunluğunda; TypeScript'te `any` yasak (unknown + narrowing).
- Rapor: `worker_done`'da ≤10 satır, file:line; koştuğun kapılar ve sonuçları; açık kalanlar.
