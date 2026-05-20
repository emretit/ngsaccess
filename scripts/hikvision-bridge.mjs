#!/usr/bin/env node
/**
 * Hikvision subscribeEvent → Convex bridge
 *
 * Cihazdan uzun-yaşayan bir HTTP bağlantısı açar (subscribeEvent),
 * gelen multipart event stream'ini parse eder ve her event'i Convex'e POST atar.
 *
 * Kullanım:
 *   HIK_IP=192.168.1.34 \
 *   HIK_USER=admin \
 *   HIK_PASS=şifre \
 *   CONVEX_URL=https://notable-tern-4.convex.site/card-reader \
 *   node scripts/hikvision-bridge.mjs
 *
 * Opsiyonel env:
 *   HIK_PORT=80            (varsayılan: 80)
 *   RECONNECT_DELAY_MS=5000 (varsayılan: 5000)
 */

import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";

const HIK_IP = process.env.HIK_IP || "192.168.1.34";
const HIK_PORT = Number(process.env.HIK_PORT || "80");
const HIK_USER = process.env.HIK_USER || "admin";
const HIK_PASS = process.env.HIK_PASS || "";
const DEVICE_API_TOKEN = process.env.DEVICE_API_TOKEN || "";
const CONVEX_URL =
  process.env.CONVEX_URL ||
  "https://notable-tern-4.convex.site/card-reader";
const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || "5000");

if (!HIK_PASS) {
  console.error("[bridge] HATA: HIK_PASS env değişkeni boş. Çıkılıyor.");
  process.exit(1);
}

let running = true;
let currentReq = null;

// ─── HTTP Digest Auth ──────────────────────────────────────────────────────

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

function parseWwwAuthenticate(header) {
  const fields = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(header)) !== null) {
    fields[m[1]] = m[2];
  }
  return fields;
}

