# Görev: Hik köprü uyandırma değişikliğini denetle (SALT-OKUMA)

## Hedef
Aşağıdaki diff'in sözleşme v1'e (yukarıdaki ortak bağlam) uygunluğunu, doğruluğunu ve güvenliğini denetle; her bulgu için
önem (kritik/yüksek/orta/düşük) + file:line + somut başarısızlık senaryosu + önerilen düzeltme ver. "Commit'e hazır mı: evet/hayır".

## Kapsam (yalnız bu dosyalar; worker raporlarına değil diff'e bak)
- Convex: `git diff convex/hikBridge.ts convex/hikvisionSync.ts convex/http.ts convex/schema.ts src/components/settings/sections/integrations/BridgeIntegrationCard.tsx`
  + yeni `convex/lib/hikWake.ts`, `convex/lib/hikWake.test.ts`, `convex/actions/hikBridgeWake.ts` (schema.ts'te yalnız `hikBridges` bloğu bu işe ait)
- Relay: `infra/hik-relay/**` (server.mjs, server.nodetest.mjs, nginx/systemd/RUNBOOK)
- Windows: `git diff bridge/windows/` + yeni `Services/WakeStreamClient.cs`, `Services/SseParser.cs`, `bridge/windows/NgAccess.HikvisionBridge.SelfTest/`

## Özellikle bak
1. Windows: eşzamanlılık (wake sinyali, debounce, 20 tur boşaltma, min 1 sn), iptal/kapanış, yeniden bağlanma + 401 bekleme,
   90 sn watchdog, bilet değişince yeniden bağlanma; "sürekli hızlı poll" geri gelebilecek herhangi bir yol (kota yangını riski —
   asıl amaç çağrı sayısını düşürmek). Relay yoksa/`wake:null` iken davranış = 900 sn poll mu?
2. Relay: timing-safe karşılaştırma, ts penceresi, rate limit, 3 bağlantı sınırı, bellek sızıntısı (kapanan bağlantı temizliği,
   rate-limit map'inin büyümesi), body limiti, log'da bilet/imza sızıntısı, nginx access log'da query string.
3. Convex: debounce doğruluğu (her iş kendisinden sonra ateşlenen bir uyandırmayla kapsanıyor mu), OCC çakışması
   (enqueue ↔ claimBridgeRoster aynı `hikBridges` belgesi), relay yapılandırılmamışken ek çağrı yakılıyor mu, teşhis logunda
   gizli bilgi (Authorization değeri) var mı, eski köprüyle geriye uyumluluk.
4. Sözleşme uyumu: üç parça aynı HMAC mesaj formatını, hex küçük harf, başlık adlarını, SSE olay adlarını kullanıyor mu.

## Kurallar
- HİÇBİR dosyaya yazma (rapor dahil — raporu `worker_done` gövdesine yaz). commit/push/deploy/SSH/`npx convex` YOK.
- Kapıları kendin koşabilirsin (salt-okuma): `node --test infra/hik-relay/server.nodetest.mjs`,
  `dotnet build bridge/windows/NgAccess.HikvisionBridge/NgAccess.HikvisionBridge.csproj -c Release`,
  `dotnet run --project bridge/windows/NgAccess.HikvisionBridge.SelfTest`, `npx vitest run convex/lib/hikWake.test.ts`.
- Rapor: `worker_done` gövdesinde en çok 12 bulgu, önem sırasıyla; sonunda "Commit'e hazır mı: evet/hayır".
