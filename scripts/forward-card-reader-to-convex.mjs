#!/usr/bin/env node
/**
 * Hikvision → LAN'da bu makine (HTTP) → Convex (HTTPS)
 * Cihaz internet/DNS kullanamıyorsa: httpHosts URL'ini bu makinenin IP:port'una ayarla.
 *
 * Kullanım:
 *   CONVEX_CARD_READER_URL=https://notable-tern-4.convex.site/card-reader \
 *   FORWARD_PORT=8765 node scripts/forward-card-reader-to-convex.mjs
 *
 * Cihaz (ISAPI veya web): protocol HTTP, IP = bu bilgisayarın LAN IP'si, port 8765,
 * url = http://<BU_IP>:8765/card-reader
 */
import http from "node:http";
import https from "node:https";

const UPSTREAM =
  process.env.CONVEX_CARD_READER_URL ||
  "https://notable-tern-4.convex.site/card-reader";
const DEVICE_API_TOKEN = process.env.DEVICE_API_TOKEN || "";
const PORT = Number(process.env.FORWARD_PORT || "8765");

const server = http.createServer((req, res) => {
  if (req.url !== "/card-reader" && req.url !== "/card-reader/") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Sadece POST /card-reader" }));
    return;
  }
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        forwarder: true,
        upstream: UPSTREAM,
      })
    );
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const u = new URL(UPSTREAM);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        "Content-Length": String(body.length),
        ...(DEVICE_API_TOKEN
          ? { Authorization: `Bearer ${DEVICE_API_TOKEN}` }
          : {}),
      },
    };
    const r = https.request(opts, (up) => {
      const out = [];
      up.on("data", (d) => out.push(d));
      up.on("end", () => {
        res.writeHead(up.statusCode || 200, {
          "Content-Type": up.headers["content-type"] || "application/json",
        });
        res.end(Buffer.concat(out));
      });
    });
    r.on("error", (e) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message), upstream: UPSTREAM }));
    });
    r.write(body);
    r.end();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[forward] http://0.0.0.0:${PORT}/card-reader → ${UPSTREAM}`
  );
  console.log(
    "[forward] Cihazda URL ör: http://<BU_BILGISAYAR_IP>:" +
      PORT +
      "/card-reader (HTTP, protocolType HTTP)"
  );
});