function buildDigestHeader(method, path, wwwAuth) {
  const { realm, nonce, qop, opaque } = parseWwwAuthenticate(wwwAuth);
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");

  const ha1 = md5(`${HIK_USER}:${realm}:${HIK_PASS}`);
  const ha2 = md5(`${method}:${path}`);
  const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

  let header =
    `Digest username="${HIK_USER}", realm="${realm}", ` +
    `nonce="${nonce}", uri="${path}", ` +
    `qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  if (opaque) header += `, opaque="${opaque}"`;
  return header;
}

// ─── Convex'e POST ────────────────────────────────────────────────────────

function postToConvex(eventBody) {
  return new Promise((resolve) => {
    const buf = Buffer.from(
      typeof eventBody === "string" ? eventBody : JSON.stringify(eventBody)
    );
    const u = new URL(CONVEX_URL);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;

    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(buf.length),
        ...(DEVICE_API_TOKEN
          ? { Authorization: `Bearer ${DEVICE_API_TOKEN}` }
          : {}),
      },
    };

    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, body: text });
      });
    });

    req.on("error", (e) => {
      resolve({ status: 0, body: e.message });
    });

    req.write(buf);
    req.end();
  });
}

// ─── Event Parser ─────────────────────────────────────────────────────────

function makeMultipartParser(boundary, onEvent) {
  let buffer = "";
  const sep = `--${boundary}`;

  return function feed(chunk) {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf(sep)) !== -1) {
      const part = buffer.slice(0, idx);
      buffer = buffer.slice(idx + sep.length);
      // Başlık + çift CRLF
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd < 0) continue;
      const body = part.slice(headerEnd + 4).trim();
      if (!body) continue;
      onEvent(body);
    }
  };
}

// ─── Event bilgisi çıkar ──────────────────────────────────────────────────

function extractEventInfo(raw) {
  const cardNo = (raw.match(/"cardNo"\s*:\s*"([^"]+)"/) || [])[1];
  const major = (raw.match(/"majorEventType"\s*:\s*(\d+)/) || [])[1];
  const sub = (raw.match(/"subEventType"\s*:\s*(\d+)/) || [])[1];
  return { cardNo, major, sub };
}

/**
 * majorEventType=5 → Access Control Event (kart okutma, kapı vs.)
 * subEventType=75  → Card verification (fiilen kart okutuldu)
 * Diğerleri: heartbeat, durum bildirimi vb. → yoksay
 */
function isCardSwipeEvent(major, sub) {
  // majorEventType 5 = Access Control; subEventType 75 = card verification
  // subEventType 1-10 arası genelde kapı durum bildirimleri — bunları atla
  if (major !== "5") return false;
  // subEventType 75 kesin kart okutma; diğer 5'ler de genelde kart ile ilgili
  // ama kardNo yoksa zaten Convex'e göndermeye gerek yok
  return true;
}

// ─── subscribeEvent stream ────────────────────────────────────────────────

async function connect() {
  const path = "/ISAPI/Event/notification/subscribeEvent";
  const body = `<SubscribeEvent version="2.0"><eventMode>all</eventMode></SubscribeEvent>`;
  const bodyBuf = Buffer.from(body);

  // İlk istek → 401 al, Digest header'ı oluştur
  const authHeader = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HIK_IP,
        port: HIK_PORT,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "Content-Length": String(bodyBuf.length),
        },
      },
      (res) => {
        res.resume(); // body'yi tüket
        if (res.statusCode === 401) {
          const wwwAuth = res.headers["www-authenticate"] || "";
          try {
            resolve(buildDigestHeader("POST", path, wwwAuth));
          } catch (e) {
            reject(new Error(`Digest parse hatası: ${e.message}`));
          }
        } else {
          reject(new Error(`Beklenmeyen HTTP ${res.statusCode} (auth olmadan)`));
        }
      }
    );
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });

  console.log(`[bridge] ${HIK_IP} → subscribeEvent bağlanılıyor...`);

  // İkinci istek → Digest auth ile stream aç
  await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HIK_IP,
        port: HIK_PORT,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "Content-Length": String(bodyBuf.length),
          Authorization: authHeader,
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`subscribeEvent HTTP ${res.statusCode}`));
          return;
        }

        const ct = res.headers["content-type"] || "";
        const bm = ct.match(/boundary=([^\s;]+)/);
        const boundary = bm ? bm[1].replace(/^"/, "").replace(/"$/, "") : null;

        console.log(`[bridge] Bağlantı kuruldu. Content-Type: ${ct}`);

        if (!boundary) {
          // Boundary yoksa raw text olarak logla
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            console.log("[bridge] Raw data:", chunk.slice(0, 200));
          });
          res.on("end", resolve);
          return;
        }

        const feed = makeMultipartParser(boundary, async (eventBody) => {
          const { cardNo, major, sub } = extractEventInfo(eventBody);

          // Kart no yoksa veya Access Control event değilse atla (heartbeat vb.)
          if (!cardNo || !isCardSwipeEvent(major, sub)) {
            console.log(`[bridge] Atlandı │ major=${major ?? "?"} sub=${sub ?? "?"} cardNo=${cardNo ?? "(yok)"}`);
            return;
          }

          console.log(`[bridge] Kart okutuldu │ cardNo=${cardNo} major=${major} sub=${sub}`);

          const result = await postToConvex(eventBody);
          let granted = "?";
          try {
            const parsed = JSON.parse(result.body);
            granted = parsed.checkResult === "success" ? "true" : "false";
          } catch {
            granted = `HTTP ${result.status}`;
          }
          console.log(`[bridge]   → Convex: granted=${granted} │ ${result.body.slice(0, 120)}`);
        });

        res.setEncoding("utf8");
        res.on("data", feed);
        res.on("end", () => {
          console.log("[bridge] Stream kapandı.");
          resolve();
        });
        res.on("error", reject);
      }
    );

    currentReq = req;
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ─── Ana döngü ────────────────────────────────────────────────────────────

async function main() {
  console.log(`[bridge] Başlatıldı`);
  console.log(`[bridge] Cihaz : http://${HIK_IP}:${HIK_PORT}`);
  console.log(`[bridge] Convex: ${CONVEX_URL}`);
  console.log(`[bridge] SIGINT ile durdur\n`);

  while (running) {
    try {
      await connect();
    } catch (err) {
      if (!running) break;
      console.error(`[bridge] Hata: ${err.message}`);
      console.log(`[bridge] ${RECONNECT_DELAY_MS / 1000}s sonra yeniden bağlanılıyor...`);
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
    }
  }

  console.log("[bridge] Durduruldu.");
}

process.on("SIGINT", () => {
  running = false;
  if (currentReq) currentReq.destroy();
  console.log("\n[bridge] SIGINT alındı, kapatılıyor...");
  process.exit(0);
});

main();
