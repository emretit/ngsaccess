#!/usr/bin/env node
/**
 * IDE Smart panel -> bu makine (LAN, HTTP) -> Convex /card-reader (HTTPS)
 *
 * Panel LAN-only; Convex cloud LAN'a giremez. Bu relay aradaki koprudur:
 *   - Panelin POST'unu HAM loglar (gorunurluk).
 *   - Convex /card-reader'a forward eder (gerekirse Authorization: Bearer enjekte).
 *   - Panele, panelin bekledigi {payload:{result:"success"}} zarfini doner
 *     (Convex {cevap,checkResult} dondugu icin panel "delivery failed" saymasin).
 *
 * Panel ayari (ide-smart-set-http-target.mjs ile): HTTPC.HOST=<bu makine IP>, HTTPC.PORT=<PORT>,
 *   LOGGER.PROTOCOL=HTTP, LOGGER.AC_LOG_PATH=/card-reader.
 *
 * Kullanim:
 *   PORT=8090 \
 *   CONVEX_CARD_READER_URL=https://notable-tern-4.convex.site/card-reader \
 *   [DEVICE_API_TOKEN=<token>] \
 *   node scripts/ide-smart-relay.mjs
 */
import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 8090);
const UPSTREAM =
  process.env.CONVEX_CARD_READER_URL ||
  "https://notable-tern-4.convex.site/card-reader";
const DEVICE_API_TOKEN = process.env.DEVICE_API_TOKEN || "";

function shortBody(buf) {
  const s = buf.toString("utf8");
  try {
    return JSON.stringify(JSON.parse(s));
  } catch {
    return s.slice(0, 500);
  }
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const ts = new Date().toISOString();
    const parsed = (() => {
      try {
        return JSON.parse(body.toString("utf8"));
      } catch {
        return null;
      }
    })();
    const type = parsed?.transaction?.type ?? "?";
    // Heartbeat'i kisa, access_event'i tam logla.
    if (type === "heartbeat") {
      console.log(`[${ts}] heartbeat  src=${parsed?.transaction?.["src-id"]}`);
    } else {
      console.log(`[${ts}] ${type}  ${shortBody(body)}`);
    }

    if (req.method !== "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ payload: { result: "success", message: "ok" } }));
      return;
    }

    const u = new URL(UPSTREAM);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        "Content-Length": String(body.length),
        ...(DEVICE_API_TOKEN ? { Authorization: `Bearer ${DEVICE_API_TOKEN}` } : {}),
      },
    };
    const r = https.request(opts, (up) => {
      const out = [];
      up.on("data", (d) => out.push(d));
      up.on("end", () => {
        const upBody = Buffer.concat(out).toString("utf8");
        const ok = (up.statusCode ?? 0) >= 200 && (up.statusCode ?? 0) < 300;
        if (type !== "heartbeat") {
          console.log(`   -> convex ${up.statusCode}: ${upBody.slice(0, 200)}`);
        }
        // Panele SADECE Convex 2xx ise basari don; aksi halde "fail" → panel
        // event'i offline kuyruğa alıp tekrar dener (sessiz veri kaybını önler).
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            payload: ok
              ? { result: "success", message: "ok" }
              : { result: "fail", message: `convex ${up.statusCode}` },
          }),
        );
      });
    });
    r.on("error", (e) => {
      console.log(`   -> convex ERROR: ${e.message}`);
      // Upstream'e ulaşılamadı → panel tekrar denesin diye "fail" don.
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ payload: { result: "fail", message: "upstream error" } }));
    });
    r.write(body);
    r.end();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[ide-relay] http://0.0.0.0:${PORT}/  ->  ${UPSTREAM}`);
  console.log(`[ide-relay] token: ${DEVICE_API_TOKEN ? "var (enjekte ediliyor)" : "yok"}`);
  console.log("[ide-relay] Panel event'leri burada gorunecek. Kart okut.");
});
