#!/usr/bin/env node
/**
 * IDE Smart panel event YAKALAYICI — panel kart event'lerinin HAM halini gösterir.
 * Senin makinende (panelle aynı LAN) çalışır; paneli bu sunucuya yönlendiririz.
 *
 * Kullanım:
 *   node scripts/ide-smart-capture.mjs          # 0.0.0.0:8090 dinler
 *   PORT=9000 node scripts/ide-smart-capture.mjs
 *
 * Sonra panelin HTTPCLIENT.HOST'unu bu makineye çevir (ide-smart-probe veya
 * ide-smart-point-here ile). Okuyucuya kart okut → event burada ham görünür.
 *
 * Her isteğe panelin beklediği başarı zarfını döner: result:"success".
 */

import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8090);

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const ts = new Date().toISOString();
    console.log(`\n┌─ ${ts}  ${req.method} ${req.url}  from ${req.socket.remoteAddress}`);
    console.log(`│ Content-Type: ${req.headers["content-type"] ?? "(yok)"}`);
    if (body) {
      console.log("│ BODY:");
      try {
        console.log(JSON.stringify(JSON.parse(body), null, 2).split("\n").map((l) => "│   " + l).join("\n"));
      } catch {
        console.log("│   " + body.slice(0, 2000));
      }
    } else {
      console.log("│ (boş body)");
    }
    console.log("└─");

    // Panele başarı zarfı dön (HB_PROCESS_RESPONSE=1 ise komut da gönderilebilir; şimdilik sade).
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ payload: { result: "success", message: "captured" } }));
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`IDE Smart event yakalayıcı dinliyor: http://0.0.0.0:${PORT}/`);
  console.log("Panel event'leri buraya gelince ham haliyle yazılacak. (Ctrl+C ile çık)");
});
