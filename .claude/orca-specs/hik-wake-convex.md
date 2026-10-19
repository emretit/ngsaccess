# Görev: Hik köprü uyandırma — Convex tarafı (Faz 0.1 + Faz 1)

## Hedef
Hik localBridge işi kuyruğa girince (veya kullanıcı tek işlemi yeniden denerse) projedeki köprü(ler) için ≤1 uyandırma/2 sn
planlanır ve `internal.actions.hikBridgeWake.wake` relay'e imzalı POST atar; roster yanıtı sözleşmedeki `nextPollSeconds` +
`wake` alanlarını döner; `lastSeenAt` yazımı 60 sn'de bire iner — vitest ile kanıtlanır.

## Ownership (yalnız bunlar)
- `convex/lib/hikWake.ts` (YENİ) + `convex/lib/hikWake.test.ts` (YENİ) — saf yardımcılar
- `convex/actions/hikBridgeWake.ts` (YENİ) — `internalAction wake({ bridgeId: v.id("hikBridges") })`
- `convex/hikBridge.ts` — `claimBridgeRoster`, `listBridges`, uyandırma planlama yardımcısı
- `convex/hikvisionSync.ts` — YALNIZ `enqueueLocalBridgeOperation` ve `retrySyncIssue` içine uyandırma çağrısı
- `convex/http.ts` — YALNIZ `POST /hik-bridge/roster` route'u
- `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx` — köprü kartında istemci bilgisi + poll notu
- `convex/_generated/api.d.ts` — YALNIZ yeni modüllerin import + `fullApi` satırları, mevcut desenle elle (`npx convex codegen/dev` YOK)

## Yapılacaklar
1. `lib/hikWake.ts` (Web Crypto `crypto.subtle`, Node/vitest'te de çalışır):
   - `hmacHex(secret, message): Promise<string>` (HMAC-SHA256, küçük harf hex) · `streamTicket(secret, bridgeId)` =
     `hmacHex(secret, "stream." + bridgeId)` · `signWakeRequest(secret, ts, rawBody)` = `hmacHex(secret, ts + "." + rawBody)`.
   - `planNextWake(now, nextWakeAt | undefined, minGapMs = 2000): { schedule: false } | { schedule: true; fireAt: number }`:
     `nextWakeAt >= now` → planlı uyandırma bu işi zaten kapsıyor → `schedule:false`; aksi halde
     `fireAt = (nextWakeAt !== undefined && now - nextWakeAt < minGapMs) ? nextWakeAt + minGapMs : now`.
   - `relayConfig(env)`: `HIK_RELAY_URL` (sondaki `/` kırpılır) + `HIK_RELAY_SECRET` ikisi de doluysa `{ url, secret }`, değilse `null`.
   - `NEXT_POLL_SECONDS = 900`.
2. Uyandırma planlama (`hikBridge.ts`, mutation içinden çağrılan yardımcı `scheduleBridgeWakeForProject(ctx, projectId)`):
   relay yapılandırılmamışsa HİÇBİR ŞEY yapma (boş çağrı yakma). Varsa `hikBridges.by_project` (`take(10)`) her köprü için
   `planNextWake` → `schedule` ise `patch(nextWakeAt = fireAt)` + `ctx.scheduler.runAt(fireAt, internal.actions.hikBridgeWake.wake, { bridgeId })`.
   Proje = cihazın `projectId`'si (`claimBridgeRoster` köprünün projesindeki cihazları döndürür). projectId yoksa atla.
3. `enqueueLocalBridgeOperation`: hem dedupe-patch hem insert dalında, işlem yazıldıktan SONRA planla. `retrySyncIssue`:
   op `pending`'e çekildikten sonra planla. Diğer pending geçişleri (cron requeue, ack retry backoff) uyandırmaz — emniyet poll'u yeter.
4. `actions/hikBridgeWake.ts`: `relayConfig(process.env)` null → return. `rawBody = JSON.stringify({ bridgeId })`, `ts = Date.now()`,
   imza başlıklarıyla `fetch(url + "/hik-bridge/wake")`, `AbortController` 3 sn; her hata/2xx-dışı `console.warn` (secret/ticket loglama YOK),
   asla throw etme. Köprü silinmişse sorun değil (relay 200 delivered:0 döner).
5. `claimBridgeRoster`: args'a `clientInfo: v.optional(v.string())`. `lastSeenAt` yalnız `!lastSeenAt || now - lastSeenAt >= 60_000`
   ise yazılır; aynı patch'te `clientInfo` (≤200 karakter) değiştiyse `lastClientInfo` da yazılır. Yanıta `bridgeId` (string) ekle.
   Mevcut cihaz/op davranışına dokunma.
6. `http.ts` roster route: `clientInfo = request.headers.get("user-agent")?.slice(0, 200)` mutation'a geçer. Başarılı yanıt
   `{ ...result, nextPollSeconds: NEXT_POLL_SECONDS, wake }` — `wake` relay config varsa `{ streamUrl: url + "/hik-bridge/stream",
   bridgeId, ticket: await streamTicket(secret, bridgeId) }`, yoksa `null` (ticket httpAction'da hesaplanır, mutation'da değil).
   **Faz 0.1 geçici teşhis:** `Math.random() < 1/50` ise tek satır `console.log("[hik-bridge/roster] client", JSON.stringify({ ua,
   xff, realIp, cfIp, headerNames }))` (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, başlık ADLARI listesi; Authorization DEĞERİ
   ASLA). Üstüne `// TODO(Faz 0): köprü tespit edilince kaldır` yorumu.
7. `listBridges` dönüşüne `lastClientInfo` ekle. `BridgeIntegrationCard.tsx`: "Son bağlantı" altında `lastClientInfo` varsa küçük
   ikincil metin; kısa not: "Köprü 15 dakikada bir yoklar; işlem olunca anında uyandırılır." (mevcut stil/token'larla, sabit renk yok).
8. Testler (`hikWake.test.ts`): HMAC'i `node:crypto` `createHmac` ile karşılaştır; `planNextWake` (ilk, kapsanan, 2 sn içinde ardışık,
   2 sn sonrası) ; `relayConfig` (eksik/boş/sonda `/`).

## Kapsam dışı
Relay (`infra/hik-relay/**`) ve Windows köprüsü başka worker'larda. `/hik-bridge/poll` (eski per-device akış) değişmez. Şema değişmez
(alanlar eklendi). Dalga 3 UX dosyaları.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 (yalnız kendi dosyaların; diğerleri raporda ayrı)
- `node_modules/.bin/eslint convex src/components/settings/sections/integrations` → 0 error
- `npx vitest run` → hepsi yeşil
